/**
 * SQLite Message Helper
 * Funciones auxiliares para guardar mensajes en SQLite
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('SQLITE_MESSAGE_HELPER');

/**
 * Guardar mensaje en SQLite
 * @param {Object} messageData - Datos del mensaje
 * @param {string} messageData.contact_id - ID del contacto
 * @param {string} messageData.type - Tipo de mensaje (text, image, etc)
 * @param {string} messageData.direction - Dirección (inbound, outbound)
 * @param {string} messageData.content - Contenido del mensaje
 * @param {string} messageData.media_url - URL de media (opcional)
 * @param {string} messageData.status - Estado (received, sent, delivered, read, failed)
 * @param {string} messageData.message_id - ID del mensaje de WhatsApp
 * @returns {Promise<void>}
 */
export async function saveMessageToSQLite(messageData) {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const {
      contact_id,
      type,
      direction,
      content,
      media_url,
      status,
      message_id,
      conversation_id
    } = messageData;

    const now = new Date().toISOString();

    // Si no hay conversation_id, obtenerlo del contact_id
    const getConversationId = (callback) => {
      if (conversation_id) {
        callback(conversation_id);
      } else {
        // Obtener o crear una conversación para este contacto
        db.get(
          'SELECT id FROM conversations WHERE contact_id = ? LIMIT 1',
          [contact_id],
          (err, row) => {
            if (row) {
              callback(row.id);
            } else {
              // Crear una conversación si no existe
              db.run(
                'INSERT INTO conversations (contact_id, status, created_at, updated_at) VALUES (?, ?, ?, ?)',
                [contact_id, 'active', now, now],
                function(err) {
                  if (err) {
                    logger.warn(`⚠️ No se pudo crear conversación: ${err.message}`);
                    callback(null); // Continuar sin conversation_id
                  } else {
                    callback(this.lastID);
                  }
                }
              );
            }
          }
        );
      }
    };

    getConversationId((convId) => {
      const sql = `INSERT INTO messages (
        contact_id, conversation_id, type, direction, content, media_url, status, 
        message_id, timestamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const params = [
        contact_id,
        convId || 1, // Usar conversación por defecto si no hay
        type || 'text',
        direction,
        content || '',
        media_url || null,
        status,
        message_id,
        now,
        now
      ];

      db.run(sql, params, function(err) {
        if (err) {
          logger.error('❌ Error saving message to SQLite:', err.message);
          db.close();
          reject(err);
        } else {
          logger.info(`💾 Message saved to SQLite`, {
            contactId: contact_id,
            type,
            direction,
            status,
            messageId: message_id
          });
          db.close();
          resolve({ id: this.lastID });
        }
      });
    });
  });
}

/**
 * Obtener contact_id por número de teléfono
 * @param {string} phoneNumber - Número de teléfono
 * @returns {Promise<number|null>} ID del contacto o null
 */
export async function getContactIdByPhone(phoneNumber) {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    db.get(
      'SELECT id FROM contacts WHERE phone_number = ?',
      [phoneNumber],
      (err, row) => {
        db.close();
        if (err) {
          logger.error('❌ Error getting contact:', err.message);
          reject(err);
        } else {
          resolve(row ? row.id : null);
        }
      }
    );
  });
}

/**
 * Crear o actualizar contacto
 * @param {string} phoneNumber - Número de teléfono
 * @param {string} name - Nombre del contacto
 * @returns {Promise<number>} ID del contacto
 */
export async function createOrUpdateContact(phoneNumber, name = null) {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const now = new Date().toISOString();

    // Primero intentar obtener el contacto
    db.get(
      'SELECT id FROM contacts WHERE phone_number = ?',
      [phoneNumber],
      (err, row) => {
        if (err) {
          db.close();
          logger.error('❌ Error checking contact:', err.message);
          reject(err);
          return;
        }

        if (row) {
          // Contacto existe, actualizar si hay nombre
          if (name && name.trim()) {
            db.run(
              'UPDATE contacts SET name = ?, updated_at = ? WHERE id = ?',
              [name, now, row.id],
              (err) => {
                db.close();
                if (err) {
                  logger.error('❌ Error updating contact:', err.message);
                  reject(err);
                } else {
                  logger.info(`✅ Contact updated: ${phoneNumber}`);
                  resolve(row.id);
                }
              }
            );
          } else {
            db.close();
            resolve(row.id);
          }
        } else {
          // Crear nuevo contacto
          db.run(
            `INSERT INTO contacts (phone_number, name, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [phoneNumber, name || phoneNumber, 'active', now, now],
            function(err) {
              db.close();
              if (err) {
                logger.error('❌ Error creating contact:', err.message);
                reject(err);
              } else {
                logger.info(`✅ Contact created: ${phoneNumber}`);
                resolve(this.lastID);
              }
            }
          );
        }
      }
    );
  });
}

/**
 * Actualizar estado de mensaje
 * @param {string} messageId - ID del mensaje de WhatsApp
 * @param {string} status - Nuevo estado
 * @returns {Promise<void>}
 */
export async function updateMessageStatus(messageId, status) {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const now = new Date().toISOString();

    db.run(
      'UPDATE messages SET status = ?, updated_at = ? WHERE message_id = ?',
      [status, now, messageId],
      (err) => {
        db.close();
        if (err) {
          logger.error('❌ Error updating message status:', err.message);
          reject(err);
        } else {
          logger.info(`✅ Message status updated: ${messageId} → ${status}`);
          resolve();
        }
      }
    );
  });
}

export default {
  saveMessageToSQLite,
  getContactIdByPhone,
  createOrUpdateContact,
  updateMessageStatus
};

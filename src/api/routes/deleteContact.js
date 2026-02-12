/**
 * Rutas para eliminar contactos y todo lo relacionado
 * Elimina: contacto, mensajes, archivos, etc.
 */

import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('DELETE_CONTACT');

const DB_PATH = path.join(process.cwd(), 'data', 'database.sqlite');

/**
 * Eliminar contacto y todo lo relacionado
 * DELETE /api/contacts/:contactId
 */
router.delete('/:contactId', async (req, res) => {
  const { contactId } = req.params;
  
  if (!contactId) {
    return res.status(400).json({
      success: false,
      error: 'contactId es requerido'
    });
  }

  const db = new sqlite3.Database(DB_PATH);

  try {
    logger.info(`🗑️  Iniciando eliminación de contacto: ${contactId}`);

    // Obtener información del contacto
    const contact = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM contacts WHERE id = ?', [contactId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!contact) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Contacto no encontrado'
      });
    }

    logger.info(`📋 Contacto encontrado: ${contact.name} (${contact.phone})`);

    // 1. Obtener todos los mensajes del contacto
    const messages = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, media_url FROM messages WHERE contact_id = ? OR (content LIKE ? OR content LIKE ?)',
        [contactId, `%${contact.phone}%`, `%${contact.name}%`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    logger.info(`📨 Encontrados ${messages.length} mensajes`);

    // 2. Eliminar archivos multimedia asociados
    let deletedFiles = 0;
    for (const msg of messages) {
      if (msg.media_url) {
        try {
          const filePath = path.join(process.cwd(), 'public', msg.media_url);
          await fs.unlink(filePath);
          deletedFiles++;
          logger.info(`🗑️  Archivo eliminado: ${msg.media_url}`);
        } catch (error) {
          logger.warn(`⚠️  No se pudo eliminar archivo: ${msg.media_url}`);
        }
      }
    }

    // 3. Eliminar mensajes de la BD
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM messages WHERE contact_id = ?',
        [contactId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    logger.info(`🗑️  ${messages.length} mensajes eliminados`);

    // 4. Eliminar conversaciones del contacto
    const conversations = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id FROM conversations WHERE contact_id = ?',
        [contactId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    for (const conv of conversations) {
      await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM conversations WHERE id = ?',
          [conv.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    logger.info(`🗑️  ${conversations.length} conversaciones eliminadas`);

    // 5. Eliminar el contacto
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM contacts WHERE id = ?',
        [contactId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    logger.info(`✅ Contacto eliminado: ${contact.name} (${contact.phone})`);

    db.close();

    res.json({
      success: true,
      message: `Contacto "${contact.name}" y todo lo relacionado ha sido eliminado`,
      deleted: {
        contact: contact.name,
        phone: contact.phone,
        messages: messages.length,
        files: deletedFiles,
        conversations: conversations.length
      }
    });

  } catch (error) {
    logger.error('❌ Error eliminando contacto:', error);
    db.close();
    
    res.status(500).json({
      success: false,
      error: 'Error al eliminar contacto: ' + error.message
    });
  }
});

/**
 * Eliminar contacto por teléfono
 * DELETE /api/contacts/phone/:phone
 */
router.delete('/phone/:phone', async (req, res) => {
  const { phone } = req.params;
  
  if (!phone) {
    return res.status(400).json({
      success: false,
      error: 'phone es requerido'
    });
  }

  const db = new sqlite3.Database(DB_PATH);

  try {
    logger.info(`🗑️  Iniciando eliminación de contacto por teléfono: ${phone}`);

    // Obtener contacto por teléfono
    const contact = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM contacts WHERE phone_number = ?', [phone], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!contact) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Contacto no encontrado'
      });
    }

    // Redirigir a la eliminación por ID
    db.close();
    res.redirect(307, `/api/contacts/${contact.id}`);

  } catch (error) {
    logger.error('❌ Error eliminando contacto por teléfono:', error);
    db.close();
    
    res.status(500).json({
      success: false,
      error: 'Error al eliminar contacto: ' + error.message
    });
  }
});

export default router;

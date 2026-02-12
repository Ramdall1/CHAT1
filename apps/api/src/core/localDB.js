import Database from 'better-sqlite3';
import path from 'path';
import { log } from './logger.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../../data');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

function ts() {
  return new Date().toISOString();
}

function normalizePhone(phone) {
  if (!phone) return '';
  
  // Remover espacios, guiones y paréntesis
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  
  // Si empieza con +, mantenerlo
  if (normalized.startsWith('+')) {
    return normalized;
  }
  
  // Si empieza con 00, convertir a +
  if (normalized.startsWith('00')) {
    return '+' + normalized.substring(2);
  }
  
  // Si es un número local (sin código de país), asumir que es de Costa Rica
  if (normalized.length === 8 && !normalized.startsWith('+')) {
    return '+506' + normalized;
  }
  
  // Si no tiene código de país pero tiene más de 8 dígitos, agregar +
  if (!normalized.startsWith('+') && normalized.length > 8) {
    return '+' + normalized;
  }
  
  return normalized;
}

export function createLocalDB() {
  try {
    const db = new Database(DB_PATH);
    
    // Configurar SQLite para mejor rendimiento
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 1000');
    db.pragma('temp_store = memory');
    
    // Verificar que las tablas existan
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='messages'
    `).all();
    
    if (tables.length === 0) {
      log('⚠️ Tabla messages no encontrada en la base de datos');
    }
    
    // Agregar métodos personalizados al objeto db
    db.normalizePhone = normalizePhone;
    
    db.ensureContact = function(phone, data = {}) {
      try {
        const normalizedPhone = normalizePhone(phone);
        
        const fullName = data.name || '';
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Buscar contacto existente - intentar múltiples variaciones del teléfono
        let existingContact = null;
        
        // Intento 1: Búsqueda exacta con teléfono normalizado
        existingContact = this.prepare(`
          SELECT id, name, first_name, last_name FROM contacts WHERE phone_number = ?
        `).get(normalizedPhone);
        
        // Intento 2: Si no encuentra, buscar sin el + al inicio
        if (!existingContact && normalizedPhone.startsWith('+')) {
          const phoneWithoutPlus = normalizedPhone.substring(1);
          existingContact = this.prepare(`
            SELECT id, name, first_name, last_name FROM contacts WHERE phone_number = ?
          `).get(phoneWithoutPlus);
          
          if (existingContact) {
            log(`✅ Contacto encontrado con variación de teléfono: ${phoneWithoutPlus}`);
          }
        }
        
        // Intento 3: Si no encuentra, buscar con + al inicio
        if (!existingContact && !normalizedPhone.startsWith('+')) {
          const phoneWithPlus = '+' + normalizedPhone;
          existingContact = this.prepare(`
            SELECT id, name, first_name, last_name FROM contacts WHERE phone_number = ?
          `).get(phoneWithPlus);
          
          if (existingContact) {
            log(`✅ Contacto encontrado con variación de teléfono: ${phoneWithPlus}`);
          }
        }
        
        if (existingContact) {
          // ❌ Contacto ya existe - NO cambiar nombre
          log(`✅ Contacto existente encontrado: ${normalizedPhone}`);
          log(`   ID: ${existingContact.id}`);
          log(`   Nombre actual: "${existingContact.name}"`);
          log(`   Nombre recibido (ignorado): "${fullName}"`);
          log(`   ℹ️  El nombre NO se actualiza para contactos existentes`);
          return existingContact;
        } else {
          // ✅ Crear nuevo contacto
          // Insertar nuevo contacto
          const result = this.prepare(`
            INSERT INTO contacts (user_id, phone_number, name, first_name, last_name, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            1,
            normalizedPhone,
            fullName || 'Sin nombre',
            firstName,
            lastName,
            'active',
            new Date().toISOString(),
            new Date().toISOString()
          );
          
          log(`✅ Contacto NUEVO creado: ${normalizedPhone}`);
          log(`   ID: ${result.lastInsertRowid}`);
          log(`   Nombre: "${firstName}", Apellido: "${lastName}"`);
          return { 
            id: result.lastInsertRowid, 
            phone: normalizedPhone, 
            name: fullName,
            first_name: firstName,
            last_name: lastName
          };
        }
      } catch (error) {
        log(`❌ Error en ensureContact: ${error.message}`);
        throw error;
      }
    };
    
    db.addMessage = function(messageData) {
      try {
        const normalizedPhone = normalizePhone(messageData.phone || messageData.from);
        
        // Insertar mensaje
        const result = this.prepare(`
          INSERT INTO messages (
            conversation_id, contact_id, user_id, type, direction, content, 
            status, message_id, sent_at, media_url, media_type, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          messageData.conversation_id || null,
          messageData.contact_id || null,
          messageData.user_id || 1,
          messageData.type || 'text',
          messageData.direction || 'inbound',
          messageData.content || messageData.message || '',
          messageData.status || 'received',
          messageData.message_id || messageData.id || null,
          messageData.sent_at || new Date().toISOString(),
          messageData.media_url || null,
          messageData.media_type || null,
          messageData.metadata ? JSON.stringify(messageData.metadata) : '{}',
          messageData.created_at || new Date().toISOString()
        );
        
        return { id: result.lastInsertRowid, ...messageData };
      } catch (error) {
        log(`❌ Error en addMessage: ${error.message}`);
        throw error;
      }
    };
    
    db.getAllMessages = function() {
      try {
        return this.prepare(`
          SELECT * FROM messages ORDER BY created_at DESC LIMIT 1000
        `).all();
      } catch (error) {
        log(`❌ Error en getAllMessages: ${error.message}`);
        return [];
      }
    };
    
    return db;
  } catch (error) {
    log(`❌ Error conectando a la base de datos: ${error.message}`);
    throw error;
  }
}

// Funciones de utilidad para trabajar con la base de datos
export const dbUtils = {
  // Obtener todos los mensajes
  getAllMessages() {
    const db = createLocalDB();
    return db.prepare(`
      SELECT * FROM messages 
      ORDER BY created_at DESC
    `).all();
  },

  // Obtener mensajes por número de teléfono
  getMessagesByPhone(phone) {
    const db = createLocalDB();
    const normalizedPhone = normalizePhone(phone);
    return db.prepare(`
      SELECT * FROM messages 
      WHERE phone_number = ? 
      ORDER BY created_at ASC
    `).all(normalizedPhone);
  },

  // Obtener contactos únicos
  getUniqueContacts() {
    const db = createLocalDB();
    return db.prepare(`
      SELECT DISTINCT 
        phone_number,
        contact_name,
        MAX(created_at) as last_message_time,
        COUNT(*) as message_count
      FROM messages 
      GROUP BY phone_number
      ORDER BY last_message_time DESC
    `).all();
  },

  // Insertar nuevo mensaje
  insertMessage(messageData) {
    const db = createLocalDB();
    const normalizedPhone = normalizePhone(messageData.phone_number);
    
    return db.prepare(`
      INSERT INTO messages (
        phone_number, contact_name, message_text, direction, 
        message_type, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalizedPhone,
      messageData.contact_name || '',
      messageData.message_text || '',
      messageData.direction || 'incoming',
      messageData.message_type || 'text',
      messageData.created_at || ts(),
      messageData.metadata ? JSON.stringify(messageData.metadata) : '{}'
    );
  },

  // Actualizar mensaje
  updateMessage(id, updates) {
    const db = createLocalDB();
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    return db.prepare(`
      UPDATE messages SET ${setClause} WHERE id = ?
    `).run(...values);
  },

  // Eliminar mensaje
  deleteMessage(id) {
    const db = createLocalDB();
    return db.prepare(`DELETE FROM messages WHERE id = ?`).run(id);
  },

  // Buscar mensajes por texto
  searchMessages(searchTerm) {
    const db = createLocalDB();
    return db.prepare(`
      SELECT * FROM messages 
      WHERE message_text LIKE ? OR contact_name LIKE ?
      ORDER BY created_at DESC
    `).all(`%${searchTerm}%`, `%${searchTerm}%`);
  },

  // Obtener estadísticas
  getStats() {
    const db = createLocalDB();
    
    const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
    const totalContacts = db.prepare('SELECT COUNT(DISTINCT phone_number) as count FROM messages').get().count;
    const todayMessages = db.prepare(`
      SELECT COUNT(*) as count FROM messages 
      WHERE date(created_at) = date('now')
    `).get().count;
    
    return {
      totalMessages,
      totalContacts,
      todayMessages,
      lastUpdated: ts()
    };
  }
};

export { normalizePhone };

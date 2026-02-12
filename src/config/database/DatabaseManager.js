import sqlite3 from 'sqlite3';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createLogger } from '../../services/core/core/logger.js';

// Compatibilidad con Jest - usar import.meta solo si está disponible
let __filename, __dirname;
try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (error) {
  // Fallback para entornos de prueba
  __dirname = path.join(process.cwd(), 'src', 'config', 'database');
  __filename = path.join(__dirname, 'DatabaseManager.js');
}

class DatabaseManager {
  constructor() {
    this.logger = createLogger('DATABASE_MANAGER');
    this.dbPath = path.join(__dirname, '../../data/database.sqlite');
    this.db = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.initializationPromise = null;
    this.sqlite3 = sqlite3.verbose();
    this.connectionPool = [];
    this.maxConnections = 10;
    this.transactionTimeout = 30000; // 30 segundos
  }

  // Patrón Singleton
  static getInstance() {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  // Inicialización de la base de datos
  async initialize() {
    // Si ya está inicializada, retornar inmediatamente
    if (this.isInitialized) {
      return;
    }
        
    // Si ya se está inicializando, esperar a que termine
    if (this.isInitializing && this.initializationPromise) {
      return await this.initializationPromise;
    }
        
    // Marcar como inicializando y crear la promesa
    this.isInitializing = true;
    this.initializationPromise = this._doInitialize();
        
    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }
    
  async _doInitialize() {
    try {
      // Crear directorio si no existe
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Conectar a la base de datos
      this.db = new this.sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          this.logger.error('Error conectando a SQLite:', err);
          throw err;
        }
        this.logger.info('✅ Conectado a SQLite database');
      });

      // Configurar SQLite para mejor rendimiento
      await this.runQuery('PRAGMA journal_mode = WAL');
      await this.runQuery('PRAGMA synchronous = NORMAL');
      await this.runQuery('PRAGMA cache_size = 10000');
      await this.runQuery('PRAGMA temp_store = MEMORY');
      await this.runQuery('PRAGMA foreign_keys = ON');

      // Crear tablas
      await this.createTables();
            
      // Crear índices
      await this.createIndexes();

      // Ejecutar migraciones
      try {
        const { default: runMigrations } = await import('../../database/migrations.js');
        await runMigrations();
      } catch (error) {
        this.logger.warn('⚠️ Error ejecutando migraciones:', error.message);
      }
            
      // Inicializar servicio de optimización
      try {
        const DatabaseOptimizationService = await import('../../services/core/core/DatabaseOptimizationService.js');
        await DatabaseOptimizationService.default.initialize();
      } catch (error) {
        logger.warn('Warning: Could not initialize database optimization service:', error.message);
      }

      this.isInitialized = true;
      this.logger.info('✅ Base de datos SQLite inicializada correctamente');
    } catch (error) {
      this.logger.error('❌ Error inicializando base de datos:', error);
      throw error;
    }
  }

  // Crear todas las tablas
  async createTables() {
    const tables = [
      // Tabla de usuarios
      `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                api_key TEXT UNIQUE,
                is_active BOOLEAN DEFAULT 1,
                last_login DATETIME,
                failed_login_attempts INTEGER DEFAULT 0,
                locked_until DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

      // Tabla de contactos
      `CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100),
                email VARCHAR(100),
                tags TEXT, -- JSON array
                metadata TEXT, -- JSON object
                is_blocked BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

      // Tabla de conversaciones
      `CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                last_message_at DATETIME,
                message_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
            )`,

      // Tabla de mensajes
      `CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                contact_id INTEGER NOT NULL,
                message_id VARCHAR(100) UNIQUE,
                direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
                type VARCHAR(20) NOT NULL, -- 'text', 'image', 'document', etc.
                content TEXT,
                media_url TEXT,
                status VARCHAR(20) DEFAULT 'sent',
                timestamp DATETIME NOT NULL,
                metadata TEXT, -- JSON object
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
            )`,

      // Tabla de plantillas
      `CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                category VARCHAR(50),
                language VARCHAR(10) DEFAULT 'es',
                status VARCHAR(20) DEFAULT 'active',
                header_type VARCHAR(20),
                header_content TEXT,
                body_text TEXT NOT NULL,
                footer_text TEXT,
                buttons TEXT, -- JSON array
                variables TEXT, -- JSON array
                usage_count INTEGER DEFAULT 0,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`,

      // Tabla de campañas
      `CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                template_id INTEGER NOT NULL,
                target_segments TEXT, -- JSON array
                status VARCHAR(20) DEFAULT 'draft',
                scheduled_at DATETIME,
                sent_count INTEGER DEFAULT 0,
                delivered_count INTEGER DEFAULT 0,
                read_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (template_id) REFERENCES templates(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`,

      // Tabla de segmentos de audiencia
      `CREATE TABLE IF NOT EXISTS audience_segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                criteria TEXT NOT NULL, -- JSON object with filtering criteria
                contact_count INTEGER DEFAULT 0,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`,

      // Tabla de analytics
      `CREATE TABLE IF NOT EXISTS analytics_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50), -- 'message', 'campaign', 'template', etc.
                entity_id INTEGER,
                properties TEXT, -- JSON object
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                session_id VARCHAR(100),
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,

      // Tabla de configuraciones
      `CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category VARCHAR(50) NOT NULL,
                key VARCHAR(100) NOT NULL,
                value TEXT,
                is_encrypted BOOLEAN DEFAULT 0,
                updated_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(category, key),
                FOREIGN KEY (updated_by) REFERENCES users(id)
            )`,

      // Tabla de logs de sistema
      `CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level VARCHAR(10) NOT NULL,
                message TEXT NOT NULL,
                context TEXT, -- JSON object
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                source VARCHAR(50),
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,

      // Tabla de sesiones
      `CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(128) PRIMARY KEY,
                user_id INTEGER NOT NULL,
                data TEXT,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`
    ];

    for (const tableSQL of tables) {
      await this.runQuery(tableSQL);
    }
  }

  // Crear índices para optimización
  async createIndexes() {
    const indexes = [
      // Índices para contacts
      'CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number)',
      'CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at)',
            
      // Índices para messages
      'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction)',
      'CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)',
            
      // Índices para conversations
      'CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at)',
            
      // Índices para templates
      'CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)',
      'CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status)',
      'CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates(created_by)',
            
      // Índices para campaigns
      'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
      'CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at)',
      'CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by)',
            
      // Índices para analytics
      'CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_entity ON analytics_events(entity_type, entity_id)',
            
      // Índices para users
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key)',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
            
      // Índices para settings
      'CREATE INDEX IF NOT EXISTS idx_settings_category_key ON settings(category, key)',
            
      // Índices para system_logs
      'CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)',
      'CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source)',
            
      // Índices para sessions
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)'
    ];

    for (const indexSQL of indexes) {
      await this.runQuery(indexSQL);
    }
  }

  // Ejecutar query con promesa
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // Obtener datos con promesa
  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Obtener múltiples filas
  getAllQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Transacciones
  async transaction(callback) {
    return new Promise(async(resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Transaction timeout'));
      }, this.transactionTimeout);

      try {
        await this.runQuery('BEGIN TRANSACTION');
                
        const result = await callback(this);
                
        await this.runQuery('COMMIT');
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        await this.runQuery('ROLLBACK');
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // Métodos de utilidad para contactos
  async createContact(contactData) {
    const { phone_number, name, email, tags, metadata } = contactData;
        
    const result = await this.runQuery(
      `INSERT INTO contacts (phone_number, name, email, tags, metadata) 
             VALUES (?, ?, ?, ?, ?)`,
      [phone_number, name, email, JSON.stringify(tags || []), JSON.stringify(metadata || {})]
    );
        
    return this.getContact(result.id);
  }

  async getContact(id) {
    const contact = await this.getQuery('SELECT * FROM contacts WHERE id = ?', [id]);
    if (contact) {
      contact.tags = JSON.parse(contact.tags || '[]');
      contact.metadata = JSON.parse(contact.metadata || '{}');
    }
    return contact;
  }

  async getContactByPhone(phone_number) {
    const contact = await this.getQuery('SELECT * FROM contacts WHERE phone_number = ?', [phone_number]);
    if (contact) {
      contact.tags = JSON.parse(contact.tags || '[]');
      contact.metadata = JSON.parse(contact.metadata || '{}');
    }
    return contact;
  }

  async updateContact(id, updates) {
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);

    await this.runQuery(
      `UPDATE contacts SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
        
    return this.getContact(id);
  }

  // Métodos para mensajes
  async createMessage(messageData) {
    const { conversation_id, contact_id, message_id, direction, type, content, media_url, status, timestamp, metadata } = messageData;
        
    const result = await this.runQuery(
      `INSERT INTO messages (conversation_id, contact_id, message_id, direction, type, content, media_url, status, timestamp, metadata) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [conversation_id, contact_id, message_id, direction, type, content, media_url, status, timestamp, JSON.stringify(metadata || {})]
    );
        
    // Actualizar contador de mensajes en conversación
    await this.runQuery(
      'UPDATE conversations SET message_count = message_count + 1, last_message_at = ? WHERE id = ?',
      [timestamp, conversation_id]
    );
        
    return this.getMessage(result.id);
  }

  async getMessage(id) {
    const message = await this.getQuery('SELECT * FROM messages WHERE id = ?', [id]);
    if (message && message.metadata) {
      message.metadata = JSON.parse(message.metadata);
    }
    return message;
  }

  async getConversationMessages(conversation_id, limit = 50, offset = 0) {
    const messages = await this.getAllQuery(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [conversation_id, limit, offset]
    );
        
    return messages.map(message => {
      if (message.metadata) {
        message.metadata = JSON.parse(message.metadata);
      }
      return message;
    });
  }

  // Métodos para analytics
  async logEvent(eventType, entityType, entityId, properties, userId = null) {
    const sessionId = crypto.randomBytes(16).toString('hex');
        
    await this.runQuery(
      'INSERT INTO analytics_events (event_type, entity_type, entity_id, properties, session_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [eventType, entityType, entityId, JSON.stringify(properties || {}), sessionId, userId]
    );
  }

  // Backup de la base de datos
  async backup(backupPath) {
    return new Promise((resolve, reject) => {
      const backup = this.db.backup(backupPath);
      backup.step(-1, (err) => {
        if (err) {
          reject(err);
        } else {
          backup.finish((err) => {
            if (err) {
              reject(err);
            } else {
              resolve(backupPath);
            }
          });
        }
      });
    });
  }

  // Cerrar conexión
  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.logger.info('✅ Conexión SQLite cerrada');
          resolve();
        }
      });
    });
  }

  // Estadísticas de la base de datos
  async getStats() {
    const stats = {};
        
    const tables = ['contacts', 'messages', 'conversations', 'templates', 'campaigns', 'users'];
        
    for (const table of tables) {
      const result = await this.getQuery(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = result.count;
    }
        
    // Tamaño de la base de datos
    const dbStats = await fs.stat(this.dbPath);
    stats.database_size = dbStats.size;
        
    return stats;
  }
}

export default DatabaseManager;
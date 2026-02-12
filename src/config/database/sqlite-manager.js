/**
 * SQLite Manager - Sistema de base de datos local optimizado
 * Implementa SQLite con transacciones ACID, índices optimizados y relaciones
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import errorManager from '../../managers/error_manager.js';
import { createLogger } from '../../services/core/core/logger.js';

const sqlite3Verbose = sqlite3.verbose();

class SQLiteManager {
  constructor(options = {}) {
    this.logger = createLogger('SQLITE_MANAGER');
    this.config = {
      dbPath: options.dbPath || path.join(process.cwd(), 'data', 'database.sqlite'),
      backupPath: options.backupPath || path.join(process.cwd(), 'data', 'backups'),
      maxConnections: options.maxConnections || 10,
      busyTimeout: options.busyTimeout || 30000,
      cacheSize: options.cacheSize || 10000,
      journalMode: options.journalMode || 'WAL',
      synchronous: options.synchronous || 'NORMAL',
      foreignKeys: options.foreignKeys !== false,
      autoVacuum: options.autoVacuum || 'INCREMENTAL',
      tempStore: options.tempStore || 'MEMORY',
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      connectionTimeout: options.connectionTimeout || 10000,
      queryTimeout: options.queryTimeout || 30000
    };

    this.db = null;
    this.isConnected = false;
    this.connectionPool = [];
    this.activeTransactions = new Map();
    this.queryCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
    this.stats = {
      queries: 0,
      transactions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      retries: 0,
      connectionAttempts: 0,
      lastError: null,
      uptime: Date.now()
    };

    this.healthCheck = {
      isHealthy: false,
      lastCheck: null,
      consecutiveFailures: 0,
      maxFailures: 5
    };

    this.init();
  }

  async init() {
    try {
      await this.validateConfiguration();
      await this.ensureDirectories();
      await this.connect();
      await this.setupDatabase();
      await this.createTables();
      await this.createIndexes();
      await this.setupTriggers();
      await this.performHealthCheck();
            
      this.healthCheck.isHealthy = true;
      this.logger.info('✅ SQLite Manager inicializado correctamente');
    } catch (error) {
      this.logger.error('❌ Error inicializando SQLite Manager:', error);
      throw error;
    }
  }

  async validateConfiguration() {
    const requiredPaths = [this.config.dbPath, this.config.backupPath];
        
    for (const configPath of requiredPaths) {
      if (!configPath || typeof configPath !== 'string') {
        throw new Error(`Configuración de ruta inválida: ${configPath}`);
      }
    }

    if (this.config.busyTimeout < 1000 || this.config.busyTimeout > 60000) {
      throw new Error('busyTimeout debe estar entre 1000 y 60000 ms');
    }

    if (this.config.maxRetries < 1 || this.config.maxRetries > 10) {
      throw new Error('maxRetries debe estar entre 1 y 10');
    }

    if (this.config.cacheSize < 1000 || this.config.cacheSize > 100000) {
      throw new Error('cacheSize debe estar entre 1000 y 100000');
    }
  }

  async ensureDirectories() {
    const dbDir = path.dirname(this.config.dbPath);
    const backupDir = this.config.backupPath;

    try {
      await fs.access(dbDir);
    } catch {
      try {
        await fs.mkdir(dbDir, { recursive: true });
        errorManager.errorManager.logError('info', 'SQLiteManager', 'Directorio de base de datos creado', { path: dbDir });
      } catch (error) {
        errorManager.logError('error', 'SQLiteManager', 'Error creando directorio de base de datos', {
          path: dbDir,
          error: error.message
        });
        throw error;
      }
    }

    try {
      await fs.access(backupDir);
    } catch {
      try {
        await fs.mkdir(backupDir, { recursive: true });
        errorManager.logError('info', 'SQLiteManager', 'Directorio de backups creado', { path: backupDir });
      } catch (error) {
        errorManager.logError('error', 'SQLiteManager', 'Error creando directorio de backups', {
          path: backupDir,
          error: error.message
        });
        throw error;
      }
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.stats.connectionAttempts++;
            
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout de conexión después de ${this.config.connectionTimeout}ms`));
      }, this.config.connectionTimeout);

      this.db = new sqlite3Verbose.Database(this.config.dbPath, (err) => {
        clearTimeout(timeout);
                
        if (err) {
          this.stats.errors++;
          this.stats.lastError = err.message;
                    
          errorManager.logError('error', 'SQLiteManager', 'Error conectando a SQLite', {
            error: err.message,
            dbPath: this.config.dbPath,
            attempt: this.stats.connectionAttempts
          });
                    
          this.logger.error('Error conectando a SQLite:', err);
          reject(err);
          return;
        }

        this.isConnected = true;
        this.setupConnection();
                
        errorManager.logError('info', 'SQLiteManager', 'Conexión a SQLite establecida', {
          dbPath: this.config.dbPath,
          attempt: this.stats.connectionAttempts
        });
                
        resolve();
      });
    });
  }

  async setupConnection() {
    try {
      // Configurar pragmas para optimización
      const pragmas = [
        `PRAGMA busy_timeout = ${this.config.busyTimeout}`,
        `PRAGMA cache_size = ${this.config.cacheSize}`,
        `PRAGMA journal_mode = ${this.config.journalMode}`,
        `PRAGMA synchronous = ${this.config.synchronous}`,
        `PRAGMA foreign_keys = ${this.config.foreignKeys ? 'ON' : 'OFF'}`,
        `PRAGMA auto_vacuum = ${this.config.autoVacuum}`,
        `PRAGMA temp_store = ${this.config.tempStore}`,
        'PRAGMA optimize',
        'PRAGMA analysis_limit = 1000',
        'PRAGMA threads = 4'
      ];

      for (const pragma of pragmas) {
        await this.run(pragma);
      }
            
      errorManager.logError('info', 'SQLiteManager', 'Configuración de conexión aplicada', {
        pragmas: pragmas.length
      });
    } catch (error) {
      errorManager.logError('error', 'SQLiteManager', 'Error configurando conexión', {
        error: error.message
      });
      throw error;
    }
  }

  async setupDatabase() {
    try {
      // Verificar integridad de la base de datos
      const integrityCheck = await this.get('PRAGMA integrity_check');
      if (integrityCheck.integrity_check !== 'ok') {
        const error = new Error('Base de datos corrupta');
        errorManager.logError('critical', 'SQLiteManager', 'Base de datos corrupta detectada', {
          integrityCheck: integrityCheck.integrity_check
        });
        throw error;
      }

      // Obtener información de la base de datos
      const dbInfo = {
        version: await this.get('PRAGMA user_version'),
        pageSize: await this.get('PRAGMA page_size'),
        encoding: await this.get('PRAGMA encoding'),
        journalMode: await this.get('PRAGMA journal_mode')
      };

      errorManager.logError('info', 'SQLiteManager', 'Información de la base de datos obtenida', dbInfo);
      this.logger.info('📊 Información de la base de datos:', dbInfo);
    } catch (error) {
      errorManager.logError('error', 'SQLiteManager', 'Error configurando base de datos', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async performHealthCheck() {
    try {
      this.healthCheck.lastCheck = new Date();
            
      // Verificar conexión
      if (!this.isConnected || !this.db) {
        throw new Error('Base de datos no conectada');
      }

      // Verificar integridad
      const integrityCheck = await this.get('PRAGMA integrity_check');
      if (integrityCheck.integrity_check !== 'ok') {
        throw new Error('Fallo en verificación de integridad');
      }

      // Test de escritura/lectura
      const testId = crypto.randomUUID();
      await this.run('CREATE TEMP TABLE IF NOT EXISTS health_check (id TEXT PRIMARY KEY, timestamp INTEGER)');
      await this.run('INSERT OR REPLACE INTO health_check (id, timestamp) VALUES (?, ?)', [testId, Date.now()]);
      const result = await this.get('SELECT * FROM health_check WHERE id = ?', [testId]);
            
      if (!result || result.id !== testId) {
        throw new Error('Fallo en test de escritura/lectura');
      }

      this.healthCheck.consecutiveFailures = 0;
      this.healthCheck.isHealthy = true;
            
      errorManager.logError('info', 'SQLiteManager', 'Health check exitoso', {
        timestamp: this.healthCheck.lastCheck,
        consecutiveFailures: this.healthCheck.consecutiveFailures
      });
            
      return true;
    } catch (error) {
      this.healthCheck.consecutiveFailures++;
      this.healthCheck.isHealthy = this.healthCheck.consecutiveFailures < this.healthCheck.maxFailures;
            
      errorManager.logError('warning', 'SQLiteManager', 'Health check falló', {
        error: error.message,
        consecutiveFailures: this.healthCheck.consecutiveFailures,
        isHealthy: this.healthCheck.isHealthy
      });
            
      if (!this.healthCheck.isHealthy) {
        errorManager.logError('critical', 'SQLiteManager', 'Base de datos marcada como no saludable', {
          consecutiveFailures: this.healthCheck.consecutiveFailures,
          maxFailures: this.healthCheck.maxFailures
        });
      }
            
      return false;
    }
  }

  async executeWithRetry(operation, context = {}) {
    let lastError;
        
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation();
                
        if (attempt > 1) {
          this.stats.retries++;
          errorManager.logError('info', 'SQLiteManager', 'Operación exitosa después de retry', {
            attempt,
            context,
            totalRetries: this.stats.retries
          });
        }
                
        return result;
      } catch (error) {
        lastError = error;
        this.stats.errors++;
        this.stats.lastError = error.message;
                
        errorManager.logError('warning', 'SQLiteManager', `Intento ${attempt} falló`, {
          attempt,
          maxRetries: this.config.maxRetries,
          error: error.message,
          context
        });
                
        if (attempt === this.config.maxRetries) {
          errorManager.logError('error', 'SQLiteManager', 'Operación falló después de todos los reintentos', {
            attempts: attempt,
            error: error.message,
            context
          });
          break;
        }
                
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
                
        // Verificar si necesitamos reconectar
        if (error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED') {
          await this.performHealthCheck();
        }
      }
    }
        
    throw lastError;
  }

  async createTables() {
    const tables = [
      // Tabla de usuarios
      `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                salt VARCHAR(32) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                status VARCHAR(20) DEFAULT 'active',
                last_login DATETIME,
                failed_attempts INTEGER DEFAULT 0,
                locked_until DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT DEFAULT '{}'
            )`,

      // Tabla de sesiones
      `CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(128) PRIMARY KEY,
                user_id INTEGER NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                refresh_token_hash VARCHAR(255),
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address VARCHAR(45),
                user_agent TEXT,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

      // Tabla de contactos
      `CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                phone VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100),
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(100),
                company VARCHAR(100),
                position VARCHAR(100),
                avatar_url TEXT,
                tags TEXT DEFAULT '[]',
                custom_fields TEXT DEFAULT '{}',
                status VARCHAR(20) DEFAULT 'active',
                source VARCHAR(50),
                last_interaction DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

      // Tabla de conversaciones
      `CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                contact_id INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                last_message_at DATETIME,
                message_count INTEGER DEFAULT 0,
                unread_count INTEGER DEFAULT 0,
                archived BOOLEAN DEFAULT 0,
                tags TEXT DEFAULT '[]',
                metadata TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                UNIQUE(user_id, contact_id)
            )`,

      // Tabla de mensajes
      `CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                contact_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                type VARCHAR(20) DEFAULT 'text',
                direction VARCHAR(10) NOT NULL,
                content TEXT NOT NULL,
                media_url VARCHAR(500),
                media_type VARCHAR(50),
                status VARCHAR(20) DEFAULT 'sent',
                message_id VARCHAR(100),
                reply_to_id INTEGER,
                scheduled_at DATETIME,
                sent_at DATETIME,
                delivered_at DATETIME,
                read_at DATETIME,
                failed_at DATETIME,
                error_message TEXT,
                metadata TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL
            )`,

      // Tabla de media (imágenes, videos, documentos)
      `CREATE TABLE IF NOT EXISTS media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id INTEGER NOT NULL,
                phone VARCHAR(20) NOT NULL,
                media_id VARCHAR(255) UNIQUE,
                type VARCHAR(20) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INTEGER,
                mime_type VARCHAR(100),
                metadata TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
            )`,

      // Tabla de templates
      `CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                category VARCHAR(50),
                content TEXT NOT NULL,
                variables TEXT DEFAULT '[]',
                language VARCHAR(10) DEFAULT 'es',
                status VARCHAR(20) DEFAULT 'active',
                usage_count INTEGER DEFAULT 0,
                last_used DATETIME,
                tags TEXT DEFAULT '[]',
                metadata TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

      // Tabla de campañas
      `CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                template_id INTEGER,
                status VARCHAR(20) DEFAULT 'draft',
                scheduled_at DATETIME,
                started_at DATETIME,
                completed_at DATETIME,
                paused_at DATETIME,
                target_count INTEGER DEFAULT 0,
                sent_count INTEGER DEFAULT 0,
                delivered_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                tags TEXT DEFAULT '[]',
                metadata TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
            )`,

      // Tabla de contactos de campaña
      `CREATE TABLE IF NOT EXISTS campaign_contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                contact_id INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                sent_at DATETIME,
                delivered_at DATETIME,
                failed_at DATETIME,
                error_message TEXT,
                message_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
                UNIQUE(campaign_id, contact_id)
            )`,

      // Tabla de eventos de seguridad
      `CREATE TABLE IF NOT EXISTS security_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                event_type VARCHAR(50) NOT NULL,
                severity VARCHAR(20) DEFAULT 'info',
                description TEXT NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                metadata TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )`,

      // Tabla de configuración
      `CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                key VARCHAR(100) NOT NULL,
                value TEXT,
                type VARCHAR(20) DEFAULT 'string',
                is_global BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, key)
            )`,

      // Tabla de métricas
      `CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                metric_name VARCHAR(100) NOT NULL,
                metric_value REAL NOT NULL,
                metric_type VARCHAR(20) DEFAULT 'counter',
                tags TEXT DEFAULT '{}',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    this.logger.info('✅ Tablas creadas correctamente');
  }

  async createIndexes() {
    // Verificar qué tablas existen antes de crear índices
    const existingTables = await this.all("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = existingTables.map(row => row.name.toLowerCase());
    
    const indexes = [];

    // Índices para usuarios (solo si la tabla existe)
    if (tableNames.includes('users')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
        'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)'
      );
    }

    // Índices para sesiones (solo si la tabla existe)
    if (tableNames.includes('sessions')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active)'
      );
    }

    // Índices para contactos
    if (tableNames.includes('contacts')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone)',
        'CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name)',
        'CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status)',
        'CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(last_interaction)'
      );
    }

    // Índices para conversaciones (solo si la tabla existe)
    if (tableNames.includes('conversations')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(archived)'
      );
    }

    // Índices para mensajes
    if (tableNames.includes('messages')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)',
        'CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction)',
        'CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)',
        'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
        'CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id)',
        'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)'
      );
    }

    // Índices para templates (solo si la tabla existe)
    if (tableNames.includes('templates')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)',
        'CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status)',
        'CREATE INDEX IF NOT EXISTS idx_templates_usage_count ON templates(usage_count)'
      );
    }

    // Índices para campañas (solo si la tabla existe)
    if (tableNames.includes('campaigns')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id)',
        'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
        'CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at)',
        'CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at)'
      );
    }

    // Índices para contactos de campaña (solo si la tabla existe)
    if (tableNames.includes('campaign_contacts')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id)',
        'CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact_id ON campaign_contacts(contact_id)',
        'CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status)'
      );
    }

    // Índices para eventos de seguridad (solo si la tabla existe)
    if (tableNames.includes('security_events')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type)',
        'CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity)',
        'CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at)'
      );
    }

    // Índices para configuración (solo si la tabla existe)
    if (tableNames.includes('settings')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)',
        'CREATE INDEX IF NOT EXISTS idx_settings_is_global ON settings(is_global)'
      );
    }

    // Índices para métricas (solo si la tabla existe)
    if (tableNames.includes('metrics')) {
      indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON metrics(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name)',
        'CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)'
      );
    }

    // Crear índices de forma segura
    for (const index of indexes) {
      try {
        await this.run(index);
      } catch (error) {
        // No loguear warnings de índices para mantener logs limpios
        // Los índices fallan si las tablas no existen, lo cual es normal en inicializaciones simplificadas
      }
    }

    this.logger.info(`✅ Índices creados correctamente (${indexes.length} índices procesados)`);
  }

  async setupTriggers() {
    const triggers = [
      // Trigger para actualizar updated_at automáticamente
      `CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
             AFTER UPDATE ON users 
             BEGIN 
                 UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END`,

      `CREATE TRIGGER IF NOT EXISTS update_contacts_timestamp 
             AFTER UPDATE ON contacts 
             BEGIN 
                 UPDATE contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END`,

      `CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp 
             AFTER UPDATE ON conversations 
             BEGIN 
                 UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END`,

      `CREATE TRIGGER IF NOT EXISTS update_templates_timestamp 
             AFTER UPDATE ON templates 
             BEGIN 
                 UPDATE templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END`,

      `CREATE TRIGGER IF NOT EXISTS update_campaigns_timestamp 
             AFTER UPDATE ON campaigns 
             BEGIN 
                 UPDATE campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END`,

      `CREATE TRIGGER IF NOT EXISTS update_settings_timestamp 
             AFTER UPDATE ON settings 
             BEGIN 
                 UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END`,

      // Trigger para actualizar contadores de conversación
      `CREATE TRIGGER IF NOT EXISTS update_conversation_message_count 
             AFTER INSERT ON messages 
             BEGIN 
                 UPDATE conversations 
                 SET message_count = message_count + 1,
                     last_message_at = CURRENT_TIMESTAMP
                 WHERE id = NEW.conversation_id;
             END`,

      // Trigger para actualizar contador de uso de templates
      `CREATE TRIGGER IF NOT EXISTS update_template_usage 
             AFTER INSERT ON messages 
             WHEN NEW.metadata LIKE '%template_id%'
             BEGIN 
                 UPDATE templates 
                 SET usage_count = usage_count + 1,
                     last_used = CURRENT_TIMESTAMP
                 WHERE id = CAST(json_extract(NEW.metadata, '$.template_id') AS INTEGER);
             END`,

      // Trigger para limpiar sesiones expiradas
      `CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions 
             AFTER INSERT ON sessions 
             BEGIN 
                 DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
             END`
    ];

    for (const trigger of triggers) {
      await this.run(trigger);
    }

    this.logger.info('✅ Triggers creados correctamente');
  }

  // === MÉTODOS DE CONSULTA ===
  async run(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Base de datos no conectada');
    }

    const context = { sql: sql.substring(0, 100), params: params.length };
        
    return this.executeWithRetry(async() => {
      return new Promise((resolve, reject) => {
        this.stats.queries++;
                
        const timeout = setTimeout(() => {
          reject(new Error(`Query timeout después de ${this.config.queryTimeout}ms`));
        }, this.config.queryTimeout);
                
        this.db.run(sql, params, function(err) {
          clearTimeout(timeout);
                    
          if (err) {
            errorManager.logError('error', 'SQLiteManager', 'Error ejecutando query run', {
              error: err.message,
              sql: sql.substring(0, 100),
              params: params.length,
              code: err.code
            });
            reject(err);
            return;
          }
                    
          const result = { lastID: this.lastID, changes: this.changes };
                    
          errorManager.logError('debug', 'SQLiteManager', 'Query run ejecutada exitosamente', {
            sql: sql.substring(0, 50),
            changes: result.changes,
            lastID: result.lastID
          });
                    
          resolve(result);
        });
      });
    }, context);
  }

  async get(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Base de datos no conectada');
    }

    const cacheKey = this.getCacheKey(sql, params);
    const cached = this.getFromCache(cacheKey);
        
    if (cached) {
      this.stats.cacheHits++;
      errorManager.logError('debug', 'SQLiteManager', 'Cache hit para query get', {
        sql: sql.substring(0, 50)
      });
      return cached;
    }

    const context = { sql: sql.substring(0, 100), params: params.length };
        
    return this.executeWithRetry(async() => {
      return new Promise((resolve, reject) => {
        this.stats.queries++;
        this.stats.cacheMisses++;
                
        const timeout = setTimeout(() => {
          reject(new Error(`Query timeout después de ${this.config.queryTimeout}ms`));
        }, this.config.queryTimeout);
                
        this.db.get(sql, params, (err, row) => {
          clearTimeout(timeout);
                    
          if (err) {
            errorManager.logError('error', 'SQLiteManager', 'Error ejecutando query get', {
              error: err.message,
              sql: sql.substring(0, 100),
              params: params.length,
              code: err.code
            });
            reject(err);
            return;
          }
                    
          if (row) {
            this.setCache(cacheKey, row);
            errorManager.logError('debug', 'SQLiteManager', 'Query get ejecutada exitosamente con resultado', {
              sql: sql.substring(0, 50),
              hasResult: true
            });
          } else {
            errorManager.logError('debug', 'SQLiteManager', 'Query get ejecutada exitosamente sin resultado', {
              sql: sql.substring(0, 50),
              hasResult: false
            });
          }
                    
          resolve(row);
        });
      });
    }, context);
  }

  async all(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Base de datos no conectada');
    }

    const cacheKey = this.getCacheKey(sql, params);
    const cached = this.getFromCache(cacheKey);
        
    if (cached) {
      this.stats.cacheHits++;
      errorManager.logError('debug', 'SQLiteManager', 'Cache hit para query all', {
        sql: sql.substring(0, 50),
        resultCount: cached.length
      });
      return cached;
    }

    const context = { sql: sql.substring(0, 100), params: params.length };
        
    return this.executeWithRetry(async() => {
      return new Promise((resolve, reject) => {
        this.stats.queries++;
        this.stats.cacheMisses++;
                
        const timeout = setTimeout(() => {
          reject(new Error(`Query timeout después de ${this.config.queryTimeout}ms`));
        }, this.config.queryTimeout);
                
        this.db.all(sql, params, (err, rows) => {
          clearTimeout(timeout);
                    
          if (err) {
            errorManager.logError('error', 'SQLiteManager', 'Error ejecutando query all', {
              error: err.message,
              sql: sql.substring(0, 100),
              params: params.length,
              code: err.code
            });
            reject(err);
            return;
          }
                    
          const result = rows || [];
                    
          if (result.length > 0) {
            this.setCache(cacheKey, result);
          }
                    
          errorManager.logError('debug', 'SQLiteManager', 'Query all ejecutada exitosamente', {
            sql: sql.substring(0, 50),
            resultCount: result.length
          });
                    
          resolve(result);
        });
      });
    }, context);
  }

  // === TRANSACCIONES ===
  async beginTransaction() {
    if (!this.isConnected) {
      throw new Error('Base de datos no conectada');
    }

    const transactionId = crypto.randomUUID();
        
    try {
      await this.run('BEGIN TRANSACTION');
      this.activeTransactions.set(transactionId, {
        id: transactionId,
        startTime: Date.now(),
        queries: []
      });
            
      this.stats.transactions++;
            
      errorManager.logError('info', 'SQLiteManager', 'Transacción iniciada', {
        transactionId,
        activeTransactions: this.activeTransactions.size
      });
            
      return transactionId;
    } catch (error) {
      errorManager.logError('error', 'SQLiteManager', 'Error iniciando transacción', {
        error: error.message,
        transactionId
      });
      throw error;
    }
  }

  async commitTransaction(transactionId) {
    if (!transactionId || !this.activeTransactions.has(transactionId)) {
      const error = new Error('Transacción no encontrada o ID inválido');
      errorManager.logError('error', 'SQLiteManager', 'Error en commit: transacción no encontrada', {
        transactionId,
        activeTransactions: Array.from(this.activeTransactions.keys())
      });
      throw error;
    }

    const transaction = this.activeTransactions.get(transactionId);
    const duration = Date.now() - transaction.startTime;

    try {
      await this.run('COMMIT');
      this.activeTransactions.delete(transactionId);
      this.clearCache(); // Limpiar cache después de commit
            
      errorManager.logError('info', 'SQLiteManager', 'Transacción confirmada exitosamente', {
        transactionId,
        duration,
        queries: transaction.queries.length,
        activeTransactions: this.activeTransactions.size
      });
    } catch (error) {
      errorManager.logError('error', 'SQLiteManager', 'Error haciendo commit, ejecutando rollback', {
        transactionId,
        error: error.message,
        duration
      });
            
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }

  async rollbackTransaction(transactionId) {
    if (!transactionId || !this.activeTransactions.has(transactionId)) {
      const error = new Error('Transacción no encontrada o ID inválido');
      errorManager.logError('error', 'SQLiteManager', 'Error en rollback: transacción no encontrada', {
        transactionId,
        activeTransactions: Array.from(this.activeTransactions.keys())
      });
      throw error;
    }

    const transaction = this.activeTransactions.get(transactionId);
    const duration = Date.now() - transaction.startTime;

    try {
      await this.run('ROLLBACK');
      this.activeTransactions.delete(transactionId);
            
      errorManager.logError('warning', 'SQLiteManager', 'Transacción revertida', {
        transactionId,
        duration,
        queries: transaction.queries.length,
        activeTransactions: this.activeTransactions.size
      });
    } catch (error) {
      errorManager.logError('error', 'SQLiteManager', 'Error haciendo rollback', {
        transactionId,
        error: error.message,
        duration
      });
            
      // Forzar eliminación de la transacción del mapa
      this.activeTransactions.delete(transactionId);
      throw error;
    }
  }

  async executeInTransaction(callback) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback de transacción debe ser una función');
    }

    const transactionId = await this.beginTransaction();
    const startTime = Date.now();
        
    try {
      errorManager.logError('debug', 'SQLiteManager', 'Ejecutando callback en transacción', {
        transactionId
      });
            
      const result = await callback(this);
      await this.commitTransaction(transactionId);
            
      const duration = Date.now() - startTime;
      errorManager.logError('info', 'SQLiteManager', 'Transacción ejecutada exitosamente', {
        transactionId,
        duration,
        hasResult: result !== undefined
      });
            
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      errorManager.logError('error', 'SQLiteManager', 'Error en transacción, ejecutando rollback', {
        transactionId,
        error: error.message,
        duration
      });
            
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }

  // === CACHE ===
  getCacheKey(sql, params) {
    return crypto.createHash('md5')
      .update(sql + JSON.stringify(params))
      .digest('hex');
  }

  getFromCache(key) {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  setCache(key, data) {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Limpiar cache si es muy grande
    if (this.queryCache.size > 1000) {
      const oldestKeys = Array.from(this.queryCache.keys()).slice(0, 100);
      oldestKeys.forEach(key => this.queryCache.delete(key));
    }
  }

  clearCache() {
    this.queryCache.clear();
  }

  // === BACKUP Y RESTAURACIÓN ===
  async createBackup(filename) {
    if (!filename) {
      filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    }

    const backupPath = path.join(this.config.backupPath, filename);
        
    return new Promise((resolve, reject) => {
      const backup = this.db.backup(backupPath);
            
      backup.step(-1, (err) => {
        if (err) {
          this.logger.error('Error creando backup:', err);
          reject(err);
          return;
        }
                
        backup.finish((err) => {
          if (err) {
            this.logger.error('Error finalizando backup:', err);
            reject(err);
            return;
          }
                    
          this.logger.info(`✅ Backup creado: ${backupPath}`);
          resolve(backupPath);
        });
      });
    });
  }

  async restoreBackup(backupPath) {
    if (!await this.fileExists(backupPath)) {
      throw new Error('Archivo de backup no encontrado');
    }

    // Cerrar conexión actual
    await this.close();

    // Copiar backup sobre la base de datos actual
    await fs.copyFile(backupPath, this.config.dbPath);

    // Reconectar
    await this.connect();
    await this.setupConnection();

    this.logger.info(`✅ Backup restaurado desde: ${backupPath}`);
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // === MANTENIMIENTO ===
  async vacuum() {
    this.logger.info('🧹 Ejecutando VACUUM...');
    await this.run('VACUUM');
    this.logger.info('✅ VACUUM completado');
  }

  async analyze() {
    this.logger.info('📊 Ejecutando ANALYZE...');
    await this.run('ANALYZE');
    this.logger.info('✅ ANALYZE completado');
  }

  async optimize() {
    this.logger.info('⚡ Optimizando base de datos...');
    await this.run('PRAGMA optimize');
    await this.analyze();
    this.logger.info('✅ Optimización completada');
  }

  async getStats() {
    try {
      const dbStats = await this.get('PRAGMA database_list');
      const pageCount = await this.get('PRAGMA page_count');
      const pageSize = await this.get('PRAGMA page_size');
      const freePages = await this.get('PRAGMA freelist_count');
      const cacheSize = await this.get('PRAGMA cache_size');
      const journalMode = await this.get('PRAGMA journal_mode');
            
      const dbSize = pageCount.page_count * pageSize.page_size;
      const freeSpace = freePages.freelist_count * pageSize.page_size;
      const usedSpace = dbSize - freeSpace;
            
      const uptime = Date.now() - this.stats.uptime;
      const queriesPerSecond = this.stats.queries / (uptime / 1000);
      const cacheHitRate = this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100;
      const errorRate = this.stats.errors / this.stats.queries * 100;

      const stats = {
        // Estadísticas de conexión
        isConnected: this.isConnected,
        isHealthy: this.healthCheck.isHealthy,
        uptime: uptime,
        connectionAttempts: this.stats.connectionAttempts,
                
        // Estadísticas de consultas
        totalQueries: this.stats.queries,
        queriesPerSecond: Math.round(queriesPerSecond * 100) / 100,
        totalTransactions: this.stats.transactions,
        activeTransactions: this.activeTransactions.size,
        totalRetries: this.stats.retries,
        totalErrors: this.stats.errors,
        errorRate: Math.round(errorRate * 100) / 100,
        lastError: this.stats.lastError,
                
        // Estadísticas de cache
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        cacheSize: this.queryCache.size,
                
        // Estadísticas de base de datos
        database: {
          path: this.config.dbPath,
          size: this.formatBytes(dbSize),
          sizeBytes: dbSize,
          usedSpace: this.formatBytes(usedSpace),
          freeSpace: this.formatBytes(freeSpace),
          pageCount: pageCount.page_count,
          pageSize: pageSize.page_size,
          journalMode: journalMode.journal_mode,
          cacheSize: cacheSize.cache_size
        },
                
        // Health check
        healthCheck: {
          isHealthy: this.healthCheck.isHealthy,
          lastCheck: this.healthCheck.lastCheck,
          consecutiveFailures: this.healthCheck.consecutiveFailures,
          maxFailures: this.healthCheck.maxFailures
        },
                
        // Configuración
        config: {
          maxRetries: this.config.maxRetries,
          retryDelay: this.config.retryDelay,
          busyTimeout: this.config.busyTimeout,
          queryTimeout: this.config.queryTimeout,
          connectionTimeout: this.config.connectionTimeout
        }
      };

      errorManager.logError('debug', 'SQLiteManager', 'Estadísticas generadas', {
        queriesPerSecond: stats.queriesPerSecond,
        cacheHitRate: stats.cacheHitRate,
        errorRate: stats.errorRate,
        isHealthy: stats.isHealthy
      });

      return stats;
    } catch (error) {
      errorManager.logError('error', 'SQLiteManager', 'Error obteniendo estadísticas', {
        error: error.message
      });
            
      // Retornar estadísticas básicas en caso de error
      return {
        isConnected: this.isConnected,
        isHealthy: this.healthCheck.isHealthy,
        totalQueries: this.stats.queries,
        totalErrors: this.stats.errors,
        error: error.message
      };
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // === HELPERS PARA CONSULTAS COMUNES ===
  async findById(table, id) {
    return await this.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  }

  async findByField(table, field, value) {
    return await this.get(`SELECT * FROM ${table} WHERE ${field} = ?`, [value]);
  }

  async findAll(table, conditions = {}, options = {}) {
    let sql = `SELECT * FROM ${table}`;
    const params = [];

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
      if (options.orderDirection) {
        sql += ` ${options.orderDirection}`;
      }
    }

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
    }

    return await this.all(sql, params);
  }

  async insert(table, data) {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`;
        
    return await this.run(sql, Object.values(data));
  }

  async update(table, id, data, primaryKey = 'id') {
    const fields = Object.keys(data);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${primaryKey} = ?`;
        
    return await this.run(sql, [...Object.values(data), id]);
  }

  async delete(table, id, primaryKey = 'id') {
    return await this.run(`DELETE FROM ${table} WHERE ${primaryKey} = ?`, [id]);
  }

  // === CIERRE ===
  async close() {
    if (!this.isConnected) return;

    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          this.logger.error('Error cerrando base de datos:', err);
          reject(err);
          return;
        }

        this.isConnected = false;
        this.clearCache();
        this.logger.info('✅ Conexión a SQLite cerrada');
        resolve();
      });
    });
  }

  // === CLEANUP ===
  async cleanup() {
    // Limpiar sesiones expiradas
    await this.run('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
        
    // Limpiar eventos de seguridad antiguos (más de 90 días)
    await this.run(`
            DELETE FROM security_events 
            WHERE created_at < datetime('now', '-90 days')
        `);
        
    // Limpiar métricas antiguas (más de 30 días)
    await this.run(`
            DELETE FROM metrics 
            WHERE timestamp < datetime('now', '-30 days')
        `);

    this.logger.info('✅ Limpieza de base de datos completada');
  }
}

export default SQLiteManager;
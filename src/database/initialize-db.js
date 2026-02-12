/**
 * Script de inicialización de base de datos
 * Crea las tablas necesarias si no existen
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../services/core/core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = createLogger('DB_INIT');

const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');

export async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('❌ Error conectando a SQLite:', err);
        reject(err);
        return;
      }

      logger.info('✅ Conectado a SQLite database');

      // Configurar SQLite
      db.serialize(() => {
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA synchronous = NORMAL');
        db.run('PRAGMA cache_size = 10000');
        db.run('PRAGMA temp_store = MEMORY');
        db.run('PRAGMA foreign_keys = ON');

        // Crear tablas
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,

          // Tabla de contactos
          `CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number VARCHAR(20) UNIQUE NOT NULL,
            name VARCHAR(100),
            email VARCHAR(100),
            tags TEXT,
            metadata TEXT,
            status VARCHAR(20) DEFAULT 'active',
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
            direction VARCHAR(10) NOT NULL,
            type VARCHAR(20) NOT NULL,
            content TEXT,
            media_url TEXT,
            status VARCHAR(20) DEFAULT 'sent',
            timestamp DATETIME NOT NULL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
          )`,

          // Tabla de plantillas
          `CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name VARCHAR(100) NOT NULL,
            category VARCHAR(50),
            language VARCHAR(10) DEFAULT 'es',
            status VARCHAR(20) DEFAULT 'active',
            body_text TEXT NOT NULL,
            buttons TEXT,
            variables TEXT,
            description TEXT,
            tags TEXT,
            is_active BOOLEAN DEFAULT 1,
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
            target_segments TEXT,
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
            criteria TEXT NOT NULL,
            contact_count INTEGER DEFAULT 0,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
          )`,

          // Tabla de sesiones
          `CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(128) PRIMARY KEY,
            user_id INTEGER NOT NULL,
            data TEXT,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )`,

          // Tabla de límites de tasa
          `CREATE TABLE IF NOT EXISTS rate_limits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            endpoint VARCHAR(255),
            request_count INTEGER DEFAULT 0,
            reset_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,

          // Tabla de aprobaciones de plantillas
          `CREATE TABLE IF NOT EXISTS template_approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            template_name VARCHAR(255),
            template_data JSON,
            status VARCHAR(20) DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (template_id) REFERENCES templates(id)
          )`,

          // Tabla de aprobaciones de campañas
          `CREATE TABLE IF NOT EXISTS campaign_approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
          )`,

          // Tabla de contactos en campañas
          `CREATE TABLE IF NOT EXISTS campaign_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            contact_id INTEGER NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (contact_id) REFERENCES contacts(id)
          )`,

          // Tabla de mensajes de campañas
          `CREATE TABLE IF NOT EXISTS campaign_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            message_id VARCHAR(100),
            status VARCHAR(20) DEFAULT 'sent',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
          )`,

          // Tabla de logs de auditoría
          `CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action VARCHAR(100),
            entity_type VARCHAR(50),
            entity_id INTEGER,
            changes TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )`,

          // Tabla de definiciones de campos personalizados
          `CREATE TABLE IF NOT EXISTS custom_field_definitions (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(20) NOT NULL,
            description TEXT,
            folder VARCHAR(50),
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,

          // Tabla de valores de campos personalizados por contacto
          `CREATE TABLE IF NOT EXISTS custom_field_values (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER NOT NULL,
            field_id VARCHAR(50) NOT NULL,
            value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
            FOREIGN KEY (field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
            UNIQUE(contact_id, field_id)
          )`,

          // Tabla de tags
          `CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL UNIQUE,
            color VARCHAR(7),
            description TEXT,
            usage_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,

          // Tabla de relación contacto-tags
          `CREATE TABLE IF NOT EXISTS contact_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
            UNIQUE(contact_id, tag_id)
          )`,

          // Tabla de productos
          `CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10, 2) NOT NULL,
            category VARCHAR(100),
            sku VARCHAR(100) UNIQUE,
            image_url TEXT,
            stock INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,

          // Tabla de órdenes
          `CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            total_amount DECIMAL(10, 2),
            items TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
          )`,

          // Tabla de pagos
          `CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            contact_id INTEGER NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            method VARCHAR(50),
            status VARCHAR(20) DEFAULT 'pending',
            transaction_id VARCHAR(100),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
          )`,

          // Tabla de inventario
          `CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 0,
            warehouse VARCHAR(100),
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          )`,

          // Tabla de carritos
          `CREATE TABLE IF NOT EXISTS carts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER NOT NULL,
            items TEXT,
            total_amount DECIMAL(10, 2),
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
          )`,

          // Tabla de reseñas
          `CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            contact_id INTEGER NOT NULL,
            rating INTEGER,
            comment TEXT,
            is_verified BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
          )`,

          // Tabla de suscripciones
          `CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER NOT NULL,
            plan VARCHAR(50),
            status VARCHAR(20) DEFAULT 'active',
            start_date DATETIME,
            end_date DATETIME,
            auto_renew BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
          )`,

          // Tabla de listas de deseos
          `CREATE TABLE IF NOT EXISTS wishlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            UNIQUE(contact_id, product_id)
          )`,

          // Tabla de facturas
          `CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            contact_id INTEGER NOT NULL,
            invoice_number VARCHAR(50) UNIQUE,
            amount DECIMAL(10, 2),
            status VARCHAR(20) DEFAULT 'draft',
            issued_at DATETIME,
            due_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
          )`,

          // Tabla de webhooks procesados (para deduplicación persistente)
          `CREATE TABLE IF NOT EXISTS processed_webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            webhook_id TEXT UNIQUE NOT NULL,
            message_id VARCHAR(100),
            webhook_type VARCHAR(50),
            status VARCHAR(20) DEFAULT 'processed',
            processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            metadata TEXT
          )`
        ];

        let completed = 0;
        const total = tables.length;

        tables.forEach((tableSQL, index) => {
          db.run(tableSQL, (err) => {
            if (err) {
              logger.error(`❌ Error inicializando tabla ${index}:`, err);
            }
            completed++;
            if (completed === total) {
              logger.info('✅ Todas las tablas verificadas/inicializadas correctamente');
              
              // Crear índices (solo para tablas que existen)
              const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number)',
                'CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at)',
                'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
                'CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id)',
                'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id)',
                'CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)',
                'CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)',
                'CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status)',
                'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
                'CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id)',
                'CREATE INDEX IF NOT EXISTS idx_template_approvals_status ON template_approvals(status)',
                'CREATE INDEX IF NOT EXISTS idx_campaign_approvals_status ON campaign_approvals(status)',
                'CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status)',
                'CREATE INDEX IF NOT EXISTS idx_campaign_messages_status ON campaign_messages(status)',
                'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_processed_webhooks_id ON processed_webhooks(webhook_id)',
                'CREATE INDEX IF NOT EXISTS idx_processed_webhooks_expires ON processed_webhooks(expires_at)'
              ];

              let indexCompleted = 0;
              indexes.forEach((indexSQL) => {
                db.run(indexSQL, (err) => {
                  if (err) {
                    logger.error('❌ Error verificando/creando índice:', err);
                  }
                  indexCompleted++;
                  if (indexCompleted === indexes.length) {
                    logger.info('✅ Todos los índices verificados/inicializados correctamente');
                    db.close();
                    resolve();
                  }
                });
              });
            }
          });
        });
      });
    });
  });
}

export default initializeDatabase;

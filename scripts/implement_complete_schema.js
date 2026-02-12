/**
 * Script para implementar la estructura completa de base de datos SQLite
 * Maneja tablas existentes y crea solo las faltantes
 */

import { config } from 'dotenv';
import { Sequelize, DataTypes } from 'sequelize';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de la base de datos
const dbConfig = {
  dialect: 'sqlite',
  storage: join(__dirname, 'chatbot_dev.db'),
  logging: console.log,
  define: {
    timestamps: true,
    underscored: true
  }
};

const sequelize = new Sequelize(dbConfig);

// Función para verificar si una tabla existe
async function tableExists(tableName) {
  try {
    const [results] = await sequelize.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='${tableName}';
    `);
    return results.length > 0;
  } catch (error) {
    return false;
  }
}

// Función para obtener tablas existentes
async function getExistingTables() {
  try {
    const [results] = await sequelize.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%';
    `);
    return results.map(row => row.name);
  } catch (error) {
    return [];
  }
}

// Función para crear tablas faltantes usando SQL directo
async function createMissingTables() {
  const existingTables = await getExistingTables();
  console.log('📊 Tablas existentes:', existingTables);

  const tablesToCreate = [
    {
      name: 'campaigns',
      sql: `
        CREATE TABLE IF NOT EXISTS campaigns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          template_id INTEGER,
          target_segments JSON DEFAULT '[]',
          status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
          scheduled_at DATETIME,
          started_at DATETIME,
          completed_at DATETIME,
          total_recipients INTEGER DEFAULT 0,
          sent_count INTEGER DEFAULT 0,
          delivered_count INTEGER DEFAULT 0,
          read_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          created_by INTEGER,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES message_templates(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        );
      `
    },
    {
      name: 'contact_segments',
      sql: `
        CREATE TABLE IF NOT EXISTS contact_segments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          criteria JSON NOT NULL,
          contact_count INTEGER DEFAULT 0,
          created_by INTEGER NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        );
      `
    },
    {
      name: 'conversation_metrics',
      sql: `
        CREATE TABLE IF NOT EXISTS conversation_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER UNIQUE NOT NULL,
          first_response_time INTEGER,
          avg_response_time INTEGER,
          total_messages INTEGER DEFAULT 0,
          agent_messages INTEGER DEFAULT 0,
          customer_messages INTEGER DEFAULT 0,
          resolution_time INTEGER,
          handoff_count INTEGER DEFAULT 0,
          escalation_count INTEGER DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'audit_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(100) NOT NULL,
          resource_id INTEGER,
          old_values JSON,
          new_values JSON,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `
    },
    {
      name: 'analytics_events',
      sql: `
        CREATE TABLE IF NOT EXISTS analytics_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type VARCHAR(100) NOT NULL,
          event_name VARCHAR(255) NOT NULL,
          user_id INTEGER,
          session_id VARCHAR(255),
          properties JSON DEFAULT '{}',
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `
    },
    {
      name: 'billing_customers',
      sql: `
        CREATE TABLE IF NOT EXISTS billing_customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          user_id INTEGER UNIQUE NOT NULL,
          stripe_customer_id VARCHAR(255) UNIQUE,
          company_name VARCHAR(255),
          tax_id VARCHAR(100),
          billing_email VARCHAR(255),
          billing_address JSON,
          payment_method JSON,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'billing_subscriptions',
      sql: `
        CREATE TABLE IF NOT EXISTS billing_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          customer_id INTEGER NOT NULL,
          stripe_subscription_id VARCHAR(255) UNIQUE,
          plan_id VARCHAR(100) NOT NULL,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
          current_period_start DATETIME,
          current_period_end DATETIME,
          trial_end DATETIME,
          canceled_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES billing_customers(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'billing_invoices',
      sql: `
        CREATE TABLE IF NOT EXISTS billing_invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          customer_id INTEGER NOT NULL,
          subscription_id INTEGER,
          stripe_invoice_id VARCHAR(255) UNIQUE,
          invoice_number VARCHAR(100),
          amount_due DECIMAL(10,2) NOT NULL,
          amount_paid DECIMAL(10,2) DEFAULT 0,
          currency VARCHAR(3) DEFAULT 'USD',
          status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
          due_date DATETIME,
          paid_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES billing_customers(id) ON DELETE CASCADE,
          FOREIGN KEY (subscription_id) REFERENCES billing_subscriptions(id)
        );
      `
    },
    {
      name: 'billing_payments',
      sql: `
        CREATE TABLE IF NOT EXISTS billing_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          customer_id INTEGER NOT NULL,
          invoice_id INTEGER,
          stripe_payment_id VARCHAR(255) UNIQUE,
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'USD',
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded')),
          payment_method VARCHAR(100),
          failure_reason TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES billing_customers(id) ON DELETE CASCADE,
          FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id)
        );
      `
    },
    {
      name: 'billing_usage',
      sql: `
        CREATE TABLE IF NOT EXISTS billing_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          subscription_id INTEGER,
          metric_name VARCHAR(100) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          unit_price DECIMAL(10,4),
          total_amount DECIMAL(10,2),
          period_start DATETIME NOT NULL,
          period_end DATETIME NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES billing_customers(id) ON DELETE CASCADE,
          FOREIGN KEY (subscription_id) REFERENCES billing_subscriptions(id)
        );
      `
    },
    {
      name: 'commerce_categories',
      sql: `
        CREATE TABLE IF NOT EXISTS commerce_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          parent_id INTEGER,
          slug VARCHAR(255) UNIQUE NOT NULL,
          image_url TEXT,
          is_active BOOLEAN DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES commerce_categories(id)
        );
      `
    },
    {
      name: 'commerce_products',
      sql: `
        CREATE TABLE IF NOT EXISTS commerce_products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          short_description TEXT,
          sku VARCHAR(100) UNIQUE NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          compare_price DECIMAL(10,2),
          cost_price DECIMAL(10,2),
          category_id INTEGER,
          images JSON DEFAULT '[]',
          attributes JSON DEFAULT '{}',
          is_active BOOLEAN DEFAULT 1,
          is_digital BOOLEAN DEFAULT 0,
          weight DECIMAL(8,2),
          dimensions JSON,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES commerce_categories(id)
        );
      `
    },
    {
      name: 'commerce_inventory',
      sql: `
        CREATE TABLE IF NOT EXISTS commerce_inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER UNIQUE NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          reserved_quantity INTEGER DEFAULT 0,
          low_stock_threshold INTEGER DEFAULT 10,
          track_inventory BOOLEAN DEFAULT 1,
          allow_backorders BOOLEAN DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES commerce_products(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'commerce_orders',
      sql: `
        CREATE TABLE IF NOT EXISTS commerce_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          order_number VARCHAR(100) UNIQUE NOT NULL,
          customer_id INTEGER,
          contact_id INTEGER,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled', 'refunded')),
          subtotal DECIMAL(10,2) NOT NULL,
          tax_amount DECIMAL(10,2) DEFAULT 0,
          shipping_amount DECIMAL(10,2) DEFAULT 0,
          discount_amount DECIMAL(10,2) DEFAULT 0,
          total_amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'USD',
          payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
          shipping_address JSON,
          billing_address JSON,
          notes TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES billing_customers(id),
          FOREIGN KEY (contact_id) REFERENCES contacts(id)
        );
      `
    },
    {
      name: 'commerce_order_items',
      sql: `
        CREATE TABLE IF NOT EXISTS commerce_order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          product_snapshot JSON,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES commerce_orders(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES commerce_products(id)
        );
      `
    },
    {
      name: 'automation_rules',
      sql: `
        CREATE TABLE IF NOT EXISTS automation_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT 1,
          trigger_type VARCHAR(100) NOT NULL,
          trigger_config JSON NOT NULL,
          conditions JSON DEFAULT '[]',
          actions JSON NOT NULL,
          execution_count INTEGER DEFAULT 0,
          last_executed_at DATETIME,
          created_by INTEGER NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        );
      `
    },
    {
      name: 'automation_triggers',
      sql: `
        CREATE TABLE IF NOT EXISTS automation_triggers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rule_id INTEGER NOT NULL,
          trigger_data JSON NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          executed_at DATETIME,
          error_message TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'automation_actions',
      sql: `
        CREATE TABLE IF NOT EXISTS automation_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trigger_id INTEGER NOT NULL,
          action_type VARCHAR(100) NOT NULL,
          action_config JSON NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'skipped')),
          result JSON,
          executed_at DATETIME,
          error_message TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trigger_id) REFERENCES automation_triggers(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'integrations',
      sql: `
        CREATE TABLE IF NOT EXISTS integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          name VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          provider VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          config JSON NOT NULL,
          credentials JSON,
          last_sync_at DATETIME,
          sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'success')),
          error_message TEXT,
          created_by INTEGER NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        );
      `
    },
    {
      name: 'integration_configs',
      sql: `
        CREATE TABLE IF NOT EXISTS integration_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          integration_id INTEGER NOT NULL,
          key VARCHAR(255) NOT NULL,
          value JSON NOT NULL,
          is_encrypted BOOLEAN DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
          UNIQUE(integration_id, key)
        );
      `
    },
    {
      name: 'webhooks',
      sql: `
        CREATE TABLE IF NOT EXISTS webhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          name VARCHAR(255) NOT NULL,
          url VARCHAR(500) NOT NULL,
          events JSON NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          secret VARCHAR(255),
          headers JSON DEFAULT '{}',
          retry_count INTEGER DEFAULT 3,
          timeout INTEGER DEFAULT 30,
          last_triggered_at DATETIME,
          created_by INTEGER NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        );
      `
    },
    {
      name: 'webhook_events',
      sql: `
        CREATE TABLE IF NOT EXISTS webhook_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          webhook_id INTEGER NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          payload JSON NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
          response_code INTEGER,
          response_body TEXT,
          attempts INTEGER DEFAULT 0,
          last_attempt_at DATETIME,
          next_retry_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'notifications',
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          user_id INTEGER NOT NULL,
          type VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          data JSON DEFAULT '{}',
          is_read BOOLEAN DEFAULT 0,
          read_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'notification_templates',
      sql: `
        CREATE TABLE IF NOT EXISTS notification_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          name VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          subject VARCHAR(255),
          body TEXT NOT NULL,
          variables JSON DEFAULT '[]',
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `
    },
    {
      name: 'user_sessions',
      sql: `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          expires_at DATETIME NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'api_keys',
      sql: `
        CREATE TABLE IF NOT EXISTS api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          user_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          key_hash VARCHAR(255) UNIQUE NOT NULL,
          permissions JSON DEFAULT '[]',
          is_active BOOLEAN DEFAULT 1,
          last_used_at DATETIME,
          expires_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'rate_limits',
      sql: `
        CREATE TABLE IF NOT EXISTS rate_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          identifier VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          count INTEGER NOT NULL DEFAULT 1,
          window_start DATETIME NOT NULL,
          window_end DATETIME NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(identifier, action, window_start)
        );
      `
    }
  ];

  // Crear tablas faltantes
  for (const table of tablesToCreate) {
    if (!existingTables.includes(table.name)) {
      try {
        console.log(`🔄 Creando tabla: ${table.name}`);
        await sequelize.query(table.sql);
        console.log(`✅ Tabla ${table.name} creada exitosamente`);
      } catch (error) {
        console.error(`❌ Error creando tabla ${table.name}:`, error.message);
      }
    } else {
      console.log(`⏭️ Tabla ${table.name} ya existe, omitiendo...`);
    }
  }

  // Crear índices adicionales
  await createIndexes();
}

// Función para crear índices adicionales
async function createIndexes() {
  console.log('🔄 Creando índices adicionales...');
  
  const indexes = [
    // Índices para campaigns
    'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);',
    'CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);',
    'CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by);',
    'CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);',
    
    // Índices para contact_segments
    'CREATE INDEX IF NOT EXISTS idx_contact_segments_created_by ON contact_segments(created_by);',
    
    // Índices para conversation_metrics
    'CREATE INDEX IF NOT EXISTS idx_conversation_metrics_conversation_id ON conversation_metrics(conversation_id);',
    
    // Índices para audit_logs
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);',
    
    // Índices para analytics_events
    'CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);',
    'CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);',
    
    // Índices para billing
    'CREATE INDEX IF NOT EXISTS idx_billing_customers_user_id ON billing_customers(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer_id ON billing_subscriptions(customer_id);',
    'CREATE INDEX IF NOT EXISTS idx_billing_invoices_customer_id ON billing_invoices(customer_id);',
    'CREATE INDEX IF NOT EXISTS idx_billing_payments_customer_id ON billing_payments(customer_id);',
    
    // Índices para commerce
    'CREATE INDEX IF NOT EXISTS idx_commerce_products_category_id ON commerce_products(category_id);',
    'CREATE INDEX IF NOT EXISTS idx_commerce_products_sku ON commerce_products(sku);',
    'CREATE INDEX IF NOT EXISTS idx_commerce_orders_customer_id ON commerce_orders(customer_id);',
    'CREATE INDEX IF NOT EXISTS idx_commerce_orders_contact_id ON commerce_orders(contact_id);',
    'CREATE INDEX IF NOT EXISTS idx_commerce_order_items_order_id ON commerce_order_items(order_id);',
    
    // Índices para automation
    'CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by ON automation_rules(created_by);',
    'CREATE INDEX IF NOT EXISTS idx_automation_triggers_rule_id ON automation_triggers(rule_id);',
    'CREATE INDEX IF NOT EXISTS idx_automation_actions_trigger_id ON automation_actions(trigger_id);',
    
    // Índices para integrations
    'CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by);',
    'CREATE INDEX IF NOT EXISTS idx_integration_configs_integration_id ON integration_configs(integration_id);',
    
    // Índices para webhooks
    'CREATE INDEX IF NOT EXISTS idx_webhooks_created_by ON webhooks(created_by);',
    'CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id);',
    
    // Índices para notifications
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);',
    
    // Índices para sessions y API keys
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);',
    'CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);',
    
    // Índices para rate limits
    'CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);',
    'CREATE INDEX IF NOT EXISTS idx_rate_limits_action ON rate_limits(action);'
  ];

  for (const indexSql of indexes) {
    try {
      await sequelize.query(indexSql);
    } catch (error) {
      // Ignorar errores de índices que ya existen
      if (!error.message.includes('already exists')) {
        console.error('❌ Error creando índice:', error.message);
      }
    }
  }
  
  console.log('✅ Índices creados exitosamente');
}

// Función para insertar datos iniciales
async function insertInitialData() {
  try {
    console.log('🔄 Insertando datos iniciales...');

    // Verificar si ya existen configuraciones del sistema
    const [settingsCount] = await sequelize.query('SELECT COUNT(*) as count FROM system_settings');
    if (settingsCount[0].count === 0) {
      const defaultSettings = [
        ['app.name', '"ChatBot Enterprise"', 'Nombre de la aplicación', 'general', 1],
        ['app.version', '"1.0.0"', 'Versión de la aplicación', 'general', 1],
        ['chat.auto_assignment', 'true', 'Asignación automática de conversaciones', 'chat', 0],
        ['notifications.email_enabled', 'true', 'Notificaciones por email habilitadas', 'notifications', 0],
        ['analytics.retention_days', '365', 'Días de retención de datos analíticos', 'analytics', 0]
      ];

      for (const setting of defaultSettings) {
        await sequelize.query(`
          INSERT INTO system_settings (key, value, description, category, is_public, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, {
          replacements: setting
        });
      }
      console.log('✅ Configuraciones del sistema creadas');
    }

    // Verificar si ya existen etiquetas
    const [tagsCount] = await sequelize.query('SELECT COUNT(*) as count FROM tags');
    if (tagsCount[0].count === 0) {
      const defaultTags = [
        ['Urgente', '#dc3545', 'Casos que requieren atención inmediata'],
        ['Prospecto', '#28a745', 'Clientes potenciales'],
        ['Soporte', '#007bff', 'Consultas de soporte técnico'],
        ['Ventas', '#ffc107', 'Consultas relacionadas con ventas'],
        ['Reclamo', '#fd7e14', 'Quejas o reclamos de clientes']
      ];

      for (const tag of defaultTags) {
        await sequelize.query(`
          INSERT INTO tags (name, color, description, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, {
          replacements: tag
        });
      }
      console.log('✅ Etiquetas por defecto creadas');
    }

    // Verificar si ya existen plantillas
    const [templatesCount] = await sequelize.query('SELECT COUNT(*) as count FROM message_templates');
    if (templatesCount[0].count === 0) {
      const defaultTemplates = [
        ['bienvenida', 'Hola {{nombre}}, bienvenido a nuestro servicio de atención al cliente. ¿En qué podemos ayudarte hoy?', 'utility', 'approved', 'es'],
        ['horario_atencion', 'Nuestro horario de atención es de lunes a viernes de 9:00 AM a 6:00 PM, hora de México.', 'utility', 'approved', 'es'],
        ['agradecimiento', 'Gracias por contactarnos, {{nombre}}. Tu consulta es importante para nosotros y te responderemos a la brevedad.', 'utility', 'approved', 'es'],
        ['despedida', 'Gracias por usar nuestro servicio. Si tienes más preguntas, no dudes en contactarnos. ¡Que tengas un excelente día!', 'utility', 'approved', 'es']
      ];

      for (const template of defaultTemplates) {
        await sequelize.query(`
          INSERT INTO message_templates (name, content, category, status, language, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, {
          replacements: template
        });
      }
      console.log('✅ Plantillas por defecto creadas');
    }

    console.log('✅ Datos iniciales insertados');

  } catch (error) {
    console.error('❌ Error insertando datos iniciales:', error);
  }
}

// Función principal para implementar el esquema
async function implementCompleteSchema() {
  try {
    console.log('🔄 Iniciando implementación del esquema completo...');
    
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');

    // Crear tablas faltantes
    await createMissingTables();

    // Insertar datos iniciales
    await insertInitialData();

    console.log('🎉 Esquema completo implementado exitosamente');
    return true;

  } catch (error) {
    console.error('❌ Error implementando el esquema:', error);
    return false;
  } finally {
    await sequelize.close();
    console.log('🔒 Conexión cerrada');
  }
}

// Ejecutar la implementación
implementCompleteSchema()
  .then(success => {
    if (success) {
      console.log('🎉 Implementación del esquema completada exitosamente');
      process.exit(0);
    } else {
      console.log('💥 Error en la implementación del esquema');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Error inesperado:', error);
    process.exit(1);
  });
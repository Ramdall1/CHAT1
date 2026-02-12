-- ============================================
-- SCRIPT DE CORRECCIÓN URGENTE - BASE DE DATOS
-- Fecha: 27 de Octubre, 2025
-- Propósito: Corregir inconsistencias críticas en el esquema
-- ============================================

-- 1. CORREGIR TABLA CAMPAIGNS
-- Agregar columnas faltantes que el código espera
ALTER TABLE campaigns ADD COLUMN user_id INTEGER;
ALTER TABLE campaigns ADD COLUMN template_id INTEGER;
ALTER TABLE campaigns ADD COLUMN segment_id INTEGER;
ALTER TABLE campaigns ADD COLUMN approval_status TEXT DEFAULT 'pending';
ALTER TABLE campaigns ADD COLUMN approved_by INTEGER;
ALTER TABLE campaigns ADD COLUMN approved_at DATETIME;
ALTER TABLE campaigns ADD COLUMN rejection_reason TEXT;
ALTER TABLE campaigns ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN last_retry_at DATETIME;
ALTER TABLE campaigns ADD COLUMN priority INTEGER DEFAULT 5;
ALTER TABLE campaigns ADD COLUMN tags TEXT;

-- 2. CREAR ÍNDICES OPTIMIZADOS
-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_priority_status ON campaigns(priority, status);

-- Índices para mensajes
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);

-- Índices para contactos
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(last_interaction);

-- Índices para campaign_messages
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_id ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_status ON campaign_messages(status);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_sent_at ON campaign_messages(sent_at);

-- 3. CREAR TABLA DE AUDITORÍA SI NO EXISTE
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    user_id INTEGER,
    changes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 4. CREAR TABLA DE QUEUE SI NO EXISTE
CREATE TABLE IF NOT EXISTS message_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    contact_id INTEGER,
    message_type TEXT NOT NULL,
    message_content TEXT NOT NULL,
    media_url TEXT,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    scheduled_at DATETIME,
    processed_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON message_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled_at ON message_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_queue_campaign_id ON message_queue(campaign_id);

-- 5. CREAR TABLA DE RATE LIMITS SI NO EXISTE
CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL UNIQUE,
    endpoint TEXT NOT NULL,
    limit_count INTEGER DEFAULT 0,
    window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    window_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start, window_end);

-- 6. AGREGAR COLUMNAS FALTANTES A OTRAS TABLAS
-- Tabla contacts
ALTER TABLE contacts ADD COLUMN tags TEXT;
ALTER TABLE contacts ADD COLUMN score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN segment_ids TEXT;
ALTER TABLE contacts ADD COLUMN custom_attributes TEXT;
ALTER TABLE contacts ADD COLUMN timezone TEXT;
ALTER TABLE contacts ADD COLUMN language TEXT DEFAULT 'es';
ALTER TABLE contacts ADD COLUMN opted_in BOOLEAN DEFAULT 1;
ALTER TABLE contacts ADD COLUMN opted_in_at DATETIME;

-- Tabla messages  
ALTER TABLE messages ADD COLUMN campaign_id INTEGER;
ALTER TABLE messages ADD COLUMN template_id INTEGER;
ALTER TABLE messages ADD COLUMN cost REAL DEFAULT 0;
ALTER TABLE messages ADD COLUMN delivered_at DATETIME;
ALTER TABLE messages ADD COLUMN read_at DATETIME;
ALTER TABLE messages ADD COLUMN failed_at DATETIME;
ALTER TABLE messages ADD COLUMN error_code TEXT;
ALTER TABLE messages ADD COLUMN retry_count INTEGER DEFAULT 0;

-- 7. CREAR VISTAS ÚTILES
-- Vista de resumen de campañas
CREATE VIEW IF NOT EXISTS campaign_summary AS
SELECT 
    c.id,
    c.name,
    c.status,
    c.created_at,
    COUNT(DISTINCT cm.contact_id) as total_contacts,
    SUM(CASE WHEN cm.status = 'sent' THEN 1 ELSE 0 END) as sent_count,
    SUM(CASE WHEN cm.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
    SUM(CASE WHEN cm.status = 'read' THEN 1 ELSE 0 END) as read_count,
    SUM(CASE WHEN cm.status = 'failed' THEN 1 ELSE 0 END) as failed_count
FROM campaigns c
LEFT JOIN campaign_messages cm ON c.id = cm.campaign_id
GROUP BY c.id;

-- Vista de actividad reciente
CREATE VIEW IF NOT EXISTS recent_activity AS
SELECT 
    'message' as type,
    id,
    contact_id,
    message as content,
    timestamp as created_at
FROM messages
WHERE timestamp > datetime('now', '-7 days')
UNION ALL
SELECT 
    'campaign' as type,
    id,
    NULL as contact_id,
    name as content,
    created_at
FROM campaigns
WHERE created_at > datetime('now', '-7 days')
ORDER BY created_at DESC
LIMIT 100;

-- 8. TRIGGERS PARA UPDATED_AT
-- Trigger para campaigns
CREATE TRIGGER IF NOT EXISTS update_campaigns_updated_at 
AFTER UPDATE ON campaigns
BEGIN
    UPDATE campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger para contacts
CREATE TRIGGER IF NOT EXISTS update_contacts_updated_at 
AFTER UPDATE ON contacts
BEGIN
    UPDATE contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger para messages
CREATE TRIGGER IF NOT EXISTS update_messages_updated_at 
AFTER UPDATE ON messages
BEGIN
    UPDATE messages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 9. DATOS DE PRUEBA/CONFIGURACIÓN INICIAL
-- Insertar configuraciones básicas si no existen
INSERT OR IGNORE INTO settings (key, value, created_at) VALUES 
    ('max_retry_attempts', '3', CURRENT_TIMESTAMP),
    ('retry_delay_seconds', '300', CURRENT_TIMESTAMP),
    ('rate_limit_per_minute', '60', CURRENT_TIMESTAMP),
    ('default_timezone', 'America/Bogota', CURRENT_TIMESTAMP),
    ('campaign_auto_approval', 'false', CURRENT_TIMESTAMP);

-- 10. VERIFICACIÓN FINAL
-- Query para verificar que todo se creó correctamente
SELECT 
    'Campaigns columns' as check_type,
    COUNT(*) as count
FROM pragma_table_info('campaigns')
WHERE name IN ('user_id', 'template_id', 'segment_id')
UNION ALL
SELECT 
    'Indexes created' as check_type,
    COUNT(*) as count
FROM sqlite_master 
WHERE type = 'index' AND name LIKE 'idx_%'
UNION ALL
SELECT 
    'New tables created' as check_type,
    COUNT(*) as count
FROM sqlite_master 
WHERE type = 'table' AND name IN ('audit_logs', 'message_queue', 'rate_limits')
UNION ALL
SELECT 
    'Views created' as check_type,
    COUNT(*) as count
FROM sqlite_master 
WHERE type = 'view' AND name IN ('campaign_summary', 'recent_activity')
UNION ALL
SELECT 
    'Triggers created' as check_type,
    COUNT(*) as count
FROM sqlite_master 
WHERE type = 'trigger' AND name LIKE 'update_%';

-- ============================================
-- FIN DEL SCRIPT DE CORRECCIÓN
-- Para ejecutar: sqlite3 data/chatbot.db < fix-critical-issues.sql
-- ============================================

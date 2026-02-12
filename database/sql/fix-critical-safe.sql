-- ============================================
-- SCRIPT DE CORRECCIÓN SEGURO - BASE DE DATOS
-- Fecha: 27 de Octubre, 2025
-- Versión: 2.0 - Con verificaciones de existencia
-- ============================================

-- 1. CORREGIR TABLA CAMPAIGNS (solo columnas faltantes críticas)
-- Solo agregar user_id y template_id que son las que causan el error
BEGIN TRANSACTION;

-- Verificar y agregar columnas solo si no existen
-- SQLite no soporta IF NOT EXISTS en ALTER TABLE, así que usaremos un approach diferente

-- Crear tabla temporal con la estructura deseada
CREATE TABLE IF NOT EXISTS campaigns_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    message TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT,
    filters TEXT,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    scheduled_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Nuevas columnas críticas
    user_id INTEGER,
    template_id INTEGER,
    segment_id INTEGER,
    approval_status TEXT DEFAULT 'pending',
    approved_by INTEGER,
    approved_at DATETIME,
    rejection_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at DATETIME,
    priority INTEGER DEFAULT 5,
    tags TEXT
);

-- Copiar datos existentes
INSERT INTO campaigns_new (
    id, name, description, message, media_url, media_type, filters,
    total_recipients, sent_count, delivered_count, read_count, failed_count,
    status, scheduled_at, started_at, completed_at, created_by,
    created_at, updated_at
)
SELECT 
    id, name, description, message, media_url, media_type, filters,
    total_recipients, sent_count, delivered_count, read_count, failed_count,
    status, scheduled_at, started_at, completed_at, created_by,
    created_at, updated_at
FROM campaigns;

-- Eliminar tabla antigua y renombrar la nueva
DROP TABLE campaigns;
ALTER TABLE campaigns_new RENAME TO campaigns;

COMMIT;

-- 2. CREAR ÍNDICES CRÍTICOS
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_priority_status ON campaigns(priority, status);

-- Índices para mensajes (usando columnas existentes)
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Índices para contactos
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(last_interaction);

-- 3. CREAR TABLAS NUEVAS SI NO EXISTEN
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

-- 4. CREAR ÍNDICES PARA NUEVAS TABLAS
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON message_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled_at ON message_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_queue_campaign_id ON message_queue(campaign_id);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start, window_end);

-- 5. VERIFICACIÓN FINAL
SELECT 
    'Script ejecutado exitosamente' as status,
    datetime('now', 'localtime') as executed_at;

-- Verificar que las columnas críticas existen
SELECT 
    'Columnas agregadas a campaigns' as verification,
    COUNT(*) as count
FROM pragma_table_info('campaigns')
WHERE name IN ('user_id', 'template_id');

-- Contar índices creados
SELECT 
    'Total de índices' as verification,
    COUNT(*) as count
FROM sqlite_master 
WHERE type = 'index' AND name LIKE 'idx_%';

-- ============================================
-- FIN DEL SCRIPT SEGURO
-- Para ejecutar: sqlite3 data/chatbot.db < fix-critical-safe.sql
-- ============================================

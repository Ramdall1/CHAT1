-- =====================================================
-- ChatBot Enterprise - PostgreSQL Database Schema
-- Migración desde MongoDB a PostgreSQL
-- Versión: 1.0
-- Fecha: 22 de enero de 2025
-- =====================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =====================================================
-- TIPOS ENUMERADOS (ENUMs)
-- =====================================================

-- Roles de usuario
CREATE TYPE user_role_enum AS ENUM (
    'admin',
    'manager', 
    'operator',
    'user'
);

-- Canales de conversación
CREATE TYPE conversation_channel_enum AS ENUM (
    'whatsapp',
    'facebook',
    'telegram',
    'instagram',
    'web',
    'email',
    'sms'
);

-- Estados de conversación
CREATE TYPE conversation_status_enum AS ENUM (
    'active',
    'pending',
    'resolved',
    'closed',
    'archived'
);

-- Niveles de prioridad
CREATE TYPE priority_enum AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

-- Tipos de mensaje
CREATE TYPE message_type_enum AS ENUM (
    'text',
    'image',
    'audio',
    'video',
    'document',
    'location',
    'contact',
    'sticker',
    'template'
);

-- Dirección del mensaje
CREATE TYPE message_direction_enum AS ENUM (
    'inbound',
    'outbound'
);

-- Categorías de plantilla
CREATE TYPE template_category_enum AS ENUM (
    'marketing',
    'utility',
    'authentication',
    'support',
    'notification'
);

-- Estados de plantilla
CREATE TYPE template_status_enum AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected',
    'archived'
);

-- Estados de campaña
CREATE TYPE campaign_status_enum AS ENUM (
    'draft',
    'scheduled',
    'running',
    'paused',
    'completed',
    'cancelled'
);

-- Estados de contacto
CREATE TYPE contact_status_enum AS ENUM (
    'active',
    'inactive',
    'blocked',
    'unsubscribed'
);

-- =====================================================
-- TABLAS PRINCIPALES
-- =====================================================

-- Tabla de usuarios del sistema
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    last_login TIMESTAMPTZ,
    permissions JSONB DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~* '^\+[1-9]\d{1,14}$')
);

-- Tabla de contactos
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    status contact_status_enum NOT NULL DEFAULT 'active',
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    last_interaction TIMESTAMPTZ,
    source VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT contacts_phone_format CHECK (phone ~* '^\+[1-9]\d{1,14}$'),
    CONSTRAINT contacts_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Tabla de conversaciones
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    channel conversation_channel_enum NOT NULL,
    status conversation_status_enum NOT NULL DEFAULT 'active',
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    priority priority_enum DEFAULT 'medium',
    subject VARCHAR(255),
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    last_message_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    resolution_time INTERVAL,
    satisfaction_score DECIMAL(3,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT conversations_satisfaction_score_range CHECK (satisfaction_score IS NULL OR (satisfaction_score >= 0 AND satisfaction_score <= 10))
);

-- Tabla de mensajes
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type message_type_enum NOT NULL DEFAULT 'text',
    direction message_direction_enum NOT NULL,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    external_id VARCHAR(255),
    media_url VARCHAR(500),
    media_type VARCHAR(100),
    media_size INTEGER,
    metadata JSONB DEFAULT '{}',
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT messages_content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT messages_media_size_positive CHECK (media_size IS NULL OR media_size > 0)
);

-- Tabla de plantillas de mensaje
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    category template_category_enum NOT NULL,
    status template_status_enum NOT NULL DEFAULT 'draft',
    language VARCHAR(10) DEFAULT 'es',
    variables JSONB DEFAULT '[]',
    header_type VARCHAR(50),
    header_content TEXT,
    footer_content TEXT,
    buttons JSONB DEFAULT '[]',
    usage_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT templates_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT templates_content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT templates_usage_count_positive CHECK (usage_count >= 0)
);

-- Tabla de campañas
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    target_segments JSONB DEFAULT '[]',
    status campaign_status_enum NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT campaigns_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT campaigns_counts_positive CHECK (
        total_recipients >= 0 AND 
        sent_count >= 0 AND 
        delivered_count >= 0 AND 
        read_count >= 0 AND 
        failed_count >= 0
    )
);

-- Tabla de segmentos de contactos
CREATE TABLE contact_segments (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL,
    contact_count INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT segments_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT segments_contact_count_positive CHECK (contact_count >= 0)
);

-- Tabla de etiquetas
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT tags_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT tags_color_format CHECK (color ~* '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT tags_usage_count_positive CHECK (usage_count >= 0)
);

-- Tabla de métricas de conversación
CREATE TABLE conversation_metrics (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER UNIQUE NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    first_response_time INTERVAL,
    avg_response_time INTERVAL,
    total_messages INTEGER DEFAULT 0,
    agent_messages INTEGER DEFAULT 0,
    customer_messages INTEGER DEFAULT 0,
    resolution_time INTERVAL,
    handoff_count INTEGER DEFAULT 0,
    escalation_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT metrics_message_counts_positive CHECK (
        total_messages >= 0 AND 
        agent_messages >= 0 AND 
        customer_messages >= 0 AND
        handoff_count >= 0 AND
        escalation_count >= 0
    )
);

-- Tabla de configuraciones del sistema
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT settings_key_not_empty CHECK (LENGTH(TRIM(key)) > 0)
);

-- Tabla de logs de auditoría
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT audit_action_not_empty CHECK (LENGTH(TRIM(action)) > 0),
    CONSTRAINT audit_resource_type_not_empty CHECK (LENGTH(TRIM(resource_type)) > 0)
);

-- =====================================================
-- TABLAS DE RELACIÓN (Many-to-Many)
-- =====================================================

-- Relación contactos-segmentos
CREATE TABLE contact_segment_members (
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    segment_id INTEGER NOT NULL REFERENCES contact_segments(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (contact_id, segment_id)
);

-- Relación conversaciones-etiquetas
CREATE TABLE conversation_tags (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (conversation_id, tag_id)
);

-- Relación contactos-etiquetas
CREATE TABLE contact_tags (
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (contact_id, tag_id)
);

-- =====================================================
-- ÍNDICES OPTIMIZADOS
-- =====================================================

-- Índices para usuarios
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login);
CREATE INDEX idx_users_uuid ON users(uuid);

-- Índices para contactos
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);
CREATE INDEX idx_contacts_last_interaction ON contacts(last_interaction);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_name_trgm ON contacts USING GIN(name gin_trgm_ops);
CREATE INDEX idx_contacts_uuid ON contacts(uuid);

-- Índices para conversaciones
CREATE INDEX idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_assigned_to ON conversations(assigned_to);
CREATE INDEX idx_conversations_priority ON conversations(priority);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX idx_conversations_tags ON conversations USING GIN(tags);
CREATE INDEX idx_conversations_uuid ON conversations(uuid);

-- Índices para mensajes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_message_type ON messages(message_type);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_external_id ON messages(external_id);
CREATE INDEX idx_messages_read_at ON messages(read_at);
CREATE INDEX idx_messages_delivered_at ON messages(delivered_at);
CREATE INDEX idx_messages_uuid ON messages(uuid);

-- Índices para plantillas
CREATE INDEX idx_templates_name ON templates(name);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_status ON templates(status);
CREATE INDEX idx_templates_language ON templates(language);
CREATE INDEX idx_templates_created_by ON templates(created_by);
CREATE INDEX idx_templates_created_at ON templates(created_at);
CREATE INDEX idx_templates_usage_count ON templates(usage_count);
CREATE INDEX idx_templates_uuid ON templates(uuid);

-- Índices para campañas
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_scheduled_at ON campaigns(scheduled_at);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at);
CREATE INDEX idx_campaigns_uuid ON campaigns(uuid);

-- Índices para segmentos
CREATE INDEX idx_segments_created_by ON contact_segments(created_by);
CREATE INDEX idx_segments_created_at ON contact_segments(created_at);
CREATE INDEX idx_segments_contact_count ON contact_segments(contact_count);
CREATE INDEX idx_segments_uuid ON contact_segments(uuid);

-- Índices para etiquetas
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_usage_count ON tags(usage_count);
CREATE INDEX idx_tags_created_by ON tags(created_by);
CREATE INDEX idx_tags_uuid ON tags(uuid);

-- Índices para métricas
CREATE INDEX idx_metrics_conversation_id ON conversation_metrics(conversation_id);
CREATE INDEX idx_metrics_created_at ON conversation_metrics(created_at);

-- Índices para configuraciones
CREATE INDEX idx_settings_key ON system_settings(key);
CREATE INDEX idx_settings_category ON system_settings(category);
CREATE INDEX idx_settings_is_public ON system_settings(is_public);

-- Índices para auditoría
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- Índices para relaciones many-to-many
CREATE INDEX idx_contact_segments_contact_id ON contact_segment_members(contact_id);
CREATE INDEX idx_contact_segments_segment_id ON contact_segment_members(segment_id);
CREATE INDEX idx_conversation_tags_conversation_id ON conversation_tags(conversation_id);
CREATE INDEX idx_conversation_tags_tag_id ON conversation_tags(tag_id);
CREATE INDEX idx_contact_tags_contact_id ON contact_tags(contact_id);
CREATE INDEX idx_contact_tags_tag_id ON contact_tags(tag_id);

-- Índices para búsqueda de texto completo
CREATE INDEX idx_messages_content_fts ON messages USING GIN(to_tsvector('spanish', content));
CREATE INDEX idx_templates_content_fts ON templates USING GIN(to_tsvector('spanish', content));
CREATE INDEX idx_conversations_subject_fts ON conversations USING GIN(to_tsvector('spanish', subject));

-- =====================================================
-- TRIGGERS Y FUNCIONES
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON contact_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_metrics_updated_at BEFORE UPDATE ON conversation_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para actualizar last_message_at en conversaciones
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.timestamp,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar last_message_at
CREATE TRIGGER update_conversation_last_message_trigger 
    AFTER INSERT ON messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_conversation_last_message();

-- Función para actualizar contadores de uso
CREATE OR REPLACE FUNCTION update_usage_counters()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar contador de plantillas
    IF TG_TABLE_NAME = 'messages' AND NEW.message_type = 'template' THEN
        UPDATE templates 
        SET usage_count = usage_count + 1,
            updated_at = NOW()
        WHERE id = (NEW.metadata->>'template_id')::INTEGER;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para contadores de uso
CREATE TRIGGER update_usage_counters_trigger 
    AFTER INSERT ON messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_usage_counters();

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de conversaciones con información completa
CREATE VIEW conversation_details AS
SELECT 
    c.id,
    c.uuid,
    c.status,
    c.channel,
    c.priority,
    c.subject,
    c.created_at,
    c.updated_at,
    c.last_message_at,
    c.satisfaction_score,
    cont.name as contact_name,
    cont.phone as contact_phone,
    cont.email as contact_email,
    u.first_name || ' ' || u.last_name as assigned_agent,
    creator.first_name || ' ' || creator.last_name as created_by_name,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.direction = 'inbound') as inbound_messages,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.direction = 'outbound') as outbound_messages
FROM conversations c
LEFT JOIN contacts cont ON c.contact_id = cont.id
LEFT JOIN users u ON c.assigned_to = u.id
LEFT JOIN users creator ON c.user_id = creator.id;

-- Vista de métricas de agentes
CREATE VIEW agent_metrics AS
SELECT 
    u.id,
    u.first_name || ' ' || u.last_name as agent_name,
    u.email,
    COUNT(DISTINCT c.id) as total_conversations,
    COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_conversations,
    COUNT(DISTINCT CASE WHEN c.status = 'resolved' THEN c.id END) as resolved_conversations,
    AVG(c.satisfaction_score) as avg_satisfaction,
    COUNT(DISTINCT m.id) as total_messages_sent,
    AVG(EXTRACT(EPOCH FROM cm.avg_response_time)) as avg_response_time_seconds
FROM users u
LEFT JOIN conversations c ON u.id = c.assigned_to
LEFT JOIN messages m ON c.id = m.conversation_id AND m.sender_id = u.id
LEFT JOIN conversation_metrics cm ON c.id = cm.conversation_id
WHERE u.role IN ('operator', 'manager')
GROUP BY u.id, u.first_name, u.last_name, u.email;

-- Vista de estadísticas de plantillas
CREATE VIEW template_stats AS
SELECT 
    t.id,
    t.name,
    t.category,
    t.status,
    t.usage_count,
    t.created_at,
    u.first_name || ' ' || u.last_name as created_by_name,
    COUNT(DISTINCT c.id) as campaigns_using_template
FROM templates t
LEFT JOIN users u ON t.created_by = u.id
LEFT JOIN campaigns c ON t.id = c.template_id
GROUP BY t.id, t.name, t.category, t.status, t.usage_count, t.created_at, u.first_name, u.last_name;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Usuario administrador por defecto
INSERT INTO users (email, password, role, first_name, last_name, is_active) VALUES
('admin@chatbot.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uIpu', 'admin', 'Admin', 'System', true);

-- Configuraciones del sistema por defecto
INSERT INTO system_settings (key, value, description, category, is_public) VALUES
('app.name', '"ChatBot Enterprise"', 'Nombre de la aplicación', 'general', true),
('app.version', '"5.1.0"', 'Versión de la aplicación', 'general', true),
('app.timezone', '"America/Mexico_City"', 'Zona horaria por defecto', 'general', false),
('chat.max_message_length', '4096', 'Longitud máxima de mensaje', 'chat', false),
('chat.auto_assignment', 'true', 'Asignación automática de conversaciones', 'chat', false),
('notifications.email_enabled', 'true', 'Notificaciones por email habilitadas', 'notifications', false),
('analytics.retention_days', '365', 'Días de retención de datos analíticos', 'analytics', false);

-- Etiquetas por defecto
INSERT INTO tags (name, color, description) VALUES
('Urgente', '#dc3545', 'Casos que requieren atención inmediata'),
('Prospecto', '#28a745', 'Clientes potenciales'),
('Soporte', '#007bff', 'Consultas de soporte técnico'),
('Ventas', '#ffc107', 'Consultas relacionadas con ventas'),
('Reclamo', '#fd7e14', 'Quejas o reclamos de clientes');

-- Plantillas por defecto
INSERT INTO templates (name, content, category, status, language) VALUES
('bienvenida', 'Hola {{nombre}}, bienvenido a nuestro servicio de atención al cliente. ¿En qué podemos ayudarte hoy?', 'utility', 'approved', 'es'),
('horario_atencion', 'Nuestro horario de atención es de lunes a viernes de 9:00 AM a 6:00 PM, hora de México.', 'utility', 'approved', 'es'),
('agradecimiento', 'Gracias por contactarnos, {{nombre}}. Tu consulta es importante para nosotros y te responderemos a la brevedad.', 'utility', 'approved', 'es'),
('despedida', 'Gracias por usar nuestro servicio. Si tienes más preguntas, no dudes en contactarnos. ¡Que tengas un excelente día!', 'utility', 'approved', 'es');

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON DATABASE chatbot_enterprise IS 'Base de datos principal del sistema ChatBot Enterprise';

COMMENT ON TABLE users IS 'Usuarios del sistema (administradores, operadores, etc.)';
COMMENT ON TABLE contacts IS 'Contactos/clientes que interactúan con el chatbot';
COMMENT ON TABLE conversations IS 'Conversaciones entre contactos y agentes';
COMMENT ON TABLE messages IS 'Mensajes individuales dentro de las conversaciones';
COMMENT ON TABLE templates IS 'Plantillas de mensajes predefinidas';
COMMENT ON TABLE campaigns IS 'Campañas de marketing masivo';
COMMENT ON TABLE contact_segments IS 'Segmentos de contactos para targeting';
COMMENT ON TABLE tags IS 'Etiquetas para categorizar conversaciones y contactos';
COMMENT ON TABLE conversation_metrics IS 'Métricas de rendimiento por conversación';
COMMENT ON TABLE system_settings IS 'Configuraciones del sistema';
COMMENT ON TABLE audit_logs IS 'Logs de auditoría para trazabilidad';

-- =====================================================
-- PERMISOS Y SEGURIDAD
-- =====================================================

-- Crear rol para la aplicación
CREATE ROLE chatbot_app WITH LOGIN PASSWORD 'secure_app_password';

-- Otorgar permisos necesarios
GRANT CONNECT ON DATABASE chatbot_enterprise TO chatbot_app;
GRANT USAGE ON SCHEMA public TO chatbot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO chatbot_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO chatbot_app;

-- Permisos para futuras tablas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chatbot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO chatbot_app;

-- =====================================================
-- FIN DEL ESQUEMA
-- =====================================================
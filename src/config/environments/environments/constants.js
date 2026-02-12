/**
 * Constantes del sistema
 * Centraliza todos los valores fijos y configuraciones estáticas
 */

// ===== Configuración de archivos =====
// NOTA: Los archivos JSON principales (contacts.json, messages.json) ya no se usan
// Toda la gestión de datos ahora se hace a través de SQLite
export const FILE_PATHS = {
  PROCESSED_IDS: 'processed_ids.json',
  TEMPLATE_LOG: 'template_log.json',
  CONTACTS_LOG: 'contacts_log.json',
  CALL_LOG: 'call_log.json',
  // DEPRECATED: Usar SQLite en su lugar
  CONTACTS: 'contacts.json', // ⚠️ OBSOLETO - Usar SQLite
  MESSAGES: 'messages.json', // ⚠️ OBSOLETO - Usar SQLite
  TEMPLATES: 'templates.json',
  TAGS: 'tags.json',
  SEGMENTS: 'segments.json',
  METADATA: 'metadata.json',
  STATS: 'stats.json',
  FLOWS: 'flows.json'
};

// ===== Configuración de límites =====
export const LIMITS = {
  FILE_UPLOAD_SIZE: 16 * 1024 * 1024, // 16MB
  MAX_MESSAGE_LENGTH: 4096,
  MAX_TEMPLATE_VARIABLES: 10,
  MAX_CONTACTS_PER_BATCH: 1000,
  RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutos
  MAX_BACKUP_FILES: 30
};

// ===== Tipos de archivos permitidos =====
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['jpeg', 'jpg', 'png', 'gif'],
  VIDEOS: ['mp4', 'mov', 'avi'],
  AUDIO: ['mp3', 'wav', 'ogg'],
  DOCUMENTS: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']
};

// ===== Configuración de MIME types =====
export const MIME_TYPES = {
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'mp4': 'video/mp4',
  'mov': 'video/quicktime',
  'avi': 'video/x-msvideo',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'txt': 'text/plain'
};

// ===== Estados de mensajes =====
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

// ===== Tipos de mensajes =====
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  INTERACTIVE: 'interactive',
  TEMPLATE: 'template',
  LOCATION: 'location',
  CONTACT: 'contact'
};

// ===== Tipos de plantillas =====
export const TEMPLATE_TYPES = {
  MARKETING: 'MARKETING',
  UTILITY: 'UTILITY',
  AUTHENTICATION: 'AUTHENTICATION'
};

// ===== Estados de plantillas =====
export const TEMPLATE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DISABLED: 'DISABLED'
};

// ===== Configuración de logging =====
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// ===== Configuración de health checks =====
export const HEALTH_CHECK_INTERVALS = {
  FAST: 30000,    // 30 segundos
  NORMAL: 60000,  // 1 minuto
  SLOW: 300000    // 5 minutos
};

// ===== Configuración de rate limiting =====
export const RATE_LIMIT_PRESETS = {
  STRICT: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 50,
    message: 'Demasiadas peticiones, intenta más tarde',
    skip: (req) => {
      // Exentar IPs locales en desarrollo
      const localIPs = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'];
      const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      return process.env.NODE_ENV === 'development' && localIPs.includes(clientIP);
    }
  },
  MODERATE: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,
    message: 'Límite de peticiones alcanzado',
    skip: (req) => {
      // Exentar IPs locales en desarrollo
      const localIPs = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'];
      const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      return process.env.NODE_ENV === 'development' && localIPs.includes(clientIP);
    }
  },
  LENIENT: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200,
    message: 'Límite de peticiones excedido',
    skip: (req) => {
      // Exentar IPs locales en desarrollo
      const localIPs = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'];
      const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      return process.env.NODE_ENV === 'development' && localIPs.includes(clientIP);
    }
  },
  DEVELOPMENT: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 999999, // Prácticamente sin límite para desarrollo
    message: 'Límite de peticiones excedido',
    skip: (req) => {
      // Siempre exentar en desarrollo
      return process.env.NODE_ENV === 'development';
    }
  }
};

// ===== Configuración de CORS =====
export const CORS_CONFIG = {
  DEVELOPMENT: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    optionsSuccessStatus: 200
  },
  PRODUCTION: {
    origin: false, // Configurar según dominio de producción
    credentials: true,
    optionsSuccessStatus: 200
  }
};

// ===== Configuración de Helmet =====
export const HELMET_CONFIG = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
      fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
      scriptSrc: ['\'self\'', '\'unsafe-inline\''],
      imgSrc: ['\'self\'', 'data:', 'https:'],
      connectSrc: ['\'self\'', 'https:']
    }
  },
  crossOriginEmbedderPolicy: false
};

// ===== Configuración de backup =====
export const BACKUP_CONFIG = {
  RETENTION_DAYS: 30,
  COMPRESSION_LEVEL: 6,
  SCHEDULE: '0 2 * * *', // Diario a las 2 AM
  INCLUDE_UPLOADS: true,
  INCLUDE_LOGS: false
};

// ===== Mensajes del sistema =====
export const SYSTEM_MESSAGES = {
  SERVER_STARTING: '🚀 Iniciando servidor...',
  SERVER_STARTED: '✅ Servidor iniciado correctamente',
  SERVER_ERROR: '❌ Error en el servidor',
  DB_CONNECTED: '✅ Base de datos conectada',
  DB_ERROR: '❌ Error en base de datos',
  WEBHOOK_CONFIGURED: '✅ Webhook configurado',
  WEBHOOK_ERROR: '❌ Error configurando webhook',
  AI_CONNECTED: '🧠 IA conectada',
  AI_DISCONNECTED: '🧠 IA desconectada',
  BACKUP_STARTED: '💾 Backup iniciado',
  BACKUP_COMPLETED: '✅ Backup completado',
  BACKUP_FAILED: '❌ Backup falló'
};

// ===== Configuración de endpoints =====
export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  HEALTH_DETAILED: '/api/health/detailed',
  STATS: '/api/stats',
  CONTACTS: '/api/contacts',
  MESSAGES: '/api/messages',
  TEMPLATES: '/api/templates',
  WEBHOOKS: '/api/webhooks',
  ANALYTICS: '/api/analytics',
  BACKUP: '/api/backup',
  AI: '/api/ai'
};

// ===== Configuración de Socket.IO =====
export const SOCKET_CONFIG = {
  CORS: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  PING_TIMEOUT: 60000,
  PING_INTERVAL: 25000
};

// ===== Configuración de validación =====
export const VALIDATION_RULES = {
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MIN_PASSWORD_LENGTH: 8,
  MAX_NAME_LENGTH: 100,
  MAX_MESSAGE_LENGTH: 4096
};

export default {
  FILE_PATHS,
  LIMITS,
  ALLOWED_FILE_TYPES,
  MIME_TYPES,
  MESSAGE_STATUS,
  MESSAGE_TYPES,
  TEMPLATE_TYPES,
  TEMPLATE_STATUS,
  LOG_LEVELS,
  HEALTH_CHECK_INTERVALS,
  RATE_LIMIT_PRESETS,
  CORS_CONFIG,
  HELMET_CONFIG,
  BACKUP_CONFIG,
  SYSTEM_MESSAGES,
  API_ENDPOINTS,
  SOCKET_CONFIG,
  VALIDATION_RULES
};
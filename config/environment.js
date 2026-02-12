/**
 * Configuración de Entorno - ChatBot Enterprise
 * 
 * Este archivo centraliza todas las configuraciones de entorno del proyecto,
 * incluyendo credenciales de API, configuraciones de base de datos,
 * y parámetros de funcionamiento del sistema.
 * 
 * @author ChatBot Enterprise Team
 * @version 2.0.0
 * @since 2024
 */

import dotenv from 'dotenv';

// Cargar variables de entorno desde archivo .env
dotenv.config();

/**
 * Configuración principal del entorno
 * Contiene todas las variables necesarias para el funcionamiento del sistema
 */
const environmentConfig = {
  // ==========================================
  // CONFIGURACIÓN BÁSICA DEL SERVIDOR
  // ==========================================
  
  /**
   * Puerto en el que se ejecutará el servidor
   * @type {number}
   * @default 3000
   */
  PORT: parseInt(process.env.PORT) || 3000,
  
  /**
   * Entorno de ejecución (development, production, test)
   * @type {string}
   * @default 'development'
   */
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  /**
   * Indica si el sistema está en modo de producción
   * @type {boolean}
   */
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  
  /**
   * Indica si el sistema está en modo de desarrollo
   * @type {boolean}
   */
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  
  // ==========================================
  // CONFIGURACIÓN DE 360DIALOG API
  // ==========================================
  
  /**
   * Clave de API de 360Dialog actualizada
   * @type {string}
   */
  DIALOG360_API_KEY: process.env.DIALOG360_API_KEY || 'AgfBv5iKrrsrrENqb4VDfeiZAK',
  
  /**
   * Partner actual de 360Dialog
   * @type {object}
   */
  DIALOG360_PARTNER: {
    name: process.env.DIALOG360_PARTNER_NAME || '360dialog-DCHUB',
    id: process.env.DIALOG360_PARTNER_ID || 'srMmqpPA'
  },
  
  /**
   * URL base de la API de WABA (WhatsApp Business API)
   * @type {string}
   */
  WABA_API_BASE: process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io',
  
  /**
   * ID del canal de WhatsApp
   * @type {string}
   */
  D360_WHATSAPP_CHANNEL_ID: process.env.D360_WHATSAPP_CHANNEL_ID || '',
  
  /**
   * ID de la cuenta WABA
   * @type {string}
   */
  D360_WABA_ACCOUNT_ID: process.env.D360_WABA_ACCOUNT_ID || '',
  
  /**
   * ID del número de teléfono
   * @type {string}
   */
  D360_PHONE_NUMBER_ID: process.env.D360_PHONE_NUMBER_ID || '',
  
  /**
   * Namespace de plantillas
   * @type {string}
   */
  D360_NAMESPACE: process.env.D360_NAMESPACE || '',
  
  // ==========================================
  // CONFIGURACIÓN DE BASE DE DATOS
  // ==========================================
  
  /**
   * URI de conexión a MongoDB
   * @type {string}
   */
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot_enterprise',
  
  /**
   * URL de conexión a Redis
   * @type {string}
   */
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  /**
   * Ruta de la base de datos SQLite (para desarrollo)
   * @type {string}
   */
  DB_PATH: process.env.DB_PATH || './data/database.sqlite',
  
  // ==========================================
  // CONFIGURACIÓN DE SEGURIDAD
  // ==========================================
  
  /**
   * Secreto para JWT (JSON Web Tokens)
   * @type {string}
   */
  JWT_SECRET: process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#',
  
  /**
   * Clave de encriptación para datos sensibles
   * @type {string}
   */
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!!',
  
  /**
   * Token de verificación para webhooks
   * @type {string}
   */
  WEBHOOK_VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN || 'webhook-verify-token-secure',
  
  // ==========================================
  // CONFIGURACIÓN DE INTELIGENCIA ARTIFICIAL
  // ==========================================
  
  /**
   * Endpoint de la API de IA
   * @type {string}
   */
  AI_ENDPOINT: process.env.AI_ENDPOINT || '',
  
  /**
   * Modelo de IA a utilizar
   * @type {string}
   */
  AI_MODEL: process.env.AI_MODEL || 'gpt-3.5-turbo',
  
  /**
   * Indica si la IA está habilitada
   * @type {boolean}
   */
  IA_ENABLED: process.env.IA_ENABLED !== 'false',
  
  // ==========================================
  // CONFIGURACIÓN DE NGROK (DESARROLLO)
  // ==========================================
  
  /**
   * URL de ngrok para desarrollo
   * @type {string}
   */
  NGROK_URL: process.env.NGROK_URL || '',
  
  // ==========================================
  // CONFIGURACIÓN DE MENSAJES
  // ==========================================
  
  /**
   * Mensaje de rechazo de llamadas
   * @type {string}
   */
  REJECT_CALL_MESSAGE: process.env.REJECT_CALL_MESSAGE || 'No puedo atender ahora, te devuelvo la llamada en breve.',
  
  /**
   * ID de producto por defecto
   * @type {string}
   */
  DEFAULT_PRODUCT_ID: process.env.DEFAULT_PRODUCT_ID || '',
  
  // ==========================================
  // CONFIGURACIÓN DE LÍMITES Y TIMEOUTS
  // ==========================================
  
  /**
   * Límite de tamaño de archivos (en bytes)
   * @type {number}
   */
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 16 * 1024 * 1024, // 16MB
  
  /**
   * Timeout para requests HTTP (en milisegundos)
   * @type {number}
   */
  HTTP_TIMEOUT: parseInt(process.env.HTTP_TIMEOUT) || 30000, // 30 segundos
  
  /**
   * Límite de rate limiting (requests por minuto)
   * @type {number}
   */
  RATE_LIMIT: parseInt(process.env.RATE_LIMIT) || 100,
  
  // ==========================================
  // CONFIGURACIÓN DE LOGGING
  // ==========================================
  
  /**
   * Nivel de logging (error, warn, info, debug)
   * @type {string}
   */
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  /**
   * Indica si se debe guardar logs en archivo
   * @type {boolean}
   */
  LOG_TO_FILE: process.env.LOG_TO_FILE === 'true',
  
  /**
   * Directorio donde guardar los logs
   * @type {string}
   */
  LOG_DIR: process.env.LOG_DIR || './logs'
};

/**
 * Validación de configuración crítica
 * Verifica que las variables esenciales estén configuradas
 */
function validateConfig() {
  const requiredVars = [
    'DIALOG360_API_KEY',
    'JWT_SECRET',
    'ENCRYPTION_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !environmentConfig[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Variables de entorno requeridas faltantes: ${missing.join(', ')}`);
  }
}

/**
 * Obtener configuración específica por categoría
 * @param {string} category - Categoría de configuración
 * @returns {object} Configuración de la categoría especificada
 */
function getConfigByCategory(category) {
  const categories = {
    server: {
      PORT: environmentConfig.PORT,
      NODE_ENV: environmentConfig.NODE_ENV,
      IS_PRODUCTION: environmentConfig.IS_PRODUCTION,
      IS_DEVELOPMENT: environmentConfig.IS_DEVELOPMENT
    },
    api: {
      DIALOG360_API_KEY: environmentConfig.DIALOG360_API_KEY,
      DIALOG360_PARTNER: environmentConfig.DIALOG360_PARTNER,
      WABA_API_BASE: environmentConfig.WABA_API_BASE
    },
    database: {
      MONGODB_URI: environmentConfig.MONGODB_URI,
      REDIS_URL: environmentConfig.REDIS_URL,
      DB_PATH: environmentConfig.DB_PATH
    },
    security: {
      JWT_SECRET: environmentConfig.JWT_SECRET,
      ENCRYPTION_KEY: environmentConfig.ENCRYPTION_KEY,
      WEBHOOK_VERIFY_TOKEN: environmentConfig.WEBHOOK_VERIFY_TOKEN
    },
    ai: {
      AI_ENDPOINT: environmentConfig.AI_ENDPOINT,
      AI_MODEL: environmentConfig.AI_MODEL,
      IA_ENABLED: environmentConfig.IA_ENABLED
    }
  };
  
  return categories[category] || {};
}

// Validar configuración al cargar el módulo
if (environmentConfig.NODE_ENV !== 'test') {
  validateConfig();
}

export default environmentConfig;
export { getConfigByCategory, validateConfig };
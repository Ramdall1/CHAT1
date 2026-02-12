/**
 * @fileoverview Sistema de Logging Centralizado del ChatBot Enterprise
 * 
 * Este archivo implementa un sistema de logging robusto y escalable
 * basado en Winston que proporciona:
 * - Logging unificado para toda la aplicación
 * - Múltiples niveles de log (error, warn, info, debug, verbose)
 * - Transportes configurables (consola, archivos)
 * - Rotación automática de archivos de log
 * - Contexto específico por módulo
 * - Middleware para logging de requests HTTP
 * - Manejo centralizado de errores
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2024
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';
import { LOGGING_CONFIG } from '../../../config/environments/index.js';

// Asegurar que el directorio de logs existe
const logsDir = path.dirname(LOGGING_CONFIG.FILE);
// Usar sync para evitar problemas con await en top-level
fs.ensureDirSync(logsDir);

/**
 * Formato personalizado para los logs
 * 
 * Combina timestamp, manejo de errores y formato personalizado
 * para crear logs legibles y estructurados.
 * 
 * @constant {winston.Format} customFormat
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, context, ...meta }) => {
    // Emojis y colores para cada nivel
    const levelEmojis = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍',
      verbose: '📝'
    };
    
    const emoji = levelEmojis[level] || '•';
    const contextStr = context ? `[${context}]` : '';
    
    let log = `${timestamp} ${emoji} ${contextStr} ${message}`;
    
    // Agregar metadata si existe
    if (Object.keys(meta).length > 0) {
      log += `\n   📊 ${JSON.stringify(meta, null, 2).split('\n').join('\n   ')}`;
    }
    
    // Agregar stack trace si existe
    if (stack) {
      log += `\n   🔗 ${stack.split('\n').join('\n   ')}`;
    }
    
    return log;
  })
);

/**
 * Configuración de transportes
 */
const transports = [];

// Transporte de consola
if (LOGGING_CONFIG.CONSOLE) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    })
  );
}

// Transporte de archivo
if (LOGGING_CONFIG.FILE_LOGGING) {
  transports.push(
    new winston.transports.File({
      filename: LOGGING_CONFIG.FILE,
      format: customFormat,
      maxsize: LOGGING_CONFIG.MAX_SIZE,
      maxFiles: LOGGING_CONFIG.MAX_FILES,
      tailable: true
    })
  );
  
  // Archivo separado para errores
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: LOGGING_CONFIG.MAX_SIZE,
      maxFiles: LOGGING_CONFIG.MAX_FILES,
      tailable: true
    })
  );
}

/**
 * Logger principal de Winston
 * 
 * Instancia configurada de Winston con todos los transportes
 * y formatos definidos según la configuración del sistema.
 * 
 * @constant {winston.Logger} logger
 */
const logger = winston.createLogger({
  level: LOGGING_CONFIG.LEVEL,
  format: customFormat,
  transports,
  exitOnError: false
});

/**
 * Wrapper para logging con contexto específico
 * 
 * Proporciona una interfaz simplificada para logging que
 * automáticamente incluye el contexto del módulo en todos
 * los mensajes de log, facilitando el debugging y monitoreo.
 * 
 * @class ContextLogger
 * @example
 * ```javascript
 * const logger = new ContextLogger('AUTH');
 * logger.info('Usuario autenticado', { userId: 123 });
 * logger.error('Error de autenticación', error, { attempt: 3 });
 * ```
 */
class ContextLogger {
  /**
   * Constructor del ContextLogger
   * 
   * @constructor
   * @param {string} [context='APP'] - Contexto del módulo para identificar logs
   */
  constructor(context = 'APP') {
    /** @type {string} Contexto del módulo para identificación en logs */
    this.context = context;
  }
  
  /**
   * Registra un mensaje de información
   * 
   * @method info
   * @param {string} message - Mensaje a registrar
   * @param {Object} [meta={}] - Metadata adicional
   * @example
   * ```javascript
   * logger.info('Servidor iniciado', { port: 3000, env: 'production' });
   * ```
   */
  info(message, meta = {}) {
    logger.info(message, { context: this.context, ...meta });
  }
  
  /**
   * Registra un mensaje de advertencia
   * 
   * @method warn
   * @param {string} message - Mensaje de advertencia
   * @param {Object} [meta={}] - Metadata adicional
   * @example
   * ```javascript
   * logger.warn('Rate limit alcanzado', { ip: '192.168.1.1', attempts: 10 });
   * ```
   */
  warn(message, meta = {}) {
    logger.warn(message, { context: this.context, ...meta });
  }
  
  /**
   * Registra un mensaje de error
   * 
   * @method error
   * @param {string} message - Mensaje de error
   * @param {Error|null} [error=null] - Objeto Error para incluir stack trace
   * @param {Object} [meta={}] - Metadata adicional
   * @example
   * ```javascript
   * logger.error('Error de base de datos', dbError, { query: 'SELECT * FROM users' });
   * ```
   */
  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      error: error.message,
      stack: error.stack,
      ...meta
    } : meta;
    
    logger.error(message, { context: this.context, ...errorMeta });
  }
  
  /**
   * Registra un mensaje de debug
   * 
   * @method debug
   * @param {string} message - Mensaje de debug
   * @param {Object} [meta={}] - Metadata adicional
   * @example
   * ```javascript
   * logger.debug('Cache hit', { key: 'user:123', ttl: 300 });
   * ```
   */
  debug(message, meta = {}) {
    logger.debug(message, { context: this.context, ...meta });
  }
  
  /**
   * Log de nivel verbose
   */
  verbose(message, meta = {}) {
    logger.verbose(message, { context: this.context, ...meta });
  }
}

/**
 * Crear logger con contexto específico
 * @param {string} context - Contexto del logger
 * @returns {ContextLogger} Logger con contexto
 */
export function createLogger(context) {
  return new ContextLogger(context);
}

/**
 * Logger por defecto
 */
export const log = new ContextLogger('SYSTEM');

/**
 * Loggers específicos por módulo
 */
export const loggers = {
  server: createLogger('SERVER'),
  api: createLogger('API'),
  webhook: createLogger('WEBHOOK'),
  messaging: createLogger('MESSAGING'),
  contacts: createLogger('CONTACTS'),
  templates: createLogger('TEMPLATES'),
  automation: createLogger('AUTOMATION'),
  ai: createLogger('AI'),
  analytics: createLogger('ANALYTICS'),
  integrations: createLogger('INTEGRATIONS'),
  auth: createLogger('AUTH'),
  database: createLogger('DATABASE')
};

/**
 * Middleware de logging para Express
 */
export function loggingMiddleware(req, res, next) {
  const start = Date.now();
  const { method, url, ip } = req;
  
  // Log de request
  loggers.api.info(`${method} ${url}`, {
    ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type')
  });
  
  // Interceptar response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Log de response
    loggers.api.info(`${method} ${url} - ${statusCode}`, {
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || data?.length || 0
    });
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Función para logging de errores no capturados
 */
export function setupErrorLogging() {
  // Errores no capturados
  process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception', error);
    process.exit(1);
  });
  
  // Promesas rechazadas no manejadas
  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Rejection', new Error(reason), {
      promise: promise.toString()
    });
  });
  
  // Señales del sistema
  process.on('SIGTERM', () => {
    log.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}

export default logger;
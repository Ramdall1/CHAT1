/**
 * Logger Service
 * Sistema de logging centralizado para el chatbot
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

class Logger {
    constructor(config = {}) {
        this.config = {
            level: process.env.LOG_LEVEL || 'info',
            maxFiles: 5,
            maxSize: '20m',
            datePattern: 'YYYY-MM-DD',
            logDir: process.env.LOG_DIR || './logs',
            enableConsole: process.env.NODE_ENV !== 'production',
            enableFile: true,
            enableRotation: true,
            ...config
        };
        
        this.loggers = new Map();
        this.createLogDirectory();
        this.setupDefaultLogger();
    }

    /**
     * Crea el directorio de logs si no existe
     */
    createLogDirectory() {
        if (!fs.existsSync(this.config.logDir)) {
            fs.mkdirSync(this.config.logDir, { recursive: true });
        }
    }

    /**
     * Configura el logger por defecto
     */
    setupDefaultLogger() {
        const transports = [];
        
        // Transporte de consola
        if (this.config.enableConsole) {
            transports.push(
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.timestamp(),
                        winston.format.printf(({ timestamp, level, message, ...meta }) => {
                            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                            return `${timestamp} [${level}]: ${message} ${metaStr}`;
                        })
                    )
                })
            );
        }
        
        // Transporte de archivo
        if (this.config.enableFile) {
            // Log general
            transports.push(
                new winston.transports.File({
                    filename: path.join(this.config.logDir, 'app.log'),
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    ),
                    maxsize: this.config.maxSize,
                    maxFiles: this.config.maxFiles
                })
            );
            
            // Log de errores
            transports.push(
                new winston.transports.File({
                    filename: path.join(this.config.logDir, 'error.log'),
                    level: 'error',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    ),
                    maxsize: this.config.maxSize,
                    maxFiles: this.config.maxFiles
                })
            );
        }
        
        // Crear logger principal
        this.defaultLogger = winston.createLogger({
            level: this.config.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports,
            exitOnError: false
        });
        
        this.loggers.set('default', this.defaultLogger);
    }

    /**
     * Crea un logger específico para un módulo
     * @param {string} module - Nombre del módulo
     * @param {object} options - Opciones específicas
     * @returns {object} Logger del módulo
     */
    createModuleLogger(module, options = {}) {
        const loggerConfig = {
            ...this.config,
            ...options
        };
        
        const transports = [];
        
        // Consola con etiqueta del módulo
        if (loggerConfig.enableConsole) {
            transports.push(
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.timestamp(),
                        winston.format.label({ label: module }),
                        winston.format.printf(({ timestamp, level, label, message, ...meta }) => {
                            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                            return `${timestamp} [${label}] [${level}]: ${message} ${metaStr}`;
                        })
                    )
                })
            );
        }
        
        // Archivo específico del módulo
        if (loggerConfig.enableFile) {
            transports.push(
                new winston.transports.File({
                    filename: path.join(this.config.logDir, `${module}.log`),
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.label({ label: module }),
                        winston.format.json()
                    ),
                    maxsize: loggerConfig.maxSize,
                    maxFiles: loggerConfig.maxFiles
                })
            );
        }
        
        const moduleLogger = winston.createLogger({
            level: loggerConfig.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.label({ label: module }),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports,
            exitOnError: false
        });
        
        this.loggers.set(module, moduleLogger);
        return moduleLogger;
    }

    /**
     * Obtiene un logger por nombre
     * @param {string} name - Nombre del logger
     * @returns {object} Logger solicitado
     */
    getLogger(name = 'default') {
        return this.loggers.get(name) || this.defaultLogger;
    }

    /**
     * Log de información
     * @param {string} message - Mensaje a loggear
     * @param {object} meta - Metadatos adicionales
     * @param {string} module - Módulo específico
     */
    info(message, meta = {}, module = 'default') {
        const logger = this.getLogger(module);
        logger.info(message, meta);
    }

    /**
     * Log de error
     * @param {string} message - Mensaje de error
     * @param {Error|object} error - Error o metadatos
     * @param {string} module - Módulo específico
     */
    error(message, error = {}, module = 'default') {
        const logger = this.getLogger(module);
        
        if (error instanceof Error) {
            logger.error(message, {
                error: error.message,
                stack: error.stack,
                ...error
            });
        } else {
            logger.error(message, error);
        }
    }

    /**
     * Log de advertencia
     * @param {string} message - Mensaje de advertencia
     * @param {object} meta - Metadatos adicionales
     * @param {string} module - Módulo específico
     */
    warn(message, meta = {}, module = 'default') {
        const logger = this.getLogger(module);
        logger.warn(message, meta);
    }

    /**
     * Log de debug
     * @param {string} message - Mensaje de debug
     * @param {object} meta - Metadatos adicionales
     * @param {string} module - Módulo específico
     */
    debug(message, meta = {}, module = 'default') {
        const logger = this.getLogger(module);
        logger.debug(message, meta);
    }

    /**
     * Log de evento de sistema
     * @param {string} event - Nombre del evento
     * @param {object} data - Datos del evento
     * @param {string} module - Módulo específico
     */
    logEvent(event, data = {}, module = 'default') {
        this.info(`Event: ${event}`, {
            event,
            eventData: data,
            timestamp: new Date().toISOString()
        }, module);
    }

    /**
     * Log de petición HTTP
     * @param {object} req - Request object
     * @param {object} res - Response object
     * @param {number} duration - Duración de la petición
     */
    logRequest(req, res, duration) {
        const logData = {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            timestamp: new Date().toISOString()
        };
        
        if (res.statusCode >= 400) {
            this.warn('HTTP Request', logData, 'http');
        } else {
            this.info('HTTP Request', logData, 'http');
        }
    }

    /**
     * Log de mensaje de chat
     * @param {object} message - Mensaje del chat
     * @param {object} session - Sesión del usuario
     * @param {string} direction - 'incoming' o 'outgoing'
     */
    logMessage(message, session, direction = 'incoming') {
        const logData = {
            direction,
            userId: session.id,
            messageType: message.type,
            platform: session.context.platform,
            sessionDuration: Date.now() - session.startTime.getTime(),
            messageCount: session.messageCount,
            timestamp: new Date().toISOString()
        };
        
        // No loggear contenido sensible en producción
        if (process.env.NODE_ENV !== 'production') {
            logData.content = message.content;
        }
        
        this.info(`Chat Message ${direction}`, logData, 'chat');
    }

    /**
     * Log de error de integración
     * @param {string} integration - Nombre de la integración
     * @param {Error} error - Error ocurrido
     * @param {object} context - Contexto adicional
     */
    logIntegrationError(integration, error, context = {}) {
        this.error(`Integration Error: ${integration}`, {
            integration,
            error: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        }, 'integration');
    }

    /**
     * Log de métricas de rendimiento
     * @param {string} operation - Operación medida
     * @param {number} duration - Duración en ms
     * @param {object} metadata - Metadatos adicionales
     */
    logPerformance(operation, duration, metadata = {}) {
        this.info(`Performance: ${operation}`, {
            operation,
            duration: `${duration}ms`,
            ...metadata,
            timestamp: new Date().toISOString()
        }, 'performance');
    }

    /**
     * Log de seguridad
     * @param {string} event - Evento de seguridad
     * @param {object} details - Detalles del evento
     * @param {string} severity - Severidad (low, medium, high, critical)
     */
    logSecurity(event, details = {}, severity = 'medium') {
        const logMethod = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
        
        this[logMethod](`Security Event: ${event}`, {
            securityEvent: event,
            severity,
            details,
            timestamp: new Date().toISOString()
        }, 'security');
    }

    /**
     * Obtiene estadísticas de logging
     * @returns {object} Estadísticas
     */
    getStats() {
        return {
            activeLoggers: this.loggers.size,
            logDirectory: this.config.logDir,
            logLevel: this.config.level,
            enabledTransports: {
                console: this.config.enableConsole,
                file: this.config.enableFile
            }
        };
    }

    /**
     * Limpia logs antiguos
     * @param {number} maxAge - Edad máxima en días
     */
    cleanupOldLogs(maxAge = 30) {
        const logDir = this.config.logDir;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAge);
        
        try {
            const files = fs.readdirSync(logDir);
            
            files.forEach(file => {
                const filePath = path.join(logDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    this.info(`Deleted old log file: ${file}`);
                }
            });
        } catch (error) {
            this.error('Failed to cleanup old logs', error);
        }
    }

    /**
     * Configura rotación automática de logs
     */
    setupLogRotation() {
        // Ejecutar limpieza diaria
        setInterval(() => {
            this.cleanupOldLogs();
        }, 24 * 60 * 60 * 1000); // 24 horas
    }
}

// Instancia singleton
const logger = new Logger();

// Configurar rotación automática
logger.setupLogRotation();

// Exportar métodos principales
export const info = (message, meta, module) => logger.info(message, meta, module);
export const error = (message, errorObj, module) => logger.error(message, errorObj, module);
export const warn = (message, meta, module) => logger.warn(message, meta, module);
export const debug = (message, meta, module) => logger.debug(message, meta, module);
export const logEvent = (event, data, module) => logger.logEvent(event, data, module);
export const logRequest = (req, res, duration) => logger.logRequest(req, res, duration);
export const logMessage = (message, session, direction) => logger.logMessage(message, session, direction);
export const logIntegrationError = (integration, errorObj, context) => logger.logIntegrationError(integration, errorObj, context);
export const logPerformance = (operation, duration, metadata) => logger.logPerformance(operation, duration, metadata);
export const logSecurity = (event, details, severity) => logger.logSecurity(event, details, severity);

export default logger;
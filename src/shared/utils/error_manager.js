/**
 * Error Manager Service
 * Gestión centralizada de errores del sistema
 */

import { EventEmitter } from 'events';

/**
 * Tipos de errores del sistema
 */
export const ErrorTypes = {
    VALIDATION: 'VALIDATION_ERROR',
    AUTHENTICATION: 'AUTHENTICATION_ERROR',
    AUTHORIZATION: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND_ERROR',
    CONFLICT: 'CONFLICT_ERROR',
    RATE_LIMIT: 'RATE_LIMIT_ERROR',
    EXTERNAL_SERVICE: 'EXTERNAL_SERVICE_ERROR',
    DATABASE: 'DATABASE_ERROR',
    NETWORK: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT_ERROR',
    INTERNAL: 'INTERNAL_ERROR',
    CONFIGURATION: 'CONFIGURATION_ERROR',
    SECURITY: 'SECURITY_ERROR',
    BUSINESS_LOGIC: 'BUSINESS_LOGIC_ERROR'
};

/**
 * Severidad de errores
 */
export const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Clase base para errores personalizados
 */
export class BaseError extends Error {
    constructor(message, type = ErrorTypes.INTERNAL, severity = ErrorSeverity.MEDIUM, details = {}) {
        super(message);
        
        this.name = this.constructor.name;
        this.type = type;
        this.severity = severity;
        this.details = details;
        this.timestamp = new Date();
        this.id = this.generateErrorId();
        
        // Mantener stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * Errores específicos del sistema
 */
export class ValidationError extends BaseError {
    constructor(message, field = null, value = null) {
        super(message, ErrorTypes.VALIDATION, ErrorSeverity.LOW, { field, value });
    }
}

export class AuthenticationError extends BaseError {
    constructor(message = 'Authentication failed') {
        super(message, ErrorTypes.AUTHENTICATION, ErrorSeverity.HIGH);
    }
}

export class AuthorizationError extends BaseError {
    constructor(message = 'Access denied', resource = null, action = null) {
        super(message, ErrorTypes.AUTHORIZATION, ErrorSeverity.HIGH, { resource, action });
    }
}

export class NotFoundError extends BaseError {
    constructor(message = 'Resource not found', resource = null, id = null) {
        super(message, ErrorTypes.NOT_FOUND, ErrorSeverity.LOW, { resource, id });
    }
}

export class ConflictError extends BaseError {
    constructor(message = 'Resource conflict', resource = null) {
        super(message, ErrorTypes.CONFLICT, ErrorSeverity.MEDIUM, { resource });
    }
}

export class RateLimitError extends BaseError {
    constructor(message = 'Rate limit exceeded', limit = null, window = null) {
        super(message, ErrorTypes.RATE_LIMIT, ErrorSeverity.MEDIUM, { limit, window });
    }
}

export class ExternalServiceError extends BaseError {
    constructor(message, service = null, statusCode = null) {
        super(message, ErrorTypes.EXTERNAL_SERVICE, ErrorSeverity.HIGH, { service, statusCode });
    }
}

export class DatabaseError extends BaseError {
    constructor(message, operation = null, table = null) {
        super(message, ErrorTypes.DATABASE, ErrorSeverity.HIGH, { operation, table });
    }
}

export class NetworkError extends BaseError {
    constructor(message, url = null, method = null) {
        super(message, ErrorTypes.NETWORK, ErrorSeverity.MEDIUM, { url, method });
    }
}

export class TimeoutError extends BaseError {
    constructor(message = 'Operation timeout', timeout = null) {
        super(message, ErrorTypes.TIMEOUT, ErrorSeverity.MEDIUM, { timeout });
    }
}

export class ConfigurationError extends BaseError {
    constructor(message, config = null) {
        super(message, ErrorTypes.CONFIGURATION, ErrorSeverity.HIGH, { config });
    }
}

export class SecurityError extends BaseError {
    constructor(message, threat = null, ip = null) {
        super(message, ErrorTypes.SECURITY, ErrorSeverity.CRITICAL, { threat, ip });
    }
}

export class BusinessLogicError extends BaseError {
    constructor(message, rule = null) {
        super(message, ErrorTypes.BUSINESS_LOGIC, ErrorSeverity.MEDIUM, { rule });
    }
}

/**
 * Gestor de errores principal
 */
class ErrorManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enableLogging: true,
            enableNotifications: true,
            enableMetrics: true,
            maxErrorHistory: 1000,
            alertThresholds: {
                [ErrorSeverity.CRITICAL]: 1,
                [ErrorSeverity.HIGH]: 5,
                [ErrorSeverity.MEDIUM]: 20,
                [ErrorSeverity.LOW]: 50
            },
            alertWindow: 300000, // 5 minutos
            ...config
        };
        
        this.errors = new Map();
        this.errorHistory = [];
        this.metrics = {
            total: 0,
            byType: new Map(),
            bySeverity: new Map(),
            byHour: new Map(),
            resolved: 0,
            unresolved: 0
        };
        
        this.handlers = new Map();
        this.alertCounts = new Map();
        
        this.setupDefaultHandlers();
        this.startMetricsCleanup();
    }

    /**
     * Configura manejadores por defecto
     */
    setupDefaultHandlers() {
        // Manejador para errores de validación
        this.registerHandler(ErrorTypes.VALIDATION, async (error, context) => {
            logger.warn(`Validation Error: ${error.message}`, error.details);
            return { handled: true, action: 'log' };
        });
        
        // Manejador para errores de autenticación
        this.registerHandler(ErrorTypes.AUTHENTICATION, async (error, context) => {
            logger.error(`Authentication Error: ${error.message}`);
            this.emit('securityAlert', { type: 'authentication_failure', error, context });
            return { handled: true, action: 'security_alert' };
        });
        
        // Manejador para errores críticos
        this.registerHandler(ErrorTypes.SECURITY, async (error, context) => {
            logger.error(`CRITICAL SECURITY ERROR: ${error.message}`, error.details);
            this.emit('criticalAlert', { error, context });
            return { handled: true, action: 'critical_alert' };
        });
        
        // Manejador para errores de servicios externos
        this.registerHandler(ErrorTypes.EXTERNAL_SERVICE, async (error, context) => {
            logger.error(`External Service Error: ${error.message}`, error.details);
            
            // Implementar circuit breaker si es necesario
            if (error.details.statusCode >= 500) {
                this.emit('serviceDown', { service: error.details.service, error });
            }
            
            return { handled: true, action: 'service_monitoring' };
        });
        
        // Manejador para errores de base de datos
        this.registerHandler(ErrorTypes.DATABASE, async (error, context) => {
            logger.error(`Database Error: ${error.message}`, error.details);
            this.emit('databaseAlert', { error, context });
            return { handled: true, action: 'database_alert' };
        });
    }

    /**
     * Registra un error en el sistema
     * @param {Error|BaseError} error - Error a registrar
     * @param {object} context - Contexto adicional
     * @returns {Promise<object>} Resultado del manejo
     */
    async handleError(error, context = {}) {
        try {
            // Convertir a BaseError si es necesario
            const managedError = this.normalizeError(error);
            
            // Registrar error
            this.registerError(managedError, context);
            
            // Actualizar métricas
            this.updateMetrics(managedError);
            
            // Verificar alertas
            this.checkAlerts(managedError);
            
            // Ejecutar manejador específico
            const result = await this.executeHandler(managedError, context);
            
            // Emitir evento
            this.emit('errorHandled', { error: managedError, context, result });
            
            return {
                errorId: managedError.id,
                handled: true,
                result
            };
            
        } catch (handlingError) {
            logger.error('Error handling failed:', handlingError);
            this.emit('handlingError', { originalError: error, handlingError });
            
            return {
                errorId: null,
                handled: false,
                error: handlingError.message
            };
        }
    }

    /**
     * Normaliza un error a BaseError
     * @param {Error} error - Error original
     * @returns {BaseError} Error normalizado
     */
    normalizeError(error) {
        if (error instanceof BaseError) {
            return error;
        }
        
        // Detectar tipo de error basado en el mensaje o propiedades
        let type = ErrorTypes.INTERNAL;
        let severity = ErrorSeverity.MEDIUM;
        const message = error.message || error.toString() || 'Unknown error';
        
        if (error.name === 'ValidationError' || (message && message.includes('validation'))) {
            type = ErrorTypes.VALIDATION;
            severity = ErrorSeverity.LOW;
        } else if (error.name === 'UnauthorizedError' || (message && message.includes('unauthorized'))) {
            type = ErrorTypes.AUTHENTICATION;
            severity = ErrorSeverity.HIGH;
        } else if (error.name === 'ForbiddenError' || (message && message.includes('forbidden'))) {
            type = ErrorTypes.AUTHORIZATION;
            severity = ErrorSeverity.HIGH;
        } else if (error.name === 'NotFoundError' || (message && message.includes('not found'))) {
            type = ErrorTypes.NOT_FOUND;
            severity = ErrorSeverity.LOW;
        } else if (error.name === 'TimeoutError' || (message && message.includes('timeout'))) {
            type = ErrorTypes.TIMEOUT;
            severity = ErrorSeverity.MEDIUM;
        } else if (message && (message.includes('database') || message.includes('sql'))) {
            type = ErrorTypes.DATABASE;
            severity = ErrorSeverity.HIGH;
        } else if (message && (message.includes('network') || message.includes('connection'))) {
            type = ErrorTypes.NETWORK;
            severity = ErrorSeverity.MEDIUM;
        }
        
        return new BaseError(message, type, severity, {
            originalName: error.name,
            originalStack: error.stack
        });
    }

    /**
     * Registra un error
     * @param {BaseError} error - Error a registrar
     * @param {object} context - Contexto
     */
    registerError(error, context) {
        // Agregar contexto al error
        error.context = {
            userId: context.userId,
            sessionId: context.sessionId,
            requestId: context.requestId,
            userAgent: context.userAgent,
            ip: context.ip,
            url: context.url,
            method: context.method,
            ...context
        };
        
        // Almacenar error
        this.errors.set(error.id, error);
        
        // Agregar al historial
        this.errorHistory.push({
            id: error.id,
            type: error.type,
            severity: error.severity,
            message: error.message,
            timestamp: error.timestamp,
            context: error.context
        });
        
        // Limitar historial
        if (this.errorHistory.length > this.config.maxErrorHistory) {
            this.errorHistory.shift();
        }
        
        // Log si está habilitado
        if (this.config.enableLogging) {
            this.logError(error);
        }
    }

    /**
     * Actualiza métricas de errores
     * @param {BaseError} error - Error
     */
    updateMetrics(error) {
        if (!this.config.enableMetrics) return;
        
        // Incrementar total
        this.metrics.total++;
        
        // Por tipo
        const typeCount = this.metrics.byType.get(error.type) || 0;
        this.metrics.byType.set(error.type, typeCount + 1);
        
        // Por severidad
        const severityCount = this.metrics.bySeverity.get(error.severity) || 0;
        this.metrics.bySeverity.set(error.severity, severityCount + 1);
        
        // Por hora
        const hour = new Date().getHours();
        const hourCount = this.metrics.byHour.get(hour) || 0;
        this.metrics.byHour.set(hour, hourCount + 1);
        
        // Incrementar no resueltos
        this.metrics.unresolved++;
    }

    /**
     * Verifica si se deben enviar alertas
     * @param {BaseError} error - Error
     */
    checkAlerts(error) {
        if (!this.config.enableNotifications) return;
        
        const threshold = this.config.alertThresholds[error.severity];
        if (!threshold) return;
        
        const key = `${error.severity}_${Math.floor(Date.now() / this.config.alertWindow)}`;
        const count = this.alertCounts.get(key) || 0;
        
        this.alertCounts.set(key, count + 1);
        
        if (count + 1 >= threshold) {
            this.emit('alertThresholdReached', {
                severity: error.severity,
                count: count + 1,
                threshold,
                window: this.config.alertWindow
            });
        }
    }

    /**
     * Ejecuta manejador específico para un error
     * @param {BaseError} error - Error
     * @param {object} context - Contexto
     * @returns {Promise<object>} Resultado del manejador
     */
    async executeHandler(error, context) {
        const handler = this.handlers.get(error.type);
        
        if (handler) {
            try {
                return await handler(error, context);
            } catch (handlerError) {
                logger.error(`Error handler failed for type ${error.type}:`, handlerError);
                return { handled: false, error: handlerError.message };
            }
        }
        
        // Manejador por defecto
        return this.defaultHandler(error, context);
    }

    /**
     * Manejador por defecto
     * @param {BaseError} error - Error
     * @param {object} context - Contexto
     * @returns {object} Resultado
     */
    defaultHandler(error, context) {
        logger.error(`Unhandled error [${error.type}]:`, error.message, error.details);
        
        return {
            handled: true,
            action: 'logged'
        };
    }

    /**
     * Registra un manejador de error
     * @param {string} type - Tipo de error
     * @param {function} handler - Función manejadora
     */
    registerHandler(type, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        
        this.handlers.set(type, handler);
        this.emit('handlerRegistered', { type, handler });
    }

    /**
     * Registra error en logs
     * @param {BaseError} error - Error
     */
    logError(error) {
        // Validar y normalizar error
        const normalizedError = this.normalizeError(error);
        
        // Crear objeto de log seguro
        const logData = {
            errorId: normalizedError.id || 'unknown',
            type: normalizedError.type || 'UNKNOWN_ERROR',
            severity: normalizedError.severity || 'MEDIUM',
            message: normalizedError.message || 'No message provided',
            details: normalizedError.details || {},
            context: normalizedError.context || {},
            stack: normalizedError.stack || 'No stack trace',
            timestamp: normalizedError.timestamp || new Date().toISOString()
        };
        
        const logLevel = this.getLogLevel(logData.severity);
        
        // Log seguro con validación
        if (typeof console[logLevel] === 'function') {
            console[logLevel](`[${logData.severity.toUpperCase()}] ${logData.type}: ${logData.message}`, logData);
        } else {
            logger.info(`[${logData.severity.toUpperCase()}] ${logData.type}: ${logData.message}`, logData);
        }
    }

    /**
     * Obtiene nivel de log según severidad
     * @param {string} severity - Severidad
     * @returns {string} Nivel de log
     */
    getLogLevel(severity) {
        switch (severity) {
            case ErrorSeverity.CRITICAL:
                return 'error';
            case ErrorSeverity.HIGH:
                return 'error';
            case ErrorSeverity.MEDIUM:
                return 'warn';
            case ErrorSeverity.LOW:
                return 'info';
            default:
                return 'error';
        }
    }

    /**
     * Marca un error como resuelto
     * @param {string} errorId - ID del error
     * @param {string} resolution - Descripción de la resolución
     */
    resolveError(errorId, resolution = '') {
        const error = this.errors.get(errorId);
        
        if (!error) {
            throw new NotFoundError('Error not found', 'error', errorId);
        }
        
        error.resolved = true;
        error.resolvedAt = new Date();
        error.resolution = resolution;
        
        this.metrics.resolved++;
        this.metrics.unresolved--;
        
        this.emit('errorResolved', { errorId, error, resolution });
    }

    /**
     * Obtiene un error por ID
     * @param {string} errorId - ID del error
     * @returns {BaseError} Error
     */
    getError(errorId) {
        return this.errors.get(errorId);
    }

    /**
     * Lista errores con filtros
     * @param {object} filters - Filtros
     * @returns {array} Lista de errores
     */
    listErrors(filters = {}) {
        let errors = Array.from(this.errors.values());
        
        if (filters.type) {
            errors = errors.filter(e => e.type === filters.type);
        }
        
        if (filters.severity) {
            errors = errors.filter(e => e.severity === filters.severity);
        }
        
        if (filters.resolved !== undefined) {
            errors = errors.filter(e => !!e.resolved === filters.resolved);
        }
        
        if (filters.since) {
            const since = new Date(filters.since);
            errors = errors.filter(e => e.timestamp >= since);
        }
        
        if (filters.until) {
            const until = new Date(filters.until);
            errors = errors.filter(e => e.timestamp <= until);
        }
        
        // Ordenar por timestamp descendente
        errors.sort((a, b) => b.timestamp - a.timestamp);
        
        // Limitar resultados
        if (filters.limit) {
            errors = errors.slice(0, filters.limit);
        }
        
        return errors;
    }

    /**
     * Obtiene métricas de errores
     * @returns {object} Métricas
     */
    getMetrics() {
        return {
            ...this.metrics,
            byType: Object.fromEntries(this.metrics.byType),
            bySeverity: Object.fromEntries(this.metrics.bySeverity),
            byHour: Object.fromEntries(this.metrics.byHour),
            errorRate: this.calculateErrorRate(),
            topErrors: this.getTopErrors()
        };
    }

    /**
     * Calcula tasa de errores
     * @returns {object} Tasa de errores
     */
    calculateErrorRate() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        const recentErrors = this.errorHistory.filter(e => 
            new Date(e.timestamp) >= oneHourAgo
        );
        
        return {
            lastHour: recentErrors.length,
            average: this.metrics.total / Math.max(1, Math.floor((now - this.startTime) / (60 * 60 * 1000)))
        };
    }

    /**
     * Obtiene errores más frecuentes
     * @returns {array} Top errores
     */
    getTopErrors() {
        const errorCounts = new Map();
        
        for (const error of this.errorHistory) {
            const key = `${error.type}:${error.message}`;
            errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
        }
        
        return Array.from(errorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([error, count]) => ({ error, count }));
    }

    /**
     * Inicia limpieza de métricas
     */
    startMetricsCleanup() {
        this.startTime = new Date();
        
        // Limpiar contadores de alertas cada hora
        this.cleanupInterval = setInterval(() => {
            const cutoff = Math.floor((Date.now() - this.config.alertWindow) / this.config.alertWindow);
            
            for (const [key] of this.alertCounts) {
                const keyTime = parseInt(key.split('_').pop());
                if (keyTime < cutoff) {
                    this.alertCounts.delete(key);
                }
            }
        }, 60 * 60 * 1000); // Cada hora
    }

    /**
     * Exporta errores para análisis
     * @param {object} filters - Filtros
     * @returns {object} Datos exportados
     */
    exportErrors(filters = {}) {
        const errors = this.listErrors(filters);
        
        return {
            exportedAt: new Date(),
            filters,
            count: errors.length,
            errors: errors.map(error => error.toJSON()),
            metrics: this.getMetrics()
        };
    }

    /**
     * Limpia errores antiguos
     * @param {number} maxAge - Edad máxima en milisegundos
     */
    cleanupErrors(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 días
        const cutoff = new Date(Date.now() - maxAge);
        let cleaned = 0;
        
        for (const [id, error] of this.errors) {
            if (error.timestamp < cutoff) {
                this.errors.delete(id);
                cleaned++;
            }
        }
        
        // Limpiar historial
        this.errorHistory = this.errorHistory.filter(e => 
            new Date(e.timestamp) >= cutoff
        );
        
        if (cleaned > 0) {
            logger.info(`Cleaned up ${cleaned} old errors`);
        }
    }

    /**
     * Limpia recursos y intervalos
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // Limpiar datos en memoria
        this.errorHistory.length = 0;
        
        // Limpiar métricas (es un objeto con Maps)
        this.metrics.total = 0;
        this.metrics.resolved = 0;
        this.metrics.unresolved = 0;
        this.metrics.byType.clear();
        this.metrics.bySeverity.clear();
        this.metrics.byHour.clear();
        
        this.alertCounts.clear();
        this.handlers.clear();
        this.errors.clear();
        
        // Remover todos los listeners
        this.removeAllListeners();
    }
}

// Instancia singleton
const errorManager = new ErrorManager();

// Exportar instancia y clases
export default errorManager;
export {
    errorManager,
    ErrorManager
};
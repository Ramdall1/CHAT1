/**
 * @fileoverview Advanced Error Handling System
 * 
 * Sistema avanzado de manejo de errores con clasificación automática,
 * recuperación inteligente, retry con backoff exponencial y logging detallado.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 5.0.0
 */

import logger from '../logger.js';
import { systemObservable } from '../Observer.js';

/**
 * Enumeración de tipos de error
 * 
 * @enum {string}
 */
export const ErrorType = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  DATABASE: 'database',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  BUSINESS_LOGIC: 'business_logic',
  EXTERNAL_SERVICE: 'external_service',
  SYSTEM: 'system',
  UNKNOWN: 'unknown'
};

/**
 * Enumeración de severidad de errores
 * 
 * @enum {string}
 */
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Enumeración de estrategias de recuperación
 * 
 * @enum {string}
 */
export const RecoveryStrategy = {
  RETRY: 'retry',
  FALLBACK: 'fallback',
  CIRCUIT_BREAKER: 'circuit_breaker',
  GRACEFUL_DEGRADATION: 'graceful_degradation',
  FAIL_FAST: 'fail_fast',
  IGNORE: 'ignore'
};

/**
 * Clase base para errores del sistema
 * 
 * @class BaseError
 * @extends Error
 */
export class BaseError extends Error {
  /**
   * Constructor del error base
   * 
   * @param {string} message - Mensaje del error
   * @param {Object} config - Configuración del error
   * @param {ErrorType} config.type - Tipo de error
   * @param {ErrorSeverity} config.severity - Severidad del error
   * @param {string} config.code - Código de error
   * @param {Object} config.context - Contexto adicional
   * @param {Error} config.originalError - Error original si existe
   */
  constructor(message, config = {}) {
    super(message);
    
    this.name = this.constructor.name;
    this.type = config.type || ErrorType.UNKNOWN;
    this.severity = config.severity || ErrorSeverity.MEDIUM;
    this.code = config.code || 'UNKNOWN_ERROR';
    this.context = config.context || {};
    this.originalError = config.originalError || null;
    this.timestamp = new Date().toISOString();
    this.id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Mantener stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convierte el error a objeto JSON
   * 
   * @returns {Object} Representación JSON del error
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : null
    };
  }
}

/**
 * Error de validación
 * 
 * @class ValidationError
 * @extends BaseError
 */
export class ValidationError extends BaseError {
  constructor(message, field = null, value = null, context = {}) {
    super(message, {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.LOW,
      code: 'VALIDATION_ERROR',
      context: { field, value, ...context }
    });
  }
}

/**
 * Error de red
 * 
 * @class NetworkError
 * @extends BaseError
 */
export class NetworkError extends BaseError {
  constructor(message, statusCode = null, url = null, context = {}) {
    super(message, {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      code: 'NETWORK_ERROR',
      context: { statusCode, url, ...context }
    });
  }
}

/**
 * Error de base de datos
 * 
 * @class DatabaseError
 * @extends BaseError
 */
export class DatabaseError extends BaseError {
  constructor(message, operation = null, table = null, context = {}) {
    super(message, {
      type: ErrorType.DATABASE,
      severity: ErrorSeverity.HIGH,
      code: 'DATABASE_ERROR',
      context: { operation, table, ...context }
    });
  }
}

/**
 * Error de servicio externo
 * 
 * @class ExternalServiceError
 * @extends BaseError
 */
export class ExternalServiceError extends BaseError {
  constructor(message, service = null, endpoint = null, context = {}) {
    super(message, {
      type: ErrorType.EXTERNAL_SERVICE,
      severity: ErrorSeverity.MEDIUM,
      code: 'EXTERNAL_SERVICE_ERROR',
      context: { service, endpoint, ...context }
    });
  }
}

/**
 * Configuración de retry
 * 
 * @typedef {Object} RetryConfig
 * @property {number} maxAttempts - Máximo número de intentos
 * @property {number} baseDelay - Delay base en ms
 * @property {number} maxDelay - Delay máximo en ms
 * @property {number} backoffMultiplier - Multiplicador para backoff exponencial
 * @property {Function} shouldRetry - Función que determina si debe reintentar
 */

/**
 * Manejador avanzado de errores
 * 
 * @class ErrorHandler
 */
export class ErrorHandler {
  /**
   * Constructor del manejador de errores
   * 
   * @param {Object} config - Configuración del manejador
   * @param {boolean} config.enableLogging - Habilitar logging
   * @param {boolean} config.enableMetrics - Habilitar métricas
   * @param {boolean} config.enableRecovery - Habilitar recuperación automática
   * @param {Object} config.retryDefaults - Configuración por defecto de retry
   */
  constructor(config = {}) {
    this.enableLogging = config.enableLogging !== false;
    this.enableMetrics = config.enableMetrics !== false;
    this.enableRecovery = config.enableRecovery !== false;
    
    this.retryDefaults = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      shouldRetry: (error) => this.isRetryableError(error),
      ...config.retryDefaults
    };

    this.errorStats = {
      total: 0,
      byType: new Map(),
      bySeverity: new Map(),
      byCode: new Map(),
      recovered: 0,
      unrecovered: 0
    };

    this.circuitBreakers = new Map();
    this.recoveryStrategies = new Map();
    
    this.setupDefaultRecoveryStrategies();
    
    if (this.enableLogging) {
      logger.info('🛡️ ErrorHandler inicializado');
    }
  }

  /**
   * Configura estrategias de recuperación por defecto
   * 
   * @private
   */
  setupDefaultRecoveryStrategies() {
    // Estrategia para errores de red
    this.recoveryStrategies.set(ErrorType.NETWORK, {
      strategy: RecoveryStrategy.RETRY,
      config: { maxAttempts: 3, baseDelay: 2000 }
    });

    // Estrategia para errores de servicios externos
    this.recoveryStrategies.set(ErrorType.EXTERNAL_SERVICE, {
      strategy: RecoveryStrategy.CIRCUIT_BREAKER,
      config: { threshold: 5, timeout: 60000 }
    });

    // Estrategia para errores de validación
    this.recoveryStrategies.set(ErrorType.VALIDATION, {
      strategy: RecoveryStrategy.FAIL_FAST,
      config: {}
    });

    // Estrategia para errores críticos del sistema
    this.recoveryStrategies.set(ErrorType.SYSTEM, {
      strategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
      config: { fallbackMode: true }
    });
  }

  /**
   * Maneja un error con recuperación automática
   * 
   * @param {Error|BaseError} error - Error a manejar
   * @param {Object} context - Contexto adicional
   * @returns {Promise<Object>} Resultado del manejo del error
   */
  async handleError(error, context = {}) {
    // Normalizar error
    const normalizedError = this.normalizeError(error, context);
    
    // Actualizar estadísticas
    this.updateStats(normalizedError);
    
    // Logging
    if (this.enableLogging) {
      this.logError(normalizedError, context);
    }

    // Notificar observadores
    await systemObservable.notifyObservers('error:occurred', {
      error: normalizedError,
      context
    });

    // Intentar recuperación si está habilitada
    let recoveryResult = null;
    if (this.enableRecovery) {
      recoveryResult = await this.attemptRecovery(normalizedError, context);
    }

    const result = {
      error: normalizedError,
      recovered: recoveryResult?.success || false,
      recoveryStrategy: recoveryResult?.strategy || null,
      recoveryData: recoveryResult?.data || null,
      timestamp: new Date().toISOString()
    };

    // Notificar resultado
    await systemObservable.notifyObservers('error:handled', result);

    return result;
  }

  /**
   * Normaliza un error a BaseError
   * 
   * @private
   * @param {Error|BaseError} error - Error a normalizar
   * @param {Object} context - Contexto adicional
   * @returns {BaseError} Error normalizado
   */
  normalizeError(error, context = {}) {
    if (error instanceof BaseError) {
      return error;
    }

    // Clasificar error automáticamente
    const type = this.classifyError(error);
    const severity = this.determineSeverity(error, type);
    
    return new BaseError(error.message, {
      type,
      severity,
      code: error.code || 'UNKNOWN_ERROR',
      context: { ...context, originalName: error.name },
      originalError: error
    });
  }

  /**
   * Clasifica automáticamente un error
   * 
   * @private
   * @param {Error} error - Error a clasificar
   * @returns {ErrorType} Tipo de error
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ErrorType.VALIDATION;
    }

    if (name.includes('network') || message.includes('network') || message.includes('timeout') || 
        message.includes('connection') || error.code === 'ECONNREFUSED') {
      return ErrorType.NETWORK;
    }

    if (name.includes('database') || message.includes('database') || message.includes('sql')) {
      return ErrorType.DATABASE;
    }

    if (name.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorType.AUTHENTICATION;
    }

    if (message.includes('external') || message.includes('api') || message.includes('service')) {
      return ErrorType.EXTERNAL_SERVICE;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Determina la severidad de un error
   * 
   * @private
   * @param {Error} error - Error a evaluar
   * @param {ErrorType} type - Tipo de error
   * @returns {ErrorSeverity} Severidad del error
   */
  determineSeverity(error, type) {
    // Errores críticos del sistema
    if (type === ErrorType.SYSTEM || error.message.includes('critical')) {
      return ErrorSeverity.CRITICAL;
    }

    // Errores de base de datos son generalmente altos
    if (type === ErrorType.DATABASE) {
      return ErrorSeverity.HIGH;
    }

    // Errores de validación son generalmente bajos
    if (type === ErrorType.VALIDATION) {
      return ErrorSeverity.LOW;
    }

    // Por defecto, severidad media
    return ErrorSeverity.MEDIUM;
  }

  /**
   * Intenta recuperación automática del error
   * 
   * @private
   * @param {BaseError} error - Error a recuperar
   * @param {Object} context - Contexto de recuperación
   * @returns {Promise<Object>} Resultado de la recuperación
   */
  async attemptRecovery(error, context = {}) {
    const recoveryConfig = this.recoveryStrategies.get(error.type);
    
    if (!recoveryConfig) {
      return { success: false, reason: 'No recovery strategy defined' };
    }

    const { strategy, config } = recoveryConfig;

    try {
      switch (strategy) {
        case RecoveryStrategy.RETRY:
          return await this.retryOperation(context.operation, config);
          
        case RecoveryStrategy.FALLBACK:
          return await this.executeFallback(context.fallback, config);
          
        case RecoveryStrategy.CIRCUIT_BREAKER:
          return await this.handleCircuitBreaker(error, config);
          
        case RecoveryStrategy.GRACEFUL_DEGRADATION:
          return await this.gracefulDegradation(config);
          
        case RecoveryStrategy.FAIL_FAST:
          return { success: false, strategy, reason: 'Fail fast strategy' };
          
        case RecoveryStrategy.IGNORE:
          return { success: true, strategy, reason: 'Error ignored' };
          
        default:
          return { success: false, reason: 'Unknown recovery strategy' };
      }
    } catch (recoveryError) {
      if (this.enableLogging) {
        logger.error('❌ Error en recuperación:', recoveryError);
      }
      return { success: false, reason: recoveryError.message };
    }
  }

  /**
   * Ejecuta operación con retry y backoff exponencial
   * 
   * @param {Function} operation - Operación a ejecutar
   * @param {RetryConfig} config - Configuración de retry
   * @returns {Promise<Object>} Resultado de la operación
   */
  async retryOperation(operation, config = {}) {
    if (!operation || typeof operation !== 'function') {
      return { success: false, reason: 'No operation provided for retry' };
    }

    const retryConfig = { ...this.retryDefaults, ...config };
    let lastError = null;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (this.enableLogging) {
          logger.info(`✅ Operación exitosa en intento ${attempt}`);
        }

        return {
          success: true,
          strategy: RecoveryStrategy.RETRY,
          data: result,
          attempts: attempt
        };
      } catch (error) {
        lastError = error;
        
        if (attempt === retryConfig.maxAttempts || !retryConfig.shouldRetry(error)) {
          break;
        }

        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        if (this.enableLogging) {
          logger.warn(`⏳ Reintentando en ${delay}ms (intento ${attempt}/${retryConfig.maxAttempts})`);
        }

        await this.delay(delay);
      }
    }

    return {
      success: false,
      strategy: RecoveryStrategy.RETRY,
      reason: lastError?.message || 'Max attempts reached',
      attempts: retryConfig.maxAttempts
    };
  }

  /**
   * Determina si un error es reintentable
   * 
   * @private
   * @param {Error} error - Error a evaluar
   * @returns {boolean} True si es reintentable
   */
  isRetryableError(error) {
    // Errores de red son generalmente reintentables
    if (error instanceof NetworkError) {
      return true;
    }

    // Errores de servicios externos pueden ser reintentables
    if (error instanceof ExternalServiceError) {
      return true;
    }

    // Errores de validación no son reintentables
    if (error instanceof ValidationError) {
      return false;
    }

    // Por defecto, no reintentar
    return false;
  }

  /**
   * Ejecuta fallback
   * 
   * @private
   * @param {Function} fallback - Función de fallback
   * @param {Object} config - Configuración
   * @returns {Promise<Object>} Resultado del fallback
   */
  async executeFallback(fallback, config = {}) {
    if (!fallback || typeof fallback !== 'function') {
      return { success: false, reason: 'No fallback provided' };
    }

    try {
      const result = await fallback(config);
      return {
        success: true,
        strategy: RecoveryStrategy.FALLBACK,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        strategy: RecoveryStrategy.FALLBACK,
        reason: error.message
      };
    }
  }

  /**
   * Maneja circuit breaker
   * 
   * @private
   * @param {BaseError} error - Error que activó el circuit breaker
   * @param {Object} config - Configuración del circuit breaker
   * @returns {Promise<Object>} Resultado del manejo
   */
  async handleCircuitBreaker(error, config = {}) {
    const key = `${error.type}_${error.context.service || 'unknown'}`;
    
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        failures: 0,
        lastFailure: null,
        state: 'closed' // closed, open, half-open
      });
    }

    const breaker = this.circuitBreakers.get(key);
    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= (config.threshold || 5)) {
      breaker.state = 'open';
      
      if (this.enableLogging) {
        logger.warn(`🔴 Circuit breaker abierto para ${key}`);
      }

      // Programar reapertura
      setTimeout(() => {
        breaker.state = 'half-open';
        if (this.enableLogging) {
          logger.info(`🟡 Circuit breaker semi-abierto para ${key}`);
        }
      }, config.timeout || 60000);
    }

    return {
      success: false,
      strategy: RecoveryStrategy.CIRCUIT_BREAKER,
      data: { state: breaker.state, failures: breaker.failures }
    };
  }

  /**
   * Implementa degradación graceful
   * 
   * @private
   * @param {Object} config - Configuración de degradación
   * @returns {Promise<Object>} Resultado de la degradación
   */
  async gracefulDegradation(config = {}) {
    if (this.enableLogging) {
      logger.warn('⚠️ Activando modo de degradación graceful');
    }

    return {
      success: true,
      strategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
      data: { fallbackMode: config.fallbackMode || true }
    };
  }

  /**
   * Actualiza estadísticas de errores
   * 
   * @private
   * @param {BaseError} error - Error procesado
   */
  updateStats(error) {
    if (!this.enableMetrics) return;

    this.errorStats.total++;
    
    // Por tipo
    const typeCount = this.errorStats.byType.get(error.type) || 0;
    this.errorStats.byType.set(error.type, typeCount + 1);
    
    // Por severidad
    const severityCount = this.errorStats.bySeverity.get(error.severity) || 0;
    this.errorStats.bySeverity.set(error.severity, severityCount + 1);
    
    // Por código
    const codeCount = this.errorStats.byCode.get(error.code) || 0;
    this.errorStats.byCode.set(error.code, codeCount + 1);
  }

  /**
   * Registra error en logs
   * 
   * @private
   * @param {BaseError} error - Error a registrar
   * @param {Object} context - Contexto adicional
   */
  logError(error, context = {}) {
    const logData = {
      errorId: error.id,
      type: error.type,
      severity: error.severity,
      code: error.code,
      message: error.message,
      context: { ...error.context, ...context }
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('🚨 ERROR CRÍTICO:', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('❌ Error alto:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('⚠️ Error medio:', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('ℹ️ Error bajo:', logData);
        break;
      default:
        logger.error('❓ Error desconocido:', logData);
    }
  }

  /**
   * Obtiene estadísticas de errores
   * 
   * @returns {Object} Estadísticas de errores
   */
  getStats() {
    return {
      ...this.errorStats,
      byType: Object.fromEntries(this.errorStats.byType),
      bySeverity: Object.fromEntries(this.errorStats.bySeverity),
      byCode: Object.fromEntries(this.errorStats.byCode),
      circuitBreakers: Object.fromEntries(this.circuitBreakers)
    };
  }

  /**
   * Delay helper
   * 
   * @private
   * @param {number} ms - Milisegundos a esperar
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Instancia global del manejador de errores
export const globalErrorHandler = new ErrorHandler({
  enableLogging: true,
  enableMetrics: true,
  enableRecovery: true
});

// Configurar manejo global de errores no capturados
process.on('uncaughtException', async (error) => {
  await globalErrorHandler.handleError(error, { source: 'uncaughtException' });
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  await globalErrorHandler.handleError(error, { source: 'unhandledRejection' });
});

export default ErrorHandler;
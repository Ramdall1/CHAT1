/**
 * @fileoverview Base Service Class
 * 
 * Clase base para todos los servicios del sistema que proporciona
 * funcionalidad común como manejo de errores, validación, logging,
 * métricas y patrones de diseño consistentes.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 5.0.0
 */

import { globalErrorHandler, BaseError, ErrorType, ErrorSeverity } from '../errors/ErrorHandler.js';
import { globalValidator } from '../validation/DataValidator.js';
import { systemObservable } from '../Observer.js';
import logger from '../logger.js';

/**
 * Estados del servicio
 * 
 * @enum {string}
 */
export const ServiceState = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  BUSY: 'busy',
  ERROR: 'error',
  STOPPED: 'stopped'
};

/**
 * Configuración base del servicio
 * 
 * @typedef {Object} ServiceConfig
 * @property {string} name - Nombre del servicio
 * @property {string} version - Versión del servicio
 * @property {boolean} enableMetrics - Habilitar métricas
 * @property {boolean} enableValidation - Habilitar validación
 * @property {boolean} enableCaching - Habilitar caché
 * @property {number} timeout - Timeout por defecto en ms
 * @property {number} retryAttempts - Intentos de retry por defecto
 * @property {Object} dependencies - Dependencias del servicio
 */

/**
 * Clase base para servicios
 * 
 * @abstract
 * @class BaseService
 */
export class BaseService {
  /**
   * Constructor del servicio base
   * 
   * @param {ServiceConfig} config - Configuración del servicio
   */
  constructor(config = {}) {
    if (this.constructor === BaseService) {
      throw new Error('BaseService es una clase abstracta y no puede ser instanciada directamente');
    }

    this.config = {
      name: config.name || this.constructor.name,
      version: config.version || '1.0.0',
      enableMetrics: config.enableMetrics !== false,
      enableValidation: config.enableValidation !== false,
      enableCaching: config.enableCaching === true,
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      dependencies: config.dependencies || {},
      ...config
    };

    this.state = ServiceState.INITIALIZING;
    this.startTime = Date.now();
    this.lastActivity = Date.now();
    
    this.metrics = {
      operationsCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastError: null,
      uptime: 0
    };

    this.cache = new Map();
    this.dependencies = new Map();
    this.eventListeners = new Map();

    // Registrar observadores
    this.setupObservers();
    
    logger.info(`🔧 Servicio ${this.config.name} inicializando...`);
  }

  /**
   * Configura observadores del servicio
   * 
   * @private
   */
  setupObservers() {
    if (this.config.enableMetrics) {
      systemObservable.addObserver('service:operation', (data) => {
        if (data.service === this.config.name) {
          this.updateMetrics(data);
        }
      });
    }
  }

  /**
   * Inicializa el servicio
   * 
   * @abstract
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('El método initialize() debe ser implementado por la clase hija');
  }

  /**
   * Detiene el servicio
   * 
   * @abstract
   * @returns {Promise<void>}
   */
  async stop() {
    throw new Error('El método stop() debe ser implementado por la clase hija');
  }

  /**
   * Verifica el estado de salud del servicio
   * 
   * @returns {Promise<Object>} Estado de salud
   */
  async healthCheck() {
    const health = {
      service: this.config.name,
      version: this.config.version,
      state: this.state,
      uptime: Date.now() - this.startTime,
      lastActivity: this.lastActivity,
      metrics: { ...this.metrics },
      dependencies: {},
      timestamp: new Date().toISOString()
    };

    // Verificar dependencias
    for (const [name, dependency] of this.dependencies) {
      try {
        if (dependency && typeof dependency.healthCheck === 'function') {
          health.dependencies[name] = await dependency.healthCheck();
        } else {
          health.dependencies[name] = { status: 'unknown' };
        }
      } catch (error) {
        health.dependencies[name] = { 
          status: 'error', 
          error: error.message 
        };
      }
    }

    return health;
  }

  /**
   * Ejecuta una operación con manejo de errores y métricas
   * 
   * @protected
   * @param {string} operationName - Nombre de la operación
   * @param {Function} operation - Función a ejecutar
   * @param {Object} options - Opciones de ejecución
   * @returns {Promise<*>} Resultado de la operación
   */
  async executeOperation(operationName, operation, options = {}) {
    const startTime = Date.now();
    const operationId = `${this.config.name}_${operationName}_${Date.now()}`;
    
    this.state = ServiceState.BUSY;
    this.lastActivity = Date.now();

    try {
      // Validar entrada si está habilitada
      if (this.config.enableValidation && options.inputSchema) {
        const validation = globalValidator.validate(options.input, options.inputSchema);
        if (!validation.valid) {
          throw new BaseError('Validación de entrada falló', {
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.LOW,
            code: 'INPUT_VALIDATION_FAILED',
            context: { 
              operation: operationName,
              errors: validation.errors 
            }
          });
        }
        options.input = validation.data;
      }

      // Verificar caché si está habilitado
      if (this.config.enableCaching && options.cacheKey) {
        const cached = this.cache.get(options.cacheKey);
        if (cached && !this.isCacheExpired(cached)) {
          logger.debug(`📦 Cache hit para ${operationName}`);
          return cached.data;
        }
      }

      // Ejecutar operación con timeout
      const result = await this.executeWithTimeout(operation, options.timeout || this.config.timeout);

      // Validar salida si está habilitada
      if (this.config.enableValidation && options.outputSchema) {
        const validation = globalValidator.validate(result, options.outputSchema);
        if (!validation.valid) {
          logger.warn(`⚠️ Validación de salida falló para ${operationName}:`, validation.errors);
        }
      }

      // Guardar en caché si está habilitado
      if (this.config.enableCaching && options.cacheKey && options.cacheTTL) {
        this.cache.set(options.cacheKey, {
          data: result,
          timestamp: Date.now(),
          ttl: options.cacheTTL
        });
      }

      // Actualizar métricas
      const responseTime = Date.now() - startTime;
      this.updateOperationMetrics(operationName, true, responseTime);

      // Notificar éxito
      await systemObservable.notifyObservers('service:operation', {
        service: this.config.name,
        operation: operationName,
        success: true,
        responseTime,
        operationId
      });

      this.state = ServiceState.READY;
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Manejar error
      const handledError = await globalErrorHandler.handleError(error, {
        service: this.config.name,
        operation: operationName,
        operationId,
        input: options.input
      });

      // Actualizar métricas
      this.updateOperationMetrics(operationName, false, responseTime, handledError.error);

      // Notificar error
      await systemObservable.notifyObservers('service:operation', {
        service: this.config.name,
        operation: operationName,
        success: false,
        error: handledError.error,
        responseTime,
        operationId
      });

      this.state = ServiceState.ERROR;
      
      // Re-lanzar error si no fue recuperado
      if (!handledError.recovered) {
        throw handledError.error;
      }

      return handledError.recoveryData;
    }
  }

  /**
   * Ejecuta una función con timeout
   * 
   * @private
   * @param {Function} operation - Operación a ejecutar
   * @param {number} timeout - Timeout en ms
   * @returns {Promise<*>} Resultado de la operación
   */
  async executeWithTimeout(operation, timeout) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new BaseError(`Operación timeout después de ${timeout}ms`, {
          type: ErrorType.SYSTEM,
          severity: ErrorSeverity.MEDIUM,
          code: 'OPERATION_TIMEOUT',
          context: { timeout }
        }));
      }, timeout);

      try {
        const result = await operation();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Actualiza métricas de operación
   * 
   * @private
   * @param {string} operationName - Nombre de la operación
   * @param {boolean} success - Si fue exitosa
   * @param {number} responseTime - Tiempo de respuesta
   * @param {Error} error - Error si ocurrió
   */
  updateOperationMetrics(operationName, success, responseTime, error = null) {
    if (!this.config.enableMetrics) return;

    this.metrics.operationsCount++;
    
    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.errorCount++;
      this.metrics.lastError = {
        operation: operationName,
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }

    // Calcular tiempo promedio de respuesta
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.operationsCount - 1) + responseTime) / 
      this.metrics.operationsCount;

    this.metrics.uptime = Date.now() - this.startTime;
  }

  /**
   * Actualiza métricas generales
   * 
   * @private
   * @param {Object} data - Datos de la operación
   */
  updateMetrics(data) {
    // Implementación específica en clases hijas si es necesario
  }

  /**
   * Verifica si un elemento del caché ha expirado
   * 
   * @private
   * @param {Object} cacheItem - Elemento del caché
   * @returns {boolean} True si ha expirado
   */
  isCacheExpired(cacheItem) {
    return Date.now() - cacheItem.timestamp > cacheItem.ttl;
  }

  /**
   * Limpia el caché expirado
   * 
   * @protected
   */
  cleanExpiredCache() {
    for (const [key, item] of this.cache.entries()) {
      if (this.isCacheExpired(item)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Registra una dependencia
   * 
   * @protected
   * @param {string} name - Nombre de la dependencia
   * @param {*} dependency - Instancia de la dependencia
   */
  registerDependency(name, dependency) {
    this.dependencies.set(name, dependency);
    logger.debug(`🔗 Dependencia registrada: ${name}`);
  }

  /**
   * Obtiene una dependencia
   * 
   * @protected
   * @param {string} name - Nombre de la dependencia
   * @returns {*} Instancia de la dependencia
   */
  getDependency(name) {
    return this.dependencies.get(name);
  }

  /**
   * Valida que todas las dependencias estén disponibles
   * 
   * @protected
   * @returns {Promise<boolean>} True si todas las dependencias están disponibles
   */
  async validateDependencies() {
    for (const [name, dependency] of this.dependencies) {
      if (!dependency) {
        throw new BaseError(`Dependencia no disponible: ${name}`, {
          type: ErrorType.SYSTEM,
          severity: ErrorSeverity.HIGH,
          code: 'DEPENDENCY_UNAVAILABLE',
          context: { dependency: name }
        });
      }

      // Verificar salud de la dependencia si es posible
      if (typeof dependency.healthCheck === 'function') {
        try {
          const health = await dependency.healthCheck();
          if (health.state === ServiceState.ERROR) {
            throw new BaseError(`Dependencia en estado de error: ${name}`, {
              type: ErrorType.SYSTEM,
              severity: ErrorSeverity.HIGH,
              code: 'DEPENDENCY_ERROR',
              context: { dependency: name, health }
            });
          }
        } catch (error) {
          logger.warn(`⚠️ No se pudo verificar salud de dependencia ${name}:`, error.message);
        }
      }
    }

    return true;
  }

  /**
   * Obtiene información del servicio
   * 
   * @returns {Object} Información del servicio
   */
  getInfo() {
    return {
      name: this.config.name,
      version: this.config.version,
      state: this.state,
      uptime: Date.now() - this.startTime,
      lastActivity: this.lastActivity,
      metrics: { ...this.metrics },
      cacheSize: this.cache.size,
      dependenciesCount: this.dependencies.size,
      config: {
        enableMetrics: this.config.enableMetrics,
        enableValidation: this.config.enableValidation,
        enableCaching: this.config.enableCaching,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts
      }
    };
  }

  /**
   * Reinicia el servicio
   * 
   * @returns {Promise<void>}
   */
  async restart() {
    logger.info(`🔄 Reiniciando servicio ${this.config.name}...`);
    
    try {
      await this.stop();
      await this.initialize();
      logger.info(`✅ Servicio ${this.config.name} reiniciado exitosamente`);
    } catch (error) {
      logger.error(`❌ Error reiniciando servicio ${this.config.name}:`, error);
      throw error;
    }
  }

  /**
   * Limpia recursos del servicio
   * 
   * @protected
   */
  cleanup() {
    this.cache.clear();
    this.eventListeners.clear();
    this.state = ServiceState.STOPPED;
    
    logger.info(`🧹 Recursos del servicio ${this.config.name} limpiados`);
  }
}

export default BaseService;
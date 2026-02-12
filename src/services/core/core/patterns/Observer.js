/**
 * @fileoverview Observer Pattern Implementation
 * 
 * Implementa el patrón Observer para crear un sistema de notificaciones
 * robusto y desacoplado, mejorando el EventBus existente con funcionalidades
 * avanzadas como prioridades, filtros y manejo de errores.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 5.0.0
 */

import logger from '../logger.js';
import { EventEmitter } from 'events';

/**
 * Interfaz base para observadores
 * 
 * Define el contrato que deben cumplir todos los observadores,
 * proporcionando una interfaz consistente para recibir notificaciones.
 * 
 * @abstract
 * @class BaseObserver
 */
export class BaseObserver {
  /**
   * Constructor del observador base
   * 
   * @param {Object} config - Configuración del observador
   * @param {string} config.id - ID único del observador
   * @param {number} config.priority - Prioridad de ejecución (mayor = primero)
   * @param {boolean} config.enabled - Si está habilitado
   * @param {Function} config.filter - Función de filtro para eventos
   */
  constructor(config = {}) {
    this.id = config.id || `observer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.priority = config.priority || 0;
    this.enabled = config.enabled !== false;
    this.filter = config.filter || (() => true);
    this.metadata = config.metadata || {};
    this.stats = {
      notificationsReceived: 0,
      notificationsProcessed: 0,
      errors: 0,
      lastNotification: null
    };
    
    if (this.constructor === BaseObserver) {
      throw new Error('BaseObserver es una clase abstracta');
    }
  }

  /**
   * Maneja una notificación (método abstracto)
   * 
   * @abstract
   * @param {*} data - Datos de la notificación
   * @param {Object} context - Contexto de la notificación
   * @returns {Promise<*>} Resultado del procesamiento
   * @throws {Error} Si no está implementado
   */
  async notify(data, context = {}) {
    throw new Error('El método notify debe ser implementado');
  }

  /**
   * Verifica si el observador puede procesar la notificación
   * 
   * @param {*} data - Datos de la notificación
   * @param {Object} context - Contexto de la notificación
   * @returns {boolean} True si puede procesar
   */
  canHandle(data, context = {}) {
    return this.enabled && this.filter(data, context);
  }

  /**
   * Actualiza las estadísticas del observador
   * 
   * @param {boolean} processed - Si se procesó exitosamente
   * @param {Error} error - Error si ocurrió
   */
  updateStats(processed = false, error = null) {
    this.stats.notificationsReceived++;
    if (processed) {
      this.stats.notificationsProcessed++;
    }
    if (error) {
      this.stats.errors++;
    }
    this.stats.lastNotification = new Date().toISOString();
  }

  /**
   * Obtiene información del observador
   * 
   * @returns {Object} Información del observador
   */
  getInfo() {
    return {
      id: this.id,
      priority: this.priority,
      enabled: this.enabled,
      metadata: this.metadata,
      stats: { ...this.stats }
    };
  }
}

/**
 * Sujeto observable que maneja observadores
 * 
 * Implementa el patrón Observer con funcionalidades avanzadas como
 * prioridades, filtros, manejo de errores y estadísticas.
 * 
 * @class Observable
 * @extends EventEmitter
 */
export class Observable extends EventEmitter {
  /**
   * Constructor del observable
   * 
   * @param {Object} config - Configuración del observable
   * @param {string} config.name - Nombre del observable
   * @param {boolean} config.enableLogging - Habilitar logging
   * @param {number} config.maxObservers - Máximo número de observadores
   * @param {boolean} config.enableStats - Habilitar estadísticas
   */
  constructor(config = {}) {
    super();
    
    this.name = config.name || 'Observable';
    this.enableLogging = config.enableLogging !== false;
    this.maxObservers = config.maxObservers || 100;
    this.enableStats = config.enableStats !== false;
    
    this.observers = new Map();
    this.eventFilters = new Map();
    this.stats = {
      totalNotifications: 0,
      successfulNotifications: 0,
      failedNotifications: 0,
      observersAdded: 0,
      observersRemoved: 0
    };
    
    // Configurar límite de listeners
    this.setMaxListeners(this.maxObservers);
    
    if (this.enableLogging) {
      logger.info(`👁️ Observable ${this.name} inicializado`);
    }
  }

  /**
   * Agrega un observador
   * 
   * @param {BaseObserver} observer - Observador a agregar
   * @param {string[]} events - Eventos a observar (opcional)
   * @throws {Error} Si el observador no es válido o se excede el límite
   */
  addObserver(observer, events = ['*']) {
    if (!(observer instanceof BaseObserver)) {
      throw new Error('El observador debe extender BaseObserver');
    }

    if (this.observers.size >= this.maxObservers) {
      throw new Error(`Máximo número de observadores alcanzado: ${this.maxObservers}`);
    }

    if (this.observers.has(observer.id)) {
      throw new Error(`Observador con ID '${observer.id}' ya existe`);
    }

    this.observers.set(observer.id, {
      observer,
      events: new Set(events),
      addedAt: new Date().toISOString()
    });

    if (this.enableStats) {
      this.stats.observersAdded++;
    }

    if (this.enableLogging) {
      logger.debug(`👁️ Observador '${observer.id}' agregado a ${this.name}`);
    }

    this.emit('observer:added', { observerId: observer.id, events });
  }

  /**
   * Remueve un observador
   * 
   * @param {string} observerId - ID del observador a remover
   * @returns {boolean} True si se removió exitosamente
   */
  removeObserver(observerId) {
    const removed = this.observers.delete(observerId);
    
    if (removed) {
      if (this.enableStats) {
        this.stats.observersRemoved++;
      }

      if (this.enableLogging) {
        logger.debug(`👁️ Observador '${observerId}' removido de ${this.name}`);
      }

      this.emit('observer:removed', { observerId });
    }

    return removed;
  }

  /**
   * Notifica a todos los observadores relevantes
   * 
   * @param {string} event - Nombre del evento
   * @param {*} data - Datos de la notificación
   * @param {Object} context - Contexto adicional
   * @returns {Promise<Object>} Resultado de las notificaciones
   */
  async notifyObservers(event, data, context = {}) {
    if (this.enableStats) {
      this.stats.totalNotifications++;
    }

    const relevantObservers = this.getRelevantObservers(event);
    const results = {
      event,
      totalObservers: relevantObservers.length,
      successful: 0,
      failed: 0,
      results: [],
      errors: []
    };

    if (relevantObservers.length === 0) {
      if (this.enableLogging) {
        logger.debug(`📢 No hay observadores para el evento '${event}' en ${this.name}`);
      }
      return results;
    }

    // Ordenar por prioridad (mayor prioridad primero)
    relevantObservers.sort((a, b) => b.observer.priority - a.observer.priority);

    const notificationPromises = relevantObservers.map(async ({ observer }) => {
      try {
        if (!observer.canHandle(data, { ...context, event })) {
          return { observerId: observer.id, status: 'skipped', reason: 'filtered' };
        }

        const result = await observer.notify(data, { ...context, event });
        observer.updateStats(true);
        
        return {
          observerId: observer.id,
          status: 'success',
          result
        };
      } catch (error) {
        observer.updateStats(false, error);
        
        if (this.enableLogging) {
          logger.error(`❌ Error en observador '${observer.id}':`, error);
        }

        return {
          observerId: observer.id,
          status: 'error',
          error: error.message
        };
      }
    });

    const notificationResults = await Promise.allSettled(notificationPromises);

    // Procesar resultados
    notificationResults.forEach((promiseResult, index) => {
      if (promiseResult.status === 'fulfilled') {
        const result = promiseResult.value;
        results.results.push(result);
        
        if (result.status === 'success') {
          results.successful++;
        } else if (result.status === 'error') {
          results.failed++;
          results.errors.push(result);
        }
      } else {
        results.failed++;
        results.errors.push({
          observerId: relevantObservers[index].observer.id,
          status: 'error',
          error: promiseResult.reason.message
        });
      }
    });

    // Actualizar estadísticas globales
    if (this.enableStats) {
      if (results.failed === 0) {
        this.stats.successfulNotifications++;
      } else {
        this.stats.failedNotifications++;
      }
    }

    if (this.enableLogging) {
      logger.debug(`📢 Evento '${event}' notificado: ${results.successful} exitosos, ${results.failed} fallidos`);
    }

    this.emit('notification:completed', results);
    return results;
  }

  /**
   * Obtiene observadores relevantes para un evento
   * 
   * @private
   * @param {string} event - Nombre del evento
   * @returns {Array} Array de observadores relevantes
   */
  getRelevantObservers(event) {
    return Array.from(this.observers.values()).filter(({ events }) => 
      events.has('*') || events.has(event)
    );
  }

  /**
   * Obtiene todos los observadores
   * 
   * @returns {Object[]} Array de información de observadores
   */
  getObservers() {
    return Array.from(this.observers.values()).map(({ observer, events, addedAt }) => ({
      ...observer.getInfo(),
      events: Array.from(events),
      addedAt
    }));
  }

  /**
   * Obtiene estadísticas del observable
   * 
   * @returns {Object} Estadísticas del observable
   */
  getStats() {
    return {
      name: this.name,
      totalObservers: this.observers.size,
      maxObservers: this.maxObservers,
      ...this.stats
    };
  }

  /**
   * Limpia todos los observadores
   */
  clearObservers() {
    const count = this.observers.size;
    this.observers.clear();
    
    if (this.enableLogging) {
      logger.debug(`🧹 ${count} observadores limpiados de ${this.name}`);
    }

    this.emit('observers:cleared', { count });
  }
}

/**
 * Observador para logging de eventos
 * 
 * @class LoggingObserver
 * @extends BaseObserver
 */
export class LoggingObserver extends BaseObserver {
  constructor(config = {}) {
    super({
      id: 'logging_observer',
      priority: -1, // Baja prioridad para ejecutar al final
      ...config
    });
    this.logLevel = config.logLevel || 'info';
  }

  async notify(data, context) {
    const { event } = context;
    const message = `📢 Evento '${event}' procesado`;
    
    switch (this.logLevel) {
      case 'debug':
        logger.debug(message, { data, context });
        break;
      case 'info':
        logger.info(message);
        break;
      case 'warn':
        logger.warn(message);
        break;
      default:
        logger.info(message);
    }

    return { logged: true, timestamp: new Date().toISOString() };
  }
}

/**
 * Observador para métricas y estadísticas
 * 
 * @class MetricsObserver
 * @extends BaseObserver
 */
export class MetricsObserver extends BaseObserver {
  constructor(config = {}) {
    super({
      id: 'metrics_observer',
      priority: 10, // Alta prioridad para capturar métricas
      ...config
    });
    this.metrics = new Map();
  }

  async notify(data, context) {
    const { event } = context;
    const timestamp = new Date().toISOString();
    
    if (!this.metrics.has(event)) {
      this.metrics.set(event, {
        count: 0,
        firstSeen: timestamp,
        lastSeen: timestamp
      });
    }

    const metric = this.metrics.get(event);
    metric.count++;
    metric.lastSeen = timestamp;

    return { 
      event, 
      count: metric.count, 
      recorded: true 
    };
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
}

// Observable global para el sistema
export const systemObservable = new Observable({
  name: 'SystemObservable',
  maxObservers: 200
});

// Agregar observadores por defecto
systemObservable.addObserver(new LoggingObserver());
systemObservable.addObserver(new MetricsObserver());

export default Observable;
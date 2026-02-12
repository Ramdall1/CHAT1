/**
 * @fileoverview EventBus - Sistema de comunicación orientado a eventos
 * 
 * Este archivo implementa el núcleo de comunicación del ChatBot Enterprise
 * usando un patrón de arquitectura orientada a eventos. Proporciona:
 * - Comunicación desacoplada entre módulos
 * - Sistema de colas con prioridades
 * - Manejo de reintentos automáticos
 * - Logging y métricas de eventos
 * - Procesamiento asíncrono de eventos
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2024
 */

import { EventEmitter } from 'events';
import { createLogger } from './core/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * EventBus - Núcleo de comunicación orientado a eventos
 * 
 * Extiende EventEmitter de Node.js para proporcionar un sistema robusto
 * de comunicación entre módulos con características avanzadas como:
 * - Colas de prioridad para eventos críticos
 * - Sistema de reintentos automáticos
 * - Logging detallado de eventos
 * - Métricas de rendimiento
 * - Manejo de errores resiliente
 * 
 * @class EventBus
 * @extends EventEmitter
 * @example
 * ```javascript
 * import EventBus from '../../EventBus.js';
 * 
 * const eventBus = new EventBus();
 * 
 * // Escuchar eventos
 * eventBus.onEvent('user.login', (data) => {
 *   logger.info('Usuario logueado:', data.userId);
 * });
 * 
 * // Emitir eventos con prioridad
 * eventBus.emitEvent('user.login', { userId: 123 }, { priority: 'high' });
 * ```
 */
class EventBus extends EventEmitter {
  /**
   * Constructor del EventBus
   * 
   * Inicializa todas las estructuras de datos necesarias para el
   * manejo de eventos, configuración de colas y sistema de logging.
   * 
   * @constructor
   */
  constructor() {
    super();
    
    /** @type {Object} Logger específico para el EventBus */
    this.logger = createLogger('EVENT_BUS');
    
    /** @type {Array} Log de eventos procesados para auditoría */
    this.eventLog = [];
    
    /** @type {Map} Estadísticas de eventos por tipo */
    this.eventStats = new Map();
    
    /** @type {Array} Cola de eventos para reintentos */
    this.retryQueue = [];
    
    /** @type {Object} Colas de prioridad para procesamiento de eventos */
    this.priorityQueues = {
      high: [],
      medium: [],
      low: []
    };
    
    /** @type {Object} Contadores de eventos procesados por prioridad */
    this.processedCounts = {
      high: 0,
      medium: 0,
      low: 0
    };
    
    /** @type {Map} Mapa de listeners registrados */
    this.listeners = new Map();
    
    /** @type {boolean} Indica si el procesador de colas está activo */
    this.isProcessing = false;
    
    /** @type {number} Número máximo de reintentos para eventos fallidos */
    this.maxRetries = 3;
    
    /** @type {number} Delay en milisegundos entre reintentos */
    this.retryDelay = 1000; // 1 segundo
    
    /** @type {number} Timestamp de inicio del EventBus */
    this.startTime = Date.now();
    
    /** @type {string} Ruta del archivo de log de eventos */
    this.logFilePath = path.join(process.cwd(), 'data', 'logs', 'events.log');
    
    /** @type {NodeJS.Timeout|null} Referencia al timer de logging para cleanup */
    this.loggingTimer = null;
        
    // Configurar límites de listeners para evitar memory leaks
    this.setMaxListeners(100);
        
    // Inicializar procesamiento de colas en background
    this.startQueueProcessor();
        
    // Configurar logging automático de eventos
    this.setupEventLogging();
        
    this.logger.info('🚀 EventBus inicializado');
  }

  /**
   * Emite un evento con prioridad y metadata
   * 
   * Método principal para emitir eventos en el sistema. Soporta
   * diferentes niveles de prioridad, timeouts, reintentos automáticos
   * y metadata personalizada para tracking y debugging.
   * 
   * @method emitEvent
   * @memberof EventBus
   * @param {string} eventName - Nombre del evento a emitir
   * @param {Object} [payload={}] - Datos del evento
   * @param {Object} [options={}] - Opciones de configuración
   * @param {string} [options.priority='medium'] - Prioridad del evento ('high', 'medium', 'low')
   * @param {boolean} [options.retryable=true] - Si debe reintentar en caso de fallo
   * @param {number} [options.timeout=30000] - Timeout en milisegundos
   * @param {string} [options.source='unknown'] - Fuente que emite el evento
   * @param {string} [options.correlationId] - ID de correlación para tracking
   * @returns {string} ID de correlación del evento emitido
   * 
   * @example
   * ```javascript
   * // Evento simple
   * eventBus.emitEvent('user.login', { userId: 123 });
   * 
   * // Evento con alta prioridad
   * eventBus.emitEvent('system.error', { error: 'Critical failure' }, {
   *   priority: 'high',
   *   timeout: 10000
   * });
   * 
   * // Evento sin reintentos
   * eventBus.emitEvent('analytics.track', { action: 'click' }, {
   *   retryable: false
   * });
   * ```
   */
  emitEvent(eventName, payload = {}, options = {}) {
    const {
      priority = 'medium',
      retryable = true,
      timeout = 30000,
      source = 'unknown',
      correlationId = this.generateCorrelationId()
    } = options;

    const eventData = {
      id: this.generateEventId(),
      name: eventName,
      payload,
      priority,
      retryable,
      timeout,
      source,
      correlationId,
      timestamp: new Date().toISOString(),
      attempts: 0,
      maxRetries: this.maxRetries
    };

    // Validar tipo de evento
    if (!this.isValidEventType(eventName)) {
      this.logger.warn(`⚠️ Tipo de evento no válido: ${eventName}`);
    }

    // Agregar a cola de prioridad
    this.addToQueue(eventData);
        
    // Log del evento
    this.logEvent('emitted', eventData);
        
    // Actualizar estadísticas
    this.updateStats(eventName, 'emitted');

    this.logger.debug(`📤 Evento emitido: ${eventName}`, { 
      correlationId, 
      priority, 
      source 
    });

    return correlationId;
  }

  /**
     * Registrar listener con metadata
     */
  onEvent(eventName, handler, options = {}) {
    const {
      priority = 'medium',
      timeout = 30000,
      retryOnError = true,
      module = 'unknown'
    } = options;

    const wrappedHandler = async(eventData) => {
      const startTime = Date.now();
            
      try {
        this.logger.debug(`📥 Procesando evento: ${eventName}`, {
          correlationId: eventData.correlationId,
          module
        });

        // Ejecutar handler con timeout
        const result = await Promise.race([
          handler(eventData.payload, eventData),
          this.createTimeout(timeout, `Handler timeout for ${eventName}`)
        ]);

        const duration = Date.now() - startTime;
                
        // Log exitoso
        this.logEvent('processed', eventData, { module, duration, result });
        this.updateStats(eventName, 'processed');

        this.logger.debug(`✅ Evento procesado exitosamente: ${eventName}`, {
          correlationId: eventData.correlationId,
          duration: `${duration}ms`,
          module
        });

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
                
        this.logger.error(`❌ Error procesando evento: ${eventName}`, {
          error: error.message,
          correlationId: eventData.correlationId,
          module,
          duration: `${duration}ms`
        });

        // Log del error
        this.logEvent('error', eventData, { module, duration, error: error.message });
        this.updateStats(eventName, 'failed');

        // Reintentar si es posible
        if (retryOnError && eventData.retryable && eventData.attempts < eventData.maxRetries) {
          this.scheduleRetry(eventData);
        }

        throw error;
      }
    };

    // Registrar listener
    this.on(eventName, wrappedHandler);
        
    // Guardar metadata del listener
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
        
    this.listeners.get(eventName).push({
      handler: wrappedHandler,
      module,
      priority,
      timeout,
      retryOnError,
      registeredAt: new Date().toISOString()
    });

    this.logger.info(`🎯 Listener registrado: ${eventName} por ${module}`);
  }

  /**
     * Agregar evento a cola de prioridad
     */
  addToQueue(eventData) {
    const { priority } = eventData;
        
    if (this.priorityQueues[priority]) {
      this.priorityQueues[priority].push(eventData);
    } else {
      this.priorityQueues.medium.push(eventData);
    }
  }

  /**
     * Procesar colas de eventos
     */
  async startQueueProcessor() {
    if (this.isProcessing) return;
        
    this.isProcessing = true;
        
    while (this.isProcessing) {
      try {
        // Procesar por prioridad: high -> medium -> low
        const eventData = this.getNextEvent();
                
        if (eventData) {
          await this.processEvent(eventData);
        } else {
          // No hay eventos, esperar un poco
          await this.sleep(100);
        }
                
      } catch (error) {
        this.logger.error('❌ Error en procesador de cola:', error);
        await this.sleep(1000);
      }
    }
  }

  /**
     * Obtener siguiente evento de la cola con prioridad
     */
  getNextEvent() {
    // Implementar algoritmo de prioridades con balanceamiento
    const highQueue = this.priorityQueues.high;
    const mediumQueue = this.priorityQueues.medium;
    const lowQueue = this.priorityQueues.low;

    // Si hay eventos de alta prioridad, procesarlos primero
    if (highQueue.length > 0) {
      return highQueue.shift();
    }

    // Balancear entre medium y low (2:1 ratio)
    if (mediumQueue.length > 0 && lowQueue.length > 0) {
      // Procesar 2 eventos medium por cada 1 low
      const mediumCount = this.processedCounts.medium || 0;
      const lowCount = this.processedCounts.low || 0;
            
      if (mediumCount < lowCount * 2) {
        this.processedCounts.medium = mediumCount + 1;
        return mediumQueue.shift();
      } else {
        this.processedCounts.low = lowCount + 1;
        return lowQueue.shift();
      }
    }

    // Si solo hay eventos medium
    if (mediumQueue.length > 0) {
      this.processedCounts.medium = (this.processedCounts.medium || 0) + 1;
      return mediumQueue.shift();
    }

    // Si solo hay eventos low
    if (lowQueue.length > 0) {
      this.processedCounts.low = (this.processedCounts.low || 0) + 1;
      return lowQueue.shift();
    }

    return null;
  }

  /**
     * Procesar evento de la cola
     */
  async processEvent(eventData) {
    try {
      eventData.attempts++;
      eventData.lastAttempt = new Date().toISOString();
            
      this.logger.debug(`🔄 Procesando evento ${eventData.name}`, {
        attempt: eventData.attempts,
        correlationId: eventData.correlationId
      });

      // Verificar si hay listeners para este evento
      const listenerCount = this.listenerCount(eventData.name);
      if (listenerCount === 0) {
        this.logger.warn(`⚠️ No hay listeners para evento ${eventData.name}`);
        this.logEvent('no_listeners', eventData);
        return;
      }

      // Crear promesa para manejar timeout
      const eventPromise = new Promise((resolve, reject) => {
        try {
          // Emitir el evento a los listeners
          this.emit(eventData.name, eventData);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      // Aplicar timeout si está configurado
      if (eventData.timeout > 0) {
        await Promise.race([
          eventPromise,
          this.createTimeout(eventData.timeout, `Timeout para evento ${eventData.name}`)
        ]);
      } else {
        await eventPromise;
      }

      // Log de éxito
      this.logEvent('processed', eventData);
      this.updateStats(eventData.name, 'processed');
            
    } catch (error) {
      this.logger.error(`❌ Error procesando evento ${eventData.name}:`, {
        error: error.message,
        attempt: eventData.attempts,
        correlationId: eventData.correlationId
      });

      // Log del error
      this.logEvent('error', eventData, { error: error.message });
      this.updateStats(eventData.name, 'failed');
            
      // Programar reintento si es necesario
      if (eventData.retryable && eventData.attempts < eventData.maxRetries) {
        this.scheduleRetry(eventData);
      } else {
        // Evento falló definitivamente
        this.logEvent('failed_permanently', eventData, { 
          error: error.message,
          totalAttempts: eventData.attempts 
        });
        this.updateStats(eventData.name, 'failed_permanently');
                
        // Emitir evento de fallo permanente
        this.emit('event.failed', {
          originalEvent: eventData,
          error: error.message,
          attempts: eventData.attempts
        });
      }
    }
  }

  /**
     * Programar reintento de evento
     */
  scheduleRetry(eventData) {
    const retryId = `${eventData.id}_${eventData.attempts}`;
        
    // Calcular delay con backoff exponencial y jitter
    const baseDelay = this.retryDelay * Math.pow(2, eventData.attempts - 1);
    const jitter = Math.random() * 0.1 * baseDelay; // 10% de jitter
    const delay = Math.min(baseDelay + jitter, 30000); // Máximo 30 segundos
        
    this.logger.info(`🔄 Programando reintento para evento ${eventData.name}`, {
      attempt: eventData.attempts,
      maxRetries: eventData.maxRetries,
      delay: `${Math.round(delay)}ms`,
      correlationId: eventData.correlationId,
      retryId
    });

    // Marcar el evento como programado para reintento
    eventData.retryScheduled = true;
    eventData.nextRetryAt = new Date(Date.now() + delay).toISOString();

    // Log del reintento programado
    this.logEvent('retry_scheduled', eventData, { 
      delay: Math.round(delay),
      nextRetryAt: eventData.nextRetryAt 
    });

    const timeoutId = setTimeout(() => {
      // Verificar si el evento aún debe ser reintentado
      if (eventData.retryScheduled) {
        eventData.retryScheduled = false;
        this.addToQueue(eventData);
        this.logEvent('retry_executed', eventData);
      }
    }, delay);

    // Guardar el timeout ID para poder cancelarlo si es necesario
    eventData.retryTimeoutId = timeoutId;
  }

  /**
     * Validar tipo de evento
     */
  isValidEventType(eventName) {
    const validPrefixes = ['system.', 'user.', 'ai.'];
    return validPrefixes.some(prefix => eventName.startsWith(prefix));
  }

  /**
     * Configurar logging automático de eventos
     */
  setupEventLogging() {
    // Crear directorio de logs si no existe
    this.ensureLogDirectory();
        
    // Guardar logs cada 5 segundos
    this.loggingTimer = setInterval(() => {
      this.flushEventLogs();
    }, 5000);
  }

  /**
     * Registrar evento en log
     */
  logEvent(action, eventData, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      eventId: eventData.id,
      eventName: eventData.name,
      correlationId: eventData.correlationId,
      source: eventData.source,
      attempts: eventData.attempts,
      ...metadata
    };

    this.eventLog.push(logEntry);
        
    // Mantener solo los últimos 1000 eventos en memoria
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }
  }

  /**
     * Actualizar estadísticas de eventos
     */
  updateStats(eventName, action) {
    if (!this.eventStats.has(eventName)) {
      this.eventStats.set(eventName, {
        emitted: 0,
        processed: 0,
        failed: 0,
        failed_permanently: 0,
        retries: 0,
        lastEmitted: null,
        lastProcessed: null,
        lastFailed: null,
        avgProcessingTime: 0,
        totalProcessingTime: 0
      });
    }

    const stats = this.eventStats.get(eventName);
    const timestamp = new Date().toISOString();
        
    // Incrementar contador de la acción
    if (stats.hasOwnProperty(action)) {
      stats[action]++;
    }
        
    // Actualizar timestamps específicos
    switch (action) {
    case 'emitted':
      stats.lastEmitted = timestamp;
      break;
    case 'processed':
      stats.lastProcessed = timestamp;
      break;
    case 'failed':
    case 'failed_permanently':
      stats.lastFailed = timestamp;
      break;
    case 'retry_scheduled':
      stats.retries++;
      break;
    }

    // Calcular tiempo promedio de procesamiento si es aplicable
    if (action === 'processed' && stats.processed > 0) {
      stats.avgProcessingTime = stats.totalProcessingTime / stats.processed;
    }
  }

  /**
     * Obtener estadísticas de eventos
     */
  getStats() {
    return {
      totalEvents: Array.from(this.eventStats.values()).reduce((sum, stats) => sum + stats.emitted, 0),
      totalProcessed: Array.from(this.eventStats.values()).reduce((sum, stats) => sum + stats.processed, 0),
      totalFailed: Array.from(this.eventStats.values()).reduce((sum, stats) => sum + stats.failed, 0),
      queueSizes: {
        high: this.priorityQueues.high.length,
        medium: this.priorityQueues.medium.length,
        low: this.priorityQueues.low.length
      },
      eventStats: Object.fromEntries(this.eventStats),
      listeners: Object.fromEntries(
        Array.from(this.listeners.entries()).map(([event, listeners]) => [
          event, 
          listeners.map(l => ({ module: l.module, priority: l.priority }))
        ])
      )
    };
  }

  /**
     * Obtener mapa de eventos
     */
  getEventMap() {
    const eventMap = {};
        
    for (const [eventName, listeners] of this.listeners.entries()) {
      eventMap[eventName] = {
        listeners: listeners.map(l => l.module),
        stats: this.eventStats.get(eventName) || { emitted: 0, processed: 0, failed: 0 }
      };
    }
        
    return eventMap;
  }

  /**
     * Guardar logs en archivo
     */
  async flushEventLogs() {
    if (this.eventLog.length === 0) return;
        
    try {
      const logsToWrite = [...this.eventLog];
      this.eventLog = [];
            
      const logContent = logsToWrite.map(log => JSON.stringify(log)).join('\n') + '\n';
      await fs.appendFile(this.logFilePath, logContent);
            
    } catch (error) {
      this.logger.error('❌ Error escribiendo logs de eventos:', error);
    }
  }

  /**
     * Asegurar que existe el directorio de logs
     */
  async ensureLogDirectory() {
    try {
      const logDir = path.dirname(this.logFilePath);
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      this.logger.error('❌ Error creando directorio de logs:', error);
    }
  }

  /**
     * Utilidades
     */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCorrelationId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createTimeout(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Cancelar reintento programado
     */
  cancelRetry(eventId) {
    // Buscar el evento en la cola de reintentos
    const eventIndex = this.retryQueue.findIndex(event => event.id === eventId);
        
    if (eventIndex !== -1) {
      const eventData = this.retryQueue[eventIndex];
            
      // Cancelar el timeout si existe
      if (eventData.retryTimeoutId) {
        clearTimeout(eventData.retryTimeoutId);
        delete eventData.retryTimeoutId;
      }
            
      // Marcar como cancelado
      eventData.retryScheduled = false;
            
      // Remover de la cola
      this.retryQueue.splice(eventIndex, 1);
            
      this.logger.info(`🚫 Reintento cancelado para evento ${eventData.name}`, {
        eventId,
        correlationId: eventData.correlationId
      });
            
      this.logEvent('retry_cancelled', eventData);
      return true;
    }
        
    return false;
  }

  /**
     * Obtener eventos pendientes de reintento
     */
  getPendingRetries() {
    return this.retryQueue.map(event => ({
      id: event.id,
      name: event.name,
      attempts: event.attempts,
      maxRetries: event.maxRetries,
      nextRetryAt: event.nextRetryAt,
      correlationId: event.correlationId
    }));
  }

  /**
     * Limpiar eventos fallidos permanentemente
     */
  clearFailedEvents() {
    const failedCount = this.retryQueue.length;
        
    // Cancelar todos los timeouts pendientes
    this.retryQueue.forEach(event => {
      if (event.retryTimeoutId) {
        clearTimeout(event.retryTimeoutId);
      }
    });
        
    // Limpiar la cola
    this.retryQueue = [];
        
    this.logger.info(`🧹 Limpiados ${failedCount} eventos fallidos`);
    return failedCount;
  }

  /**
     * Obtener métricas de salud del sistema
     */
  getHealthMetrics() {
    const now = Date.now();
    const stats = this.getStats();
        
    const totalQueueSize = this.priorityQueues.high.length + 
                              this.priorityQueues.medium.length + 
                              this.priorityQueues.low.length;
        
    return {
      status: this.isProcessing ? 'healthy' : 'stopped',
      queueSize: totalQueueSize,
      retryQueueSize: this.retryQueue.length,
      priorityQueues: {
        high: this.priorityQueues.high.length,
        medium: this.priorityQueues.medium.length,
        low: this.priorityQueues.low.length
      },
      totalEvents: Object.values(stats).reduce((sum, stat) => sum + (stat.emitted || 0), 0),
      totalProcessed: Object.values(stats).reduce((sum, stat) => sum + (stat.processed || 0), 0),
      totalFailed: Object.values(stats).reduce((sum, stat) => sum + (stat.failed || 0), 0),
      totalRetries: Object.values(stats).reduce((sum, stat) => sum + (stat.retries || 0), 0),
      uptime: now - this.startTime,
      memoryUsage: {
        eventLog: this.eventLog.length,
        listeners: this.listeners.size,
        eventStats: this.eventStats.size
      }
    };
  }

  /**
     * Detener el EventBus
     */
  async stop() {
    this.logger.info('🛑 Deteniendo EventBus...');
        
    this.isProcessing = false;
        
    // Limpiar timer de logging para evitar memory leaks
    if (this.loggingTimer) {
      clearInterval(this.loggingTimer);
      this.loggingTimer = null;
    }
        
    // Cancelar todos los reintentos pendientes
    this.clearFailedEvents();
        
    // Guardar logs pendientes
    await this.flushEventLogs();
        
    // Remover todos los listeners
    this.removeAllListeners();
    this.listeners.clear();
        
    this.logger.info('✅ EventBus detenido');
  }
}

// Crear instancia singleton
export default EventBus;
export { EventBus };
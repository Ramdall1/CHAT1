import EventTypes from './EventTypes.js';
import { createLogger } from './logger.js';

/**
 * Clase base para todos los agentes especializados
 * Define la interfaz común y funcionalidades básicas
 */
class BaseAgent {
  constructor(name, eventBus, config = {}) {
    this.name = name;
    this.eventBus = eventBus;
    this.isActive = false;
    this.listeners = new Map();
    this.logger = createLogger(`BASE_AGENT_${name.toUpperCase()}`);
        
    this.config = {
      priority: 'medium',
      maxConcurrentTasks: 5,
      retryAttempts: 3,
      timeout: 30000,
      ...config
    };
        
    this.stats = {
      eventsProcessed: 0,
      eventsEmitted: 0,
      errors: 0,
      averageProcessingTime: 0,
      lastActivity: null,
      startTime: null
    };
        
    this.currentTasks = new Set();
    this.taskQueue = [];
    this.processingTimes = [];
  }

  /**
     * Inicia el agente
     */
  async start() {
    if (this.isActive) return;
        
    this.isActive = true;
    this.stats.startTime = new Date().toISOString();
        
    logger.info(`🤖 ${this.name}: Agente iniciado`);
        
    // Registrar listeners de eventos
    await this.registerEventListeners();
        
    // Emitir evento de inicio
    this.emit(EventTypes.SYSTEM.AGENT_STARTED, {
      agentName: this.name,
      config: this.config,
      timestamp: new Date().toISOString()
    });
        
    // Inicialización específica del agente
    await this.onStart();
  }

  /**
     * Detiene el agente
     */
  async stop() {
    if (!this.isActive) return;
        
    this.isActive = false;
        
    // Esperar a que terminen las tareas actuales
    await this.waitForCurrentTasks();
        
    // Desregistrar listeners
    this.unregisterEventListeners();
        
    logger.info(`🤖 ${this.name}: Agente detenido`);
        
    // Emitir evento de parada
    this.emit(EventTypes.SYSTEM.AGENT_STOPPED, {
      agentName: this.name,
      finalStats: this.stats,
      timestamp: new Date().toISOString()
    });
        
    // Limpieza específica del agente
    await this.onStop();
  }

  /**
     * Registra un listener para un tipo de evento
     */
  on(eventType, handler, options = {}) {
    if (!this.isActive) {
      logger.warn(`⚠️ ${this.name}: Intentando registrar listener mientras el agente está inactivo`);
      return;
    }
        
    const wrappedHandler = async(data) => {
      if (!this.isActive) return;
            
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();
            
      try {
        // Verificar límite de tareas concurrentes
        if (this.currentTasks.size >= this.config.maxConcurrentTasks) {
          this.taskQueue.push({ taskId, eventType, data, handler, startTime });
          return;
        }
                
        this.currentTasks.add(taskId);
                
        // Procesar el evento
        await this.processEvent(taskId, eventType, data, handler, startTime);
                
      } catch (error) {
        this.handleError(error, eventType, data);
      } finally {
        this.currentTasks.delete(taskId);
        this.processTaskQueue();
      }
    };
        
    this.eventBus.on(eventType, wrappedHandler);
    this.listeners.set(eventType, wrappedHandler);
        
    logger.info(`🎯 ${this.name}: Registrado listener para '${eventType}'`);
  }

  /**
     * Procesa un evento
     */
  async processEvent(taskId, eventType, data, handler, startTime) {
    logger.info(`🔄 ${this.name}: Procesando evento '${eventType}' [${taskId}]`);
        
    // Aplicar timeout si está configurado
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Event processing timeout')), this.config.timeout);
    });
        
    try {
      // Ejecutar el handler con timeout
      await Promise.race([
        handler(data),
        timeoutPromise
      ]);
            
      // Actualizar estadísticas
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime);
            
      logger.info(`✅ ${this.name}: Evento '${eventType}' procesado en ${processingTime}ms [${taskId}]`);
            
      // Emitir evento de tarea completada
      this.emit(EventTypes.SYSTEM.AGENT_TASK_COMPLETED, {
        agentName: this.name,
        taskId,
        eventType,
        processingTime,
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`❌ ${this.name}: Error procesando evento '${eventType}' [${taskId}]:`, error.message);
            
      this.stats.errors++;
            
      // Emitir evento de error
      this.emit(EventTypes.SYSTEM.AGENT_ERROR, {
        agentName: this.name,
        taskId,
        eventType,
        error: error.message,
        processingTime,
        timestamp: new Date().toISOString()
      });
            
      throw error;
    }
  }

  /**
     * Procesa la cola de tareas pendientes
     */
  processTaskQueue() {
    while (this.taskQueue.length > 0 && this.currentTasks.size < this.config.maxConcurrentTasks) {
      const task = this.taskQueue.shift();
            
      this.currentTasks.add(task.taskId);
            
      // Procesar la tarea de forma asíncrona
      this.processEvent(task.taskId, task.eventType, task.data, task.handler, task.startTime)
        .catch(error => this.handleError(error, task.eventType, task.data))
        .finally(() => {
          this.currentTasks.delete(task.taskId);
          this.processTaskQueue();
        });
    }
  }

  /**
     * Emite un evento
     */
  emit(eventType, data) {
    if (!this.isActive) return;
        
    this.stats.eventsEmitted++;
    this.stats.lastActivity = new Date().toISOString();
        
    this.eventBus.emit(eventType, {
      ...data,
      emittedBy: this.name
    });
  }

  /**
     * Actualiza estadísticas del agente
     */
  updateStats(processingTime) {
    this.stats.eventsProcessed++;
    this.stats.lastActivity = new Date().toISOString();
        
    // Mantener historial de tiempos de procesamiento (últimos 100)
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
        
    // Calcular tiempo promedio
    this.stats.averageProcessingTime = Math.round(
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
    );
  }

  /**
     * Maneja errores del agente
     */
  handleError(error, eventType, data) {
    this.logger.error(`❌ ${this.name}: Error en agente:`, error.message);
        
    this.stats.errors++;
        
    // Emitir evento de error del agente
    this.emit(EventTypes.SYSTEM.AGENT_ERROR, {
      agentName: this.name,
      error: error.message,
      eventType,
      data: this.sanitizeData(data),
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Sanitiza datos sensibles
     */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;
        
    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
        
    return sanitized;
  }

  /**
     * Espera a que terminen las tareas actuales
     */
  async waitForCurrentTasks(timeout = 30000) {
    const startTime = Date.now();
        
    while (this.currentTasks.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
        
    if (this.currentTasks.size > 0) {
      logger.warn(`⚠️ ${this.name}: Timeout esperando tareas actuales. ${this.currentTasks.size} tareas aún activas.`);
    }
  }

  /**
     * Desregistra todos los listeners
     */
  unregisterEventListeners() {
    for (const [eventType, handler] of this.listeners) {
      this.eventBus.removeListener(eventType, handler);
    }
    this.listeners.clear();
  }

  /**
     * Obtiene estadísticas del agente
     */
  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      currentTasks: this.currentTasks.size,
      queuedTasks: this.taskQueue.length,
      registeredListeners: this.listeners.size,
      uptime: this.stats.startTime ? Date.now() - new Date(this.stats.startTime).getTime() : 0
    };
  }

  /**
     * Obtiene información del agente
     */
  getInfo() {
    return {
      name: this.name,
      type: this.constructor.name,
      config: this.config,
      stats: this.getStats(),
      isActive: this.isActive
    };
  }

  /**
     * Verifica si el agente está saludable
     */
  isHealthy() {
    const errorRate = this.stats.eventsProcessed > 0 ? 
      (this.stats.errors / this.stats.eventsProcessed) * 100 : 0;
        
    return {
      healthy: errorRate < 10 && this.currentTasks.size < this.config.maxConcurrentTasks,
      errorRate,
      currentLoad: (this.currentTasks.size / this.config.maxConcurrentTasks) * 100,
      lastActivity: this.stats.lastActivity
    };
  }

  // Métodos abstractos que deben ser implementados por las subclases

  /**
     * Registra los listeners específicos del agente
     * Debe ser implementado por cada agente especializado
     */
  async registerEventListeners() {
    throw new Error(`${this.name}: registerEventListeners() debe ser implementado por la subclase`);
  }

  /**
     * Inicialización específica del agente
     * Puede ser sobrescrito por las subclases
     */
  async onStart() {
    // Implementación por defecto vacía
  }

  /**
     * Limpieza específica del agente
     * Puede ser sobrescrito por las subclases
     */
  async onStop() {
    // Implementación por defecto vacía
  }
}

export default BaseAgent;
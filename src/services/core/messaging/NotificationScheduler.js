import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { createLogger } from '../core/logger.js';

/**
 * Programador de notificaciones
 * Maneja envíos diferidos, recurrentes y basados en eventos
 */
class NotificationScheduler extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración general
      enabled: true,
      timezone: 'America/Mexico_City',
      maxScheduledJobs: 10000,
      cleanupInterval: 3600000, // 1 hora
            
      // Configuración de persistencia
      persistence: {
        enabled: false,
        type: 'memory', // memory, file, database
        file: './scheduled_notifications.json',
        autoSave: true,
        saveInterval: 300000 // 5 minutos
      },
            
      // Configuración de ejecución
      execution: {
        maxConcurrent: 10,
        retryAttempts: 3,
        retryDelay: 5000,
        timeout: 30000
      },
            
      // Configuración de cron
      cron: {
        enabled: true,
        precision: 'second', // second, minute
        maxJobs: 1000
      },
            
      // Configuración de triggers
      triggers: {
        enabled: true,
        maxTriggers: 500,
        debounce: 1000
      },
            
      // Configuración de batching
      batching: {
        enabled: true,
        maxBatchSize: 100,
        batchWindow: 5000,
        groupBy: ['type', 'channel']
      },
            
      // Configuración de rate limiting
      rateLimit: {
        enabled: true,
        maxPerSecond: 10,
        maxPerMinute: 100,
        maxPerHour: 1000
      },
            
      ...config
    };
        
    this.state = 'initialized';
        
    // Jobs programados
    this.scheduledJobs = new Map();
        
    // Jobs recurrentes (cron)
    this.cronJobs = new Map();
        
    // Triggers de eventos
    this.eventTriggers = new Map();
        
    // Cola de ejecución
    this.executionQueue = [];
        
    // Jobs en ejecución
    this.runningJobs = new Set();
        
    // Historial de ejecuciones
    this.executionHistory = new Map();
        
    // Timers activos
    this.activeTimers = new Map();
        
    // Intervalos activos
    this.activeIntervals = new Map();
        
    // Rate limiters
    this.rateLimiters = {
      second: { count: 0, resetTime: 0 },
      minute: { count: 0, resetTime: 0 },
      hour: { count: 0, resetTime: 0 }
    };
        
    // Estadísticas del programador
    this.schedulerStats = {
      startTime: Date.now(),
      jobsScheduled: 0,
      jobsExecuted: 0,
      jobsFailed: 0,
      jobsCancelled: 0,
      averageExecutionTime: 0,
      errors: 0,
      lastExecution: null
    };
        
    // Timer de limpieza
    this.cleanupTimer = null;
        
    // Timer de guardado
    this.saveTimer = null;
        
    // Logger
    this.logger = createLogger('NOTIFICATION_SCHEDULER');
  }
    
  /**
     * Inicializa el programador
     */
  async initialize() {
    try {
      this._validateConfig();
      this._setupEventHandlers();
            
      // Cargar jobs persistidos
      if (this.config.persistence.enabled) {
        await this._loadPersistedJobs();
      }
            
      // Inicializar timers de sistema
      this._initializeSystemTimers();
            
      // Inicializar rate limiters
      this._initializeRateLimiters();
            
      this.state = 'ready';
      this.emit('initialized');
            
      return true;
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Programa una notificación para una fecha específica
     */
  scheduleAt(notification, executeAt, options = {}) {
    const jobId = options.id || `job_${Date.now()}_${Math.random()}`;
        
    // Validar fecha de ejecución
    const executeTime = new Date(executeAt).getTime();
    const now = Date.now();
        
    if (executeTime <= now) {
      throw new Error('Execution time must be in the future');
    }
        
    // Crear job
    const job = {
      id: jobId,
      type: 'scheduled',
      notification,
      executeAt: executeTime,
      createdAt: now,
      attempts: 0,
      maxAttempts: options.maxAttempts || this.config.execution.retryAttempts,
      timeout: options.timeout || this.config.execution.timeout,
      priority: options.priority || 'normal',
      metadata: options.metadata || {}
    };
        
    // Verificar límites
    if (this.scheduledJobs.size >= this.config.maxScheduledJobs) {
      throw new Error('Maximum scheduled jobs limit reached');
    }
        
    // Programar ejecución
    const delay = executeTime - now;
    const timer = setTimeout(() => {
      this._executeJob(job);
    }, delay);
        
    // Guardar job y timer
    this.scheduledJobs.set(jobId, job);
    this.activeTimers.set(jobId, timer);
        
    // Persistir si está habilitado
    if (this.config.persistence.enabled && this.config.persistence.autoSave) {
      this._saveJobs();
    }
        
    this.schedulerStats.jobsScheduled++;
        
    this.emit('jobScheduled', {
      jobId,
      type: 'scheduled',
      executeAt: executeTime,
      delay
    });
        
    return jobId;
  }
    
  /**
     * Programa una notificación con delay relativo
     */
  scheduleIn(notification, delay, options = {}) {
    const executeAt = Date.now() + this._parseDelay(delay);
    return this.scheduleAt(notification, executeAt, options);
  }
    
  /**
     * Programa una notificación recurrente con cron
     */
  scheduleCron(notification, cronExpression, options = {}) {
    if (!this.config.cron.enabled) {
      throw new Error('Cron scheduling is disabled');
    }
        
    const jobId = options.id || `cron_${Date.now()}_${Math.random()}`;
        
    // Validar expresión cron
    const cronSchedule = this._parseCronExpression(cronExpression);
        
    // Crear job cron
    const cronJob = {
      id: jobId,
      type: 'cron',
      notification,
      cronExpression,
      cronSchedule,
      createdAt: Date.now(),
      lastExecution: null,
      nextExecution: this._getNextCronExecution(cronSchedule),
      executions: 0,
      maxExecutions: options.maxExecutions || Infinity,
      enabled: true,
      metadata: options.metadata || {}
    };
        
    // Verificar límites
    if (this.cronJobs.size >= this.config.cron.maxJobs) {
      throw new Error('Maximum cron jobs limit reached');
    }
        
    // Programar primera ejecución
    this._scheduleCronExecution(cronJob);
        
    // Guardar job
    this.cronJobs.set(jobId, cronJob);
        
    // Persistir si está habilitado
    if (this.config.persistence.enabled && this.config.persistence.autoSave) {
      this._saveJobs();
    }
        
    this.emit('cronJobScheduled', {
      jobId,
      cronExpression,
      nextExecution: cronJob.nextExecution
    });
        
    return jobId;
  }
    
  /**
     * Programa una notificación basada en eventos
     */
  scheduleOnEvent(notification, eventName, condition, options = {}) {
    if (!this.config.triggers.enabled) {
      throw new Error('Event triggers are disabled');
    }
        
    const triggerId = options.id || `trigger_${Date.now()}_${Math.random()}`;
        
    // Crear trigger
    const trigger = {
      id: triggerId,
      type: 'event',
      notification,
      eventName,
      condition: this._compileCondition(condition),
      createdAt: Date.now(),
      triggered: 0,
      maxTriggers: options.maxTriggers || Infinity,
      enabled: true,
      debounce: options.debounce || this.config.triggers.debounce,
      lastTriggered: null,
      metadata: options.metadata || {}
    };
        
    // Verificar límites
    if (this.eventTriggers.size >= this.config.triggers.maxTriggers) {
      throw new Error('Maximum event triggers limit reached');
    }
        
    // Guardar trigger
    this.eventTriggers.set(triggerId, trigger);
        
    // Persistir si está habilitado
    if (this.config.persistence.enabled && this.config.persistence.autoSave) {
      this._saveJobs();
    }
        
    this.emit('eventTriggerScheduled', {
      triggerId,
      eventName,
      condition
    });
        
    return triggerId;
  }
    
  /**
     * Programa un lote de notificaciones
     */
  scheduleBatch(notifications, schedule, options = {}) {
    const batchId = options.id || `batch_${Date.now()}_${Math.random()}`;
    const jobs = [];
        
    for (let i = 0; i < notifications.length; i++) {
      const notification = notifications[i];
      let executeAt;
            
      if (typeof schedule === 'function') {
        executeAt = schedule(i, notification);
      } else if (Array.isArray(schedule)) {
        executeAt = schedule[i] || schedule[schedule.length - 1];
      } else {
        executeAt = new Date(schedule).getTime() + (i * 1000); // 1 segundo entre cada una
      }
            
      const jobId = this.scheduleAt(notification, executeAt, {
        ...options,
        id: `${batchId}_${i}`,
        batchId
      });
            
      jobs.push(jobId);
    }
        
    this.emit('batchScheduled', {
      batchId,
      jobCount: jobs.length,
      jobs
    });
        
    return { batchId, jobs };
  }
    
  /**
     * Cancela un job programado
     */
  cancelJob(jobId) {
    let cancelled = false;
        
    // Cancelar job programado
    if (this.scheduledJobs.has(jobId)) {
      const timer = this.activeTimers.get(jobId);
      if (timer) {
        clearTimeout(timer);
        this.activeTimers.delete(jobId);
      }
            
      this.scheduledJobs.delete(jobId);
      cancelled = true;
    }
        
    // Cancelar job cron
    if (this.cronJobs.has(jobId)) {
      const cronJob = this.cronJobs.get(jobId);
      cronJob.enabled = false;
            
      const timer = this.activeTimers.get(jobId);
      if (timer) {
        clearTimeout(timer);
        this.activeTimers.delete(jobId);
      }
            
      this.cronJobs.delete(jobId);
      cancelled = true;
    }
        
    // Cancelar trigger de evento
    if (this.eventTriggers.has(jobId)) {
      this.eventTriggers.delete(jobId);
      cancelled = true;
    }
        
    if (cancelled) {
      this.schedulerStats.jobsCancelled++;
            
      // Persistir si está habilitado
      if (this.config.persistence.enabled && this.config.persistence.autoSave) {
        this._saveJobs();
      }
            
      this.emit('jobCancelled', { jobId });
    }
        
    return cancelled;
  }
    
  /**
     * Cancela múltiples jobs
     */
  cancelJobs(jobIds) {
    const results = {};
        
    for (const jobId of jobIds) {
      results[jobId] = this.cancelJob(jobId);
    }
        
    return results;
  }
    
  /**
     * Pausa un job cron
     */
  pauseCronJob(jobId) {
    const cronJob = this.cronJobs.get(jobId);
        
    if (cronJob) {
      cronJob.enabled = false;
            
      const timer = this.activeTimers.get(jobId);
      if (timer) {
        clearTimeout(timer);
        this.activeTimers.delete(jobId);
      }
            
      this.emit('cronJobPaused', { jobId });
      return true;
    }
        
    return false;
  }
    
  /**
     * Reanuda un job cron
     */
  resumeCronJob(jobId) {
    const cronJob = this.cronJobs.get(jobId);
        
    if (cronJob) {
      cronJob.enabled = true;
      cronJob.nextExecution = this._getNextCronExecution(cronJob.cronSchedule);
            
      this._scheduleCronExecution(cronJob);
            
      this.emit('cronJobResumed', { jobId });
      return true;
    }
        
    return false;
  }
    
  /**
     * Dispara un evento para triggers
     */
  triggerEvent(eventName, eventData = {}) {
    const triggeredJobs = [];
        
    for (const [triggerId, trigger] of this.eventTriggers.entries()) {
      if (trigger.eventName === eventName && trigger.enabled) {
        // Verificar debounce
        const now = Date.now();
        if (trigger.lastTriggered && (now - trigger.lastTriggered) < trigger.debounce) {
          continue;
        }
                
        // Evaluar condición
        if (this._evaluateCondition(trigger.condition, eventData)) {
          // Verificar límite de triggers
          if (trigger.triggered >= trigger.maxTriggers) {
            this.eventTriggers.delete(triggerId);
            continue;
          }
                    
          // Crear job de ejecución inmediata
          const job = {
            id: `trigger_exec_${Date.now()}_${Math.random()}`,
            type: 'triggered',
            notification: {
              ...trigger.notification,
              eventData
            },
            triggerId,
            eventName,
            eventData,
            executeAt: now,
            createdAt: now,
            attempts: 0,
            maxAttempts: this.config.execution.retryAttempts
          };
                    
          // Ejecutar inmediatamente
          this._executeJob(job);
                    
          // Actualizar trigger
          trigger.triggered++;
          trigger.lastTriggered = now;
                    
          triggeredJobs.push({
            triggerId,
            jobId: job.id
          });
        }
      }
    }
        
    this.emit('eventTriggered', {
      eventName,
      eventData,
      triggeredJobs: triggeredJobs.length,
      jobs: triggeredJobs
    });
        
    return triggeredJobs;
  }
    
  /**
     * Lista todos los jobs programados
     */
  listJobs(filters = {}) {
    const jobs = [];
        
    // Jobs programados
    for (const [jobId, job] of this.scheduledJobs.entries()) {
      if (this._matchesFilter(job, filters)) {
        jobs.push({
          id: jobId,
          type: 'scheduled',
          executeAt: job.executeAt,
          createdAt: job.createdAt,
          attempts: job.attempts,
          status: 'pending'
        });
      }
    }
        
    // Jobs cron
    for (const [jobId, cronJob] of this.cronJobs.entries()) {
      if (this._matchesFilter(cronJob, filters)) {
        jobs.push({
          id: jobId,
          type: 'cron',
          cronExpression: cronJob.cronExpression,
          nextExecution: cronJob.nextExecution,
          lastExecution: cronJob.lastExecution,
          executions: cronJob.executions,
          enabled: cronJob.enabled,
          status: cronJob.enabled ? 'active' : 'paused'
        });
      }
    }
        
    // Triggers de eventos
    for (const [triggerId, trigger] of this.eventTriggers.entries()) {
      if (this._matchesFilter(trigger, filters)) {
        jobs.push({
          id: triggerId,
          type: 'trigger',
          eventName: trigger.eventName,
          triggered: trigger.triggered,
          maxTriggers: trigger.maxTriggers,
          enabled: trigger.enabled,
          status: trigger.enabled ? 'active' : 'disabled'
        });
      }
    }
        
    return jobs;
  }
    
  /**
     * Obtiene información de un job específico
     */
  getJob(jobId) {
    // Buscar en jobs programados
    if (this.scheduledJobs.has(jobId)) {
      const job = this.scheduledJobs.get(jobId);
      return {
        ...job,
        type: 'scheduled',
        status: 'pending'
      };
    }
        
    // Buscar en jobs cron
    if (this.cronJobs.has(jobId)) {
      const cronJob = this.cronJobs.get(jobId);
      return {
        ...cronJob,
        type: 'cron',
        status: cronJob.enabled ? 'active' : 'paused'
      };
    }
        
    // Buscar en triggers
    if (this.eventTriggers.has(jobId)) {
      const trigger = this.eventTriggers.get(jobId);
      return {
        ...trigger,
        type: 'trigger',
        status: trigger.enabled ? 'active' : 'disabled'
      };
    }
        
    return null;
  }
    
  /**
     * Obtiene el historial de ejecuciones
     */
  getExecutionHistory(filters = {}) {
    let history = Array.from(this.executionHistory.values());
        
    // Aplicar filtros
    if (filters.jobId) {
      history = history.filter(h => h.jobId === filters.jobId);
    }
        
    if (filters.type) {
      history = history.filter(h => h.type === filters.type);
    }
        
    if (filters.status) {
      history = history.filter(h => h.status === filters.status);
    }
        
    if (filters.since) {
      const since = new Date(filters.since).getTime();
      history = history.filter(h => h.executedAt >= since);
    }
        
    // Ordenar por fecha (más recientes primero)
    history.sort((a, b) => b.executedAt - a.executedAt);
        
    // Limitar resultados
    const limit = filters.limit || 100;
    return history.slice(0, limit);
  }
    
  /**
     * Obtiene estadísticas del programador
     */
  getStatistics() {
    return {
      scheduler: this.schedulerStats,
      jobs: {
        scheduled: this.scheduledJobs.size,
        cron: this.cronJobs.size,
        triggers: this.eventTriggers.size,
        running: this.runningJobs.size,
        queued: this.executionQueue.length
      },
      performance: {
        uptime: Date.now() - this.schedulerStats.startTime,
        state: this.state,
        errors: this.schedulerStats.errors,
        averageExecutionTime: this.schedulerStats.averageExecutionTime,
        successRate: this._calculateSuccessRate()
      },
      rateLimit: {
        current: {
          perSecond: this.rateLimiters.second.count,
          perMinute: this.rateLimiters.minute.count,
          perHour: this.rateLimiters.hour.count
        },
        limits: {
          perSecond: this.config.rateLimit.maxPerSecond,
          perMinute: this.config.rateLimit.maxPerMinute,
          perHour: this.config.rateLimit.maxPerHour
        }
      }
    };
  }
    
  /**
     * Destruye el programador
     */
  destroy() {
    // Cancelar todos los timers
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
        
    // Cancelar todos los intervalos
    for (const interval of this.activeIntervals.values()) {
      clearInterval(interval);
    }
    this.activeIntervals.clear();
        
    // Cancelar timer de limpieza
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    // Cancelar timer de guardado
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
        
    // Limpiar datos
    this.scheduledJobs.clear();
    this.cronJobs.clear();
    this.eventTriggers.clear();
    this.executionQueue = [];
    this.runningJobs.clear();
    this.executionHistory.clear();
        
    this.state = 'destroyed';
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  async _executeJob(job) {
    const startTime = Date.now();
        
    try {
      // Verificar rate limit
      if (!this._checkRateLimit()) {
        // Retrasar ejecución
        setTimeout(() => this._executeJob(job), 1000);
        return;
      }
            
      // Verificar límite de concurrencia
      if (this.runningJobs.size >= this.config.execution.maxConcurrent) {
        this.executionQueue.push(job);
        return;
      }
            
      // Marcar como en ejecución
      this.runningJobs.add(job.id);
            
      // Actualizar rate limiters
      this._updateRateLimiters();
            
      // Emitir evento de inicio
      this.emit('jobStarted', {
        jobId: job.id,
        type: job.type,
        attempts: job.attempts
      });
            
      // Ejecutar con timeout
      const result = await this._executeWithTimeout(job);
            
      // Marcar como completado
      this.runningJobs.delete(job.id);
            
      // Actualizar estadísticas
      const executionTime = Date.now() - startTime;
      this.schedulerStats.jobsExecuted++;
      this.schedulerStats.averageExecutionTime = 
                (this.schedulerStats.averageExecutionTime + executionTime) / 2;
      this.schedulerStats.lastExecution = Date.now();
            
      // Guardar en historial
      this._saveExecutionHistory(job, 'success', executionTime, result);
            
      // Limpiar job programado
      if (job.type === 'scheduled') {
        this.scheduledJobs.delete(job.id);
        this.activeTimers.delete(job.id);
      }
            
      // Reprogramar job cron
      if (job.type === 'cron') {
        this._rescheduleCronJob(job.cronJobId);
      }
            
      // Procesar cola
      this._processExecutionQueue();
            
      this.emit('jobCompleted', {
        jobId: job.id,
        type: job.type,
        executionTime,
        result
      });
            
    } catch (error) {
      this.runningJobs.delete(job.id);
            
      // Incrementar intentos
      job.attempts++;
            
      // Verificar si debe reintentar
      if (job.attempts < job.maxAttempts) {
        // Programar reintento
        const retryDelay = this.config.execution.retryDelay * job.attempts;
        setTimeout(() => this._executeJob(job), retryDelay);
                
        this.emit('jobRetry', {
          jobId: job.id,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          retryDelay,
          error: error.message
        });
      } else {
        // Marcar como fallido
        this.schedulerStats.jobsFailed++;
        this.schedulerStats.errors++;
                
        // Guardar en historial
        const executionTime = Date.now() - startTime;
        this._saveExecutionHistory(job, 'failed', executionTime, null, error);
                
        // Limpiar job
        if (job.type === 'scheduled') {
          this.scheduledJobs.delete(job.id);
          this.activeTimers.delete(job.id);
        }
                
        this.emit('jobFailed', {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
          error: error.message
        });
      }
            
      // Procesar cola
      this._processExecutionQueue();
    }
  }
    
  async _executeWithTimeout(job) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Job execution timeout'));
      }, job.timeout);
            
      // Simular ejecución de notificación
      this._executeNotification(job.notification)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
    
  async _executeNotification(notification) {
    // Simular envío de notificación
    // En una implementación real, esto llamaría al NotificationManager
    logger.info(`Executing notification: ${notification.type || 'unknown'} to ${notification.recipient}`);
        
    return {
      success: true,
      messageId: `exec_${Date.now()}`,
      executedAt: Date.now()
    };
  }
    
  _processExecutionQueue() {
    while (this.executionQueue.length > 0 && 
               this.runningJobs.size < this.config.execution.maxConcurrent) {
      const job = this.executionQueue.shift();
      this._executeJob(job);
    }
  }
    
  _scheduleCronExecution(cronJob) {
    if (!cronJob.enabled || cronJob.executions >= cronJob.maxExecutions) {
      return;
    }
        
    const now = Date.now();
    const delay = cronJob.nextExecution - now;
        
    if (delay <= 0) {
      // Ejecutar inmediatamente y calcular siguiente
      this._executeCronJob(cronJob);
    } else {
      // Programar ejecución
      const timer = setTimeout(() => {
        this._executeCronJob(cronJob);
      }, delay);
            
      this.activeTimers.set(cronJob.id, timer);
    }
  }
    
  _executeCronJob(cronJob) {
    // Crear job de ejecución
    const job = {
      id: `cron_exec_${Date.now()}_${Math.random()}`,
      type: 'cron',
      cronJobId: cronJob.id,
      notification: cronJob.notification,
      executeAt: Date.now(),
      createdAt: cronJob.createdAt,
      attempts: 0,
      maxAttempts: this.config.execution.retryAttempts
    };
        
    // Ejecutar job
    this._executeJob(job);
        
    // Actualizar cronJob
    cronJob.lastExecution = Date.now();
    cronJob.executions++;
    cronJob.nextExecution = this._getNextCronExecution(cronJob.cronSchedule);
        
    // Programar siguiente ejecución
    this._scheduleCronExecution(cronJob);
  }
    
  _rescheduleCronJob(cronJobId) {
    const cronJob = this.cronJobs.get(cronJobId);
    if (cronJob) {
      this._scheduleCronExecution(cronJob);
    }
  }
    
  _parseCronExpression(expression) {
    // Implementación simplificada de parsing de cron
    // Formato: segundo minuto hora día mes día_semana
    const parts = expression.trim().split(/\s+/);
        
    if (parts.length !== 6) {
      throw new Error('Invalid cron expression format');
    }
        
    return {
      second: this._parseCronField(parts[0], 0, 59),
      minute: this._parseCronField(parts[1], 0, 59),
      hour: this._parseCronField(parts[2], 0, 23),
      day: this._parseCronField(parts[3], 1, 31),
      month: this._parseCronField(parts[4], 1, 12),
      dayOfWeek: this._parseCronField(parts[5], 0, 6)
    };
  }
    
  _parseCronField(field, min, max) {
    if (field === '*') {
      return { type: 'any' };
    }
        
    if (field.includes('/')) {
      const [range, step] = field.split('/');
      return {
        type: 'step',
        step: parseInt(step),
        range: range === '*' ? [min, max] : this._parseRange(range, min, max)
      };
    }
        
    if (field.includes('-')) {
      return {
        type: 'range',
        range: this._parseRange(field, min, max)
      };
    }
        
    if (field.includes(',')) {
      return {
        type: 'list',
        values: field.split(',').map(v => parseInt(v))
      };
    }
        
    return {
      type: 'value',
      value: parseInt(field)
    };
  }
    
  _parseRange(range, min, max) {
    const [start, end] = range.split('-').map(v => parseInt(v));
    return [Math.max(start, min), Math.min(end, max)];
  }
    
  _getNextCronExecution(cronSchedule) {
    const now = new Date();
    const next = new Date(now);
        
    // Implementación simplificada
    // En una implementación real, usaríamos una librería como node-cron
        
    // Avanzar al siguiente minuto
    next.setSeconds(0);
    next.setMilliseconds(0);
    next.setMinutes(next.getMinutes() + 1);
        
    return next.getTime();
  }
    
  _compileCondition(condition) {
    if (typeof condition === 'function') {
      return condition;
    }
        
    if (typeof condition === 'string') {
      // Compilar expresión simple
      return new Function('data', `return ${condition}`);
    }
        
    if (typeof condition === 'object') {
      // Condición estructurada
      return (data) => {
        for (const [key, value] of Object.entries(condition)) {
          if (data[key] !== value) {
            return false;
          }
        }
        return true;
      };
    }
        
    return () => true;
  }
    
  _evaluateCondition(condition, data) {
    try {
      return condition(data);
    } catch (error) {
      return false;
    }
  }
    
  _parseDelay(delay) {
    if (typeof delay === 'number') {
      return delay;
    }
        
    if (typeof delay === 'string') {
      const units = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
      };
            
      const match = delay.match(/^(\d+)([smhd])$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        return value * units[unit];
      }
    }
        
    throw new Error('Invalid delay format');
  }
    
  _checkRateLimit() {
    const now = Date.now();
        
    // Verificar límite por segundo
    if (this.rateLimiters.second.resetTime <= now) {
      this.rateLimiters.second.count = 0;
      this.rateLimiters.second.resetTime = now + 1000;
    }
        
    if (this.rateLimiters.second.count >= this.config.rateLimit.maxPerSecond) {
      return false;
    }
        
    // Verificar límite por minuto
    if (this.rateLimiters.minute.resetTime <= now) {
      this.rateLimiters.minute.count = 0;
      this.rateLimiters.minute.resetTime = now + 60000;
    }
        
    if (this.rateLimiters.minute.count >= this.config.rateLimit.maxPerMinute) {
      return false;
    }
        
    // Verificar límite por hora
    if (this.rateLimiters.hour.resetTime <= now) {
      this.rateLimiters.hour.count = 0;
      this.rateLimiters.hour.resetTime = now + 3600000;
    }
        
    if (this.rateLimiters.hour.count >= this.config.rateLimit.maxPerHour) {
      return false;
    }
        
    return true;
  }
    
  _updateRateLimiters() {
    this.rateLimiters.second.count++;
    this.rateLimiters.minute.count++;
    this.rateLimiters.hour.count++;
  }
    
  _initializeRateLimiters() {
    const now = Date.now();
        
    this.rateLimiters.second.resetTime = now + 1000;
    this.rateLimiters.minute.resetTime = now + 60000;
    this.rateLimiters.hour.resetTime = now + 3600000;
  }
    
  _initializeSystemTimers() {
    // Timer de limpieza
    this.cleanupTimer = setInterval(() => {
      this._cleanupExpiredJobs();
    }, this.config.cleanupInterval);
        
    // Timer de guardado
    if (this.config.persistence.enabled && this.config.persistence.autoSave) {
      this.saveTimer = setInterval(() => {
        this._saveJobs();
      }, this.config.persistence.saveInterval);
    }
  }
    
  _cleanupExpiredJobs() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
        
    // Limpiar historial antiguo
    for (const [id, execution] of this.executionHistory.entries()) {
      if ((now - execution.executedAt) > maxAge) {
        this.executionHistory.delete(id);
      }
    }
        
    // Limpiar jobs cron completados
    for (const [id, cronJob] of this.cronJobs.entries()) {
      if (cronJob.executions >= cronJob.maxExecutions) {
        this.cronJobs.delete(id);
        this.activeTimers.delete(id);
      }
    }
        
    // Limpiar triggers agotados
    for (const [id, trigger] of this.eventTriggers.entries()) {
      if (trigger.triggered >= trigger.maxTriggers) {
        this.eventTriggers.delete(id);
      }
    }
  }
    
  _saveExecutionHistory(job, status, executionTime, result, error = null) {
    const historyId = `exec_${Date.now()}_${Math.random()}`;
        
    const execution = {
      id: historyId,
      jobId: job.id,
      type: job.type,
      status,
      executedAt: Date.now(),
      executionTime,
      attempts: job.attempts,
      result,
      error: error ? error.message : null
    };
        
    this.executionHistory.set(historyId, execution);
        
    // Limitar tamaño del historial
    if (this.executionHistory.size > 10000) {
      const entries = Array.from(this.executionHistory.entries());
      entries.sort((a, b) => a[1].executedAt - b[1].executedAt);
            
      // Eliminar las 1000 entradas más antiguas
      for (let i = 0; i < 1000; i++) {
        this.executionHistory.delete(entries[i][0]);
      }
    }
  }
    
  async _loadPersistedJobs() {
    if (this.config.persistence.type === 'file') {
      try {
        const data = await fs.readFile(this.config.persistence.file, 'utf8');
        const persisted = JSON.parse(data);
                
        // Restaurar jobs programados
        for (const job of persisted.scheduled || []) {
          if (job.executeAt > Date.now()) {
            this.scheduleAt(job.notification, job.executeAt, {
              id: job.id,
              maxAttempts: job.maxAttempts
            });
          }
        }
                
        // Restaurar jobs cron
        for (const cronJob of persisted.cron || []) {
          this.scheduleCron(cronJob.notification, cronJob.cronExpression, {
            id: cronJob.id,
            maxExecutions: cronJob.maxExecutions
          });
        }
                
        // Restaurar triggers
        for (const trigger of persisted.triggers || []) {
          this.scheduleOnEvent(trigger.notification, trigger.eventName, trigger.condition, {
            id: trigger.id,
            maxTriggers: trigger.maxTriggers
          });
        }
                
      } catch (error) {
        // Archivo no existe o está corrupto, continuar
      }
    }
  }
    
  async _saveJobs() {
    if (this.config.persistence.type === 'file') {
      try {
        const data = {
          scheduled: Array.from(this.scheduledJobs.values()),
          cron: Array.from(this.cronJobs.values()),
          triggers: Array.from(this.eventTriggers.values()),
          savedAt: Date.now()
        };
                
        await fs.writeFile(this.config.persistence.file, JSON.stringify(data, null, 2));
                
      } catch (error) {
        this.emit('error', error);
      }
    }
  }
    
  _matchesFilter(item, filters) {
    if (filters.type && item.type !== filters.type) {
      return false;
    }
        
    if (filters.enabled !== undefined && item.enabled !== filters.enabled) {
      return false;
    }
        
    return true;
  }
    
  _calculateSuccessRate() {
    const total = this.schedulerStats.jobsExecuted + this.schedulerStats.jobsFailed;
    return total > 0 ? (this.schedulerStats.jobsExecuted / total) * 100 : 0;
  }
    
  _validateConfig() {
    if (this.config.maxScheduledJobs <= 0) {
      throw new Error('Max scheduled jobs must be positive');
    }
        
    if (this.config.execution.maxConcurrent <= 0) {
      throw new Error('Max concurrent executions must be positive');
    }
        
    if (this.config.execution.retryAttempts < 0) {
      throw new Error('Retry attempts must be non-negative');
    }
  }
    
  _setupEventHandlers() {
    this.on('error', (error) => {
      this.logger.error('Notification scheduler error:', error);
    });
  }
}

export default NotificationScheduler;
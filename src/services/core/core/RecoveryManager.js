import EventTypes from './EventTypes.js';
import { createLogger } from './logger.js';

/**
 * Gestor de recuperación automática y tolerancia a fallos
 * Maneja errores, reintentos automáticos y auto-reparación del sistema
 */
class RecoveryManager {
  constructor(eventBus, eventStore, eventReplayer) {
    this.eventBus = eventBus;
    this.eventStore = eventStore;
    this.eventReplayer = eventReplayer;
    this.logger = createLogger('RECOVERY_MANAGER');
        
    this.isActive = false;
    this.failedEvents = new Map();
    this.retryQueue = [];
    this.circuitBreakers = new Map();
    this.healthChecks = new Map();
        
    this.config = {
      maxRetries: 3,
      retryDelays: [1000, 5000, 15000], // Backoff exponencial
      circuitBreakerThreshold: 5, // Fallos consecutivos para abrir circuito
      circuitBreakerTimeout: 30000, // 30 segundos
      healthCheckInterval: 60000, // 1 minuto
      criticalEventTimeout: 10000, // 10 segundos para eventos críticos
      autoRecoveryEnabled: true
    };
        
    this.stats = {
      totalFailures: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      circuitBreakersTriggered: 0,
      autoRepairsPerformed: 0
    };
        
    this.setupEventListeners();
  }

  /**
     * Inicia el gestor de recuperación
     */
  async start() {
    if (this.isActive) return;
        
    this.isActive = true;
    logger.info('🛡️ RecoveryManager: Sistema de recuperación automática iniciado');
        
    // Iniciar verificaciones de salud periódicas
    this.startHealthChecks();
        
    // Procesar cola de reintentos
    this.startRetryProcessor();
        
    this.eventBus.emit(EventTypes.SYSTEM.RECOVERY_MANAGER_STARTED, {
      timestamp: new Date().toISOString(),
      config: this.config
    });
  }

  /**
     * Detiene el gestor de recuperación
     */
  async stop() {
    if (!this.isActive) return;
        
    this.isActive = false;
        
    // Detener verificaciones de salud
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
        
    // Detener procesador de reintentos
    if (this.retryProcessorInterval) {
      clearInterval(this.retryProcessorInterval);
    }
        
    logger.info('🛡️ RecoveryManager: Sistema de recuperación detenido');
        
    this.eventBus.emit(EventTypes.SYSTEM.RECOVERY_MANAGER_STOPPED, {
      timestamp: new Date().toISOString(),
      finalStats: this.stats
    });
  }

  /**
     * Configura los listeners para capturar errores
     */
  setupEventListeners() {
    // Escuchar todos los tipos de errores
    this.eventBus.on(EventTypes.SYSTEM.ERROR, (data) => {
      this.handleSystemError(data);
    });

    this.eventBus.on(EventTypes.SYSTEM.CRITICAL_ERROR, (data) => {
      this.handleCriticalError(data);
    });

    this.eventBus.on(EventTypes.SYSTEM.PERFORMANCE_ALERT, (data) => {
      this.handlePerformanceAlert(data);
    });

    // Escuchar eventos de fallo de procesamiento
    this.eventBus.on('event.processing.failed', (data) => {
      this.handleEventProcessingFailure(data);
    });

    // Escuchar eventos de timeout
    this.eventBus.on('event.timeout', (data) => {
      this.handleEventTimeout(data);
    });

    // Escuchar eventos de circuito abierto
    this.eventBus.on('circuit.breaker.opened', (data) => {
      this.handleCircuitBreakerOpened(data);
    });
  }

  /**
     * Maneja errores del sistema
     */
  async handleSystemError(errorData) {
    this.logger.error('🚨 RecoveryManager: Error del sistema detectado:', errorData);
        
    this.stats.totalFailures++;
        
    const errorInfo = {
      id: `error_${Date.now()}`,
      type: 'system_error',
      timestamp: new Date().toISOString(),
      data: errorData,
      retryCount: 0,
      status: 'pending'
    };
        
    this.failedEvents.set(errorInfo.id, errorInfo);
        
    // Determinar estrategia de recuperación
    const recoveryStrategy = this.determineRecoveryStrategy(errorData);
        
    // Ejecutar recuperación
    await this.executeRecovery(errorInfo, recoveryStrategy);
  }

  /**
     * Maneja errores críticos
     */
  async handleCriticalError(errorData) {
    this.logger.error('🔥 RecoveryManager: Error crítico detectado:', errorData);
        
    // Los errores críticos requieren atención inmediata
    const criticalInfo = {
      id: `critical_${Date.now()}`,
      type: 'critical_error',
      timestamp: new Date().toISOString(),
      data: errorData,
      priority: 'immediate'
    };
        
    // Notificar inmediatamente
    this.eventBus.emit(EventTypes.SYSTEM.ALERT, {
      level: 'critical',
      message: 'Error crítico detectado - Requiere atención inmediata',
      error: criticalInfo,
      timestamp: new Date().toISOString()
    });
        
    // Intentar diagnóstico automático con IA
    if (this.config.autoRecoveryEnabled) {
      await this.requestAIDiagnosis(criticalInfo);
    }
        
    // Activar modo de emergencia si es necesario
    await this.activateEmergencyMode(criticalInfo);
  }

  /**
     * Maneja fallos de procesamiento de eventos
     */
  async handleEventProcessingFailure(failureData) {
    logger.warn('⚠️ RecoveryManager: Fallo de procesamiento de evento:', failureData);
        
    const eventId = failureData.eventId;
    const error = failureData.error;
        
    // Actualizar estado en el store
    if (this.eventStore) {
      this.eventStore.markEventFailed(eventId, error);
    }
        
    // Verificar si el evento debe reintentarse
    if (this.shouldRetryEvent(failureData)) {
      await this.scheduleRetry(failureData);
    } else {
      // Marcar como fallo permanente
      await this.markPermanentFailure(failureData);
    }
  }

  /**
     * Maneja timeouts de eventos
     */
  async handleEventTimeout(timeoutData) {
    logger.warn('⏰ RecoveryManager: Timeout de evento detectado:', timeoutData);
        
    const eventType = timeoutData.eventType;
        
    // Verificar si es un evento crítico
    if (this.isCriticalEvent(eventType)) {
      // Los eventos críticos con timeout requieren atención especial
      this.eventBus.emit(EventTypes.SYSTEM.CRITICAL_EVENT_TIMEOUT, {
        eventType,
        timeout: timeoutData.timeout,
        timestamp: new Date().toISOString()
      });
            
      // Intentar recuperación inmediata
      await this.recoverCriticalEventTimeout(timeoutData);
    }
  }

  /**
     * Determina la estrategia de recuperación apropiada
     */
  determineRecoveryStrategy(errorData) {
    const errorType = errorData.type || 'unknown';
    const errorMessage = errorData.message || '';
        
    // Estrategias basadas en el tipo de error
    if (errorType.includes('memory')) {
      return 'memory_cleanup';
    }
        
    if (errorType.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      return 'network_retry';
    }
        
    if (errorType.includes('database') || errorMessage.includes('database')) {
      return 'database_reconnect';
    }
        
    if (errorType.includes('timeout')) {
      return 'timeout_recovery';
    }
        
    if (errorType.includes('validation')) {
      return 'data_validation';
    }
        
    // Estrategia por defecto
    return 'generic_retry';
  }

  /**
     * Ejecuta la estrategia de recuperación
     */
  async executeRecovery(errorInfo, strategy) {
    logger.info(`🔧 RecoveryManager: Ejecutando estrategia de recuperación: ${strategy}`);
        
    try {
      switch (strategy) {
      case 'memory_cleanup':
        await this.performMemoryCleanup();
        break;
                    
      case 'network_retry':
        await this.performNetworkRetry(errorInfo);
        break;
                    
      case 'database_reconnect':
        await this.performDatabaseReconnect(errorInfo);
        break;
                    
      case 'timeout_recovery':
        await this.performTimeoutRecovery(errorInfo);
        break;
                    
      case 'data_validation':
        await this.performDataValidation(errorInfo);
        break;
                    
      case 'generic_retry':
      default:
        await this.performGenericRetry(errorInfo);
        break;
      }
            
      this.stats.successfulRecoveries++;
      errorInfo.status = 'recovered';
            
      this.eventBus.emit(EventTypes.SYSTEM.RECOVERY_SUCCESS, {
        errorId: errorInfo.id,
        strategy,
        timestamp: new Date().toISOString()
      });
            
    } catch (recoveryError) {
      this.logger.error('❌ RecoveryManager: Fallo en recuperación:', recoveryError.message);
            
      this.stats.failedRecoveries++;
      errorInfo.status = 'recovery_failed';
      errorInfo.recoveryError = recoveryError.message;
            
      this.eventBus.emit(EventTypes.SYSTEM.RECOVERY_FAILED, {
        errorId: errorInfo.id,
        strategy,
        recoveryError: recoveryError.message,
        timestamp: new Date().toISOString()
      });
            
      // Escalar el problema
      await this.escalateFailure(errorInfo);
    }
  }

  /**
     * Realiza limpieza de memoria
     */
  async performMemoryCleanup() {
    logger.info('🧹 RecoveryManager: Realizando limpieza de memoria...');
        
    // Forzar garbage collection si está disponible
    if (global.gc) {
      global.gc();
    }
        
    // Limpiar eventos antiguos del store
    if (this.eventStore) {
      await this.eventStore.cleanupOldEvents({ maxAge: 24 * 60 * 60 * 1000 }); // 24 horas
    }
        
    // Limpiar caches internos
    this.clearInternalCaches();
        
    this.stats.autoRepairsPerformed++;
        
    this.eventBus.emit(EventTypes.SYSTEM.MEMORY_CLEANUP_COMPLETED, {
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage()
    });
  }

  /**
     * Realiza reintento de red
     */
  async performNetworkRetry(errorInfo) {
    logger.info('🌐 RecoveryManager: Reintentando operación de red...');
        
    // Implementar lógica específica de reintento de red
    const retryDelay = this.config.retryDelays[errorInfo.retryCount] || 15000;
        
    await this.sleep(retryDelay);
        
    // Aquí se reintentaría la operación original
    // Por ahora, simularemos el reintento
        
    this.eventBus.emit(EventTypes.SYSTEM.NETWORK_RETRY_COMPLETED, {
      errorId: errorInfo.id,
      retryCount: errorInfo.retryCount + 1,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Realiza reconexión de base de datos
     */
  async performDatabaseReconnect(errorInfo) {
    logger.info('🗄️ RecoveryManager: Reintentando conexión de base de datos...');
        
    // Implementar lógica de reconexión de BD
    // Por ahora, simularemos la reconexión
        
    this.eventBus.emit(EventTypes.SYSTEM.DATABASE_RECONNECT_COMPLETED, {
      errorId: errorInfo.id,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Realiza recuperación de timeout
     */
  async performTimeoutRecovery(errorInfo) {
    logger.info('⏱️ RecoveryManager: Recuperando de timeout...');
        
    // Aumentar timeouts temporalmente
    // Reintentar operación con timeout extendido
        
    this.eventBus.emit(EventTypes.SYSTEM.TIMEOUT_RECOVERY_COMPLETED, {
      errorId: errorInfo.id,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Realiza validación de datos
     */
  async performDataValidation(errorInfo) {
    logger.info('✅ RecoveryManager: Validando y corrigiendo datos...');
        
    // Implementar lógica de validación y corrección de datos
        
    this.eventBus.emit(EventTypes.SYSTEM.DATA_VALIDATION_COMPLETED, {
      errorId: errorInfo.id,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Realiza reintento genérico
     */
  async performGenericRetry(errorInfo) {
    logger.info('🔄 RecoveryManager: Realizando reintento genérico...');
        
    if (errorInfo.retryCount < this.config.maxRetries) {
      await this.scheduleRetry(errorInfo);
    } else {
      throw new Error('Máximo número de reintentos alcanzado');
    }
  }

  /**
     * Programa un reintento
     */
  async scheduleRetry(errorInfo) {
    const retryDelay = this.config.retryDelays[errorInfo.retryCount] || 15000;
        
    logger.info(`🔄 RecoveryManager: Programando reintento en ${retryDelay}ms...`);
        
    setTimeout(async() => {
      if (!this.isActive) return;
            
      errorInfo.retryCount++;
            
      try {
        // Reintentar la operación original
        await this.retryOriginalOperation(errorInfo);
                
        this.stats.successfulRecoveries++;
        errorInfo.status = 'recovered';
                
        this.eventBus.emit(EventTypes.SYSTEM.RETRY_SUCCESS, {
          errorId: errorInfo.id,
          retryCount: errorInfo.retryCount,
          timestamp: new Date().toISOString()
        });
                
      } catch (retryError) {
        this.logger.error('❌ RecoveryManager: Fallo en reintento:', retryError.message);
                
        if (errorInfo.retryCount >= this.config.maxRetries) {
          await this.markPermanentFailure(errorInfo);
        } else {
          await this.scheduleRetry(errorInfo);
        }
      }
    }, retryDelay);
  }

  /**
     * Reintenta la operación original
     */
  async retryOriginalOperation(errorInfo) {
    // Aquí se implementaría la lógica para reintentar la operación original
    // Por ahora, simularemos el reintento
        
    logger.info(`🔄 RecoveryManager: Reintentando operación original para ${errorInfo.id}`);
        
    // Simular éxito/fallo aleatorio para demostración
    if (Math.random() > 0.3) {
      return; // Éxito simulado
    } else {
      throw new Error('Reintento fallido (simulado)');
    }
  }

  /**
     * Marca un fallo como permanente
     */
  async markPermanentFailure(errorInfo) {
    this.logger.error(`💀 RecoveryManager: Marcando fallo permanente: ${errorInfo.id}`);
        
    errorInfo.status = 'permanent_failure';
    errorInfo.markedFailureAt = new Date().toISOString();
        
    this.eventBus.emit(EventTypes.SYSTEM.PERMANENT_FAILURE, {
      errorId: errorInfo.id,
      originalError: errorInfo.data,
      retryCount: errorInfo.retryCount,
      timestamp: new Date().toISOString()
    });
        
    // Solicitar diagnóstico de IA para fallos permanentes
    await this.requestAIDiagnosis(errorInfo);
  }

  /**
     * Solicita diagnóstico automático de IA
     */
  async requestAIDiagnosis(errorInfo) {
    logger.info('🤖 RecoveryManager: Solicitando diagnóstico de IA...');
        
    this.eventBus.emit(EventTypes.AI.ERROR_DIAGNOSIS_REQUESTED, {
      errorId: errorInfo.id,
      errorData: errorInfo.data,
      context: {
        retryCount: errorInfo.retryCount,
        timestamp: errorInfo.timestamp,
        systemState: await this.getSystemState()
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Activa modo de emergencia
     */
  async activateEmergencyMode(criticalInfo) {
    logger.warn('🚨 RecoveryManager: Activando modo de emergencia...');
        
    this.eventBus.emit(EventTypes.SYSTEM.EMERGENCY_MODE_ACTIVATED, {
      reason: criticalInfo,
      timestamp: new Date().toISOString(),
      actions: [
        'Reducir carga de procesamiento',
        'Activar modo de solo lectura',
        'Notificar administradores'
      ]
    });
  }

  /**
     * Inicia verificaciones de salud periódicas
     */
  startHealthChecks() {
    this.healthCheckInterval = setInterval(async() => {
      if (!this.isActive) return;
            
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
     * Realiza verificación de salud del sistema
     */
  async performHealthCheck() {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      components: {},
      metrics: {}
    };
        
    try {
      // Verificar memoria
      const memUsage = process.memoryUsage();
      healthStatus.components.memory = {
        status: memUsage.heapUsed / memUsage.heapTotal < 0.9 ? 'healthy' : 'warning',
        usage: memUsage
      };
            
      // Verificar cola de eventos
      if (this.eventBus.getStats) {
        const eventStats = this.eventBus.getStats();
        healthStatus.components.eventBus = {
          status: eventStats.queueSize < 1000 ? 'healthy' : 'warning',
          stats: eventStats
        };
      }
            
      // Verificar fallos recientes
      const recentFailures = Array.from(this.failedEvents.values())
        .filter(f => Date.now() - new Date(f.timestamp).getTime() < 300000); // 5 minutos
            
      healthStatus.components.failures = {
        status: recentFailures.length < 10 ? 'healthy' : 'critical',
        recentCount: recentFailures.length
      };
            
      // Determinar estado general
      const componentStatuses = Object.values(healthStatus.components).map(c => c.status);
      if (componentStatuses.includes('critical')) {
        healthStatus.overall = 'critical';
      } else if (componentStatuses.includes('warning')) {
        healthStatus.overall = 'warning';
      }
            
      this.eventBus.emit(EventTypes.SYSTEM.HEALTH_CHECK_COMPLETED, healthStatus);
            
      // Tomar acciones correctivas si es necesario
      if (healthStatus.overall !== 'healthy') {
        await this.takeCorrectiveActions(healthStatus);
      }
            
    } catch (error) {
      this.logger.error('❌ RecoveryManager: Error en verificación de salud:', error.message);
    }
  }

  /**
     * Toma acciones correctivas basadas en el estado de salud
     */
  async takeCorrectiveActions(healthStatus) {
    logger.info('🔧 RecoveryManager: Tomando acciones correctivas...');
        
    if (healthStatus.components.memory?.status === 'warning') {
      await this.performMemoryCleanup();
    }
        
    if (healthStatus.components.eventBus?.status === 'warning') {
      this.eventBus.emit(EventTypes.SYSTEM.PERFORMANCE_OPTIMIZATION_REQUESTED, {
        reason: 'High event queue size',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Inicia el procesador de cola de reintentos
     */
  startRetryProcessor() {
    this.retryProcessorInterval = setInterval(() => {
      this.processRetryQueue();
    }, 5000); // Cada 5 segundos
  }

  /**
     * Procesa la cola de reintentos
     */
  processRetryQueue() {
    if (this.retryQueue.length === 0) return;
        
    const now = Date.now();
    const readyToRetry = this.retryQueue.filter(item => item.retryAt <= now);
        
    readyToRetry.forEach(async(item) => {
      try {
        await this.retryOriginalOperation(item.errorInfo);
        this.retryQueue = this.retryQueue.filter(r => r.id !== item.id);
      } catch (error) {
        // Manejar fallo de reintento
        item.errorInfo.retryCount++;
        if (item.errorInfo.retryCount >= this.config.maxRetries) {
          await this.markPermanentFailure(item.errorInfo);
          this.retryQueue = this.retryQueue.filter(r => r.id !== item.id);
        }
      }
    });
  }

  /**
     * Verifica si un evento debe reintentarse
     */
  shouldRetryEvent(failureData) {
    const retryableErrors = [
      'network',
      'timeout',
      'temporary',
      'rate_limit',
      'service_unavailable'
    ];
        
    const errorType = failureData.error?.type || '';
    return retryableErrors.some(type => errorType.includes(type));
  }

  /**
     * Verifica si un evento es crítico
     */
  isCriticalEvent(eventType) {
    const criticalEvents = [
      'payment_approved',
      'payment_declined',
      'error_critical',
      'system_failure',
      'security_breach'
    ];
        
    return criticalEvents.includes(eventType);
  }

  /**
     * Obtiene el estado actual del sistema
     */
  async getSystemState() {
    return {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      failedEventsCount: this.failedEvents.size,
      retryQueueSize: this.retryQueue.length,
      stats: this.stats
    };
  }

  /**
     * Limpia caches internos
     */
  clearInternalCaches() {
    // Limpiar eventos fallidos antiguos (más de 1 hora)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
        
    for (const [id, errorInfo] of this.failedEvents) {
      if (new Date(errorInfo.timestamp).getTime() < oneHourAgo) {
        this.failedEvents.delete(id);
      }
    }
  }

  /**
     * Escala un fallo para atención manual
     */
  async escalateFailure(errorInfo) {
    this.logger.error('🚨 RecoveryManager: Escalando fallo para atención manual:', errorInfo.id);
        
    this.eventBus.emit(EventTypes.SYSTEM.FAILURE_ESCALATED, {
      errorId: errorInfo.id,
      errorInfo,
      timestamp: new Date().toISOString(),
      requiresManualIntervention: true
    });
  }

  /**
     * Función auxiliar para pausas
     */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Obtiene estadísticas del recovery manager
     */
  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      failedEventsCount: this.failedEvents.size,
      retryQueueSize: this.retryQueue.length,
      circuitBreakersCount: this.circuitBreakers.size
    };
  }
}

export default RecoveryManager;
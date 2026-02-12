import { createLogger } from '../core/evolutive-logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * HealingAgent - Agente de autorrecuperación
 * Responsable de:
 * - Detectar fallos y errores del sistema
 * - Aplicar estrategias de recuperación automática
 * - Aislar componentes problemáticos
 * - Reportar estado de salud del sistema
 * - Implementar circuit breakers y backoff exponencial
 */
class HealingAgent {
  constructor(eventHub) {
    this.eventHub = eventHub;
    this.logger = createLogger('HEALING_AGENT');
    this.agentId = uuidv4();
        
    // Estado del agente
    this.isActive = false;
    this.healingStrategies = new Map();
    this.failureHistory = new Map();
    this.isolatedComponents = new Set();
    this.circuitBreakers = new Map();
        
    // Métricas
    this.metrics = {
      errorsDetected: 0,
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      componentsIsolated: 0,
      circuitBreakersTriggered: 0
    };
        
    // Configuración
    this.config = {
      maxRetryAttempts: 3,
      baseBackoffDelay: 1000, // 1 segundo
      maxBackoffDelay: 30000,  // 30 segundos
      circuitBreakerThreshold: 5, // Fallos antes de abrir circuito
      circuitBreakerTimeout: 60000, // 1 minuto
      isolationThreshold: 10, // Fallos antes de aislar componente
      healthCheckInterval: 30000, // 30 segundos
      recoveryTimeout: 120000 // 2 minutos
    };
        
    // Estrategias de recuperación predefinidas
    this.initializeHealingStrategies();
        
    this.logger.info('🏥 HealingAgent inicializado');
  }

  /**
     * Inicializar estrategias de recuperación
     */
  initializeHealingStrategies() {
    // Estrategia para errores de conexión
    this.healingStrategies.set('connection_error', {
      name: 'Connection Recovery',
      maxAttempts: 5,
      backoffMultiplier: 2,
      action: async(error, context) => {
        this.logger.info('🔄 Intentando recuperar conexión...', { context });
                
        // Simular reconexión
        await this.delay(this.calculateBackoff(context.attempt));
                
        // Emitir evento de reconexión
        this.eventHub.emitEvolutive('system.connection_retry', {
          attempt: context.attempt,
          component: context.component,
          error: error.message
        }, { source: 'HealingAgent', priority: 'medium' });
                
        return { success: Math.random() > 0.3 }; // 70% de éxito
      }
    });
        
    // Estrategia para errores de memoria
    this.healingStrategies.set('memory_error', {
      name: 'Memory Recovery',
      maxAttempts: 2,
      backoffMultiplier: 1.5,
      action: async(error, context) => {
        this.logger.info('🧠 Intentando liberar memoria...', { context });
                
        // Forzar garbage collection si está disponible
        if (global.gc) {
          global.gc();
        }
                
        // Emitir evento de limpieza de memoria
        this.eventHub.emitEvolutive('system.memory_cleanup', {
          component: context.component,
          memoryUsage: process.memoryUsage()
        }, { source: 'HealingAgent', priority: 'high' });
                
        return { success: true };
      }
    });
        
    // Estrategia para errores de timeout
    this.healingStrategies.set('timeout_error', {
      name: 'Timeout Recovery',
      maxAttempts: 3,
      backoffMultiplier: 1.8,
      action: async(error, context) => {
        this.logger.info('⏱️ Intentando recuperar de timeout...', { context });
                
        // Aumentar timeout para próximos intentos
        const newTimeout = (context.originalTimeout || 5000) * 1.5;
                
        this.eventHub.emitEvolutive('system.timeout_adjusted', {
          component: context.component,
          originalTimeout: context.originalTimeout,
          newTimeout,
          attempt: context.attempt
        }, { source: 'HealingAgent', priority: 'medium' });
                
        return { success: true, adjustedTimeout: newTimeout };
      }
    });
        
    // Estrategia para errores de validación
    this.healingStrategies.set('validation_error', {
      name: 'Validation Recovery',
      maxAttempts: 2,
      backoffMultiplier: 1,
      action: async(error, context) => {
        this.logger.info('✅ Intentando corregir datos de validación...', { context });
                
        // Intentar sanitizar datos
        const sanitizedData = this.sanitizeData(context.data);
                
        this.eventHub.emitEvolutive('system.data_sanitized', {
          component: context.component,
          originalData: context.data,
          sanitizedData,
          error: error.message
        }, { source: 'HealingAgent', priority: 'low' });
                
        return { success: true, sanitizedData };
      }
    });
  }

  /**
     * Activar el agente de recuperación
     */
  activate() {
    if (this.isActive) {
      this.logger.warn('HealingAgent ya está activo');
      return;
    }

    this.isActive = true;
        
    // Registrar el agente
    this.eventHub.registerAgent('HealingAgent', this, [
      'error_recovery',
      'system_healing',
      'circuit_breaking',
      'component_isolation',
      'health_monitoring'
    ]);

    // Escuchar eventos de error
    this.setupErrorListeners();
        
    // Iniciar monitoreo de salud
    this.startHealthMonitoring();
        
    // Emitir evento de activación
    this.eventHub.emitEvolutive('system.healing_activated', {
      agentId: this.agentId,
      strategies: Array.from(this.healingStrategies.keys()),
      timestamp: new Date().toISOString()
    }, { source: 'HealingAgent', priority: 'medium' });

    this.logger.info('🏥 HealingAgent activado - Monitoreando salud del sistema');
  }

  /**
     * Configurar listeners para eventos de error
     */
  setupErrorListeners() {
    // Escuchar todos los eventos de error
    this.eventHub.onEvolutive('system.handler_error', (event) => {
      this.handleError(event);
    }, { agentName: 'HealingAgent' });
        
    this.eventHub.onEvolutive('system.connection_error', (event) => {
      this.handleError(event);
    }, { agentName: 'HealingAgent' });
        
    this.eventHub.onEvolutive('system.timeout_error', (event) => {
      this.handleError(event);
    }, { agentName: 'HealingAgent' });
        
    this.eventHub.onEvolutive('system.validation_error', (event) => {
      this.handleError(event);
    }, { agentName: 'HealingAgent' });
        
    this.eventHub.onEvolutive('system.memory_error', (event) => {
      this.handleError(event);
    }, { agentName: 'HealingAgent' });
        
    // Escuchar anomalías del ObserverAgent
    this.eventHub.onEvolutive('system.anomaly_detected', (event) => {
      this.handleAnomaly(event);
    }, { agentName: 'HealingAgent' });
  }

  /**
     * Manejar error detectado
     */
  async handleError(event) {
    if (!this.isActive) return;

    try {
      this.metrics.errorsDetected++;
            
      const errorInfo = {
        eventId: event.id,
        errorType: event.type,
        component: event.payload.agentName || event.metadata.source || 'unknown',
        error: event.payload.error || event.payload.message,
        timestamp: new Date(event.metadata.timestamp),
        payload: event.payload
      };

      this.logger.warn(`🚨 Error detectado: ${errorInfo.errorType}`, errorInfo);

      // Verificar circuit breaker
      if (this.isCircuitOpen(errorInfo.component)) {
        this.logger.warn(`⚡ Circuit breaker abierto para ${errorInfo.component} - Saltando recuperación`);
        return;
      }

      // Verificar si el componente está aislado
      if (this.isolatedComponents.has(errorInfo.component)) {
        this.logger.warn(`🔒 Componente ${errorInfo.component} está aislado - Saltando recuperación`);
        return;
      }

      // Registrar fallo
      this.recordFailure(errorInfo);

      // Intentar recuperación
      await this.attemptRecovery(errorInfo);

    } catch (error) {
      this.logger.error('Error manejando error del sistema:', error);
    }
  }

  /**
     * Manejar anomalía detectada
     */
  async handleAnomaly(event) {
    const anomaly = event.payload.anomaly;
        
    if (anomaly.severity === 'high') {
      this.logger.warn(`🔍 Anomalía de alta severidad detectada: ${anomaly.type}`, anomaly.details);
            
      // Tratar anomalías de alta severidad como errores potenciales
      const errorInfo = {
        eventId: event.id,
        errorType: `anomaly_${anomaly.type}`,
        component: anomaly.details.source || 'system',
        error: `Anomaly detected: ${anomaly.type}`,
        timestamp: new Date(),
        payload: anomaly.details
      };
            
      await this.attemptRecovery(errorInfo);
    }
  }

  /**
     * Registrar fallo
     */
  recordFailure(errorInfo) {
    const component = errorInfo.component;
        
    if (!this.failureHistory.has(component)) {
      this.failureHistory.set(component, []);
    }
        
    const failures = this.failureHistory.get(component);
    failures.push({
      timestamp: errorInfo.timestamp,
      errorType: errorInfo.errorType,
      error: errorInfo.error
    });
        
    // Mantener solo los últimos 50 fallos por componente
    if (failures.length > 50) {
      failures.shift();
    }
        
    // Verificar si necesita activar circuit breaker
    this.checkCircuitBreaker(component, failures);
        
    // Verificar si necesita aislar componente
    this.checkComponentIsolation(component, failures);
  }

  /**
     * Verificar y activar circuit breaker
     */
  checkCircuitBreaker(component, failures) {
    const recentFailures = failures.filter(failure => 
      Date.now() - failure.timestamp.getTime() < this.config.circuitBreakerTimeout
    );
        
    if (recentFailures.length >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker(component);
    }
  }

  /**
     * Abrir circuit breaker
     */
  openCircuitBreaker(component) {
    const circuitBreaker = {
      component,
      openedAt: new Date(),
      failureCount: this.failureHistory.get(component).length,
      timeout: this.config.circuitBreakerTimeout
    };
        
    this.circuitBreakers.set(component, circuitBreaker);
    this.metrics.circuitBreakersTriggered++;
        
    this.eventHub.emitEvolutive('system.circuit_breaker_opened', {
      component,
      circuitBreaker,
      agentId: this.agentId
    }, { source: 'HealingAgent', priority: 'high' });
        
    this.logger.warn(`⚡ Circuit breaker abierto para ${component}`);
        
    // Programar cierre automático
    setTimeout(() => {
      this.closeCircuitBreaker(component);
    }, this.config.circuitBreakerTimeout);
  }

  /**
     * Cerrar circuit breaker
     */
  closeCircuitBreaker(component) {
    if (this.circuitBreakers.has(component)) {
      this.circuitBreakers.delete(component);
            
      this.eventHub.emitEvolutive('system.circuit_breaker_closed', {
        component,
        agentId: this.agentId
      }, { source: 'HealingAgent', priority: 'medium' });
            
      this.logger.info(`⚡ Circuit breaker cerrado para ${component}`);
    }
  }

  /**
     * Verificar si circuit breaker está abierto
     */
  isCircuitOpen(component) {
    return this.circuitBreakers.has(component);
  }

  /**
     * Verificar aislamiento de componente
     */
  checkComponentIsolation(component, failures) {
    const recentFailures = failures.filter(failure => 
      Date.now() - failure.timestamp.getTime() < 300000 // 5 minutos
    );
        
    if (recentFailures.length >= this.config.isolationThreshold) {
      this.isolateComponent(component);
    }
  }

  /**
     * Aislar componente problemático
     */
  isolateComponent(component) {
    this.isolatedComponents.add(component);
    this.metrics.componentsIsolated++;
        
    this.eventHub.emitEvolutive('system.component_isolated', {
      component,
      reason: 'Excessive failures detected',
      failureCount: this.failureHistory.get(component).length,
      agentId: this.agentId
    }, { source: 'HealingAgent', priority: 'high' });
        
    this.logger.error(`🔒 Componente ${component} aislado debido a fallos excesivos`);
        
    // Notificar al supervisor de IA
    this.eventHub.emitEvolutive('ai.supervisor_notification', {
      type: 'component_isolation',
      component,
      severity: 'critical',
      action: 'manual_intervention_required'
    }, { source: 'HealingAgent', priority: 'high' });
  }

  /**
     * Intentar recuperación
     */
  async attemptRecovery(errorInfo) {
    this.metrics.recoveryAttempts++;
        
    // Determinar estrategia de recuperación
    const strategy = this.selectRecoveryStrategy(errorInfo);
        
    if (!strategy) {
      this.logger.warn(`No hay estrategia de recuperación para: ${errorInfo.errorType}`);
      this.metrics.failedRecoveries++;
      return;
    }
        
    const context = {
      component: errorInfo.component,
      attempt: this.getAttemptCount(errorInfo.component, errorInfo.errorType),
      originalTimeout: errorInfo.payload.timeout,
      data: errorInfo.payload.data,
      errorType: errorInfo.errorType
    };
        
    // Verificar si excede intentos máximos
    if (context.attempt > strategy.maxAttempts) {
      this.logger.warn(`Máximo de intentos alcanzado para ${errorInfo.component}:${errorInfo.errorType}`);
      this.metrics.failedRecoveries++;
      return;
    }
        
    try {
      this.logger.info(`🔄 Iniciando recuperación: ${strategy.name} (intento ${context.attempt})`);
            
      // Emitir evento de inicio de recuperación
      this.eventHub.emitEvolutive('system.recovery_started', {
        component: errorInfo.component,
        strategy: strategy.name,
        attempt: context.attempt,
        errorType: errorInfo.errorType,
        agentId: this.agentId
      }, { source: 'HealingAgent', priority: 'medium' });
            
      // Ejecutar estrategia con timeout
      const recoveryPromise = strategy.action(errorInfo, context);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Recovery timeout')), this.config.recoveryTimeout)
      );
            
      const result = await Promise.race([recoveryPromise, timeoutPromise]);
            
      if (result.success) {
        this.handleSuccessfulRecovery(errorInfo, strategy, result);
      } else {
        this.handleFailedRecovery(errorInfo, strategy, result);
      }
            
    } catch (error) {
      this.handleRecoveryError(errorInfo, strategy, error);
    }
  }

  /**
     * Seleccionar estrategia de recuperación
     */
  selectRecoveryStrategy(errorInfo) {
    // Mapear tipos de error a estrategias
    const errorTypeMap = {
      'connection_error': 'connection_error',
      'timeout_error': 'timeout_error',
      'validation_error': 'validation_error',
      'memory_error': 'memory_error',
      'handler_error': 'connection_error' // Default
    };
        
    const strategyKey = errorTypeMap[errorInfo.errorType.replace('system.', '')] || 'connection_error';
    return this.healingStrategies.get(strategyKey);
  }

  /**
     * Obtener contador de intentos
     */
  getAttemptCount(component, errorType) {
    const failures = this.failureHistory.get(component) || [];
    const recentFailures = failures.filter(failure => 
      failure.errorType === errorType &&
            Date.now() - failure.timestamp.getTime() < 300000 // 5 minutos
    );
        
    return recentFailures.length;
  }

  /**
     * Manejar recuperación exitosa
     */
  handleSuccessfulRecovery(errorInfo, strategy, result) {
    this.metrics.successfulRecoveries++;
        
    this.eventHub.emitEvolutive('system.recovery_successful', {
      component: errorInfo.component,
      strategy: strategy.name,
      errorType: errorInfo.errorType,
      result,
      agentId: this.agentId
    }, { source: 'HealingAgent', priority: 'low' });
        
    this.logger.info(`✅ Recuperación exitosa: ${strategy.name} para ${errorInfo.component}`);
        
    // Limpiar historial de fallos recientes para este componente
    this.clearRecentFailures(errorInfo.component, errorInfo.errorType);
  }

  /**
     * Manejar recuperación fallida
     */
  handleFailedRecovery(errorInfo, strategy, result) {
    this.metrics.failedRecoveries++;
        
    this.eventHub.emitEvolutive('system.recovery_failed', {
      component: errorInfo.component,
      strategy: strategy.name,
      errorType: errorInfo.errorType,
      result,
      agentId: this.agentId
    }, { source: 'HealingAgent', priority: 'medium' });
        
    this.logger.warn(`❌ Recuperación fallida: ${strategy.name} para ${errorInfo.component}`);
  }

  /**
     * Manejar error en recuperación
     */
  handleRecoveryError(errorInfo, strategy, error) {
    this.metrics.failedRecoveries++;
        
    this.eventHub.emitEvolutive('system.recovery_error', {
      component: errorInfo.component,
      strategy: strategy.name,
      errorType: errorInfo.errorType,
      error: error.message,
      agentId: this.agentId
    }, { source: 'HealingAgent', priority: 'high' });
        
    this.logger.error(`💥 Error en recuperación: ${strategy.name}`, error);
  }

  /**
     * Limpiar fallos recientes
     */
  clearRecentFailures(component, errorType) {
    const failures = this.failureHistory.get(component) || [];
    const filtered = failures.filter(failure => 
      failure.errorType !== errorType ||
            Date.now() - failure.timestamp.getTime() > 300000
    );
        
    this.failureHistory.set(component, filtered);
  }

  /**
     * Calcular backoff exponencial
     */
  calculateBackoff(attempt) {
    const delay = this.config.baseBackoffDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.config.maxBackoffDelay);
  }

  /**
     * Sanitizar datos
     */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;
        
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        sanitized[key] = value.trim().replace(/[<>]/g, '');
      } else if (typeof value === 'number' && !isNaN(value)) {
        sanitized[key] = value;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.filter(item => item != null);
      }
    }
        
    return sanitized;
  }

  /**
     * Delay helper
     */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Iniciar monitoreo de salud
     */
  startHealthMonitoring() {
    setInterval(() => {
      if (this.isActive) {
        this.performHealthCheck();
      }
    }, this.config.healthCheckInterval);
  }

  /**
     * Realizar chequeo de salud
     */
  performHealthCheck() {
    try {
      const systemStats = this.eventHub.getSystemStats();
      const healthReport = {
        timestamp: new Date().toISOString(),
        systemHealth: this.calculateSystemHealth(systemStats),
        activeCircuitBreakers: this.circuitBreakers.size,
        isolatedComponents: this.isolatedComponents.size,
        metrics: this.metrics,
        memoryUsage: systemStats.memoryUsage,
        uptime: systemStats.uptime
      };
            
      this.eventHub.emitEvolutive('system.health_report', {
        report: healthReport,
        agentId: this.agentId
      }, { source: 'HealingAgent', priority: 'low' });
            
      // Log si hay problemas de salud
      if (healthReport.systemHealth < 0.8) {
        this.logger.warn(`⚕️ Salud del sistema baja: ${(healthReport.systemHealth * 100).toFixed(1)}%`);
      }
            
    } catch (error) {
      this.logger.error('Error en chequeo de salud:', error);
    }
  }

  /**
     * Calcular salud del sistema
     */
  calculateSystemHealth(systemStats) {
    let healthScore = 1.0;
        
    // Penalizar por componentes aislados
    healthScore -= this.isolatedComponents.size * 0.1;
        
    // Penalizar por circuit breakers activos
    healthScore -= this.circuitBreakers.size * 0.05;
        
    // Penalizar por uso alto de memoria
    if (systemStats.memoryUsage) {
      const memoryUsage = systemStats.memoryUsage.heapUsed / systemStats.memoryUsage.heapTotal;
      if (memoryUsage > 0.8) {
        healthScore -= (memoryUsage - 0.8) * 0.5;
      }
    }
        
    // Penalizar por tasa de fallos alta
    const totalErrors = this.metrics.errorsDetected;
    const totalRecoveries = this.metrics.successfulRecoveries + this.metrics.failedRecoveries;
    if (totalRecoveries > 0) {
      const failureRate = this.metrics.failedRecoveries / totalRecoveries;
      healthScore -= failureRate * 0.3;
    }
        
    return Math.max(0, Math.min(1, healthScore));
  }

  /**
     * Obtener estadísticas del agente
     */
  getStats() {
    return {
      agentId: this.agentId,
      isActive: this.isActive,
      metrics: this.metrics,
      activeCircuitBreakers: Array.from(this.circuitBreakers.keys()),
      isolatedComponents: Array.from(this.isolatedComponents),
      healingStrategies: Array.from(this.healingStrategies.keys()),
      failureHistory: Object.fromEntries(
        Array.from(this.failureHistory.entries()).map(([key, value]) => [key, value.length])
      )
    };
  }

  /**
     * Desactivar el agente
     */
  deactivate() {
    this.isActive = false;
        
    this.eventHub.emitEvolutive('system.healing_deactivated', {
      agentId: this.agentId,
      finalStats: this.getStats(),
      timestamp: new Date().toISOString()
    }, { source: 'HealingAgent', priority: 'medium' });
        
    this.logger.info('🏥 HealingAgent desactivado');
  }
}

export default HealingAgent;
/**
 * ErrorAgent - Agente evolutivo de gestión inteligente de errores (Refactorizado)
 * 
 * Funcionalidades principales:
 * - Captura centralizada de errores del sistema
 * - Análisis de patrones y correlaciones
 * - Auto-recuperación inteligente
 * - Aprendizaje de contextos y estrategias
 * - Predicción de fallos
 * - Escalamiento inteligente de alertas
 * 
 * Arquitectura modular:
 * - ErrorClassificationService: Clasificación inteligente
 * - ErrorPatternAnalyzer: Análisis de patrones
 * - ErrorRecoverySystem: Sistema de auto-recuperación
 * - ErrorPredictionEngine: Motor de predicción
 * - ErrorLearningSystem: Sistema de aprendizaje
 * - ErrorMetricsCollector: Recolección de métricas
 * - ErrorBufferManager: Gestión de buffers y logs
 */

import { promises as fs } from 'fs';
import path from 'path';
import EventHub from '../core/event_hub.js';
import EvolutiveLogger from './evolutive-logger.js';

// Importar módulos especializados
import ErrorClassificationService from '../../error/classification/ErrorClassificationService.js';
import ErrorPatternAnalyzer from '../../error/patterns/ErrorPatternAnalyzer.js';
import ErrorRecoverySystem from '../../error/recovery/ErrorRecoverySystem.js';
import ErrorPredictionEngine from '../../error/prediction/ErrorPredictionEngine.js';
import ErrorLearningSystem from '../../error/learning/ErrorLearningSystem.js';
import ErrorMetricsCollector from '../../error/metrics/ErrorMetricsCollector.js';
import ErrorBufferManager from '../../error/buffer/ErrorBufferManager.js';

class ErrorAgent {
  constructor() {
    // Configuración principal
    this.config = {
      isActive: false,
      logPath: './logs/errors',
      maxLogSize: 50 * 1024 * 1024, // 50MB
      maxLogFiles: 10,
      bufferSize: 10000,
      flushInterval: 60000, // 1 minuto
      analysisInterval: 300000, // 5 minutos
      performanceInterval: 30000, // 30 segundos
      autoRecovery: true,
      intelligentClassification: true,
      learningEnabled: true,
      predictionEnabled: true,
      alertThresholds: {
        errorRate: 10, // errores por minuto
        criticalErrors: 5, // errores críticos por hora
        moduleFailureRate: 0.1 // 10% de tasa de fallo
      },
      trendAnalysisWindow: 3600000, // 1 hora
      retentionPeriod: 86400000 // 24 horas
    };

    // Servicios especializados
    this.services = {
      classification: null,
      patterns: null,
      recovery: null,
      prediction: null,
      learning: null,
      metrics: null,
      buffer: null
    };

    // Configuraciones para servicios
    this.serviceConfigs = {
      classification: {
        intelligentClassification: true,
        semanticAnalysis: true,
        contextualAnalysis: true,
        duplicateDetection: true,
        autoTagging: true
      },
      patterns: {
        temporalAnalysis: true,
        moduleAnalysis: true,
        correlationAnalysis: true,
        trendAnalysis: true,
        anomalyDetection: true
      },
      recovery: {
        autoRecovery: true,
        maxRetries: 3,
        backoffMultiplier: 2,
        timeout: 30000,
        learningEnabled: true
      },
      prediction: {
        enabled: true,
        temporalPrediction: true,
        patternPrediction: true,
        cascadePrediction: true,
        alertGeneration: true
      },
      learning: {
        enabled: true,
        contextLearning: true,
        patternLearning: true,
        thresholdAdaptation: true,
        strategyOptimization: true
      },
      metrics: {
        metricsEnabled: true,
        aggregationInterval: 60000,
        retentionPeriod: 86400000,
        reportingEnabled: true,
        reportInterval: 3600000
      },
      buffer: {
        bufferSize: 10000,
        maxMemoryUsage: 100 * 1024 * 1024,
        logDirectory: './logs/errors',
        logRotation: {
          enabled: true,
          maxFileSize: 50 * 1024 * 1024,
          maxFiles: 10,
          compress: true
        },
        persistence: {
          enabled: true,
          interval: 300000,
          batchSize: 1000
        }
      }
    };

    // Hub de eventos
    this.eventHub = EventHub;
    
    // Logger evolutivo
    this.logger = new EvolutiveLogger('ErrorAgent');

    // Estado del agente
    this.state = {
      initialized: false,
      startTime: Date.now(),
      lastAnalysis: null,
      lastFlush: null,
      errorCount: 0,
      recoveryAttempts: 0,
      learningIterations: 0
    };

    // Temporizadores
    this.timers = {
      analysis: null,
      performance: null,
      cleanup: null
    };

    // Configurar listeners de eventos
    this.setupEventListeners();
  }

  /**
   * Configurar listeners de eventos del sistema
   */
  setupEventListeners() {
    // Eventos del sistema
    this.eventHub.on('system.started', (data) => this.handleSystemStarted(data));
    this.eventHub.on('system.error', (data) => this.handleSystemError(data));
    this.eventHub.on('system.critical_error', (data) => this.handleCriticalError(data));
    this.eventHub.on('system.shutdown', (data) => this.handleSystemShutdown(data));

    // Eventos de aplicación
    this.eventHub.on('app.error', (data) => this.handleApplicationError(data));
    this.eventHub.on('app.warning', (data) => this.handleApplicationWarning(data));

    // Eventos de base de datos
    this.eventHub.on('db.error', (data) => this.handleDatabaseError(data));
    this.eventHub.on('db.connection_error', (data) => this.handleDatabaseConnectionError(data));

    // Eventos de red
    this.eventHub.on('network.error', (data) => this.handleNetworkError(data));
    this.eventHub.on('network.timeout', (data) => this.handleNetworkTimeout(data));

    // Eventos de validación
    this.eventHub.on('validation.error', (data) => this.handleValidationError(data));

    // Eventos de módulos
    this.eventHub.on('module.error', (data) => this.handleModuleError(data));
    this.eventHub.on('module.warning', (data) => this.handleModuleWarning(data));
    this.eventHub.on('module.failure', (data) => this.handleModuleFailure(data));

    // Eventos de tareas
    this.eventHub.on('task.failed', (data) => this.handleTaskFailed(data));
    this.eventHub.on('task.timeout', (data) => this.handleTaskTimeout(data));
    this.eventHub.on('task.retry_exhausted', (data) => this.handleRetryExhausted(data));

    // Eventos de autenticación
    this.eventHub.on('auth.error', (data) => this.handleAuthError(data));
    this.eventHub.on('auth.permission_error', (data) => this.handlePermissionError(data));

    // Eventos de Node.js
    process.on('uncaughtException', (error) => this.handleUncaughtException(error));
    process.on('unhandledRejection', (reason, promise) => this.handleUnhandledRejection(reason, promise));

    // Eventos de solicitudes
    this.eventHub.on('error_agent.stats_request', (data) => this.handleStatsRequest(data));
    this.eventHub.on('error_agent.analysis_request', (data) => this.handleAnalysisRequest(data));
    this.eventHub.on('error_agent.recovery_request', (data) => this.handleRecoveryRequest(data));
  }

  /**
   * Inicializar agente de errores
   */
  async initialize() {
    logger.debug('🤖 Inicializando ErrorAgent evolutivo...');
    
    try {
      // Crear directorios necesarios
      await this.ensureDirectories();
      
      // Inicializar servicios especializados
      await this.initializeServices();
      
      // Cargar estado del agente
      await this.loadAgentState();
      
      // Inicializar temporizadores
      this.startTimers();
      
      this.state.initialized = true;
      this.config.isActive = true;
      
      logger.debug('✅ ErrorAgent inicializado correctamente');
      
      // Emitir evento de inicialización
      this.eventHub.emit('error_agent.initialized', {
        timestamp: new Date().toISOString(),
        services: Object.keys(this.services),
        config: this.config
      });
      
    } catch (error) {
      logger.error('❌ Error inicializando ErrorAgent:', error);
      throw error;
    }
  }

  /**
   * Inicializar servicios especializados
   */
  async initializeServices() {
    logger.debug('🔧 Inicializando servicios especializados...');

    try {
      // Inicializar servicio de clasificación
      this.services.classification = new ErrorClassificationService(this.serviceConfigs.classification);
      await this.services.classification.initialize();

      // Inicializar analizador de patrones
      this.services.patterns = new ErrorPatternAnalyzer(this.serviceConfigs.patterns);
      await this.services.patterns.initialize();

      // Inicializar sistema de recuperación
      this.services.recovery = new ErrorRecoverySystem(this.serviceConfigs.recovery);
      await this.services.recovery.initialize();

      // Inicializar motor de predicción
      this.services.prediction = new ErrorPredictionEngine(this.serviceConfigs.prediction);
      await this.services.prediction.initialize();

      // Inicializar sistema de aprendizaje
      this.services.learning = new ErrorLearningSystem(this.serviceConfigs.learning);
      await this.services.learning.initialize();

      // Inicializar collector de métricas
      this.services.metrics = new ErrorMetricsCollector(this.serviceConfigs.metrics);
      await this.services.metrics.initialize();

      // Inicializar gestor de buffers
      this.services.buffer = new ErrorBufferManager(this.serviceConfigs.buffer);
      await this.services.buffer.initialize();

      logger.debug('✅ Todos los servicios inicializados correctamente');

    } catch (error) {
      logger.error('❌ Error inicializando servicios:', error);
      throw error;
    }
  }

  /**
   * Activar/desactivar agente
   */
  async setActive(isActive) {
    this.config.isActive = isActive;
    
    if (isActive) {
      logger.debug('🟢 ErrorAgent activado');
      this.eventHub.emit('error_agent.activated', { timestamp: new Date().toISOString() });
    } else {
      logger.debug('🔴 ErrorAgent desactivado');
      this.eventHub.emit('error_agent.deactivated', { timestamp: new Date().toISOString() });
    }
  }

  /**
   * Procesar error principal
   */
  async processError(severity, module, message, metadata = {}, errorObj = null) {
    if (!this.config.isActive || !this.state.initialized) return;

    const startTime = Date.now();

    try {
      // 1. Clasificación inteligente del error
      const classificationResult = await this.services.classification.classifyError({
        severity,
        module,
        message,
        metadata,
        stack: errorObj?.stack,
        timestamp: Date.now()
      });

      // 2. Crear entrada de error enriquecida
      const errorEntry = {
        id: this.generateErrorId(),
        timestamp: Date.now(),
        severity: classificationResult.severity,
        module,
        message: this.sanitizeMessage(message),
        metadata: this.sanitizeMetadata(metadata),
        stack: errorObj?.stack,
        classification: classificationResult,
        context: await this.gatherContext(module, metadata),
        correlationId: this.generateCorrelationId(module, message)
      };

      // 3. Agregar al buffer
      await this.services.buffer.addError(errorEntry);

      // 4. Registrar métricas
      const processingTime = Date.now() - startTime;
      this.services.metrics.recordError(errorEntry, processingTime);

      // 5. Análisis de patrones
      const patternAnalysis = await this.services.patterns.analyzeError(errorEntry);
      errorEntry.patterns = patternAnalysis;

      // 6. Predicción de errores futuros
      if (this.config.predictionEnabled) {
        const predictions = await this.services.prediction.predictFromError(errorEntry);
        if (predictions.length > 0) {
          this.handlePredictions(predictions);
        }
      }

      // 7. Aprendizaje del error
      if (this.config.learningEnabled) {
        await this.services.learning.learnFromError(errorEntry);
        this.state.learningIterations++;
      }

      // 8. Intentar auto-recuperación si es necesario
      if (this.config.autoRecovery && this.shouldAttemptRecovery(errorEntry)) {
        await this.attemptAutoRecovery(errorEntry);
      }

      // 9. Actualizar estado
      this.state.errorCount++;
      this.state.lastAnalysis = Date.now();

      // 10. Emitir evento de error procesado
      this.eventHub.emit('error_agent.error_processed', {
        errorId: errorEntry.id,
        severity: errorEntry.severity,
        module: errorEntry.module,
        processingTime,
        hasPatterns: patternAnalysis.hasPatterns,
        hasPredictions: predictions?.length > 0,
        recoveryAttempted: this.shouldAttemptRecovery(errorEntry)
      });

      return errorEntry;

    } catch (error) {
      logger.error('Error procesando error:', error);
      // Fallback: registrar error básico
      await this.logBasicError(severity, module, message, metadata);
    }
  }

  /**
   * Determinar si se debe intentar recuperación
   */
  shouldAttemptRecovery(errorEntry) {
    // Recuperación para errores críticos y errores
    if (errorEntry.severity === 'critical' || errorEntry.severity === 'error') {
      return true;
    }

    // Recuperación para patrones conocidos
    if (errorEntry.patterns?.hasPatterns && errorEntry.patterns.confidence > 0.7) {
      return true;
    }

    // Recuperación para módulos críticos
    const criticalModules = ['Database', 'Network', 'Auth', 'Core'];
    if (criticalModules.includes(errorEntry.module)) {
      return true;
    }

    return false;
  }

  /**
   * Intentar auto-recuperación
   */
  async attemptAutoRecovery(errorEntry) {
    try {
      logger.debug(`🔧 Intentando auto-recuperación para error ${errorEntry.id}...`);
      
      const recoveryResult = await this.services.recovery.attemptRecovery(errorEntry);
      
      if (recoveryResult.success) {
        logger.debug(`✅ Auto-recuperación exitosa: ${recoveryResult.strategy}`);
        
        // Aprender de la recuperación exitosa
        if (this.config.learningEnabled) {
          await this.services.learning.learnFromRecovery(errorEntry, recoveryResult);
        }
        
        // Emitir evento de recuperación exitosa
        this.eventHub.emit('error_agent.recovery_success', {
          errorId: errorEntry.id,
          strategy: recoveryResult.strategy,
          duration: recoveryResult.duration
        });
        
      } else {
        logger.debug(`❌ Auto-recuperación falló: ${recoveryResult.reason}`);
        
        // Emitir evento de recuperación fallida
        this.eventHub.emit('error_agent.recovery_failed', {
          errorId: errorEntry.id,
          reason: recoveryResult.reason,
          strategy: recoveryResult.strategy
        });
      }
      
      this.state.recoveryAttempts++;
      return recoveryResult;
      
    } catch (error) {
      logger.error('Error en auto-recuperación:', error);
      return { success: false, reason: 'recovery_system_error', error: error.message };
    }
  }

  /**
   * Manejar predicciones
   */
  handlePredictions(predictions) {
    predictions.forEach(prediction => {
      if (prediction.confidence > 0.8) {
        logger.debug(`🔮 Predicción de alta confianza: ${prediction.type} - ${prediction.message}`);
        
        // Emitir alerta de predicción
        this.eventHub.emit('error_agent.prediction_alert', {
          type: prediction.type,
          message: prediction.message,
          confidence: prediction.confidence,
          estimatedTime: prediction.estimatedTime
        });
      }
    });
  }

  // ==================== HANDLERS DE EVENTOS ====================

  /**
   * Manejar inicio del sistema
   */
  async handleSystemStarted(data) {
    await this.processError('info', 'System', 'Sistema iniciado', {
      ...data,
      source: 'system',
      category: 'system_lifecycle'
    });
  }

  /**
   * Manejar error del sistema
   */
  async handleSystemError(data) {
    await this.processError('error', 'System', data.message || 'Error del sistema', {
      ...data,
      source: 'system',
      category: 'system_error'
    });
  }

  /**
   * Manejar error crítico
   */
  async handleCriticalError(data) {
    await this.processError('critical', data.module || 'System', data.message || 'Error crítico', {
      ...data,
      source: 'system',
      category: 'critical_error',
      requiresImmediate: true
    });
  }

  /**
   * Manejar error de aplicación
   */
  async handleApplicationError(data) {
    await this.processError('error', data.module || 'Application', data.message, {
      ...data,
      source: 'application',
      category: 'app_error'
    });
  }

  /**
   * Manejar advertencia de aplicación
   */
  async handleApplicationWarning(data) {
    await this.processError('warning', data.module || 'Application', data.message, {
      ...data,
      source: 'application',
      category: 'app_warning'
    });
  }

  /**
   * Manejar error de base de datos
   */
  async handleDatabaseError(data) {
    await this.processError('error', 'Database', data.message, {
      ...data,
      source: 'database',
      category: 'db_error',
      query: data.query,
      connection: data.connection
    });
  }

  /**
   * Manejar error de conexión de base de datos
   */
  async handleDatabaseConnectionError(data) {
    await this.processError('critical', 'Database', 'Error de conexión a base de datos', {
      ...data,
      source: 'database',
      category: 'db_connection_error'
    });
  }

  /**
   * Manejar error de red
   */
  async handleNetworkError(data) {
    await this.processError('warning', 'Network', data.message, {
      ...data,
      source: 'network',
      category: 'network_error',
      endpoint: data.endpoint,
      statusCode: data.statusCode
    });
  }

  /**
   * Manejar timeout de red
   */
  async handleNetworkTimeout(data) {
    await this.processError('error', 'Network', 'Timeout de red', {
      ...data,
      source: 'network',
      category: 'network_timeout'
    });
  }

  /**
   * Manejar error de validación
   */
  async handleValidationError(data) {
    await this.processError('warning', data.module || 'Validation', data.message, {
      ...data,
      source: 'validation',
      category: 'validation_error',
      field: data.field,
      value: data.value,
      rule: data.rule
    });
  }

  /**
   * Manejar error de módulo
   */
  async handleModuleError(data) {
    await this.processError('error', data.module || 'Unknown', data.message, {
      ...data,
      source: 'module',
      category: 'module_error'
    });
  }

  /**
   * Manejar advertencia de módulo
   */
  async handleModuleWarning(data) {
    await this.processError('warning', data.module || 'Unknown', data.message, {
      ...data,
      source: 'module',
      category: 'module_warning'
    });
  }

  /**
   * Manejar fallo de módulo
   */
  async handleModuleFailure(data) {
    await this.processError('critical', data.module || 'Unknown', 'Fallo de módulo', {
      ...data,
      source: 'module',
      category: 'module_failure'
    });
  }

  /**
   * Manejar fallo de tarea
   */
  async handleTaskFailed(data) {
    await this.processError('error', 'TaskManager', `Tarea falló: ${data.taskName}`, {
      ...data,
      source: 'task',
      category: 'task_failure'
    });
  }

  /**
   * Manejar timeout de tarea
   */
  async handleTaskTimeout(data) {
    await this.processError('warning', 'TaskManager', `Timeout de tarea: ${data.taskName}`, {
      ...data,
      source: 'task',
      category: 'task_timeout'
    });
  }

  /**
   * Manejar reintentos agotados
   */
  async handleRetryExhausted(data) {
    await this.processError('error', data.module || 'TaskManager', 'Reintentos agotados', {
      ...data,
      source: 'task',
      category: 'retry_exhausted'
    });
  }

  /**
   * Manejar error de autenticación
   */
  async handleAuthError(data) {
    await this.processError('warning', 'Auth', data.message || 'Error de autenticación', {
      ...data,
      source: 'auth',
      category: 'auth_error'
    });
  }

  /**
   * Manejar error de permisos
   */
  async handlePermissionError(data) {
    await this.processError('warning', 'Auth', data.message || 'Error de permisos', {
      ...data,
      source: 'auth',
      category: 'permission_error'
    });
  }

  /**
   * Manejar excepción no capturada
   */
  async handleUncaughtException(error) {
    await this.processError('critical', 'Process', 'Excepción no capturada', {
      error: error.message,
      stack: error.stack,
      source: 'process',
      category: 'uncaught_exception',
      requiresImmediate: true
    }, error);

    // Emitir evento de emergencia
    this.eventHub.emit('system.emergency', {
      type: 'uncaught_exception',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Manejar promesa rechazada no manejada
   */
  async handleUnhandledRejection(reason, promise) {
    await this.processError('critical', 'Process', 'Promesa rechazada no manejada', {
      reason: reason?.toString(),
      source: 'process',
      category: 'unhandled_rejection',
      requiresImmediate: true
    });

    // Emitir evento de emergencia
    this.eventHub.emit('system.emergency', {
      type: 'unhandled_rejection',
      reason: reason?.toString(),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Manejar cierre del sistema
   */
  async handleSystemShutdown(data) {
    await this.processError('info', 'System', 'Sistema cerrándose', {
      ...data,
      source: 'system',
      category: 'system_lifecycle'
    });

    // Guardar estado antes del cierre
    await this.saveAgentState();
  }

  // ==================== HANDLERS DE SOLICITUDES ====================

  /**
   * Manejar solicitud de estadísticas
   */
  async handleStatsRequest(data) {
    try {
      const stats = await this.getStats();
      
      this.eventHub.emit('error_agent.stats_response', {
        requestId: data.requestId,
        stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.eventHub.emit('error_agent.stats_error', {
        requestId: data.requestId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Manejar solicitud de análisis
   */
  async handleAnalysisRequest(data) {
    try {
      const analysis = await this.performAnalysis(data.criteria);
      
      this.eventHub.emit('error_agent.analysis_response', {
        requestId: data.requestId,
        analysis,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.eventHub.emit('error_agent.analysis_error', {
        requestId: data.requestId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Manejar solicitud de recuperación
   */
  async handleRecoveryRequest(data) {
    try {
      const result = await this.services.recovery.executeStrategy(data.strategy, data.errorData);
      
      this.eventHub.emit('error_agent.recovery_response', {
        requestId: data.requestId,
        result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.eventHub.emit('error_agent.recovery_error', {
        requestId: data.requestId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ==================== MÉTODOS DE UTILIDAD ====================

  /**
   * Recopilar contexto del error
   */
  async gatherContext(module, metadata) {
    return {
      timestamp: Date.now(),
      module,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development',
      metadata
    };
  }

  /**
   * Realizar análisis completo
   */
  async performAnalysis(criteria = {}) {
    const analysis = {
      timestamp: Date.now(),
      criteria,
      patterns: null,
      predictions: null,
      recommendations: null,
      metrics: null
    };

    try {
      // Análisis de patrones
      if (this.services.patterns) {
        analysis.patterns = await this.services.patterns.getPatternAnalysis(criteria);
      }

      // Predicciones
      if (this.services.prediction) {
        analysis.predictions = await this.services.prediction.getPredictions(criteria);
      }

      // Recomendaciones del sistema de aprendizaje
      if (this.services.learning) {
        analysis.recommendations = await this.services.learning.getRecommendations();
      }

      // Métricas
      if (this.services.metrics) {
        analysis.metrics = this.services.metrics.getStats();
      }

      return analysis;

    } catch (error) {
      logger.error('Error en análisis:', error);
      analysis.error = error.message;
      return analysis;
    }
  }

  /**
   * Obtener estadísticas completas
   */
  async getStats() {
    const stats = {
      agent: {
        initialized: this.state.initialized,
        active: this.config.isActive,
        uptime: Date.now() - this.state.startTime,
        errorCount: this.state.errorCount,
        recoveryAttempts: this.state.recoveryAttempts,
        learningIterations: this.state.learningIterations
      },
      services: {}
    };

    // Estadísticas de cada servicio
    for (const [name, service] of Object.entries(this.services)) {
      if (service && typeof service.getStats === 'function') {
        try {
          stats.services[name] = service.getStats();
        } catch (error) {
          stats.services[name] = { error: error.message };
        }
      }
    }

    return stats;
  }

  /**
   * Obtener errores recientes
   */
  async getRecentErrors(limit = 50, criteria = {}) {
    if (this.services.buffer) {
      return this.services.buffer.search({ ...criteria, limit, recent: true });
    }
    return [];
  }

  /**
   * Inicializar temporizadores
   */
  startTimers() {
    // Timer para análisis periódico
    this.timers.analysis = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.config.analysisInterval);

    // Timer para monitoreo de rendimiento
    this.timers.performance = setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.config.performanceInterval);

    // Timer para limpieza
    this.timers.cleanup = setInterval(() => {
      this.performCleanup();
    }, 3600000); // cada hora
  }

  /**
   * Detener temporizadores
   */
  stopTimers() {
    if (this.timers.analysis) {
      clearInterval(this.timers.analysis);
      this.timers.analysis = null;
    }
    
    if (this.timers.performance) {
      clearInterval(this.timers.performance);
      this.timers.performance = null;
    }
    
    if (this.timers.cleanup) {
      clearInterval(this.timers.cleanup);
      this.timers.cleanup = null;
    }
  }

  /**
   * Análisis periódico
   */
  async performPeriodicAnalysis() {
    try {
      logger.debug('🔍 Realizando análisis periódico...');
      
      // Análisis de patrones
      if (this.services.patterns) {
        await this.services.patterns.performPeriodicAnalysis();
      }

      // Actualización de predicciones
      if (this.services.prediction) {
        await this.services.prediction.updatePredictions();
      }

      // Optimización del aprendizaje
      if (this.services.learning) {
        await this.services.learning.optimizeModels();
      }

      this.state.lastAnalysis = Date.now();
      
    } catch (error) {
      logger.error('Error en análisis periódico:', error);
    }
  }

  /**
   * Actualizar métricas de rendimiento
   */
  updatePerformanceMetrics() {
    // Las métricas se actualizan automáticamente en cada servicio
    // Este método puede usarse para métricas adicionales del agente principal
  }

  /**
   * Realizar limpieza
   */
  async performCleanup() {
    try {
      logger.debug('🧹 Realizando limpieza periódica...');
      
      // Limpiar cada servicio
      for (const service of Object.values(this.services)) {
        if (service && typeof service.cleanup === 'function') {
          await service.cleanup();
        }
      }
      
    } catch (error) {
      logger.error('Error en limpieza:', error);
    }
  }

  /**
   * Crear directorios necesarios
   */
  async ensureDirectories() {
    const directories = [
      this.config.logPath,
      path.join(this.config.logPath, 'archive'),
      path.join(this.config.logPath, 'state')
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }
  }

  /**
   * Cargar estado del agente
   */
  async loadAgentState() {
    try {
      const stateFile = path.join(this.config.logPath, 'state', 'agent-state.json');
      const data = await fs.readFile(stateFile, 'utf8');
      const savedState = JSON.parse(data);
      
      // Restaurar estado relevante
      this.state.errorCount = savedState.errorCount || 0;
      this.state.recoveryAttempts = savedState.recoveryAttempts || 0;
      this.state.learningIterations = savedState.learningIterations || 0;
      
      logger.debug('📂 Estado del agente cargado');
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('⚠️ Error cargando estado del agente:', error.message);
      }
    }
  }

  /**
   * Guardar estado del agente
   */
  async saveAgentState() {
    try {
      const stateFile = path.join(this.config.logPath, 'state', 'agent-state.json');
      const stateData = {
        timestamp: Date.now(),
        state: this.state,
        config: this.config
      };
      
      await fs.writeFile(stateFile, JSON.stringify(stateData, null, 2));
      logger.debug('💾 Estado del agente guardado');
      
    } catch (error) {
      logger.error('Error guardando estado del agente:', error);
    }
  }

  /**
   * Registrar error básico (fallback)
   */
  async logBasicError(severity, module, message, metadata) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${severity.toUpperCase()}] [${module}] ${message}`;
    
    logger.debug(logEntry);
    
    // Intentar escribir a archivo si es posible
    try {
      const logFile = path.join(this.config.logPath, 'fallback.log');
      await fs.appendFile(logFile, logEntry + '\n');
    } catch (error) {
      // Silenciar errores de escritura en fallback
    }
  }

  /**
   * Generar ID único para error
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generar ID de correlación
   */
  generateCorrelationId(module, message) {
    const hash = this.simpleHash(module + message);
    return `corr_${hash}_${Date.now()}`;
  }

  /**
   * Hash simple para correlación
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Sanitizar mensaje
   */
  sanitizeMessage(message) {
    if (typeof message !== 'string') {
      return String(message);
    }
    
    // Remover información sensible
    return message
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/token[=:]\s*\S+/gi, 'token=***')
      .replace(/key[=:]\s*\S+/gi, 'key=***')
      .replace(/secret[=:]\s*\S+/gi, 'secret=***');
  }

  /**
   * Sanitizar metadata
   */
  sanitizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }
    
    const sanitized = { ...metadata };
    
    // Remover campos sensibles
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });
    
    return sanitized;
  }

  /**
   * Obtener información del agente
   */
  getAgentInfo() {
    return {
      name: 'ErrorAgent',
      version: '2.0.0',
      description: 'Agente evolutivo de gestión inteligente de errores',
      features: [
        'Clasificación inteligente de errores',
        'Análisis de patrones y correlaciones',
        'Auto-recuperación inteligente',
        'Predicción de fallos',
        'Aprendizaje evolutivo',
        'Métricas y estadísticas avanzadas',
        'Gestión inteligente de buffers y logs'
      ],
      services: Object.keys(this.services),
      state: this.state,
      config: this.config
    };
  }

  /**
   * Limpiar recursos
   */
  async cleanup() {
    logger.debug('🧹 Limpiando recursos del ErrorAgent...');
    
    try {
      // Detener temporizadores
      this.stopTimers();
      
      // Limpiar servicios
      for (const service of Object.values(this.services)) {
        if (service && typeof service.stop === 'function') {
          await service.stop();
        }
      }
      
      // Guardar estado final
      await this.saveAgentState();
      
      logger.debug('✅ Limpieza completada');
      
    } catch (error) {
      logger.error('Error en limpieza:', error);
    }
  }

  /**
   * Destruir agente
   */
  async destroy() {
    logger.debug('💥 Destruyendo ErrorAgent...');
    
    try {
      // Limpiar recursos
      await this.cleanup();
      
      // Desactivar agente
      this.config.isActive = false;
      this.state.initialized = false;
      
      // Limpiar referencias
      this.services = {};
      
      logger.debug('✅ ErrorAgent destruido');
      
    } catch (error) {
      logger.error('Error destruyendo ErrorAgent:', error);
    }
  }
}

export default ErrorAgent;
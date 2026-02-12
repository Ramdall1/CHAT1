/**
 * AIAgent - Agente de IA Modular y Refactorizado
 * 
 * Coordina todos los servicios de IA especializados para proporcionar
 * una interfaz unificada y optimizada para interacciones con IA.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../core/core/logger.js';
import { CircuitBreaker } from './circuit-breaker/CircuitBreaker.js';
import { AIProviderManager } from './providers/AIProviderManager.js';
import { AICacheManager } from './cache/AICacheManager.js';
import { AIMonitoringService } from './monitoring/AIMonitoringService.js';
import { AIOptimizationEngine } from './optimization/AIOptimizationEngine.js';
import { AILearningSystem } from './learning/AILearningSystem.js';
import { AIQualityAssurance } from './quality/AIQualityAssurance.js';

const logger = createLogger('AI_AGENT');

export class AIAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: true,
      autoOptimize: true,
      enableLearning: true,
      enableQualityAssurance: true,
      enableCaching: true,
      enableMonitoring: true,
      maxConcurrentRequests: 10,
      defaultTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    // Estado del agente
    this.isActive = false;
    this.isInitialized = false;
    this.requestQueue = [];
    this.activeRequests = new Map();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalCost: 0,
      avgResponseTime: 0
    };

    // Inicializar servicios especializados
    this.initializeServices();
  }

  /**
   * Inicializar todos los servicios especializados
   */
  initializeServices() {
    try {
      // Circuit Breaker principal
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000
      });

      // Gestor de proveedores de IA
      this.providerManager = new AIProviderManager({
        providers: this.config.providers || {},
        defaultProvider: this.config.defaultProvider || 'openai',
        loadBalancing: this.config.loadBalancing || 'round_robin'
      });

      // Sistema de caché
      this.cacheManager = new AICacheManager({
        enabled: this.config.enableCaching,
        maxSize: this.config.cacheMaxSize || 1000,
        ttl: this.config.cacheTTL || 3600000, // 1 hora
        persistToDisk: true
      });

      // Servicio de monitoreo
      this.monitoringService = new AIMonitoringService({
        enabled: this.config.enableMonitoring,
        metricsRetention: this.config.metricsRetention || 7 * 24 * 60 * 60 * 1000, // 7 días
        alertThresholds: this.config.alertThresholds || {}
      });

      // Motor de optimización
      this.optimizationEngine = new AIOptimizationEngine({
        enabled: this.config.autoOptimize,
        optimizationInterval: this.config.optimizationInterval || 3600000, // 1 hora
        learningRate: this.config.learningRate || 0.01
      });

      // Sistema de aprendizaje
      this.learningSystem = new AILearningSystem({
        enabled: this.config.enableLearning,
        persistLearning: true,
        minSamples: this.config.minLearningSamples || 50
      });

      // Aseguramiento de calidad
      this.qualityAssurance = new AIQualityAssurance({
        enabled: this.config.enableQualityAssurance,
        minQualityScore: this.config.minQualityScore || 0.7,
        enableContentFiltering: true
      });

      logger.info('Servicios de IA inicializados correctamente');

    } catch (error) {
      logger.error('Error inicializando servicios de IA', error);
      throw error;
    }
  }

  /**
   * Inicializar el agente de IA
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('AIAgent ya está inicializado');
      return;
    }

    try {
      logger.info('Inicializando AIAgent...');

      // Inicializar servicios en orden
      await this.providerManager.initialize();
      await this.cacheManager.initialize();
      await this.monitoringService.initialize();
      await this.optimizationEngine.initialize();
      await this.learningSystem.initialize();

      // Configurar listeners de eventos
      this.setupEventListeners();

      // Marcar como inicializado
      this.isInitialized = true;
      this.isActive = this.config.enabled;

      logger.info('AIAgent inicializado correctamente');
      this.emit('agent:initialized');

    } catch (error) {
      logger.error('Error inicializando AIAgent', error);
      this.emit('agent:error', error);
      throw error;
    }
  }

  /**
   * Configurar listeners de eventos entre servicios
   */
  setupEventListeners() {
    // Eventos del proveedor
    this.providerManager.on('provider:selected', (data) => {
      this.emit('ai:provider_selected', data);
    });

    this.providerManager.on('provider:error', (error) => {
      this.monitoringService.recordError(error);
      this.emit('ai:error', error);
    });

    // Eventos de caché
    this.cacheManager.on('cache:hit', (data) => {
      this.monitoringService.recordCacheHit(data);
    });

    this.cacheManager.on('cache:miss', (data) => {
      this.monitoringService.recordCacheMiss(data);
    });

    // Eventos de monitoreo
    this.monitoringService.on('alert:triggered', (alert) => {
      logger.warn('Alerta de monitoreo', alert);
      this.emit('ai:alert', alert);
    });

    // Eventos de optimización
    this.optimizationEngine.on('optimization:completed', (results) => {
      logger.info('Optimización completada', results);
      this.emit('ai:optimized', results);
    });

    // Eventos de aprendizaje
    this.learningSystem.on('adaptation:generated', (adaptation) => {
      logger.info('Nueva adaptación generada', adaptation);
      this.emit('ai:adaptation', adaptation);
    });

    // Eventos de calidad
    this.qualityAssurance.on('quality:evaluated', (evaluation) => {
      this.monitoringService.recordQualityMetrics(evaluation);
    });
  }

  /**
   * Procesar solicitud de IA
   */
  async processRequest(prompt, options = {}) {
    if (!this.isActive || !this.isInitialized) {
      throw new Error('AIAgent no está activo o inicializado');
    }

    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      // Verificar circuit breaker
      if (!this.circuitBreaker.canExecute()) {
        throw new Error('Circuit breaker abierto - servicio temporalmente no disponible');
      }

      // Preparar contexto de solicitud
      const requestContext = {
        requestId,
        prompt,
        options,
        timestamp: startTime,
        userId: options.userId,
        sessionId: options.sessionId
      };

      // Registrar solicitud
      this.activeRequests.set(requestId, requestContext);
      this.stats.totalRequests++;

      logger.debug('Procesando solicitud de IA', { requestId, promptLength: prompt.length });

      // Verificar caché primero
      let response = null;
      if (this.config.enableCaching) {
        response = await this.cacheManager.get(prompt, options);
        if (response) {
          logger.debug('Respuesta obtenida del caché', { requestId });
          return await this.handleCachedResponse(requestContext, response);
        }
      }

      // Obtener recomendaciones de aprendizaje
      let recommendations = null;
      if (this.config.enableLearning) {
        recommendations = this.learningSystem.getRecommendations(
          prompt, 
          options.context, 
          options.userId
        );
      }

      // Seleccionar proveedor y modelo
      const providerSelection = await this.selectProvider(prompt, options, recommendations);

      // Ejecutar solicitud
      response = await this.executeRequest(requestContext, providerSelection);

      // Evaluar calidad si está habilitado
      if (this.config.enableQualityAssurance) {
        const qualityEvaluation = await this.qualityAssurance.evaluateResponse(
          prompt, 
          response.content, 
          options.context
        );

        if (!qualityEvaluation.passed) {
          logger.warn('Respuesta no pasó evaluación de calidad', {
            requestId,
            score: qualityEvaluation.score,
            flags: qualityEvaluation.flags
          });

          // Intentar con otro proveedor si la calidad es muy baja
          if (qualityEvaluation.score < 0.5 && this.config.retryAttempts > 0) {
            return await this.retryWithDifferentProvider(requestContext, providerSelection);
          }
        }

        response.quality = qualityEvaluation;
      }

      // Guardar en caché
      if (this.config.enableCaching && response.quality?.passed !== false) {
        await this.cacheManager.set(prompt, options, response);
      }

      // Registrar métricas
      await this.recordRequestMetrics(requestContext, response, true);

      // Aprender de la interacción
      if (this.config.enableLearning) {
        await this.learningSystem.learnFromInteraction({
          userId: options.userId,
          prompt,
          context: options.context,
          provider: providerSelection.provider,
          model: providerSelection.model,
          response: response.content,
          responseTime: Date.now() - startTime,
          cost: response.cost || 0,
          success: true
        });
      }

      // Registrar éxito en circuit breaker
      this.circuitBreaker.recordSuccess();

      logger.debug('Solicitud procesada exitosamente', { 
        requestId, 
        responseTime: Date.now() - startTime 
      });

      return response;

    } catch (error) {
      // Registrar fallo en circuit breaker
      this.circuitBreaker.recordFailure();

      // Registrar métricas de error
      await this.recordRequestMetrics(requestContext, null, false, error);

      logger.error('Error procesando solicitud de IA', { requestId, error: error.message });
      
      this.emit('ai:error', { requestId, error });
      throw error;

    } finally {
      // Limpiar solicitud activa
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Seleccionar proveedor y modelo óptimo
   */
  async selectProvider(prompt, options, recommendations) {
    try {
      // Usar recomendaciones de aprendizaje si están disponibles
      if (recommendations && recommendations.confidence > 0.7) {
        logger.debug('Usando recomendaciones de aprendizaje', recommendations);
        return {
          provider: recommendations.provider,
          model: recommendations.model,
          reasoning: recommendations.reasoning
        };
      }

      // Usar motor de optimización
      if (this.config.autoOptimize) {
        const optimization = await this.optimizationEngine.getOptimalConfiguration(prompt, options);
        if (optimization.confidence > 0.6) {
          return optimization;
        }
      }

      // Selección por defecto del gestor de proveedores
      return await this.providerManager.selectOptimalProvider(prompt, options);

    } catch (error) {
      logger.warn('Error en selección de proveedor, usando por defecto', error);
      return await this.providerManager.getDefaultProvider();
    }
  }

  /**
   * Ejecutar solicitud con el proveedor seleccionado
   */
  async executeRequest(requestContext, providerSelection) {
    const { requestId, prompt, options } = requestContext;
    
    try {
      // Obtener proveedor
      const provider = await this.providerManager.getProvider(providerSelection.provider);
      
      if (!provider) {
        throw new Error(`Proveedor no disponible: ${providerSelection.provider}`);
      }

      // Configurar parámetros de solicitud
      const requestParams = {
        prompt,
        model: providerSelection.model,
        maxTokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        timeout: options.timeout || this.config.defaultTimeout,
        ...options.providerOptions
      };

      // Ejecutar solicitud
      const startTime = Date.now();
      const response = await provider.generateResponse(requestParams);
      const responseTime = Date.now() - startTime;

      // Registrar métricas en monitoreo
      await this.monitoringService.recordRequest({
        requestId,
        provider: providerSelection.provider,
        model: providerSelection.model,
        promptTokens: this.estimateTokens(prompt),
        responseTokens: this.estimateTokens(response.content),
        responseTime,
        cost: response.cost || 0,
        success: true
      });

      return {
        content: response.content,
        provider: providerSelection.provider,
        model: providerSelection.model,
        responseTime,
        cost: response.cost || 0,
        metadata: response.metadata || {}
      };

    } catch (error) {
      // Registrar error en monitoreo
      await this.monitoringService.recordError({
        requestId,
        provider: providerSelection.provider,
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Manejar respuesta desde caché
   */
  async handleCachedResponse(requestContext, cachedResponse) {
    const { requestId } = requestContext;
    
    // Registrar métricas de caché
    await this.monitoringService.recordRequest({
      requestId,
      provider: 'cache',
      model: 'cached',
      responseTime: 1, // Tiempo mínimo para caché
      cost: 0,
      success: true,
      fromCache: true
    });

    this.stats.successfulRequests++;

    return {
      ...cachedResponse,
      fromCache: true,
      responseTime: 1
    };
  }

  /**
   * Reintentar con proveedor diferente
   */
  async retryWithDifferentProvider(requestContext, originalSelection) {
    logger.info('Reintentando con proveedor diferente', { 
      requestId: requestContext.requestId,
      originalProvider: originalSelection.provider 
    });

    try {
      // Obtener proveedor alternativo
      const alternativeSelection = await this.providerManager.selectAlternativeProvider(
        originalSelection.provider,
        requestContext.prompt,
        requestContext.options
      );

      if (!alternativeSelection) {
        throw new Error('No hay proveedores alternativos disponibles');
      }

      // Ejecutar con proveedor alternativo
      return await this.executeRequest(requestContext, alternativeSelection);

    } catch (error) {
      logger.error('Error en reintento con proveedor alternativo', error);
      throw error;
    }
  }

  /**
   * Registrar métricas de solicitud
   */
  async recordRequestMetrics(requestContext, response, success, error = null) {
    const responseTime = Date.now() - requestContext.timestamp;
    
    if (success) {
      this.stats.successfulRequests++;
      this.stats.totalCost += response?.cost || 0;
    } else {
      this.stats.failedRequests++;
    }

    // Actualizar tiempo promedio de respuesta
    this.stats.avgResponseTime = (
      (this.stats.avgResponseTime * (this.stats.totalRequests - 1) + responseTime) / 
      this.stats.totalRequests
    );

    // Emitir evento de métricas
    this.emit('ai:metrics', {
      requestId: requestContext.requestId,
      success,
      responseTime,
      cost: response?.cost || 0,
      error: error?.message
    });
  }

  /**
   * Estimar tokens (implementación básica)
   */
  estimateTokens(text) {
    // Estimación aproximada: ~4 caracteres por token
    return Math.ceil(text.length / 4);
  }

  /**
   * Generar ID único de solicitud
   */
  generateRequestId() {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtener estadísticas del agente
   */
  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      isInitialized: this.isInitialized,
      activeRequests: this.activeRequests.size,
      circuitBreakerState: this.circuitBreaker.getState(),
      services: {
        cache: this.cacheManager.getStats(),
        monitoring: this.monitoringService.getStats(),
        learning: this.learningSystem.getLearningStats(),
        quality: this.qualityAssurance.getQualityStats()
      }
    };
  }

  /**
   * Obtener métricas detalladas
   */
  async getDetailedMetrics() {
    return {
      agent: this.getStats(),
      providers: await this.providerManager.getProviderStats(),
      cache: this.cacheManager.getDetailedStats(),
      monitoring: await this.monitoringService.getDetailedMetrics(),
      optimization: this.optimizationEngine.getOptimizationStats(),
      learning: this.learningSystem.getLearningStats(),
      quality: this.qualityAssurance.getQualityStats()
    };
  }

  /**
   * Configurar proveedor
   */
  async configureProvider(providerName, config) {
    return await this.providerManager.configureProvider(providerName, config);
  }

  /**
   * Activar/desactivar agente
   */
  setActive(active) {
    this.isActive = active;
    logger.info(`AIAgent ${active ? 'activado' : 'desactivado'}`);
    this.emit('agent:status_changed', { active });
  }

  /**
   * Limpiar caché
   */
  async clearCache() {
    if (this.cacheManager) {
      await this.cacheManager.clear();
      logger.info('Caché de IA limpiado');
    }
  }

  /**
   * Exportar datos de aprendizaje
   */
  async exportLearningData() {
    if (this.learningSystem) {
      return await this.learningSystem.exportLearningData();
    }
    return null;
  }

  /**
   * Importar datos de aprendizaje
   */
  async importLearningData(data) {
    if (this.learningSystem) {
      return await this.learningSystem.importLearningData(data);
    }
  }

  /**
   * Cerrar agente y limpiar recursos
   */
  async shutdown() {
    logger.info('Cerrando AIAgent...');

    try {
      // Esperar a que terminen las solicitudes activas
      if (this.activeRequests.size > 0) {
        logger.info(`Esperando ${this.activeRequests.size} solicitudes activas...`);
        await this.waitForActiveRequests();
      }

      // Cerrar servicios
      if (this.learningSystem) await this.learningSystem.shutdown();
      if (this.cacheManager) await this.cacheManager.shutdown();
      if (this.monitoringService) await this.monitoringService.shutdown();
      if (this.optimizationEngine) await this.optimizationEngine.shutdown();

      this.isActive = false;
      this.isInitialized = false;

      logger.info('AIAgent cerrado correctamente');
      this.emit('agent:shutdown');

    } catch (error) {
      logger.error('Error cerrando AIAgent', error);
      throw error;
    }
  }

  /**
   * Esperar a que terminen las solicitudes activas
   */
  async waitForActiveRequests(timeout = 30000) {
    const startTime = Date.now();
    
    while (this.activeRequests.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.activeRequests.size > 0) {
      logger.warn(`Timeout esperando solicitudes activas: ${this.activeRequests.size} restantes`);
    }
  }
}

export default AIAgent;
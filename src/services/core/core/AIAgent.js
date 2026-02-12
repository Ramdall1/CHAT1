/**
 * AIAgent - Agente Event-Driven de Gestión Inteligente de IA
 * 
 * Transforma el AIService en un agente evolutivo que:
 * - Gestiona múltiples proveedores de IA de forma inteligente
 * - Optimiza automáticamente la selección de modelos
 * - Aprende de patrones de uso y feedback
 * - Predice necesidades de recursos
 * - Auto-optimiza prompts y parámetros
 * - Gestiona cache inteligente y rate limiting
 * - Monitorea calidad y rendimiento en tiempo real
 * - Implementa circuit breakers y failover
 * - Correlaciona contextos y conversaciones
 * - Sugiere mejoras automáticas
 */

import { EventEmitter } from 'events';
import { getDatabase } from './database.js';
import { createLogger } from './logger.js';
import { CONFIG } from '../../../workflows/index.js';
import { AIResponse } from '../core/AIResponse.js';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('AI_AGENT');

export class AIAgent extends EventEmitter {
  constructor() {
    super();
    
    // Configuración evolutiva del agente
    this.config = {
      // Configuración de proveedores inteligente
      providers: {
        openai: {
          enabled: true,
          priority: 1,
          models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
          costPerToken: { 'gpt-4': 0.00003, 'gpt-3.5-turbo': 0.000002 },
          maxTokens: { 'gpt-4': 8192, 'gpt-3.5-turbo': 4096 },
          reliability: 0.95,
          avgResponseTime: 2000
        },
        anthropic: {
          enabled: true,
          priority: 2,
          models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
          costPerToken: { 'claude-3-opus': 0.000015, 'claude-3-sonnet': 0.000003 },
          maxTokens: { 'claude-3-opus': 200000, 'claude-3-sonnet': 200000 },
          reliability: 0.93,
          avgResponseTime: 2500
        },
        google: {
          enabled: true,
          priority: 3,
          models: ['gemini-pro', 'gemini-pro-vision'],
          costPerToken: { 'gemini-pro': 0.000001 },
          maxTokens: { 'gemini-pro': 32768 },
          reliability: 0.90,
          avgResponseTime: 3000
        },
        local: {
          enabled: true,
          priority: 4,
          models: ['llama-2-7b', 'mistral-7b'],
          costPerToken: { 'llama-2-7b': 0, 'mistral-7b': 0 },
          maxTokens: { 'llama-2-7b': 4096, 'mistral-7b': 8192 },
          reliability: 0.85,
          avgResponseTime: 5000
        }
      },
      
      // Configuración de optimización inteligente
      optimization: {
        autoModelSelection: true,
        dynamicPromptOptimization: true,
        contextualCaching: true,
        predictivePreloading: true,
        adaptiveRateLimiting: true,
        qualityBasedRouting: true,
        costOptimization: true,
        performanceMonitoring: true
      },
      
      // Configuración de aprendizaje
      learning: {
        enablePatternLearning: true,
        enableFeedbackLearning: true,
        enableUsageOptimization: true,
        enableContextCorrelation: true,
        learningRate: 0.1,
        memoryWindow: 10000,
        adaptationThreshold: 0.8
      },
      
      // Configuración de cache inteligente
      cache: {
        enabled: true,
        maxSize: 10000,
        ttl: 3600000, // 1 hora
        intelligentEviction: true,
        contextualMatching: true,
        similarityThreshold: 0.85
      },
      
      // Configuración de circuit breakers
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringWindow: 300000
      },
      
      // Configuración de rate limiting adaptativo
      rateLimiting: {
        enabled: true,
        baseLimit: 100,
        windowMs: 60000,
        adaptiveScaling: true,
        priorityQueuing: true
      }
    };
    
    // Estado del agente
    this.state = {
      active: false,
      initialized: false,
      lastActivity: null,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      currentLoad: 0
    };
    
    // Registro de proveedores y modelos
    this.providers = new Map();
    this.models = new Map();
    this.activeConnections = new Map();
    
    // Sistema de cache inteligente
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // Sistema de rate limiting adaptativo
    this.rateLimits = new Map();
    this.requestQueues = new Map();
    
    // Métricas evolutivas
    this.metrics = {
      performance: {
        responseTime: [],
        throughput: [],
        errorRate: [],
        qualityScore: []
      },
      usage: {
        byProvider: new Map(),
        byModel: new Map(),
        byContext: new Map(),
        byUser: new Map()
      },
      learning: {
        patterns: new Map(),
        optimizations: new Map(),
        predictions: new Map()
      },
      costs: {
        total: 0,
        byProvider: new Map(),
        byModel: new Map(),
        savings: 0
      }
    };
    
    // Circuit breakers por proveedor
    this.circuitBreakers = new Map();
    
    // Sistema de aprendizaje
    this.learningEngine = {
      patterns: new Map(),
      contextCorrelations: new Map(),
      userPreferences: new Map(),
      modelPerformance: new Map()
    };
    
    // Timers para tareas periódicas
    this.timers = {
      optimization: null,
      monitoring: null,
      learning: null,
      cleanup: null,
      healthCheck: null
    };
    
    // Sistema de mutex para operaciones críticas
    this.mutex = {
      cache: false,
      learning: false,
      optimization: false
    };
    
    // Base de datos y logger
    this.db = null;
    this.logger = logger;
    
    this.setupEventListeners();
  }
  
  /**
   * Configurar listeners de eventos del sistema
   */
  setupEventListeners() {
    // Eventos del sistema
    this.on('system:start', this.handleSystemStart.bind(this));
    this.on('system:stop', this.handleSystemStop.bind(this));
    this.on('system:error', this.handleSystemError.bind(this));
    
    // Eventos de IA
    this.on('ai:request', this.handleAIRequest.bind(this));
    this.on('ai:response', this.handleAIResponse.bind(this));
    this.on('ai:error', this.handleAIError.bind(this));
    this.on('ai:feedback', this.handleAIFeedback.bind(this));
    
    // Eventos de optimización
    this.on('optimization:trigger', this.handleOptimizationTrigger.bind(this));
    this.on('performance:alert', this.handlePerformanceAlert.bind(this));
    this.on('cost:alert', this.handleCostAlert.bind(this));
    
    // Eventos de aprendizaje
    this.on('learning:pattern', this.handleLearningPattern.bind(this));
    this.on('learning:update', this.handleLearningUpdate.bind(this));
  }
  
  /**
   * Inicializar el agente
   */
  async initialize() {
    try {
      this.logger.info('Inicializando AIAgent...');
      
      // Inicializar base de datos
      this.db = getDatabase();
      
      // Inicializar proveedores
      await this.initializeProviders();
      
      // Cargar estado previo
      await this.loadAgentState();
      
      // Cargar patrones de aprendizaje
      await this.loadLearningPatterns();
      
      // Inicializar circuit breakers
      this.initializeCircuitBreakers();
      
      // Iniciar monitoreo
      this.startMonitoring();
      
      // Iniciar optimización
      this.startOptimization();
      
      // Iniciar aprendizaje
      this.startLearning();
      
      this.state.initialized = true;
      this.logger.info('AIAgent inicializado correctamente');
      
      this.emit('agent:initialized', { agentId: 'ai-agent' });
      
    } catch (error) {
      this.logger.error('Error inicializando AIAgent', error);
      throw error;
    }
  }
  
  /**
   * Activar el agente
   */
  async setActive(active) {
    this.state.active = active;
    this.state.lastActivity = new Date().toISOString();
    
    if (active) {
      this.logger.info('AIAgent activado');
      this.emit('agent:activated', { agentId: 'ai-agent' });
    } else {
      this.logger.info('AIAgent desactivado');
      this.emit('agent:deactivated', { agentId: 'ai-agent' });
    }
  }
  
  /**
   * Manejar inicio del sistema
   */
  async handleSystemStart(data) {
    this.logger.info('Sistema iniciado, activando AIAgent');
    await this.setActive(true);
  }
  
  /**
   * Manejar parada del sistema
   */
  async handleSystemStop(data) {
    this.logger.info('Sistema deteniéndose, desactivando AIAgent');
    await this.setActive(false);
    await this.shutdown();
  }
  
  /**
   * Manejar errores del sistema
   */
  async handleSystemError(data) {
    this.logger.error('Error del sistema detectado', data);
    
    // Implementar estrategias de recuperación
    if (data.severity === 'critical') {
      await this.handleCriticalError(data);
    }
  }
  
  /**
   * Manejar solicitud de IA
   */
  async handleAIRequest(data) {
    try {
      const { requestId, prompt, context, options = {} } = data;
      
      this.logger.info('Procesando solicitud de IA', { requestId });
      
      // Verificar rate limiting
      if (!this.checkRateLimit(context.contactId)) {
        throw new Error('Rate limit excedido');
      }
      
      // Buscar en cache
      const cacheKey = this.generateCacheKey(prompt, context, options.model);
      const cachedResponse = this.getCachedResponse(cacheKey);
      
      if (cachedResponse) {
        this.cacheStats.hits++;
        this.emit('ai:response', {
          requestId,
          response: cachedResponse,
          fromCache: true
        });
        return;
      }
      
      this.cacheStats.misses++;
      
      // Seleccionar proveedor y modelo óptimo
      const { provider, model } = await this.selectOptimalProvider(prompt, context, options);
      
      // Generar respuesta
      const response = await this.generateResponse({
        prompt,
        context,
        provider,
        model,
        ...options
      });
      
      // Guardar en cache
      this.setCachedResponse(cacheKey, response);
      
      // Actualizar métricas
      this.updateMetrics(provider, model, response);
      
      // Actualizar rate limiting
      this.updateRateLimit(context.contactId);
      
      this.emit('ai:response', {
        requestId,
        response,
        provider,
        model,
        fromCache: false
      });
      
    } catch (error) {
      this.logger.error('Error procesando solicitud de IA', error);
      this.emit('ai:error', { requestId: data.requestId, error });
    }
  }
  
  /**
   * Manejar respuesta de IA
   */
  async handleAIResponse(data) {
    const { requestId, response, provider, model } = data;
    
    // Registrar respuesta en base de datos
    await this.saveResponse(response);
    
    // Actualizar estadísticas
    this.state.totalRequests++;
    this.state.successfulRequests++;
    this.state.lastActivity = new Date().toISOString();
    
    // Aprender de la respuesta
    if (this.config.learning.enablePatternLearning) {
      this.learnFromResponse(response, provider, model);
    }
    
    this.logger.info('Respuesta de IA procesada', { requestId, provider, model });
  }
  
  /**
   * Manejar error de IA
   */
  async handleAIError(data) {
    const { requestId, error, provider } = data;
    
    this.state.failedRequests++;
    
    // Actualizar circuit breaker
    if (provider && this.circuitBreakers.has(provider)) {
      this.circuitBreakers.get(provider).recordFailure();
    }
    
    // Intentar con proveedor alternativo
    if (provider) {
      await this.tryAlternativeProvider(data);
    }
    
    this.logger.error('Error de IA manejado', { requestId, error, provider });
  }
  
  /**
   * Manejar feedback de IA
   */
  async handleAIFeedback(data) {
    const { responseId, feedback } = data;
    
    try {
      // Actualizar respuesta con feedback
      await this.updateResponseFeedback(responseId, feedback);
      
      // Aprender del feedback
      if (this.config.learning.enableFeedbackLearning) {
        this.learnFromFeedback(responseId, feedback);
      }
      
      this.logger.info('Feedback de IA procesado', { responseId, feedback });
      
    } catch (error) {
      this.logger.error('Error procesando feedback', error);
    }
  }
  
  /**
   * Inicializar proveedores de IA
   */
  async initializeProviders() {
    for (const [name, config] of Object.entries(this.config.providers)) {
      if (config.enabled) {
        const provider = await this.createProvider(name, config);
        this.providers.set(name, provider);
        
        // Inicializar modelos del proveedor
        for (const model of config.models) {
          this.models.set(`${name}:${model}`, {
            provider: name,
            model,
            config: config
          });
        }
      }
    }
    
    this.logger.info(`Inicializados ${this.providers.size} proveedores de IA`);
  }
  
  /**
   * Crear proveedor específico
   */
  async createProvider(name, config) {
    switch (name) {
    case 'openai':
      return this.createOpenAIProvider(config);
    case 'anthropic':
      return this.createAnthropicProvider(config);
    case 'google':
      return this.createGoogleProvider(config);
    case 'local':
      return this.createLocalProvider(config);
    default:
      throw new Error(`Proveedor desconocido: ${name}`);
    }
  }
  
  /**
   * Crear proveedor OpenAI
   */
  createOpenAIProvider(config) {
    return {
      name: 'openai',
      config,
      async generateResponse(options) {
        const { prompt, model = 'gpt-3.5-turbo', temperature = 0.7, maxTokens = 1000 } = options;
        
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens
        }, {
          headers: {
            'Authorization': `Bearer ${CONFIG.ai.openai.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        return {
          response: response.data.choices[0].message.content,
          tokens: {
            prompt: response.data.usage.prompt_tokens,
            completion: response.data.usage.completion_tokens,
            total: response.data.usage.total_tokens
          },
          confidence: 0.8,
          model,
          provider: 'openai'
        };
      }
    };
  }
  
  /**
   * Crear proveedor Anthropic
   */
  createAnthropicProvider(config) {
    return {
      name: 'anthropic',
      config,
      async generateResponse(options) {
        // Implementación para Anthropic Claude
        const { prompt, model = 'claude-3-sonnet', temperature = 0.7, maxTokens = 1000 } = options;
        
        // Placeholder - implementar API real de Anthropic
        return {
          response: `Respuesta de Claude (${model}): ${prompt.substring(0, 100)}...`,
          tokens: { prompt: 50, completion: 100, total: 150 },
          confidence: 0.85,
          model,
          provider: 'anthropic'
        };
      }
    };
  }
  
  /**
   * Crear proveedor Google
   */
  createGoogleProvider(config) {
    return {
      name: 'google',
      config,
      async generateResponse(options) {
        // Implementación para Google Gemini
        const { prompt, model = 'gemini-pro', temperature = 0.7, maxTokens = 1000 } = options;
        
        // Placeholder - implementar API real de Google
        return {
          response: `Respuesta de Gemini (${model}): ${prompt.substring(0, 100)}...`,
          tokens: { prompt: 40, completion: 80, total: 120 },
          confidence: 0.75,
          model,
          provider: 'google'
        };
      }
    };
  }
  
  /**
   * Crear proveedor local
   */
  createLocalProvider(config) {
    return {
      name: 'local',
      config,
      async generateResponse(options) {
        const { prompt, model = 'llama-2-7b', temperature = 0.7, maxTokens = 1000 } = options;
        
        // Simulación de modelo local
        return {
          response: `Respuesta local (${model}): ${prompt.substring(0, 100)}...`,
          tokens: { prompt: 30, completion: 60, total: 90 },
          confidence: 0.6,
          model,
          provider: 'local'
        };
      }
    };
  }
  
  /**
   * Seleccionar proveedor y modelo óptimo
   */
  async selectOptimalProvider(prompt, context, options = {}) {
    // Si se especifica un proveedor/modelo, usarlo
    if (options.provider && options.model) {
      return { provider: options.provider, model: options.model };
    }
    
    // Análisis inteligente para selección óptima
    const analysis = await this.analyzeRequest(prompt, context);
    
    // Filtrar proveedores disponibles
    const availableProviders = Array.from(this.providers.entries())
      .filter(([name, provider]) => {
        const circuitBreaker = this.circuitBreakers.get(name);
        return !circuitBreaker || circuitBreaker.canExecute();
      })
      .sort((a, b) => {
        const configA = this.config.providers[a[0]];
        const configB = this.config.providers[b[0]];
        
        // Ordenar por prioridad, confiabilidad y costo
        const scoreA = this.calculateProviderScore(a[0], analysis);
        const scoreB = this.calculateProviderScore(b[0], analysis);
        
        return scoreB - scoreA;
      });
    
    if (availableProviders.length === 0) {
      throw new Error('No hay proveedores disponibles');
    }
    
    const selectedProvider = availableProviders[0][0];
    const selectedModel = this.selectOptimalModel(selectedProvider, analysis);
    
    return { provider: selectedProvider, model: selectedModel };
  }
  
  /**
   * Analizar solicitud para optimización
   */
  async analyzeRequest(prompt, context) {
    return {
      complexity: this.analyzeComplexity(prompt),
      urgency: this.analyzeUrgency(context),
      costSensitivity: this.analyzeCostSensitivity(context),
      qualityRequirement: this.analyzeQualityRequirement(context),
      tokenEstimate: this.estimateTokens(prompt),
      contextSize: this.calculateContextSize(context)
    };
  }
  
  /**
   * Calcular puntuación de proveedor
   */
  calculateProviderScore(providerName, analysis) {
    const config = this.config.providers[providerName];
    const metrics = this.metrics.usage.byProvider.get(providerName) || {};
    
    let score = 0;
    
    // Factor de confiabilidad
    score += config.reliability * 30;
    
    // Factor de velocidad (inverso del tiempo de respuesta)
    score += (5000 - config.avgResponseTime) / 100;
    
    // Factor de costo (inverso del costo)
    if (analysis.costSensitivity > 0.7) {
      const avgCost = Object.values(config.costPerToken).reduce((a, b) => a + b, 0) / Object.values(config.costPerToken).length;
      score += (0.00005 - avgCost) * 1000000;
    }
    
    // Factor de calidad histórica
    if (metrics.avgQuality) {
      score += metrics.avgQuality * 20;
    }
    
    // Factor de disponibilidad
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (circuitBreaker && !circuitBreaker.canExecute()) {
      score -= 50;
    }
    
    return score;
  }
  
  /**
   * Seleccionar modelo óptimo para proveedor
   */
  selectOptimalModel(providerName, analysis) {
    const config = this.config.providers[providerName];
    const models = config.models;
    
    // Seleccionar modelo basado en complejidad y requisitos
    if (analysis.complexity > 0.8 || analysis.qualityRequirement > 0.8) {
      // Usar modelo más potente
      return models[0];
    } else if (analysis.costSensitivity > 0.7) {
      // Usar modelo más económico
      return models[models.length - 1];
    } else {
      // Usar modelo balanceado
      return models[Math.floor(models.length / 2)];
    }
  }
  
  /**
   * Generar respuesta con proveedor seleccionado
   */
  async generateResponse(options) {
    const { provider, model, prompt, context } = options;
    
    const startTime = Date.now();
    
    try {
      const providerInstance = this.providers.get(provider);
      if (!providerInstance) {
        throw new Error(`Proveedor no encontrado: ${provider}`);
      }
      
      // Construir prompt optimizado
      const optimizedPrompt = await this.optimizePrompt(prompt, context);
      
      // Generar respuesta
      const result = await providerInstance.generateResponse({
        ...options,
        prompt: optimizedPrompt,
        model
      });
      
      const processingTime = Date.now() - startTime;
      
      // Crear objeto AIResponse
      const aiResponse = new AIResponse({
        prompt: optimizedPrompt,
        response: result.response,
        provider,
        model,
        tokens: result.tokens,
        confidence: result.confidence,
        processingTime,
        context,
        cost: this.calculateCost(provider, model, result.tokens)
      });
      
      // Evaluar calidad
      await this.evaluateQuality(aiResponse);
      
      return aiResponse;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Registrar fallo en circuit breaker
      const circuitBreaker = this.circuitBreakers.get(provider);
      if (circuitBreaker) {
        circuitBreaker.recordFailure();
      }
      
      this.logger.error(`Error generando respuesta con ${provider}:${model}`, error);
      throw error;
    }
  }
  
  /**
   * Optimizar prompt basado en patrones aprendidos
   */
  async optimizePrompt(prompt, context) {
    if (!this.config.optimization.dynamicPromptOptimization) {
      return prompt;
    }
    
    // Buscar optimizaciones aprendidas
    const optimizations = this.learningEngine.patterns.get('prompt_optimization') || [];
    
    let optimizedPrompt = prompt;
    
    for (const optimization of optimizations) {
      if (optimization.confidence > 0.8) {
        optimizedPrompt = optimization.apply(optimizedPrompt, context);
      }
    }
    
    return optimizedPrompt;
  }
  
  /**
   * Calcular costo de respuesta
   */
  calculateCost(provider, model, tokens) {
    const config = this.config.providers[provider];
    const costPerToken = config.costPerToken[model] || 0;
    
    return (tokens.total || 0) * costPerToken;
  }
  
  /**
   * Evaluar calidad de respuesta
   */
  async evaluateQuality(aiResponse) {
    // Evaluación multi-dimensional de calidad
    const quality = {
      relevance: await this.evaluateRelevance(aiResponse),
      coherence: await this.evaluateCoherence(aiResponse),
      helpfulness: await this.evaluateHelpfulness(aiResponse),
      safety: await this.evaluateSafety(aiResponse),
      accuracy: await this.evaluateAccuracy(aiResponse)
    };
    
    // Calcular puntuación general
    const overallScore = Object.values(quality).reduce((sum, score) => sum + score, 0) / Object.keys(quality).length;
    
    aiResponse.updateQuality({ ...quality, overall: overallScore });
    
    return quality;
  }
  
  /**
   * Evaluar relevancia
   */
  async evaluateRelevance(aiResponse) {
    // Implementación básica - mejorar con ML
    const promptLength = aiResponse.prompt.length;
    const responseLength = aiResponse.response.length;
    
    // Heurística simple
    if (responseLength < promptLength * 0.5) return 0.6;
    if (responseLength > promptLength * 5) return 0.7;
    return 0.8;
  }
  
  /**
   * Evaluar coherencia
   */
  async evaluateCoherence(aiResponse) {
    // Implementación básica
    const sentences = aiResponse.response.split(/[.!?]+/).filter(s => s.trim());
    return Math.min(0.9, 0.5 + (sentences.length * 0.1));
  }
  
  /**
   * Evaluar utilidad
   */
  async evaluateHelpfulness(aiResponse) {
    // Implementación básica
    const hasActionableContent = /\b(should|could|try|consider|recommend)\b/i.test(aiResponse.response);
    return hasActionableContent ? 0.8 : 0.6;
  }
  
  /**
   * Evaluar seguridad
   */
  async evaluateSafety(aiResponse) {
    // Implementación básica de filtros de seguridad
    const unsafePatterns = [
      /\b(hack|exploit|illegal|harmful)\b/i,
      /\b(violence|weapon|drug)\b/i
    ];
    
    for (const pattern of unsafePatterns) {
      if (pattern.test(aiResponse.response)) {
        return 0.3;
      }
    }
    
    return 0.9;
  }
  
  /**
   * Evaluar precisión
   */
  async evaluateAccuracy(aiResponse) {
    // Implementación básica - mejorar con fact-checking
    return 0.75; // Placeholder
  }
  
  /**
   * Inicializar circuit breakers
   */
  initializeCircuitBreakers() {
    for (const providerName of this.providers.keys()) {
      this.circuitBreakers.set(providerName, new CircuitBreaker({
        failureThreshold: this.config.circuitBreaker.failureThreshold,
        resetTimeout: this.config.circuitBreaker.resetTimeout,
        monitoringWindow: this.config.circuitBreaker.monitoringWindow
      }));
    }
  }
  
  /**
   * Verificar rate limit
   */
  checkRateLimit(contactId) {
    if (!this.config.rateLimiting.enabled) return true;
    
    const now = Date.now();
    const limit = this.rateLimits.get(contactId);
    
    if (!limit) return true;
    
    const windowMs = this.config.rateLimiting.windowMs;
    const maxRequests = this.calculateAdaptiveLimit(contactId);
    
    const validRequests = limit.requests.filter(time => now - time < windowMs);
    
    return validRequests.length < maxRequests;
  }
  
  /**
   * Calcular límite adaptativo
   */
  calculateAdaptiveLimit(contactId) {
    const baseLimit = this.config.rateLimiting.baseLimit;
    
    if (!this.config.rateLimiting.adaptiveScaling) {
      return baseLimit;
    }
    
    // Ajustar límite basado en historial del usuario
    const userMetrics = this.metrics.usage.byUser.get(contactId);
    if (userMetrics && userMetrics.avgQualityFeedback > 0.8) {
      return Math.floor(baseLimit * 1.5); // Aumentar límite para usuarios de alta calidad
    }
    
    return baseLimit;
  }
  
  /**
   * Actualizar rate limit
   */
  updateRateLimit(contactId) {
    const now = Date.now();
    const limit = this.rateLimits.get(contactId) || { requests: [] };
    
    limit.requests.push(now);
    
    // Mantener solo requests de la ventana actual
    const windowMs = this.config.rateLimiting.windowMs;
    limit.requests = limit.requests.filter(time => now - time < windowMs);
    
    this.rateLimits.set(contactId, limit);
  }
  
  /**
   * Obtener respuesta del cache
   */
  getCachedResponse(cacheKey) {
    if (!this.config.cache.enabled) return null;
    
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    // Verificar TTL
    if (Date.now() - cached.timestamp > this.config.cache.ttl) {
      this.cache.delete(cacheKey);
      this.cacheStats.evictions++;
      return null;
    }
    
    return cached.response;
  }
  
  /**
   * Guardar respuesta en cache
   */
  setCachedResponse(cacheKey, response) {
    if (!this.config.cache.enabled) return;
    
    // Verificar límite de tamaño
    if (this.cache.size >= this.config.cache.maxSize) {
      this.evictCacheEntries();
    }
    
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      accessCount: 0
    });
  }
  
  /**
   * Evictar entradas del cache
   */
  evictCacheEntries() {
    if (!this.config.cache.intelligentEviction) {
      // Evicción simple LRU
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.cacheStats.evictions++;
      return;
    }
    
    // Evicción inteligente basada en uso y edad
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => {
      const scoreA = this.calculateCacheScore(a[1]);
      const scoreB = this.calculateCacheScore(b[1]);
      return scoreA - scoreB;
    });
    
    // Evictar 10% de las entradas menos valiosas
    const toEvict = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < toEvict; i++) {
      this.cache.delete(entries[i][0]);
      this.cacheStats.evictions++;
    }
  }
  
  /**
   * Calcular puntuación de cache
   */
  calculateCacheScore(entry) {
    const age = Date.now() - entry.timestamp;
    const accessCount = entry.accessCount || 0;
    
    // Puntuación basada en frecuencia de acceso y edad
    return accessCount * 1000 - age;
  }
  
  /**
   * Generar clave de cache
   */
  generateCacheKey(prompt, context, model) {
    const contextStr = JSON.stringify({
      conversationId: context.conversationId,
      contactId: context.contactId,
      type: context.type
    });
    
    const key = `${model}:${prompt}:${contextStr}`;
    return this.hashString(key);
  }
  
  /**
   * Hash de string para claves de cache
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return hash.toString(36);
  }
  
  /**
   * Actualizar métricas
   */
  updateMetrics(provider, model, response) {
    // Métricas de rendimiento
    this.metrics.performance.responseTime.push(response.processingTime);
    this.metrics.performance.qualityScore.push(response.quality?.overall || 0);
    
    // Métricas de uso
    const providerMetrics = this.metrics.usage.byProvider.get(provider) || { count: 0, totalTime: 0, totalCost: 0 };
    providerMetrics.count++;
    providerMetrics.totalTime += response.processingTime;
    providerMetrics.totalCost += response.cost || 0;
    this.metrics.usage.byProvider.set(provider, providerMetrics);
    
    const modelMetrics = this.metrics.usage.byModel.get(model) || { count: 0, totalTime: 0, totalCost: 0 };
    modelMetrics.count++;
    modelMetrics.totalTime += response.processingTime;
    modelMetrics.totalCost += response.cost || 0;
    this.metrics.usage.byModel.set(model, modelMetrics);
    
    // Métricas de costos
    this.metrics.costs.total += response.cost || 0;
    const providerCost = this.metrics.costs.byProvider.get(provider) || 0;
    this.metrics.costs.byProvider.set(provider, providerCost + (response.cost || 0));
    
    // Mantener ventana de métricas
    this.trimMetricsWindow();
  }
  
  /**
   * Recortar ventana de métricas
   */
  trimMetricsWindow() {
    const maxSize = 1000;
    
    if (this.metrics.performance.responseTime.length > maxSize) {
      this.metrics.performance.responseTime = this.metrics.performance.responseTime.slice(-maxSize);
    }
    
    if (this.metrics.performance.qualityScore.length > maxSize) {
      this.metrics.performance.qualityScore = this.metrics.performance.qualityScore.slice(-maxSize);
    }
  }
  
  /**
   * Iniciar monitoreo
   */
  startMonitoring() {
    this.timers.monitoring = setInterval(() => {
      this.performMonitoring();
    }, 30000); // Cada 30 segundos
  }
  
  /**
   * Realizar monitoreo
   */
  async performMonitoring() {
    try {
      // Monitorear rendimiento
      const avgResponseTime = this.calculateAverageResponseTime();
      const errorRate = this.calculateErrorRate();
      const avgQuality = this.calculateAverageQuality();
      
      // Alertas de rendimiento
      if (avgResponseTime > 10000) { // 10 segundos
        this.emit('performance:alert', {
          type: 'high_response_time',
          value: avgResponseTime,
          threshold: 10000
        });
      }
      
      if (errorRate > 0.1) { // 10%
        this.emit('performance:alert', {
          type: 'high_error_rate',
          value: errorRate,
          threshold: 0.1
        });
      }
      
      if (avgQuality < 0.6) {
        this.emit('performance:alert', {
          type: 'low_quality',
          value: avgQuality,
          threshold: 0.6
        });
      }
      
      // Monitorear costos
      const hourlyCost = this.calculateHourlyCost();
      if (hourlyCost > 10) { // $10 por hora
        this.emit('cost:alert', {
          type: 'high_cost',
          value: hourlyCost,
          threshold: 10
        });
      }
      
      // Actualizar estado del agente
      this.state.avgResponseTime = avgResponseTime;
      this.state.currentLoad = this.calculateCurrentLoad();
      
    } catch (error) {
      this.logger.error('Error en monitoreo', error);
    }
  }
  
  /**
   * Calcular tiempo de respuesta promedio
   */
  calculateAverageResponseTime() {
    const times = this.metrics.performance.responseTime;
    if (times.length === 0) return 0;
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }
  
  /**
   * Calcular tasa de error
   */
  calculateErrorRate() {
    const total = this.state.totalRequests;
    const failed = this.state.failedRequests;
    
    return total > 0 ? failed / total : 0;
  }
  
  /**
   * Calcular calidad promedio
   */
  calculateAverageQuality() {
    const scores = this.metrics.performance.qualityScore;
    if (scores.length === 0) return 0;
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
  
  /**
   * Calcular costo por hora
   */
  calculateHourlyCost() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Estimar basado en actividad reciente
    return this.metrics.costs.total * 0.1; // Placeholder
  }
  
  /**
   * Calcular carga actual
   */
  calculateCurrentLoad() {
    return this.activeConnections.size / 100; // Normalizado a 0-1
  }
  
  /**
   * Iniciar optimización
   */
  startOptimization() {
    this.timers.optimization = setInterval(() => {
      this.performOptimization();
    }, 300000); // Cada 5 minutos
  }
  
  /**
   * Realizar optimización
   */
  async performOptimization() {
    if (this.mutex.optimization) return;
    
    try {
      this.mutex.optimization = true;
      
      // Optimizar configuración de proveedores
      await this.optimizeProviderConfig();
      
      // Optimizar cache
      await this.optimizeCache();
      
      // Optimizar rate limiting
      await this.optimizeRateLimiting();
      
      // Optimizar selección de modelos
      await this.optimizeModelSelection();
      
      this.logger.info('Optimización completada');
      
    } catch (error) {
      this.logger.error('Error en optimización', error);
    } finally {
      this.mutex.optimization = false;
    }
  }
  
  /**
   * Optimizar configuración de proveedores
   */
  async optimizeProviderConfig() {
    for (const [providerName, metrics] of this.metrics.usage.byProvider) {
      const config = this.config.providers[providerName];
      if (!config) continue;
      
      // Ajustar prioridad basada en rendimiento
      const avgTime = metrics.totalTime / metrics.count;
      const avgCost = metrics.totalCost / metrics.count;
      
      if (avgTime < config.avgResponseTime * 0.8) {
        config.priority = Math.max(1, config.priority - 1);
      } else if (avgTime > config.avgResponseTime * 1.2) {
        config.priority = Math.min(10, config.priority + 1);
      }
      
      // Actualizar métricas de configuración
      config.avgResponseTime = avgTime;
    }
  }
  
  /**
   * Optimizar cache
   */
  async optimizeCache() {
    // Ajustar TTL basado en patrones de acceso
    const cacheHitRate = this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses);
    
    if (cacheHitRate < 0.3) {
      // Aumentar TTL para mejorar hit rate
      this.config.cache.ttl = Math.min(this.config.cache.ttl * 1.2, 7200000); // Max 2 horas
    } else if (cacheHitRate > 0.8) {
      // Reducir TTL para mantener frescura
      this.config.cache.ttl = Math.max(this.config.cache.ttl * 0.9, 1800000); // Min 30 minutos
    }
  }
  
  /**
   * Optimizar rate limiting
   */
  async optimizeRateLimiting() {
    // Ajustar límites basado en capacidad y demanda
    const currentLoad = this.calculateCurrentLoad();
    
    if (currentLoad > 0.8) {
      // Reducir límites bajo alta carga
      this.config.rateLimiting.baseLimit = Math.max(50, this.config.rateLimiting.baseLimit * 0.9);
    } else if (currentLoad < 0.3) {
      // Aumentar límites bajo baja carga
      this.config.rateLimiting.baseLimit = Math.min(200, this.config.rateLimiting.baseLimit * 1.1);
    }
    
    // Rate limiting desactivado - establecer límite muy alto
    this.config.rateLimiting.baseLimit = 999999;
  }
  
  /**
   * Optimizar selección de modelos
   */
  async optimizeModelSelection() {
    // Analizar rendimiento de modelos y ajustar selección
    for (const [modelKey, metrics] of this.metrics.usage.byModel) {
      const [provider, model] = modelKey.split(':');
      const avgQuality = metrics.avgQuality || 0;
      const avgCost = metrics.totalCost / metrics.count;
      
      // Guardar optimizaciones aprendidas
      this.learningEngine.modelPerformance.set(modelKey, {
        quality: avgQuality,
        cost: avgCost,
        efficiency: avgQuality / (avgCost + 0.001) // Evitar división por cero
      });
    }
  }
  
  /**
   * Iniciar aprendizaje
   */
  startLearning() {
    this.timers.learning = setInterval(() => {
      this.performLearning();
    }, 600000); // Cada 10 minutos
  }
  
  /**
   * Realizar aprendizaje
   */
  async performLearning() {
    if (this.mutex.learning) return;
    
    try {
      this.mutex.learning = true;
      
      // Aprender patrones de uso
      await this.learnUsagePatterns();
      
      // Aprender correlaciones de contexto
      await this.learnContextCorrelations();
      
      // Aprender preferencias de usuario
      await this.learnUserPreferences();
      
      // Aprender optimizaciones de prompt
      await this.learnPromptOptimizations();
      
      this.logger.info('Aprendizaje completado');
      
    } catch (error) {
      this.logger.error('Error en aprendizaje', error);
    } finally {
      this.mutex.learning = false;
    }
  }
  
  /**
   * Aprender patrones de uso
   */
  async learnUsagePatterns() {
    // Analizar patrones temporales
    const hourlyUsage = new Map();
    const dailyUsage = new Map();
    
    // Implementar análisis de patrones
    // Placeholder para lógica de aprendizaje
  }
  
  /**
   * Aprender correlaciones de contexto
   */
  async learnContextCorrelations() {
    // Analizar qué contextos producen mejores resultados
    // Placeholder para lógica de correlación
  }
  
  /**
   * Aprender preferencias de usuario
   */
  async learnUserPreferences() {
    // Analizar feedback y patrones de usuario
    // Placeholder para lógica de preferencias
  }
  
  /**
   * Aprender optimizaciones de prompt
   */
  async learnPromptOptimizations() {
    // Identificar patrones de prompts exitosos
    // Placeholder para lógica de optimización
  }
  
  /**
   * Aprender de respuesta
   */
  learnFromResponse(response, provider, model) {
    // Registrar patrones exitosos
    const pattern = {
      provider,
      model,
      quality: response.quality?.overall || 0,
      processingTime: response.processingTime,
      cost: response.cost,
      context: response.context
    };
    
    const patterns = this.learningEngine.patterns.get('successful_responses') || [];
    patterns.push(pattern);
    
    // Mantener ventana de aprendizaje
    if (patterns.length > this.config.learning.memoryWindow) {
      patterns.shift();
    }
    
    this.learningEngine.patterns.set('successful_responses', patterns);
  }
  
  /**
   * Aprender de feedback
   */
  learnFromFeedback(responseId, feedback) {
    // Correlacionar feedback con características de respuesta
    // Implementar lógica de aprendizaje por feedback
  }
  
  /**
   * Intentar proveedor alternativo
   */
  async tryAlternativeProvider(originalRequest) {
    const { requestId, prompt, context, options } = originalRequest;
    
    try {
      // Seleccionar proveedor alternativo
      const { provider, model } = await this.selectOptimalProvider(prompt, context, {
        ...options,
        excludeProvider: originalRequest.provider
      });
      
      // Generar respuesta con proveedor alternativo
      const response = await this.generateResponse({
        prompt,
        context,
        provider,
        model,
        ...options
      });
      
      this.emit('ai:response', {
        requestId,
        response,
        provider,
        model,
        fromFallback: true
      });
      
    } catch (error) {
      this.logger.error('Error con proveedor alternativo', error);
      this.emit('ai:error', { requestId, error, isFinal: true });
    }
  }
  
  /**
   * Manejar trigger de optimización
   */
  async handleOptimizationTrigger(data) {
    this.logger.info('Trigger de optimización recibido', data);
    await this.performOptimization();
  }
  
  /**
   * Manejar alerta de rendimiento
   */
  async handlePerformanceAlert(data) {
    this.logger.warn('Alerta de rendimiento', data);
    
    // Implementar acciones correctivas
    switch (data.type) {
    case 'high_response_time':
      await this.handleHighResponseTime(data);
      break;
    case 'high_error_rate':
      await this.handleHighErrorRate(data);
      break;
    case 'low_quality':
      await this.handleLowQuality(data);
      break;
    }
  }
  
  /**
   * Manejar alerta de costo
   */
  async handleCostAlert(data) {
    this.logger.warn('Alerta de costo', data);
    
    // Activar modo de ahorro
    this.activateCostSavingMode();
  }
  
  /**
   * Activar modo de ahorro
   */
  activateCostSavingMode() {
    // Priorizar proveedores más económicos
    for (const [name, config] of Object.entries(this.config.providers)) {
      if (name === 'local') {
        config.priority = 1;
      } else {
        config.priority += 2;
      }
    }
    
    // Reducir límites de tokens
    this.config.optimization.costOptimization = true;
    
    this.logger.info('Modo de ahorro activado');
  }
  
  /**
   * Manejar tiempo de respuesta alto
   */
  async handleHighResponseTime(data) {
    // Priorizar proveedores más rápidos
    for (const [name, config] of Object.entries(this.config.providers)) {
      if (config.avgResponseTime < 3000) {
        config.priority = Math.max(1, config.priority - 1);
      }
    }
  }
  
  /**
   * Manejar tasa de error alta
   */
  async handleHighErrorRate(data) {
    // Activar circuit breakers más agresivos
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.failureThreshold = Math.max(2, circuitBreaker.failureThreshold - 1);
    }
  }
  
  /**
   * Manejar calidad baja
   */
  async handleLowQuality(data) {
    // Priorizar modelos de mayor calidad
    this.config.optimization.qualityBasedRouting = true;
  }
  
  /**
   * Manejar error crítico
   */
  async handleCriticalError(data) {
    this.logger.error('Error crítico detectado', data);
    
    // Implementar recuperación de emergencia
    await this.emergencyRecovery();
  }
  
  /**
   * Recuperación de emergencia
   */
  async emergencyRecovery() {
    try {
      // Reinicializar proveedores
      await this.initializeProviders();
      
      // Limpiar cache
      this.cache.clear();
      
      // Resetear circuit breakers
      this.initializeCircuitBreakers();
      
      this.logger.info('Recuperación de emergencia completada');
      
    } catch (error) {
      this.logger.error('Error en recuperación de emergencia', error);
    }
  }
  
  /**
   * Manejar patrón de aprendizaje
   */
  async handleLearningPattern(data) {
    const { pattern, confidence } = data;
    
    if (confidence > this.config.learning.adaptationThreshold) {
      // Aplicar patrón aprendido
      await this.applyLearningPattern(pattern);
    }
  }
  
  /**
   * Aplicar patrón aprendido
   */
  async applyLearningPattern(pattern) {
    // Implementar aplicación de patrones
    this.logger.info('Aplicando patrón aprendido', pattern);
  }
  
  /**
   * Manejar actualización de aprendizaje
   */
  async handleLearningUpdate(data) {
    // Actualizar modelos de aprendizaje
    this.logger.info('Actualizando aprendizaje', data);
  }
  
  /**
   * Analizar complejidad de prompt
   */
  analyzeComplexity(prompt) {
    // Factores de complejidad
    const length = prompt.length;
    const sentences = prompt.split(/[.!?]+/).length;
    const questions = (prompt.match(/\?/g) || []).length;
    const keywords = (prompt.match(/\b(analyze|explain|compare|evaluate|create)\b/gi) || []).length;
    
    // Normalizar a 0-1
    let complexity = 0;
    complexity += Math.min(length / 1000, 1) * 0.3;
    complexity += Math.min(sentences / 10, 1) * 0.2;
    complexity += Math.min(questions / 5, 1) * 0.2;
    complexity += Math.min(keywords / 3, 1) * 0.3;
    
    return complexity;
  }
  
  /**
   * Analizar urgencia
   */
  analyzeUrgency(context) {
    // Factores de urgencia
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'critical'];
    const urgentCount = urgentKeywords.filter(keyword => 
      context.message?.toLowerCase().includes(keyword)
    ).length;
    
    return Math.min(urgentCount / urgentKeywords.length, 1);
  }
  
  /**
   * Analizar sensibilidad al costo
   */
  analyzeCostSensitivity(context) {
    // Basado en configuración del usuario o contexto
    return context.costSensitive ? 0.9 : 0.3;
  }
  
  /**
   * Analizar requisito de calidad
   */
  analyzeQualityRequirement(context) {
    // Basado en tipo de conversación o usuario
    if (context.type === 'business' || context.type === 'support') {
      return 0.9;
    }
    return 0.6;
  }
  
  /**
   * Estimar tokens
   */
  estimateTokens(prompt) {
    // Estimación aproximada: ~4 caracteres por token
    return Math.ceil(prompt.length / 4);
  }
  
  /**
   * Calcular tamaño de contexto
   */
  calculateContextSize(context) {
    const contextStr = JSON.stringify(context);
    return contextStr.length;
  }
  
  /**
   * Guardar respuesta en base de datos
   */
  async saveResponse(response) {
    try {
      await this.db.insert('ai_responses', response.toJSON());
    } catch (error) {
      this.logger.error('Error guardando respuesta', error);
    }
  }
  
  /**
   * Actualizar feedback de respuesta
   */
  async updateResponseFeedback(responseId, feedback) {
    try {
      const response = await this.db.findById('ai_responses', responseId);
      if (!response) {
        throw new Error('Respuesta no encontrada');
      }
      
      const aiResponse = AIResponse.fromJSON(response);
      aiResponse.updateFeedback(feedback);
      
      await this.db.update('ai_responses', responseId, aiResponse.toJSON());
      
      return aiResponse;
      
    } catch (error) {
      this.logger.error('Error actualizando feedback', error);
      throw error;
    }
  }
  
  /**
   * Obtener estadísticas del agente
   */
  async getAgentStats() {
    return {
      state: this.state,
      metrics: {
        performance: {
          avgResponseTime: this.calculateAverageResponseTime(),
          errorRate: this.calculateErrorRate(),
          avgQuality: this.calculateAverageQuality(),
          throughput: this.calculateThroughput()
        },
        usage: {
          totalRequests: this.state.totalRequests,
          successfulRequests: this.state.successfulRequests,
          failedRequests: this.state.failedRequests,
          byProvider: Object.fromEntries(this.metrics.usage.byProvider),
          byModel: Object.fromEntries(this.metrics.usage.byModel)
        },
        cache: {
          size: this.cache.size,
          hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses),
          ...this.cacheStats
        },
        costs: this.metrics.costs
      },
      providers: Array.from(this.providers.keys()),
      models: Array.from(this.models.keys()),
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([name, cb]) => [
          name,
          { state: cb.state, failures: cb.failures }
        ])
      )
    };
  }
  
  /**
   * Calcular throughput
   */
  calculateThroughput() {
    // Requests por minuto en la última hora
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Placeholder - implementar cálculo real
    return this.state.totalRequests * 0.1;
  }
  
  /**
   * Obtener información del agente
   */
  getAgentInfo() {
    return {
      id: 'ai-agent',
      name: 'AI Agent',
      type: 'ai-management',
      version: '1.0.0',
      description: 'Agente inteligente de gestión de IA con capacidades evolutivas',
      capabilities: [
        'multi-provider-management',
        'intelligent-routing',
        'quality-optimization',
        'cost-optimization',
        'pattern-learning',
        'performance-monitoring',
        'circuit-breaking',
        'adaptive-caching',
        'rate-limiting',
        'feedback-learning'
      ],
      state: this.state,
      config: this.config
    };
  }
  
  /**
   * Apagar el agente
   */
  async shutdown() {
    try {
      this.logger.info('Apagando AIAgent...');
      
      // Detener timers
      this.stopTimers();
      
      // Guardar estado
      await this.saveAgentState();
      
      // Guardar patrones de aprendizaje
      await this.saveLearningPatterns();
      
      // Limpiar recursos
      this.cache.clear();
      this.rateLimits.clear();
      this.providers.clear();
      this.models.clear();
      
      this.state.active = false;
      this.state.initialized = false;
      
      this.logger.info('AIAgent apagado correctamente');
      
      this.emit('agent:shutdown', { agentId: 'ai-agent' });
      
    } catch (error) {
      this.logger.error('Error apagando AIAgent', error);
      throw error;
    }
  }
  
  /**
   * Detener timers
   */
  stopTimers() {
    Object.values(this.timers).forEach(timer => {
      if (timer) {
        clearInterval(timer);
      }
    });
    
    this.timers = {
      optimization: null,
      monitoring: null,
      learning: null,
      cleanup: null,
      healthCheck: null
    };
  }
  
  /**
   * Guardar estado del agente
   */
  async saveAgentState() {
    try {
      const stateData = {
        state: this.state,
        metrics: this.metrics,
        config: this.config,
        timestamp: new Date().toISOString()
      };
      
      await this.ensureDirectory('storage/agents');
      await fs.writeFile(
        'storage/agents/ai-agent-state.json',
        JSON.stringify(stateData, null, 2)
      );
      
    } catch (error) {
      this.logger.error('Error guardando estado del agente', error);
    }
  }
  
  /**
   * Cargar estado del agente
   */
  async loadAgentState() {
    try {
      const stateFile = 'storage/agents/ai-agent-state.json';
      const data = await fs.readFile(stateFile, 'utf8');
      const stateData = JSON.parse(data);
      
      // Restaurar estado
      this.state = { ...this.state, ...stateData.state };
      
      // Restaurar métricas
      if (stateData.metrics) {
        this.metrics = { ...this.metrics, ...stateData.metrics };
      }
      
      this.logger.info('Estado del agente cargado');
      
    } catch (error) {
      this.logger.info('No se encontró estado previo del agente');
    }
  }
  
  /**
   * Guardar patrones de aprendizaje
   */
  async saveLearningPatterns() {
    try {
      const learningData = {
        patterns: Object.fromEntries(this.learningEngine.patterns),
        contextCorrelations: Object.fromEntries(this.learningEngine.contextCorrelations),
        userPreferences: Object.fromEntries(this.learningEngine.userPreferences),
        modelPerformance: Object.fromEntries(this.learningEngine.modelPerformance),
        timestamp: new Date().toISOString()
      };
      
      await this.ensureDirectory('storage/agents');
      await fs.writeFile(
        'storage/agents/ai-agent-learning.json',
        JSON.stringify(learningData, null, 2)
      );
      
    } catch (error) {
      this.logger.error('Error guardando patrones de aprendizaje', error);
    }
  }
  
  /**
   * Cargar patrones de aprendizaje
   */
  async loadLearningPatterns() {
    try {
      const learningFile = 'storage/agents/ai-agent-learning.json';
      const data = await fs.readFile(learningFile, 'utf8');
      const learningData = JSON.parse(data);
      
      // Restaurar patrones
      this.learningEngine.patterns = new Map(Object.entries(learningData.patterns || {}));
      this.learningEngine.contextCorrelations = new Map(Object.entries(learningData.contextCorrelations || {}));
      this.learningEngine.userPreferences = new Map(Object.entries(learningData.userPreferences || {}));
      this.learningEngine.modelPerformance = new Map(Object.entries(learningData.modelPerformance || {}));
      
      this.logger.info('Patrones de aprendizaje cargados');
      
    } catch (error) {
      this.logger.info('No se encontraron patrones de aprendizaje previos');
    }
  }
  
  /**
   * Asegurar que existe el directorio
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directorio ya existe
    }
  }
  
  /**
   * Limpiar datos antiguos
   */
  async cleanupOldData() {
    try {
      // Limpiar métricas antiguas (más de 7 días)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      // Limpiar cache expirado
      for (const [key, entry] of this.cache.entries()) {
        if (entry.timestamp < sevenDaysAgo) {
          this.cache.delete(key);
          this.cacheStats.evictions++;
        }
      }
      
      // Limpiar rate limits antiguos
      for (const [contactId, limit] of this.rateLimits.entries()) {
        limit.requests = limit.requests.filter(time => Date.now() - time < 3600000); // 1 hora
        if (limit.requests.length === 0) {
          this.rateLimits.delete(contactId);
        }
      }
      
      this.logger.info('Limpieza de datos antiguos completada');
      
    } catch (error) {
      this.logger.error('Error en limpieza de datos', error);
    }
  }
  
  /**
   * Destruir el agente
   */
  async destroy() {
    await this.shutdown();
    this.removeAllListeners();
    this.logger.info('AIAgent destruido');
  }
}

/**
 * Circuit Breaker para proveedores de IA
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.monitoringWindow = options.monitoringWindow || 300000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
  
  canExecute() {
    if (this.state === 'CLOSED') {
      return true;
    }
    
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return true;
      }
      return false;
    }
    
    if (this.state === 'HALF_OPEN') {
      return true;
    }
    
    return false;
  }
  
  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        this.failures = 0;
      }
    } else if (this.state === 'CLOSED') {
      this.failures = Math.max(0, this.failures - 1);
    }
  }
  
  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// Instancia singleton del agente
let agentInstance = null;

/**
 * Obtener instancia del agente de IA
 * @returns {AIAgent} Instancia del agente
 */
export function getAIAgent() {
  if (!agentInstance) {
    agentInstance = new AIAgent();
  }
  return agentInstance;
}

export default AIAgent;
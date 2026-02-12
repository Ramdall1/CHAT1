/**
 * AIProviderManager - Gestor de proveedores de IA
 * 
 * Gestiona múltiples proveedores de IA (OpenAI, Anthropic, Google, Local)
 * y selecciona el óptimo basado en diferentes criterios.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../core/core/logger.js';
import { CircuitBreaker } from '../circuit-breaker/CircuitBreaker.js';
import axios from 'axios';

const logger = createLogger('AI_PROVIDER_MANAGER');

export class AIProviderManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
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
      ...config
    };

    this.providers = new Map();
    this.circuitBreakers = new Map();
    this.metrics = new Map();
  }

  /**
   * Inicializar todos los proveedores
   */
  async initialize() {
    try {
      logger.info('Inicializando proveedores de IA...');
      
      for (const [name, config] of Object.entries(this.config.providers)) {
        if (config.enabled) {
          await this.createProvider(name, config);
        }
      }
      
      logger.info(`${this.providers.size} proveedores inicializados`);
      this.emit('providers:initialized', { count: this.providers.size });
      
    } catch (error) {
      logger.error('Error inicializando proveedores', error);
      throw error;
    }
  }

  /**
   * Crear un proveedor específico
   */
  async createProvider(name, config) {
    try {
      let provider;
      
      switch (name) {
        case 'openai':
          provider = this.createOpenAIProvider(config);
          break;
        case 'anthropic':
          provider = this.createAnthropicProvider(config);
          break;
        case 'google':
          provider = this.createGoogleProvider(config);
          break;
        case 'local':
          provider = this.createLocalProvider(config);
          break;
        default:
          throw new Error(`Proveedor desconocido: ${name}`);
      }

      this.providers.set(name, provider);
      this.circuitBreakers.set(name, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000
      }));
      
      this.metrics.set(name, {
        requests: 0,
        successes: 0,
        failures: 0,
        totalResponseTime: 0,
        totalCost: 0,
        lastUsed: null
      });

      logger.info(`Proveedor ${name} creado exitosamente`);
      
    } catch (error) {
      logger.error(`Error creando proveedor ${name}`, error);
      throw error;
    }
  }

  /**
   * Crear proveedor OpenAI
   */
  createOpenAIProvider(config) {
    return {
      name: 'openai',
      config,
      async generateResponse(prompt, options = {}) {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: options.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        return {
          text: response.data.choices[0].message.content,
          usage: response.data.usage,
          model: response.data.model
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
      async generateResponse(prompt, options = {}) {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
          model: options.model || 'claude-3-sonnet-20240229',
          max_tokens: options.maxTokens || 1000,
          messages: [{ role: 'user', content: prompt }]
        }, {
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          }
        });
        
        return {
          text: response.data.content[0].text,
          usage: response.data.usage,
          model: response.data.model
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
      async generateResponse(prompt, options = {}) {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1/models/${options.model || 'gemini-pro'}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
          contents: [{ parts: [{ text: prompt }] }]
        });
        
        return {
          text: response.data.candidates[0].content.parts[0].text,
          usage: response.data.usageMetadata,
          model: options.model || 'gemini-pro'
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
      async generateResponse(prompt, options = {}) {
        // Implementación para modelo local (Ollama, etc.)
        const response = await axios.post('http://localhost:11434/api/generate', {
          model: options.model || 'llama2',
          prompt: prompt,
          stream: false
        });
        
        return {
          text: response.data.response,
          usage: { total_tokens: response.data.eval_count || 0 },
          model: response.data.model
        };
      }
    };
  }

  /**
   * Seleccionar el proveedor óptimo
   */
  async selectOptimalProvider(prompt, context, options = {}) {
    const analysis = await this.analyzeRequest(prompt, context);
    
    // Filtrar proveedores disponibles
    const availableProviders = Array.from(this.providers.keys()).filter(name => {
      const circuitBreaker = this.circuitBreakers.get(name);
      return circuitBreaker.canExecute() && this.config.providers[name].enabled;
    });

    if (availableProviders.length === 0) {
      throw new Error('No hay proveedores disponibles');
    }

    // Calcular scores para cada proveedor
    const scores = availableProviders.map(name => ({
      name,
      score: this.calculateProviderScore(name, analysis)
    }));

    // Ordenar por score descendente
    scores.sort((a, b) => b.score - a.score);

    const selectedProvider = scores[0].name;
    const selectedModel = this.selectOptimalModel(selectedProvider, analysis);

    logger.info(`Proveedor seleccionado: ${selectedProvider} con modelo ${selectedModel}`);

    return {
      provider: selectedProvider,
      model: selectedModel,
      analysis
    };
  }

  /**
   * Analizar la solicitud para determinar requisitos
   */
  async analyzeRequest(prompt, context) {
    return {
      complexity: this.analyzeComplexity(prompt),
      urgency: this.analyzeUrgency(context),
      costSensitivity: this.analyzeCostSensitivity(context),
      qualityRequirement: this.analyzeQualityRequirement(context),
      estimatedTokens: this.estimateTokens(prompt),
      contextSize: this.calculateContextSize(context)
    };
  }

  /**
   * Calcular score del proveedor
   */
  calculateProviderScore(providerName, analysis) {
    const config = this.config.providers[providerName];
    const metrics = this.metrics.get(providerName);
    
    let score = 0;
    
    // Factor de confiabilidad
    score += config.reliability * 30;
    
    // Factor de costo (invertido para preferir menor costo)
    const avgCostPerToken = Object.values(config.costPerToken).reduce((a, b) => a + b, 0) / Object.values(config.costPerToken).length;
    score += (1 - avgCostPerToken * 10000) * 20;
    
    // Factor de velocidad (invertido para preferir menor tiempo)
    score += (1 - config.avgResponseTime / 10000) * 20;
    
    // Factor de éxito histórico
    if (metrics.requests > 0) {
      const successRate = metrics.successes / metrics.requests;
      score += successRate * 20;
    }
    
    // Factor de prioridad
    score += (5 - config.priority) * 10;
    
    return score;
  }

  /**
   * Seleccionar modelo óptimo para el proveedor
   */
  selectOptimalModel(providerName, analysis) {
    const config = this.config.providers[providerName];
    const models = config.models;
    
    // Lógica simple: seleccionar basado en complejidad
    if (analysis.complexity > 0.8) {
      return models[0]; // Modelo más potente
    } else if (analysis.complexity > 0.5) {
      return models[Math.floor(models.length / 2)]; // Modelo intermedio
    } else {
      return models[models.length - 1]; // Modelo más eficiente
    }
  }

  /**
   * Generar respuesta usando el proveedor seleccionado
   */
  async generateResponse(providerName, model, prompt, options = {}) {
    const provider = this.providers.get(providerName);
    const circuitBreaker = this.circuitBreakers.get(providerName);
    const metrics = this.metrics.get(providerName);

    if (!circuitBreaker.canExecute()) {
      throw new Error(`Proveedor ${providerName} no disponible (Circuit Breaker OPEN)`);
    }

    const startTime = Date.now();
    
    try {
      metrics.requests++;
      
      const response = await provider.generateResponse(prompt, { model, ...options });
      
      const responseTime = Date.now() - startTime;
      
      // Actualizar métricas
      metrics.successes++;
      metrics.totalResponseTime += responseTime;
      metrics.lastUsed = new Date().toISOString();
      
      // Calcular costo
      const cost = this.calculateCost(providerName, model, response.usage?.total_tokens || 0);
      metrics.totalCost += cost;
      
      circuitBreaker.recordSuccess();
      
      this.emit('response:generated', {
        provider: providerName,
        model,
        responseTime,
        cost,
        tokens: response.usage?.total_tokens || 0
      });
      
      return {
        ...response,
        provider: providerName,
        responseTime,
        cost
      };
      
    } catch (error) {
      metrics.failures++;
      circuitBreaker.recordFailure();
      
      this.emit('response:error', {
        provider: providerName,
        model,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Calcular costo de la respuesta
   */
  calculateCost(provider, model, tokens) {
    const config = this.config.providers[provider];
    const costPerToken = config.costPerToken[model] || 0;
    return tokens * costPerToken;
  }

  /**
   * Analizar complejidad del prompt
   */
  analyzeComplexity(prompt) {
    const length = prompt.length;
    const words = prompt.split(' ').length;
    const sentences = prompt.split(/[.!?]+/).length;
    
    // Factores de complejidad
    const lengthFactor = Math.min(length / 1000, 1);
    const wordFactor = Math.min(words / 200, 1);
    const sentenceFactor = Math.min(sentences / 10, 1);
    
    return (lengthFactor + wordFactor + sentenceFactor) / 3;
  }

  /**
   * Analizar urgencia del contexto
   */
  analyzeUrgency(context) {
    if (!context) return 0.5;
    
    const urgentKeywords = ['urgente', 'inmediato', 'rápido', 'ahora', 'ya'];
    const text = JSON.stringify(context).toLowerCase();
    
    const urgentMatches = urgentKeywords.filter(keyword => text.includes(keyword)).length;
    return Math.min(urgentMatches / urgentKeywords.length + 0.3, 1);
  }

  /**
   * Analizar sensibilidad al costo
   */
  analyzeCostSensitivity(context) {
    if (!context || !context.user) return 0.5;
    
    // Lógica basada en el tipo de usuario o configuración
    return context.user.costSensitive ? 0.9 : 0.3;
  }

  /**
   * Analizar requisito de calidad
   */
  analyzeQualityRequirement(context) {
    if (!context) return 0.7;
    
    const qualityKeywords = ['importante', 'crítico', 'preciso', 'detallado'];
    const text = JSON.stringify(context).toLowerCase();
    
    const qualityMatches = qualityKeywords.filter(keyword => text.includes(keyword)).length;
    return Math.min(qualityMatches / qualityKeywords.length + 0.5, 1);
  }

  /**
   * Estimar tokens del prompt
   */
  estimateTokens(prompt) {
    // Estimación aproximada: 1 token ≈ 4 caracteres
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Calcular tamaño del contexto
   */
  calculateContextSize(context) {
    if (!context) return 0;
    return JSON.stringify(context).length;
  }

  /**
   * Obtener métricas de todos los proveedores
   */
  getMetrics() {
    const result = {};
    
    for (const [name, metrics] of this.metrics.entries()) {
      const circuitBreaker = this.circuitBreakers.get(name);
      
      result[name] = {
        ...metrics,
        avgResponseTime: metrics.requests > 0 ? metrics.totalResponseTime / metrics.requests : 0,
        successRate: metrics.requests > 0 ? metrics.successes / metrics.requests : 0,
        circuitBreakerState: circuitBreaker.getState()
      };
    }
    
    return result;
  }

  /**
   * Obtener proveedor por nombre
   */
  getProvider(name) {
    return this.providers.get(name);
  }

  /**
   * Verificar si un proveedor está disponible
   */
  isProviderAvailable(name) {
    const circuitBreaker = this.circuitBreakers.get(name);
    return circuitBreaker && circuitBreaker.canExecute() && this.config.providers[name]?.enabled;
  }

  /**
   * Resetear métricas de un proveedor
   */
  resetProviderMetrics(name) {
    if (this.metrics.has(name)) {
      this.metrics.set(name, {
        requests: 0,
        successes: 0,
        failures: 0,
        totalResponseTime: 0,
        totalCost: 0,
        lastUsed: null
      });
    }
  }

  /**
   * Cerrar todos los proveedores
   */
  async shutdown() {
    logger.info('Cerrando proveedores de IA...');
    
    this.providers.clear();
    this.circuitBreakers.clear();
    this.metrics.clear();
    
    this.emit('providers:shutdown');
  }
}

export default AIProviderManager;
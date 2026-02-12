/**
 * Servicio de IA
 * 
 * Encapsula la lógica de negocio para interacciones con IA,
 * incluyendo generación de respuestas, análisis de contexto y gestión de modelos.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { getDatabase } from '../../../../services/core/core/database.js';
import { createLogger } from '../../../../services/core/core/logger.js';
import { DEFAULT_WORKFLOW_CONFIG } from '../../../../workflows/index.js';
import { AIResponse } from '../models/AIResponse.js';
import axios from 'axios';

const logger = createLogger('AI_SERVICE');

/**
 * Servicio para gestión de IA
 */
export class AIService {
  constructor() {
    this.db = getDatabase();
    this.config = DEFAULT_WORKFLOW_CONFIG.ai || {};
    this.providers = {
      openai: this.createOpenAIProvider(),
      anthropic: this.createAnthropicProvider(),
      google: this.createGoogleProvider(),
      local: this.createLocalProvider()
    };
    this.defaultProvider = this.config.defaultProvider || 'openai';
    this.models = this.config.models || {};
    this.cache = new Map(); // Cache simple para respuestas
    this.rateLimits = new Map(); // Control de rate limiting
  }
  
  /**
   * Generar respuesta de IA
   * @param {Object} options - Opciones para la generación
   */
  async generateResponse(options) {
    try {
      const {
        prompt,
        conversationId,
        contactId,
        messageId,
        context = {},
        provider = this.defaultProvider,
        model,
        temperature = 0.7,
        maxTokens = 1000,
        type = 'text'
      } = options;
      
      // Validar rate limiting
      if (!this.checkRateLimit(contactId)) {
        throw new Error('Rate limit excedido para este contacto');
      }
      
      // Verificar cache
      const cacheKey = this.generateCacheKey(prompt, context, model);
      if (this.cache.has(cacheKey)) {
        logger.info('Respuesta obtenida desde cache', { cacheKey });
        const cachedResponse = this.cache.get(cacheKey);
        return AIResponse.fromJSON({
          ...cachedResponse,
          id: undefined, // Generar nuevo ID
          conversationId,
          contactId,
          messageId
        });
      }
      
      const startTime = Date.now();
      
      // Crear respuesta inicial
      const aiResponse = new AIResponse({
        conversationId,
        contactId,
        messageId,
        prompt,
        provider,
        model: model || this.getDefaultModel(provider),
        type,
        status: 'pending',
        metadata: {
          temperature,
          maxTokens
        },
        context
      });
      
      // Guardar respuesta inicial
      await this.db.append('ai_responses', aiResponse.toJSON());
      
      try {
        // Generar respuesta usando el proveedor
        const providerInstance = this.providers[provider];
        if (!providerInstance) {
          throw new Error(`Proveedor de IA no disponible: ${provider}`);
        }
        
        const result = await providerInstance.generateResponse({
          prompt: this.buildPrompt(prompt, context),
          model: aiResponse.model,
          temperature,
          maxTokens
        });
        
        // Actualizar respuesta con resultado
        aiResponse.response = result.response;
        aiResponse.tokens = result.tokens || {};
        aiResponse.confidence = result.confidence || 0.8;
        aiResponse.status = 'completed';
        aiResponse.processingTime = Date.now() - startTime;
        
        // Calcular costo
        aiResponse.calculateCost(this.config.pricing);
        
        // Evaluar calidad
        await this.evaluateQuality(aiResponse);
        
        // Actualizar en base de datos
        await this.db.update('ai_responses', aiResponse.id, aiResponse.toJSON());
        
        // Guardar en cache si es de alta calidad
        if (aiResponse.isHighQuality()) {
          this.cache.set(cacheKey, aiResponse.toJSON());
        }
        
        // Actualizar rate limit
        this.updateRateLimit(contactId);
        
        logger.info('Respuesta de IA generada exitosamente', {
          id: aiResponse.id,
          provider,
          model: aiResponse.model,
          tokens: aiResponse.tokens.total,
          processingTime: aiResponse.processingTime
        });
        
        return aiResponse;
        
      } catch (error) {
        // Actualizar respuesta con error
        aiResponse.status = 'failed';
        aiResponse.error = {
          message: error.message,
          code: error.code || 'GENERATION_ERROR',
          timestamp: new Date().toISOString()
        };
        aiResponse.processingTime = Date.now() - startTime;
        
        await this.db.update('ai_responses', aiResponse.id, aiResponse.toJSON());
        
        logger.error('Error generando respuesta de IA', error);
        throw error;
      }
      
    } catch (error) {
      logger.error('Error en generateResponse', error);
      throw error;
    }
  }
  
  /**
   * Analizar contexto de conversación
   * @param {string} conversationId - ID de conversación
   */
  async analyzeContext(conversationId) {
    try {
      const messages = await this.db.find('messages', { conversationId });
      const contacts = await this.db.find('contacts', {});
      
      // Obtener últimos mensajes
      const recentMessages = messages
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
      
      // Analizar sentimiento y temas
      const analysis = {
        messageCount: messages.length,
        recentActivity: recentMessages.length,
        sentiment: await this.analyzeSentiment(recentMessages),
        topics: await this.extractTopics(recentMessages),
        userIntent: await this.detectIntent(recentMessages),
        conversationStage: this.determineConversationStage(messages),
        lastInteraction: messages.length > 0 ? messages[messages.length - 1].createdAt : null
      };
      
      return analysis;
      
    } catch (error) {
      logger.error('Error analizando contexto', error);
      throw error;
    }
  }
  
  /**
   * Obtener respuestas por conversación
   * @param {string} conversationId - ID de conversación
   * @param {Object} options - Opciones de filtrado
   */
  async getResponsesByConversation(conversationId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        status = '',
        type = '',
        provider = ''
      } = options;
      
      const filters = { conversationId };
      
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (provider) filters.provider = provider;
      
      const responses = await this.db.find('ai_responses', filters);
      
      // Ordenar por fecha de creación
      responses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Paginación
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResponses = responses.slice(startIndex, endIndex);
      
      return {
        responses: paginatedResponses.map(r => AIResponse.fromJSON(r)),
        pagination: {
          page,
          limit,
          total: responses.length,
          pages: Math.ceil(responses.length / limit)
        }
      };
      
    } catch (error) {
      logger.error('Error obteniendo respuestas por conversación', error);
      throw error;
    }
  }
  
  /**
   * Actualizar feedback de respuesta
   * @param {string} responseId - ID de respuesta
   * @param {Object} feedback - Feedback del usuario
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
      
      logger.info('Feedback actualizado', { responseId, feedback });
      
      return aiResponse;
      
    } catch (error) {
      logger.error('Error actualizando feedback', error);
      throw error;
    }
  }
  
  /**
   * Obtener estadísticas de IA
   * @param {Object} filters - Filtros para estadísticas
   */
  async getAIStats(filters = {}) {
    try {
      const {
        dateFrom = '',
        dateTo = '',
        provider = '',
        contactId = ''
      } = filters;
      
      let responses = await this.db.find('ai_responses', {});
      
      // Aplicar filtros
      if (dateFrom) {
        responses = responses.filter(r => r.createdAt >= dateFrom);
      }
      if (dateTo) {
        responses = responses.filter(r => r.createdAt <= dateTo);
      }
      if (provider) {
        responses = responses.filter(r => r.provider === provider);
      }
      if (contactId) {
        responses = responses.filter(r => r.contactId === contactId);
      }
      
      const stats = {
        total: responses.length,
        byStatus: this.groupBy(responses, 'status'),
        byProvider: this.groupBy(responses, 'provider'),
        byType: this.groupBy(responses, 'type'),
        byModel: this.groupBy(responses, 'model'),
        totalTokens: responses.reduce((sum, r) => sum + (r.tokens?.total || 0), 0),
        totalCost: responses.reduce((sum, r) => sum + (r.cost || 0), 0),
        avgProcessingTime: responses.length > 0 
          ? responses.reduce((sum, r) => sum + (r.processingTime || 0), 0) / responses.length 
          : 0,
        avgConfidence: responses.length > 0
          ? responses.reduce((sum, r) => sum + (r.confidence || 0), 0) / responses.length
          : 0,
        highQualityCount: responses.filter(r => {
          const aiResponse = AIResponse.fromJSON(r);
          return aiResponse.isHighQuality();
        }).length,
        feedbackStats: {
          totalRatings: responses.filter(r => r.feedback?.rating).length,
          avgRating: this.calculateAvgRating(responses),
          helpfulCount: responses.filter(r => r.feedback?.helpful === true).length
        }
      };
      
      return stats;
      
    } catch (error) {
      logger.error('Error obteniendo estadísticas de IA', error);
      throw error;
    }
  }
  
  /**
   * Limpiar cache de respuestas
   */
  clearCache() {
    this.cache.clear();
    logger.info('Cache de IA limpiado');
  }
  
  /**
   * Crear proveedor OpenAI
   */
  createOpenAIProvider() {
    return {
      async generateResponse(options) {
        const { prompt, model = 'gpt-3.5-turbo', temperature = 0.7, maxTokens = 1000 } = options;
        
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens
        }, {
          headers: {
            'Authorization': `Bearer ${getConfig('ai').openai.apiKey}`,
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
          confidence: 0.8
        };
      }
    };
  }
  
  /**
   * Crear proveedor Anthropic
   */
  createAnthropicProvider() {
    return {
      async generateResponse(options) {
        const { 
          prompt, 
          model = 'claude-3-sonnet-20240229', 
          temperature = 0.7, 
          maxTokens = 1000 
        } = options;
        
        try {
          // Verificar configuración de API key
          if (!this.config.anthropic?.apiKey) {
            throw new Error('API key de Anthropic no configurada');
          }
          
          const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model,
            max_tokens: maxTokens,
            temperature,
            messages: [{ 
              role: 'user', 
              content: prompt 
            }]
          }, {
            headers: {
              'Authorization': `Bearer ${this.config.anthropic.apiKey}`,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            timeout: 30000 // 30 segundos timeout
          });
          
          // Extraer respuesta y metadatos
          const content = response.data.content?.[0]?.text || '';
          const usage = response.data.usage || {};
          
          return {
            response: content,
            tokens: {
              prompt: usage.input_tokens || 0,
              completion: usage.output_tokens || 0,
              total: (usage.input_tokens || 0) + (usage.output_tokens || 0)
            },
            confidence: 0.85, // Claude generalmente tiene alta confianza
            model,
            provider: 'anthropic',
            metadata: {
              stopReason: response.data.stop_reason,
              stopSequence: response.data.stop_sequence
            }
          };
          
        } catch (error) {
          logger.error('Error en proveedor Anthropic:', {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
          });
          
          // Manejo específico de errores de Anthropic
          if (error.response?.status === 401) {
            throw new Error('API key de Anthropic inválida o expirada');
          } else if (error.response?.status === 429) {
            throw new Error('Límite de rate de Anthropic excedido. Intenta más tarde');
          } else if (error.response?.status === 400) {
            throw new Error(`Error en solicitud a Anthropic: ${error.response.data?.error?.message || 'Solicitud inválida'}`);
          } else if (error.code === 'ECONNABORTED') {
            throw new Error('Timeout en conexión con Anthropic API');
          }
          
          throw new Error(`Error del proveedor Anthropic: ${error.message}`);
        }
      }
    };
  }
  
  /**
   * Crear proveedor Google
   */
  createGoogleProvider() {
    return {
      async generateResponse(options) {
        const { 
          prompt, 
          model = 'gemini-pro', 
          temperature = 0.7, 
          maxTokens = 1000 
        } = options;
        
        try {
          // Verificar configuración de API key
          if (!this.config.google?.apiKey) {
            throw new Error('API key de Google no configurada');
          }
          
          // Construir URL con API key
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.google.apiKey}`;
          
          const response = await axios.post(url, {
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
              topP: 0.8,
              topK: 40
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH", 
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              }
            ]
          }, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 segundos timeout
          });
          
          // Extraer respuesta y metadatos
          const candidates = response.data.candidates || [];
          if (candidates.length === 0) {
            throw new Error('No se generó respuesta de Gemini');
          }
          
          const candidate = candidates[0];
          const content = candidate.content?.parts?.[0]?.text || '';
          const usage = response.data.usageMetadata || {};
          
          // Verificar si la respuesta fue bloqueada por seguridad
          if (candidate.finishReason === 'SAFETY') {
            throw new Error('Respuesta bloqueada por filtros de seguridad de Gemini');
          }
          
          return {
            response: content,
            tokens: {
              prompt: usage.promptTokenCount || 0,
              completion: usage.candidatesTokenCount || 0,
              total: usage.totalTokenCount || 0
            },
            confidence: 0.8, // Gemini tiene buena confianza
            model,
            provider: 'google',
            metadata: {
              finishReason: candidate.finishReason,
              safetyRatings: candidate.safetyRatings,
              citationMetadata: candidate.citationMetadata
            }
          };
          
        } catch (error) {
          logger.error('Error en proveedor Google:', {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
          });
          
          // Manejo específico de errores de Google
          if (error.response?.status === 400) {
            const errorData = error.response.data?.error;
            if (errorData?.message?.includes('API key')) {
              throw new Error('API key de Google inválida');
            }
            throw new Error(`Error en solicitud a Google: ${errorData?.message || 'Solicitud inválida'}`);
          } else if (error.response?.status === 403) {
            throw new Error('Acceso denegado a Google Gemini API. Verifica permisos y cuota');
          } else if (error.response?.status === 429) {
            throw new Error('Límite de rate de Google excedido. Intenta más tarde');
          } else if (error.code === 'ECONNABORTED') {
            throw new Error('Timeout en conexión con Google Gemini API');
          }
          
          throw new Error(`Error del proveedor Google: ${error.message}`);
        }
      }
    };
  }
  
  /**
   * Crear proveedor local
   */
  createLocalProvider() {
    return {
      async generateResponse(options) {
        // Implementación para modelo local
        return {
          response: 'Respuesta generada por modelo local (placeholder)',
          tokens: { prompt: 50, completion: 100, total: 150 },
          confidence: 0.6
        };
      }
    };
  }
  
  /**
   * Construir prompt con contexto
   */
  buildPrompt(basePrompt, context) {
    let prompt = basePrompt;
    
    if (context.conversationHistory) {
      prompt = `Historial de conversación:\n${context.conversationHistory}\n\nPregunta actual: ${basePrompt}`;
    }
    
    if (context.contactInfo) {
      prompt = `Información del contacto: ${JSON.stringify(context.contactInfo)}\n\n${prompt}`;
    }
    
    return prompt;
  }
  
  /**
   * Evaluar calidad de respuesta
   */
  async evaluateQuality(aiResponse) {
    // Evaluación básica de calidad
    const quality = {
      relevance: Math.random() * 0.3 + 0.7, // Placeholder
      coherence: Math.random() * 0.3 + 0.7,
      helpfulness: Math.random() * 0.3 + 0.7,
      safety: Math.random() * 0.2 + 0.8
    };
    
    aiResponse.updateQuality(quality);
  }
  
  /**
   * Verificar rate limit
   */
  checkRateLimit(contactId) {
    const now = Date.now();
    const limit = this.rateLimits.get(contactId);
    
    if (!limit) return true;
    
    // Permitir 10 requests por minuto por contacto
    const windowMs = 60 * 1000;
    const maxRequests = 10;
    
    const validRequests = limit.requests.filter(time => now - time < windowMs);
    
    return validRequests.length < maxRequests;
  }
  
  /**
   * Actualizar rate limit
   */
  updateRateLimit(contactId) {
    const now = Date.now();
    const limit = this.rateLimits.get(contactId) || { requests: [] };
    
    limit.requests.push(now);
    
    // Mantener solo requests de la última hora
    const hourMs = 60 * 60 * 1000;
    limit.requests = limit.requests.filter(time => now - time < hourMs);
    
    this.rateLimits.set(contactId, limit);
  }
  
  /**
   * Generar clave de cache
   */
  generateCacheKey(prompt, context, model) {
    const contextStr = JSON.stringify(context);
    return `${model}:${prompt}:${contextStr}`.substring(0, 100);
  }
  
  /**
   * Obtener modelo por defecto para proveedor
   */
  getDefaultModel(provider) {
    const defaults = {
      openai: 'gpt-3.5-turbo',
      anthropic: 'claude-3-sonnet',
      google: 'gemini-pro',
      local: 'local-model'
    };
    
    return defaults[provider] || 'gpt-3.5-turbo';
  }
  
  /**
   * Agrupar elementos por campo
   */
  groupBy(array, field) {
    return array.reduce((groups, item) => {
      const key = item[field] || 'unknown';
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }
  
  /**
   * Calcular rating promedio
   */
  calculateAvgRating(responses) {
    const ratings = responses
      .map(r => r.feedback?.rating)
      .filter(rating => rating);
    
    if (ratings.length === 0) return 0;
    
    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  }
  
  /**
   * Analizar sentimiento (placeholder)
   */
  async analyzeSentiment(messages) {
    // Implementación básica de análisis de sentimiento
    return {
      overall: 'neutral',
      confidence: 0.7,
      breakdown: {
        positive: 0.3,
        neutral: 0.5,
        negative: 0.2
      }
    };
  }
  
  /**
   * Extraer temas (placeholder)
   */
  async extractTopics(messages) {
    // Implementación básica de extracción de temas
    return ['general', 'support', 'sales'];
  }
  
  /**
   * Detectar intención (placeholder)
   */
  async detectIntent(messages) {
    // Implementación básica de detección de intención
    return {
      intent: 'information_request',
      confidence: 0.8
    };
  }
  
  /**
   * Determinar etapa de conversación
   */
  determineConversationStage(messages) {
    if (messages.length === 0) return 'new';
    if (messages.length <= 3) return 'initial';
    if (messages.length <= 10) return 'active';
    return 'ongoing';
  }
}

// Instancia singleton del servicio
let serviceInstance = null;

/**
 * Obtener instancia del servicio de IA
 * @returns {AIService} Instancia del servicio
 */
export function getAIService() {
  if (!serviceInstance) {
    serviceInstance = new AIService();
  }
  return serviceInstance;
}

export default AIService;
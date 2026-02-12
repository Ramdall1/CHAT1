/**
 * Modelo de Respuesta de IA
 * 
 * Define la estructura y validación para respuestas generadas por IA,
 * incluyendo metadatos, contexto y métricas de calidad.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { generateId } from '../../../../services/core/core/database.js';

/**
 * Clase para gestionar respuestas de IA
 */
export class AIResponse {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.conversationId = data.conversationId || '';
    this.contactId = data.contactId || '';
    this.messageId = data.messageId || '';
    this.prompt = data.prompt || '';
    this.response = data.response || '';
    this.model = data.model || 'gpt-3.5-turbo';
    this.provider = data.provider || 'openai';
    this.type = data.type || 'text'; // text, template, action
    this.confidence = data.confidence || 0;
    this.tokens = {
      prompt: data.tokens?.prompt || 0,
      completion: data.tokens?.completion || 0,
      total: data.tokens?.total || 0
    };
    this.cost = data.cost || 0;
    this.processingTime = data.processingTime || 0;
    this.context = data.context || {};
    this.metadata = {
      temperature: data.metadata?.temperature || 0.7,
      maxTokens: data.metadata?.maxTokens || 1000,
      topP: data.metadata?.topP || 1,
      frequencyPenalty: data.metadata?.frequencyPenalty || 0,
      presencePenalty: data.metadata?.presencePenalty || 0,
      ...data.metadata
    };
    this.quality = {
      relevance: data.quality?.relevance || 0,
      coherence: data.quality?.coherence || 0,
      helpfulness: data.quality?.helpfulness || 0,
      safety: data.quality?.safety || 0,
      ...data.quality
    };
    this.feedback = {
      rating: data.feedback?.rating || 0,
      comment: data.feedback?.comment || '',
      helpful: data.feedback?.helpful || null,
      ...data.feedback
    };
    this.status = data.status || 'completed'; // pending, completed, failed, cancelled
    this.error = data.error || null;
    this.retryCount = data.retryCount || 0;
    this.tags = data.tags || [];
    this.category = data.category || 'general';
    this.isUsed = data.isUsed || false;
    this.usedAt = data.usedAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    this.validate();
  }
  
  /**
   * Validar los datos de la respuesta de IA
   */
  validate() {
    const errors = [];
    
    if (!this.conversationId) {
      errors.push('ID de conversación es requerido');
    }
    
    if (!this.contactId) {
      errors.push('ID de contacto es requerido');
    }
    
    if (!this.prompt) {
      errors.push('Prompt es requerido');
    }
    
    if (!this.response && this.status === 'completed') {
      errors.push('Respuesta es requerida para estado completado');
    }
    
    if (!['openai', 'anthropic', 'google', 'local'].includes(this.provider)) {
      errors.push('Proveedor de IA no válido');
    }
    
    if (!['text', 'template', 'action', 'analysis'].includes(this.type)) {
      errors.push('Tipo de respuesta no válido');
    }
    
    if (this.confidence < 0 || this.confidence > 1) {
      errors.push('Confianza debe estar entre 0 y 1');
    }
    
    if (!['pending', 'completed', 'failed', 'cancelled'].includes(this.status)) {
      errors.push('Estado no válido');
    }
    
    if (this.feedback.rating && (this.feedback.rating < 1 || this.feedback.rating > 5)) {
      errors.push('Rating debe estar entre 1 y 5');
    }
    
    if (errors.length > 0) {
      throw new Error(`Datos de respuesta de IA inválidos: ${errors.join(', ')}`);
    }
  }
  
  /**
   * Marcar respuesta como usada
   */
  markAsUsed() {
    this.isUsed = true;
    this.usedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Actualizar feedback de la respuesta
   * @param {Object} feedback - Feedback del usuario
   */
  updateFeedback(feedback) {
    this.feedback = {
      ...this.feedback,
      ...feedback,
      updatedAt: new Date().toISOString()
    };
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Actualizar métricas de calidad
   * @param {Object} quality - Métricas de calidad
   */
  updateQuality(quality) {
    this.quality = {
      ...this.quality,
      ...quality
    };
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Calcular costo estimado basado en tokens
   * @param {Object} pricing - Precios por modelo
   */
  calculateCost(pricing = {}) {
    const modelPricing = pricing[this.model] || {
      prompt: 0.0015, // $0.0015 por 1K tokens
      completion: 0.002 // $0.002 por 1K tokens
    };
    
    const promptCost = (this.tokens.prompt / 1000) * modelPricing.prompt;
    const completionCost = (this.tokens.completion / 1000) * modelPricing.completion;
    
    this.cost = promptCost + completionCost;
    this.updatedAt = new Date().toISOString();
    
    return this.cost;
  }
  
  /**
   * Obtener resumen de la respuesta
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      model: this.model,
      confidence: this.confidence,
      tokens: this.tokens.total,
      cost: this.cost,
      processingTime: this.processingTime,
      status: this.status,
      rating: this.feedback.rating,
      createdAt: this.createdAt
    };
  }
  
  /**
   * Verificar si la respuesta es de alta calidad
   */
  isHighQuality() {
    const avgQuality = (
      this.quality.relevance +
      this.quality.coherence +
      this.quality.helpfulness +
      this.quality.safety
    ) / 4;
    
    return avgQuality >= 0.8 && this.confidence >= 0.7;
  }
  
  /**
   * Obtener tiempo de procesamiento en formato legible
   */
  getProcessingTimeFormatted() {
    if (this.processingTime < 1000) {
      return `${this.processingTime}ms`;
    } else {
      return `${(this.processingTime / 1000).toFixed(2)}s`;
    }
  }
  
  /**
   * Verificar si necesita retry
   */
  needsRetry() {
    return this.status === 'failed' && this.retryCount < 3;
  }
  
  /**
   * Incrementar contador de retry
   */
  incrementRetry() {
    this.retryCount++;
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Agregar tag
   * @param {string} tag - Tag a agregar
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date().toISOString();
    }
  }
  
  /**
   * Remover tag
   * @param {string} tag - Tag a remover
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date().toISOString();
    }
  }
  
  /**
   * Convertir a JSON
   */
  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      contactId: this.contactId,
      messageId: this.messageId,
      prompt: this.prompt,
      response: this.response,
      model: this.model,
      provider: this.provider,
      type: this.type,
      confidence: this.confidence,
      tokens: this.tokens,
      cost: this.cost,
      processingTime: this.processingTime,
      context: this.context,
      metadata: this.metadata,
      quality: this.quality,
      feedback: this.feedback,
      status: this.status,
      error: this.error,
      retryCount: this.retryCount,
      tags: this.tags,
      category: this.category,
      isUsed: this.isUsed,
      usedAt: this.usedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
  
  /**
   * Crear desde JSON
   * @param {Object} json - Datos en formato JSON
   */
  static fromJSON(json) {
    return new AIResponse(json);
  }
  
  /**
   * Crear respuesta de error
   * @param {string} conversationId - ID de conversación
   * @param {string} contactId - ID de contacto
   * @param {string} prompt - Prompt original
   * @param {Error} error - Error ocurrido
   */
  static createError(conversationId, contactId, prompt, error) {
    return new AIResponse({
      conversationId,
      contactId,
      prompt,
      status: 'failed',
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  /**
   * Crear respuesta exitosa
   * @param {Object} data - Datos de la respuesta
   */
  static createSuccess(data) {
    return new AIResponse({
      ...data,
      status: 'completed'
    });
  }
}

export default AIResponse;
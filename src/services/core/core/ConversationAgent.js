/**
 * CONVERSATION AGENT - Agente evolutivo para flujos conversacionales
 * 
 * Agente inteligente que maneja la lógica conversacional, detección de intenciones,
 * generación de respuestas con IA y gestión de flujos de conversación a través de eventos.
 * 
 * @author Sistema Event-Driven Evolutivo
 * @version 1.0.0
 */

import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { createLogger } from '../core/evolutive-logger.js';
import { v4 as uuidv4 } from 'uuid';

class ConversationAgent {
  constructor(eventHub) {
    this.eventHub = eventHub;
    this.logger = createLogger('ConversationAgent');
    this.agentId = uuidv4();
    this.isActive = false;
        
    // Estado del agente
    this.state = {
      activeConversations: new Map(),
      processedMessages: 0,
      aiResponses: 0,
      templatesUsed: 0,
      lastActivity: null,
      errors: 0
    };
        
    // Configuración
    this.config = {
      aiEndpoint: process.env.AI_ENDPOINT || 'http://localhost:1234/v1/chat/completions',
      aiModel: process.env.AI_MODEL || 'local-model',
      maxTokens: 500,
      temperature: 0.7,
      intentionThreshold: 0.7,
      templateCooldown: 300000, // 5 minutos
      maxRetries: 3,
      responseTimeout: 30000
    };

    // Palabras clave para detección de intención
    this.intentionKeywords = {
      highIntention: [
        'quiero participar', 'me interesa mucho', 'cómo me inscribo',
        'quiero comprar', 'me apunto', 'acepto', 'sí quiero',
        'mándame el formulario', 'quiero el link', 'envíame la info'
      ],
      mediumIntention: [
        'me interesa', 'cuánto cuesta', 'más información',
        'cómo funciona', 'qué incluye', 'cuáles son los requisitos',
        'hasta cuándo', 'hay descuentos', 'formas de pago'
      ],
      lowIntention: [
        'de qué se trata', 'no entiendo', 'explícame',
        'qué es esto', 'cuéntame más', 'información',
        'detalles', 'qué premios', 'cuándo es'
      ],
      rejection: [
        'no me interesa', 'no quiero', 'no gracias', 'déjame en paz',
        'no molestes', 'estafa', 'fraude', 'no confío',
        'stop', 'basta', 'eliminar', 'borrar'
      ]
    };

    // Etapas de conversación
    this.conversationStages = {
      NEW: 'new',
      INITIAL: 'initial',
      ENGAGED: 'engaged',
      INTERESTED: 'interested',
      QUALIFIED: 'qualified',
      CONVERTED: 'converted',
      REJECTED: 'rejected'
    };

    // Métricas de rendimiento
    this.metrics = {
      intentionDetections: 0,
      aiResponsesGenerated: 0,
      templatesDeployed: 0,
      conversionsAchieved: 0,
      averageResponseTime: 0,
      successRate: 0
    };
        
    this.setupEventListeners();
  }

  /**
     * Configura los listeners de eventos
     */
  setupEventListeners() {
    // Eventos de mensajes
    this.eventHub.on('user.message.received', this.handleIncomingMessage.bind(this));
    this.eventHub.on('user.message.process', this.handleProcessMessage.bind(this));
        
    // Eventos de conversación
    this.eventHub.on('user.conversation.start', this.handleConversationStart.bind(this));
    this.eventHub.on('user.conversation.continue', this.handleConversationContinue.bind(this));
    this.eventHub.on('user.conversation.end', this.handleConversationEnd.bind(this));
        
    // Eventos de IA
    this.eventHub.on('ai.response.request', this.handleAIResponseRequest.bind(this));
    this.eventHub.on('ai.intention.detect', this.handleIntentionDetection.bind(this));
        
    // Eventos de plantillas
    this.eventHub.on('user.template.send', this.handleTemplateSend.bind(this));
    this.eventHub.on('user.template.request', this.handleTemplateRequest.bind(this));
        
    // Eventos del sistema
    this.eventHub.on('system.agent.activate', this.handleActivateAgent.bind(this));
    this.eventHub.on('system.agent.deactivate', this.handleDeactivateAgent.bind(this));
    this.eventHub.on('system.stats.request', this.handleStatsRequest.bind(this));
    this.eventHub.on('system.health.check', this.handleHealthCheck.bind(this));
        
    // Eventos de contexto
    this.eventHub.on('user.context.update', this.handleContextUpdate.bind(this));
    this.eventHub.on('user.context.request', this.handleContextRequest.bind(this));
        
    this.logger.info('🎯 ConversationAgent listeners configurados', { agentId: this.agentId });
  }

  /**
     * Activa el agente
     */
  async activate() {
    if (this.isActive) return;
        
    try {
      this.isActive = true;
      this.state.lastActivity = new Date();
            
      // Inicializar directorios y configuración
      await this.initializeAgent();
            
      this.logger.info('✅ ConversationAgent activado', {
        agentId: this.agentId,
        config: this.config
      });
            
      this.eventHub.emit('system.agent.activated', {
        agentType: 'ConversationAgent',
        agentId: this.agentId,
        timestamp: new Date(),
        capabilities: [
          'message_processing',
          'intention_detection',
          'ai_response_generation',
          'template_management',
          'conversation_flow'
        ]
      });
            
    } catch (error) {
      this.logger.error('❌ Error activando ConversationAgent', { error: error.message });
      this.eventHub.emit('error.agent.activation_failed', {
        agentType: 'ConversationAgent',
        agentId: this.agentId,
        error: error.message
      });
    }
  }

  /**
     * Inicializa el agente
     */
  async initializeAgent() {
    const baseDir = process.cwd();
    const directories = [
      path.join(baseDir, 'config'),
      path.join(baseDir, 'templates'),
      path.join(baseDir, 'data', 'conversations'),
      path.join(baseDir, 'data', 'intentions'),
      path.join(baseDir, 'data', 'responses')
    ];

    for (const dir of directories) {
      await fs.ensureDir(dir);
    }
  }

  /**
     * Maneja mensajes entrantes
     */
  async handleIncomingMessage(eventData) {
    if (!this.isActive) return;
        
    const startTime = Date.now();
    const { phone, message, metadata = {}, eventId, source } = eventData;
        
    try {
      this.logger.info('💬 Procesando mensaje entrante', { 
        phone, 
        messageLength: message?.length,
        source 
      });
            
      // Normalizar teléfono
      const normalizedPhone = this.normalizePhone(phone);
            
      // Solicitar contexto del usuario
      this.eventHub.emit('user.context.request', {
        phone: normalizedPhone,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
            
      // Solicitar información del contacto
      this.eventHub.emit('user.contact.get', {
        phone: normalizedPhone,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
            
      // Procesar el mensaje después de obtener contexto
      setTimeout(() => {
        this.eventHub.emit('user.message.process', {
          phone: normalizedPhone,
          message,
          metadata,
          source: 'ConversationAgent',
          linkedToEvent: eventId
        });
      }, 100); // Pequeño delay para permitir que llegue el contexto
            
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);
            
    } catch (error) {
      this.state.errors++;
      this.logger.error('❌ Error procesando mensaje entrante', { 
        phone, 
        error: error.message,
        source 
      });
            
      this.eventHub.emit('error.message.processing_failed', {
        phone,
        message,
        error: error.message,
        source,
        linkedToEvent: eventId
      });
    }
  }

  /**
     * Procesa un mensaje con contexto
     */
  async handleProcessMessage(eventData) {
    if (!this.isActive) return;
        
    const { phone, message, metadata = {}, eventId, source } = eventData;
        
    try {
      // Obtener o crear conversación activa
      let conversation = this.state.activeConversations.get(phone);
      if (!conversation) {
        conversation = {
          phone,
          startTime: new Date(),
          messages: [],
          stage: this.conversationStages.NEW,
          context: {},
          contact: null
        };
        this.state.activeConversations.set(phone, conversation);
      }
            
      // Agregar mensaje a la conversación
      conversation.messages.push({
        message,
        timestamp: new Date(),
        metadata
      });
            
      // Detectar intención
      this.eventHub.emit('ai.intention.detect', {
        phone,
        message,
        conversation,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
            
      this.state.processedMessages++;
            
    } catch (error) {
      this.state.errors++;
      this.logger.error('❌ Error procesando mensaje', { 
        phone, 
        error: error.message 
      });
    }
  }

  /**
     * Maneja la detección de intención
     */
  async handleIntentionDetection(eventData) {
    if (!this.isActive) return;
        
    const { phone, message, conversation, eventId, source } = eventData;
        
    try {
      const intentionResult = await this.detectIntention(message, conversation);
            
      this.logger.info('🎯 Intención detectada', {
        phone,
        intention: intentionResult.type,
        confidence: intentionResult.confidence
      });
            
      // Emitir resultado de detección de intención
      this.eventHub.emit('ai.intention.detected', {
        phone,
        message,
        intentionResult,
        conversation,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
            
      // Determinar acción basada en la intención
      await this.determineAction(phone, message, conversation, intentionResult, eventId);
            
      this.metrics.intentionDetections++;
            
    } catch (error) {
      this.state.errors++;
      this.logger.error('❌ Error detectando intención', { 
        phone, 
        error: error.message 
      });
            
      this.eventHub.emit('error.intention.detection_failed', {
        phone,
        message,
        error: error.message,
        source,
        linkedToEvent: eventId
      });
    }
  }

  /**
     * Detecta la intención del mensaje
     */
  async detectIntention(message, conversation) {
    const messageText = message.toLowerCase();
    let maxConfidence = 0;
    let detectedType = 'informational';
        
    // Verificar palabras clave
    for (const [type, keywords] of Object.entries(this.intentionKeywords)) {
      for (const keyword of keywords) {
        if (messageText.includes(keyword.toLowerCase())) {
          const confidence = this.calculateKeywordConfidence(keyword, messageText);
          if (confidence > maxConfidence) {
            maxConfidence = confidence;
            detectedType = type;
          }
        }
      }
    }
        
    // Ajustar confianza basada en contexto
    const contextAdjustment = this.adjustConfidenceByContext(maxConfidence, conversation);
        
    return {
      type: detectedType,
      confidence: Math.min(contextAdjustment, 1.0),
      keywords: this.extractMatchedKeywords(messageText, detectedType),
      contextFactors: this.getContextFactors(conversation)
    };
  }

  /**
     * Calcula la confianza de una palabra clave
     */
  calculateKeywordConfidence(keyword, messageText) {
    const keywordLength = keyword.length;
    const messageLength = messageText.length;
        
    // Confianza base por longitud de palabra clave
    let confidence = Math.min(keywordLength / 20, 0.8);
        
    // Bonus si la palabra clave está al inicio o final
    if (messageText.startsWith(keyword) || messageText.endsWith(keyword)) {
      confidence += 0.1;
    }
        
    // Bonus si es una coincidencia exacta de palabra
    const words = messageText.split(/\s+/);
    if (words.includes(keyword)) {
      confidence += 0.15;
    }
        
    return confidence;
  }

  /**
     * Determina la acción a tomar basada en la intención
     */
  async determineAction(phone, message, conversation, intentionResult, eventId) {
    const { type, confidence } = intentionResult;
        
    if (confidence < this.config.intentionThreshold) {
      // Baja confianza - respuesta informacional
      this.eventHub.emit('ai.response.request', {
        phone,
        message,
        conversation,
        responseType: 'informational',
        intentionResult,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
      return;
    }
        
    switch (type) {
    case 'highIntention':
      this.eventHub.emit('user.intention.high', {
        phone,
        message,
        conversation,
        intentionResult,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
      break;
                
    case 'mediumIntention':
      this.eventHub.emit('user.intention.medium', {
        phone,
        message,
        conversation,
        intentionResult,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
      break;
                
    case 'lowIntention':
      this.eventHub.emit('ai.response.request', {
        phone,
        message,
        conversation,
        responseType: 'informational',
        intentionResult,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
      break;
                
    case 'rejection':
      this.eventHub.emit('user.intention.rejection', {
        phone,
        message,
        conversation,
        intentionResult,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
      break;
                
    default:
      this.eventHub.emit('ai.response.request', {
        phone,
        message,
        conversation,
        responseType: 'general',
        intentionResult,
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
    }
  }

  /**
     * Maneja solicitudes de respuesta de IA
     */
  async handleAIResponseRequest(eventData) {
    if (!this.isActive) return;
        
    const { phone, message, conversation, responseType, intentionResult, eventId, source } = eventData;
        
    try {
      this.logger.info('🤖 Generando respuesta de IA', {
        phone,
        responseType,
        intention: intentionResult?.type
      });
            
      const aiResponse = await this.generateAIResponse(
        message, 
        conversation, 
        { responseType, intentionResult }
      );
            
      if (aiResponse) {
        this.logger.info('✅ Respuesta de IA generada', {
          phone,
          responseLength: aiResponse.length
        });
                
        // Emitir respuesta generada
        this.eventHub.emit('ai.response.generated', {
          phone,
          message,
          response: aiResponse,
          responseType,
          intentionResult,
          conversation,
          source: 'ConversationAgent',
          linkedToEvent: eventId
        });
                
        // Enviar mensaje
        this.eventHub.emit('user.message.send', {
          phone,
          message: aiResponse,
          messageType: 'ai_response',
          metadata: {
            responseType,
            intention: intentionResult?.type,
            confidence: intentionResult?.confidence
          },
          source: 'ConversationAgent',
          linkedToEvent: eventId
        });
                
        this.metrics.aiResponsesGenerated++;
        this.state.aiResponses++;
      }
            
    } catch (error) {
      this.state.errors++;
      this.logger.error('❌ Error generando respuesta de IA', { 
        phone, 
        error: error.message 
      });
            
      // Enviar respuesta de fallback
      this.eventHub.emit('user.message.send', {
        phone,
        message: this.getErrorResponse(),
        messageType: 'error_fallback',
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
    }
  }

  /**
     * Genera respuesta de IA
     */
  async generateAIResponse(message, conversation, options = {}) {
    try {
      const prompt = this.buildAIPrompt(message, conversation, options);
            
      const response = await axios.post(this.config.aiEndpoint, {
        model: this.config.aiModel,
        messages: [
          { role: 'system', content: this.getSystemPrompt(options) },
          { role: 'user', content: prompt }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      }, {
        timeout: this.config.responseTimeout
      });
            
      return response.data.choices[0]?.message?.content?.trim();
            
    } catch (error) {
      this.logger.error('Error generando respuesta de IA:', error.message);
      return null;
    }
  }

  /**
     * Construye el prompt para la IA
     */
  buildAIPrompt(message, conversation, options = {}) {
    const { responseType, intentionResult } = options;
        
    let prompt = `Mensaje del usuario: "${message}"\n\n`;
        
    if (conversation && conversation.messages.length > 1) {
      prompt += 'Contexto de conversación:\n';
      const recentMessages = conversation.messages.slice(-3);
      recentMessages.forEach((msg, index) => {
        prompt += `${index + 1}. ${msg.message}\n`;
      });
      prompt += '\n';
    }
        
    if (intentionResult) {
      prompt += `Intención detectada: ${intentionResult.type} (confianza: ${intentionResult.confidence})\n`;
      prompt += `Factores de contexto: ${JSON.stringify(intentionResult.contextFactors)}\n\n`;
    }
        
    prompt += `Tipo de respuesta solicitada: ${responseType || 'general'}\n\n`;
    prompt += 'Genera una respuesta apropiada, empática y persuasiva.';
        
    return prompt;
  }

  /**
     * Obtiene el prompt del sistema para IA
     */
  getSystemPrompt(options = {}) {
    return `Eres un asistente comercial empático y profesional especializado en WhatsApp Business.

PERSONALIDAD:
- Empático y comprensivo
- Profesional pero cercano
- Persuasivo sin ser agresivo
- Siempre útil y orientado a soluciones

REGLAS:
1. Responde SIEMPRE en español
2. Usa emojis apropiados pero sin exceso
3. Mantén respuestas concisas (máximo 2-3 líneas)
4. Adapta el tono al contexto del cliente
5. Nunca presiones demasiado
6. Siempre ofrece valor en cada respuesta

CONTEXTO DEL NEGOCIO:
- Vendes productos/servicios de alta calidad
- Ofreces excelente atención al cliente
- Tienes promociones y ofertas especiales
- El proceso es simple y seguro

Genera una respuesta apropiada basada en el contexto proporcionado.`;
  }

  /**
     * Maneja envío de plantillas
     */
  async handleTemplateSend(eventData) {
    if (!this.isActive) return;
        
    const { phone, templateName, variables = {}, eventId, source } = eventData;
        
    try {
      this.logger.info('📄 Enviando plantilla', { phone, templateName });
            
      // Aquí se implementaría la lógica de plantillas
      // Por ahora emitimos un evento de éxito
      this.eventHub.emit('user.template.sent', {
        phone,
        templateName,
        variables,
        timestamp: new Date(),
        source: 'ConversationAgent',
        linkedToEvent: eventId
      });
            
      this.metrics.templatesDeployed++;
      this.state.templatesUsed++;
            
    } catch (error) {
      this.state.errors++;
      this.logger.error('❌ Error enviando plantilla', { 
        phone, 
        templateName,
        error: error.message 
      });
    }
  }

  /**
     * Maneja actualizaciones de contexto
     */
  async handleContextUpdate(eventData) {
    const { phone, context, eventId } = eventData;
        
    const conversation = this.state.activeConversations.get(phone);
    if (conversation) {
      conversation.context = { ...conversation.context, ...context };
      this.logger.info('📝 Contexto actualizado', { phone });
    }
  }

  /**
     * Ajusta confianza basada en contexto
     */
  adjustConfidenceByContext(baseConfidence, conversation) {
    let adjustment = baseConfidence;
        
    if (conversation && conversation.messages.length > 1) {
      // Bonus por conversación activa
      adjustment += 0.1;
            
      // Bonus por mensajes recientes
      if (conversation.messages.length > 3) {
        adjustment += 0.05;
      }
    }
        
    return Math.min(adjustment, 1.0);
  }

  /**
     * Obtiene factores de contexto
     */
  getContextFactors(conversation) {
    return {
      messageCount: conversation?.messages?.length || 0,
      conversationAge: conversation?.startTime ? 
        Date.now() - new Date(conversation.startTime).getTime() : 0,
      stage: conversation?.stage || 'new'
    };
  }

  /**
     * Extrae palabras clave coincidentes
     */
  extractMatchedKeywords(messageText, intentionType) {
    const keywords = this.intentionKeywords[intentionType] || [];
    return keywords.filter(keyword => 
      messageText.includes(keyword.toLowerCase())
    );
  }

  /**
     * Normaliza número telefónico
     */
  normalizePhone(phone) {
    if (!phone) return null;
    let normalized = phone.toString().replace(/[^\d+]/g, '');
    if (!normalized.startsWith('+')) {
      normalized = '+57' + normalized;
    }
    return normalized;
  }

  /**
     * Respuesta de error por defecto
     */
  getErrorResponse() {
    return 'Disculpa, estoy teniendo problemas técnicos. ¿Podrías repetir tu mensaje? 🤖';
  }

  /**
     * Actualiza métricas
     */
  updateMetrics(responseTime) {
    this.state.lastActivity = new Date();
        
    // Calcular tiempo promedio de respuesta
    const totalOperations = this.state.processedMessages + this.state.aiResponses;
    if (totalOperations > 0) {
      this.metrics.averageResponseTime = 
                (this.metrics.averageResponseTime * (totalOperations - 1) + responseTime) / 
                totalOperations;
    }
        
    // Calcular tasa de éxito
    if (this.state.processedMessages > 0) {
      this.metrics.successRate = 
                (this.state.processedMessages - this.state.errors) / this.state.processedMessages;
    }
  }

  /**
     * Maneja solicitudes de estadísticas
     */
  async handleStatsRequest(eventData) {
    if (!this.isActive) return;
        
    const { eventId, source } = eventData;
        
    const stats = {
      agentType: 'ConversationAgent',
      agentId: this.agentId,
      state: {
        ...this.state,
        activeConversations: this.state.activeConversations.size
      },
      metrics: this.metrics,
      config: this.config,
      isActive: this.isActive,
      timestamp: new Date()
    };
        
    this.eventHub.emit('system.stats.response', {
      stats,
      source,
      linkedToEvent: eventId
    });
  }

  /**
     * Maneja verificaciones de salud
     */
  async handleHealthCheck(eventData) {
    const { eventId, source } = eventData;
        
    const health = {
      agentType: 'ConversationAgent',
      agentId: this.agentId,
      status: this.isActive ? 'healthy' : 'inactive',
      lastActivity: this.state.lastActivity,
      errors: this.state.errors,
      activeConversations: this.state.activeConversations.size,
      uptime: this.isActive ? Date.now() - new Date(this.state.lastActivity).getTime() : 0
    };
        
    this.eventHub.emit('system.health.response', {
      health,
      source,
      linkedToEvent: eventId
    });
  }

  /**
     * Maneja activación del agente
     */
  async handleActivateAgent(eventData) {
    const { agentType } = eventData;
    if (agentType === 'ConversationAgent' || agentType === 'all') {
      await this.activate();
    }
  }

  /**
     * Maneja desactivación del agente
     */
  async handleDeactivateAgent(eventData) {
    const { agentType } = eventData;
    if (agentType === 'ConversationAgent' || agentType === 'all') {
      await this.deactivate();
    }
  }

  /**
     * Desactiva el agente
     */
  async deactivate() {
    if (!this.isActive) return;
        
    this.isActive = false;
        
    this.logger.info('🔴 ConversationAgent desactivado', {
      agentId: this.agentId,
      finalStats: this.metrics
    });
        
    this.eventHub.emit('system.agent.deactivated', {
      agentType: 'ConversationAgent',
      agentId: this.agentId,
      timestamp: new Date(),
      finalMetrics: this.metrics
    });
  }

  /**
     * Obtiene el estado actual del agente
     */
  getState() {
    return {
      agentId: this.agentId,
      isActive: this.isActive,
      state: {
        ...this.state,
        activeConversations: this.state.activeConversations.size
      },
      metrics: this.metrics,
      config: this.config
    };
  }
}

export default ConversationAgent;
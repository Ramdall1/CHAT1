/**
 * Conversation Flow Manager - Gestor unificado del flujo conversacional
 * Integra detección de intención, respuesta con IA, manejo de plantillas y actualización de contexto
 */

import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { createLogger } from '../services/core/core/logger.js';
import contactsManager from './contacts_manager.js';
import contextManager from './context_manager.js';
import statsManager from './stats_manager.js';
import errorManager from './error_manager.js';
import { ensureDirectories } from '../utils/directory-utils.js';

class ConversationFlowManager {
  constructor() {
    this.baseDir = process.cwd();
    this.configDir = path.join(this.baseDir, 'config');
    this.templatesDir = path.join(this.baseDir, 'templates');
        
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

    this.conversationStages = {
      NEW: 'new',
      INITIAL: 'initial',
      ENGAGED: 'engaged',
      INTERESTED: 'interested',
      QUALIFIED: 'qualified',
      CONVERTED: 'converted',
      REJECTED: 'rejected'
    };

    this.isInitialized = false;
    this.logger = createLogger('CONVERSATION_FLOW_MANAGER');
  }

  /**
     * Inicializar el gestor de flujo conversacional
     */
  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.ensureDirectories();
      await this.loadConfig();
            
      this.isInitialized = true;
      this.logger.info('ConversationFlowManager inicializado correctamente');
            
      return { success: true, message: 'ConversationFlowManager inicializado' };
            
    } catch (error) {
      this.logger.error('Error inicializando ConversationFlowManager:', error);
      await errorManager.handleError(error, 'ConversationFlowManager.initialize');
      throw error;
    }
  }

  /**
     * Asegurar que existan los directorios necesarios
     */
  async ensureDirectories() {
    const directories = [
      this.configDir,
      this.templatesDir,
      path.join(this.baseDir, 'data', 'conversations'),
      path.join(this.baseDir, 'data', 'intentions'),
      path.join(this.baseDir, 'data', 'responses')
    ];

    await ensureDirectories(directories);
  }

  /**
     * Cargar configuración
     */
  async loadConfig() {
    try {
      const configPath = path.join(this.configDir, 'conversation-config.json');
      if (await fs.pathExists(configPath)) {
        const savedConfig = await fs.readJson(configPath);
        this.config = { ...this.config, ...savedConfig };
      } else {
        await this.saveConfig();
      }
    } catch (error) {
      this.logger.warn('Error cargando configuración, usando valores por defecto');
    }
  }

  /**
     * Guardar configuración
     */
  async saveConfig() {
    try {
      const configPath = path.join(this.configDir, 'conversation-config.json');
      await fs.writeJson(configPath, this.config, { spaces: 2 });
    } catch (error) {
      this.logger.error('Error guardando configuración:', error);
    }
  }

  /**
     * Procesar mensaje entrante - Punto de entrada principal
     */
  async processIncomingMessage(phone, message, metadata = {}) {
    const startTime = Date.now();
        
    try {
      this.logger.info(`Procesando mensaje de ${phone}: "${message}"`);

      // 1. Normalizar teléfono y obtener/crear contacto
      const normalizedPhone = this.normalizePhone(phone);
      let contact = await contactsManager.getContact(normalizedPhone);
            
      if (!contact) {
        contact = await contactsManager.createContact({
          phone: normalizedPhone,
          name: metadata.name || `Usuario ${normalizedPhone.slice(-4)}`,
          source: 'whatsapp'
        });
      }

      // 2. Cargar contexto conversacional
      const context = await contextManager.getContext(normalizedPhone);
            
      // 3. Registrar mensaje en contexto
      await contextManager.addMessage(normalizedPhone, {
        content: message,
        direction: 'inbound',
        timestamp: new Date().toISOString(),
        metadata: {
          ...metadata,
          processingStartTime: startTime
        }
      });

      // 4. Detectar intención
      const intentionResult = await this.detectIntention(message, context, contact);
            
      // 5. Actualizar estadísticas
      await statsManager.recordMessage(normalizedPhone, {
        direction: 'inbound',
        content: message,
        intention: intentionResult,
        timestamp: new Date().toISOString()
      });

      // 6. Determinar y ejecutar acción
      const actionResult = await this.determineAndExecuteAction(
        normalizedPhone, 
        message, 
        context, 
        contact, 
        intentionResult
      );

      // 7. Actualizar contexto con resultado
      await this.updateContextWithResult(normalizedPhone, actionResult, intentionResult);

      // 8. Actualizar contacto si es necesario
      await this.updateContactIfNeeded(contact, context, intentionResult);

      const processingTime = Date.now() - startTime;
      this.logger.info(`Mensaje procesado en ${processingTime}ms`);

      return {
        success: true,
        phone: normalizedPhone,
        action: actionResult.action,
        response: actionResult.response,
        intention: intentionResult,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Error procesando mensaje de ${phone}:`, error);
            
      await errorManager.handleError(error, 'ConversationFlowManager.processIncomingMessage', {
        phone,
        message,
        processingTime
      });

      return {
        success: false,
        error: error.message,
        response: this.getErrorResponse(),
        processingTime
      };
    }
  }

  /**
     * Detectar intención en el mensaje
     */
  async detectIntention(message, context, contact) {
    try {
      const text = message.toLowerCase().trim();
      let confidence = 0;
      let intentionType = 'none';
      const detectedPhrases = [];
      let stage = this.conversationStages.NEW;

      // Detectar rechazo primero
      const rejectionPhrases = this.intentionKeywords.rejection.filter(phrase => 
        text.includes(phrase)
      );
            
      if (rejectionPhrases.length > 0) {
        return {
          type: 'rejection',
          confidence: 0.95,
          stage: this.conversationStages.REJECTED,
          detectedPhrases: rejectionPhrases,
          isRejection: true,
          timestamp: new Date().toISOString()
        };
      }

      // Detectar intención de compra/participación
      for (const [level, phrases] of Object.entries(this.intentionKeywords)) {
        if (level === 'rejection') continue;
                
        const foundPhrases = phrases.filter(phrase => text.includes(phrase));
        if (foundPhrases.length > 0) {
          detectedPhrases.push(...foundPhrases);
                    
          switch (level) {
          case 'highIntention':
            confidence = Math.max(confidence, 0.9);
            intentionType = 'high_purchase';
            stage = this.conversationStages.QUALIFIED;
            break;
          case 'mediumIntention':
            confidence = Math.max(confidence, 0.7);
            intentionType = 'price_inquiry';
            stage = this.conversationStages.INTERESTED;
            break;
          case 'lowIntention':
            confidence = Math.max(confidence, 0.4);
            intentionType = 'information_seeking';
            stage = this.conversationStages.ENGAGED;
            break;
          }
        }
      }

      // Ajustar confianza basado en contexto
      confidence = this.adjustConfidenceByContext(confidence, context, contact);

      // Determinar si se detectó intención
      const detected = confidence >= this.config.intentionThreshold;

      const result = {
        type: intentionType,
        confidence,
        stage,
        detected,
        detectedPhrases,
        isRejection: false,
        contextFactors: this.getContextFactors(context, contact),
        timestamp: new Date().toISOString()
      };

      // Registrar en estadísticas
      await statsManager.recordInteraction(contact.phone, {
        type: 'intention_detection',
        result: result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      this.logger.error('Error detectando intención:', error);
      await errorManager.handleError(error, 'ConversationFlowManager.detectIntention');
            
      return {
        type: 'error',
        confidence: 0,
        stage: this.conversationStages.NEW,
        detected: false,
        detectedPhrases: [],
        isRejection: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
     * Determinar y ejecutar acción basada en la intención
     */
  async determineAndExecuteAction(phone, message, context, contact, intentionResult) {
    try {
      // Si es rechazo, manejar apropiadamente
      if (intentionResult.isRejection) {
        return await this.handleRejection(phone, message, context, contact);
      }

      // Si se detecta intención de compra alta
      if (intentionResult.detected && intentionResult.confidence >= 0.8) {
        return await this.handleHighIntention(phone, message, context, contact, intentionResult);
      }

      // Si se detecta intención media
      if (intentionResult.detected && intentionResult.confidence >= 0.6) {
        return await this.handleMediumIntention(phone, message, context, contact, intentionResult);
      }

      // Si es información general o baja intención
      return await this.handleInformationalResponse(phone, message, context, contact, intentionResult);

    } catch (error) {
      this.logger.error('Error determinando acción:', error);
      await errorManager.handleError(error, 'ConversationFlowManager.determineAndExecuteAction');
            
      return {
        action: 'error_response',
        response: this.getErrorResponse(),
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Manejar rechazo del usuario
     */
  async handleRejection(phone, message, context, contact) {
    try {
      const responses = [
        'Entiendo perfectamente, respeto tu decisión. Si en algún momento cambias de opinión, estaré aquí para ayudarte. ¡Que tengas un excelente día! 😊',
        'No hay problema, gracias por tu tiempo. Si necesitas algo en el futuro, no dudes en escribirme. ¡Cuídate mucho! 🙏',
        'Perfecto, quedo atento por si cambias de opinión. Gracias por tu honestidad y que tengas un buen día 😊'
      ];

      const response = responses[Math.floor(Math.random() * responses.length)];
            
      // Actualizar contacto como no interesado
      await contactsManager.updateContact(contact.id, {
        status: 'not_interested',
        lastInteraction: new Date().toISOString(),
        tags: [...(contact.tags || []), 'rejected']
      });

      // Registrar en contexto
      await contextManager.updateSessionData(phone, {
        stage: this.conversationStages.REJECTED,
        lastAction: 'rejection_handled',
        rejectionReason: message
      });

      return {
        action: 'rejection_handled',
        response,
        success: true,
        shouldContinue: false
      };

    } catch (error) {
      this.logger.error('Error manejando rechazo:', error);
      throw error;
    }
  }

  /**
     * Manejar intención alta (enviar plantilla/formulario)
     */
  async handleHighIntention(phone, message, context, contact, intentionResult) {
    try {
      // Verificar cooldown de plantilla
      const lastTemplateTime = context.sessionData?.lastTemplateTime;
      if (lastTemplateTime && (Date.now() - lastTemplateTime) < this.config.templateCooldown) {
        return {
          action: 'template_cooldown',
          response: 'Ya te envié el formulario hace un momento 😊 ¿Pudiste verlo? Si tienes algún problema para llenarlo, avísame y te ayudo 🤝',
          success: true
        };
      }

      // Generar respuesta personalizada con IA
      const aiResponse = await this.generateAIResponse(message, context, contact, {
        intention: 'high_purchase',
        shouldIncludeTemplate: true
      });

      // Enviar plantilla si está configurada
      const templateResult = await this.sendTemplate(phone, contact, 'purchase_form');

      // Actualizar contexto
      await contextManager.updateSessionData(phone, {
        stage: this.conversationStages.QUALIFIED,
        lastAction: 'template_sent',
        lastTemplateTime: Date.now(),
        templatesSent: (context.sessionData?.templatesSent || 0) + 1
      });

      // Actualizar contacto
      await contactsManager.updateContact(contact.id, {
        status: 'qualified',
        lastInteraction: new Date().toISOString(),
        tags: [...(contact.tags || []), 'high_intention', 'template_sent']
      });

      return {
        action: 'template_sent',
        response: aiResponse || '¡Perfecto! Te envío el formulario para que puedas participar. Solo toma unos minutos llenarlo 😊',
        templateSent: templateResult.success,
        success: true
      };

    } catch (error) {
      this.logger.error('Error manejando intención alta:', error);
      throw error;
    }
  }

  /**
     * Manejar intención media (información y persuasión)
     */
  async handleMediumIntention(phone, message, context, contact, intentionResult) {
    try {
      // Generar respuesta persuasiva con IA
      const aiResponse = await this.generateAIResponse(message, context, contact, {
        intention: 'medium_purchase',
        shouldPersuade: true
      });

      // Actualizar contexto
      await contextManager.updateSessionData(phone, {
        stage: this.conversationStages.INTERESTED,
        lastAction: 'persuasive_response',
        questionsAsked: (context.sessionData?.questionsAsked || 0) + 1
      });

      // Actualizar contacto
      await contactsManager.updateContact(contact.id, {
        status: 'interested',
        lastInteraction: new Date().toISOString(),
        tags: [...(contact.tags || []), 'medium_intention', 'asking_questions']
      });

      return {
        action: 'persuasive_response',
        response: aiResponse || this.getDefaultPersuasiveResponse(intentionResult.type),
        success: true
      };

    } catch (error) {
      this.logger.error('Error manejando intención media:', error);
      throw error;
    }
  }

  /**
     * Manejar respuesta informacional
     */
  async handleInformationalResponse(phone, message, context, contact, intentionResult) {
    try {
      // Generar respuesta informativa con IA
      const aiResponse = await this.generateAIResponse(message, context, contact, {
        intention: 'informational',
        shouldEducate: true
      });

      // Actualizar contexto
      await contextManager.updateSessionData(phone, {
        stage: this.conversationStages.ENGAGED,
        lastAction: 'informational_response',
        informationalQueries: (context.sessionData?.informationalQueries || 0) + 1
      });

      // Actualizar contacto
      await contactsManager.updateContact(contact.id, {
        status: 'engaged',
        lastInteraction: new Date().toISOString(),
        tags: [...(contact.tags || []), 'engaged', 'seeking_info']
      });

      return {
        action: 'informational_response',
        response: aiResponse || this.getDefaultInformationalResponse(),
        success: true
      };

    } catch (error) {
      this.logger.error('Error manejando respuesta informacional:', error);
      throw error;
    }
  }

  /**
     * Generar respuesta con IA
     */
  async generateAIResponse(message, context, contact, options = {}) {
    try {
      const prompt = this.buildAIPrompt(message, context, contact, options);
            
      const response = await axios.post(this.config.aiEndpoint, {
        model: this.config.aiModel,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(options)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: false
      }, {
        timeout: this.config.responseTimeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data?.choices?.[0]?.message?.content) {
        const aiResponse = response.data.choices[0].message.content.trim();
        this.logger.info(`Respuesta IA generada para ${contact.phone}`);
        return aiResponse;
      }

      return null;

    } catch (error) {
      this.logger.warn('Error generando respuesta IA, usando fallback:', error);
      await errorManager.handleError(error, 'ConversationFlowManager.generateAIResponse');
      return null;
    }
  }

  /**
     * Construir prompt para IA
     */
  buildAIPrompt(message, context, contact, options) {
    let prompt = `Mensaje del cliente: "${message}"\n\n`;
        
    prompt += 'Información del cliente:\n';
    prompt += `- Nombre: ${contact.name || 'Usuario'}\n`;
    prompt += `- Teléfono: ${contact.phone}\n`;
    prompt += `- Estado: ${contact.status || 'nuevo'}\n`;
    prompt += `- Etiquetas: ${(contact.tags || []).join(', ') || 'ninguna'}\n`;
        
    prompt += '\nContexto conversacional:\n';
    prompt += `- Etapa: ${context.sessionData?.stage || 'nueva'}\n`;
    prompt += `- Mensajes totales: ${context.messages?.length || 0}\n`;
    prompt += `- Última acción: ${context.sessionData?.lastAction || 'ninguna'}\n`;
        
    if (context.messages && context.messages.length > 0) {
      prompt += '\nÚltimos mensajes:\n';
      context.messages.slice(-3).forEach((msg, index) => {
        const direction = msg.direction === 'inbound' ? 'Cliente' : 'Bot';
        prompt += `${index + 1}. ${direction}: "${msg.content}"\n`;
      });
    }

    prompt += `\nTipo de respuesta requerida: ${options.intention || 'general'}\n`;
        
    if (options.shouldIncludeTemplate) {
      prompt += '\nNOTA: Confirma el interés y prepara para envío de formulario.\n';
    } else if (options.shouldPersuade) {
      prompt += '\nNOTA: Responde de manera persuasiva pero no agresiva.\n';
    } else if (options.shouldEducate) {
      prompt += '\nNOTA: Proporciona información útil y educativa.\n';
    }

    return prompt;
  }

  /**
     * Obtener prompt del sistema para IA
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
     * Enviar plantilla
     */
  async sendTemplate(phone, contact, templateName) {
    try {
      // Aquí se integraría con el sistema de plantillas existente
      // Por ahora retornamos un mock
      this.logger.info(`Enviando plantilla ${templateName} a ${phone}`);
            
      return {
        success: true,
        templateName,
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error enviando plantilla:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Actualizar contexto con resultado
     */
  async updateContextWithResult(phone, actionResult, intentionResult) {
    try {
      await contextManager.addMessage(phone, {
        content: actionResult.response,
        direction: 'outbound',
        timestamp: new Date().toISOString(),
        metadata: {
          action: actionResult.action,
          intention: intentionResult,
          success: actionResult.success
        }
      });

    } catch (error) {
      this.logger.error('Error actualizando contexto:', error);
    }
  }

  /**
     * Actualizar contacto si es necesario
     */
  async updateContactIfNeeded(contact, context, intentionResult) {
    try {
      const updates = {};
      let shouldUpdate = false;

      // Actualizar última interacción
      updates.lastInteraction = new Date().toISOString();
      shouldUpdate = true;

      // Actualizar etiquetas basadas en intención
      if (intentionResult.detected) {
        const newTags = [...(contact.tags || [])];
                
        if (intentionResult.type === 'high_purchase' && !newTags.includes('high_intention')) {
          newTags.push('high_intention');
          shouldUpdate = true;
        }
                
        if (newTags.length !== (contact.tags || []).length) {
          updates.tags = newTags;
        }
      }

      if (shouldUpdate) {
        await contactsManager.updateContact(contact.id, updates);
      }

    } catch (error) {
      this.logger.error('Error actualizando contacto:', error);
    }
  }

  // Métodos de utilidad

  /**
     * Ajustar confianza basado en contexto
     */
  adjustConfidenceByContext(baseConfidence, context, contact) {
    let adjustedConfidence = baseConfidence;

    // Ajustar por historial de mensajes
    const messageCount = context.messages?.length || 0;
    if (messageCount > 5) {
      adjustedConfidence += 0.1; // Mayor engagement
    }

    // Ajustar por etiquetas del contacto
    const tags = contact.tags || [];
    if (tags.includes('interested')) {
      adjustedConfidence += 0.1;
    }
    if (tags.includes('rejected')) {
      adjustedConfidence -= 0.3;
    }

    // Ajustar por etapa de conversación
    const stage = context.sessionData?.stage;
    if (stage === this.conversationStages.INTERESTED) {
      adjustedConfidence += 0.1;
    }

    return Math.min(Math.max(adjustedConfidence, 0), 1);
  }

  /**
     * Obtener factores de contexto
     */
  getContextFactors(context, contact) {
    return {
      messageCount: context.messages?.length || 0,
      stage: context.sessionData?.stage || this.conversationStages.NEW,
      lastAction: context.sessionData?.lastAction,
      contactStatus: contact.status,
      contactTags: contact.tags || [],
      hasTemplate: !!(context.sessionData?.lastTemplateTime)
    };
  }

  /**
     * Obtener respuesta por defecto persuasiva
     */
  getDefaultPersuasiveResponse(intentionType) {
    const responses = {
      price_inquiry: 'Te entiendo perfectamente. El precio es muy accesible considerando todo lo que incluye. ¿Te gustaría que te explique los beneficios específicos? 😊',
      information_seeking: '¡Excelente pregunta! Es normal querer conocer todos los detalles antes de decidir. Te explico todo lo que necesitas saber... 📋'
    };

    return responses[intentionType] || 'Gracias por tu interés. ¿En qué específicamente te puedo ayudar? 😊';
  }

  /**
     * Obtener respuesta informacional por defecto
     */
  getDefaultInformationalResponse() {
    return 'Gracias por escribir. Estoy aquí para ayudarte con cualquier duda que tengas. ¿En qué te puedo asistir? 😊';
  }

  /**
     * Obtener respuesta de error
     */
  getErrorResponse() {
    return 'Disculpa, hubo un problema técnico. ¿Podrías repetir tu mensaje? Estoy aquí para ayudarte 😊';
  }

  /**
     * Normalizar número de teléfono
     */
  normalizePhone(phone) {
    return phone.replace(/\D/g, '');
  }



  /**
     * Obtener estadísticas del flujo conversacional
     */
  async getFlowStats() {
    try {
      return {
        totalProcessed: await statsManager.getGlobalStats().totalMessages || 0,
        intentionsDetected: await statsManager.getGlobalStats().totalInteractions || 0,
        templatesSet: await statsManager.getGlobalStats().templatesSet || 0,
        conversionsRate: await this.calculateConversionRate(),
        averageResponseTime: await statsManager.getGlobalStats().averageResponseTime || 0
      };
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }

  /**
     * Calcular tasa de conversión
     */
  async calculateConversionRate() {
    try {
      const contacts = await contactsManager.getAllContacts();
      const total = contacts.length;
      const converted = contacts.filter(c => c.status === 'qualified' || c.status === 'converted').length;
            
      return total > 0 ? (converted / total) * 100 : 0;
    } catch (error) {
      this.logger.error('Error calculando tasa de conversión:', error);
      return 0;
    }
  }
}

// Crear instancia global
const conversationFlowManager = new ConversationFlowManager();

export default conversationFlowManager;
export { ConversationFlowManager };
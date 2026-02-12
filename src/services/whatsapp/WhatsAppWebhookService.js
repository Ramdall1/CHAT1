/**
 * WhatsApp Business Account Webhook Service
 * Servicio especializado para procesar webhooks de WhatsApp Business Account
 * Maneja la estructura completa del webhook según la documentación oficial
 */

import { createLogger } from '../core/core/logger.js';
import crypto from 'crypto';

const logger = createLogger('WHATSAPP_WEBHOOK');

export class WhatsAppWebhookService {
  constructor() {
    this.metrics = {
      totalWebhooksProcessed: 0,
      messagesProcessed: 0,
      contactsProcessed: 0,
      conversationsProcessed: 0,
      errorsCount: 0,
      lastProcessedAt: null,
      averageProcessingTime: 0
    };
    
    this.supportedMessageTypes = [
      'text', 'image', 'audio', 'video', 'document', 
      'location', 'contacts', 'interactive', 'button', 
      'list_reply', 'sticker', 'reaction'
    ];
    
    this.processingQueue = new Map();
    this.rateLimiter = new Map();
  }

  /**
   * Procesar webhook de WhatsApp Business Account
   * @param {Object} webhookPayload - Payload completo del webhook
   * @param {Object} metadata - Metadatos adicionales (headers, etc.)
   * @returns {Object} Resultado del procesamiento
   */
  async processWhatsAppWebhook(webhookPayload, metadata = {}) {
    const startTime = Date.now();
    const webhookId = this.generateWebhookId(webhookPayload);
    
    try {
      logger.info(`🔄 Procesando webhook de WhatsApp ${webhookId}...`);
      
      // Validar estructura básica del webhook
      this.validateWebhookStructure(webhookPayload);
      
      // Verificar rate limiting
      if (!this.checkRateLimit(webhookPayload)) {
        throw new Error('Rate limit exceeded');
      }
      
      // Marcar como en procesamiento
      this.processingQueue.set(webhookId, { 
        startTime, 
        status: 'processing',
        payload: webhookPayload 
      });
      
      const results = [];
      
      // Procesar cada entrada del webhook
      if (webhookPayload.entry && Array.isArray(webhookPayload.entry)) {
        for (const entry of webhookPayload.entry) {
          const entryResult = await this.processWebhookEntry(entry, metadata);
          results.push(entryResult);
        }
      }
      
      // Actualizar métricas
      this.updateMetrics(startTime, true);
      
      // Limpiar de la cola de procesamiento
      this.processingQueue.delete(webhookId);
      
      const processingTime = Date.now() - startTime;
      logger.info(`✅ Webhook ${webhookId} procesado exitosamente en ${processingTime}ms`);
      
      return {
        success: true,
        webhookId,
        processingTime,
        results,
        metrics: this.getProcessingMetrics()
      };
      
    } catch (error) {
      logger.error(`❌ Error procesando webhook ${webhookId}:`, error.message);
      
      // Actualizar métricas de error
      this.updateMetrics(startTime, false);
      
      // Limpiar de la cola de procesamiento
      this.processingQueue.delete(webhookId);
      
      return {
        success: false,
        webhookId,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Procesar una entrada individual del webhook
   * @param {Object} entry - Entrada del webhook
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Object} Resultado del procesamiento de la entrada
   */
  async processWebhookEntry(entry, metadata) {
    try {
      const { id: businessAccountId, changes } = entry;
      
      if (!changes || !Array.isArray(changes)) {
        return { businessAccountId, processed: false, reason: 'No changes found' };
      }
      
      const changeResults = [];
      
      for (const change of changes) {
        if (change.field === 'messages') {
          const changeResult = await this.processMessagesChange(change.value, businessAccountId, metadata);
          changeResults.push(changeResult);
        }
      }
      
      return {
        businessAccountId,
        processed: true,
        changes: changeResults.length,
        results: changeResults
      };
      
    } catch (error) {
      logger.error('❌ Error procesando entrada del webhook:', error.message);
      throw error;
    }
  }

  /**
   * Procesar cambios de mensajes
   * @param {Object} value - Valor del cambio de mensajes
   * @param {string} businessAccountId - ID de la cuenta de negocio
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Object} Resultado del procesamiento
   */
  async processMessagesChange(value, businessAccountId, metadata) {
    try {
      const {
        messaging_product,
        metadata: whatsappMetadata,
        contacts,
        messages
      } = value;
      
      const results = {
        messaging_product,
        phone_number_id: whatsappMetadata?.phone_number_id,
        display_phone_number: whatsappMetadata?.display_phone_number,
        contacts_processed: 0,
        messages_processed: 0,
        contacts: [],
        messages: []
      };
      
      // Procesar contactos
      if (contacts && Array.isArray(contacts)) {
        for (const contact of contacts) {
          const contactResult = await this.processContact(contact, businessAccountId, whatsappMetadata);
          results.contacts.push(contactResult);
          results.contacts_processed++;
        }
      }
      
      // Procesar mensajes
      if (messages && Array.isArray(messages)) {
        for (const message of messages) {
          const messageResult = await this.processMessage(message, businessAccountId, whatsappMetadata);
          results.messages.push(messageResult);
          results.messages_processed++;
        }
      }
      
      return results;
      
    } catch (error) {
      logger.error('❌ Error procesando cambios de mensajes:', error.message);
      throw error;
    }
  }

  /**
   * Procesar información de contacto
   * @param {Object} contact - Información del contacto
   * @param {string} businessAccountId - ID de la cuenta de negocio
   * @param {Object} whatsappMetadata - Metadatos de WhatsApp
   * @returns {Object} Resultado del procesamiento del contacto
   */
  async processContact(contact, businessAccountId, whatsappMetadata) {
    try {
      const { profile, wa_id } = contact;
      
      const contactData = {
        wa_id,
        phone_number: wa_id,
        name: profile?.name || 'Usuario sin nombre',
        profile_name: profile?.name,
        business_account_id: businessAccountId,
        phone_number_id: whatsappMetadata?.phone_number_id,
        display_phone_number: whatsappMetadata?.display_phone_number,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      logger.debug(`📞 Procesando contacto: ${contactData.name} (${wa_id})`);
      
      // Aquí se integrará con la base de datos
      // await this.saveContact(contactData);
      
      this.metrics.contactsProcessed++;
      
      return {
        success: true,
        contact_id: wa_id,
        name: contactData.name,
        action: 'processed'
      };
      
    } catch (error) {
      logger.error('❌ Error procesando contacto:', error.message);
      return {
        success: false,
        contact_id: contact.wa_id,
        error: error.message
      };
    }
  }

  /**
   * Procesar mensaje individual
   * @param {Object} message - Mensaje a procesar
   * @param {string} businessAccountId - ID de la cuenta de negocio
   * @param {Object} whatsappMetadata - Metadatos de WhatsApp
   * @returns {Object} Resultado del procesamiento del mensaje
   */
  async processMessage(message, businessAccountId, whatsappMetadata) {
    try {
      const {
        id: messageId,
        from,
        timestamp,
        type,
        text,
        image,
        audio,
        video,
        document,
        location,
        contacts,
        interactive,
        button,
        list_reply,
        sticker,
        reaction
      } = message;
      
      // Validar tipo de mensaje soportado
      if (!this.supportedMessageTypes.includes(type)) {
        logger.warn(`⚠️ Tipo de mensaje no soportado: ${type}`);
      }
      
      const messageData = {
        message_id: messageId,
        from_phone: from,
        timestamp: new Date(parseInt(timestamp) * 1000),
        type,
        business_account_id: businessAccountId,
        phone_number_id: whatsappMetadata?.phone_number_id,
        display_phone_number: whatsappMetadata?.display_phone_number,
        content: this.extractMessageContent(message),
        raw_message: message,
        created_at: new Date().toISOString()
      };
      
      logger.debug(`💬 Procesando mensaje ${type} de ${from}: ${messageData.content}`);
      
      // Aquí se integrará con la base de datos
      // await this.saveMessage(messageData);
      
      this.metrics.messagesProcessed++;
      
      return {
        success: true,
        message_id: messageId,
        type,
        from,
        content: messageData.content,
        action: 'processed'
      };
      
    } catch (error) {
      logger.error('❌ Error procesando mensaje:', error.message);
      return {
        success: false,
        message_id: message.id,
        error: error.message
      };
    }
  }

  /**
   * Extraer contenido del mensaje según su tipo
   * @param {Object} message - Mensaje completo
   * @returns {string} Contenido extraído
   */
  extractMessageContent(message) {
    const { type } = message;
    
    switch (type) {
      case 'text':
        return message.text?.body || '';
      
      case 'image':
        return `[Imagen] ${message.image?.caption || 'Sin descripción'}`;
      
      case 'audio':
        return '[Audio]';
      
      case 'video':
        return `[Video] ${message.video?.caption || 'Sin descripción'}`;
      
      case 'document':
        return `[Documento] ${message.document?.filename || 'Sin nombre'}`;
      
      case 'location':
        return `[Ubicación] ${message.location?.name || 'Ubicación compartida'}`;
      
      case 'contacts':
        return '[Contacto compartido]';
      
      case 'interactive':
        return this.extractInteractiveContent(message.interactive);
      
      case 'button':
        return `[Botón] ${message.button?.text || 'Botón presionado'}`;
      
      case 'list_reply':
        return `[Lista] ${message.list_reply?.title || 'Opción seleccionada'}`;
      
      case 'sticker':
        return '[Sticker]';
      
      case 'reaction':
        return `[Reacción] ${message.reaction?.emoji || '👍'}`;
      
      default:
        return `[${type}] Mensaje no procesado`;
    }
  }

  /**
   * Extraer contenido de mensaje interactivo
   * @param {Object} interactive - Contenido interactivo
   * @returns {string} Contenido extraído
   */
  extractInteractiveContent(interactive) {
    if (!interactive) return '[Interactivo]';
    
    const { type } = interactive;
    
    switch (type) {
      case 'button_reply':
        return `[Botón] ${interactive.button_reply?.title || 'Botón presionado'}`;
      
      case 'list_reply':
        return `[Lista] ${interactive.list_reply?.title || 'Opción seleccionada'}`;
      
      default:
        return `[Interactivo ${type}]`;
    }
  }

  /**
   * Validar estructura básica del webhook
   * @param {Object} payload - Payload del webhook
   */
  validateWebhookStructure(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload del webhook inválido');
    }
    
    if (payload.object !== 'whatsapp_business_account') {
      throw new Error(`Tipo de objeto no soportado: ${payload.object}`);
    }
    
    if (!payload.entry || !Array.isArray(payload.entry)) {
      throw new Error('Estructura de entrada inválida');
    }
    
    logger.debug('✅ Estructura del webhook validada correctamente');
  }

  /**
   * Verificar rate limiting
   * @param {Object} payload - Payload del webhook
   * @returns {boolean} True si está dentro del límite
   */
  checkRateLimit(payload) {
    // Implementar lógica de rate limiting básica
    const key = this.generateRateLimitKey(payload);
    const now = Date.now();
    const windowMs = 60000; // 1 minuto
    const maxRequests = 100; // 100 requests por minuto
    
    if (!this.rateLimiter.has(key)) {
      this.rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    const limit = this.rateLimiter.get(key);
    
    if (now > limit.resetTime) {
      this.rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (limit.count >= maxRequests) {
      return false;
    }
    
    limit.count++;
    return true;
  }

  /**
   * Generar ID único para el webhook
   * @param {Object} payload - Payload del webhook
   * @returns {string} ID único
   */
  generateWebhookId(payload) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 8);
    
    return `whatsapp_${timestamp}_${hash}`;
  }

  /**
   * Generar clave para rate limiting
   * @param {Object} payload - Payload del webhook
   * @returns {string} Clave para rate limiting
   */
  generateRateLimitKey(payload) {
    // Usar el primer business account ID como clave
    const businessAccountId = payload.entry?.[0]?.id || 'unknown';
    return `whatsapp_${businessAccountId}`;
  }

  /**
   * Actualizar métricas del servicio
   * @param {number} startTime - Tiempo de inicio
   * @param {boolean} success - Si fue exitoso
   */
  updateMetrics(startTime, success) {
    this.metrics.totalWebhooksProcessed++;
    this.metrics.lastProcessedAt = new Date().toISOString();
    
    if (!success) {
      this.metrics.errorsCount++;
    }
    
    const processingTime = Date.now() - startTime;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime + processingTime) / 2;
  }

  /**
   * Obtener métricas de procesamiento
   * @returns {Object} Métricas actuales
   */
  getProcessingMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalWebhooksProcessed > 0 
        ? ((this.metrics.totalWebhooksProcessed - this.metrics.errorsCount) / this.metrics.totalWebhooksProcessed * 100).toFixed(2) + '%'
        : '0%',
      queueSize: this.processingQueue.size
    };
  }

  /**
   * Verificar estado del servicio
   * @returns {Object} Estado del servicio
   */
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'WhatsAppWebhookService',
      metrics: this.getProcessingMetrics(),
      supportedMessageTypes: this.supportedMessageTypes,
      queueSize: this.processingQueue.size,
      rateLimiterSize: this.rateLimiter.size
    };
  }

  /**
   * Limpiar recursos del servicio
   */
  cleanup() {
    this.processingQueue.clear();
    this.rateLimiter.clear();
    logger.info('🧹 WhatsAppWebhookService limpiado');
  }
}

// Instancia singleton
export const whatsAppWebhookService = new WhatsAppWebhookService();

export default WhatsAppWebhookService;
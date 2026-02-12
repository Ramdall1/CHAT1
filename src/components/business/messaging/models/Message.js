/**
 * Modelo de Mensaje
 * 
 * Define la estructura y validaciones para los mensajes
 * del sistema de WhatsApp Business.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { createLogger } from '../../../../services/core/core/logger.js';

const logger = createLogger('MESSAGE_MODEL');

/**
 * Clase modelo para Mensajes
 */
export class Message {
  constructor(data = {}) {
    this.id = data.id || null;
    this.type = data.type || 'text'; // text, image, document, audio, video, template
    this.direction = data.direction || 'outbound'; // inbound, outbound
    this.status = data.status || 'pending'; // pending, sent, delivered, read, failed
    this.from = data.from || '';
    this.to = data.to || '';
    this.content = data.content || {};
    this.templateId = data.templateId || null;
    this.templateData = data.templateData || {};
    this.mediaUrl = data.mediaUrl || null;
    this.mediaType = data.mediaType || null;
    this.metadata = data.metadata || {};
    this.errorCode = data.errorCode || null;
    this.errorMessage = data.errorMessage || null;
    this.whatsappMessageId = data.whatsappMessageId || null;
    this.conversationId = data.conversationId || null;
    this.campaignId = data.campaignId || null;
    this.automationRuleId = data.automationRuleId || null;
    this.scheduledAt = data.scheduledAt || null;
    this.sentAt = data.sentAt || null;
    this.deliveredAt = data.deliveredAt || null;
    this.readAt = data.readAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    // Validar datos al crear instancia
    this.validate();
  }
  
  /**
   * Validar datos del mensaje
   * @throws {Error} Si los datos son inválidos
   */
  validate() {
    const errors = [];
    
    // Validar tipo de mensaje
    const validTypes = ['text', 'image', 'document', 'audio', 'video', 'template', 'interactive'];
    if (!validTypes.includes(this.type)) {
      errors.push(`Tipo de mensaje inválido: ${this.type}`);
    }
    
    // Validar dirección
    const validDirections = ['inbound', 'outbound'];
    if (!validDirections.includes(this.direction)) {
      errors.push(`Dirección inválida: ${this.direction}`);
    }
    
    // Validar status
    const validStatuses = ['pending', 'sent', 'delivered', 'read', 'failed', 'scheduled'];
    if (!validStatuses.includes(this.status)) {
      errors.push(`Status inválido: ${this.status}`);
    }
    
    // Validar números de teléfono
    if (this.direction === 'outbound' && !this.to) {
      errors.push('Número de destino requerido para mensajes salientes');
    }
    
    if (this.direction === 'inbound' && !this.from) {
      errors.push('Número de origen requerido para mensajes entrantes');
    }
    
    // Validar contenido según tipo
    if (this.type === 'text' && (!this.content.text || this.content.text.trim() === '')) {
      errors.push('Contenido de texto requerido para mensajes de texto');
    }
    
    if (this.type === 'template' && !this.templateId) {
      errors.push('ID de template requerido para mensajes de template');
    }
    
    // Validar media para tipos multimedia
    const mediaTypes = ['image', 'document', 'audio', 'video'];
    if (mediaTypes.includes(this.type) && !this.mediaUrl) {
      errors.push(`URL de media requerida para mensajes de tipo ${this.type}`);
    }
    
    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }
  }
  
  /**
   * Marcar mensaje como enviado
   * @param {string} whatsappMessageId - ID del mensaje en WhatsApp
   */
  markAsSent(whatsappMessageId = null) {
    this.status = 'sent';
    this.sentAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    
    if (whatsappMessageId) {
      this.whatsappMessageId = whatsappMessageId;
    }
  }
  
  /**
   * Marcar mensaje como entregado
   */
  markAsDelivered() {
    this.status = 'delivered';
    this.deliveredAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Marcar mensaje como leído
   */
  markAsRead() {
    this.status = 'read';
    this.readAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Marcar mensaje como fallido
   * @param {string} errorCode - Código de error
   * @param {string} errorMessage - Mensaje de error
   */
  markAsFailed(errorCode, errorMessage) {
    this.status = 'failed';
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Programar mensaje para envío futuro
   * @param {Date|string} scheduledDate - Fecha programada
   */
  schedule(scheduledDate) {
    this.status = 'scheduled';
    this.scheduledAt = typeof scheduledDate === 'string' ? scheduledDate : scheduledDate.toISOString();
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Verificar si el mensaje está pendiente
   * @returns {boolean} True si está pendiente
   */
  isPending() {
    return this.status === 'pending';
  }
  
  /**
   * Verificar si el mensaje fue enviado
   * @returns {boolean} True si fue enviado
   */
  isSent() {
    return ['sent', 'delivered', 'read'].includes(this.status);
  }
  
  /**
   * Verificar si el mensaje falló
   * @returns {boolean} True si falló
   */
  isFailed() {
    return this.status === 'failed';
  }
  
  /**
   * Verificar si el mensaje está programado
   * @returns {boolean} True si está programado
   */
  isScheduled() {
    return this.status === 'scheduled';
  }
  
  /**
   * Verificar si es mensaje entrante
   * @returns {boolean} True si es entrante
   */
  isInbound() {
    return this.direction === 'inbound';
  }
  
  /**
   * Verificar si es mensaje saliente
   * @returns {boolean} True si es saliente
   */
  isOutbound() {
    return this.direction === 'outbound';
  }
  
  /**
   * Obtener número de teléfono del contacto
   * @returns {string} Número de teléfono
   */
  getContactPhone() {
    return this.direction === 'inbound' ? this.from : this.to;
  }
  
  /**
   * Actualizar metadata del mensaje
   * @param {object} newMetadata - Nueva metadata
   */
  updateMetadata(newMetadata) {
    this.metadata = { ...this.metadata, ...newMetadata };
    this.updatedAt = new Date().toISOString();
  }
  
  /**
   * Obtener duración hasta entrega (en segundos)
   * @returns {number|null} Duración en segundos
   */
  getDeliveryDuration() {
    if (!this.sentAt || !this.deliveredAt) {
      return null;
    }
    
    const sentTime = new Date(this.sentAt);
    const deliveredTime = new Date(this.deliveredAt);
    return Math.floor((deliveredTime - sentTime) / 1000);
  }
  
  /**
   * Obtener duración hasta lectura (en segundos)
   * @returns {number|null} Duración en segundos
   */
  getReadDuration() {
    if (!this.sentAt || !this.readAt) {
      return null;
    }
    
    const sentTime = new Date(this.sentAt);
    const readTime = new Date(this.readAt);
    return Math.floor((readTime - sentTime) / 1000);
  }
  
  /**
   * Verificar si el mensaje debe ser enviado ahora
   * @returns {boolean} True si debe enviarse
   */
  shouldBeSentNow() {
    if (this.status !== 'scheduled') {
      return false;
    }
    
    if (!this.scheduledAt) {
      return true;
    }
    
    return new Date(this.scheduledAt) <= new Date();
  }
  
  /**
   * Convertir a objeto plano para almacenamiento
   * @returns {object} Objeto plano
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      direction: this.direction,
      status: this.status,
      from: this.from,
      to: this.to,
      content: this.content,
      templateId: this.templateId,
      templateData: this.templateData,
      mediaUrl: this.mediaUrl,
      mediaType: this.mediaType,
      metadata: this.metadata,
      errorCode: this.errorCode,
      errorMessage: this.errorMessage,
      whatsappMessageId: this.whatsappMessageId,
      conversationId: this.conversationId,
      campaignId: this.campaignId,
      automationRuleId: this.automationRuleId,
      scheduledAt: this.scheduledAt,
      sentAt: this.sentAt,
      deliveredAt: this.deliveredAt,
      readAt: this.readAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
  
  /**
   * Crear instancia desde objeto plano
   * @param {object} data - Datos del mensaje
   * @returns {Message} Nueva instancia
   */
  static fromJSON(data) {
    return new Message(data);
  }
  
  /**
   * Crear mensaje de texto
   * @param {string} to - Número de destino
   * @param {string} text - Texto del mensaje
   * @param {object} options - Opciones adicionales
   * @returns {Message} Nueva instancia
   */
  static createTextMessage(to, text, options = {}) {
    return new Message({
      type: 'text',
      direction: 'outbound',
      to,
      content: { text },
      ...options
    });
  }
  
  /**
   * Crear mensaje de template
   * @param {string} to - Número de destino
   * @param {string} templateId - ID del template
   * @param {object} templateData - Datos del template
   * @param {object} options - Opciones adicionales
   * @returns {Message} Nueva instancia
   */
  static createTemplateMessage(to, templateId, templateData = {}, options = {}) {
    return new Message({
      type: 'template',
      direction: 'outbound',
      to,
      templateId,
      templateData,
      ...options
    });
  }
  
  /**
   * Crear mensaje multimedia
   * @param {string} to - Número de destino
   * @param {string} type - Tipo de media
   * @param {string} mediaUrl - URL del archivo
   * @param {object} options - Opciones adicionales
   * @returns {Message} Nueva instancia
   */
  static createMediaMessage(to, type, mediaUrl, options = {}) {
    return new Message({
      type,
      direction: 'outbound',
      to,
      mediaUrl,
      mediaType: type,
      content: options.content || {},
      ...options
    });
  }
  
  /**
   * Crear mensaje entrante (inbound)
   * @param {object} messageData - Datos del mensaje recibido
   * @returns {Message} Nueva instancia
   */
  static createIncomingMessage(messageData) {
    // Asegurar que metadata se guarde correctamente
    const metadata = messageData.metadata || {};
    
    // Si hay datos interactivos, agregarlos a metadata
    if (messageData.interactive) {
      metadata.interactive = messageData.interactive;
      
      // LOG para mensajes interactivos
      logger.info('🔍 [Message.createIncomingMessage] Creando mensaje interactivo:', {
        type: messageData.type,
        from: messageData.from,
        has_interactive: !!messageData.interactive,
        interactive_type: messageData.interactive?.type,
        metadata_has_interactive: !!metadata.interactive,
        metadata_preview: JSON.stringify(metadata, null, 2)
      });
    }
    
    const message = new Message({
      direction: 'inbound',
      status: 'delivered',
      from: messageData.from,
      type: messageData.type || 'text',
      content: { text: messageData.text || '' },
      mediaUrl: messageData.mediaUrl,
      mediaType: messageData.mediaType,
      metadata: metadata,
      createdAt: messageData.timestamp || new Date().toISOString()
    });
    
    // VALIDAR mensaje creado antes de retornar
    if (messageData.type === 'interactive') {
      logger.info('✅ [Message Created] Instancia de mensaje interactivo:', {
        type: message.type,
        has_metadata: !!message.metadata,
        metadata_keys: message.metadata ? Object.keys(message.metadata) : [],
        metadata_has_interactive: !!message.metadata?.interactive
      });
    }
    
    return message;
  }
}

/**
 * Esquema de validación para mensajes
 */
export const MessageSchema = {
  type: {
    type: 'string',
    required: true,
    enum: ['text', 'image', 'document', 'audio', 'video', 'template', 'interactive']
  },
  direction: {
    type: 'string',
    required: true,
    enum: ['inbound', 'outbound']
  },
  status: {
    type: 'string',
    required: false,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'scheduled'],
    default: 'pending'
  },
  to: {
    type: 'string',
    required: function(data) { return data.direction === 'outbound'; }
  },
  from: {
    type: 'string',
    required: function(data) { return data.direction === 'inbound'; }
  },
  content: {
    type: 'object',
    required: true
  }
};

export default Message;
/**
 * @fileoverview Messaging Service Factory
 * 
 * Factory centralizado para la creación y gestión de servicios de mensajería,
 * eliminando la duplicación de código y proporcionando una interfaz unificada
 * para WhatsApp, SMS, Email, Push Notifications y otros canales.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 5.0.0
 */

import { MessagingServiceFactory } from '../core/Factory.js';
import BaseService from '../core/BaseService.js';
import { globalValidator, DataType, CommonSchemas } from '../core/DataValidator.js';
import { BaseError, ErrorType, ErrorSeverity } from '../core/ErrorHandler.js';
import logger from '../core/logger.js';

/**
 * Tipos de servicios de mensajería
 * 
 * @enum {string}
 */
export const MessagingServiceType = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  EMAIL: 'email',
  PUSH: 'push',
  TELEGRAM: 'telegram',
  SLACK: 'slack',
  DISCORD: 'discord',
  TEAMS: 'teams'
};

/**
 * Tipos de mensajes
 * 
 * @enum {string}
 */
export const MessageType = {
  TEXT: 'text',
  MEDIA: 'media',
  TEMPLATE: 'template',
  INTERACTIVE: 'interactive',
  DOCUMENT: 'document',
  LOCATION: 'location',
  CONTACT: 'contact'
};

/**
 * Estados de mensaje
 * 
 * @enum {string}
 */
export const MessageStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  EXPIRED: 'expired'
};

/**
 * Esquemas de validación para mensajería
 */
export const MessagingSchemas = {
  message: {
    type: DataType.OBJECT,
    required: true,
    properties: {
      to: { ...CommonSchemas.nonEmptyString, message: 'Destinatario requerido' },
      type: { type: DataType.STRING, enum: Object.values(MessageType), required: true },
      content: { type: DataType.OBJECT, required: true },
      metadata: { type: DataType.OBJECT, required: false, default: {} }
    }
  },
  
  textMessage: {
    type: DataType.OBJECT,
    required: true,
    properties: {
      text: { ...CommonSchemas.nonEmptyString, max: 4096 }
    }
  },
  
  mediaMessage: {
    type: DataType.OBJECT,
    required: true,
    properties: {
      url: CommonSchemas.url,
      caption: { type: DataType.STRING, max: 1024, required: false },
      filename: { type: DataType.STRING, required: false }
    }
  },
  
  templateMessage: {
    type: DataType.OBJECT,
    required: true,
    properties: {
      templateId: CommonSchemas.nonEmptyString,
      parameters: { type: DataType.ARRAY, required: false, default: [] }
    }
  }
};

/**
 * Interfaz base para servicios de mensajería
 * 
 * @abstract
 * @class BaseMessagingService
 * @extends BaseService
 */
export class BaseMessagingService extends BaseService {
  /**
   * Constructor del servicio base de mensajería
   * 
   * @param {Object} config - Configuración del servicio
   */
  constructor(config = {}) {
    super({
      name: `MessagingService_${config.type || 'Unknown'}`,
      enableValidation: true,
      enableCaching: true,
      enableMetrics: true,
      ...config
    });

    this.serviceType = config.type;
    this.provider = config.provider;
    this.credentials = config.credentials || {};
    this.rateLimits = config.rateLimits || {};
    this.messageQueue = [];
    this.deliveryCallbacks = new Map();
  }

  /**
   * Envía un mensaje
   * 
   * @abstract
   * @param {Object} message - Mensaje a enviar
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendMessage(message) {
    throw new Error('El método sendMessage() debe ser implementado por la clase hija');
  }

  /**
   * Obtiene el estado de un mensaje
   * 
   * @abstract
   * @param {string} messageId - ID del mensaje
   * @returns {Promise<Object>} Estado del mensaje
   */
  async getMessageStatus(messageId) {
    throw new Error('El método getMessageStatus() debe ser implementado por la clase hija');
  }

  /**
   * Valida un mensaje antes del envío
   * 
   * @protected
   * @param {Object} message - Mensaje a validar
   * @returns {Object} Mensaje validado
   */
  validateMessage(message) {
    // Validación base del mensaje
    const baseValidation = globalValidator.validate(message, MessagingSchemas.message);
    if (!baseValidation.valid) {
      throw new BaseError('Mensaje inválido', {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        code: 'INVALID_MESSAGE',
        context: { errors: baseValidation.errors }
      });
    }

    const validatedMessage = baseValidation.data;

    // Validación específica por tipo de mensaje
    switch (validatedMessage.type) {
      case MessageType.TEXT:
        const textValidation = globalValidator.validate(validatedMessage.content, MessagingSchemas.textMessage);
        if (!textValidation.valid) {
          throw new BaseError('Contenido de texto inválido', {
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.LOW,
            code: 'INVALID_TEXT_CONTENT',
            context: { errors: textValidation.errors }
          });
        }
        validatedMessage.content = textValidation.data;
        break;

      case MessageType.MEDIA:
        const mediaValidation = globalValidator.validate(validatedMessage.content, MessagingSchemas.mediaMessage);
        if (!mediaValidation.valid) {
          throw new BaseError('Contenido de media inválido', {
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.LOW,
            code: 'INVALID_MEDIA_CONTENT',
            context: { errors: mediaValidation.errors }
          });
        }
        validatedMessage.content = mediaValidation.data;
        break;

      case MessageType.TEMPLATE:
        const templateValidation = globalValidator.validate(validatedMessage.content, MessagingSchemas.templateMessage);
        if (!templateValidation.valid) {
          throw new BaseError('Contenido de template inválido', {
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.LOW,
            code: 'INVALID_TEMPLATE_CONTENT',
            context: { errors: templateValidation.errors }
          });
        }
        validatedMessage.content = templateValidation.data;
        break;
    }

    return validatedMessage;
  }

  /**
   * Procesa un mensaje antes del envío
   * 
   * @protected
   * @param {Object} message - Mensaje a procesar
   * @returns {Promise<Object>} Mensaje procesado
   */
  async processMessage(message) {
    return await this.executeOperation('processMessage', async () => {
      // Validar mensaje
      const validatedMessage = this.validateMessage(message);
      
      // Agregar metadatos del servicio
      validatedMessage.metadata = {
        ...validatedMessage.metadata,
        serviceType: this.serviceType,
        provider: this.provider,
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId()
      };

      // Verificar rate limits
      await this.checkRateLimits(validatedMessage.to);

      return validatedMessage;
    }, {
      inputSchema: MessagingSchemas.message,
      input: message
    });
  }

  /**
   * Genera un ID único para el mensaje
   * 
   * @protected
   * @returns {string} ID del mensaje
   */
  generateMessageId() {
    return `msg_${this.serviceType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Verifica los límites de velocidad
   * 
   * @protected
   * @param {string} recipient - Destinatario
   * @returns {Promise<void>}
   */
  async checkRateLimits(recipient) {
    if (!this.rateLimits.enabled) return;

    const key = `rate_limit_${recipient}`;
    const cached = this.cache.get(key);
    
    if (cached && !this.isCacheExpired(cached)) {
      if (cached.data.count >= this.rateLimits.maxPerMinute) {
        throw new BaseError('Rate limit excedido', {
          type: ErrorType.BUSINESS_LOGIC,
          severity: ErrorSeverity.MEDIUM,
          code: 'RATE_LIMIT_EXCEEDED',
          context: { 
            recipient, 
            limit: this.rateLimits.maxPerMinute,
            current: cached.data.count 
          }
        });
      }
      
      cached.data.count++;
    } else {
      this.cache.set(key, {
        data: { count: 1 },
        timestamp: Date.now(),
        ttl: 60000 // 1 minuto
      });
    }
  }

  /**
   * Registra callback de entrega
   * 
   * @protected
   * @param {string} messageId - ID del mensaje
   * @param {Function} callback - Callback a ejecutar
   */
  registerDeliveryCallback(messageId, callback) {
    this.deliveryCallbacks.set(messageId, callback);
  }

  /**
   * Ejecuta callback de entrega
   * 
   * @protected
   * @param {string} messageId - ID del mensaje
   * @param {Object} status - Estado de entrega
   */
  async executeDeliveryCallback(messageId, status) {
    const callback = this.deliveryCallbacks.get(messageId);
    if (callback && typeof callback === 'function') {
      try {
        await callback(status);
        this.deliveryCallbacks.delete(messageId);
      } catch (error) {
        logger.error(`❌ Error ejecutando callback de entrega para ${messageId}:`, error);
      }
    }
  }
}

/**
 * Servicio de WhatsApp
 * 
 * @class WhatsAppService
 * @extends BaseMessagingService
 */
export class WhatsAppService extends BaseMessagingService {
  constructor(config = {}) {
    super({
      type: MessagingServiceType.WHATSAPP,
      provider: config.provider || 'whatsapp-business-api',
      rateLimits: {
        enabled: true,
        maxPerMinute: 80,
        maxPerDay: 1000,
        ...config.rateLimits
      },
      ...config
    });

    this.apiUrl = config.apiUrl || 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
  }

  async initialize() {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new BaseError('Configuración de WhatsApp incompleta', {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.HIGH,
        code: 'WHATSAPP_CONFIG_MISSING'
      });
    }

    this.state = 'ready';
    logger.info('📱 WhatsApp Service inicializado');
  }

  async stop() {
    this.cleanup();
    logger.info('📱 WhatsApp Service detenido');
  }

  async sendMessage(message) {
    return await this.executeOperation('sendMessage', async () => {
      const processedMessage = await this.processMessage(message);
      
      const payload = this.buildWhatsAppPayload(processedMessage);
      
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new BaseError(`Error enviando mensaje WhatsApp: ${error.error?.message || 'Unknown error'}`, {
          type: ErrorType.EXTERNAL_SERVICE,
          severity: ErrorSeverity.MEDIUM,
          code: 'WHATSAPP_SEND_FAILED',
          context: { statusCode: response.status, error }
        });
      }

      const result = await response.json();
      
      return {
        messageId: result.messages[0].id,
        status: MessageStatus.SENT,
        provider: this.provider,
        timestamp: new Date().toISOString(),
        metadata: processedMessage.metadata
      };
    });
  }

  async getMessageStatus(messageId) {
    return await this.executeOperation('getMessageStatus', async () => {
      // Implementar consulta de estado específica de WhatsApp
      return {
        messageId,
        status: MessageStatus.DELIVERED, // Placeholder
        timestamp: new Date().toISOString()
      };
    });
  }

  buildWhatsAppPayload(message) {
    const payload = {
      messaging_product: 'whatsapp',
      to: message.to,
      type: message.type
    };

    switch (message.type) {
      case MessageType.TEXT:
        payload.text = { body: message.content.text };
        break;
        
      case MessageType.MEDIA:
        payload.image = {
          link: message.content.url,
          caption: message.content.caption
        };
        break;
        
      case MessageType.TEMPLATE:
        payload.template = {
          name: message.content.templateId,
          language: { code: 'es' },
          components: message.content.parameters ? [{
            type: 'body',
            parameters: message.content.parameters.map(p => ({ type: 'text', text: p }))
          }] : []
        };
        break;
    }

    return payload;
  }
}

/**
 * Servicio de SMS
 * 
 * @class SMSService
 * @extends BaseMessagingService
 */
export class SMSService extends BaseMessagingService {
  constructor(config = {}) {
    super({
      type: MessagingServiceType.SMS,
      provider: config.provider || 'disabled',
      rateLimits: {
        enabled: false,
        maxPerMinute: 0,
        maxPerDay: 0,
        ...config.rateLimits
      },
      ...config
    });

    // SMS deshabilitado - Twilio removido
    this.enabled = false;
  }

  async initialize() {
    this.state = 'disabled';
    logger.warn('📨 SMS Service deshabilitado - Twilio removido del proyecto');
  }

  async stop() {
    this.cleanup();
    logger.info('📨 SMS Service detenido');
  }

  async sendMessage(message) {
    return await this.executeOperation('sendMessage', async () => {
      throw new BaseError('SMS deshabilitado - Twilio removido del proyecto', {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.LOW,
        code: 'SMS_DISABLED'
      });
    });
  }

  async getMessageStatus(messageId) {
    return await this.executeOperation('getMessageStatus', async () => {
      return {
        messageId,
        status: MessageStatus.FAILED,
        timestamp: new Date().toISOString(),
        error: 'SMS deshabilitado - Twilio removido del proyecto'
      };
    });
  }
}

/**
 * Factory específico para servicios de mensajería
 * 
 * @class ConcreteMessagingServiceFactory
 * @extends MessagingServiceFactory
 */
export class ConcreteMessagingServiceFactory extends MessagingServiceFactory {
  constructor() {
    super();
    this.setupDefaultServices();
  }

  setupDefaultServices() {
    this.registerService(MessagingServiceType.WHATSAPP, WhatsAppService);
    this.registerService(MessagingServiceType.SMS, SMSService);
  }

  createService(type, config = {}) {
    const ServiceClass = this.services.get(type);
    
    if (!ServiceClass) {
      throw new BaseError(`Tipo de servicio de mensajería no soportado: ${type}`, {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        code: 'UNSUPPORTED_MESSAGING_SERVICE',
        context: { type, availableTypes: Array.from(this.services.keys()) }
      });
    }

    const service = new ServiceClass(config);
    
    logger.info(`🏭 Servicio de mensajería creado: ${type}`);
    
    return service;
  }
}

// Instancia global del factory
export const messagingServiceFactory = new ConcreteMessagingServiceFactory();

/**
 * Gestor unificado de mensajería
 * 
 * @class MessagingManager
 */
export class MessagingManager {
  constructor() {
    this.services = new Map();
    this.defaultService = null;
    this.messageHistory = [];
    this.deliveryStats = {
      total: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      byService: new Map()
    };
  }

  /**
   * Registra un servicio de mensajería
   * 
   * @param {MessagingServiceType} type - Tipo de servicio
   * @param {Object} config - Configuración del servicio
   * @returns {Promise<BaseMessagingService>} Servicio creado
   */
  async registerService(type, config = {}) {
    const service = messagingServiceFactory.createService(type, config);
    await service.initialize();
    
    this.services.set(type, service);
    
    if (!this.defaultService) {
      this.defaultService = type;
    }

    logger.info(`📋 Servicio de mensajería registrado: ${type}`);
    return service;
  }

  /**
   * Envía un mensaje usando el servicio especificado o el por defecto
   * 
   * @param {Object} message - Mensaje a enviar
   * @param {MessagingServiceType} serviceType - Tipo de servicio (opcional)
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendMessage(message, serviceType = null) {
    const type = serviceType || this.defaultService;
    const service = this.services.get(type);
    
    if (!service) {
      throw new BaseError(`Servicio de mensajería no disponible: ${type}`, {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        code: 'MESSAGING_SERVICE_UNAVAILABLE',
        context: { type, availableServices: Array.from(this.services.keys()) }
      });
    }

    try {
      const result = await service.sendMessage(message);
      
      // Registrar en historial
      this.messageHistory.push({
        ...result,
        originalMessage: message,
        serviceType: type
      });

      // Actualizar estadísticas
      this.updateDeliveryStats(type, 'sent');
      
      return result;
    } catch (error) {
      this.updateDeliveryStats(type, 'failed');
      throw error;
    }
  }

  /**
   * Obtiene el estado de un mensaje
   * 
   * @param {string} messageId - ID del mensaje
   * @param {MessagingServiceType} serviceType - Tipo de servicio
   * @returns {Promise<Object>} Estado del mensaje
   */
  async getMessageStatus(messageId, serviceType) {
    const service = this.services.get(serviceType);
    
    if (!service) {
      throw new BaseError(`Servicio de mensajería no disponible: ${serviceType}`, {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        code: 'MESSAGING_SERVICE_UNAVAILABLE'
      });
    }

    return await service.getMessageStatus(messageId);
  }

  /**
   * Actualiza estadísticas de entrega
   * 
   * @private
   * @param {MessagingServiceType} serviceType - Tipo de servicio
   * @param {string} status - Estado del mensaje
   */
  updateDeliveryStats(serviceType, status) {
    this.deliveryStats.total++;
    this.deliveryStats[status]++;
    
    if (!this.deliveryStats.byService.has(serviceType)) {
      this.deliveryStats.byService.set(serviceType, {
        total: 0, sent: 0, delivered: 0, failed: 0
      });
    }
    
    const serviceStats = this.deliveryStats.byService.get(serviceType);
    serviceStats.total++;
    serviceStats[status]++;
  }

  /**
   * Obtiene estadísticas de entrega
   * 
   * @returns {Object} Estadísticas de entrega
   */
  getDeliveryStats() {
    return {
      ...this.deliveryStats,
      byService: Object.fromEntries(this.deliveryStats.byService)
    };
  }

  /**
   * Obtiene información de todos los servicios
   * 
   * @returns {Promise<Object>} Información de servicios
   */
  async getServicesInfo() {
    const info = {};
    
    for (const [type, service] of this.services) {
      info[type] = await service.getInfo();
    }
    
    return info;
  }
}

// Instancia global del gestor
export const messagingManager = new MessagingManager();

export default {
  MessagingServiceFactory: ConcreteMessagingServiceFactory,
  MessagingManager,
  messagingServiceFactory,
  messagingManager,
  MessagingServiceType,
  MessageType,
  MessageStatus
};
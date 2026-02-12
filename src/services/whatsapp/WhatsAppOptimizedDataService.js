/**
 * @fileoverview Servicio de datos optimizado para WhatsApp Business API
 * Versión simplificada compatible con el adaptador mock
 * 
 * @author ChatBot Enterprise Team
 * @version 2.0.0
 * @since 2025-01-21
 */

import { Contact, Message, Conversation, sequelize } from '../../adapters/SequelizeAdapter.js';
import { createLogger } from '../core/core/logger.js';

const logger = createLogger('WHATSAPP_OPTIMIZED_DATA_SERVICE');

class WhatsAppOptimizedDataService {
  constructor() {
    this.sequelize = sequelize;
    this.Contact = Contact;
    this.Conversation = Conversation;
    this.Message = Message;
    this.logger = logger;
    
    // Cola de procesamiento asíncrono
    this.processingQueue = [];
    this.isProcessing = false;
    
    // Métricas de rendimiento
    this.metrics = {
      totalRequests: 0,
      avgResponseTime: 0,
      successfulProcessing: 0,
      failedProcessing: 0
    };

    // Datos en memoria para campos adicionales requeridos por la API
    this.clientData = new Map();
    this.whatsappNumbers = new Map();
    this.extendedContactData = new Map();
  }

  /**
   * Inicializa la conexión y crea las tablas
   */
  async initialize() {
    try {
      await this.sequelize.authenticate();
      await this.sequelize.sync({ alter: true });
      this.logger.info('✅ Base de datos optimizada inicializada');
      
      // Iniciar procesamiento de cola
      this.startQueueProcessor();
      
      return true;
    } catch (error) {
      this.logger.error('❌ Error inicializando base de datos:', error);
      throw error;
    }
  }

  /**
   * Procesa webhook de WhatsApp con respuesta inmediata (≤80ms)
   * @param {Object} webhookData - Datos del webhook
   * @returns {Object} Respuesta inmediata
   */
  async processWebhookFast(webhookData) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Validación rápida básica
      if (!webhookData || !webhookData.entry) {
        throw new Error('Datos de webhook inválidos');
      }

      // Respuesta inmediata (≤80ms)
      const response = {
        success: true,
        message: 'Webhook recibido correctamente',
        timestamp: new Date().toISOString(),
        processing_id: `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Agregar a cola para procesamiento asíncrono
      this.addToQueue({
        id: response.processing_id,
        data: webhookData,
        timestamp: Date.now()
      });

      // Calcular tiempo de respuesta
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);

      this.logger.info(`⚡ Respuesta rápida enviada en ${responseTime}ms`);
      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, false);
      
      this.logger.error('❌ Error en procesamiento rápido:', error);
      throw error;
    }
  }

  /**
   * Agrega elemento a la cola de procesamiento
   * @param {Object} item - Elemento a procesar
   */
  addToQueue(item) {
    this.processingQueue.push(item);
    this.logger.debug(`📥 Agregado a cola: ${item.id} (${this.processingQueue.length} pendientes)`);
  }

  /**
   * Inicia el procesador de cola asíncrono
   */
  startQueueProcessor() {
    setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processQueue();
      }
    }, 100); // Procesar cada 100ms
  }

  /**
   * Procesa la cola de elementos pendientes
   */
  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batchSize = Math.min(10, this.processingQueue.length);
    const batch = this.processingQueue.splice(0, batchSize);

    this.logger.info(`🔄 Procesando lote de ${batch.length} elementos`);

    for (const item of batch) {
      try {
        await this.processWebhookComplete(item.data);
        this.metrics.successfulProcessing++;
        this.logger.debug(`✅ Procesado: ${item.id}`);
      } catch (error) {
        this.metrics.failedProcessing++;
        this.logger.error(`❌ Error procesando ${item.id}:`, error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Procesamiento completo del webhook (asíncrono)
   * @param {Object} webhookData - Datos del webhook
   */
  async processWebhookComplete(webhookData) {
    try {
      const results = {
        clients: [],
        contacts: [],
        conversations: [],
        messages: [],
        errors: []
      };

      // Procesar cada entrada del webhook
      for (const entry of webhookData.entry || []) {
        // Procesar cambios de mensajes
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;
            
            // Almacenar datos de cliente y número de WhatsApp
            if (value.metadata) {
              this.storeClientData(value.metadata);
            }
            
            // Procesar contactos
            for (const contactData of value.contacts || []) {
              try {
                const contact = await this.upsertContact(contactData);
                results.contacts.push(contact);
              } catch (error) {
                results.errors.push({ type: 'contact', error: error.message, data: contactData });
              }
            }

            // Procesar mensajes
            for (const messageData of value.messages || []) {
              try {
                const contact = results.contacts.find(c => c.phone === messageData.from);
                if (!contact) {
                  throw new Error(`Contacto no encontrado para número: ${messageData.from}`);
                }

                const conversation = await this.getOrCreateConversation(
                  contact.id,
                  value.metadata?.phone_number_id
                );
                results.conversations.push(conversation);

                const message = await this.createMessage({
                  conversation_id: conversation.id,
                  contact_id: contact.id,
                  external_id: messageData.id,
                  content: this.extractMessageContent(messageData),
                  type: messageData.type,
                  direction: 'inbound',
                  timestamp: new Date(parseInt(messageData.timestamp) * 1000),
                  metadata: {
                    original_data: messageData,
                    phone_number_id: value.metadata?.phone_number_id,
                    wa_id: messageData.from,
                    from: messageData.from
                  }
                });
                
                results.messages.push(message);
              } catch (error) {
                results.errors.push({ type: 'message', error: error.message, data: messageData });
              }
            }
          }
        }
      }

      this.logger.info(`✅ Procesamiento completo: ${results.contacts.length} contactos, ${results.messages.length} mensajes`);
      
      return results;

    } catch (error) {
      this.logger.error('❌ Error en procesamiento completo:', error);
      throw error;
    }
  }

  /**
   * Almacena datos de cliente y número de WhatsApp
   * @param {Object} metadata - Metadatos del webhook
   */
  storeClientData(metadata) {
    if (metadata.phone_number_id) {
      this.whatsappNumbers.set(metadata.phone_number_id, {
        phone_number_id: metadata.phone_number_id,
        display_phone_number: metadata.display_phone_number,
        waba_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'default_waba',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  /**
   * Crea o actualiza un contacto
   * @param {Object} contactData - Datos del contacto
   */
  async upsertContact(contactData) {
    const { wa_id, profile } = contactData;
    
    // Buscar contacto existente
    let contact = await this.Contact.findOne({
      where: { phone: wa_id }
    });

    if (!contact) {
      // Crear nuevo contacto
      contact = await this.Contact.create({
        phone: wa_id.startsWith('+') ? wa_id : `+${wa_id}`,
        name: profile?.name || 'Usuario WhatsApp',
        email: null,
        status: 'active',
        custom_fields: {
          wa_id: wa_id,
          profile_name: profile?.name,
          profile_data: profile || {}
        }
      });
    } else {
      // Actualizar contacto existente
      await this.Contact.update({
        name: profile?.name || contact.name,
        custom_fields: {
          ...contact.custom_fields,
          wa_id: wa_id,
          profile_name: profile?.name,
          profile_data: profile || {}
        }
      }, {
        where: { id: contact.id }
      });
    }

    // Almacenar datos extendidos
    this.extendedContactData.set(contact.id, {
      wa_id: wa_id,
      profile_name: profile?.name,
      last_interaction: new Date().toISOString()
    });

    return contact;
  }

  /**
   * Obtiene o crea una conversación
   * @param {number} contactId - ID del contacto
   * @param {string} phoneNumberId - ID del número de WhatsApp
   */
  async getOrCreateConversation(contactId, phoneNumberId) {
    let conversation = await this.Conversation.findOne({
      where: {
        contact_id: contactId,
        status: 'active'
      }
    });

    if (!conversation) {
      conversation = await this.Conversation.create({
        contact_id: contactId,
        status: 'active',
        priority: 'medium',
        channel: 'whatsapp',
        metadata: {
          phone_number_id: phoneNumberId,
          created_from: 'whatsapp_webhook'
        }
      });
    }

    return conversation;
  }

  /**
   * Crea un mensaje
   * @param {Object} messageData - Datos del mensaje
   */
  async createMessage(messageData) {
    const message = await this.Message.create(messageData);
    return message;
  }

  /**
   * Extrae el contenido del mensaje según su tipo
   * @param {Object} messageData - Datos del mensaje
   */
  extractMessageContent(messageData) {
    const { type } = messageData;
    
    switch (type) {
      case 'text':
        return messageData.text?.body || '';
      case 'image':
        return messageData.image?.caption || 'Imagen enviada';
      case 'audio':
        return 'Audio enviado';
      case 'video':
        return messageData.video?.caption || 'Video enviado';
      case 'document':
        return messageData.document?.filename || 'Documento enviado';
      case 'location':
        return `Ubicación: ${messageData.location?.latitude}, ${messageData.location?.longitude}`;
      case 'contact':
        return `Contacto compartido: ${messageData.contact?.name || 'Sin nombre'}`;
      default:
        return `Mensaje de tipo: ${type}`;
    }
  }

  /**
   * Actualiza métricas de rendimiento
   * @param {number} responseTime - Tiempo de respuesta en ms
   * @param {boolean} success - Si fue exitoso
   */
  updateMetrics(responseTime, success) {
    this.metrics.avgResponseTime = (
      (this.metrics.avgResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests
    );

    if (success) {
      this.metrics.successfulProcessing++;
    } else {
      this.metrics.failedProcessing++;
    }
  }

  /**
   * Obtiene métricas de rendimiento
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.processingQueue.length,
      isProcessing: this.isProcessing,
      successRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.successfulProcessing / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      clientDataCount: this.clientData.size,
      whatsappNumbersCount: this.whatsappNumbers.size,
      extendedContactsCount: this.extendedContactData.size
    };
  }

  /**
   * Obtiene datos de cliente por ID
   * @param {string} clientId - ID del cliente
   */
  getClientData(clientId) {
    return this.clientData.get(clientId);
  }

  /**
   * Obtiene datos de número de WhatsApp
   * @param {string} phoneNumberId - ID del número
   */
  getWhatsAppNumber(phoneNumberId) {
    return this.whatsappNumbers.get(phoneNumberId);
  }

  /**
   * Obtiene todos los números de WhatsApp
   */
  getAllWhatsAppNumbers() {
    return Array.from(this.whatsappNumbers.values());
  }

  /**
   * Cierra la conexión a la base de datos
   */
  async close() {
    try {
      await this.sequelize.close();
      this.logger.info('Conexión a base de datos cerrada');
    } catch (error) {
      this.logger.error('Error cerrando conexión:', error);
    }
  }
}

export default WhatsAppOptimizedDataService;
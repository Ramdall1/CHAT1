/**
 * Unified Webhook Service - Servicio Unificado de Webhooks
 * Consolida toda la lógica de procesamiento de webhooks
 * Estilo Manychat unificado y mejorado
 */

import { unified360DialogService } from '../core/Unified360DialogService.js';
import { messageUtils } from '../../../shared/utils/helpers/helpers/MessageUtils.js';
import logger from './logger.js';
import { Persuader } from '../../../../apps/api/src/ai/persuader.js';
import crypto from 'crypto';
import axios from 'axios';

/**
 * Servicio unificado de webhooks
 */
export class UnifiedWebhookService {
  constructor() {
    this.dialog360Service = unified360DialogService;
    this.messageUtils = messageUtils;
    this.persuader = null;
    this.io = null; // Socket.IO instance
    this.localMessagingService = null; // Local messaging service
    this.contactManager = null; // Contact manager instance
    this.processingQueue = new Map();
    this.rateLimiter = new Map();
    this.processedMessages = new Map(); // Cache en memoria para deduplicación rápida
    this.messageDeduplicationTimeout = 60000; // 60 segundos para limpiar cache
    this.db = null; // SQLite database instance
    this.webhookDeduplicationDays = 7; // Guardar webhooks procesados por 7 días
    this.metrics = {
      totalProcessed: 0,
      successfulProcessed: 0,
      failedProcessed: 0,
      averageProcessingTime: 0,
      lastProcessedAt: null,
      duplicatesDetected: 0
    };
    
    // Limpiar cache de mensajes cada 60 segundos
    setInterval(() => this.cleanupMessageCache(), this.messageDeduplicationTimeout);
    
    // Limpiar webhooks expirados de la BD cada 24 horas
    setInterval(() => this.cleanupExpiredWebhooks(), 24 * 60 * 60 * 1000);
  }

  /**
   * Configurar instancia de BD
   */
  setDatabase(db) {
    this.db = db;
    logger.info('✅ Database configured for UnifiedWebhookService');
  }

  /**
     * Configurar Socket.IO
     */
  setSocketIO(io) {
    this.io = io;
    logger.info('✅ Socket.IO configured for UnifiedWebhookService');
  }

  /**
      * Configurar Local Messaging Service
      */
   setLocalMessagingService(localMessagingService) {
     this.localMessagingService = localMessagingService;
     logger.info('✅ LocalMessagingService configured for UnifiedWebhookService');
   }

   /**
      * Configurar Contact Manager
      */
   setContactManager(contactManager) {
     this.contactManager = contactManager;
     logger.info('✅ ContactManager configured for UnifiedWebhookService');
   }

  /**
     * Inicializar el servicio
     */
  async initialize() {
    try {
      await this.dialog360Service.initialize();
      await this.messageUtils.initializePersuader();
            
      // Inicializar persuader
      try {
        this.persuader = new Persuader();
        logger.info('✅ Persuader initialized successfully');
      } catch (error) {
        logger.warn('⚠️ Persuader not available, using fallback logic');
      }
            
      logger.info('✅ UnifiedWebhookService initialized successfully');
      return { success: true };
            
    } catch (error) {
      logger.error('❌ Failed to initialize UnifiedWebhookService:', error.message);
      throw error;
    }
  }

  /**
     * Procesar webhook de 360dialog
     * Reemplaza: procesarWebhook360dialog()
     */
  async processWebhook(webhookData, signature = null) {
    const startTime = Date.now();
    const webhookId = this.generateWebhookId(webhookData);
        
    try {
      logger.info(`🔄 Processing webhook ${webhookId}...`);
            
      // Verificar rate limiting
      if (!this.checkRateLimit()) {
        logger.warn(`⚠️ Rate limit exceeded for webhook ${webhookId}`);
        return {
          success: false,
          error: 'Rate limit exceeded',
          webhookId
        };
      }
            
      // Webhook signature verification removed - no longer needed
            
      // Verificar si ya está siendo procesado
      if (this.processingQueue.has(webhookId)) {
        logger.warn(`⚠️ Webhook ${webhookId} already being processed`);
        return {
          success: false,
          error: 'Already processing',
          webhookId
        };
      }
            
      // Marcar como en procesamiento
      this.processingQueue.set(webhookId, { startTime, status: 'processing' });
            
      // Procesar según el tipo de webhook
      let result;
            
      if (this.is360DialogWebhook(webhookData)) {
        result = await this.process360DialogWebhook(webhookData);
      } else if (this.isManychatWebhook(webhookData)) {
        result = await this.processManychatWebhook(webhookData);
      } else {
        result = await this.processGenericWebhook(webhookData);
      }
            
      // Actualizar métricas
      this.updateMetrics(startTime, true);
            
      // Limpiar de la cola de procesamiento
      this.processingQueue.delete(webhookId);
            
      logger.info(`✅ Webhook ${webhookId} processed successfully in ${Date.now() - startTime}ms`);
            
      return {
        success: true,
        webhookId,
        processingTime: Date.now() - startTime,
        result
      };
            
    } catch (error) {
      logger.error(`❌ Error processing webhook ${webhookId}:`, error.message);
            
      // Actualizar métricas de error
      this.updateMetrics(startTime, false);
            
      // Limpiar de la cola de procesamiento
      this.processingQueue.delete(webhookId);
            
      return {
        success: false,
        error: error.message,
        webhookId,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
     * Procesar webhook de 360dialog
     */
  async process360DialogWebhook(webhookData) {
    try {
      logger.debug('📨 === WEBHOOK 360DIALOG RECIBIDO ===');
      logger.debug('📨 PAYLOAD COMPLETO:', JSON.stringify(webhookData, null, 2));
      logger.debug('📨 ================================');

      const { entry } = webhookData;

      if (!entry || !Array.isArray(entry)) {
        throw new Error('Invalid 360dialog webhook format');
      }

      const results = [];
            
      for (const entryItem of entry) {
        const { changes } = entryItem;
                
        if (!changes || !Array.isArray(changes)) {
          continue;
        }
                
        for (const change of changes) {
          const { value } = change;
                    
          if (!value) continue;
                    
          // Procesar mensajes entrantes (de usuarios)
          if (value.messages && Array.isArray(value.messages)) {
            logger.info(`📨 Procesando ${value.messages.length} mensaje(s) entrante(s)`);

            // Extraer nombres de perfil de WhatsApp
            const contactsInfo = {};
            if (value.contacts && Array.isArray(value.contacts)) {
              for (const contact of value.contacts) {
                if (contact.wa_id && contact.profile?.name) {
                  contactsInfo[contact.wa_id] = contact.profile.name;
                  logger.info(`👤 Nombre de perfil detectado: "${contact.profile.name}" para ${contact.wa_id}`);
                }
              }
            }

            for (const message of value.messages) {
              // Agregar nombre del perfil al mensaje
              if (contactsInfo[message.from]) {
                message._profileName = contactsInfo[message.from];
              }

              const messageResult = await this.processIncomingMessage(message, value);
              results.push(messageResult);
            }
          }

          // Procesar message echoes (mensajes enviados por el negocio)
          if (value.message_echoes && Array.isArray(value.message_echoes)) {
            logger.info(`🔄 Procesando ${value.message_echoes.length} message echo(es) - mensajes enviados por el negocio`);

            for (const messageEcho of value.message_echoes) {
              // Los message echoes contienen el contenido completo del mensaje enviado
              // Marcar como echo para procesamiento especial
              messageEcho._isEcho = true;
              messageEcho._echoType = 'outbound_message';

              logger.info(`🔄 Message Echo - ID: ${messageEcho.id}, From: ${messageEcho.from}, To: ${messageEcho.to}, Type: ${messageEcho.type}`);

              const echoResult = await this.processMessageEcho(messageEcho, value);
              results.push(echoResult);
            }
          }
                    
          // Procesar estados de mensajes
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const status of value.statuses) {
              const statusResult = await this.processMessageStatus(status, value);
              results.push(statusResult);
            }
          }
        }
      }
            
      return {
        type: '360dialog',
        processedItems: results.length,
        results
      };
            
    } catch (error) {
      logger.error('❌ Error processing 360dialog webhook:', error.message);
      throw error;
    }
  }

  /**
      * Procesar message echo (mensaje enviado por el negocio)
      */
   async processMessageEcho(messageEcho, context) {
    try {
      const { from, to, id, timestamp, type } = messageEcho;

      logger.info(`🔄 Processing message echo - ID: ${id}, From: ${from}, To: ${to}, Type: ${type}`);

      // DEDUPLICACIÓN: Verificar si el message echo ya fue procesado (en BD o cache)
      const echoId = `echo_${id}`;
      const isProcessed = await this.isWebhookProcessed(echoId, id);
      if (isProcessed) {
        logger.warn(`⚠️ Message echo duplicado detectado y filtrado - ID: ${id}, From: ${from}, To: ${to}`);
        this.metrics.duplicatesDetected++;
        return { filtered: true, reason: 'duplicate_echo', messageId: id };
      }
      
      // Marcar como procesado (en BD y cache)
      await this.markWebhookAsProcessed(echoId, id, 'message_echo');

      // Los message echoes son mensajes que nosotros enviamos, por lo que:
      // 1. No deben generar respuestas automáticas
      // 2. Pueden usarse para actualizar estado de mensajes en BD
      // 3. Pueden emitirse vía Socket.IO para actualizar UI

       // Procesar media si existe (imagen, video, audio, documento)
       let mediaUrl = null;
       let mediaType = null;
       
       if (type === 'image' && messageEcho.image?.id) {
         mediaType = messageEcho.image.mime_type || 'image/jpeg';
         mediaUrl = await this.downloadMediaFromId(messageEcho.image.id, mediaType, type);
       } else if (type === 'video' && messageEcho.video?.id) {
         mediaType = messageEcho.video.mime_type || 'video/mp4';
         mediaUrl = await this.downloadMediaFromId(messageEcho.video.id, mediaType, type);
       } else if (type === 'audio' && messageEcho.audio?.id) {
         mediaType = messageEcho.audio.mime_type || 'audio/ogg';
         mediaUrl = await this.downloadMediaFromId(messageEcho.audio.id, mediaType, type);
       } else if (type === 'document' && messageEcho.document?.id) {
         mediaType = messageEcho.document.mime_type || 'application/pdf';
         mediaUrl = await this.downloadMediaFromId(messageEcho.document.id, mediaType, type);
       }

       // Guardar el message echo en el sistema de mensajería local (opcional)
       if (this.localMessagingService) {
         try {
           const echoContent = messageEcho.text?.body || messageEcho.text ||
                              `Message echo: ${type}`;

           // Para echoes: el "from" es el negocio (nosotros) y "to" es el cliente
           // Los message echoes son confirmaciones de mensajes ENVIADOS por nosotros
           const echoData = {
             from: from, // El negocio (nosotros) - dirección correcta
             to: to,     // El cliente
             text: echoContent,
             type,
             direction: 'outbound', // Mensaje SALIENTE (enviado por nosotros)
             id: id, // ID del mensaje de WhatsApp
             timestamp: new Date(timestamp * 1000).toISOString(), // Convertir Unix timestamp a ISO
             _isEcho: true,
             _echoType: 'message_echo',
             status: 'delivered', // Los echoes confirman entrega
             mediaUrl: mediaUrl, // Agregar URL de media si existe
             mediaType: mediaType // Agregar tipo de media si existe
           };

           await this.localMessagingService.receiveMessage(echoData);
           logger.info(`💾 Message echo (outbound) saved to LocalMessagingService: ${id}`);
         } catch (saveError) {
           logger.error('❌ Error saving message echo to LocalMessagingService:', saveError.message);
         }
       }

       // Emitir evento Socket.IO para actualizar UI en tiempo real
       if (this.io) {
         const echoData = {
           id,
           from: from, // El negocio (nosotros) - mensaje SALIENTE
           to: to,     // El cliente - destinatario
           type,
           text: messageEcho.text?.body || messageEcho.text,
           timestamp: new Date(timestamp * 1000).toISOString(),
           isEcho: true,
           direction: 'outbound', // Mensaje enviado por nosotros
           status: 'delivered', // Los echoes confirman entrega
           mediaUrl: mediaUrl, // Agregar URL de media si existe
           mediaType: mediaType // Agregar tipo de media si existe
         };

         // Emitir a la sala de la conversación del cliente
         this.io.to(`conversation_${to}`).emit('message_echo', echoData);

         logger.info(`📡 Socket.IO message_echo event emitted for outbound message ${id} to ${to}`);
       }

       return {
         messageId: id,
         from,
         to,
         type,
         processed: true,
         echo: true,
         direction: 'outbound'
       };

     } catch (error) {
       logger.error('❌ Error processing message echo:', error.message);
       return {
         messageId: messageEcho.id,
         from: messageEcho.from,
         to: messageEcho.to,
         type: messageEcho.type,
         processed: false,
         error: error.message,
         echo: true
       };
     }
   }

  /**
      * Procesar mensaje entrante
      */
   async processIncomingMessage(message, context) {
    try {
      const { from, type, text, interactive, button, list_reply } = message;

      // DEDUPLICACIÓN: Verificar si el mensaje ya fue procesado (en BD o cache)
      const messageId = message.id;
      const isProcessed = await this.isWebhookProcessed(messageId, messageId);
      if (isProcessed) {
        logger.warn(`⚠️ Mensaje duplicado detectado y filtrado - ID: ${messageId}, From: ${from}`);
        this.metrics.duplicatesDetected++;
        return { filtered: true, reason: 'duplicate_message', messageId };
      }
      
      // Marcar como procesado (en BD y cache)
      await this.markWebhookAsProcessed(messageId, messageId, 'incoming_message');

       // FILTRAR MENSAJES ECHO - Evitar procesar mensajes enviados por el bot mismo
       // Los message echoes ya se procesan por separado en processMessageEcho
       const businessPhoneNumber = process.env.BUSINESS_PHONE || process.env.WHATSAPP_PHONE_NUMBER || process.env.D360_PHONE_NUMBER;
       if (businessPhoneNumber && from === businessPhoneNumber) {
         logger.info('🛑 Mensaje echo detectado y filtrado (procesado por separado)', {
           from,
           businessPhoneNumber,
           messageId: message.id,
           type,
           category: 'ECHO_MESSAGE_FILTERED',
         });
         return { filtered: true, reason: 'echo_message' }; // No procesar mensajes del bot mismo
       }

       logger.debug('📨 === PROCESANDO MENSAJE ENTRANTE ===');
       logger.debug('📨 De:', from);
       logger.debug('📨 Tipo:', type);
       logger.debug('📨 Texto:', text?.body || text);
       logger.debug('📨 Mensaje completo:', JSON.stringify(message, null, 2));
       logger.debug('📨 ===================================');

       logger.info(`📨 Processing incoming message from ${from}, type: ${type}`);

      // Extraer contenido del mensaje una sola vez
      const messageContent = text?.body || text ||
                           interactive?.button_reply?.title ||
                           interactive?.list_reply?.title ||
                           button?.text ||
                           (type === 'location' ? '📍 Ubicación compartida' : null) ||
                           (type === 'contacts' ? '👤 Contacto compartido' : null) ||
                           (type === 'document' ? '📄 Documento' : null) ||
                           '';

      // Extraer media ID y descargar automáticamente si es multimedia
      let mediaUrl = null;
      let mediaType = null;

      if (type === 'image' && message.image?.id) {
        mediaType = message.image.mime_type || 'image/jpeg';
        mediaUrl = await this.downloadMediaFromId(message.image.id, mediaType, type);
      } else if (type === 'video' && message.video?.id) {
        mediaType = message.video.mime_type || 'video/mp4';
        mediaUrl = await this.downloadMediaFromId(message.video.id, mediaType, type);
      } else if (type === 'audio' && message.audio?.id) {
        mediaType = message.audio.mime_type || 'audio/ogg';
        mediaUrl = await this.downloadMediaFromId(message.audio.id, mediaType, type);
      } else if (type === 'document' && message.document?.id) {
        mediaType = message.document.mime_type || 'application/pdf';
        mediaUrl = await this.downloadMediaFromId(message.document.id, mediaType, type);
      }

      // Procesar mensajes interactivos
      if (type === 'interactive' && interactive?.nfm_reply?.response_json) {
        const responseJsonType = typeof interactive.nfm_reply.response_json;

        if (responseJsonType === 'string') {
          try {
            interactive.nfm_reply.response_json = JSON.parse(interactive.nfm_reply.response_json);
          } catch (parseError) {
            logger.error('❌ Error parseando response_json:', parseError.message);
          }
        }
      }

      // Construir objeto completo del mensaje
      const messageData = {
        from,
        text: messageContent,
        type,
        mediaUrl,
        mediaType,
        // Datos de ubicación (si aplica)
        latitude: type === 'location' ? message.location?.latitude : null,
        longitude: type === 'location' ? message.location?.longitude : null,
        locationName: type === 'location' ? message.location?.name : null,
        locationAddress: type === 'location' ? message.location?.address : null,
        // Datos interactivos (botones, listas, flows)
        ...(interactive && { interactive: interactive }),
        ...(interactive && {
          metadata: {
            interactive: interactive
          }
        }),
        // Nombre del perfil de WhatsApp
        _profileName: message._profileName || null,
        timestamp: new Date().toISOString()
      };

      // Guardar SOLO en SQLite (fuente única de verdad)
      try {
        const { saveMessageToSQLite, createOrUpdateContact } = await import('./SQLiteMessageHelper.js');

        // Crear o actualizar contacto
        const contactId = await createOrUpdateContact(from, message._profileName);

        // Guardar mensaje
        await saveMessageToSQLite({
          contact_id: contactId,
          type,
          direction: 'inbound',
          content: messageContent,
          media_url: mediaUrl,
          status: 'received',
          message_id: message.id
        });
      } catch (dbError) {
        logger.error('❌ Error saving message to SQLite:', dbError.message);
        logger.error('❌ Stack trace:', dbError.stack);
      }

      // Notificar actualización en tiempo real vía Socket.IO
      if (this.io && message._profileName) {
        this.io.emit('contact_updated', {
          phone: from,
          name: message._profileName,
          updatedAt: new Date().toISOString()
        });
      }

      // También actualizar en contactManager si está disponible (para compatibilidad)
      if (this.contactManager && message._profileName) {
        try {
          const existingContact = this.contactManager.getContact(from);
          const shouldUpdate = existingContact && message._profileName &&
                             (existingContact.name === from || !existingContact.name || existingContact.name.trim() === '');

          if (shouldUpdate) {
            this.contactManager.updateContact(from, { name: message._profileName });
          }
        } catch (contactError) {
          logger.debug(`ContactManager update failed (non-critical): ${contactError.message}`);
        }
      }
            
      let response = null;
            
      // Procesar según el tipo de mensaje
      switch (type) {
      case 'text':
        response = await this.processTextMessage(from, text?.body, context);
        break;
                    
      case 'interactive':
        if (interactive?.type === 'button_reply') {
          response = await this.processButtonReply(from, interactive.button_reply, context);
        } else if (interactive?.type === 'list_reply') {
          response = await this.processListReply(from, interactive.list_reply, context);
        }
        break;
                    
      case 'button':
        response = await this.processButtonReply(from, button, context);
        break;
                    
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        response = await this.processMediaMessage(from, message, context);
        break;
                    
      default:
        logger.warn(`⚠️ Unsupported message type: ${type}`);
        response = await this.processUnsupportedMessage(from, type, context);
      }
            
      // Emitir evento Socket.IO para nuevo mensaje
       if (this.io) {
         logger.info(`📡 Socket.IO instance available, emitting event for message from ${from}`);

         const messageData = {
           id: message.id,
           from,
           contactPhone: from,
           phone: from,
           type,
           text: message.text?.body || message.text,
           content: messageContent,
           message: messageContent,
           direction: 'inbound',
           status: 'received',
           timestamp: new Date().toISOString(),
           processed: true,
           // Incluir información de media si existe
           mediaUrl: mediaUrl,
           mediaType: mediaType,
           // Incluir datos de ubicación si es mensaje de ubicación
           latitude: type === 'location' ? message.location?.latitude : null,
           longitude: type === 'location' ? message.location?.longitude : null,
           locationName: type === 'location' ? message.location?.name : null,
           locationAddress: type === 'location' ? message.location?.address : null,
           // Incluir datos interactivos si existen
           interactive: interactive,
           metadata: interactive ? { interactive: interactive } : {}
         };

         // Emitir a todos los clientes conectados
         this.io.emit('new_message', messageData);

         // Emitir específicamente a la sala de la conversación
         this.io.to(`conversation_${from}`).emit('conversation_message', messageData);

         logger.info(`📡 Socket.IO event emitted for message from ${from}`, {
           type,
           hasMedia: !!mediaUrl,
           mediaType,
           eventName: 'new_message'
         });
       } else {
         logger.warn(`⚠️ Socket.IO instance not available for message from ${from}`);
       }

      return {
        messageId: message.id,
        from,
        type,
        processed: true,
        response
      };
            
    } catch (error) {
      logger.error('❌ Error processing incoming message:', error.message);
      return {
        messageId: message.id,
        from: message.from,
        type: message.type,
        processed: false,
        error: error.message
      };
    }
  }

  /**
     * Procesar mensaje de texto con IA
     */
  async processTextMessage(from, text, context) {
    try {
      if (!text) return null;
            
      logger.info(`💬 Processing text message: "${text.substring(0, 50)}..."`);
            
      // Usar IA para generar respuesta si está disponible
      if (this.persuader) {
        try {
          const aiResponse = await this.persuader.procesarMensaje(text, { from, context });
                    
          if (aiResponse && aiResponse.respuesta) {
            await this.messageUtils.sendTextMessage(from, aiResponse.respuesta);
                        
            return {
              type: 'ai_response',
              message: aiResponse.respuesta,
              confidence: aiResponse.confianza || 0.8,
              intent: aiResponse.intencion
            };
          }
        } catch (aiError) {
          logger.warn('⚠️ AI processing failed, using fallback logic:', aiError.message);
        }
      }
            
      // DESHABILITADO: Lógica de respuesta por defecto (respuestas automáticas)
      // const response = await this.generateDefaultResponse(text, from);
            
      // if (response) {
      //   await this.messageUtils.sendTextMessage(from, response);
                
      //   return {
      //     type: 'default_response',
      //     message: response,
      //     confidence: 0.6
      //   };
      // }
            
      logger.debug('💬 Respuestas automáticas deshabilitadas - mensaje recibido sin respuesta automática');
      return null;
            
    } catch (error) {
      logger.error('❌ Error processing text message:', error.message);
      throw error;
    }
  }

  /**
     * Procesar respuesta de botón
     */
  async processButtonReply(from, buttonReply, context) {
    try {
      const { id, title } = buttonReply;
            
      logger.info(`🔘 Processing button reply: ${id} - ${title}`);
            
      // Procesar según el ID del botón
      switch (id) {
      case 'info':
        await this.messageUtils.sendTextMessage(from, 
          '📋 Aquí tienes más información sobre nuestros servicios...');
        break;
                    
      case 'participate':
        await this.messageUtils.sendWelcomeMessage(from, { name: 'Participante' });
        break;
                    
      case 'contact':
        await this.messageUtils.sendTextMessage(from, 
          '📞 Puedes contactarnos en cualquier momento. ¿En qué podemos ayudarte?');
        break;
                    
      default:
        await this.messageUtils.sendTextMessage(from, 
          `Has seleccionado: ${title}. ¿En qué más podemos ayudarte?`);
      }
            
      return {
        type: 'button_response',
        buttonId: id,
        buttonTitle: title,
        processed: true
      };
            
    } catch (error) {
      logger.error('❌ Error processing button reply:', error.message);
      throw error;
    }
  }

  /**
     * Procesar respuesta de lista
     */
  async processListReply(from, listReply, context) {
    try {
      const { id, title, description } = listReply;
            
      logger.info(`📋 Processing list reply: ${id} - ${title}`);
            
      await this.messageUtils.sendTextMessage(from, 
        `Has seleccionado: ${title}. ${description ? description : ''} ¿Te gustaría más información?`);
            
      return {
        type: 'list_response',
        itemId: id,
        itemTitle: title,
        itemDescription: description,
        processed: true
      };
            
    } catch (error) {
      logger.error('❌ Error processing list reply:', error.message);
      throw error;
    }
  }

  /**
   * Procesar mensaje multimedia - RESPUESTAS AUTOMÁTICAS DESHABILITADAS
   */
  async processMediaMessage(from, message, context) {
    try {
      const { type } = message;

      logger.info(`🎬 Mensaje multimedia recibido - respuestas automáticas deshabilitadas: ${type}`, {
        from,
        mediaType: type,
        hasMedia: true
      });

      // RESPUESTAS AUTOMÁTICAS DESHABILITADAS
      /*
      await this.messageUtils.sendTextMessage(from,
        `Gracias por compartir tu ${type}. Lo hemos recibido correctamente. 📎`);
      */

      return {
        type: 'media_response',
        mediaType: type,
        processed: true,
        autoResponseDisabled: true
      };

    } catch (error) {
      logger.error('❌ Error processing media message:', error.message);
      throw error;
    }
  }

  /**
   * Procesar mensaje no soportado - RESPUESTAS AUTOMÁTICAS DESHABILITADAS
   */
  async processUnsupportedMessage(from, messageType, context) {
    try {
      logger.info(`❓ Mensaje no soportado recibido - respuestas automáticas deshabilitadas: ${messageType}`, {
        from,
        messageType,
        processed: true
      });

      // RESPUESTAS AUTOMÁTICAS DESHABILITADAS
      /*
      await this.messageUtils.sendTextMessage(from,
        'Lo siento, ese tipo de mensaje no es compatible en este momento. ¿Puedes enviar un mensaje de texto? 📝');
      */

      return {
        type: 'unsupported_response',
        originalType: messageType,
        processed: true,
        autoResponseDisabled: true
      };

    } catch (error) {
      logger.error('❌ Error processing unsupported message:', error.message);
      throw error;
    }
  }

  /**
     * Procesar estado de mensaje
     */
  async processMessageStatus(status, context) {
    try {
      const { id, status: messageStatus, timestamp, recipient_id } = status;
            
      logger.info(`📊 Processing message status: ${messageStatus} for message ${id}`);

      // DEDUPLICACIÓN: Verificar si el status update ya fue procesado (en BD o cache)
      const statusId = `status_${id}_${messageStatus}`;
      const isProcessed = await this.isWebhookProcessed(statusId, id);
      if (isProcessed) {
        logger.warn(`⚠️ Message status duplicado detectado y filtrado - ID: ${id}, Status: ${messageStatus}`);
        this.metrics.duplicatesDetected++;
        return { filtered: true, reason: 'duplicate_status', messageId: id };
      }
      
      // Marcar como procesado (en BD y cache)
      await this.markWebhookAsProcessed(statusId, id, `message_status_${messageStatus}`);
            
      // Actualizar métricas según el estado
      switch (messageStatus) {
      case 'sent':
        logger.info(`✅ Message ${id} sent successfully`);
        break;
      case 'delivered':
        logger.info(`📬 Message ${id} delivered`);
        break;
      case 'read':
        logger.info(`👁️ Message ${id} read`);
        break;
      case 'failed':
        logger.error(`❌ Message ${id} failed to send`);
        break;
      }
      
      // Actualizar estado en campañas si el mensaje pertenece a una
      try {
        const { campaignMessagingService } = await import('../../../services/campaigns/CampaignMessagingService.js');
        await campaignMessagingService.updateMessageStatus(id, messageStatus, timestamp);
      } catch (error) {
        // No fallar si el servicio de campañas no está disponible
        logger.debug('Campaign messaging service not available or message not from campaign');
      }
            
      return {
        messageId: id,
        status: messageStatus,
        timestamp,
        recipientId: recipient_id,
        processed: true
      };
            
    } catch (error) {
      logger.error('❌ Error processing message status:', error.message);
      return {
        messageId: status.id,
        processed: false,
        error: error.message
      };
    }
  }

  /**
     * Procesar webhook de Manychat
     */
  async processManychatWebhook(webhookData) {
    try {
      logger.info('🔄 Processing Manychat webhook...');
            
      // Implementar lógica específica de Manychat
      return {
        type: 'manychat',
        processed: true,
        message: 'Manychat webhook processed successfully'
      };
            
    } catch (error) {
      logger.error('❌ Error processing Manychat webhook:', error.message);
      throw error;
    }
  }

  /**
     * Procesar webhook genérico
     */
  async processGenericWebhook(webhookData) {
    try {
      logger.info('🔄 Processing generic webhook...');
            
      return {
        type: 'generic',
        processed: true,
        message: 'Generic webhook processed successfully'
      };
            
    } catch (error) {
      logger.error('❌ Error processing generic webhook:', error.message);
      throw error;
    }
  }

  /**
     * Generar respuesta por defecto
     */
  async generateDefaultResponse(text, from) {
    const lowerText = text.toLowerCase();
        
    // Respuestas básicas
    if (lowerText.includes('hola') || lowerText.includes('hi')) {
      return '¡Hola! 👋 ¿En qué puedo ayudarte hoy?';
    }
        
    if (lowerText.includes('gracias') || lowerText.includes('thank')) {
      return '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?';
    }
        
    if (lowerText.includes('ayuda') || lowerText.includes('help')) {
      return '¡Por supuesto! Estoy aquí para ayudarte. ¿Qué necesitas saber?';
    }
        
    if (lowerText.includes('precio') || lowerText.includes('cost')) {
      return 'Te enviaré información sobre nuestros precios. ¿Te interesa algún servicio en particular?';
    }
        
    // Respuesta genérica
    return 'Gracias por tu mensaje. Un representante se pondrá en contacto contigo pronto. 😊';
  }


  /**
     * Verificar si es webhook de 360dialog
     */
  is360DialogWebhook(data) {
    return data && data.entry && Array.isArray(data.entry);
  }

  /**
     * Verificar si es webhook de Manychat
     */
  isManychatWebhook(data) {
    return data && (data.type === 'manychat' || data.platform === 'manychat');
  }

  /**
     * Verificar rate limiting - DESACTIVADO
     */
    checkRateLimit() {
        return true; // Siempre permitir todas las peticiones
    }

  /**
     * Generar ID único para webhook
     */
  generateWebhookId(data) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `webhook_${timestamp}_${hash.substring(0, 8)}`;
  }

  /**
     * Generar clave para rate limiting
     */
  generateRateLimitKey(data) {
    // Usar IP o identificador único del webhook
    return data.from || data.source || 'unknown';
  }

  /**
     * Actualizar métricas
     */
  updateMetrics(startTime, success) {
    this.metrics.totalProcessed++;
    this.metrics.lastProcessedAt = new Date().toISOString();
        
    if (success) {
      this.metrics.successfulProcessed++;
    } else {
      this.metrics.failedProcessed++;
    }
        
    const processingTime = Date.now() - startTime;
    this.metrics.averageProcessingTime = 
            (this.metrics.averageProcessingTime + processingTime) / 2;
  }

  /**
     * Obtener métricas del servicio
     */
  getMetrics() {
    return {
      ...this.metrics,
      currentlyProcessing: this.processingQueue.size,
      rateLimiterEntries: this.rateLimiter.size,
      successRate: this.metrics.totalProcessed > 0 
        ? (this.metrics.successfulProcessed / this.metrics.totalProcessed * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Obtener URL temporal del media desde 360Dialog
   * Proceso correcto según documentación de WhatsApp Business API:
   * 1. Recibir webhook con media_id
   * 2. GET https://waba-v2.360dialog.io/{media-id} para obtener URL temporal
   * 3. Usar URL temporal (válida por 5 minutos) para descargar archivo
   * 4. Las URLs temporales comienzan con https://lookaside.fbsbx.com y son confidenciales
   */
  async getMediaUrl(mediaId, mediaType = 'image/jpeg') {
    try {
      if (!mediaId) return null;

      const apiKey = process.env.D360_API_KEY;
      const baseUrl = process.env.D360_API_BASE || 'https://waba.360dialog.io';

      if (!apiKey) {
        logger.warn('D360_API_KEY not configured');
        return null;
      }

      logger.info(`🔗 Paso 1: Solicitando URL temporal para media ${mediaId}`);

      // Paso 1: Obtener URL temporal del media desde 360Dialog
      const response = await axios.get(`${baseUrl}/${mediaId}`, {
        headers: {
          'D360-API-KEY': apiKey
        },
        timeout: 10000 // 10 segundos timeout
      });

      if (!response.data?.url) {
        logger.error('❌ No se recibió URL en la respuesta de 360Dialog');
        return null;
      }

      const temporaryUrl = response.data.url;
      logger.info(`🔗 Paso 2: URL temporal obtenida (confidencial): ${temporaryUrl.substring(0, 50)}...`);

      // Validar que la URL sea del dominio esperado
      if (!temporaryUrl.startsWith('https://lookaside.fbsbx.com')) {
        logger.warn(`⚠️ URL temporal no comienza con dominio esperado: ${temporaryUrl.substring(0, 30)}...`);
      }

      // Paso 2: Limpiar la URL (remover backslashes si existen)
      const cleanUrl = temporaryUrl.replace(/\\/g, '');
      logger.info(`✅ URL temporal limpia y lista para descarga`);

      // Paso 3: Opción A - Retornar URL temporal para descarga directa (recomendado)
      // Las URLs temporales son válidas por 5 minutos y deben usarse inmediatamente
      return {
        url: cleanUrl,
        expiresIn: 5 * 60 * 1000, // 5 minutos en ms
        mediaId,
        mediaType
      };

      // Opción B - Descargar y almacenar localmente (comentado - solo si es necesario)
      /*
      try {
        const fs = await import('fs');
        const path = await import('path');
        const crypto = await import('crypto');

        // Crear directorio para media si no existe
        const mediaDir = path.join(process.cwd(), 'data', 'media');
        if (!fs.existsSync(mediaDir)) {
          fs.mkdirSync(mediaDir, { recursive: true });
        }

        // Generar nombre único y seguro para el archivo
        const extension = this.getFileExtension(mediaType);
        const fileName = `${crypto.randomBytes(8).toString('hex')}_${Date.now()}${extension}`;
        const filePath = path.join(mediaDir, fileName);

        logger.info(`📥 Paso 3: Descargando archivo desde URL temporal...`);

        // Descargar el archivo usando la URL temporal
        const mediaResponse = await axios.get(cleanUrl, {
          responseType: 'arraybuffer',
          timeout: 30000, // 30 segundos para descarga
          maxRedirects: 5,
          headers: {
            'User-Agent': 'WhatsApp-Business-API/1.0'
          }
        });

        // Guardar archivo localmente
        fs.writeFileSync(filePath, mediaResponse.data);
        logger.info(`💾 Archivo guardado localmente: ${filePath}`);

        // Retornar ruta local para acceso web
        return `/media/${fileName}`;

      } catch (downloadError) {
        logger.error(`❌ Error descargando archivo: ${downloadError.message}`);
        // Fallback: retornar URL temporal si falla la descarga local
        return {
          url: cleanUrl,
          expiresIn: 5 * 60 * 1000,
          mediaId,
          mediaType,
          fallback: true
        };
      }
      */

    } catch (error) {
      logger.error(`❌ Error obteniendo URL de media (${mediaId}): ${error.message}`);
      if (error.response) {
        logger.error(`❌ Status: ${error.response.status}, Data:`, error.response.data);
      }
      return null;
    }
  }

  /**
   * Descargar y almacenar media localmente
   */
  async downloadAndStoreMedia(temporaryUrl, mediaType, mediaId) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const crypto = await import('crypto');

      // Crear directorio para media si no existe
      const mediaDir = path.join(process.cwd(), 'data', 'media');
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
        logger.info(`📁 Directorio de media creado: ${mediaDir}`);
      }

      // Generar nombre único y seguro para el archivo
      const extension = this.getFileExtension(mediaType);
      const fileName = `${crypto.randomBytes(8).toString('hex')}_${Date.now()}${extension}`;
      const filePath = path.join(mediaDir, fileName);

      logger.info(`📥 Descargando archivo desde URL temporal para media ${mediaId}...`);

      // Descargar el archivo usando la URL temporal
      const mediaResponse = await axios.get(temporaryUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 segundos para descarga
        maxRedirects: 5,
        headers: {
          'User-Agent': 'WhatsApp-Business-API/1.0'
        }
      });

      // Guardar archivo localmente
      fs.writeFileSync(filePath, mediaResponse.data);
      logger.info(`💾 Archivo multimedia guardado localmente: ${filePath}`);

      // Retornar ruta web accesible (/media/filename)
      const webPath = `/media/${fileName}`;
      logger.info(`🌐 Ruta web para acceso: ${webPath}`);

      return webPath;

    } catch (error) {
      logger.error(`❌ Error descargando/archivando media ${mediaId}: ${error.message}`);
      // Fallback: retornar URL temporal si falla la descarga local
      return temporaryUrl;
    }
  }

  /**
   * Descargar media desde Media ID (combina generación de URL y descarga)
   */
  async downloadMediaFromId(mediaId, mediaType, messageType) {
    try {
      if (!mediaId) return null;

      logger.info(`📥 Descargando media ${mediaId} de tipo ${messageType}`);

      // Paso 1: Generar URL fresca desde Media ID
      const urlResult = await this.dialog360Service.generateMediaUrl(mediaId);
      if (!urlResult.success) {
        logger.warn(`❌ Error generando URL para media ${mediaId}: ${urlResult.error}`);
        return null;
      }

      const freshMediaUrl = urlResult.mediaUrl;
      logger.debug(`🔗 URL generada para media ${mediaId}: ${freshMediaUrl}`);

      // Paso 2: Descargar y almacenar el archivo
      const fs = await import('fs');
      const path = await import('path');
      const crypto = await import('crypto');

      // Crear directorio para media si no existe
      const mediaDir = path.join(process.cwd(), 'data', 'media');
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
        logger.info(`📁 Directorio de media creado: ${mediaDir}`);
      }

      // Generar nombre único para el archivo
      const fileExtension = this.getFileExtension(mediaType);
      const filename = `${messageType}_${mediaId}_${Date.now()}.${fileExtension}`;
      const filepath = path.join(mediaDir, filename);

      // Descargar el archivo
      const downloadResult = await this.dialog360Service.downloadMediaFromWebhook(freshMediaUrl, filepath);

      if (downloadResult.success) {
        // Retornar ruta web accesible
        const webPath = `/media/${filename}`;
        logger.info(`✅ Media descargado exitosamente: ${webPath} (${downloadResult.size} bytes)`);
        return webPath;
      } else {
        logger.warn(`❌ Error descargando media ${mediaId}: ${downloadResult.error}`);
        return null;
      }

    } catch (error) {
      logger.error(`❌ Error descargando media ${mediaId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtener extensión de archivo basada en MIME type
   */
  getFileExtension(mediaType) {
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/avi': '.avi',
      'audio/ogg': '.ogg',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'text/plain': '.txt'
    };

    return mimeToExt[mediaType] || '.bin';
  }

  /**
     * Limpiar cache de mensajes procesados
     */
  cleanupMessageCache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [messageId, data] of this.processedMessages.entries()) {
      // Eliminar mensajes más antiguos que 60 segundos
      if (now - data.timestamp > this.messageDeduplicationTimeout) {
        this.processedMessages.delete(messageId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`🧹 Limpieza de cache: ${cleanedCount} mensajes eliminados. Cache actual: ${this.processedMessages.size}`);
    }
  }

  /**
   * Verificar si un webhook ya fue procesado (en BD o cache)
   */
  async isWebhookProcessed(webhookId, messageId) {
    try {
      // Primero verificar en cache en memoria (rápido)
      if (this.processedMessages.has(webhookId)) {
        return true;
      }

      // Luego verificar en BD (persistente)
      if (this.db) {
        return new Promise((resolve, reject) => {
          this.db.get(
            'SELECT id FROM processed_webhooks WHERE webhook_id = ? AND expires_at > datetime("now")',
            [webhookId],
            (err, row) => {
              if (err) {
                logger.error('Error checking webhook in DB:', err);
                resolve(false);
              } else {
                resolve(!!row);
              }
            }
          );
        });
      }

      return false;
    } catch (error) {
      logger.error('Error in isWebhookProcessed:', error);
      return false;
    }
  }

  /**
   * Guardar webhook como procesado (en BD y cache)
   */
  async markWebhookAsProcessed(webhookId, messageId, webhookType) {
    try {
      // Guardar en cache en memoria
      this.processedMessages.set(webhookId, {
        messageId,
        webhookType,
        timestamp: Date.now()
      });

      // Guardar en BD (persistente)
      if (this.db) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.webhookDeduplicationDays);

        return new Promise((resolve, reject) => {
          this.db.run(
            `INSERT OR IGNORE INTO processed_webhooks 
             (webhook_id, message_id, webhook_type, expires_at) 
             VALUES (?, ?, ?, ?)`,
            [webhookId, messageId, webhookType, expiresAt.toISOString()],
            (err) => {
              if (err) {
                logger.error('Error saving webhook to DB:', err);
              }
              resolve();
            }
          );
        });
      }
    } catch (error) {
      logger.error('Error in markWebhookAsProcessed:', error);
    }
  }

  /**
   * Limpiar webhooks expirados de la BD
   */
  async cleanupExpiredWebhooks() {
    try {
      if (!this.db) return;

      return new Promise((resolve, reject) => {
        this.db.run(
          'DELETE FROM processed_webhooks WHERE expires_at <= datetime("now")',
          (err) => {
            if (err) {
              logger.error('Error cleaning expired webhooks:', err);
            } else {
              logger.debug('✅ Expired webhooks cleaned from database');
            }
            resolve();
          }
        );
      });
    } catch (error) {
      logger.error('Error in cleanupExpiredWebhooks:', error);
    }
  }

  /**
     * Verificar estado del servicio
     */
  async healthCheck() {
    try {
      const dialog360Health = await this.dialog360Service.healthCheck();
            
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          dialog360: dialog360Health.status,
          persuader: this.persuader ? 'available' : 'unavailable',
          messageUtils: 'available'
        },
        metrics: this.getMetrics()
      };
            
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
     * Limpiar recursos
     */
  cleanup() {
    this.processingQueue.clear();
    this.rateLimiter.clear();
    logger.info('🧹 UnifiedWebhookService cleaned up');
  }
}

// Instancia singleton
export const unifiedWebhookService = new UnifiedWebhookService();

export default UnifiedWebhookService;
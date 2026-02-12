/**
 * Unified 360Dialog Service - Estilo Manychat Mejorado
 * Servicio unificado que consolida todas las funcionalidades de 360Dialog
 * Elimina duplicidades y proporciona una interfaz coherente y eficiente
 */

import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import logger from './logger.js';
import EventBus from '../EventBus.js';
import { EventTypes } from './EventTypes.js';
import { CONFIG } from '../../../../apps/api/src/core/config.js';
import contextManager from '../../../managers/context_manager.js';
import { intelligentAI } from '../../../../apps/api/src/services/IntelligentAIService.js';

/**
 * Clase de error personalizada para 360Dialog
 */
class Dialog360Error extends Error {
  constructor(message, code = 'DIALOG360_ERROR', statusCode = null, details = null) {
    super(message);
    this.name = 'Dialog360Error';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Servicio Unificado de 360Dialog con estilo Manychat
 * Combina envío de mensajes, procesamiento de webhooks y gestión de IA
 */
class Unified360DialogService {
  constructor() {
    // Configuración de API - Estandarizada
    this.baseUrl = process.env.D360_API_BASE || 'https://waba-v2.360dialog.io';  // ✅ Usar waba-v2
    this.apiKey = process.env.D360_API_KEY;
    this.phoneNumberId = process.env.D360_PHONE_NUMBER_ID;
    this.businessAccountId = process.env.D360_BUSINESS_ACCOUNT_ID;
    this.webhookUrl = process.env.D360_WEBHOOK_URL;
        
    // Servicios internos
    this.logger = logger;
    this.eventBus = new EventBus();
    this.rateLimiter = new Map();
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.isEnabled = true; // Se deshabilitará si no hay credenciales
        
    // Configuración de reintentos estilo Manychat
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      jitter: true
    };
        
    // Métricas de rendimiento
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      webhooksProcessed: 0,
      errors: 0,
      avgResponseTime: 0,
      lastActivity: null,
      aiInteractions: 0
    };
        
    // Palabras clave para detección de intención (estilo Manychat)
    this.intentKeywords = {
      purchase: [
        'quiero participar', 'como se paga', 'cómo se paga', 'me interesa',
        'mandame la info', 'mándame la info', 'envíame la info', 'enviame la info',
        'quiero comprar', 'participar', 'inscribirme', 'registrarme'
      ],
      rejection: [
        'no me interesa', 'no gracias', 'no quiero', 'déjame en paz',
        'no molestar', 'stop', 'basta', 'cancelar'
      ]
    };
        
    this.initializeService();
  }

  /**
     * Inicializar el servicio unificado
     */
  async initializeService() {
    try {
      if (!this.apiKey || !this.phoneNumberId) {
        this.logger.warn('⚠️ Credenciales de 360Dialog no configuradas. El servicio estará deshabilitado.', {
          context: 'UNIFIED_360DIALOG_SERVICE',
          required: ['D360_API_KEY', 'D360_PHONE_NUMBER_ID']
        });
        this.isEnabled = false;
        return;
      }
            
      // Verificar conectividad
      // NOTA: Health check deshabilitado porque 360Dialog no tiene endpoint /health_status
      // El servicio se verificará cuando se intente usar
      try {
        // await this.healthCheck();  // Deshabilitado - 360Dialog no tiene este endpoint
        
        // Iniciar procesamiento de cola
        this.startQueueProcessor();
      } catch (error) {
        logger.warn('⚠️ 360Dialog service not available, continuing without it', {
          error: error.message,
          code: error.code
        });
        this.isEnabled = false;
        return;
      }
            
      logger.info('🚀 Unified 360Dialog Service initialized successfully', {
        baseUrl: this.baseUrl,
        phoneNumberId: this.phoneNumberId,
        businessAccountId: this.businessAccountId,
        style: 'Manychat Enhanced'
      });
            
      this.eventBus.emit(EventTypes.INTEGRATION_CONNECTED, {
        provider: '360Dialog Unified',
        status: 'connected',
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      logger.error('❌ Failed to initialize Unified 360Dialog Service:', {
        error: error.message,
        code: error.code || 'INITIALIZATION_ERROR',
        stack: error.stack
      });
            
      throw error instanceof Dialog360Error ? error : new Dialog360Error(
        `Initialization failed: ${error.message}`,
        'INITIALIZATION_ERROR'
      );
    }
  }

  /**
     * Verificación de salud del servicio
     */
  async healthCheck() {
    try {
      const response = await this.makeRequest('GET', '/health_status');
            
      if (response.status === 200) {
        logger.info('✅ 360Dialog health check passed');
        return { status: 'healthy', timestamp: new Date().toISOString() };
      }
            
      throw new Error(`Health check failed with status: ${response.status}`);
            
    } catch (error) {
      logger.error('❌ 360Dialog health check failed:', error.message);
      throw new Dialog360Error(
        `Health check failed: ${error.message}`,
        'HEALTH_CHECK_FAILED'
      );
    }
  }

  /**
      * Subir media y obtener Media ID (Método 2 recomendado)
      */
   async uploadMedia(mediaBuffer, mimeType, filename) {
     try {
       const formData = new FormData();
       formData.append('file', mediaBuffer, {
         filename: filename,
         contentType: mimeType
       });
       formData.append('messaging_product', 'whatsapp');

       const config = {
         method: 'POST',
         url: `${this.baseUrl}/media`,
         headers: {
           'D360-API-KEY': this.apiKey,
           ...formData.getHeaders()
         },
         data: formData,
         timeout: 60000 // 60 segundos para uploads
       };

       const response = await axios(config);

       if (response.data && response.data.id) {
         logger.info(`📤 Media uploaded successfully, ID: ${response.data.id}`);
         return {
           success: true,
           mediaId: response.data.id,
           url: response.data.url
         };
       }

       throw new Dialog360Error('Invalid media upload response', 'INVALID_MEDIA_RESPONSE');

     } catch (error) {
       logger.error(`❌ Failed to upload media:`, error.message);
       throw new Dialog360Error(
         `Failed to upload media: ${error.message}`,
         'MEDIA_UPLOAD_ERROR'
       );
     }
   }

   /**
      * Enviar imagen usando Media ID (Método 2 recomendado)
      */
   async sendImageById(to, mediaId, caption = '', options = {}) {
     try {
       const messageData = {
         messaging_product: 'whatsapp',
         recipient_type: 'individual',
         to: this.normalizePhoneNumber(to),
         type: 'image',
         image: {
           id: mediaId,
           caption: caption || undefined
         },
         ...options
       };

       return await this.sendMessage(messageData, options);

     } catch (error) {
       logger.error(`❌ Failed to send image by ID to ${to}:`, error.message);
       throw error;
     }
   }

   /**
      * Enviar video usando Media ID (Método 2 recomendado)
      */
   async sendVideoById(to, mediaId, caption = '', options = {}) {
     try {
       const messageData = {
         messaging_product: 'whatsapp',
         recipient_type: 'individual',
         to: this.normalizePhoneNumber(to),
         type: 'video',
         video: {
           id: mediaId,
           caption: caption || undefined
         },
         ...options
       };

       return await this.sendMessage(messageData, options);

     } catch (error) {
       logger.error(`❌ Failed to send video by ID to ${to}:`, error.message);
       throw error;
     }
   }

   /**
      * Enviar imagen usando URL directa (Método 1)
      */
   async sendImageByUrl(to, imageUrl, caption = '', options = {}) {
     try {
       const messageData = {
         messaging_product: 'whatsapp',
         recipient_type: 'individual',
         to: this.normalizePhoneNumber(to),
         type: 'image',
         image: {
           link: imageUrl,
           caption: caption || undefined
         },
         ...options
       };

       return await this.sendMessage(messageData, options);

     } catch (error) {
       logger.error(`❌ Failed to send image by URL to ${to}:`, error.message);
       throw error;
     }
   }

   /**
      * Enviar video usando URL directa (Método 1)
      */
   async sendVideoByUrl(to, videoUrl, caption = '', options = {}) {
     try {
       const messageData = {
         messaging_product: 'whatsapp',
         recipient_type: 'individual',
         to: this.normalizePhoneNumber(to),
         type: 'video',
         video: {
           link: videoUrl,
           caption: caption || undefined
         },
         ...options
       };

       return await this.sendMessage(messageData, options);

     } catch (error) {
       logger.error(`❌ Failed to send video by URL to ${to}:`, error.message);
       throw error;
     }
   }

   /**
      * Generar nueva URL de media desde Media ID
      */
   async generateMediaUrl(mediaId) {
     try {
       const config = {
         method: 'GET',
         url: `https://waba-v2.360dialog.io/${mediaId}`,
         headers: {
           'D360-API-KEY': this.apiKey
         },
         timeout: 30000
       };

       const response = await axios(config);

       if (response.data && response.data.url) {
         // Reemplazar el dominio según las instrucciones
         let mediaUrl = response.data.url;
         mediaUrl = mediaUrl.replace('lookaside.fbsbx.com', 'waba-v2.360dialog.io');

         logger.info(`🔗 Generated new media URL for ID ${mediaId}`);
         return {
           success: true,
           mediaUrl: mediaUrl,
           originalUrl: response.data.url
         };
       }

       throw new Dialog360Error('Invalid media URL response', 'INVALID_MEDIA_URL_RESPONSE');

     } catch (error) {
       logger.error(`❌ Failed to generate media URL for ID ${mediaId}:`, error.message);
       throw new Dialog360Error(
         `Failed to generate media URL: ${error.message}`,
         'MEDIA_URL_GENERATION_ERROR'
       );
     }
   }

   /**
      * Descargar media desde webhook URL
      */
   async downloadMediaFromWebhook(mediaUrl, outputPath = null) {
     try {
       const config = {
         method: 'GET',
         url: mediaUrl,
         headers: {
           'D360-API-KEY': this.apiKey
         },
         responseType: 'arraybuffer',
         timeout: 30000
       };

       const response = await axios(config);

       if (!outputPath) {
         // Si no se especifica ruta, devolver buffer
         return {
           success: true,
           data: response.data,
           size: response.data.length,
           mimeType: response.headers['content-type']
         };
       }

       // Guardar en archivo
       const fs = await import('fs');
       const path = await import('path');

       // Crear directorio si no existe
       const dir = path.dirname(outputPath);
       if (!fs.existsSync(dir)) {
         fs.mkdirSync(dir, { recursive: true });
       }

       fs.writeFileSync(outputPath, response.data);

       return {
         success: true,
         path: outputPath,
         size: response.data.length,
         mimeType: response.headers['content-type']
       };

     } catch (error) {
       logger.error(`❌ Failed to download media from webhook:`, error.message);
       throw new Dialog360Error(
         `Failed to download media: ${error.message}`,
         'MEDIA_DOWNLOAD_ERROR'
       );
     }
   }

   /**
      * Enviar mensaje de texto (estilo Manychat mejorado)
      */
   async sendTextMessage(to, text, options = {}) {
    try {
      const startTime = Date.now();
            
      // Normalizar número de teléfono
      const normalizedTo = this.normalizePhoneNumber(to);
            
      // Validar entrada
      if (!text || text.trim().length === 0) {
        throw new Dialog360Error('Text message cannot be empty', 'INVALID_TEXT');
      }
            
      if (text.length > 4096) {
        throw new Dialog360Error('Text message too long (max 4096 characters)', 'TEXT_TOO_LONG');
      }
            
      // Verificar rate limiting
      if (!this.checkRateLimit(normalizedTo)) {
        throw new Dialog360Error('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
      }
            
      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'text',
        text: {
          body: text.trim()
        },
        ...options
      };
            
      const result = await this.sendMessage(messageData, options);
            
      // Actualizar métricas
      const responseTime = Date.now() - startTime;
      this.updateMetrics('message_sent', responseTime);
            
      logger.info(`📩 Text message sent successfully to ${normalizedTo}`, {
        messageId: result.messageId,
        responseTime: `${responseTime}ms`
      });
            
      return result;
            
    } catch (error) {
      this.updateMetrics('error');
      logger.error(`❌ Failed to send text message to ${to}:`, error.message);
            
      if (error instanceof Dialog360Error) {
        throw error;
      }
            
      throw new Dialog360Error(
        `Failed to send text message: ${error.message}`,
        'SEND_TEXT_MESSAGE_ERROR'
      );
    }
  }

  /**
     * Enviar mensaje de agradecimiento personalizado
     */
  async sendThankYouMessage(to, customerData = {}) {
    try {
      const { name = '', email = '', phone = '' } = customerData;
            
      const thankYouMessage = `¡Gracias ${name ? name : 'por tu interés'}! 🙏
            
Hemos recibido tu información correctamente:
${email ? `📧 Email: ${email}` : ''}
${phone ? `📱 Teléfono: ${phone}` : ''}

Te contactaremos pronto con más detalles. ¡Estamos emocionados de tenerte con nosotros! 🎉`;

      return await this.sendTextMessage(to, thankYouMessage);
            
    } catch (error) {
      logger.error(`❌ Failed to send thank you message to ${to}:`, error.message);
      throw error;
    }
  }

  /**
     * Enviar información de pago
     */
  async sendPaymentInfo(to, paymentMethod = 'nequi') {
    try {
      const paymentMessages = {
        nequi: `💳 *Información de Pago - Nequi*

Para completar tu participación, realiza el pago por Nequi:

📱 *Número Nequi:* 3001234567
💰 *Valor:* $50.000 COP
📝 *Concepto:* Participación + tu número de teléfono

Una vez realices el pago, envíanos el comprobante para confirmar tu participación.

¿Tienes alguna pregunta sobre el proceso de pago? 🤔`,

        bancolombia: `🏦 *Información de Pago - Bancolombia*

Para completar tu participación:

🏦 *Banco:* Bancolombia
💳 *Cuenta:* 123-456789-01
💰 *Valor:* $50.000 COP
📝 *Concepto:* Participación + tu número

Envíanos el comprobante una vez realices la transferencia.

¿Necesitas ayuda con el proceso? 💬`
      };

      const message = paymentMessages[paymentMethod] || paymentMessages.nequi;
      return await this.sendTextMessage(to, message);
            
    } catch (error) {
      logger.error(`❌ Failed to send payment info to ${to}:`, error.message);
      throw error;
    }
  }

  /**
     * Enviar mensaje con botones interactivos (estilo Manychat)
     */
  async sendInteractiveButtons(to, text, buttons, options = {}) {
    try {
      if (!Array.isArray(buttons) || buttons.length === 0) {
        throw new Dialog360Error('Buttons array is required', 'INVALID_BUTTONS');
      }
            
      if (buttons.length > 3) {
        throw new Dialog360Error('Maximum 3 buttons allowed', 'TOO_MANY_BUTTONS');
      }
            
      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.normalizePhoneNumber(to),
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: text
          },
          action: {
            buttons: buttons.map((button, index) => ({
              type: 'reply',
              reply: {
                id: button.id || `btn_${index}`,
                title: button.title.substring(0, 20) // WhatsApp limit
              }
            }))
          }
        },
        ...options
      };
            
      return await this.sendMessage(messageData, options);
            
    } catch (error) {
      logger.error(`❌ Failed to send interactive buttons to ${to}:`, error.message);
      throw error;
    }
  }

  /**
     * Enviar lista interactiva (estilo Manychat)
     */
  async sendInteractiveList(to, text, buttonText, sections, options = {}) {
    try {
      if (!Array.isArray(sections) || sections.length === 0) {
        throw new Dialog360Error('Sections array is required', 'INVALID_SECTIONS');
      }
            
      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.normalizePhoneNumber(to),
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: text
          },
          action: {
            button: buttonText || 'Ver opciones',
            sections: sections.map(section => ({
              title: section.title,
              rows: section.rows.map(row => ({
                id: row.id,
                title: row.title.substring(0, 24),
                description: row.description?.substring(0, 72)
              }))
            }))
          }
        },
        ...options
      };
            
      return await this.sendMessage(messageData, options);
            
    } catch (error) {
      logger.error(`❌ Failed to send interactive list to ${to}:`, error.message);
      throw error;
    }
  }

  /**
     * Método principal para enviar mensajes (unificado)
     */
  async sendMessage(messageData, options = {}) {
    try {
      const { useQueue = true, priority = 'normal', retryCount = 0 } = options;
            
      // Si se debe usar cola, agregar a la cola
      if (useQueue && !options.skipQueue) {
        return await this.queueMessage(messageData, options);
      }
            
      // Verificar rate limiting
      if (!this.checkRateLimit(messageData.to)) {
        throw new Dialog360Error('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
      }
            
      // ✅ Usar endpoint /messages directamente (sin phoneNumberId en URL)
      const response = await this.makeRequest('POST', '/messages', messageData, retryCount);
            
      if (response.data && response.data.messages && response.data.messages[0]) {
        const message = response.data.messages[0];
                
        this.updateMetrics('message_sent');
                
        return {
          success: true,
          messageId: message.id,
          status: message.message_status,
          data: response.data,
          timestamp: new Date().toISOString()
        };
      }
            
      throw new Dialog360Error('Invalid response format', 'INVALID_RESPONSE');
            
    } catch (error) {
      this.updateMetrics('error');
            
      if (error instanceof Dialog360Error) {
        throw error;
      }
            
      throw new Dialog360Error(
        `Failed to send message: ${error.message}`,
        'SEND_MESSAGE_ERROR',
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
     * Procesar webhook unificado (estilo Manychat con IA)
     */
  async processWebhook(payload, signature) {
    try {
      const startTime = Date.now();
            
      // Verificar firma del webhook
      if (signature && !this.verifyWebhookSignature(payload, signature)) {
        throw new Dialog360Error('Invalid webhook signature', 'INVALID_SIGNATURE');
      }
            
      // Procesar cambios del webhook
      if (payload.entry && Array.isArray(payload.entry)) {
        for (const entry of payload.entry) {
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              await this.processWebhookChange(change);
            }
          }
        }
      }
            
      const processingTime = Date.now() - startTime;
      this.updateMetrics('webhook_processed', processingTime);
            
      logger.info(`✅ Webhook processed successfully in ${processingTime}ms`);
            
      return {
        success: true,
        processed: true,
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      };
            
    } catch (error) {
      this.updateMetrics('error');
      logger.error('❌ Webhook processing failed:', error.message);
            
      if (error instanceof Dialog360Error) {
        throw error;
      }
            
      throw new Dialog360Error(
        `Webhook processing failed: ${error.message}`,
        'WEBHOOK_PROCESSING_ERROR'
      );
    }
  }

  /**
     * Procesar cambio individual del webhook
     */
  async processWebhookChange(change) {
    try {
      if (change.field !== 'messages') {
        return;
      }
            
      const value = change.value;
            
      // Procesar mensajes entrantes
      if (value.messages && Array.isArray(value.messages)) {
        for (const message of value.messages) {
          await this.processIncomingMessage(message, value.metadata);
        }
      }
            
      // Procesar actualizaciones de estado
      if (value.statuses && Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          await this.processMessageStatus(status);
        }
      }
            
    } catch (error) {
      logger.error('❌ Error processing webhook change:', error.message);
      throw error;
    }
  }

  /**
     * Procesar mensaje entrante con IA (estilo Manychat mejorado)
     */
  async processIncomingMessage(message, metadata) {
    try {
      const { from, text, id: messageId, timestamp, type } = message;
      const content = this.extractMessageContent(message);
            
      logger.info(`📨 Processing incoming message from ${from}: "${content.substring(0, 50)}..."`);
            
      // Cargar contexto del cliente
      const context = await contextManager.cargarContexto(from);
            
      // Verificar si el cliente está rechazado
      if (context.estado === 'rechazado') {
        logger.info(`⛔ Customer ${from} is marked as rejected. Ignoring message.`);
        return;
      }
            
      // Agregar mensaje al historial
      await contextManager.agregarAlHistorial(from, {
        tipo: 'recibido',
        contenido: content,
        timestamp: Date.now(),
        messageId: messageId,
        messageType: type
      });
            
      // Detectar intención con palabras clave (estilo Manychat)
      const intentAnalysis = this.analyzeIntent(content);
            
      // Si hay rechazo explícito
      if (intentAnalysis.isRejection) {
        await this.handleRejection(from, context);
        return;
      }
            
      // Si hay intención de compra
      if (intentAnalysis.isPurchaseIntent) {
        await this.handlePurchaseIntent(from, context);
        return;
      }
            
      // Procesar con IA para respuesta contextual
      if (intelligentAI) {
        const aiAnalysis = await intelligentAI.analizarMensaje(content, context);
                
        if (aiAnalysis.respuesta && aiAnalysis.respuesta.trim()) {
          await this.sendTextMessage(from, aiAnalysis.respuesta);
                    
          // Agregar respuesta al historial
          await contextManager.agregarAlHistorial(from, {
            tipo: 'enviado',
            contenido: aiAnalysis.respuesta,
            timestamp: Date.now(),
            generadoPorIA: true
          });
                    
          this.updateMetrics('ai_interaction');
        }
      }
            
      // Emitir evento para otros sistemas
      this.eventBus.emit(EventTypes.MESSAGE_RECEIVED, {
        from,
        content,
        messageId,
        timestamp,
        context,
        intentAnalysis
      });
            
    } catch (error) {
      logger.error(`❌ Error processing incoming message from ${message.from}:`, error.message);
      throw error;
    }
  }

  /**
     * Analizar intención del mensaje (estilo Manychat)
     */
  analyzeIntent(content) {
    const lowerContent = content.toLowerCase();
        
    const isPurchaseIntent = this.intentKeywords.purchase.some(keyword => 
      lowerContent.includes(keyword)
    );
        
    const isRejection = this.intentKeywords.rejection.some(keyword => 
      lowerContent.includes(keyword)
    );
        
    return {
      isPurchaseIntent,
      isRejection,
      confidence: isPurchaseIntent || isRejection ? 0.8 : 0.3,
      detectedKeywords: [
        ...this.intentKeywords.purchase.filter(k => lowerContent.includes(k)),
        ...this.intentKeywords.rejection.filter(k => lowerContent.includes(k))
      ]
    };
  }

  /**
     * Manejar intención de compra
     */
  async handlePurchaseIntent(from, context) {
    try {
      logger.info(`💰 Purchase intent detected for ${from}`);
            
      // Actualizar contexto
      await contextManager.actualizarContexto(from, {
        estado: 'interesado',
        intencionCompra: true,
        ultimaInteraccion: Date.now()
      });
            
      // Enviar información de pago
      await this.sendPaymentInfo(from);
            
      // Emitir evento
      this.eventBus.emit(EventTypes.PURCHASE_INTENT_DETECTED, {
        from,
        timestamp: new Date().toISOString(),
        context
      });
            
    } catch (error) {
      logger.error(`❌ Error handling purchase intent for ${from}:`, error.message);
      throw error;
    }
  }

  /**
     * Manejar rechazo
     */
  async handleRejection(from, context) {
    try {
      logger.info(`❌ Rejection detected for ${from}`);
            
      // Actualizar contexto
      await contextManager.actualizarContexto(from, {
        estado: 'rechazado',
        fechaRechazo: Date.now()
      });
            
      // Enviar mensaje de despedida
      await this.sendTextMessage(from, 
        'Entendemos perfectamente. Gracias por tu tiempo y que tengas un excelente día. 😊'
      );
            
      // Emitir evento
      this.eventBus.emit(EventTypes.CUSTOMER_REJECTED, {
        from,
        timestamp: new Date().toISOString(),
        context
      });
            
    } catch (error) {
      logger.error(`❌ Error handling rejection for ${from}:`, error.message);
      throw error;
    }
  }

  /**
     * Extraer contenido del mensaje
     */
  extractMessageContent(message) {
    if (message.text) {
      return message.text.body || '';
    }
        
    if (message.interactive) {
      if (message.interactive.button_reply) {
        return message.interactive.button_reply.title || '';
      }
      if (message.interactive.list_reply) {
        return message.interactive.list_reply.title || '';
      }
    }
        
    if (message.button) {
      return message.button.text || '';
    }
        
    return `[${message.type || 'unknown'} message]`;
  }

  /**
     * Procesar estado del mensaje
     */
  async processMessageStatus(status) {
    try {
      logger.info(`📊 Message status update: ${status.id} -> ${status.status}`);
            
      // Emitir evento de estado
      this.eventBus.emit(EventTypes.MESSAGE_STATUS_UPDATED, {
        messageId: status.id,
        status: status.status,
        timestamp: status.timestamp,
        recipient: status.recipient_id
      });
            
    } catch (error) {
      logger.error('❌ Error processing message status:', error.message);
      throw error;
    }
  }

  /**
     * Realizar petición HTTP con reintentos
     */
  async makeRequest(method, endpoint, data = null, retryCount = 0) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'D360-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      };

      if (data) {
        config.data = data;
      }

      // 🔍 Logging detallado para debugging
      if (endpoint === '/messages') {
        logger.info(`📡 Enviando a 360Dialog:`, {
          url: config.url,
          method: config.method,
          phoneNumberId: this.phoneNumberId,
          to: data?.to,
          type: data?.type,
          apiKeyPresent: !!this.apiKey
        });
      }

      const response = await axios(config);
      return response;
            
    } catch (error) {
      // Log detallado del error
      if (endpoint === '/messages') {
        logger.error(`❌ Error de 360Dialog:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          errorData: error.response?.data,
          message: error.message
        });
      }
      
      if (this.shouldRetry(error) && retryCount < this.retryConfig.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount);
                
        logger.warn(`🔄 Retrying request (${retryCount + 1}/${this.retryConfig.maxRetries}) after ${delay}ms`);
                
        await this.sleep(delay);
        return this.makeRequest(method, endpoint, data, retryCount + 1);
      }
            
      throw error;
    }
  }

  /**
     * Verificar si se debe reintentar
     */
  shouldRetry(error) {
    if (!error.response) return true; // Network error
        
    const status = error.response.status;
    return status >= 500 || status === 429; // Server error or rate limit
  }

  /**
     * Calcular delay de reintento con jitter
     */
  calculateRetryDelay(retryCount) {
    const baseDelay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, retryCount);
    const delay = Math.min(baseDelay, this.retryConfig.maxDelay);
        
    if (this.retryConfig.jitter) {
      return delay + Math.random() * 1000; // Add up to 1s jitter
    }
        
    return delay;
  }

  /**
     * Verificar rate limiting - DESACTIVADO
     */
  checkRateLimit() {
      return true; // Siempre permitir todas las peticiones
  }


  /**
     * Normalizar número de teléfono
     */
  normalizePhoneNumber(phone) {
    if (!phone) return '';
        
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
        
    // Add country code if missing (assuming Colombia +57)
    if (cleaned.length === 10 && cleaned.startsWith('3')) {
      return `57${cleaned}`;
    }
        
    // If already has country code
    if (cleaned.length === 12 && cleaned.startsWith('57')) {
      return cleaned;
    }
        
    // Return as-is if format is unclear
    return cleaned;
  }

  /**
     * Actualizar métricas
     */
  updateMetrics(type, responseTime = null) {
    this.metrics.lastActivity = new Date().toISOString();
        
    switch (type) {
    case 'message_sent':
      this.metrics.messagesSent++;
      break;
    case 'message_received':
      this.metrics.messagesReceived++;
      break;
    case 'webhook_processed':
      this.metrics.webhooksProcessed++;
      break;
    case 'ai_interaction':
      this.metrics.aiInteractions++;
      break;
    case 'error':
      this.metrics.errors++;
      break;
    }
        
    if (responseTime !== null) {
      // Calculate rolling average
      const currentAvg = this.metrics.avgResponseTime;
      const totalMessages = this.metrics.messagesSent + this.metrics.messagesReceived;
      this.metrics.avgResponseTime = ((currentAvg * (totalMessages - 1)) + responseTime) / totalMessages;
    }
  }

  /**
     * Obtener métricas
     */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
     * Dormir por ms milisegundos
     */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Iniciar procesador de cola
     */
  startQueueProcessor() {
    if (this.isProcessingQueue) return;
        
    this.isProcessingQueue = true;
    this.processQueue();
  }

  /**
     * Procesar cola de mensajes
     */
  async processQueue() {
    while (this.isProcessingQueue) {
      try {
        if (this.messageQueue.length > 0) {
          const { messageData, options, resolve, reject } = this.messageQueue.shift();
                    
          try {
            const result = await this.sendMessage(messageData, { ...options, skipQueue: true });
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }
                
        await this.sleep(100); // Small delay between messages
                
      } catch (error) {
        logger.error('❌ Error in queue processor:', error.message);
        await this.sleep(1000); // Longer delay on error
      }
    }
  }

  /**
   * Enviar plantilla de WhatsApp
   */
  async sendTemplate(to, templateName, options = {}) {
    try {
      const startTime = Date.now();
      
      // Normalizar número de teléfono
      const normalizedTo = this.normalizePhoneNumber(to);
      
      // Validar entrada
      if (!templateName || templateName.trim().length === 0) {
        throw new Dialog360Error('Template name cannot be empty', 'INVALID_TEMPLATE');
      }
      
      // Verificar rate limiting
      if (!this.checkRateLimit(normalizedTo)) {
        throw new Dialog360Error('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
      }
      
      // Determinar idioma de la plantilla
      // Prioridad: options.language > es_CO (default)
      const templateLanguage = options.language || 'es_CO';
      
      // Construir payload de plantilla según formato de 360Dialog
      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: templateLanguage
          }
        }
      };
      
      // Si hay componentes en options, agregarlos al template
      // Esto es necesario para plantillas con parámetros o componentes complejos
      if (options.components && Array.isArray(options.components)) {
        messageData.template.components = options.components;
      }
      
      // Logging detallado del payload
      console.error(`🔍🔍🔍 [CRITICAL] PAYLOAD ENVIADO A 360DIALOG:`, JSON.stringify(messageData, null, 2));
      logger.info(`📦 Payload de plantilla a enviar:`, {
        to: normalizedTo,
        templateName: templateName,
        language: templateLanguage,
        hasComponents: !!messageData.template.components,
        componentsCount: messageData.template.components ? messageData.template.components.length : 0,
        fullPayload: JSON.stringify(messageData, null, 2)
      });
      
      const result = await this.sendMessage(messageData, options);
      
      // Actualizar métricas
      const responseTime = Date.now() - startTime;
      this.updateMetrics('template_sent', responseTime);
      
      logger.info(`📋 Template "${templateName}" sent successfully to ${normalizedTo}`, {
        messageId: result.messageId,
        responseTime: `${responseTime}ms`
      });
      
      return result;
      
    } catch (error) {
      this.updateMetrics('error');
      logger.error(`❌ Failed to send template to ${to}:`, error.message);
      
      if (error instanceof Dialog360Error) {
        throw error;
      }
      
      throw new Dialog360Error(
        `Failed to send template: ${error.message}`,
        'SEND_TEMPLATE_ERROR'
      );
    }
  }

  /**
     * Agregar mensaje a la cola
     */
  async queueMessage(messageData, options) {
    return new Promise((resolve, reject) => {
      this.messageQueue.push({
        messageData,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }

  /**
     * Detener el servicio
     */
  async stop() {
    this.isProcessingQueue = false;
    logger.info('🛑 Unified 360Dialog Service stopped');
  }
}

// Exportar instancia singleton
export const unified360DialogService = new Unified360DialogService();
export default Unified360DialogService;
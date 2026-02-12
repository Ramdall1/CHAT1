/**
 * @fileoverview Manejador especializado para diferentes tipos de mensajes de WhatsApp
 * Procesa y normaliza todos los tipos de mensajes según la API de WhatsApp Business
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import { createLogger } from '../core/core/logger.js';

const logger = createLogger('WHATSAPP_MESSAGE_HANDLER');

/**
 * Tipos de mensajes soportados por WhatsApp Business API
 */
const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  DOCUMENT: 'document',
  LOCATION: 'location',
  CONTACT: 'contact',
  INTERACTIVE: 'interactive',
  TEMPLATE: 'template',
  SYSTEM: 'system',
  STICKER: 'sticker',
  REACTION: 'reaction',
  ORDER: 'order'
};

/**
 * Estados de mensajes
 */
const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

/**
 * Manejador de mensajes de WhatsApp
 */
class WhatsAppMessageHandler {
  constructor() {
    this.logger = logger;
    this.supportedTypes = Object.values(MESSAGE_TYPES);
  }

  /**
   * Procesa un mensaje según su tipo
   * @param {Object} messageData - Datos del mensaje del webhook
   * @returns {Object} Mensaje procesado y normalizado
   */
  async processMessage(messageData) {
    try {
      const { type, id, from, timestamp } = messageData;

      // Validar tipo de mensaje
      if (!this.supportedTypes.includes(type)) {
        this.logger.warn(`Tipo de mensaje no soportado: ${type}`);
        return this.createUnsupportedMessage(messageData);
      }

      // Procesar según el tipo
      const processedMessage = await this.processMessageByType(messageData);

      // Añadir metadatos comunes
      processedMessage.metadata = {
        ...processedMessage.metadata,
        original_type: type,
        whatsapp_id: id,
        sender: from,
        received_at: new Date(),
        webhook_timestamp: timestamp
      };

      this.logger.info(`Mensaje procesado: ${id} (${type})`);
      return processedMessage;

    } catch (error) {
      this.logger.error('Error procesando mensaje:', error);
      return this.createErrorMessage(messageData, error);
    }
  }

  /**
   * Procesa mensaje según su tipo específico
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  async processMessageByType(messageData) {
    const { type } = messageData;

    switch (type) {
      case MESSAGE_TYPES.TEXT:
        return this.processTextMessage(messageData);
      
      case MESSAGE_TYPES.IMAGE:
        return this.processImageMessage(messageData);
      
      case MESSAGE_TYPES.AUDIO:
        return this.processAudioMessage(messageData);
      
      case MESSAGE_TYPES.VIDEO:
        return this.processVideoMessage(messageData);
      
      case MESSAGE_TYPES.DOCUMENT:
        return this.processDocumentMessage(messageData);
      
      case MESSAGE_TYPES.LOCATION:
        return this.processLocationMessage(messageData);
      
      case MESSAGE_TYPES.CONTACT:
        return this.processContactMessage(messageData);
      
      case MESSAGE_TYPES.INTERACTIVE:
        return this.processInteractiveMessage(messageData);
      
      case MESSAGE_TYPES.TEMPLATE:
        return this.processTemplateMessage(messageData);
      
      case MESSAGE_TYPES.STICKER:
        return this.processStickerMessage(messageData);
      
      case MESSAGE_TYPES.REACTION:
        return this.processReactionMessage(messageData);
      
      case MESSAGE_TYPES.ORDER:
        return this.processOrderMessage(messageData);
      
      default:
        return this.processGenericMessage(messageData);
    }
  }

  /**
   * Procesa mensaje de texto
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processTextMessage(messageData) {
    // Soporte para estructura parseada y estructura original
    const textContent = messageData.content || messageData.text?.body || '';
    const textData = messageData.raw?.text || messageData.text;
    
    return {
      type: MESSAGE_TYPES.TEXT,
      content: textContent,
      media_url: null,
      media_type: null,
      metadata: {
        text_data: textData,
        has_preview_url: !!(textData?.preview_url)
      }
    };
  }

  /**
   * Procesa mensaje de imagen
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processImageMessage(messageData) {
    // Soporte para estructura parseada y estructura original
    const imageData = messageData.raw?.image || messageData.image;
    const imageContent = messageData.content || imageData?.caption || 'Imagen enviada';
    
    return {
      type: MESSAGE_TYPES.IMAGE,
      content: imageContent,
      media_url: imageData?.id || null,
      media_type: imageData?.mime_type || 'image/jpeg',
      metadata: {
        image_data: imageData,
        file_size: imageData?.file_size,
        sha256: imageData?.sha256,
        has_caption: !!(imageData?.caption)
      }
    };
  }

  /**
   * Procesa mensaje de audio
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processAudioMessage(messageData) {
    const { audio } = messageData;
    
    return {
      type: MESSAGE_TYPES.AUDIO,
      content: 'Audio enviado',
      media_url: audio?.id || null,
      media_type: audio?.mime_type || 'audio/ogg',
      metadata: {
        audio_data: audio,
        file_size: audio?.file_size,
        sha256: audio?.sha256,
        voice: audio?.voice || false
      }
    };
  }

  /**
   * Procesa mensaje de video
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processVideoMessage(messageData) {
    const { video } = messageData;
    
    return {
      type: MESSAGE_TYPES.VIDEO,
      content: video?.caption || 'Video enviado',
      media_url: video?.id || null,
      media_type: video?.mime_type || 'video/mp4',
      metadata: {
        video_data: video,
        file_size: video?.file_size,
        sha256: video?.sha256,
        has_caption: !!video?.caption
      }
    };
  }

  /**
   * Procesa mensaje de documento
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processDocumentMessage(messageData) {
    const { document } = messageData;
    
    return {
      type: MESSAGE_TYPES.DOCUMENT,
      content: document?.caption || document?.filename || 'Documento enviado',
      media_url: document?.id || null,
      media_type: document?.mime_type || 'application/octet-stream',
      metadata: {
        document_data: document,
        filename: document?.filename,
        file_size: document?.file_size,
        sha256: document?.sha256,
        has_caption: !!document?.caption
      }
    };
  }

  /**
   * Procesa mensaje de ubicación
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processLocationMessage(messageData) {
    const { location } = messageData;
    
    const content = location?.name || 
      `Ubicación: ${location?.latitude}, ${location?.longitude}`;
    
    return {
      type: MESSAGE_TYPES.LOCATION,
      content,
      media_url: null,
      media_type: null,
      metadata: {
        location_data: location,
        latitude: location?.latitude,
        longitude: location?.longitude,
        name: location?.name,
        address: location?.address,
        url: location?.url
      }
    };
  }

  /**
   * Procesa mensaje de contacto
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processContactMessage(messageData) {
    const { contacts } = messageData;
    const contact = contacts?.[0] || {};
    
    const content = `Contacto compartido: ${contact?.name?.formatted_name || 'Sin nombre'}`;
    
    return {
      type: MESSAGE_TYPES.CONTACT,
      content,
      media_url: null,
      media_type: null,
      metadata: {
        contacts_data: contacts,
        contact_info: contact,
        phones: contact?.phones || [],
        emails: contact?.emails || []
      }
    };
  }

  /**
   * Procesa mensaje interactivo (botones, listas)
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processInteractiveMessage(messageData) {
    const { interactive } = messageData;
    
    let content = 'Mensaje interactivo';
    let interactionType = 'unknown';
    let selectedOption = null;

    if (interactive?.button_reply) {
      interactionType = 'button_reply';
      selectedOption = interactive.button_reply;
      content = `Botón seleccionado: ${interactive.button_reply.title}`;
    } else if (interactive?.list_reply) {
      interactionType = 'list_reply';
      selectedOption = interactive.list_reply;
      content = `Opción seleccionada: ${interactive.list_reply.title}`;
    } else if (interactive?.nfm_reply) {
      interactionType = 'nfm_reply';
      selectedOption = interactive.nfm_reply;
      content = 'Respuesta de formulario';
    }
    
    return {
      type: MESSAGE_TYPES.INTERACTIVE,
      content,
      media_url: null,
      media_type: null,
      metadata: {
        interactive_data: interactive,
        interaction_type: interactionType,
        selected_option: selectedOption,
        response_json: interactive?.nfm_reply?.response_json
      }
    };
  }

  /**
   * Procesa mensaje de plantilla
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processTemplateMessage(messageData) {
    const { template } = messageData;
    
    return {
      type: MESSAGE_TYPES.TEMPLATE,
      content: `Plantilla: ${template?.name || 'Sin nombre'}`,
      media_url: null,
      media_type: null,
      metadata: {
        template_data: template,
        template_name: template?.name,
        language: template?.language,
        components: template?.components || []
      }
    };
  }

  /**
   * Procesa mensaje de sticker
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processStickerMessage(messageData) {
    const { sticker } = messageData;
    
    return {
      type: MESSAGE_TYPES.STICKER,
      content: 'Sticker enviado',
      media_url: sticker?.id || null,
      media_type: sticker?.mime_type || 'image/webp',
      metadata: {
        sticker_data: sticker,
        file_size: sticker?.file_size,
        sha256: sticker?.sha256,
        animated: sticker?.animated || false
      }
    };
  }

  /**
   * Procesa reacción a mensaje
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processReactionMessage(messageData) {
    const { reaction } = messageData;
    
    const content = reaction?.emoji ? 
      `Reacción: ${reaction.emoji}` : 
      'Reacción eliminada';
    
    return {
      type: MESSAGE_TYPES.REACTION,
      content,
      media_url: null,
      media_type: null,
      metadata: {
        reaction_data: reaction,
        emoji: reaction?.emoji,
        message_id: reaction?.message_id,
        removed: !reaction?.emoji
      }
    };
  }

  /**
   * Procesa mensaje de orden/pedido
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processOrderMessage(messageData) {
    const { order } = messageData;
    
    return {
      type: MESSAGE_TYPES.ORDER,
      content: `Pedido: ${order?.catalog_id || 'Sin ID'}`,
      media_url: null,
      media_type: null,
      metadata: {
        order_data: order,
        catalog_id: order?.catalog_id,
        product_items: order?.product_items || [],
        text: order?.text
      }
    };
  }

  /**
   * Procesa mensaje genérico (tipo no específico)
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje procesado
   */
  processGenericMessage(messageData) {
    const { type } = messageData;
    
    return {
      type: type || MESSAGE_TYPES.SYSTEM,
      content: `Mensaje de tipo: ${type}`,
      media_url: null,
      media_type: null,
      metadata: {
        original_data: messageData,
        processed_as: 'generic'
      }
    };
  }

  /**
   * Crea mensaje para tipos no soportados
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje de error
   */
  createUnsupportedMessage(messageData) {
    const { type, id } = messageData;
    
    return {
      type: MESSAGE_TYPES.SYSTEM,
      content: `Tipo de mensaje no soportado: ${type}`,
      media_url: null,
      media_type: null,
      metadata: {
        error: 'unsupported_message_type',
        original_type: type,
        original_data: messageData,
        message_id: id
      }
    };
  }

  /**
   * Crea mensaje de error
   * @param {Object} messageData - Datos del mensaje
   * @param {Error} error - Error ocurrido
   * @returns {Object} Mensaje de error
   */
  createErrorMessage(messageData, error) {
    const { type, id } = messageData;
    
    return {
      type: MESSAGE_TYPES.SYSTEM,
      content: `Error procesando mensaje: ${error.message}`,
      media_url: null,
      media_type: null,
      metadata: {
        error: 'processing_error',
        error_message: error.message,
        original_type: type,
        original_data: messageData,
        message_id: id
      }
    };
  }

  /**
   * Valida si un tipo de mensaje es soportado
   * @param {string} type - Tipo de mensaje
   * @returns {boolean} True si es soportado
   */
  isMessageTypeSupported(type) {
    return this.supportedTypes.includes(type);
  }

  /**
   * Obtiene información sobre un tipo de mensaje
   * @param {string} type - Tipo de mensaje
   * @returns {Object} Información del tipo
   */
  getMessageTypeInfo(type) {
    const typeInfo = {
      [MESSAGE_TYPES.TEXT]: {
        name: 'Texto',
        description: 'Mensaje de texto simple',
        hasMedia: false,
        canHaveCaption: false
      },
      [MESSAGE_TYPES.IMAGE]: {
        name: 'Imagen',
        description: 'Imagen con caption opcional',
        hasMedia: true,
        canHaveCaption: true
      },
      [MESSAGE_TYPES.AUDIO]: {
        name: 'Audio',
        description: 'Archivo de audio o nota de voz',
        hasMedia: true,
        canHaveCaption: false
      },
      [MESSAGE_TYPES.VIDEO]: {
        name: 'Video',
        description: 'Video con caption opcional',
        hasMedia: true,
        canHaveCaption: true
      },
      [MESSAGE_TYPES.DOCUMENT]: {
        name: 'Documento',
        description: 'Archivo documento con caption opcional',
        hasMedia: true,
        canHaveCaption: true
      },
      [MESSAGE_TYPES.LOCATION]: {
        name: 'Ubicación',
        description: 'Ubicación geográfica',
        hasMedia: false,
        canHaveCaption: false
      },
      [MESSAGE_TYPES.CONTACT]: {
        name: 'Contacto',
        description: 'Información de contacto compartida',
        hasMedia: false,
        canHaveCaption: false
      },
      [MESSAGE_TYPES.INTERACTIVE]: {
        name: 'Interactivo',
        description: 'Respuesta a botones o listas',
        hasMedia: false,
        canHaveCaption: false
      },
      [MESSAGE_TYPES.TEMPLATE]: {
        name: 'Plantilla',
        description: 'Mensaje de plantilla aprobada',
        hasMedia: false,
        canHaveCaption: false
      },
      [MESSAGE_TYPES.STICKER]: {
        name: 'Sticker',
        description: 'Sticker o emoji grande',
        hasMedia: true,
        canHaveCaption: false
      },
      [MESSAGE_TYPES.REACTION]: {
        name: 'Reacción',
        description: 'Reacción emoji a un mensaje',
        hasMedia: false,
        canHaveCaption: false
      },
      [MESSAGE_TYPES.ORDER]: {
        name: 'Pedido',
        description: 'Pedido de productos del catálogo',
        hasMedia: false,
        canHaveCaption: false
      }
    };

    return typeInfo[type] || {
      name: 'Desconocido',
      description: 'Tipo de mensaje no reconocido',
      hasMedia: false,
      canHaveCaption: false
    };
  }

  /**
   * Obtiene estadísticas de tipos de mensajes procesados
   * @returns {Object} Estadísticas
   */
  getProcessingStats() {
    return {
      supported_types: this.supportedTypes.length,
      message_types: MESSAGE_TYPES,
      message_status: MESSAGE_STATUS
    };
  }
}

export default WhatsAppMessageHandler;
export { MESSAGE_TYPES, MESSAGE_STATUS };
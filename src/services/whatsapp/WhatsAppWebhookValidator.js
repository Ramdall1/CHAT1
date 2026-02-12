/**
 * WhatsApp Webhook Validator & Parser
 * Validación y parsing robusto de la estructura del webhook de WhatsApp Business Account
 * Implementa validaciones estrictas según la documentación oficial de WhatsApp
 */

import { createLogger } from '../core/core/logger.js';
import crypto from 'crypto';

const logger = createLogger('WHATSAPP_VALIDATOR');

export class WhatsAppWebhookValidator {
  constructor() {
    this.requiredFields = {
      webhook: ['object', 'entry'],
      entry: ['id', 'changes'],
      change: ['value', 'field'],
      value: ['messaging_product', 'metadata'],
      metadata: ['phone_number_id'],
      contact: ['wa_id'],
      message: ['id', 'from', 'timestamp', 'type']
    };
    
    this.validMessageTypes = [
      'text', 'image', 'audio', 'video', 'document', 
      'location', 'contacts', 'interactive', 'button', 
      'list_reply', 'sticker', 'reaction', 'system'
    ];
    
    this.validInteractiveTypes = [
      'button_reply', 'list_reply', 'flow_reply'
    ];
    
    this.validStatusTypes = [
      'sent', 'delivered', 'read', 'failed'
    ];
    
    this.validationErrors = [];
    this.warnings = [];
  }

  /**
   * Validar webhook completo de WhatsApp
   * @param {Object} payload - Payload del webhook
   * @param {Object} options - Opciones de validación
   * @returns {Object} Resultado de la validación
   */
  validateWebhook(payload, options = {}) {
    this.resetValidation();
    
    try {
      logger.debug('🔍 Iniciando validación del webhook de WhatsApp...');
      
      // Validación básica de estructura
      this.validateBasicStructure(payload);
      
      // Validación de objeto principal
      this.validateWebhookObject(payload);
      
      // Validación de entradas
      this.validateEntries(payload.entry);
      
      // Validación de firma si se proporciona
      if (options.signature && options.secret) {
        this.validateSignature(payload, options.signature, options.secret);
      }
      
      const isValid = this.validationErrors.length === 0;
      
      if (isValid) {
        logger.debug('✅ Webhook validado correctamente');
      } else {
        logger.warn(`⚠️ Webhook con errores: ${this.validationErrors.length} errores encontrados`);
      }
      
      return {
        isValid,
        errors: this.validationErrors,
        warnings: this.warnings,
        summary: this.generateValidationSummary(payload)
      };
      
    } catch (error) {
      logger.error('❌ Error durante la validación:', error.message);
      this.addError('VALIDATION_EXCEPTION', error.message);
      
      return {
        isValid: false,
        errors: this.validationErrors,
        warnings: this.warnings,
        exception: error.message
      };
    }
  }

  /**
   * Parsear webhook de WhatsApp a estructura normalizada
   * @param {Object} payload - Payload del webhook
   * @returns {Object} Estructura normalizada
   */
  parseWebhook(payload) {
    try {
      logger.debug('🔄 Parseando webhook de WhatsApp...');
      
      const parsed = {
        webhook_id: this.generateWebhookId(payload),
        object: payload.object,
        timestamp: new Date().toISOString(),
        entries: []
      };
      
      if (payload.entry && Array.isArray(payload.entry)) {
        for (const entry of payload.entry) {
          const parsedEntry = this.parseEntry(entry);
          parsed.entries.push(parsedEntry);
        }
      }
      
      logger.debug(`✅ Webhook parseado: ${parsed.entries.length} entradas procesadas`);
      
      // Extraer contactos y mensajes de todas las entradas para facilitar el acceso
      const flatData = this.flattenParsedData(parsed);
      
      return {
        ...parsed,
        contacts: flatData.contacts,
        messages: flatData.messages,
        statuses: flatData.statuses
      };
      
    } catch (error) {
      logger.error('❌ Error parseando webhook:', error.message);
      throw new Error(`Error parseando webhook: ${error.message}`);
    }
  }

  /**
   * Aplana los datos parseados para facilitar el acceso a contactos y mensajes
   * @param {Object} parsed - Datos parseados
   * @returns {Object} Datos aplanados
   */
  flattenParsedData(parsed) {
    const contacts = [];
    const messages = [];
    const statuses = [];

    for (const entry of parsed.entries) {
      for (const change of entry.changes) {
        if (change.contacts) {
          contacts.push(...change.contacts);
        }
        if (change.messages) {
          messages.push(...change.messages);
        }
        if (change.statuses) {
          statuses.push(...change.statuses);
        }
      }
    }

    return { contacts, messages, statuses };
  }

  /**
   * Validar estructura básica del webhook
   * @param {Object} payload - Payload del webhook
   */
  validateBasicStructure(payload) {
    if (!payload || typeof payload !== 'object') {
      this.addError('INVALID_PAYLOAD', 'El payload debe ser un objeto válido');
      return;
    }
    
    // Verificar campos requeridos del webhook
    this.validateRequiredFields(payload, this.requiredFields.webhook, 'webhook');
  }

  /**
   * Validar objeto principal del webhook
   * @param {Object} payload - Payload del webhook
   */
  validateWebhookObject(payload) {
    if (payload.object !== 'whatsapp_business_account') {
      this.addError('INVALID_OBJECT_TYPE', 
        `Tipo de objeto inválido: ${payload.object}. Esperado: whatsapp_business_account`);
    }
  }

  /**
   * Validar entradas del webhook
   * @param {Array} entries - Array de entradas
   */
  validateEntries(entries) {
    if (!Array.isArray(entries)) {
      this.addError('INVALID_ENTRIES', 'Las entradas deben ser un array');
      return;
    }
    
    if (entries.length === 0) {
      this.addWarning('EMPTY_ENTRIES', 'No hay entradas para procesar');
      return;
    }
    
    entries.forEach((entry, index) => {
      this.validateEntry(entry, index);
    });
  }

  /**
   * Validar entrada individual
   * @param {Object} entry - Entrada individual
   * @param {number} index - Índice de la entrada
   */
  validateEntry(entry, index) {
    const context = `entry[${index}]`;
    
    // Validar campos requeridos
    this.validateRequiredFields(entry, this.requiredFields.entry, context);
    
    // Validar ID de la cuenta de negocio
    if (entry.id && typeof entry.id !== 'string') {
      this.addError('INVALID_BUSINESS_ACCOUNT_ID', 
        `${context}: ID de cuenta de negocio debe ser string`);
    }
    
    // Validar cambios
    if (entry.changes && Array.isArray(entry.changes)) {
      entry.changes.forEach((change, changeIndex) => {
        this.validateChange(change, `${context}.changes[${changeIndex}]`);
      });
    }
  }

  /**
   * Validar cambio individual
   * @param {Object} change - Cambio individual
   * @param {string} context - Contexto para errores
   */
  validateChange(change, context) {
    // Validar campos requeridos
    this.validateRequiredFields(change, this.requiredFields.change, context);
    
    // Validar campo
    if (change.field !== 'messages') {
      this.addWarning('UNSUPPORTED_FIELD', 
        `${context}: Campo no soportado: ${change.field}`);
      return;
    }
    
    // Validar valor
    if (change.value) {
      this.validateChangeValue(change.value, `${context}.value`);
    }
  }

  /**
   * Validar valor del cambio
   * @param {Object} value - Valor del cambio
   * @param {string} context - Contexto para errores
   */
  validateChangeValue(value, context) {
    // Validar campos requeridos
    this.validateRequiredFields(value, this.requiredFields.value, context);
    
    // Validar producto de mensajería
    if (value.messaging_product !== 'whatsapp') {
      this.addError('INVALID_MESSAGING_PRODUCT', 
        `${context}: Producto de mensajería inválido: ${value.messaging_product}`);
    }
    
    // Validar metadatos
    if (value.metadata) {
      this.validateMetadata(value.metadata, `${context}.metadata`);
    }
    
    // Validar contactos
    if (value.contacts && Array.isArray(value.contacts)) {
      value.contacts.forEach((contact, index) => {
        this.validateContact(contact, `${context}.contacts[${index}]`);
      });
    }
    
    // Validar mensajes
    if (value.messages && Array.isArray(value.messages)) {
      value.messages.forEach((message, index) => {
        this.validateMessage(message, `${context}.messages[${index}]`);
      });
    }
    
    // Validar estados
    if (value.statuses && Array.isArray(value.statuses)) {
      value.statuses.forEach((status, index) => {
        this.validateStatus(status, `${context}.statuses[${index}]`);
      });
    }
  }

  /**
   * Validar metadatos
   * @param {Object} metadata - Metadatos
   * @param {string} context - Contexto para errores
   */
  validateMetadata(metadata, context) {
    this.validateRequiredFields(metadata, this.requiredFields.metadata, context);
    
    // Validar formato del phone_number_id
    if (metadata.phone_number_id && !/^\d+$/.test(metadata.phone_number_id)) {
      this.addError('INVALID_PHONE_NUMBER_ID', 
        `${context}: phone_number_id debe contener solo dígitos`);
    }
    
    // Validar formato del display_phone_number
    if (metadata.display_phone_number && !/^\+?\d+$/.test(metadata.display_phone_number)) {
      this.addWarning('INVALID_DISPLAY_PHONE_NUMBER', 
        `${context}: display_phone_number tiene formato inválido`);
    }
  }

  /**
   * Validar contacto
   * @param {Object} contact - Contacto
   * @param {string} context - Contexto para errores
   */
  validateContact(contact, context) {
    this.validateRequiredFields(contact, this.requiredFields.contact, context);
    
    // Validar wa_id
    if (contact.wa_id && !/^\d+$/.test(contact.wa_id)) {
      this.addError('INVALID_WA_ID', 
        `${context}: wa_id debe contener solo dígitos`);
    }
    
    // Validar perfil
    if (contact.profile) {
      if (contact.profile.name && typeof contact.profile.name !== 'string') {
        this.addError('INVALID_PROFILE_NAME', 
          `${context}: profile.name debe ser string`);
      }
    }
  }

  /**
   * Validar mensaje
   * @param {Object} message - Mensaje
   * @param {string} context - Contexto para errores
   */
  validateMessage(message, context) {
    this.validateRequiredFields(message, this.requiredFields.message, context);
    
    // Validar ID del mensaje
    if (message.id && typeof message.id !== 'string') {
      this.addError('INVALID_MESSAGE_ID', 
        `${context}: id debe ser string`);
    }
    
    // Validar número de origen
    if (message.from && !/^\d+$/.test(message.from)) {
      this.addError('INVALID_FROM_NUMBER', 
        `${context}: from debe contener solo dígitos`);
    }
    
    // Validar timestamp
    if (message.timestamp && !/^\d+$/.test(message.timestamp)) {
      this.addError('INVALID_TIMESTAMP', 
        `${context}: timestamp debe ser numérico`);
    }
    
    // Validar tipo de mensaje
    if (!this.validMessageTypes.includes(message.type)) {
      this.addWarning('UNSUPPORTED_MESSAGE_TYPE', 
        `${context}: Tipo de mensaje no soportado: ${message.type}`);
    }
    
    // Validar contenido según el tipo
    this.validateMessageContent(message, context);
  }

  /**
   * Validar contenido del mensaje según su tipo
   * @param {Object} message - Mensaje
   * @param {string} context - Contexto para errores
   */
  validateMessageContent(message, context) {
    const { type } = message;
    
    switch (type) {
      case 'text':
        if (!message.text || !message.text.body) {
          this.addError('MISSING_TEXT_BODY', 
            `${context}: Mensaje de texto debe tener text.body`);
        }
        break;
        
      case 'image':
        if (!message.image || !message.image.id) {
          this.addError('MISSING_IMAGE_ID', 
            `${context}: Mensaje de imagen debe tener image.id`);
        }
        break;
        
      case 'interactive':
        if (!message.interactive || !message.interactive.type) {
          this.addError('MISSING_INTERACTIVE_TYPE', 
            `${context}: Mensaje interactivo debe tener interactive.type`);
        } else if (!this.validInteractiveTypes.includes(message.interactive.type)) {
          this.addWarning('UNSUPPORTED_INTERACTIVE_TYPE', 
            `${context}: Tipo interactivo no soportado: ${message.interactive.type}`);
        }
        break;
        
      case 'location':
        if (!message.location || (!message.location.latitude || !message.location.longitude)) {
          this.addError('MISSING_LOCATION_COORDS', 
            `${context}: Mensaje de ubicación debe tener latitude y longitude`);
        }
        break;
    }
  }

  /**
   * Validar estado de mensaje
   * @param {Object} status - Estado
   * @param {string} context - Contexto para errores
   */
  validateStatus(status, context) {
    if (!status.id || !status.status) {
      this.addError('MISSING_STATUS_FIELDS', 
        `${context}: Estado debe tener id y status`);
    }
    
    if (status.status && !this.validStatusTypes.includes(status.status)) {
      this.addWarning('UNSUPPORTED_STATUS_TYPE', 
        `${context}: Tipo de estado no soportado: ${status.status}`);
    }
  }

  /**
   * Validar firma del webhook
   * @param {Object} payload - Payload del webhook
   * @param {string} signature - Firma recibida
   * @param {string} secret - Secreto para validación
   */
  validateSignature(payload, signature, secret) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      const receivedSignature = signature.replace('sha256=', '');
      
      if (expectedSignature !== receivedSignature) {
        this.addError('INVALID_SIGNATURE', 'Firma del webhook inválida');
      }
      
    } catch (error) {
      this.addError('SIGNATURE_VALIDATION_ERROR', 
        `Error validando firma: ${error.message}`);
    }
  }

  /**
   * Parsear entrada individual
   * @param {Object} entry - Entrada del webhook
   * @returns {Object} Entrada parseada
   */
  parseEntry(entry) {
    const parsed = {
      business_account_id: entry.id,
      changes: []
    };
    
    if (entry.changes && Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (change.field === 'messages' && change.value) {
          const parsedChange = this.parseMessagesChange(change.value);
          parsed.changes.push(parsedChange);
        }
      }
    }
    
    return parsed;
  }

  /**
   * Parsear cambio de mensajes
   * @param {Object} value - Valor del cambio
   * @returns {Object} Cambio parseado
   */
  parseMessagesChange(value) {
    return {
      messaging_product: value.messaging_product,
      metadata: {
        phone_number_id: value.metadata?.phone_number_id,
        display_phone_number: value.metadata?.display_phone_number
      },
      contacts: (value.contacts || []).map(contact => this.parseContact(contact)),
      messages: (value.messages || []).map(message => this.parseMessage(message)),
      statuses: (value.statuses || []).map(status => this.parseStatus(status))
    };
  }

  /**
   * Parsear contacto
   * @param {Object} contact - Contacto original
   * @returns {Object} Contacto parseado
   */
  parseContact(contact) {
    return {
      wa_id: contact.wa_id,
      profile: {
        name: contact.profile?.name || 'Usuario sin nombre'
      }
    };
  }

  /**
   * Parsear mensaje
   * @param {Object} message - Mensaje original
   * @returns {Object} Mensaje parseado
   */
  parseMessage(message) {
    return {
      id: message.id,
      from: message.from,
      timestamp: parseInt(message.timestamp),
      type: message.type,
      content: this.extractMessageContent(message),
      raw: message
    };
  }

  /**
   * Parsear estado
   * @param {Object} status - Estado original
   * @returns {Object} Estado parseado
   */
  parseStatus(status) {
    return {
      id: status.id,
      status: status.status,
      timestamp: status.timestamp ? parseInt(status.timestamp) : null,
      recipient_id: status.recipient_id
    };
  }

  /**
   * Extraer contenido del mensaje
   * @param {Object} message - Mensaje completo
   * @returns {string} Contenido extraído
   */
  extractMessageContent(message) {
    const { type } = message;
    
    switch (type) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return message.image?.caption || '[Imagen]';
      case 'audio':
        return '[Audio]';
      case 'video':
        return message.video?.caption || '[Video]';
      case 'document':
        return `[Documento: ${message.document?.filename || 'Sin nombre'}]`;
      case 'location':
        return `[Ubicación: ${message.location?.name || 'Ubicación compartida'}]`;
      case 'interactive':
        return this.extractInteractiveContent(message.interactive);
      default:
        return `[${type}]`;
    }
  }

  /**
   * Extraer contenido interactivo
   * @param {Object} interactive - Contenido interactivo
   * @returns {string} Contenido extraído
   */
  extractInteractiveContent(interactive) {
    if (!interactive) return '[Interactivo]';
    
    switch (interactive.type) {
      case 'button_reply':
        return interactive.button_reply?.title || '[Botón]';
      case 'list_reply':
        return interactive.list_reply?.title || '[Lista]';
      default:
        return `[Interactivo: ${interactive.type}]`;
    }
  }

  /**
   * Validar campos requeridos
   * @param {Object} obj - Objeto a validar
   * @param {Array} requiredFields - Campos requeridos
   * @param {string} context - Contexto para errores
   */
  validateRequiredFields(obj, requiredFields, context) {
    for (const field of requiredFields) {
      if (!obj || obj[field] === undefined || obj[field] === null) {
        this.addError('MISSING_REQUIRED_FIELD', 
          `${context}: Campo requerido faltante: ${field}`);
      }
    }
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
   * Generar resumen de validación
   * @param {Object} payload - Payload del webhook
   * @returns {Object} Resumen
   */
  generateValidationSummary(payload) {
    const summary = {
      entries_count: payload.entry?.length || 0,
      total_messages: 0,
      total_contacts: 0,
      total_statuses: 0,
      message_types: new Set(),
      business_accounts: new Set()
    };
    
    if (payload.entry) {
      for (const entry of payload.entry) {
        summary.business_accounts.add(entry.id);
        
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.value) {
              const value = change.value;
              
              if (value.messages) {
                summary.total_messages += value.messages.length;
                value.messages.forEach(msg => summary.message_types.add(msg.type));
              }
              
              if (value.contacts) {
                summary.total_contacts += value.contacts.length;
              }
              
              if (value.statuses) {
                summary.total_statuses += value.statuses.length;
              }
            }
          }
        }
      }
    }
    
    return {
      ...summary,
      message_types: Array.from(summary.message_types),
      business_accounts: Array.from(summary.business_accounts)
    };
  }

  /**
   * Agregar error de validación
   * @param {string} code - Código del error
   * @param {string} message - Mensaje del error
   */
  addError(code, message) {
    this.validationErrors.push({ code, message, type: 'error' });
    logger.warn(`❌ Error de validación [${code}]: ${message}`);
  }

  /**
   * Agregar advertencia de validación
   * @param {string} code - Código de la advertencia
   * @param {string} message - Mensaje de la advertencia
   */
  addWarning(code, message) {
    this.warnings.push({ code, message, type: 'warning' });
    logger.debug(`⚠️ Advertencia de validación [${code}]: ${message}`);
  }

  /**
   * Resetear estado de validación
   */
  resetValidation() {
    this.validationErrors = [];
    this.warnings = [];
  }
}

// Instancia singleton
export const whatsAppWebhookValidator = new WhatsAppWebhookValidator();

export default WhatsAppWebhookValidator;
/**
 * Message Utils - Utilidades Consolidadas de Mensajes
 * Reemplaza todas las funciones duplicadas de envío de mensajes
 * Estilo Manychat unificado y mejorado
 */

import { unified360DialogService } from '../../../../services/core/core/Unified360DialogService.js';
import logger from '../../../../services/core/core/logger.js';
import { Persuader } from '../../../../../apps/api/src/ai/persuader.js';

/**
 * Clase de utilidades de mensajes consolidada
 */
export class MessageUtils {
  constructor() {
    this.service = unified360DialogService;
    this.persuader = null;
  }

  /**
     * Inicializar persuader de IA
     */
  async initializePersuader() {
    if (!this.persuader) {
      try {
        this.persuader = new Persuader();
      } catch (error) {
        logger.warn('⚠️ Persuader not available, using fallback messages');
      }
    }
  }

  /**
     * Enviar mensaje de texto simple
     * Reemplaza: enviarMensajeTexto()
     */
  async sendTextMessage(to, text, options = {}) {
    try {
      logger.info(`📩 Sending text message to ${to}: ${text.substring(0, 50)}...`);
            
      const result = await this.service.sendTextMessage(to, text, options);
            
      if (result.success) {
        logger.info(`✅ Text message sent successfully to ${to}`);
        return {
          success: true,
          messageId: result.messageId,
          status: result.status,
          data: result.data
        };
      } else {
        throw new Error(result.error || 'Unknown error');
      }
            
    } catch (error) {
      logger.error(`❌ Failed to send text message to ${to}:`, error.message);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
     * Enviar mensaje de agradecimiento personalizado
     * Reemplaza: enviarMensajeAgradecimiento()
     */
  async sendThankYouMessage(to, customerData = {}) {
    try {
      await this.initializePersuader();
            
      let message;
            
      // Intentar generar mensaje personalizado con IA
      if (this.persuader) {
        try {
          message = this.persuader.generarMensajeAgradecimiento(customerData);
        } catch (error) {
          logger.warn('⚠️ Persuader failed, using fallback message');
          message = this.generateFallbackThankYouMessage(customerData);
        }
      } else {
        message = this.generateFallbackThankYouMessage(customerData);
      }
            
      const result = await this.service.sendThankYouMessage(to, customerData);
            
      if (result.success) {
        logger.info(`✅ Thank you message sent to ${to}`);
        return {
          success: true,
          message: 'Thank you message sent successfully',
          data: result,
          messageText: message
        };
      } else {
        throw new Error(result.error || 'Error sending thank you message');
      }
            
    } catch (error) {
      logger.error('❌ Error sending thank you message:', error.message);
            
      // Fallback a mensaje básico
      try {
        const fallbackMessage = '¡Gracias por tu interés! Te contactaremos pronto. 😊';
        await this.sendTextMessage(to, fallbackMessage);
                
        return {
          success: true,
          message: 'Fallback thank you message sent',
          messageText: fallbackMessage
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: fallbackError.message
        };
      }
    }
  }

  /**
     * Generar mensaje de agradecimiento de respaldo
     */
  generateFallbackThankYouMessage(customerData) {
    const { name = '', email = '', phone = '' } = customerData;
        
    return `¡Gracias ${name ? name : 'por tu interés'}! 🙏

Hemos recibido tu información correctamente:
${email ? `📧 Email: ${email}` : ''}
${phone ? `📱 Teléfono: ${phone}` : ''}

Te contactaremos pronto con más detalles. ¡Estamos emocionados de tenerte con nosotros! 🎉`;
  }

  /**
     * Enviar información de pago
     * Reemplaza: enviarInformacionPago()
     */
  async sendPaymentInfo(to, paymentMethod = 'nequi') {
    try {
      const result = await this.service.sendPaymentInfo(to, paymentMethod);
            
      if (result.success) {
        logger.info(`✅ Payment info sent to ${to} for method: ${paymentMethod}`);
        return {
          success: true,
          message: 'Payment information sent successfully',
          paymentMethod,
          data: result
        };
      } else {
        throw new Error(result.error || 'Error sending payment info');
      }
            
    } catch (error) {
      logger.error(`❌ Error sending payment info to ${to}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Enviar mensaje de seguimiento
     * Reemplaza: enviarMensajeSeguimiento()
     */
  async sendFollowUpMessage(to, contactName = '') {
    try {
      const followUpMessage = `Hola ${contactName ? contactName : 'amigo/a'} 👋

Esperamos que estés muy bien. Queríamos hacer un seguimiento sobre tu interés en nuestro programa.

¿Tienes alguna pregunta adicional que podamos resolver? Estamos aquí para ayudarte en todo lo que necesites.

¡Esperamos saber de ti pronto! 😊`;

      const result = await this.sendTextMessage(to, followUpMessage);
            
      if (result.success) {
        logger.info(`✅ Follow-up message sent to ${to}`);
        return {
          success: true,
          message: 'Follow-up message sent successfully',
          contactName,
          data: result
        };
      } else {
        throw new Error(result.error || 'Error sending follow-up message');
      }
            
    } catch (error) {
      logger.error(`❌ Error sending follow-up message to ${to}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Enviar confirmación de números asignados
     * Reemplaza: enviarConfirmacionNumeros()
     */
  async sendNumberConfirmation(to, contactData, assignedNumbers) {
    try {
      const { name = 'Cliente' } = contactData;
      const numbersText = Array.isArray(assignedNumbers) 
        ? assignedNumbers.join(', ') 
        : assignedNumbers.toString();
            
      const confirmationMessage = `🎉 ¡Excelente, ${name}!

Tu participación ha sido confirmada exitosamente. 

📋 **Detalles de tu participación:**
🔢 Números asignados: ${numbersText}
📅 Fecha de registro: ${new Date().toLocaleDateString('es-CO')}
✅ Estado: Confirmado

¡Te deseamos mucha suerte! Estaremos en contacto para cualquier novedad.

¿Tienes alguna pregunta sobre tu participación? 🤔`;

      const result = await this.sendTextMessage(to, confirmationMessage);
            
      if (result.success) {
        logger.info(`✅ Number confirmation sent to ${to}`);
        return {
          success: true,
          message: 'Number confirmation sent successfully',
          assignedNumbers,
          data: result
        };
      } else {
        throw new Error(result.error || 'Error sending confirmation');
      }
            
    } catch (error) {
      logger.error(`❌ Error sending number confirmation to ${to}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Enviar mensaje con botones interactivos
     * Nueva funcionalidad estilo Manychat
     */
  async sendInteractiveButtons(to, text, buttons, options = {}) {
    try {
      const result = await this.service.sendInteractiveButtons(to, text, buttons, options);
            
      if (result.success) {
        logger.info(`✅ Interactive buttons sent to ${to}`);
        return {
          success: true,
          message: 'Interactive buttons sent successfully',
          buttonsCount: buttons.length,
          data: result
        };
      } else {
        throw new Error(result.error || 'Error sending interactive buttons');
      }
            
    } catch (error) {
      logger.error(`❌ Error sending interactive buttons to ${to}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Enviar lista interactiva
     * Nueva funcionalidad estilo Manychat
     */
  async sendInteractiveList(to, text, buttonText, sections, options = {}) {
    try {
      const result = await this.service.sendInteractiveList(to, text, buttonText, sections, options);
            
      if (result.success) {
        logger.info(`✅ Interactive list sent to ${to}`);
        return {
          success: true,
          message: 'Interactive list sent successfully',
          sectionsCount: sections.length,
          data: result
        };
      } else {
        throw new Error(result.error || 'Error sending interactive list');
      }
            
    } catch (error) {
      logger.error(`❌ Error sending interactive list to ${to}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Enviar mensaje de bienvenida personalizado
     * Nueva funcionalidad mejorada
     */
  async sendWelcomeMessage(to, customerData = {}) {
    try {
      const { name = 'amigo/a' } = customerData;
            
      const welcomeButtons = [
        { id: 'info', title: '📋 Más información' },
        { id: 'participate', title: '🎯 Quiero participar' },
        { id: 'contact', title: '📞 Contactar' }
      ];
            
      const welcomeText = `¡Hola ${name}! 👋 Bienvenido/a

Nos alegra mucho tenerte aquí. Estamos emocionados de poder ayudarte y ofrecerte la mejor experiencia posible.

¿En qué podemos ayudarte hoy?`;

      return await this.sendInteractiveButtons(to, welcomeText, welcomeButtons);
            
    } catch (error) {
      logger.error(`❌ Error sending welcome message to ${to}:`, error.message);
            
      // Fallback a mensaje de texto simple
      const fallbackMessage = `¡Hola ${customerData.name || 'amigo/a'}! 👋 Bienvenido/a. ¿En qué podemos ayudarte hoy?`;
      return await this.sendTextMessage(to, fallbackMessage);
    }
  }

  /**
     * Enviar mensaje de error amigable
     * Nueva funcionalidad
     */
  async sendErrorMessage(to, errorType = 'general') {
    try {
      const errorMessages = {
        general: 'Lo sentimos, ha ocurrido un error temporal. Por favor intenta nuevamente en unos minutos. 🔄',
        payment: 'Hubo un problema procesando la información de pago. Por favor verifica los datos e intenta nuevamente. 💳',
        validation: 'Algunos datos no son válidos. Por favor revisa la información e intenta nuevamente. ✏️',
        network: 'Problemas de conexión detectados. Estamos trabajando para solucionarlo. ⚡',
        maintenance: 'Estamos realizando mantenimiento del sistema. Estaremos de vuelta pronto. 🔧'
      };
            
      const message = errorMessages[errorType] || errorMessages.general;
            
      return await this.sendTextMessage(to, message);
            
    } catch (error) {
      logger.error(`❌ Error sending error message to ${to}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Obtener métricas del servicio de mensajes
     */
  getMetrics() {
    return this.service.getMetrics();
  }

  /**
     * Verificar estado del servicio
     */
  async checkServiceHealth() {
    try {
      return await this.service.healthCheck();
    } catch (error) {
      logger.error('❌ Service health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Funciones de conveniencia para compatibilidad hacia atrás
export const messageUtils = new MessageUtils();

// Exportar funciones individuales para compatibilidad
export const enviarMensajeTexto = (to, text, options) => messageUtils.sendTextMessage(to, text, options);
export const enviarMensajeAgradecimiento = (to, data) => messageUtils.sendThankYouMessage(to, data);
export const enviarInformacionPago = (to, method) => messageUtils.sendPaymentInfo(to, method);
export const enviarMensajeSeguimiento = (to, name) => messageUtils.sendFollowUpMessage(to, name);
export const enviarConfirmacionNumeros = (to, data, numbers) => messageUtils.sendNumberConfirmation(to, data, numbers);

// Nuevas funciones mejoradas
export const sendInteractiveButtons = (to, text, buttons, options) => messageUtils.sendInteractiveButtons(to, text, buttons, options);
export const sendInteractiveList = (to, text, buttonText, sections, options) => messageUtils.sendInteractiveList(to, text, buttonText, sections, options);
export const sendWelcomeMessage = (to, data) => messageUtils.sendWelcomeMessage(to, data);
export const sendErrorMessage = (to, type) => messageUtils.sendErrorMessage(to, type);

export default MessageUtils;
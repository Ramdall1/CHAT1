/**
 * @fileoverview Integración con 360Dialog API
 * 
 * Maneja la comunicación con la API de 360Dialog para:
 * - Configuración de webhooks
 * - Envío de mensajes
 * - Gestión de plantillas
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import axios from 'axios';
import { createLogger } from '../../services/core/core/logger.js';

const logger = createLogger('DIALOG360_INTEGRATION');

class Dialog360Integration {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.D360_API_KEY;
    this.phoneNumberId = config.phoneNumberId || process.env.D360_PHONE_NUMBER_ID;
    this.baseUrl = config.baseUrl || process.env.D360_API_BASE || 'https://waba-v2.360dialog.io';
    this.webhookUrl = config.webhookUrl;
    this.webhookVerifyToken = config.webhookVerifyToken || process.env.WEBHOOK_VERIFY_TOKEN || 'webhook_token';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'D360-API-KEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Configurar webhook en 360Dialog
   * 
   * @param {Object} config - Configuración del webhook
   * @param {string} config.url - URL del webhook
   * @param {string} config.verify_token - Token de verificación (opcional)
   * @param {Object} config.headers - Headers personalizados para el webhook (opcional)
   */
  async configureWebhook(config = {}) {
    try {
      const url = config.url || this.webhookUrl;
      const verifyToken = config.verify_token || this.webhookVerifyToken;
      const customHeaders = config.headers || {};

      if (!url) {
        throw new Error('URL del webhook es requerida');
      }

      logger.info(`🔧 Configurando webhook en 360Dialog...`);
      logger.info(`   URL: ${url}`);
      if (Object.keys(customHeaders).length > 0) {
        logger.info(`   Headers personalizados: ${Object.keys(customHeaders).join(', ')}`);
      }

      // Construir body del webhook
      // NOTA: 360Dialog API solo acepta 'url' y 'headers', NO acepta 'verify_token'
      const webhookBody = {
        url: url
      };

      // Agregar headers personalizados si están disponibles
      if (Object.keys(customHeaders).length > 0) {
        webhookBody.headers = customHeaders;
      }

      logger.debug('📦 Body del webhook:', JSON.stringify(webhookBody));

      const response = await this.client.post(`/v1/configs/webhook`, webhookBody);

      logger.info('✅ Webhook configurado correctamente en 360Dialog');
      return {
        success: true,
        data: response.data,
        message: 'Webhook configurado correctamente'
      };

    } catch (error) {
      logger.error('❌ Error configurando webhook:', error.message);
      
      // Log detallado del error
      if (error.response) {
        logger.error('   Status:', error.response.status);
        logger.error('   Data:', JSON.stringify(error.response.data));
      }
      
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Obtener configuración actual del webhook
   */
  async getWebhookConfig() {
    try {
      logger.info('🔍 Obteniendo configuración actual del webhook...');
      const response = await this.client.get('/v1/configs/webhook');
      
      logger.info('✅ Configuración del webhook obtenida correctamente');
      return {
        success: true,
        data: response.data,
        message: 'Configuración obtenida correctamente'
      };
    } catch (error) {
      logger.error('❌ Error obteniendo configuración del webhook:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Enviar mensaje de texto
   */
  async sendMessage(phoneNumber, message) {
    try {
      const response = await this.client.post(`/v1/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: {
          body: message
        }
      });

      return {
        success: true,
        messageId: response.data.messages[0].id
      };
    } catch (error) {
      logger.error('❌ Error enviando mensaje:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener plantillas
   */
  async getTemplates() {
    try {
      const response = await this.client.get(`/v1/message_templates`);
      return {
        success: true,
        templates: response.data.waba_templates || []
      };
    } catch (error) {
      logger.error('❌ Error obteniendo plantillas:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener flows desde Hub API
   */
  async getFlows() {
    try {
      const hubApiBase = process.env.D360_HUB_API_BASE || 'https://hub.360dialog.io';
      const partnerId = process.env.D360_PARTNER_ID;
      const wabaAccountId = process.env.D360_WABA_ACCOUNT_ID;
      const hubApiKey = process.env.D360_API_KEY;

      if (!partnerId || !wabaAccountId) {
        throw new Error('Partner ID y WABA Account ID son requeridos');
      }

      const hubClient = axios.create({
        baseURL: hubApiBase,
        headers: {
          'D360-API-KEY': hubApiKey,
          'Content-Type': 'application/json'
        }
      });

      const response = await hubClient.get(
        `/api/v2/partners/${partnerId}/waba_accounts/${wabaAccountId}/flows`
      );

      return {
        success: true,
        flows: response.data.flows || [],
        count: response.data.count || 0
      };
    } catch (error) {
      logger.error('❌ Error obteniendo flows:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Validar webhook
   */
  validateWebhook(token) {
    return token === this.webhookVerifyToken;
  }
}

export default Dialog360Integration;

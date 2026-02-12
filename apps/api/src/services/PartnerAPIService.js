/**
 * Partner API Service
 *
 * Servicio para gestionar la creación automatizada de WABA (WhatsApp Business Account)
 * y la integración con el Partner API de 360dialog
 */

import axios from 'axios';
import { CONFIG } from '../core/config.js';
import logger from '../utils/logger.js';

export class PartnerAPIService {
  constructor() {
    this.partnerApiBase =
      process.env.D360_PARTNER_API_BASE || 'https://partner-api.360dialog.io';
    this.partnerId = process.env.D360_PARTNER_ID;
    this.partnerApiKey = process.env.D360_PARTNER_API_KEY;

    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.partnerApiKey}`,
      'X-Partner-ID': this.partnerId,
    };

    // Validar configuración requerida
    if (!this.partnerId || !this.partnerApiKey) {
      logger.warn(
        'Partner API no configurado completamente. Algunas funciones no estarán disponibles.'
      );
    }
  }

  /**
   * Crear una nueva cuenta WABA
   */
  async createWABAAccount(clientData) {
    try {
      const payload = {
        business_name: clientData.businessName,
        business_email: clientData.businessEmail,
        business_phone: clientData.businessPhone,
        business_website: clientData.businessWebsite,
        business_description: clientData.businessDescription,
        business_category: clientData.businessCategory || 'OTHER',
        timezone: clientData.timezone || 'America/Mexico_City',
        locale: clientData.locale || 'es_MX',
        webhook_url: clientData.webhookUrl,
        webhook_verify_token: clientData.webhookVerifyToken,
      };

      const response = await axios.post(
        `${this.partnerApiBase}/v1/waba/accounts`,
        payload,
        { headers: this.headers }
      );

      logger.info(
        `WABA account created successfully for ${clientData.businessName}`,
        {
          wabaId: response.data.waba_id,
          clientEmail: clientData.businessEmail,
        }
      );

      return {
        success: true,
        data: {
          wabaId: response.data.waba_id,
          accountId: response.data.account_id,
          phoneNumberId: response.data.phone_number_id,
          namespace: response.data.namespace,
          status: response.data.status,
          createdAt: response.data.created_at,
        },
      };
    } catch (error) {
      logger.error('Error creating WABA account:', {
        error: error.message,
        response: error.response?.data,
        clientData: clientData.businessEmail,
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status || 500,
      };
    }
  }

  /**
   * Obtener información de una cuenta WABA
   */
  async getWABAAccount(wabaId) {
    try {
      const response = await axios.get(
        `${this.partnerApiBase}/v1/waba/accounts/${wabaId}`,
        { headers: this.headers }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Error getting WABA account:', {
        error: error.message,
        wabaId,
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status || 500,
      };
    }
  }

  /**
   * Listar todas las cuentas WABA del partner
   */
  async listWABAAccounts(filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);

      const response = await axios.get(
        `${this.partnerApiBase}/v1/waba/accounts?${params.toString()}`,
        { headers: this.headers }
      );

      return {
        success: true,
        data: response.data.accounts,
        pagination: response.data.pagination,
      };
    } catch (error) {
      logger.error('Error listing WABA accounts:', {
        error: error.message,
        filters,
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status || 500,
      };
    }
  }

  /**
   * Actualizar configuración de una cuenta WABA
   */
  async updateWABAAccount(wabaId, updateData) {
    try {
      const response = await axios.patch(
        `${this.partnerApiBase}/v1/waba/accounts/${wabaId}`,
        updateData,
        { headers: this.headers }
      );

      logger.info(`WABA account updated successfully: ${wabaId}`, updateData);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Error updating WABA account:', {
        error: error.message,
        wabaId,
        updateData,
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status || 500,
      };
    }
  }

  /**
   * Eliminar una cuenta WABA
   */
  async deleteWABAAccount(wabaId) {
    try {
      await axios.delete(`${this.partnerApiBase}/v1/waba/accounts/${wabaId}`, {
        headers: this.headers,
      });

      logger.info(`WABA account deleted successfully: ${wabaId}`);

      return {
        success: true,
        message: 'WABA account deleted successfully',
      };
    } catch (error) {
      logger.error('Error deleting WABA account:', {
        error: error.message,
        wabaId,
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status || 500,
      };
    }
  }

  /**
   * Crear un canal de WhatsApp para una cuenta WABA
   */
  async createWhatsAppChannel(wabaId, channelData) {
    try {
      const payload = {
        waba_id: wabaId,
        phone_number: channelData.phoneNumber,
        display_name: channelData.displayName,
        webhook_url: channelData.webhookUrl,
        webhook_verify_token: channelData.webhookVerifyToken,
      };

      const response = await axios.post(
        `${this.partnerApiBase}/v1/waba/channels`,
        payload,
        { headers: this.headers }
      );

      logger.info(`WhatsApp channel created successfully for WABA: ${wabaId}`, {
        channelId: response.data.channel_id,
        phoneNumber: channelData.phoneNumber,
      });

      return {
        success: true,
        data: {
          channelId: response.data.channel_id,
          phoneNumberId: response.data.phone_number_id,
          status: response.data.status,
          createdAt: response.data.created_at,
        },
      };
    } catch (error) {
      logger.error('Error creating WhatsApp channel:', {
        error: error.message,
        wabaId,
        phoneNumber: channelData.phoneNumber,
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status || 500,
      };
    }
  }

  /**
   * Obtener métricas de uso de una cuenta WABA
   */
  async getWABAMetrics(wabaId, dateRange = {}) {
    try {
      const params = new URLSearchParams();

      if (dateRange.startDate) params.append('start_date', dateRange.startDate);
      if (dateRange.endDate) params.append('end_date', dateRange.endDate);

      const response = await axios.get(
        `${this.partnerApiBase}/v1/waba/accounts/${wabaId}/metrics?${params.toString()}`,
        { headers: this.headers }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Error getting WABA metrics:', {
        error: error.message,
        wabaId,
        dateRange,
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status || 500,
      };
    }
  }

  /**
   * Verificar el estado del Partner API
   */
  async checkPartnerAPIStatus() {
    try {
      const response = await axios.get(`${this.partnerApiBase}/health_status`, {
        headers: this.headers,
      });

      return {
        success: true,
        status: 'healthy',
        data: response.data,
      };
    } catch (error) {
      logger.error('Partner API health check failed:', error.message);

      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Configurar webhook para eventos del Partner API
   */
  async configurePartnerWebhook(webhookConfig) {
    try {
      const payload = {
        url: webhookConfig.url,
        verify_token: webhookConfig.verifyToken,
        events: webhookConfig.events || [
          'waba.created',
          'waba.updated',
          'waba.deleted',
          'channel.created',
          'channel.updated',
          'channel.deleted',
        ],
      };

      const response = await axios.post(
        `${this.partnerApiBase}/v1/webhooks`,
        payload,
        { headers: this.headers }
      );

      logger.info('Partner webhook configured successfully', {
        webhookId: response.data.webhook_id,
        url: webhookConfig.url,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Error configuring partner webhook:', {
        error: error.message,
        webhookConfig,
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status || 500,
      };
    }
  }
}

export default new PartnerAPIService();

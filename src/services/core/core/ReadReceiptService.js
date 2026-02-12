/**
 * ReadReceiptService.js
 * Servicio para marcar mensajes como leídos en WhatsApp (doble check azul)
 */

import axios from 'axios';
import logger from './logger.js';
import { unified360DialogService } from './Unified360DialogService.js';

class ReadReceiptService {
  constructor() {
    this.baseUrl = unified360DialogService.baseUrl;
    this.apiKey = unified360DialogService.apiKey;
    this.logger = logger;
  }

  /**
   * Marcar un mensaje como leído en WhatsApp (doble check azul)
   * @param {string} messageId - ID del mensaje de WhatsApp a marcar como leído
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async markMessageAsRead(messageId) {
    try {
      if (!messageId) {
        throw new Error('Message ID is required');
      }

      this.logger.info(`🔵 Marcando mensaje como leído: ${messageId}`);

      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/v1/messages/${messageId}/read`,
        headers: {
          'D360-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        data: {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        }
      });

      this.logger.info(`✅ Mensaje marcado como leído: ${messageId}`, {
        status: response.status,
        statusText: response.statusText
      });

      return {
        success: true,
        messageId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`❌ Error marcando mensaje como leído: ${messageId}`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      throw new Error(`Failed to mark message as read: ${error.message}`);
    }
  }

  /**
   * Marcar múltiples mensajes como leídos
   * @param {string[]} messageIds - Array de IDs de mensajes
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async markMessagesAsRead(messageIds) {
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      throw new Error('Valid message IDs array is required');
    }

    const results = {
      success: [],
      failed: []
    };

    for (const messageId of messageIds) {
      try {
        await this.markMessageAsRead(messageId);
        results.success.push(messageId);
      } catch (error) {
        results.failed.push({
          messageId,
          error: error.message
        });
      }
    }

    return {
      success: results.success.length > 0,
      totalProcessed: messageIds.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      results
    };
  }
}

// Exportar instancia singleton
export const readReceiptService = new ReadReceiptService();
export default ReadReceiptService;

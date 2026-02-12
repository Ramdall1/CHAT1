/**
 * Partner API Routes
 *
 * Rutas para gestionar la creación automatizada de WABA y Partner API
 */

import express from 'express';
import PartnerAPIService from '../services/PartnerAPIService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route POST /api/partner/waba/create
 * @desc Crear una nueva cuenta WABA
 */
router.post('/waba/create', async (req, res) => {
  try {
    const {
      businessName,
      businessEmail,
      businessPhone,
      businessWebsite,
      businessDescription,
      businessCategory,
      timezone,
      locale,
      webhookUrl,
      webhookVerifyToken,
    } = req.body;

    // Validaciones básicas
    if (!businessName || !businessEmail || !businessPhone) {
      return res.status(400).json({
        success: false,
        error: 'businessName, businessEmail y businessPhone son requeridos',
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(businessEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de email inválido',
      });
    }

    const clientData = {
      businessName,
      businessEmail,
      businessPhone,
      businessWebsite,
      businessDescription,
      businessCategory,
      timezone,
      locale,
      webhookUrl,
      webhookVerifyToken,
    };

    const result = await PartnerAPIService.createWABAAccount(clientData);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(result.code || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in POST /api/partner/waba/create:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route GET /api/partner/waba/:wabaId
 * @desc Obtener información de una cuenta WABA
 */
router.get('/waba/:wabaId', async (req, res) => {
  try {
    const { wabaId } = req.params;

    if (!wabaId) {
      return res.status(400).json({
        success: false,
        error: 'wabaId es requerido',
      });
    }

    const result = await PartnerAPIService.getWABAAccount(wabaId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.code || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in GET /api/partner/waba/:wabaId:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route GET /api/partner/waba
 * @desc Listar todas las cuentas WABA
 */
router.get('/waba', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const filters = {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const result = await PartnerAPIService.listWABAAccounts(filters);

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.code || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in GET /api/partner/waba:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route PATCH /api/partner/waba/:wabaId
 * @desc Actualizar configuración de una cuenta WABA
 */
router.patch('/waba/:wabaId', async (req, res) => {
  try {
    const { wabaId } = req.params;
    const updateData = req.body;

    if (!wabaId) {
      return res.status(400).json({
        success: false,
        error: 'wabaId es requerido',
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Datos de actualización requeridos',
      });
    }

    const result = await PartnerAPIService.updateWABAAccount(
      wabaId,
      updateData
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.code || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in PATCH /api/partner/waba/:wabaId:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route DELETE /api/partner/waba/:wabaId
 * @desc Eliminar una cuenta WABA
 */
router.delete('/waba/:wabaId', async (req, res) => {
  try {
    const { wabaId } = req.params;

    if (!wabaId) {
      return res.status(400).json({
        success: false,
        error: 'wabaId es requerido',
      });
    }

    const result = await PartnerAPIService.deleteWABAAccount(wabaId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.code || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in DELETE /api/partner/waba/:wabaId:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route POST /api/partner/waba/:wabaId/channels
 * @desc Crear un canal de WhatsApp para una cuenta WABA
 */
router.post('/waba/:wabaId/channels', async (req, res) => {
  try {
    const { wabaId } = req.params;
    const { phoneNumber, displayName, webhookUrl, webhookVerifyToken } =
      req.body;

    if (!wabaId || !phoneNumber || !displayName) {
      return res.status(400).json({
        success: false,
        error: 'wabaId, phoneNumber y displayName son requeridos',
      });
    }

    const channelData = {
      phoneNumber,
      displayName,
      webhookUrl,
      webhookVerifyToken,
    };

    const result = await PartnerAPIService.createWhatsAppChannel(
      wabaId,
      channelData
    );

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(result.code || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in POST /api/partner/waba/:wabaId/channels:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route GET /api/partner/waba/:wabaId/metrics
 * @desc Obtener métricas de uso de una cuenta WABA
 */
router.get('/waba/:wabaId/metrics', async (req, res) => {
  try {
    const { wabaId } = req.params;
    const { startDate, endDate } = req.query;

    if (!wabaId) {
      return res.status(400).json({
        success: false,
        error: 'wabaId es requerido',
      });
    }

    const dateRange = {
      startDate,
      endDate,
    };

    const result = await PartnerAPIService.getWABAMetrics(wabaId, dateRange);

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.code || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in GET /api/partner/waba/:wabaId/metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route GET /api/partner/health
 * @desc Verificar el estado del Partner API
 */
router.get('/health', async (req, res) => {
  try {
    const result = await PartnerAPIService.checkPartnerAPIStatus();

    if (result.success) {
      res.json(result);
    } else {
      res.status(503).json(result);
    }
  } catch (error) {
    logger.error('Error in GET /api/partner/health:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route POST /api/partner/webhooks/configure
 * @desc Configurar webhook para eventos del Partner API
 */
router.post('/webhooks/configure', async (req, res) => {
  try {
    const { url, verifyToken, events } = req.body;

    if (!url || !verifyToken) {
      return res.status(400).json({
        success: false,
        error: 'url y verifyToken son requeridos',
      });
    }

    // Validar formato de URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Formato de URL inválido',
      });
    }

    const webhookConfig = {
      url,
      verifyToken,
      events,
    };

    const result =
      await PartnerAPIService.configurePartnerWebhook(webhookConfig);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(result.code || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in POST /api/partner/webhooks/configure:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

/**
 * @route POST /api/partner/webhooks/events
 * @desc Recibir eventos del Partner API
 */
router.post('/webhooks/events', async (req, res) => {
  try {
    const event = req.body;

    logger.info('Partner API webhook event received:', {
      eventType: event.type,
      eventId: event.id,
      timestamp: event.timestamp,
    });

    // Procesar diferentes tipos de eventos
    switch (event.type) {
      case 'waba.created':
        logger.info('New WABA account created:', {
          wabaId: event.data.waba_id,
          businessName: event.data.business_name,
        });
        break;

      case 'waba.updated':
        logger.info('WABA account updated:', {
          wabaId: event.data.waba_id,
          changes: event.data.changes,
        });
        break;

      case 'waba.deleted':
        logger.info('WABA account deleted:', {
          wabaId: event.data.waba_id,
        });
        break;

      case 'channel.created':
        logger.info('WhatsApp channel created:', {
          channelId: event.data.channel_id,
          wabaId: event.data.waba_id,
          phoneNumber: event.data.phone_number,
        });
        break;

      case 'channel.updated':
        logger.info('WhatsApp channel updated:', {
          channelId: event.data.channel_id,
          changes: event.data.changes,
        });
        break;

      case 'channel.deleted':
        logger.info('WhatsApp channel deleted:', {
          channelId: event.data.channel_id,
        });
        break;

      default:
        logger.warn('Unknown Partner API event type:', event.type);
    }

    res.status(200).json({
      success: true,
      message: 'Event processed successfully',
    });
  } catch (error) {
    logger.error('Error processing Partner API webhook event:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando evento',
    });
  }
});

export default router;

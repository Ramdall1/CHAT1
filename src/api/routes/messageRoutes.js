/**
 * Message Routes - ChatBot Enterprise
 * Rutas para envío de mensajes WhatsApp
 * @version 5.1.0
 */

import express from 'express';
import { unified360DialogService } from '../../services/core/core/Unified360DialogService.js';
import logger from '../../services/core/core/logger.js';

const router = express.Router();

// Usar el servicio unificado de 360Dialog
const getDialogService = () => {
  return unified360DialogService;
};

// Middleware de validación básica
const validateMessageRequest = (req, res, next) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros requeridos faltantes: to, message'
    });
  }

  // Validar formato del número de teléfono
  const phoneRegex = /^\d{10,15}$/;
  if (!phoneRegex.test(to.replace(/^\+/, ''))) {
    return res.status(400).json({
      success: false,
      error: 'Formato de número de teléfono inválido'
    });
  }

  next();
};

// POST /api/whatsapp/send - Enviar mensaje WhatsApp
router.post('/send', validateMessageRequest, async (req, res) => {
  try {
    const { to, message, type = 'text' } = req.body;

    logger.info('Enviando mensaje WhatsApp', { to, type, messageLength: message.length });

    // Usar el servicio de 360Dialog
    const service = getDialogService();
    const result = await service.sendTextMessage(to, message);

    logger.info('Mensaje WhatsApp enviado exitosamente', { messageId: result.messageId });

    res.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
      timestamp: new Date().toISOString(),
      recipient: to
    });

  } catch (error) {
    logger.error('Error enviando mensaje WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/v1/messages - Endpoint alternativo para envío de mensajes
router.post('/', validateMessageRequest, async (req, res) => {
  try {
    const { to, message, type = 'text' } = req.body;

    logger.info('Enviando mensaje vía API v1', { to, type, messageLength: message.length });

    const service = getDialogService();
    const result = await service.sendTextMessage(to, message);

    logger.info('Mensaje enviado exitosamente vía API v1', { messageId: result.messageId });

    res.json({
      success: true,
      data: {
        messageId: result.messageId,
        status: result.status,
        recipient: to,
        timestamp: new Date().toISOString(),
        type: type
      }
    });

  } catch (error) {
    logger.error('Error enviando mensaje vía API v1:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'MESSAGE_SEND_FAILED'
    });
  }
});

// GET /api/whatsapp/status/:messageId - Verificar estado de mensaje
router.get('/status/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    logger.info('Consultando estado de mensaje', { messageId });

    const service = getDialogService();
    const status = await service.getMessageStatus(messageId);

    res.json({
      success: true,
      messageId,
      status: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error consultando estado de mensaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// GET /test - Endpoint de prueba para verificar rutas
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Rutas de mensajería funcionando correctamente',
    timestamp: new Date().toISOString(),
    endpoints: {
      send: 'POST /send',
      messages: 'POST /',
      status: 'GET /status/:messageId',
      test: 'GET /test'
    }
  });
});

export default router;
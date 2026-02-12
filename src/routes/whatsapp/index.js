/**
 * @fileoverview Rutas de WhatsApp/360Dialog
 * 
 * Módulo que maneja todas las rutas relacionadas con WhatsApp y 360Dialog,
 * extraído del archivo server.js monolítico para mejorar la modularidad.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import express from 'express';
import axios from 'axios';
import { createLogger } from '../../services/core/core/logger.js';

const logger = createLogger('WHATSAPP');

const router = express.Router();

/**
 * Configuración de WhatsApp/360Dialog
 */
const WHATSAPP_CONFIG = {
  API_URL: process.env.WHATSAPP_API_URL || 'https://waba.360dialog.io',
  API_KEY: process.env.WHATSAPP_API_KEY,
  PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'mi_token_secreto'
};

/**
 * GET /api/whatsapp/webhook
 * Verificación del webhook de WhatsApp
 */
router.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === WHATSAPP_CONFIG.WEBHOOK_VERIFY_TOKEN) {
        logger.info('Webhook de WhatsApp verificado exitosamente');
        res.status(200).send(challenge);
      } else {
        logger.warn('Token de verificación inválido para webhook de WhatsApp');
        res.sendStatus(403);
      }
    } else {
      logger.warn('Parámetros de verificación faltantes en webhook de WhatsApp');
      res.sendStatus(400);
    }
  } catch (error) {
    logger.error('Error en verificación de webhook:', error);
    res.sendStatus(500);
  }
});

/**
 * POST /api/whatsapp/webhook
 * Recepción de mensajes de WhatsApp
 */
router.post('/webhook', (req, res) => {
  try {
    const body = req.body;

    if (body.object) {
      if (body.entry && 
          body.entry[0].changes && 
          body.entry[0].changes[0] && 
          body.entry[0].changes[0].value.messages && 
          body.entry[0].changes[0].value.messages[0]) {
        
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const messageBody = message.text?.body || '';

        logger.info(`Mensaje recibido de ${from}: ${messageBody}`);

        // Aquí se procesaría el mensaje con el chatbot
        // Por ahora solo registramos el evento
        
        res.status(200).send('EVENT_RECEIVED');
      } else {
        res.status(404).send('NOT_FOUND');
      }
    } else {
      res.status(404).send('NOT_FOUND');
    }
  } catch (error) {
    logger.error('Error procesando webhook de WhatsApp:', error);
    res.status(500).send('INTERNAL_ERROR');
  }
});

/**
 * POST /api/whatsapp/send-message
 * Envío de mensajes a través de WhatsApp
 */
router.post('/send-message', async (req, res) => {
  try {
    const { to, message, type = 'text' } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Destinatario y mensaje son requeridos'
      });
    }

    if (!WHATSAPP_CONFIG.API_KEY || !WHATSAPP_CONFIG.PHONE_NUMBER_ID) {
      return res.status(500).json({
        success: false,
        error: 'Configuración de WhatsApp incompleta'
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: type,
      text: {
        body: message
      }
    };

    const response = await axios.post(
      `${WHATSAPP_CONFIG.API_URL}/v1/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`Mensaje enviado exitosamente a ${to}`);

    res.json({
      success: true,
      data: {
        messageId: response.data.messages[0].id,
        status: 'sent'
      }
    });

  } catch (error) {
    logger.error('Error enviando mensaje de WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando mensaje',
      details: error.response?.data || error.message
    });
  }
});

/**
 * GET /api/whatsapp/status
 * Estado de la conexión con WhatsApp
 */
router.get('/status', async (req, res) => {
  try {
    if (!WHATSAPP_CONFIG.API_KEY || !WHATSAPP_CONFIG.PHONE_NUMBER_ID) {
      return res.json({
        success: false,
        status: 'not_configured',
        message: 'WhatsApp API no configurada'
      });
    }

    // Verificar conectividad con la API de WhatsApp
    try {
      const response = await axios.get(
        `${WHATSAPP_CONFIG.API_URL}/v1/health`,
        {
          headers: {
            'Authorization': `Bearer ${WHATSAPP_CONFIG.API_KEY}`
          },
          timeout: 5000
        }
      );

      res.json({
        success: true,
        status: 'connected',
        message: 'WhatsApp API conectada',
        phoneNumberId: WHATSAPP_CONFIG.PHONE_NUMBER_ID
      });

    } catch (apiError) {
      res.json({
        success: false,
        status: 'disconnected',
        message: 'Error conectando con WhatsApp API',
        error: apiError.message
      });
    }

  } catch (error) {
    logger.error('Error verificando estado de WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/whatsapp/send-template
 * Envío de mensajes template de WhatsApp
 */
router.post('/send-template', async (req, res) => {
  try {
    const { to, templateName, language = 'es', parameters = [] } = req.body;

    if (!to || !templateName) {
      return res.status(400).json({
        success: false,
        error: 'Destinatario y nombre del template son requeridos'
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: language
        },
        components: parameters.length > 0 ? [{
          type: 'body',
          parameters: parameters.map(param => ({
            type: 'text',
            text: param
          }))
        }] : []
      }
    };

    const response = await axios.post(
      `${WHATSAPP_CONFIG.API_URL}/v1/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`Template ${templateName} enviado exitosamente a ${to}`);

    res.json({
      success: true,
      data: {
        messageId: response.data.messages[0].id,
        status: 'sent',
        template: templateName
      }
    });

  } catch (error) {
    logger.error('Error enviando template de WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando template',
      details: error.response?.data || error.message
    });
  }
});

export default router;
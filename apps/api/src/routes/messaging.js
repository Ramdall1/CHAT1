/**
 * Router de mensajería unificado para 360dialog
 * Consolida todas las operaciones de envío de mensajes
 * Reemplaza completamente enviarMensajeTexto.js
 */

import express from 'express';
import { unified360DialogService } from '../../../../src/services/core/core/Unified360DialogService.js';
import { messageUtils } from '../../../../src/shared/utils/helpers/helpers/MessageUtils.js';
import { createLocalDB } from '../core/localDB.js';
import { log } from '../core/logger.js';

const router = express.Router();
const db = createLocalDB();

// POST /api/messaging/send-text - Enviar mensaje de texto
router.post('/send-text', async (req, res) => {
  try {
    const { to, text } = req.body;

    if (!to || !text) {
      return res.status(400).json({ error: 'Faltan parámetros: to, text' });
    }

    const result = await unified360DialogService.sendTextMessage(to, text);

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', text, 'text');

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando mensaje de texto: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messaging/send-template - Enviar template
router.post('/send-template', async (req, res) => {
  try {
    const { to, templateName, languageCode = 'es', components = [] } = req.body;

    if (!to || !templateName) {
      return res
        .status(400)
        .json({ error: 'Faltan parámetros: to, templateName' });
    }

    const result = await unified360DialogService.sendTemplate(
      to,
      templateName,
      { languageCode, components }
    );

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', `Template: ${templateName}`, 'template');

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando template: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messaging/send-interactive - Enviar mensaje interactivo
router.post('/send-interactive', async (req, res) => {
  try {
    const { to, interactive } = req.body;

    if (!to || !interactive) {
      return res
        .status(400)
        .json({ error: 'Faltan parámetros: to, interactive' });
    }

    const result = await unified360DialogService.sendInteractiveMessage(
      to,
      interactive
    );

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', 'Mensaje interactivo', 'interactive');

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando mensaje interactivo: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messaging/send-media - Enviar media
router.post('/send-media', async (req, res) => {
  try {
    const { to, mediaType, mediaId, caption = '' } = req.body;

    if (!to || !mediaType || !mediaId) {
      return res
        .status(400)
        .json({ error: 'Faltan parámetros: to, mediaType, mediaId' });
    }

    const result = await unified360DialogService.sendMediaMessage(
      to,
      mediaType,
      mediaId,
      caption
    );

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', caption || `Media: ${mediaType}`, mediaType);

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando media: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messaging/upload-media - Subir media
router.post('/upload-media', async (req, res) => {
  try {
    const { mediaBuffer, mimeType } = req.body;

    if (!mediaBuffer || !mimeType) {
      return res
        .status(400)
        .json({ error: 'Faltan parámetros: mediaBuffer, mimeType' });
    }

    const result = await unified360DialogService.uploadMedia(
      mediaBuffer,
      mimeType
    );

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error subiendo media: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/messaging/templates - Obtener templates disponibles
router.get('/templates', async (req, res) => {
  try {
    const templates = await unified360DialogService.getTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    log(`❌ Error obteniendo templates: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ENDPOINTS ESPECIALIZADOS DE NEGOCIO
// Reemplazan las funciones de enviarMensajeTexto.js
// ========================================

// POST /api/messaging/send-thank-you - Enviar mensaje de agradecimiento
router.post('/send-thank-you', async (req, res) => {
  try {
    const { to, customerData = {} } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Falta parámetro: to' });
    }

    const result = await messageUtils.sendThankYouMessage(to, customerData);

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', 'Mensaje de agradecimiento', 'thank_you');

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando mensaje de agradecimiento: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messaging/send-payment-info - Enviar información de pago
router.post('/send-payment-info', async (req, res) => {
  try {
    const { to, paymentMethod = 'nequi' } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Falta parámetro: to' });
    }

    const result = await messageUtils.sendPaymentInfo(to, paymentMethod);

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', `Información de pago: ${paymentMethod}`, 'payment_info');

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando información de pago: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messaging/send-follow-up - Enviar mensaje de seguimiento
router.post('/send-follow-up', async (req, res) => {
  try {
    const { to, contactName = '' } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Falta parámetro: to' });
    }

    const result = await messageUtils.sendFollowUpMessage(to, contactName);

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', 'Mensaje de seguimiento', 'follow_up');

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando mensaje de seguimiento: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messaging/send-number-confirmation - Enviar confirmación de números
router.post('/send-number-confirmation', async (req, res) => {
  try {
    const { to, contactData = {}, assignedNumbers = [] } = req.body;

    if (!to || !assignedNumbers.length) {
      return res.status(400).json({ error: 'Faltan parámetros: to, assignedNumbers' });
    }

    const result = await messageUtils.sendNumberConfirmation(to, contactData, assignedNumbers);

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', `Confirmación de números: ${assignedNumbers.join(', ')}`, 'number_confirmation');

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando confirmación de números: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messaging/send-welcome - Enviar mensaje de bienvenida
router.post('/send-welcome', async (req, res) => {
  try {
    const { to, customerData = {} } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Falta parámetro: to' });
    }

    const result = await messageUtils.sendWelcomeMessage(to, customerData);

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', 'Mensaje de bienvenida', 'welcome');

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando mensaje de bienvenida: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messaging/send-error - Enviar mensaje de error
router.post('/send-error', async (req, res) => {
  try {
    const { to, errorType = 'general' } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Falta parámetro: to' });
    }

    const result = await messageUtils.sendErrorMessage(to, errorType);

    // Registrar en base de datos local
    db.addMessage(to, 'outgoing', `Mensaje de error: ${errorType}`, 'error');

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error enviando mensaje de error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/messaging/health - Estado del servicio de mensajería
router.get('/health', async (req, res) => {
  try {
    const health = await messageUtils.checkServiceHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    log(`❌ Error verificando salud del servicio: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/messaging/metrics - Métricas del servicio de mensajería
router.get('/metrics', async (req, res) => {
  try {
    const metrics = messageUtils.getMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    log(`❌ Error obteniendo métricas: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;

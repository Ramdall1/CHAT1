/**
 * Rutas para Gestión de Media
 * Integración con 360Dialog
 */

import express from 'express';
import mediaManager from '../services/MediaManager.js';
import { createLogger } from '../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('MEDIA_ROUTES');

/**
 * Descargar media desde 360Dialog
 * POST /media/download
 */
router.post('/download', async (req, res) => {
  try {
    const { mediaId, mediaType, phone, contactId } = req.body;

    if (!mediaId || !mediaType || !phone || !contactId) {
      return res.status(400).json({
        success: false,
        error: 'mediaId, mediaType, phone y contactId son requeridos'
      });
    }

    const result = await mediaManager.downloadMediaFrom360Dialog(
      mediaId,
      mediaType,
      phone,
      contactId
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Media descargado correctamente',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error descargando media:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtener media por contacto
 * GET /media/contact/:contactId
 */
router.get('/contact/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const media = await mediaManager.getMediaByContact(parseInt(contactId));

    res.json({
      success: true,
      data: media,
      count: media.length
    });
  } catch (error) {
    logger.error('Error obteniendo media:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtener media por teléfono
 * GET /media/phone/:phone
 */
router.get('/phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const media = await mediaManager.getMediaByPhone(phone);

    res.json({
      success: true,
      data: media,
      count: media.length
    });
  } catch (error) {
    logger.error('Error obteniendo media:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtener media por tipo
 * GET /media/contact/:contactId/type/:type
 */
router.get('/contact/:contactId/type/:type', async (req, res) => {
  try {
    const { contactId, type } = req.params;
    const media = await mediaManager.getMediaByType(parseInt(contactId), type);

    res.json({
      success: true,
      data: media,
      count: media.length
    });
  } catch (error) {
    logger.error('Error obteniendo media:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Enviar media a contacto
 * POST /media/send
 */
router.post('/send', async (req, res) => {
  try {
    const { phone, mediaId, mediaType, caption } = req.body;

    if (!phone || !mediaId || !mediaType) {
      return res.status(400).json({
        success: false,
        error: 'phone, mediaId y mediaType son requeridos'
      });
    }

    const result = await mediaManager.sendMediaToContact(
      phone,
      mediaId,
      mediaType,
      caption || ''
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Media enviado correctamente',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error enviando media:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtener estadísticas de media
 * GET /media/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await mediaManager.getStats();
    res.json(result);
  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Limpiar media antiguo
 * POST /media/cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { daysToKeep } = req.body;
    await mediaManager.cleanOldMedia(daysToKeep || 30);

    res.json({
      success: true,
      message: 'Media antiguo limpiado correctamente'
    });
  } catch (error) {
    logger.error('Error limpiando media:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

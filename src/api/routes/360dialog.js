/**
 * 360Dialog Routes - ChatBot Enterprise
 * Rutas para integración con 360Dialog API
 * @version 1.0.0
 */

import express from 'express';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('360DIALOG_ROUTES');

/**
 * GET /api/360dialog/status - Estado del servicio 360Dialog
 */
router.get('/status', (req, res) => {
  try {
    logger.info('Endpoint /api/360dialog/status llamado');

    const apiKey = process.env.D360_API_KEY;
    const phoneNumberId = process.env.D360_PHONE_NUMBER_ID;
    const baseUrl = process.env.D360_API_BASE || 'https://waba.360dialog.io';
    const webhookUrl = process.env.D360_WEBHOOK_URL || `${req.protocol}://${req.get('host')}/api/webhooks/360dialog`;
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

    const status = {
      service: '360Dialog',
      status: apiKey && phoneNumberId ? 'configured' : 'not_configured',
      connected: !!(apiKey && phoneNumberId),
      configured: !!(apiKey && phoneNumberId),
      lastCheck: new Date().toISOString(),
      baseUrl: baseUrl,
      webhookUrl: webhookUrl,
      webhookConfigured: true, // Webhooks work without verification tokens
      environment: {
        D360_API_KEY: !!apiKey,
        D360_PHONE_NUMBER_ID: !!phoneNumberId,
        D360_API_BASE: !!process.env.D360_API_BASE,
        D360_WEBHOOK_URL: !!process.env.D360_WEBHOOK_URL,
        WEBHOOK_VERIFY_TOKEN: 'not_required', // No longer needed
        WEBHOOK_SECRET: 'not_required' // No longer needed
      },
      message: (apiKey && phoneNumberId)
        ? 'Servicio 360Dialog configurado y disponible - Webhooks sin verificación'
        : 'Servicio 360Dialog requiere configuración de D360_API_KEY y D360_PHONE_NUMBER_ID'
    };

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting 360Dialog status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/360dialog/templates - Obtener plantillas reales de 360Dialog API
 */
router.get('/templates', async (req, res) => {
  try {
    logger.info('Endpoint /api/360dialog/templates llamado - obteniendo plantillas reales de 360Dialog');
    
    const DIALOG360_API_KEY = process.env.D360_API_KEY;
    const WABA_API_BASE = process.env.D360_API_BASE || 'https://waba-v2.360dialog.io';
    
    if (!DIALOG360_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'API Key de 360Dialog no configurada'
      });
    }

    // Obtener plantillas reales de 360Dialog
    const response = await fetch(`${WABA_API_BASE}/v1/configs/templates`, {
      method: 'GET',
      headers: {
        'D360-API-KEY': DIALOG360_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Error de 360Dialog API:', errorText);
      return res.status(response.status).json({
        success: false,
        error: 'Error al obtener plantillas de 360Dialog',
        details: errorText
      });
    }

    const data = await response.json();
    const templates = data.waba_templates || [];
    
    logger.info(`Plantillas obtenidas de 360Dialog: ${templates.length}`);

    res.json({ 
      success: true, 
      templates: templates,
      data: templates,
      count: templates.length,
      total: templates.length,
      message: 'Plantillas 360Dialog cargadas correctamente',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting 360Dialog templates:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


/**
 * GET /api/360dialog/webhook-status - Consultar configuración actual del webhook en 360Dialog
 */
router.get('/webhook-status', async (req, res) => {
  try {
    logger.info('Endpoint /api/360dialog/webhook-status llamado - consultando configuración actual');

    // Importar Dialog360Integration para consultar configuración
    const { default: Dialog360Integration } = await import('../../integrations/360dialog/Dialog360Integration.js');

    const dialog360 = new Dialog360Integration({
      apiKey: process.env.D360_API_KEY,
      phoneNumberId: process.env.D360_PHONE_NUMBER_ID,
      baseUrl: process.env.D360_API_BASE || 'https://waba.360dialog.io'
    });

    // Intentar consultar la configuración actual del webhook
    // Nota: 360Dialog API puede no tener endpoint para consultar configuración actual
    // Esta es una aproximación basada en la documentación disponible

    try {
      // Intentar hacer una petición GET al endpoint de configuración
      const response = await dialog360.httpClient.get('/v1/configs/webhook');

      const webhookStatus = {
        service: '360Dialog',
        configured: true,
        currentUrl: response.data?.url || 'No disponible en respuesta',
        status: 'active',
        lastChecked: new Date().toISOString(),
        apiResponse: response.data
      };

      res.json({
        success: true,
        data: webhookStatus,
        message: 'Configuración de webhook consultada exitosamente'
      });

    } catch (apiError) {
      // Si la API no soporta consulta, devolver información basada en configuración local
      logger.warn('No se pudo consultar configuración vía API, usando datos locales');

      const webhookStatus = {
        service: '360Dialog',
        configured: false,
        currentUrl: 'No se puede consultar vía API',
        status: 'unknown',
        lastChecked: new Date().toISOString(),
        note: '360Dialog API puede no soportar consulta de configuración de webhook',
        localConfig: {
          expectedUrl: `${process.env.NGROK_URL}/api/webhooks/360dialog`,
          verifyToken: process.env.WEBHOOK_VERIFY_TOKEN ? 'configured' : 'missing'
        },
        apiError: apiError.message
      };

      res.json({
        success: true,
        data: webhookStatus,
        message: 'Información basada en configuración local (API no disponible)'
      });
    }

  } catch (error) {
    logger.error('Error consultando webhook status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      note: 'Error interno consultando configuración de webhook'
    });
  }
});

/**
 * POST /api/360dialog/configure-webhook - Configurar webhook en 360Dialog
 * 
 * Body esperado:
 * {
 *   "url": "https://tu-webhook-url.com",
 *   "verify_token": "token-opcional",
 *   "headers": { "Authorization": "Basic dGVzdA==" },
 *   "apiKey": "tu-api-key-opcional"
 * }
 */
router.post('/configure-webhook', async (req, res) => {
  try {
    const { url, verify_token, headers, apiKey } = req.body;
    
    logger.info('🔧 Endpoint /api/360dialog/configure-webhook llamado');
    logger.info(`   URL: ${url}`);
    logger.info(`   Verify Token: ${verify_token ? '***' : 'no proporcionado'}`);
    if (headers && Object.keys(headers).length > 0) {
      logger.info(`   Headers personalizados: ${Object.keys(headers).join(', ')}`);
    }

    // Validar parámetros requeridos
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL del webhook es requerida',
        required: ['url'],
        optional: ['verify_token', 'headers', 'apiKey']
      });
    }

    // Usar API Key proporcionada o la del .env
    const D360_API_KEY = apiKey || process.env.D360_API_KEY;
    
    if (!D360_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'API Key de 360Dialog no disponible',
        hint: 'Proporciona apiKey en el body o configura D360_API_KEY en .env'
      });
    }

    // Importar Dialog360Integration
    const { default: Dialog360Integration } = await import('../../integrations/360dialog/Dialog360Integration.js');

    const dialog360 = new Dialog360Integration({
      apiKey: D360_API_KEY,
      phoneNumberId: process.env.D360_PHONE_NUMBER_ID,
      baseUrl: process.env.D360_API_BASE || 'https://waba-v2.360dialog.io',
      webhookUrl: url,
      webhookVerifyToken: verify_token || process.env.WEBHOOK_VERIFY_TOKEN
    });

    // Intentar configurar webhook con headers personalizados si se proporcionan
    const result = await dialog360.configureWebhook({
      url: url,
      verify_token: verify_token || process.env.WEBHOOK_VERIFY_TOKEN,
      headers: headers || {}
    });

    if (result.success) {
      logger.info('✅ Webhook configurado correctamente');
      res.json({
        success: true,
        message: 'Webhook configurado correctamente en 360Dialog',
        data: result.data,
        webhookUrl: url
      });
    } else {
      logger.warn('⚠️ Error configurando webhook:', result.error);
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        hint: 'Verifica que la API Key sea válida y que el endpoint sea correcto'
      });
    }

  } catch (error) {
    logger.error('Error en configure-webhook:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      note: 'Error interno configurando webhook'
    });
  }
});

/**
 * GET /api/360dialog/flows - Obtener flows de 360Dialog API
 */
router.get('/flows', async (req, res) => {
  try {
    logger.info('Endpoint /api/360dialog/flows llamado - obteniendo flows de 360Dialog');
    
    const DIALOG360_API_KEY = process.env.D360_API_KEY;
    const HUB_API_BASE = process.env.D360_HUB_API_BASE || 'https://hub.360dialog.io';
    const PARTNER_ID = process.env.D360_PARTNER_ID;
    const WABA_ACCOUNT_ID = process.env.D360_WABA_ACCOUNT_ID;
    
    if (!DIALOG360_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'API Key de 360Dialog no configurada'
      });
    }

    if (!PARTNER_ID || !WABA_ACCOUNT_ID) {
      return res.status(500).json({
        success: false,
        error: 'Partner ID o WABA Account ID no configurados',
        required: ['D360_PARTNER_ID', 'D360_WABA_ACCOUNT_ID']
      });
    }

    // Obtener flows reales de 360Dialog Hub API
    const flowsUrl = `${HUB_API_BASE}/api/v2/partners/${PARTNER_ID}/waba_accounts/${WABA_ACCOUNT_ID}/flows`;
    
    logger.info(`Solicitando flows desde: ${flowsUrl}`);

    const response = await fetch(flowsUrl, {
      method: 'GET',
      headers: {
        'x-api-key': DIALOG360_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Error de 360Dialog API:', errorText);
      return res.status(response.status).json({
        success: false,
        error: 'Error al obtener flows de 360Dialog',
        details: errorText,
        statusCode: response.status
      });
    }

    const data = await response.json();
    const flows = data.flows || data.data || [];
    
    logger.info(`Flows obtenidos de 360Dialog: ${flows.length}`);

    res.json({ 
      success: true, 
      flows: flows,
      data: flows,
      count: flows.length,
      total: flows.length,
      message: 'Flows 360Dialog cargados correctamente',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting 360Dialog flows:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/360dialog/health - Health check específico para 360Dialog
 */
router.get('/health', (req, res) => {
  try {
    logger.info('Endpoint /api/360dialog/health llamado');

    const health = {
      service: '360Dialog',
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    logger.error('Error getting 360Dialog health:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

logger.info('✅ Rutas de 360Dialog configuradas');

export default router;
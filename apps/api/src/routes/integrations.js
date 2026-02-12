import express from 'express';
import ThirdPartyIntegrationService from '../services/ThirdPartyIntegrationService.js';

const router = express.Router();
const integrationService = new ThirdPartyIntegrationService();

// Middleware para validar API key
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key requerida',
      });
    }

    const validation = await integrationService.validateApiKey(apiKey);

    if (!validation.valid) {
      const status = validation.reason === 'Rate limit excedido' ? 429 : 401;
      const response = {
        success: false,
        error: validation.reason,
      };

      if (validation.retryAfter) {
        res.set('Retry-After', validation.retryAfter);
        response.retryAfter = validation.retryAfter;
      }

      return res.status(status).json(response);
    }

    req.apiKeyData = validation.keyData;
    next();
  } catch (error) {
    console.error('Error validando API key:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
};

// Middleware para verificar permisos
const checkPermission = permission => {
  return (req, res, next) => {
    if (
      !req.apiKeyData.permissions.includes(permission) &&
      !req.apiKeyData.permissions.includes('admin')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes',
      });
    }
    next();
  };
};

// Inicializar servicio
integrationService.initialize().catch(console.error);

// === RUTAS PÚBLICAS (sin autenticación) ===

// Información de la API
router.get('/info', (req, res) => {
  res.json({
    success: true,
    api: {
      name: 'ChatBot Integration API',
      version: '1.0.0',
      description: 'API para integraciones de terceros',
      endpoints: {
        auth: '/api/integrations/auth',
        webhooks: '/api/integrations/webhooks',
        data: '/api/integrations/data',
        sync: '/api/integrations/sync',
      },
      documentation: '/api/integrations/docs',
    },
  });
});

// Documentación de la API
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    documentation: {
      authentication: {
        method: 'API Key',
        header: 'X-API-Key',
        description:
          'Incluir API key en el header X-API-Key o como parámetro api_key',
      },
      endpoints: {
        'GET /info': 'Información de la API',
        'POST /auth/api-keys': 'Crear nueva API key (requiere admin)',
        'GET /auth/api-keys': 'Listar API keys (requiere admin)',
        'DELETE /auth/api-keys/:key': 'Revocar API key (requiere admin)',
        'POST /webhooks': 'Registrar webhook (requiere write)',
        'GET /webhooks': 'Listar webhooks (requiere read)',
        'DELETE /webhooks/:id': 'Eliminar webhook (requiere write)',
        'POST /webhooks/test': 'Probar webhook (requiere write)',
        'POST /integrations': 'Crear integración (requiere write)',
        'GET /integrations': 'Listar integraciones (requiere read)',
        'POST /integrations/:id/sync':
          'Sincronizar integración (requiere write)',
        'GET /data/messages': 'Obtener mensajes (requiere read)',
        'POST /data/messages': 'Enviar mensaje (requiere write)',
        'GET /data/analytics': 'Obtener analytics (requiere read)',
        'GET /stats': 'Estadísticas del sistema (requiere read)',
      },
      permissions: ['read', 'write', 'admin'],
      rateLimit: 'Por defecto: 1000 requests por hora',
      webhookEvents: [
        'message.received',
        'message.sent',
        'user.created',
        'conversation.started',
        'conversation.ended',
        'error.occurred',
      ],
    },
  });
});

// === RUTAS DE AUTENTICACIÓN ===

// Crear API key (solo para administradores)
router.post('/auth/api-keys', async (req, res) => {
  try {
    // Verificar si es una solicitud administrativa (requiere token especial)
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({
        success: false,
        error: 'Token de administrador requerido',
      });
    }

    const result = await integrationService.createApiKey(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error creando API key:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Listar API keys
router.get(
  '/auth/api-keys',
  validateApiKey,
  checkPermission('admin'),
  async (req, res) => {
    try {
      const result = await integrationService.listApiKeys();
      res.json(result);
    } catch (error) {
      console.error('Error listando API keys:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Revocar API key
router.delete(
  '/auth/api-keys/:key',
  validateApiKey,
  checkPermission('admin'),
  async (req, res) => {
    try {
      const result = await integrationService.revokeApiKey(req.params.key);
      res.json(result);
    } catch (error) {
      console.error('Error revocando API key:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// === RUTAS DE WEBHOOKS ===

// Registrar webhook
router.post(
  '/webhooks',
  validateApiKey,
  checkPermission('write'),
  async (req, res) => {
    try {
      const result = await integrationService.registerWebhook(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error registrando webhook:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Listar webhooks
router.get(
  '/webhooks',
  validateApiKey,
  checkPermission('read'),
  async (req, res) => {
    try {
      const result = await integrationService.listWebhooks();
      res.json(result);
    } catch (error) {
      console.error('Error listando webhooks:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Eliminar webhook
router.delete(
  '/webhooks/:id',
  validateApiKey,
  checkPermission('write'),
  async (req, res) => {
    try {
      const result = await integrationService.deleteWebhook(req.params.id);
      res.json(result);
    } catch (error) {
      console.error('Error eliminando webhook:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Probar webhook
router.post(
  '/webhooks/test',
  validateApiKey,
  checkPermission('write'),
  async (req, res) => {
    try {
      const { event = 'test', data = {} } = req.body;
      const result = await integrationService.triggerWebhook(event, {
        ...data,
        test: true,
        timestamp: new Date().toISOString(),
      });
      res.json(result);
    } catch (error) {
      console.error('Error probando webhook:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// === RUTAS DE INTEGRACIONES ===

// Crear integración
router.post(
  '/integrations',
  validateApiKey,
  checkPermission('write'),
  async (req, res) => {
    try {
      const result = await integrationService.createIntegration(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error creando integración:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Listar integraciones
router.get(
  '/integrations',
  validateApiKey,
  checkPermission('read'),
  async (req, res) => {
    try {
      const integrations = Array.from(integrationService.integrations.values());
      res.json({
        success: true,
        integrations,
      });
    } catch (error) {
      console.error('Error listando integraciones:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Obtener integración específica
router.get(
  '/integrations/:id',
  validateApiKey,
  checkPermission('read'),
  async (req, res) => {
    try {
      const integration = integrationService.integrations.get(req.params.id);

      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integración no encontrada',
        });
      }

      res.json({
        success: true,
        integration,
      });
    } catch (error) {
      console.error('Error obteniendo integración:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Sincronizar integración
router.post(
  '/integrations/:id/sync',
  validateApiKey,
  checkPermission('write'),
  async (req, res) => {
    try {
      const result = await integrationService.syncIntegration(
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error sincronizando integración:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// === RUTAS DE DATOS ===

// Obtener mensajes
router.get(
  '/data/messages',
  validateApiKey,
  checkPermission('read'),
  async (req, res) => {
    try {
      const { limit = 50, offset = 0, from, to, phone, type } = req.query;

      // Simular obtención de mensajes (integrar con tu sistema de mensajes)
      const messages = [
        {
          id: '1',
          phone: '+1234567890',
          message: 'Hola, ¿cómo estás?',
          type: 'received',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ];

      res.json({
        success: true,
        messages,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: messages.length,
        },
      });
    } catch (error) {
      console.error('Error obteniendo mensajes:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Enviar mensaje
router.post(
  '/data/messages',
  validateApiKey,
  checkPermission('write'),
  async (req, res) => {
    try {
      const { phone, message, type = 'text', metadata = {} } = req.body;

      if (!phone || !message) {
        return res.status(400).json({
          success: false,
          error: 'Teléfono y mensaje son requeridos',
        });
      }

      // Simular envío de mensaje (integrar con tu sistema de mensajes)
      const messageData = {
        id: Date.now().toString(),
        phone,
        message,
        type,
        metadata,
        timestamp: new Date().toISOString(),
        status: 'sent',
      };

      // Disparar webhook
      await integrationService.triggerWebhook('message.sent', messageData);

      res.json({
        success: true,
        message: messageData,
      });
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Obtener analytics
router.get(
  '/data/analytics',
  validateApiKey,
  checkPermission('read'),
  async (req, res) => {
    try {
      const { period = '24h', metrics = 'all' } = req.query;

      // Simular datos de analytics (integrar con tu sistema de analytics)
      const analytics = {
        period,
        metrics: {
          totalMessages: 150,
          sentMessages: 75,
          receivedMessages: 75,
          activeUsers: 25,
          responseTime: 1.2,
          successRate: 98.5,
        },
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        analytics,
      });
    } catch (error) {
      console.error('Error obteniendo analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// === RUTAS DE ESTADÍSTICAS ===

// Estadísticas del sistema
router.get(
  '/stats',
  validateApiKey,
  checkPermission('read'),
  async (req, res) => {
    try {
      const stats = integrationService.getStats();
      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// === WEBHOOK RECEIVER (para recibir webhooks de terceros) ===

// Recibir webhook
router.post('/webhook/receive', async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const event = req.headers['x-webhook-event'] || 'external.webhook';

    // Verificar firma si se proporciona
    if (signature && process.env.WEBHOOK_SECRET) {
      const isValid = integrationService.verifyWebhookSignature(
        req.body,
        signature,
        process.env.WEBHOOK_SECRET
      );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Firma de webhook inválida',
        });
      }
    }

    // Procesar webhook
    console.log('Webhook recibido:', { event, data: req.body });

    // Disparar eventos internos
    await integrationService.triggerWebhook('external.webhook.received', {
      event,
      data: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Webhook procesado exitosamente',
    });
  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// === MIDDLEWARE DE MANEJO DE ERRORES ===

router.use((error, req, res, next) => {
  console.error('Error en API de integraciones:', error);

  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    timestamp: new Date().toISOString(),
  });
});

export default router;

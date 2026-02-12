/**
 * Endpoints para el Sistema de Seguimiento de Respuestas
 */

import express from 'express';
const router = express.Router();

// Middleware para verificar servicios
const checkServices = (req, res, next) => {
  if (!req.app.locals.responseTrackingService) {
    return res.status(503).json({
      error: 'Servicio de seguimiento de respuestas no disponible',
    });
  }
  next();
};

// Registrar mensaje enviado
router.post('/track-sent', checkServices, async (req, res) => {
  try {
    const messageData = req.body;

    if (!messageData.messageId || !messageData.recipient) {
      return res.status(400).json({
        error: 'messageId y recipient son requeridos',
      });
    }

    const trackingId =
      await req.app.locals.responseTrackingService.trackSentMessage(
        messageData
      );

    res.json({
      success: true,
      trackingId,
    });
  } catch (error) {
    console.error('Error registrando mensaje enviado:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Registrar respuesta recibida
router.post('/track-response', checkServices, async (req, res) => {
  try {
    const responseData = req.body;

    if (!responseData.from || !responseData.responseType) {
      return res.status(400).json({
        error: 'from y responseType son requeridos',
      });
    }

    const responseId =
      await req.app.locals.responseTrackingService.trackResponse(responseData);

    res.json({
      success: true,
      responseId,
    });
  } catch (error) {
    console.error('Error registrando respuesta:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Obtener estadísticas de respuestas
router.get('/stats', checkServices, async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      templateId: req.query.templateId,
      flowId: req.query.flowId,
      responseType: req.query.responseType,
      campaign: req.query.campaign,
      segment: req.query.segment,
    };

    // Remover filtros vacíos
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });

    const stats =
      req.app.locals.responseTrackingService.getResponseStats(filters);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Obtener respuestas para un mensaje específico
router.get(
  '/message/:trackingId/responses',
  checkServices,
  async (req, res) => {
    try {
      const { trackingId } = req.params;

      const responses =
        req.app.locals.responseTrackingService.getResponsesForMessage(
          trackingId
        );

      res.json({
        success: true,
        responses,
      });
    } catch (error) {
      console.error('Error obteniendo respuestas del mensaje:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
      });
    }
  }
);

// Obtener mensajes sin respuesta
router.get('/unresponded', checkServices, async (req, res) => {
  try {
    const hoursOld = parseInt(req.query.hoursOld) || 24;

    const unrespondedMessages =
      req.app.locals.responseTrackingService.getUnrespondedMessages(hoursOld);

    res.json({
      success: true,
      messages: unrespondedMessages,
    });
  } catch (error) {
    console.error('Error obteniendo mensajes sin respuesta:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Obtener respuestas no procesadas
router.get('/unprocessed', checkServices, async (req, res) => {
  try {
    const unprocessedResponses =
      req.app.locals.responseTrackingService.getUnprocessedResponses();

    res.json({
      success: true,
      responses: unprocessedResponses,
    });
  } catch (error) {
    console.error('Error obteniendo respuestas no procesadas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Marcar respuesta como procesada
router.post('/mark-processed/:responseId', checkServices, async (req, res) => {
  try {
    const { responseId } = req.params;
    const { processingNotes } = req.body;

    await req.app.locals.responseTrackingService.markResponseProcessed(
      responseId,
      processingNotes
    );

    res.json({
      success: true,
      message: 'Respuesta marcada como procesada',
    });
  } catch (error) {
    console.error('Error marcando respuesta como procesada:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Exportar datos
router.get('/export', checkServices, async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      templateId: req.query.templateId,
      flowId: req.query.flowId,
      responseType: req.query.responseType,
      campaign: req.query.campaign,
      segment: req.query.segment,
    };

    // Remover filtros vacíos
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });

    const exportData = await req.app.locals.responseTrackingService.exportData(
      format,
      filters
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=response-tracking.csv'
      );
      res.send(exportData);
    } else {
      res.json({
        success: true,
        data: exportData,
      });
    }
  } catch (error) {
    console.error('Error exportando datos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Dashboard de respuestas en tiempo real
router.get('/dashboard', checkServices, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // Estadísticas de hoy
    const todayStats = req.app.locals.responseTrackingService.getResponseStats({
      startDate: today,
    });

    // Estadísticas de ayer
    const yesterdayStats =
      req.app.locals.responseTrackingService.getResponseStats({
        startDate: yesterday,
        endDate: yesterday,
      });

    // Mensajes sin respuesta
    const unrespondedMessages =
      req.app.locals.responseTrackingService.getUnrespondedMessages(24);

    // Respuestas no procesadas
    const unprocessedResponses =
      req.app.locals.responseTrackingService.getUnprocessedResponses();

    res.json({
      success: true,
      dashboard: {
        today: todayStats,
        yesterday: yesterdayStats,
        unrespondedCount: unrespondedMessages.length,
        unprocessedCount: unprocessedResponses.length,
        comparison: {
          responseRateChange:
            todayStats.responseRate - yesterdayStats.responseRate,
          totalResponsesChange:
            todayStats.totalResponses - yesterdayStats.totalResponses,
        },
      },
    });
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Limpiar datos antiguos
router.post('/cleanup', checkServices, async (req, res) => {
  try {
    const { daysOld = 90 } = req.body;

    const cleaned =
      await req.app.locals.responseTrackingService.cleanupOldData(daysOld);

    res.json({
      success: true,
      cleaned,
    });
  } catch (error) {
    console.error('Error limpiando datos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Webhook para recibir notificaciones de respuestas
router.post('/webhook', checkServices, async (req, res) => {
  try {
    const { type, data } = req.body;

    switch (type) {
      case 'message_response':
        await req.app.locals.responseTrackingService.trackResponse(data);
        break;
      case 'template_response':
        await req.app.locals.responseTrackingService.trackResponse({
          ...data,
          responseType: 'template_response',
        });
        break;
      case 'flow_response':
        await req.app.locals.responseTrackingService.trackResponse({
          ...data,
          responseType: 'flow_response',
        });
        break;
      default:
        console.log('Tipo de webhook no reconocido:', type);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error procesando webhook de respuesta:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

export default router;

/**
 * Analytics API Routes
 * Endpoints para acceder a métricas y datos de analytics
 */

import express from 'express';
import analyticsService from '../services/AnalyticsService.js';

const router = express.Router();

// Middleware para validar acceso (opcional - agregar autenticación si es necesario)
const validateAccess = (req, res, next) => {
  // Por ahora permitir acceso libre, pero se puede agregar autenticación aquí
  next();
};

// GET /api/analytics - Obtener métricas generales
router.get('/', validateAccess, (req, res) => {
  try {
    const metrics = analyticsService.getMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error retrieving analytics data',
      message: error.message,
    });
  }
});

// GET /api/analytics/realtime - Eventos en tiempo real
router.get('/realtime', validateAccess, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const events = analyticsService.getRealTimeEvents(limit);

    res.json({
      success: true,
      data: events,
      count: events.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error retrieving real-time events',
      message: error.message,
    });
  }
});

// GET /api/analytics/hourly - Métricas por hora
router.get('/hourly', validateAccess, (req, res) => {
  try {
    const date = req.query.date || new Date().toDateString();
    const hourlyData = analyticsService.getHourlyMetrics(date);

    res.json({
      success: true,
      data: hourlyData,
      date: date,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error retrieving hourly metrics',
      message: error.message,
    });
  }
});

// GET /api/analytics/trends - Tendencias diarias
router.get('/trends', validateAccess, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const trends = analyticsService.getDailyTrends(days);

    res.json({
      success: true,
      data: trends,
      days: days,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error retrieving trends data',
      message: error.message,
    });
  }
});

// GET /api/analytics/flows - Estadísticas de flujos
router.get('/flows', validateAccess, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const flows = analyticsService.getTopFlows(limit);

    res.json({
      success: true,
      data: flows,
      count: flows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error retrieving flows data',
      message: error.message,
    });
  }
});

// GET /api/analytics/summary - Resumen ejecutivo
router.get('/summary', validateAccess, (req, res) => {
  try {
    const metrics = analyticsService.getMetrics();

    const summary = {
      overview: {
        totalMessages: metrics.messages.total,
        activeConversations: metrics.conversations.active,
        uniqueUsers: metrics.users.unique,
        systemUptime: Math.floor(metrics.performance.uptime / (1000 * 60 * 60)), // hours
        successRate:
          metrics.messages.total > 0
            ? ((metrics.messages.sent / metrics.messages.total) * 100).toFixed(
                2
              )
            : 0,
      },
      ai: {
        intentDetections: metrics.ai.intentDetections,
        averageConfidence: metrics.ai.averageConfidence.toFixed(2),
        emotionalPersuasionUsage: metrics.ai.emotionalPersuasionUsed,
        aiSuccessRate:
          metrics.ai.intentDetections > 0
            ? (
                (metrics.ai.successfulResponses / metrics.ai.intentDetections) *
                100
              ).toFixed(2)
            : 0,
      },
      performance: {
        averageResponseTime: metrics.performance.averageResponseTime.toFixed(2),
        totalErrors: metrics.performance.errors,
        webhookPerformance:
          metrics.performance.averageWebhookTime?.toFixed(2) || 0,
      },
      flows: {
        conversionRate: metrics.flows.conversionRate.toFixed(2),
        completedFlows: metrics.flows.completed,
        abandonedFlows: metrics.flows.abandoned,
      },
    };

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error generating summary',
      message: error.message,
    });
  }
});

// POST /api/analytics/export - Exportar datos
router.post('/export', validateAccess, async (req, res) => {
  try {
    const format = req.body.format || 'json';
    const filepath = await analyticsService.exportMetrics(format);

    if (filepath) {
      res.json({
        success: true,
        message: 'Analytics data exported successfully',
        filepath: filepath,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Unsupported export format',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error exporting analytics data',
      message: error.message,
    });
  }
});

// POST /api/analytics/reset - Resetear métricas (solo para desarrollo/testing)
router.post('/reset', validateAccess, (req, res) => {
  try {
    // Solo permitir en modo desarrollo
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Reset not allowed in production',
      });
    }

    analyticsService.resetMetrics();

    res.json({
      success: true,
      message: 'Analytics metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error resetting metrics',
      message: error.message,
    });
  }
});

// WebSocket endpoint para métricas en tiempo real (si se implementa WebSocket)
router.get('/stream', validateAccess, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Enviar métricas cada 5 segundos
  const interval = setInterval(() => {
    const metrics = analyticsService.getMetrics();
    const realtimeEvents = analyticsService.getRealTimeEvents(10);

    res.write(
      `data: ${JSON.stringify({
        metrics,
        realtimeEvents,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  }, 5000);

  // Cleanup cuando el cliente se desconecta
  req.on('close', () => {
    clearInterval(interval);
  });
});

export default router;

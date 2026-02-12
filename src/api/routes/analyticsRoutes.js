/**
 * =====================================================
 * ChatBot Enterprise - Analytics Routes (ES Modules)
 * =====================================================
 * 
 * Rutas para el sistema de analytics y métricas de negocio.
 * Compatible con ES modules para integración con SecureServer.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import AnalyticsController from '../../controllers/AnalyticsController.js';
import { getAnalyticsInitializer } from '../../features/analytics/AnalyticsInitializer.js';

// Importar servicios de analytics (usando require dentro de funciones async)
let analyticsController = null;

// Función para cargar el controlador de analytics
async function loadAnalyticsController() {
  if (!analyticsController) {
    try {
      analyticsController = new AnalyticsController();
    } catch (error) {
      logger.error('Error cargando AnalyticsController:', error);
      throw error;
    }
  }
  return analyticsController;
}

const router = express.Router();

// Rate limiting para analytics
const analyticsRateLimit = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutos
  max: 100, // máximo 100 requests por 2 minutos
  message: {
    error: 'Demasiadas consultas de analytics',
    code: 'TOO_MANY_ANALYTICS_REQUESTS',
    retryAfter: '2 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar rate limiting a todas las rutas
router.use(analyticsRateLimit);

// Esquemas de validación con Joi
const dateRangeSchema = Joi.object({
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
  period: Joi.string().valid('today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'this_month', 'last_month', 'this_year', 'custom').default('last_30_days'),
  timezone: Joi.string().optional().default('UTC')
});

const metricsQuerySchema = Joi.object({
  metrics: Joi.array().items(Joi.string()).optional(),
  group_by: Joi.string().valid('day', 'week', 'month', 'hour').default('day'),
  include_trends: Joi.boolean().default(false)
}).concat(dateRangeSchema);

const alertRuleSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  metric: Joi.string().required(),
  condition: Joi.string().valid('greater_than', 'less_than', 'equals', 'not_equals').required(),
  threshold: Joi.number().required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  enabled: Joi.boolean().default(true),
  cooldown: Joi.number().integer().min(0).default(300)
});

// Middleware de validación
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Parámetros de consulta inválidos',
        details: error.details.map(d => d.message),
        code: 'VALIDATION_ERROR'
      });
    }
    req.query = value;
    next();
  };
};

// Middleware para cargar el controlador
const ensureController = async (req, res, next) => {
  try {
    req.analyticsController = await loadAnalyticsController();
    next();
  } catch (error) {
    logger.error('Error cargando controlador de analytics:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'CONTROLLER_LOAD_ERROR'
    });
  }
};

// =====================================================
// RUTAS DE MÉTRICAS DE NEGOCIO
// =====================================================

/**
 * GET /api/analytics/dashboard
 * Obtener métricas principales del dashboard
 */
router.get('/dashboard', validate(dateRangeSchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getDashboardMetrics(req, res);
  } catch (error) {
    logger.error('Error en ruta dashboard:', error);
    res.status(500).json({
      error: 'Error obteniendo métricas del dashboard',
      code: 'DASHBOARD_ERROR'
    });
  }
});

/**
 * GET /api/analytics/kpis
 * Obtener KPIs principales
 */
router.get('/kpis', validate(dateRangeSchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getKPIs(req, res);
  } catch (error) {
    logger.error('Error en ruta KPIs:', error);
    res.status(500).json({
      error: 'Error obteniendo KPIs',
      code: 'KPIS_ERROR'
    });
  }
});

/**
 * GET /api/analytics/conversations
 * Obtener métricas de conversaciones
 */
router.get('/conversations', validate(metricsQuerySchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getConversationMetrics(req, res);
  } catch (error) {
    logger.error('Error en ruta conversaciones:', error);
    res.status(500).json({
      error: 'Error obteniendo métricas de conversaciones',
      code: 'CONVERSATIONS_ERROR'
    });
  }
});

/**
 * GET /api/analytics/messages
 * Obtener métricas de mensajes
 */
router.get('/messages', validate(metricsQuerySchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getMessageMetrics(req, res);
  } catch (error) {
    logger.error('Error en ruta mensajes:', error);
    res.status(500).json({
      error: 'Error obteniendo métricas de mensajes',
      code: 'MESSAGES_ERROR'
    });
  }
});

/**
 * GET /api/analytics/agents
 * Obtener métricas de rendimiento de agentes
 */
router.get('/agents', validate(dateRangeSchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getAgentPerformance(req, res);
  } catch (error) {
    logger.error('Error en ruta agentes:', error);
    res.status(500).json({
      error: 'Error obteniendo métricas de agentes',
      code: 'AGENTS_ERROR'
    });
  }
});

// =====================================================
// RUTAS DE DASHBOARDS
// =====================================================

/**
 * GET /api/analytics/dashboard/main
 * Dashboard principal
 */
router.get('/dashboard/main', validate(dateRangeSchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getMainDashboard(req, res);
  } catch (error) {
    logger.error('Error en dashboard principal:', error);
    res.status(500).json({
      error: 'Error obteniendo dashboard principal',
      code: 'MAIN_DASHBOARD_ERROR'
    });
  }
});

/**
 * GET /api/analytics/dashboard/agent
 * Dashboard de agentes
 */
router.get('/dashboard/agent', validate(dateRangeSchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getAgentDashboard(req, res);
  } catch (error) {
    logger.error('Error en dashboard de agentes:', error);
    res.status(500).json({
      error: 'Error obteniendo dashboard de agentes',
      code: 'AGENT_DASHBOARD_ERROR'
    });
  }
});

/**
 * GET /api/analytics/dashboard/satisfaction
 * Dashboard de satisfacción del cliente
 */
router.get('/dashboard/satisfaction', validate(dateRangeSchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getSatisfactionDashboard(req, res);
  } catch (error) {
    logger.error('Error en dashboard de satisfacción:', error);
    res.status(500).json({
      error: 'Error obteniendo dashboard de satisfacción',
      code: 'SATISFACTION_DASHBOARD_ERROR'
    });
  }
});

/**
 * GET /api/analytics/dashboard/operations
 * Dashboard operacional
 */
router.get('/dashboard/operations', validate(dateRangeSchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getOperationsDashboard(req, res);
  } catch (error) {
    logger.error('Error en dashboard operacional:', error);
    res.status(500).json({
      error: 'Error obteniendo dashboard operacional',
      code: 'OPERATIONS_DASHBOARD_ERROR'
    });
  }
});

// =====================================================
// RUTAS DE ALERTAS
// =====================================================

/**
 * GET /api/analytics/alerts
 * Obtener alertas activas
 */
router.get('/alerts', ensureController, async (req, res) => {
  try {
    await req.analyticsController.getActiveAlerts(req, res);
  } catch (error) {
    logger.error('Error obteniendo alertas:', error);
    res.status(500).json({
      error: 'Error obteniendo alertas',
      code: 'ALERTS_ERROR'
    });
  }
});

/**
 * GET /api/analytics/alerts/history
 * Obtener historial de alertas
 */
router.get('/alerts/history', validate(dateRangeSchema), ensureController, async (req, res) => {
  try {
    await req.analyticsController.getAlertHistory(req, res);
  } catch (error) {
    logger.error('Error obteniendo historial de alertas:', error);
    res.status(500).json({
      error: 'Error obteniendo historial de alertas',
      code: 'ALERT_HISTORY_ERROR'
    });
  }
});

/**
 * POST /api/analytics/alerts/:id/acknowledge
 * Reconocer una alerta
 */
router.post('/alerts/:id/acknowledge', ensureController, async (req, res) => {
  try {
    await req.analyticsController.acknowledgeAlert(req, res);
  } catch (error) {
    logger.error('Error reconociendo alerta:', error);
    res.status(500).json({
      error: 'Error reconociendo alerta',
      code: 'ACKNOWLEDGE_ALERT_ERROR'
    });
  }
});

/**
 * POST /api/analytics/alerts/:id/resolve
 * Resolver una alerta
 */
router.post('/alerts/:id/resolve', ensureController, async (req, res) => {
  try {
    await req.analyticsController.resolveAlert(req, res);
  } catch (error) {
    logger.error('Error resolviendo alerta:', error);
    res.status(500).json({
      error: 'Error resolviendo alerta',
      code: 'RESOLVE_ALERT_ERROR'
    });
  }
});

// =====================================================
// RUTAS DE REPORTES
// =====================================================

/**
 * POST /api/analytics/reports/generate
 * Generar un nuevo reporte
 */
router.post('/reports/generate', ensureController, async (req, res) => {
  try {
    await req.analyticsController.generateReport(req, res);
  } catch (error) {
    logger.error('Error generando reporte:', error);
    res.status(500).json({
      error: 'Error generando reporte',
      code: 'GENERATE_REPORT_ERROR'
    });
  }
});

/**
 * GET /api/analytics/reports
 * Listar reportes disponibles
 */
router.get('/reports', ensureController, async (req, res) => {
  try {
    await req.analyticsController.listReports(req, res);
  } catch (error) {
    logger.error('Error listando reportes:', error);
    res.status(500).json({
      error: 'Error listando reportes',
      code: 'LIST_REPORTS_ERROR'
    });
  }
});

/**
 * GET /api/analytics/reports/:id/download
 * Descargar un reporte
 */
router.get('/reports/:id/download', ensureController, async (req, res) => {
  try {
    await req.analyticsController.downloadReport(req, res);
  } catch (error) {
    logger.error('Error descargando reporte:', error);
    res.status(500).json({
      error: 'Error descargando reporte',
      code: 'DOWNLOAD_REPORT_ERROR'
    });
  }
});

// =====================================================
// RUTAS DE ESTADÍSTICAS GENERALES
// =====================================================

/**
 * GET /api/analytics/stats/summary
 * Obtener resumen general de estadísticas
 */
router.get('/stats/summary', ensureController, async (req, res) => {
  try {
    await req.analyticsController.getGeneralSummary(req, res);
  } catch (error) {
    logger.error('Error obteniendo resumen:', error);
    res.status(500).json({
      error: 'Error obteniendo resumen de estadísticas',
      code: 'STATS_SUMMARY_ERROR'
    });
  }
});

/**
 * GET /api/analytics/stats/notifications
 * Obtener estadísticas de notificaciones
 */
router.get('/stats/notifications', ensureController, async (req, res) => {
  try {
    await req.analyticsController.getNotificationStats(req, res);
  } catch (error) {
    logger.error('Error obteniendo estadísticas de notificaciones:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas de notificaciones',
      code: 'NOTIFICATION_STATS_ERROR'
    });
  }
});

// =====================================================
// RUTA DE ESTADO DEL SISTEMA
// =====================================================

/**
 * GET /api/analytics/system/status
 * Obtener estado del sistema de analytics
 */
router.get('/system/status', async (req, res) => {
  try {
    const analyticsInitializer = getAnalyticsInitializer();
    const status = analyticsInitializer.getSystemStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo estado del sistema:', error);
    res.status(500).json({
      error: 'Error obteniendo estado del sistema',
      code: 'SYSTEM_STATUS_ERROR'
    });
  }
});

export default router;
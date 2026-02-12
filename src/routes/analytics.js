/**
 * =====================================================
 * ChatBot Enterprise - Analytics Routes
 * =====================================================
 * 
 * Rutas para métricas de negocio, KPIs, dashboards y alertas.
 */

import express from 'express';
const router = express.Router();
import { body, query, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { checkRole } from '../middleware/roleCheck.js';

// Controlador
import AnalyticsController from '../controllers/AnalyticsController.js';

// Instanciar controlador
const analyticsController = new AnalyticsController();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

/**
 * =====================================================
 * RUTAS DE MÉTRICAS DE NEGOCIO
 * =====================================================
 */

/**
 * @route GET /api/analytics/metrics/dashboard
 * @desc Obtener métricas del dashboard principal
 * @access Supervisor, Admin
 */
router.get('/metrics/dashboard',
    checkRole(['SUPERVISOR', 'ADMIN']),
    [
        query('timeRange')
            .optional()
            .isIn(['1h', '24h', '7d', '30d'])
            .withMessage('Rango de tiempo inválido')
    ],
    validateRequest,
    analyticsController.getDashboardMetrics.bind(analyticsController)
);

/**
 * @route GET /api/analytics/metrics/kpis
 * @desc Obtener KPIs principales
 * @access Supervisor, Admin
 */
router.get('/metrics/kpis',
    checkRole(['SUPERVISOR', 'ADMIN']),
    [
        query('timeRange')
            .optional()
            .isIn(['1h', '24h', '7d', '30d'])
            .withMessage('Rango de tiempo inválido')
    ],
    validateRequest,
    analyticsController.getKPIs.bind(analyticsController)
);

/**
 * @route GET /api/analytics/metrics/conversations
 * @desc Obtener métricas específicas de conversaciones
 * @access Agent, Supervisor, Admin
 */
router.get('/metrics/conversations',
    checkRole(['AGENT', 'SUPERVISOR', 'ADMIN']),
    [
        query('timeRange')
            .optional()
            .isIn(['1h', '24h', '7d', '30d'])
            .withMessage('Rango de tiempo inválido'),
        query('agentId')
            .optional()
            .isUUID()
            .withMessage('ID de agente inválido')
    ],
    validateRequest,
    analyticsController.getConversationMetrics.bind(analyticsController)
);

/**
 * @route GET /api/analytics/metrics/messages
 * @desc Obtener métricas de mensajes
 * @access Agent, Supervisor, Admin
 */
router.get('/metrics/messages',
    checkRole(['AGENT', 'SUPERVISOR', 'ADMIN']),
    [
        query('timeRange')
            .optional()
            .isIn(['1h', '24h', '7d', '30d'])
            .withMessage('Rango de tiempo inválido'),
        query('agentId')
            .optional()
            .isUUID()
            .withMessage('ID de agente inválido')
    ],
    validateRequest,
    analyticsController.getMessageMetrics.bind(analyticsController)
);

/**
 * @route GET /api/analytics/metrics/agents/performance
 * @desc Obtener métricas de rendimiento de agentes
 * @access Supervisor, Admin
 */
router.get('/metrics/agents/performance',
    checkRole(['SUPERVISOR', 'ADMIN']),
    [
        query('timeRange')
            .optional()
            .isIn(['1h', '24h', '7d', '30d'])
            .withMessage('Rango de tiempo inválido'),
        query('agentId')
            .optional()
            .isUUID()
            .withMessage('ID de agente inválido')
    ],
    validateRequest,
    analyticsController.getAgentPerformance.bind(analyticsController)
);

/**
 * =====================================================
 * REPORTES
 * =====================================================
 */

// Generar reporte
router.post('/reports/generate',
    checkRole(['supervisor', 'admin']),
    [
        body('type').isIn(['metrics', 'kpis', 'conversations', 'agents', 'satisfaction']).withMessage('Tipo de reporte inválido'),
        body('format').isIn(['excel', 'pdf', 'json', 'csv']).withMessage('Formato inválido'),
        body('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        validateRequest
    ],
    analyticsController.generateReport.bind(analyticsController)
);

// Listar reportes
router.get('/reports',
    checkRole(['supervisor', 'admin']),
    [
        query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite inválido'),
        validateRequest
    ],
    analyticsController.listReports.bind(analyticsController)
);

// Descargar reporte
router.get('/reports/:reportId/download',
    checkRole(['supervisor', 'admin']),
    [
        param('reportId').isUUID().withMessage('ID de reporte inválido'),
        validateRequest
    ],
    analyticsController.downloadReport.bind(analyticsController)
);

/**
 * =====================================================
 * ESTADÍSTICAS GENERALES
 * =====================================================
 */

// Obtener resumen general de estadísticas
router.get('/summary',
    [
        query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        validateRequest
    ],
    analyticsController.getGeneralSummary.bind(analyticsController)
);

// Obtener estadísticas de notificaciones
router.get('/notifications/stats',
    checkRole(['supervisor', 'admin']),
    [
        query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        validateRequest
    ],
    analyticsController.getNotificationStats.bind(analyticsController)
);

/**
 * =====================================================
 * ALERTAS
 * =====================================================
 */

// Obtener alertas activas
router.get('/alerts/active',
    [
        query('severity').optional().isIn(['critical', 'warning', 'info']).withMessage('Severidad inválida'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite inválido'),
        validateRequest
    ],
    analyticsController.getActiveAlerts.bind(analyticsController)
);

// Obtener historial de alertas
router.get('/alerts/history',
    checkRole(['supervisor', 'admin']),
    [
        query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        query('severity').optional().isIn(['critical', 'warning', 'info']).withMessage('Severidad inválida'),
        query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite inválido'),
        validateRequest
    ],
    analyticsController.getAlertHistory.bind(analyticsController)
);

// Reconocer alerta
router.post('/alerts/:alertId/acknowledge',
    [
        param('alertId').isUUID().withMessage('ID de alerta inválido'),
        validateRequest
    ],
    analyticsController.acknowledgeAlert.bind(analyticsController)
);

// Resolver alerta
router.post('/alerts/:alertId/resolve',
    [
        param('alertId').isUUID().withMessage('ID de alerta inválido'),
        body('resolution').notEmpty().withMessage('Resolución es requerida'),
        validateRequest
    ],
    analyticsController.resolveAlert.bind(analyticsController)
);

// Obtener reglas de alerta (solo admin)
router.get('/alerts/rules',
    checkRole(['admin']),
    analyticsController.getAlertRules.bind(analyticsController)
);

// Crear regla de alerta (solo admin)
router.post('/alerts/rules',
    checkRole(['admin']),
    [
        body('name').notEmpty().withMessage('Nombre es requerido'),
        body('metric').notEmpty().withMessage('Métrica es requerida'),
        body('operator').isIn(['>', '<', '>=', '<=', '==', '!=']).withMessage('Operador inválido'),
        body('threshold').isNumeric().withMessage('Umbral debe ser numérico'),
        body('severity').isIn(['critical', 'warning', 'info']).withMessage('Severidad inválida'),
        validateRequest
    ],
    analyticsController.createAlertRule.bind(analyticsController)
);

// Actualizar regla de alerta (solo admin)
router.put('/alerts/rules/:ruleId',
    checkRole(['admin']),
    [
        param('ruleId').isUUID().withMessage('ID de regla inválido'),
        body('name').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
        body('operator').optional().isIn(['>', '<', '>=', '<=', '==', '!=']).withMessage('Operador inválido'),
        body('threshold').optional().isNumeric().withMessage('Umbral debe ser numérico'),
        body('severity').optional().isIn(['critical', 'warning', 'info']).withMessage('Severidad inválida'),
        validateRequest
    ],
    analyticsController.updateAlertRule.bind(analyticsController)
);

// Eliminar regla de alerta (solo admin)
router.delete('/alerts/rules/:ruleId',
    checkRole(['admin']),
    [
        param('ruleId').isUUID().withMessage('ID de regla inválido'),
        validateRequest
    ],
    analyticsController.deleteAlertRule.bind(analyticsController)
);

/**
 * =====================================================
 * RUTAS DE DASHBOARDS
 * =====================================================
 */

// Obtener dashboard principal
router.get('/dashboard/main',
    checkRole(['supervisor', 'admin']),
    [
        query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        validateRequest
    ],
    analyticsController.getMainDashboard.bind(analyticsController)
);

// Obtener dashboard de agentes
router.get('/dashboard/agents',
    checkRole(['supervisor', 'admin']),
    [
        query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        query('agentId').optional().isUUID().withMessage('ID de agente inválido'),
        validateRequest
    ],
    analyticsController.getAgentDashboard.bind(analyticsController)
);

// Obtener dashboard de satisfacción del cliente
router.get('/dashboard/satisfaction',
    checkRole(['supervisor', 'admin']),
    [
        query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        validateRequest
    ],
    analyticsController.getCustomerSatisfactionDashboard.bind(analyticsController)
);

// Obtener dashboard operacional
router.get('/dashboard/operational',
    checkRole(['supervisor', 'admin']),
    [
        query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        validateRequest
    ],
    analyticsController.getOperationalDashboard.bind(analyticsController)
);

// Exportar dashboard
router.get('/dashboard/export',
    checkRole(['supervisor', 'admin']),
    [
        query('type').optional().isIn(['main', 'agents', 'satisfaction', 'operational']).withMessage('Tipo de dashboard inválido'),
        query('format').optional().isIn(['json', 'excel', 'pdf']).withMessage('Formato inválido'),
        query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        validateRequest
    ],
    analyticsController.exportDashboard.bind(analyticsController)
);

/**
 * =====================================================
 * RUTAS DE ESTADÍSTICAS GENERALES
 * =====================================================
 */

// Obtener resumen general de estadísticas
router.get('/stats/summary',
    [
        query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Rango de tiempo inválido'),
        validateRequest
    ],
    analyticsController.getGeneralSummary.bind(analyticsController)
);

export default router;
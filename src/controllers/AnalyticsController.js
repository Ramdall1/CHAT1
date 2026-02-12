/**
 * =====================================================
 * ChatBot Enterprise - Analytics Controller
 * =====================================================
 * 
 * Controlador para gestionar todas las operaciones
 * relacionadas con analytics, métricas y reportes.
 */

import BusinessMetricsService from '../features/analytics/BusinessMetricsService.js';
import AlertService from '../features/analytics/AlertService.js';
import DashboardService from '../features/analytics/DashboardService.js';
import NotificationService from '../features/analytics/NotificationService.js';
import ReportService from '../features/analytics/ReportService.js';

class AnalyticsController {
    constructor() {
        this.metricsService = new BusinessMetricsService();
        this.alertService = new AlertService();
        this.dashboardService = new DashboardService();
        this.notificationService = new NotificationService();
        this.reportService = new ReportService();
    }

    /**
     * =====================================================
     * MÉTRICAS Y DASHBOARDS
     * =====================================================
     */

    /**
     * Obtener métricas del dashboard principal
     */
    async getDashboardMetrics(req, res) {
        try {
            const { timeRange = '24h' } = req.query;
            const metrics = await this.metricsService.getDashboardMetrics(timeRange);
            
            res.json({
                success: true,
                data: metrics,
                timeRange
            });
        } catch (error) {
            logger.error('Error obteniendo métricas del dashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo métricas del dashboard',
                error: error.message
            });
        }
    }

    /**
     * Obtener KPIs principales
     */
    async getKPIs(req, res) {
        try {
            const { timeRange = '24h' } = req.query;
            const kpis = await this.metricsService.getKPIs(timeRange);
            
            res.json({
                success: true,
                data: kpis,
                timeRange
            });
        } catch (error) {
            logger.error('Error obteniendo KPIs:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo KPIs',
                error: error.message
            });
        }
    }

    /**
     * Obtener métricas de conversaciones
     */
    async getConversationMetrics(req, res) {
        try {
            const { timeRange = '24h', groupBy = 'status' } = req.query;
            
            let metrics;
            switch (groupBy) {
                case 'status':
                    metrics = await this.metricsService.getConversationsByStatus(timeRange);
                    break;
                case 'priority':
                    metrics = await this.metricsService.getConversationsByPriority(timeRange);
                    break;
                case 'channel':
                    metrics = await this.metricsService.getChannelDistribution(timeRange);
                    break;
                default:
                    metrics = await this.metricsService.getConversationMetrics(timeRange);
            }
            
            res.json({
                success: true,
                data: metrics,
                timeRange,
                groupBy
            });
        } catch (error) {
            logger.error('Error obteniendo métricas de conversaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo métricas de conversaciones',
                error: error.message
            });
        }
    }

    /**
     * Obtener métricas de mensajes
     */
    async getMessageMetrics(req, res) {
        try {
            const { timeRange = '24h', groupBy = 'type' } = req.query;
            
            let metrics;
            switch (groupBy) {
                case 'type':
                    metrics = await this.metricsService.getMessagesByType(timeRange);
                    break;
                case 'hour':
                    metrics = await this.metricsService.getMessagesByHour(timeRange);
                    break;
                default:
                    metrics = await this.metricsService.getMessageMetrics(timeRange);
            }
            
            res.json({
                success: true,
                data: metrics,
                timeRange,
                groupBy
            });
        } catch (error) {
            logger.error('Error obteniendo métricas de mensajes:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo métricas de mensajes',
                error: error.message
            });
        }
    }

    /**
     * Obtener métricas de rendimiento de agentes
     */
    async getAgentPerformance(req, res) {
        try {
            const { timeRange = '24h', agentId } = req.query;
            
            const metrics = agentId 
                ? await this.metricsService.getAgentPerformanceMetrics(timeRange, agentId)
                : await this.metricsService.getAgentPerformanceMetrics(timeRange);
            
            res.json({
                success: true,
                data: metrics,
                timeRange,
                agentId
            });
        } catch (error) {
            logger.error('Error obteniendo métricas de agentes:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo métricas de agentes',
                error: error.message
            });
        }
    }

    /**
     * =====================================================
     * DASHBOARDS
     * =====================================================
     */

    /**
     * Obtener dashboard principal
     */
    async getMainDashboard(req, res) {
        try {
            const { timeRange = '24h' } = req.query;
            const dashboard = await this.dashboardService.getMainDashboard(timeRange);
            
            res.json({
                success: true,
                data: dashboard,
                timeRange
            });
        } catch (error) {
            logger.error('Error obteniendo dashboard principal:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo dashboard principal',
                error: error.message
            });
        }
    }

    /**
     * Obtener dashboard de agentes
     */
    async getAgentDashboard(req, res) {
        try {
            const { timeRange = '24h', agentId } = req.query;
            const dashboard = await this.dashboardService.getAgentDashboard(timeRange, agentId);
            
            res.json({
                success: true,
                data: dashboard,
                timeRange,
                agentId
            });
        } catch (error) {
            logger.error('Error obteniendo dashboard de agentes:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo dashboard de agentes',
                error: error.message
            });
        }
    }

    /**
     * Obtener dashboard de satisfacción del cliente
     */
    async getCustomerSatisfactionDashboard(req, res) {
        try {
            const { timeRange = '24h' } = req.query;
            const dashboard = await this.dashboardService.getCustomerSatisfactionDashboard(timeRange);
            
            res.json({
                success: true,
                data: dashboard,
                timeRange
            });
        } catch (error) {
            logger.error('Error obteniendo dashboard de satisfacción:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo dashboard de satisfacción',
                error: error.message
            });
        }
    }

    /**
     * Obtener dashboard operacional
     */
    async getOperationalDashboard(req, res) {
        try {
            const { timeRange = '24h' } = req.query;
            const dashboard = await this.dashboardService.getOperationalDashboard(timeRange);
            
            res.json({
                success: true,
                data: dashboard,
                timeRange
            });
        } catch (error) {
            logger.error('Error obteniendo dashboard operacional:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo dashboard operacional',
                error: error.message
            });
        }
    }

    /**
     * =====================================================
     * ALERTAS
     * =====================================================
     */

    /**
     * Obtener alertas activas
     */
    async getActiveAlerts(req, res) {
        try {
            const { severity, limit = 50 } = req.query;
            const alerts = await this.alertService.getActiveAlerts(severity, parseInt(limit));
            
            res.json({
                success: true,
                data: alerts,
                count: alerts.length
            });
        } catch (error) {
            logger.error('Error obteniendo alertas activas:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo alertas activas',
                error: error.message
            });
        }
    }

    /**
     * Obtener historial de alertas
     */
    async getAlertHistory(req, res) {
        try {
            const { 
                timeRange = '7d', 
                severity, 
                page = 1, 
                limit = 50 
            } = req.query;
            
            const history = await this.alertService.getAlertHistory(
                timeRange, 
                severity, 
                parseInt(page), 
                parseInt(limit)
            );
            
            res.json({
                success: true,
                data: history.alerts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: history.total,
                    pages: Math.ceil(history.total / parseInt(limit))
                }
            });
        } catch (error) {
            logger.error('Error obteniendo historial de alertas:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo historial de alertas',
                error: error.message
            });
        }
    }

    /**
     * Reconocer alerta
     */
    async acknowledgeAlert(req, res) {
        try {
            const { alertId } = req.params;
            const { userId } = req.user;
            
            const result = await this.alertService.acknowledgeAlert(alertId, userId);
            
            res.json({
                success: true,
                message: 'Alerta reconocida exitosamente',
                data: result
            });
        } catch (error) {
            logger.error('Error reconociendo alerta:', error);
            res.status(500).json({
                success: false,
                message: 'Error reconociendo alerta',
                error: error.message
            });
        }
    }

    /**
     * Resolver alerta
     */
    async resolveAlert(req, res) {
        try {
            const { alertId } = req.params;
            const { userId } = req.user;
            const { resolution } = req.body;
            
            const result = await this.alertService.resolveAlert(alertId, userId, resolution);
            
            res.json({
                success: true,
                message: 'Alerta resuelta exitosamente',
                data: result
            });
        } catch (error) {
            logger.error('Error resolviendo alerta:', error);
            res.status(500).json({
                success: false,
                message: 'Error resolviendo alerta',
                error: error.message
            });
        }
    }

    /**
     * Obtener reglas de alerta
     */
    async getAlertRules(req, res) {
        try {
            const rules = await this.alertService.getAlertRules();
            
            res.json({
                success: true,
                data: rules
            });
        } catch (error) {
            logger.error('Error obteniendo reglas de alerta:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo reglas de alerta',
                error: error.message
            });
        }
    }

    /**
     * Crear regla de alerta
     */
    async createAlertRule(req, res) {
        try {
            const ruleData = req.body;
            const rule = await this.alertService.addAlertRule(ruleData);
            
            res.status(201).json({
                success: true,
                message: 'Regla de alerta creada exitosamente',
                data: rule
            });
        } catch (error) {
            logger.error('Error creando regla de alerta:', error);
            res.status(500).json({
                success: false,
                message: 'Error creando regla de alerta',
                error: error.message
            });
        }
    }

    /**
     * Actualizar regla de alerta
     */
    async updateAlertRule(req, res) {
        try {
            const { ruleId } = req.params;
            const updates = req.body;
            
            const rule = await this.alertService.updateAlertRule(ruleId, updates);
            
            res.json({
                success: true,
                message: 'Regla de alerta actualizada exitosamente',
                data: rule
            });
        } catch (error) {
            logger.error('Error actualizando regla de alerta:', error);
            res.status(500).json({
                success: false,
                message: 'Error actualizando regla de alerta',
                error: error.message
            });
        }
    }

    /**
     * Eliminar regla de alerta
     */
    async deleteAlertRule(req, res) {
        try {
            const { ruleId } = req.params;
            await this.alertService.removeAlertRule(ruleId);
            
            res.json({
                success: true,
                message: 'Regla de alerta eliminada exitosamente'
            });
        } catch (error) {
            logger.error('Error eliminando regla de alerta:', error);
            res.status(500).json({
                success: false,
                message: 'Error eliminando regla de alerta',
                error: error.message
            });
        }
    }

    /**
     * =====================================================
     * REPORTES
     * =====================================================
     */

    /**
     * Generar reporte de métricas
     */
    async generateReport(req, res) {
        try {
            const {
                timeRange = '30d',
                format = 'excel',
                includeCharts = true,
                includeDetails = true
            } = req.body;
            
            const report = await this.reportService.generateMetricsReport({
                timeRange,
                format,
                includeCharts,
                includeDetails
            });
            
            res.json({
                success: true,
                message: 'Reporte generado exitosamente',
                data: report
            });
        } catch (error) {
            logger.error('Error generando reporte:', error);
            res.status(500).json({
                success: false,
                message: 'Error generando reporte',
                error: error.message
            });
        }
    }

    /**
     * Listar reportes disponibles
     */
    async listReports(req, res) {
        try {
            const reports = await this.reportService.listReports();
            
            res.json({
                success: true,
                data: reports,
                count: reports.length
            });
        } catch (error) {
            logger.error('Error listando reportes:', error);
            res.status(500).json({
                success: false,
                message: 'Error listando reportes',
                error: error.message
            });
        }
    }

    /**
     * Descargar reporte
     */
    async downloadReport(req, res) {
        try {
            const { filename } = req.params;
            const reports = await this.reportService.listReports();
            const report = reports.find(r => r.filename === filename);
            
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: 'Reporte no encontrado'
                });
            }
            
            res.download(report.filepath, filename);
        } catch (error) {
            logger.error('Error descargando reporte:', error);
            res.status(500).json({
                success: false,
                message: 'Error descargando reporte',
                error: error.message
            });
        }
    }

    /**
     * =====================================================
     * NOTIFICACIONES
     * =====================================================
     */

    /**
     * Obtener estadísticas de notificaciones
     */
    async getNotificationStats(req, res) {
        try {
            const { timeRange = '24h' } = req.query;
            const stats = await this.notificationService.getNotificationStats(timeRange);
            
            res.json({
                success: true,
                data: stats,
                timeRange
            });
        } catch (error) {
            logger.error('Error obteniendo estadísticas de notificaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo estadísticas de notificaciones',
                error: error.message
            });
        }
    }

    /**
     * =====================================================
     * RESUMEN GENERAL
     * =====================================================
     */

    /**
     * Obtener resumen general de estadísticas
     */
    async getOverallStats(req, res) {
        try {
            const { timeRange = '24h' } = req.query;
            
            // Obtener datos de múltiples fuentes
            const [
                dashboardMetrics,
                kpis,
                activeAlerts,
                notificationStats
            ] = await Promise.all([
                this.metricsService.getDashboardMetrics(timeRange),
                this.metricsService.getKPIs(timeRange),
                this.alertService.getActiveAlerts(),
                this.notificationService.getNotificationStats(timeRange)
            ]);
            
            const overallStats = {
                metrics: dashboardMetrics,
                kpis,
                alerts: {
                    active: activeAlerts.length,
                    critical: activeAlerts.filter(a => a.severity === 'critical').length,
                    warning: activeAlerts.filter(a => a.severity === 'warning').length
                },
                notifications: notificationStats,
                systemHealth: {
                    status: activeAlerts.filter(a => a.severity === 'critical').length > 0 ? 'critical' : 
                           activeAlerts.filter(a => a.severity === 'warning').length > 0 ? 'warning' : 'healthy',
                    uptime: process.uptime(),
                    lastUpdated: new Date()
                }
            };
            
            res.json({
                success: true,
                data: overallStats,
                timeRange
            });
        } catch (error) {
            logger.error('Error obteniendo estadísticas generales:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo estadísticas generales',
                error: error.message
            });
        }
    }

    /**
     * =====================================================
     * EXPORTACIÓN DE DASHBOARDS
     * =====================================================
     */

    /**
     * Exportar dashboard
     */
    async exportDashboard(req, res) {
        try {
            const { type = 'main', format = 'json', timeRange = '24h' } = req.query;
            
            const exported = await this.dashboardService.exportDashboard(type, format, timeRange);
            
            if (format === 'json') {
                res.json({
                    success: true,
                    data: exported
                });
            } else {
                // Para otros formatos, devolver información del archivo
                res.json({
                    success: true,
                    message: 'Dashboard exportado exitosamente',
                    data: exported
                });
            }
        } catch (error) {
            logger.error('Error exportando dashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Error exportando dashboard',
                error: error.message
            });
        }
    }
}

export default AnalyticsController;
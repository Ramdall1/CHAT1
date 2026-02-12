/**
 * =====================================================
 * ChatBot Enterprise - Dashboard Service
 * =====================================================
 * 
 * Servicio para generar y gestionar dashboards de
 * métricas de negocio del ChatBot Enterprise.
 */

import BusinessMetricsService from './BusinessMetricsService.js';
import AlertService from './AlertService.js';
import { getPrismaService } from '../../infrastructure/database/PrismaService.js';

class DashboardService {
    constructor() {
        this.metricsService = new BusinessMetricsService();
        this.alertService = new AlertService();
        this.prismaService = getPrismaService();
        this.dashboardCache = new Map();
        this.cacheTimeout = 2 * 60 * 1000; // 2 minutos
    }

    /**
     * Obtener dashboard principal
     */
    async getMainDashboard(timeRange = '24h', userId = null) {
        try {
            const cacheKey = `main_dashboard_${timeRange}_${userId}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;

            const [
                metrics,
                kpis,
                alerts,
                trends,
                agentPerformance,
                channelAnalytics
            ] = await Promise.all([
                this.metricsService.getDashboardMetrics(timeRange),
                this.metricsService.getKPIs(timeRange),
                this.alertService.getActiveAlerts(),
                this.getTrendAnalytics(timeRange),
                this.getAgentPerformanceData(timeRange),
                this.getChannelAnalytics(timeRange)
            ]);

            const dashboard = {
                id: 'main_dashboard',
                name: 'Dashboard Principal',
                timeRange,
                generatedAt: new Date().toISOString(),
                userId,
                sections: {
                    overview: this.buildOverviewSection(metrics, kpis),
                    kpis: this.buildKPISection(kpis),
                    alerts: this.buildAlertsSection(alerts),
                    trends: this.buildTrendsSection(trends),
                    agents: this.buildAgentsSection(agentPerformance),
                    channels: this.buildChannelsSection(channelAnalytics),
                    realTime: await this.buildRealTimeSection()
                }
            };

            this.setCache(cacheKey, dashboard);
            return dashboard;

        } catch (error) {
            logger.error('Error generando dashboard principal:', error);
            throw error;
        }
    }

    /**
     * Obtener dashboard de agentes
     */
    async getAgentDashboard(timeRange = '24h', agentId = null) {
        try {
            const cacheKey = `agent_dashboard_${timeRange}_${agentId}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;

            const [
                agentMetrics,
                agentPerformance,
                agentConversations,
                agentWorkload,
                agentComparison
            ] = await Promise.all([
                this.getAgentMetrics(agentId, timeRange),
                this.getAgentPerformanceDetails(agentId, timeRange),
                this.getAgentConversations(agentId, timeRange),
                this.getAgentWorkload(agentId),
                this.getAgentComparison(agentId, timeRange)
            ]);

            const dashboard = {
                id: 'agent_dashboard',
                name: 'Dashboard de Agentes',
                timeRange,
                agentId,
                generatedAt: new Date().toISOString(),
                sections: {
                    metrics: agentMetrics,
                    performance: agentPerformance,
                    conversations: agentConversations,
                    workload: agentWorkload,
                    comparison: agentComparison
                }
            };

            this.setCache(cacheKey, dashboard);
            return dashboard;

        } catch (error) {
            logger.error('Error generando dashboard de agentes:', error);
            throw error;
        }
    }

    /**
     * Obtener dashboard de satisfacción del cliente
     */
    async getCustomerSatisfactionDashboard(timeRange = '24h') {
        try {
            const cacheKey = `satisfaction_dashboard_${timeRange}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;

            const [
                satisfactionMetrics,
                satisfactionTrends,
                satisfactionByChannel,
                satisfactionByAgent,
                feedbackAnalysis
            ] = await Promise.all([
                this.getSatisfactionMetrics(timeRange),
                this.getSatisfactionTrends(timeRange),
                this.getSatisfactionByChannel(timeRange),
                this.getSatisfactionByAgent(timeRange),
                this.getFeedbackAnalysis(timeRange)
            ]);

            const dashboard = {
                id: 'satisfaction_dashboard',
                name: 'Dashboard de Satisfacción del Cliente',
                timeRange,
                generatedAt: new Date().toISOString(),
                sections: {
                    overview: satisfactionMetrics,
                    trends: satisfactionTrends,
                    channels: satisfactionByChannel,
                    agents: satisfactionByAgent,
                    feedback: feedbackAnalysis
                }
            };

            this.setCache(cacheKey, dashboard);
            return dashboard;

        } catch (error) {
            logger.error('Error generando dashboard de satisfacción:', error);
            throw error;
        }
    }

    /**
     * Obtener dashboard de operaciones
     */
    async getOperationsDashboard(timeRange = '24h') {
        try {
            const cacheKey = `operations_dashboard_${timeRange}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;

            const [
                operationalMetrics,
                systemHealth,
                resourceUtilization,
                performanceMetrics,
                errorAnalysis
            ] = await Promise.all([
                this.getOperationalMetrics(timeRange),
                this.getSystemHealth(),
                this.getResourceUtilization(timeRange),
                this.getPerformanceMetrics(timeRange),
                this.getErrorAnalysis(timeRange)
            ]);

            const dashboard = {
                id: 'operations_dashboard',
                name: 'Dashboard de Operaciones',
                timeRange,
                generatedAt: new Date().toISOString(),
                sections: {
                    metrics: operationalMetrics,
                    health: systemHealth,
                    resources: resourceUtilization,
                    performance: performanceMetrics,
                    errors: errorAnalysis
                }
            };

            this.setCache(cacheKey, dashboard);
            return dashboard;

        } catch (error) {
            logger.error('Error generando dashboard de operaciones:', error);
            throw error;
        }
    }

    /**
     * Construir sección de resumen
     */
    buildOverviewSection(metrics, kpis) {
        return {
            title: 'Resumen General',
            widgets: [
                {
                    type: 'metric_card',
                    title: 'Conversaciones Totales',
                    value: metrics.conversations.total,
                    change: metrics.conversations.new,
                    changeLabel: 'Nuevas hoy',
                    icon: 'chat',
                    color: 'blue'
                },
                {
                    type: 'metric_card',
                    title: 'Mensajes Totales',
                    value: metrics.messages.total,
                    change: metrics.messages.new,
                    changeLabel: 'Nuevos hoy',
                    icon: 'message',
                    color: 'green'
                },
                {
                    type: 'metric_card',
                    title: 'Usuarios Activos',
                    value: metrics.users.active,
                    change: metrics.users.total,
                    changeLabel: 'Total',
                    icon: 'users',
                    color: 'purple'
                },
                {
                    type: 'metric_card',
                    title: 'Tiempo Respuesta Promedio',
                    value: this.formatTime(metrics.responseTime.averageResponse),
                    change: kpis.averageResponseTime.status,
                    changeLabel: 'Estado',
                    icon: 'clock',
                    color: this.getStatusColor(kpis.averageResponseTime.status)
                }
            ]
        };
    }

    /**
     * Construir sección de KPIs
     */
    buildKPISection(kpis) {
        return {
            title: 'Indicadores Clave de Rendimiento',
            widgets: [
                {
                    type: 'kpi_gauge',
                    title: 'Tasa de Resolución',
                    value: kpis.conversationResolutionRate.value,
                    target: kpis.conversationResolutionRate.target,
                    status: kpis.conversationResolutionRate.status,
                    unit: '%',
                    description: 'Porcentaje de conversaciones resueltas'
                },
                {
                    type: 'kpi_gauge',
                    title: 'Satisfacción del Cliente',
                    value: kpis.customerSatisfactionScore.value,
                    target: kpis.customerSatisfactionScore.target,
                    status: kpis.customerSatisfactionScore.status,
                    unit: '/5',
                    description: 'Puntuación promedio de satisfacción'
                },
                {
                    type: 'kpi_gauge',
                    title: 'Utilización de Agentes',
                    value: kpis.agentUtilization.value,
                    target: kpis.agentUtilization.target,
                    status: kpis.agentUtilization.status,
                    unit: '%',
                    description: 'Porcentaje de agentes activos'
                },
                {
                    type: 'kpi_gauge',
                    title: 'Resolución Primer Contacto',
                    value: kpis.firstContactResolution.value,
                    target: kpis.firstContactResolution.target,
                    status: kpis.firstContactResolution.status,
                    unit: '%',
                    description: 'Conversaciones resueltas en primer contacto'
                }
            ]
        };
    }

    /**
     * Construir sección de alertas
     */
    buildAlertsSection(alerts) {
        const activeAlerts = alerts.filter(alert => alert.status === 'active');
        
        return {
            title: 'Alertas Activas',
            widgets: [
                {
                    type: 'alert_summary',
                    title: 'Resumen de Alertas',
                    data: {
                        total: activeAlerts.length,
                        critical: activeAlerts.filter(a => a.severity === 'critical').length,
                        warning: activeAlerts.filter(a => a.severity === 'warning').length,
                        info: activeAlerts.filter(a => a.severity === 'info').length
                    }
                },
                {
                    type: 'alert_list',
                    title: 'Alertas Recientes',
                    data: activeAlerts.slice(0, 5).map(alert => ({
                        id: alert.id,
                        name: alert.name,
                        severity: alert.severity,
                        triggeredAt: alert.triggeredAt,
                        description: alert.description
                    }))
                }
            ]
        };
    }

    /**
     * Construir sección de tendencias
     */
    buildTrendsSection(trends) {
        return {
            title: 'Análisis de Tendencias',
            widgets: [
                {
                    type: 'line_chart',
                    title: 'Conversaciones por Hora',
                    data: trends.conversationsByHour,
                    xAxis: 'hour',
                    yAxis: 'count'
                },
                {
                    type: 'line_chart',
                    title: 'Mensajes por Hora',
                    data: trends.messagesByHour,
                    xAxis: 'hour',
                    yAxis: 'count'
                },
                {
                    type: 'area_chart',
                    title: 'Tiempo de Respuesta',
                    data: trends.responseTimeTrend,
                    xAxis: 'time',
                    yAxis: 'responseTime'
                }
            ]
        };
    }

    /**
     * Construir sección de agentes
     */
    buildAgentsSection(agentPerformance) {
        return {
            title: 'Rendimiento de Agentes',
            widgets: [
                {
                    type: 'agent_leaderboard',
                    title: 'Top Agentes por Conversaciones',
                    data: agentPerformance.topByConversations
                },
                {
                    type: 'agent_leaderboard',
                    title: 'Top Agentes por Satisfacción',
                    data: agentPerformance.topBySatisfaction
                },
                {
                    type: 'bar_chart',
                    title: 'Distribución de Carga de Trabajo',
                    data: agentPerformance.workloadDistribution,
                    xAxis: 'agent',
                    yAxis: 'conversations'
                }
            ]
        };
    }

    /**
     * Construir sección de canales
     */
    buildChannelsSection(channelAnalytics) {
        return {
            title: 'Análisis por Canal',
            widgets: [
                {
                    type: 'pie_chart',
                    title: 'Distribución por Canal',
                    data: channelAnalytics.distribution
                },
                {
                    type: 'bar_chart',
                    title: 'Mensajes Promedio por Canal',
                    data: channelAnalytics.averageMessages,
                    xAxis: 'channel',
                    yAxis: 'messages'
                },
                {
                    type: 'line_chart',
                    title: 'Tendencias por Canal',
                    data: channelAnalytics.trends,
                    xAxis: 'time',
                    yAxis: 'count'
                }
            ]
        };
    }

    /**
     * Construir sección en tiempo real
     */
    async buildRealTimeSection() {
        try {
            const prisma = this.prismaService.getClient();
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            const [
                activeConversations,
                recentMessages,
                onlineAgents,
                pendingConversations
            ] = await Promise.all([
                prisma.conversation.count({
                    where: { status: 'ACTIVE' }
                }),
                prisma.message.count({
                    where: {
                        createdAt: { gte: oneHourAgo }
                    }
                }),
                prisma.user.count({
                    where: {
                        role: { in: ['AGENT', 'SUPERVISOR'] },
                        isActive: true,
                        lastLogin: { gte: oneHourAgo }
                    }
                }),
                prisma.conversation.count({
                    where: { status: 'PENDING' }
                })
            ]);

            return {
                title: 'Estado en Tiempo Real',
                widgets: [
                    {
                        type: 'real_time_metric',
                        title: 'Conversaciones Activas',
                        value: activeConversations,
                        icon: 'chat-active',
                        color: 'green'
                    },
                    {
                        type: 'real_time_metric',
                        title: 'Mensajes (última hora)',
                        value: recentMessages,
                        icon: 'message-clock',
                        color: 'blue'
                    },
                    {
                        type: 'real_time_metric',
                        title: 'Agentes Online',
                        value: onlineAgents,
                        icon: 'user-online',
                        color: 'green'
                    },
                    {
                        type: 'real_time_metric',
                        title: 'Conversaciones Pendientes',
                        value: pendingConversations,
                        icon: 'clock-pending',
                        color: pendingConversations > 10 ? 'red' : 'orange'
                    }
                ]
            };

        } catch (error) {
            logger.error('Error construyendo sección en tiempo real:', error);
            return {
                title: 'Estado en Tiempo Real',
                widgets: [],
                error: 'Error cargando datos en tiempo real'
            };
        }
    }

    /**
     * Métodos auxiliares para obtener datos específicos
     */

    async getTrendAnalytics(timeRange) {
        const { startDate, endDate } = this.metricsService.getTimeRange(timeRange);
        const prisma = this.prismaService.getClient();

        const [conversationsByHour, messagesByHour, responseTimeTrend] = await Promise.all([
            prisma.$queryRaw`
                SELECT 
                    EXTRACT(HOUR FROM created_at) as hour,
                    COUNT(*) as count
                FROM conversations 
                WHERE created_at >= ${startDate} AND created_at <= ${endDate}
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY hour
            `,
            prisma.$queryRaw`
                SELECT 
                    EXTRACT(HOUR FROM created_at) as hour,
                    COUNT(*) as count
                FROM messages 
                WHERE created_at >= ${startDate} AND created_at <= ${endDate}
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY hour
            `,
            prisma.$queryRaw`
                SELECT 
                    DATE_TRUNC('hour', created_at) as time,
                    AVG(average_response_time) as responseTime
                FROM conversation_metrics 
                WHERE created_at >= ${startDate} AND created_at <= ${endDate}
                GROUP BY DATE_TRUNC('hour', created_at)
                ORDER BY time
            `
        ]);

        return {
            conversationsByHour,
            messagesByHour,
            responseTimeTrend
        };
    }

    async getAgentPerformanceData(timeRange) {
        const { startDate, endDate } = this.metricsService.getTimeRange(timeRange);
        const prisma = this.prismaService.getClient();

        const agentData = await prisma.$queryRaw`
            SELECT 
                u.id,
                u.name,
                COUNT(c.id) as conversations_handled,
                AVG(cm.customer_satisfaction) as avg_satisfaction,
                AVG(cm.average_response_time) as avg_response_time
            FROM users u
            LEFT JOIN conversations c ON u.id = c.assigned_to_id
            LEFT JOIN conversation_metrics cm ON c.id = cm.conversation_id
            WHERE u.role IN ('AGENT', 'SUPERVISOR')
            AND c.created_at >= ${startDate} AND c.created_at <= ${endDate}
            GROUP BY u.id, u.name
            ORDER BY conversations_handled DESC
        `;

        return {
            topByConversations: agentData.slice(0, 5),
            topBySatisfaction: [...agentData]
                .sort((a, b) => (b.avg_satisfaction || 0) - (a.avg_satisfaction || 0))
                .slice(0, 5),
            workloadDistribution: agentData.map(agent => ({
                agent: agent.name,
                conversations: agent.conversations_handled
            }))
        };
    }

    async getChannelAnalytics(timeRange) {
        const { startDate, endDate } = this.metricsService.getTimeRange(timeRange);
        const prisma = this.prismaService.getClient();

        const [distribution, averageMessages, trends] = await Promise.all([
            prisma.conversation.groupBy({
                by: ['channel'],
                _count: { id: true },
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                }
            }),
            prisma.conversation.groupBy({
                by: ['channel'],
                _avg: { messageCount: true },
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                }
            }),
            prisma.$queryRaw`
                SELECT 
                    channel,
                    DATE_TRUNC('hour', created_at) as time,
                    COUNT(*) as count
                FROM conversations 
                WHERE created_at >= ${startDate} AND created_at <= ${endDate}
                GROUP BY channel, DATE_TRUNC('hour', created_at)
                ORDER BY time, channel
            `
        ]);

        return {
            distribution: distribution.reduce((acc, item) => {
                acc[item.channel] = item._count.id;
                return acc;
            }, {}),
            averageMessages: averageMessages.map(item => ({
                channel: item.channel,
                messages: item._avg.messageCount || 0
            })),
            trends
        };
    }

    // Métodos auxiliares adicionales para dashboards específicos
    async getAgentMetrics(agentId, timeRange) {
        // Implementar métricas específicas del agente
        return {};
    }

    async getSatisfactionMetrics(timeRange) {
        // Implementar métricas de satisfacción
        return {};
    }

    async getOperationalMetrics(timeRange) {
        // Implementar métricas operacionales
        return {};
    }

    async getSystemHealth() {
        // Implementar verificación de salud del sistema
        return {
            database: 'healthy',
            api: 'healthy',
            integrations: 'healthy'
        };
    }

    /**
     * Métodos de utilidad
     */

    formatTime(seconds) {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        return `${Math.round(seconds / 3600)}h`;
    }

    getStatusColor(status) {
        const colors = {
            good: 'green',
            warning: 'orange',
            critical: 'red'
        };
        return colors[status] || 'gray';
    }

    getFromCache(key) {
        const cached = this.dashboardCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.dashboardCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.dashboardCache.clear();
    }

    /**
     * Exportar dashboard a diferentes formatos
     */
    async exportDashboard(dashboardId, format = 'json', options = {}) {
        try {
            let dashboard;
            
            switch (dashboardId) {
                case 'main':
                    dashboard = await this.getMainDashboard(options.timeRange);
                    break;
                case 'agent':
                    dashboard = await this.getAgentDashboard(options.timeRange, options.agentId);
                    break;
                case 'satisfaction':
                    dashboard = await this.getCustomerSatisfactionDashboard(options.timeRange);
                    break;
                case 'operations':
                    dashboard = await this.getOperationsDashboard(options.timeRange);
                    break;
                default:
                    throw new Error('Dashboard no encontrado');
            }

            switch (format) {
                case 'json':
                    return JSON.stringify(dashboard, null, 2);
                case 'csv':
                    return this.convertToCSV(dashboard);
                case 'pdf':
                    return await this.generatePDF(dashboard);
                default:
                    throw new Error('Formato no soportado');
            }

        } catch (error) {
            logger.error('Error exportando dashboard:', error);
            throw error;
        }
    }

    convertToCSV(dashboard) {
        // Implementar conversión a CSV
        return 'CSV export not implemented yet';
    }

    async generatePDF(dashboard) {
        // Implementar generación de PDF
        return 'PDF export not implemented yet';
    }
}

export default DashboardService;
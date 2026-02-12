/**
 * =====================================================
 * ChatBot Enterprise - Business Metrics Service
 * =====================================================
 * 
 * Servicio principal para calcular y gestionar métricas
 * de negocio, KPIs y analytics del ChatBot Enterprise.
 */

import { getPrismaService } from '../../infrastructure/database/PrismaService.js';

class BusinessMetricsService {
    constructor() {
        this.prismaService = getPrismaService();
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
    }

    /**
     * Obtener métricas generales del dashboard
     */
    async getDashboardMetrics(timeRange = '24h') {
        try {
            const cacheKey = `dashboard_metrics_${timeRange}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;

            const { startDate, endDate } = this.getTimeRange(timeRange);
            const prisma = this.prismaService.getClient();

            const [
                conversationMetrics,
                messageMetrics,
                userMetrics,
                responseTimeMetrics,
                satisfactionMetrics,
                channelMetrics
            ] = await Promise.all([
                this.getConversationMetrics(startDate, endDate),
                this.getMessageMetrics(startDate, endDate),
                this.getUserMetrics(startDate, endDate),
                this.getResponseTimeMetrics(startDate, endDate),
                this.getSatisfactionMetrics(startDate, endDate),
                this.getChannelMetrics(startDate, endDate)
            ]);

            const metrics = {
                timeRange,
                period: { startDate, endDate },
                conversations: conversationMetrics,
                messages: messageMetrics,
                users: userMetrics,
                responseTime: responseTimeMetrics,
                satisfaction: satisfactionMetrics,
                channels: channelMetrics,
                timestamp: new Date().toISOString()
            };

            this.setCache(cacheKey, metrics);
            return metrics;

        } catch (error) {
            logger.error('Error obteniendo métricas del dashboard:', error);
            throw error;
        }
    }

    /**
     * Obtener métricas de conversaciones
     */
    async getConversationMetrics(startDate, endDate) {
        try {
            const prisma = this.prismaService.getClient();

            const [
                totalConversations,
                newConversations,
                activeConversations,
                resolvedConversations,
                averageResolutionTime,
                conversationsByStatus,
                conversationsByPriority,
                conversationTrends
            ] = await Promise.all([
                // Total de conversaciones
                prisma.conversation.count(),
                
                // Nuevas conversaciones en el período
                prisma.conversation.count({
                    where: {
                        createdAt: { gte: startDate, lte: endDate }
                    }
                }),
                
                // Conversaciones activas
                prisma.conversation.count({
                    where: { status: 'ACTIVE' }
                }),
                
                // Conversaciones resueltas en el período
                prisma.conversation.count({
                    where: {
                        status: 'RESOLVED',
                        updatedAt: { gte: startDate, lte: endDate }
                    }
                }),
                
                // Tiempo promedio de resolución
                this.getAverageResolutionTime(startDate, endDate),
                
                // Conversaciones por estado
                prisma.conversation.groupBy({
                    by: ['status'],
                    _count: { id: true }
                }),
                
                // Conversaciones por prioridad
                prisma.conversation.groupBy({
                    by: ['priority'],
                    _count: { id: true }
                }),
                
                // Tendencias de conversaciones
                this.getConversationTrends(startDate, endDate)
            ]);

            return {
                total: totalConversations,
                new: newConversations,
                active: activeConversations,
                resolved: resolvedConversations,
                averageResolutionTime,
                byStatus: conversationsByStatus.reduce((acc, item) => {
                    acc[item.status] = item._count.id;
                    return acc;
                }, {}),
                byPriority: conversationsByPriority.reduce((acc, item) => {
                    acc[item.priority] = item._count.id;
                    return acc;
                }, {}),
                trends: conversationTrends
            };

        } catch (error) {
            logger.error('Error obteniendo métricas de conversaciones:', error);
            throw error;
        }
    }

    /**
     * Obtener métricas de mensajes
     */
    async getMessageMetrics(startDate, endDate) {
        try {
            const prisma = this.prismaService.getClient();

            const [
                totalMessages,
                newMessages,
                inboundMessages,
                outboundMessages,
                messagesByType,
                messagesByHour,
                averageMessagesPerConversation
            ] = await Promise.all([
                // Total de mensajes
                prisma.message.count(),
                
                // Nuevos mensajes en el período
                prisma.message.count({
                    where: {
                        createdAt: { gte: startDate, lte: endDate }
                    }
                }),
                
                // Mensajes entrantes en el período
                prisma.message.count({
                    where: {
                        direction: 'INBOUND',
                        createdAt: { gte: startDate, lte: endDate }
                    }
                }),
                
                // Mensajes salientes en el período
                prisma.message.count({
                    where: {
                        direction: 'OUTBOUND',
                        createdAt: { gte: startDate, lte: endDate }
                    }
                }),
                
                // Mensajes por tipo
                prisma.message.groupBy({
                    by: ['type'],
                    _count: { id: true },
                    where: {
                        createdAt: { gte: startDate, lte: endDate }
                    }
                }),
                
                // Mensajes por hora
                this.getMessagesByHour(startDate, endDate),
                
                // Promedio de mensajes por conversación
                this.getAverageMessagesPerConversation(startDate, endDate)
            ]);

            return {
                total: totalMessages,
                new: newMessages,
                inbound: inboundMessages,
                outbound: outboundMessages,
                averagePerConversation: averageMessagesPerConversation,
                byType: messagesByType.reduce((acc, item) => {
                    acc[item.type] = item._count.id;
                    return acc;
                }, {}),
                byHour: messagesByHour
            };

        } catch (error) {
            logger.error('Error obteniendo métricas de mensajes:', error);
            throw error;
        }
    }

    /**
     * Obtener métricas de usuarios/agentes
     */
    async getUserMetrics(startDate, endDate) {
        try {
            const prisma = this.prismaService.getClient();

            const [
                totalUsers,
                activeUsers,
                usersByRole,
                agentPerformance,
                loginActivity
            ] = await Promise.all([
                // Total de usuarios
                prisma.user.count({ where: { isActive: true } }),
                
                // Usuarios activos (con login reciente)
                prisma.user.count({
                    where: {
                        isActive: true,
                        lastLogin: { gte: startDate }
                    }
                }),
                
                // Usuarios por rol
                prisma.user.groupBy({
                    by: ['role'],
                    _count: { id: true },
                    where: { isActive: true }
                }),
                
                // Performance de agentes
                this.getAgentPerformance(startDate, endDate),
                
                // Actividad de login
                this.getLoginActivity(startDate, endDate)
            ]);

            return {
                total: totalUsers,
                active: activeUsers,
                byRole: usersByRole.reduce((acc, item) => {
                    acc[item.role] = item._count.id;
                    return acc;
                }, {}),
                agentPerformance,
                loginActivity
            };

        } catch (error) {
            logger.error('Error obteniendo métricas de usuarios:', error);
            throw error;
        }
    }

    /**
     * Obtener métricas de tiempo de respuesta
     */
    async getResponseTimeMetrics(startDate, endDate) {
        try {
            const prisma = this.prismaService.getClient();

            const responseTimeData = await prisma.conversationMetric.aggregate({
                _avg: {
                    firstResponseTime: true,
                    averageResponseTime: true
                },
                _min: {
                    firstResponseTime: true,
                    averageResponseTime: true
                },
                _max: {
                    firstResponseTime: true,
                    averageResponseTime: true
                },
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                }
            });

            const responseTimeDistribution = await this.getResponseTimeDistribution(startDate, endDate);

            return {
                averageFirstResponse: responseTimeData._avg.firstResponseTime || 0,
                averageResponse: responseTimeData._avg.averageResponseTime || 0,
                minFirstResponse: responseTimeData._min.firstResponseTime || 0,
                maxFirstResponse: responseTimeData._max.firstResponseTime || 0,
                minResponse: responseTimeData._min.averageResponseTime || 0,
                maxResponse: responseTimeData._max.averageResponseTime || 0,
                distribution: responseTimeDistribution
            };

        } catch (error) {
            logger.error('Error obteniendo métricas de tiempo de respuesta:', error);
            throw error;
        }
    }

    /**
     * Obtener métricas de satisfacción del cliente
     */
    async getSatisfactionMetrics(startDate, endDate) {
        try {
            const prisma = this.prismaService.getClient();

            const satisfactionData = await prisma.conversationMetric.aggregate({
                _avg: {
                    customerSatisfaction: true
                },
                _count: {
                    customerSatisfaction: true
                },
                where: {
                    customerSatisfaction: { not: null },
                    createdAt: { gte: startDate, lte: endDate }
                }
            });

            const satisfactionDistribution = await prisma.conversationMetric.groupBy({
                by: ['customerSatisfaction'],
                _count: { id: true },
                where: {
                    customerSatisfaction: { not: null },
                    createdAt: { gte: startDate, lte: endDate }
                }
            });

            return {
                average: satisfactionData._avg.customerSatisfaction || 0,
                totalRatings: satisfactionData._count.customerSatisfaction || 0,
                distribution: satisfactionDistribution.reduce((acc, item) => {
                    acc[item.customerSatisfaction] = item._count.id;
                    return acc;
                }, {})
            };

        } catch (error) {
            logger.error('Error obteniendo métricas de satisfacción:', error);
            throw error;
        }
    }

    /**
     * Obtener métricas por canal
     */
    async getChannelMetrics(startDate, endDate) {
        try {
            const prisma = this.prismaService.getClient();

            const channelData = await prisma.conversation.groupBy({
                by: ['channel'],
                _count: { id: true },
                _avg: {
                    messageCount: true
                },
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                }
            });

            const channelTrends = await this.getChannelTrends(startDate, endDate);

            return {
                distribution: channelData.reduce((acc, item) => {
                    acc[item.channel] = {
                        count: item._count.id,
                        averageMessages: item._avg.messageCount || 0
                    };
                    return acc;
                }, {}),
                trends: channelTrends
            };

        } catch (error) {
            logger.error('Error obteniendo métricas por canal:', error);
            throw error;
        }
    }

    /**
     * Obtener KPIs principales
     */
    async getKPIs(timeRange = '24h') {
        try {
            const { startDate, endDate } = this.getTimeRange(timeRange);
            const prisma = this.prismaService.getClient();

            const [
                conversationResolutionRate,
                averageResponseTime,
                customerSatisfactionScore,
                agentUtilization,
                firstContactResolution,
                conversationVolume
            ] = await Promise.all([
                this.getConversationResolutionRate(startDate, endDate),
                this.getAverageResponseTime(startDate, endDate),
                this.getCustomerSatisfactionScore(startDate, endDate),
                this.getAgentUtilization(startDate, endDate),
                this.getFirstContactResolution(startDate, endDate),
                this.getConversationVolume(startDate, endDate)
            ]);

            return {
                conversationResolutionRate: {
                    value: conversationResolutionRate,
                    target: 85,
                    status: conversationResolutionRate >= 85 ? 'good' : conversationResolutionRate >= 70 ? 'warning' : 'critical'
                },
                averageResponseTime: {
                    value: averageResponseTime,
                    target: 300, // 5 minutos
                    status: averageResponseTime <= 300 ? 'good' : averageResponseTime <= 600 ? 'warning' : 'critical'
                },
                customerSatisfactionScore: {
                    value: customerSatisfactionScore,
                    target: 4.0,
                    status: customerSatisfactionScore >= 4.0 ? 'good' : customerSatisfactionScore >= 3.5 ? 'warning' : 'critical'
                },
                agentUtilization: {
                    value: agentUtilization,
                    target: 75,
                    status: agentUtilization >= 60 && agentUtilization <= 85 ? 'good' : 'warning'
                },
                firstContactResolution: {
                    value: firstContactResolution,
                    target: 70,
                    status: firstContactResolution >= 70 ? 'good' : firstContactResolution >= 50 ? 'warning' : 'critical'
                },
                conversationVolume: {
                    value: conversationVolume,
                    trend: await this.getConversationVolumeTrend(startDate, endDate)
                }
            };

        } catch (error) {
            logger.error('Error obteniendo KPIs:', error);
            throw error;
        }
    }

    /**
     * Métodos auxiliares para cálculos específicos
     */

    async getAverageResolutionTime(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        const result = await prisma.conversationMetric.aggregate({
            _avg: { resolutionTime: true },
            where: {
                resolutionTime: { not: null },
                createdAt: { gte: startDate, lte: endDate }
            }
        });
        return result._avg.resolutionTime || 0;
    }

    async getConversationTrends(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        return await prisma.$queryRaw`
            SELECT 
                DATE_TRUNC('hour', created_at) as hour,
                COUNT(*) as count
            FROM conversations 
            WHERE created_at >= ${startDate} AND created_at <= ${endDate}
            GROUP BY DATE_TRUNC('hour', created_at)
            ORDER BY hour
        `;
    }

    async getMessagesByHour(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        return await prisma.$queryRaw`
            SELECT 
                EXTRACT(HOUR FROM created_at) as hour,
                COUNT(*) as count
            FROM messages 
            WHERE created_at >= ${startDate} AND created_at <= ${endDate}
            GROUP BY EXTRACT(HOUR FROM created_at)
            ORDER BY hour
        `;
    }

    async getAverageMessagesPerConversation(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        const result = await prisma.conversation.aggregate({
            _avg: { messageCount: true },
            where: {
                createdAt: { gte: startDate, lte: endDate }
            }
        });
        return result._avg.messageCount || 0;
    }

    async getAgentPerformance(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        return await prisma.$queryRaw`
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
    }

    async getLoginActivity(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        return await prisma.$queryRaw`
            SELECT 
                DATE_TRUNC('day', last_login) as day,
                COUNT(*) as logins
            FROM users 
            WHERE last_login >= ${startDate} AND last_login <= ${endDate}
            GROUP BY DATE_TRUNC('day', last_login)
            ORDER BY day
        `;
    }

    async getResponseTimeDistribution(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        return await prisma.$queryRaw`
            SELECT 
                CASE 
                    WHEN first_response_time <= 60 THEN '0-1min'
                    WHEN first_response_time <= 300 THEN '1-5min'
                    WHEN first_response_time <= 900 THEN '5-15min'
                    WHEN first_response_time <= 3600 THEN '15-60min'
                    ELSE '60min+'
                END as time_range,
                COUNT(*) as count
            FROM conversation_metrics
            WHERE created_at >= ${startDate} AND created_at <= ${endDate}
            AND first_response_time IS NOT NULL
            GROUP BY time_range
            ORDER BY time_range
        `;
    }

    async getChannelTrends(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        return await prisma.$queryRaw`
            SELECT 
                channel,
                DATE_TRUNC('day', created_at) as day,
                COUNT(*) as count
            FROM conversations 
            WHERE created_at >= ${startDate} AND created_at <= ${endDate}
            GROUP BY channel, DATE_TRUNC('day', created_at)
            ORDER BY day, channel
        `;
    }

    // KPI calculation methods
    async getConversationResolutionRate(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        const [total, resolved] = await Promise.all([
            prisma.conversation.count({
                where: { createdAt: { gte: startDate, lte: endDate } }
            }),
            prisma.conversation.count({
                where: {
                    status: 'RESOLVED',
                    createdAt: { gte: startDate, lte: endDate }
                }
            })
        ]);
        return total > 0 ? (resolved / total) * 100 : 0;
    }

    async getAverageResponseTime(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        const result = await prisma.conversationMetric.aggregate({
            _avg: { averageResponseTime: true },
            where: {
                createdAt: { gte: startDate, lte: endDate }
            }
        });
        return result._avg.averageResponseTime || 0;
    }

    async getCustomerSatisfactionScore(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        const result = await prisma.conversationMetric.aggregate({
            _avg: { customerSatisfaction: true },
            where: {
                customerSatisfaction: { not: null },
                createdAt: { gte: startDate, lte: endDate }
            }
        });
        return result._avg.customerSatisfaction || 0;
    }

    async getAgentUtilization(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        const [totalAgents, activeAgents] = await Promise.all([
            prisma.user.count({
                where: { role: { in: ['AGENT', 'SUPERVISOR'] }, isActive: true }
            }),
            prisma.user.count({
                where: {
                    role: { in: ['AGENT', 'SUPERVISOR'] },
                    isActive: true,
                    assignedConversations: {
                        some: {
                            status: { in: ['ACTIVE', 'PENDING'] }
                        }
                    }
                }
            })
        ]);
        return totalAgents > 0 ? (activeAgents / totalAgents) * 100 : 0;
    }

    async getFirstContactResolution(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        const [total, firstContact] = await Promise.all([
            prisma.conversation.count({
                where: { createdAt: { gte: startDate, lte: endDate } }
            }),
            prisma.conversation.count({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                    status: 'RESOLVED',
                    messageCount: { lte: 3 } // Consideramos resolución en primer contacto si hay 3 o menos mensajes
                }
            })
        ]);
        return total > 0 ? (firstContact / total) * 100 : 0;
    }

    async getConversationVolume(startDate, endDate) {
        const prisma = this.prismaService.getClient();
        return await prisma.conversation.count({
            where: { createdAt: { gte: startDate, lte: endDate } }
        });
    }

    async getConversationVolumeTrend(startDate, endDate) {
        // Comparar con período anterior
        const periodDuration = endDate.getTime() - startDate.getTime();
        const previousStartDate = new Date(startDate.getTime() - periodDuration);
        const previousEndDate = startDate;

        const [current, previous] = await Promise.all([
            this.getConversationVolume(startDate, endDate),
            this.getConversationVolume(previousStartDate, previousEndDate)
        ]);

        const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
        return {
            current,
            previous,
            change,
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
        };
    }

    /**
     * Métodos auxiliares
     */

    getTimeRange(timeRange) {
        const endDate = new Date();
        let startDate;

        switch (timeRange) {
            case '1h':
                startDate = new Date(endDate.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        }

        return { startDate, endDate };
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }
}

export default BusinessMetricsService;
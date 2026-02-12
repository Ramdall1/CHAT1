/**
 * =====================================================
 * ChatBot Enterprise - Alert Service
 * =====================================================
 * 
 * Servicio para gestionar alertas de negocio basadas en
 * KPIs y métricas críticas del ChatBot Enterprise.
 */

import BusinessMetricsService from './BusinessMetricsService.js';
import { getPrismaService } from '../../infrastructure/database/PrismaService.js';

class AlertService {
    constructor() {
        this.metricsService = new BusinessMetricsService();
        this.prismaService = getPrismaService();
        this.alertRules = new Map();
        this.activeAlerts = new Map();
        this.notificationChannels = [];
        
        this.initializeDefaultRules();
    }

    /**
     * Inicializar reglas de alerta por defecto
     */
    initializeDefaultRules() {
        // Reglas críticas de negocio
        this.addAlertRule({
            id: 'response_time_critical',
            name: 'Tiempo de Respuesta Crítico',
            description: 'Tiempo de respuesta promedio superior a 10 minutos',
            metric: 'averageResponseTime',
            condition: 'greater_than',
            threshold: 600, // 10 minutos
            severity: 'critical',
            enabled: true,
            cooldown: 300000 // 5 minutos
        });

        this.addAlertRule({
            id: 'satisfaction_low',
            name: 'Satisfacción del Cliente Baja',
            description: 'Puntuación de satisfacción inferior a 3.0',
            metric: 'customerSatisfactionScore',
            condition: 'less_than',
            threshold: 3.0,
            severity: 'warning',
            enabled: true,
            cooldown: 900000 // 15 minutos
        });

        this.addAlertRule({
            id: 'resolution_rate_low',
            name: 'Tasa de Resolución Baja',
            description: 'Tasa de resolución de conversaciones inferior al 70%',
            metric: 'conversationResolutionRate',
            condition: 'less_than',
            threshold: 70,
            severity: 'warning',
            enabled: true,
            cooldown: 1800000 // 30 minutos
        });

        this.addAlertRule({
            id: 'conversation_volume_spike',
            name: 'Pico de Volumen de Conversaciones',
            description: 'Incremento del 50% en el volumen de conversaciones',
            metric: 'conversationVolume',
            condition: 'percentage_increase',
            threshold: 50,
            severity: 'info',
            enabled: true,
            cooldown: 600000 // 10 minutos
        });

        this.addAlertRule({
            id: 'agent_utilization_high',
            name: 'Utilización de Agentes Alta',
            description: 'Utilización de agentes superior al 90%',
            metric: 'agentUtilization',
            condition: 'greater_than',
            threshold: 90,
            severity: 'warning',
            enabled: true,
            cooldown: 600000 // 10 minutos
        });

        this.addAlertRule({
            id: 'pending_conversations_high',
            name: 'Conversaciones Pendientes Altas',
            description: 'Más de 20 conversaciones pendientes',
            metric: 'pendingConversations',
            condition: 'greater_than',
            threshold: 20,
            severity: 'warning',
            enabled: true,
            cooldown: 300000 // 5 minutos
        });
    }

    /**
     * Agregar regla de alerta
     */
    addAlertRule(rule) {
        this.alertRules.set(rule.id, {
            ...rule,
            createdAt: new Date(),
            lastTriggered: null
        });
    }

    /**
     * Actualizar regla de alerta
     */
    updateAlertRule(ruleId, updates) {
        const rule = this.alertRules.get(ruleId);
        if (rule) {
            this.alertRules.set(ruleId, { ...rule, ...updates });
            return true;
        }
        return false;
    }

    /**
     * Eliminar regla de alerta
     */
    removeAlertRule(ruleId) {
        return this.alertRules.delete(ruleId);
    }

    /**
     * Obtener todas las reglas de alerta
     */
    getAlertRules() {
        return Array.from(this.alertRules.values());
    }

    /**
     * Evaluar todas las alertas
     */
    async evaluateAlerts(timeRange = '1h') {
        try {
            const kpis = await this.metricsService.getKPIs(timeRange);
            const dashboardMetrics = await this.metricsService.getDashboardMetrics(timeRange);
            const triggeredAlerts = [];

            for (const [ruleId, rule] of this.alertRules) {
                if (!rule.enabled) continue;

                // Verificar cooldown
                if (this.isInCooldown(rule)) continue;

                const alertTriggered = await this.evaluateRule(rule, kpis, dashboardMetrics);
                
                if (alertTriggered) {
                    const alert = await this.createAlert(rule, kpis, dashboardMetrics);
                    triggeredAlerts.push(alert);
                    
                    // Actualizar última activación
                    rule.lastTriggered = new Date();
                    this.alertRules.set(ruleId, rule);
                }
            }

            // Enviar notificaciones para alertas nuevas
            for (const alert of triggeredAlerts) {
                await this.sendNotification(alert);
            }

            return triggeredAlerts;

        } catch (error) {
            logger.error('Error evaluando alertas:', error);
            throw error;
        }
    }

    /**
     * Evaluar una regla específica
     */
    async evaluateRule(rule, kpis, dashboardMetrics) {
        try {
            let metricValue;

            // Obtener valor de la métrica
            switch (rule.metric) {
                case 'averageResponseTime':
                    metricValue = kpis.averageResponseTime.value;
                    break;
                case 'customerSatisfactionScore':
                    metricValue = kpis.customerSatisfactionScore.value;
                    break;
                case 'conversationResolutionRate':
                    metricValue = kpis.conversationResolutionRate.value;
                    break;
                case 'agentUtilization':
                    metricValue = kpis.agentUtilization.value;
                    break;
                case 'conversationVolume':
                    metricValue = kpis.conversationVolume.value;
                    break;
                case 'pendingConversations':
                    metricValue = dashboardMetrics.conversations.active;
                    break;
                default:
                    logger.warn(`Métrica desconocida: ${rule.metric}`);
                    return false;
            }

            // Evaluar condición
            return this.evaluateCondition(rule.condition, metricValue, rule.threshold, kpis);

        } catch (error) {
            logger.error(`Error evaluando regla ${rule.id}:`, error);
            return false;
        }
    }

    /**
     * Evaluar condición de alerta
     */
    evaluateCondition(condition, value, threshold, kpis) {
        switch (condition) {
            case 'greater_than':
                return value > threshold;
            case 'less_than':
                return value < threshold;
            case 'equals':
                return value === threshold;
            case 'percentage_increase':
                if (kpis.conversationVolume && kpis.conversationVolume.trend) {
                    return kpis.conversationVolume.trend.change > threshold;
                }
                return false;
            case 'percentage_decrease':
                if (kpis.conversationVolume && kpis.conversationVolume.trend) {
                    return kpis.conversationVolume.trend.change < -threshold;
                }
                return false;
            default:
                return false;
        }
    }

    /**
     * Crear alerta
     */
    async createAlert(rule, kpis, dashboardMetrics) {
        const alert = {
            id: `alert_${rule.id}_${Date.now()}`,
            ruleId: rule.id,
            name: rule.name,
            description: rule.description,
            severity: rule.severity,
            status: 'active',
            triggeredAt: new Date(),
            acknowledgedAt: null,
            resolvedAt: null,
            acknowledgedBy: null,
            resolvedBy: null,
            metadata: {
                rule: rule,
                kpis: kpis,
                dashboardMetrics: dashboardMetrics
            }
        };

        // Guardar en memoria activa
        this.activeAlerts.set(alert.id, alert);

        // Persistir en base de datos
        try {
            const prisma = this.prismaService.getClient();
            await prisma.auditLog.create({
                data: {
                    action: 'ALERT_TRIGGERED',
                    entityType: 'ALERT',
                    entityId: alert.id,
                    details: JSON.stringify({
                        alertName: alert.name,
                        severity: alert.severity,
                        ruleId: rule.id,
                        triggeredAt: alert.triggeredAt
                    }),
                    userId: null // Sistema
                }
            });
        } catch (error) {
            logger.error('Error persistiendo alerta:', error);
        }

        return alert;
    }

    /**
     * Verificar si una regla está en cooldown
     */
    isInCooldown(rule) {
        if (!rule.lastTriggered || !rule.cooldown) return false;
        
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        return timeSinceLastTrigger < rule.cooldown;
    }

    /**
     * Reconocer alerta
     */
    async acknowledgeAlert(alertId, userId) {
        try {
            const alert = this.activeAlerts.get(alertId);
            if (!alert) {
                throw new Error('Alerta no encontrada');
            }

            alert.acknowledgedAt = new Date();
            alert.acknowledgedBy = userId;
            alert.status = 'acknowledged';

            this.activeAlerts.set(alertId, alert);

            // Registrar en audit log
            const prisma = this.prismaService.getClient();
            await prisma.auditLog.create({
                data: {
                    action: 'ALERT_ACKNOWLEDGED',
                    entityType: 'ALERT',
                    entityId: alertId,
                    details: JSON.stringify({
                        alertName: alert.name,
                        acknowledgedBy: userId,
                        acknowledgedAt: alert.acknowledgedAt
                    }),
                    userId: userId
                }
            });

            return alert;

        } catch (error) {
            logger.error('Error reconociendo alerta:', error);
            throw error;
        }
    }

    /**
     * Resolver alerta
     */
    async resolveAlert(alertId, userId, resolution) {
        try {
            const alert = this.activeAlerts.get(alertId);
            if (!alert) {
                throw new Error('Alerta no encontrada');
            }

            alert.resolvedAt = new Date();
            alert.resolvedBy = userId;
            alert.status = 'resolved';
            alert.resolution = resolution;

            this.activeAlerts.set(alertId, alert);

            // Registrar en audit log
            const prisma = this.prismaService.getClient();
            await prisma.auditLog.create({
                data: {
                    action: 'ALERT_RESOLVED',
                    entityType: 'ALERT',
                    entityId: alertId,
                    details: JSON.stringify({
                        alertName: alert.name,
                        resolvedBy: userId,
                        resolvedAt: alert.resolvedAt,
                        resolution: resolution
                    }),
                    userId: userId
                }
            });

            return alert;

        } catch (error) {
            logger.error('Error resolviendo alerta:', error);
            throw error;
        }
    }

    /**
     * Obtener alertas activas
     */
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values())
            .filter(alert => alert.status === 'active')
            .sort((a, b) => {
                const severityOrder = { critical: 3, warning: 2, info: 1 };
                return severityOrder[b.severity] - severityOrder[a.severity];
            });
    }

    /**
     * Obtener todas las alertas
     */
    getAllAlerts() {
        return Array.from(this.activeAlerts.values())
            .sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt));
    }

    /**
     * Agregar canal de notificación
     */
    addNotificationChannel(channel) {
        this.notificationChannels.push(channel);
    }

    /**
     * Enviar notificación
     */
    async sendNotification(alert) {
        try {
            const notification = {
                title: `🚨 ${alert.name}`,
                message: alert.description,
                severity: alert.severity,
                timestamp: alert.triggeredAt,
                alertId: alert.id,
                metadata: alert.metadata
            };

            // Enviar a todos los canales configurados
            for (const channel of this.notificationChannels) {
                try {
                    await channel.send(notification);
                } catch (error) {
                    logger.error(`Error enviando notificación por ${channel.name}:`, error);
                }
            }

        } catch (error) {
            logger.error('Error enviando notificación:', error);
        }
    }

    /**
     * Limpiar alertas antiguas
     */
    cleanupOldAlerts(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 días por defecto
        const cutoffTime = Date.now() - maxAge;
        
        for (const [alertId, alert] of this.activeAlerts) {
            if (alert.triggeredAt.getTime() < cutoffTime && alert.status === 'resolved') {
                this.activeAlerts.delete(alertId);
            }
        }
    }

    /**
     * Obtener estadísticas de alertas
     */
    getAlertStatistics(timeRange = '24h') {
        const { startDate } = this.metricsService.getTimeRange(timeRange);
        const alerts = Array.from(this.activeAlerts.values())
            .filter(alert => alert.triggeredAt >= startDate);

        const stats = {
            total: alerts.length,
            active: alerts.filter(a => a.status === 'active').length,
            acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
            resolved: alerts.filter(a => a.status === 'resolved').length,
            bySeverity: {
                critical: alerts.filter(a => a.severity === 'critical').length,
                warning: alerts.filter(a => a.severity === 'warning').length,
                info: alerts.filter(a => a.severity === 'info').length
            },
            byRule: {}
        };

        // Estadísticas por regla
        for (const alert of alerts) {
            if (!stats.byRule[alert.ruleId]) {
                stats.byRule[alert.ruleId] = 0;
            }
            stats.byRule[alert.ruleId]++;
        }

        return stats;
    }

    /**
     * Iniciar monitoreo automático
     */
    startMonitoring(interval = 60000) { // 1 minuto por defecto
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(async () => {
            try {
                await this.evaluateAlerts();
                this.cleanupOldAlerts();
            } catch (error) {
                logger.error('Error en monitoreo automático:', error);
            }
        }, interval);

        logger.info(`Monitoreo de alertas iniciado (intervalo: ${interval}ms)`);
    }

    /**
     * Detener monitoreo automático
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('Monitoreo de alertas detenido');
        }
    }
}

export default AlertService;
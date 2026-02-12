/**
 * =====================================================
 * ChatBot Enterprise - Notification Service
 * =====================================================
 * 
 * Servicio para gestionar notificaciones de alertas
 * a través de múltiples canales (email, Slack, webhook).
 */

import axios from 'axios';
import { getPrismaService } from '../../infrastructure/database/PrismaService.js';

class NotificationService {
    constructor() {
        this.prismaService = getPrismaService();
        this.channels = new Map();
        this.templates = new Map();
        
        this.initializeChannels();
        this.initializeTemplates();
    }

    /**
     * Inicializar canales de notificación
     */
    initializeChannels() {
        // Canal de Slack
        if (process.env.SLACK_WEBHOOK_URL) {
            this.addChannel('slack', new SlackChannel({
                webhookUrl: process.env.SLACK_WEBHOOK_URL,
                channel: process.env.SLACK_CHANNEL || '#alerts',
                username: process.env.SLACK_USERNAME || 'ChatBot Enterprise'
            }));
        }

        // Canal de Webhook genérico
        if (process.env.WEBHOOK_URL) {
            this.addChannel('webhook', new WebhookChannel({
                url: process.env.WEBHOOK_URL,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': process.env.WEBHOOK_AUTH_HEADER
                }
            }));
        }

        // Canal de SMS deshabilitado (Twilio removido)
        // if (process.env.SMS_ENABLED) {
        //     this.addChannel('sms', new SMSChannel({
        //         provider: 'custom'
        //     }));
        // }
    }

    /**
     * Inicializar plantillas de notificación
     */
    initializeTemplates() {
        // Plantilla para alertas críticas
        this.addTemplate('critical_alert', {
            email: {
                subject: '🚨 ALERTA CRÍTICA - {{alertName}}',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
                            <h1>🚨 ALERTA CRÍTICA</h1>
                        </div>
                        <div style="padding: 20px; background-color: #f8f9fa;">
                            <h2>{{alertName}}</h2>
                            <p><strong>Descripción:</strong> {{description}}</p>
                            <p><strong>Severidad:</strong> <span style="color: #dc3545; font-weight: bold;">{{severity}}</span></p>
                            <p><strong>Fecha y Hora:</strong> {{timestamp}}</p>
                            <p><strong>Valor Actual:</strong> {{currentValue}}</p>
                            <p><strong>Umbral:</strong> {{threshold}}</p>
                        </div>
                        <div style="padding: 20px; background-color: #e9ecef; text-align: center;">
                            <p>Esta alerta requiere atención inmediata.</p>
                            <a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Dashboard</a>
                        </div>
                    </div>
                `
            },
            slack: {
                text: '🚨 *ALERTA CRÍTICA*: {{alertName}}',
                attachments: [{
                    color: 'danger',
                    fields: [
                        { title: 'Descripción', value: '{{description}}', short: false },
                        { title: 'Severidad', value: '{{severity}}', short: true },
                        { title: 'Timestamp', value: '{{timestamp}}', short: true },
                        { title: 'Valor Actual', value: '{{currentValue}}', short: true },
                        { title: 'Umbral', value: '{{threshold}}', short: true }
                    ]
                }]
            },
            sms: '🚨 ALERTA CRÍTICA: {{alertName}} - {{description}}. Valor: {{currentValue}}. Revisar dashboard inmediatamente.'
        });

        // Plantilla para alertas de advertencia
        this.addTemplate('warning_alert', {
            email: {
                subject: '⚠️ ADVERTENCIA - {{alertName}}',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #ffc107; color: #212529; padding: 20px; text-align: center;">
                            <h1>⚠️ ADVERTENCIA</h1>
                        </div>
                        <div style="padding: 20px; background-color: #f8f9fa;">
                            <h2>{{alertName}}</h2>
                            <p><strong>Descripción:</strong> {{description}}</p>
                            <p><strong>Severidad:</strong> <span style="color: #ffc107; font-weight: bold;">{{severity}}</span></p>
                            <p><strong>Fecha y Hora:</strong> {{timestamp}}</p>
                            <p><strong>Valor Actual:</strong> {{currentValue}}</p>
                            <p><strong>Umbral:</strong> {{threshold}}</p>
                        </div>
                        <div style="padding: 20px; background-color: #e9ecef; text-align: center;">
                            <p>Se recomienda revisar esta situación.</p>
                            <a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Dashboard</a>
                        </div>
                    </div>
                `
            },
            slack: {
                text: '⚠️ *ADVERTENCIA*: {{alertName}}',
                attachments: [{
                    color: 'warning',
                    fields: [
                        { title: 'Descripción', value: '{{description}}', short: false },
                        { title: 'Severidad', value: '{{severity}}', short: true },
                        { title: 'Timestamp', value: '{{timestamp}}', short: true }
                    ]
                }]
            }
        });

        // Plantilla para alertas informativas
        this.addTemplate('info_alert', {
            email: {
                subject: 'ℹ️ INFORMACIÓN - {{alertName}}',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #17a2b8; color: white; padding: 20px; text-align: center;">
                            <h1>ℹ️ INFORMACIÓN</h1>
                        </div>
                        <div style="padding: 20px; background-color: #f8f9fa;">
                            <h2>{{alertName}}</h2>
                            <p><strong>Descripción:</strong> {{description}}</p>
                            <p><strong>Fecha y Hora:</strong> {{timestamp}}</p>
                        </div>
                    </div>
                `
            },
            slack: {
                text: 'ℹ️ *INFORMACIÓN*: {{alertName}} - {{description}}'
            }
        });
    }

    /**
     * Agregar canal de notificación
     */
    addChannel(name, channel) {
        this.channels.set(name, channel);
    }

    /**
     * Agregar plantilla de notificación
     */
    addTemplate(name, template) {
        this.templates.set(name, template);
    }

    /**
     * Enviar notificación
     */
    async sendNotification(alert, channels = ['slack']) {
        try {
            const templateName = this.getTemplateName(alert.severity);
            const template = this.templates.get(templateName);
            
            if (!template) {
                logger.error(`Plantilla ${templateName} no encontrada`);
                return;
            }

            const context = this.buildNotificationContext(alert);
            const results = [];

            for (const channelName of channels) {
                const channel = this.channels.get(channelName);
                if (!channel) {
                    logger.warn(`Canal ${channelName} no configurado`);
                    continue;
                }

                try {
                    const channelTemplate = template[channelName];
                    if (!channelTemplate) {
                        logger.warn(`Plantilla para canal ${channelName} no encontrada`);
                        continue;
                    }

                    const message = this.renderTemplate(channelTemplate, context);
                    const result = await channel.send(message, context);
                    
                    results.push({
                        channel: channelName,
                        success: true,
                        result
                    });

                    // Registrar envío exitoso
                    await this.logNotification(alert.id, channelName, 'sent', message);

                } catch (error) {
                    logger.error(`Error enviando notificación por ${channelName}:`, error);
                    results.push({
                        channel: channelName,
                        success: false,
                        error: error.message
                    });

                    // Registrar error
                    await this.logNotification(alert.id, channelName, 'failed', null, error.message);
                }
            }

            return results;

        } catch (error) {
            logger.error('Error enviando notificación:', error);
            throw error;
        }
    }

    /**
     * Obtener nombre de plantilla según severidad
     */
    getTemplateName(severity) {
        switch (severity) {
            case 'critical':
                return 'critical_alert';
            case 'warning':
                return 'warning_alert';
            case 'info':
                return 'info_alert';
            default:
                return 'info_alert';
        }
    }

    /**
     * Construir contexto para la notificación
     */
    buildNotificationContext(alert) {
        const metadata = alert.metadata || {};
        const kpis = metadata.kpis || {};
        
        return {
            alertId: alert.id,
            alertName: alert.name,
            description: alert.description,
            severity: alert.severity.toUpperCase(),
            timestamp: new Date(alert.triggeredAt).toLocaleString('es-ES'),
            currentValue: this.getCurrentValue(alert, kpis),
            threshold: this.getThreshold(alert),
            dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
            ...metadata
        };
    }

    /**
     * Obtener valor actual de la métrica
     */
    getCurrentValue(alert, kpis) {
        const rule = alert.metadata?.rule;
        if (!rule) return 'N/A';

        switch (rule.metric) {
            case 'averageResponseTime':
                return `${Math.round(kpis.averageResponseTime?.value || 0)}s`;
            case 'customerSatisfactionScore':
                return `${(kpis.customerSatisfactionScore?.value || 0).toFixed(1)}/5`;
            case 'conversationResolutionRate':
                return `${Math.round(kpis.conversationResolutionRate?.value || 0)}%`;
            case 'agentUtilization':
                return `${Math.round(kpis.agentUtilization?.value || 0)}%`;
            default:
                return 'N/A';
        }
    }

    /**
     * Obtener umbral de la alerta
     */
    getThreshold(alert) {
        const rule = alert.metadata?.rule;
        if (!rule) return 'N/A';

        switch (rule.metric) {
            case 'averageResponseTime':
                return `${rule.threshold}s`;
            case 'customerSatisfactionScore':
                return `${rule.threshold}/5`;
            case 'conversationResolutionRate':
            case 'agentUtilization':
                return `${rule.threshold}%`;
            default:
                return rule.threshold?.toString() || 'N/A';
        }
    }

    /**
     * Renderizar plantilla con contexto
     */
    renderTemplate(template, context) {
        if (typeof template === 'string') {
            return this.replaceVariables(template, context);
        }

        const rendered = {};
        for (const [key, value] of Object.entries(template)) {
            if (typeof value === 'string') {
                rendered[key] = this.replaceVariables(value, context);
            } else if (Array.isArray(value)) {
                rendered[key] = value.map(item => 
                    typeof item === 'object' ? this.renderTemplate(item, context) : item
                );
            } else if (typeof value === 'object') {
                rendered[key] = this.renderTemplate(value, context);
            } else {
                rendered[key] = value;
            }
        }
        return rendered;
    }

    /**
     * Reemplazar variables en texto
     */
    replaceVariables(text, context) {
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return context[key] || match;
        });
    }

    /**
     * Registrar notificación en base de datos
     */
    async logNotification(alertId, channel, status, message, error = null) {
        try {
            const prisma = this.prismaService.getClient();
            await prisma.auditLog.create({
                data: {
                    action: 'NOTIFICATION_SENT',
                    entityType: 'ALERT',
                    entityId: alertId,
                    details: JSON.stringify({
                        channel,
                        status,
                        message: typeof message === 'object' ? JSON.stringify(message) : message,
                        error
                    }),
                    userId: null // Sistema
                }
            });
        } catch (error) {
            logger.error('Error registrando notificación:', error);
        }
    }

    /**
     * Obtener estadísticas de notificaciones
     */
    async getNotificationStats(timeRange = '24h') {
        try {
            const { startDate } = this.getTimeRange(timeRange);
            const prisma = this.prismaService.getClient();

            const logs = await prisma.auditLog.findMany({
                where: {
                    action: 'NOTIFICATION_SENT',
                    createdAt: { gte: startDate }
                }
            });

            const stats = {
                total: logs.length,
                byChannel: {},
                byStatus: { sent: 0, failed: 0 },
                successRate: 0
            };

            for (const log of logs) {
                try {
                    const details = JSON.parse(log.details);
                    const channel = details.channel;
                    const status = details.status;

                    if (!stats.byChannel[channel]) {
                        stats.byChannel[channel] = { sent: 0, failed: 0 };
                    }

                    stats.byChannel[channel][status]++;
                    stats.byStatus[status]++;
                } catch (error) {
                    logger.error('Error procesando log de notificación:', error);
                }
            }

            stats.successRate = stats.total > 0 ? 
                (stats.byStatus.sent / stats.total) * 100 : 0;

            return stats;

        } catch (error) {
            logger.error('Error obteniendo estadísticas de notificaciones:', error);
            throw error;
        }
    }

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
}

/**
 * =====================================================
 * CANALES DE NOTIFICACIÓN
 * =====================================================
 */



/**
 * Canal de Slack
 */
class SlackChannel {
    constructor(config) {
        this.name = 'slack';
        this.webhookUrl = config.webhookUrl;
        this.channel = config.channel;
        this.username = config.username;
    }

    async send(message, context) {
        const payload = {
            channel: this.channel,
            username: this.username,
            text: message.text,
            attachments: message.attachments
        };

        const response = await axios.post(this.webhookUrl, payload);
        return response.data;
    }
}

/**
 * Canal de Webhook
 */
class WebhookChannel {
    constructor(config) {
        this.name = 'webhook';
        this.url = config.url;
        this.headers = config.headers;
    }

    async send(message, context) {
        const payload = {
            alert: context,
            message: message,
            timestamp: new Date().toISOString()
        };

        const response = await axios.post(this.url, payload, {
            headers: this.headers
        });
        
        return response.data;
    }
}

/**
 * Canal de SMS
 */
class SMSChannel {
    constructor(config) {
        this.name = 'sms';
        this.provider = config.provider || 'disabled';
        
        logger.warn('SMS Channel: Twilio removido - funcionalidad SMS deshabilitada');
    }

    async send(message, context) {
        // SMS deshabilitado - Twilio removido
        logger.warn('SMS envío omitido: Twilio removido del proyecto');
        return {
            success: false,
            message: 'SMS deshabilitado - Twilio removido',
            recipients: []
        };
    }

    async getRecipients(severity) {
        // SMS deshabilitado
        return [];
    }
}

export default NotificationService;
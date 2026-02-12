/**
 * Notification Manager Service
 * Gestiona notificaciones del sistema
 */

import { EventEmitter } from 'events';

export class NotificationManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            batchSize: 50,
            queueTimeout: 30000,
            enablePersistence: true,
            ...config
        };
        
        this.channels = new Map();
        this.templates = new Map();
        this.queue = [];
        this.processing = false;
        this.stats = {
            sent: 0,
            failed: 0,
            queued: 0,
            retries: 0
        };
        
        this.setupDefaultChannels();
        this.setupDefaultTemplates();
        this.startQueueProcessor();
    }

    /**
     * Configura canales por defecto
     */
    setupDefaultChannels() {
        // Canal de email
        this.registerChannel('email', {
            type: 'email',
            enabled: false,
            config: {
                smtp: {
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                },
                from: process.env.EMAIL_FROM || 'noreply@chatbot.com'
            },
            send: this.sendEmail.bind(this)
        });
        

        
        // Canal de push notifications
        this.registerChannel('push', {
            type: 'push',
            enabled: false,
            config: {
                fcmServerKey: process.env.FCM_SERVER_KEY,
                apnsCert: process.env.APNS_CERT,
                apnsKey: process.env.APNS_KEY
            },
            send: this.sendPush.bind(this)
        });
        
        // Canal de webhook
        this.registerChannel('webhook', {
            type: 'webhook',
            enabled: true,
            config: {
                timeout: 10000,
                retries: 2
            },
            send: this.sendWebhook.bind(this)
        });
        
        // Canal interno (logs/eventos)
        this.registerChannel('internal', {
            type: 'internal',
            enabled: true,
            config: {},
            send: this.sendInternal.bind(this)
        });
    }

    /**
     * Configura plantillas por defecto
     */
    setupDefaultTemplates() {
        // Plantilla de bienvenida
        this.registerTemplate('welcome', {
            subject: 'Bienvenido a ChatBot',
            body: 'Hola {{name}}, bienvenido a nuestro sistema de chatbot.',
            channels: ['email', 'internal']
        });
        
        // Plantilla de error crítico
        this.registerTemplate('critical_error', {
            subject: 'Error Crítico en ChatBot',
            body: 'Se ha detectado un error crítico: {{error}}. Tiempo: {{timestamp}}',
            channels: ['email', 'webhook', 'internal'],
            priority: 'high'
        });
        
        // Plantilla de alerta de seguridad
        this.registerTemplate('security_alert', {
            subject: 'Alerta de Seguridad',
            body: 'Evento de seguridad detectado: {{event}}. IP: {{ip}}. Tiempo: {{timestamp}}',
            channels: ['email', 'webhook', 'internal'],
            priority: 'critical'
        });
        
        // Plantilla de mantenimiento
        this.registerTemplate('maintenance', {
            subject: 'Mantenimiento Programado',
            body: 'El sistema entrará en mantenimiento el {{date}} a las {{time}}.',
            channels: ['email', 'push', 'internal']
        });
    }

    /**
     * Registra un canal de notificación
     * @param {string} name - Nombre del canal
     * @param {object} channel - Configuración del canal
     */
    registerChannel(name, channel) {
        if (!channel.send || typeof channel.send !== 'function') {
            throw new Error('Channel must have a send method');
        }
        
        this.channels.set(name, {
            ...channel,
            stats: {
                sent: 0,
                failed: 0,
                lastUsed: null
            }
        });
        
        this.emit('channelRegistered', { name, channel });
    }

    /**
     * Registra una plantilla de notificación
     * @param {string} name - Nombre de la plantilla
     * @param {object} template - Configuración de la plantilla
     */
    registerTemplate(name, template) {
        this.templates.set(name, {
            ...template,
            createdAt: new Date(),
            usageCount: 0
        });
        
        this.emit('templateRegistered', { name, template });
    }

    /**
     * Envía una notificación
     * @param {object} notification - Datos de la notificación
     * @returns {Promise<object>} Resultado del envío
     */
    async send(notification) {
        try {
            // Validar notificación
            this.validateNotification(notification);
            
            // Procesar plantilla si se especifica
            const processedNotification = await this.processTemplate(notification);
            
            // Determinar canales
            const channels = this.determineChannels(processedNotification);
            
            // Enviar por cada canal
            const results = await Promise.allSettled(
                channels.map(channel => this.sendToChannel(channel, processedNotification))
            );
            
            // Procesar resultados
            const summary = this.processSendResults(results, channels);
            
            this.emit('notificationSent', {
                notification: processedNotification,
                results: summary
            });
            
            return summary;
            
        } catch (error) {
            this.emit('notificationError', { notification, error });
            throw error;
        }
    }

    /**
     * Envía notificación usando plantilla
     * @param {string} templateName - Nombre de la plantilla
     * @param {object} data - Datos para la plantilla
     * @param {object} options - Opciones adicionales
     * @returns {Promise<object>} Resultado del envío
     */
    async sendFromTemplate(templateName, data = {}, options = {}) {
        const template = this.templates.get(templateName);
        
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }
        
        const notification = {
            template: templateName,
            data,
            ...options
        };
        
        return await this.send(notification);
    }

    /**
     * Añade notificación a la cola
     * @param {object} notification - Notificación a encolar
     * @param {object} options - Opciones de cola
     */
    queue(notification, options = {}) {
        const queueItem = {
            id: this.generateId(),
            notification,
            priority: options.priority || notification.priority || 'normal',
            attempts: 0,
            maxAttempts: options.maxAttempts || this.config.maxRetries,
            scheduledAt: options.scheduledAt || new Date(),
            createdAt: new Date()
        };
        
        this.queue.push(queueItem);
        this.stats.queued++;
        
        // Ordenar por prioridad
        this.sortQueue();
        
        this.emit('notificationQueued', queueItem);
    }

    /**
     * Procesa la cola de notificaciones
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        
        this.processing = true;
        
        try {
            const batch = this.queue.splice(0, this.config.batchSize);
            
            for (const item of batch) {
                try {
                    // Verificar si es tiempo de enviar
                    if (item.scheduledAt > new Date()) {
                        this.queue.unshift(item); // Devolver a la cola
                        continue;
                    }
                    
                    await this.send(item.notification);
                    this.stats.queued--;
                    
                } catch (error) {
                    item.attempts++;
                    
                    if (item.attempts < item.maxAttempts) {
                        // Reintento con delay exponencial
                        item.scheduledAt = new Date(Date.now() + (this.config.retryDelay * Math.pow(2, item.attempts)));
                        this.queue.push(item);
                        this.stats.retries++;
                    } else {
                        // Falló definitivamente
                        this.stats.failed++;
                        this.stats.queued--;
                        this.emit('notificationFailed', { item, error });
                    }
                }
            }
            
        } finally {
            this.processing = false;
        }
    }

    /**
     * Inicia el procesador de cola
     */
    startQueueProcessor() {
        setInterval(() => {
            this.processQueue();
        }, 5000); // Cada 5 segundos
    }

    /**
     * Envía notificación a un canal específico
     * @param {string} channelName - Nombre del canal
     * @param {object} notification - Notificación a enviar
     * @returns {Promise<object>} Resultado del envío
     */
    async sendToChannel(channelName, notification) {
        const channel = this.channels.get(channelName);
        
        if (!channel) {
            throw new Error(`Channel '${channelName}' not found`);
        }
        
        if (!channel.enabled) {
            throw new Error(`Channel '${channelName}' is disabled`);
        }
        
        try {
            const result = await channel.send(notification, channel.config);
            
            // Actualizar estadísticas
            channel.stats.sent++;
            channel.stats.lastUsed = new Date();
            this.stats.sent++;
            
            return {
                channel: channelName,
                success: true,
                result
            };
            
        } catch (error) {
            channel.stats.failed++;
            this.stats.failed++;
            
            throw {
                channel: channelName,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Procesa plantilla de notificación
     * @param {object} notification - Notificación original
     * @returns {object} Notificación procesada
     */
    async processTemplate(notification) {
        if (!notification.template) {
            return notification;
        }
        
        const template = this.templates.get(notification.template);
        
        if (!template) {
            throw new Error(`Template '${notification.template}' not found`);
        }
        
        // Incrementar contador de uso
        template.usageCount++;
        
        // Procesar plantilla
        const processedNotification = {
            ...notification,
            subject: this.interpolateTemplate(template.subject, notification.data || {}),
            body: this.interpolateTemplate(template.body, notification.data || {}),
            channels: notification.channels || template.channels,
            priority: notification.priority || template.priority || 'normal'
        };
        
        return processedNotification;
    }

    /**
     * Interpola variables en plantilla
     * @param {string} template - Plantilla con variables
     * @param {object} data - Datos para interpolación
     * @returns {string} Texto interpolado
     */
    interpolateTemplate(template, data) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] || match;
        });
    }

    /**
     * Determina canales para una notificación
     * @param {object} notification - Notificación
     * @returns {array} Lista de canales
     */
    determineChannels(notification) {
        if (notification.channels) {
            return notification.channels.filter(channel => this.channels.has(channel));
        }
        
        // Canales por defecto según prioridad
        switch (notification.priority) {
            case 'critical':
                return ['email', 'webhook', 'internal'];
            case 'high':
                return ['email', 'internal'];
            case 'normal':
                return ['internal'];
            default:
                return ['internal'];
        }
    }

    /**
     * Valida estructura de notificación
     * @param {object} notification - Notificación a validar
     */
    validateNotification(notification) {
        if (!notification) {
            throw new Error('Notification is required');
        }
        
        if (!notification.template && !notification.body) {
            throw new Error('Notification must have template or body');
        }
        
        if (notification.recipients && !Array.isArray(notification.recipients)) {
            throw new Error('Recipients must be an array');
        }
    }

    /**
     * Procesa resultados de envío
     * @param {array} results - Resultados de Promise.allSettled
     * @param {array} channels - Canales utilizados
     * @returns {object} Resumen de resultados
     */
    processSendResults(results, channels) {
        const summary = {
            total: results.length,
            successful: 0,
            failed: 0,
            results: []
        };
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                summary.successful++;
                summary.results.push(result.value);
            } else {
                summary.failed++;
                summary.results.push({
                    channel: channels[index],
                    success: false,
                    error: result.reason.message || result.reason
                });
            }
        });
        
        return summary;
    }

    /**
     * Ordena cola por prioridad
     */
    sortQueue() {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        
        this.queue.sort((a, b) => {
            const aPriority = priorityOrder[a.priority] || 2;
            const bPriority = priorityOrder[b.priority] || 2;
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            return a.scheduledAt - b.scheduledAt;
        });
    }





    /**
     * Implementación de envío por push
     * @param {object} notification - Notificación
     * @param {object} config - Configuración del canal
     * @returns {Promise<object>} Resultado
     */
    async sendPush(notification, config) {
        // Implementación básica - en producción usar FCM/APNS
        logger.debug('Sending push notification:', {
            to: notification.recipients,
            title: notification.subject,
            body: notification.body
        });
        
        return { messageId: this.generateId(), status: 'sent' };
    }

    /**
     * Implementación de envío por webhook
     * @param {object} notification - Notificación
     * @param {object} config - Configuración del canal
     * @returns {Promise<object>} Resultado
     */
    async sendWebhook(notification, config) {
        // Implementación básica - en producción usar axios
        logger.debug('Sending webhook:', {
            url: notification.webhookUrl,
            payload: {
                subject: notification.subject,
                body: notification.body,
                priority: notification.priority
            }
        });
        
        return { status: 'sent', timestamp: new Date() };
    }

    /**
     * Implementación de notificación interna
     * @param {object} notification - Notificación
     * @param {object} config - Configuración del canal
     * @returns {Promise<object>} Resultado
     */
    async sendInternal(notification, config) {
        this.emit('internalNotification', notification);
        
        logger.debug('Internal notification:', {
            subject: notification.subject,
            body: notification.body,
            priority: notification.priority
        });
        
        return { status: 'logged', timestamp: new Date() };
    }

    /**
     * Genera ID único
     * @returns {string} ID único
     */
    generateId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtiene estadísticas
     * @returns {object} Estadísticas
     */
    getStats() {
        const channelStats = {};
        
        for (const [name, channel] of this.channels) {
            channelStats[name] = channel.stats;
        }
        
        return {
            ...this.stats,
            queueSize: this.queue.length,
            channels: channelStats,
            templates: this.templates.size,
            processing: this.processing
        };
    }

    /**
     * Limpia cola de notificaciones antiguas
     * @param {number} maxAge - Edad máxima en milisegundos
     */
    cleanupQueue(maxAge = 24 * 60 * 60 * 1000) { // 24 horas
        const cutoff = new Date(Date.now() - maxAge);
        const originalLength = this.queue.length;
        
        this.queue = this.queue.filter(item => item.createdAt > cutoff);
        
        const cleaned = originalLength - this.queue.length;
        if (cleaned > 0) {
            logger.debug(`Cleaned up ${cleaned} old notifications from queue`);
        }
    }
}

// Instancia singleton
const notificationManager = new NotificationManager();

export default notificationManager;
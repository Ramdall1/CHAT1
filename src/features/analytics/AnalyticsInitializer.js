/**
 * =====================================================
 * ChatBot Enterprise - Analytics Initializer
 * =====================================================
 * 
 * Inicializador del sistema de analytics y métricas de negocio.
 */

import cron from 'node-cron';
import { promises as fs } from 'fs';
import path from 'path';

import { analyticsConfig, defaultAlertRules } from '../../config/analytics.js';
import BusinessMetricsService from './BusinessMetricsService.js';
import AlertService from './AlertService.js';
import DashboardService from './DashboardService.js';
import NotificationService from './NotificationService.js';
import ReportService from './ReportService.js';

/**
 * Inicializador del Sistema de Analytics
 */
class AnalyticsInitializer {
    constructor() {
        this.services = {};
        this.scheduledTasks = [];
        this.isInitialized = false;
    }

    /**
     * Inicializar el sistema de analytics
     */
    async initialize() {
        try {
            logger.info('🚀 Inicializando sistema de analytics...');

            // 1. Crear directorios necesarios
            await this.createDirectories();

            // 2. Inicializar servicios
            await this.initializeServices();

            // 3. Configurar reglas de alerta predefinidas
            await this.setupDefaultAlertRules();

            // 4. Configurar tareas programadas
            await this.setupScheduledTasks();

            // 5. Configurar canales de notificación
            await this.setupNotificationChannels();

            this.isInitialized = true;
            logger.info('✅ Sistema de analytics inicializado correctamente');

            return {
                success: true,
                message: 'Sistema de analytics inicializado correctamente',
                services: Object.keys(this.services)
            };
        } catch (error) {
            logger.error('❌ Error inicializando sistema de analytics:', error);
            throw error;
        }
    }

    /**
     * Crear directorios necesarios
     */
    async createDirectories() {
        const directories = [
            analyticsConfig.reports.storage.directory,
            analyticsConfig.logging.files.directory,
            path.join(process.cwd(), 'storage', 'cache', 'analytics'),
            path.join(process.cwd(), 'storage', 'exports')
        ];

        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
                logger.info(`📁 Directorio creado: ${dir}`);
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    logger.error(`❌ Error creando directorio ${dir}:`, error);
                    throw error;
                }
            }
        }
    }

    /**
     * Inicializar servicios de analytics
     */
    async initializeServices() {
        logger.info('🔧 Inicializando servicios de analytics...');

        // Inicializar servicios en orden de dependencia
        this.services.businessMetrics = new BusinessMetricsService();
        this.services.alert = new AlertService();
        this.services.dashboard = new DashboardService();
        this.services.notification = new NotificationService();
        this.services.report = new ReportService();

        // Inicializar cada servicio
        for (const [name, service] of Object.entries(this.services)) {
            if (typeof service.initialize === 'function') {
                await service.initialize();
                logger.info(`✅ Servicio ${name} inicializado`);
            }
        }
    }

    /**
     * Configurar reglas de alerta predefinidas
     */
    async setupDefaultAlertRules() {
        if (!analyticsConfig.alerts.enabled) {
            logger.info('⚠️ Alertas deshabilitadas, omitiendo configuración de reglas');
            return;
        }

        logger.info('📋 Configurando reglas de alerta predefinidas...');

        const alertService = this.services.alert;
        const existingRules = alertService.getAlertRules();

        for (const rule of defaultAlertRules) {
            // Verificar si la regla ya existe
            const existingRule = existingRules.find(r => r.name === rule.name);
            
            if (!existingRule) {
                await alertService.addAlertRule(rule);
                logger.info(`✅ Regla de alerta agregada: ${rule.name}`);
            } else {
                logger.info(`ℹ️ Regla de alerta ya existe: ${rule.name}`);
            }
        }
    }

    /**
     * Configurar tareas programadas
     */
    async setupScheduledTasks() {
        logger.info('⏰ Configurando tareas programadas...');

        // Tarea de evaluación de alertas (cada 5 minutos)
        if (analyticsConfig.alerts.enabled) {
            const alertTask = cron.schedule('*/5 * * * *', async () => {
                try {
                    await this.services.alert.evaluateAlerts();
                } catch (error) {
                    logger.error('Error en evaluación de alertas:', error);
                }
            }, { scheduled: false });

            this.scheduledTasks.push({
                name: 'alert-evaluation',
                task: alertTask,
                schedule: '*/5 * * * *'
            });
        }

        // Tarea de limpieza de caché (cada hora)
        const cacheCleanupTask = cron.schedule('0 * * * *', async () => {
            try {
                await this.services.businessMetrics.clearExpiredCache();
            } catch (error) {
                logger.error('Error en limpieza de caché:', error);
            }
        }, { scheduled: false });

        this.scheduledTasks.push({
            name: 'cache-cleanup',
            task: cacheCleanupTask,
            schedule: '0 * * * *'
        });

        // Tarea de limpieza de reportes antiguos (diariamente a las 2 AM)
        if (analyticsConfig.reports.enabled) {
            const reportCleanupTask = cron.schedule('0 2 * * *', async () => {
                try {
                    await this.services.report.cleanupOldReports();
                } catch (error) {
                    logger.error('Error en limpieza de reportes:', error);
                }
            }, { scheduled: false });

            this.scheduledTasks.push({
                name: 'report-cleanup',
                task: reportCleanupTask,
                schedule: '0 2 * * *'
            });
        }

        // Tarea de limpieza de alertas resueltas (diariamente a las 3 AM)
        if (analyticsConfig.alerts.enabled) {
            const alertCleanupTask = cron.schedule('0 3 * * *', async () => {
                try {
                    await this.services.alert.cleanupOldAlerts();
                } catch (error) {
                    logger.error('Error en limpieza de alertas:', error);
                }
            }, { scheduled: false });

            this.scheduledTasks.push({
                name: 'alert-cleanup',
                task: alertCleanupTask,
                schedule: '0 3 * * *'
            });
        }

        logger.info(`✅ ${this.scheduledTasks.length} tareas programadas configuradas`);
    }

    /**
     * Configurar canales de notificación
     */
    async setupNotificationChannels() {
        if (!analyticsConfig.alerts.notifications.enabled) {
            logger.info('⚠️ Notificaciones deshabilitadas, omitiendo configuración de canales');
            return;
        }

        logger.info('📢 Configurando canales de notificación...');

        const notificationService = this.services.notification;
        const channels = analyticsConfig.alerts.notifications.channels;

        // Configurar canal de email
        if (channels.email.enabled && channels.email.smtp.host) {
            await notificationService.addChannel('email', {
                type: 'email',
                config: channels.email
            });
            logger.info('✅ Canal de email configurado');
        }

        // Configurar canal de Slack
        if (channels.slack.enabled && channels.slack.webhookUrl) {
            await notificationService.addChannel('slack', {
                type: 'slack',
                config: channels.slack
            });
            logger.info('✅ Canal de Slack configurado');
        }

        // Configurar canal de webhook
        if (channels.webhook.enabled && channels.webhook.url) {
            await notificationService.addChannel('webhook', {
                type: 'webhook',
                config: channels.webhook
            });
            logger.info('✅ Canal de webhook configurado');
        }

        // Canal de SMS deshabilitado (Twilio removido)
        if (channels.sms.enabled && false) { // SMS deshabilitado - Twilio removido
            logger.warn('📱 Canal de SMS deshabilitado - Twilio removido del proyecto');
        }
    }

    /**
     * Iniciar tareas programadas
     */
    startScheduledTasks() {
        if (!this.isInitialized) {
            throw new Error('Sistema de analytics no inicializado');
        }

        logger.info('▶️ Iniciando tareas programadas...');

        for (const { name, task } of this.scheduledTasks) {
            task.start();
            logger.info(`✅ Tarea iniciada: ${name}`);
        }

        logger.info(`✅ ${this.scheduledTasks.length} tareas programadas iniciadas`);
    }

    /**
     * Detener tareas programadas
     */
    stopScheduledTasks() {
        logger.info('⏹️ Deteniendo tareas programadas...');

        for (const { name, task } of this.scheduledTasks) {
            task.stop();
            logger.info(`✅ Tarea detenida: ${name}`);
        }

        logger.info('✅ Todas las tareas programadas detenidas');
    }

    /**
     * Obtener estado del sistema
     */
    getSystemStatus() {
        return {
            initialized: this.isInitialized,
            services: Object.keys(this.services),
            scheduledTasks: this.scheduledTasks.map(t => ({
                name: t.name,
                schedule: t.schedule,
                running: t.task.running
            })),
            config: {
                cache: analyticsConfig.cache,
                alerts: analyticsConfig.alerts.enabled,
                reports: analyticsConfig.reports.enabled,
                dashboards: analyticsConfig.dashboards.enabled
            }
        };
    }

    /**
     * Obtener servicio por nombre
     */
    getService(serviceName) {
        if (!this.isInitialized) {
            throw new Error('Sistema de analytics no inicializado');
        }

        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Servicio no encontrado: ${serviceName}`);
        }

        return service;
    }

    /**
     * Reinicializar sistema
     */
    async reinitialize() {
        logger.info('🔄 Reinicializando sistema de analytics...');

        // Detener tareas programadas
        this.stopScheduledTasks();

        // Limpiar servicios
        this.services = {};
        this.scheduledTasks = [];
        this.isInitialized = false;

        // Reinicializar
        await this.initialize();
        this.startScheduledTasks();

        logger.info('✅ Sistema de analytics reinicializado');
    }

    /**
     * Shutdown graceful del sistema
     */
    async shutdown() {
        logger.info('🛑 Cerrando sistema de analytics...');

        // Detener tareas programadas
        this.stopScheduledTasks();

        // Cerrar servicios que lo requieran
        for (const [name, service] of Object.entries(this.services)) {
            if (typeof service.shutdown === 'function') {
                await service.shutdown();
                logger.info(`✅ Servicio ${name} cerrado`);
            }
        }

        this.isInitialized = false;
        logger.info('✅ Sistema de analytics cerrado correctamente');
    }
}

// Singleton instance
let analyticsInitializer = null;

/**
 * Obtener instancia singleton del inicializador
 */
function getAnalyticsInitializer() {
    if (!analyticsInitializer) {
        analyticsInitializer = new AnalyticsInitializer();
    }
    return analyticsInitializer;
}

export {
    AnalyticsInitializer,
    getAnalyticsInitializer
};

export default getAnalyticsInitializer;
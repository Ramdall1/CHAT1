/**
 * Sistema de Cola de Mensajes con Bull
 * Fecha: 27 de Octubre, 2025
 * Version: 1.0.0
 * 
 * Este servicio maneja el procesamiento asíncrono de mensajes
 * para evitar bloqueos y pérdida de mensajes en alta carga
 */

import Bull from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { createLogger } from '../../core/core/logger.js';

const logger = createLogger('MESSAGE_QUEUE');

class MessageQueueService {
    constructor() {
        this.queues = {};
        this.isInitialized = false;
        this.serverAdapter = new ExpressAdapter();
        this.serverAdapter.setBasePath('/admin/queues');
        
        // Configuración de Redis (usar Redis local o remoto)
        this.redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            db: process.env.REDIS_DB || 0,
            maxRetriesPerRequest: 3,
            enableReadyCheck: false,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        };
        
        // Configuración por defecto de las colas
        this.defaultJobOptions = {
            removeOnComplete: 100, // Mantener últimos 100 jobs completados
            removeOnFail: 500,     // Mantener últimos 500 jobs fallidos
            attempts: 3,           // 3 intentos por defecto
            backoff: {
                type: 'exponential',
                delay: 5000
            }
        };
    }

    /**
     * Inicializar el servicio de colas
     */
    async initialize() {
        if (this.isInitialized) {
            logger.warn('MessageQueueService ya inicializado');
            return;
        }

        try {
            // Crear colas principales
            await this.createQueue('messages', {
                concurrency: 10,
                limiter: {
                    max: 60,        // Máximo 60 jobs
                    duration: 60000 // Por minuto
                }
            });

            await this.createQueue('campaigns', {
                concurrency: 5,
                limiter: {
                    max: 30,
                    duration: 60000
                }
            });

            await this.createQueue('notifications', {
                concurrency: 20,
                limiter: {
                    max: 100,
                    duration: 60000
                }
            });

            await this.createQueue('webhooks', {
                concurrency: 15,
                limiter: {
                    max: 50,
                    duration: 60000
                }
            });

            await this.createQueue('reports', {
                concurrency: 3,
                limiter: {
                    max: 10,
                    duration: 60000
                }
            });

            // Configurar Bull Board para monitoreo
            this.setupBullBoard();

            // Configurar procesadores
            this.setupProcessors();

            // Configurar event listeners
            this.setupEventListeners();

            this.isInitialized = true;
            logger.info('✅ MessageQueueService inicializado correctamente');
            
            // Mostrar estadísticas
            this.logQueueStats();

        } catch (error) {
            logger.error('Error inicializando MessageQueueService:', error);
            throw error;
        }
    }

    /**
     * Crear una nueva cola
     */
    async createQueue(name, options = {}) {
        if (this.queues[name]) {
            logger.warn(`Cola ${name} ya existe`);
            return this.queues[name];
        }

        try {
            const queue = new Bull(name, {
                redis: this.redisConfig,
                defaultJobOptions: this.defaultJobOptions,
                ...options
            });

            this.queues[name] = queue;
            logger.info(`📬 Cola '${name}' creada exitosamente`);
            
            return queue;
        } catch (error) {
            logger.error(`Error creando cola ${name}:`, error);
            throw error;
        }
    }

    /**
     * Configurar Bull Board para monitoreo visual
     */
    setupBullBoard() {
        const bullAdapters = Object.keys(this.queues).map(
            queueName => new BullAdapter(this.queues[queueName])
        );

        createBullBoard({
            queues: bullAdapters,
            serverAdapter: this.serverAdapter
        });

        logger.info('📊 Bull Board configurado en /admin/queues');
    }

    /**
     * Configurar procesadores para cada cola
     */
    setupProcessors() {
        // Procesador de mensajes
        this.queues.messages?.process(async (job) => {
            const { type, data } = job.data;
            logger.info(`Procesando mensaje: ${type}`, { jobId: job.id });

            try {
                switch (type) {
                    case 'whatsapp':
                        return await this.processWhatsAppMessage(data);
                    case 'sms':
                        return await this.processSMSMessage(data);
                    case 'email':
                        return await this.processEmailMessage(data);
                    default:
                        throw new Error(`Tipo de mensaje no soportado: ${type}`);
                }
            } catch (error) {
                logger.error(`Error procesando mensaje ${job.id}:`, error);
                throw error;
            }
        });

        // Procesador de campañas
        this.queues.campaigns?.process(async (job) => {
            const { campaignId, action, data } = job.data;
            logger.info(`Procesando campaña ${campaignId}: ${action}`);

            try {
                switch (action) {
                    case 'start':
                        return await this.startCampaign(campaignId, data);
                    case 'pause':
                        return await this.pauseCampaign(campaignId);
                    case 'resume':
                        return await this.resumeCampaign(campaignId);
                    case 'stop':
                        return await this.stopCampaign(campaignId);
                    default:
                        throw new Error(`Acción no soportada: ${action}`);
                }
            } catch (error) {
                logger.error(`Error en campaña ${campaignId}:`, error);
                throw error;
            }
        });

        // Procesador de webhooks
        this.queues.webhooks?.process(async (job) => {
            const { url, payload, headers } = job.data;
            logger.info(`Procesando webhook: ${url}`);

            try {
                // Aquí iría la lógica para procesar webhooks
                return { success: true, url };
            } catch (error) {
                logger.error(`Error en webhook ${url}:`, error);
                throw error;
            }
        });

        // Procesador de reportes
        this.queues.reports?.process(async (job) => {
            const { reportType, parameters } = job.data;
            logger.info(`Generando reporte: ${reportType}`);

            try {
                // Aquí iría la lógica para generar reportes
                return { success: true, reportType };
            } catch (error) {
                logger.error(`Error generando reporte ${reportType}:`, error);
                throw error;
            }
        });
    }

    /**
     * Configurar event listeners para monitoreo
     */
    setupEventListeners() {
        Object.entries(this.queues).forEach(([name, queue]) => {
            queue.on('completed', (job, result) => {
                logger.info(`✅ Job completado en ${name}:`, {
                    jobId: job.id,
                    duration: Date.now() - job.timestamp
                });
            });

            queue.on('failed', (job, err) => {
                logger.error(`❌ Job fallido en ${name}:`, {
                    jobId: job.id,
                    error: err.message,
                    attempts: job.attemptsMade
                });
            });

            queue.on('stalled', (job) => {
                logger.warn(`⚠️ Job estancado en ${name}:`, {
                    jobId: job.id
                });
            });

            queue.on('error', (error) => {
                logger.error(`Error en cola ${name}:`, error);
            });

            queue.on('waiting', (jobId) => {
                logger.debug(`Job ${jobId} esperando en ${name}`);
            });

            queue.on('active', (job) => {
                logger.debug(`Job ${job.id} activo en ${name}`);
            });
        });
    }

    /**
     * Agregar un mensaje a la cola
     */
    async addMessage(type, data, options = {}) {
        const queue = this.queues.messages;
        if (!queue) {
            throw new Error('Cola de mensajes no inicializada');
        }

        const job = await queue.add(
            { type, data, timestamp: Date.now() },
            {
                priority: options.priority || 0,
                delay: options.delay || 0,
                attempts: options.attempts || this.defaultJobOptions.attempts,
                ...options
            }
        );

        logger.info(`📨 Mensaje agregado a la cola: ${job.id}`);
        return job.id;
    }

    /**
     * Agregar una campaña a la cola
     */
    async addCampaign(campaignId, action, data = {}, options = {}) {
        const queue = this.queues.campaigns;
        if (!queue) {
            throw new Error('Cola de campañas no inicializada');
        }

        const job = await queue.add(
            { campaignId, action, data, timestamp: Date.now() },
            {
                priority: options.priority || 0,
                delay: options.delay || 0,
                ...options
            }
        );

        logger.info(`📢 Campaña agregada a la cola: ${job.id}`);
        return job.id;
    }

    /**
     * Procesar mensaje de WhatsApp
     */
    async processWhatsAppMessage(data) {
        // Implementación simulada - conectar con servicio real
        logger.info('Procesando mensaje WhatsApp:', data.phone);
        
        // Simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
            success: true,
            messageId: `wa_${Date.now()}`,
            phone: data.phone
        };
    }

    /**
     * Procesar mensaje SMS
     */
    async processSMSMessage(data) {
        logger.info('Procesando mensaje SMS:', data.phone);
        
        // Simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            success: true,
            messageId: `sms_${Date.now()}`,
            phone: data.phone
        };
    }

    /**
     * Procesar mensaje de Email
     */
    async processEmailMessage(data) {
        logger.info('Procesando email:', data.email);
        
        // Simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
            success: true,
            messageId: `email_${Date.now()}`,
            email: data.email
        };
    }

    /**
     * Iniciar una campaña
     */
    async startCampaign(campaignId, data) {
        logger.info(`Iniciando campaña ${campaignId}`);
        
        // Aquí iría la lógica real de inicio de campaña
        // Por ahora, agregar mensajes individuales a la cola
        if (data.contacts && Array.isArray(data.contacts)) {
            for (const contact of data.contacts) {
                await this.addMessage('whatsapp', {
                    phone: contact.phone,
                    message: data.message,
                    campaignId
                }, {
                    priority: 1,
                    delay: Math.random() * 5000 // Distribuir en 5 segundos
                });
            }
        }
        
        return { success: true, campaignId };
    }

    /**
     * Pausar una campaña
     */
    async pauseCampaign(campaignId) {
        logger.info(`Pausando campaña ${campaignId}`);
        // Implementar lógica de pausa
        return { success: true, campaignId };
    }

    /**
     * Reanudar una campaña
     */
    async resumeCampaign(campaignId) {
        logger.info(`Reanudando campaña ${campaignId}`);
        // Implementar lógica de reanudación
        return { success: true, campaignId };
    }

    /**
     * Detener una campaña
     */
    async stopCampaign(campaignId) {
        logger.info(`Deteniendo campaña ${campaignId}`);
        // Implementar lógica de detención
        return { success: true, campaignId };
    }

    /**
     * Obtener estadísticas de las colas
     */
    async getQueueStats() {
        const stats = {};

        for (const [name, queue] of Object.entries(this.queues)) {
            const counts = await queue.getJobCounts();
            stats[name] = {
                waiting: counts.waiting || 0,
                active: counts.active || 0,
                completed: counts.completed || 0,
                failed: counts.failed || 0,
                delayed: counts.delayed || 0,
                paused: counts.paused || 0
            };
        }

        return stats;
    }

    /**
     * Limpiar colas (jobs completados y fallidos)
     */
    async cleanQueues(grace = 3600000) { // 1 hora por defecto
        const results = {};

        for (const [name, queue] of Object.entries(this.queues)) {
            try {
                const completed = await queue.clean(grace, 'completed');
                const failed = await queue.clean(grace, 'failed');
                
                results[name] = {
                    completedRemoved: completed.length,
                    failedRemoved: failed.length
                };

                logger.info(`🧹 Cola ${name} limpiada:`, results[name]);
            } catch (error) {
                logger.error(`Error limpiando cola ${name}:`, error);
                results[name] = { error: error.message };
            }
        }

        return results;
    }

    /**
     * Pausar todas las colas
     */
    async pauseAll() {
        const results = [];
        for (const [name, queue] of Object.entries(this.queues)) {
            await queue.pause();
            results.push(name);
            logger.info(`⏸️ Cola ${name} pausada`);
        }
        return results;
    }

    /**
     * Reanudar todas las colas
     */
    async resumeAll() {
        const results = [];
        for (const [name, queue] of Object.entries(this.queues)) {
            await queue.resume();
            results.push(name);
            logger.info(`▶️ Cola ${name} reanudada`);
        }
        return results;
    }

    /**
     * Registrar estadísticas periódicamente
     */
    logQueueStats() {
        setInterval(async () => {
            try {
                const stats = await this.getQueueStats();
                logger.info('📊 Estadísticas de colas:', stats);
            } catch (error) {
                logger.error('Error obteniendo estadísticas:', error);
            }
        }, 60000); // Cada minuto
    }

    /**
     * Obtener el adaptador del servidor para Express
     */
    getServerAdapter() {
        return this.serverAdapter;
    }

    /**
     * Cerrar todas las conexiones
     */
    async shutdown() {
        logger.info('Cerrando MessageQueueService...');
        
        for (const [name, queue] of Object.entries(this.queues)) {
            await queue.close();
            logger.info(`Cola ${name} cerrada`);
        }

        this.isInitialized = false;
        logger.info('✅ MessageQueueService cerrado correctamente');
    }
}

// Exportar instancia única (Singleton)
const messageQueueService = new MessageQueueService();
export default messageQueueService;

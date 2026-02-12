/**
 * Servicio Alternativo de Cache y Queue en Memoria
 * Fallback cuando Redis no está disponible
 * Fecha: 27 de Octubre, 2025
 */

import NodeCache from 'node-cache';
import { createLogger } from '../../core/core/logger.js';

const logger = createLogger('CACHE_SERVICE');

class InMemoryQueueService {
    constructor() {
        this.queues = new Map();
        this.cache = new NodeCache({
            stdTTL: 600, // 10 minutos por defecto
            checkperiod: 120,
            useClones: false
        });
        this.isRedisAvailable = false;
        this.stats = {
            processed: 0,
            failed: 0,
            pending: 0
        };
    }

    async initialize() {
        logger.info('🎯 Inicializando servicio de cola en memoria (Redis no disponible)');
        
        // Crear colas principales
        this.createQueue('messages');
        this.createQueue('campaigns');
        this.createQueue('notifications');
        this.createQueue('webhooks');
        this.createQueue('reports');
        
        // Iniciar procesamiento
        this.startProcessing();
        
        logger.info('✅ Servicio de cola en memoria inicializado');
        return this;
    }

    createQueue(name) {
        if (!this.queues.has(name)) {
            this.queues.set(name, {
                items: [],
                processing: false,
                processor: null
            });
            logger.info(`📦 Cola '${name}' creada en memoria`);
        }
        return this.queues.get(name);
    }

    async add(queueName, data, options = {}) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Cola ${queueName} no existe`);
        }

        const job = {
            id: `${queueName}_${Date.now()}_${Math.random()}`,
            data,
            options,
            attempts: 0,
            maxAttempts: options.attempts || 3,
            createdAt: Date.now(),
            status: 'pending'
        };

        queue.items.push(job);
        this.stats.pending++;
        
        logger.debug(`Job ${job.id} agregado a cola ${queueName}`);
        return job.id;
    }

    async process(queueName, processor) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Cola ${queueName} no existe`);
        }
        
        queue.processor = processor;
        logger.info(`Procesador configurado para cola ${queueName}`);
    }

    startProcessing() {
        setInterval(() => {
            this.queues.forEach((queue, queueName) => {
                if (!queue.processing && queue.items.length > 0 && queue.processor) {
                    this.processNextJob(queueName);
                }
            });
        }, 1000); // Procesar cada segundo
    }

    async processNextJob(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue || queue.processing) return;

        const job = queue.items.find(j => j.status === 'pending');
        if (!job) return;

        queue.processing = true;
        job.status = 'processing';
        job.attempts++;

        try {
            const result = await queue.processor(job);
            job.status = 'completed';
            job.result = result;
            this.stats.processed++;
            this.stats.pending--;
            
            // Eliminar job completado después de un tiempo
            setTimeout(() => {
                const index = queue.items.indexOf(job);
                if (index > -1) queue.items.splice(index, 1);
            }, 60000); // Mantener por 1 minuto

            logger.info(`✅ Job ${job.id} completado`);
        } catch (error) {
            if (job.attempts < job.maxAttempts) {
                job.status = 'pending'; // Reintentar
                job.nextRetry = Date.now() + (5000 * job.attempts); // Backoff
                logger.warn(`⚠️ Job ${job.id} falló, reintentando...`);
            } else {
                job.status = 'failed';
                job.error = error.message;
                this.stats.failed++;
                this.stats.pending--;
                logger.error(`❌ Job ${job.id} falló definitivamente:`, error);
            }
        } finally {
            queue.processing = false;
        }
    }

    async getStats() {
        const queueStats = {};
        this.queues.forEach((queue, name) => {
            queueStats[name] = {
                pending: queue.items.filter(j => j.status === 'pending').length,
                processing: queue.items.filter(j => j.status === 'processing').length,
                completed: queue.items.filter(j => j.status === 'completed').length,
                failed: queue.items.filter(j => j.status === 'failed').length,
                total: queue.items.length
            };
        });

        return {
            global: this.stats,
            queues: queueStats,
            cache: this.cache.getStats()
        };
    }

    // Métodos de cache
    async set(key, value, ttl) {
        return this.cache.set(key, value, ttl);
    }

    async get(key) {
        return this.cache.get(key);
    }

    async del(key) {
        return this.cache.del(key);
    }

    async flush() {
        this.cache.flushAll();
        this.queues.forEach(queue => {
            queue.items = [];
        });
        logger.info('🧹 Cache y colas limpiadas');
    }
}

// Exportar singleton
const queueService = new InMemoryQueueService();
export default queueService;

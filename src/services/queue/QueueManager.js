/**
 * Queue Manager - Adaptador Inteligente
 * Utiliza Redis si está disponible, sino usa alternativa en memoria
 * Fecha: 27 de Octubre, 2025
 */

import { createLogger } from '../../core/core/logger.js';
import InMemoryQueueService from './RedisAlternative.js';

const logger = createLogger('QUEUE_MANAGER');

class QueueManager {
    constructor() {
        this.service = null;
        this.isInitialized = false;
        this.useRedis = false;
    }

    async initialize() {
        if (this.isInitialized) return this.service;

        try {
            // Intentar conectar a Redis primero
            const Redis = await import('ioredis').catch(() => null);
            
            if (Redis) {
                const redis = new Redis.default({
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379,
                    password: process.env.REDIS_PASSWORD,
                    retryStrategy: (times) => {
                        if (times > 3) return null;
                        return Math.min(times * 100, 3000);
                    },
                    maxRetriesPerRequest: 1,
                    lazyConnect: true
                });

                // Intentar conectar
                await redis.connect().catch(() => null);
                
                if (redis.status === 'ready') {
                    logger.info('✅ Redis disponible, usando Bull para colas');
                    this.useRedis = true;
                    
                    // Importar y usar MessageQueueService con Bull
                    const MessageQueueService = await import('./MessageQueueService.js');
                    this.service = MessageQueueService.default;
                    await this.service.initialize();
                    
                    await redis.disconnect();
                } else {
                    throw new Error('Redis no disponible');
                }
            } else {
                throw new Error('ioredis no instalado');
            }
        } catch (error) {
            logger.warn('⚠️ Redis no disponible, usando sistema de colas en memoria');
            logger.debug('Error Redis:', error.message);
            
            // Usar alternativa en memoria
            this.service = InMemoryQueueService;
            await this.service.initialize();
        }

        this.isInitialized = true;
        
        // Log de estadísticas cada minuto
        setInterval(() => this.logStats(), 60000);
        
        return this.service;
    }

    async logStats() {
        try {
            const stats = await this.service.getQueueStats();
            logger.info('📊 Estadísticas del Queue Manager:', {
                type: this.useRedis ? 'Redis/Bull' : 'In-Memory',
                stats
            });
        } catch (error) {
            logger.error('Error obteniendo estadísticas:', error);
        }
    }

    // Proxy methods
    async addMessage(type, data, options) {
        if (!this.isInitialized) await this.initialize();
        return this.service.addMessage(type, data, options);
    }

    async addCampaign(campaignId, action, data, options) {
        if (!this.isInitialized) await this.initialize();
        return this.service.addCampaign(campaignId, action, data, options);
    }

    async getStats() {
        if (!this.isInitialized) await this.initialize();
        return this.service.getQueueStats ? this.service.getQueueStats() : this.service.getStats();
    }

    async pauseAll() {
        if (!this.isInitialized) await this.initialize();
        return this.service.pauseAll ? this.service.pauseAll() : { message: 'Not supported' };
    }

    async resumeAll() {
        if (!this.isInitialized) await this.initialize();
        return this.service.resumeAll ? this.service.resumeAll() : { message: 'Not supported' };
    }

    async shutdown() {
        if (this.service && this.service.shutdown) {
            await this.service.shutdown();
        }
        this.isInitialized = false;
    }

    getServerAdapter() {
        if (this.service && this.service.getServerAdapter) {
            return this.service.getServerAdapter();
        }
        // Retornar un adaptador dummy si no hay Redis
        return {
            setBasePath: () => {},
            getRouter: () => (req, res) => {
                res.json({
                    message: 'Queue Dashboard no disponible (Redis no instalado)',
                    stats: this.service ? this.service.stats : null
                });
            }
        };
    }
}

// Singleton
const queueManager = new QueueManager();
export default queueManager;

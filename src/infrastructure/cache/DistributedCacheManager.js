/**
 * Distributed Cache Manager
 * Sistema avanzado de cache distribuido con Redis
 * Incluye clustering, estrategias múltiples y optimizaciones de rendimiento
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import logger from '../core/core/logger.js';
import { redisInstances, monitoringConfig } from '../../config/environments/redis.js';

class DistributedCacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableCluster: process.env.REDIS_CLUSTER_ENABLED === 'true',
      enableCompression: true,
      enableMetrics: true,
      enablePipeline: true,
      maxRetries: 3,
      retryDelay: 100,
      ...options
    };

    // Instancias Redis especializadas
    this.clients = {};
    this.isInitialized = false;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      totalOperations: 0
    };

    // Configuraciones de cache por tipo
    this.cacheConfigs = {
      session: {
        ttl: 86400, // 24 horas
        keyPrefix: 'session:',
        compression: false,
        strategy: 'lru'
      },
      user: {
        ttl: 3600, // 1 hora
        keyPrefix: 'user:',
        compression: true,
        strategy: 'lru'
      },
      conversation: {
        ttl: 7200, // 2 horas
        keyPrefix: 'conv:',
        compression: true,
        strategy: 'lfu'
      },
      template: {
        ttl: 86400, // 24 horas
        keyPrefix: 'tmpl:',
        compression: true,
        strategy: 'ttl'
      },
      api: {
        ttl: 300, // 5 minutos
        keyPrefix: 'api:',
        compression: false,
        strategy: 'lru'
      },
      analytics: {
        ttl: 3600, // 1 hora
        keyPrefix: 'analytics:',
        compression: true,
        strategy: 'lfu'
      }
    };

    // Pipeline para operaciones batch
    this.pipeline = null;
    this.pipelineOperations = [];
    this.pipelineTimeout = null;
  }

  /**
   * Inicializar el gestor de cache distribuido
   */
  async initialize() {
    try {
      logger.info('Inicializando Distributed Cache Manager...');

      if (this.options.enableCluster) {
        await this.initializeCluster();
      } else {
        await this.initializeSingleInstance();
      }

      // Configurar métricas si está habilitado
      if (this.options.enableMetrics) {
        this.startMetricsCollection();
      }

      this.isInitialized = true;
      this.emit('initialized');
      logger.info('Distributed Cache Manager inicializado correctamente');

    } catch (error) {
      logger.error('Error inicializando Distributed Cache Manager:', error);
      throw error;
    }
  }

  /**
   * Inicializar cluster Redis
   */
  async initializeCluster() {
    const clusterNodes = process.env.REDIS_CLUSTER_NODES?.split(',') || [
      { host: 'localhost', port: 6379 }
    ];

    const clusterOptions = {
      enableOfflineQueue: false,
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        family: 4,
        lazyConnect: true
      },
      clusterRetryDelayOnFailover: 100,
      clusterRetryDelayOnClusterDown: 300,
      clusterMaxRedirections: 6,
      scaleReads: 'slave',
      maxRetriesPerRequest: this.options.maxRetries
    };

    // Cliente principal para operaciones generales
    this.clients.main = new Redis.Cluster(clusterNodes, clusterOptions);
    
    // Cliente especializado para sesiones
    this.clients.session = new Redis.Cluster(clusterNodes, {
      ...clusterOptions,
      keyPrefix: redisInstances.session.keyPrefix
    });

    // Cliente para rate limiting
    this.clients.rateLimit = new Redis.Cluster(clusterNodes, {
      ...clusterOptions,
      keyPrefix: redisInstances.rateLimit.keyPrefix
    });

    await this.setupClusterEventHandlers();
  }

  /**
   * Inicializar instancia única Redis
   */
  async initializeSingleInstance() {
    const baseConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryDelayOnFailover: this.options.retryDelay,
      maxRetriesPerRequest: this.options.maxRetries,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      family: 4
    };

    // Cliente principal
    this.clients.main = new Redis(baseConfig);

    // Cliente para sesiones (DB diferente)
    this.clients.session = new Redis({
      ...baseConfig,
      db: 1,
      keyPrefix: redisInstances.session.keyPrefix
    });

    // Cliente para rate limiting
    this.clients.rateLimit = new Redis({
      ...baseConfig,
      db: 2,
      keyPrefix: redisInstances.rateLimit.keyPrefix
    });

    // Cliente para pub/sub
    this.clients.pubsub = new Redis({
      ...baseConfig,
      db: 3
    });

    await this.setupEventHandlers();
  }

  /**
   * Configurar event handlers para cluster
   */
  async setupClusterEventHandlers() {
    Object.entries(this.clients).forEach(([name, client]) => {
      client.on('connect', () => {
        logger.info(`Redis cluster client '${name}' conectado`);
      });

      client.on('error', (error) => {
        logger.error(`Error en Redis cluster client '${name}':`, error);
        this.metrics.errors++;
      });

      client.on('node error', (error, node) => {
        logger.error(`Error en nodo Redis ${node.host}:${node.port}:`, error);
      });

      client.on('failover', () => {
        logger.warn(`Failover ejecutado en client '${name}'`);
      });
    });
  }

  /**
   * Configurar event handlers para instancia única
   */
  async setupEventHandlers() {
    Object.entries(this.clients).forEach(([name, client]) => {
      client.on('connect', () => {
        logger.info(`Redis client '${name}' conectado`);
      });

      client.on('error', (error) => {
        logger.error(`Error en Redis client '${name}':`, error);
        this.metrics.errors++;
      });

      client.on('close', () => {
        logger.warn(`Conexión Redis client '${name}' cerrada`);
      });

      client.on('reconnecting', () => {
        logger.info(`Reconectando Redis client '${name}'`);
      });
    });
  }

  /**
   * Obtener cliente Redis apropiado para el tipo de cache
   */
  getClient(cacheType = 'main') {
    const clientMap = {
      session: 'session',
      rateLimit: 'rateLimit',
      pubsub: 'pubsub'
    };

    const clientName = clientMap[cacheType] || 'main';
    return this.clients[clientName] || this.clients.main;
  }

  /**
   * Generar clave de cache con prefijo
   */
  generateKey(cacheType, key) {
    const config = this.cacheConfigs[cacheType] || this.cacheConfigs.api;
    return `${config.keyPrefix}${key}`;
  }

  /**
   * Comprimir datos si está habilitado
   */
  async compressData(data, cacheType) {
    if (!this.options.enableCompression) return data;
    
    const config = this.cacheConfigs[cacheType];
    if (!config?.compression) return data;

    try {
      // Implementar compresión LZ4 o gzip según el tipo
      const compressed = JSON.stringify(data);
      return compressed;
    } catch (error) {
      logger.error('Error comprimiendo datos:', error);
      return data;
    }
  }

  /**
   * Descomprimir datos
   */
  async decompressData(data, cacheType) {
    if (!this.options.enableCompression) return data;
    
    const config = this.cacheConfigs[cacheType];
    if (!config?.compression) return data;

    try {
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error descomprimiendo datos:', error);
      return data;
    }
  }

  /**
   * Obtener valor del cache
   */
  async get(cacheType, key) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const client = this.getClient(cacheType);
      const fullKey = this.generateKey(cacheType, key);
      
      const value = await client.get(fullKey);
      this.metrics.totalOperations++;

      if (value !== null) {
        this.metrics.hits++;
        const decompressed = await this.decompressData(value, cacheType);
        logger.debug(`Cache HIT: ${cacheType}:${key}`);
        return decompressed;
      }

      this.metrics.misses++;
      logger.debug(`Cache MISS: ${cacheType}:${key}`);
      return null;

    } catch (error) {
      logger.error(`Error obteniendo cache ${cacheType}:${key}:`, error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Establecer valor en cache
   */
  async set(cacheType, key, value, customTTL = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const client = this.getClient(cacheType);
      const config = this.cacheConfigs[cacheType] || this.cacheConfigs.api;
      const fullKey = this.generateKey(cacheType, key);
      const ttl = customTTL || config.ttl;

      const compressed = await this.compressData(value, cacheType);
      
      if (ttl > 0) {
        await client.setex(fullKey, ttl, compressed);
      } else {
        await client.set(fullKey, compressed);
      }

      this.metrics.sets++;
      this.metrics.totalOperations++;
      logger.debug(`Cache SET: ${cacheType}:${key} (TTL: ${ttl}s)`);
      
      return true;

    } catch (error) {
      logger.error(`Error estableciendo cache ${cacheType}:${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Eliminar valor del cache
   */
  async del(cacheType, key) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const client = this.getClient(cacheType);
      const fullKey = this.generateKey(cacheType, key);
      
      const result = await client.del(fullKey);
      this.metrics.deletes++;
      this.metrics.totalOperations++;
      
      logger.debug(`Cache DEL: ${cacheType}:${key}`);
      return result > 0;

    } catch (error) {
      logger.error(`Error eliminando cache ${cacheType}:${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Operaciones batch con pipeline
   */
  async mget(cacheType, keys) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const client = this.getClient(cacheType);
      const fullKeys = keys.map(key => this.generateKey(cacheType, key));
      
      const values = await client.mget(...fullKeys);
      this.metrics.totalOperations += keys.length;

      const results = {};
      for (let i = 0; i < keys.length; i++) {
        if (values[i] !== null) {
          results[keys[i]] = await this.decompressData(values[i], cacheType);
          this.metrics.hits++;
        } else {
          this.metrics.misses++;
        }
      }

      return results;

    } catch (error) {
      logger.error(`Error en mget ${cacheType}:`, error);
      this.metrics.errors++;
      return {};
    }
  }

  /**
   * Establecer múltiples valores
   */
  async mset(cacheType, keyValuePairs, customTTL = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const client = this.getClient(cacheType);
      const config = this.cacheConfigs[cacheType] || this.cacheConfigs.api;
      const ttl = customTTL || config.ttl;

      const pipeline = client.pipeline();
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const fullKey = this.generateKey(cacheType, key);
        const compressed = await this.compressData(value, cacheType);
        
        if (ttl > 0) {
          pipeline.setex(fullKey, ttl, compressed);
        } else {
          pipeline.set(fullKey, compressed);
        }
      }

      await pipeline.exec();
      this.metrics.sets += Object.keys(keyValuePairs).length;
      this.metrics.totalOperations += Object.keys(keyValuePairs).length;

      return true;

    } catch (error) {
      logger.error(`Error en mset ${cacheType}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Invalidar cache por patrón
   */
  async invalidatePattern(cacheType, pattern) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const client = this.getClient(cacheType);
      const fullPattern = this.generateKey(cacheType, pattern);
      
      const keys = await client.keys(fullPattern);
      if (keys.length > 0) {
        await client.del(...keys);
        this.metrics.deletes += keys.length;
        this.metrics.totalOperations += keys.length;
      }

      logger.debug(`Cache invalidated pattern: ${cacheType}:${pattern} (${keys.length} keys)`);
      return keys.length;

    } catch (error) {
      logger.error(`Error invalidando patrón ${cacheType}:${pattern}:`, error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Función remember - obtener o establecer
   */
  async remember(cacheType, key, fallbackFn, customTTL = null) {
    const cached = await this.get(cacheType, key);
    
    if (cached !== null) {
      return cached;
    }

    try {
      const value = await fallbackFn();
      await this.set(cacheType, key, value, customTTL);
      return value;
    } catch (error) {
      logger.error(`Error en remember ${cacheType}:${key}:`, error);
      throw error;
    }
  }

  /**
   * Incrementar contador
   */
  async incr(cacheType, key, amount = 1, ttl = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const client = this.getClient(cacheType);
      const fullKey = this.generateKey(cacheType, key);
      
      const result = await client.incrby(fullKey, amount);
      
      if (ttl && result === amount) {
        // Primera vez que se crea la clave
        await client.expire(fullKey, ttl);
      }

      this.metrics.totalOperations++;
      return result;

    } catch (error) {
      logger.error(`Error incrementando ${cacheType}:${key}:`, error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Obtener métricas del cache
   */
  getMetrics() {
    const hitRate = this.metrics.totalOperations > 0 
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100 
      : 0;

    return {
      ...this.metrics,
      hitRate: parseFloat(hitRate.toFixed(2)),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Iniciar recolección de métricas
   */
  startMetricsCollection() {
    setInterval(async () => {
      try {
        const metrics = this.getMetrics();
        this.emit('metrics', metrics);
        
        // Log métricas cada 5 minutos
        if (metrics.totalOperations % 1000 === 0) {
          logger.info('Cache metrics:', metrics);
        }

      } catch (error) {
        logger.error('Error recolectando métricas:', error);
      }
    }, monitoringConfig.metricsInterval);
  }

  /**
   * Limpiar cache por tipo
   */
  async flush(cacheType = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (cacheType) {
        const pattern = this.generateKey(cacheType, '*');
        return await this.invalidatePattern(cacheType, '*');
      } else {
        // Limpiar todos los clientes
        const results = await Promise.all(
          Object.values(this.clients).map(client => client.flushdb())
        );
        logger.info('Cache completamente limpiado');
        return results.every(result => result === 'OK');
      }

    } catch (error) {
      logger.error('Error limpiando cache:', error);
      return false;
    }
  }

  /**
   * Cerrar todas las conexiones
   */
  async close() {
    try {
      await Promise.all(
        Object.values(this.clients).map(client => client.quit())
      );
      this.isInitialized = false;
      logger.info('Distributed Cache Manager cerrado');
    } catch (error) {
      logger.error('Error cerrando Distributed Cache Manager:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      clients: {},
      metrics: this.getMetrics(),
      timestamp: new Date().toISOString()
    };

    try {
      for (const [name, client] of Object.entries(this.clients)) {
        const start = Date.now();
        await client.ping();
        const latency = Date.now() - start;
        
        health.clients[name] = {
          status: 'connected',
          latency: `${latency}ms`
        };
      }
    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
    }

    return health;
  }
}

// Instancia singleton
const distributedCacheManager = new DistributedCacheManager();

export { DistributedCacheManager, distributedCacheManager };
export default distributedCacheManager;
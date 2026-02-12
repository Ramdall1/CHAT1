/**
 * Configuración de Redis
 * Configuración centralizada para conexiones Redis
 * Recomendación #16: Redis Cache
 */

import Redis from 'ioredis';
import logger from '../../services/core/core/logger.js';

/**
 * Configuración por entorno
 */
const redisConfig = {
  development: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    family: 4
  },
    
  production: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    family: 4,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    // Configuración de cluster si está disponible
    enableOfflineQueue: false,
    maxRetriesPerRequest: null
  },
    
  test: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB) || 1, // Base de datos diferente para tests
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 2000
  }
};

/**
 * Configuración de cluster Redis (para producción)
 */
const clusterConfig = {
  enableOfflineQueue: false,
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    family: 4
  },
  clusterRetryDelayOnFailover: 100,
  clusterRetryDelayOnClusterDown: 300,
  clusterMaxRedirections: 6,
  scaleReads: 'slave',
  maxRetriesPerRequest: null
};

/**
 * Obtener configuración según el entorno
 */
export function getRedisConfig() {
  const env = process.env.NODE_ENV || 'development';
  const config = redisConfig[env] || redisConfig.development;
    
  logger.info(`Configurando Redis para entorno: ${env}`);
    
  return config;
}

/**
 * Crear instancia de Redis
 */
export function createRedisInstance(customConfig = {}) {
  const config = { ...getRedisConfig(), ...customConfig };
    
  // Verificar si usar cluster
  if (process.env.REDIS_CLUSTER_NODES) {
    const nodes = process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port) || 6379 };
    });
        
    logger.info('Conectando a Redis Cluster:', nodes);
    return new Redis.Cluster(nodes, clusterConfig);
  }
    
  // Instancia Redis normal
  const redis = new Redis(config);
    
  // Event listeners
  redis.on('connect', () => {
    logger.info(`Redis conectado: ${config.host}:${config.port}`);
  });
    
  redis.on('ready', () => {
    logger.info('Redis listo para recibir comandos');
  });
    
  redis.on('error', (error) => {
    logger.error('Error de conexión Redis:', error);
  });
    
  redis.on('close', () => {
    logger.warn('Conexión Redis cerrada');
  });
    
  redis.on('reconnecting', (delay) => {
    logger.info(`Reconectando a Redis en ${delay}ms`);
  });
    
  redis.on('end', () => {
    logger.warn('Conexión Redis terminada');
  });
    
  return redis;
}

/**
 * Configuración de Redis para diferentes propósitos
 */
export const redisInstances = {
  // Cache principal
  cache: {
    keyPrefix: 'cache:',
    defaultTTL: 3600, // 1 hora
    maxMemoryPolicy: 'allkeys-lru'
  },
    
  // Sesiones de usuario
  session: {
    keyPrefix: 'session:',
    defaultTTL: 86400, // 24 horas
    maxMemoryPolicy: 'volatile-ttl'
  },
    
  // Rate limiting
  rateLimit: {
    keyPrefix: 'ratelimit:',
    defaultTTL: 3600, // 1 hora
    maxMemoryPolicy: 'volatile-ttl'
  },
    
  // Colas de trabajo
  queue: {
    keyPrefix: 'queue:',
    defaultTTL: 0, // Sin expiración
    maxMemoryPolicy: 'noeviction'
  },
    
  // Pub/Sub para eventos en tiempo real
  pubsub: {
    keyPrefix: 'pubsub:',
    defaultTTL: 0,
    maxMemoryPolicy: 'noeviction'
  }
};

/**
 * Configuración de monitoreo y métricas
 */
export const monitoringConfig = {
  // Intervalo de recolección de métricas (ms)
  metricsInterval: 30000,
    
  // Métricas a recolectar
  metrics: [
    'used_memory',
    'used_memory_peak',
    'connected_clients',
    'total_commands_processed',
    'instantaneous_ops_per_sec',
    'keyspace_hits',
    'keyspace_misses',
    'expired_keys',
    'evicted_keys'
  ],
    
  // Alertas
  alerts: {
    memoryUsageThreshold: 0.8, // 80%
    connectionThreshold: 100,
    hitRatioThreshold: 0.9 // 90%
  }
};

/**
 * Configuración de backup y persistencia
 */
export const persistenceConfig = {
  // RDB (Redis Database Backup)
  rdb: {
    enabled: process.env.REDIS_RDB_ENABLED !== 'false',
    savePoints: [
      { seconds: 900, changes: 1 },    // 15 min si al menos 1 cambio
      { seconds: 300, changes: 10 },   // 5 min si al menos 10 cambios
      { seconds: 60, changes: 10000 }  // 1 min si al menos 10000 cambios
    ]
  },
    
  // AOF (Append Only File)
  aof: {
    enabled: process.env.REDIS_AOF_ENABLED === 'true',
    fsync: process.env.REDIS_AOF_FSYNC || 'everysec' // always, everysec, no
  }
};

/**
 * Configuración de seguridad
 */
export const securityConfig = {
  // Comandos deshabilitados en producción
  disabledCommands: process.env.NODE_ENV === 'production' ? [
    'FLUSHDB',
    'FLUSHALL',
    'KEYS',
    'CONFIG',
    'SHUTDOWN',
    'DEBUG'
  ] : [],
    
  // Configuración de ACL (Access Control List)
  acl: {
    enabled: process.env.REDIS_ACL_ENABLED === 'true',
    users: {
      cache_user: {
        password: process.env.REDIS_CACHE_PASSWORD,
        commands: ['+get', '+set', '+del', '+exists', '+expire', '+ttl'],
        keys: ['cache:*']
      },
      session_user: {
        password: process.env.REDIS_SESSION_PASSWORD,
        commands: ['+get', '+set', '+del', '+exists', '+expire'],
        keys: ['session:*']
      }
    }
  }
};

/**
 * Validar configuración de Redis
 */
export function validateRedisConfig() {
  const config = getRedisConfig();
  const errors = [];
    
  if (!config.host) {
    errors.push('REDIS_HOST no está configurado');
  }
    
  if (!config.port || isNaN(config.port)) {
    errors.push('REDIS_PORT debe ser un número válido');
  }
    
  if (process.env.NODE_ENV === 'production' && !config.password) {
    errors.push('REDIS_PASSWORD es requerido en producción');
  }
    
  if (errors.length > 0) {
    throw new Error(`Configuración Redis inválida: ${errors.join(', ')}`);
  }
    
  return true;
}

/**
 * Configuración de conexión con retry automático
 */
export const connectionConfig = {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Reintentando conexión Redis en ${delay}ms (intento ${times})`);
    return delay;
  },
    
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    return err.message.includes(targetError);
  },
    
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  lazyConnect: true
};

export default {
  getRedisConfig,
  createRedisInstance,
  redisInstances,
  monitoringConfig,
  persistenceConfig,
  securityConfig,
  validateRedisConfig,
  connectionConfig
};
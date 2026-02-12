/**
 * @fileoverview Configuración de Cache
 * 
 * Configuración centralizada para el sistema de caché con soporte para
 * múltiples estrategias de almacenamiento (Redis, Memory, Hybrid)
 * 
 * @author ChatBot Enterprise Team
 * @version 2.0.0
 */

class CacheConfig {
  /**
   * Obtener configuración de Redis
   */
  static getRedisConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '0'),
      password: process.env.REDIS_PASSWORD || undefined,
      username: process.env.REDIS_USERNAME || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      enableReadyCheck: true,
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
      connectTimeout: 10000,
      commandTimeout: 5000,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      }
    };
  }

  /**
   * Obtener configuración de Memory Cache
   */
  static getMemoryConfig() {
    return {
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
      ttl: parseInt(process.env.CACHE_TTL || '3600'),
      checkperiod: parseInt(process.env.CACHE_CHECK_PERIOD || '600'),
      useClones: true,
      stdTTL: parseInt(process.env.CACHE_STD_TTL || '0'),
      errorOnMissing: false,
      enableLegacyCallbacks: false
    };
  }

  /**
   * Obtener configuración de Hybrid Cache
   */
  static getHybridConfig() {
    return {
      memory: this.getMemoryConfig(),
      redis: this.getRedisConfig(),
      fallbackToMemory: true,
      syncInterval: parseInt(process.env.CACHE_SYNC_INTERVAL || '5000'),
      memoryPriority: process.env.CACHE_MEMORY_PRIORITY === 'true'
    };
  }

  /**
   * Obtener estrategia de caché
   */
  static getCacheStrategy() {
    const strategy = process.env.CACHE_STRATEGY || 'memory';
    const validStrategies = ['memory', 'redis', 'hybrid'];
    
    if (!validStrategies.includes(strategy)) {
      logger.warn(`⚠️ Estrategia de caché inválida: ${strategy}. Usando 'memory' por defecto.`);
      return 'memory';
    }
    
    return strategy;
  }

  /**
   * Obtener configuración de compresión
   */
  static getCompressionConfig() {
    return {
      enabled: process.env.CACHE_COMPRESSION === 'true',
      algorithm: process.env.CACHE_COMPRESSION_ALGORITHM || 'gzip',
      level: parseInt(process.env.CACHE_COMPRESSION_LEVEL || '6'),
      threshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024')
    };
  }

  /**
   * Obtener configuración de serialización
   */
  static getSerializationConfig() {
    return {
      enabled: process.env.CACHE_SERIALIZATION === 'true',
      format: process.env.CACHE_SERIALIZATION_FORMAT || 'json',
      includePrototype: false,
      preserveFunctions: false
    };
  }

  /**
   * Obtener configuración de invalidación
   */
  static getInvalidationConfig() {
    return {
      strategy: process.env.CACHE_INVALIDATION_STRATEGY || 'ttl', // 'ttl', 'lru', 'lfu'
      maxAge: parseInt(process.env.CACHE_MAX_AGE || '86400'),
      staleWhileRevalidate: parseInt(process.env.CACHE_STALE_WHILE_REVALIDATE || '3600'),
      staleIfError: parseInt(process.env.CACHE_STALE_IF_ERROR || '86400'),
      enableEventualConsistency: process.env.CACHE_EVENTUAL_CONSISTENCY === 'true'
    };
  }

  /**
   * Obtener configuración de monitoreo
   */
  static getMonitoringConfig() {
    return {
      enabled: process.env.CACHE_MONITORING === 'true',
      metricsInterval: parseInt(process.env.CACHE_METRICS_INTERVAL || '60000'),
      trackHitRate: true,
      trackMemoryUsage: true,
      trackOperationTime: true,
      enableDetailedLogging: process.env.CACHE_DETAILED_LOGGING === 'true'
    };
  }

  /**
   * Obtener configuración completa de caché
   */
  static getFullConfig() {
    const strategy = this.getCacheStrategy();
    
    return {
      strategy,
      redis: this.getRedisConfig(),
      memory: this.getMemoryConfig(),
      hybrid: this.getHybridConfig(),
      compression: this.getCompressionConfig(),
      serialization: this.getSerializationConfig(),
      invalidation: this.getInvalidationConfig(),
      monitoring: this.getMonitoringConfig(),
      enabled: process.env.CACHE_ENABLED !== 'false',
      namespace: process.env.CACHE_NAMESPACE || 'app',
      keyPrefix: process.env.CACHE_KEY_PREFIX || 'cache:',
      separator: process.env.CACHE_KEY_SEPARATOR || ':',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Validar configuración
   */
  static validateConfig() {
    const config = this.getFullConfig();
    const errors = [];

    if (!config.enabled) {
      return { valid: true, warnings: ['Cache deshabilitado'] };
    }

    if (config.strategy === 'redis' || config.strategy === 'hybrid') {
      if (!config.redis.host) {
        errors.push('Redis host no configurado');
      }
      if (!config.redis.port || config.redis.port < 1 || config.redis.port > 65535) {
        errors.push('Redis port inválido');
      }
    }

    if (config.memory.maxSize < 10) {
      errors.push('Cache memory size muy pequeño (mínimo 10)');
    }

    if (config.memory.ttl < 60) {
      errors.push('Cache TTL muy pequeño (mínimo 60 segundos)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }
}

export default CacheConfig;

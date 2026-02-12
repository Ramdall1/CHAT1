import CacheManager from './CacheManager.js';
import CacheStore from './CacheStore.js';
import CacheStrategy from './CacheStrategy.js';

/**
 * Configuración por defecto del sistema de caché
 */
const DEFAULT_CACHE_CONFIG = {
  // Configuración general
  enabled: true,
  debug: false,
    
  // Configuración del gestor de caché
  manager: {
    storage: {
      type: 'memory', // memory, file, redis, hybrid
      maxSize: 1000,
      maxMemory: 100 * 1024 * 1024, // 100MB
      compression: false,
      serialization: 'json'
    },
        
    expiration: {
      defaultTTL: 3600000, // 1 hora
      checkInterval: 300000, // 5 minutos
      strategy: 'lazy' // lazy, active, hybrid
    },
        
    eviction: {
      policy: 'lru', // lru, lfu, fifo, random, ttl
      threshold: 0.8,
      batchSize: 10
    },
        
    partitioning: {
      enabled: false,
      strategy: 'hash',
      partitions: 4
    },
        
    persistence: {
      enabled: false,
      path: './cache',
      interval: 300000,
      format: 'json'
    },
        
    statistics: {
      enabled: true,
      detailed: false,
      historySize: 1000
    },
        
    warming: {
      enabled: false,
      strategies: ['preload'],
      preloadKeys: []
    },
        
    clustering: {
      enabled: false,
      nodes: [],
      replication: 1
    }
  },
    
  // Configuración del almacén
  store: {
    memory: {
      maxSize: 100 * 1024 * 1024,
      maxItems: 10000,
      compression: false
    },
        
    file: {
      directory: './cache',
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 1000,
      compression: true,
      format: 'json',
      sync: false,
      backup: true,
      encryption: false
    },
        
    redis: {
      host: 'localhost',
      port: 6379,
      password: null,
      db: 0,
      keyPrefix: 'cache:',
      maxRetries: 3,
      retryDelay: 1000,
      compression: true
    },
        
    hybrid: {
      l1: 'memory',
      l2: 'file',
      l1MaxSize: 50 * 1024 * 1024,
      l2MaxSize: 500 * 1024 * 1024,
      promoteThreshold: 3,
      demoteThreshold: 0.8
    },
        
    serialization: {
      format: 'json',
      compression: false,
      encryption: false,
      encryptionKey: null
    },
        
    persistence: {
      enabled: false,
      interval: 300000,
      atomic: true,
      backup: true,
      maxBackups: 5
    }
  },
    
  // Configuración de estrategias
  strategy: {
    eviction: {
      policy: 'lru',
      maxSize: 1000,
      maxMemory: 100 * 1024 * 1024,
      threshold: 0.8,
      batchSize: 10,
      adaptiveWindow: 1000
    },
        
    ttl: {
      default: 3600000,
      sliding: false,
      absolute: true,
      maxAge: 86400000,
      refreshThreshold: 0.8
    },
        
    warming: {
      enabled: false,
      strategies: ['preload', 'predictive', 'scheduled'],
      preloadKeys: [],
      predictiveThreshold: 5,
      scheduledInterval: 3600000
    },
        
    partitioning: {
      enabled: false,
      strategy: 'hash',
      partitions: 4,
      rebalanceThreshold: 0.7,
      virtualNodes: 150
    },
        
    replication: {
      enabled: false,
      factor: 2,
      strategy: 'sync',
      consistency: 'eventual'
    }
  }
};

/**
 * Eventos del sistema de caché
 */
const CACHE_EVENTS = {
  // Eventos del gestor
  MANAGER_INITIALIZED: 'manager:initialized',
  MANAGER_STARTED: 'manager:started',
  MANAGER_STOPPED: 'manager:stopped',
  MANAGER_ERROR: 'manager:error',
  MANAGER_DESTROYED: 'manager:destroyed',
    
  // Eventos de operaciones
  ITEM_SET: 'item:set',
  ITEM_GET: 'item:get',
  ITEM_DELETE: 'item:delete',
  ITEM_EXPIRED: 'item:expired',
  ITEM_EVICTED: 'item:evicted',
    
  // Eventos de caché
  CACHE_HIT: 'cache:hit',
  CACHE_MISS: 'cache:miss',
  CACHE_CLEAR: 'cache:clear',
  CACHE_FULL: 'cache:full',
    
  // Eventos de almacén
  STORE_INITIALIZED: 'store:initialized',
  STORE_ERROR: 'store:error',
  STORE_DESTROYED: 'store:destroyed',
    
  // Eventos de estrategia
  STRATEGY_INITIALIZED: 'strategy:initialized',
  STRATEGY_EVICTION: 'strategy:eviction',
  STRATEGY_PROMOTION: 'strategy:promotion',
  STRATEGY_DEMOTION: 'strategy:demotion',
  STRATEGY_PREDICTION: 'strategy:prediction',
  STRATEGY_REBALANCE: 'strategy:rebalanceNeeded',
    
  // Eventos de warming
  WARMING_STARTED: 'warming:started',
  WARMING_COMPLETED: 'warming:completed',
  WARMING_SCHEDULED: 'warming:scheduled',
  WARMING_PREDICTIVE: 'warming:predictive',
    
  // Eventos de persistencia
  PERSISTENCE_SAVED: 'persistence:saved',
  PERSISTENCE_LOADED: 'persistence:loaded',
  PERSISTENCE_ERROR: 'persistence:error',
    
  // Eventos de clustering
  CLUSTER_NODE_ADDED: 'cluster:nodeAdded',
  CLUSTER_NODE_REMOVED: 'cluster:nodeRemoved',
  CLUSTER_REPLICATION: 'cluster:replication'
};

/**
 * Estados del sistema de caché
 */
const CACHE_STATES = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error',
  DESTROYED: 'destroyed'
};

/**
 * Tipos de almacenamiento
 */
const STORAGE_TYPES = {
  MEMORY: 'memory',
  FILE: 'file',
  REDIS: 'redis',
  HYBRID: 'hybrid'
};

/**
 * Políticas de evicción
 */
const EVICTION_POLICIES = {
  LRU: 'lru',
  LFU: 'lfu',
  FIFO: 'fifo',
  LIFO: 'lifo',
  RANDOM: 'random',
  TTL: 'ttl',
  ADAPTIVE: 'adaptive'
};

/**
 * Estrategias de warming
 */
const WARMING_STRATEGIES = {
  PRELOAD: 'preload',
  PREDICTIVE: 'predictive',
  SCHEDULED: 'scheduled'
};

/**
 * Funciones de fábrica
 */

/**
 * Crea una instancia del gestor de caché
 */
function createCacheManager(config = {}) {
  const mergedConfig = {
    ...DEFAULT_CACHE_CONFIG.manager,
    ...config
  };
    
  return new CacheManager(mergedConfig);
}

/**
 * Crea una instancia del almacén de caché
 */
function createCacheStore(config = {}) {
  const mergedConfig = {
    ...DEFAULT_CACHE_CONFIG.store,
    ...config
  };
    
  return new CacheStore(mergedConfig);
}

/**
 * Crea una instancia de la estrategia de caché
 */
function createCacheStrategy(config = {}) {
  const mergedConfig = {
    ...DEFAULT_CACHE_CONFIG.strategy,
    ...config
  };
    
  return new CacheStrategy(mergedConfig);
}

/**
 * Crea un sistema de caché completo
 */
async function createCacheSystem(config = {}) {
  const fullConfig = CacheUtils.mergeConfigs(DEFAULT_CACHE_CONFIG, config);
    
  // Crear componentes
  const store = createCacheStore(fullConfig.store);
  const strategy = createCacheStrategy(fullConfig.strategy);
  const manager = new CacheManager({
    ...fullConfig.manager,
    store,
    strategy
  });
    
  // Inicializar sistema
  await store.initialize();
  strategy.initialize();
  await manager.initialize();
    
  return {
    manager,
    store,
    strategy,
    config: fullConfig,
        
    // Métodos de conveniencia
    async start() {
      return await manager.start();
    },
        
    async stop() {
      return await manager.stop();
    },
        
    async destroy() {
      await manager.destroy();
      await store.destroy();
      strategy.destroy();
    },
        
    // Operaciones de caché
    async get(key) {
      return await manager.get(key);
    },
        
    async set(key, value, options = {}) {
      return await manager.set(key, value, options);
    },
        
    async delete(key) {
      return await manager.delete(key);
    },
        
    async clear() {
      return await manager.clear();
    },
        
    async has(key) {
      return await manager.has(key);
    },
        
    async keys() {
      return await manager.keys();
    },
        
    async size() {
      return await manager.size();
    },
        
    // Estadísticas
    getStatistics() {
      return {
        manager: manager.getStatistics(),
        store: store.getStatistics(),
        strategy: strategy.getStatistics()
      };
    },
        
    getInfo() {
      return {
        config: fullConfig,
        state: manager.state,
        statistics: this.getStatistics()
      };
    }
  };
}

/**
 * Utilidades del sistema de caché
 */
const CacheUtils = {
  /**
     * Valida una configuración de caché
     */
  validateConfig(config) {
    const errors = [];
        
    // Validar tipo de almacenamiento
    if (config.storage && config.storage.type) {
      const validTypes = Object.values(STORAGE_TYPES);
      if (!validTypes.includes(config.storage.type)) {
        errors.push(`Invalid storage type: ${config.storage.type}`);
      }
    }
        
    // Validar política de evicción
    if (config.eviction && config.eviction.policy) {
      const validPolicies = Object.values(EVICTION_POLICIES);
      if (!validPolicies.includes(config.eviction.policy)) {
        errors.push(`Invalid eviction policy: ${config.eviction.policy}`);
      }
    }
        
    // Validar tamaños
    if (config.storage && config.storage.maxSize && config.storage.maxSize <= 0) {
      errors.push('Storage maxSize must be positive');
    }
        
    if (config.storage && config.storage.maxMemory && config.storage.maxMemory <= 0) {
      errors.push('Storage maxMemory must be positive');
    }
        
    // Validar TTL
    if (config.expiration && config.expiration.defaultTTL && config.expiration.defaultTTL <= 0) {
      errors.push('Default TTL must be positive');
    }
        
    return {
      valid: errors.length === 0,
      errors
    };
  },
    
  /**
     * Combina configuraciones de caché
     */
  mergeConfigs(defaultConfig, userConfig) {
    return this.deepMerge(defaultConfig, userConfig);
  },
    
  /**
     * Combina objetos profundamente
     */
  deepMerge(target, source) {
    const result = { ...target };
        
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
        
    return result;
  },
    
  /**
     * Crea una configuración optimizada para desarrollo
     */
  createDevelopmentConfig() {
    return {
      debug: true,
      manager: {
        storage: {
          type: 'memory',
          maxSize: 100,
          maxMemory: 10 * 1024 * 1024 // 10MB
        },
        statistics: {
          enabled: true,
          detailed: true
        },
        persistence: {
          enabled: false
        }
      }
    };
  },
    
  /**
     * Crea una configuración optimizada para producción
     */
  createProductionConfig() {
    return {
      debug: false,
      manager: {
        storage: {
          type: 'hybrid',
          maxSize: 10000,
          maxMemory: 500 * 1024 * 1024 // 500MB
        },
        persistence: {
          enabled: true,
          interval: 300000 // 5 minutos
        },
        warming: {
          enabled: true,
          strategies: ['preload', 'predictive']
        },
        clustering: {
          enabled: true
        }
      }
    };
  },
    
  /**
     * Obtiene información del sistema
     */
  getSystemInfo() {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  },
    
  /**
     * Formatea estadísticas para mostrar
     */
  formatStatistics(stats) {
    return {
      summary: {
        hitRate: `${stats.hitRate?.toFixed(2) || 0}%`,
        totalOperations: (stats.reads || 0) + (stats.writes || 0) + (stats.deletes || 0),
        cacheSize: this.formatBytes(stats.totalSize || 0),
        uptime: this.formatDuration(stats.uptime || 0)
      },
      operations: {
        reads: stats.reads || 0,
        writes: stats.writes || 0,
        deletes: stats.deletes || 0,
        hits: stats.hits || 0,
        misses: stats.misses || 0,
        evictions: stats.evictions || 0
      },
      performance: {
        averageResponseTime: `${stats.averageResponseTime?.toFixed(2) || 0}ms`,
        throughput: `${stats.throughput?.toFixed(2) || 0} ops/sec`,
        errorRate: `${stats.errorRate?.toFixed(2) || 0}%`
      }
    };
  },
    
  /**
     * Formatea bytes en formato legible
     */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
        
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
        
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  },
    
  /**
     * Formatea duración en formato legible
     */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
        
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
};

// Exportaciones ES Modules
export {
  // Clases principales
  CacheManager,
  CacheStore,
  CacheStrategy,
    
  // Configuración
  DEFAULT_CACHE_CONFIG,
    
  // Constantes
  CACHE_EVENTS,
  CACHE_STATES,
  STORAGE_TYPES,
  EVICTION_POLICIES,
  WARMING_STRATEGIES,
    
  // Funciones de fábrica
  createCacheManager,
  createCacheStore,
  createCacheStrategy,
  createCacheSystem,
    
  // Utilidades
  CacheUtils
};

// Exportación por defecto
export default {
  CacheManager,
  CacheStore,
  CacheStrategy,
  DEFAULT_CACHE_CONFIG,
  CACHE_EVENTS,
  CACHE_STATES,
  STORAGE_TYPES,
  EVICTION_POLICIES,
  WARMING_STRATEGIES,
  createCacheManager,
  createCacheStore,
  createCacheStrategy,
  createCacheSystem,
  CacheUtils
};
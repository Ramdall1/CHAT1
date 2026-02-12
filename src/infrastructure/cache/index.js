/**
 * Cache System Index
 * Punto de entrada principal para el sistema de cache distribuido
 */

// Componentes principales
export { default as distributedCacheManager } from './DistributedCacheManager.js';
export { default as cacheInitializer } from './CacheInitializer.js';
export { default as cacheMonitoring } from './CacheMonitoring.js';
export { default as cacheInvalidation } from './CacheInvalidation.js';

// Estrategias y configuración
export { CacheStrategies } from './CacheStrategies.js';
export { default as cacheConfig } from '../config/cache/CacheConfig.js';

// Middleware
export { 
  default as advancedCacheMiddleware,
  CACHE_PROFILES,
  generateCacheKey,
  invalidateCache,
  getMiddlewareMetrics,
  resetMiddlewareMetrics,
  recordHTTPMetrics
} from '../middleware/AdvancedCacheMiddleware.js';

// Utilidades
export {
  CacheKeyUtils,
  CacheSerializationUtils,
  CacheTTLUtils,
  CachePatternUtils,
  CacheMetricsUtils,
  CacheValidationUtils,
  CacheDebugUtils
} from './CacheUtils.js';

// Clases principales para importación directa
export { CacheInitializer } from './CacheInitializer.js';

/**
 * Función de inicialización rápida
 */
export async function initializeCache(options = {}) {
  const { default: cacheInitializer } = await import('./CacheInitializer.js');
  return cacheInitializer.initialize(options);
}

/**
 * Función para obtener instancia del cache manager
 */
export async function getCacheManager() {
  const { default: distributedCacheManager } = await import('./DistributedCacheManager.js');
  return distributedCacheManager;
}

/**
 * Función para obtener métricas del sistema
 */
export async function getSystemMetrics() {
  const { default: cacheInitializer } = await import('./CacheInitializer.js');
  return cacheInitializer.getSystemMetrics();
}

/**
 * Función para verificar salud del sistema
 */
export async function healthCheck() {
  try {
    const { default: distributedCacheManager } = await import('./DistributedCacheManager.js');
    const { default: cacheMonitoring } = await import('./CacheMonitoring.js');
    const { default: cacheInitializer } = await import('./CacheInitializer.js');

    const [managerHealth, monitoringHealth, systemStatus] = await Promise.all([
      distributedCacheManager.healthCheck(),
      cacheMonitoring.healthCheck(),
      Promise.resolve(cacheInitializer.getComponentsStatus())
    ]);

    return {
      healthy: managerHealth.healthy && monitoringHealth.status === 'healthy',
      components: {
        manager: managerHealth,
        monitoring: monitoringHealth,
        system: systemStatus
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Configuración por defecto para desarrollo rápido
 */
export const defaultConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0
  },
  monitoring: {
    enabled: process.env.NODE_ENV !== 'test',
    interval: 30000
  },
  compression: {
    enabled: true,
    threshold: 1024
  }
};

// Exportación por defecto
export default {
  // Funciones principales
  initializeCache,
  getCacheManager,
  getSystemMetrics,
  healthCheck,
  
  // Componentes
  distributedCacheManager,
  cacheInitializer,
  cacheMonitoring,
  cacheInvalidation,
  
  // Configuración
  cacheConfig,
  defaultConfig,
  
  // Middleware
  advancedCacheMiddleware,
  CACHE_PROFILES,
  
  // Estrategias
  CacheStrategies,
  
  // Utilidades
  CacheKeyUtils,
  CacheSerializationUtils,
  CacheTTLUtils,
  CachePatternUtils,
  CacheMetricsUtils,
  CacheValidationUtils,
  CacheDebugUtils
};
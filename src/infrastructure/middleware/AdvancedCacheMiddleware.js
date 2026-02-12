/**
 * Advanced Cache Middleware
 * Middleware de cache HTTP avanzado con múltiples estrategias,
 * invalidación inteligente y optimizaciones de rendimiento
 */

import distributedCacheManager from '../services/cache/DistributedCacheManager.js';
import cacheMonitoring from '../services/cache/CacheMonitoring.js';
import cacheInvalidation from '../services/cache/CacheInvalidation.js';
import cacheConfig from '../config/cache/CacheConfig.js';
import logger from '../services/core/core/logger.js';
import crypto from 'crypto';

/**
 * Perfiles de cache predefinidos
 */
const CACHE_PROFILES = {
  static: {
    ttl: 86400, // 24 horas
    staleWhileRevalidate: 3600, // 1 hora
    tags: ['static'],
    compression: true,
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Vary': 'Accept-Encoding'
    }
  },
  
  dynamic: {
    ttl: 300, // 5 minutos
    staleWhileRevalidate: 60, // 1 minuto
    tags: ['dynamic'],
    compression: true,
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Vary': 'Accept-Encoding, Authorization'
    }
  },
  
  public: {
    ttl: 1800, // 30 minutos
    staleWhileRevalidate: 300, // 5 minutos
    tags: ['public'],
    compression: true,
    headers: {
      'Cache-Control': 'public, max-age=1800',
      'Vary': 'Accept-Encoding'
    }
  },
  
  user: {
    ttl: 900, // 15 minutos
    staleWhileRevalidate: 180, // 3 minutos
    tags: ['user'],
    compression: true,
    private: true,
    headers: {
      'Cache-Control': 'private, max-age=900',
      'Vary': 'Authorization'
    }
  },
  
  realtime: {
    ttl: 30, // 30 segundos
    staleWhileRevalidate: 10, // 10 segundos
    tags: ['realtime'],
    compression: false,
    headers: {
      'Cache-Control': 'public, max-age=30',
      'Vary': 'Accept-Encoding'
    }
  }
};

/**
 * Middleware principal de cache avanzado
 */
export const advancedCacheMiddleware = (options = {}) => {
  const config = {
    profile: 'dynamic',
    keyGenerator: null,
    skipCache: false,
    enableMetrics: true,
    enableDebug: process.env.NODE_ENV === 'development',
    varyBy: [],
    compression: true,
    enableETag: true,
    enableInvalidation: true,
    staleWhileRevalidate: 60,
    tags: [],
    condition: null,
    allowAuth: false,
    private: false,
    dependencies: null,
    ...options
  };

  // Obtener configuración del perfil
  const profile = CACHE_PROFILES[config.profile] || CACHE_PROFILES.dynamic;
  const finalConfig = { ...profile, ...config };

  return async (req, res, next) => {
    const startTime = Date.now();
    middlewareMetrics.requests++;
    
    // Verificar si debe saltar el cache
    if (shouldSkipCache(req, finalConfig)) {
      return next();
    }

    try {
      const cacheKey = generateCacheKey(req, finalConfig);

      // Intentar obtener del cache
      const cachedResponse = await getCachedResponse(cacheKey, finalConfig);

      if (cachedResponse) {
        middlewareMetrics.hits++;
        const responseTime = Date.now() - startTime;
        middlewareMetrics.totalResponseTime += responseTime;
        
        if (finalConfig.enableMetrics) {
          recordHTTPMetrics('hit', responseTime, cacheKey, req);
        }
        
        return handleCacheHit(res, cachedResponse, cacheKey, startTime, finalConfig);
      }

      // Cache miss - interceptar respuesta
      middlewareMetrics.misses++;
      const responseTime = Date.now() - startTime;
      middlewareMetrics.totalResponseTime += responseTime;
      
      if (finalConfig.enableMetrics) {
        recordHTTPMetrics('miss', responseTime, cacheKey, req);
      }
      
      return handleCacheMiss(req, res, next, cacheKey, startTime, finalConfig);

    } catch (error) {
      logger.error('Error en advanced cache middleware:', error);
      middlewareMetrics.errors++;
      
      if (finalConfig.enableMetrics) {
        recordHTTPMetrics('error', Date.now() - startTime, null, req, error);
      }
      
      return next(); // Continuar sin cache en caso de error
    }
  };
};

/**
 * Métricas del middleware
 */
let middlewareMetrics = {
  requests: 0,
  hits: 0,
  misses: 0,
  errors: 0,
  totalResponseTime: 0,
  compressionSavings: 0
};

/**
 * Determinar si debe saltar el cache
 */
function shouldSkipCache(req, config) {
  // Verificar método HTTP
  const skipMethods = config.skipMethods || ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (skipMethods.includes(req.method)) {
    return true;
  }

  // Verificar headers que indican no cache
  const cacheControl = req.headers['cache-control'];
  if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
    return true;
  }

  if (req.headers['pragma'] === 'no-cache') {
    return true;
  }

  // Verificar query parameters que indican no cache
  if (req.query.nocache || req.query._t || req.query.bust) {
    return true;
  }

  // Requests con authorization (a menos que esté explícitamente permitido)
  if (req.headers.authorization && !config.allowAuth && !config.private) {
    return true;
  }

  // Verificar si está deshabilitado globalmente
  if (config.skipCache) {
    return true;
  }

  // Verificar condiciones personalizadas
  if (config.condition && !config.condition(req)) {
    return true;
  }

  return false;
}

/**
 * Generar clave de cache
 */
function generateCacheKey(req, config) {
  if (config.keyGenerator && typeof config.keyGenerator === 'function') {
    return config.keyGenerator(req);
  }

  const baseKey = `${req.method}:${req.originalUrl || req.url}`;
  
  // Agregar variaciones basadas en headers
  const variations = [];
  
  config.varyBy.forEach(header => {
    const value = req.headers[header.toLowerCase()];
    if (value) {
      variations.push(`${header}:${value}`);
    }
  });

  // Agregar query parameters ordenados
  const sortedQuery = Object.keys(req.query || {})
    .sort()
    .map(key => `${key}=${req.query[key]}`)
    .join('&');

  if (sortedQuery) {
    variations.push(`query:${sortedQuery}`);
  }

  const variationString = variations.length > 0 ? `:${variations.join(':')}` : '';
  return `${baseKey}${variationString}`;
}

/**
 * Obtener respuesta cacheada
 */
async function getCachedResponse(cacheKey, config) {
  try {
    const cached = await apiCache.get(cacheKey);
    
    if (cached && isValidCachedResponse(cached, config)) {
      return cached;
    }

    return null;
  } catch (error) {
    logger.error(`Error obteniendo cache para ${cacheKey}:`, error);
    return null;
  }
}

/**
 * Validar respuesta cacheada
 */
function isValidCachedResponse(cached, config) {
  // Verificar estructura básica
  if (!cached || !cached.response || !cached.timestamp) {
    return false;
  }

  // Verificar TTL
  const age = Date.now() - new Date(cached.timestamp).getTime();
  const maxAge = config.ttl * 1000;

  if (age > maxAge) {
    return false;
  }

  return true;
}

/**
 * Manejar cache hit
 */
function handleCacheHit(res, cachedResponse, cacheKey, startTime, config) {
  const responseTime = Date.now() - startTime;

  // Establecer headers de cache
  res.set('X-Cache', 'HIT');
  res.set('X-Cache-Key', cacheKey);
  res.set('X-Response-Time', `${responseTime}ms`);

  // Establecer headers de la respuesta cacheada
  if (cachedResponse.headers) {
    Object.entries(cachedResponse.headers).forEach(([key, value]) => {
      res.set(key, value);
    });
  }

  // Establecer ETag si está habilitado
  if (config.enableETag && cachedResponse.etag) {
    res.set('ETag', cachedResponse.etag);
  }

  // Establecer headers de control de cache
  res.set('Cache-Control', `public, max-age=${config.ttl}`);

  if (config.enableDebug) {
    logger.debug(`Cache HIT: ${cacheKey} (${responseTime}ms)`);
  }

  return res.json(cachedResponse.response);
}

/**
 * Manejar cache miss
 */
function handleCacheMiss(req, res, next, cacheKey, startTime, config) {
  const responseTime = Date.now() - startTime;

  // Establecer headers de cache miss
  res.set('X-Cache', 'MISS');
  res.set('X-Cache-Key', cacheKey);
  res.set('X-Response-Time', `${responseTime}ms`);

  if (config.enableDebug) {
    logger.debug(`Cache MISS: ${cacheKey} (${responseTime}ms)`);
  }

  // Interceptar la respuesta para cachearla
  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function(data) {
    cacheResponse(cacheKey, data, this, config);
    return originalJson.call(this, data);
  };

  res.send = function(data) {
    // Solo cachear respuestas JSON
    if (this.get('Content-Type')?.includes('application/json')) {
      try {
        const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
        cacheResponse(cacheKey, jsonData, this, config);
      } catch (error) {
        // No es JSON válido, no cachear
      }
    }
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Cachear respuesta
 */
async function cacheResponse(cacheKey, data, res, config) {
  // Solo cachear respuestas exitosas
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return;
  }

  try {
    const cacheData = {
      response: data,
      timestamp: new Date().toISOString(),
      statusCode: res.statusCode,
      headers: extractCacheableHeaders(res),
      etag: config.enableETag ? generateETag(data) : null
    };

    await apiCache.set(cacheKey, cacheData, config.ttl);

    if (config.enableDebug) {
      logger.debug(`Respuesta cacheada: ${cacheKey}`);
    }

  } catch (error) {
    logger.error(`Error cacheando respuesta ${cacheKey}:`, error);
  }
}

/**
 * Extraer headers cacheables
 */
function extractCacheableHeaders(res) {
  const cacheableHeaders = [
    'content-type',
    'content-encoding',
    'content-language',
    'last-modified',
    'expires'
  ];

  const headers = {};
  cacheableHeaders.forEach(header => {
    const value = res.get(header);
    if (value) {
      headers[header] = value;
    }
  });

  return headers;
}

/**
 * Generar ETag para los datos
 */
function generateETag(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return `"${crypto.createHash('md5').update(content).digest('hex')}"`;
}

/**
 * Middleware para invalidación de cache
 */
export const cacheInvalidationMiddleware = (options = {}) => {
  const config = {
    patterns: [],
    methods: ['POST', 'PUT', 'DELETE', 'PATCH'],
    ...options
  };

  return async (req, res, next) => {
    // Solo procesar métodos que modifican datos
    if (!config.methods.includes(req.method)) {
      return next();
    }

    // Interceptar respuesta exitosa para invalidar cache
    const originalJson = res.json;
    const originalSend = res.send;

    const invalidateCache = async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await performCacheInvalidation(req, config);
      }
    };

    res.json = function(data) {
      invalidateCache();
      return originalJson.call(this, data);
    };

    res.send = function(data) {
      invalidateCache();
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Realizar invalidación de cache
 */
async function performCacheInvalidation(req, config) {
  try {
    const patterns = generateInvalidationPatterns(req, config);
    
    const invalidationPromises = patterns.map(async (pattern) => {
      const count = await distributedCacheManager.invalidatePattern('api', pattern);
      logger.debug(`Invalidated ${count} cache entries for pattern: ${pattern}`);
      return count;
    });

    const results = await Promise.allSettled(invalidationPromises);
    const totalInvalidated = results
      .filter(result => result.status === 'fulfilled')
      .reduce((sum, result) => sum + result.value, 0);

    if (totalInvalidated > 0) {
      logger.info(`Cache invalidation: ${totalInvalidated} entries invalidated for ${req.originalUrl}`);
    }

  } catch (error) {
    logger.error('Error en invalidación de cache:', error);
  }
}

/**
 * Generar patrones de invalidación
 */
function generateInvalidationPatterns(req, config) {
  const patterns = [...config.patterns];

  // Patrones automáticos basados en la ruta
  const basePath = req.route?.path || req.originalUrl;
  
  // Invalidar rutas relacionadas
  if (basePath.includes('/api/')) {
    const resourcePath = basePath.split('/api/')[1];
    const resourceType = resourcePath.split('/')[0];
    
    patterns.push(`GET:/api/${resourceType}*`);
    patterns.push(`GET:/api/${resourceType}/*`);
  }

  // Patrones específicos por ID de recurso
  const resourceId = req.params.id;
  if (resourceId) {
    patterns.push(`*${resourceId}*`);
  }

  return patterns;
}

/**
 * Middleware para warming de cache
 */
export const cacheWarmingMiddleware = (warmupConfig = {}) => {
  const config = {
    enabled: process.env.CACHE_WARMING_ENABLED === 'true',
    routes: [],
    interval: 300000, // 5 minutos
    ...warmupConfig
  };

  if (!config.enabled) {
    return (req, res, next) => next();
  }

  // Iniciar warming periódico
  setInterval(async () => {
    await performCacheWarming(config);
  }, config.interval);

  return (req, res, next) => next();
};

/**
 * Realizar warming de cache
 */
async function performCacheWarming(config) {
  logger.info('Iniciando cache warming...');

  const warmupPromises = config.routes.map(async (route) => {
    try {
      // Simular request para warming
      const mockReq = {
        method: 'GET',
        originalUrl: route.path,
        headers: route.headers || {},
        query: route.query || {}
      };

      const cacheKey = generateCacheKey(mockReq, route.config || {});
      const cached = await apiCache.get(cacheKey);

      if (!cached && route.loader) {
        const data = await route.loader();
        await apiCache.set(cacheKey, {
          response: data,
          timestamp: new Date().toISOString(),
          statusCode: 200,
          headers: { 'content-type': 'application/json' }
        }, route.ttl || 300);

        logger.debug(`Cache warmed: ${route.path}`);
      }

    } catch (error) {
      logger.error(`Error warming cache for ${route.path}:`, error);
    }
  });

  await Promise.allSettled(warmupPromises);
  logger.info('Cache warming completado');
}

/**
 * Middleware para métricas de cache
 */
export const cacheMetricsMiddleware = () => {
  return (req, res, next) => {
    const startTime = Date.now();

    // Interceptar respuesta para recolectar métricas
    const originalJson = res.json;
    
    res.json = function(data) {
      const responseTime = Date.now() - startTime;
      const cacheStatus = res.get('X-Cache') || 'BYPASS';
      
      // Emitir métricas
      distributedCacheManager.emit('httpCacheMetrics', {
        method: req.method,
        url: req.originalUrl,
        cacheStatus,
        responseTime,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      });

      return originalJson.call(this, data);
    };

    next();
  };
};

// Configuraciones predefinidas para diferentes tipos de endpoints
export const cacheProfiles = {
  static: (options = {}) => advancedCacheMiddleware({ profile: 'static', ...options }),
  dynamic: (options = {}) => advancedCacheMiddleware({ profile: 'dynamic', ...options }),
  public: (options = {}) => advancedCacheMiddleware({ profile: 'public', ...options }),
  user: (options = {}) => advancedCacheMiddleware({ profile: 'user', ...options }),
  realtime: (options = {}) => advancedCacheMiddleware({ profile: 'realtime', ...options })
};

/**
 * Registrar métricas HTTP de cache
 */
function recordHTTPMetrics(type, responseTime, cacheKey = null, req = null, error = null) {
  const metrics = {
    type,
    responseTime,
    cacheKey,
    timestamp: new Date().toISOString(),
    url: req?.originalUrl || req?.url,
    method: req?.method,
    userAgent: req?.headers['user-agent'],
    ip: req?.ip || req?.connection?.remoteAddress,
    cacheStatus: type,
    error: error?.message
  };

  // Emitir evento para el sistema de monitoreo
  try {
    cacheMonitoring.emit('httpCacheMetrics', metrics);
    distributedCacheManager.emit('httpCacheMetrics', metrics);
  } catch (err) {
    logger.error('Error emitiendo métricas HTTP:', err);
  }
  
  // Log para debugging
  if (type === 'error') {
    logger.error(`Cache error: ${cacheKey || 'unknown'} (${responseTime}ms)`, error);
  } else {
    logger.debug(`Cache ${type}: ${cacheKey || 'unknown'} (${responseTime}ms)`);
  }
}

/**
 * Obtener métricas del middleware
 */
function getMiddlewareMetrics() {
  const totalRequests = middlewareMetrics.requests;
  const hitRate = totalRequests > 0 ? middlewareMetrics.hits / totalRequests : 0;
  const errorRate = totalRequests > 0 ? middlewareMetrics.errors / totalRequests : 0;
  const avgResponseTime = totalRequests > 0 ? middlewareMetrics.totalResponseTime / totalRequests : 0;

  return {
    ...middlewareMetrics,
    hitRate,
    errorRate,
    avgResponseTime,
    timestamp: new Date().toISOString()
  };
}

/**
 * Resetear métricas del middleware
 */
function resetMiddlewareMetrics() {
  middlewareMetrics = {
    requests: 0,
    hits: 0,
    misses: 0,
    errors: 0,
    totalResponseTime: 0,
    compressionSavings: 0
  };
}

export default advancedCacheMiddleware;
export { 
  CACHE_PROFILES,
  generateCacheKey,
  getMiddlewareMetrics,
  resetMiddlewareMetrics,
  recordHTTPMetrics
};
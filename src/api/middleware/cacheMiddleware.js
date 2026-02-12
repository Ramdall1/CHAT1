/**
 * Cache Middleware
 * Middleware para integrar Redis Cache en rutas de API
 * Recomendación #16: Redis Cache
 */

import cacheService from '../services/CacheService.js';
import logger from '../../services/core/core/logger.js';

/**
 * Middleware de cache para respuestas HTTP
 */
export const cacheMiddleware = (options = {}) => {
  const {
    ttl = 300, // 5 minutos por defecto
    keyGenerator = null,
    skipCache = false,
    varyBy = []
  } = options;

  return async(req, res, next) => {
    // Saltar cache si está deshabilitado
    if (skipCache || req.method !== 'GET') {
      return next();
    }

    try {
      // Generar clave de cache
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : generateCacheKey(req, varyBy);

      // Intentar obtener del cache
      const cachedResponse = await cacheService.get(cacheKey);
            
      if (cachedResponse) {
        logger.debug(`Cache HIT para ruta: ${req.originalUrl}`);
                
        // Establecer headers de cache
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
                
        return res.json(cachedResponse);
      }

      // Cache MISS - continuar con la ruta
      logger.debug(`Cache MISS para ruta: ${req.originalUrl}`);
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Interceptar la respuesta para cachearla
      const originalJson = res.json;
      res.json = function(data) {
        // Cachear solo respuestas exitosas
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, ttl)
            .catch(error => {
              logger.error('Error cacheando respuesta:', error);
            });
        }
                
        return originalJson.call(this, data);
      };

      next();

    } catch (error) {
      logger.error('Error en cache middleware:', error);
      next(); // Continuar sin cache en caso de error
    }
  };
};

/**
 * Middleware para invalidar cache
 */
export const invalidateCacheMiddleware = (patterns = []) => {
  return async(req, res, next) => {
    // Ejecutar la ruta primero
    const originalJson = res.json;
    res.json = async function(data) {
      // Invalidar cache después de operaciones exitosas
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          for (const pattern of patterns) {
            const resolvedPattern = typeof pattern === 'function' 
              ? pattern(req, data) 
              : pattern;
                        
            await cacheService.delPattern(resolvedPattern);
            logger.debug(`Cache invalidado: ${resolvedPattern}`);
          }
        } catch (error) {
          logger.error('Error invalidando cache:', error);
        }
      }
            
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Middleware específico para contactos
 */
export const contactCacheMiddleware = cacheMiddleware({
  ttl: 1800, // 30 minutos
  keyGenerator: (req) => {
    const { id } = req.params;
    const { page, limit, search } = req.query;
        
    if (id) {
      return `contact:${id}`;
    }
        
    return `contacts:list:${page || 1}:${limit || 10}:${search || 'all'}`;
  }
});

/**
 * Middleware específico para conversaciones
 */
export const conversationCacheMiddleware = cacheMiddleware({
  ttl: 3600, // 1 hora
  keyGenerator: (req) => {
    const { id } = req.params;
    const { contactId, limit } = req.query;
        
    if (id) {
      return `conversation:${id}`;
    }
        
    return `conversations:${contactId || 'all'}:${limit || 50}`;
  }
});

/**
 * Middleware específico para plantillas
 */
export const templateCacheMiddleware = cacheMiddleware({
  ttl: 7200, // 2 horas
  keyGenerator: (req) => {
    const { id } = req.params;
    const { status, category } = req.query;
        
    if (id) {
      return `template:${id}`;
    }
        
    return `templates:${status || 'all'}:${category || 'all'}`;
  }
});

/**
 * Middleware específico para estadísticas
 */
export const statsCacheMiddleware = cacheMiddleware({
  ttl: 600, // 10 minutos
  keyGenerator: (req) => {
    const { period, type } = req.query;
    return `stats:${type || 'general'}:${period || 'day'}`;
  }
});

/**
 * Middleware para rate limiting con cache
 */
export const rateLimitCacheMiddleware = (options = {}) => {
  // Rate limiting desactivado - permitir todas las peticiones
  return (req, res, next) => {
    next();
  };
};

/**
 * Generar clave de cache basada en la request
 */
function generateCacheKey(req, varyBy = []) {
  const baseKey = `route:${req.method}:${req.route?.path || req.path}`;
    
  // Agregar parámetros de ruta
  const params = Object.keys(req.params).length > 0 
    ? `:params:${JSON.stringify(req.params)}` 
    : '';
    
  // Agregar query parameters específicos
  const queryParts = [];
  for (const key of varyBy) {
    if (req.query[key] !== undefined) {
      queryParts.push(`${key}:${req.query[key]}`);
    }
  }
  const query = queryParts.length > 0 ? `:query:${queryParts.join(':')}` : '';
    
  return `${baseKey}${params}${query}`;
}

/**
 * Middleware para limpiar cache en desarrollo
 */
export const clearCacheMiddleware = async(req, res, next) => {
  if (process.env.NODE_ENV === 'development' && req.query.clearCache === 'true') {
    try {
      await cacheService.flush();
      logger.info('Cache limpiado en modo desarrollo');
      res.set('X-Cache-Cleared', 'true');
    } catch (error) {
      logger.error('Error limpiando cache:', error);
    }
  }
  next();
};

/**
 * Middleware para estadísticas de cache
 */
export const cacheStatsMiddleware = async(req, res, next) => {
  if (req.path === '/api/cache/stats') {
    try {
      const stats = await cacheService.getStats();
      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Error obteniendo estadísticas de cache'
      });
    }
  }
  next();
};

export default {
  cacheMiddleware,
  invalidateCacheMiddleware,
  contactCacheMiddleware,
  conversationCacheMiddleware,
  templateCacheMiddleware,
  statsCacheMiddleware,
  rateLimitCacheMiddleware,
  clearCacheMiddleware,
  cacheStatsMiddleware
};
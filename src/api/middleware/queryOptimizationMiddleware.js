/**
 * Query Optimization Middleware
 * Middleware para interceptar y optimizar consultas de base de datos
 * Recomendación #17: Optimización de consultas de base de datos
 */

import DatabaseOptimizationService from '../../services/core/core/DatabaseOptimizationService.js';
import logger from '../../services/core/core/logger.js';

/**
 * Middleware para optimización automática de consultas
 */
export const queryOptimizationMiddleware = (options = {}) => {
  const {
    enableProfiling = true,
    enableCaching = true,
    slowQueryThreshold = 1000,
    enableAutoOptimization = false
  } = options;

  return async(req, res, next) => {
    if (!enableProfiling) {
      return next();
    }

    // Interceptar métodos de base de datos en el request
    const originalDbMethods = {};
        
    if (req.db) {
      // Interceptar getAllQuery
      if (req.db.getAllQuery) {
        originalDbMethods.getAllQuery = req.db.getAllQuery.bind(req.db);
        req.db.getAllQuery = async(sql, params) => {
          return await DatabaseOptimizationService.executeWithProfiling(sql, params);
        };
      }

      // Interceptar getQuery
      if (req.db.getQuery) {
        originalDbMethods.getQuery = req.db.getQuery.bind(req.db);
        req.db.getQuery = async(sql, params) => {
          const startTime = Date.now();
          try {
            const result = await originalDbMethods.getQuery(sql, params);
            const executionTime = Date.now() - startTime;
                        
            if (executionTime > slowQueryThreshold) {
              logger.warn(`Slow single query detected (${executionTime}ms): ${sql}`);
            }
                        
            return result;
          } catch (error) {
            logger.error('Query error:', error);
            throw error;
          }
        };
      }

      // Interceptar runQuery
      if (req.db.runQuery) {
        originalDbMethods.runQuery = req.db.runQuery.bind(req.db);
        req.db.runQuery = async(sql, params) => {
          const startTime = Date.now();
          try {
            const result = await originalDbMethods.runQuery(sql, params);
            const executionTime = Date.now() - startTime;
                        
            if (executionTime > slowQueryThreshold) {
              logger.warn(`Slow write query detected (${executionTime}ms): ${sql}`);
            }
                        
            return result;
          } catch (error) {
            logger.error('Write query error:', error);
            throw error;
          }
        };
      }
    }

    // Restaurar métodos originales después de la respuesta
    res.on('finish', () => {
      if (req.db) {
        Object.assign(req.db, originalDbMethods);
      }
    });

    next();
  };
};

/**
 * Middleware para análisis de consultas por ruta
 */
export const routeQueryAnalysisMiddleware = () => {
  const routeStats = new Map();

  return async(req, res, next) => {
    const route = req.route?.path || req.path;
    const method = req.method;
    const routeKey = `${method} ${route}`;
        
    const startTime = Date.now();
    let queryCount = 0;

    // Interceptar consultas para contar
    if (req.db) {
      const originalMethods = {};
            
      ['getAllQuery', 'getQuery', 'runQuery'].forEach(methodName => {
        if (req.db[methodName]) {
          originalMethods[methodName] = req.db[methodName].bind(req.db);
          req.db[methodName] = async(...args) => {
            queryCount++;
            return await originalMethods[methodName](...args);
          };
        }
      });

      // Restaurar métodos después de la respuesta
      res.on('finish', () => {
        Object.assign(req.db, originalMethods);
                
        const totalTime = Date.now() - startTime;
                
        // Actualizar estadísticas de ruta
        const stats = routeStats.get(routeKey) || {
          requests: 0,
          totalQueries: 0,
          totalTime: 0,
          avgQueries: 0,
          avgTime: 0
        };
                
        stats.requests++;
        stats.totalQueries += queryCount;
        stats.totalTime += totalTime;
        stats.avgQueries = stats.totalQueries / stats.requests;
        stats.avgTime = stats.totalTime / stats.requests;
                
        routeStats.set(routeKey, stats);
                
        // Log rutas con muchas consultas
        if (queryCount > 10) {
          logger.warn(`Route with many queries: ${routeKey} (${queryCount} queries in ${totalTime}ms)`);
        }
      });
    }

    next();
  };
};

/**
 * Middleware para optimización de consultas N+1
 */
export const nPlusOneDetectionMiddleware = () => {
  return async(req, res, next) => {
    const queryPatterns = new Map();
    const startTime = Date.now();

    if (req.db) {
      const originalGetAllQuery = req.db.getAllQuery?.bind(req.db);
      const originalGetQuery = req.db.getQuery?.bind(req.db);

      if (originalGetAllQuery) {
        req.db.getAllQuery = async(sql, params) => {
          const pattern = sql.replace(/\?/g, 'PARAM').replace(/\d+/g, 'NUM');
          const count = queryPatterns.get(pattern) || 0;
          queryPatterns.set(pattern, count + 1);
                    
          return await originalGetAllQuery(sql, params);
        };
      }

      if (originalGetQuery) {
        req.db.getQuery = async(sql, params) => {
          const pattern = sql.replace(/\?/g, 'PARAM').replace(/\d+/g, 'NUM');
          const count = queryPatterns.get(pattern) || 0;
          queryPatterns.set(pattern, count + 1);
                    
          return await originalGetQuery(sql, params);
        };
      }

      res.on('finish', () => {
        // Detectar patrones N+1
        for (const [pattern, count] of queryPatterns) {
          if (count > 5) { // Umbral para detectar N+1
            logger.warn(`Potential N+1 query detected: ${pattern} (executed ${count} times)`);
                        
            // Sugerir optimización
            if (pattern.includes('SELECT') && pattern.includes('WHERE')) {
              logger.info(`Suggestion: Consider using JOIN or IN clause for: ${pattern}`);
            }
          }
        }

        // Restaurar métodos originales
        if (originalGetAllQuery) req.db.getAllQuery = originalGetAllQuery;
        if (originalGetQuery) req.db.getQuery = originalGetQuery;
      });
    }

    next();
  };
};

/**
 * Middleware para cache de consultas
 */
export const queryCacheMiddleware = (options = {}) => {
  const {
    ttl = 300, // 5 minutos
    maxSize = 1000,
    enableForRoutes = []
  } = options;

  const cache = new Map();
  const cacheTimestamps = new Map();

  return async(req, res, next) => {
    const route = req.route?.path || req.path;
        
    // Solo aplicar cache a rutas específicas
    if (enableForRoutes.length > 0 && !enableForRoutes.includes(route)) {
      return next();
    }

    if (req.db && req.method === 'GET') {
      const originalGetAllQuery = req.db.getAllQuery?.bind(req.db);
      const originalGetQuery = req.db.getQuery?.bind(req.db);

      if (originalGetAllQuery) {
        req.db.getAllQuery = async(sql, params) => {
          const cacheKey = `${sql}:${JSON.stringify(params)}`;
          const cached = cache.get(cacheKey);
          const timestamp = cacheTimestamps.get(cacheKey);

          if (cached && timestamp && (Date.now() - timestamp) < ttl * 1000) {
            logger.debug(`Query cache HIT: ${sql.substring(0, 50)}...`);
            return cached;
          }

          const result = await originalGetAllQuery(sql, params);
                    
          // Limpiar cache si está lleno
          if (cache.size >= maxSize) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
            cacheTimestamps.delete(oldestKey);
          }

          cache.set(cacheKey, result);
          cacheTimestamps.set(cacheKey, Date.now());
                    
          logger.debug(`Query cache MISS: ${sql.substring(0, 50)}...`);
          return result;
        };
      }

      if (originalGetQuery) {
        req.db.getQuery = async(sql, params) => {
          const cacheKey = `single:${sql}:${JSON.stringify(params)}`;
          const cached = cache.get(cacheKey);
          const timestamp = cacheTimestamps.get(cacheKey);

          if (cached && timestamp && (Date.now() - timestamp) < ttl * 1000) {
            return cached;
          }

          const result = await originalGetQuery(sql, params);
                    
          if (cache.size >= maxSize) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
            cacheTimestamps.delete(oldestKey);
          }

          cache.set(cacheKey, result);
          cacheTimestamps.set(cacheKey, Date.now());
                    
          return result;
        };
      }

      res.on('finish', () => {
        if (originalGetAllQuery) req.db.getAllQuery = originalGetAllQuery;
        if (originalGetQuery) req.db.getQuery = originalGetQuery;
      });
    }

    next();
  };
};

/**
 * Middleware para límites de consultas por request
 */
export const queryLimitMiddleware = (options = {}) => {
  const {
    maxQueries = 50,
    maxQueryTime = 10000 // 10 segundos
  } = options;

  return async(req, res, next) => {
    let queryCount = 0;
    const startTime = Date.now();

    if (req.db) {
      const originalMethods = {};
            
      ['getAllQuery', 'getQuery', 'runQuery'].forEach(methodName => {
        if (req.db[methodName]) {
          originalMethods[methodName] = req.db[methodName].bind(req.db);
          req.db[methodName] = async(...args) => {
            queryCount++;
                        
            if (queryCount > maxQueries) {
              throw new Error(`Query limit exceeded: ${maxQueries} queries per request`);
            }
                        
            if (Date.now() - startTime > maxQueryTime) {
              throw new Error(`Query time limit exceeded: ${maxQueryTime}ms per request`);
            }
                        
            return await originalMethods[methodName](...args);
          };
        }
      });

      res.on('finish', () => {
        Object.assign(req.db, originalMethods);
      });
    }

    next();
  };
};

/**
 * Middleware para estadísticas de optimización
 */
export const optimizationStatsMiddleware = () => {
  return async(req, res, next) => {
    if (req.path === '/api/database/optimization-stats') {
      try {
        const stats = DatabaseOptimizationService.getPerformanceStats();
        return res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Error getting optimization stats'
        });
      }
    }

    if (req.path === '/api/database/optimization-report') {
      try {
        const report = DatabaseOptimizationService.generateOptimizationReport();
        return res.json({
          success: true,
          data: report
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Error generating optimization report'
        });
      }
    }

    next();
  };
};

export default {
  queryOptimizationMiddleware,
  routeQueryAnalysisMiddleware,
  nPlusOneDetectionMiddleware,
  queryCacheMiddleware,
  queryLimitMiddleware,
  optimizationStatsMiddleware
};
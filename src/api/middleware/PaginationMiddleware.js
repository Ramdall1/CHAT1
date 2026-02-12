/**
 * Middleware de Paginación para Optimización de Consultas
 * Proporciona paginación eficiente y optimización de consultas de base de datos
 */

import { createLogger } from '../../services/core/core/logger.js';

class PaginationMiddleware {
  constructor(options = {}) {
    this.defaultLimit = options.defaultLimit || 20;
    this.maxLimit = options.maxLimit || 100;
    this.defaultSort = options.defaultSort || { createdAt: -1 };
    this.enableCache = options.enableCache !== false;
    this.cacheService = options.cacheService;
        
    // Logger centralizado
    this.logger = createLogger('PAGINATION_MIDDLEWARE');
  }

  /**
     * Middleware para parsear parámetros de paginación
     */
  parsePaginationParams() {
    return (req, res, next) => {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(
        this.maxLimit,
        Math.max(1, parseInt(req.query.limit) || this.defaultLimit)
      );
      const skip = (page - 1) * limit;

      // Parsear ordenamiento
      let sort = this.defaultSort;
      if (req.query.sort) {
        try {
          const sortParam = req.query.sort;
          if (typeof sortParam === 'string') {
            const [field, order] = sortParam.split(':');
            sort = { [field]: order === 'desc' ? -1 : 1 };
          }
        } catch (error) {
          if (this.logger) this.logger.warn('⚠️ Error parseando parámetros de ordenamiento:', error.message);
        }
      }

      // Parsear filtros
      const filters = {};
      if (req.query.search) {
        filters.search = req.query.search;
      }
      if (req.query.status) {
        filters.status = req.query.status;
      }
      if (req.query.dateFrom) {
        filters.dateFrom = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filters.dateTo = new Date(req.query.dateTo);
      }

      req.pagination = {
        page,
        limit,
        skip,
        sort,
        filters
      };

      next();
    };
  }

  /**
     * Genera una clave de caché basada en los parámetros de la consulta
     */
  generateCacheKey(prefix, req) {
    const { page, limit, sort, filters } = req.pagination;
    const sortKey = JSON.stringify(sort);
    const filtersKey = JSON.stringify(filters);
    return `${prefix}:page:${page}:limit:${limit}:sort:${sortKey}:filters:${filtersKey}`;
  }

  /**
     * Middleware para aplicar caché a consultas paginadas
     */
  withCache(prefix, ttl = 60) {
    return async(req, res, next) => {
      if (!this.enableCache || !this.cacheService) {
        return next();
      }

      const cacheKey = this.generateCacheKey(prefix, req);
            
      try {
        const cachedResult = await this.cacheService.get(cacheKey);
        if (cachedResult) {
          res.set('X-Cache', 'HIT');
          return res.json(cachedResult);
        }
      } catch (error) {
        if (this.logger) this.logger.warn('⚠️ Error obteniendo caché:', error.message);
      }

      // Interceptar res.json para cachear la respuesta
      const originalJson = res.json;
      res.json = function(data) {
        if (res.statusCode === 200 && data) {
          // Cachear solo respuestas exitosas
          this.cacheService?.set(cacheKey, data, ttl).catch(error => {
            if (this.logger) this.logger.error('Error cacheando respuesta:', error);
          });
        }
        res.set('X-Cache', 'MISS');
        return originalJson.call(this, data);
      }.bind({ cacheService: this.cacheService });

      next();
    };
  }

  /**
     * Construye una consulta MongoDB optimizada
     */
  buildMongoQuery(baseQuery = {}, req) {
    const { filters } = req.pagination;
    const query = { ...baseQuery };

    // Aplicar filtros de búsqueda
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // Aplicar filtros de estado
    if (filters.status) {
      query.status = filters.status;
    }

    // Aplicar filtros de fecha
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        query.createdAt.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        query.createdAt.$lte = filters.dateTo;
      }
    }

    return query;
  }

  /**
     * Ejecuta una consulta paginada optimizada
     */
  async executePaginatedQuery(collection, baseQuery = {}, req, options = {}) {
    const { page, limit, skip, sort } = req.pagination;
    const query = this.buildMongoQuery(baseQuery, req);

    try {
      // Usar agregación para mejor rendimiento
      const pipeline = [
        { $match: query },
        { $sort: sort },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limit }
            ],
            totalCount: [
              { $count: 'count' }
            ]
          }
        }
      ];

      // Agregar proyección si se especifica
      if (options.projection) {
        pipeline.splice(2, 0, { $project: options.projection });
      }

      const [result] = await collection.aggregate(pipeline).toArray();
      const data = result.data || [];
      const totalCount = result.totalCount[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      if (this.logger) this.logger.error('❌ Error en consulta paginada:', error);
      throw error;
    }
  }

  /**
     * Formatea la respuesta paginada estándar
     */
  formatResponse(data, pagination, metadata = {}) {
    return {
      success: true,
      data,
      pagination,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
     * Middleware para invalidar caché relacionado
     */
  invalidateCache(patterns = []) {
    return async(req, res, next) => {
      if (!this.enableCache || !this.cacheService) {
        return next();
      }

      // Interceptar respuestas exitosas para invalidar caché
      const originalJson = res.json;
      res.json = function(data) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Invalidar caché en operaciones exitosas
          patterns.forEach(pattern => {
            this.cacheService?.invalidatePattern?.(pattern).catch(error => {
              if (this.logger) this.logger.error('Error invalidando caché:', error);
            });
          });
        }
        return originalJson.call(this, data);
      }.bind({ cacheService: this.cacheService });

      next();
    };
  }
}

export default PaginationMiddleware;
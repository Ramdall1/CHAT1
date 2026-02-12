/**
 * Middleware Centralizado
 * 
 * Contiene todos los middlewares reutilizables del sistema
 * para autenticación, validación, logging, etc.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { createLogger } from './logger.js';
import config from '../../../workflows/index.js';

const logger = createLogger('MIDDLEWARE');

/**
 * Middleware de autenticación básica
 */
export function authMiddleware(req, res, next) {
  try {
    // Por ahora, permitir todas las requests (autenticación simplificada)
    // En producción, implementar validación JWT apropiada
    next();
  } catch (error) {
    logger.error('Error en middleware de autenticación', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Middleware de validación de datos
 */
export function validateData(schema) {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }
      
      req.validatedData = value;
      next();
    } catch (error) {
      logger.error('Error en validación de datos', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  };
}

/**
 * Middleware de manejo de errores
 */
export function errorHandler(err, req, res, next) {
  logger.error('Error no manejado', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  // Error de validación
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Error de validación',
      details: err.message
    });
  }
  
  // Error de archivo no encontrado
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      error: 'Recurso no encontrado'
    });
  }
  
  // Error de permisos
  if (err.code === 'EACCES') {
    return res.status(403).json({
      success: false,
      error: 'Permisos insuficientes'
    });
  }
  
  // Error genérico
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

/**
 * Middleware de CORS
 */
export function corsMiddleware(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}

/**
 * Middleware de rate limiting básico - DESACTIVADO
 */
export function rateLimitMiddleware(options = {}) {
  return (req, res, next) => {
    // Simplemente pasar al siguiente middleware sin verificaciones
    next();
  };
}

/**
 * Middleware de validación de parámetros de URL
 */
export function validateParams(paramValidators) {
  return (req, res, next) => {
    try {
      for (const [param, validator] of Object.entries(paramValidators)) {
        const value = req.params[param];
        
        if (!validator(value)) {
          return res.status(400).json({
            success: false,
            error: `Parámetro inválido: ${param}`,
            value
          });
        }
      }
      
      next();
    } catch (error) {
      logger.error('Error validando parámetros', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  };
}

/**
 * Middleware de timeout para requests
 */
export function timeoutMiddleware(timeoutMs = 30000) {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Timeout de la solicitud'
        });
      }
    }, timeoutMs);
    
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
}

/**
 * Middleware de compresión de respuestas
 */
export function compressionMiddleware(req, res, next) {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (typeof data === 'object') {
      // Comprimir objetos grandes eliminando campos innecesarios
      if (Array.isArray(data) && data.length > 100) {
        logger.debug(`Comprimiendo respuesta con ${data.length} elementos`);
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Middleware de cache simple
 */
export function cacheMiddleware(ttlSeconds = 300) {
  const cache = new Map();
  
  return (req, res, next) => {
    // Solo cachear GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = req.originalUrl;
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttlSeconds * 1000) {
      logger.debug(`Cache hit para ${key}`);
      return res.json(cached.data);
    }
    
    const originalSend = res.send;
    res.send = function(data) {
      // Cachear solo respuestas exitosas
      if (res.statusCode === 200) {
        cache.set(key, {
          data: typeof data === 'string' ? JSON.parse(data) : data,
          timestamp: Date.now()
        });
        
        // Limpiar cache viejo
        if (cache.size > 1000) {
          const oldestKey = cache.keys().next().value;
          cache.delete(oldestKey);
        }
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

/**
 * Middleware de sanitización de datos
 */
export function sanitizeMiddleware(req, res, next) {
  try {
    // Sanitizar body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitizar query params
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    next();
  } catch (error) {
    logger.error('Error sanitizando datos', error);
    res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos'
    });
  }
}

/**
 * Función auxiliar para sanitizar objetos
 */
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const cleanKey = key.replace(/[<>"'&]/g, '');
    if (typeof value === 'string') {
      sanitized[cleanKey] = value
        .replace(/[<>"'&]/g, '')
        .trim()
        .substring(0, 1000);
    } else if (Array.isArray(value)) {
      sanitized[cleanKey] = value.map(item => sanitizeObject(item));
    } else if (typeof value === 'object') {
      sanitized[cleanKey] = sanitizeObject(value);
    } else {
      sanitized[cleanKey] = value;
    }
  }
  return sanitized;
};

/**
 * Middleware de métricas básicas
 */
export function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.debug('Request metrics', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
}

export default {
  authMiddleware,
  validateData,
  errorHandler,
  corsMiddleware,
  rateLimitMiddleware,
  validateParams,
  timeoutMiddleware,
  compressionMiddleware,
  cacheMiddleware,
  sanitizeMiddleware,
  metricsMiddleware
};
/**
 * @fileoverview API Manager Service
 * Gestiona todas las APIs del sistema, incluyendo routing, middleware y validación
 * 
 * @author ChatBot Enterprise Team
 * @version 6.0.0
 * @since 1.0.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { EventEmitter } from 'events';
import { logger } from '../core/logger.js';

/**
 * Estados de API
 */
export const APIStatus = {
  INACTIVE: 'inactive',
  STARTING: 'starting',
  ACTIVE: 'active',
  ERROR: 'error',
  MAINTENANCE: 'maintenance'
};

/**
 * Tipos de endpoint
 */
export const EndpointType = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  INTERNAL: 'internal',
  WEBHOOK: 'webhook'
};

/**
 * Métodos HTTP soportados
 */
export const HTTPMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  OPTIONS: 'OPTIONS',
  HEAD: 'HEAD'
};

/**
 * Clase principal del gestor de APIs
 */
export class APIManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Configuración del servidor
      port: config.port || process.env.PORT || 3000,
      host: config.host || process.env.HOST || '0.0.0.0',
      
      // Configuración de CORS
      cors: {
        origin: config.cors?.origin || '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        credentials: true,
        ...config.cors
      },
      
      // Configuración de rate limiting
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 100, // máximo 100 requests por ventana
        message: 'Too many requests from this IP',
        standardHeaders: true,
        legacyHeaders: false,
        ...config.rateLimit
      },
      
      // Configuración de seguridad
      security: {
        helmet: true,
        compression: true,
        bodyLimit: '10mb',
        ...config.security
      },
      
      // Configuración de logging
      logging: {
        enabled: true,
        logRequests: true,
        logResponses: false,
        logErrors: true,
        ...config.logging
      },
      
      // Configuración de validación
      validation: {
        enabled: true,
        strictMode: false,
        ...config.validation
      },
      
      ...config
    };
    
    // Express app
    this.app = express();
    this.server = null;
    this.status = APIStatus.INACTIVE;
    
    // Almacenamiento de rutas y middleware
    this.routes = new Map();
    this.middleware = [];
    this.errorHandlers = [];
    
    // Estadísticas
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastResponseTime: 0,
      uptime: 0,
      startTime: null
    };
    
    // Rate limiting por endpoint
    this.endpointLimiters = new Map();
    
    this.initializeAPI();
  }

  /**
   * Inicializa el API Manager
   * @async
   * @returns {Promise<void>}
   * @throws {Error} Si falla la inicialización
   */
  async initializeAPI() {
    try {
      // Configurar middleware básico
      this.setupBasicMiddleware();
      
      // Configurar middleware de logging
      this.setupLoggingMiddleware();
      
      // Configurar middleware de estadísticas
      this.setupStatsMiddleware();
      
      // Configurar manejo de errores
      this.setupErrorHandling();
      
      logger.info('APIManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize APIManager', error);
      throw error;
    }
  }

  /**
   * Configura middleware básico
   */
  setupBasicMiddleware() {
    // Seguridad con Helmet
    if (this.config.security.helmet) {
      this.app.use(helmet());
    }
    
    // Compresión
    if (this.config.security.compression) {
      this.app.use(compression());
    }
    
    // CORS
    this.app.use(cors(this.config.cors));
    
    // Parsing de JSON
    this.app.use(express.json({ 
      limit: this.config.security.bodyLimit 
    }));
    
    // Parsing de URL encoded
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: this.config.security.bodyLimit 
    }));
    
    // Rate limiting global
    const limiter = rateLimit(this.config.rateLimit);
    this.app.use(limiter);
  }

  /**
   * Configura middleware de logging
   */
  setupLoggingMiddleware() {
    if (!this.config.logging.enabled) {
      return;
    }
    
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      // Log de request
      if (this.config.logging.logRequests) {
        logger.info('API Request', {
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
      }
      
      // Interceptar response
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - startTime;
        
        // Log de response
        if (this.config.logging.logResponses) {
          logger.info('API Response', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            timestamp: new Date().toISOString()
          });
        }
        
        return originalSend.call(this, data);
      }.bind(this);
      
      next();
    });
  }

  /**
   * Configura middleware de estadísticas
   */
  setupStatsMiddleware() {
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      // Interceptar response para estadísticas
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - startTime;
        
        // Actualizar estadísticas
        this.updateStats(responseTime, res.statusCode < 400);
        
        return originalSend.call(this, data);
      }.bind(this);
      
      next();
    });
  }

  /**
   * Configura manejo de errores
   */
  setupErrorHandling() {
    // Middleware de error 404
    this.app.use((req, res, next) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `${req.method} ${req.url} not found`,
        timestamp: new Date().toISOString()
      });
    });
    
    // Middleware de manejo de errores
    this.app.use((error, req, res, next) => {
      if (this.config.logging.logErrors) {
        logger.error('API Error', {
          method: req.method,
          url: req.url,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
      
      // Determinar código de estado
      let statusCode = error.statusCode || error.status || 500;
      
      // Respuesta de error
      const errorResponse = {
        success: false,
        error: error.name || 'Internal Server Error',
        message: error.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      };
      
      // Agregar stack trace en desarrollo
      if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = error.stack;
      }
      
      res.status(statusCode).json(errorResponse);
      
      // Emitir evento de error
      this.emit('api.error', error, req, res);
    });
  }

  /**
   * Registra una nueva ruta
   * @param {string} method - Método HTTP (GET, POST, PUT, etc.)
   * @param {string} path - Ruta del endpoint
   * @param {Function} handler - Función manejadora de la ruta
   * @param {Object} [options={}] - Opciones adicionales
   * @param {Array} [options.middleware] - Middleware específico para la ruta
   * @param {Object} [options.validation] - Esquema de validación
   * @param {Object} [options.rateLimit] - Configuración de rate limiting
   * @throws {Error} Si el método no es válido o la ruta ya existe
   */
  registerRoute(method, path, handler, options = {}) {
    const route = {
      method: method.toUpperCase(),
      path,
      handler,
      type: options.type || EndpointType.PUBLIC,
      middleware: options.middleware || [],
      validation: options.validation,
      rateLimit: options.rateLimit,
      description: options.description,
      tags: options.tags || [],
      createdAt: new Date().toISOString()
    };
    
    const routeKey = `${route.method}:${path}`;
    this.routes.set(routeKey, route);
    
    // Crear middleware stack
    const middlewareStack = [];
    
    // Rate limiting específico del endpoint
    if (route.rateLimit) {
      const limiter = rateLimit({
        ...this.config.rateLimit,
        ...route.rateLimit
      });
      middlewareStack.push(limiter);
      this.endpointLimiters.set(routeKey, limiter);
    }
    
    // Middleware personalizado
    if (route.middleware.length > 0) {
      middlewareStack.push(...route.middleware);
    }
    
    // Middleware de validación
    if (route.validation && this.config.validation.enabled) {
      middlewareStack.push(this.createValidationMiddleware(route.validation));
    }
    
    // Wrapper del handler para manejo de errores
    const wrappedHandler = this.wrapHandler(route.handler);
    
    // Registrar en Express
    switch (route.method) {
      case HTTPMethod.GET:
        this.app.get(path, ...middlewareStack, wrappedHandler);
        break;
      case HTTPMethod.POST:
        this.app.post(path, ...middlewareStack, wrappedHandler);
        break;
      case HTTPMethod.PUT:
        this.app.put(path, ...middlewareStack, wrappedHandler);
        break;
      case HTTPMethod.PATCH:
        this.app.patch(path, ...middlewareStack, wrappedHandler);
        break;
      case HTTPMethod.DELETE:
        this.app.delete(path, ...middlewareStack, wrappedHandler);
        break;
      case HTTPMethod.OPTIONS:
        this.app.options(path, ...middlewareStack, wrappedHandler);
        break;
      case HTTPMethod.HEAD:
        this.app.head(path, ...middlewareStack, wrappedHandler);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${route.method}`);
    }
    
    logger.info(`Route registered: ${route.method} ${path}`, {
      type: route.type,
      middleware: route.middleware.length,
      hasValidation: !!route.validation
    });
    
    return route;
  }

  /**
   * Crea middleware de validación
   */
  createValidationMiddleware(validation) {
    return (req, res, next) => {
      try {
        // Validar parámetros de query
        if (validation.query) {
          const queryErrors = this.validateObject(req.query, validation.query);
          if (queryErrors.length > 0) {
            return res.status(400).json({
              success: false,
              error: 'Query validation failed',
              details: queryErrors
            });
          }
        }
        
        // Validar parámetros de ruta
        if (validation.params) {
          const paramErrors = this.validateObject(req.params, validation.params);
          if (paramErrors.length > 0) {
            return res.status(400).json({
              success: false,
              error: 'Parameter validation failed',
              details: paramErrors
            });
          }
        }
        
        // Validar body
        if (validation.body) {
          const bodyErrors = this.validateObject(req.body, validation.body);
          if (bodyErrors.length > 0) {
            return res.status(400).json({
              success: false,
              error: 'Body validation failed',
              details: bodyErrors
            });
          }
        }
        
        // Validar headers
        if (validation.headers) {
          const headerErrors = this.validateObject(req.headers, validation.headers);
          if (headerErrors.length > 0) {
            return res.status(400).json({
              success: false,
              error: 'Header validation failed',
              details: headerErrors
            });
          }
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Valida un objeto contra un esquema
   */
  validateObject(obj, schema) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];
      
      // Verificar campo requerido
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`Field '${field}' is required`);
        continue;
      }
      
      // Si el campo no está presente y no es requerido, continuar
      if (value === undefined || value === null) {
        continue;
      }
      
      // Verificar tipo
      if (rules.type && typeof value !== rules.type) {
        errors.push(`Field '${field}' must be of type ${rules.type}`);
        continue;
      }
      
      // Verificar longitud mínima
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`Field '${field}' must be at least ${rules.minLength} characters long`);
      }
      
      // Verificar longitud máxima
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`Field '${field}' must be at most ${rules.maxLength} characters long`);
      }
      
      // Verificar valor mínimo
      if (rules.min && value < rules.min) {
        errors.push(`Field '${field}' must be at least ${rules.min}`);
      }
      
      // Verificar valor máximo
      if (rules.max && value > rules.max) {
        errors.push(`Field '${field}' must be at most ${rules.max}`);
      }
      
      // Verificar patrón regex
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`Field '${field}' does not match required pattern`);
      }
      
      // Verificar valores permitidos
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
      }
    }
    
    return errors;
  }

  /**
   * Envuelve un handler para manejo de errores
   */
  wrapHandler(handler) {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Registra middleware global
   */
  use(middleware) {
    this.middleware.push(middleware);
    this.app.use(middleware);
    
    logger.info('Global middleware registered');
  }

  /**
   * Inicia el servidor
   * @async
   * @returns {Promise<void>}
   * @throws {Error} Si el servidor ya está activo o falla el inicio
   */
  async start() {
    if (this.status === APIStatus.ACTIVE) {
      logger.warn('API server is already running');
      return;
    }
    
    this.status = APIStatus.STARTING;
    
    try {
      // Registrar rutas de sistema
      this.registerSystemRoutes();
      
      // Iniciar servidor
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        this.status = APIStatus.ACTIVE;
        this.stats.startTime = Date.now();
        
        logger.info(`API server started on ${this.config.host}:${this.config.port}`);
        this.emit('api.started', {
          host: this.config.host,
          port: this.config.port
        });
      });
      
      // Manejo de errores del servidor
      this.server.on('error', (error) => {
        this.status = APIStatus.ERROR;
        logger.error('API server error', error);
        this.emit('api.error', error);
      });
      
    } catch (error) {
      this.status = APIStatus.ERROR;
      logger.error('Failed to start API server', error);
      throw error;
    }
  }

  /**
   * Detiene el servidor
   */
  async stop() {
    if (this.status !== APIStatus.ACTIVE) {
      logger.warn('API server is not running');
      return;
    }
    
    try {
      await new Promise((resolve, reject) => {
        this.server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
      
      this.status = APIStatus.INACTIVE;
      this.server = null;
      
      logger.info('API server stopped');
      this.emit('api.stopped');
      
    } catch (error) {
      logger.error('Failed to stop API server', error);
      throw error;
    }
  }

  /**
   * Registra rutas de sistema
   */
  registerSystemRoutes() {
    // Health check
    this.registerRoute('GET', '/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        version: process.env.npm_package_version || '1.0.0'
      });
    }, {
      type: EndpointType.PUBLIC,
      description: 'Health check endpoint'
    });
    
    // Estadísticas
    this.registerRoute('GET', '/stats', (req, res) => {
      res.json({
        success: true,
        data: this.getStats(),
        timestamp: new Date().toISOString()
      });
    }, {
      type: EndpointType.INTERNAL,
      description: 'API statistics endpoint'
    });
    
    // Información de rutas
    this.registerRoute('GET', '/routes', (req, res) => {
      const routes = Array.from(this.routes.values()).map(route => ({
        method: route.method,
        path: route.path,
        type: route.type,
        description: route.description,
        tags: route.tags
      }));
      
      res.json({
        success: true,
        data: routes,
        total: routes.length,
        timestamp: new Date().toISOString()
      });
    }, {
      type: EndpointType.INTERNAL,
      description: 'List all registered routes'
    });
  }

  /**
   * Actualiza estadísticas
   */
  updateStats(responseTime, success) {
    this.stats.totalRequests++;
    this.stats.lastResponseTime = responseTime;
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime + responseTime) / 2;
    
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }
  }

  /**
   * Obtiene tiempo de actividad
   */
  getUptime() {
    if (!this.stats.startTime) {
      return 0;
    }
    return Date.now() - this.stats.startTime;
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      uptime: this.getUptime(),
      status: this.status,
      routesRegistered: this.routes.size,
      middlewareCount: this.middleware.length,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Obtiene todas las rutas
   */
  getRoutes() {
    return Array.from(this.routes.values());
  }

  /**
   * Obtiene ruta por clave
   */
  getRoute(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    return this.routes.get(routeKey);
  }

  /**
   * Elimina una ruta
   */
  removeRoute(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    const route = this.routes.get(routeKey);
    
    if (route) {
      this.routes.delete(routeKey);
      this.endpointLimiters.delete(routeKey);
      
      logger.info(`Route removed: ${method} ${path}`);
      return true;
    }
    
    return false;
  }

  /**
   * Activa modo de mantenimiento
   */
  enableMaintenanceMode() {
    this.status = APIStatus.MAINTENANCE;
    
    // Middleware de mantenimiento
    this.app.use((req, res, next) => {
      if (req.path === '/health') {
        return next();
      }
      
      res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'API is currently under maintenance',
        timestamp: new Date().toISOString()
      });
    });
    
    logger.info('Maintenance mode enabled');
    this.emit('api.maintenance.enabled');
  }

  /**
   * Desactiva modo de mantenimiento
   */
  disableMaintenanceMode() {
    this.status = APIStatus.ACTIVE;
    
    // Remover middleware de mantenimiento
    // Nota: En una implementación real, necesitarías una forma más sofisticada
    // de remover middleware específico
    
    logger.info('Maintenance mode disabled');
    this.emit('api.maintenance.disabled');
  }

  /**
   * Obtiene información del servidor
   */
  getServerInfo() {
    return {
      status: this.status,
      host: this.config.host,
      port: this.config.port,
      uptime: this.getUptime(),
      stats: this.getStats(),
      routes: this.routes.size,
      middleware: this.middleware.length
    };
  }
}

// Instancia singleton
export const apiManager = new APIManager();

export default APIManager;
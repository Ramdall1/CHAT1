/**
 * @fileoverview Inicializador de la Aplicación
 * 
 * Coordina la inicialización y configuración de todos los componentes
 * modularizados de la aplicación, reemplazando la lógica monolítica
 * del archivo app.js original.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import timeout from 'connect-timeout';
import path from 'path';
import fs from 'fs';

import { createLogger } from '../../core/core/logger.js';
import { ServiceManager } from '../services/ServiceManager.js';
import { EndpointManager } from '../endpoints/EndpointManager.js';
import { DashboardManager } from '../dashboard/DashboardManager.js';
import { AnalyticsManager } from '../analytics/AnalyticsManager.js';

const logger = createLogger('APP_INITIALIZER');

/**
 * Inicializador de la Aplicación
 */
export class AppInitializer {
  constructor(config = {}) {
    this.config = {
      port: config.port || process.env.PORT || 3000,
      host: config.host || '0.0.0.0',
      enableCompression: config.enableCompression !== false,
      enableCors: config.enableCors !== false,
      enableRateLimit: config.enableRateLimit !== false,
      enableTimeout: config.enableTimeout !== false,
      enableSocketIO: config.enableSocketIO !== false,
      enableServices: config.enableServices !== false,
      enableEndpoints: config.enableEndpoints !== false,
      enableDashboard: config.enableDashboard !== false,
      enableAnalytics: config.enableAnalytics !== false,
      staticPath: config.staticPath || path.join(process.cwd(), 'public'),
      uploadsPath: config.uploadsPath || path.join(process.cwd(), 'uploads'),
      clientPath: config.clientPath || path.join(process.cwd(), 'client'),
      rateLimitMax: config.rateLimitMax || 100,
      rateLimitWindow: config.rateLimitWindow || 15 * 60 * 1000, // 15 minutos
      timeoutDuration: config.timeoutDuration || 30000, // 30 segundos
      corsOrigins: config.corsOrigins || ['http://localhost:3000', 'http://localhost:5173'],
      ...config
    };

    this.app = null;
    this.server = null;
    this.io = null;
    this.managers = {};
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = null;

    this.initStats = {
      initializationTime: 0,
      managersLoaded: 0,
      endpointsRegistered: 0,
      middlewaresConfigured: 0,
      lastInitialization: null
    };
  }

  /**
   * Inicializar toda la aplicación
   */
  async initialize() {
    try {
      const startTime = Date.now();
      logger.info('🚀 Iniciando inicialización de la aplicación...');

      // Crear aplicación Express
      this.createExpressApp();

      // Configurar middleware básico
      this.setupBasicMiddleware();

      // Crear servidor HTTP
      this.createHttpServer();

      // Configurar Socket.IO
      if (this.config.enableSocketIO) {
        this.setupSocketIO();
      }

      // Inicializar gestores
      await this.initializeManagers();

      // Configurar archivos estáticos
      this.setupStaticFiles();

      // Configurar rutas finales
      this.setupFinalRoutes();

      // Configurar manejo de errores
      this.setupErrorHandling();

      this.isInitialized = true;
      this.initStats.initializationTime = Date.now() - startTime;
      this.initStats.lastInitialization = new Date();

      logger.info(`✅ Aplicación inicializada correctamente en ${this.initStats.initializationTime}ms`);

    } catch (error) {
      logger.error('❌ Error inicializando la aplicación:', error);
      throw error;
    }
  }

  /**
   * Crear aplicación Express
   */
  createExpressApp() {
    try {
      this.app = express();
      
      // Configurar Express
      this.app.set('trust proxy', true); // Cambiar a true para manejar proxies correctamente
      this.app.disable('x-powered-by');

      logger.info('✅ Aplicación Express creada');

    } catch (error) {
      logger.error('❌ Error creando aplicación Express:', error);
      throw error;
    }
  }

  /**
   * Configurar middleware básico
   */
  setupBasicMiddleware() {
    try {
      let middlewareCount = 0;

      // Logging de requests
      this.app.use((req, res, next) => {
        logger.debug(`${req.method} ${req.url}`);
        next();
      });
      middlewareCount++;

      // Compresión
      if (this.config.enableCompression) {
        this.app.use(compression());
        middlewareCount++;
      }

      // CORS
      if (this.config.enableCors) {
        this.app.use(cors({
          origin: this.config.corsOrigins,
          credentials: true
        }));
        middlewareCount++;
      }

      // Parsers
      this.app.use(express.json({ limit: '10mb' }));
      this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
      middlewareCount += 2;

      // Rate limiting
      if (this.config.enableRateLimit) {
        const limiter = rateLimit({
          windowMs: this.config.rateLimitWindow,
          max: this.config.rateLimitMax,
          message: 'Too many requests from this IP'
        });
        this.app.use(limiter);
        middlewareCount++;
      }

      // Timeout
      if (this.config.enableTimeout) {
        this.app.use(timeout(this.config.timeoutDuration));
        middlewareCount++;
      }

      this.initStats.middlewaresConfigured = middlewareCount;
      logger.info(`✅ Middleware básico configurado (${middlewareCount} middlewares)`);

    } catch (error) {
      logger.error('❌ Error configurando middleware básico:', error);
      throw error;
    }
  }

  /**
   * Crear servidor HTTP
   */
  createHttpServer() {
    try {
      this.server = http.createServer(this.app);
      logger.info('✅ Servidor HTTP creado');

    } catch (error) {
      logger.error('❌ Error creando servidor HTTP:', error);
      throw error;
    }
  }

  /**
   * Configurar Socket.IO
   */
  setupSocketIO() {
    try {
      this.io = new SocketIOServer(this.server, {
        cors: {
          origin: this.config.corsOrigins,
          methods: ['GET', 'POST']
        }
      });

      // Configurar eventos básicos de Socket.IO
      this.io.on('connection', (socket) => {
        logger.debug(`Cliente conectado: ${socket.id}`);

        socket.on('disconnect', () => {
          logger.debug(`Cliente desconectado: ${socket.id}`);
        });

        // Eventos básicos
        socket.on('join-room', (room) => {
          socket.join(room);
          logger.debug(`Cliente ${socket.id} se unió a la sala: ${room}`);
        });

        socket.on('leave-room', (room) => {
          socket.leave(room);
          logger.debug(`Cliente ${socket.id} salió de la sala: ${room}`);
        });
      });

      logger.info('✅ Socket.IO configurado');

    } catch (error) {
      logger.error('❌ Error configurando Socket.IO:', error);
      throw error;
    }
  }

  /**
   * Inicializar gestores
   */
  async initializeManagers() {
    try {
      logger.info('🔧 Inicializando gestores...');

      // Inicializar ServiceManager
      if (this.config.enableServices) {
        this.managers.services = new ServiceManager(this.app, {
          io: this.io,
          ...this.config.services
        });
        await this.managers.services.initialize();
        this.initStats.managersLoaded++;
      }

      // Inicializar EndpointManager
      if (this.config.enableEndpoints) {
        this.managers.endpoints = new EndpointManager(this.app, {
          services: this.managers.services,
          ...this.config.endpoints
        });
        await this.managers.endpoints.setupAll();
        this.initStats.endpointsRegistered += this.managers.endpoints.getStats().endpointsRegistered;
        this.initStats.managersLoaded++;
      }

      // Inicializar DashboardManager
      if (this.config.enableDashboard) {
        logger.info('🎯 Inicializando DashboardManager...');
        this.managers.dashboard = new DashboardManager(this.app, {
          ...this.config.dashboard
        });
        logger.info('📊 DashboardManager creado, configurando endpoints...');
        this.managers.dashboard.setupAll();
        const dashboardStats = this.managers.dashboard.getStats();
        logger.info(`✅ DashboardManager configurado - Endpoints registrados: ${dashboardStats.endpointsRegistered}`);
        this.initStats.endpointsRegistered += dashboardStats.endpointsRegistered;
        this.initStats.managersLoaded++;
      }

      // Inicializar AnalyticsManager
      if (this.config.enableAnalytics) {
        this.managers.analytics = new AnalyticsManager(this.app, {
          ...this.config.analytics
        });
        this.managers.analytics.setupAll();
        this.initStats.endpointsRegistered += this.managers.analytics.getStats().endpointsRegistered;
        this.initStats.managersLoaded++;
      }

      // Cargar rutas de API dinámicamente
      await this.loadAPIRoutes();

      logger.info(`✅ Gestores inicializados (${this.initStats.managersLoaded} gestores)`);

    } catch (error) {
      logger.error('❌ Error inicializando gestores:', error);
      throw error;
    }
  }

  /**
   * Cargar rutas de API dinámicamente desde src/api/routes
   */
  async loadAPIRoutes() {
    try {
      logger.info('📂 Cargando rutas de API...');
      const routesPath = path.join(process.cwd(), 'src/api/routes');
      
      if (fs.existsSync(routesPath)) {
        const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));
        
        for (const file of routeFiles) {
          try {
            const routePath = path.join(routesPath, file);
            const route = await import(routePath);
            const routeName = file.replace('.js', '');
            
            if (route.default) {
              this.app.use(`/api/${routeName}`, route.default);
              logger.info(`✅ Ruta cargada: /api/${routeName}`);
              this.initStats.endpointsRegistered++;
            }
          } catch (error) {
            logger.warn(`⚠️  Error cargando ruta ${file}:`, error.message);
          }
        }
      }
      
      logger.info('✅ Rutas de API cargadas correctamente');
    } catch (error) {
      logger.warn('⚠️  Error cargando rutas de API:', error.message);
    }
  }

  /**
   * Configurar archivos estáticos
   */
  setupStaticFiles() {
    try {
      // Archivos públicos
      this.app.use(express.static(this.config.staticPath));

      // Archivos de uploads
      this.app.use('/uploads', express.static(this.config.uploadsPath));

      // Archivos del cliente - servir directamente en la raíz
      this.app.use(express.static(this.config.clientPath));
      
      // Para compatibilidad con rutas antiguas
      this.app.use('/client', express.static(this.config.clientPath));

      logger.info('✅ Archivos estáticos configurados');

    } catch (error) {
      logger.error('❌ Error configurando archivos estáticos:', error);
      throw error;
    }
  }

  /**
   * Configurar rutas finales
   */
  setupFinalRoutes() {
    try {
      // Ruta de salud
      this.app.get('/health', (req, res) => {
        res.json({
          status: 'healthy',
          uptime: this.getUptime(),
          timestamp: Date.now(),
          version: process.env.npm_package_version || '1.0.0'
        });
      });

      // Ruta de información del sistema
      this.app.get('/api/system/info', (req, res) => {
        res.json({
          success: true,
          data: this.getSystemInfo()
        });
      });

      // Rutas específicas para archivos HTML
      this.app.get('/contacts', (req, res) => {
        res.sendFile(path.join(this.config.clientPath, 'contacts.html'));
      });
      
      this.app.get('/chat-live', (req, res) => {
        res.sendFile(path.join(this.config.clientPath, 'chat-live.html'));
      });
      
      // Middleware catch-all para SPA (debe ir al final)
      this.app.use((req, res, next) => {
        // Solo para rutas GET que no son API
        if (req.method === 'GET' && !req.path.startsWith('/api/')) {
          // Intentar primero servir desde la carpeta client
          const clientPath = path.join(this.config.clientPath, req.path);
          if (fs.existsSync(clientPath)) {
            return res.sendFile(clientPath);
          }
          // Si no existe, usar el dashboard como fallback
          res.sendFile(path.join(this.config.staticPath, 'dashboard.html'));
        } else {
          next();
        }
      });

      logger.info('✅ Rutas finales configuradas');

    } catch (error) {
      logger.error('❌ Error configurando rutas finales:', error);
      throw error;
    }
  }

  /**
   * Configurar manejo de errores
   */
  setupErrorHandling() {
    try {
      // Middleware para rutas no encontradas
      this.app.use((req, res, next) => {
        res.status(404).json({
          success: false,
          error: 'Route not found',
          path: req.path
        });
      });

      // Middleware de manejo de errores
      this.app.use((err, req, res, next) => {
        logger.error('Error en la aplicación:', err);

        res.status(err.status || 500).json({
          success: false,
          error: err.message || 'Internal server error',
          ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
      });

      logger.info('✅ Manejo de errores configurado');

    } catch (error) {
      logger.error('❌ Error configurando manejo de errores:', error);
      throw error;
    }
  }

  /**
   * Iniciar el servidor
   */
  async start() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      return new Promise((resolve, reject) => {
        this.server.listen(this.config.port, this.config.host, (err) => {
          if (err) {
            logger.error('❌ Error iniciando servidor:', err);
            reject(err);
            return;
          }

          this.isRunning = true;
          this.startTime = new Date();

          logger.info(`🚀 Servidor iniciado en http://${this.config.host}:${this.config.port}`);
          logger.info(`📊 Dashboard disponible en http://localhost:${this.config.port}`);
          
          resolve({
            host: this.config.host,
            port: this.config.port,
            url: `http://${this.config.host}:${this.config.port}`,
            startTime: this.startTime
          });
        });
      });

    } catch (error) {
      logger.error('❌ Error iniciando aplicación:', error);
      throw error;
    }
  }

  /**
   * Detener el servidor
   */
  async stop() {
    try {
      if (!this.isRunning) {
        logger.warn('⚠️ El servidor no está ejecutándose');
        return;
      }

      // Detener servicios
      if (this.managers.services) {
        await this.managers.services.stopAll();
      }

      // Cerrar Socket.IO
      if (this.io) {
        this.io.close();
      }

      // Cerrar servidor HTTP
      return new Promise((resolve) => {
        this.server.close(() => {
          this.isRunning = false;
          logger.info('🛑 Servidor detenido correctamente');
          resolve();
        });
      });

    } catch (error) {
      logger.error('❌ Error deteniendo servidor:', error);
      throw error;
    }
  }

  /**
   * Reiniciar el servidor
   */
  async restart() {
    try {
      logger.info('🔄 Reiniciando servidor...');
      
      await this.stop();
      await this.start();
      
      logger.info('✅ Servidor reiniciado correctamente');

    } catch (error) {
      logger.error('❌ Error reiniciando servidor:', error);
      throw error;
    }
  }

  /**
   * Obtener tiempo de actividad
   */
  getUptime() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Obtener información del sistema
   */
  getSystemInfo() {
    return {
      status: this.isRunning ? 'running' : 'stopped',
      uptime: this.getUptime(),
      config: {
        port: this.config.port,
        host: this.config.host,
        environment: process.env.NODE_ENV || 'development'
      },
      stats: this.initStats,
      managers: Object.keys(this.managers).map(key => ({
        name: key,
        info: this.managers[key].getInfo ? this.managers[key].getInfo() : 'No info available'
      })),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  /**
   * Obtener estadísticas de la aplicación
   */
  getStats() {
    return {
      ...this.initStats,
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      uptime: this.getUptime(),
      managersStats: Object.keys(this.managers).reduce((stats, key) => {
        stats[key] = this.managers[key].getStats ? this.managers[key].getStats() : {};
        return stats;
      }, {})
    };
  }

  /**
   * Validar configuración
   */
  validateConfig() {
    try {
      // Validaciones básicas
      if (!this.config.port || this.config.port < 1 || this.config.port > 65535) {
        return false;
      }

      if (!this.config.host || typeof this.config.host !== 'string') {
        return false;
      }

      return true;

    } catch (error) {
      logger.error('❌ Error validando configuración:', error);
      return false;
    }
  }

  /**
   * Obtener instancia de la aplicación Express
   */
  getApp() {
    return this.app;
  }

  /**
   * Obtener instancia del servidor HTTP
   */
  getServer() {
    return this.server;
  }

  /**
   * Obtener instancia de Socket.IO
   */
  getIO() {
    return this.io;
  }

  /**
   * Obtener gestor específico
   */
  getManager(name) {
    return this.managers[name];
  }
}

export default AppInitializer;
/**
 * @fileoverview Servidor Modular Refactorizado del ChatBot
 * 
 * Nueva implementación completamente modular del servidor, refactorizada
 * para seguir principios de arquitectura limpia y separación de responsabilidades.
 * Utiliza gestores especializados para cada aspecto del servidor.
 * 
 * @author ChatBot Enterprise Team
 * @version 3.0.0
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Gestores especializados
import MiddlewareManager from './services/server/middleware/MiddlewareManager.js';
import RouteManager from './services/server/routes/RouteManager.js';
import SocketManager from './services/server/websocket/SocketManager.js';
import StaticFileManager from './services/server/static/StaticFileManager.js';
import ErrorHandler from './services/server/error/ErrorHandler.js';

// Services imports
import { createLogger } from './services/core/core/logger.js';

const logger = createLogger('MODULAR_SERVER');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Clase Server Modular - Implementación completamente refactorizada
 */
export class Server {
  constructor(config = {}) {
    this.config = {
      port: config.port || process.env.PORT || 3000,
      host: config.host || process.env.HOST || 'localhost',
      environment: config.environment || process.env.NODE_ENV || 'development',
      clientPath: config.clientPath || path.join(__dirname, '../client'),
      ...config
    };

    // Inicializar Express y HTTP Server
    this.app = express();
    this.httpServer = createServer(this.app);

    // Gestores especializados
    this.middlewareManager = null;
    this.routeManager = null;
    this.socketManager = null;
    this.staticFileManager = null;
    this.errorHandler = null;

    // Estado del servidor
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = null;
  }

  /**
   * Inicializar el servidor y todos sus gestores
   */
  async initialize() {
    try {
      logger.info('🚀 Inicializando servidor modular refactorizado...');
      
      // Inicializar gestores en orden específico
      await this.initializeManagers();
      
      // Configurar todos los gestores
      await this.setupManagers();

      this.isInitialized = true;
      logger.info('✅ Servidor modular inicializado exitosamente');

    } catch (error) {
      logger.error('❌ Error inicializando servidor modular:', error);
      throw error;
    }
  }

  /**
   * Inicializar todos los gestores especializados
   */
  async initializeManagers() {
    try {
      logger.info('📦 Inicializando gestores especializados...');

      // Gestor de Middleware (debe ir primero)
      this.middlewareManager = new MiddlewareManager(this.app, {
        bodyLimit: this.config.bodyLimit,
        enableAuth: this.config.enableAuth,
        enableSecurity: this.config.enableSecurity,
        enableLogging: this.config.enableLogging
      });

      // Gestor de Rutas
      this.routeManager = new RouteManager(this.app, {
        apiPrefix: this.config.apiPrefix,
        version: this.config.version,
        enableHealthCheck: this.config.enableHealthCheck,
        enableDataRoutes: this.config.enableDataRoutes,
        enableMessageRoutes: this.config.enableMessageRoutes
      });

      // Gestor de WebSocket
      this.socketManager = new SocketManager(this.httpServer, {
        allowedOrigins: this.config.allowedOrigins,
        updateInterval: this.config.updateInterval,
        enableDashboardUpdates: this.config.enableDashboardUpdates,
        enableRoomManagement: this.config.enableRoomManagement
      });

      // Gestor de Archivos Estáticos
      this.staticFileManager = new StaticFileManager(this.app, {
        clientPath: this.config.clientPath,
        enableClientServing: this.config.enableClientServing,
        enablePublicServing: this.config.enablePublicServing,
        enableUploadsServing: this.config.enableUploadsServing,
        enableSPA: this.config.enableSPA,
        cacheControl: this.config.cacheControl
      });

      // Gestor de Errores (debe ir al final)
      this.errorHandler = new ErrorHandler(this.app, {
        environment: this.config.environment,
        clientPath: this.config.clientPath,
        enableNotFoundHandler: this.config.enableNotFoundHandler,
        enableGlobalErrorHandler: this.config.enableGlobalErrorHandler,
        enableSPAFallback: this.config.enableSPAFallback,
        logErrors: this.config.logErrors,
        includeStackTrace: this.config.includeStackTrace
      });

      logger.info('✅ Gestores especializados inicializados');

    } catch (error) {
      logger.error('❌ Error inicializando gestores:', error);
      throw error;
    }
  }

  /**
   * Configurar todos los gestores en el orden correcto
   */
  async setupManagers() {
    try {
      logger.info('⚙️ Configurando gestores especializados...');

      // 1. Configurar middleware (primero)
      this.middlewareManager.setupAll();
      logger.info('✅ Middleware configurado');

      // 2. Configurar rutas
      this.routeManager.setupAll();
      logger.info('✅ Rutas configuradas');

      // 3. Configurar archivos estáticos (antes del manejo de errores)
      this.staticFileManager.setupAll();
      logger.info('✅ Archivos estáticos configurados');

      // 4. Configurar WebSocket
      this.socketManager.initialize();
      logger.info('✅ WebSocket configurado');

      // 5. Configurar manejo de errores (último)
      this.errorHandler.setupAll();
      logger.info('✅ Manejo de errores configurado');

      logger.info('🎯 Todos los gestores configurados exitosamente');

    } catch (error) {
      logger.error('❌ Error configurando gestores:', error);
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
        this.httpServer.listen(this.config.port, this.config.host, (err) => {
          if (err) {
            logger.error('❌ Error iniciando servidor:', err);
            reject(err);
            return;
          }

          this.isRunning = true;
          this.startTime = new Date();
          
          const serverInfo = {
            host: this.config.host,
            port: this.config.port,
            url: `http://${this.config.host}:${this.config.port}`,
            environment: this.config.environment,
            startTime: this.startTime
          };

          logger.info('🚀 Servidor modular ejecutándose exitosamente');
          logger.info(`📊 Dashboard: ${serverInfo.url}`);
          logger.info(`🔧 Ambiente: ${serverInfo.environment}`);
          logger.info(`⏰ Iniciado: ${this.startTime.toISOString()}`);
          
          // Log de información de gestores
          this.logManagersInfo();
          
          resolve(serverInfo);
        });
      });

    } catch (error) {
      logger.error('❌ Error iniciando servidor modular:', error);
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

      logger.info('🛑 Deteniendo servidor modular...');

      // Detener gestores en orden inverso
      if (this.socketManager) {
        this.socketManager.stop();
      }

      return new Promise((resolve) => {
        this.httpServer.close(() => {
          this.isRunning = false;
          logger.info('✅ Servidor modular detenido exitosamente');
          resolve();
        });
      });

    } catch (error) {
      logger.error('❌ Error deteniendo servidor:', error);
      throw error;
    }
  }

  /**
   * Obtener información completa del servidor
   */
  getInfo() {
    const baseInfo = {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      config: this.config,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0
    };

    // Agregar información de gestores si están disponibles
    if (this.isInitialized) {
      baseInfo.managers = {
        middleware: this.middlewareManager?.getInfo(),
        routes: this.routeManager?.getInfo(),
        socket: this.socketManager?.getInfo(),
        staticFiles: this.staticFileManager?.getInfo(),
        errorHandler: this.errorHandler?.getInfo()
      };
    }

    return baseInfo;
  }

  /**
   * Obtener estadísticas del servidor
   */
  getStats() {
    if (!this.isInitialized) {
      return { error: 'Servidor no inicializado' };
    }

    return {
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      connectedClients: this.socketManager?.getInfo()?.connectedClients || 0,
      activeRooms: this.socketManager?.getInfo()?.activeRooms || 0,
      registeredRoutes: this.routeManager?.getInfo()?.count || 0,
      activeMiddleware: this.middlewareManager?.getInfo()?.count || 0,
      servedPaths: this.staticFileManager?.getInfo()?.servedPaths?.length || 0,
      errorStats: this.errorHandler?.getErrorStats() || {},
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validar configuración del servidor
   */
  validateConfiguration() {
    const validations = [];

    // Validar gestores
    if (this.middlewareManager && !this.middlewareManager.validateConfig()) {
      validations.push('Configuración de middleware inválida');
    }

    if (this.routeManager && !this.routeManager.validateConfig()) {
      validations.push('Configuración de rutas inválida');
    }

    if (this.errorHandler && !this.errorHandler.validateConfig()) {
      validations.push('Configuración de manejo de errores inválida');
    }

    return {
      isValid: validations.length === 0,
      errors: validations
    };
  }

  /**
   * Reiniciar el servidor
   */
  async restart() {
    try {
      logger.info('🔄 Reiniciando servidor modular...');
      
      await this.stop();
      await this.start();
      
      logger.info('✅ Servidor modular reiniciado exitosamente');

    } catch (error) {
      logger.error('❌ Error reiniciando servidor:', error);
      throw error;
    }
  }

  /**
   * Registrar información de gestores
   */
  logManagersInfo() {
    try {
      const info = this.getInfo();
      
      if (info.managers) {
        logger.info('📊 Información de gestores:');
        logger.info(`   • Middleware: ${info.managers.middleware?.count || 0} activos`);
        logger.info(`   • Rutas: ${info.managers.routes?.count || 0} registradas`);
        logger.info(`   • WebSocket: ${info.managers.socket?.connectedClients || 0} clientes`);
        logger.info(`   • Archivos estáticos: ${info.managers.staticFiles?.servedPaths?.length || 0} rutas`);
      }

    } catch (error) {
      logger.error('Error registrando información de gestores:', error);
    }
  }

  /**
   * Limpiar recursos del servidor
   */
  async cleanup() {
    try {
      logger.info('🧹 Limpiando recursos del servidor...');

      // Limpiar archivos temporales
      if (this.staticFileManager) {
        const cleaned = this.staticFileManager.cleanupTempFiles();
        logger.info(`🗑️ Archivos temporales limpiados: ${cleaned}`);
      }

      // Resetear estadísticas de errores
      if (this.errorHandler) {
        this.errorHandler.resetErrorStats();
        logger.info('📊 Estadísticas de errores reseteadas');
      }

      logger.info('✅ Limpieza de recursos completada');

    } catch (error) {
      logger.error('❌ Error limpiando recursos:', error);
    }
  }
}

export default Server;
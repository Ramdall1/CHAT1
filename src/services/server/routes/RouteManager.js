/**
 * @fileoverview Gestor de Rutas del Servidor
 * 
 * Módulo especializado para la configuración y gestión de rutas
 * del servidor Express. Centraliza toda la lógica de enrutamiento.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Routes imports
import authRoutes from '../../../routes/auth/index.js';
import whatsappRoutes from '../../../routes/whatsapp/index.js';
import dashboardRoutes from '../../../routes/dashboard/index.js';
import chatLiveRoutes from '../../../api/routes/chat-live.js';
import contactRoutes from '../../../api/routes/contactRoutes.js';

import { createLogger } from '../../core/core/logger.js';

const logger = createLogger('ROUTE_MANAGER');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Gestor de Rutas
 */
export class RouteManager {
  constructor(app, config = {}) {
    this.app = app;
    this.config = {
      apiPrefix: config.apiPrefix || '/api',
      enableHealthCheck: config.enableHealthCheck !== false,
      enableDataRoutes: config.enableDataRoutes !== false,
      enableMessageRoutes: config.enableMessageRoutes !== false,
      version: config.version || '2.0.0',
      ...config
    };
    
    this.registeredRoutes = [];
    this.database = config.database;
  }

  /**
   * Configurar todas las rutas
   */
  setupAll() {
    try {
      logger.info('Configurando rutas del servidor...');

      this.setupModularRoutes();
      this.setupDataRoutes();
      this.setupMessageRoutes();
      this.setupStatusRoute();
      this.setupHealthRoute();

      logger.info(`Rutas configuradas exitosamente (${this.registeredRoutes.length} rutas registradas)`);
      
    } catch (error) {
      logger.error('Error configurando rutas:', error);
      throw error;
    }
  }

  /**
   * Configurar rutas modulares principales
   */
  setupModularRoutes() {
    try {
      // Middleware para pasar la base de datos a las rutas
      const databaseMiddleware = (req, res, next) => {
        req.database = this.database;
        next();
      };

      // Rutas de autenticación
      this.app.use(`${this.config.apiPrefix}/auth`, databaseMiddleware, authRoutes);
      this.registeredRoutes.push('/auth');

      // Rutas de WhatsApp
      this.app.use(`${this.config.apiPrefix}/whatsapp`, databaseMiddleware, whatsappRoutes);
      this.registeredRoutes.push('/whatsapp');

      // Rutas del dashboard
      this.app.use(`${this.config.apiPrefix}/dashboard`, databaseMiddleware, dashboardRoutes);
      this.registeredRoutes.push('/dashboard');

      // Rutas de chat en vivo
      this.app.use(`${this.config.apiPrefix}/chat-live`, databaseMiddleware, chatLiveRoutes);
      this.registeredRoutes.push('/chat-live');

      // Rutas de contactos
      this.app.use(`${this.config.apiPrefix}/contacts`, databaseMiddleware, contactRoutes);
      this.registeredRoutes.push('/contacts');


      logger.info('Rutas modulares configuradas');

    } catch (error) {
      logger.error('Error configurando rutas modulares:', error);
      throw error;
    }
  }

  /**
   * Configurar rutas de datos (compatibilidad)
   */
  setupDataRoutes() {
    if (!this.config.enableDataRoutes) {
      logger.info('Rutas de datos deshabilitadas');
      return;
    }

    try {
      // Endpoint para obtener mensajes
      this.app.get(`${this.config.apiPrefix}/data/messages`, (req, res) => {
        this.handleMessagesData(req, res);
      });

      // Endpoint para obtener contactos
      this.app.get(`${this.config.apiPrefix}/data/contacts`, (req, res) => {
        this.handleContactsData(req, res);
      });

      this.registeredRoutes.push('/data/messages', '/data/contacts');
      logger.info('Rutas de datos configuradas');

    } catch (error) {
      logger.error('Error configurando rutas de datos:', error);
      throw error;
    }
  }

  /**
   * Configurar rutas de mensajes
   */
  setupMessageRoutes() {
    if (!this.config.enableMessageRoutes) {
      logger.info('Rutas de mensajes deshabilitadas');
      return;
    }

    try {
      // Endpoint para actualizaciones de mensajes en tiempo real
      this.app.get(`${this.config.apiPrefix}/messages/updates`, (req, res) => {
        this.handleMessageUpdates(req, res);
      });

      this.registeredRoutes.push('/messages/updates');
      logger.info('Rutas de mensajes configuradas');

    } catch (error) {
      logger.error('Error configurando rutas de mensajes:', error);
      throw error;
    }
  }

  /**
   * Configurar ruta de status del sistema
   */
  setupStatusRoute() {
    try {
      this.app.get(`${this.config.apiPrefix}/status`, (req, res) => {
        res.json({
          success: true,
          status: 'running',
          timestamp: new Date().toISOString(),
          version: this.config.version || '2.0.0'
        });
      });

      this.registeredRoutes.push('/status');
      logger.info('Ruta de status configurada');

    } catch (error) {
      logger.error('Error configurando ruta de status:', error);
      throw error;
    }
  }

  /**
   * Configurar ruta de salud del sistema
   */
  setupHealthRoute() {
    if (!this.config.enableHealthCheck) {
      logger.info('Ruta de health check deshabilitada');
      return;
    }

    try {
      this.app.get(`${this.config.apiPrefix}/health`, (req, res) => {
        this.handleHealthCheck(req, res);
      });

      this.registeredRoutes.push('/health');
      logger.info('Ruta de health check configurada');

    } catch (error) {
      logger.error('Error configurando ruta de health check:', error);
      throw error;
    }
  }

  /**
   * Manejar datos de mensajes - ELIMINADO
   */
  handleMessagesData(req, res) {
    res.status(410).json({
      success: false,
      error: 'Este endpoint ha sido eliminado. Los datos ahora se obtienen de SQLite a través de /api/chat-live/conversations',
      timestamp: req.timestamp
    });
  }

  /**
   * Manejar datos de contactos - ELIMINADO
   */
  handleContactsData(req, res) {
    res.status(410).json({
      success: false,
      error: 'Este endpoint ha sido eliminado. Los datos ahora se obtienen de SQLite a través de /api/contacts',
      timestamp: req.timestamp
    });
  }

  /**
   * Manejar actualizaciones de mensajes
   */
  handleMessageUpdates(req, res) {
    try {
      const updates = {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          newMessages: Math.floor(Math.random() * 10),
          activeChats: Math.floor(Math.random() * 50) + 20,
          pendingResponses: Math.floor(Math.random() * 15)
        }
      };

      res.json(updates);
    } catch (error) {
      logger.error('Error obteniendo actualizaciones:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo actualizaciones',
        timestamp: req.timestamp
      });
    }
  }

  /**
   * Manejar health check
   */
  handleHealthCheck(req, res) {
    try {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: this.config.version,
        uptime: process.uptime(),
        routes: this.registeredRoutes.length
      });
    } catch (error) {
      logger.error('Error en health check:', error);
      res.status(500).json({
        success: false,
        error: 'Error en health check',
        timestamp: req.timestamp
      });
    }
  }

  /**
   * Registrar ruta personalizada
   */
  registerCustomRoute(method, path, handler, name) {
    try {
      this.app[method.toLowerCase()](`${this.config.apiPrefix}${path}`, handler);
      this.registeredRoutes.push(path);
      logger.info(`Ruta personalizada registrada: ${method.toUpperCase()} ${path} (${name})`);
    } catch (error) {
      logger.error(`Error registrando ruta ${path}:`, error);
      throw error;
    }
  }

  /**
   * Obtener información de rutas
   */
  getInfo() {
    return {
      registeredRoutes: this.registeredRoutes,
      count: this.registeredRoutes.length,
      config: this.config
    };
  }

  /**
   * Validar configuración de rutas
   */
  validateConfig() {
    const requiredRoutes = ['/health'];
    const missing = requiredRoutes.filter(route => !this.registeredRoutes.includes(route));
    
    if (missing.length > 0) {
      logger.warn(`Rutas requeridas faltantes: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }
}

export default RouteManager;
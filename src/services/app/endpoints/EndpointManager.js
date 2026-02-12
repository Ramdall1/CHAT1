/**
 * @fileoverview Gestor de Endpoints Modulares
 * 
 * Centraliza la configuración y gestión de todos los endpoints modulares
 * de la aplicación, incluyendo APIs de templates, tags, flows y servicios externos.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import { createLogger } from '../../core/core/logger.js';
import SecurityManager from '../../core/core/auth/SecurityManager.js';
import path from 'path';
import fs from 'fs';

const logger = createLogger('ENDPOINT_MANAGER');

/**
 * Gestor de Endpoints Modulares
 */
export class EndpointManager {
  constructor(app, config = {}) {
    this.app = app;
    this.config = {
      enableTemplates: config.enableTemplates !== false,
      enableTags: config.enableTags !== false,
      enableFlows: config.enableFlows !== false,
      enable360Dialog: config.enable360Dialog !== false,
      enableAI: config.enableAI !== false,
      enableLocal: config.enableLocal !== false,
      enableSystemInfo: config.enableSystemInfo !== false,
      enableHealthCheck: config.enableHealthCheck !== false,
      enableTestEndpoint: config.enableTestEndpoint !== false,
      apiPrefix: config.apiPrefix || '/api',
      requireAuth: config.requireAuth !== false,
      ...config
    };

    this.registeredEndpoints = [];
    this.endpointStats = {
      total: 0,
      byCategory: {},
      lastRegistered: null
    };
  }

  /**
   * Configurar todos los endpoints modulares
   */
  async setupAll() {
    try {
      logger.info('🔧 Configurando endpoints modulares...');

      // Configurar endpoints básicos
      this.setupBasicEndpoints();

      // Configurar endpoints de templates
      if (this.config.enableTemplates) {
        this.setupTemplateEndpoints();
      }

      // Configurar endpoints de tags
      if (this.config.enableTags) {
        this.setupTagEndpoints();
      }

      // Configurar endpoints de flows
      if (this.config.enableFlows) {
        this.setupFlowEndpoints();
      }

      // Configurar endpoints de 360Dialog
      if (this.config.enable360Dialog) {
        this.setup360DialogEndpoints();
      }

      // Configurar endpoints de IA
      if (this.config.enableAI) {
        this.setupAIEndpoints();
      }

      // Configurar endpoints locales
      if (this.config.enableLocal) {
        this.setupLocalEndpoints();
      }

      // Configurar endpoints del sistema
      if (this.config.enableSystemInfo) {
        this.setupSystemEndpoints();
      }

      // Configurar endpoints de datos
      this.setupDataEndpoints();

      this.logEndpointSummary();
      logger.info('✅ Endpoints modulares configurados correctamente');

    } catch (error) {
      logger.error('❌ Error configurando endpoints modulares:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints básicos
   */
  setupBasicEndpoints() {
    try {
      // Health check endpoint
      if (this.config.enableHealthCheck) {
        this.registerEndpoint('GET', '/health', (req, res) => {
          res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            version: this.config.version || '1.0.0',
            environment: this.config.environment || 'development'
          });
        }, 'basic');
      }

      // Test endpoint
      if (this.config.enableTestEndpoint) {
        this.registerEndpoint('GET', `${this.config.apiPrefix}/test`, (req, res) => {
          res.json({ 
            success: true, 
            message: 'Ruta de prueba funcionando', 
            timestamp: Date.now() 
          });
        }, 'basic');
      }

      logger.info('✅ Endpoints básicos configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints básicos:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de templates
   */
  setupTemplateEndpoints() {
    try {
      // Obtener templates
      this.registerEndpoint('GET', `${this.config.apiPrefix}/templates`, (req, res) => {
        res.json({ success: true, data: [] });
      }, 'templates');

      // Obtener templates locales
      this.registerEndpoint('GET', `${this.config.apiPrefix}/templates/local`, (req, res) => {
        res.json({ success: true, data: [] });
      }, 'templates');

      logger.info('✅ Endpoints de templates configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints de templates:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de tags
   */
  setupTagEndpoints() {
    try {
      // Obtener tags
      this.registerEndpoint('GET', `${this.config.apiPrefix}/tags`, (req, res) => {
        res.json({ success: true, data: [] });
      }, 'tags');

      // Obtener tags locales
      this.registerEndpoint('GET', `${this.config.apiPrefix}/tags/local`, (req, res) => {
        res.json({ success: true, data: [] });
      }, 'tags');

      logger.info('✅ Endpoints de tags configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints de tags:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de flows
   */
  setupFlowEndpoints() {
    try {
      // Obtener flows
      this.registerEndpoint('GET', `${this.config.apiPrefix}/flows`, (req, res) => {
        res.json({ success: true, data: [] });
      }, 'flows');

      logger.info('✅ Endpoints de flows configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints de flows:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de 360Dialog
   */
  setup360DialogEndpoints() {
    try {
      // Handler para estado de 360Dialog
      const statusHandler = (req, res) => {
        try {
          logger.info('Endpoint /api/360dialog/status llamado');
          const status = {
            service: '360Dialog',
            status: 'available',
            connected: false,
            lastCheck: new Date().toISOString(),
            message: 'Servicio 360Dialog disponible pero no configurado'
          };
          res.json({ success: true, data: status });
        } catch (error) {
          logger.error('Error getting 360Dialog status:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      };

      // Handler para templates de 360Dialog
      const templatesHandler = (req, res) => {
        try {
          res.json({ 
            success: true, 
            data: [],
            message: 'Plantillas 360Dialog - servicio no configurado'
          });
        } catch (error) {
          logger.error('Error getting 360Dialog templates:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      };

      // Registrar endpoints sin autenticación (rutas públicas de API)
      this.registerEndpoint('GET', `${this.config.apiPrefix}/360dialog/status`, statusHandler, '360dialog');
      this.registerEndpoint('GET', `${this.config.apiPrefix}/360dialog/templates`, templatesHandler, '360dialog');

      logger.info('✅ Endpoints de 360Dialog configurados (sin autenticación)');

    } catch (error) {
      logger.error('❌ Error configurando endpoints de 360Dialog:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de IA
   */
  setupAIEndpoints() {
    try {
      // Estado de IA
      this.registerEndpoint('GET', `${this.config.apiPrefix}/ai/status`, (req, res) => {
        try {
          const status = {
            service: 'AI',
            status: 'available',
            connected: true,
            model: 'local-model',
            lastCheck: new Date().toISOString(),
            message: 'Servicio de IA disponible'
          };
          res.json({ success: true, data: status });
        } catch (error) {
          logger.error('Error getting AI status:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      }, 'ai');

      // Estado de AI Admin
      this.registerEndpoint('GET', `${this.config.apiPrefix}/ai-admin/status`, (req, res) => {
        try {
          const status = {
            service: 'AI Admin',
            status: 'available',
            connected: true,
            features: ['chat', 'automation', 'analytics'],
            lastCheck: new Date().toISOString(),
            message: 'Servicio de administración de IA disponible'
          };
          res.json({ success: true, data: status });
        } catch (error) {
          logger.error('Error getting AI Admin status:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      }, 'ai');

      logger.info('✅ Endpoints de IA configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints de IA:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints locales (compatibilidad)
   */
  setupLocalEndpoints() {
    try {
      // Templates locales (sistema anterior)
      this.registerEndpoint('GET', `${this.config.apiPrefix}/local/templates`, (req, res) => {
        res.json({ success: true, templates: [] });
      }, 'local');

      // Tags locales (sistema anterior)
      this.registerEndpoint('GET', `${this.config.apiPrefix}/local/tags`, (req, res) => {
        res.json({ success: true, tags: [] });
      }, 'local');

      logger.info('✅ Endpoints locales configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints locales:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints del sistema
   */
  setupSystemEndpoints() {
    try {
      // Información del sistema (requiere autenticación)
      const systemInfoHandler = async (req, res) => {
        try {
          // Obtener servicios desde el app locals
          const services = req.app.locals.services || {};
          
          const stats = {};
          
          // Obtener estadísticas de servicios si están disponibles
          if (services.contact && typeof services.contact.getContactStats === 'function') {
            stats.contacts = await services.contact.getContactStats();
          }
          
          if (services.message && typeof services.message.getMessageStats === 'function') {
            stats.messages = await services.message.getMessageStats();
          }
          
          if (services.automation && typeof services.automation.getRuleStats === 'function') {
            stats.automation = await services.automation.getRuleStats();
          }
          
          if (services.ai && typeof services.ai.getAIStats === 'function') {
            stats.ai = await services.ai.getAIStats();
          }
          
          res.json({
            success: true,
            data: {
              version: this.config.version || '1.0.0',
              environment: this.config.environment || 'development',
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              stats
            }
          });
        } catch (error) {
          logger.error('Error obteniendo información del sistema', error);
          res.status(500).json({
            success: false,
            message: 'Error obteniendo información del sistema'
          });
        }
      };

      if (this.config.requireAuth) {
        this.registerEndpoint('GET', `${this.config.apiPrefix}/system/info`, 
          SecurityManager.authenticateToken, systemInfoHandler, 'system');
      } else {
        this.registerEndpoint('GET', `${this.config.apiPrefix}/system/info`, 
          systemInfoHandler, 'system');
      }

      // Endpoint de estadísticas del dashboard (compatible con frontend)
      const dashboardStatsHandler = async (req, res) => {
        try {
          const stats = {
            totalMessages: 0,
            activeContacts: 0,
            templatesCount: 0,
            systemStatus: 'active',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
          };
          
          res.json({
            success: true,
            data: stats
          });
        } catch (error) {
          logger.error('Error obteniendo estadísticas del dashboard:', error);
          res.status(500).json({
            success: false,
            error: 'Error obteniendo estadísticas del dashboard'
          });
        }
      };

      this.registerEndpoint('GET', `${this.config.apiPrefix}/dashboard/stats`, 
        dashboardStatsHandler, 'dashboard');

      logger.info('✅ Endpoints del sistema configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints del sistema:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de datos del dashboard
   */
  setupDataEndpoints() {
    try {
      // Endpoint para obtener mensajes
      // Handlers eliminados - ahora todos los datos vienen de SQLite
      const messagesHandler = (req, res) => {
        res.status(410).json({
          success: false,
          error: 'Este endpoint ha sido eliminado. Los datos ahora se obtienen de SQLite a través de /api/chat-live/conversations'
        });
      };

      const contactsHandler = (req, res) => {
        res.status(410).json({
          success: false,
          error: 'Este endpoint ha sido eliminado. Los datos ahora se obtienen de SQLite a través de /api/contacts'
        });
      };

      // Registrar endpoints
      this.registerEndpoint('GET', '/api/data/messages', messagesHandler, 'data');
      this.registerEndpoint('GET', '/api/data/contacts', contactsHandler, 'data');

      logger.info('✅ Endpoints de datos configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints de datos:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de chat en vivo
   */
  /**
   * Registrar un endpoint
   */
  registerEndpoint(method, path, ...handlers) {
    try {
      // Extraer categoría si el último argumento es un string
      let category = 'general';
      if (handlers.length > 0 && typeof handlers[handlers.length - 1] === 'string') {
        category = handlers.pop();
      }
      
      // Debug: verificar que todos los handlers sean funciones
      logger.debug(`Registrando endpoint ${method} ${path} con ${handlers.length} handlers, categoría: ${category}`);
      handlers.forEach((handler, index) => {
        if (typeof handler !== 'function') {
          logger.error(`Handler ${index} no es una función:`, typeof handler, handler);
          throw new Error(`Handler ${index} para ${method} ${path} no es una función`);
        }
      });
      
      // Registrar en Express
      this.app[method.toLowerCase()](path, ...handlers);
      
      // Registrar en estadísticas
      this.registeredEndpoints.push({
        method: method.toUpperCase(),
        path,
        category,
        timestamp: new Date()
      });

      this.endpointStats.total++;
      this.endpointStats.byCategory[category] = (this.endpointStats.byCategory[category] || 0) + 1;
      this.endpointStats.lastRegistered = new Date();

      logger.debug(`📍 Endpoint registrado: ${method.toUpperCase()} ${path} [${category}]`);

    } catch (error) {
      logger.error(`❌ Error registrando endpoint ${method} ${path}:`, error);
      throw error;
    }
  }

  /**
   * Obtener información de endpoints
   */
  getInfo() {
    return {
      config: this.config,
      stats: this.endpointStats,
      endpoints: this.registeredEndpoints,
      categories: Object.keys(this.endpointStats.byCategory)
    };
  }

  /**
   * Obtener estadísticas de endpoints
   */
  getStats() {
    return {
      ...this.endpointStats,
      endpointsByMethod: this.getEndpointsByMethod(),
      endpointsByCategory: { ...this.endpointStats.byCategory }
    };
  }

  /**
   * Obtener endpoints agrupados por método HTTP
   */
  getEndpointsByMethod() {
    const byMethod = {};
    
    this.registeredEndpoints.forEach(endpoint => {
      if (!byMethod[endpoint.method]) {
        byMethod[endpoint.method] = 0;
      }
      byMethod[endpoint.method]++;
    });

    return byMethod;
  }

  /**
   * Validar configuración
   */
  validateConfig() {
    try {
      // Validaciones básicas
      if (!this.config.apiPrefix || typeof this.config.apiPrefix !== 'string') {
        return false;
      }

      if (!this.config.apiPrefix.startsWith('/')) {
        return false;
      }

      return true;

    } catch (error) {
      logger.error('❌ Error validando configuración:', error);
      return false;
    }
  }

  /**
   * Registrar resumen de endpoints
   */
  logEndpointSummary() {
    try {
      const stats = this.getStats();
      
      logger.info('📊 Resumen de endpoints:');
      logger.info(`   • Total de endpoints: ${stats.total}`);
      
      Object.entries(stats.endpointsByCategory).forEach(([category, count]) => {
        logger.info(`   • ${category}: ${count} endpoints`);
      });

      Object.entries(stats.endpointsByMethod).forEach(([method, count]) => {
        logger.info(`   • ${method}: ${count} endpoints`);
      });

    } catch (error) {
      logger.error('❌ Error registrando resumen de endpoints:', error);
    }
  }
}

export default EndpointManager;
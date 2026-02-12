/**
 * @fileoverview Gestor del Dashboard
 * 
 * Centraliza la gestión de endpoints, métricas y funcionalidades específicas
 * del dashboard de la aplicación, incluyendo métricas en tiempo real,
 * actividad del sistema y estado de servicios.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import { createLogger } from '../../core/core/logger.js';
import path from 'path';

const logger = createLogger('DASHBOARD_MANAGER');

/**
 * Gestor del Dashboard
 */
export class DashboardManager {
  constructor(app, config = {}) {
    this.app = app;
    this.config = {
      enableMetrics: config.enableMetrics !== false,
      enableActivity: config.enableActivity !== false,
      enableStatus: config.enableStatus !== false,
      enableRoutes: config.enableRoutes !== false,
      apiPrefix: config.apiPrefix || '/api',
      dashboardPath: config.dashboardPath || path.join(process.cwd(), 'public/dashboard.html'),
      updateInterval: config.updateInterval || 30000, // 30 segundos
      maxActivityItems: config.maxActivityItems || 10,
      enableSimulatedData: config.enableSimulatedData !== false,
      ...config
    };

    this.metrics = {
      activeChats: 0,
      messagesSent: 0,
      aiResponses: 0,
      totalUsers: 0,
      newUsers: 0
    };

    this.activityLog = [];
    this.dashboardStats = {
      endpointsRegistered: 0,
      lastUpdate: null,
      requestCount: 0
    };
  }

  /**
   * Configurar todos los endpoints del dashboard
   */
  setupAll() {
    try {
      logger.info('🎯 Configurando endpoints del dashboard...');

      // Configurar endpoints de métricas
      if (this.config.enableMetrics) {
        this.setupMetricsEndpoints();
      }

      // Configurar endpoints de actividad
      if (this.config.enableActivity) {
        this.setupActivityEndpoints();
      }

      // Configurar endpoints de estado
      if (this.config.enableStatus) {
        this.setupStatusEndpoints();
      }

      // Configurar rutas del dashboard
      if (this.config.enableRoutes) {
        this.setupDashboardRoutes();
      }

      this.dashboardStats.lastUpdate = new Date();
      logger.info('✅ Endpoints del dashboard configurados correctamente');

    } catch (error) {
      logger.error('❌ Error configurando endpoints del dashboard:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de métricas
   */
  setupMetricsEndpoints() {
    try {
      // Métricas del dashboard
      this.app.get(`${this.config.apiPrefix}/dashboard/metrics`, (req, res) => {
        try {
          this.dashboardStats.requestCount++;
          
          const metrics = this.generateMetrics();
          
          res.json({
            success: true,
            data: metrics,
            timestamp: Date.now()
          });

          logger.debug('📊 Métricas del dashboard enviadas');

        } catch (error) {
          logger.error('Error getting dashboard metrics:', error);
          res.status(500).json({
            success: false,
            error: 'Error retrieving metrics'
          });
        }
      });

      this.dashboardStats.endpointsRegistered++;
      logger.info('✅ Endpoints de métricas configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints de métricas:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de actividad
   */
  setupActivityEndpoints() {
    try {
      // Actividad del dashboard
      this.app.get(`${this.config.apiPrefix}/dashboard/activity`, (req, res) => {
        try {
          this.dashboardStats.requestCount++;
          
          const activities = this.generateActivity();
          
          res.json({
            success: true,
            data: activities
          });

          logger.debug('📋 Actividad del dashboard enviada');

        } catch (error) {
          logger.error('Error getting dashboard activity:', error);
          res.status(500).json({
            success: false,
            error: 'Error retrieving activity'
          });
        }
      });

      this.dashboardStats.endpointsRegistered++;
      logger.info('✅ Endpoints de actividad configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints de actividad:', error);
      throw error;
    }
  }

  /**
   * Configurar endpoints de estado
   */
  setupStatusEndpoints() {
    try {
      // Estado del sistema
      this.app.get(`${this.config.apiPrefix}/dashboard/status`, (req, res) => {
        try {
          this.dashboardStats.requestCount++;
          
          const status = this.generateSystemStatus();
          
          res.json({
            success: true,
            data: status
          });

          logger.debug('🔍 Estado del sistema enviado');

        } catch (error) {
          logger.error('Error getting dashboard status:', error);
          res.status(500).json({
            success: false,
            error: 'Error retrieving status'
          });
        }
      });

      this.dashboardStats.endpointsRegistered++;
      logger.info('✅ Endpoints de estado configurados');

    } catch (error) {
      logger.error('❌ Error configurando endpoints de estado:', error);
      throw error;
    }
  }

  /**
   * Configurar rutas del dashboard
   */
  setupDashboardRoutes() {
    try {
      // Ruta principal del dashboard
      this.app.get('/', (req, res) => {
        res.sendFile(this.config.dashboardPath);
      });

      // Ruta específica del dashboard
      this.app.get('/dashboard', (req, res) => {
        res.sendFile(this.config.dashboardPath);
      });

      // Rutas de secciones específicas
      this.app.get('/contacts', (req, res) => {
        res.sendFile(this.config.dashboardPath);
      });

      this.app.get('/messages', (req, res) => {
        res.sendFile(this.config.dashboardPath);
      });

      this.app.get('/automation', (req, res) => {
        res.sendFile(this.config.dashboardPath);
      });

      this.dashboardStats.endpointsRegistered += 5;
      logger.info('✅ Rutas del dashboard configuradas');

    } catch (error) {
      logger.error('❌ Error configurando rutas del dashboard:', error);
      throw error;
    }
  }

  /**
   * Generar métricas del dashboard
   */
  generateMetrics() {
    if (this.config.enableSimulatedData) {
      // Generar métricas simuladas más realistas
      return {
        activeChats: Math.floor(Math.random() * 50) + 10,
        messagesSent: Math.floor(Math.random() * 1000) + 500,
        aiResponses: Math.floor(Math.random() * 800) + 400,
        conversionRate: (Math.random() * 15 + 5).toFixed(1) + '%',
        responseTime: Math.floor(Math.random() * 500) + 100,
        userSatisfaction: (Math.random() * 2 + 8).toFixed(1),
        totalUsers: Math.floor(Math.random() * 200) + 100,
        newUsers: Math.floor(Math.random() * 20) + 5,
        lastUpdate: Date.now()
      };
    }

    // Retornar métricas reales si están disponibles
    return {
      ...this.metrics,
      lastUpdate: Date.now()
    };
  }

  /**
   * Generar actividad del dashboard
   */
  generateActivity() {
    if (this.config.enableSimulatedData) {
      // Generar actividad simulada
      const activities = [];
      const activityTypes = ['message', 'user_joined', 'ai_response', 'automation_triggered', 'contact_added'];
      const users = ['Usuario1', 'Usuario2', 'Usuario3', 'Sistema', 'Bot AI'];
      
      for (let i = 0; i < this.config.maxActivityItems; i++) {
        const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        const user = users[Math.floor(Math.random() * users.length)];
        const timestamp = Date.now() - (Math.random() * 3600000); // Últimas 1 hora
        
        activities.push({
          id: `activity_${i}`,
          type,
          user,
          message: this.generateActivityMessage(type, user),
          timestamp,
          status: Math.random() > 0.1 ? 'success' : 'warning'
        });
      }

      return activities.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Retornar actividad real si está disponible
    return this.activityLog.slice(0, this.config.maxActivityItems);
  }

  /**
   * Generar estado del sistema
   */
  generateSystemStatus() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      status: 'online',
      uptime: Math.floor(uptime),
      uptimeFormatted: this.formatUptime(uptime),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      cpu: Math.floor(Math.random() * 30) + 10, // CPU simulado
      services: this.getServicesStatus(),
      lastCheck: Date.now(),
      requestCount: this.dashboardStats.requestCount
    };
  }

  /**
   * Obtener estado de servicios
   */
  getServicesStatus() {
    if (this.config.enableSimulatedData) {
      return {
        database: Math.random() > 0.05 ? 'online' : 'warning',
        ai: Math.random() > 0.03 ? 'online' : 'offline',
        messaging: 'online',
        automation: Math.random() > 0.02 ? 'online' : 'warning'
      };
    }

    // Obtener estado real de servicios si está disponible
    return {
      database: 'online',
      ai: 'online',
      messaging: 'online',
      automation: 'online'
    };
  }

  /**
   * Generar mensaje de actividad basado en el tipo
   */
  generateActivityMessage(type, user) {
    const messages = {
      message: `${user} envió un mensaje`,
      user_joined: `${user} se unió al chat`,
      ai_response: `${user} generó una respuesta automática`,
      automation_triggered: `Se activó una automatización para ${user}`,
      contact_added: `Se agregó un nuevo contacto: ${user}`
    };
    return messages[type] || `${user} realizó una acción`;
  }

  /**
   * Formatear tiempo de actividad
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Actualizar métricas
   */
  updateMetrics(newMetrics) {
    try {
      this.metrics = { ...this.metrics, ...newMetrics };
      this.dashboardStats.lastUpdate = new Date();
      
      logger.debug('📊 Métricas actualizadas');

    } catch (error) {
      logger.error('❌ Error actualizando métricas:', error);
    }
  }

  /**
   * Agregar actividad
   */
  addActivity(activity) {
    try {
      const activityItem = {
        id: `activity_${Date.now()}`,
        timestamp: Date.now(),
        ...activity
      };

      this.activityLog.unshift(activityItem);
      
      // Mantener solo los últimos elementos
      if (this.activityLog.length > this.config.maxActivityItems * 2) {
        this.activityLog = this.activityLog.slice(0, this.config.maxActivityItems);
      }

      logger.debug('📋 Actividad agregada:', activityItem.type);

    } catch (error) {
      logger.error('❌ Error agregando actividad:', error);
    }
  }

  /**
   * Obtener información del gestor
   */
  getInfo() {
    return {
      config: this.config,
      stats: this.dashboardStats,
      metricsCount: Object.keys(this.metrics).length,
      activityCount: this.activityLog.length,
      endpointsRegistered: this.dashboardStats.endpointsRegistered
    };
  }

  /**
   * Obtener estadísticas del dashboard
   */
  getStats() {
    return {
      ...this.dashboardStats,
      currentMetrics: this.metrics,
      recentActivity: this.activityLog.slice(0, 5),
      systemStatus: this.generateSystemStatus()
    };
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

      if (this.config.maxActivityItems < 1) {
        return false;
      }

      if (this.config.updateInterval < 1000) {
        return false;
      }

      return true;

    } catch (error) {
      logger.error('❌ Error validando configuración:', error);
      return false;
    }
  }

  /**
   * Limpiar datos antiguos
   */
  cleanup() {
    try {
      // Limpiar actividad antigua (más de 24 horas)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.activityLog = this.activityLog.filter(activity => activity.timestamp > oneDayAgo);

      logger.info('🧹 Limpieza de datos del dashboard completada');

    } catch (error) {
      logger.error('❌ Error limpiando datos del dashboard:', error);
    }
  }
}

export default DashboardManager;
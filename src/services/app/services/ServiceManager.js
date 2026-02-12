/**
 * @fileoverview Gestor de Servicios de la Aplicación
 * 
 * Centraliza la inicialización, configuración y gestión de todos los servicios
 * de negocio de la aplicación, incluyendo contactos, mensajes, automatización e IA.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import { createLogger } from '../../core/core/logger.js';
import { getContactService } from '../../../components/business/contacts/services/ContactService.js';
import { getMessageService } from '../../../components/business/messaging/services/MessageService.js';
import { getAutomationService } from '../../../components/business/automation/services/AutomationService.js';
import { getAIService } from '../../../components/business/ai/services/AIService.js';

const logger = createLogger('SERVICE_MANAGER');

/**
 * Gestor de Servicios - Maneja la inicialización y gestión de servicios
 */
export class ServiceManager {
  constructor(config = {}) {
    this.config = {
      automationInterval: config.automationInterval || 5 * 60 * 1000, // 5 minutos
      scheduledMessagesInterval: config.scheduledMessagesInterval || 60 * 1000, // 1 minuto
      enableAutomation: config.enableAutomation !== false,
      enableScheduledMessages: config.enableScheduledMessages !== false,
      enableServiceMonitoring: config.enableServiceMonitoring !== false,
      ...config
    };

    this.services = {};
    this.intervals = {};
    this.isInitialized = false;
    this.serviceStats = {
      initialized: 0,
      failed: 0,
      lastCheck: null
    };
  }

  /**
   * Inicializar todos los servicios
   */
  async initialize() {
    try {
      logger.info('🔧 Inicializando servicios de la aplicación...');

      await this.initializeBusinessServices();
      await this.setupServiceIntervals();
      
      if (this.config.enableServiceMonitoring) {
        this.setupServiceMonitoring();
      }

      this.isInitialized = true;
      this.serviceStats.lastCheck = new Date();

      logger.info('✅ Servicios inicializados correctamente');
      this.logServiceStatus();

    } catch (error) {
      logger.error('❌ Error inicializando servicios:', error);
      this.serviceStats.failed++;
      throw error;
    }
  }

  /**
   * Inicializar servicios de negocio
   */
  async initializeBusinessServices() {
    try {
      logger.info('📦 Inicializando servicios de negocio...');

      // Inicializar servicios principales
      this.services.contact = getContactService();
      this.services.message = getMessageService();
      this.services.automation = getAutomationService();
      this.services.ai = getAIService();

      // Validar servicios
      await this.validateServices();

      this.serviceStats.initialized = Object.keys(this.services).length;
      logger.info(`✅ ${this.serviceStats.initialized} servicios de negocio inicializados`);

    } catch (error) {
      logger.error('❌ Error inicializando servicios de negocio:', error);
      throw error;
    }
  }

  /**
   * Configurar intervalos de servicios
   */
  async setupServiceIntervals() {
    try {
      logger.info('⏰ Configurando intervalos de servicios...');

      // Intervalo para procesamiento automático de reglas
      if (this.config.enableAutomation && this.services.automation) {
        this.intervals.automation = setInterval(async () => {
          try {
            await this.services.automation.processAutomaticRules();
            logger.debug('✅ Reglas automáticas procesadas');
          } catch (error) {
            logger.error('❌ Error en procesamiento automático de reglas:', error);
          }
        }, this.config.automationInterval);

        logger.info(`⚙️ Intervalo de automatización: ${this.config.automationInterval / 1000}s`);
      }

      // Intervalo para procesamiento de mensajes programados
      if (this.config.enableScheduledMessages && this.services.message) {
        this.intervals.scheduledMessages = setInterval(async () => {
          try {
            await this.services.message.processScheduledMessages();
            logger.debug('✅ Mensajes programados procesados');
          } catch (error) {
            logger.error('❌ Error procesando mensajes programados:', error);
          }
        }, this.config.scheduledMessagesInterval);

        logger.info(`📅 Intervalo de mensajes programados: ${this.config.scheduledMessagesInterval / 1000}s`);
      }

      logger.info('✅ Intervalos de servicios configurados');

    } catch (error) {
      logger.error('❌ Error configurando intervalos:', error);
      throw error;
    }
  }

  /**
   * Configurar monitoreo de servicios
   */
  setupServiceMonitoring() {
    try {
      logger.info('📊 Configurando monitoreo de servicios...');

      // Monitoreo cada 30 segundos
      this.intervals.monitoring = setInterval(async () => {
        try {
          await this.checkServiceHealth();
        } catch (error) {
          logger.error('❌ Error en monitoreo de servicios:', error);
        }
      }, 30000);

      logger.info('✅ Monitoreo de servicios configurado');

    } catch (error) {
      logger.error('❌ Error configurando monitoreo:', error);
    }
  }

  /**
   * Validar que todos los servicios estén disponibles
   */
  async validateServices() {
    const requiredServices = ['contact', 'message', 'automation', 'ai'];
    const missingServices = [];

    for (const serviceName of requiredServices) {
      if (!this.services[serviceName]) {
        missingServices.push(serviceName);
      }
    }

    if (missingServices.length > 0) {
      throw new Error(`Servicios faltantes: ${missingServices.join(', ')}`);
    }

    logger.info('✅ Validación de servicios completada');
  }

  /**
   * Verificar salud de los servicios
   */
  async checkServiceHealth() {
    try {
      const healthChecks = {};

      for (const [name, service] of Object.entries(this.services)) {
        try {
          // Verificar si el servicio tiene método de health check
          if (typeof service.healthCheck === 'function') {
            healthChecks[name] = await service.healthCheck();
          } else {
            // Verificación básica
            healthChecks[name] = {
              status: 'healthy',
              timestamp: new Date().toISOString()
            };
          }
        } catch (error) {
          healthChecks[name] = {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }

      this.serviceStats.lastCheck = new Date();
      return healthChecks;

    } catch (error) {
      logger.error('❌ Error verificando salud de servicios:', error);
      return {};
    }
  }

  /**
   * Obtener estadísticas de servicios
   */
  async getServiceStats() {
    try {
      const stats = {};

      // Obtener estadísticas de cada servicio
      if (this.services.contact && typeof this.services.contact.getContactStats === 'function') {
        stats.contacts = await this.services.contact.getContactStats();
      }

      if (this.services.message && typeof this.services.message.getMessageStats === 'function') {
        stats.messages = await this.services.message.getMessageStats();
      }

      if (this.services.automation && typeof this.services.automation.getRuleStats === 'function') {
        stats.automation = await this.services.automation.getRuleStats();
      }

      if (this.services.ai && typeof this.services.ai.getAIStats === 'function') {
        stats.ai = await this.services.ai.getAIStats();
      }

      return stats;

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de servicios:', error);
      return {};
    }
  }

  /**
   * Obtener información de un servicio específico
   */
  getService(serviceName) {
    if (!this.isInitialized) {
      throw new Error('ServiceManager no está inicializado');
    }

    if (!this.services[serviceName]) {
      throw new Error(`Servicio '${serviceName}' no encontrado`);
    }

    return this.services[serviceName];
  }

  /**
   * Obtener todos los servicios
   */
  getAllServices() {
    if (!this.isInitialized) {
      throw new Error('ServiceManager no está inicializado');
    }

    return { ...this.services };
  }

  /**
   * Configurar Socket.IO en servicios que lo requieran
   */
  setSocketIO(io) {
    try {
      this.services.io = io;

      // Configurar Socket.IO en servicios que lo necesiten
      for (const [name, service] of Object.entries(this.services)) {
        if (typeof service.setSocketIO === 'function') {
          service.setSocketIO(io);
          logger.info(`🔌 Socket.IO configurado en servicio: ${name}`);
        }
      }

      logger.info('✅ Socket.IO configurado en servicios');

    } catch (error) {
      logger.error('❌ Error configurando Socket.IO en servicios:', error);
    }
  }

  /**
   * Reiniciar un servicio específico
   */
  async restartService(serviceName) {
    try {
      logger.info(`🔄 Reiniciando servicio: ${serviceName}`);

      if (!this.services[serviceName]) {
        throw new Error(`Servicio '${serviceName}' no encontrado`);
      }

      // Detener servicio si tiene método stop
      if (typeof this.services[serviceName].stop === 'function') {
        await this.services[serviceName].stop();
      }

      // Reinicializar servicio
      switch (serviceName) {
        case 'contact':
          this.services.contact = getContactService();
          break;
        case 'message':
          this.services.message = getMessageService();
          break;
        case 'automation':
          this.services.automation = getAutomationService();
          break;
        case 'ai':
          this.services.ai = getAIService();
          break;
        default:
          throw new Error(`No se puede reiniciar el servicio: ${serviceName}`);
      }

      logger.info(`✅ Servicio reiniciado: ${serviceName}`);

    } catch (error) {
      logger.error(`❌ Error reiniciando servicio ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Detener todos los servicios
   */
  async stop() {
    try {
      logger.info('🛑 Deteniendo servicios...');

      // Limpiar intervalos
      for (const [name, interval] of Object.entries(this.intervals)) {
        clearInterval(interval);
        logger.info(`⏹️ Intervalo detenido: ${name}`);
      }

      // Detener servicios que tengan método stop
      for (const [name, service] of Object.entries(this.services)) {
        if (typeof service.stop === 'function') {
          await service.stop();
          logger.info(`⏹️ Servicio detenido: ${name}`);
        }
      }

      this.isInitialized = false;
      logger.info('✅ Servicios detenidos correctamente');

    } catch (error) {
      logger.error('❌ Error deteniendo servicios:', error);
      throw error;
    }
  }

  /**
   * Obtener información del gestor
   */
  getInfo() {
    return {
      isInitialized: this.isInitialized,
      config: this.config,
      serviceCount: Object.keys(this.services).length,
      intervalCount: Object.keys(this.intervals).length,
      stats: this.serviceStats,
      services: Object.keys(this.services),
      intervals: Object.keys(this.intervals)
    };
  }

  /**
   * Validar configuración
   */
  validateConfig() {
    try {
      // Validaciones básicas
      if (this.config.automationInterval < 1000) {
        return false;
      }

      if (this.config.scheduledMessagesInterval < 1000) {
        return false;
      }

      return true;

    } catch (error) {
      logger.error('❌ Error validando configuración:', error);
      return false;
    }
  }

  /**
   * Registrar estado de servicios
   */
  logServiceStatus() {
    try {
      const info = this.getInfo();
      
      logger.info('📊 Estado de servicios:');
      logger.info(`   • Servicios inicializados: ${info.serviceCount}`);
      logger.info(`   • Intervalos activos: ${info.intervalCount}`);
      logger.info(`   • Servicios: ${info.services.join(', ')}`);
      
      if (info.intervals.length > 0) {
        logger.info(`   • Intervalos: ${info.intervals.join(', ')}`);
      }

    } catch (error) {
      logger.error('❌ Error registrando estado de servicios:', error);
    }
  }
}

export default ServiceManager;
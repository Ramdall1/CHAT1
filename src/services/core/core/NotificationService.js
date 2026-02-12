import BaseService from './BaseService.js';
import { createLogger } from './logger.js';
import { getDatabase } from './database.js';
import EventEmitter from 'events';

/**
 * Servicio de notificaciones refactorizado
 * Extiende BaseService y EventEmitter para proporcionar funcionalidad de notificaciones
 */
class NotificationService extends BaseService {
  constructor(options = {}) {
    super('NotificationService', options);
        
    // Configurar EventEmitter
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(50);
        
    this.serviceDependencies = options;
    this.subscribers = new Map(); // userId -> { socketId, preferences }
    this.alertRules = new Map(); // ruleId -> { condition, action, enabled }
    this.notificationQueue = [];
    this.isProcessing = false;
    this.queueProcessor = null;
        
    // Métricas específicas del servicio
    this.serviceMetrics = {
      sent: 0,
      failed: 0,
      queued: 0,
      alertsTriggered: 0,
      subscribers: 0
    };
  }

  /**
     * Inicializar el servicio
     */
  async initialize() {
    await super.initialize();
        
    try {
      // Verificar dependencias
      await this.checkDependencies(['database']);
            
      // Inicializar reglas por defecto
      this.initializeDefaultRules();
            
      // Cargar suscriptores persistentes si existen
      await this.loadPersistedSubscribers();
            
      this.logger.info('NotificationService inicializado correctamente');
            
    } catch (error) {
      this.logger.error('Error inicializando NotificationService:', error);
      throw error;
    }
  }

  /**
     * Iniciar el servicio
     */
  async start() {
    await super.start();
        
    try {
      // Iniciar procesador de cola
      this.startQueueProcessor();
            
      this.logger.info('NotificationService iniciado correctamente');
            
    } catch (error) {
      this.logger.error('Error iniciando NotificationService:', error);
      throw error;
    }
  }

  /**
     * Detener el servicio
     */
  async stop() {
    // Detener procesador de cola
    this.stopQueueProcessor();
        
    // Procesar cola restante
    await this.processRemainingQueue();
        
    // Persistir suscriptores
    await this.persistSubscribers();
        
    await super.stop();
    this.logger.info('NotificationService detenido');
  }

  /**
     * Inicializar reglas de alerta por defecto
     */
  initializeDefaultRules() {
    // Regla para errores críticos
    this.alertRules.set('critical_error', {
      name: 'Error Crítico',
      condition: (data) => data.level === 'error' && data.critical === true,
      action: {
        type: 'broadcast',
        priority: 'high',
        template: 'Error crítico detectado: {{message}}'
      },
      enabled: true,
      cooldown: 60000 // 1 minuto
    });

    // Regla para alta carga de memoria
    this.alertRules.set('high_memory', {
      name: 'Memoria Alta',
      condition: (data) => data.type === 'memory' && data.usage > 80,
      action: {
        type: 'admin_only',
        priority: 'medium',
        template: 'Uso de memoria alto: {{usage}}%'
      },
      enabled: true,
      cooldown: 300000 // 5 minutos
    });

    // Regla para servicios caídos
    this.alertRules.set('service_down', {
      name: 'Servicio Caído',
      condition: (data) => data.type === 'service_status' && data.status === 'down',
      action: {
        type: 'broadcast',
        priority: 'high',
        template: 'Servicio {{service}} está caído'
      },
      enabled: true,
      cooldown: 120000 // 2 minutos
    });

    // Regla para mensajes fallidos
    this.alertRules.set('message_failed', {
      name: 'Mensaje Fallido',
      condition: (data) => data.type === 'message' && data.status === 'failed',
      action: {
        type: 'admin_only',
        priority: 'medium',
        template: 'Mensaje falló: {{error}}'
      },
      enabled: true,
      cooldown: 30000 // 30 segundos
    });

    this.logger.info(`Reglas de alerta inicializadas: ${this.alertRules.size} reglas`);
  }

  /**
     * Suscribir usuario a notificaciones
     */
  subscribe(userId, socketId, preferences = {}) {
    const defaultPreferences = {
      messages: true,
      alerts: true,
      systemEvents: true,
      aiEvents: true,
      errorAlerts: true,
      performanceAlerts: true,
      sound: true,
      desktop: true,
      email: false
    };

    const subscriber = {
      socketId,
      preferences: { ...defaultPreferences, ...preferences },
      subscribedAt: new Date(),
      lastSeen: new Date()
    };

    this.subscribers.set(userId, subscriber);
    this.serviceMetrics.subscribers = this.subscribers.size;

    this.logger.info(`Usuario ${userId} suscrito a notificaciones`);
    this.eventEmitter.emit('userSubscribed', { userId, socketId });

    // Persistir cambio
    this.persistSubscribers().catch(error => {
      this.logger.error('Error persistiendo suscriptores:', error);
    });
  }

  /**
     * Desuscribir usuario
     */
  unsubscribe(userId) {
    if (this.subscribers.has(userId)) {
      this.subscribers.delete(userId);
      this.serviceMetrics.subscribers = this.subscribers.size;
            
      this.logger.info(`Usuario ${userId} desuscrito de notificaciones`);
      this.eventEmitter.emit('userUnsubscribed', { userId });

      // Persistir cambio
      this.persistSubscribers().catch(error => {
        this.logger.error('Error persistiendo suscriptores:', error);
      });
    }
  }

  /**
     * Actualizar preferencias de usuario
     */
  updatePreferences(userId, preferences) {
    const subscriber = this.subscribers.get(userId);
    if (subscriber) {
      subscriber.preferences = { ...subscriber.preferences, ...preferences };
      subscriber.lastSeen = new Date();
            
      this.logger.info(`Preferencias actualizadas para usuario ${userId}`);
            
      // Persistir cambio
      this.persistSubscribers().catch(error => {
        this.logger.error('Error persistiendo suscriptores:', error);
      });
    }
  }

  /**
     * Enviar notificación
     */
  async sendNotification(notification) {
    const startTime = Date.now();
        
    try {
      // Validar notificación
      if (!this.validateNotification(notification)) {
        throw new Error('Notificación inválida');
      }

      // Generar ID si no existe
      if (!notification.id) {
        notification.id = this.generateNotificationId();
      }

      // Añadir timestamp
      notification.timestamp = new Date().toISOString();

      // Añadir a cola
      this.notificationQueue.push(notification);
      this.serviceMetrics.queued++;

      this.logger.debug(`Notificación añadida a cola: ${notification.id}`);
      this.recordOperation(Date.now() - startTime);

      return notification.id;

    } catch (error) {
      this.recordError(error);
      this.logger.error('Error enviando notificación:', error);
      throw error;
    }
  }

  /**
     * Enviar notificación a usuario específico
     */
  async sendToUser(userId, notification) {
    const subscriber = this.subscribers.get(userId);
    if (!subscriber) {
      throw new Error(`Usuario ${userId} no está suscrito`);
    }

    notification.targetType = 'user';
    notification.targetId = userId;

    return await this.sendNotification(notification);
  }

  /**
     * Broadcast a todos los usuarios
     */
  async broadcast(notification) {
    notification.targetType = 'broadcast';
    return await this.sendNotification(notification);
  }

  /**
     * Enviar notificación de mensaje
     */
  async sendMessageNotification(messageData) {
    const notification = {
      type: 'message',
      title: 'Nuevo Mensaje',
      message: `Mensaje de ${messageData.from || 'Usuario'}`,
      data: messageData,
      priority: 'normal'
    };

    return await this.sendNotification(notification);
  }

  /**
     * Enviar notificación de IA
     */
  async sendAINotification(aiData) {
    const notification = {
      type: 'ai',
      title: 'Evento de IA',
      message: aiData.message || 'Evento de IA procesado',
      data: aiData,
      priority: 'low'
    };

    return await this.sendNotification(notification);
  }

  /**
     * Enviar notificación del sistema
     */
  async sendSystemNotification(systemData) {
    const notification = {
      type: 'system',
      title: 'Notificación del Sistema',
      message: systemData.message || 'Evento del sistema',
      data: systemData,
      priority: systemData.priority || 'medium'
    };

    return await this.sendNotification(notification);
  }

  /**
     * Enviar notificación de error
     */
  async sendErrorNotification(errorData) {
    const notification = {
      type: 'error',
      title: 'Error del Sistema',
      message: errorData.message || 'Error detectado',
      data: errorData,
      priority: 'high'
    };

    return await this.sendNotification(notification);
  }

  /**
     * Verificar y disparar alertas
     */
  async checkAlerts(data) {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        // Verificar cooldown
        if (rule.lastTriggered && 
                    Date.now() - rule.lastTriggered < rule.cooldown) {
          continue;
        }

        // Evaluar condición
        if (rule.condition(data)) {
          await this.triggerAlert(ruleId, rule, data);
        }

      } catch (error) {
        this.logger.error(`Error evaluando regla ${ruleId}:`, error);
      }
    }
  }

  /**
     * Disparar alerta
     */
  async triggerAlert(ruleId, rule, data) {
    try {
      const alertNotification = {
        type: 'alert',
        title: `Alerta: ${rule.name}`,
        message: this.formatAlertMessage(rule.action.template, data),
        data: { ruleId, originalData: data },
        priority: rule.action.priority || 'medium'
      };

      // Determinar destinatarios según el tipo de acción
      switch (rule.action.type) {
      case 'broadcast':
        await this.broadcast(alertNotification);
        break;
      case 'admin_only':
        // Enviar solo a administradores
        for (const [userId, subscriber] of this.subscribers) {
          if (subscriber.preferences.adminAlerts !== false) {
            await this.sendToUser(userId, alertNotification);
          }
        }
        break;
      default:
        await this.broadcast(alertNotification);
      }

      // Actualizar timestamp de última activación
      rule.lastTriggered = Date.now();
      this.serviceMetrics.alertsTriggered++;

      this.logger.warn(`Alerta disparada: ${rule.name}`, { ruleId, data });

    } catch (error) {
      this.logger.error(`Error disparando alerta ${ruleId}:`, error);
    }
  }

  /**
     * Iniciar procesador de cola
     */
  startQueueProcessor() {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
    }

    this.queueProcessor = setInterval(async() => {
      await this.processQueue();
    }, 1000); // Procesar cada segundo

    this.logger.info('Procesador de cola de notificaciones iniciado');
  }

  /**
     * Detener procesador de cola
     */
  stopQueueProcessor() {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
      this.logger.info('Procesador de cola de notificaciones detenido');
    }
  }

  /**
     * Procesar cola de notificaciones
     */
  async processQueue() {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batchSize = 10; // Procesar hasta 10 notificaciones por vez
      const batch = this.notificationQueue.splice(0, batchSize);

      for (const notification of batch) {
        try {
          await this.deliverNotification(notification);
          this.serviceMetrics.sent++;
          this.serviceMetrics.queued--;

        } catch (error) {
          this.serviceMetrics.failed++;
          this.serviceMetrics.queued--;
          this.logger.error('Error entregando notificación:', error);
        }
      }

    } catch (error) {
      this.logger.error('Error procesando cola de notificaciones:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
     * Procesar cola restante al cerrar
     */
  async processRemainingQueue() {
    while (this.notificationQueue.length > 0) {
      await this.processQueue();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
     * Entregar notificación
     */
  async deliverNotification(notification) {
    const io = this.serviceDependencies.io;
    if (!io) {
      throw new Error('Socket.IO no disponible');
    }

    try {
      switch (notification.targetType) {
      case 'user':
        await this.deliverToUser(notification, io);
        break;
      case 'broadcast':
        await this.deliverBroadcast(notification, io);
        break;
      default:
        await this.deliverBroadcast(notification, io);
      }

      this.logger.debug(`Notificación entregada: ${notification.id}`);

    } catch (error) {
      this.logger.error('Error entregando notificación:', error);
      throw error;
    }
  }

  /**
     * Entregar notificación a usuario específico
     */
  async deliverToUser(notification, io) {
    const subscriber = this.subscribers.get(notification.targetId);
    if (!subscriber) {
      throw new Error(`Usuario ${notification.targetId} no encontrado`);
    }

    // Verificar preferencias
    if (!this.checkPreferences(subscriber.preferences, notification.type)) {
      return;
    }

    // Enviar por Socket.IO
    io.to(subscriber.socketId).emit('notification', notification);

    // Actualizar última vista
    subscriber.lastSeen = new Date();
  }

  /**
     * Entregar broadcast
     */
  async deliverBroadcast(notification, io) {
    let deliveredCount = 0;

    for (const [userId, subscriber] of this.subscribers) {
      try {
        // Verificar preferencias
        if (!this.checkPreferences(subscriber.preferences, notification.type)) {
          continue;
        }

        // Enviar por Socket.IO
        io.to(subscriber.socketId).emit('notification', notification);
        deliveredCount++;

        // Actualizar última vista
        subscriber.lastSeen = new Date();

      } catch (error) {
        this.logger.error(`Error enviando a usuario ${userId}:`, error);
      }
    }

    this.logger.debug(`Broadcast entregado a ${deliveredCount} usuarios`);
  }

  /**
     * Validar notificación
     */
  validateNotification(notification) {
    if (!notification || typeof notification !== 'object') {
      return false;
    }

    const required = ['type', 'message'];
    return required.every(field => notification[field]);
  }

  /**
     * Verificar preferencias de usuario
     */
  checkPreferences(preferences, notificationType) {
    const typeMap = {
      'message': 'messages',
      'alert': 'alerts',
      'system': 'systemEvents',
      'ai': 'aiEvents',
      'error': 'errorAlerts'
    };

    const prefKey = typeMap[notificationType] || 'systemEvents';
    return preferences[prefKey] !== false;
  }

  /**
     * Generar ID de notificación
     */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
     * Formatear mensaje de alerta
     */
  formatAlertMessage(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
     * Agregar regla de alerta
     */
  addAlertRule(ruleId, rule) {
    this.alertRules.set(ruleId, {
      ...rule,
      enabled: rule.enabled !== false,
      cooldown: rule.cooldown || 60000
    });

    this.logger.info(`Regla de alerta agregada: ${ruleId}`);
  }

  /**
     * Remover regla de alerta
     */
  removeAlertRule(ruleId) {
    if (this.alertRules.delete(ruleId)) {
      this.logger.info(`Regla de alerta removida: ${ruleId}`);
    }
  }

  /**
     * Cargar suscriptores persistidos
     */
  async loadPersistedSubscribers() {
    try {
      const db = getDatabase();
      const data = await db.read('notifications', 'subscribers');
            
      if (data && data.subscribers) {
        for (const [userId, subscriber] of Object.entries(data.subscribers)) {
          // Solo cargar preferencias, no socketId (se actualiza al conectar)
          this.subscribers.set(userId, {
            ...subscriber,
            socketId: null,
            lastSeen: new Date(subscriber.lastSeen)
          });
        }
                
        this.serviceMetrics.subscribers = this.subscribers.size;
        this.logger.info(`Cargados ${this.subscribers.size} suscriptores persistidos`);
      }

    } catch (error) {
      this.logger.warn('No se pudieron cargar suscriptores persistidos:', error.message);
    }
  }

  /**
     * Persistir suscriptores
     */
  async persistSubscribers() {
    try {
      const db = getDatabase();
      const subscribersData = {};
            
      for (const [userId, subscriber] of this.subscribers) {
        subscribersData[userId] = {
          preferences: subscriber.preferences,
          subscribedAt: subscriber.subscribedAt,
          lastSeen: subscriber.lastSeen
        };
      }

      await db.write('notifications', 'subscribers', { 
        subscribers: subscribersData,
        lastUpdate: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Error persistiendo suscriptores:', error);
    }
  }

  /**
     * Obtener métricas del servicio
     */
  getServiceMetrics() {
    return {
      ...this.serviceMetrics,
      queueSize: this.notificationQueue.length,
      alertRules: this.alertRules.size,
      isProcessing: this.isProcessing
    };
  }

  /**
     * Obtener suscriptores
     */
  getSubscribers() {
    const subscribers = {};
    for (const [userId, subscriber] of this.subscribers) {
      subscribers[userId] = {
        preferences: subscriber.preferences,
        subscribedAt: subscriber.subscribedAt,
        lastSeen: subscriber.lastSeen,
        isConnected: !!subscriber.socketId
      };
    }
    return subscribers;
  }

  /**
     * Obtener reglas de alerta
     */
  getAlertRules() {
    const rules = {};
    for (const [ruleId, rule] of this.alertRules) {
      rules[ruleId] = {
        name: rule.name,
        enabled: rule.enabled,
        cooldown: rule.cooldown,
        lastTriggered: rule.lastTriggered
      };
    }
    return rules;
  }

  /**
     * Health check específico
     */
  async getHealth() {
    const queueSize = this.notificationQueue.length;
    const subscribersCount = this.subscribers.size;
        
    let status = 'healthy';
    const issues = [];

    // Verificar cola
    if (queueSize > 100) {
      status = 'warning';
      issues.push('Cola de notificaciones grande');
    }

    // Verificar Socket.IO
    if (!this.serviceDependencies.io) {
      status = 'unhealthy';
      issues.push('Socket.IO no disponible');
    }

    return {
      status,
      service: this.serviceName,
      message: status === 'healthy' ? 'Servicio funcionando correctamente' : issues.join(', '),
      details: {
        queueSize,
        subscribersCount,
        alertRules: this.alertRules.size,
        metrics: this.getServiceMetrics(),
        issues: issues.length > 0 ? issues : undefined
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
     * Configurar dependencias
     */
  setDependencies(dependencies) {
    this.serviceDependencies = { ...this.serviceDependencies, ...dependencies };
    this.logger.info('Dependencias actualizadas para NotificationService');
  }

  /**
     * Limpiar recursos
     */
  cleanup() {
    this.stopQueueProcessor();
    this.subscribers.clear();
    this.alertRules.clear();
    this.notificationQueue = [];
    this.eventEmitter.removeAllListeners();
  }

  /**
     * Métodos de EventEmitter delegados
     */
  on(event, listener) {
    return this.eventEmitter.on(event, listener);
  }

  emit(event, ...args) {
    return this.eventEmitter.emit(event, ...args);
  }

  removeListener(event, listener) {
    return this.eventEmitter.removeListener(event, listener);
  }
}

export default NotificationService;
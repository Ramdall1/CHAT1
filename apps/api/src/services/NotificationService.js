import EventEmitter from 'events';
import logger from '../utils/logger.js';

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.subscribers = new Map(); // userId -> { socketId, preferences }
    this.alertRules = new Map(); // ruleId -> { condition, action, enabled }
    this.notificationQueue = [];
    this.isProcessing = false;
    this.metrics = {
      sent: 0,
      failed: 0,
      queued: 0,
      alertsTriggered: 0,
    };

    this.initializeDefaultRules();
    this.startQueueProcessor();
  }

  // ===== SUBSCRIPTION MANAGEMENT =====
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
      email: false,
    };

    this.subscribers.set(userId, {
      socketId,
      preferences: { ...defaultPreferences, ...preferences },
      subscribedAt: new Date(),
      lastSeen: new Date(),
    });

    logger.info(`Usuario ${userId} suscrito a notificaciones`);
    this.emit('userSubscribed', { userId, socketId });
  }

  unsubscribe(userId) {
    if (this.subscribers.has(userId)) {
      this.subscribers.delete(userId);
      logger.info(`Usuario ${userId} desuscrito de notificaciones`);
      this.emit('userUnsubscribed', { userId });
    }
  }

  updatePreferences(userId, preferences) {
    if (this.subscribers.has(userId)) {
      const subscriber = this.subscribers.get(userId);
      subscriber.preferences = { ...subscriber.preferences, ...preferences };
      this.subscribers.set(userId, subscriber);
      logger.info(`Preferencias actualizadas para usuario ${userId}`);
    }
  }

  // ===== NOTIFICATION SENDING =====
  async sendNotification(notification) {
    try {
      // Validar notificación
      if (!this.validateNotification(notification)) {
        throw new Error('Notificación inválida');
      }

      // Agregar a cola
      this.notificationQueue.push({
        ...notification,
        id: this.generateNotificationId(),
        timestamp: new Date(),
        status: 'queued',
      });

      this.metrics.queued++;
      this.processQueue();

      return true;
    } catch (error) {
      logger.error('Error enviando notificación:', error);
      this.metrics.failed++;
      return false;
    }
  }

  async sendToUser(userId, notification) {
    const subscriber = this.subscribers.get(userId);
    if (!subscriber) {
      logger.warn(`Usuario ${userId} no está suscrito a notificaciones`);
      return false;
    }

    // Verificar preferencias
    if (!this.checkPreferences(subscriber.preferences, notification.type)) {
      logger.debug(
        `Notificación filtrada por preferencias del usuario ${userId}`
      );
      return false;
    }

    return await this.sendNotification({
      ...notification,
      targetUser: userId,
      socketId: subscriber.socketId,
    });
  }

  async broadcast(notification) {
    const promises = [];

    for (const [userId, subscriber] of this.subscribers) {
      if (this.checkPreferences(subscriber.preferences, notification.type)) {
        promises.push(this.sendToUser(userId, notification));
      }
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(
      r => r.status === 'fulfilled' && r.value
    ).length;

    logger.info(
      `Broadcast enviado a ${successful}/${this.subscribers.size} usuarios`
    );
    return successful;
  }

  // ===== ALERT SYSTEM =====
  initializeDefaultRules() {
    // Regla: Muchos errores en poco tiempo
    this.addAlertRule('high-error-rate', {
      condition: data => {
        const errorCount = data.errorCount || 0;
        const timeWindow = data.timeWindow || 300000; // 5 minutos
        return errorCount > 10 && timeWindow < 300000;
      },
      action: {
        type: 'alert',
        severity: 'high',
        message: 'Alta tasa de errores detectada',
        channels: ['push', 'email'],
      },
      cooldown: 600000, // 10 minutos
      enabled: true,
    });

    // Regla: Rendimiento degradado
    this.addAlertRule('performance-degraded', {
      condition: data => {
        const responseTime = data.averageResponseTime || 0;
        return responseTime > 5000; // 5 segundos
      },
      action: {
        type: 'alert',
        severity: 'medium',
        message: 'Rendimiento del sistema degradado',
        channels: ['push'],
      },
      cooldown: 300000, // 5 minutos
      enabled: true,
    });

    // Regla: Servidor desconectado
    this.addAlertRule('server-disconnected', {
      condition: data => {
        return data.serverStatus === 'disconnected';
      },
      action: {
        type: 'alert',
        severity: 'critical',
        message: 'Servidor desconectado',
        channels: ['push', 'email', 'sms'],
      },
      cooldown: 60000, // 1 minuto
      enabled: true,
    });

    // Regla: Muchos mensajes fallidos
    this.addAlertRule('message-failures', {
      condition: data => {
        const failureRate = data.messageFailureRate || 0;
        return failureRate > 0.1; // 10% de fallos
      },
      action: {
        type: 'alert',
        severity: 'medium',
        message: 'Alta tasa de fallos en mensajes',
        channels: ['push'],
      },
      cooldown: 600000, // 10 minutos
      enabled: true,
    });
  }

  addAlertRule(ruleId, rule) {
    this.alertRules.set(ruleId, {
      ...rule,
      lastTriggered: null,
      triggerCount: 0,
    });
    logger.info(`Regla de alerta agregada: ${ruleId}`);
  }

  removeAlertRule(ruleId) {
    if (this.alertRules.has(ruleId)) {
      this.alertRules.delete(ruleId);
      logger.info(`Regla de alerta eliminada: ${ruleId}`);
    }
  }

  async checkAlerts(data) {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        // Verificar cooldown
        if (
          rule.lastTriggered &&
          Date.now() - rule.lastTriggered.getTime() < rule.cooldown
        ) {
          continue;
        }

        // Evaluar condición
        if (rule.condition(data)) {
          await this.triggerAlert(ruleId, rule, data);
        }
      } catch (error) {
        logger.error(`Error evaluando regla ${ruleId}:`, error);
      }
    }
  }

  async triggerAlert(ruleId, rule, data) {
    const alert = {
      id: this.generateNotificationId(),
      ruleId,
      type: 'alert',
      severity: rule.action.severity,
      title: rule.action.message,
      message: this.formatAlertMessage(rule.action.message, data),
      data: data,
      timestamp: new Date(),
      channels: rule.action.channels,
    };

    // Actualizar regla
    rule.lastTriggered = new Date();
    rule.triggerCount++;
    this.alertRules.set(ruleId, rule);

    // Enviar alerta
    await this.broadcast(alert);
    this.metrics.alertsTriggered++;

    logger.warn(`Alerta disparada: ${ruleId} - ${rule.action.message}`);
    this.emit('alertTriggered', alert);
  }

  // ===== NOTIFICATION TYPES =====
  async sendMessageNotification(messageData) {
    return await this.sendNotification({
      type: 'message',
      title: 'Nuevo mensaje',
      message: `Mensaje de ${messageData.from}`,
      data: messageData,
      priority: 'normal',
      channels: ['push'],
    });
  }

  async sendAINotification(aiData) {
    return await this.sendNotification({
      type: 'ai_event',
      title: 'Evento de IA',
      message: `Intención detectada: ${aiData.intent}`,
      data: aiData,
      priority: 'normal',
      channels: ['push'],
    });
  }

  async sendSystemNotification(systemData) {
    return await this.sendNotification({
      type: 'system',
      title: 'Evento del sistema',
      message: systemData.message,
      data: systemData,
      priority: systemData.priority || 'normal',
      channels: ['push'],
    });
  }

  async sendErrorNotification(errorData) {
    return await this.sendNotification({
      type: 'error',
      title: 'Error del sistema',
      message: errorData.message,
      data: errorData,
      priority: 'high',
      severity: 'high',
      channels: ['push', 'email'],
    });
  }

  // ===== QUEUE PROCESSING =====
  async processQueue() {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift();
        await this.deliverNotification(notification);
        this.metrics.queued--;
      }
    } catch (error) {
      logger.error('Error procesando cola de notificaciones:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async deliverNotification(notification) {
    try {
      // Entregar vía WebSocket
      if (notification.socketId && global.io) {
        global.io.to(notification.socketId).emit('notification', notification);
      }

      // Broadcast si no hay socketId específico
      if (!notification.socketId && global.io) {
        global.io.emit('notification', notification);
      }

      // Aquí se pueden agregar otros canales (email, SMS, etc.)
      if (notification.channels?.includes('email')) {
        await this.sendEmailNotification(notification);
      }

      notification.status = 'delivered';
      this.metrics.sent++;

      logger.debug(`Notificación entregada: ${notification.id}`);
    } catch (error) {
      notification.status = 'failed';
      this.metrics.failed++;
      logger.error('Error entregando notificación:', error);
    }
  }

  startQueueProcessor() {
    setInterval(() => {
      this.processQueue();
    }, 1000); // Procesar cada segundo
  }

  // ===== UTILITY METHODS =====
  validateNotification(notification) {
    return (
      notification &&
      notification.type &&
      notification.title &&
      notification.message
    );
  }

  checkPreferences(preferences, notificationType) {
    switch (notificationType) {
      case 'message':
        return preferences.messages;
      case 'alert':
        return preferences.alerts;
      case 'system':
        return preferences.systemEvents;
      case 'ai_event':
        return preferences.aiEvents;
      case 'error':
        return preferences.errorAlerts;
      default:
        return true;
    }
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatAlertMessage(template, data) {
    let message = template;

    // Reemplazar variables en el template
    Object.keys(data).forEach(key => {
      const placeholder = `{${key}}`;
      if (message.includes(placeholder)) {
        message = message.replace(placeholder, data[key]);
      }
    });

    return message;
  }

  async sendEmailNotification(notification) {
    // Placeholder para integración con servicio de email
    logger.info(`Email notification would be sent: ${notification.title}`);
    // Aquí se integraría con SendGrid, Nodemailer, etc.
  }

  // ===== METRICS AND STATUS =====
  getMetrics() {
    return {
      ...this.metrics,
      subscribersCount: this.subscribers.size,
      queueLength: this.notificationQueue.length,
      activeRules: Array.from(this.alertRules.entries()).filter(
        ([_, rule]) => rule.enabled
      ).length,
    };
  }

  getSubscribers() {
    return Array.from(this.subscribers.entries()).map(([userId, data]) => ({
      userId,
      socketId: data.socketId,
      preferences: data.preferences,
      subscribedAt: data.subscribedAt,
      lastSeen: data.lastSeen,
    }));
  }

  getAlertRules() {
    return Array.from(this.alertRules.entries()).map(([ruleId, rule]) => ({
      ruleId,
      enabled: rule.enabled,
      lastTriggered: rule.lastTriggered,
      triggerCount: rule.triggerCount,
      cooldown: rule.cooldown,
      action: rule.action,
    }));
  }

  // ===== CLEANUP =====
  cleanup() {
    this.subscribers.clear();
    this.notificationQueue.length = 0;
    this.alertRules.clear();
    logger.info('NotificationService limpiado');
  }
}

// Singleton instance
const notificationService = new NotificationService();

export default notificationService;

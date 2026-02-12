/**
 * @fileoverview Notification Manager Service
 * Gestiona notificaciones multi-canal (email, SMS, push, webhook)
 * 
 * @author ChatBot Enterprise Team
 * @version 6.0.0
 * @since 2.0.0
 */

import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../core/logger.js';

/**
 * Tipos de notificación
 */
export const NotificationType = {
  PUSH: 'push',
  WEBHOOK: 'webhook',
  IN_APP: 'in_app',
  SLACK: 'slack',
  DISCORD: 'discord'
};

/**
 * Prioridades de notificación
 */
export const NotificationPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
  CRITICAL: 'critical'
};

/**
 * Estados de notificación
 */
export const NotificationStatus = {
  PENDING: 'pending',
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  RETRYING: 'retrying'
};

/**
 * Categorías de notificación
 */
export const NotificationCategory = {
  SYSTEM: 'system',
  SECURITY: 'security',
  USER_ACTION: 'user_action',
  MARKETING: 'marketing',
  ALERT: 'alert',
  REMINDER: 'reminder',
  UPDATE: 'update'
};

/**
 * Clase principal del gestor de notificaciones
 */
export class NotificationManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Configuración de email
      email: {
        enabled: true,
        service: config.email?.service || 'gmail',
        host: config.email?.host || 'smtp.gmail.com',
        port: config.email?.port || 587,
        secure: config.email?.secure || false,
        auth: {
          user: config.email?.auth?.user || process.env.EMAIL_USER,
          pass: config.email?.auth?.pass || process.env.EMAIL_PASS
        },
        from: config.email?.from || process.env.EMAIL_FROM || 'noreply@chatbot.com',
        ...config.email
      },
      
      // Configuración de SMS - DESHABILITADO (Twilio removido)
      sms: {
        enabled: false,
        provider: 'disabled', // Twilio removido del proyecto
        // accountSid: process.env.TWILIO_ACCOUNT_SID, // Deshabilitado - Twilio removido
        // authToken: process.env.TWILIO_AUTH_TOKEN, // Deshabilitado - Twilio removido
        // from: process.env.TWILIO_FROM, // Deshabilitado - Twilio removido
        ...config.sms
      },
      
      // Configuración de push notifications
      push: {
        enabled: false,
        provider: 'firebase',
        serverKey: process.env.FIREBASE_SERVER_KEY,
        ...config.push
      },
      
      // Configuración de webhooks
      webhook: {
        enabled: true,
        timeout: 30000,
        retries: 3,
        ...config.webhook
      },
      
      // Configuración de retry
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2
      },
      
      // Configuración de rate limiting
      rateLimit: {
        enabled: true,
        maxPerMinute: 60,
        maxPerHour: 1000
      },
      
      // Configuración de templates
      templates: {
        enabled: true,
        defaultLanguage: 'es',
        fallbackLanguage: 'en'
      },
      
      ...config
    };
    
    // Almacenamiento de notificaciones
    this.notifications = new Map();
    this.templates = new Map();
    this.subscribers = new Map();
    this.channels = new Map();
    
    // Colas de procesamiento
    this.sendQueue = [];
    this.retryQueue = [];
    
    // Estadísticas
    this.stats = {
      totalSent: 0,
      totalFailed: 0,
      totalRetries: 0,
      byType: {},
      byPriority: {},
      byStatus: {},
      averageDeliveryTime: 0,
      lastDeliveryTime: 0
    };
    
    // Rate limiting
    this.rateLimitCounters = new Map();
    
    // Transporters
    this.smsClient = null;
    
    this.initializeManager();
  }

  /**
   * Inicializa el gestor de notificaciones
   */
  async initializeManager() {
    try {
      // Configurar transporters
      await this.setupTransporters();
      
      // Configurar templates por defecto
      this.setupDefaultTemplates();
      
      // Configurar procesamiento de colas
      this.setupQueueProcessing();
      
      // Configurar limpieza automática
      this.setupCleanupTasks();
      
      logger.info('NotificationManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize NotificationManager', error);
      throw error;
    }
  }

  /**
   * Configura transporters de notificación
   */
  async setupTransporters() {
    // Configurar cliente SMS
    if (this.config.sms.enabled) {
      try {
        // SMS client configuration disabled (Twilio removed from project)
        logger.info('SMS client configured successfully');
      } catch (error) {
        logger.error('Failed to configure SMS client', error);
        this.config.sms.enabled = false;
      }
    }
  }

  /**
   * Configura templates por defecto
   */
  setupDefaultTemplates() {
    // Template de bienvenida
    this.registerTemplate('welcome', {
      subject: {
        es: 'Bienvenido a ChatBot Enterprise',
        en: 'Welcome to ChatBot Enterprise'
      },
      body: {
        es: 'Hola {{name}}, bienvenido a nuestro sistema de chatbot.',
        en: 'Hello {{name}}, welcome to our chatbot system.'
      },
      type: NotificationType.EMAIL
    });
    
    // Template de alerta de seguridad
    this.registerTemplate('security_alert', {
      subject: {
        es: 'Alerta de Seguridad - ChatBot Enterprise',
        en: 'Security Alert - ChatBot Enterprise'
      },
      body: {
        es: 'Se ha detectado actividad sospechosa en tu cuenta: {{details}}',
        en: 'Suspicious activity detected in your account: {{details}}'
      },
      type: NotificationType.EMAIL,
      priority: NotificationPriority.HIGH
    });
    
    // Template de error del sistema
    this.registerTemplate('system_error', {
      subject: {
        es: 'Error del Sistema - ChatBot Enterprise',
        en: 'System Error - ChatBot Enterprise'
      },
      body: {
        es: 'Error detectado: {{error}}. Tiempo: {{timestamp}}',
        en: 'Error detected: {{error}}. Time: {{timestamp}}'
      },
      type: NotificationType.WEBHOOK,
      priority: NotificationPriority.CRITICAL
    });
  }

  /**
   * Registra un template de notificación
   */
  registerTemplate(id, template) {
    this.templates.set(id, {
      id,
      ...template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    logger.info(`Notification template registered: ${id}`);
  }

  /**
   * Suscribe un usuario a notificaciones
   */
  subscribe(userId, preferences) {
    const subscription = {
      userId,
      channels: preferences.channels || [NotificationType.EMAIL],
      categories: preferences.categories || Object.values(NotificationCategory),
      priority: preferences.priority || NotificationPriority.NORMAL,
      language: preferences.language || this.config.templates.defaultLanguage,
      active: preferences.active !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.subscribers.set(userId, subscription);
    
    logger.info(`User subscribed to notifications: ${userId}`, {
      channels: subscription.channels,
      categories: subscription.categories
    });
    
    return subscription;
  }

  /**
   * Desuscribe un usuario
   */
  unsubscribe(userId) {
    const subscription = this.subscribers.get(userId);
    if (subscription) {
      this.subscribers.delete(userId);
      logger.info(`User unsubscribed from notifications: ${userId}`);
      return true;
    }
    return false;
  }

  /**
   * Envía una notificación
   */
  async sendNotification(notification) {
    const notificationId = notification.id || this.generateNotificationId();
    
    const notificationData = {
      id: notificationId,
      type: notification.type,
      recipient: notification.recipient,
      subject: notification.subject,
      body: notification.body,
      data: notification.data || {},
      priority: notification.priority || NotificationPriority.NORMAL,
      category: notification.category || NotificationCategory.SYSTEM,
      templateId: notification.templateId,
      language: notification.language || this.config.templates.defaultLanguage,
      scheduledAt: notification.scheduledAt,
      status: NotificationStatus.PENDING,
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Procesar template si se especifica
    if (notificationData.templateId) {
      const processed = this.processTemplate(notificationData);
      Object.assign(notificationData, processed);
    }
    
    this.notifications.set(notificationId, notificationData);
    
    // Agregar a cola de envío
    if (notificationData.scheduledAt) {
      // Programar para más tarde
      const delay = new Date(notificationData.scheduledAt).getTime() - Date.now();
      setTimeout(() => {
        this.sendQueue.push(notificationData);
      }, Math.max(0, delay));
    } else {
      // Enviar inmediatamente
      this.sendQueue.push(notificationData);
    }
    
    logger.info(`Notification queued: ${notificationId}`, {
      type: notificationData.type,
      recipient: notificationData.recipient,
      priority: notificationData.priority
    });
    
    return notificationData;
  }

  /**
   * Envía notificación usando template
   */
  async sendTemplateNotification(templateId, recipient, data = {}, options = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    return this.sendNotification({
      type: template.type,
      recipient,
      templateId,
      data,
      priority: template.priority || options.priority,
      category: template.category || options.category,
      language: options.language,
      scheduledAt: options.scheduledAt
    });
  }

  /**
   * Procesa un template
   */
  processTemplate(notification) {
    const template = this.templates.get(notification.templateId);
    if (!template) {
      throw new Error(`Template not found: ${notification.templateId}`);
    }
    
    const language = notification.language || this.config.templates.defaultLanguage;
    const fallbackLanguage = this.config.templates.fallbackLanguage;
    
    // Obtener subject y body en el idioma apropiado
    const subject = template.subject[language] || template.subject[fallbackLanguage] || template.subject;
    const body = template.body[language] || template.body[fallbackLanguage] || template.body;
    
    // Reemplazar variables
    const processedSubject = this.replaceVariables(subject, notification.data);
    const processedBody = this.replaceVariables(body, notification.data);
    
    return {
      subject: processedSubject,
      body: processedBody,
      type: template.type,
      priority: template.priority || notification.priority,
      category: template.category || notification.category
    };
  }

  /**
   * Reemplaza variables en un texto
   */
  replaceVariables(text, data) {
    if (typeof text !== 'string') {
      return text;
    }
    
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  /**
   * Procesa la cola de envío
   */
  async processNotification(notification) {
    const startTime = Date.now();
    notification.status = NotificationStatus.SENDING;
    notification.attempts++;
    notification.lastAttemptAt = new Date().toISOString();
    
    try {
      // Verificar rate limiting
      if (!this.checkRateLimit(notification.type)) {
        throw new Error('Rate limit exceeded');
      }
      
      let result;
      
      switch (notification.type) {
        case NotificationType.PUSH:
          result = await this.sendPush(notification);
          break;
        case NotificationType.WEBHOOK:
          result = await this.sendWebhook(notification);
          break;
        case NotificationType.IN_APP:
          result = await this.sendInApp(notification);
          break;
        default:
          throw new Error(`Unsupported notification type: ${notification.type}`);
      }
      
      // Actualizar estado
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date().toISOString();
      notification.deliveryTime = Date.now() - startTime;
      notification.result = result;
      
      // Actualizar estadísticas
      this.updateStats(notification, true, notification.deliveryTime);
      
      logger.info(`Notification sent successfully: ${notification.id}`, {
        type: notification.type,
        recipient: notification.recipient,
        deliveryTime: notification.deliveryTime
      });
      
      this.emit('notification.sent', notification);
      
      return notification;
      
    } catch (error) {
      notification.status = NotificationStatus.FAILED;
      notification.error = error.message;
      notification.deliveryTime = Date.now() - startTime;
      
      // Actualizar estadísticas
      this.updateStats(notification, false, notification.deliveryTime);
      
      logger.error(`Notification failed: ${notification.id}`, {
        type: notification.type,
        recipient: notification.recipient,
        error: error.message,
        attempt: notification.attempts
      });
      
      // Programar retry si es necesario
      if (notification.attempts < this.config.retry.maxAttempts) {
        this.scheduleRetry(notification);
      } else {
        this.emit('notification.failed', notification);
      }
      
      throw error;
    }
  }





  /**
   * Envía push notification
   */
  async sendPush(notification) {
    if (!this.config.push.enabled) {
      throw new Error('Push notification service not available');
    }
    
    try {
      const provider = this.config.push.provider || 'fcm';
      
      switch (provider) {
        case 'fcm':
          return await this.sendFCMPush(notification);
        case 'apns':
          return await this.sendAPNsPush(notification);
        case 'expo':
          return await this.sendExpoPush(notification);
        default:
          throw new Error(`Proveedor Push no soportado: ${provider}`);
      }
    } catch (error) {
      logger.error('Error enviando Push notification:', {
        error: error.message,
        recipient: notification.recipient,
        provider: this.config.push.provider
      });
      throw error;
    }
  }

  /**
   * Envía push notification usando Firebase Cloud Messaging (FCM)
   */
  async sendFCMPush(notification) {
    const { serverKey, projectId } = this.config.push.fcm || {};
    
    if (!serverKey) {
      throw new Error('Server Key de FCM no configurado');
    }
    
    const payload = {
      to: notification.recipient, // FCM token
      notification: {
        title: notification.title || notification.subject,
        body: notification.body || notification.message,
        icon: notification.icon || this.config.push.defaultIcon,
        sound: notification.sound || 'default',
        badge: notification.badge || 1
      },
      data: notification.data || {},
      priority: this.mapPriorityToFCM(notification.priority),
      time_to_live: notification.ttl || 3600 // 1 hora por defecto
    };
    
    // Si es un array de tokens, usar multicast
    if (Array.isArray(notification.recipient)) {
      payload.registration_ids = notification.recipient;
      delete payload.to;
    }
    
    const response = await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      payload,
      {
        headers: {
          'Authorization': `key=${serverKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    // Verificar errores en la respuesta
    if (response.data.failure > 0) {
      const errors = response.data.results?.filter(r => r.error) || [];
      logger.warn('Algunos tokens FCM fallaron:', { errors });
    }
    
    return {
      messageId: response.data.multicast_id || `fcm_${Date.now()}`,
      status: response.data.success > 0 ? 'sent' : 'failed',
      provider: 'fcm',
      success: response.data.success || 0,
      failure: response.data.failure || 0,
      results: response.data.results || [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Envía push notification usando Apple Push Notification Service (APNs)
   */
  async sendAPNsPush(notification) {
    const { keyId, teamId, bundleId, keyPath } = this.config.push.apns || {};
    
    if (!keyId || !teamId || !bundleId) {
      throw new Error('Configuración de APNs incompleta');
    }
    
    // Nota: En producción, usar una librería como 'node-apn' para manejar certificados
    const payload = {
      aps: {
        alert: {
          title: notification.title || notification.subject,
          body: notification.body || notification.message
        },
        sound: notification.sound || 'default',
        badge: notification.badge || 1,
        'content-available': notification.contentAvailable ? 1 : 0
      },
      ...notification.data
    };
    
    // Simulación de envío APNs (en producción usar certificados reales)
    logger.info('Enviando notificación APNs:', {
      deviceToken: notification.recipient,
      payload,
      bundleId
    });
    
    return {
      messageId: `apns_${Date.now()}`,
      status: 'sent',
      provider: 'apns',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Envía push notification usando Expo Push Service
   */
  async sendExpoPush(notification) {
    const { accessToken } = this.config.push.expo || {};
    
    const payload = {
      to: notification.recipient, // Expo push token
      title: notification.title || notification.subject,
      body: notification.body || notification.message,
      data: notification.data || {},
      sound: notification.sound || 'default',
      priority: notification.priority || 'normal',
      ttl: notification.ttl || 3600
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate'
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await axios.post(
      'https://exp.host/--/api/v2/push/send',
      payload,
      {
        headers,
        timeout: 15000
      }
    );
    
    const result = response.data.data || response.data;
    
    if (result.status === 'error') {
      throw new Error(`Error Expo: ${result.message || 'Error desconocido'}`);
    }
    
    return {
      messageId: result.id || `expo_${Date.now()}`,
      status: result.status === 'ok' ? 'sent' : 'failed',
      provider: 'expo',
      receipt: result.receipt,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Mapea prioridad interna a prioridad FCM
   */
  mapPriorityToFCM(priority) {
    const priorityMap = {
      'low': 'normal',
      'normal': 'normal', 
      'high': 'high',
      'urgent': 'high',
      'critical': 'high'
    };
    
    return priorityMap[priority] || 'normal';
  }

  /**
   * Envía webhook
   */
  async sendWebhook(notification) {
    if (!this.config.webhook.enabled) {
      throw new Error('Webhook service not available');
    }
    

    
    const response = await axios.post(notification.recipient, {
      subject: notification.subject,
      body: notification.body,
      data: notification.data,
      timestamp: new Date().toISOString()
    }, {
      timeout: this.config.webhook.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChatBot-Enterprise-NotificationManager/6.0.0'
      }
    });
    
    return {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    };
  }

  /**
   * Envía notificación in-app
   */
  async sendInApp(notification) {
    // Implementar notificaciones in-app
    // Por ejemplo, usando WebSockets o Server-Sent Events
    this.emit('notification.in_app', notification);
    
    return {
      delivered: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Programa retry de notificación
   */
  scheduleRetry(notification) {
    const delay = Math.min(
      this.config.retry.baseDelay * Math.pow(this.config.retry.backoffFactor, notification.attempts - 1),
      this.config.retry.maxDelay
    );
    
    notification.status = NotificationStatus.RETRYING;
    notification.nextRetryAt = new Date(Date.now() + delay).toISOString();
    
    setTimeout(() => {
      this.retryQueue.push(notification);
    }, delay);
    
    this.stats.totalRetries++;
    
    logger.info(`Notification retry scheduled: ${notification.id}`, {
      attempt: notification.attempts,
      delay,
      nextRetryAt: notification.nextRetryAt
    });
  }

  /**
   * Verifica rate limiting
   */
  checkRateLimit(type) {
    if (!this.config.rateLimit.enabled) {
      return true;
    }
    
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    
    const minuteKey = `${type}:${minute}`;
    const hourKey = `${type}:${hour}`;
    
    const minuteCount = this.rateLimitCounters.get(minuteKey) || 0;
    const hourCount = this.rateLimitCounters.get(hourKey) || 0;
    
    if (minuteCount >= this.config.rateLimit.maxPerMinute ||
        hourCount >= this.config.rateLimit.maxPerHour) {
      return false;
    }
    
    this.rateLimitCounters.set(minuteKey, minuteCount + 1);
    this.rateLimitCounters.set(hourKey, hourCount + 1);
    
    return true;
  }

  /**
   * Configura procesamiento de colas
   */
  setupQueueProcessing() {
    // Procesar cola de envío cada segundo
    setInterval(() => {
      this.processSendQueue();
    }, 1000);
    
    // Procesar cola de retry cada 5 segundos
    setInterval(() => {
      this.processRetryQueue();
    }, 5000);
  }

  /**
   * Procesa cola de envío
   */
  async processSendQueue() {
    while (this.sendQueue.length > 0) {
      const notification = this.sendQueue.shift();
      
      try {
        await this.processNotification(notification);
      } catch (error) {
        // Error ya manejado en processNotification
      }
    }
  }

  /**
   * Procesa cola de retry
   */
  async processRetryQueue() {
    while (this.retryQueue.length > 0) {
      const notification = this.retryQueue.shift();
      
      // Verificar si es hora del retry
      if (notification.nextRetryAt && new Date() < new Date(notification.nextRetryAt)) {
        this.retryQueue.push(notification);
        break;
      }
      
      try {
        await this.processNotification(notification);
      } catch (error) {
        // Error ya manejado en processNotification
      }
    }
  }

  /**
   * Configura tareas de limpieza
   */
  setupCleanupTasks() {
    // Limpiar contadores de rate limit cada hora
    setInterval(() => {
      this.cleanupRateLimitCounters();
    }, 60 * 60 * 1000);
    
    // Limpiar notificaciones antiguas cada día
    setInterval(() => {
      this.cleanupOldNotifications();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Limpia contadores de rate limit antiguos
   */
  cleanupRateLimitCounters() {
    const now = Date.now();
    const cutoff = now - 3600000; // 1 hora
    
    let cleaned = 0;
    for (const [key, value] of this.rateLimitCounters) {
      const [type, timestamp] = key.split(':');
      if (parseInt(timestamp) * 60000 < cutoff) {
        this.rateLimitCounters.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old rate limit counters`);
    }
  }

  /**
   * Limpia notificaciones antiguas
   */
  cleanupOldNotifications() {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 días
    let cleaned = 0;
    
    for (const [id, notification] of this.notifications) {
      const createdAt = new Date(notification.createdAt).getTime();
      if (createdAt < cutoff && 
          [NotificationStatus.SENT, NotificationStatus.FAILED, NotificationStatus.CANCELLED].includes(notification.status)) {
        this.notifications.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old notifications`);
    }
  }

  /**
   * Actualiza estadísticas
   */
  updateStats(notification, success, deliveryTime) {
    if (success) {
      this.stats.totalSent++;
    } else {
      this.stats.totalFailed++;
    }
    
    // Estadísticas por tipo
    if (!this.stats.byType[notification.type]) {
      this.stats.byType[notification.type] = { sent: 0, failed: 0 };
    }
    if (success) {
      this.stats.byType[notification.type].sent++;
    } else {
      this.stats.byType[notification.type].failed++;
    }
    
    // Estadísticas por prioridad
    if (!this.stats.byPriority[notification.priority]) {
      this.stats.byPriority[notification.priority] = { sent: 0, failed: 0 };
    }
    if (success) {
      this.stats.byPriority[notification.priority].sent++;
    } else {
      this.stats.byPriority[notification.priority].failed++;
    }
    
    // Tiempo de entrega
    this.stats.lastDeliveryTime = deliveryTime;
    this.stats.averageDeliveryTime = 
      (this.stats.averageDeliveryTime + deliveryTime) / 2;
  }

  /**
   * Genera ID de notificación
   */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      pendingNotifications: this.sendQueue.length,
      retryingNotifications: this.retryQueue.length,
      totalNotifications: this.notifications.size,
      templatesRegistered: this.templates.size,
      subscribersCount: this.subscribers.size
    };
  }

  /**
   * Obtiene notificación por ID
   */
  getNotification(id) {
    return this.notifications.get(id);
  }

  /**
   * Obtiene notificaciones por estado
   */
  getNotificationsByStatus(status) {
    return Array.from(this.notifications.values())
      .filter(notification => notification.status === status);
  }

  /**
   * Cancela una notificación
   */
  cancelNotification(id) {
    const notification = this.notifications.get(id);
    if (!notification) {
      return false;
    }
    
    if (notification.status === NotificationStatus.PENDING || 
        notification.status === NotificationStatus.RETRYING) {
      notification.status = NotificationStatus.CANCELLED;
      notification.cancelledAt = new Date().toISOString();
      
      // Remover de colas
      this.sendQueue = this.sendQueue.filter(n => n.id !== id);
      this.retryQueue = this.retryQueue.filter(n => n.id !== id);
      
      logger.info(`Notification cancelled: ${id}`);
      this.emit('notification.cancelled', notification);
      
      return true;
    }
    
    return false;
  }

  /**
   * Cierra el gestor de notificaciones
   */
  async close() {
    // Procesar notificaciones pendientes
    await this.processSendQueue();
    await this.processRetryQueue();
    
    // Cerrar transporters
    if (this.emailTransporter) {
      this.emailTransporter.close();
    }
    
    logger.info('NotificationManager closed');
  }
}

// Instancia singleton
export const notificationManager = new NotificationManager();

export default NotificationManager;
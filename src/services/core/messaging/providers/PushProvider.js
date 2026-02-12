import { EventEmitter } from 'events';
import admin from 'firebase-admin';
import apn from 'apn';
import webpush from 'web-push';

/**
 * Proveedor de notificaciones push
 * Soporta FCM (Firebase Cloud Messaging) y APNs (Apple Push Notification service)
 */
class PushProvider extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración del proveedor
      name: 'push',
      enabled: true,
      priority: 3,
            
      // Configuración de FCM (Firebase Cloud Messaging)
      fcm: {
        enabled: true,
        serverKey: process.env.FCM_SERVER_KEY || '',
        senderId: process.env.FCM_SENDER_ID || '',
        projectId: process.env.FCM_PROJECT_ID || '',
        serviceAccountPath: process.env.FCM_SERVICE_ACCOUNT_PATH || null
      },
            
      // Configuración de APNs (Apple Push Notification service)
      apns: {
        enabled: true,
        keyId: process.env.APNS_KEY_ID || '',
        teamId: process.env.APNS_TEAM_ID || '',
        bundleId: process.env.APNS_BUNDLE_ID || '',
        keyPath: process.env.APNS_KEY_PATH || '',
        production: process.env.NODE_ENV === 'production'
      },
            
      // Configuración de Web Push
      webPush: {
        enabled: true,
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
        subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
      },
            
      // Configuración de mensajes
      message: {
        defaultTtl: 86400, // 24 horas
        maxPayloadSize: 4096,
        collapseKey: null,
        priority: 'high', // high, normal
        restrictedPackageName: null
      },
            
      // Configuración de retry
      retry: {
        attempts: 3,
        delay: 1000,
        backoff: 'exponential'
      },
            
      // Configuración de rate limiting
      rateLimit: {
        enabled: true,
        maxPerSecond: 10,
        maxPerMinute: 500,
        maxPerHour: 10000
      },
            
      // Configuración de tracking
      tracking: {
        enabled: true,
        deliveryReceipts: true,
        clickTracking: true,
        customData: true
      },
            
      // Configuración de topics
      topics: {
        enabled: true,
        maxSubscriptions: 1000000,
        defaultTopic: 'general'
      },
            
      ...config
    };
        
    this.state = 'initialized';
    this.fcmClient = null;
    this.apnsClient = null;
    this.webPushClient = null;
        
    // Estadísticas del proveedor
    this.stats = {
      sent: 0,
      failed: 0,
      delivered: 0,
      clicked: 0,
      dismissed: 0,
      lastSent: null,
      errors: 0,
      byPlatform: {
        android: { sent: 0, failed: 0 },
        ios: { sent: 0, failed: 0 },
        web: { sent: 0, failed: 0 }
      }
    };
        
    // Rate limiter
    this.rateLimiter = {
      second: { count: 0, resetTime: 0 },
      minute: { count: 0, resetTime: 0 },
      hour: { count: 0, resetTime: 0 }
    };
        
    // Cache de tokens válidos
    this.tokenCache = new Map();
  }
    
  /**
     * Inicializa el proveedor
     */
  async initialize() {
    try {
      this._validateConfig();
            
      // Inicializar FCM
      if (this.config.fcm.enabled) {
        await this._initializeFCM();
      }
            
      // Inicializar APNs
      if (this.config.apns.enabled) {
        await this._initializeAPNs();
      }
            
      // Inicializar Web Push
      if (this.config.webPush.enabled) {
        await this._initializeWebPush();
      }
            
      this.state = 'ready';
      this.emit('initialized');
            
      return true;
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Envía una notificación push
     */
  async send(notification) {
    try {
      // Validar notificación
      this._validateNotification(notification);
            
      // Verificar rate limit
      if (!this._checkRateLimit()) {
        throw new Error('Rate limit exceeded');
      }
            
      // Determinar plataforma y enviar
      const results = await this._sendByPlatform(notification);
            
      // Actualizar estadísticas
      this.stats.sent += results.length;
      this.stats.lastSent = Date.now();
      this._updateRateLimiter();
            
      this.emit('sent', {
        messageIds: results.map(r => r.messageId),
        recipient: notification.recipient,
        platform: notification.platform
      });
            
      return {
        success: true,
        messageIds: results.map(r => r.messageId),
        provider: 'push',
        sentAt: Date.now(),
        platform: notification.platform,
        results
      };
            
    } catch (error) {
      this.stats.failed++;
      this.stats.errors++;
            
      this.emit('failed', {
        recipient: notification.recipient,
        error: error.message
      });
            
      throw error;
    }
  }
    
  /**
     * Envía notificación a un topic
     */
  async sendToTopic(notification, topic) {
    try {
      if (!this.config.topics.enabled) {
        throw new Error('Topic messaging is disabled');
      }
            
      // Verificar rate limit
      if (!this._checkRateLimit()) {
        throw new Error('Rate limit exceeded');
      }
            
      // Preparar mensaje para topic
      const message = this._prepareTopicMessage(notification, topic);
            
      // Enviar según plataforma
      let result;
      if (notification.platform === 'ios' && this.apnsClient) {
        result = await this._sendAPNsToTopic(message, topic);
      } else {
        result = await this._sendFCMToTopic(message, topic);
      }
            
      // Actualizar estadísticas
      this.stats.sent++;
      this.stats.lastSent = Date.now();
      this._updateRateLimiter();
            
      this.emit('topicSent', {
        messageId: result.messageId,
        topic,
        platform: notification.platform
      });
            
      return {
        success: true,
        messageId: result.messageId,
        provider: 'push',
        sentAt: Date.now(),
        topic,
        platform: notification.platform
      };
            
    } catch (error) {
      this.stats.failed++;
      this.stats.errors++;
            
      this.emit('topicFailed', {
        topic,
        error: error.message
      });
            
      throw error;
    }
  }
    
  /**
     * Suscribe un token a un topic
     */
  async subscribeToTopic(tokens, topic) {
    if (!this.config.topics.enabled) {
      throw new Error('Topic messaging is disabled');
    }
        
    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
            
      if (this.fcmClient) {
        const response = await this.fcmClient.subscribeToTopic(tokenArray, topic);
                
        this.emit('topicSubscribed', {
          topic,
          tokens: tokenArray,
          successCount: response.successCount,
          failureCount: response.failureCount
        });
                
        return response;
      }
            
      throw new Error('FCM client not available for topic subscription');
    } catch (error) {
      this.emit('topicSubscriptionFailed', {
        topic,
        tokens,
        error: error.message
      });
            
      throw error;
    }
  }
    
  /**
     * Desuscribe un token de un topic
     */
  async unsubscribeFromTopic(tokens, topic) {
    if (!this.config.topics.enabled) {
      throw new Error('Topic messaging is disabled');
    }
        
    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
            
      if (this.fcmClient) {
        const response = await this.fcmClient.unsubscribeFromTopic(tokenArray, topic);
                
        this.emit('topicUnsubscribed', {
          topic,
          tokens: tokenArray,
          successCount: response.successCount,
          failureCount: response.failureCount
        });
                
        return response;
      }
            
      throw new Error('FCM client not available for topic unsubscription');
    } catch (error) {
      this.emit('topicUnsubscriptionFailed', {
        topic,
        tokens,
        error: error.message
      });
            
      throw error;
    }
  }
    
  /**
     * Envía múltiples notificaciones
     */
  async sendBatch(notifications) {
    const results = [];
        
    for (const notification of notifications) {
      try {
        const result = await this.send(notification);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          recipient: notification.recipient
        });
      }
    }
        
    return results;
  }
    
  /**
     * Verifica el estado del proveedor
     */
  async checkHealth() {
    try {
      const health = {
        healthy: true,
        state: this.state,
        stats: this.stats,
        services: {}
      };
            
      // Verificar FCM
      if (this.config.fcm.enabled) {
        health.services.fcm = this.fcmClient ? { available: true } : { available: false };
      }
            
      // Verificar APNs
      if (this.config.apns.enabled) {
        health.services.apns = this.apnsClient ? { available: true } : { available: false };
      }
            
      // Verificar Web Push
      if (this.config.webPush.enabled) {
        health.services.webPush = this.webPushClient ? { available: true } : { available: false };
      }
            
      return health;
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        state: this.state
      };
    }
  }
    
  /**
     * Obtiene estadísticas del proveedor
     */
  getStatistics() {
    return {
      provider: 'push',
      state: this.state,
      stats: this.stats,
      rateLimit: {
        current: {
          perSecond: this.rateLimiter.second.count,
          perMinute: this.rateLimiter.minute.count,
          perHour: this.rateLimiter.hour.count
        },
        limits: {
          perSecond: this.config.rateLimit.maxPerSecond,
          perMinute: this.config.rateLimit.maxPerMinute,
          perHour: this.config.rateLimit.maxPerHour
        }
      },
      performance: {
        successRate: this._calculateSuccessRate(),
        clickRate: this._calculateClickRate(),
        platformDistribution: this._calculatePlatformDistribution()
      }
    };
  }
    
  /**
     * Destruye el proveedor
     */
  destroy() {
    this.fcmClient = null;
    this.apnsClient = null;
    this.webPushClient = null;
    this.tokenCache.clear();
        
    this.state = 'destroyed';
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  async _initializeFCM() {
        
    let credential;
    if (this.config.fcm.serviceAccountPath) {
      credential = admin.credential.cert(this.config.fcm.serviceAccountPath);
    } else {
      credential = admin.credential.cert({
        projectId: this.config.fcm.projectId,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n')
      });
    }
        
    const app = admin.initializeApp({
      credential,
      projectId: this.config.fcm.projectId
    }, 'push-notifications');
        
    this.fcmClient = app.messaging();
  }
    
  async _initializeAPNs() {
        
    const options = {
      token: {
        key: this.config.apns.keyPath,
        keyId: this.config.apns.keyId,
        teamId: this.config.apns.teamId
      },
      production: this.config.apns.production
    };
        
    this.apnsClient = new apn.Provider(options);
  }
    
  async _initializeWebPush() {
        
    webpush.setVapidDetails(
      this.config.webPush.subject,
      this.config.webPush.vapidPublicKey,
      this.config.webPush.vapidPrivateKey
    );
        
    this.webPushClient = webpush;
  }
    
  async _sendByPlatform(notification) {
    const results = [];
        
    // Determinar plataforma
    const platform = notification.platform || this._detectPlatform(notification.recipient);
        
    switch (platform) {
    case 'android':
      if (this.fcmClient) {
        const result = await this._sendFCM(notification);
        results.push(result);
        this.stats.byPlatform.android.sent++;
      }
      break;
                
    case 'ios':
      if (this.apnsClient) {
        const result = await this._sendAPNs(notification);
        results.push(result);
        this.stats.byPlatform.ios.sent++;
      }
      break;
                
    case 'web':
      if (this.webPushClient) {
        const result = await this._sendWebPush(notification);
        results.push(result);
        this.stats.byPlatform.web.sent++;
      }
      break;
                
    default:
      // Intentar con FCM por defecto
      if (this.fcmClient) {
        const result = await this._sendFCM(notification);
        results.push(result);
      }
      break;
    }
        
    return results;
  }
    
  async _sendFCM(notification) {
    const message = this._prepareFCMMessage(notification);
        
    try {
      const response = await this.fcmClient.send(message);
            
      return {
        messageId: response,
        platform: 'android',
        status: 'sent'
      };
    } catch (error) {
      this.stats.byPlatform.android.failed++;
      throw error;
    }
  }
    
  async _sendAPNs(notification) {
    const message = this._prepareAPNsMessage(notification);
    const deviceToken = notification.recipient;
        
    try {
      const response = await this.apnsClient.send(message, deviceToken);
            
      if (response.failed && response.failed.length > 0) {
        throw new Error(`APNs failed: ${response.failed[0].error}`);
      }
            
      return {
        messageId: `apns_${Date.now()}`,
        platform: 'ios',
        status: 'sent'
      };
    } catch (error) {
      this.stats.byPlatform.ios.failed++;
      throw error;
    }
  }
    
  async _sendWebPush(notification) {
    const message = this._prepareWebPushMessage(notification);
    const subscription = JSON.parse(notification.recipient);
        
    try {
      const response = await this.webPushClient.sendNotification(
        subscription,
        JSON.stringify(message)
      );
            
      return {
        messageId: `webpush_${Date.now()}`,
        platform: 'web',
        status: 'sent',
        statusCode: response.statusCode
      };
    } catch (error) {
      this.stats.byPlatform.web.failed++;
      throw error;
    }
  }
    
  async _sendFCMToTopic(message, topic) {
    const topicMessage = {
      ...message,
      topic
    };
        
    const response = await this.fcmClient.send(topicMessage);
        
    return {
      messageId: response,
      platform: 'android',
      status: 'sent'
    };
  }
    
  async _sendAPNsToTopic(message, topic) {
    // APNs no soporta topics directamente
    // Esto requeriría una implementación personalizada
    throw new Error('APNs topic messaging not implemented');
  }
    
  _prepareFCMMessage(notification) {
    const message = {
      token: notification.recipient,
      notification: {
        title: notification.title,
        body: notification.message || notification.body
      },
      data: notification.data || {},
      android: {
        priority: this.config.message.priority,
        ttl: this.config.message.defaultTtl * 1000,
        notification: {
          icon: notification.icon || 'default',
          color: notification.color || '#007bff',
          sound: notification.sound || 'default',
          clickAction: notification.clickAction
        }
      }
    };
        
    // Agregar collapse key si está especificado
    if (this.config.message.collapseKey) {
      message.android.collapseKey = this.config.message.collapseKey;
    }
        
    // Agregar datos de tracking
    if (this.config.tracking.enabled && this.config.tracking.customData) {
      message.data.trackingId = `fcm_${Date.now()}`;
      message.data.sentAt = Date.now().toString();
    }
        
    return message;
  }
    
  _prepareAPNsMessage(notification) {
    const message = new apn.Notification();
        
    message.alert = {
      title: notification.title,
      body: notification.message || notification.body
    };
        
    message.badge = notification.badge || 1;
    message.sound = notification.sound || 'default';
    message.topic = this.config.apns.bundleId;
    message.expiry = Math.floor(Date.now() / 1000) + this.config.message.defaultTtl;
    message.priority = this.config.message.priority === 'high' ? 10 : 5;
        
    // Agregar datos personalizados
    if (notification.data) {
      message.payload = notification.data;
    }
        
    // Agregar datos de tracking
    if (this.config.tracking.enabled && this.config.tracking.customData) {
      message.payload = {
        ...message.payload,
        trackingId: `apns_${Date.now()}`,
        sentAt: Date.now()
      };
    }
        
    return message;
  }
    
  _prepareWebPushMessage(notification) {
    return {
      title: notification.title,
      body: notification.message || notification.body,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/badge-72x72.png',
      image: notification.image,
      data: {
        ...notification.data,
        url: notification.url || '/',
        trackingId: this.config.tracking.enabled ? `webpush_${Date.now()}` : undefined,
        sentAt: this.config.tracking.enabled ? Date.now() : undefined
      },
      actions: notification.actions || [],
      requireInteraction: notification.requireInteraction || false,
      silent: notification.silent || false,
      tag: notification.tag || 'default',
      timestamp: Date.now()
    };
  }
    
  _prepareTopicMessage(notification, topic) {
    return {
      topic,
      notification: {
        title: notification.title,
        body: notification.message || notification.body
      },
      data: notification.data || {},
      android: {
        priority: this.config.message.priority,
        ttl: this.config.message.defaultTtl * 1000
      }
    };
  }
    
  _detectPlatform(recipient) {
    // Detectar plataforma basado en el formato del token/recipient
        
    if (typeof recipient === 'string') {
      // Token FCM típico (Android)
      if (recipient.length > 100 && recipient.includes(':')) {
        return 'android';
      }
            
      // Token APNs típico (iOS)
      if (recipient.length === 64 && /^[a-f0-9]+$/i.test(recipient)) {
        return 'ios';
      }
    }
        
    // Subscription object (Web Push)
    if (typeof recipient === 'object' || recipient.startsWith('{')) {
      return 'web';
    }
        
    return 'android'; // Por defecto
  }
    
  _checkRateLimit() {
    if (!this.config.rateLimit.enabled) {
      return true;
    }
        
    const now = Date.now();
        
    // Verificar límite por segundo
    if (this.rateLimiter.second.resetTime <= now) {
      this.rateLimiter.second.count = 0;
      this.rateLimiter.second.resetTime = now + 1000;
    }
        
    if (this.rateLimiter.second.count >= this.config.rateLimit.maxPerSecond) {
      return false;
    }
        
    // Verificar límite por minuto
    if (this.rateLimiter.minute.resetTime <= now) {
      this.rateLimiter.minute.count = 0;
      this.rateLimiter.minute.resetTime = now + 60000;
    }
        
    if (this.rateLimiter.minute.count >= this.config.rateLimit.maxPerMinute) {
      return false;
    }
        
    // Verificar límite por hora
    if (this.rateLimiter.hour.resetTime <= now) {
      this.rateLimiter.hour.count = 0;
      this.rateLimiter.hour.resetTime = now + 3600000;
    }
        
    if (this.rateLimiter.hour.count >= this.config.rateLimit.maxPerHour) {
      return false;
    }
        
    return true;
  }
    
  _updateRateLimiter() {
    this.rateLimiter.second.count++;
    this.rateLimiter.minute.count++;
    this.rateLimiter.hour.count++;
  }
    
  _calculateSuccessRate() {
    const total = this.stats.sent + this.stats.failed;
    return total > 0 ? (this.stats.sent / total) * 100 : 0;
  }
    
  _calculateClickRate() {
    return this.stats.sent > 0 ? (this.stats.clicked / this.stats.sent) * 100 : 0;
  }
    
  _calculatePlatformDistribution() {
    const total = this.stats.byPlatform.android.sent + 
                     this.stats.byPlatform.ios.sent + 
                     this.stats.byPlatform.web.sent;
        
    if (total === 0) {
      return { android: 0, ios: 0, web: 0 };
    }
        
    return {
      android: (this.stats.byPlatform.android.sent / total) * 100,
      ios: (this.stats.byPlatform.ios.sent / total) * 100,
      web: (this.stats.byPlatform.web.sent / total) * 100
    };
  }
    
  _validateNotification(notification) {
    if (!notification.recipient) {
      throw new Error('Recipient token is required');
    }
        
    if (!notification.title) {
      throw new Error('Notification title is required');
    }
        
    if (!notification.message && !notification.body) {
      throw new Error('Notification message is required');
    }
  }
    
  _validateConfig() {
    if (!this.config.fcm.enabled && !this.config.apns.enabled && !this.config.webPush.enabled) {
      throw new Error('At least one push service must be enabled');
    }
        
    if (this.config.fcm.enabled) {
      if (!this.config.fcm.projectId) {
        throw new Error('FCM project ID is required');
      }
    }
        
    if (this.config.apns.enabled) {
      if (!this.config.apns.keyId || !this.config.apns.teamId || !this.config.apns.bundleId) {
        throw new Error('APNs configuration is incomplete');
      }
    }
        
    if (this.config.webPush.enabled) {
      if (!this.config.webPush.vapidPublicKey || !this.config.webPush.vapidPrivateKey) {
        throw new Error('Web Push VAPID keys are required');
      }
    }
  }
}

export default PushProvider;
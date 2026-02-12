import { EventEmitter } from 'events';
import axios from 'axios';

/**
 * Proveedor de notificaciones para Slack
 * Envía notificaciones a canales de Slack y mensajes directos
 */
class SlackProvider extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración del proveedor
      name: 'slack',
      enabled: true,
      priority: 5,
            
      // Configuración de Slack
      slack: {
        botToken: process.env.SLACK_BOT_TOKEN || '',
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        appToken: process.env.SLACK_APP_TOKEN || '',
        signingSecret: process.env.SLACK_SIGNING_SECRET || ''
      },
            
      // Configuración de canales
      channels: {
        default: '#general',
        alerts: '#alerts',
        notifications: '#notifications',
        errors: '#errors'
      },
            
      // Configuración de mensajes
      message: {
        username: 'NotificationBot',
        iconEmoji: ':bell:',
        iconUrl: null,
        linkNames: true,
        unfurlLinks: false,
        unfurlMedia: false,
        markdown: true,
        maxLength: 4000
      },
            
      // Configuración de formato
      formatting: {
        enableBlocks: true,
        enableAttachments: true,
        enableThreads: false,
        colorScheme: {
          info: '#36a64f',
          warning: '#ff9500',
          error: '#ff0000',
          success: '#36a64f'
        }
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
        maxPerSecond: 1,
        maxPerMinute: 50,
        maxPerHour: 1000
      },
            
      // Configuración de tracking
      tracking: {
        enabled: true,
        includeTimestamp: true,
        includeSource: true,
        threadReplies: false
      },
            
      // Configuración de usuarios
      users: {
        mentionUsers: false,
        userMapping: {
          // 'email@example.com': 'U1234567890'
        }
      },
            
      ...config
    };
        
    this.state = 'initialized';
    this.httpClient = null;
        
    // Estadísticas del proveedor
    this.stats = {
      sent: 0,
      failed: 0,
      delivered: 0,
      lastSent: null,
      errors: 0,
      byChannel: {},
      byType: {
        channel: 0,
        dm: 0,
        webhook: 0
      }
    };
        
    // Rate limiter
    this.rateLimiter = {
      second: { count: 0, resetTime: 0 },
      minute: { count: 0, resetTime: 0 },
      hour: { count: 0, resetTime: 0 }
    };
        
    // Cache de canales y usuarios
    this.channelCache = new Map();
    this.userCache = new Map();
  }
    
  /**
     * Inicializa el proveedor
     */
  async initialize() {
    try {
      this._validateConfig();
      this._initializeHttpClient();
            
      // Verificar conexión con Slack
      if (this.config.slack.botToken) {
        await this._testConnection();
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
     * Envía una notificación a Slack
     */
  async send(notification) {
    try {
      // Validar notificación
      this._validateNotification(notification);
            
      // Verificar rate limit
      if (!this._checkRateLimit()) {
        throw new Error('Rate limit exceeded');
      }
            
      // Determinar método de envío
      let result;
      if (this.config.slack.webhookUrl && !notification.channel?.startsWith('@')) {
        result = await this._sendViaWebhook(notification);
      } else if (this.config.slack.botToken) {
        result = await this._sendViaAPI(notification);
      } else {
        throw new Error('No valid Slack configuration found');
      }
            
      // Actualizar estadísticas
      this._updateStats(notification, result);
      this._updateRateLimiter();
            
      this.emit('sent', {
        channel: notification.channel,
        messageId: result.ts,
        method: result.method
      });
            
      return {
        success: true,
        messageId: result.ts,
        provider: 'slack',
        sentAt: Date.now(),
        channel: notification.channel,
        method: result.method
      };
            
    } catch (error) {
      this.stats.failed++;
      this.stats.errors++;
            
      this.emit('failed', {
        channel: notification.channel,
        error: error.message
      });
            
      throw error;
    }
  }
    
  /**
     * Envía una notificación con formato enriquecido
     */
  async sendRich(notification) {
    const richNotification = {
      ...notification,
      blocks: this._createBlocks(notification),
      attachments: this._createAttachments(notification)
    };
        
    return this.send(richNotification);
  }
    
  /**
     * Envía una notificación a múltiples canales
     */
  async sendToChannels(notification, channels) {
    const results = [];
        
    for (const channel of channels) {
      try {
        const channelNotification = { ...notification, channel };
        const result = await this.send(channelNotification);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          channel
        });
      }
    }
        
    return results;
  }
    
  /**
     * Envía un mensaje directo a un usuario
     */
  async sendDirectMessage(notification, userId) {
    const dmNotification = {
      ...notification,
      channel: `@${userId}`,
      isDM: true
    };
        
    return this.send(dmNotification);
  }
    
  /**
     * Responde en un hilo
     */
  async replyToThread(notification, threadTs) {
    const threadNotification = {
      ...notification,
      threadTs,
      isThread: true
    };
        
    return this.send(threadNotification);
  }
    
  /**
     * Actualiza un mensaje existente
     */
  async updateMessage(messageTs, channel, notification) {
    try {
      if (!this.config.slack.botToken) {
        throw new Error('Bot token required for message updates');
      }
            
      const payload = this._prepareAPIPayload(notification);
      payload.ts = messageTs;
      payload.channel = channel;
            
      const response = await this.httpClient.post(
        'https://slack.com/api/chat.update',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.config.slack.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
            
      if (!response.data.ok) {
        throw new Error(`Slack API error: ${response.data.error}`);
      }
            
      this.emit('messageUpdated', {
        channel,
        messageId: messageTs,
        updatedAt: Date.now()
      });
            
      return {
        success: true,
        messageId: messageTs,
        channel,
        updatedAt: Date.now()
      };
            
    } catch (error) {
      this.emit('updateFailed', {
        channel,
        messageId: messageTs,
        error: error.message
      });
            
      throw error;
    }
  }
    
  /**
     * Elimina un mensaje
     */
  async deleteMessage(messageTs, channel) {
    try {
      if (!this.config.slack.botToken) {
        throw new Error('Bot token required for message deletion');
      }
            
      const response = await this.httpClient.post(
        'https://slack.com/api/chat.delete',
        {
          ts: messageTs,
          channel
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.slack.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
            
      if (!response.data.ok) {
        throw new Error(`Slack API error: ${response.data.error}`);
      }
            
      this.emit('messageDeleted', {
        channel,
        messageId: messageTs,
        deletedAt: Date.now()
      });
            
      return {
        success: true,
        messageId: messageTs,
        channel,
        deletedAt: Date.now()
      };
            
    } catch (error) {
      this.emit('deleteFailed', {
        channel,
        messageId: messageTs,
        error: error.message
      });
            
      throw error;
    }
  }
    
  /**
     * Obtiene información de un canal
     */
  async getChannelInfo(channelId) {
    try {
      if (!this.config.slack.botToken) {
        throw new Error('Bot token required for channel info');
      }
            
      // Verificar cache
      if (this.channelCache.has(channelId)) {
        return this.channelCache.get(channelId);
      }
            
      const response = await this.httpClient.get(
        `https://slack.com/api/conversations.info?channel=${channelId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.slack.botToken}`
          }
        }
      );
            
      if (!response.data.ok) {
        throw new Error(`Slack API error: ${response.data.error}`);
      }
            
      const channelInfo = response.data.channel;
      this.channelCache.set(channelId, channelInfo);
            
      return channelInfo;
            
    } catch (error) {
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
          channel: notification.channel
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
        connection: {}
      };
            
      // Verificar conexión con Slack
      if (this.config.slack.botToken) {
        try {
          await this._testConnection();
          health.connection.api = { available: true };
        } catch (error) {
          health.connection.api = { available: false, error: error.message };
          health.healthy = false;
        }
      }
            
      if (this.config.slack.webhookUrl) {
        health.connection.webhook = { available: true };
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
      provider: 'slack',
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
        channelCount: Object.keys(this.stats.byChannel).length,
        cacheSize: {
          channels: this.channelCache.size,
          users: this.userCache.size
        }
      }
    };
  }
    
  /**
     * Destruye el proveedor
     */
  destroy() {
    this.httpClient = null;
    this.channelCache.clear();
    this.userCache.clear();
        
    this.state = 'destroyed';
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  _initializeHttpClient() {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'NotificationSystem/1.0'
      }
    });
  }
    
  async _testConnection() {
    const response = await this.httpClient.get(
      'https://slack.com/api/auth.test',
      {
        headers: {
          'Authorization': `Bearer ${this.config.slack.botToken}`
        }
      }
    );
        
    if (!response.data.ok) {
      throw new Error(`Slack connection test failed: ${response.data.error}`);
    }
        
    return response.data;
  }
    
  async _sendViaWebhook(notification) {
    const payload = this._prepareWebhookPayload(notification);
        
    const response = await this.httpClient.post(
      this.config.slack.webhookUrl,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
        
    if (response.status !== 200 || response.data !== 'ok') {
      throw new Error(`Webhook failed: ${response.data}`);
    }
        
    return {
      ts: `webhook_${Date.now()}`,
      method: 'webhook'
    };
  }
    
  async _sendViaAPI(notification) {
    const payload = this._prepareAPIPayload(notification);
        
    const response = await this.httpClient.post(
      'https://slack.com/api/chat.postMessage',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.config.slack.botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
        
    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
        
    return {
      ts: response.data.ts,
      method: 'api'
    };
  }
    
  _prepareWebhookPayload(notification) {
    const payload = {
      text: notification.message || notification.title,
      username: this.config.message.username,
      icon_emoji: this.config.message.iconEmoji,
      icon_url: this.config.message.iconUrl,
      link_names: this.config.message.linkNames,
      unfurl_links: this.config.message.unfurlLinks,
      unfurl_media: this.config.message.unfurlMedia
    };
        
    // Agregar canal si está especificado
    if (notification.channel) {
      payload.channel = notification.channel;
    }
        
    // Agregar blocks si están habilitados
    if (this.config.formatting.enableBlocks && notification.blocks) {
      payload.blocks = notification.blocks;
    }
        
    // Agregar attachments si están habilitados
    if (this.config.formatting.enableAttachments && notification.attachments) {
      payload.attachments = notification.attachments;
    }
        
    return payload;
  }
    
  _prepareAPIPayload(notification) {
    const payload = {
      channel: notification.channel || this.config.channels.default,
      text: notification.message || notification.title,
      username: this.config.message.username,
      icon_emoji: this.config.message.iconEmoji,
      icon_url: this.config.message.iconUrl,
      link_names: this.config.message.linkNames,
      unfurl_links: this.config.message.unfurlLinks,
      unfurl_media: this.config.message.unfurlMedia
    };
        
    // Agregar thread timestamp si es una respuesta
    if (notification.threadTs) {
      payload.thread_ts = notification.threadTs;
    }
        
    // Agregar blocks si están habilitados
    if (this.config.formatting.enableBlocks && notification.blocks) {
      payload.blocks = notification.blocks;
    }
        
    // Agregar attachments si están habilitados
    if (this.config.formatting.enableAttachments && notification.attachments) {
      payload.attachments = notification.attachments;
    }
        
    return payload;
  }
    
  _createBlocks(notification) {
    if (!this.config.formatting.enableBlocks) {
      return null;
    }
        
    const blocks = [];
        
    // Header block
    if (notification.title) {
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: notification.title
        }
      });
    }
        
    // Message block
    if (notification.message) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.message
        }
      });
    }
        
    // Fields block
    if (notification.fields && notification.fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: notification.fields.map(field => ({
          type: 'mrkdwn',
          text: `*${field.title}*\n${field.value}`
        }))
      });
    }
        
    // Actions block
    if (notification.actions && notification.actions.length > 0) {
      blocks.push({
        type: 'actions',
        elements: notification.actions.map(action => ({
          type: 'button',
          text: {
            type: 'plain_text',
            text: action.text
          },
          url: action.url,
          style: action.style || 'default'
        }))
      });
    }
        
    // Context block
    if (this.config.tracking.includeTimestamp || this.config.tracking.includeSource) {
      const contextElements = [];
            
      if (this.config.tracking.includeTimestamp) {
        contextElements.push({
          type: 'mrkdwn',
          text: `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`
        });
      }
            
      if (this.config.tracking.includeSource) {
        contextElements.push({
          type: 'mrkdwn',
          text: 'Notification System'
        });
      }
            
      if (contextElements.length > 0) {
        blocks.push({
          type: 'context',
          elements: contextElements
        });
      }
    }
        
    return blocks.length > 0 ? blocks : null;
  }
    
  _createAttachments(notification) {
    if (!this.config.formatting.enableAttachments) {
      return null;
    }
        
    const attachment = {
      color: this._getColor(notification.type || notification.level),
      fallback: notification.message || notification.title
    };
        
    // Agregar campos
    if (notification.fields) {
      attachment.fields = notification.fields.map(field => ({
        title: field.title,
        value: field.value,
        short: field.short || false
      }));
    }
        
    // Agregar timestamp
    if (this.config.tracking.includeTimestamp) {
      attachment.ts = Math.floor(Date.now() / 1000);
    }
        
    // Agregar footer
    if (this.config.tracking.includeSource) {
      attachment.footer = 'Notification System';
      attachment.footer_icon = 'https://platform.slack-edge.com/img/default_application_icon.png';
    }
        
    return [attachment];
  }
    
  _getColor(type) {
    const colors = this.config.formatting.colorScheme;
        
    switch (type) {
    case 'error':
    case 'danger':
      return colors.error;
    case 'warning':
    case 'warn':
      return colors.warning;
    case 'success':
      return colors.success;
    case 'info':
    default:
      return colors.info;
    }
  }
    
  _updateStats(notification, result) {
    this.stats.sent++;
    this.stats.lastSent = Date.now();
        
    // Actualizar estadísticas por canal
    const channel = notification.channel || this.config.channels.default;
    if (!this.stats.byChannel[channel]) {
      this.stats.byChannel[channel] = {
        sent: 0,
        failed: 0,
        lastSent: null
      };
    }
        
    this.stats.byChannel[channel].sent++;
    this.stats.byChannel[channel].lastSent = Date.now();
        
    // Actualizar estadísticas por tipo
    if (notification.isDM) {
      this.stats.byType.dm++;
    } else if (result.method === 'webhook') {
      this.stats.byType.webhook++;
    } else {
      this.stats.byType.channel++;
    }
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
    
  _validateNotification(notification) {
    if (!notification.title && !notification.message) {
      throw new Error('Notification title or message is required');
    }
        
    if (notification.message && notification.message.length > this.config.message.maxLength) {
      throw new Error(`Message exceeds maximum length of ${this.config.message.maxLength} characters`);
    }
  }
    
  _validateConfig() {
    if (!this.config.slack.botToken && !this.config.slack.webhookUrl) {
      throw new Error('Either bot token or webhook URL must be configured');
    }
        
    if (this.config.slack.webhookUrl) {
      try {
        new URL(this.config.slack.webhookUrl);
      } catch (error) {
        throw new Error('Invalid webhook URL');
      }
    }
  }
}

export default SlackProvider;
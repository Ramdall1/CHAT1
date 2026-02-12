import { EventEmitter } from 'events';
import axios from 'axios';
import crypto from 'crypto';

/**
 * Proveedor de notificaciones webhook
 * Envía notificaciones a URLs externas mediante HTTP/HTTPS
 */
class WebhookProvider extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración del proveedor
      name: 'webhook',
      enabled: true,
      priority: 4,
            
      // Configuración de HTTP
      http: {
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 300,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NotificationSystem/1.0'
        }
      },
            
      // Configuración de autenticación
      auth: {
        type: 'none', // none, bearer, basic, apikey, signature
        bearer: {
          token: process.env.WEBHOOK_BEARER_TOKEN || ''
        },
        basic: {
          username: process.env.WEBHOOK_USERNAME || '',
          password: process.env.WEBHOOK_PASSWORD || ''
        },
        apiKey: {
          header: 'X-API-Key',
          value: process.env.WEBHOOK_API_KEY || ''
        },
        signature: {
          secret: process.env.WEBHOOK_SECRET || '',
          algorithm: 'sha256',
          header: 'X-Signature'
        }
      },
            
      // Configuración de retry
      retry: {
        attempts: 3,
        delay: 1000,
        backoff: 'exponential',
        retryCondition: (error) => {
          return error.response?.status >= 500 || 
                           error.code === 'ECONNRESET' ||
                           error.code === 'ETIMEDOUT';
        }
      },
            
      // Configuración de rate limiting
      rateLimit: {
        enabled: true,
        maxPerSecond: 5,
        maxPerMinute: 100,
        maxPerHour: 1000
      },
            
      // Configuración de payload
      payload: {
        format: 'json', // json, form, xml
        template: null,
        includeMetadata: true,
        customFields: {}
      },
            
      // Configuración de verificación
      verification: {
        enabled: false,
        endpoint: null,
        challenge: null
      },
            
      // Configuración de tracking
      tracking: {
        enabled: true,
        includeId: true,
        includeTimestamp: true,
        includeSource: true
      },
            
      // Configuración de webhooks específicos
      webhooks: {
        // Ejemplo:
        // 'webhook-name': {
        //     url: 'https://example.com/webhook',
        //     method: 'POST',
        //     auth: { type: 'bearer', token: 'xxx' },
        //     headers: {},
        //     enabled: true
        // }
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
      byWebhook: {},
      byStatusCode: {},
      responseTime: {
        total: 0,
        count: 0,
        average: 0,
        min: Infinity,
        max: 0
      }
    };
        
    // Rate limiter
    this.rateLimiter = {
      second: { count: 0, resetTime: 0 },
      minute: { count: 0, resetTime: 0 },
      hour: { count: 0, resetTime: 0 }
    };
        
    // Cache de webhooks verificados
    this.verifiedWebhooks = new Set();
  }
    
  /**
     * Inicializa el proveedor
     */
  async initialize() {
    try {
      this._validateConfig();
      this._initializeHttpClient();
            
      // Verificar webhooks si está habilitado
      if (this.config.verification.enabled) {
        await this._verifyWebhooks();
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
     * Envía una notificación webhook
     */
  async send(notification) {
    try {
      // Validar notificación
      this._validateNotification(notification);
            
      // Verificar rate limit
      if (!this._checkRateLimit()) {
        throw new Error('Rate limit exceeded');
      }
            
      // Obtener configuración del webhook
      const webhookConfig = this._getWebhookConfig(notification.webhook);
            
      // Preparar payload
      const payload = this._preparePayload(notification, webhookConfig);
            
      // Preparar headers
      const headers = this._prepareHeaders(notification, webhookConfig, payload);
            
      // Enviar webhook con reintentos
      const result = await this._sendWithRetry(webhookConfig, payload, headers);
            
      // Actualizar estadísticas
      this._updateStats(webhookConfig.name, result);
      this._updateRateLimiter();
            
      this.emit('sent', {
        webhook: webhookConfig.name,
        url: webhookConfig.url,
        statusCode: result.status,
        responseTime: result.responseTime
      });
            
      return {
        success: true,
        webhook: webhookConfig.name,
        provider: 'webhook',
        sentAt: Date.now(),
        statusCode: result.status,
        responseTime: result.responseTime,
        headers: result.headers
      };
            
    } catch (error) {
      this.stats.failed++;
      this.stats.errors++;
            
      this.emit('failed', {
        webhook: notification.webhook,
        error: error.message,
        statusCode: error.response?.status
      });
            
      throw error;
    }
  }
    
  /**
     * Envía múltiples notificaciones webhook
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
          webhook: notification.webhook
        });
      }
    }
        
    return results;
  }
    
  /**
     * Registra un nuevo webhook
     */
  registerWebhook(name, config) {
    this.config.webhooks[name] = {
      enabled: true,
      method: 'POST',
      ...config
    };
        
    // Inicializar estadísticas para el webhook
    if (!this.stats.byWebhook[name]) {
      this.stats.byWebhook[name] = {
        sent: 0,
        failed: 0,
        lastSent: null,
        averageResponseTime: 0
      };
    }
        
    this.emit('webhookRegistered', { name, config });
  }
    
  /**
     * Desregistra un webhook
     */
  unregisterWebhook(name) {
    delete this.config.webhooks[name];
    this.verifiedWebhooks.delete(name);
        
    this.emit('webhookUnregistered', { name });
  }
    
  /**
     * Verifica un webhook específico
     */
  async verifyWebhook(name) {
    const webhookConfig = this.config.webhooks[name];
    if (!webhookConfig) {
      throw new Error(`Webhook '${name}' not found`);
    }
        
    try {
      const verificationPayload = {
        type: 'verification',
        challenge: this.config.verification.challenge || crypto.randomBytes(16).toString('hex'),
        timestamp: Date.now()
      };
            
      const headers = this._prepareHeaders({}, webhookConfig, verificationPayload);
            
      const response = await this.httpClient.request({
        method: webhookConfig.method || 'POST',
        url: webhookConfig.url,
        data: verificationPayload,
        headers,
        timeout: this.config.http.timeout
      });
            
      if (response.status >= 200 && response.status < 300) {
        this.verifiedWebhooks.add(name);
                
        this.emit('webhookVerified', {
          name,
          url: webhookConfig.url,
          statusCode: response.status
        });
                
        return true;
      }
            
      throw new Error(`Verification failed with status ${response.status}`);
            
    } catch (error) {
      this.emit('webhookVerificationFailed', {
        name,
        url: webhookConfig.url,
        error: error.message
      });
            
      throw error;
    }
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
        webhooks: {}
      };
            
      // Verificar cada webhook
      for (const [name, config] of Object.entries(this.config.webhooks)) {
        if (config.enabled) {
          health.webhooks[name] = {
            configured: true,
            verified: this.verifiedWebhooks.has(name),
            url: config.url
          };
        }
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
      provider: 'webhook',
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
        averageResponseTime: this.stats.responseTime.average,
        webhookCount: Object.keys(this.config.webhooks).length,
        verifiedWebhooks: this.verifiedWebhooks.size
      }
    };
  }
    
  /**
     * Destruye el proveedor
     */
  destroy() {
    this.httpClient = null;
    this.verifiedWebhooks.clear();
        
    this.state = 'destroyed';
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  _initializeHttpClient() {
    this.httpClient = axios.create({
      timeout: this.config.http.timeout,
      maxRedirects: this.config.http.maxRedirects,
      validateStatus: this.config.http.validateStatus,
      headers: this.config.http.headers
    });
        
    // Interceptor para medir tiempo de respuesta
    this.httpClient.interceptors.request.use((config) => {
      config.metadata = { startTime: Date.now() };
      return config;
    });
        
    this.httpClient.interceptors.response.use(
      (response) => {
        const responseTime = Date.now() - response.config.metadata.startTime;
        response.responseTime = responseTime;
        return response;
      },
      (error) => {
        if (error.config?.metadata) {
          const responseTime = Date.now() - error.config.metadata.startTime;
          error.responseTime = responseTime;
        }
        return Promise.reject(error);
      }
    );
  }
    
  async _verifyWebhooks() {
    const verificationPromises = [];
        
    for (const [name, config] of Object.entries(this.config.webhooks)) {
      if (config.enabled) {
        verificationPromises.push(
          this.verifyWebhook(name).catch(error => {
            logger.warn(`Webhook verification failed for ${name}:`, error.message);
          })
        );
      }
    }
        
    await Promise.allSettled(verificationPromises);
  }
    
  async _sendWithRetry(webhookConfig, payload, headers) {
    let lastError;
        
    for (let attempt = 1; attempt <= this.config.retry.attempts; attempt++) {
      try {
        const response = await this.httpClient.request({
          method: webhookConfig.method || 'POST',
          url: webhookConfig.url,
          data: payload,
          headers,
          timeout: this.config.http.timeout
        });
                
        return {
          status: response.status,
          headers: response.headers,
          responseTime: response.responseTime,
          attempt
        };
                
      } catch (error) {
        lastError = error;
                
        // Verificar si debemos reintentar
        if (attempt < this.config.retry.attempts && 
                    this.config.retry.retryCondition(error)) {
                    
          const delay = this._calculateRetryDelay(attempt);
          await this._sleep(delay);
          continue;
        }
                
        break;
      }
    }
        
    throw lastError;
  }
    
  _getWebhookConfig(webhookName) {
    if (!webhookName) {
      throw new Error('Webhook name is required');
    }
        
    const config = this.config.webhooks[webhookName];
    if (!config) {
      throw new Error(`Webhook '${webhookName}' not configured`);
    }
        
    if (!config.enabled) {
      throw new Error(`Webhook '${webhookName}' is disabled`);
    }
        
    return {
      name: webhookName,
      ...config
    };
  }
    
  _preparePayload(notification, webhookConfig) {
    let payload = {
      type: 'notification',
      notification: {
        title: notification.title,
        message: notification.message,
        data: notification.data || {}
      }
    };
        
    // Agregar metadata si está habilitado
    if (this.config.payload.includeMetadata) {
      payload.metadata = {
        provider: 'webhook',
        webhook: webhookConfig.name,
        sentAt: Date.now()
      };
            
      if (this.config.tracking.includeId) {
        payload.metadata.id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
            
      if (this.config.tracking.includeTimestamp) {
        payload.metadata.timestamp = new Date().toISOString();
      }
            
      if (this.config.tracking.includeSource) {
        payload.metadata.source = 'notification-system';
      }
    }
        
    // Agregar campos personalizados
    if (this.config.payload.customFields) {
      payload = { ...payload, ...this.config.payload.customFields };
    }
        
    // Aplicar plantilla si está configurada
    if (this.config.payload.template) {
      payload = this._applyTemplate(payload, this.config.payload.template);
    }
        
    return payload;
  }
    
  _prepareHeaders(notification, webhookConfig, payload) {
    const headers = {
      ...this.config.http.headers,
      ...webhookConfig.headers
    };
        
    // Configurar autenticación
    const authConfig = webhookConfig.auth || this.config.auth;
        
    switch (authConfig.type) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${authConfig.bearer?.token || authConfig.token}`;
      break;
                
    case 'basic':
      const credentials = Buffer.from(
        `${authConfig.basic?.username || authConfig.username}:${authConfig.basic?.password || authConfig.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
      break;
                
    case 'apikey':
      const headerName = authConfig.apiKey?.header || authConfig.header || 'X-API-Key';
      const apiKeyValue = authConfig.apiKey?.value || authConfig.value;
      headers[headerName] = apiKeyValue;
      break;
                
    case 'signature':
      const signature = this._generateSignature(payload, authConfig);
      const signatureHeader = authConfig.signature?.header || authConfig.header || 'X-Signature';
      headers[signatureHeader] = signature;
      break;
    }
        
    return headers;
  }
    
  _generateSignature(payload, authConfig) {
    const secret = authConfig.signature?.secret || authConfig.secret;
    const algorithm = authConfig.signature?.algorithm || authConfig.algorithm || 'sha256';
        
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
        
    return crypto
      .createHmac(algorithm, secret)
      .update(payloadString)
      .digest('hex');
  }
    
  _applyTemplate(payload, template) {
    // Implementación simple de plantillas
    // En una implementación real, se podría usar un motor de plantillas como Handlebars
        
    if (typeof template === 'function') {
      return template(payload);
    }
        
    if (typeof template === 'object') {
      return { ...template, ...payload };
    }
        
    return payload;
  }
    
  _updateStats(webhookName, result) {
    this.stats.sent++;
    this.stats.lastSent = Date.now();
        
    // Actualizar estadísticas por webhook
    if (!this.stats.byWebhook[webhookName]) {
      this.stats.byWebhook[webhookName] = {
        sent: 0,
        failed: 0,
        lastSent: null,
        averageResponseTime: 0
      };
    }
        
    const webhookStats = this.stats.byWebhook[webhookName];
    webhookStats.sent++;
    webhookStats.lastSent = Date.now();
        
    // Actualizar tiempo de respuesta
    if (result.responseTime) {
      this.stats.responseTime.total += result.responseTime;
      this.stats.responseTime.count++;
      this.stats.responseTime.average = this.stats.responseTime.total / this.stats.responseTime.count;
      this.stats.responseTime.min = Math.min(this.stats.responseTime.min, result.responseTime);
      this.stats.responseTime.max = Math.max(this.stats.responseTime.max, result.responseTime);
            
      // Actualizar tiempo de respuesta promedio del webhook
      webhookStats.averageResponseTime = (
        (webhookStats.averageResponseTime * (webhookStats.sent - 1) + result.responseTime) / 
                webhookStats.sent
      );
    }
        
    // Actualizar estadísticas por código de estado
    const statusCode = result.status.toString();
    if (!this.stats.byStatusCode[statusCode]) {
      this.stats.byStatusCode[statusCode] = 0;
    }
    this.stats.byStatusCode[statusCode]++;
  }
    
  _calculateRetryDelay(attempt) {
    const baseDelay = this.config.retry.delay;
        
    switch (this.config.retry.backoff) {
    case 'exponential':
      return baseDelay * Math.pow(2, attempt - 1);
    case 'linear':
      return baseDelay * attempt;
    default:
      return baseDelay;
    }
  }
    
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    if (!notification.webhook) {
      throw new Error('Webhook name is required');
    }
        
    if (!notification.title && !notification.message) {
      throw new Error('Notification title or message is required');
    }
  }
    
  _validateConfig() {
    if (Object.keys(this.config.webhooks).length === 0) {
      throw new Error('At least one webhook must be configured');
    }
        
    for (const [name, config] of Object.entries(this.config.webhooks)) {
      if (!config.url) {
        throw new Error(`Webhook '${name}' must have a URL`);
      }
            
      try {
        new URL(config.url);
      } catch (error) {
        throw new Error(`Webhook '${name}' has invalid URL: ${config.url}`);
      }
    }
  }
}

export default WebhookProvider;
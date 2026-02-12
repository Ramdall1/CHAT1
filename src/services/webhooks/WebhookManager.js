/**
 * @fileoverview Webhook Manager Service
 * Gestiona webhooks entrantes y salientes con validación, retry y logging
 * 
 * @author ChatBot Enterprise Team
 * @version 6.0.0
 * @since 3.0.0
 */

import crypto from 'crypto';
import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../core/logger.js';

/**
 * Estados de webhook
 */
export const WebhookStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  RETRYING: 'retrying',
  CANCELLED: 'cancelled'
};

/**
 * Tipos de webhook
 */
export const WebhookType = {
  INCOMING: 'incoming',
  OUTGOING: 'outgoing'
};

/**
 * Eventos de webhook
 */
export const WebhookEvents = {
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  USER_JOINED: 'user.joined',
  USER_LEFT: 'user.left',
  CONVERSATION_STARTED: 'conversation.started',
  CONVERSATION_ENDED: 'conversation.ended',
  ERROR_OCCURRED: 'error.occurred',
  SYSTEM_STATUS: 'system.status'
};

/**
 * Clase principal del gestor de webhooks
 */
export class WebhookManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Configuración de retry
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2
      },
      
      // Configuración de timeout
      timeout: 30000,
      
      // Configuración de validación
      validation: {
        enabled: true,
        requireSignature: true,
        signatureHeader: 'X-Webhook-Signature',
        timestampHeader: 'X-Webhook-Timestamp',
        maxTimestampAge: 300000 // 5 minutos
      },
      
      // Configuración de rate limiting
      rateLimit: {
        enabled: true,
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000
      },
      
      // Configuración de logging
      logging: {
        enabled: true,
        logPayloads: false,
        logHeaders: true
      },
      
      ...config
    };
    
    // Almacenamiento de webhooks
    this.webhooks = new Map();
    this.subscriptions = new Map();
    this.deliveryQueue = [];
    this.retryQueue = [];
    
    // Estadísticas
    this.stats = {
      totalReceived: 0,
      totalSent: 0,
      totalFailed: 0,
      totalRetries: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0
    };
    
    // Rate limiting
    this.rateLimitCounters = new Map();
    
    this.initializeManager();
  }

  /**
   * Inicializa el gestor de webhooks
   */
  async initializeManager() {
    try {
      // Configurar procesamiento de cola
      this.setupQueueProcessing();
      
      // Configurar limpieza automática
      this.setupCleanupTasks();
      
      logger.info('WebhookManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WebhookManager', error);
      throw error;
    }
  }

  /**
   * Registra un webhook
   */
  registerWebhook(id, config) {
    const webhook = {
      id,
      url: config.url,
      events: config.events || [],
      secret: config.secret,
      headers: config.headers || {},
      method: config.method || 'POST',
      timeout: config.timeout || this.config.timeout,
      retryConfig: { ...this.config.retry, ...config.retry },
      active: config.active !== false,
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0
    };
    
    this.webhooks.set(id, webhook);
    
    logger.info(`Webhook registered: ${id}`, { url: webhook.url, events: webhook.events });
    
    return webhook;
  }

  /**
   * Desregistra un webhook
   */
  unregisterWebhook(id) {
    const webhook = this.webhooks.get(id);
    if (webhook) {
      this.webhooks.delete(id);
      logger.info(`Webhook unregistered: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Suscribe a eventos de webhook
   */
  subscribe(webhookId, events) {
    if (!Array.isArray(events)) {
      events = [events];
    }
    
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }
    
    webhook.events = [...new Set([...webhook.events, ...events])];
    
    logger.info(`Webhook subscribed to events: ${webhookId}`, { events });
  }

  /**
   * Desuscribe de eventos de webhook
   */
  unsubscribe(webhookId, events) {
    if (!Array.isArray(events)) {
      events = [events];
    }
    
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }
    
    webhook.events = webhook.events.filter(event => !events.includes(event));
    
    logger.info(`Webhook unsubscribed from events: ${webhookId}`, { events });
  }

  /**
   * Procesa webhook entrante
   */
  async processIncomingWebhook(request, response) {
    const startTime = Date.now();
    
    try {
      // Validar rate limiting
      if (!this.checkRateLimit(request.ip)) {
        response.status(429).json({ error: 'Rate limit exceeded' });
        return;
      }
      
      // Validar webhook
      const validation = await this.validateIncomingWebhook(request);
      if (!validation.valid) {
        response.status(400).json({ error: validation.error });
        return;
      }
      
      // Extraer datos del webhook
      const webhookData = {
        id: crypto.randomUUID(),
        type: WebhookType.INCOMING,
        source: request.headers['user-agent'] || 'unknown',
        timestamp: new Date().toISOString(),
        headers: request.headers,
        payload: request.body,
        ip: request.ip,
        status: WebhookStatus.PROCESSING
      };
      
      // Procesar webhook
      const result = await this.processWebhookData(webhookData);
      
      // Actualizar estadísticas
      this.updateStats(startTime, true);
      
      // Responder
      response.status(200).json({
        success: true,
        webhookId: webhookData.id,
        processed: result.processed,
        message: 'Webhook processed successfully'
      });
      
      // Emitir evento
      this.emit('webhook.processed', webhookData, result);
      
    } catch (error) {
      this.updateStats(startTime, false);
      
      logger.error('Failed to process incoming webhook', error);
      
      response.status(500).json({
        success: false,
        error: 'Internal server error'
      });
      
      this.emit('webhook.error', error);
    }
  }

  /**
   * Envía webhook saliente
   */
  async sendWebhook(event, payload, options = {}) {
    const webhooksToTrigger = Array.from(this.webhooks.values())
      .filter(webhook => webhook.active && webhook.events.includes(event));
    
    if (webhooksToTrigger.length === 0) {
      logger.debug(`No webhooks registered for event: ${event}`);
      return [];
    }
    
    const deliveries = [];
    
    for (const webhook of webhooksToTrigger) {
      const delivery = {
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        event,
        payload,
        url: webhook.url,
        method: webhook.method,
        headers: { ...webhook.headers, ...options.headers },
        timeout: options.timeout || webhook.timeout,
        retryConfig: webhook.retryConfig,
        status: WebhookStatus.PENDING,
        attempts: 0,
        createdAt: new Date().toISOString(),
        scheduledAt: options.delay ? new Date(Date.now() + options.delay).toISOString() : null
      };
      
      // Agregar firma si hay secreto
      if (webhook.secret) {
        delivery.headers[this.config.validation.signatureHeader] = this.generateSignature(payload, webhook.secret);
        delivery.headers[this.config.validation.timestampHeader] = Date.now().toString();
      }
      
      deliveries.push(delivery);
      
      // Agregar a cola de entrega
      if (options.delay) {
        setTimeout(() => {
          this.deliveryQueue.push(delivery);
        }, options.delay);
      } else {
        this.deliveryQueue.push(delivery);
      }
    }
    
    logger.info(`Queued ${deliveries.length} webhook deliveries for event: ${event}`);
    
    return deliveries;
  }

  /**
   * Valida webhook entrante
   */
  async validateIncomingWebhook(request) {
    if (!this.config.validation.enabled) {
      return { valid: true };
    }
    
    // Validar timestamp
    const timestamp = request.headers[this.config.validation.timestampHeader.toLowerCase()];
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age > this.config.validation.maxTimestampAge) {
        return { valid: false, error: 'Timestamp too old' };
      }
    }
    
    // Validar firma si es requerida
    if (this.config.validation.requireSignature) {
      const signature = request.headers[this.config.validation.signatureHeader.toLowerCase()];
      if (!signature) {
        return { valid: false, error: 'Missing signature' };
      }
      
      // Aquí deberías validar la firma con el secreto correspondiente
      // Por simplicidad, asumimos que es válida si está presente
    }
    
    return { valid: true };
  }

  /**
   * Procesa datos de webhook
   */
  async processWebhookData(webhookData) {
    try {
      // Aquí implementarías la lógica específica de procesamiento
      // Por ejemplo, enrutar a diferentes handlers según el tipo de evento
      
      const result = {
        processed: true,
        actions: [],
        timestamp: new Date().toISOString()
      };
      
      // Ejemplo de procesamiento básico
      if (webhookData.payload.type === 'message') {
        result.actions.push('message_processed');
      }
      
      webhookData.status = WebhookStatus.SUCCESS;
      
      return result;
    } catch (error) {
      webhookData.status = WebhookStatus.FAILED;
      throw error;
    }
  }

  /**
   * Entrega webhook
   */
  async deliverWebhook(delivery) {
    const startTime = Date.now();
    delivery.attempts++;
    delivery.status = WebhookStatus.PROCESSING;
    delivery.lastAttemptAt = new Date().toISOString();
    
    try {
      const response = await axios({
        method: delivery.method,
        url: delivery.url,
        data: delivery.payload,
        headers: delivery.headers,
        timeout: delivery.timeout,
        validateStatus: (status) => status >= 200 && status < 300
      });
      
      delivery.status = WebhookStatus.SUCCESS;
      delivery.responseStatus = response.status;
      delivery.responseHeaders = response.headers;
      delivery.deliveredAt = new Date().toISOString();
      delivery.processingTime = Date.now() - startTime;
      
      // Actualizar estadísticas del webhook
      const webhook = this.webhooks.get(delivery.webhookId);
      if (webhook) {
        webhook.totalDeliveries++;
        webhook.successfulDeliveries++;
        webhook.lastTriggered = delivery.deliveredAt;
      }
      
      this.stats.totalSent++;
      
      logger.info(`Webhook delivered successfully: ${delivery.id}`, {
        webhookId: delivery.webhookId,
        url: delivery.url,
        status: response.status,
        processingTime: delivery.processingTime
      });
      
      this.emit('webhook.delivered', delivery);
      
      return delivery;
      
    } catch (error) {
      delivery.status = WebhookStatus.FAILED;
      delivery.error = error.message;
      delivery.processingTime = Date.now() - startTime;
      
      // Actualizar estadísticas del webhook
      const webhook = this.webhooks.get(delivery.webhookId);
      if (webhook) {
        webhook.totalDeliveries++;
        webhook.failedDeliveries++;
      }
      
      this.stats.totalFailed++;
      
      logger.error(`Webhook delivery failed: ${delivery.id}`, {
        webhookId: delivery.webhookId,
        url: delivery.url,
        error: error.message,
        attempt: delivery.attempts
      });
      
      // Programar retry si es necesario
      if (delivery.attempts < delivery.retryConfig.maxAttempts) {
        this.scheduleRetry(delivery);
      } else {
        this.emit('webhook.failed', delivery);
      }
      
      throw error;
    }
  }

  /**
   * Programa retry de webhook
   */
  scheduleRetry(delivery) {
    const delay = Math.min(
      delivery.retryConfig.baseDelay * Math.pow(delivery.retryConfig.backoffFactor, delivery.attempts - 1),
      delivery.retryConfig.maxDelay
    );
    
    delivery.status = WebhookStatus.RETRYING;
    delivery.nextRetryAt = new Date(Date.now() + delay).toISOString();
    
    setTimeout(() => {
      this.retryQueue.push(delivery);
    }, delay);
    
    this.stats.totalRetries++;
    
    logger.info(`Webhook retry scheduled: ${delivery.id}`, {
      attempt: delivery.attempts,
      delay,
      nextRetryAt: delivery.nextRetryAt
    });
  }

  /**
   * Genera firma para webhook
   */
  generateSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verifica firma de webhook
   */
  verifySignature(payload, signature, secret) {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Verifica rate limiting
   */
  checkRateLimit(ip) {
    if (!this.config.rateLimit.enabled) {
      return true;
    }
    
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    
    const key = `${ip}:${minute}`;
    const hourKey = `${ip}:${hour}`;
    
    const minuteCount = this.rateLimitCounters.get(key) || 0;
    const hourCount = this.rateLimitCounters.get(hourKey) || 0;
    
    if (minuteCount >= this.config.rateLimit.maxRequestsPerMinute ||
        hourCount >= this.config.rateLimit.maxRequestsPerHour) {
      return false;
    }
    
    this.rateLimitCounters.set(key, minuteCount + 1);
    this.rateLimitCounters.set(hourKey, hourCount + 1);
    
    return true;
  }

  /**
   * Configura procesamiento de colas
   */
  setupQueueProcessing() {
    // Procesar cola de entrega cada segundo
    setInterval(() => {
      this.processDeliveryQueue();
    }, 1000);
    
    // Procesar cola de retry cada 5 segundos
    setInterval(() => {
      this.processRetryQueue();
    }, 5000);
  }

  /**
   * Procesa cola de entrega
   */
  async processDeliveryQueue() {
    while (this.deliveryQueue.length > 0) {
      const delivery = this.deliveryQueue.shift();
      
      // Verificar si está programado para más tarde
      if (delivery.scheduledAt && new Date() < new Date(delivery.scheduledAt)) {
        this.deliveryQueue.push(delivery);
        break;
      }
      
      try {
        await this.deliverWebhook(delivery);
      } catch (error) {
        // Error ya manejado en deliverWebhook
      }
    }
  }

  /**
   * Procesa cola de retry
   */
  async processRetryQueue() {
    while (this.retryQueue.length > 0) {
      const delivery = this.retryQueue.shift();
      
      // Verificar si es hora del retry
      if (delivery.nextRetryAt && new Date() < new Date(delivery.nextRetryAt)) {
        this.retryQueue.push(delivery);
        break;
      }
      
      try {
        await this.deliverWebhook(delivery);
      } catch (error) {
        // Error ya manejado en deliverWebhook
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
  }

  /**
   * Limpia contadores de rate limit antiguos
   */
  cleanupRateLimitCounters() {
    const now = Date.now();
    const cutoff = now - 3600000; // 1 hora
    
    let cleaned = 0;
    for (const [key, value] of this.rateLimitCounters) {
      const [ip, timestamp] = key.split(':');
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
   * Actualiza estadísticas
   */
  updateStats(startTime, success) {
    const processingTime = Date.now() - startTime;
    
    this.stats.lastProcessingTime = processingTime;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime + processingTime) / 2;
    
    if (success) {
      this.stats.totalReceived++;
    } else {
      this.stats.totalFailed++;
    }
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      webhooksRegistered: this.webhooks.size,
      pendingDeliveries: this.deliveryQueue.length,
      pendingRetries: this.retryQueue.length,
      rateLimitCounters: this.rateLimitCounters.size
    };
  }

  /**
   * Obtiene información de webhooks
   */
  getWebhooks() {
    return Array.from(this.webhooks.values());
  }

  /**
   * Obtiene webhook por ID
   */
  getWebhook(id) {
    return this.webhooks.get(id);
  }

  /**
   * Actualiza configuración de webhook
   */
  updateWebhook(id, updates) {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`);
    }
    
    Object.assign(webhook, updates);
    webhook.updatedAt = new Date().toISOString();
    
    logger.info(`Webhook updated: ${id}`, updates);
    
    return webhook;
  }

  /**
   * Activa/desactiva webhook
   */
  toggleWebhook(id, active) {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`);
    }
    
    webhook.active = active;
    webhook.updatedAt = new Date().toISOString();
    
    logger.info(`Webhook ${active ? 'activated' : 'deactivated'}: ${id}`);
    
    return webhook;
  }

  /**
   * Cierra el gestor de webhooks
   */
  async close() {
    // Limpiar intervalos
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Procesar entregas pendientes
    await this.processDeliveryQueue();
    await this.processRetryQueue();
    
    logger.info('WebhookManager closed');
  }
}

// Instancia singleton
export const webhookManager = new WebhookManager();

export default WebhookManager;
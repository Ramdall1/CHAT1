import { EventEmitter } from 'events';
import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/**
 * Gestor de webhooks para manejar webhooks entrantes y salientes
 * Incluye validación, autenticación, procesamiento de eventos y delivery
 */
class WebhookManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración general
      enabled: config.enabled !== false,
      maxWebhooks: config.maxWebhooks || 1000,
            
      // Configuración del servidor
      server: {
        enabled: config.server?.enabled !== false,
        port: config.server?.port || 3001,
        host: config.server?.host || '0.0.0.0',
        basePath: config.server?.basePath || '/webhooks',
        maxPayloadSize: config.server?.maxPayloadSize || '10mb',
        timeout: config.server?.timeout || 30000,
        cors: config.server?.cors !== false,
        helmet: config.server?.helmet !== false
      },
            
      // Configuración de seguridad
      security: {
        enabled: config.security?.enabled !== false,
        requireSignature: config.security?.requireSignature !== false,
        algorithms: config.security?.algorithms || ['sha256', 'sha1'],
        headerName: config.security?.headerName || 'X-Webhook-Signature',
        timestampHeader: config.security?.timestampHeader || 'X-Webhook-Timestamp',
        timestampTolerance: config.security?.timestampTolerance || 300000, // 5 minutos
        ipWhitelist: config.security?.ipWhitelist || [],
        userAgentWhitelist: config.security?.userAgentWhitelist || []
      },
            
      // Configuración de delivery (webhooks salientes)
      delivery: {
        enabled: config.delivery?.enabled !== false,
        timeout: config.delivery?.timeout || 30000,
        retries: config.delivery?.retries || 3,
        retryDelay: config.delivery?.retryDelay || 1000,
        retryBackoff: config.delivery?.retryBackoff || 2,
        maxRetryDelay: config.delivery?.maxRetryDelay || 30000,
        batchSize: config.delivery?.batchSize || 10,
        concurrency: config.delivery?.concurrency || 5
      },
            
      // Configuración de eventos
      events: {
        enabled: config.events?.enabled !== false,
        maxHistory: config.events?.maxHistory || 10000,
        retention: config.events?.retention || 86400000, // 24 horas
        compression: config.events?.compression !== false
      },
            
      // Configuración de filtros
      filters: {
        enabled: config.filters?.enabled !== false,
        maxFilters: config.filters?.maxFilters || 100,
        allowedOperators: config.filters?.allowedOperators || ['eq', 'ne', 'gt', 'lt', 'in', 'contains', 'regex']
      },
            
      // Configuración de transformación
      transform: {
        enabled: config.transform?.enabled !== false,
        maxTransformers: config.transform?.maxTransformers || 50,
        timeout: config.transform?.timeout || 5000
      },
            
      // Configuración de rate limiting
      rateLimit: {
        enabled: config.rateLimit?.enabled !== false,
        windowMs: config.rateLimit?.windowMs || 60000, // 1 minuto
        maxRequests: config.rateLimit?.maxRequests || 100,
        skipSuccessfulRequests: config.rateLimit?.skipSuccessfulRequests !== false
      },
            
      // Configuración de logging
      logging: {
        enabled: config.logging?.enabled !== false,
        level: config.logging?.level || 'info',
        includePayload: config.logging?.includePayload !== false,
        maxPayloadSize: config.logging?.maxPayloadSize || 1024,
        maxLogs: config.logging?.maxLogs || 10000
      },
            
      // Configuración de métricas
      metrics: {
        enabled: config.metrics?.enabled !== false,
        retention: config.metrics?.retention || 86400000, // 24 horas
        aggregation: config.metrics?.aggregation !== false
      }
    };
        
    // Estado interno
    this.webhooks = new Map(); // Webhooks registrados
    this.endpoints = new Map(); // Endpoints activos
    this.events = []; // Historial de eventos
    this.deliveryQueue = []; // Cola de delivery
    this.rateLimiters = new Map(); // Rate limiters por IP
    this.logs = [];
    this.metrics = {
      totalReceived: 0,
      totalDelivered: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      receivedByEndpoint: new Map(),
      deliveredByWebhook: new Map(),
      errorsByType: new Map()
    };
        
    // Componentes
    this.server = null;
    this.app = null;
        
    // Timers
    this.cleanupTimer = null;
    this.deliveryTimer = null;
    this.metricsTimer = null;
        
    this.initialized = false;
  }
    
  /**
     * Inicializa el gestor de webhooks
     */
  async initialize() {
    if (this.initialized) return;
        
    try {
      this._validateConfig();
            
      if (this.config.server.enabled) {
        await this._setupServer();
      }
            
      this._setupTimers();
      this._setupEventHandlers();
            
      this.initialized = true;
      this.emit('initialized');
            
      this._log('info', 'WebhookManager initialized successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Registra un nuevo webhook
     */
  async registerWebhook(webhookConfig) {
    if (!this.initialized) {
      throw new Error('WebhookManager not initialized');
    }
        
    if (this.webhooks.size >= this.config.maxWebhooks) {
      throw new Error('Maximum number of webhooks reached');
    }
        
    const webhook = {
      id: webhookConfig.id || uuidv4(),
      name: webhookConfig.name || 'Unnamed Webhook',
      url: webhookConfig.url,
      method: webhookConfig.method || 'POST',
      description: webhookConfig.description || '',
            
      // Configuración de eventos
      events: webhookConfig.events || ['*'], // Eventos a los que se suscribe
            
      // Configuración de headers
      headers: webhookConfig.headers || {},
            
      // Configuración de autenticación
      auth: {
        type: webhookConfig.auth?.type || 'none', // none, bearer, basic, signature
        secret: webhookConfig.auth?.secret || null,
        algorithm: webhookConfig.auth?.algorithm || 'sha256',
        header: webhookConfig.auth?.header || 'Authorization'
      },
            
      // Configuración de filtros
      filters: webhookConfig.filters || [],
            
      // Configuración de transformación
      transformers: webhookConfig.transformers || [],
            
      // Configuración de delivery
      delivery: {
        timeout: webhookConfig.delivery?.timeout || this.config.delivery.timeout,
        retries: webhookConfig.delivery?.retries || this.config.delivery.retries,
        retryDelay: webhookConfig.delivery?.retryDelay || this.config.delivery.retryDelay
      },
            
      // Configuración de rate limiting
      rateLimit: {
        enabled: webhookConfig.rateLimit?.enabled !== false,
        requests: webhookConfig.rateLimit?.requests || 999999, // Rate limiting desactivado
        window: webhookConfig.rateLimit?.window || 60000
      },
            
      // Metadatos
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: webhookConfig.metadata?.tags || [],
        category: webhookConfig.metadata?.category || 'general'
      },
            
      // Estado
      status: 'active',
      lastDelivery: null,
      lastSuccess: null,
      lastFailure: null,
            
      // Estadísticas
      stats: {
        deliveries: 0,
        successes: 0,
        failures: 0,
        averageResponseTime: 0,
        totalResponseTime: 0
      }
    };
        
    // Validar configuración
    this._validateWebhookConfig(webhook);
        
    this.webhooks.set(webhook.id, webhook);
    this.emit('webhookRegistered', webhook);
        
    this._log('info', `Webhook registered: ${webhook.name} (${webhook.id})`);
        
    return webhook;
  }
    
  /**
     * Registra un endpoint para recibir webhooks
     */
  async registerEndpoint(endpointConfig) {
    if (!this.initialized) {
      throw new Error('WebhookManager not initialized');
    }
        
    const endpoint = {
      id: endpointConfig.id || uuidv4(),
      path: endpointConfig.path,
      method: endpointConfig.method || 'POST',
      name: endpointConfig.name || 'Unnamed Endpoint',
      description: endpointConfig.description || '',
            
      // Configuración de seguridad
      security: {
        requireSignature: endpointConfig.security?.requireSignature !== false,
        secret: endpointConfig.security?.secret || null,
        algorithm: endpointConfig.security?.algorithm || 'sha256',
        headerName: endpointConfig.security?.headerName || this.config.security.headerName,
        ipWhitelist: endpointConfig.security?.ipWhitelist || [],
        userAgentWhitelist: endpointConfig.security?.userAgentWhitelist || []
      },
            
      // Configuración de procesamiento
      processing: {
        async: endpointConfig.processing?.async !== false,
        timeout: endpointConfig.processing?.timeout || 30000,
        maxPayloadSize: endpointConfig.processing?.maxPayloadSize || this.config.server.maxPayloadSize
      },
            
      // Configuración de validación
      validation: {
        enabled: endpointConfig.validation?.enabled !== false,
        schema: endpointConfig.validation?.schema || null,
        strict: endpointConfig.validation?.strict !== false
      },
            
      // Configuración de transformación
      transformers: endpointConfig.transformers || [],
            
      // Configuración de rate limiting
      rateLimit: {
        enabled: endpointConfig.rateLimit?.enabled !== false,
        requests: endpointConfig.rateLimit?.requests || this.config.rateLimit.maxRequests,
        window: endpointConfig.rateLimit?.window || this.config.rateLimit.windowMs
      },
            
      // Handler personalizado
      handler: endpointConfig.handler || null,
            
      // Metadatos
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: endpointConfig.metadata?.tags || []
      },
            
      // Estado
      status: 'active',
            
      // Estadísticas
      stats: {
        requests: 0,
        successes: 0,
        failures: 0,
        averageProcessingTime: 0,
        totalProcessingTime: 0,
        lastRequest: null
      }
    };
        
    // Validar configuración
    this._validateEndpointConfig(endpoint);
        
    // Registrar ruta en Express
    if (this.app) {
      this._registerRoute(endpoint);
    }
        
    this.endpoints.set(endpoint.id, endpoint);
    this.emit('endpointRegistered', endpoint);
        
    this._log('info', `Endpoint registered: ${endpoint.path} (${endpoint.id})`);
        
    return endpoint;
  }
    
  /**
     * Envía un evento a todos los webhooks suscritos
     */
  async sendEvent(eventType, payload, options = {}) {
    if (!this.initialized) {
      throw new Error('WebhookManager not initialized');
    }
        
    const event = {
      id: uuidv4(),
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
      source: options.source || 'system',
      metadata: options.metadata || {}
    };
        
    // Agregar al historial
    this._addEvent(event);
        
    // Obtener webhooks suscritos
    const subscribedWebhooks = this._getSubscribedWebhooks(eventType);
        
    if (subscribedWebhooks.length === 0) {
      this._log('debug', `No webhooks subscribed to event: ${eventType}`);
      return { event, deliveries: [] };
    }
        
    const deliveries = [];
        
    // Procesar cada webhook
    for (const webhook of subscribedWebhooks) {
      try {
        // Aplicar filtros
        if (!this._passesFilters(event, webhook.filters)) {
          continue;
        }
                
        // Crear delivery
        const delivery = {
          id: uuidv4(),
          webhookId: webhook.id,
          eventId: event.id,
          event,
          webhook,
          status: 'pending',
          attempts: 0,
          maxAttempts: webhook.delivery.retries + 1,
          nextAttempt: Date.now(),
          createdAt: new Date().toISOString()
        };
                
        deliveries.push(delivery);
                
        // Agregar a la cola de delivery
        this.deliveryQueue.push(delivery);
                
      } catch (error) {
        this._log('error', `Error preparing delivery for webhook ${webhook.id}: ${error.message}`);
      }
    }
        
    // Procesar cola de delivery
    this._processDeliveryQueue();
        
    this.emit('eventSent', event, deliveries);
        
    return { event, deliveries };
  }
    
  /**
     * Procesa la cola de delivery
     */
  async _processDeliveryQueue() {
    if (this.deliveryQueue.length === 0) return;
        
    const now = Date.now();
    const readyDeliveries = this.deliveryQueue.filter(delivery => 
      delivery.status === 'pending' && delivery.nextAttempt <= now
    );
        
    if (readyDeliveries.length === 0) return;
        
    // Procesar en lotes
    const batches = this._chunkArray(readyDeliveries, this.config.delivery.batchSize);
        
    for (const batch of batches) {
      const promises = batch.map(delivery => this._deliverWebhook(delivery));
      await Promise.allSettled(promises);
    }
  }
    
  /**
     * Entrega un webhook
     */
  async _deliverWebhook(delivery) {
    const { webhook, event } = delivery;
    const startTime = Date.now();
        
    try {
      delivery.attempts++;
      delivery.status = 'delivering';
            
      // Preparar payload
      let payload = event.payload;
            
      // Aplicar transformadores
      if (webhook.transformers.length > 0) {
        payload = await this._applyTransformers(payload, webhook.transformers);
      }
            
      // Preparar headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookManager/1.0',
        'X-Event-Type': event.type,
        'X-Event-ID': event.id,
        'X-Delivery-ID': delivery.id,
        'X-Timestamp': event.timestamp,
        ...webhook.headers
      };
            
      // Agregar autenticación
      this._addAuthentication(headers, webhook, payload);
            
      // Realizar petición
      const response = await axios({
        method: webhook.method,
        url: webhook.url,
        data: payload,
        headers,
        timeout: webhook.delivery.timeout,
        validateStatus: (status) => status < 500 // 4xx no son errores de delivery
      });
            
      const responseTime = Date.now() - startTime;
            
      // Actualizar delivery
      delivery.status = 'delivered';
      delivery.response = {
        status: response.status,
        headers: response.headers,
        data: response.data
      };
      delivery.deliveredAt = new Date().toISOString();
      delivery.responseTime = responseTime;
            
      // Actualizar estadísticas
      this._updateWebhookStats(webhook, true, responseTime);
      this.metrics.totalDelivered++;
            
      // Remover de la cola
      this._removeFromDeliveryQueue(delivery.id);
            
      this.emit('webhookDelivered', delivery);
      this._log('debug', `Webhook delivered: ${webhook.name} (${delivery.id}) - ${responseTime}ms`);
            
    } catch (error) {
      const responseTime = Date.now() - startTime;
            
      delivery.error = error.message;
      delivery.responseTime = responseTime;
            
      // Verificar si debe reintentar
      if (delivery.attempts < delivery.maxAttempts && this._isRetryableError(error)) {
        delivery.status = 'pending';
        delivery.nextAttempt = Date.now() + this._calculateRetryDelay(delivery.attempts, webhook.delivery);
                
        this._log('debug', `Webhook delivery failed, retrying: ${webhook.name} (${delivery.id}) - attempt ${delivery.attempts}/${delivery.maxAttempts}`);
      } else {
        delivery.status = 'failed';
        delivery.failedAt = new Date().toISOString();
                
        // Remover de la cola
        this._removeFromDeliveryQueue(delivery.id);
                
        this.metrics.totalFailed++;
        this._updateWebhookStats(webhook, false, responseTime);
                
        this.emit('webhookFailed', delivery);
        this._log('error', `Webhook delivery failed permanently: ${webhook.name} (${delivery.id}) - ${error.message}`);
      }
    }
  }
    
  /**
     * Verifica si un error es reintentable
     */
  _isRetryableError(error) {
    // Errores de red son reintentables
    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return true;
    }
        
    // Errores 5xx son reintentables
    if (error.response && error.response.status >= 500) {
      return true;
    }
        
    // Error 429 (rate limit) es reintentable
    if (error.response && error.response.status === 429) {
      return true;
    }
        
    return false;
  }
    
  /**
     * Calcula delay para reintentos
     */
  _calculateRetryDelay(attempt, deliveryConfig) {
    const baseDelay = deliveryConfig.retryDelay;
    const backoff = deliveryConfig.retryBackoff || this.config.delivery.retryBackoff;
    const maxDelay = this.config.delivery.maxRetryDelay;
        
    const delay = baseDelay * Math.pow(backoff, attempt - 1);
    return Math.min(delay, maxDelay);
  }
    
  /**
     * Obtiene webhooks suscritos a un evento
     */
  _getSubscribedWebhooks(eventType) {
    return Array.from(this.webhooks.values()).filter(webhook => {
      if (webhook.status !== 'active') return false;
            
      // Verificar suscripción
      return webhook.events.includes('*') || webhook.events.includes(eventType);
    });
  }
    
  /**
     * Verifica si un evento pasa los filtros
     */
  _passesFilters(event, filters) {
    if (!filters || filters.length === 0) return true;
        
    for (const filter of filters) {
      if (!this._evaluateFilter(event, filter)) {
        return false;
      }
    }
        
    return true;
  }
    
  /**
     * Evalúa un filtro
     */
  _evaluateFilter(event, filter) {
    const { field, operator, value } = filter;
    const fieldValue = this._getNestedValue(event, field);
        
    switch (operator) {
    case 'eq':
      return fieldValue === value;
    case 'ne':
      return fieldValue !== value;
    case 'gt':
      return fieldValue > value;
    case 'lt':
      return fieldValue < value;
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(value);
    case 'regex':
      return new RegExp(value).test(fieldValue);
    default:
      return true;
    }
  }
    
  /**
     * Obtiene valor anidado de un objeto
     */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
    
  /**
     * Aplica transformadores
     */
  async _applyTransformers(payload, transformers) {
    let transformedPayload = payload;
        
    for (const transformer of transformers) {
      if (typeof transformer === 'function') {
        transformedPayload = await transformer(transformedPayload);
      } else if (transformer.type === 'jq' && transformer.expression) {
        // Implementación básica de transformación JQ
        // En producción usar librería jq
        transformedPayload = this._applyJQTransform(transformedPayload, transformer.expression);
      }
    }
        
    return transformedPayload;
  }
    
  /**
     * Aplica transformación JQ básica
     */
  _applyJQTransform(payload, expression) {
    // Implementación muy básica - en producción usar node-jq
    try {
      if (expression === '.') return payload;
            
      // Transformaciones simples
      if (expression.startsWith('.')) {
        const path = expression.slice(1);
        return this._getNestedValue(payload, path);
      }
            
      return payload;
    } catch (error) {
      this._log('error', `JQ transform error: ${error.message}`);
      return payload;
    }
  }
    
  /**
     * Agrega autenticación a headers
     */
  _addAuthentication(headers, webhook, payload) {
    const { auth } = webhook;
        
    switch (auth.type) {
    case 'bearer':
      if (auth.secret) {
        headers[auth.header] = `Bearer ${auth.secret}`;
      }
      break;
                
    case 'basic':
      if (auth.username && auth.password) {
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers[auth.header] = `Basic ${credentials}`;
      }
      break;
                
    case 'signature':
      if (auth.secret) {
        const signature = this._generateSignature(payload, auth.secret, auth.algorithm);
        headers[this.config.security.headerName] = `${auth.algorithm}=${signature}`;
      }
      break;
    }
  }
    
  /**
     * Genera firma para webhook
     */
  _generateSignature(payload, secret, algorithm = 'sha256') {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
  }
    
  /**
     * Configura servidor Express
     */
  async _setupServer() {
    this.app = express();
        
    // Middleware de seguridad
    if (this.config.server.helmet) {
      this.app.use(helmet());
    }
        
    if (this.config.server.cors) {
      this.app.use(cors());
    }
        
    // Rate limiting
    if (this.config.rateLimit.enabled) {
      const limiter = rateLimit({
        windowMs: this.config.rateLimit.windowMs,
        max: this.config.rateLimit.maxRequests,
        skip: (req) => {
          return this.config.rateLimit.skipSuccessfulRequests && req.statusCode < 400;
        }
      });
            
      this.app.use(this.config.server.basePath, limiter);
    }
        
    // Middleware de parsing
    this.app.use(express.json({ 
      limit: this.config.server.maxPayloadSize,
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
        
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: this.config.server.maxPayloadSize 
    }));
        
    // Middleware de logging
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      next();
    });
        
    // Registrar endpoints existentes
    for (const endpoint of this.endpoints.values()) {
      this._registerRoute(endpoint);
    }
        
    // Ruta de health check
    this.app.get(`${this.config.server.basePath}/health`, (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        webhooks: this.webhooks.size,
        endpoints: this.endpoints.size
      });
    });
        
    // Iniciar servidor
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.server.port, this.config.server.host, (error) => {
        if (error) {
          reject(error);
        } else {
          this._log('info', `Webhook server listening on ${this.config.server.host}:${this.config.server.port}`);
          resolve();
        }
      });
    });
  }
    
  /**
     * Registra una ruta en Express
     */
  _registerRoute(endpoint) {
    const fullPath = `${this.config.server.basePath}${endpoint.path}`;
        
    this.app[endpoint.method.toLowerCase()](fullPath, async(req, res) => {
      const startTime = Date.now();
            
      try {
        // Verificar estado del endpoint
        if (endpoint.status !== 'active') {
          return res.status(503).json({ error: 'Endpoint not active' });
        }
                
        // Verificar seguridad
        if (endpoint.security.requireSignature) {
          const isValid = this._verifySignature(req, endpoint.security);
          if (!isValid) {
            return res.status(401).json({ error: 'Invalid signature' });
          }
        }
                
        // Verificar IP whitelist
        if (endpoint.security.ipWhitelist.length > 0) {
          const clientIP = req.ip || req.connection.remoteAddress;
          if (!endpoint.security.ipWhitelist.includes(clientIP)) {
            return res.status(403).json({ error: 'IP not allowed' });
          }
        }
                
        // Verificar User-Agent whitelist
        if (endpoint.security.userAgentWhitelist.length > 0) {
          const userAgent = req.get('User-Agent');
          if (!endpoint.security.userAgentWhitelist.some(ua => userAgent?.includes(ua))) {
            return res.status(403).json({ error: 'User-Agent not allowed' });
          }
        }
                
        // Validar payload
        if (endpoint.validation.enabled && endpoint.validation.schema) {
          const isValid = this._validatePayload(req.body, endpoint.validation.schema);
          if (!isValid) {
            return res.status(400).json({ error: 'Invalid payload' });
          }
        }
                
        // Aplicar transformadores
        let payload = req.body;
        if (endpoint.transformers.length > 0) {
          payload = await this._applyTransformers(payload, endpoint.transformers);
        }
                
        // Crear evento
        const event = {
          id: uuidv4(),
          type: 'webhook.received',
          payload,
          timestamp: new Date().toISOString(),
          source: endpoint.name,
          metadata: {
            endpointId: endpoint.id,
            method: req.method,
            path: req.path,
            headers: req.headers,
            ip: req.ip || req.connection.remoteAddress
          }
        };
                
        // Agregar al historial
        this._addEvent(event);
                
        // Actualizar estadísticas
        endpoint.stats.requests++;
        endpoint.stats.lastRequest = new Date().toISOString();
                
        // Procesar con handler personalizado o emitir evento
        let result;
        if (endpoint.handler && typeof endpoint.handler === 'function') {
          if (endpoint.processing.async) {
            // Procesamiento asíncrono
            setImmediate(() => {
              endpoint.handler(event, req, res).catch(error => {
                this._log('error', `Endpoint handler error: ${error.message}`);
              });
            });
            result = { received: true, eventId: event.id };
          } else {
            // Procesamiento síncrono
            result = await endpoint.handler(event, req, res);
          }
        } else {
          // Emitir evento por defecto
          this.emit('webhookReceived', event, endpoint);
          result = { received: true, eventId: event.id };
        }
                
        const processingTime = Date.now() - startTime;
                
        // Actualizar estadísticas
        endpoint.stats.successes++;
        this._updateEndpointStats(endpoint, true, processingTime);
        this.metrics.totalReceived++;
                
        this.emit('endpointProcessed', endpoint, event, result);
                
        res.json(result);
                
      } catch (error) {
        const processingTime = Date.now() - startTime;
                
        endpoint.stats.failures++;
        this._updateEndpointStats(endpoint, false, processingTime);
                
        this.emit('endpointError', endpoint, error);
        this._log('error', `Endpoint error: ${endpoint.path} - ${error.message}`);
                
        res.status(500).json({ error: 'Internal server error' });
      }
    });
        
    this._log('debug', `Route registered: ${endpoint.method} ${fullPath}`);
  }
    
  /**
     * Verifica firma de webhook
     */
  _verifySignature(req, security) {
    const signature = req.get(security.headerName);
    if (!signature) return false;
        
    const timestamp = req.get(this.config.security.timestampHeader);
    if (timestamp) {
      const requestTime = parseInt(timestamp) * 1000;
      const now = Date.now();
            
      if (Math.abs(now - requestTime) > this.config.security.timestampTolerance) {
        return false;
      }
    }
        
    const payload = req.rawBody || JSON.stringify(req.body);
    const expectedSignature = this._generateSignature(payload, security.secret, security.algorithm);
        
    // Extraer algoritmo y firma
    const [algorithm, receivedSignature] = signature.split('=');
        
    if (algorithm !== security.algorithm) return false;
        
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  }
    
  /**
     * Valida payload
     */
  _validatePayload(payload, schema) {
    // Implementación básica - en producción usar joi, ajv, etc.
    if (!schema) return true;
        
    try {
      // Validación simple por tipo
      if (schema.type && typeof payload !== schema.type) {
        return false;
      }
            
      return true;
    } catch (error) {
      return false;
    }
  }
    
  /**
     * Actualiza estadísticas de webhook
     */
  _updateWebhookStats(webhook, success, responseTime) {
    webhook.stats.deliveries++;
        
    if (success) {
      webhook.stats.successes++;
      webhook.lastSuccess = new Date().toISOString();
    } else {
      webhook.stats.failures++;
      webhook.lastFailure = new Date().toISOString();
    }
        
    webhook.lastDelivery = new Date().toISOString();
        
    // Calcular tiempo promedio de respuesta
    webhook.stats.totalResponseTime += responseTime;
    webhook.stats.averageResponseTime = webhook.stats.totalResponseTime / webhook.stats.deliveries;
  }
    
  /**
     * Actualiza estadísticas de endpoint
     */
  _updateEndpointStats(endpoint, success, processingTime) {
    if (success) {
      endpoint.stats.successes++;
    } else {
      endpoint.stats.failures++;
    }
        
    // Calcular tiempo promedio de procesamiento
    endpoint.stats.totalProcessingTime += processingTime;
    endpoint.stats.averageProcessingTime = endpoint.stats.totalProcessingTime / endpoint.stats.requests;
  }
    
  /**
     * Agrega evento al historial
     */
  _addEvent(event) {
    this.events.push(event);
        
    // Mantener límite de eventos
    if (this.events.length > this.config.events.maxHistory) {
      this.events.shift();
    }
        
    this.emit('eventAdded', event);
  }
    
  /**
     * Remueve delivery de la cola
     */
  _removeFromDeliveryQueue(deliveryId) {
    const index = this.deliveryQueue.findIndex(d => d.id === deliveryId);
    if (index !== -1) {
      this.deliveryQueue.splice(index, 1);
    }
  }
    
  /**
     * Divide array en chunks
     */
  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
    
  /**
     * Obtiene un webhook por ID
     */
  getWebhook(webhookId) {
    return this.webhooks.get(webhookId);
  }
    
  /**
     * Lista todos los webhooks
     */
  listWebhooks(filter = {}) {
    let webhooks = Array.from(this.webhooks.values());
        
    if (filter.status) {
      webhooks = webhooks.filter(webhook => webhook.status === filter.status);
    }
        
    if (filter.events) {
      webhooks = webhooks.filter(webhook => 
        filter.events.some(event => webhook.events.includes(event) || webhook.events.includes('*'))
      );
    }
        
    return webhooks;
  }
    
  /**
     * Obtiene un endpoint por ID
     */
  getEndpoint(endpointId) {
    return this.endpoints.get(endpointId);
  }
    
  /**
     * Lista todos los endpoints
     */
  listEndpoints(filter = {}) {
    let endpoints = Array.from(this.endpoints.values());
        
    if (filter.status) {
      endpoints = endpoints.filter(endpoint => endpoint.status === filter.status);
    }
        
    return endpoints;
  }
    
  /**
     * Actualiza un webhook
     */
  async updateWebhook(webhookId, updates) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }
        
    const allowedUpdates = [
      'name', 'url', 'method', 'description', 'events', 'headers',
      'auth', 'filters', 'transformers', 'delivery', 'rateLimit'
    ];
        
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (typeof webhook[field] === 'object' && !Array.isArray(webhook[field])) {
          Object.assign(webhook[field], updates[field]);
        } else {
          webhook[field] = updates[field];
        }
      }
    });
        
    webhook.metadata.updatedAt = new Date().toISOString();
        
    this.emit('webhookUpdated', webhook);
        
    return webhook;
  }
    
  /**
     * Actualiza un endpoint
     */
  async updateEndpoint(endpointId, updates) {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`);
    }
        
    const allowedUpdates = [
      'name', 'description', 'security', 'processing', 'validation',
      'transformers', 'rateLimit', 'handler'
    ];
        
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (typeof endpoint[field] === 'object' && !Array.isArray(endpoint[field])) {
          Object.assign(endpoint[field], updates[field]);
        } else {
          endpoint[field] = updates[field];
        }
      }
    });
        
    endpoint.metadata.updatedAt = new Date().toISOString();
        
    this.emit('endpointUpdated', endpoint);
        
    return endpoint;
  }
    
  /**
     * Elimina un webhook
     */
  async deleteWebhook(webhookId) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }
        
    // Remover deliveries pendientes
    this.deliveryQueue = this.deliveryQueue.filter(d => d.webhookId !== webhookId);
        
    this.webhooks.delete(webhookId);
    this.emit('webhookDeleted', webhook);
        
    return true;
  }
    
  /**
     * Elimina un endpoint
     */
  async deleteEndpoint(endpointId) {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`);
    }
        
    this.endpoints.delete(endpointId);
    this.emit('endpointDeleted', endpoint);
        
    return true;
  }
    
  /**
     * Obtiene estadísticas
     */
  getStats() {
    const webhookStats = {};
    const endpointStats = {};
        
    for (const [id, webhook] of this.webhooks) {
      webhookStats[id] = {
        name: webhook.name,
        status: webhook.status,
        stats: webhook.stats
      };
    }
        
    for (const [id, endpoint] of this.endpoints) {
      endpointStats[id] = {
        name: endpoint.name,
        path: endpoint.path,
        status: endpoint.status,
        stats: endpoint.stats
      };
    }
        
    return {
      ...this.metrics,
      webhooks: webhookStats,
      endpoints: endpointStats,
      queue: {
        pending: this.deliveryQueue.filter(d => d.status === 'pending').length,
        delivering: this.deliveryQueue.filter(d => d.status === 'delivering').length,
        total: this.deliveryQueue.length
      },
      events: {
        total: this.events.length,
        maxHistory: this.config.events.maxHistory
      }
    };
  }
    
  /**
     * Obtiene estado de salud
     */
  getHealthStatus() {
    const activeWebhooks = Array.from(this.webhooks.values()).filter(w => w.status === 'active').length;
    const activeEndpoints = Array.from(this.endpoints.values()).filter(e => e.status === 'active').length;
        
    return {
      healthy: true,
      components: {
        server: {
          healthy: this.server?.listening || false,
          port: this.config.server.port
        },
        webhooks: {
          healthy: true,
          total: this.webhooks.size,
          active: activeWebhooks
        },
        endpoints: {
          healthy: true,
          total: this.endpoints.size,
          active: activeEndpoints
        },
        deliveryQueue: {
          healthy: this.deliveryQueue.length < 1000,
          size: this.deliveryQueue.length
        }
      },
      timestamp: new Date().toISOString()
    };
  }
    
  /**
     * Configura timers del sistema
     */
  _setupTimers() {
    // Timer de procesamiento de delivery
    this.deliveryTimer = setInterval(() => {
      this._processDeliveryQueue();
    }, 5000); // Cada 5 segundos
        
    // Timer de limpieza
    this.cleanupTimer = setInterval(() => {
      this._cleanup();
    }, 300000); // Cada 5 minutos
        
    // Timer de métricas
    if (this.config.metrics.enabled) {
      this.metricsTimer = setInterval(() => {
        const stats = this.getStats();
        this.emit('metricsUpdate', stats);
      }, 60000); // Cada minuto
    }
  }
    
  /**
     * Limpia datos antiguos
     */
  _cleanup() {
    const now = Date.now();
    const retention = this.config.events.retention;
        
    // Limpiar eventos antiguos
    this.events = this.events.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return (now - eventTime) < retention;
    });
        
    // Limpiar deliveries fallidas antiguas
    this.deliveryQueue = this.deliveryQueue.filter(delivery => {
      if (delivery.status === 'failed') {
        const createdTime = new Date(delivery.createdAt).getTime();
        return (now - createdTime) < retention;
      }
      return true;
    });
        
    this._log('debug', 'Cleanup completed');
  }
    
  /**
     * Configura manejadores de eventos
     */
  _setupEventHandlers() {
    this.on('error', (error) => {
      this._log('error', `WebhookManager error: ${error.message}`);
    });
  }
    
  /**
     * Valida configuración de webhook
     */
  _validateWebhookConfig(webhook) {
    if (!webhook.url) {
      throw new Error('Webhook URL is required');
    }
        
    if (!webhook.url.startsWith('http')) {
      throw new Error('Webhook URL must be a valid HTTP/HTTPS URL');
    }
        
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    if (!allowedMethods.includes(webhook.method.toUpperCase())) {
      throw new Error(`Invalid HTTP method: ${webhook.method}`);
    }
  }
    
  /**
     * Valida configuración de endpoint
     */
  _validateEndpointConfig(endpoint) {
    if (!endpoint.path) {
      throw new Error('Endpoint path is required');
    }
        
    if (!endpoint.path.startsWith('/')) {
      throw new Error('Endpoint path must start with /');
    }
        
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    if (!allowedMethods.includes(endpoint.method.toUpperCase())) {
      throw new Error(`Invalid HTTP method: ${endpoint.method}`);
    }
  }
    
  /**
     * Valida configuración
     */
  _validateConfig() {
    if (this.config.maxWebhooks <= 0) {
      throw new Error('maxWebhooks must be greater than 0');
    }
        
    if (this.config.server.port <= 0 || this.config.server.port > 65535) {
      throw new Error('Server port must be between 1 and 65535');
    }
  }
    
  /**
     * Registra un log
     */
  _log(level, message) {
    if (!this.config.logging.enabled) return;
        
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      component: 'WebhookManager'
    };
        
    this.logs.push(logEntry);
    this.emit('log', logEntry);
        
    if (this.logs.length > this.config.logging.maxLogs) {
      this.logs.shift();
    }
  }
    
  /**
     * Destruye el gestor de webhooks
     */
  async destroy() {
    // Cerrar servidor
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
        
    // Limpiar timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    if (this.deliveryTimer) {
      clearInterval(this.deliveryTimer);
    }
        
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
        
    this.removeAllListeners();
    this.initialized = false;
        
    this._log('info', 'WebhookManager destroyed');
  }
}

export default WebhookManager;
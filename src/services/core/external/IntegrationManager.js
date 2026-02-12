import { EventEmitter } from 'events';
import APIManager from './APIManager.js';
import WebhookManager from './WebhookManager.js';
import { unified360DialogService } from '../core/Unified360DialogService.js';
import { createLogger } from '../core/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gestor de integraciones que coordina APIs y webhooks
 * Proporciona una interfaz unificada para todas las integraciones externas
 */
class IntegrationManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración general
      enabled: config.enabled !== false,
      maxIntegrations: config.maxIntegrations || 500,
            
      // Configuración de APIs
      apis: {
        enabled: config.apis?.enabled !== false,
        config: config.apis?.config || {}
      },
            
      // Configuración de webhooks
      webhooks: {
        enabled: config.webhooks?.enabled !== false,
        config: config.webhooks?.config || {}
      },
            
      // Configuración de sincronización
      sync: {
        enabled: config.sync?.enabled !== false,
        interval: config.sync?.interval || 300000, // 5 minutos
        batchSize: config.sync?.batchSize || 50,
        maxRetries: config.sync?.maxRetries || 3
      },
            
      // Configuración de mapeo de datos
      mapping: {
        enabled: config.mapping?.enabled !== false,
        defaultMappings: config.mapping?.defaultMappings || {},
        transformers: config.mapping?.transformers || []
      },
            
      // Configuración de eventos
      events: {
        enabled: config.events?.enabled !== false,
        maxHistory: config.events?.maxHistory || 10000,
        retention: config.events?.retention || 86400000, // 24 horas
        propagation: config.events?.propagation !== false
      },
            
      // Configuración de monitoreo
      monitoring: {
        enabled: config.monitoring?.enabled !== false,
        healthCheckInterval: config.monitoring?.healthCheckInterval || 60000, // 1 minuto
        alertThresholds: {
          errorRate: config.monitoring?.alertThresholds?.errorRate || 0.1, // 10%
          responseTime: config.monitoring?.alertThresholds?.responseTime || 5000, // 5 segundos
          availability: config.monitoring?.alertThresholds?.availability || 0.95 // 95%
        }
      },
            
      // Configuración de caché
      cache: {
        enabled: config.cache?.enabled !== false,
        ttl: config.cache?.ttl || 300000, // 5 minutos
        maxSize: config.cache?.maxSize || 1000
      },
            
      // Configuración de logging
      logging: {
        enabled: config.logging?.enabled !== false,
        level: config.logging?.level || 'info',
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
    this.integrations = new Map(); // Integraciones registradas
    this.syncJobs = new Map(); // Trabajos de sincronización
    this.events = []; // Historial de eventos
    this.cache = new Map(); // Caché de datos
    this.logs = [];
    this.metrics = {
      totalIntegrations: 0,
      activeIntegrations: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      syncJobs: {
        total: 0,
        successful: 0,
        failed: 0
      },
      integrationsByType: new Map(),
      errorsByIntegration: new Map()
    };
        
    // Componentes
    this.apiManager = null;
    this.webhookManager = null;
    this.dialog360Service = null;
        
    // Timers
    this.syncTimer = null;
    this.healthCheckTimer = null;
    this.cleanupTimer = null;
    this.metricsTimer = null;
        
    this.initialized = false;
  }
    
  /**
     * Inicializa el gestor de integraciones
     */
  async initialize() {
    if (this.initialized) return;
        
    try {
      this._validateConfig();
            
      // Inicializar componentes
      if (this.config.apis.enabled) {
        this.apiManager = new APIManager(this.config.apis.config);
        await this.apiManager.initialize();
        this._setupAPIManagerEvents();
      }
            
      if (this.config.webhooks.enabled) {
        this.webhookManager = new WebhookManager(this.config.webhooks.config);
        await this.webhookManager.initialize();
        this._setupWebhookManagerEvents();
      }

      // Inicializar servicio 360Dialog
      this.dialog360Service = new Dialog360Service();
      await this.dialog360Service.initialize();
            
      this._setupTimers();
      this._setupEventHandlers();
            
      this.initialized = true;
      this.emit('initialized');
            
      this._log('info', 'IntegrationManager initialized successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Registra una nueva integración
     */
  async registerIntegration(integrationConfig) {
    if (!this.initialized) {
      throw new Error('IntegrationManager not initialized');
    }
        
    if (this.integrations.size >= this.config.maxIntegrations) {
      throw new Error('Maximum number of integrations reached');
    }
        
    const integration = {
      id: integrationConfig.id || uuidv4(),
      name: integrationConfig.name || 'Unnamed Integration',
      type: integrationConfig.type, // api, webhook, hybrid
      description: integrationConfig.description || '',
            
      // Configuración específica del tipo
      config: integrationConfig.config || {},
            
      // Configuración de sincronización
      sync: {
        enabled: integrationConfig.sync?.enabled !== false,
        direction: integrationConfig.sync?.direction || 'bidirectional', // inbound, outbound, bidirectional
        interval: integrationConfig.sync?.interval || this.config.sync.interval,
        lastSync: null,
        nextSync: null
      },
            
      // Configuración de mapeo
      mapping: {
        enabled: integrationConfig.mapping?.enabled !== false,
        inbound: integrationConfig.mapping?.inbound || {},
        outbound: integrationConfig.mapping?.outbound || {},
        transformers: integrationConfig.mapping?.transformers || []
      },
            
      // Configuración de eventos
      events: {
        subscribe: integrationConfig.events?.subscribe || [],
        publish: integrationConfig.events?.publish || []
      },
            
      // Configuración de autenticación
      auth: integrationConfig.auth || {},
            
      // Metadatos
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: integrationConfig.metadata?.tags || [],
        category: integrationConfig.metadata?.category || 'general',
        version: integrationConfig.metadata?.version || '1.0'
      },
            
      // Estado
      status: 'inactive',
      lastActivity: null,
      lastError: null,
            
      // Estadísticas
      stats: {
        requests: 0,
        successes: 0,
        failures: 0,
        syncJobs: 0,
        lastSync: null,
        averageResponseTime: 0,
        totalResponseTime: 0
      }
    };
        
    // Validar configuración
    this._validateIntegrationConfig(integration);
        
    // Configurar según el tipo
    await this._setupIntegration(integration);
        
    this.integrations.set(integration.id, integration);
    this.metrics.totalIntegrations++;
        
    // Configurar sincronización si está habilitada
    if (integration.sync.enabled) {
      this._scheduleSyncJob(integration);
    }
        
    this.emit('integrationRegistered', integration);
    this._log('info', `Integration registered: ${integration.name} (${integration.id})`);
        
    return integration;
  }
    
  /**
     * Configura una integración según su tipo
     */
  async _setupIntegration(integration) {
    switch (integration.type) {
    case 'api':
      if (!this.apiManager) {
        throw new Error('API Manager not enabled');
      }
                
      const apiConfig = {
        id: integration.id,
        name: integration.name,
        ...integration.config
      };
                
      await this.apiManager.registerAPI(apiConfig);
      break;
                
    case 'webhook':
      if (!this.webhookManager) {
        throw new Error('Webhook Manager not enabled');
      }
                
      // Registrar webhook saliente si se especifica URL
      if (integration.config.url) {
        const webhookConfig = {
          id: integration.id,
          name: integration.name,
          ...integration.config
        };
                    
        await this.webhookManager.registerWebhook(webhookConfig);
      }
                
      // Registrar endpoint entrante si se especifica path
      if (integration.config.path) {
        const endpointConfig = {
          id: `${integration.id}_endpoint`,
          name: `${integration.name} Endpoint`,
          path: integration.config.path,
          handler: (event, req, res) => this._handleWebhookEvent(integration, event, req, res),
          ...integration.config.endpoint
        };
                    
        await this.webhookManager.registerEndpoint(endpointConfig);
      }
      break;
                
    case 'hybrid':
      // Configurar tanto API como webhook
      if (integration.config.api && this.apiManager) {
        const apiConfig = {
          id: `${integration.id}_api`,
          name: `${integration.name} API`,
          ...integration.config.api
        };
                    
        await this.apiManager.registerAPI(apiConfig);
      }
                
      if (integration.config.webhook && this.webhookManager) {
        if (integration.config.webhook.url) {
          const webhookConfig = {
            id: `${integration.id}_webhook`,
            name: `${integration.name} Webhook`,
            ...integration.config.webhook
          };
                        
          await this.webhookManager.registerWebhook(webhookConfig);
        }
                    
        if (integration.config.webhook.path) {
          const endpointConfig = {
            id: `${integration.id}_endpoint`,
            name: `${integration.name} Endpoint`,
            path: integration.config.webhook.path,
            handler: (event, req, res) => this._handleWebhookEvent(integration, event, req, res),
            ...integration.config.webhook.endpoint
          };
                        
          await this.webhookManager.registerEndpoint(endpointConfig);
        }
      }
      break;
                
    default:
      throw new Error(`Unsupported integration type: ${integration.type}`);
    }
  }
    
  /**
     * Maneja eventos de webhook para una integración
     */
  async _handleWebhookEvent(integration, event, req, res) {
    try {
      // Aplicar mapeo de entrada
      let mappedData = event.payload;
      if (integration.mapping.enabled && integration.mapping.inbound) {
        mappedData = await this._applyMapping(mappedData, integration.mapping.inbound);
      }
            
      // Aplicar transformadores
      if (integration.mapping.transformers.length > 0) {
        mappedData = await this._applyTransformers(mappedData, integration.mapping.transformers);
      }
            
      // Crear evento interno
      const internalEvent = {
        id: uuidv4(),
        type: 'integration.webhook.received',
        integrationId: integration.id,
        data: mappedData,
        originalEvent: event,
        timestamp: new Date().toISOString()
      };
            
      // Agregar al historial
      this._addEvent(internalEvent);
            
      // Emitir evento
      this.emit('webhookReceived', integration, internalEvent);
            
      // Actualizar estadísticas
      integration.stats.requests++;
      integration.stats.successes++;
      integration.lastActivity = new Date().toISOString();
            
      return { success: true, eventId: internalEvent.id };
            
    } catch (error) {
      integration.stats.failures++;
      integration.lastError = error.message;
            
      this._log('error', `Webhook event handling failed for integration ${integration.id}: ${error.message}`);
      throw error;
    }
  }
    
  /**
     * Realiza una petición a través de una integración
     */
  async makeRequest(integrationId, endpoint, options = {}) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }
        
    if (integration.status !== 'active') {
      throw new Error(`Integration not active: ${integrationId}`);
    }
        
    const startTime = Date.now();
        
    try {
      let result;
            
      switch (integration.type) {
      case 'api':
      case 'hybrid':
        if (!this.apiManager) {
          throw new Error('API Manager not available');
        }
                    
        const apiId = integration.type === 'api' ? integration.id : `${integration.id}_api`;
        result = await this.apiManager.makeRequest(apiId, endpoint, options);
        break;
                    
      default:
        throw new Error(`Request not supported for integration type: ${integration.type}`);
      }
            
      const responseTime = Date.now() - startTime;
            
      // Aplicar mapeo de salida si está configurado
      if (integration.mapping.enabled && integration.mapping.outbound && result.data) {
        result.data = await this._applyMapping(result.data, integration.mapping.outbound);
      }
            
      // Actualizar estadísticas
      integration.stats.requests++;
      integration.stats.successes++;
      integration.stats.totalResponseTime += responseTime;
      integration.stats.averageResponseTime = integration.stats.totalResponseTime / integration.stats.requests;
      integration.lastActivity = new Date().toISOString();
            
      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalResponseTime += responseTime;
      this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.totalRequests;
            
      // Crear evento
      const event = {
        id: uuidv4(),
        type: 'integration.request.completed',
        integrationId: integration.id,
        endpoint,
        options,
        result,
        responseTime,
        timestamp: new Date().toISOString()
      };
            
      this._addEvent(event);
      this.emit('requestCompleted', integration, event);
            
      return result;
            
    } catch (error) {
      const responseTime = Date.now() - startTime;
            
      // Actualizar estadísticas
      integration.stats.requests++;
      integration.stats.failures++;
      integration.lastError = error.message;
            
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
            
      // Crear evento de error
      const event = {
        id: uuidv4(),
        type: 'integration.request.failed',
        integrationId: integration.id,
        endpoint,
        options,
        error: error.message,
        responseTime,
        timestamp: new Date().toISOString()
      };
            
      this._addEvent(event);
      this.emit('requestFailed', integration, event);
            
      throw error;
    }
  }
    
  /**
     * Envía un evento a través de una integración
     */
  async sendEvent(integrationId, eventType, payload, options = {}) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }
        
    if (integration.status !== 'active') {
      throw new Error(`Integration not active: ${integrationId}`);
    }
        
    try {
      let result;
            
      switch (integration.type) {
      case 'webhook':
      case 'hybrid':
        if (!this.webhookManager) {
          throw new Error('Webhook Manager not available');
        }
                    
        // Aplicar mapeo de salida
        let mappedPayload = payload;
        if (integration.mapping.enabled && integration.mapping.outbound) {
          mappedPayload = await this._applyMapping(payload, integration.mapping.outbound);
        }
                    
        result = await this.webhookManager.sendEvent(eventType, mappedPayload, options);
        break;
                    
      default:
        throw new Error(`Event sending not supported for integration type: ${integration.type}`);
      }
            
      // Actualizar estadísticas
      integration.lastActivity = new Date().toISOString();
            
      // Crear evento
      const event = {
        id: uuidv4(),
        type: 'integration.event.sent',
        integrationId: integration.id,
        eventType,
        payload,
        result,
        timestamp: new Date().toISOString()
      };
            
      this._addEvent(event);
      this.emit('eventSent', integration, event);
            
      return result;
            
    } catch (error) {
      integration.lastError = error.message;
            
      // Crear evento de error
      const event = {
        id: uuidv4(),
        type: 'integration.event.failed',
        integrationId: integration.id,
        eventType,
        payload,
        error: error.message,
        timestamp: new Date().toISOString()
      };
            
      this._addEvent(event);
      this.emit('eventFailed', integration, event);
            
      throw error;
    }
  }
    
  /**
     * Ejecuta sincronización para una integración
     */
  async syncIntegration(integrationId, options = {}) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }
        
    if (!integration.sync.enabled) {
      throw new Error(`Sync not enabled for integration: ${integrationId}`);
    }
        
    const syncJob = {
      id: uuidv4(),
      integrationId: integration.id,
      type: options.type || 'manual',
      direction: options.direction || integration.sync.direction,
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: null,
      recordsProcessed: 0,
      recordsSuccessful: 0,
      recordsFailed: 0,
      errors: []
    };
        
    this.syncJobs.set(syncJob.id, syncJob);
    this.metrics.syncJobs.total++;
        
    try {
      this._log('info', `Starting sync job for integration ${integration.name} (${syncJob.id})`);
            
      // Ejecutar sincronización según la dirección
      switch (syncJob.direction) {
      case 'inbound':
        await this._syncInbound(integration, syncJob, options);
        break;
      case 'outbound':
        await this._syncOutbound(integration, syncJob, options);
        break;
      case 'bidirectional':
        await this._syncInbound(integration, syncJob, options);
        await this._syncOutbound(integration, syncJob, options);
        break;
      }
            
      syncJob.status = 'completed';
      syncJob.endTime = new Date().toISOString();
            
      // Actualizar estadísticas
      integration.sync.lastSync = syncJob.endTime;
      integration.stats.syncJobs++;
      integration.stats.lastSync = syncJob.endTime;
            
      this.metrics.syncJobs.successful++;
            
      this.emit('syncCompleted', integration, syncJob);
      this._log('info', `Sync job completed for integration ${integration.name} (${syncJob.id})`);
            
      return syncJob;
            
    } catch (error) {
      syncJob.status = 'failed';
      syncJob.endTime = new Date().toISOString();
      syncJob.errors.push(error.message);
            
      integration.lastError = error.message;
      this.metrics.syncJobs.failed++;
            
      this.emit('syncFailed', integration, syncJob);
      this._log('error', `Sync job failed for integration ${integration.name} (${syncJob.id}): ${error.message}`);
            
      throw error;
    }
  }
    
  /**
     * Sincronización entrante
     */
  async _syncInbound(integration, syncJob, options) {
    // Implementación específica según el tipo de integración
    // Esta es una implementación básica que debe ser extendida
        
    if (integration.type === 'api' || integration.type === 'hybrid') {
      // Obtener datos de la API externa
      const endpoint = options.endpoint || integration.config.syncEndpoint || '/sync';
      const response = await this.makeRequest(integration.id, endpoint, {
        method: 'GET',
        params: options.params || {}
      });
            
      if (response.data && Array.isArray(response.data)) {
        for (const record of response.data) {
          try {
            // Aplicar mapeo
            let mappedRecord = record;
            if (integration.mapping.enabled && integration.mapping.inbound) {
              mappedRecord = await this._applyMapping(record, integration.mapping.inbound);
            }
                        
            // Procesar registro
            await this._processInboundRecord(integration, mappedRecord);
                        
            syncJob.recordsProcessed++;
            syncJob.recordsSuccessful++;
                        
          } catch (error) {
            syncJob.recordsFailed++;
            syncJob.errors.push(`Record processing failed: ${error.message}`);
          }
        }
      }
    }
  }
    
  /**
     * Sincronización saliente
     */
  async _syncOutbound(integration, syncJob, options) {
    // Implementación específica según el tipo de integración
    // Esta es una implementación básica que debe ser extendida
        
    // Obtener datos locales para sincronizar
    const localData = await this._getLocalDataForSync(integration, options);
        
    if (localData && Array.isArray(localData)) {
      for (const record of localData) {
        try {
          // Aplicar mapeo
          let mappedRecord = record;
          if (integration.mapping.enabled && integration.mapping.outbound) {
            mappedRecord = await this._applyMapping(record, integration.mapping.outbound);
          }
                    
          // Enviar registro
          if (integration.type === 'api' || integration.type === 'hybrid') {
            const endpoint = options.endpoint || integration.config.syncEndpoint || '/sync';
            await this.makeRequest(integration.id, endpoint, {
              method: 'POST',
              data: mappedRecord
            });
          } else if (integration.type === 'webhook' || integration.type === 'hybrid') {
            await this.sendEvent(integration.id, 'sync.outbound', mappedRecord);
          }
                    
          syncJob.recordsProcessed++;
          syncJob.recordsSuccessful++;
                    
        } catch (error) {
          syncJob.recordsFailed++;
          syncJob.errors.push(`Record sync failed: ${error.message}`);
        }
      }
    }
  }
    
  /**
     * Procesa un registro entrante
     */
  async _processInboundRecord(integration, record) {
    // Implementación básica - debe ser extendida según las necesidades
    const event = {
      id: uuidv4(),
      type: 'integration.sync.inbound',
      integrationId: integration.id,
      data: record,
      timestamp: new Date().toISOString()
    };
        
    this._addEvent(event);
    this.emit('inboundRecord', integration, record);
  }
    
  /**
     * Obtiene datos locales para sincronización
     */
  async _getLocalDataForSync(integration, options) {
    // Implementación básica - debe ser extendida según las necesidades
    // Por ahora retorna array vacío
    return [];
  }
    
  /**
     * Aplica mapeo de datos
     */
  async _applyMapping(data, mapping) {
    if (!mapping || Object.keys(mapping).length === 0) {
      return data;
    }
        
    const mappedData = {};
        
    for (const [targetField, sourceField] of Object.entries(mapping)) {
      if (typeof sourceField === 'string') {
        // Mapeo simple
        mappedData[targetField] = this._getNestedValue(data, sourceField);
      } else if (typeof sourceField === 'object' && sourceField.field) {
        // Mapeo con transformación
        let value = this._getNestedValue(data, sourceField.field);
                
        if (sourceField.transform) {
          value = await this._applyTransform(value, sourceField.transform);
        }
                
        mappedData[targetField] = value;
      }
    }
        
    return mappedData;
  }
    
  /**
     * Aplica transformación a un valor
     */
  async _applyTransform(value, transform) {
    if (typeof transform === 'function') {
      return await transform(value);
    }
        
    if (typeof transform === 'object') {
      switch (transform.type) {
      case 'format':
        return this._formatValue(value, transform.format);
      case 'convert':
        return this._convertValue(value, transform.to);
      case 'default':
        return value !== undefined && value !== null ? value : transform.value;
      default:
        return value;
      }
    }
        
    return value;
  }
    
  /**
     * Formatea un valor
     */
  _formatValue(value, format) {
    if (format === 'date' && value) {
      return new Date(value).toISOString();
    }
        
    if (format === 'string') {
      return String(value);
    }
        
    if (format === 'number') {
      return Number(value);
    }
        
    return value;
  }
    
  /**
     * Convierte un valor
     */
  _convertValue(value, targetType) {
    switch (targetType) {
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'date':
      return new Date(value);
    default:
      return value;
    }
  }
    
  /**
     * Aplica transformadores
     */
  async _applyTransformers(data, transformers) {
    let transformedData = data;
        
    for (const transformer of transformers) {
      if (typeof transformer === 'function') {
        transformedData = await transformer(transformedData);
      }
    }
        
    return transformedData;
  }
    
  /**
     * Obtiene valor anidado de un objeto
     */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
    
  /**
     * Programa trabajo de sincronización
     */
  _scheduleSyncJob(integration) {
    const nextSync = Date.now() + integration.sync.interval;
    integration.sync.nextSync = new Date(nextSync).toISOString();
        
    setTimeout(() => {
      if (integration.sync.enabled && integration.status === 'active') {
        this.syncIntegration(integration.id, { type: 'scheduled' }).catch(error => {
          this._log('error', `Scheduled sync failed for integration ${integration.id}: ${error.message}`);
        });
                
        // Reprogramar siguiente sincronización
        this._scheduleSyncJob(integration);
      }
    }, integration.sync.interval);
  }
    
  /**
     * Activa una integración
     */
  async activateIntegration(integrationId) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }
        
    integration.status = 'active';
    integration.metadata.updatedAt = new Date().toISOString();
        
    this.metrics.activeIntegrations++;
        
    // Programar sincronización si está habilitada
    if (integration.sync.enabled) {
      this._scheduleSyncJob(integration);
    }
        
    this.emit('integrationActivated', integration);
    this._log('info', `Integration activated: ${integration.name} (${integration.id})`);
        
    return integration;
  }
    
  /**
     * Desactiva una integración
     */
  async deactivateIntegration(integrationId) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }
        
    integration.status = 'inactive';
    integration.metadata.updatedAt = new Date().toISOString();
        
    this.metrics.activeIntegrations--;
        
    this.emit('integrationDeactivated', integration);
    this._log('info', `Integration deactivated: ${integration.name} (${integration.id})`);
        
    return integration;
  }
    
  /**
     * Obtiene una integración por ID
     */
  getIntegration(integrationId) {
    return this.integrations.get(integrationId);
  }
    
  /**
     * Lista todas las integraciones
     */
  listIntegrations(filter = {}) {
    let integrations = Array.from(this.integrations.values());
        
    if (filter.type) {
      integrations = integrations.filter(integration => integration.type === filter.type);
    }
        
    if (filter.status) {
      integrations = integrations.filter(integration => integration.status === filter.status);
    }
        
    if (filter.category) {
      integrations = integrations.filter(integration => integration.metadata.category === filter.category);
    }
        
    return integrations;
  }
    
  /**
     * Actualiza una integración
     */
  async updateIntegration(integrationId, updates) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }
        
    const allowedUpdates = [
      'name', 'description', 'config', 'sync', 'mapping', 'events', 'auth'
    ];
        
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (typeof integration[field] === 'object' && !Array.isArray(integration[field])) {
          Object.assign(integration[field], updates[field]);
        } else {
          integration[field] = updates[field];
        }
      }
    });
        
    integration.metadata.updatedAt = new Date().toISOString();
        
    this.emit('integrationUpdated', integration);
        
    return integration;
  }
    
  /**
     * Elimina una integración
     */
  async deleteIntegration(integrationId) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }
        
    // Limpiar recursos según el tipo
    switch (integration.type) {
    case 'api':
      if (this.apiManager) {
        await this.apiManager.deleteAPI(integration.id);
      }
      break;
                
    case 'webhook':
      if (this.webhookManager) {
        await this.webhookManager.deleteWebhook(integration.id);
        await this.webhookManager.deleteEndpoint(`${integration.id}_endpoint`);
      }
      break;
                
    case 'hybrid':
      if (this.apiManager) {
        await this.apiManager.deleteAPI(`${integration.id}_api`);
      }
      if (this.webhookManager) {
        await this.webhookManager.deleteWebhook(`${integration.id}_webhook`);
        await this.webhookManager.deleteEndpoint(`${integration.id}_endpoint`);
      }
      break;
    }
        
    // Limpiar trabajos de sincronización
    for (const [jobId, job] of this.syncJobs) {
      if (job.integrationId === integrationId) {
        this.syncJobs.delete(jobId);
      }
    }
        
    this.integrations.delete(integrationId);
    this.metrics.totalIntegrations--;
        
    if (integration.status === 'active') {
      this.metrics.activeIntegrations--;
    }
        
    this.emit('integrationDeleted', integration);
        
    return true;
  }
    
  /**
     * Realiza health check de todas las integraciones
     */
  async performHealthCheck() {
    const results = {};
        
    for (const [id, integration] of this.integrations) {
      try {
        let healthy = true;
        let details = {};
                
        switch (integration.type) {
        case 'api':
          if (this.apiManager) {
            const healthResult = await this.apiManager.performHealthCheck(integration.id);
            healthy = healthResult.healthy;
            details = healthResult;
          }
          break;
                        
        case 'webhook':
          // Para webhooks, verificar que el endpoint esté disponible
          healthy = integration.status === 'active';
          details = { status: integration.status };
          break;
                        
        case 'hybrid':
          // Verificar ambos componentes
          let apiHealthy = true;
          let webhookHealthy = true;
                        
          if (this.apiManager && integration.config.api) {
            const apiHealth = await this.apiManager.performHealthCheck(`${integration.id}_api`);
            apiHealthy = apiHealth.healthy;
            details.api = apiHealth;
          }
                        
          if (integration.config.webhook) {
            webhookHealthy = integration.status === 'active';
            details.webhook = { status: integration.status };
          }
                        
          healthy = apiHealthy && webhookHealthy;
          break;
        }
                
        results[id] = {
          name: integration.name,
          type: integration.type,
          healthy,
          details,
          lastActivity: integration.lastActivity,
          lastError: integration.lastError
        };
                
      } catch (error) {
        results[id] = {
          name: integration.name,
          type: integration.type,
          healthy: false,
          error: error.message
        };
      }
    }
        
    return results;
  }
    
  /**
     * Obtiene estadísticas
     */
  getStats() {
    const integrationStats = {};
        
    for (const [id, integration] of this.integrations) {
      integrationStats[id] = {
        name: integration.name,
        type: integration.type,
        status: integration.status,
        stats: integration.stats
      };
    }
        
    return {
      ...this.metrics,
      integrations: integrationStats,
      components: {
        apiManager: this.apiManager ? this.apiManager.getStats() : null,
        webhookManager: this.webhookManager ? this.webhookManager.getStats() : null
      },
      syncJobs: {
        ...this.metrics.syncJobs,
        active: Array.from(this.syncJobs.values()).filter(job => job.status === 'running').length,
        total: this.syncJobs.size
      }
    };
  }
    
  /**
     * Obtiene estado de salud
     */
  getHealthStatus() {
    const activeIntegrations = Array.from(this.integrations.values()).filter(i => i.status === 'active').length;
    const totalIntegrations = this.integrations.size;
        
    return {
      healthy: true,
      components: {
        integrations: {
          healthy: true,
          total: totalIntegrations,
          active: activeIntegrations
        },
        apiManager: this.apiManager ? this.apiManager.getHealthStatus() : null,
        webhookManager: this.webhookManager ? this.webhookManager.getHealthStatus() : null,
        syncJobs: {
          healthy: true,
          active: Array.from(this.syncJobs.values()).filter(job => job.status === 'running').length,
          total: this.syncJobs.size
        }
      },
      timestamp: new Date().toISOString()
    };
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
     * Configura eventos del API Manager
     */
  _setupAPIManagerEvents() {
    this.apiManager.on('requestCompleted', (api, endpoint, response, requestId) => {
      this.emit('apiRequestCompleted', api, endpoint, response, requestId);
    });
        
    this.apiManager.on('requestFailed', (api, endpoint, error, requestId) => {
      this.emit('apiRequestFailed', api, endpoint, error, requestId);
    });
  }
    
  /**
     * Configura eventos del Webhook Manager
     */
  _setupWebhookManagerEvents() {
    this.webhookManager.on('webhookReceived', (event, endpoint) => {
      this.emit('webhookReceived', event, endpoint);
    });
        
    this.webhookManager.on('webhookDelivered', (delivery) => {
      this.emit('webhookDelivered', delivery);
    });
        
    this.webhookManager.on('webhookFailed', (delivery) => {
      this.emit('webhookFailed', delivery);
    });
  }
    
  /**
     * Configura timers del sistema
     */
  _setupTimers() {
    // Timer de health check
    if (this.config.monitoring.enabled) {
      this.healthCheckTimer = setInterval(async() => {
        try {
          const healthResults = await this.performHealthCheck();
          this.emit('healthCheckCompleted', healthResults);
        } catch (error) {
          this._log('error', `Health check failed: ${error.message}`);
        }
      }, this.config.monitoring.healthCheckInterval);
    }
        
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
        
    // Limpiar trabajos de sincronización completados antiguos
    for (const [jobId, job] of this.syncJobs) {
      if (job.status !== 'running' && job.endTime) {
        const endTime = new Date(job.endTime).getTime();
        if ((now - endTime) > retention) {
          this.syncJobs.delete(jobId);
        }
      }
    }
        
    // Limpiar caché expirado
    for (const [key, cached] of this.cache) {
      if (cached.expiresAt && now > cached.expiresAt) {
        this.cache.delete(key);
      }
    }
        
    this._log('debug', 'Cleanup completed');
  }
    
  /**
     * Configura manejadores de eventos
     */
  _setupEventHandlers() {
    this.on('error', (error) => {
      this._log('error', `IntegrationManager error: ${error.message}`);
    });
  }
    
  /**
     * Valida configuración de integración
     */
  _validateIntegrationConfig(integration) {
    if (!integration.type) {
      throw new Error('Integration type is required');
    }
        
    const allowedTypes = ['api', 'webhook', 'hybrid'];
    if (!allowedTypes.includes(integration.type)) {
      throw new Error(`Invalid integration type: ${integration.type}`);
    }
        
    if (integration.type === 'api' && !integration.config.baseURL) {
      throw new Error('Base URL is required for API integrations');
    }
        
    if (integration.type === 'webhook' && !integration.config.url && !integration.config.path) {
      throw new Error('URL or path is required for webhook integrations');
    }
  }
    
  /**
     * Valida configuración
     */
  _validateConfig() {
    if (this.config.maxIntegrations <= 0) {
      throw new Error('maxIntegrations must be greater than 0');
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
      component: 'IntegrationManager'
    };
        
    this.logs.push(logEntry);
    this.emit('log', logEntry);
        
    if (this.logs.length > this.config.logging.maxLogs) {
      this.logs.shift();
    }
  }

  /**
     * Métodos específicos para 360Dialog
     */
    
  /**
     * Envía un mensaje de WhatsApp a través de 360Dialog
     */
  async sendWhatsAppMessage(to, message, options = {}) {
    try {
      const result = await unified360DialogService.sendTextMessage(to, message, options);
            
      this._log('info', `WhatsApp message sent via 360Dialog to ${to}`);
      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
            
      return result;
    } catch (error) {
      this._log('error', `Failed to send WhatsApp message via 360Dialog: ${error.message}`);
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
     * Envía una plantilla de WhatsApp a través de 360Dialog
     */
  async sendWhatsAppTemplate(to, templateName, templateData = {}, options = {}) {
    try {
      const result = await unified360DialogService.sendTemplate(to, templateName, templateData, options);
            
      this._log('info', `WhatsApp template sent via 360Dialog to ${to}`);
      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
            
      return result;
    } catch (error) {
      this._log('error', `Failed to send WhatsApp template via 360Dialog: ${error.message}`);
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
     * Procesa webhook de 360Dialog
     */
  async processDialog360Webhook(payload, signature) {
    try {
      const result = await unified360DialogService.processWebhook(payload, signature);
            
      this._log('info', '360Dialog webhook processed successfully');
      this.emit('dialog360_webhook', result);
            
      return result;
    } catch (error) {
      this._log('error', `Failed to process 360Dialog webhook: ${error.message}`);
      throw error;
    }
  }

  /**
     * Obtiene el estado de 360Dialog
     */
  async getDialog360Status() {
    try {
      return await unified360DialogService.getStatus();
    } catch (error) {
      this._log('error', `Failed to get 360Dialog status: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  }

  /**
     * Configura 360Dialog con nuevas credenciales
     */
  async configureDialog360(config) {
    try {
      await unified360DialogService.configure(config);
      this._log('info', '360Dialog configured successfully');
            
      return { success: true };
    } catch (error) {
      this._log('error', `Failed to configure 360Dialog: ${error.message}`);
      throw error;
    }
  }
    
  /**
     * Destruye el gestor de integraciones
     */
  async destroy() {
    // Destruir componentes
    if (this.apiManager) {
      await this.apiManager.destroy();
    }
        
    if (this.webhookManager) {
      await this.webhookManager.destroy();
    }

    if (this.dialog360Service) {
      await this.dialog360Service.destroy();
    }
        
    // Limpiar timers
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
        
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
        
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
        
    this.removeAllListeners();
    this.initialized = false;
        
    this._log('info', 'IntegrationManager destroyed');
  }
}

export default IntegrationManager;
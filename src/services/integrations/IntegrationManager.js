/**
 * @fileoverview Integration Manager Service
 * Gestiona integraciones con servicios externos y APIs de terceros
 * 
 * @author ChatBot Enterprise Team
 * @version 6.0.0
 * @since 2.0.0
 */

import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../core/logger.js';

/**
 * Estados de integración
 */
export const IntegrationStatus = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  ERROR: 'error',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  MAINTENANCE: 'maintenance'
};

/**
 * Tipos de integración
 */
export const IntegrationType = {
  MESSAGING: 'messaging',
  CRM: 'crm',
  ANALYTICS: 'analytics',
  PAYMENT: 'payment',
  STORAGE: 'storage',
  AI_SERVICE: 'ai_service',
  NOTIFICATION: 'notification',
  WEBHOOK: 'webhook',
  DATABASE: 'database',
  SOCIAL_MEDIA: 'social_media'
};

/**
 * Proveedores de integración
 */
export const IntegrationProvider = {
  // Messaging
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
  SLACK: 'slack',
  DISCORD: 'discord',
  FACEBOOK: 'facebook',
  
  // CRM
  SALESFORCE: 'salesforce',
  HUBSPOT: 'hubspot',
  PIPEDRIVE: 'pipedrive',
  
  // Analytics
  GOOGLE_ANALYTICS: 'google_analytics',
  MIXPANEL: 'mixpanel',
  AMPLITUDE: 'amplitude',
  
  // Payment
  STRIPE: 'stripe',
  PAYPAL: 'paypal',
  MERCADOPAGO: 'mercadopago',
  
  // AI Services
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE_AI: 'google_ai',
  
  // Storage
  AWS_S3: 'aws_s3',
  GOOGLE_CLOUD: 'google_cloud',
  AZURE: 'azure',
  
  // Custom
  CUSTOM: 'custom'
};

/**
 * Clase principal del gestor de integraciones
 */
export class IntegrationManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Configuración de timeout
      timeout: 30000,
      
      // Configuración de retry
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2
      },
      
      // Configuración de health check
      healthCheck: {
        enabled: true,
        interval: 60000, // 1 minuto
        timeout: 10000
      },
      
      // Configuración de rate limiting
      rateLimit: {
        enabled: true,
        requestsPerSecond: 10,
        burstLimit: 50
      },
      
      // Configuración de cache
      cache: {
        enabled: true,
        ttl: 300000, // 5 minutos
        maxSize: 1000
      },
      
      ...config
    };
    
    // Almacenamiento de integraciones
    this.integrations = new Map();
    this.connections = new Map();
    this.cache = new Map();
    
    // Estadísticas
    this.stats = {
      totalIntegrations: 0,
      activeIntegrations: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastResponseTime: 0
    };
    
    // Rate limiting
    this.rateLimiters = new Map();
    
    this.initializeManager();
  }

  /**
   * Inicializa el gestor de integraciones
   */
  async initializeManager() {
    try {
      // Configurar health checks
      if (this.config.healthCheck.enabled) {
        this.setupHealthChecks();
      }
      
      // Configurar limpieza de cache
      this.setupCacheCleanup();
      
      logger.info('IntegrationManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize IntegrationManager', error);
      throw error;
    }
  }

  /**
   * Registra una nueva integración
   */
  registerIntegration(id, config) {
    const integration = {
      id,
      name: config.name || id,
      type: config.type,
      provider: config.provider,
      status: IntegrationStatus.INACTIVE,
      
      // Configuración de conexión
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      headers: config.headers || {},
      
      // Configuración específica
      settings: config.settings || {},
      
      // Configuración de comportamiento
      timeout: config.timeout || this.config.timeout,
      retryConfig: { ...this.config.retry, ...config.retry },
      
      // Metadatos
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastHealthCheck: null,
      lastError: null,
      
      // Estadísticas
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
    
    this.integrations.set(id, integration);
    this.stats.totalIntegrations++;
    
    logger.info(`Integration registered: ${id}`, {
      type: integration.type,
      provider: integration.provider
    });
    
    return integration;
  }

  /**
   * Desregistra una integración
   */
  unregisterIntegration(id) {
    const integration = this.integrations.get(id);
    if (!integration) {
      return false;
    }
    
    // Desconectar si está activa
    if (integration.status === IntegrationStatus.ACTIVE) {
      this.disconnectIntegration(id);
    }
    
    this.integrations.delete(id);
    this.connections.delete(id);
    this.rateLimiters.delete(id);
    
    this.stats.totalIntegrations--;
    
    logger.info(`Integration unregistered: ${id}`);
    
    return true;
  }

  /**
   * Conecta una integración
   */
  async connectIntegration(id) {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }
    
    if (integration.status === IntegrationStatus.ACTIVE) {
      return integration;
    }
    
    integration.status = IntegrationStatus.CONNECTING;
    
    try {
      // Realizar test de conexión
      const connectionTest = await this.testConnection(integration);
      
      if (connectionTest.success) {
        integration.status = IntegrationStatus.ACTIVE;
        integration.lastHealthCheck = new Date().toISOString();
        integration.lastError = null;
        
        // Crear conexión
        const connection = this.createConnection(integration);
        this.connections.set(id, connection);
        
        // Configurar rate limiter
        this.setupRateLimiter(id);
        
        this.stats.activeIntegrations++;
        
        logger.info(`Integration connected: ${id}`);
        this.emit('integration.connected', integration);
        
      } else {
        integration.status = IntegrationStatus.ERROR;
        integration.lastError = connectionTest.error;
        
        logger.error(`Failed to connect integration: ${id}`, connectionTest.error);
        this.emit('integration.error', integration, connectionTest.error);
        
        throw new Error(`Connection failed: ${connectionTest.error}`);
      }
      
      return integration;
      
    } catch (error) {
      integration.status = IntegrationStatus.ERROR;
      integration.lastError = error.message;
      
      logger.error(`Integration connection error: ${id}`, error);
      this.emit('integration.error', integration, error);
      
      throw error;
    }
  }

  /**
   * Desconecta una integración
   */
  async disconnectIntegration(id) {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }
    
    if (integration.status !== IntegrationStatus.ACTIVE) {
      return integration;
    }
    
    integration.status = IntegrationStatus.DISCONNECTED;
    
    // Remover conexión
    this.connections.delete(id);
    this.rateLimiters.delete(id);
    
    this.stats.activeIntegrations--;
    
    logger.info(`Integration disconnected: ${id}`);
    this.emit('integration.disconnected', integration);
    
    return integration;
  }

  /**
   * Realiza una petición a una integración
   */
  async makeRequest(integrationId, options) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }
    
    if (integration.status !== IntegrationStatus.ACTIVE) {
      throw new Error(`Integration not active: ${integrationId}`);
    }
    
    // Verificar rate limiting
    if (!this.checkRateLimit(integrationId)) {
      throw new Error(`Rate limit exceeded for integration: ${integrationId}`);
    }
    
    const startTime = Date.now();
    
    try {
      // Verificar cache
      const cacheKey = this.generateCacheKey(integrationId, options);
      if (this.config.cache.enabled && options.method === 'GET') {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cache.ttl) {
          return cached.data;
        }
      }
      
      // Preparar petición
      const requestConfig = {
        method: options.method || 'GET',
        url: this.buildUrl(integration, options.path),
        headers: {
          ...integration.headers,
          ...options.headers
        },
        timeout: options.timeout || integration.timeout,
        ...options
      };
      
      // Agregar autenticación
      this.addAuthentication(requestConfig, integration);
      
      // Realizar petición con retry
      const response = await this.makeRequestWithRetry(requestConfig, integration.retryConfig);
      
      // Actualizar estadísticas
      const responseTime = Date.now() - startTime;
      this.updateIntegrationStats(integration, responseTime, true);
      
      // Guardar en cache si es aplicable
      if (this.config.cache.enabled && options.method === 'GET') {
        this.cache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
      }
      
      logger.debug(`Integration request successful: ${integrationId}`, {
        method: requestConfig.method,
        path: options.path,
        responseTime
      });
      
      return response.data;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateIntegrationStats(integration, responseTime, false);
      
      logger.error(`Integration request failed: ${integrationId}`, {
        method: options.method,
        path: options.path,
        error: error.message,
        responseTime
      });
      
      throw error;
    }
  }

  /**
   * Realiza petición con retry
   */
  async makeRequestWithRetry(requestConfig, retryConfig) {
    let lastError;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const response = await axios(requestConfig);
        return response;
      } catch (error) {
        lastError = error;
        
        if (attempt === retryConfig.maxAttempts) {
          break;
        }
        
        // Calcular delay para retry
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffFactor, attempt - 1),
          retryConfig.maxDelay
        );
        
        logger.warn(`Request failed, retrying in ${delay}ms`, {
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Prueba la conexión de una integración
   */
  async testConnection(integration) {
    try {
      const testConfig = {
        method: 'GET',
        url: integration.endpoint,
        headers: integration.headers,
        timeout: this.config.healthCheck.timeout
      };
      
      this.addAuthentication(testConfig, integration);
      
      const response = await axios(testConfig);
      
      return {
        success: true,
        status: response.status,
        responseTime: Date.now()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Crea una conexión para una integración
   */
  createConnection(integration) {
    return {
      id: integration.id,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * Configura rate limiter para una integración
   */
  setupRateLimiter(integrationId) {
    if (!this.config.rateLimit.enabled) {
      return;
    }
    
    this.rateLimiters.set(integrationId, {
      requests: [],
      lastReset: Date.now()
    });
  }

  /**
   * Verifica rate limiting
   */
  checkRateLimit(integrationId) {
    if (!this.config.rateLimit.enabled) {
      return true;
    }
    
    const limiter = this.rateLimiters.get(integrationId);
    if (!limiter) {
      return true;
    }
    
    const now = Date.now();
    const windowStart = now - 1000; // 1 segundo
    
    // Limpiar requests antiguos
    limiter.requests = limiter.requests.filter(time => time > windowStart);
    
    // Verificar límites
    if (limiter.requests.length >= this.config.rateLimit.requestsPerSecond) {
      return false;
    }
    
    // Registrar request
    limiter.requests.push(now);
    
    return true;
  }

  /**
   * Construye URL completa
   */
  buildUrl(integration, path) {
    const baseUrl = integration.endpoint.replace(/\/$/, '');
    const cleanPath = path ? path.replace(/^\//, '') : '';
    return cleanPath ? `${baseUrl}/${cleanPath}` : baseUrl;
  }

  /**
   * Agrega autenticación a la petición
   */
  addAuthentication(requestConfig, integration) {
    if (integration.apiKey) {
      // API Key en header
      requestConfig.headers['Authorization'] = `Bearer ${integration.apiKey}`;
    }
    
    if (integration.apiSecret) {
      // Basic auth o custom auth
      if (integration.provider === IntegrationProvider.CUSTOM) {
        requestConfig.headers['X-API-Secret'] = integration.apiSecret;
      } else {
        requestConfig.auth = {
          username: integration.apiKey,
          password: integration.apiSecret
        };
      }
    }
  }

  /**
   * Genera clave de cache
   */
  generateCacheKey(integrationId, options) {
    const key = `${integrationId}:${options.method}:${options.path}`;
    if (options.params) {
      const params = new URLSearchParams(options.params).toString();
      return `${key}:${params}`;
    }
    return key;
  }

  /**
   * Actualiza estadísticas de integración
   */
  updateIntegrationStats(integration, responseTime, success) {
    integration.totalRequests++;
    this.stats.totalRequests++;
    
    if (success) {
      integration.successfulRequests++;
      this.stats.successfulRequests++;
    } else {
      integration.failedRequests++;
      this.stats.failedRequests++;
    }
    
    // Actualizar tiempo de respuesta promedio
    integration.averageResponseTime = 
      (integration.averageResponseTime + responseTime) / 2;
    
    this.stats.lastResponseTime = responseTime;
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime + responseTime) / 2;
  }

  /**
   * Configura health checks
   */
  setupHealthChecks() {
    setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheck.interval);
  }

  /**
   * Realiza health checks de todas las integraciones activas
   */
  async performHealthChecks() {
    const activeIntegrations = Array.from(this.integrations.values())
      .filter(integration => integration.status === IntegrationStatus.ACTIVE);
    
    for (const integration of activeIntegrations) {
      try {
        const result = await this.testConnection(integration);
        
        if (result.success) {
          integration.lastHealthCheck = new Date().toISOString();
          integration.lastError = null;
        } else {
          integration.status = IntegrationStatus.ERROR;
          integration.lastError = result.error;
          
          logger.warn(`Health check failed for integration: ${integration.id}`, result.error);
          this.emit('integration.health_check_failed', integration, result.error);
        }
        
      } catch (error) {
        integration.status = IntegrationStatus.ERROR;
        integration.lastError = error.message;
        
        logger.error(`Health check error for integration: ${integration.id}`, error);
        this.emit('integration.health_check_error', integration, error);
      }
    }
  }

  /**
   * Configura limpieza de cache
   */
  setupCacheCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Cada minuto
  }

  /**
   * Limpia cache expirado
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache) {
      if (now - value.timestamp > this.config.cache.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    // Limitar tamaño del cache
    if (this.cache.size > this.config.cache.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = this.cache.size - this.config.cache.maxSize;
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} cache entries`);
    }
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      connectionsActive: this.connections.size,
      rateLimitersActive: this.rateLimiters.size
    };
  }

  /**
   * Obtiene todas las integraciones
   */
  getIntegrations() {
    return Array.from(this.integrations.values());
  }

  /**
   * Obtiene integración por ID
   */
  getIntegration(id) {
    return this.integrations.get(id);
  }

  /**
   * Obtiene integraciones por tipo
   */
  getIntegrationsByType(type) {
    return Array.from(this.integrations.values())
      .filter(integration => integration.type === type);
  }

  /**
   * Obtiene integraciones por proveedor
   */
  getIntegrationsByProvider(provider) {
    return Array.from(this.integrations.values())
      .filter(integration => integration.provider === provider);
  }

  /**
   * Actualiza configuración de integración
   */
  updateIntegration(id, updates) {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }
    
    Object.assign(integration, updates);
    integration.updatedAt = new Date().toISOString();
    
    logger.info(`Integration updated: ${id}`, updates);
    
    return integration;
  }

  /**
   * Limpia cache de una integración específica
   */
  clearIntegrationCache(integrationId) {
    let cleared = 0;
    
    for (const [key, value] of this.cache) {
      if (key.startsWith(`${integrationId}:`)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    logger.info(`Cleared ${cleared} cache entries for integration: ${integrationId}`);
    
    return cleared;
  }

  /**
   * Cierra el gestor de integraciones
   */
  async close() {
    // Desconectar todas las integraciones activas
    const activeIntegrations = Array.from(this.integrations.values())
      .filter(integration => integration.status === IntegrationStatus.ACTIVE);
    
    for (const integration of activeIntegrations) {
      await this.disconnectIntegration(integration.id);
    }
    
    // Limpiar cache
    this.cache.clear();
    
    logger.info('IntegrationManager closed');
  }
}

// Instancia singleton
export const integrationManager = new IntegrationManager();

export default IntegrationManager;
import APIManager from './APIManager.js';
import IntegrationManager from './IntegrationManager.js';
import { unifiedWebhookService } from '../core/UnifiedWebhookService.js';
import crypto from 'crypto';

/**
 * Configuración por defecto para el sistema de integraciones
 */
const DEFAULT_INTEGRATION_CONFIG = {
  // Configuración general
  enabled: true,
  maxIntegrations: 500,
    
  // Configuración de APIs
  apis: {
    enabled: true,
    config: {
      enabled: true,
      maxConnections: 100,
      defaultTimeout: 30000,
      auth: {
        enabled: true,
        types: ['bearer', 'basic', 'apikey', 'oauth2', 'custom'],
        storage: 'memory',
        encryption: false,
        tokenRefresh: true
      },
      rateLimit: {
        enabled: true,
        defaultLimit: 1000,
        window: 3600000,
        strategy: 'sliding-window',
        storage: 'memory'
      },
      cache: {
        enabled: true,
        defaultTTL: 300000,
        maxSize: 1000,
        compression: false
      },
      retry: {
        enabled: true,
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        statusCodes: [408, 429, 500, 502, 503, 504]
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 10000
      },
      logging: {
        enabled: true,
        level: 'info',
        includeHeaders: false,
        includeBody: false,
        maxBodySize: 1024
      },
      metrics: {
        enabled: true,
        retention: 86400000,
        aggregation: true
      }
    }
  },
    
  // Configuración de webhooks
  webhooks: {
    enabled: true,
    config: {
      server: {
        enabled: true,
        port: 3001,
        host: '0.0.0.0',
        basePath: '/webhooks',
        maxPayloadSize: '10mb',
        timeout: 30000,
        cors: {
          enabled: true,
          origin: '*',
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          headers: ['Content-Type', 'Authorization', 'X-Webhook-Signature']
        },
        helmet: {
          enabled: true,
          contentSecurityPolicy: false
        }
      },
      security: {
        signature: {
          enabled: true,
          algorithm: 'sha256',
          header: 'X-Webhook-Signature',
          timestampTolerance: 300000
        },
        ipWhitelist: {
          enabled: false,
          ips: []
        },
        userAgentWhitelist: {
          enabled: false,
          agents: []
        }
      },
      delivery: {
        timeout: 30000,
        maxRetries: 3,
        retryBackoff: 'exponential',
        batchSize: 10,
        maxConcurrency: 5
      },
      events: {
        maxHistory: 10000,
        retention: 86400000,
        compression: false
      },
      rateLimit: {
        enabled: true,
        window: 60000,
        maxRequests: 100
      },
      logging: {
        enabled: true,
        level: 'info',
        includePayload: false,
        maxPayloadSize: 1024
      },
      metrics: {
        enabled: true,
        retention: 86400000,
        aggregation: true
      }
    }
  },
    
  // Configuración de sincronización
  sync: {
    enabled: true,
    interval: 300000,
    batchSize: 50,
    maxRetries: 3
  },
    
  // Configuración de mapeo
  mapping: {
    enabled: true,
    defaultMappings: {},
    transformers: []
  },
    
  // Configuración de eventos
  events: {
    enabled: true,
    maxHistory: 10000,
    retention: 86400000,
    propagation: true
  },
    
  // Configuración de monitoreo
  monitoring: {
    enabled: true,
    healthCheckInterval: 60000,
    alertThresholds: {
      errorRate: 0.1,
      responseTime: 5000,
      availability: 0.95
    }
  },
    
  // Configuración de caché
  cache: {
    enabled: true,
    ttl: 300000,
    maxSize: 1000
  },
    
  // Configuración de logging
  logging: {
    enabled: true,
    level: 'info',
    maxLogs: 10000
  },
    
  // Configuración de métricas
  metrics: {
    enabled: true,
    retention: 86400000,
    aggregation: true
  }
};

/**
 * Constantes del sistema de integraciones
 */
const INTEGRATION_CONSTANTS = {
  // Tipos de integración
  INTEGRATION_TYPES: {
    API: 'api',
    WEBHOOK: 'webhook',
    HYBRID: 'hybrid'
  },
    
  // Estados de integración
  INTEGRATION_STATUS: {
    INACTIVE: 'inactive',
    ACTIVE: 'active',
    ERROR: 'error',
    SUSPENDED: 'suspended'
  },
    
  // Direcciones de sincronización
  SYNC_DIRECTIONS: {
    INBOUND: 'inbound',
    OUTBOUND: 'outbound',
    BIDIRECTIONAL: 'bidirectional'
  },
    
  // Estados de trabajos de sincronización
  SYNC_JOB_STATUS: {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  },
    
  // Tipos de eventos
  EVENT_TYPES: {
    INTEGRATION_REGISTERED: 'integration.registered',
    INTEGRATION_ACTIVATED: 'integration.activated',
    INTEGRATION_DEACTIVATED: 'integration.deactivated',
    INTEGRATION_UPDATED: 'integration.updated',
    INTEGRATION_DELETED: 'integration.deleted',
    REQUEST_COMPLETED: 'integration.request.completed',
    REQUEST_FAILED: 'integration.request.failed',
    EVENT_SENT: 'integration.event.sent',
    EVENT_FAILED: 'integration.event.failed',
    WEBHOOK_RECEIVED: 'integration.webhook.received',
    SYNC_STARTED: 'integration.sync.started',
    SYNC_COMPLETED: 'integration.sync.completed',
    SYNC_FAILED: 'integration.sync.failed',
    HEALTH_CHECK_COMPLETED: 'integration.health.completed',
    METRICS_UPDATE: 'integration.metrics.update'
  },
    
  // Métodos HTTP
  HTTP_METHODS: {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    DELETE: 'DELETE',
    HEAD: 'HEAD',
    OPTIONS: 'OPTIONS'
  },
    
  // Tipos de autenticación
  AUTH_TYPES: {
    BEARER: 'bearer',
    BASIC: 'basic',
    API_KEY: 'apikey',
    OAUTH2: 'oauth2',
    CUSTOM: 'custom'
  },
    
  // Algoritmos de firma
  SIGNATURE_ALGORITHMS: {
    SHA256: 'sha256',
    SHA1: 'sha1',
    MD5: 'md5'
  },
    
  // Estrategias de rate limiting
  RATE_LIMIT_STRATEGIES: {
    FIXED_WINDOW: 'fixed-window',
    SLIDING_WINDOW: 'sliding-window',
    TOKEN_BUCKET: 'token-bucket'
  },
    
  // Tipos de transformación
  TRANSFORM_TYPES: {
    FORMAT: 'format',
    CONVERT: 'convert',
    DEFAULT: 'default',
    CUSTOM: 'custom'
  },
    
  // Formatos de datos
  DATA_FORMATS: {
    JSON: 'json',
    XML: 'xml',
    FORM: 'form',
    TEXT: 'text',
    BINARY: 'binary'
  }
};

/**
 * Utilidades para el sistema de integraciones
 */
class IntegrationUtils {
  /**
     * Valida configuración de integración
     */
  static validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }
        
    return true;
  }
    
  /**
     * Combina configuraciones
     */
  static mergeConfigs(defaultConfig, userConfig) {
    const merged = JSON.parse(JSON.stringify(defaultConfig));
        
    function deepMerge(target, source) {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
        
    deepMerge(merged, userConfig);
    return merged;
  }
    
  /**
     * Crea configuración optimizada para desarrollo
     */
  static createDevelopmentConfig(overrides = {}) {
    const devConfig = {
      logging: {
        enabled: true,
        level: 'debug'
      },
      metrics: {
        enabled: true,
        retention: 3600000 // 1 hora
      },
      apis: {
        config: {
          retry: {
            maxAttempts: 1
          },
          circuitBreaker: {
            enabled: false
          }
        }
      },
      webhooks: {
        config: {
          server: {
            port: 3001
          },
          delivery: {
            maxRetries: 1
          }
        }
      }
    };
        
    return this.mergeConfigs(DEFAULT_INTEGRATION_CONFIG, this.mergeConfigs(devConfig, overrides));
  }
    
  /**
     * Crea configuración optimizada para producción
     */
  static createProductionConfig(overrides = {}) {
    const prodConfig = {
      logging: {
        enabled: true,
        level: 'warn'
      },
      metrics: {
        enabled: true,
        retention: 604800000 // 7 días
      },
      apis: {
        config: {
          retry: {
            maxAttempts: 5
          },
          circuitBreaker: {
            enabled: true
          },
          rateLimit: {
            enabled: true
          }
        }
      },
      webhooks: {
        config: {
          security: {
            signature: {
              enabled: true
            }
          },
          delivery: {
            maxRetries: 5
          }
        }
      }
    };
        
    return this.mergeConfigs(DEFAULT_INTEGRATION_CONFIG, this.mergeConfigs(prodConfig, overrides));
  }
    
  /**
     * Obtiene información del sistema
     */
  static getSystemInfo() {
    return {
      version: '1.0.0',
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
    
  /**
     * Formatea estadísticas para visualización
     */
  static formatStats(stats) {
    return {
      summary: {
        totalIntegrations: stats.totalIntegrations,
        activeIntegrations: stats.activeIntegrations,
        totalRequests: stats.totalRequests,
        successRate: stats.totalRequests > 0 ? 
          ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) + '%' : '0%',
        averageResponseTime: stats.averageResponseTime ? 
          stats.averageResponseTime.toFixed(2) + 'ms' : '0ms'
      },
      sync: {
        totalJobs: stats.syncJobs.total,
        successfulJobs: stats.syncJobs.successful,
        failedJobs: stats.syncJobs.failed,
        successRate: stats.syncJobs.total > 0 ? 
          ((stats.syncJobs.successful / stats.syncJobs.total) * 100).toFixed(2) + '%' : '0%'
      },
      integrations: stats.integrations,
      components: stats.components
    };
  }
    
  /**
     * Genera configuración de mapeo básica
     */
  static generateBasicMapping(sourceFields, targetFields) {
    const mapping = {};
        
    sourceFields.forEach((sourceField, index) => {
      if (targetFields[index]) {
        mapping[targetFields[index]] = sourceField;
      }
    });
        
    return mapping;
  }
    
  /**
     * Valida URL de webhook
     */
  static validateWebhookURL(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
    
  /**
     * Genera firma de webhook
     */
  static generateWebhookSignature(payload, secret, algorithm = 'sha256') {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }
    
  /**
     * Verifica firma de webhook
     */
  static verifyWebhookSignature(payload, signature, secret, algorithm = 'sha256') {
    const expectedSignature = this.generateWebhookSignature(payload, secret, algorithm);
    return signature === expectedSignature;
  }
}

/**
 * Funciones de fábrica para crear instancias
 */

/**
 * Crea una instancia de APIManager
 */
function createAPIManager(config = {}) {
  const finalConfig = IntegrationUtils.mergeConfigs(
    DEFAULT_INTEGRATION_CONFIG.apis.config,
    config
  );
    
  return new APIManager(finalConfig);
}

/**
 * Obtiene la instancia del servicio unificado de webhooks
 */
function getUnifiedWebhookService() {
  return unifiedWebhookService;
}

/**
 * Crea una instancia de IntegrationManager
 */
function createIntegrationManager(config = {}) {
  const finalConfig = IntegrationUtils.mergeConfigs(
    DEFAULT_INTEGRATION_CONFIG,
    config
  );
    
  return new IntegrationManager(finalConfig);
}

/**
 * Crea un sistema completo de integraciones
 */
async function createIntegrationSystem(config = {}) {
  const finalConfig = IntegrationUtils.mergeConfigs(
    DEFAULT_INTEGRATION_CONFIG,
    config
  );
    
  const apiManager = createAPIManager(finalConfig.apis.config);
  const integrationManager = createIntegrationManager(finalConfig);
  
  // Inicializar managers
  await apiManager.initialize();
  await integrationManager.initialize();
  
  return {
    apiManager,
    webhookService: unifiedWebhookService,
    integrationManager,
    config: finalConfig
  };
}

// Exportaciones ES Modules
export {
  // Clases principales
  APIManager,
  IntegrationManager,
    
  // Services
  unifiedWebhookService,
    
  // Configuración y constantes
  DEFAULT_INTEGRATION_CONFIG,
  INTEGRATION_CONSTANTS,
    
  // Utilidades
  IntegrationUtils,
    
  // Funciones de fábrica
  createAPIManager,
  getUnifiedWebhookService,
  createIntegrationManager,
  createIntegrationSystem
};

// Exportación por defecto
export default {
  APIManager,
  IntegrationManager,
  unifiedWebhookService,
  DEFAULT_INTEGRATION_CONFIG,
  INTEGRATION_CONSTANTS,
  IntegrationUtils,
  createAPIManager,
  getUnifiedWebhookService,
  createIntegrationManager,
  createIntegrationSystem
};
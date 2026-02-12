import NotificationManager from '../NotificationManager.js';
import TemplateEngine from '../TemplateEngine.js';
import NotificationScheduler from '../NotificationScheduler.js';

// Proveedores de notificación
import PushProvider from './providers/PushProvider.js';
import WebhookProvider from './providers/WebhookProvider.js';
import SlackProvider from './providers/SlackProvider.js';

/**
 * Configuración por defecto del sistema de notificaciones
 */
const DEFAULT_NOTIFICATION_CONFIG = {
  // Configuración general
  enabled: true,
  environment: process.env.NODE_ENV || 'development',
  debug: process.env.NODE_ENV !== 'production',
    
  // Configuración del gestor de notificaciones
  manager: {
    maxConcurrentNotifications: 100,
    defaultPriority: 'medium',
    enableBatching: true,
    batchSize: 50,
    batchTimeout: 5000,
    enableRetries: true,
    maxRetries: 3,
    retryDelay: 1000,
    enableDeduplication: true,
    deduplicationWindow: 300000, // 5 minutos
    enableRateLimiting: true,
    globalRateLimit: {
      maxPerSecond: 10,
      maxPerMinute: 500,
      maxPerHour: 5000
    }
  },
    
  // Configuración de canales
  channels: {
    push: {
      enabled: false,
      priority: 3,
      provider: 'PushProvider',
      config: {
        fcm: {
          enabled: true,
          serverKey: process.env.FCM_SERVER_KEY || '',
          projectId: process.env.FCM_PROJECT_ID || ''
        },
        apns: {
          enabled: false,
          keyId: process.env.APNS_KEY_ID || '',
          teamId: process.env.APNS_TEAM_ID || '',
          bundleId: process.env.APNS_BUNDLE_ID || ''
        }
      }
    },
    webhook: {
      enabled: false,
      priority: 4,
      provider: 'WebhookProvider',
      config: {
        webhooks: {
          default: {
            url: process.env.WEBHOOK_URL || '',
            method: 'POST',
            auth: {
              type: 'bearer',
              token: process.env.WEBHOOK_TOKEN || ''
            }
          }
        }
      }
    },
    slack: {
      enabled: false,
      priority: 5,
      provider: 'SlackProvider',
      config: {
        slack: {
          botToken: process.env.SLACK_BOT_TOKEN || '',
          webhookUrl: process.env.SLACK_WEBHOOK_URL || ''
        },
        channels: {
          default: '#general',
          alerts: '#alerts',
          notifications: '#notifications'
        }
      }
    }
  },
    
  // Configuración del motor de plantillas
  templates: {
    engine: 'handlebars',
    directory: './templates',
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 3600000 // 1 hora
    },
    localization: {
      enabled: false,
      defaultLocale: 'en',
      directory: './locales'
    },
    formats: ['html', 'text', 'markdown'],
    helpers: {
      builtin: true,
      custom: {}
    }
  },
    
  // Configuración del programador
  scheduler: {
    enabled: true,
    timezone: process.env.TZ || 'UTC',
    persistence: {
      type: 'memory',
      file: './data/scheduled-jobs.json'
    },
    execution: {
      maxConcurrency: 10,
      maxRetries: 3,
      timeout: 30000
    },
    cron: {
      precision: 'second',
      maxJobs: 1000
    }
  },
    
  // Configuración de colas
  queues: {
    type: 'memory', // memory, redis, database
    maxSize: 10000,
    priority: {
      enabled: true,
      levels: ['low', 'medium', 'high', 'urgent']
    },
    persistence: {
      enabled: false,
      interval: 60000
    },
    workers: {
      count: 5,
      concurrency: 10
    }
  },
    
  // Configuración de filtros
  filters: {
    duplicates: {
      enabled: true,
      window: 300000, // 5 minutos
      fields: ['recipient', 'title', 'message']
    },
    rateLimit: {
      enabled: true,
      perRecipient: {
        maxPerMinute: 10,
        maxPerHour: 100,
        maxPerDay: 500
      }
    },
    blacklist: {
      enabled: false,
      recipients: [],
      domains: []
    }
  },
    
  // Configuración de tracking
  tracking: {
    enabled: true,
    delivery: {
      enabled: true,
      timeout: 300000 // 5 minutos
    },
    opens: {
      enabled: false,
      trackingPixel: true
    },
    clicks: {
      enabled: false,
      trackingLinks: true
    },
    bounces: {
      enabled: true,
      handleBounces: true
    },
    complaints: {
      enabled: true,
      handleComplaints: true
    },
    unsubscribes: {
      enabled: false,
      handleUnsubscribes: true
    }
  },
    
  // Configuración de analytics
  analytics: {
    enabled: true,
    retention: {
      events: 30, // días
      metrics: 90, // días
      reports: 365 // días
    },
    aggregation: {
      enabled: true,
      intervals: ['hour', 'day', 'week', 'month']
    },
    metrics: {
      delivery: true,
      engagement: true,
      performance: true,
      errors: true
    }
  }
};

/**
 * Utilidades del sistema de notificaciones
 */
class NotificationUtils {
  /**
     * Valida una configuración de notificación
     */
  static validateConfig(config) {
    const errors = [];
        
    // Validar configuración de canales
    if (!config.channels || Object.keys(config.channels).length === 0) {
      errors.push('At least one notification channel must be configured');
    }
        
    // Validar canales habilitados
    const enabledChannels = Object.entries(config.channels)
      .filter(([_, channelConfig]) => channelConfig.enabled);
        
    if (enabledChannels.length === 0) {
      errors.push('At least one notification channel must be enabled');
    }
        
    // Validar configuración de proveedores
    for (const [channelName, channelConfig] of enabledChannels) {
      if (!channelConfig.provider) {
        errors.push(`Channel '${channelName}' must specify a provider`);
      }
            
      if (!channelConfig.config) {
        errors.push(`Channel '${channelName}' must have configuration`);
      }
    }
        
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
        
    return true;
  }
    
  /**
     * Combina configuraciones
     */
  static mergeConfigs(defaultConfig, userConfig) {
    return this._deepMerge(defaultConfig, userConfig);
  }
    
  /**
     * Crea una configuración optimizada para desarrollo
     */
  static createDevelopmentConfig(overrides = {}) {
    return this.mergeConfigs(DEFAULT_NOTIFICATION_CONFIG, {
      environment: 'development',
      debug: true,
      manager: {
        enableRetries: false,
        enableRateLimiting: false
      },
      channels: {
        email: {
          enabled: true,
          config: {
            smtp: {
              host: 'localhost',
              port: 1025, // MailHog default port
              secure: false,
              auth: false
            }
          }
        }
      },
      scheduler: {
        persistence: {
          type: 'memory'
        }
      },
      queues: {
        type: 'memory',
        persistence: {
          enabled: false
        }
      },
      ...overrides
    });
  }
    
  /**
     * Crea una configuración optimizada para producción
     */
  static createProductionConfig(overrides = {}) {
    return this.mergeConfigs(DEFAULT_NOTIFICATION_CONFIG, {
      environment: 'production',
      debug: false,
      manager: {
        enableRetries: true,
        enableRateLimiting: true,
        enableDeduplication: true
      },
      scheduler: {
        persistence: {
          type: 'file'
        }
      },
      queues: {
        type: 'redis',
        persistence: {
          enabled: true
        }
      },
      tracking: {
        enabled: true,
        delivery: { enabled: true },
        opens: { enabled: true },
        clicks: { enabled: true }
      },
      analytics: {
        enabled: true,
        retention: {
          events: 90,
          metrics: 365,
          reports: 1095 // 3 años
        }
      },
      ...overrides
    });
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
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };
  }
    
  /**
     * Formatea estadísticas para visualización
     */
  static formatStats(stats) {
    return {
      summary: {
        total: stats.sent + stats.failed,
        sent: stats.sent,
        failed: stats.failed,
        successRate: stats.sent + stats.failed > 0 
          ? ((stats.sent / (stats.sent + stats.failed)) * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        lastSent: stats.lastSent ? new Date(stats.lastSent).toISOString() : null,
        errors: stats.errors,
        averageResponseTime: stats.averageResponseTime || 0
      },
      details: stats
    };
  }
    
  // Método privado para merge profundo
  static _deepMerge(target, source) {
    const result = { ...target };
        
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
        
    return result;
  }
}

/**
 * Constantes del sistema de notificaciones
 */
const NOTIFICATION_CONSTANTS = {
  // Eventos del sistema
  EVENTS: {
    INITIALIZED: 'initialized',
    NOTIFICATION_SENT: 'notification:sent',
    NOTIFICATION_FAILED: 'notification:failed',
    NOTIFICATION_DELIVERED: 'notification:delivered',
    NOTIFICATION_OPENED: 'notification:opened',
    NOTIFICATION_CLICKED: 'notification:clicked',
    NOTIFICATION_BOUNCED: 'notification:bounced',
    NOTIFICATION_COMPLAINED: 'notification:complained',
    NOTIFICATION_UNSUBSCRIBED: 'notification:unsubscribed',
    PROVIDER_INITIALIZED: 'provider:initialized',
    PROVIDER_ERROR: 'provider:error',
    PROVIDER_HEALTH_CHECK: 'provider:health',
    SCHEDULER_JOB_SCHEDULED: 'scheduler:job:scheduled',
    SCHEDULER_JOB_EXECUTED: 'scheduler:job:executed',
    SCHEDULER_JOB_FAILED: 'scheduler:job:failed',
    TEMPLATE_COMPILED: 'template:compiled',
    TEMPLATE_RENDERED: 'template:rendered',
    TEMPLATE_ERROR: 'template:error',
    QUEUE_ADDED: 'queue:added',
    QUEUE_PROCESSED: 'queue:processed',
    QUEUE_FAILED: 'queue:failed'
  },
    
  // Estados del sistema
  STATES: {
    INITIALIZED: 'initialized',
    READY: 'ready',
    PROCESSING: 'processing',
    ERROR: 'error',
    DESTROYED: 'destroyed'
  },
    
  // Prioridades de notificación
  PRIORITIES: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  },
    
  // Tipos de notificación
  TYPES: {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    ALERT: 'alert'
  },
    
  // Canales de notificación
  CHANNELS: {
    PUSH: 'push',
    WEBHOOK: 'webhook',
    SLACK: 'slack',
    DISCORD: 'discord',
    CONSOLE: 'console'
  },
    
  // Estados de notificación
  NOTIFICATION_STATES: {
    PENDING: 'pending',
    QUEUED: 'queued',
    PROCESSING: 'processing',
    SENT: 'sent',
    DELIVERED: 'delivered',
    FAILED: 'failed',
    BOUNCED: 'bounced',
    COMPLAINED: 'complained',
    UNSUBSCRIBED: 'unsubscribed'
  },
    
  // Formatos de plantilla
  TEMPLATE_FORMATS: {
    HTML: 'html',
    TEXT: 'text',
    MARKDOWN: 'markdown',
    JSON: 'json'
  },
    
  // Motores de plantilla
  TEMPLATE_ENGINES: {
    HANDLEBARS: 'handlebars',
    MUSTACHE: 'mustache',
    EJS: 'ejs',
    CUSTOM: 'custom'
  }
};

/**
 * Funciones de fábrica para crear instancias
 */

/**
 * Crea una instancia del gestor de notificaciones
 */
function createNotificationManager(config = {}) {
  const finalConfig = NotificationUtils.mergeConfigs(DEFAULT_NOTIFICATION_CONFIG, config);
  return new NotificationManager(finalConfig);
}

/**
 * Crea una instancia del motor de plantillas
 */
function createTemplateEngine(config = {}) {
  const finalConfig = NotificationUtils.mergeConfigs(
    DEFAULT_NOTIFICATION_CONFIG.templates, 
    config
  );
  return new TemplateEngine(finalConfig);
}

/**
 * Crea una instancia del programador de notificaciones
 */
function createNotificationScheduler(config = {}) {
  const finalConfig = NotificationUtils.mergeConfigs(
    DEFAULT_NOTIFICATION_CONFIG.scheduler, 
    config
  );
  return new NotificationScheduler(finalConfig);
}

/**
 * Crea un proveedor de notificaciones
 */
function createProvider(type, config = {}) {
  const providers = {
    push: PushProvider,
    webhook: WebhookProvider,
    slack: SlackProvider
  };
  
  const ProviderClass = providers[type.toLowerCase()];
  if (!ProviderClass) {
    throw new Error(`Unknown provider type: ${type}`);
  }
  
  return new ProviderClass(config);
}

/**
 * Crea un sistema completo de notificaciones
 */
async function createNotificationSystem(config = {}) {
  const finalConfig = NotificationUtils.mergeConfigs(DEFAULT_NOTIFICATION_CONFIG, config);
    
  // Validar configuración
  NotificationUtils.validateConfig(finalConfig);
    
  // Crear componentes
  const manager = createNotificationManager(finalConfig);
  const templateEngine = createTemplateEngine(finalConfig.templates);
  const scheduler = createNotificationScheduler(finalConfig.scheduler);
    
  // Crear y registrar proveedores
  const providers = {};
  for (const [channelName, channelConfig] of Object.entries(finalConfig.channels)) {
    if (channelConfig.enabled) {
      const providerType = channelConfig.provider.replace('Provider', '').toLowerCase();
      const provider = createProvider(providerType, channelConfig.config);
      providers[channelName] = provider;
            
      // Registrar proveedor en el gestor
      manager.registerProvider(channelName, provider);
    }
  }
    
  // Registrar motor de plantillas
  manager.registerTemplateEngine(templateEngine);
    
  // Registrar programador
  manager.registerScheduler(scheduler);
    
  // Inicializar sistema
  await manager.initialize();
    
  return {
    manager,
    templateEngine,
    scheduler,
    providers,
    config: finalConfig,
        
    // Métodos de conveniencia
    send: (notification) => manager.send(notification),
    sendBatch: (notifications) => manager.sendBatch(notifications),
    schedule: (notification, schedule) => manager.schedule(notification, schedule),
    getStats: () => manager.getStatistics(),
    getHealth: () => manager.checkHealth(),
    destroy: () => manager.destroy()
  };
}

// Exportaciones ES Modules
export {
  // Clases principales
  NotificationManager,
  TemplateEngine,
  NotificationScheduler,
  
  // Proveedores
  PushProvider,
  WebhookProvider,
  SlackProvider,
  
  // Configuración y utilidades
  DEFAULT_NOTIFICATION_CONFIG,
  NotificationUtils,
  NOTIFICATION_CONSTANTS,
  
  // Funciones de creación
  createNotificationManager,
  createTemplateEngine,
  createNotificationScheduler,
  createProvider,
  createNotificationSystem
};

// Exportación por defecto
export default {
  NotificationManager,
  TemplateEngine,
  NotificationScheduler,
  PushProvider,
  WebhookProvider,
  SlackProvider,
  DEFAULT_NOTIFICATION_CONFIG,
  NotificationUtils,
  NOTIFICATION_CONSTANTS,
  createNotificationManager,
  createTemplateEngine,
  createNotificationScheduler,
  createProvider,
  createNotificationSystem
};
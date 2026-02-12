/**
 * Configuración de Adaptadores de Comunicación
 * 
 * Configuración centralizada para todos los adaptadores del sistema
 * event-driven (WebSocket, Pub/Sub, MQTT, etc.)
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

// Configuración por defecto del AdapterManager
export const adapterManagerConfig = {
  // Adaptadores habilitados
  enabledAdapters: ['websocket', 'pubsub', 'mqtt'],
  
  // Configuración general
  autoStart: true,
  autoReconnect: true,
  
  // Configuración de failover
  enableFailover: true,
  failoverTimeout: 30000,
  primaryAdapter: 'websocket',
  
  // Configuración de load balancing
  enableLoadBalancing: false,
  loadBalancingStrategy: 'round-robin', // round-robin, least-connections, weighted
  
  // Configuración de broadcasting
  enableBroadcasting: true,
  broadcastFilters: [
    // Filtrar eventos de sistema interno
    (event) => !event.eventType?.startsWith('system:internal'),
    
    // Filtrar eventos de debug en producción
    (event) => process.env.NODE_ENV !== 'production' || event.level !== 'debug'
  ],
  
  // Configuración de métricas
  enableMetrics: true,
  metricsInterval: 60000, // 1 minuto
  
  // Configuración específica de adaptadores
  adapters: {
    websocket: {
      // Configuración WebSocket
      mode: 'server', // 'client' | 'server' | 'both'
      
      // Configuración del servidor
      server: {
        port: process.env.WS_PORT || 8080,
        host: process.env.WS_HOST || 'localhost',
        path: '/ws',
        
        // Configuración SSL/TLS
        ssl: {
          enabled: process.env.WS_SSL_ENABLED === 'true',
          cert: process.env.WS_SSL_CERT,
          key: process.env.WS_SSL_KEY,
          ca: process.env.WS_SSL_CA
        },
        
        // Configuración de autenticación
        auth: {
          enabled: process.env.WS_AUTH_ENABLED === 'true',
          secret: process.env.WS_AUTH_SECRET || 'default-secret',
          tokenExpiry: 3600000 // 1 hora
        }
      },
      
      // Configuración del cliente
      client: {
        url: process.env.WS_CLIENT_URL || 'ws://localhost:8080/ws',
        protocols: [],
        
        // Configuración de reconexión
        reconnect: {
          enabled: true,
          maxAttempts: 10,
          delay: 1000,
          backoff: 'exponential'
        }
      },
      
      // Configuración de mensajes
      message: {
        maxSize: 1024 * 1024, // 1MB
        compression: true,
        format: 'json' // 'json' | 'msgpack' | 'protobuf'
      },
      
      // Configuración de ping/pong
      ping: {
        enabled: true,
        interval: 30000,
        timeout: 5000
      },
      
      // Configuración de canales
      channels: {
        enabled: true,
        maxChannelsPerClient: 100,
        defaultChannel: 'general'
      }
    },
    
    pubsub: {
      // Proveedor de Pub/Sub
      provider: process.env.PUBSUB_PROVIDER || 'local', // 'redis' | 'gcp' | 'aws' | 'local'
      
      // Configuración de Redis
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        
        // Configuración de conexión
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        
        // Configuración de cluster
        cluster: {
          enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
          nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || []
        }
      },
      
      // Configuración de Google Cloud Pub/Sub
      gcp: {
        projectId: process.env.GCP_PROJECT_ID,
        keyFilename: process.env.GCP_KEY_FILENAME,
        
        // Configuración de suscripción
        subscription: {
          ackDeadlineSeconds: 60,
          maxMessages: 100,
          allowExcessMessages: false
        }
      },
      
      // Configuración de AWS SNS/SQS
      aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        
        // Configuración SNS
        sns: {
          topicArn: process.env.AWS_SNS_TOPIC_ARN
        },
        
        // Configuración SQS
        sqs: {
          queueUrl: process.env.AWS_SQS_QUEUE_URL,
          visibilityTimeout: 30,
          waitTimeSeconds: 20,
          maxNumberOfMessages: 10
        }
      },
      
      // Configuración de tópicos
      topics: {
        prefix: process.env.PUBSUB_TOPIC_PREFIX || 'chatbot',
        separator: ':',
        
        // Tópicos por defecto
        defaults: [
          'events',
          'notifications',
          'analytics',
          'errors'
        ]
      },
      
      // Configuración de mensajes
      message: {
        format: 'json',
        compression: true,
        maxSize: 256 * 1024, // 256KB
        ttl: 3600000, // 1 hora
        
        // Configuración de deduplicación
        deduplication: {
          enabled: true,
          windowSize: 300000, // 5 minutos
          maxEntries: 10000
        }
      }
    },
    
    mqtt: {
      // Configuración de conexión
      connection: {
        host: process.env.MQTT_HOST || 'localhost',
        port: process.env.MQTT_PORT || 1883,
        protocol: process.env.MQTT_PROTOCOL || 'mqtt', // 'mqtt' | 'mqtts' | 'ws' | 'wss'
        
        // Configuración de cliente
        clientId: process.env.MQTT_CLIENT_ID || `chatbot-${Date.now()}`,
        clean: true,
        keepalive: 60,
        connectTimeout: 30000,
        reconnectPeriod: 1000,
        
        // Configuración de autenticación
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        
        // Configuración SSL/TLS
        ssl: {
          enabled: process.env.MQTT_SSL_ENABLED === 'true',
          rejectUnauthorized: process.env.MQTT_SSL_REJECT_UNAUTHORIZED !== 'false',
          cert: process.env.MQTT_SSL_CERT,
          key: process.env.MQTT_SSL_KEY,
          ca: process.env.MQTT_SSL_CA
        }
      },
      
      // Configuración de Will Message
      will: {
        enabled: true,
        topic: 'chatbot/status',
        payload: JSON.stringify({ status: 'offline', timestamp: new Date().toISOString() }),
        qos: 1,
        retain: true
      },
      
      // Configuración de tópicos
      topics: {
        prefix: process.env.MQTT_TOPIC_PREFIX || 'chatbot',
        separator: '/',
        
        // Wildcards permitidos
        wildcards: {
          single: '+',
          multi: '#'
        },
        
        // Tópicos por defecto
        defaults: {
          events: 'events/+',
          commands: 'commands/+',
          status: 'status',
          metrics: 'metrics'
        }
      },
      
      // Configuración de QoS
      qos: {
        default: 1, // 0: At most once, 1: At least once, 2: Exactly once
        publish: 1,
        subscribe: 1
      },
      
      // Configuración de mensajes
      message: {
        retain: false,
        maxSize: 128 * 1024, // 128KB
        format: 'json',
        
        // Configuración de compresión
        compression: {
          enabled: true,
          threshold: 1024, // Comprimir mensajes > 1KB
          algorithm: 'gzip'
        }
      },
      
      // Configuración de retención
      retention: {
        enabled: true,
        maxMessages: 1000,
        ttl: 3600000 // 1 hora
      }
    }
  }
};

// Configuraciones específicas por entorno
export const environmentConfigs = {
  development: {
    enabledAdapters: ['websocket', 'pubsub'],
    enableMetrics: true,
    
    adapters: {
      websocket: {
        server: {
          port: 8080,
          host: 'localhost'
        }
      },
      pubsub: {
        provider: 'local'
      }
    }
  },
  
  testing: {
    enabledAdapters: ['websocket'],
    enableMetrics: false,
    autoStart: false,
    
    adapters: {
      websocket: {
        server: {
          port: 0, // Puerto aleatorio
          host: 'localhost'
        }
      }
    }
  },
  
  production: {
    enabledAdapters: ['websocket', 'pubsub', 'mqtt'],
    enableMetrics: true,
    enableFailover: true,
    enableLoadBalancing: true,
    
    adapters: {
      websocket: {
        server: {
          ssl: {
            enabled: true
          },
          auth: {
            enabled: true
          }
        }
      },
      pubsub: {
        provider: 'redis', // o 'gcp', 'aws'
        redis: {
          cluster: {
            enabled: true
          }
        }
      },
      mqtt: {
        connection: {
          ssl: {
            enabled: true
          }
        }
      }
    }
  }
};

// Configuración de logging específica para adaptadores
export const loggingConfig = {
  level: process.env.ADAPTER_LOG_LEVEL || 'info',
  
  // Configuración por adaptador
  adapters: {
    websocket: {
      level: 'info',
      logConnections: true,
      logMessages: false, // Solo en desarrollo
      logErrors: true
    },
    pubsub: {
      level: 'info',
      logPublish: false,
      logSubscribe: true,
      logErrors: true
    },
    mqtt: {
      level: 'info',
      logConnect: true,
      logPublish: false,
      logSubscribe: true,
      logErrors: true
    }
  }
};

// Configuración de métricas y monitoreo
export const metricsConfig = {
  enabled: process.env.METRICS_ENABLED !== 'false',
  interval: parseInt(process.env.METRICS_INTERVAL) || 60000,
  
  // Métricas a recopilar
  collect: {
    connections: true,
    messages: true,
    errors: true,
    latency: true,
    throughput: true,
    memory: true,
    cpu: false // Puede ser costoso
  },
  
  // Configuración de exportación
  export: {
    enabled: process.env.METRICS_EXPORT_ENABLED === 'true',
    format: 'prometheus', // 'prometheus' | 'json' | 'csv'
    endpoint: '/metrics',
    interval: 30000
  },
  
  // Configuración de alertas
  alerts: {
    enabled: process.env.ALERTS_ENABLED === 'true',
    
    thresholds: {
      errorRate: 0.05, // 5%
      latency: 1000, // 1 segundo
      memoryUsage: 0.8, // 80%
      connectionFailures: 10
    },
    
    // Canales de notificación
    channels: {
      email: process.env.ALERT_EMAIL,
      webhook: process.env.ALERT_WEBHOOK,
      slack: process.env.ALERT_SLACK_WEBHOOK
    }
  }
};

// Configuración de seguridad
export const securityConfig = {
  // Configuración de autenticación
  auth: {
    enabled: process.env.AUTH_ENABLED === 'true',
    secret: process.env.AUTH_SECRET || 'default-secret-change-in-production',
    algorithm: 'HS256',
    expiresIn: '1h',
    
    // Configuración de rate limiting
    rateLimit: {
      enabled: false, // Desactivado para pruebas
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // máximo 100 requests por ventana
      message: 'Too many requests from this IP'
    }
  },
  
  // Configuración de CORS
  cors: {
    enabled: true,
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  
  // Configuración de validación
  validation: {
    enabled: true,
    maxMessageSize: 1024 * 1024, // 1MB
    allowedEventTypes: [
      'message:*',
      'user:*',
      'system:*',
      'automation:*'
    ],
    
    // Sanitización
    sanitize: {
      enabled: true,
      removeScripts: true,
      removeHtml: false
    }
  }
};

/**
 * Obtener configuración completa para un entorno específico
 */
export function getAdapterConfig(environment = process.env.NODE_ENV || 'development') {
  const baseConfig = { ...adapterManagerConfig };
  const envConfig = environmentConfigs[environment] || {};
  
  // Merge configuraciones
  return mergeConfigs(baseConfig, envConfig);
}

/**
 * Merge profundo de configuraciones
 */
function mergeConfigs(base, override) {
  const result = { ...base };
  
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeConfigs(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Validar configuración de adaptador
 */
export function validateAdapterConfig(config) {
  const errors = [];
  
  // Validar adaptadores habilitados
  if (!config.enabledAdapters || !Array.isArray(config.enabledAdapters)) {
    errors.push('enabledAdapters debe ser un array');
  }
  
  // Validar configuración de adaptadores
  for (const adapterName of config.enabledAdapters || []) {
    if (!config.adapters || !config.adapters[adapterName]) {
      errors.push(`Configuración faltante para adaptador: ${adapterName}`);
    }
  }
  
  // Validar adaptador primario
  if (config.primaryAdapter && !config.enabledAdapters?.includes(config.primaryAdapter)) {
    errors.push(`Adaptador primario '${config.primaryAdapter}' no está habilitado`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  adapterManagerConfig,
  environmentConfigs,
  loggingConfig,
  metricsConfig,
  securityConfig,
  getAdapterConfig,
  validateAdapterConfig
};
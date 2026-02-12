/**
 * Configuración de Monitoreo de Rendimiento
 * Define métricas, umbrales y configuraciones para el análisis de rendimiento
 */

export default {
  // Configuración de métricas de rendimiento
  metrics: {
    // Métricas de respuesta HTTP
    http: {
      responseTime: {
        warning: 500,    // ms
        critical: 1000   // ms
      },
      throughput: {
        minimum: 100,    // requests/second
        target: 500      // requests/second
      },
      errorRate: {
        warning: 0.01,   // 1%
        critical: 0.05   // 5%
      }
    },
    
    // Métricas de base de datos
    database: {
      queryTime: {
        warning: 100,    // ms
        critical: 500    // ms
      },
      connectionPool: {
        warning: 0.8,    // 80% utilización
        critical: 0.95   // 95% utilización
      },
      slowQueries: {
        threshold: 1000, // ms
        maxCount: 10     // por minuto
      }
    },
    
    // Métricas de memoria
    memory: {
      heapUsed: {
        warning: 0.7,    // 70% del heap
        critical: 0.9    // 90% del heap
      },
      rss: {
        warning: 512,    // MB
        critical: 1024   // MB
      },
      external: {
        warning: 100,    // MB
        critical: 200    // MB
      }
    },
    
    // Métricas de CPU
    cpu: {
      usage: {
        warning: 70,     // %
        critical: 90     // %
      },
      loadAverage: {
        warning: 2.0,
        critical: 4.0
      }
    },
    
    // Métricas de red
    network: {
      latency: {
        warning: 50,     // ms
        critical: 100    // ms
      },
      bandwidth: {
        warning: 80,     // % utilización
        critical: 95     // % utilización
      }
    },
    
    // Métricas de aplicación específicas
    application: {
      messageProcessing: {
        warning: 200,    // ms por mensaje
        critical: 500    // ms por mensaje
      },
      queueSize: {
        warning: 1000,   // mensajes en cola
        critical: 5000   // mensajes en cola
      },
      activeConnections: {
        warning: 500,    // conexiones WebSocket
        critical: 1000   // conexiones WebSocket
      }
    }
  },
  
  // Configuración de alertas
  alerts: {
    channels: {
      email: {
        enabled: true,
        recipients: ['admin@company.com', 'dev-team@company.com'],
        severity: ['critical', 'warning']
      },
      slack: {
        enabled: true,
        webhook: process.env.SLACK_WEBHOOK_URL,
        channel: '#alerts',
        severity: ['critical']
      },
      sms: {
        enabled: false,
        numbers: ['+1234567890'],
        severity: ['critical']
      }
    },
    
    // Configuración de escalamiento
    escalation: {
      levels: [
        {
          time: 300,     // 5 minutos
          action: 'notify_team'
        },
        {
          time: 900,     // 15 minutos
          action: 'notify_manager'
        },
        {
          time: 1800,    // 30 minutos
          action: 'page_oncall'
        }
      ]
    },
    
    // Configuración de supresión
    suppression: {
      duplicateWindow: 300,  // 5 minutos
      maintenanceMode: false,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC'
      }
    }
  },
  
  // Configuración de recolección de datos
  collection: {
    interval: 30,        // segundos
    retention: {
      raw: 86400,        // 24 horas en segundos
      hourly: 2592000,   // 30 días en segundos
      daily: 31536000    // 1 año en segundos
    },
    
    // Configuración de muestreo
    sampling: {
      enabled: true,
      rate: 0.1,         // 10% de las requests
      excludePaths: [
        '/health',
        '/metrics',
        '/favicon.ico'
      ]
    }
  },
  
  // Configuración de profiling
  profiling: {
    enabled: process.env.NODE_ENV !== 'production',
    cpu: {
      enabled: true,
      sampleRate: 1000,  // microsegundos
      maxSamples: 10000
    },
    memory: {
      enabled: true,
      interval: 60000,   // 1 minuto
      heapSnapshot: {
        enabled: false,
        threshold: 0.9   // 90% heap usage
      }
    },
    
    // Configuración de flame graphs
    flameGraphs: {
      enabled: true,
      duration: 30,      // segundos
      outputDir: './performance/flame-graphs'
    }
  },
  
  // Configuración de benchmarks
  benchmarks: {
    enabled: true,
    scenarios: [
      {
        name: 'message_processing',
        description: 'Procesamiento de mensajes WhatsApp',
        target: 1000,     // requests/second
        duration: 60,     // segundos
        rampUp: 10        // segundos
      },
      {
        name: 'user_authentication',
        description: 'Autenticación de usuarios',
        target: 500,      // requests/second
        duration: 30,     // segundos
        rampUp: 5         // segundos
      },
      {
        name: 'database_queries',
        description: 'Consultas a base de datos',
        target: 2000,     // queries/second
        duration: 45,     // segundos
        rampUp: 10        // segundos
      }
    ]
  },
  
  // Configuración de reportes
  reporting: {
    enabled: true,
    schedule: {
      daily: '08:00',
      weekly: 'monday 09:00',
      monthly: '1st 10:00'
    },
    
    // Configuración de dashboards
    dashboards: {
      grafana: {
        enabled: true,
        url: process.env.GRAFANA_URL,
        apiKey: process.env.GRAFANA_API_KEY
      },
      custom: {
        enabled: true,
        port: 3001,
        path: '/performance-dashboard'
      }
    },
    
    // Configuración de exportación
    export: {
      formats: ['json', 'csv', 'pdf'],
      s3: {
        enabled: false,
        bucket: 'performance-reports',
        region: 'us-east-1'
      }
    }
  },
  
  // Configuración de optimización automática
  autoOptimization: {
    enabled: false,
    rules: [
      {
        condition: 'cpu_usage > 80',
        action: 'scale_horizontally',
        parameters: { instances: 2 }
      },
      {
        condition: 'memory_usage > 85',
        action: 'restart_gracefully',
        parameters: { delay: 30 }
      },
      {
        condition: 'response_time > 1000',
        action: 'enable_caching',
        parameters: { ttl: 300 }
      }
    ]
  }
};
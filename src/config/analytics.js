/**
 * =====================================================
 * ChatBot Enterprise - Analytics Configuration
 * =====================================================
 * 
 * Configuración principal para el sistema de analytics y métricas de negocio.
 */

import path from 'path';

/**
 * Configuración de Analytics
 */
const analyticsConfig = {
    // Configuración de caché
    cache: {
        enabled: process.env.ANALYTICS_CACHE_ENABLED === 'true' || true,
        ttl: parseInt(process.env.ANALYTICS_CACHE_TTL) || 300, // 5 minutos
        maxKeys: parseInt(process.env.ANALYTICS_CACHE_MAX_KEYS) || 1000
    },

    // Configuración de métricas
    metrics: {
        // Intervalos de tiempo soportados
        timeRanges: ['1h', '24h', '7d', '30d'],
        
        // Configuración de agregación
        aggregation: {
            batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE) || 1000,
            intervalMinutes: parseInt(process.env.ANALYTICS_INTERVAL_MINUTES) || 5
        },

        // Configuración de retención de datos
        retention: {
            rawData: parseInt(process.env.ANALYTICS_RAW_RETENTION_DAYS) || 30,
            aggregatedData: parseInt(process.env.ANALYTICS_AGGREGATED_RETENTION_DAYS) || 365
        }
    },

    // Configuración de alertas
    alerts: {
        enabled: process.env.ANALYTICS_ALERTS_ENABLED === 'true' || true,
        
        // Configuración de evaluación
        evaluation: {
            intervalMinutes: parseInt(process.env.ALERT_EVALUATION_INTERVAL) || 5,
            batchSize: parseInt(process.env.ALERT_BATCH_SIZE) || 100
        },

        // Configuración de cooldown
        cooldown: {
            critical: parseInt(process.env.ALERT_COOLDOWN_CRITICAL) || 300, // 5 minutos
            warning: parseInt(process.env.ALERT_COOLDOWN_WARNING) || 900,   // 15 minutos
            info: parseInt(process.env.ALERT_COOLDOWN_INFO) || 1800        // 30 minutos
        },

        // Configuración de notificaciones
        notifications: {
            enabled: process.env.ALERT_NOTIFICATIONS_ENABLED === 'true' || true,
            channels: {
                email: {
                    enabled: process.env.ALERT_EMAIL_ENABLED === 'true' || false,
                    from: process.env.ALERT_EMAIL_FROM || 'alerts@chatbot-enterprise.com',
                    smtp: {
                        host: process.env.SMTP_HOST,
                        port: parseInt(process.env.SMTP_PORT) || 587,
                        secure: process.env.SMTP_SECURE === 'true' || false,
                        auth: {
                            user: process.env.SMTP_USER,
                            pass: process.env.SMTP_PASS
                        }
                    }
                },
                slack: {
                    enabled: process.env.ALERT_SLACK_ENABLED === 'true' || false,
                    webhookUrl: process.env.SLACK_WEBHOOK_URL,
                    channel: process.env.SLACK_CHANNEL || '#alerts',
                    username: process.env.SLACK_USERNAME || 'ChatBot Alerts'
                },
                webhook: {
                    enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true' || false,
                    url: process.env.ALERT_WEBHOOK_URL,
                    timeout: parseInt(process.env.ALERT_WEBHOOK_TIMEOUT) || 5000
                },
                sms: {
                    enabled: false, // SMS deshabilitado - Twilio removido
                    provider: 'disabled', // Twilio removido del proyecto
                    // Configuración SMS deshabilitada
                }
            }
        }
    },

    // Configuración de reportes
    reports: {
        enabled: process.env.ANALYTICS_REPORTS_ENABLED === 'true' || true,
        
        // Directorio de almacenamiento
        storage: {
            directory: process.env.REPORTS_STORAGE_DIR || path.join(process.cwd(), 'storage', 'reports'),
            maxSizeMB: parseInt(process.env.REPORTS_MAX_SIZE_MB) || 100,
            retentionDays: parseInt(process.env.REPORTS_RETENTION_DAYS) || 30
        },

        // Configuración de formatos
        formats: {
            excel: {
                enabled: true,
                maxRows: parseInt(process.env.EXCEL_MAX_ROWS) || 100000
            },
            pdf: {
                enabled: true,
                pageSize: process.env.PDF_PAGE_SIZE || 'A4',
                orientation: process.env.PDF_ORIENTATION || 'portrait'
            },
            csv: {
                enabled: true,
                delimiter: process.env.CSV_DELIMITER || ',',
                encoding: process.env.CSV_ENCODING || 'utf8'
            }
        }
    },

    // Configuración de dashboards
    dashboards: {
        enabled: process.env.ANALYTICS_DASHBOARDS_ENABLED === 'true' || true,
        
        // Configuración de actualización
        refresh: {
            intervalSeconds: parseInt(process.env.DASHBOARD_REFRESH_INTERVAL) || 30,
            autoRefresh: process.env.DASHBOARD_AUTO_REFRESH === 'true' || true
        },

        // Configuración de exportación
        export: {
            enabled: true,
            formats: ['json', 'excel', 'pdf'],
            maxDataPoints: parseInt(process.env.DASHBOARD_MAX_DATA_POINTS) || 10000
        }
    },

    // Configuración de logging
    logging: {
        enabled: process.env.ANALYTICS_LOGGING_ENABLED === 'true' || true,
        level: process.env.ANALYTICS_LOG_LEVEL || 'info',
        
        // Configuración de archivos de log
        files: {
            enabled: process.env.ANALYTICS_LOG_FILES_ENABLED === 'true' || true,
            directory: process.env.ANALYTICS_LOG_DIR || path.join(process.cwd(), 'logs', 'analytics'),
            maxSize: process.env.ANALYTICS_LOG_MAX_SIZE || '10m',
            maxFiles: parseInt(process.env.ANALYTICS_LOG_MAX_FILES) || 5
        }
    },

    // Configuración de performance
    performance: {
        // Configuración de timeouts
        timeouts: {
            query: parseInt(process.env.ANALYTICS_QUERY_TIMEOUT) || 30000,
            report: parseInt(process.env.ANALYTICS_REPORT_TIMEOUT) || 120000,
            export: parseInt(process.env.ANALYTICS_EXPORT_TIMEOUT) || 60000
        },

        // Configuración de límites
        limits: {
            maxConcurrentQueries: parseInt(process.env.ANALYTICS_MAX_CONCURRENT_QUERIES) || 10,
            maxResultRows: parseInt(process.env.ANALYTICS_MAX_RESULT_ROWS) || 50000,
            maxMemoryUsageMB: parseInt(process.env.ANALYTICS_MAX_MEMORY_MB) || 512
        }
    }
};

/**
 * Reglas de alerta predefinidas
 */
const defaultAlertRules = [
    {
        name: 'Tiempo de Respuesta Crítico',
        metric: 'averageResponseTime',
        operator: '>',
        threshold: 300, // 5 minutos
        severity: 'critical',
        enabled: true,
        description: 'Tiempo de respuesta promedio superior a 5 minutos'
    },
    {
        name: 'Baja Satisfacción del Cliente',
        metric: 'customerSatisfactionScore',
        operator: '<',
        threshold: 3.0,
        severity: 'warning',
        enabled: true,
        description: 'Puntuación de satisfacción del cliente inferior a 3.0'
    },
    {
        name: 'Baja Tasa de Resolución',
        metric: 'conversationResolutionRate',
        operator: '<',
        threshold: 0.8, // 80%
        severity: 'warning',
        enabled: true,
        description: 'Tasa de resolución de conversaciones inferior al 80%'
    },
    {
        name: 'Pico de Volumen de Conversaciones',
        metric: 'activeConversations',
        operator: '>',
        threshold: 100,
        severity: 'info',
        enabled: true,
        description: 'Número de conversaciones activas superior a 100'
    },
    {
        name: 'Alta Utilización de Agentes',
        metric: 'agentUtilization',
        operator: '>',
        threshold: 0.9, // 90%
        severity: 'warning',
        enabled: true,
        description: 'Utilización de agentes superior al 90%'
    },
    {
        name: 'Conversaciones Pendientes',
        metric: 'pendingConversations',
        operator: '>',
        threshold: 20,
        severity: 'critical',
        enabled: true,
        description: 'Número de conversaciones pendientes superior a 20'
    }
];

/**
 * Configuración de KPIs
 */
const kpiConfig = {
    // KPIs principales
    primary: [
        'conversationResolutionRate',
        'averageResponseTime',
        'customerSatisfactionScore',
        'agentUtilization'
    ],

    // KPIs secundarios
    secondary: [
        'firstContactResolution',
        'conversationVolume',
        'messageVolume',
        'channelDistribution'
    ],

    // Configuración de cálculo
    calculation: {
        // Intervalos de actualización (en minutos)
        updateIntervals: {
            realTime: 1,
            hourly: 60,
            daily: 1440
        },

        // Configuración de agregación
        aggregation: {
            methods: ['avg', 'sum', 'count', 'min', 'max'],
            windows: ['1h', '24h', '7d', '30d']
        }
    }
};

export {
    analyticsConfig,
    defaultAlertRules,
    kpiConfig
};

export default analyticsConfig;
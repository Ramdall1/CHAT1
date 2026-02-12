# Herramientas de Debugging y Monitoreo

## Descripción General

Este documento describe las herramientas avanzadas de debugging y monitoreo implementadas en el sistema, incluyendo análisis de rendimiento, monitoreo de salud del sistema y dashboard web interactivo.

## Componentes

### 1. DebugMonitor

Herramienta principal para debugging y métricas en tiempo real.

#### Características
- Rastreo de errores con contexto
- Métricas de requests HTTP
- Monitoreo de memoria y CPU
- Profiling de funciones
- Alertas automáticas

#### API Principal

```javascript
import DebugMonitor from '../utils/DebugMonitor.js';

const monitor = new DebugMonitor({
  enableMetrics: true,
  enableProfiling: true,
  metricsInterval: 1000,
  maxErrorHistory: 100,
  maxRequestHistory: 1000
});

// Inicializar
await monitor.start();

// Rastrear errores
monitor.trackError(error, { 
  context: 'UserService',
  userId: '12345',
  operation: 'createUser'
});

// Rastrear requests
monitor.trackRequest('POST', '/api/users', 201, 250, {
  userId: '12345',
  userAgent: 'Mozilla/5.0...'
});

// Obtener métricas actuales
const metrics = monitor.getMetrics();
console.log(metrics);
/*
{
  requests: {
    total: 1250,
    successful: 1180,
    failed: 70,
    averageResponseTime: 180,
    requestsPerSecond: 12.5
  },
  errors: {
    total: 45,
    byType: { ValidationError: 20, DatabaseError: 15, ... },
    recentErrors: [...]
  },
  system: {
    memoryUsage: { used: 125.5, total: 512, percentage: 24.5 },
    cpuUsage: 15.2,
    uptime: 3600000
  }
}
*/

// Generar reporte
const report = monitor.generateReport();
```

#### Configuración Avanzada

```javascript
const monitor = new DebugMonitor({
  // Métricas
  enableMetrics: true,
  metricsInterval: 1000,
  
  // Profiling
  enableProfiling: true,
  profilingThreshold: 100, // ms
  
  // Historial
  maxErrorHistory: 100,
  maxRequestHistory: 1000,
  maxMetricsHistory: 500,
  
  // Alertas
  alertThresholds: {
    errorRate: 0.05,        // 5%
    responseTime: 2000,     // 2s
    memoryUsage: 0.8,       // 80%
    cpuUsage: 0.7          // 70%
  },
  
  // Callbacks
  onAlert: (alert) => {
    console.log('🚨 Alerta:', alert);
  },
  onError: (error, context) => {
    console.log('❌ Error rastreado:', error.message);
  }
});
```

### 2. PerformanceProfiler

Análisis detallado de rendimiento y detección de cuellos de botella.

#### Características
- Profiling automático de funciones
- Análisis de Performance API
- Detección de memory leaks
- Monitoreo de garbage collection
- Reportes detallados de rendimiento

#### API Principal

```javascript
import PerformanceProfiler from '../utils/PerformanceProfiler.js';

const profiler = new PerformanceProfiler({
  enableGCMonitoring: true,
  enableMemoryProfiling: true,
  sampleInterval: 100,
  maxSamples: 1000
});

await profiler.start();

// Medir función específica
const result = await profiler.measureFunction('processData', async () => {
  return await processLargeDataset(data);
});

console.log(result);
/*
{
  result: [...], // Resultado de la función
  performance: {
    duration: 1250,
    memoryDelta: 15.5,
    cpuTime: 890
  }
}
*/

// Profiling automático
const wrappedFunction = profiler.wrapFunction('calculateTotal', calculateTotal);
const total = await wrappedFunction(items); // Automáticamente profileado

// Iniciar sesión de profiling
const sessionId = profiler.startProfilingSession('user-checkout');
// ... operaciones a profilear ...
const sessionData = profiler.endProfilingSession(sessionId);

// Análisis de cuellos de botella
const bottlenecks = profiler.analyzeBottlenecks();
console.log(bottlenecks);
/*
[
  {
    function: 'processPayment',
    averageDuration: 2500,
    callCount: 150,
    totalTime: 375000,
    impact: 'high'
  },
  ...
]
*/
```

#### Configuración de Observadores

```javascript
const profiler = new PerformanceProfiler({
  observers: {
    measure: true,      // Mediciones personalizadas
    navigation: true,   // Navegación (frontend)
    resource: true,     // Carga de recursos
    paint: true,        // Eventos de pintado
    layout: true        // Cambios de layout
  },
  
  gcMonitoring: {
    enabled: true,
    threshold: 10       // MB
  },
  
  memoryProfiling: {
    enabled: true,
    interval: 5000,     // 5s
    threshold: 50       // MB de cambio
  }
});
```

### 3. SystemHealthMonitor

Monitoreo integral del estado del sistema y servicios.

#### Características
- Health checks personalizados
- Monitoreo de recursos del sistema
- Verificación de conectividad
- Alertas configurables
- Reportes de salud históricos

#### API Principal

```javascript
import SystemHealthMonitor from '../utils/SystemHealthMonitor.js';

const healthMonitor = new SystemHealthMonitor({
  checkInterval: 30000,
  retryAttempts: 3,
  retryDelay: 5000,
  alertThresholds: {
    memory: 0.8,
    cpu: 0.7,
    disk: 0.9,
    responseTime: 5000
  }
});

// Health checks personalizados
healthMonitor.addHealthCheck('database', async () => {
  try {
    await database.ping();
    const connectionCount = await database.getConnectionCount();
    
    return {
      status: 'healthy',
      details: {
        connected: true,
        connections: connectionCount,
        maxConnections: 100
      },
      responseTime: 50
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: error.message },
      responseTime: null
    };
  }
});

healthMonitor.addHealthCheck('redis', async () => {
  const ping = await redis.ping();
  return {
    status: ping === 'PONG' ? 'healthy' : 'unhealthy',
    details: { ping },
    responseTime: 25
  };
});

healthMonitor.addHealthCheck('external-api', async () => {
  const start = Date.now();
  try {
    const response = await fetch('https://api.external.com/health');
    const responseTime = Date.now() - start;
    
    return {
      status: response.ok ? 'healthy' : 'degraded',
      details: { 
        statusCode: response.status,
        url: response.url
      },
      responseTime
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: error.message },
      responseTime: Date.now() - start
    };
  }
});

// Registrar servicios
healthMonitor.registerService('user-service', {
  url: 'http://localhost:3001/health',
  timeout: 5000,
  critical: true
});

healthMonitor.registerService('notification-service', {
  url: 'http://localhost:3002/health',
  timeout: 3000,
  critical: false
});

await healthMonitor.start();

// Obtener estado actual
const health = healthMonitor.getSystemHealth();
console.log(health);
/*
{
  status: 'healthy', // healthy, degraded, unhealthy
  timestamp: '2024-01-15T10:30:45.123Z',
  uptime: 3600000,
  checks: {
    database: { status: 'healthy', responseTime: 50, ... },
    redis: { status: 'healthy', responseTime: 25, ... },
    'external-api': { status: 'degraded', responseTime: 2500, ... }
  },
  services: {
    'user-service': { status: 'healthy', ... },
    'notification-service': { status: 'unhealthy', ... }
  },
  system: {
    memory: { used: 2.1, total: 8, percentage: 26.25 },
    cpu: { usage: 15.5, cores: 8 },
    disk: { used: 45.2, total: 256, percentage: 17.66 }
  },
  alerts: [
    {
      type: 'service_down',
      service: 'notification-service',
      timestamp: '2024-01-15T10:25:30.000Z',
      severity: 'warning'
    }
  ]
}
*/
```

#### Configuración de Alertas

```javascript
const healthMonitor = new SystemHealthMonitor({
  alertThresholds: {
    memory: 0.85,
    cpu: 0.80,
    disk: 0.90,
    responseTime: 5000
  },
  
  alertCallbacks: {
    onServiceDown: (service, details) => {
      console.log(`🔴 Servicio caído: ${service}`);
      // Enviar notificación
    },
    
    onHighMemory: (usage) => {
      console.log(`⚠️ Alto uso de memoria: ${usage.percentage}%`);
      // Trigger garbage collection o restart
    },
    
    onHighCPU: (usage) => {
      console.log(`⚠️ Alto uso de CPU: ${usage}%`);
      // Escalar recursos
    },
    
    onSlowResponse: (check, responseTime) => {
      console.log(`🐌 Respuesta lenta en ${check}: ${responseTime}ms`);
      // Investigar performance
    }
  }
});
```

### 4. DebugDashboard

Interfaz web interactiva para visualización en tiempo real.

#### Características
- Dashboard web responsive
- Métricas en tiempo real con WebSockets
- Logs en vivo con filtros
- Visualización de health checks
- Exportación de datos
- Autenticación opcional

#### API Principal

```javascript
import DebugDashboard from '../utils/DebugDashboard.js';

const dashboard = new DebugDashboard({
  port: 3001,
  enableAuth: true,
  credentials: {
    username: 'admin',
    password: 'debug123'
  },
  
  // Configuración de la interfaz
  ui: {
    title: 'Sistema de Monitoreo',
    theme: 'dark',
    refreshInterval: 1000,
    maxLogEntries: 1000
  },
  
  // Configuración de datos
  data: {
    retentionPeriod: 24 * 60 * 60 * 1000, // 24 horas
    compressionEnabled: true,
    exportFormats: ['json', 'csv', 'xlsx']
  }
});

// Registrar monitores
dashboard.registerMonitor('debug', debugMonitor);
dashboard.registerMonitor('performance', performanceProfiler);
dashboard.registerMonitor('health', systemHealthMonitor);

// Añadir logs personalizados
dashboard.addLogEntry('info', 'Sistema iniciado', {
  module: 'App',
  version: '1.0.0'
});

// Métricas personalizadas
dashboard.addMetric('custom', 'active_users', 150);
dashboard.addMetric('business', 'revenue_today', 2500.75);

// Eventos personalizados
dashboard.addEvent('deployment', {
  version: '1.2.0',
  timestamp: new Date(),
  details: { branch: 'main', commit: 'abc123' }
});

await dashboard.start();
console.log('Dashboard disponible en: http://localhost:3001');
```

#### Rutas del Dashboard

- **`/`** - Dashboard principal con métricas en tiempo real
- **`/logs`** - Visualizador de logs con filtros
- **`/health`** - Estado del sistema y health checks
- **`/performance`** - Análisis de rendimiento y profiling
- **`/alerts`** - Alertas activas y historial
- **`/api/metrics`** - API REST para métricas
- **`/api/logs`** - API REST para logs
- **`/api/export`** - Exportación de datos

#### Personalización de la Interfaz

```javascript
const dashboard = new DebugDashboard({
  ui: {
    title: 'Mi Sistema de Monitoreo',
    logo: '/assets/logo.png',
    theme: 'dark', // 'light', 'dark', 'auto'
    
    // Widgets personalizados
    widgets: [
      {
        type: 'metric',
        title: 'Usuarios Activos',
        source: 'custom.active_users',
        format: 'number'
      },
      {
        type: 'chart',
        title: 'Requests por Minuto',
        source: 'debug.requests',
        chartType: 'line',
        timeRange: '1h'
      },
      {
        type: 'status',
        title: 'Estado de Servicios',
        source: 'health.services'
      }
    ],
    
    // Configuración de gráficos
    charts: {
      defaultTimeRange: '1h',
      refreshInterval: 5000,
      maxDataPoints: 100
    }
  }
});
```

## Integración Completa

### Configuración de Desarrollo

```javascript
// config/debug.development.js
export default {
  debugMonitor: {
    enableMetrics: true,
    enableProfiling: true,
    metricsInterval: 1000
  },
  
  performanceProfiler: {
    enableGCMonitoring: true,
    enableMemoryProfiling: true,
    sampleInterval: 100
  },
  
  systemHealthMonitor: {
    checkInterval: 10000,
    alertThresholds: {
      memory: 0.9,
      cpu: 0.8
    }
  },
  
  debugDashboard: {
    port: 3001,
    enableAuth: false,
    ui: { theme: 'dark' }
  }
};
```

### Configuración de Producción

```javascript
// config/debug.production.js
export default {
  debugMonitor: {
    enableMetrics: true,
    enableProfiling: false,
    metricsInterval: 5000
  },
  
  performanceProfiler: {
    enableGCMonitoring: false,
    enableMemoryProfiling: true,
    sampleInterval: 1000
  },
  
  systemHealthMonitor: {
    checkInterval: 30000,
    alertThresholds: {
      memory: 0.8,
      cpu: 0.7
    }
  },
  
  debugDashboard: {
    port: 3001,
    enableAuth: true,
    credentials: process.env.DEBUG_CREDENTIALS,
    ui: { theme: 'light' }
  }
};
```

### Inicialización Automática

```javascript
// src/utils/index.js - función initializeDebugSuite
import { initializeDebugSuite } from '../utils/index.js';

// En tu aplicación principal
async function startApp() {
  // Inicializar suite de debugging
  const debugSuite = await initializeDebugSuite(process.env.NODE_ENV);
  
  // Configurar middleware de logging
  app.use((req, res, next) => {
    debugSuite.debugMonitor.trackRequest(
      req.method,
      req.url,
      res.statusCode,
      Date.now() - req.startTime
    );
    next();
  });
  
  // Configurar manejo de errores
  app.use((error, req, res, next) => {
    debugSuite.debugMonitor.trackError(error, {
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    next(error);
  });
  
  console.log('🔧 Sistema de debugging inicializado');
  console.log(`📊 Dashboard disponible en: http://localhost:${debugSuite.dashboard.port}`);
}
```

## Casos de Uso Comunes

### 1. Debugging de Performance

```javascript
// Identificar funciones lentas
const profiler = new PerformanceProfiler();
await profiler.start();

// Después de un tiempo...
const bottlenecks = profiler.analyzeBottlenecks();
bottlenecks.forEach(bottleneck => {
  if (bottleneck.impact === 'high') {
    console.log(`🐌 Cuello de botella: ${bottleneck.function}`);
    console.log(`   Tiempo promedio: ${bottleneck.averageDuration}ms`);
    console.log(`   Llamadas: ${bottleneck.callCount}`);
  }
});
```

### 2. Monitoreo de Servicios Críticos

```javascript
// Configurar monitoreo de servicios críticos
const healthMonitor = new SystemHealthMonitor();

healthMonitor.addHealthCheck('payment-gateway', async () => {
  const response = await fetch('https://payments.api.com/health');
  return {
    status: response.ok ? 'healthy' : 'unhealthy',
    details: { statusCode: response.status }
  };
});

healthMonitor.onAlert('service_down', (service) => {
  if (service === 'payment-gateway') {
    // Activar sistema de pagos de respaldo
    activateBackupPaymentSystem();
  }
});
```

### 3. Análisis de Errores en Tiempo Real

```javascript
// Rastrear y analizar errores
const debugMonitor = new DebugMonitor();

debugMonitor.onError((error, context) => {
  // Agrupar errores similares
  const errorSignature = `${error.name}:${error.message}`;
  
  if (debugMonitor.getErrorCount(errorSignature) > 10) {
    console.log('🚨 Error frecuente detectado:', errorSignature);
    // Enviar alerta al equipo de desarrollo
  }
});
```

### 4. Dashboard Personalizado

```javascript
// Crear dashboard específico para el negocio
const dashboard = new DebugDashboard({
  ui: {
    widgets: [
      {
        type: 'metric',
        title: 'Ventas Hoy',
        source: 'business.sales_today',
        format: 'currency'
      },
      {
        type: 'chart',
        title: 'Usuarios Activos',
        source: 'business.active_users',
        chartType: 'area'
      },
      {
        type: 'status',
        title: 'Estado de Pagos',
        source: 'health.payment_gateway'
      }
    ]
  }
});

// Actualizar métricas de negocio
setInterval(() => {
  dashboard.addMetric('business', 'sales_today', getCurrentSales());
  dashboard.addMetric('business', 'active_users', getActiveUsers());
}, 60000);
```

## Mejores Prácticas

### 1. Configuración por Ambiente

- **Desarrollo**: Todas las herramientas habilitadas, intervalos cortos
- **Staging**: Configuración similar a producción pero con más detalle
- **Producción**: Solo métricas esenciales, intervalos más largos

### 2. Gestión de Recursos

- Configurar límites de memoria para historiales
- Usar compresión para datos históricos
- Implementar rotación automática de logs

### 3. Seguridad

- Habilitar autenticación en producción
- Filtrar información sensible en logs
- Usar HTTPS para el dashboard

### 4. Alertas Inteligentes

- Configurar umbrales apropiados para evitar spam
- Implementar escalación de alertas
- Usar diferentes canales según la severidad

## Troubleshooting

### Problemas Comunes

1. **Dashboard no carga**
   - Verificar que el puerto esté disponible
   - Comprobar configuración de firewall
   - Revisar logs de errores del dashboard

2. **Métricas no se actualizan**
   - Verificar que los monitores estén iniciados
   - Comprobar intervalos de actualización
   - Revisar conexión WebSocket

3. **Alto uso de memoria**
   - Reducir tamaños de historial
   - Aumentar intervalos de limpieza
   - Deshabilitar profiling en producción

4. **Alertas falsas**
   - Ajustar umbrales de alertas
   - Implementar períodos de gracia
   - Usar promedios móviles en lugar de valores instantáneos

### Configuración de Logs de Debug

```javascript
// Habilitar logs detallados para debugging
const debugMonitor = new DebugMonitor({
  debug: true,
  logLevel: 'debug',
  logToConsole: true
});

// Ver logs internos del sistema
debugMonitor.on('internal-log', (level, message, data) => {
  console.log(`[${level.toUpperCase()}] ${message}`, data);
});
```

## Conclusión

Las herramientas de debugging y monitoreo proporcionan una visibilidad completa del sistema, permitiendo:

- **Detección temprana** de problemas
- **Análisis detallado** de rendimiento
- **Monitoreo proactivo** de la salud del sistema
- **Debugging eficiente** de errores
- **Optimización continua** del rendimiento

Su uso adecuado mejora significativamente la confiabilidad y el rendimiento de la aplicación.
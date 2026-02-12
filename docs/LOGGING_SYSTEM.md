# Sistema de Logging Centralizado

## Descripción General

El sistema de logging centralizado proporciona una solución robusta y escalable para el registro de eventos, errores y métricas en toda la aplicación. Incluye herramientas avanzadas de debugging, monitoreo de rendimiento y análisis del estado del sistema.

## Componentes Principales

### 1. Logger Principal (`src/utils/logger.js`)

El logger principal proporciona diferentes niveles de logging con formato estructurado y rotación automática de archivos.

#### Niveles de Logging
- **debug**: Información detallada para debugging
- **info**: Información general del sistema
- **warn**: Advertencias que no interrumpen el funcionamiento
- **error**: Errores que requieren atención

#### Uso Básico

```javascript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ModuleName');

// Logging básico
logger.info('Sistema iniciado correctamente');
logger.warn('Variable de entorno faltante', { variable: 'API_KEY' });
logger.error('Error en la conexión', { error: error.message });
logger.debug('Datos de debugging', { data: debugData });
```

#### Configuración

```javascript
const logger = createLogger('ModuleName', {
  level: 'info',           // Nivel mínimo de logging
  enableConsole: true,     // Mostrar en consola
  enableFile: true,        // Guardar en archivo
  maxFiles: 5,            // Máximo archivos de rotación
  maxSize: '10m'          // Tamaño máximo por archivo
});
```

### 2. Frontend Logger (`src/utils/FrontendLogger.js`)

Logger especializado para el frontend con capacidades de envío al servidor.

```javascript
import FrontendLogger from '../utils/FrontendLogger.js';

const logger = new FrontendLogger({
  endpoint: '/api/logs',
  batchSize: 10,
  flushInterval: 5000
});

// Uso en el frontend
logger.info('Usuario autenticado', { userId: user.id });
logger.error('Error en la interfaz', { component: 'LoginForm' });
```

## Herramientas de Debugging y Monitoreo

### 1. Debug Monitor (`src/utils/DebugMonitor.js`)

Proporciona capacidades avanzadas de debugging y métricas en tiempo real.

```javascript
import DebugMonitor from '../utils/DebugMonitor.js';

const debugMonitor = new DebugMonitor({
  enableMetrics: true,
  enableProfiling: true,
  metricsInterval: 1000
});

// Iniciar monitoreo
await debugMonitor.start();

// Rastrear errores
debugMonitor.trackError(error, { context: 'UserService' });

// Rastrear requests
debugMonitor.trackRequest('GET', '/api/users', 200, 150);

// Obtener métricas
const metrics = debugMonitor.getMetrics();
```

### 2. Performance Profiler (`src/utils/PerformanceProfiler.js`)

Análisis detallado de rendimiento y detección de cuellos de botella.

```javascript
import PerformanceProfiler from '../utils/PerformanceProfiler.js';

const profiler = new PerformanceProfiler();

// Iniciar profiling
await profiler.start();

// Medir función
const result = await profiler.measureFunction(
  'processData',
  () => processLargeDataset(data)
);

// Obtener reporte de rendimiento
const report = profiler.generateReport();
```

### 3. System Health Monitor (`src/utils/SystemHealthMonitor.js`)

Monitoreo del estado del sistema y recursos.

```javascript
import SystemHealthMonitor from '../utils/SystemHealthMonitor.js';

const healthMonitor = new SystemHealthMonitor({
  checkInterval: 30000,
  alertThresholds: {
    memory: 0.8,
    cpu: 0.7
  }
});

// Añadir health check personalizado
healthMonitor.addHealthCheck('database', async () => {
  const isConnected = await database.ping();
  return {
    status: isConnected ? 'healthy' : 'unhealthy',
    details: { connected: isConnected }
  };
});

// Iniciar monitoreo
await healthMonitor.start();
```

### 4. Debug Dashboard (`src/utils/DebugDashboard.js`)

Interfaz web para visualización de métricas y logs en tiempo real.

```javascript
import DebugDashboard from '../utils/DebugDashboard.js';

const dashboard = new DebugDashboard({
  port: 3001,
  enableAuth: true,
  credentials: { username: 'admin', password: 'debug123' }
});

// Registrar monitores
dashboard.registerMonitor('debug', debugMonitor);
dashboard.registerMonitor('performance', profiler);
dashboard.registerMonitor('health', healthMonitor);

// Iniciar dashboard
await dashboard.start();
// Acceder en: http://localhost:3001
```

## Configuración Completa

### Inicialización Rápida

```javascript
import { initializeDebugSuite } from '../utils/index.js';

// Configuración para desarrollo
const debugSuite = await initializeDebugSuite('development');

// Configuración para producción
const debugSuite = await initializeDebugSuite('production');
```

### Configuración Manual

```javascript
import {
  DebugMonitor,
  PerformanceProfiler,
  SystemHealthMonitor,
  DebugDashboard
} from '../utils/index.js';

// Configurar cada componente individualmente
const debugMonitor = new DebugMonitor({ enableMetrics: true });
const profiler = new PerformanceProfiler();
const healthMonitor = new SystemHealthMonitor();
const dashboard = new DebugDashboard({ port: 3001 });

// Inicializar
await Promise.all([
  debugMonitor.start(),
  profiler.start(),
  healthMonitor.start(),
  dashboard.start()
]);
```

## Integración en la Aplicación

### En el Servidor Principal

```javascript
// src/app.js
import { createLogger } from './utils/logger.js';
import { initializeDebugSuite } from './utils/index.js';

const logger = createLogger('App');

async function main() {
  try {
    // Inicializar sistema de debugging
    const debugSuite = await initializeDebugSuite(process.env.NODE_ENV);
    
    logger.info('🚀 Sistema iniciado correctamente', {
      environment: process.env.NODE_ENV,
      port: process.env.PORT
    });
    
    // Resto de la inicialización...
    
  } catch (error) {
    logger.error('Error al inicializar la aplicación', { error: error.message });
    process.exit(1);
  }
}
```

### En Servicios

```javascript
// src/services/UserService.js
import { createLogger } from '../utils/logger.js';

const logger = createLogger('UserService');

class UserService {
  async createUser(userData) {
    try {
      logger.info('Creando nuevo usuario', { email: userData.email });
      
      const user = await this.database.create(userData);
      
      logger.info('Usuario creado exitosamente', { 
        userId: user.id,
        email: user.email 
      });
      
      return user;
    } catch (error) {
      logger.error('Error al crear usuario', {
        error: error.message,
        userData: { email: userData.email }
      });
      throw error;
    }
  }
}
```

### En Middleware

```javascript
// src/middleware/requestLogger.js
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RequestLogger');

export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('Request completado', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
}
```

## Archivos de Log

### Estructura de Directorios

```
logs/
├── app.log              # Log principal de la aplicación
├── error.log            # Solo errores
├── info.log             # Información general
├── warn.log             # Advertencias
├── archived/            # Logs archivados por rotación
├── metrics/             # Métricas de rendimiento
├── performance/         # Datos de profiling
└── security/           # Logs de seguridad
```

### Formato de Logs

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "module": "UserService",
  "message": "Usuario creado exitosamente",
  "metadata": {
    "userId": "12345",
    "email": "user@example.com"
  },
  "requestId": "req-abc123",
  "sessionId": "sess-xyz789"
}
```

## Mejores Prácticas

### 1. Uso de Niveles Apropiados

- **debug**: Solo para desarrollo, información muy detallada
- **info**: Eventos importantes del sistema
- **warn**: Situaciones que requieren atención pero no son críticas
- **error**: Errores que requieren intervención inmediata

### 2. Información Contextual

```javascript
// ✅ Bueno: Incluir contexto relevante
logger.error('Error en autenticación', {
  userId: user.id,
  attemptedAction: 'login',
  ipAddress: req.ip,
  error: error.message
});

// ❌ Malo: Información insuficiente
logger.error('Error');
```

### 3. Evitar Información Sensible

```javascript
// ✅ Bueno: Omitir datos sensibles
logger.info('Usuario autenticado', {
  userId: user.id,
  email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2')
});

// ❌ Malo: Exponer información sensible
logger.info('Usuario autenticado', {
  password: user.password,
  token: user.accessToken
});
```

### 4. Manejo de Errores

```javascript
// ✅ Bueno: Log completo del error
try {
  await riskyOperation();
} catch (error) {
  logger.error('Error en operación crítica', {
    error: error.message,
    stack: error.stack,
    operation: 'riskyOperation',
    context: { userId, sessionId }
  });
  throw error;
}
```

## Monitoreo y Alertas

### Configuración de Alertas

```javascript
const healthMonitor = new SystemHealthMonitor({
  alertThresholds: {
    memory: 0.85,           // 85% de uso de memoria
    cpu: 0.80,              // 80% de uso de CPU
    errorRate: 0.05,        // 5% de tasa de errores
    responseTime: 2000      // 2 segundos de tiempo de respuesta
  },
  alertCallbacks: {
    onHighMemory: (metrics) => {
      logger.warn('Alto uso de memoria detectado', metrics);
      // Enviar notificación
    },
    onHighErrorRate: (metrics) => {
      logger.error('Alta tasa de errores detectada', metrics);
      // Enviar alerta crítica
    }
  }
});
```

### Dashboard Web

El dashboard web está disponible en `http://localhost:3001` (configurable) y proporciona:

- **Métricas en tiempo real**: CPU, memoria, requests/segundo
- **Logs en vivo**: Stream de logs con filtros
- **Estado del sistema**: Health checks y servicios
- **Alertas activas**: Notificaciones y problemas detectados
- **Análisis de rendimiento**: Gráficos y estadísticas

## Troubleshooting

### Problemas Comunes

1. **Logs no aparecen en archivos**
   - Verificar permisos de escritura en directorio `logs/`
   - Comprobar configuración `enableFile: true`

2. **Dashboard no accesible**
   - Verificar que el puerto no esté en uso
   - Comprobar configuración de firewall

3. **Alto uso de memoria**
   - Ajustar `maxFiles` y `maxSize` en configuración
   - Implementar rotación más frecuente

4. **Pérdida de logs en producción**
   - Configurar `flushInterval` más bajo
   - Usar logging síncrono para errores críticos

### Configuración de Producción

```javascript
const productionConfig = {
  level: 'info',
  enableConsole: false,
  enableFile: true,
  maxFiles: 10,
  maxSize: '50m',
  enableMetrics: true,
  enableProfiling: false,
  dashboardEnabled: false
};
```

## Migración desde Console.log

Para migrar código existente que usa `console.log`:

1. **Reemplazar console.log**:
   ```javascript
   // Antes
   console.log('Usuario creado:', user);
   
   // Después
   logger.info('Usuario creado', { userId: user.id, email: user.email });
   ```

2. **Reemplazar console.error**:
   ```javascript
   // Antes
   console.error('Error:', error);
   
   // Después
   logger.error('Error en operación', { error: error.message, stack: error.stack });
   ```

3. **Usar herramientas de búsqueda**:
   ```bash
   # Buscar todos los console.log
   grep -r "console\." src/
   
   # Reemplazar automáticamente (con cuidado)
   sed -i 's/console\.log/logger.info/g' src/**/*.js
   ```

## Conclusión

El sistema de logging centralizado proporciona una base sólida para el monitoreo, debugging y análisis de la aplicación. Su uso consistente mejora significativamente la capacidad de diagnosticar problemas y optimizar el rendimiento del sistema.
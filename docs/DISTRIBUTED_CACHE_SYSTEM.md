# Sistema de Cache Distribuido

## Descripción General

El sistema de cache distribuido implementado proporciona una solución robusta y escalable para el almacenamiento en cache de datos en la aplicación de chatbot. Utiliza Redis como backend y ofrece funcionalidades avanzadas como clustering, monitoreo, invalidación inteligente y múltiples estrategias de cache.

## Arquitectura

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    Cache System                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Cache Manager   │  │ Cache Strategies│  │ Invalidation │ │
│  │                 │  │                 │  │              │ │
│  │ - Connections   │  │ - Session       │  │ - Patterns   │ │
│  │ - Operations    │  │ - User          │  │ - Dependencies│ │
│  │ - Clustering    │  │ - Conversation  │  │ - Events     │ │
│  │ - Metrics       │  │ - Template      │  │ - Strategies │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Monitoring      │  │ Configuration   │  │ Utilities    │ │
│  │                 │  │                 │  │              │ │
│  │ - Metrics       │  │ - Environments  │  │ - Key Utils  │ │
│  │ - Alerts        │  │ - Validation    │  │ - Serialization│ │
│  │ - Health Checks │  │ - Profiles      │  │ - TTL Utils  │ │
│  │ - Reports       │  │ - Docker        │  │ - Patterns   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Middleware      │  │ Initializer     │                   │
│  │                 │  │                 │                   │
│  │ - HTTP Cache    │  │ - Startup       │                   │
│  │ - Profiles      │  │ - Health Check  │                   │
│  │ - Compression   │  │ - Dependencies  │                   │
│  │ - Metrics       │  │ - Cleanup       │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

```
Request → Middleware → Cache Check → Strategy → Redis → Response
    ↓         ↓           ↓           ↓         ↓        ↓
Metrics → Monitoring → Invalidation → Config → Cluster → Logs
```

## Instalación y Configuración

### Dependencias

```bash
npm install ioredis
npm install zlib  # Para compresión
```

### Variables de Entorno

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Cluster Configuration (opcional)
REDIS_CLUSTER_ENABLED=false
REDIS_CLUSTER_NODES=host1:port1,host2:port2

# Monitoring
CACHE_MONITORING_ENABLED=true
CACHE_MONITORING_INTERVAL=30000

# Performance
CACHE_COMPRESSION_ENABLED=true
CACHE_COMPRESSION_THRESHOLD=1024
```

### Inicialización

```javascript
import { initializeCache } from './src/services/cache/index.js';

// Inicialización básica
await initializeCache();

// Inicialización con opciones personalizadas
await initializeCache({
  redis: {
    host: 'redis-server',
    port: 6379,
    password: 'secret'
  },
  monitoring: {
    enabled: true,
    interval: 60000
  },
  compression: {
    enabled: true,
    threshold: 2048
  }
});
```

## Uso del Sistema

### Cache Manager

```javascript
import { getCacheManager } from './src/services/cache/index.js';

const cacheManager = await getCacheManager();

// Operaciones básicas
await cacheManager.set('user:123', userData, 3600);
const user = await cacheManager.get('user:123');
await cacheManager.del('user:123');

// Operaciones avanzadas
await cacheManager.mget(['user:123', 'user:456']);
await cacheManager.remember('expensive:operation', async () => {
  return await expensiveOperation();
}, 1800);

// Pipeline operations
const pipeline = cacheManager.pipeline();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
await pipeline.exec();
```

### Estrategias de Cache

```javascript
import { CacheStrategies } from './src/services/cache/index.js';

// Cache de sesión
await CacheStrategies.session.set(sessionId, sessionData);
const session = await CacheStrategies.session.get(sessionId);

// Cache de usuario
await CacheStrategies.user.set(userId, userData);
const user = await CacheStrategies.user.get(userId);

// Cache de conversación
await CacheStrategies.conversation.set(convId, convData);
const conversation = await CacheStrategies.conversation.get(convId);

// Precarga de datos
await CacheStrategies.user.preload(userIds);
await CacheStrategies.conversation.preload(conversationIds);
```

### Middleware HTTP

```javascript
import { advancedCacheMiddleware, CACHE_PROFILES } from './src/services/cache/index.js';

// Usar perfiles predefinidos
app.get('/api/users', advancedCacheMiddleware(CACHE_PROFILES.dynamic), getUsersHandler);
app.get('/api/static', advancedCacheMiddleware(CACHE_PROFILES.static), getStaticHandler);

// Configuración personalizada
app.get('/api/custom', advancedCacheMiddleware({
  ttl: 300,
  tags: ['users', 'api'],
  compression: true,
  staleWhileRevalidate: 60,
  condition: (req) => req.user?.role === 'admin'
}), getCustomHandler);
```

### Invalidación de Cache

```javascript
import { cacheInvalidation } from './src/services/cache/index.js';

// Invalidación manual
await cacheInvalidation.invalidateKey('user:123');
await cacheInvalidation.invalidatePattern('user:*');
await cacheInvalidation.invalidateTag('users');

// Invalidación por eventos
cacheInvalidation.emit('dataChanged', {
  entity: 'user',
  id: '123',
  action: 'update'
});

// Registrar patrones de invalidación
cacheInvalidation.registerPattern('userUpdate', {
  keyPattern: 'user:*',
  triggers: ['userAction'],
  strategy: 'immediate'
});
```

## Configuración Avanzada

### Perfiles de Entorno

```javascript
// Desarrollo
const devConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    maxMemory: '100mb'
  },
  monitoring: {
    enabled: true,
    interval: 30000
  }
};

// Producción
const prodConfig = {
  redis: {
    host: 'redis-cluster',
    port: 6379,
    maxMemory: '2gb',
    cluster: {
      enabled: true,
      nodes: [
        { host: 'redis-1', port: 6379 },
        { host: 'redis-2', port: 6379 },
        { host: 'redis-3', port: 6379 }
      ]
    }
  },
  monitoring: {
    enabled: true,
    interval: 60000,
    alerts: {
      enabled: true,
      thresholds: {
        memoryUsage: 80,
        hitRate: 70,
        responseTime: 100
      }
    }
  }
};
```

### Tipos de Cache Personalizados

```javascript
const customCacheTypes = {
  analytics: {
    ttl: 3600,
    maxSize: 1000,
    strategy: 'lru',
    compression: true,
    keyPrefix: 'analytics',
    cluster: true
  },
  reports: {
    ttl: 7200,
    maxSize: 500,
    strategy: 'ttl',
    compression: true,
    keyPrefix: 'reports',
    cluster: false
  }
};
```

## Monitoreo y Métricas

### Métricas Disponibles

```javascript
import { getSystemMetrics } from './src/services/cache/index.js';

const metrics = await getSystemMetrics();
console.log(metrics);

// Salida ejemplo:
{
  manager: {
    operations: {
      total: 15420,
      hits: 12336,
      misses: 3084,
      hitRate: 80.0
    },
    performance: {
      avgResponseTime: 2.5,
      p95ResponseTime: 8.2,
      throughput: 156.7
    },
    memory: {
      used: '245MB',
      available: '1.75GB',
      usage: 12.3
    }
  },
  monitoring: {
    status: 'healthy',
    alerts: [],
    uptime: 86400
  }
}
```

### Health Checks

```javascript
import { healthCheck } from './src/services/cache/index.js';

const health = await healthCheck();
console.log(health);

// Salida ejemplo:
{
  healthy: true,
  components: {
    manager: { healthy: true, latency: 2.1 },
    monitoring: { status: 'healthy', uptime: 86400 },
    system: { initialized: true, components: {...} }
  },
  timestamp: '2024-01-15T10:30:00.000Z'
}
```

### Alertas

```javascript
// Configurar alertas personalizadas
cacheMonitoring.addAlert('highMemoryUsage', {
  condition: (metrics) => metrics.memory.usage > 85,
  message: 'Uso de memoria alto: {usage}%',
  severity: 'warning',
  cooldown: 300000 // 5 minutos
});

cacheMonitoring.addAlert('lowHitRate', {
  condition: (metrics) => metrics.performance.hitRate < 70,
  message: 'Tasa de aciertos baja: {hitRate}%',
  severity: 'critical',
  cooldown: 600000 // 10 minutos
});
```

## Optimización de Rendimiento

### Estrategias de TTL

```javascript
import { CacheTTLUtils } from './src/services/cache/index.js';

// TTL dinámico basado en tipo de datos
const ttl = CacheTTLUtils.getDynamicTTL('user', dataSize, accessFrequency);

// TTL con jitter para evitar thundering herd
const jitteredTTL = CacheTTLUtils.addJitter(3600, 10); // ±10%

// Verificar proximidad a expiración
const isNearExpiration = CacheTTLUtils.isNearExpiration(remainingTTL, originalTTL, 0.1);
```

### Compresión

```javascript
import { CacheSerializationUtils } from './src/services/cache/index.js';

// Serialización con compresión automática
const serialized = await CacheSerializationUtils.serialize(largeData, {
  compression: true,
  format: 'json'
});

// Deserialización
const deserialized = await CacheSerializationUtils.deserialize(serialized, {
  compression: true,
  format: 'json'
});
```

### Clustering

```javascript
// Configuración de cluster Redis
const clusterConfig = {
  cluster: {
    enabled: true,
    nodes: [
      { host: 'redis-1', port: 6379 },
      { host: 'redis-2', port: 6379 },
      { host: 'redis-3', port: 6379 }
    ],
    options: {
      enableReadyCheck: true,
      redisOptions: {
        password: 'cluster-password'
      }
    }
  }
};
```

## Patrones de Uso Comunes

### Cache-Aside Pattern

```javascript
async function getUser(userId) {
  // 1. Intentar obtener del cache
  let user = await cacheManager.get(`user:${userId}`);
  
  if (!user) {
    // 2. Si no está en cache, obtener de la base de datos
    user = await database.getUser(userId);
    
    // 3. Guardar en cache para futuras consultas
    await cacheManager.set(`user:${userId}`, user, 1800);
  }
  
  return user;
}
```

### Write-Through Pattern

```javascript
async function updateUser(userId, userData) {
  // 1. Actualizar en la base de datos
  await database.updateUser(userId, userData);
  
  // 2. Actualizar en cache
  await cacheManager.set(`user:${userId}`, userData, 1800);
  
  // 3. Invalidar caches relacionados
  await cacheInvalidation.invalidatePattern(`user:${userId}:*`);
}
```

### Write-Behind Pattern

```javascript
async function updateUserAsync(userId, userData) {
  // 1. Actualizar inmediatamente en cache
  await cacheManager.set(`user:${userId}`, userData, 1800);
  
  // 2. Programar actualización en base de datos
  await writeQueue.add('updateUser', { userId, userData });
  
  return userData;
}
```

## Troubleshooting

### Problemas Comunes

#### 1. Conexión a Redis Fallida

```javascript
// Verificar configuración
const config = cacheConfig.getRedisConfig();
console.log('Redis Config:', config);

// Verificar conectividad
const health = await distributedCacheManager.healthCheck();
console.log('Health:', health);
```

#### 2. Memoria Insuficiente

```javascript
// Verificar uso de memoria
const metrics = await cacheManager.getMetrics();
console.log('Memory Usage:', metrics.memory);

// Limpiar cache si es necesario
await cacheManager.flush();
```

#### 3. Baja Tasa de Aciertos

```javascript
// Analizar patrones de acceso
const stats = await cacheManager.getStats();
console.log('Hit Rate:', stats.hitRate);

// Ajustar TTLs
const newTTL = CacheTTLUtils.getDynamicTTL(dataType, size, frequency);
```

### Logs y Debugging

```javascript
import { CacheDebugUtils } from './src/services/cache/index.js';

// Habilitar logging detallado
const debugInfo = CacheDebugUtils.generateDebugInfo('get', key, data);
console.log('Debug Info:', debugInfo);

// Log de operaciones
CacheDebugUtils.logCacheOperation('set', key, result, duration);
```

## Migración y Mantenimiento

### Migración de Datos

```javascript
// Script de migración
async function migrateCacheData() {
  const oldKeys = await cacheManager.keys('old:*');
  
  for (const oldKey of oldKeys) {
    const data = await cacheManager.get(oldKey);
    const newKey = oldKey.replace('old:', 'new:');
    
    await cacheManager.set(newKey, data);
    await cacheManager.del(oldKey);
  }
}
```

### Backup y Restore

```javascript
// Backup de configuración
const config = cacheConfig.exportConfig('json');
fs.writeFileSync('cache-config-backup.json', config);

// Restore de configuración
const backupConfig = fs.readFileSync('cache-config-backup.json', 'utf8');
cacheConfig.importConfig(backupConfig, 'json');
```

## Roadmap Futuro

### Funcionalidades Planificadas

1. **Cache Warming Inteligente**
   - Precarga automática basada en patrones de uso
   - Predicción de datos necesarios

2. **Particionamiento Automático**
   - Distribución inteligente de datos
   - Balanceado de carga automático

3. **Machine Learning Integration**
   - Optimización automática de TTLs
   - Detección de anomalías

4. **Multi-Region Support**
   - Replicación entre regiones
   - Failover automático

5. **Advanced Analytics**
   - Dashboards en tiempo real
   - Reportes de rendimiento

## Conclusión

El sistema de cache distribuido implementado proporciona una base sólida y escalable para las necesidades de caching de la aplicación. Con sus múltiples estrategias, monitoreo avanzado y capacidades de invalidación inteligente, está diseñado para manejar cargas de trabajo complejas y crecer con las necesidades del negocio.

Para más información o soporte, consulte la documentación adicional en el directorio `docs/` o contacte al equipo de desarrollo.
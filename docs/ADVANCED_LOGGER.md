# AdvancedTestLogger - Sistema de Logging Avanzado

## Descripción General

El `AdvancedTestLogger` es un sistema de logging robusto diseñado específicamente para entornos de testing que requiere máxima observabilidad y análisis detallado de fallos.

## Características Principales

### 1. Clasificación Automática de Errores

El sistema clasifica automáticamente los errores en categorías predefinidas:

```javascript
const ERROR_CATEGORIES = {
  TIMEOUT_ERROR: 'timeout',
  MEMORY_ERROR: 'memory', 
  NETWORK_ERROR: 'network',
  ASSERTION_ERROR: 'assertion',
  DEPENDENCY_ERROR: 'dependency',
  UNKNOWN_ERROR: 'unknown'
};
```

### 2. Niveles de Severidad

- **CRITICAL**: Fallos que impiden la ejecución completa
- **ERROR**: Errores específicos de tests
- **WARNING**: Advertencias de rendimiento o configuración
- **INFO**: Información general de ejecución
- **DEBUG**: Información detallada para depuración

### 3. Contexto Detallado

Cada log incluye contexto completo del sistema:

```javascript
{
  timestamp: "2024-01-15T10:30:45.123Z",
  level: "ERROR",
  category: "TIMEOUT_ERROR",
  message: "Test execution timeout",
  context: {
    testFile: "user.test.js",
    testName: "should create user successfully",
    duration: 35000,
    timeout: 30000,
    environment: {
      NODE_ENV: "test",
      CI: "true",
      JEST_WORKER_ID: "1"
    },
    systemInfo: {
      platform: "darwin",
      arch: "x64",
      nodeVersion: "v18.17.0",
      memory: {
        heapUsed: 45678901,
        heapTotal: 67890123,
        external: 1234567,
        rss: 89012345
      },
      cpu: {
        usage: 0.75,
        loadAverage: [0.5, 0.6, 0.7]
      }
    },
    stackTrace: "Error: Test timeout\n    at TestRunner.run..."
  }
}
```

## API del Sistema

### Constructor

```javascript
const logger = new AdvancedTestLogger({
  level: 'INFO',                    // Nivel mínimo de logging
  outputFile: 'logs/test.log',      // Archivo de salida
  maxFileSize: 10 * 1024 * 1024,    // Tamaño máximo (10MB)
  enableAnalysis: true,             // Habilitar análisis de patrones
  enableMetrics: true,              // Habilitar métricas de rendimiento
  rotateFiles: true,                // Rotación automática de archivos
  compressionLevel: 6               // Nivel de compresión para archivos rotados
});
```

### Métodos Principales

#### logTestFailure(error, context)
Registra fallos de tests con clasificación automática:

```javascript
await logger.logTestFailure(new Error('Assertion failed'), {
  testFile: 'user.test.js',
  testName: 'should validate email',
  expectedValue: 'valid@email.com',
  actualValue: 'invalid-email'
});
```

#### logInfo(message, data)
Registra información general:

```javascript
await logger.logInfo('Test suite started', {
  totalTests: 150,
  estimatedDuration: 45000,
  parallelWorkers: 4
});
```

#### logWarning(message, data)
Registra advertencias del sistema:

```javascript
await logger.logWarning('High memory usage detected', {
  currentUsage: 0.85,
  threshold: 0.8,
  recommendation: 'Consider reducing parallel workers'
});
```

#### logPerformanceMetric(metric, value, context)
Registra métricas de rendimiento:

```javascript
await logger.logPerformanceMetric('test_duration', 2500, {
  testFile: 'api.test.js',
  testName: 'should handle concurrent requests',
  threshold: 3000,
  status: 'within_limits'
});
```

## Análisis de Patrones

### Detección de Errores Recurrentes

El sistema analiza automáticamente los logs para identificar:

- **Errores frecuentes**: Tests que fallan repetidamente
- **Patrones temporales**: Errores que ocurren en horarios específicos
- **Correlaciones**: Relación entre errores y condiciones del sistema

```javascript
const analysis = await logger.analyzeErrorPatterns();
console.log('Análisis de patrones:', {
  mostFrequentErrors: analysis.frequent,
  timeBasedPatterns: analysis.temporal,
  systemCorrelations: analysis.correlations
});
```

### Métricas de Rendimiento

Recolección automática de métricas:

```javascript
const metrics = logger.getPerformanceMetrics();
console.log('Métricas de rendimiento:', {
  averageTestDuration: metrics.avgDuration,
  slowestTests: metrics.slowest,
  memoryTrends: metrics.memory,
  cpuUtilization: metrics.cpu
});
```

## Gestión de Archivos

### Rotación Automática

Cuando un archivo de log alcanza el tamaño máximo:

1. **Compresión**: El archivo actual se comprime usando gzip
2. **Rotación**: Se crea un nuevo archivo con timestamp
3. **Limpieza**: Archivos antiguos se eliminan automáticamente

```javascript
// Ejemplo de archivos rotados
logs/
├── test.log                    // Archivo actual
├── test.log.2024-01-15.gz     // Archivo rotado comprimido
├── test.log.2024-01-14.gz     // Archivo rotado anterior
└── test.log.2024-01-13.gz     // Archivo más antiguo
```

### Configuración de Retención

```javascript
const logger = new AdvancedTestLogger({
  maxFileSize: 10 * 1024 * 1024,  // 10MB por archivo
  maxFiles: 10,                   // Mantener máximo 10 archivos
  retentionDays: 30,              // Eliminar archivos después de 30 días
  compressionLevel: 6             // Nivel de compresión gzip
});
```

## Reportes y Estadísticas

### Generación de Reportes

```javascript
const report = await logger.generateReport();
console.log('Reporte de logging:', {
  period: report.period,
  totalLogs: report.stats.total,
  errorCount: report.stats.errors,
  warningCount: report.stats.warnings,
  topErrors: report.analysis.topErrors,
  recommendations: report.recommendations
});
```

### Estadísticas en Tiempo Real

```javascript
const stats = logger.getStats();
console.log('Estadísticas actuales:', {
  logsToday: stats.today,
  errorsThisHour: stats.recentErrors,
  averageLogSize: stats.avgSize,
  diskUsage: stats.diskUsage
});
```

## Integración con Sistemas Externos

### Webhooks para Alertas

```javascript
const logger = new AdvancedTestLogger({
  webhooks: {
    critical: 'https://alerts.company.com/critical',
    error: 'https://alerts.company.com/error'
  },
  alertThresholds: {
    errorRate: 0.1,        // 10% de errores
    criticalCount: 5       // 5 errores críticos
  }
});
```

### Exportación a Sistemas de Monitoreo

```javascript
// Exportar a Elasticsearch
await logger.exportToElasticsearch({
  host: 'localhost:9200',
  index: 'test-logs',
  type: 'log-entry'
});

// Exportar a Prometheus
const prometheusMetrics = logger.getPrometheusMetrics();
```

## Configuración Avanzada

### Filtros Personalizados

```javascript
const logger = new AdvancedTestLogger({
  filters: [
    // Filtrar logs de tests específicos
    (logEntry) => !logEntry.context.testFile?.includes('legacy'),
    
    // Filtrar por nivel de severidad
    (logEntry) => logEntry.level !== 'DEBUG' || process.env.NODE_ENV === 'development'
  ]
});
```

### Formatters Personalizados

```javascript
const logger = new AdvancedTestLogger({
  formatters: {
    json: (logEntry) => JSON.stringify(logEntry, null, 2),
    compact: (logEntry) => `${logEntry.timestamp} [${logEntry.level}] ${logEntry.message}`,
    detailed: (logEntry) => {
      return `
=== LOG ENTRY ===
Time: ${logEntry.timestamp}
Level: ${logEntry.level}
Category: ${logEntry.category}
Message: ${logEntry.message}
Context: ${JSON.stringify(logEntry.context, null, 2)}
================
      `.trim();
    }
  },
  defaultFormatter: 'json'
});
```

## Mejores Prácticas

### 1. Configuración de Niveles

```javascript
// Desarrollo: Máximo detalle
const devLogger = new AdvancedTestLogger({ level: 'DEBUG' });

// Producción: Solo errores y warnings
const prodLogger = new AdvancedTestLogger({ level: 'WARNING' });

// CI/CD: Información completa pero sin debug
const ciLogger = new AdvancedTestLogger({ level: 'INFO' });
```

### 2. Contexto Significativo

```javascript
// ❌ Mal: Contexto insuficiente
await logger.logTestFailure(error, { test: 'user test' });

// ✅ Bien: Contexto detallado
await logger.logTestFailure(error, {
  testFile: 'user.test.js',
  testName: 'should create user with valid data',
  testSuite: 'User Management',
  inputData: { email: 'test@example.com', name: 'John Doe' },
  expectedResult: 'User created successfully',
  actualResult: 'Validation error: Invalid email format'
});
```

### 3. Gestión de Memoria

```javascript
// Configurar límites para evitar memory leaks
const logger = new AdvancedTestLogger({
  maxMemoryUsage: 100 * 1024 * 1024,  // 100MB máximo
  flushInterval: 5000,                 // Flush cada 5 segundos
  bufferSize: 1000                     // Buffer máximo de 1000 entradas
});
```

## Troubleshooting

### Problemas Comunes

#### 1. Archivos de Log Muy Grandes
```javascript
// Solución: Reducir tamaño máximo y aumentar frecuencia de rotación
const logger = new AdvancedTestLogger({
  maxFileSize: 5 * 1024 * 1024,  // 5MB en lugar de 10MB
  rotateFiles: true,
  maxFiles: 20                   // Mantener más archivos pequeños
});
```

#### 2. Alto Uso de CPU
```javascript
// Solución: Reducir frecuencia de análisis
const logger = new AdvancedTestLogger({
  enableAnalysis: false,         // Deshabilitar análisis en tiempo real
  analysisInterval: 60000,       // Análisis cada minuto en lugar de continuo
  bufferSize: 500               // Buffer más pequeño
});
```

#### 3. Pérdida de Logs
```javascript
// Solución: Configurar flush más frecuente
const logger = new AdvancedTestLogger({
  flushInterval: 1000,          // Flush cada segundo
  syncWrites: true,             // Escrituras síncronas para logs críticos
  backupEnabled: true           // Habilitar backup automático
});
```

---

*Documentación del AdvancedTestLogger - Versión 1.0*
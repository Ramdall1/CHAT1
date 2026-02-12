# ⚡ Optimización de Jest - ChatBot Enterprise

## 🎯 Objetivo

Optimizar la configuración de Jest para obtener el máximo rendimiento en la ejecución de pruebas, reduciendo tiempos de ejecución y uso de memoria.

## 📊 Configuraciones Disponibles

### 1. Configuración Estándar (`jest.config.js`)
- **Uso**: Desarrollo general y CI/CD
- **Características**: Cobertura completa, reportes detallados, configuración balanceada
- **Workers**: 75% de CPUs disponibles
- **Timeout**: 30s (60s en CI)

### 2. Configuración Optimizada (`jest.performance.config.js`)
- **Uso**: Desarrollo rápido y testing frecuente
- **Características**: Sin cobertura, reportes mínimos, máximo rendimiento
- **Workers**: 50% de CPUs disponibles
- **Timeout**: 15s

### 3. Configuración Paralela
- **Uso**: Máquinas con múltiples cores
- **Características**: Paralelización agresiva
- **Workers**: 75% de CPUs disponibles con paralelización forzada

## 🚀 Scripts de Testing Optimizados

```bash
# Testing estándar
npm test                    # Configuración completa
npm run test:watch         # Watch mode estándar
npm run test:coverage      # Con cobertura de código

# Testing optimizado
npm run test:fast          # Máximo rendimiento
npm run test:fast:watch    # Watch mode optimizado
npm run test:parallel      # Ejecución paralela

# Benchmark y análisis
npm run test:benchmark     # Comparar rendimientos
```

## ⚙️ Optimizaciones Implementadas

### 🔧 Workers y Paralelización
```javascript
// Configuración adaptativa según entorno
maxWorkers: process.env.CI ? 2 : '75%',
workerIdleMemoryLimit: '512MB',
runInBand: process.env.CI && process.env.CI_PARALLEL !== 'true',
```

### 💾 Cache y Memoria
```javascript
// Cache optimizado
cache: true,
cacheDirectory: '<rootDir>/.jest-cache',
haste: {
  enableSymlinks: false,
  forceNodeFilesystemAPI: true
},

// Límites de memoria
workerIdleMemoryLimit: '512MB',
logHeapUsage: process.env.NODE_ENV === 'development',
```

### 🔄 Transformaciones
```javascript
// Babel optimizado
transform: {
  '^.+\\.js$': ['babel-jest', { 
    presets: [['@babel/preset-env', { 
      targets: { node: 'current' },
      modules: 'auto'
    }]],
    cacheDirectory: true,
    compact: false
  }]
},

// Patrones optimizados
transformIgnorePatterns: [
  'node_modules/(?!(uuid|@babel|@jest|chalk|strip-ansi|ansi-regex)/)'
],
```

### ⏱️ Timeouts y Detección
```javascript
// Timeouts adaptativos
testTimeout: process.env.CI ? 60000 : 30000,
slowTestThreshold: 5,

// Detección optimizada
detectOpenHandles: true,
forceExit: false,
bail: process.env.CI ? 1 : 0,
```

### 🎭 Mocks y Globals
```javascript
// Mocks optimizados
clearMocks: true,
restoreMocks: true,
resetMocks: false, // Optimización: no resetear entre tests

// Globals optimizados
injectGlobals: false, // Mejora rendimiento
extensionsToTreatAsEsm: ['.js'],
```

## 📈 Métricas de Rendimiento

### Benchmark Automático
El sistema incluye un benchmark automático que compara:

1. **Tiempo de ejecución**: Duración total de las pruebas
2. **Uso de memoria**: Peak y RSS memory usage
3. **Throughput**: Tests por segundo
4. **Eficiencia**: Relación tiempo/tests

### Ejecutar Benchmark
```bash
npm run test:benchmark
```

### Resultados Esperados
- **Configuración Optimizada**: 40-60% más rápida
- **Uso de Memoria**: 20-30% menos consumo
- **Paralelización**: Mejora escalable con cores

## 🔍 Monitoreo y Análisis

### Métricas Automáticas
- Tiempo de ejecución por configuración
- Uso de memoria por worker
- Detección de tests lentos (>5s)
- Análisis de cache hit ratio

### Reportes Generados
- `test-reports/jest-benchmark.json`: Reporte detallado
- `coverage/`: Reportes de cobertura (cuando aplique)
- `.jest-cache/`: Cache de transformaciones

## 🛠️ Configuración por Entorno

### Desarrollo Local
```bash
# Rápido para desarrollo iterativo
npm run test:fast:watch

# Completo para verificación
npm test
```

### CI/CD
```bash
# Configuración optimizada para CI
CI=true npm test

# Con paralelización en CI potente
CI=true CI_PARALLEL=true npm run test:parallel
```

### Producción
```bash
# Testing completo con cobertura
npm run test:coverage

# Verificación de calidad
npm run test:quality
```

## 🎯 Mejores Prácticas

### 1. Selección de Configuración
- **Desarrollo activo**: `test:fast:watch`
- **Pre-commit**: `test:fast`
- **CI/CD**: `test` (estándar)
- **Release**: `test:coverage`

### 2. Optimización de Tests
```javascript
// ✅ Bueno: Tests específicos y rápidos
describe('UserService', () => {
  it('should validate email format', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });
});

// ❌ Evitar: Tests lentos y complejos
describe('Integration', () => {
  it('should test entire workflow', async () => {
    // Test muy complejo y lento
  });
});
```

### 3. Gestión de Memoria
- Usar `beforeEach` para limpiar estado
- Evitar variables globales en tests
- Cerrar conexiones y recursos

### 4. Cache Management
```bash
# Limpiar cache si hay problemas
rm -rf .jest-cache
npm test
```

## 🚨 Troubleshooting

### Problemas Comunes

#### Tests Lentos
```bash
# Identificar tests lentos
npm test -- --verbose

# Usar configuración optimizada
npm run test:fast
```

#### Memoria Insuficiente
```bash
# Reducir workers
NODE_OPTIONS="--max-old-space-size=4096" npm test

# Usar configuración con menos memoria
npm run test:fast
```

#### Cache Corrupto
```bash
# Limpiar cache
npm run test -- --clearCache
rm -rf .jest-cache
```

#### Transformaciones Lentas
```bash
# Verificar patrones de transformación
npm test -- --verbose --no-cache
```

## 📊 Comparación de Rendimiento

| Configuración | Tiempo | Memoria | Cobertura | Uso Recomendado |
|---------------|--------|---------|-----------|-----------------|
| Estándar      | 100%   | 100%    | ✅        | CI/CD, Release  |
| Optimizada    | 60%    | 70%     | ❌        | Desarrollo      |
| Paralela      | 80%    | 120%    | ✅        | CI Potente      |

## 🔄 Actualizaciones Futuras

### Roadmap de Optimización
- [ ] Integración con Jest 30.x
- [ ] Optimización de transformaciones con SWC
- [ ] Cache distribuido para equipos
- [ ] Métricas de rendimiento en tiempo real
- [ ] Auto-tuning de configuración

---

**📝 Nota**: Las optimizaciones se actualizan continuamente. Ejecuta `npm run test:benchmark` regularmente para verificar el rendimiento.
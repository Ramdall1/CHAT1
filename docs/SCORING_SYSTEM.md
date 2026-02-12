# Sistema de Puntuación de Pruebas

## Descripción General

El sistema de puntuación de pruebas proporciona una evaluación automática y detallada de la calidad de las pruebas ejecutadas en el proyecto. Genera reportes JSON con métricas específicas para diferentes tipos de pruebas.

## Características Principales

### 🎯 Puntuación Inteligente
- **Criterios específicos por tipo de prueba**: Integración, E2E, Rendimiento, Seguridad
- **Evaluación basada en métricas**: Éxito de ejecución, precisión de aserciones, cobertura de código
- **Puntuación de 0-10**: Escala estándar con criterios claros

### 📊 Reportes Detallados
- **Archivos JSON timestamped**: `test-scores-YYYY-MM-DDTHH-mm-ss-sssZ.json`
- **Resumen de calidad**: `test-quality-summary.json`
- **Métricas por prueba individual**: Puntuación, tiempo de ejecución, estado

### 🔄 Gestión Automática
- **Inicialización lazy**: El sistema de archivos se inicializa solo cuando es necesario
- **Compatibilidad ES6**: Uso de import dinámico para módulos Node.js
- **Limpieza automática**: Scripts para mantener solo los reportes más recientes

## Uso

### Scripts Disponibles

```bash
# Ejecutar todas las pruebas con puntuación
npm run test:all

# Probar el sistema de puntuación directamente
npm run test:scoring

# Limpiar archivos de puntuación antiguos
npm run test:cleanup

# Pruebas estándar (también generan puntuación)
npm test
```

### Integración en Pruebas

```javascript
import TestScorer, { TEST_CATEGORIES } from '../../config/scoring-system.js';

describe('Mi Suite de Pruebas', () => {
  const testScorer = new TestScorer();

  beforeAll(() => {
    testScorer.startSession('integration', 'Mi Suite de Pruebas');
  });

  it('debe hacer algo', () => {
    const startTime = Date.now();
    
    // Tu lógica de prueba aquí
    const result = myFunction();
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    expect(result).toBe(expected);
    
    // Registrar la prueba
    testScorer.recordTest({
      testName: 'debe hacer algo',
      isPassed: true,
      executionTime,
      metrics: {
        assertionAccuracy: 100,
        codeCoverage: 85
      }
    });
  });

  afterAll(async () => {
    await testScorer.finalize();
  });
});
```

## Criterios de Puntuación

### Pruebas de Integración
- **Éxito de ejecución** (40%): La prueba debe pasar
- **Precisión de aserciones** (30%): Calidad de las validaciones
- **Cobertura de código** (20%): Porcentaje de código cubierto
- **Tiempo de ejecución** (10%): Eficiencia temporal

### Pruebas E2E
- **Éxito de ejecución** (35%): Flujo completo exitoso
- **Precisión de aserciones** (25%): Validaciones de UI/UX
- **Cobertura de funcionalidad** (25%): Casos de uso cubiertos
- **Tiempo de ejecución** (15%): Rendimiento del flujo

### Pruebas de Rendimiento
- **Tiempo de respuesta** (40%): Latencia aceptable
- **Throughput** (30%): Capacidad de procesamiento
- **Uso de recursos** (20%): Eficiencia de memoria/CPU
- **Escalabilidad** (10%): Comportamiento bajo carga

### Pruebas de Seguridad
- **Vulnerabilidades detectadas** (50%): Identificación de riesgos
- **Cobertura de superficie de ataque** (30%): Áreas evaluadas
- **Tiempo de ejecución** (20%): Eficiencia del análisis

## Archivos Generados

### test-quality-summary.json
```json
{
  "timestamp": "2025-10-21T19:07:36.887Z",
  "totalTests": 10,
  "passedTests": 8,
  "failedTests": 2,
  "overallScore": 8.2,
  "passRate": 80,
  "averageExecutionTime": 0
}
```

### test-scores-[timestamp].json
```json
{
  "sessionId": "unique-session-id",
  "timestamp": "2025-10-21T19:07:36.887Z",
  "testType": "integration",
  "suiteName": "Mi Suite de Pruebas",
  "tests": [
    {
      "testName": "debe hacer algo",
      "score": 9,
      "maxScore": 10,
      "isPassed": true,
      "executionTime": 15,
      "metrics": {
        "assertionAccuracy": 100,
        "codeCoverage": 85
      }
    }
  ],
  "summary": {
    "totalTests": 1,
    "passedTests": 1,
    "failedTests": 0,
    "averageScore": 9,
    "averageExecutionTime": 15
  }
}
```

## Mantenimiento

### Limpieza de Archivos
El script `cleanup-test-reports.js` mantiene solo los 3 archivos de puntuación más recientes para evitar acumulación excesiva.

### Configuración de Umbrales
Los criterios de puntuación se pueden ajustar en `tests/config/scoring-system.js` en las secciones de criterios específicos por tipo de prueba.

### Monitoreo
- Revisar regularmente el `test-quality-summary.json` para tendencias de calidad
- Usar los reportes detallados para identificar pruebas problemáticas
- Establecer umbrales mínimos de puntuación en CI/CD

## Troubleshooting

### Problemas Comunes

1. **Archivos no se generan**
   - Verificar que `finalize()` se llame con `await`
   - Comprobar permisos de escritura en el directorio

2. **Puntuaciones siempre 0**
   - Verificar que las métricas se pasen correctamente
   - Revisar que `isPassed` sea boolean

3. **Error de módulos ES6**
   - Asegurar que `type: "module"` esté en package.json
   - Usar import dinámico para módulos Node.js

### Logs de Debug
El sistema registra información en consola durante la ejecución. Para más detalles, revisar los logs de Jest o ejecutar scripts individuales.
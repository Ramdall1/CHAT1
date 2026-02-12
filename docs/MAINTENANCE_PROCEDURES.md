# Procedimientos de Mantenimiento - Sistema de Calidad y Pruebas

## Tabla de Contenidos
1. [Mantenimiento Rutinario](#mantenimiento-rutinario)
2. [Adición de Nuevas Pruebas](#adición-de-nuevas-pruebas)
3. [Actualización de Umbrales](#actualización-de-umbrales)
4. [Monitoreo y Alertas](#monitoreo-y-alertas)
5. [Resolución de Problemas](#resolución-de-problemas)
6. [Mejores Prácticas](#mejores-prácticas)

## Mantenimiento Rutinario

### Limpieza de Archivos de Puntuación

**Frecuencia:** Semanal o después de cada release

```bash
# Limpiar archivos antiguos de puntuación
npm run test:cleanup

# Verificar espacio en disco
du -sh test-scores-*.json
```

### Verificación de Calidad

**Frecuencia:** Diaria (automática en CI/CD)

```bash
# Ejecutar verificación completa de calidad
npm run test:quality

# Ejecutar todas las pruebas con puntuación
npm run test:all

# Verificar solo el sistema de puntuación
npm run test:scoring
```

### Revisión de Métricas

**Frecuencia:** Semanal

1. **Revisar tendencias de calidad:**
   ```bash
   # Ver resumen actual
   cat test-quality-summary.json | jq '.'
   
   # Ver reportes históricos
   ls -la test-scores-*.json
   ```

2. **Analizar cobertura de código:**
   ```bash
   # Generar reporte de cobertura
   npm run test:coverage
   
   # Ver resumen de cobertura
   cat coverage/coverage-summary.json | jq '.total'
   ```

## Adición de Nuevas Pruebas

### 1. Crear Nueva Prueba

```javascript
// tests/unit/[categoria]/nueva-prueba.test.js (para pruebas unitarias)
// tests/integrations/[categoria]/nueva-prueba.test.js (para pruebas de integración)
// tests/performance/[categoria]/nueva-prueba.test.js (para pruebas de rendimiento)
import { describe, test, expect } from '@jest/globals';
import { scoreTest } from '../../config/scoring-system.js';

describe('Nueva Funcionalidad', () => {
  test('debe realizar nueva operación', async () => {
    const testName = 'Nueva operación';
    const category = 'integration'; // o 'auth', 'performance', etc.
    
    try {
      // Lógica de la prueba
      const result = await nuevaOperacion();
      
      // Aserciones
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      
      // Registrar puntuación
      await scoreTest(testName, category, true, {
        executionTime: Date.now() - startTime,
        details: 'Prueba ejecutada correctamente'
      });
      
    } catch (error) {
      await scoreTest(testName, category, false, {
        error: error.message,
        details: 'Error en la ejecución'
      });
      throw error;
    }
  });
});
```

### 2. Configurar Categoría de Prueba

Si es una nueva categoría, actualizar `tests/config/scoring-system.js`:

```javascript
const SCORING_CRITERIA = {
  // ... criterios existentes
  nueva_categoria: {
    EXECUTION_SUCCESS: { weight: 15, description: 'La prueba se ejecuta sin errores' },
    ASSERTION_ACCURACY: { weight: 15, description: 'Todas las aserciones son correctas' },
    // ... más criterios específicos
  }
};
```

### 3. Actualizar Scripts de Ejecución

Si es necesario, actualizar `run-all-tests.js`:

```javascript
const testSuites = [
  // ... suites existentes
  {
    name: 'Nueva Categoría',
    path: 'tests/unit/nueva-categoria/*.test.js', // o tests/integrations/ o tests/performance/
    timeout: 30000
  }
];
```

### 4. Verificar Integración

```bash
# Ejecutar solo la nueva prueba
npx jest tests/unit/nueva-categoria/nueva-prueba.test.js

# Ejecutar todas las pruebas
npm run test:all

# Verificar calidad
npm run test:quality
```

## Actualización de Umbrales

### Archivo de Configuración

Editar `.github/quality-thresholds.json`:

```json
{
  "coverage": {
    "statements": 70,  // Incrementar gradualmente
    "branches": 60,
    "functions": 70,
    "lines": 70
  },
  "testQuality": {
    "passRate": 80,    // Objetivo: 95%
    "minimumScore": 25, // Incrementar gradualmente
    "minimumTests": 15
  },
  "performance": {
    "maxTestDuration": 25000, // Reducir gradualmente
    "maxSuiteSize": 50
  }
}
```

### Estrategia de Incremento Gradual

1. **Mes 1:** Establecer baseline actual
2. **Mes 2:** Incrementar umbrales en 5-10%
3. **Mes 3:** Continuar incremento gradual
4. **Objetivo final:** 
   - Cobertura: 80%+
   - Tasa de éxito: 95%+
   - Puntuación mínima: 50+

### Verificar Impacto

```bash
# Probar nuevos umbrales
npm run test:quality

# Si fallan, ajustar gradualmente
# Si pasan, confirmar cambios
```

## Monitoreo y Alertas

### Métricas Clave a Monitorear

1. **Tasa de éxito de pruebas**
2. **Puntuación general de calidad**
3. **Tiempo de ejecución de pruebas**
4. **Cobertura de código**
5. **Número de pruebas fallidas**

### Configuración de Alertas

En el pipeline de CI/CD (`.github/workflows/ci.yml`):

```yaml
- name: Check Quality Thresholds
  run: npm run test:quality
  continue-on-error: false

- name: Notify on Failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: "❌ Quality thresholds not met in ${{ github.repository }}"
```

### Dashboard de Métricas

Crear script para generar dashboard:

```bash
# scripts/generate-dashboard.js
node scripts/generate-dashboard.js > quality-dashboard.html
```

## Resolución de Problemas

### Problemas Comunes

#### 1. Pruebas Fallando Intermitentemente

**Síntomas:** Pruebas que pasan/fallan aleatoriamente

**Solución:**
```bash
# Ejecutar múltiples veces para identificar patrón
for i in {1..10}; do npm test; done

# Revisar logs detallados
npm test -- --verbose

# Verificar dependencias asíncronas
# Agregar timeouts apropiados
```

#### 2. Puntuación Baja Inesperada

**Síntomas:** Puntuación general menor a lo esperado

**Solución:**
```bash
# Revisar archivos de puntuación detallados
cat test-scores-*.json | jq '.results[] | select(.score < 7)'

# Identificar pruebas problemáticas
# Mejorar criterios específicos
```

#### 3. Cobertura de Código Baja

**Síntomas:** Cobertura menor a umbrales

**Solución:**
```bash
# Generar reporte detallado
npm run test:coverage -- --coverage-reporters=html

# Abrir reporte en navegador
open coverage/lcov-report/index.html

# Identificar archivos sin cobertura
# Agregar pruebas específicas
```

### Logs y Debugging

```bash
# Habilitar logs detallados
DEBUG=scoring:* npm run test:all

# Revisar logs de CI/CD
# Verificar artefactos de calidad

# Analizar tendencias históricas
ls -la test-scores-*.json | head -10
```

## Mejores Prácticas

### Desarrollo de Pruebas

1. **Nomenclatura consistente:**
   ```javascript
   // ✅ Bueno
   test('debe autenticar usuario con credenciales válidas', ...)
   
   // ❌ Malo
   test('auth test', ...)
   ```

2. **Categorización apropiada:**
   - `auth`: Autenticación y autorización
   - `integration`: Integración entre componentes
   - `performance`: Rendimiento y escalabilidad
   - `security`: Seguridad y vulnerabilidades

3. **Manejo de errores:**
   ```javascript
   try {
     // Lógica de prueba
     await scoreTest(testName, category, true, details);
   } catch (error) {
     await scoreTest(testName, category, false, { error: error.message });
     throw error;
   }
   ```

### Mantenimiento del Sistema

1. **Revisiones regulares:** Semanales
2. **Actualizaciones graduales:** Incrementos del 5-10%
3. **Documentación actualizada:** Cada cambio importante
4. **Backup de configuraciones:** Antes de cambios mayores

### Integración con CI/CD

1. **Fallos rápidos:** Detener pipeline si calidad es crítica
2. **Reportes automáticos:** Generar y almacenar artefactos
3. **Notificaciones:** Alertar a equipo en fallos
4. **Métricas históricas:** Mantener tendencias de calidad

## Scripts de Utilidad

### Backup de Configuración

```bash
#!/bin/bash
# scripts/backup-quality-config.sh
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p backups/quality-config-$DATE
cp .github/quality-thresholds.json backups/quality-config-$DATE/
cp tests/config/scoring-system.js backups/quality-config-$DATE/
echo "Backup creado en backups/quality-config-$DATE/"
```

### Análisis de Tendencias

```bash
#!/bin/bash
# scripts/analyze-trends.sh
echo "=== Análisis de Tendencias de Calidad ==="
echo "Últimos 5 reportes:"
ls -t test-scores-*.json | head -5 | xargs -I {} sh -c 'echo "Archivo: {}"; cat {} | jq ".summary"'
```

### Limpieza Automática

```bash
#!/bin/bash
# scripts/auto-cleanup.sh
# Mantener solo los últimos 10 archivos de puntuación
ls -t test-scores-*.json | tail -n +11 | xargs rm -f
echo "Limpieza automática completada"
```

---

## Contacto y Soporte

Para problemas o mejoras del sistema de calidad:

1. **Issues:** Crear issue en el repositorio
2. **Documentación:** Actualizar este archivo
3. **Revisiones:** Programar revisiones trimestrales

**Última actualización:** $(date)
**Versión:** 1.0.0
# 🧪 Documentación del Sistema de Testing

## Resumen

El sistema de Chat Bot cuenta con una suite de testing completamente funcional basada en Jest, configurada para trabajar con módulos ES y CommonJS. Esta documentación describe cómo usar, configurar y extender el sistema de testing.

## 📋 Estado Actual

### ✅ Funcionando Correctamente
- **Jest 29.x** configurado con soporte ES modules
- **Pruebas básicas** (3/3 tests pasando)
- **Pruebas del sistema** (11/11 tests pasando)
- **Setup global** con variables de entorno
- **Sistema de mocks** funcionando
- **Configuración CommonJS** para compatibilidad

### ⚠️ Pendiente de Migración
- Pruebas legacy en `tests/core/` y otros directorios
- Conversión de ES modules a CommonJS en pruebas existentes

## 🛠️ Configuración

### Archivos de Configuración

#### `jest.config.cjs`
```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.cjs'],
  testTimeout: 30000,
  verbose: true,
  collectCoverage: false,
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  moduleFileExtensions: ['js', 'json'],
  transform: {},
  testPathIgnorePatterns: ['/node_modules/'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
```

#### `babel.config.cjs`
```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: { node: 'current' },
      modules: 'commonjs'
    }]
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: 'commonjs'
        }]
      ]
    }
  }
};
```

#### `tests/setup.cjs`
```javascript
// Configuración global para Jest
global.jest = jest;
jest.setTimeout(30000);

// Variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DB_PATH = ':memory:';
process.env.PORT = '3001';

// Mock global para fetch
global.fetch = jest.fn();

// Limpiar mocks después de cada prueba
afterEach(() => {
    jest.clearAllMocks();
});

// Configurar zona horaria
process.env.TZ = 'UTC';
```

## 🚀 Ejecutar Pruebas

### Comandos Básicos

```bash
# Ejecutar todas las pruebas
npm test

# Ejecutar pruebas específicas
npm test tests/basic.test.js
npm test tests/system.test.js

# Ejecutar con patrón
npm test tests/basic.test.js tests/system.test.js

# Ejecutar con watch mode (desarrollo)
npm run test:watch

# Ejecutar con cobertura
npm run test:coverage
```

### Comandos Avanzados

```bash
# Ejecutar con verbose output
npm test -- --verbose

# Ejecutar solo pruebas que fallaron
npm test -- --onlyFailures

# Ejecutar con timeout personalizado
npm test -- --testTimeout=60000

# Ejecutar con patrón específico
npm test -- --testNamePattern="should handle"
```

## 📁 Estructura de Pruebas

```
tests/
├── basic.test.js              # ✅ Pruebas básicas
├── system.test.js             # ✅ Pruebas del sistema
├── setup.cjs                  # ✅ Configuración Jest
├── utils/
│   └── testHelpers.js         # Utilidades de testing
├── core/                      # Pruebas de componentes core
│   ├── ChatBot.test.js        # ⚠️ Requiere migración
│   └── ...
├── api/                       # Pruebas de API
├── integration/               # Pruebas de integración
└── e2e/                       # Pruebas end-to-end
```

## 📝 Tipos de Pruebas

### 1. Pruebas Básicas (`tests/basic.test.js`)

Pruebas fundamentales del sistema:

```javascript
describe('Basic Test Suite', () => {
    it('should run basic test', () => {
        expect(1 + 1).toBe(2);
    });

    it('should handle async operations', async () => {
        const result = await Promise.resolve('async result');
        expect(result).toBe('async result');
    });

    it('should handle objects', () => {
        const obj = { name: 'test', value: 42 };
        expect(obj).toHaveProperty('name');
        expect(obj.value).toBe(42);
    });
});
```

### 2. Pruebas del Sistema (`tests/system.test.js`)

Pruebas integrales del sistema:

```javascript
describe('Sistema de Chat Bot', () => {
    describe('Configuración básica', () => {
        it('debería tener variables de entorno configuradas', () => {
            expect(process.env.NODE_ENV).toBe('test');
            expect(process.env.JWT_SECRET).toBeDefined();
        });
    });

    describe('Funcionalidades core', () => {
        it('debería poder simular una conversación', async () => {
            const conversation = {
                id: 'test-conv-1',
                userId: 'user-123',
                messages: []
            };
            // ... lógica de prueba
        });
    });
});
```

## 🔧 Utilidades de Testing

### Mocks Globales

```javascript
// Mock de fetch disponible globalmente
global.fetch = jest.fn();

// Mock de console para pruebas silenciosas
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};
```

### Helpers Personalizados

```javascript
// Crear datos de prueba
const createTestUser = () => ({
    id: 'test-user-1',
    name: 'Test User',
    email: 'test@example.com'
});

// Simular delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Verificar estructura de objeto
const expectValidMessage = (message) => {
    expect(message).toHaveProperty('id');
    expect(message).toHaveProperty('content');
    expect(message).toHaveProperty('role');
    expect(['user', 'assistant', 'system']).toContain(message.role);
};
```

## 🐛 Solución de Problemas

### Problemas Comunes

#### 1. `ReferenceError: require is not defined`

**Causa**: Mezcla de módulos ES y CommonJS
**Solución**: Usar archivos `.cjs` para configuración y CommonJS en pruebas

```javascript
// ❌ Incorrecto
import { jest } from '@jest/globals';

// ✅ Correcto
const jest = require('jest');
```

#### 2. `ReferenceError: jest is not defined`

**Causa**: Jest no está disponible globalmente
**Solución**: Configurar en `setup.cjs`

```javascript
// En tests/setup.cjs
global.jest = jest;
```

#### 3. `ReferenceError: exports is not defined`

**Causa**: Archivo tratado como ES module
**Solución**: Usar extensión `.cjs` o configurar correctamente

```javascript
// ❌ Incorrecto
export default config;

// ✅ Correcto
module.exports = config;
```

### Debugging

```bash
# Ejecutar con debug
DEBUG=* npm test

# Ejecutar con logs detallados
npm test -- --verbose --no-cache

# Verificar configuración Jest
npx jest --showConfig
```

## 📊 Cobertura de Código

### Configurar Cobertura

```javascript
// En jest.config.cjs
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/testing/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Generar Reportes

```bash
# Generar reporte de cobertura
npm run test:coverage

# Ver reporte HTML
open coverage/lcov-report/index.html
```

## 🔄 Migración de Pruebas Legacy

### Pasos para Migrar

1. **Identificar archivos a migrar**:
```bash
find tests/ -name "*.test.js" -exec grep -l "import.*from" {} \;
```

2. **Convertir importaciones**:
```javascript
// ❌ ES modules
import { ChatBot } from '../src/core/ChatBot.js';
import { TestHelpers } from './utils/testHelpers.js';

// ✅ CommonJS
const { ChatBot } = require('../src/core/ChatBot.js');
const { TestHelpers } = require('./utils/testHelpers.js');
```

3. **Convertir exportaciones**:
```javascript
// ❌ ES modules
export default TestHelpers;
export const customMatchers = {};

// ✅ CommonJS
module.exports = { TestHelpers, customMatchers };
```

### Script de Migración Automática

```bash
#!/bin/bash
# migrate-tests.sh

for file in tests/**/*.test.js; do
    if grep -q "import.*from" "$file"; then
        echo "Migrando: $file"
        
        # Convertir imports
        sed -i 's/import { \(.*\) } from \(.*\);/const { \1 } = require(\2);/g' "$file"
        sed -i 's/import \(.*\) from \(.*\);/const \1 = require(\2);/g' "$file"
        
        # Convertir exports
        sed -i 's/export default \(.*\);/module.exports = \1;/g' "$file"
        sed -i 's/export const \(.*\) = /const \1 = /g' "$file"
    fi
done
```

## 📚 Mejores Prácticas

### 1. Estructura de Pruebas

```javascript
describe('ComponentName', () => {
    // Setup
    beforeEach(() => {
        // Configuración antes de cada prueba
    });

    afterEach(() => {
        // Limpieza después de cada prueba
    });

    describe('método específico', () => {
        it('debería hacer algo específico', () => {
            // Arrange
            const input = 'test input';
            
            // Act
            const result = component.method(input);
            
            // Assert
            expect(result).toBe('expected output');
        });
    });
});
```

### 2. Naming Conventions

```javascript
// ✅ Descriptivo y claro
it('debería retornar error cuando el email es inválido', () => {});

// ❌ Vago
it('should work', () => {});
```

### 3. Mocks Efectivos

```javascript
// ✅ Mock específico
const mockDatabase = {
    findUser: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
    saveUser: jest.fn().mockResolvedValue(true)
};

// ❌ Mock genérico
const mockDatabase = jest.fn();
```

### 4. Assertions Claras

```javascript
// ✅ Específico
expect(user).toEqual({
    id: expect.any(Number),
    name: 'Test User',
    email: 'test@example.com'
});

// ❌ Genérico
expect(user).toBeTruthy();
```

## 🚀 Próximos Pasos

### Tareas Pendientes

1. **Migrar pruebas legacy** a CommonJS
2. **Implementar pruebas de integración** para APIs
3. **Configurar pruebas E2E** con Playwright
4. **Mejorar cobertura** de código
5. **Automatizar testing** en CI/CD

### Roadmap

- [ ] **v5.1**: Migración completa de pruebas legacy
- [ ] **v5.2**: Pruebas de integración para todas las APIs
- [ ] **v5.3**: Pruebas E2E automatizadas
- [ ] **v5.4**: Cobertura >90%
- [ ] **v5.5**: Testing de performance

## 📞 Soporte

Para problemas con el sistema de testing:

1. **Revisar esta documentación**
2. **Verificar configuración** en archivos `.cjs`
3. **Ejecutar pruebas básicas** para verificar setup
4. **Consultar logs** de Jest para errores específicos

---

**Última actualización**: v5.0.0 - Sistema de testing completamente funcional
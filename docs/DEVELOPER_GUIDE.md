# Guía para Desarrolladores - ChatBot Enterprise

## 📋 Índice
1. [Configuración del Entorno](#configuración-del-entorno)
2. [Sistema de Pruebas](#sistema-de-pruebas)
3. [Cobertura de Código](#cobertura-de-código)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Mejores Prácticas](#mejores-prácticas)
6. [Troubleshooting](#troubleshooting)

## 🚀 Configuración del Entorno

### Requisitos Previos
- Node.js 18.x o 20.x
- npm 9.x o superior
- Git

### Instalación
```bash
# Clonar el repositorio
git clone <repository-url>
cd Chat-Bot-1-2

# Instalar dependencias
npm install

# Configurar hooks de Git
npm run prepare
```

### Variables de Entorno
Crear archivo `.env` basado en `.env.example`:
```bash
cp .env.example .env
```

## 🧪 Sistema de Pruebas

### Estructura de Pruebas
```
tests/
├── basic.test.js           # Pruebas básicas del sistema
├── system.test.js          # Pruebas del sistema completo
├── core/
│   └── ChatBot.test.js     # Pruebas del ChatBot core
├── integration/
│   ├── auth-routes.test.js # Pruebas de autenticación
│   └── billing-commerce.test.js # Pruebas de facturación
└── performance/
    └── load.test.js        # Pruebas de rendimiento
```

### Comandos de Pruebas

#### Pruebas Básicas
```bash
# Ejecutar pruebas básicas (recomendado para desarrollo)
npm test -- tests/basic.test.js tests/system.test.js tests/core/ChatBot.test.js

# Ejecutar todas las pruebas
npm test

# Ejecutar pruebas en modo watch
npm run test:watch
```

#### Pruebas con Cobertura
```bash
# Generar reporte de cobertura básico
npm run test:coverage -- tests/basic.test.js tests/system.test.js tests/core/ChatBot.test.js

# Generar reporte de cobertura completo
npm run coverage:report

# Ver reporte HTML
open coverage/lcov-report/index.html
```

#### Pruebas Específicas
```bash
# Ejecutar suite específica
npm test -- tests/core/ChatBot.test.js

# Ejecutar prueba específica
npm test -- --testNamePattern="should initialize correctly"

# Ejecutar con verbose
npm test -- --verbose
```

### Configuración de Jest

El proyecto usa Jest con configuración optimizada en `jest.config.js`:

- **Entorno**: Node.js con soporte para ES modules
- **Timeout**: 30 segundos por prueba
- **Setup**: Configuración automática de mocks y limpieza
- **Cobertura**: Habilitada con umbrales del 70%

## 📊 Cobertura de Código

### Métricas de Cobertura
- **Líneas**: 70% mínimo
- **Funciones**: 70% mínimo
- **Ramas**: 70% mínimo
- **Declaraciones**: 70% mínimo

### Reportes Disponibles
1. **Consola**: Resumen inmediato
2. **HTML**: Reporte interactivo en `coverage/lcov-report/index.html`
3. **LCOV**: Para integración con herramientas externas
4. **JSON**: Datos estructurados para análisis

### Script de Análisis
```bash
# Generar análisis detallado
npm run coverage:report
```

Este script genera:
- Reporte de cobertura en múltiples formatos
- Análisis de archivos con mayor/menor cobertura
- Recomendaciones de mejora
- Archivo de análisis en `reports/coverage-analysis.md`

## 🔄 CI/CD Pipeline

### Pipeline Local
```bash
# Ejecutar verificaciones completas localmente
npm run ci:local
```

Este comando ejecuta:
1. ✅ Linting de código
2. ✅ Verificación de formato
3. ✅ Auditoría de seguridad
4. ✅ Pruebas unitarias
5. ✅ Reporte de cobertura
6. ✅ Build del proyecto

### Pipeline en GitHub Actions

El pipeline se ejecuta automáticamente en:
- Push a `main` o `develop`
- Pull requests
- Semanalmente (auditoría de seguridad)

#### Etapas del Pipeline
1. **Security Scan**: Análisis de seguridad y calidad
2. **Test**: Pruebas en Node.js 18.x y 20.x
3. **Coverage**: Generación y upload de cobertura
4. **Build**: Construcción del proyecto
5. **Deploy**: Despliegue automático (staging/production)

### Configuración de Servicios
El pipeline incluye servicios para pruebas:
- **MongoDB**: Base de datos de pruebas
- **Redis**: Cache y sesiones

## 🎯 Mejores Prácticas

### Escribiendo Pruebas

#### Estructura de Pruebas
```javascript
describe('ComponentName', () => {
    beforeEach(() => {
        // Setup antes de cada prueba
    });

    afterEach(() => {
        // Limpieza después de cada prueba
    });

    describe('method/feature', () => {
        it('should do something specific', async () => {
            // Arrange
            const input = 'test data';
            
            // Act
            const result = await component.method(input);
            
            // Assert
            expect(result).toBe('expected output');
        });
    });
});
```

#### Naming Conventions
- **Describe**: Nombre del componente o feature
- **It**: Comportamiento específico en presente
- **Variables**: Descriptivas y claras

#### Mocking
```javascript
// Mock de módulos externos
jest.mock('../path/to/module', () => ({
    method: jest.fn().mockResolvedValue('mocked result')
}));

// Mock de funciones específicas
const mockFunction = jest.fn();
mockFunction.mockReturnValue('value');
```

### Desarrollo con TDD

1. **Red**: Escribir prueba que falle
2. **Green**: Implementar código mínimo para pasar
3. **Refactor**: Mejorar código manteniendo pruebas

### Code Review Checklist

- [ ] Todas las pruebas pasan
- [ ] Cobertura de código >= 70%
- [ ] Linting sin errores
- [ ] Documentación actualizada
- [ ] No hay secrets en el código
- [ ] Performance considerado

## 🔧 Troubleshooting

### Problemas Comunes

#### Error: "Cannot use 'import.meta' outside a module"
```bash
# Solución: Usar NODE_OPTIONS
NODE_OPTIONS=--experimental-vm-modules npm test
```

#### Pruebas Lentas
```bash
# Ejecutar solo pruebas básicas durante desarrollo
npm test -- tests/basic.test.js tests/system.test.js tests/core/ChatBot.test.js

# Usar modo watch para feedback inmediato
npm run test:watch
```

#### Problemas de Memoria
```bash
# Aumentar memoria para Jest
NODE_OPTIONS="--max-old-space-size=4096 --experimental-vm-modules" npm test
```

#### Mocks No Funcionan
1. Verificar que el mock esté en `__mocks__/`
2. Usar `jest.mock()` antes de importar
3. Limpiar mocks entre pruebas: `jest.clearAllMocks()`

### Debugging

#### Debugging con VS Code
```json
// .vscode/launch.json
{
    "type": "node",
    "request": "launch",
    "name": "Debug Jest Tests",
    "program": "${workspaceFolder}/node_modules/.bin/jest",
    "args": ["--runInBand"],
    "console": "integratedTerminal",
    "internalConsoleOptions": "neverOpen"
}
```

#### Debugging con Node.js
```bash
# Debug específico
node --inspect-brk node_modules/.bin/jest --runInBand tests/specific.test.js
```

### Logs y Monitoreo

#### Logs de Pruebas
```javascript
// En pruebas, usar console.log con moderación
console.log('Debug info:', data);

// Mejor: usar expect para verificar estados
expect(component.state).toMatchObject({ expected: 'state' });
```

#### Análisis de Performance
```bash
# Ejecutar con profiling
npm test -- --detectOpenHandles --forceExit
```

## 📚 Recursos Adicionales

### Documentación
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Node.js Testing Guide](https://nodejs.org/en/docs/guides/testing/)

### Herramientas Recomendadas
- **VS Code Extensions**:
  - Jest Runner
  - Coverage Gutters
  - ESLint
  - Prettier

### Scripts Útiles
```bash
# Limpiar cache de Jest
npm test -- --clearCache

# Actualizar snapshots
npm test -- --updateSnapshot

# Ejecutar con coverage específica
npm test -- --collectCoverageFrom="src/core/**/*.js"
```

## 🤝 Contribución

1. Fork del repositorio
2. Crear branch feature: `git checkout -b feature/nueva-funcionalidad`
3. Escribir pruebas para la nueva funcionalidad
4. Implementar la funcionalidad
5. Verificar que todas las pruebas pasen: `npm run ci:local`
6. Commit con mensaje descriptivo
7. Push y crear Pull Request

### Commit Messages
```
feat: añadir nueva funcionalidad de chat
fix: corregir error en autenticación
test: añadir pruebas para módulo de pagos
docs: actualizar guía de desarrollo
refactor: mejorar estructura de ChatBot
```

---

**¿Necesitas ayuda?** Revisa los logs en `reports/` o contacta al equipo de desarrollo.
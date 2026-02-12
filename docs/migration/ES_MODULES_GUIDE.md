# Guía de ES Modules - Chat Bot Enterprise

## 🚀 Guía Rápida para Desarrolladores

Esta guía proporciona las mejores prácticas y patrones para trabajar con ES Modules en el proyecto Chat Bot Enterprise.

## 📝 Sintaxis Básica

### Importaciones

```javascript
// Importación por defecto
import ChatBot from './core/ChatBot.js';

// Importación nombrada
import { EventEmitter } from 'events';

// Importación mixta
import express, { Router } from 'express';

// Importación de todo el módulo
import * as utils from './utils/index.js';

// Importación dinámica (async)
const module = await import('./dynamic-module.js');
```

### Exportaciones

```javascript
// Exportación por defecto
export default class ChatBot {
  // ...
}

// Exportaciones nombradas
export const config = {};
export function helper() {}

// Re-exportación
export { default as ChatBot } from './ChatBot.js';
export * from './utils.js';
```

## 🔧 Patrones Comunes

### 1. Módulo de Servicio
```javascript
// src/services/MyService.js
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

class MyService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
  }

  async start() {
    logger.info('Service starting...');
    // Lógica de inicio
  }
}

export default MyService;
```

### 2. Módulo de Utilidades
```javascript
// src/utils/helpers.js
export function formatMessage(text) {
  return text.trim().toLowerCase();
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const constants = {
  MAX_RETRIES: 3,
  TIMEOUT: 5000
};
```

### 3. Módulo de Configuración
```javascript
// src/config/index.js
import { readFileSync } from 'fs';
import { join } from 'path';

const config = JSON.parse(
  readFileSync(join(process.cwd(), 'config.json'), 'utf8')
);

export default config;
export const { database, cache, api } = config;
```

## 🧪 Pruebas con ES Modules

### Configuración de Jest
```javascript
// jest.config.js
export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['babel-jest', { 
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]] 
    }]
  }
};
```

### Archivo de Prueba
```javascript
// tests/MyService.test.js
import { jest } from '@jest/globals';
import MyService from '../src/services/MyService.js';

describe('MyService', () => {
  let service;

  beforeEach(() => {
    service = new MyService({ test: true });
  });

  test('should start successfully', async () => {
    await expect(service.start()).resolves.not.toThrow();
  });
});
```

## 📁 Estructura de Archivos

### Convenciones de Nombres
```
src/
├── services/
│   ├── ChatService.js          # PascalCase para clases
│   └── index.js               # Punto de entrada
├── utils/
│   ├── helpers.js             # camelCase para utilidades
│   ├── constants.js           # Constantes
│   └── index.js              # Re-exportaciones
└── config/
    ├── database.js           # Configuraciones específicas
    └── index.js             # Configuración principal
```

### Archivos index.js
```javascript
// src/services/index.js
export { default as ChatService } from './ChatService.js';
export { default as UserService } from './UserService.js';
export { default as MessageService } from './MessageService.js';

// src/utils/index.js
export * from './helpers.js';
export * from './constants.js';
export { default as logger } from './logger.js';
```

## 🔄 Migración de CommonJS

### Antes (CommonJS)
```javascript
const fs = require('fs');
const { EventEmitter } = require('events');
const MyClass = require('./MyClass');

class Service extends EventEmitter {
  // ...
}

module.exports = Service;
```

### Después (ES Modules)
```javascript
import fs from 'fs';
import { EventEmitter } from 'events';
import MyClass from './MyClass.js';

class Service extends EventEmitter {
  // ...
}

export default Service;
```

## ⚠️ Consideraciones Importantes

### 1. Extensiones de Archivo
```javascript
// ✅ Correcto
import utils from './utils.js';

// ❌ Incorrecto en ES Modules
import utils from './utils';
```

### 2. Importaciones Dinámicas
```javascript
// Para carga condicional
if (condition) {
  const module = await import('./optional-module.js');
  module.default.init();
}

// Para lazy loading
const getLazyModule = () => import('./lazy-module.js');
```

### 3. Compatibilidad con CommonJS
```javascript
// Para usar módulos CommonJS en ESM
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const oldModule = require('old-commonjs-module');
```

### 4. Variables Globales
```javascript
// En lugar de __dirname y __filename
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

## 🛠️ Herramientas de Desarrollo

### Scripts de package.json
```json
{
  "scripts": {
    "start": "node src/main.js",
    "dev": "node --watch src/main.js",
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest",
    "lint": "eslint src/ --ext .js"
  }
}
```

### Configuración de ESLint
```javascript
// eslint.config.js
export default {
  env: {
    es2022: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
};
```

## 🐛 Solución de Problemas

### Error: Cannot use import statement outside a module
**Solución**: Agregar `"type": "module"` en package.json

### Error: Module not found
**Solución**: Verificar que las rutas incluyan extensión `.js`

### Error: jest is not defined
**Solución**: Importar jest: `import { jest } from '@jest/globals';`

### Error: require is not defined
**Solución**: Usar importaciones ESM o createRequire para módulos legacy

## 📚 Recursos Adicionales

- [Node.js ES Modules Documentation](https://nodejs.org/api/esm.html)
- [Jest ES Modules Support](https://jestjs.io/docs/ecmascript-modules)
- [MDN ES Modules Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)

## 🎯 Mejores Prácticas

1. **Siempre usar extensiones .js** en las importaciones
2. **Preferir importaciones nombradas** para mejor tree-shaking
3. **Usar importaciones dinámicas** para código condicional
4. **Mantener archivos index.js** para puntos de entrada claros
5. **Documentar exportaciones públicas** para mejor mantenibilidad

---

**Nota**: Esta guía está basada en la migración exitosa del proyecto Chat Bot Enterprise a ES Modules v5.1.0
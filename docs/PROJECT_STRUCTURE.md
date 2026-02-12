# Estructura del Proyecto ChatBot Enterprise

## Descripción General

Este documento describe la estructura organizacional del proyecto ChatBot Enterprise después de la reorganización y unificación de archivos realizada para mejorar la mantenibilidad y claridad del código.

## Estructura de Directorios

```
Chat-Bot-1-2/
├── .github/                    # Configuración de GitHub Actions y workflows
│   └── workflows/             # Archivos de CI/CD
├── .husky/                    # Git hooks para pre-commit y post-commit
├── apps/                      # Aplicaciones modulares
│   └── api/                   # API específica
├── backups/                   # Respaldos automáticos y manuales
│   ├── daily/                 # Respaldos diarios
│   ├── weekly/                # Respaldos semanales
│   ├── monthly/               # Respaldos mensuales
│   ├── emergency/             # Respaldos de emergencia
│   ├── manual/                # Respaldos manuales
│   └── html-migration/        # Respaldos de migración HTML
├── client/                    # Frontend de la aplicación
│   ├── components/            # Componentes reutilizables
│   ├── assets/                # Recursos estáticos (CSS, imágenes, JS)
│   ├── pages/                 # Páginas de la aplicación
│   └── utils/                 # Utilidades del cliente
├── config/                    # Archivos de configuración
│   ├── jest.config.js         # Configuración de Jest
│   ├── environment.js         # Variables de entorno
│   └── *.config.js           # Otras configuraciones
├── data/                      # Datos de la aplicación
│   ├── analytics/             # Datos de análisis
│   ├── billing/               # Datos de facturación
│   ├── commerce/              # Datos de comercio
│   ├── contacts/              # Datos de contactos
│   ├── conversations/         # Datos de conversaciones
│   ├── integrations/          # Datos de integraciones
│   ├── modules/               # Datos de módulos
│   └── reports/               # Reportes y archivos de datos
│       ├── exports/           # Exportaciones
│       └── test-scores/       # Puntuaciones de pruebas
├── docs/                      # Documentación del proyecto
│   ├── analysis/              # Análisis del proyecto
│   ├── migration/             # Documentación de migraciones
│   ├── modules/               # Documentación de módulos
│   ├── reports/               # Reportes de estado
│   └── security/              # Documentación de seguridad
├── examples/                  # Ejemplos y demostraciones
├── modules/                   # Módulos del sistema
├── nginx/                     # Configuración del servidor web
│   └── ssl/                   # Certificados SSL
├── routes/                    # Rutas de la aplicación
├── scripts/                   # Scripts de utilidad
│   ├── testing/               # Scripts de pruebas
│   └── utilities/             # Scripts de utilidades
├── src/                       # Código fuente principal
│   ├── adapters/              # Adaptadores de integración
│   ├── agents/                # Agentes de IA
│   ├── cache/                 # Sistema de caché
│   ├── config/                # Configuración del sistema
│   ├── core/                  # Funcionalidades centrales
│   ├── database/              # Gestión de base de datos
│   ├── integrations/          # Integraciones externas
│   ├── middleware/            # Middleware de la aplicación
│   ├── modules/               # Módulos del sistema
│   ├── security/              # Sistema de seguridad
│   ├── services/              # Servicios de la aplicación
│   ├── utils/                 # Utilidades generales
│   └── workflows/             # Flujos de trabajo
├── storage/                   # Almacenamiento de archivos
├── templates/                 # Plantillas del sistema
├── test/                      # Pruebas legacy
└── tests/                     # Suite de pruebas principal
    ├── ai/                    # Pruebas de IA
    ├── core/                  # Pruebas del núcleo
    ├── e2e/                   # Pruebas end-to-end
    ├── integration/           # Pruebas de integración
    ├── performance/           # Pruebas de rendimiento
    ├── security/              # Pruebas de seguridad
    ├── unit/                  # Pruebas unitarias
    └── utils/                 # Utilidades de pruebas
```

## Convenciones de Nombrado

### Archivos de Prueba
- **Formato estándar**: `[nombre].test.js`
- **Ejemplos**: `auth.test.js`, `sanitization.test.js`, `360dialog-integration.test.js`

### Archivos de Configuración
- **Formato**: `[herramienta].config.js`
- **Ejemplos**: `jest.config.js`, `babel.config.js`, `eslint.config.js`

### Archivos de Documentación
- **Formato**: `[TEMA]_[SUBTEMA].md` (en mayúsculas)
- **Ejemplos**: `PROJECT_STRUCTURE.md`, `SYSTEM_SUMMARY.md`

### Archivos de Datos
- **Formato JSON**: `[nombre].json`
- **Reportes con timestamp**: `[tipo]-[timestamp].json`

## Organización por Funcionalidad

### Frontend (`client/`)
- **components/**: Componentes React/Vue reutilizables
- **assets/**: Recursos estáticos (CSS, imágenes, JavaScript)
- **pages/**: Páginas principales de la aplicación
- **utils/**: Utilidades específicas del frontend

### Backend (`src/`)
- **core/**: Funcionalidades centrales del sistema
- **modules/**: Módulos específicos (auth, messaging, analytics, etc.)
- **services/**: Servicios de negocio
- **integrations/**: Integraciones con servicios externos

### Pruebas (`tests/`)
- **unit/**: Pruebas unitarias organizadas por módulo
- **integration/**: Pruebas de integración
- **e2e/**: Pruebas end-to-end
- **security/**: Pruebas de seguridad
- **performance/**: Pruebas de rendimiento

### Datos (`data/`)
- **Datos operacionales**: contacts.json, messages.json, etc.
- **reports/**: Reportes y métricas del sistema
- **analytics/**: Datos de análisis y estadísticas

## Archivos de Configuración Principales

| Archivo | Propósito |
|---------|-----------|
| `package.json` | Dependencias y scripts de npm |
| `jest.config.js` | Configuración principal de Jest |
| `jest.config.sandbox.mjs` | Configuración de Jest para sandbox |
| `eslint.config.js` | Configuración de ESLint |
| `babel.config.js` | Configuración de Babel |
| `playwright.config.js` | Configuración de Playwright |
| `.env.example` | Ejemplo de variables de entorno |

## Mejoras Implementadas

### 1. Unificación de Archivos
- ✅ Movidos archivos de prueba del directorio raíz a `tests/`
- ✅ Organizados scripts en `scripts/testing/` y `scripts/utilities/`
- ✅ Centralizados reportes en `data/reports/`
- ✅ Documentación organizada en `docs/`

### 2. Convenciones de Nombrado
- ✅ Estandarizados archivos de prueba con formato `.test.js`
- ✅ Eliminados prefijos `test_` inconsistentes
- ✅ Aplicado formato kebab-case para archivos con múltiples palabras

### 3. Eliminación de Duplicados
- ✅ Verificados y eliminados archivos duplicados
- ✅ Mantenidos archivos de configuración con propósitos específicos

### 4. Limpieza de Archivos Temporales
- ✅ Eliminados archivos `.DS_Store`
- ✅ Mantenidos respaldos importantes en `backups/`

## Mantenimiento Futuro

### Reglas para Nuevos Archivos
1. **Pruebas**: Usar formato `[nombre].test.js` en la carpeta apropiada
2. **Documentación**: Colocar en `docs/` con formato descriptivo
3. **Scripts**: Organizar en `scripts/` por categoría
4. **Datos**: Almacenar en `data/` con estructura lógica

### Revisiones Periódicas
- Verificar que no se acumulen archivos en el directorio raíz
- Mantener la estructura de `tests/` organizada por tipo
- Actualizar esta documentación cuando se agreguen nuevas carpetas

## Contacto y Soporte

Para preguntas sobre la estructura del proyecto o sugerencias de mejora, consulte:
- `docs/COMPONENTS.md` - Documentación de componentes
- `docs/ARCHITECTURE.md` - Arquitectura del sistema
- `docs/TESTING.md` - Guía de pruebas

---

*Última actualización: Octubre 2024*
*Versión: 1.0*
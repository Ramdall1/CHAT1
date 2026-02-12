# ChatBot Enterprise v2.3

Sistema unificado de chat empresarial con IA conversacional, gestión completa de contactos, integración WhatsApp 360Dialog y todas las funcionalidades necesarias para una operación profesional escalable.

## 🚀 Características Principales

- **Chat en Tiempo Real**: Socket.IO para comunicación instantánea
- **API REST Completa**: 50+ endpoints para todas las funcionalidades
- **Autenticación Avanzada**: JWT, 2FA, OAuth2
- **Analíticas y Reportes**: Métricas detalladas del sistema
- **Integración WhatsApp**: Conectividad con 360Dialog (webhooks, templates, campaigns)
- **Sistema de Plantillas**: Gestión de mensajes automatizados con variables
- **Automatización de Flujos**: Workflows inteligentes y campañas
- **Gestión de Contactos**: CRM integrado con campos personalizados
- **Multimedia**: Soporte para imágenes, videos, documentos y audio
- **v2.3 Optimizations**: Connection Pool, Query Cache, LRU Cache, Batch Operations
- **Webhook Deduplication**: Sistema robusto de deduplicación de webhooks
- **Message Echoes**: Confirmación de mensajes enviados
- **Database Adapters**: 7 adaptadores soportados (SQLite, PostgreSQL, MongoDB, Redis, etc.)
- **Database Monitoring**: Monitoreo de performance y queries lentas

## 📋 Requisitos

- Node.js >= 14.0.0
- npm >= 6.0.0

## 🛠️ Instalación

1. **Instalar dependencias**
```bash
npm install
```

2. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

3. **Iniciar el servidor**
```bash
npm start
```

## 🎯 Scripts Disponibles

```bash
npm start                    # Iniciar servidor (main.js)
npm test                     # Ejecutar tests con Jest
npm run test:watch          # Ejecutar tests en modo watch
npm run test:unit           # Ejecutar tests unitarios
npm run test:integration    # Ejecutar tests de integración

# Simulaciones v2.3
node simulations/run-v2.3-simulation.mjs              # Simulación básica
node simulations/run-v2.3-visual.mjs                  # Simulación con delays visuales
node simulations/run-v2.3-detailed.mjs                # Simulación detallada
node simulations/run-v2.3-stress-test.mjs             # Stress test (100,000 webhooks)
node simulations/run-v2.3-full-simulation.mjs         # Simulación completa
```

## 🌐 URLs del Sistema

Una vez iniciado el servidor, puedes acceder a:

- **Aplicación Principal**: http://localhost:3000
- **API Status**: http://localhost:3000/api/status
- **Health Check**: http://localhost:3000/api/health
- **API Estadísticas**: http://localhost:3000/api/stats
- **API Contactos**: http://localhost:3000/api/contacts
- **API Mensajes**: http://localhost:3000/api/messages
- **API Conversaciones**: http://localhost:3000/api/conversations

## 📁 Estructura del Proyecto

```
Chat1/
├── client/                 # Frontend de la aplicación
│   ├── css/               # Estilos CSS
│   ├── js/                # JavaScript del cliente
│   └── html/              # Páginas HTML
├── src/                   # Código fuente del backend
│   ├── api/               # Rutas de la API (50+ endpoints)
│   ├── services/          # Servicios del sistema
│   ├── middleware/        # Middleware personalizado
│   ├── database/          # Adaptadores de BD y optimizaciones v2.3
│   ├── queue/             # Webhook Queue para procesamiento asincrónico
│   ├── components/        # Componentes de negocio
│   └── tests/             # Tests automatizados
├── docs/                  # Documentación
│   ├── general/           # Documentación general
│   └── v2.3/              # Documentación de v2.3
├── simulations/           # Simulaciones v2.3
├── scripts/               # Scripts de utilidad
├── config/                # Configuraciones
├── data/                  # Datos del sistema
├── database/              # Archivos de base de datos
├── main.js                # Servidor principal
├── package.json           # Configuración del proyecto
└── README.md              # Este archivo
```

## 🔧 Configuración

### Variables de Entorno Principales

```env
# Servidor
PORT=3000
NODE_ENV=production

# Base de Datos
DATABASE_URL=sqlite:./data/chatbot.db
DATABASE_ADAPTER=sqlite3

# Autenticación
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# WhatsApp (360Dialog)
D360_API_KEY=your-api-key
D360_PARTNER_ID=your-partner-id
D360_WABA_ACCOUNT_ID=your-waba-account-id
D360_PHONE_NUMBER_ID=your-phone-number-id

# ngrok (para webhooks)
NGROK_AUTH_TOKEN=your-ngrok-token

# CORS
CORS_ORIGIN=*

# Socket.IO
SOCKET_IO_ENABLED=true

# Cache
CACHE_TYPE=memory
CACHE_TTL=3600
```

## 📊 API Endpoints (50+)

### Estado del Sistema
- `GET /api/status` - Estado general del sistema
- `GET /api/health` - Health check del servidor
- `GET /api/stats` - Estadísticas del sistema

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/logout` - Cerrar sesión
- `POST /api/auth/2fa` - Autenticación de dos factores

### Mensajes
- `GET /api/messages` - Obtener mensajes
- `POST /api/messages` - Enviar mensaje
- `PUT /api/messages/:id` - Actualizar mensaje
- `DELETE /api/messages/:id` - Eliminar mensaje

### Contactos
- `GET /api/contacts` - Obtener contactos
- `POST /api/contacts` - Crear contacto
- `PUT /api/contacts/:id` - Actualizar contacto
- `DELETE /api/contacts/:id` - Eliminar contacto
- `GET /api/contacts/:id/custom-fields` - Obtener campos personalizados

### Conversaciones
- `GET /api/conversations` - Obtener conversaciones
- `GET /api/conversations/:id` - Obtener conversación específica
- `POST /api/conversations` - Crear conversación

### Campañas
- `GET /api/campaigns` - Obtener campañas
- `POST /api/campaigns` - Crear campaña
- `PUT /api/campaigns/:id` - Actualizar campaña
- `POST /api/campaigns/:id/send` - Enviar campaña

### Plantillas
- `GET /api/templates` - Obtener plantillas
- `POST /api/templates` - Crear plantilla
- `PUT /api/templates/:id` - Actualizar plantilla

### Webhooks
- `POST /webhooks/360dialog` - Recibir webhooks de 360Dialog
- `POST /webhooks/verify` - Verificar webhook

### Analíticas
- `GET /api/analytics/dashboard` - Dashboard de analíticas
- `GET /api/analytics/messages` - Estadísticas de mensajes
- `GET /api/analytics/contacts` - Estadísticas de contactos

## 🧪 Testing

El sistema incluye tests automatizados para asegurar la calidad:

```bash
# Ejecutar todos los tests
npm test

# Tests con cobertura
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

## 🔒 Seguridad

- **Autenticación JWT**: Tokens seguros para autenticación
- **Rate Limiting**: Protección contra ataques de fuerza bruta
- **Validación de Entrada**: Sanitización de todos los inputs
- **CORS Configurado**: Control de acceso entre dominios
- **Middleware de Seguridad**: Protección contra vulnerabilidades comunes

## 📈 Monitoreo

El sistema incluye métricas y monitoreo integrado:

- **Health Checks**: Verificación automática del estado
- **Métricas de Performance**: Tiempo de respuesta y uso de recursos
- **Logs Estructurados**: Logging detallado para debugging
- **Analíticas**: Métricas de uso y comportamiento

## 🚀 Despliegue

### Desarrollo
```bash
npm start
```

### Docker (opcional)
```bash
docker build -t chat-empresarial .
docker run -p 3000:3000 chat-empresarial
```

### Docker Compose
```bash
docker-compose up -d
```

## 🔗 Integración 360Dialog

### Configuración de Webhooks
1. Obtener `D360_API_KEY` desde el dashboard de 360Dialog
2. Configurar `D360_PARTNER_ID` y `D360_WABA_ACCOUNT_ID`
3. El sistema configura automáticamente el webhook en 360Dialog
4. ngrok se inicia automáticamente para exponer webhooks locales

### Webhooks Soportados
- `messages` - Mensajes entrantes
- `message_echoes` - Confirmación de mensajes enviados
- `message_status` - Cambios de estado de mensajes
- `contacts` - Cambios en contactos

## 🔄 Características v2.3

### Optimizaciones de Performance
- **Connection Pool**: Gestión eficiente de conexiones a BD
- **Query Cache**: Caché de resultados de queries
- **LRU Cache**: Gestión automática de memoria
- **Batch Operations**: Operaciones masivas optimizadas
- **Database Monitoring**: Monitoreo de performance

### Webhook Processing
- **Deduplication**: Sistema robusto de deduplicación
- **Message Echoes**: Confirmación de mensajes enviados
- **Async Queue**: Procesamiento asincrónico con Bull/Redis
- **Error Handling**: Manejo robusto de errores

### Database Adapters
- SQLite3 (por defecto)
- PostgreSQL
- MongoDB
- Redis
- Deno SQLite
- Bun SQLite
- WebSQL

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 📞 Soporte

Para soporte técnico o preguntas:

- **Documentación**: [docs/](./docs/)
- **Documentación v2.3**: [docs/v2.3/](./docs/v2.3/)
- **Simulaciones**: [simulations/](./simulations/)

## 🎯 Roadmap Futuro

- **v2.4**: Integración con más plataformas de mensajería
- **v2.5**: Machine Learning para análisis de sentimientos
- **v3.0**: Refactoring completo y mejoras de arquitectura

---

**Versión**: 2.3.0  
**Última actualización**: Noviembre 2025  
**Estado**: ✅ Production Ready
# CHAT1

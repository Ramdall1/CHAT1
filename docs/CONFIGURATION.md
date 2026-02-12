# Configuración

## Variables de Entorno

### 360Dialog API

```env
D360_API_KEY=tu_api_key
D360_API_BASE=https://waba-v2.360dialog.io
D360_PHONE_NUMBER_ID=tu_phone_id
D360_WABA_ACCOUNT_ID=tu_waba_id
```

### Base de Datos

```env
DATABASE_URL=sqlite:./data/chatbot.db
DATABASE_TYPE=sqlite
```

### Servidor

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### JWT

```env
JWT_SECRET=tu_secret_key
JWT_EXPIRES_IN=24h
REFRESH_EXPIRES_IN=7d
```

### Seguridad

```env
BCRYPT_SALT_ROUNDS=10
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=1800000
```

### CORS

```env
CORS_ENABLED=true
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Webhook

```env
WEBHOOK_VERIFY_TOKEN=tu_verify_token
WEBHOOK_URL=https://tu-dominio.com/api/webhook/360dialog
```

---

## Configuración por Ambiente

### Desarrollo

```env
NODE_ENV=development
LOG_LEVEL=debug
DEBUG_MODE=true
```

### Producción

```env
NODE_ENV=production
LOG_LEVEL=info
DEBUG_MODE=false
CORS_ENABLED=true
ALLOWED_ORIGINS=https://tu-dominio.com
```

---

## Archivos de Configuración

### `.env`

Configuración local (no incluir en Git)

### `.env.example`

Plantilla de configuración

### `.env.production`

Configuración de producción

---

## Estructura de Logs

```
data/logs/
├── errors/
├── info/
├── debug/
├── warnings/
├── api/
├── database/
├── security/
└── performance/
```

---

## Base de Datos

### SQLite

```
data/chatbot.db
```

### Migraciones

```bash
npm run migrate
npm run migrate:reset
npm run migrate:status
```

---

## Más Información

- Ver [Instalación](./INSTALLATION.md)
- Ver [API](./API.md)
- Ver [Deployment](./DEPLOYMENT.md)

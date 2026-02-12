# Instalación

## Requisitos Previos

- Node.js 18+
- npm o yarn
- SQLite3
- Docker (opcional)

## Instalación Local

### 1. Clonar Repositorio

```bash
git clone https://github.com/tu-usuario/Chat-Bot-1-2.git
cd Chat-Bot-1-2
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
D360_API_KEY=tu_api_key
D360_PHONE_NUMBER_ID=tu_phone_id
JWT_SECRET=tu_secret
```

### 4. Inicializar Base de Datos

```bash
npm run migrate
```

### 5. Iniciar Servidor

```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`

---

## Instalación con Docker

### 1. Construir Imagen

```bash
docker build -t chatbot:latest .
```

### 2. Ejecutar Contenedor

```bash
docker run -p 3000:3000 \
  -e D360_API_KEY=tu_api_key \
  -e D360_PHONE_NUMBER_ID=tu_phone_id \
  -v $(pwd)/data:/app/data \
  chatbot:latest
```

### 3. Usar Docker Compose

```bash
docker-compose up -d
```

---

## Verificar Instalación

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{
  "status": "healthy",
  "uptime": 123.45,
  "timestamp": "2025-11-19T11:00:00Z"
}
```

---

## Troubleshooting

### Error: Puerto 3000 en uso

```bash
# Cambiar puerto
PORT=3001 npm start

# O matar proceso
lsof -ti:3000 | xargs kill -9
```

### Error: Base de datos no encontrada

```bash
npm run migrate:reset
```

### Error: Módulos no encontrados

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Próximos Pasos

- Ver [Configuración](./CONFIGURATION.md)
- Ver [API Documentation](./API.md)
- Ver [Deployment](./DEPLOYMENT.md)

# Guía de Deployment a Producción - ChatBot Enterprise

**Última actualización:** 22 de Noviembre, 2025
**Versión:** v2.0.2

---

## 📋 Pre-Deployment Checklist

Antes de desplegar a producción, asegúrate de completar:

- [x] Tests pasando: `npm test`
- [x] Linting sin errores: `npm run lint`
- [x] Build exitoso: `npm run build`
- [x] Variables de entorno configuradas
- [x] Base de datos migrada
- [x] Backup de BD realizado
- [x] SSL/TLS configurado
- [x] Monitoreo configurado
- [x] Health check funcionando

---

## 🚀 Opciones de Deployment

### Opción 1: Heroku

**Requisitos:**
- Cuenta de Heroku
- Heroku CLI instalado

**Pasos:**

```bash
# 1. Crear aplicación
heroku create chatbot-enterprise

# 2. Configurar variables de entorno
heroku config:set NODE_ENV=production
heroku config:set LOG_LEVEL=info
heroku config:set DATABASE_URL=...
heroku config:set JWT_SECRET=...

# 3. Desplegar
git push heroku main

# 4. Ejecutar migraciones
heroku run npm run migrate

# 5. Ver logs
heroku logs --tail
```

---

### Opción 2: AWS EC2

**Requisitos:**
- Instancia EC2 (t2.micro o superior)
- Node.js 14+ instalado
- PM2 para process management

**Pasos:**

```bash
# 1. Conectar a instancia
ssh -i key.pem ec2-user@your-instance.compute.amazonaws.com

# 2. Clonar repositorio
git clone https://github.com/usuario/chatbot-enterprise.git
cd chatbot-enterprise

# 3. Instalar dependencias
npm install

# 4. Configurar variables de entorno
cp .env.example .env
nano .env  # Editar con valores de producción

# 5. Ejecutar migraciones
npm run migrate

# 6. Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 7. Configurar Nginx como reverse proxy
sudo nano /etc/nginx/sites-available/default
# Agregar:
# server {
#     listen 80;
#     server_name your-domain.com;
#     location / {
#         proxy_pass http://localhost:3000;
#     }
# }

# 8. Reiniciar Nginx
sudo systemctl restart nginx
```

---

### Opción 3: DigitalOcean

**Requisitos:**
- Droplet (1GB RAM mínimo)
- Node.js 14+ instalado

**Pasos:**

```bash
# Similar a AWS EC2
# 1. Crear droplet
# 2. SSH a droplet
# 3. Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Clonar y configurar
git clone https://github.com/usuario/chatbot-enterprise.git
cd chatbot-enterprise
npm install

# 5. Configurar variables
cp .env.example .env
nano .env

# 6. Ejecutar migraciones
npm run migrate

# 7. Iniciar con PM2
npm install -g pm2
pm2 start src/main.js --name "chatbot"
pm2 save
pm2 startup

# 8. Configurar SSL con Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d your-domain.com
```

---

### Opción 4: Docker

**Dockerfile:**

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - DATABASE_URL=sqlite:///data/database.sqlite
    volumes:
      - ./data:/app/data
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: always
```

**Desplegar:**

```bash
docker-compose up -d
```

---

## ⚙️ Configuración de Producción

### Variables de Entorno

```bash
# Node
NODE_ENV=production
LOG_LEVEL=info

# Base de Datos
DATABASE_URL=sqlite:///data/database.sqlite
DATABASE_BACKUP_PATH=/backups

# Autenticación
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=24h

# 360Dialog
D360_API_KEY=your-api-key
D360_PARTNER_ID=your-partner-id
D360_WABA_ACCOUNT_ID=your-waba-id

# Redis (opcional)
REDIS_URL=redis://localhost:6379

# Seguridad
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100
```

### Backup Automático

```bash
# Crear script de backup
cat > /usr/local/bin/backup-chatbot.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/chatbot"
mkdir -p $BACKUP_DIR
sqlite3 /app/data/database.sqlite ".backup $BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).db"
# Mantener solo últimos 7 backups
find $BACKUP_DIR -name "backup-*.db" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-chatbot.sh

# Agregar a crontab (cada 6 horas)
0 */6 * * * /usr/local/bin/backup-chatbot.sh
```

### Monitoreo

**Health Check:**

```bash
curl http://localhost:3000/api/health
```

**Logs:**

```bash
# PM2
pm2 logs

# Docker
docker-compose logs -f app

# Syslog
tail -f /var/log/syslog
```

---

## 🔒 Seguridad en Producción

### SSL/TLS

```bash
# Let's Encrypt
sudo certbot certonly --standalone -d your-domain.com

# Nginx configuration
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

### Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Rate Limiting

Configurado en `src/middleware/rateLimiter.js`

### CORS

Configurado en `src/server/SecureServer.js`

---

## 📊 Monitoreo y Alertas

### PM2 Monitoring

```bash
pm2 install pm2-logrotate
pm2 install pm2-auto-pull
pm2 monit
```

### Uptime Monitoring

```bash
# Usar servicio como UptimeRobot
# https://uptimerobot.com
```

### Error Tracking

```bash
# Usar servicio como Sentry
# https://sentry.io
```

---

## 🔄 Actualización de Código

```bash
# 1. Descargar cambios
git pull origin main

# 2. Instalar dependencias
npm install

# 3. Ejecutar migraciones
npm run migrate

# 4. Reiniciar aplicación
pm2 restart chatbot
# o
docker-compose restart app
```

---

## 🚨 Troubleshooting

### Aplicación no inicia

```bash
# Revisar logs
pm2 logs
# o
docker-compose logs app

# Revisar puerto
lsof -i :3000

# Revisar variables de entorno
env | grep NODE_ENV
```

### Base de datos corrupta

```bash
# Restaurar desde backup
cp /backups/chatbot/backup-latest.db /app/data/database.sqlite

# O resetear
npm run migrate:reset
```

### Memoria insuficiente

```bash
# Aumentar límite de Node.js
export NODE_OPTIONS="--max-old-space-size=2048"
npm start
```

---

## 📞 Soporte

Para problemas de deployment:
- Email: support@chatbot-enterprise.com
- Issues: GitHub Issues
- Documentación: /docs

---

**Última actualización:** 22 de Noviembre, 2025

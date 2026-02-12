# Guía de Troubleshooting - ChatBot Enterprise

**Última actualización:** 22 de Noviembre, 2025
**Versión:** v2.0.2

---

## 🔧 Errores Comunes y Soluciones

### Error: "Port 3000 already in use"

**Síntoma:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solución:**

```bash
# Opción 1: Matar proceso en puerto 3000
lsof -ti:3000 | xargs kill -9

# Opción 2: Usar puerto diferente
PORT=3001 npm start

# Opción 3: Verificar qué está usando el puerto
lsof -i :3000
```

---

### Error: "Database connection failed"

**Síntoma:**
```
Error: Cannot open database file
Error: SQLITE_CANTOPEN
```

**Solución:**

```bash
# Opción 1: Ejecutar migraciones
npm run migrate

# Opción 2: Resetear base de datos
npm run migrate:reset

# Opción 3: Verificar permisos
chmod 755 data/
chmod 644 data/database.sqlite

# Opción 4: Crear directorio si no existe
mkdir -p data/
```

---

### Error: "Socket.IO connection refused"

**Síntoma:**
```
WebSocket is closed before the connection is established
```

**Solución:**

```bash
# Opción 1: Verificar que Socket.IO está habilitado
# En src/server/SecureServer.js, verificar setupSocketIO()

# Opción 2: Revisar CORS configuration
# En src/server/SecureServer.js, verificar cors options

# Opción 3: Revisar firewall
sudo ufw status
sudo ufw allow 3000/tcp

# Opción 4: Verificar logs
npm start  # Ver logs en consola
```

---

### Error: "JWT token expired"

**Síntoma:**
```
Error: jwt expired
Unauthorized
```

**Solución:**

```bash
# Opción 1: Limpiar cookies/localStorage
# En navegador: DevTools > Application > Clear Storage

# Opción 2: Obtener nuevo token
# Hacer login nuevamente

# Opción 3: Aumentar expiración de token
# En .env: JWT_EXPIRY=48h

# Opción 4: Usar refresh token
# Implementado en src/services/auth.js
```

---

### Error: "CORS error"

**Síntoma:**
```
Access to XMLHttpRequest at 'http://localhost:3000/api/...' 
from origin 'http://localhost:3001' has been blocked by CORS policy
```

**Solución:**

```bash
# Opción 1: Verificar CORS configuration
# En src/server/SecureServer.js

# Opción 2: Agregar origen permitido
# CORS_ORIGIN=http://localhost:3001

# Opción 3: Usar proxy en desarrollo
# En package.json: "proxy": "http://localhost:3000"

# Opción 4: Deshabilitar CORS (solo desarrollo)
# app.use(cors());
```

---

### Error: "Module not found"

**Síntoma:**
```
Error: Cannot find module 'package-name'
```

**Solución:**

```bash
# Opción 1: Instalar dependencias
npm install

# Opción 2: Limpiar e reinstalar
rm -rf node_modules package-lock.json
npm install

# Opción 3: Instalar paquete específico
npm install package-name

# Opción 4: Verificar import correcto
# import { module } from 'package-name';
```

---

### Error: "Out of memory"

**Síntoma:**
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed
```

**Solución:**

```bash
# Opción 1: Aumentar límite de memoria
export NODE_OPTIONS="--max-old-space-size=2048"
npm start

# Opción 2: Usar PM2 con límite
pm2 start src/main.js --max-memory-restart 1G

# Opción 3: Optimizar código
# Revisar memory leaks
# Usar profiler: node --prof src/main.js
```

---

### Error: "Database locked"

**Síntoma:**
```
Error: database is locked
SQLITE_BUSY
```

**Solución:**

```bash
# Opción 1: Esperar a que se libere
# El error se resuelve automáticamente

# Opción 2: Aumentar timeout
# En DatabaseService.js: busyTimeout(5000)

# Opción 3: Cerrar otras conexiones
# Verificar si hay otros procesos usando la BD

# Opción 4: Usar WAL mode
# PRAGMA journal_mode=WAL;
```

---

### Error: "Rate limit exceeded"

**Síntoma:**
```
Error: Too many requests
429 Too Many Requests
```

**Solución:**

```bash
# Opción 1: Esperar el tiempo especificado
# Por defecto: 15 minutos

# Opción 2: Aumentar límite
# En .env: RATE_LIMIT_MAX_REQUESTS=200

# Opción 3: Usar IP diferente
# El rate limit es por IP

# Opción 4: Deshabilitar en desarrollo
# En src/middleware/rateLimiter.js
```

---

### Error: "Invalid API key"

**Síntoma:**
```
Error: Invalid API key
HTTP 401 Unauthorized
```

**Solución:**

```bash
# Opción 1: Verificar API key
echo $D360_API_KEY

# Opción 2: Actualizar API key
# En .env: D360_API_KEY=your-valid-key

# Opción 3: Obtener nueva API key
# Dashboard de 360Dialog > API Keys

# Opción 4: Verificar permisos
# Asegurar que la API key tiene permisos correctos
```

---

## ❓ Preguntas Frecuentes (FAQ)

### ¿Cómo resetear la base de datos?

```bash
# Opción 1: Resetear completamente
npm run migrate:reset

# Opción 2: Limpiar datos pero mantener estructura
sqlite3 data/database.sqlite "DELETE FROM contacts; DELETE FROM messages;"

# Opción 3: Restaurar desde backup
cp backups/backup-latest.db data/database.sqlite
```

---

### ¿Cómo ver los logs?

```bash
# Opción 1: Logs en consola
npm start

# Opción 2: Logs con PM2
pm2 logs

# Opción 3: Logs de Docker
docker-compose logs -f app

# Opción 4: Logs del sistema
tail -f /var/log/syslog

# Opción 5: Cambiar nivel de log
LOG_LEVEL=debug npm start
```

---

### ¿Cómo hacer backup de la BD?

```bash
# Opción 1: Backup manual
cp data/database.sqlite backups/backup-$(date +%Y%m%d-%H%M%S).db

# Opción 2: Backup con SQLite
sqlite3 data/database.sqlite ".backup backups/backup-latest.db"

# Opción 3: Backup automático
npm run backup

# Opción 4: Backup con crontab
0 */6 * * * /usr/local/bin/backup-chatbot.sh
```

---

### ¿Cómo cambiar el puerto?

```bash
# Opción 1: Variable de entorno
PORT=3001 npm start

# Opción 2: En .env
PORT=3001

# Opción 3: En código
# src/main.js: const PORT = process.env.PORT || 3000;
```

---

### ¿Cómo habilitar HTTPS?

```bash
# Opción 1: Let's Encrypt
sudo certbot certonly --standalone -d your-domain.com

# Opción 2: Certificado autofirmado
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# Opción 3: Nginx reverse proxy
# Ver DEPLOYMENT.md
```

---

### ¿Cómo monitorear el rendimiento?

```bash
# Opción 1: PM2 monitoring
pm2 monit

# Opción 2: Node profiler
node --prof src/main.js
node --prof-process isolate-*.log > profile.txt

# Opción 3: Health check
curl http://localhost:3000/api/health

# Opción 4: Logs de performance
LOG_LEVEL=debug npm start
```

---

### ¿Cómo actualizar dependencias?

```bash
# Opción 1: Actualizar todas
npm update

# Opción 2: Actualizar una específica
npm install package-name@latest

# Opción 3: Verificar actualizaciones
npm outdated

# Opción 4: Auditar seguridad
npm audit
npm audit fix
```

---

### ¿Cómo ejecutar tests?

```bash
# Opción 1: Todos los tests
npm test

# Opción 2: Tests específicos
npm test -- --testNamePattern="test name"

# Opción 3: Watch mode
npm run test:watch

# Opción 4: Coverage
npm test -- --coverage
```

---

### ¿Cómo hacer deploy?

```bash
# Ver DEPLOYMENT.md para opciones completas
# Heroku, AWS EC2, DigitalOcean, Docker

# Resumen rápido:
git add .
git commit -m "chore: update for deployment"
git push origin main
# Luego seguir instrucciones de tu plataforma
```

---

## 📞 Contacto y Soporte

Si el problema persiste después de intentar estas soluciones:

- **Email:** support@chatbot-enterprise.com
- **Issues:** GitHub Issues
- **Documentación:** /docs
- **Logs:** Compartir logs relevantes

---

## 🔍 Cómo Reportar un Bug

1. **Descripción clara** del problema
2. **Pasos para reproducir**
3. **Comportamiento esperado vs actual**
4. **Logs relevantes**
5. **Información del sistema:**
   ```bash
   node --version
   npm --version
   uname -a
   ```

---

**Última actualización:** 22 de Noviembre, 2025

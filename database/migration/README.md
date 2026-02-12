# Sistema de Migración MongoDB → PostgreSQL

Este directorio contiene todas las herramientas necesarias para migrar los datos del ChatBot Enterprise de MongoDB a PostgreSQL.

## 📋 Contenido

```
database/migration/
├── migrate.js              # Script principal de migración
├── validate-migration.js   # Validador de migración
├── rollback.js            # Script de rollback
├── package.json           # Dependencias del proyecto
├── .env.example           # Configuración de ejemplo
├── README.md              # Esta documentación
├── logs/                  # Directorio de logs
└── backups/               # Directorio de backups
```

## 🚀 Instalación

1. **Instalar dependencias:**
   ```bash
   cd database/migration
   npm install
   ```

2. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   # Editar .env con tus configuraciones
   ```

3. **Verificar conexiones:**
   ```bash
   npm run test-connections
   ```

## 📊 Uso

### Migración Completa

```bash
# Migración completa con validación
npm run migrate

# Migración sin validación (más rápido)
npm run migrate:fast

# Dry run (simulación sin cambios)
npm run migrate:dry-run
```

### Migración por Colecciones

```bash
# Migrar solo usuarios
npm run migrate:users

# Migrar solo conversaciones
npm run migrate:conversations

# Migrar solo mensajes
npm run migrate:messages
```

### Validación

```bash
# Validación completa
npm run validate

# Validación rápida (solo conteos)
npm run validate:quick

# Validación detallada con correcciones
npm run validate:detailed
```

### Rollback

```bash
# Rollback con confirmación
npm run rollback

# Rollback forzado (sin confirmación)
npm run rollback:force
```

## ⚙️ Configuración

### Variables de Entorno Principales

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `MONGODB_URL` | URL de conexión a MongoDB | `mongodb://localhost:27017` |
| `MONGODB_DATABASE` | Base de datos MongoDB | `chatbot_enterprise` |
| `POSTGRES_HOST` | Host de PostgreSQL | `localhost` |
| `POSTGRES_DATABASE` | Base de datos PostgreSQL | `chatbot_enterprise` |
| `BATCH_SIZE` | Tamaño de lote para migración | `1000` |
| `PARALLEL_WORKERS` | Trabajadores paralelos | `4` |

### Configuración de Rendimiento

```bash
# Para bases de datos grandes
BATCH_SIZE=5000
PARALLEL_WORKERS=8
CONNECTION_POOL_SIZE=20

# Para bases de datos pequeñas
BATCH_SIZE=500
PARALLEL_WORKERS=2
CONNECTION_POOL_SIZE=5
```

## 📈 Proceso de Migración

### 1. Preparación
- ✅ Backup de MongoDB
- ✅ Verificación de conexiones
- ✅ Creación de esquema PostgreSQL
- ✅ Validación de espacio en disco

### 2. Migración de Datos
1. **Usuarios** → Tabla `users`
2. **Contactos** → Tabla `contacts`
3. **Conversaciones** → Tabla `conversations`
4. **Mensajes** → Tabla `messages`
5. **Plantillas** → Tabla `templates`
6. **Campañas** → Tabla `campaigns`
7. **Etiquetas** → Tabla `tags`
8. **Métricas** → Tabla `conversation_metrics`

### 3. Validación
- ✅ Conteo de registros
- ✅ Integridad referencial
- ✅ Consistencia de datos
- ✅ Verificación de índices

### 4. Optimización
- ✅ Análisis de estadísticas
- ✅ Optimización de índices
- ✅ Configuración de autovacuum

## 🔍 Monitoreo

### Logs

Los logs se generan en tiempo real en:
- `logs/migration-{timestamp}.log`
- `logs/validation-{timestamp}.log`
- `logs/rollback-{timestamp}.log`

### Métricas

Durante la migración se muestran:
- Progreso por colección
- Velocidad de procesamiento
- Errores y advertencias
- Tiempo estimado restante

### Ejemplo de Salida

```
🚀 Iniciando migración MongoDB → PostgreSQL

📊 Estadísticas iniciales:
   MongoDB: 125,430 documentos
   PostgreSQL: 0 registros

🔄 Migrando usuarios...
   ✅ 1,250 usuarios migrados (100%)
   ⏱️  Tiempo: 2.3s | Velocidad: 543 docs/s

🔄 Migrando conversaciones...
   ✅ 45,230 conversaciones migradas (100%)
   ⏱️  Tiempo: 45.2s | Velocidad: 1,001 docs/s

✅ Migración completada exitosamente
📈 Total: 125,430 documentos en 2m 15s
```

## 🛠️ Troubleshooting

### Errores Comunes

#### Error de Conexión MongoDB
```bash
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solución:** Verificar que MongoDB esté ejecutándose
```bash
brew services start mongodb-community
```

#### Error de Conexión PostgreSQL
```bash
Error: password authentication failed
```
**Solución:** Verificar credenciales en `.env`

#### Error de Memoria
```bash
Error: JavaScript heap out of memory
```
**Solución:** Reducir `BATCH_SIZE` y `PARALLEL_WORKERS`

#### Datos Duplicados
```bash
Error: duplicate key value violates unique constraint
```
**Solución:** Ejecutar limpieza antes de migrar
```bash
npm run clean:postgresql
```

### Comandos de Diagnóstico

```bash
# Verificar estado de conexiones
npm run test-connections

# Verificar espacio en disco
npm run check-disk-space

# Limpiar datos de prueba
npm run clean:test-data

# Reparar índices corruptos
npm run repair:indexes
```

## 📋 Checklist Pre-Migración

- [ ] Backup completo de MongoDB
- [ ] PostgreSQL instalado y configurado
- [ ] Esquema PostgreSQL creado
- [ ] Variables de entorno configuradas
- [ ] Conexiones verificadas
- [ ] Espacio en disco suficiente (3x tamaño de datos)
- [ ] Permisos de usuario configurados
- [ ] Firewall configurado si es necesario

## 📋 Checklist Post-Migración

- [ ] Validación de datos completada
- [ ] Índices optimizados
- [ ] Aplicación actualizada para usar PostgreSQL
- [ ] Tests de integración ejecutados
- [ ] Monitoreo configurado
- [ ] Backup de PostgreSQL configurado
- [ ] Documentación actualizada

## 🔒 Seguridad

### Recomendaciones

1. **Credenciales:** Usar variables de entorno, nunca hardcodear
2. **Conexiones:** Usar SSL en producción
3. **Permisos:** Principio de menor privilegio
4. **Backups:** Encriptar backups sensibles
5. **Logs:** No loggear información sensible

### Configuración SSL

```bash
# En .env
ENABLE_SSL=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
SSL_CA_PATH=/path/to/ca.pem
```

## 📞 Soporte

Para problemas o preguntas:

1. Revisar logs en `logs/`
2. Consultar troubleshooting arriba
3. Verificar configuración en `.env`
4. Ejecutar diagnósticos con `npm run diagnose`

## 📄 Licencia

Este sistema de migración es parte del ChatBot Enterprise y está sujeto a la misma licencia del proyecto principal.
# Seguridad de la Base de Datos - Protección de Datos

**Fecha:** 22 de Noviembre, 2025
**Versión:** 1.0

---

## ❓ Pregunta: ¿Se eliminan los datos si se vuelven a crear las tablas?

### ✅ RESPUESTA: NO - Los datos están SEGUROS

---

## 🔒 Por Qué los Datos Están Protegidos

### Palabra Clave: `CREATE TABLE IF NOT EXISTS`

En el archivo `/src/database/initialize-db.js`, todas las tablas se crean con:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  ...
)
```

**La clave es: `IF NOT EXISTS`**

---

## 📊 Cómo Funciona

### Escenario 1: Primera Ejecución
```
✅ La tabla NO existe
✅ Se CREA la tabla
✅ Los datos se insertan
```

### Escenario 2: Ejecuciones Posteriores
```
✅ La tabla YA existe
✅ NO se vuelve a crear
✅ Los datos se MANTIENEN intactos
✅ Se ignora el comando CREATE TABLE
```

---

## 🛡️ Protección de Datos

| Situación | Resultado |
|-----------|-----------|
| **Reiniciar servidor** | ✅ Datos intactos |
| **Ejecutar npm start** | ✅ Datos intactos |
| **Reiniciar máquina** | ✅ Datos intactos |
| **Ejecutar initialize-db.js** | ✅ Datos intactos |
| **Actualizar código** | ✅ Datos intactos |

---

## ⚠️ Cómo ELIMINAR Datos (Si es necesario)

Si necesitas eliminar los datos, tienes 3 opciones:

### Opción 1: Eliminar la Base de Datos Completa
```bash
rm data/database.sqlite
npm start
```
**Resultado:** Nueva BD vacía, todas las tablas se crean de cero

### Opción 2: Limpiar una Tabla Específica
```sql
DELETE FROM users;
DELETE FROM contacts;
-- etc.
```
**Resultado:** Tabla vacía pero estructura intacta

### Opción 3: Usar Comando de Reset (Si existe)
```bash
npm run migrate:reset
```
**Resultado:** BD limpia y reinicializada

---

## 🔍 Verificación

Para verificar que los datos están seguros:

```bash
# Ver contenido de una tabla
sqlite3 data/database.sqlite "SELECT COUNT(*) FROM users;"

# Ver estructura de tabla
sqlite3 data/database.sqlite ".schema users"

# Ver todos los datos
sqlite3 data/database.sqlite "SELECT * FROM users;"
```

---

## 📝 Resumen

```
✅ Los datos NO se eliminan al reiniciar
✅ Las tablas se crean solo si no existen
✅ Los datos se mantienen entre reinicios
✅ La BD es persistente en data/database.sqlite
✅ Necesitas eliminar manualmente si quieres limpiar
```

---

## 🎯 Conclusión

**Tu base de datos está completamente segura.** Los datos se mantienen entre reinicios del servidor y solo se eliminan si:

1. Eliminas manualmente el archivo `data/database.sqlite`
2. Ejecutas un comando de reset explícitamente
3. Ejecutas un comando DELETE en SQL

---

**Última actualización:** 22 de Noviembre, 2025

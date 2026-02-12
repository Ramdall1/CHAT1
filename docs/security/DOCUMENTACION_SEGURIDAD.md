# 🔐 DOCUMENTACIÓN TÉCNICA DE SEGURIDAD
## Chat-Bot-1-2 - Sistema de Sanitización y Protección

---

## 📚 ÍNDICE

1. [Arquitectura de Seguridad](#-arquitectura-de-seguridad)
2. [Servicios de Sanitización](#-servicios-de-sanitización)
3. [Middleware de Protección](#-middleware-de-protección)
4. [Integración en Rutas](#-integración-en-rutas)
5. [Configuración y Personalización](#-configuración-y-personalización)
6. [APIs y Métodos](#-apis-y-métodos)
7. [Logging y Monitoreo](#-logging-y-monitoreo)
8. [Pruebas y Validación](#-pruebas-y-validación)
9. [Mantenimiento](#-mantenimiento)
10. [Troubleshooting](#-troubleshooting)

---

## 🏗️ ARQUITECTURA DE SEGURIDAD

### 📊 Diagrama de Flujo de Seguridad

```
Request → detectAttacks → logSanitization → sanitizeInputs → Route Handler
    ↓           ↓              ↓               ↓
  Block      Log Event    Clean Data      Process
```

### 🔄 Capas de Protección

1. **Capa de Detección**: Identifica amenazas conocidas
2. **Capa de Logging**: Registra eventos de seguridad
3. **Capa de Sanitización**: Limpia y valida datos
4. **Capa de Validación**: Verifica esquemas de datos
5. **Capa de Procesamiento**: Lógica de negocio segura

---

## 🛠️ SERVICIOS DE SANITIZACIÓN

### 📁 InputSanitizationService

**Ubicación**: `src/services/InputSanitizationService.js`

#### 🔧 Configuración Principal

```javascript
class InputSanitizationService {
    constructor() {
        this.maxStringLength = 10000;
        this.maxArrayLength = 1000;
        this.maxObjectDepth = 10;
        
        this.xssOptions = {
            whiteList: {
                // Configuración personalizada de XSS
            }
        };
    }
}
```

#### 🎯 Métodos Principales

##### `sanitizeString(input, options = {})`
**Propósito**: Sanitiza strings generales
**Parámetros**:
- `input`: String a sanitizar
- `options.maxLength`: Longitud máxima (default: 10000)
- `options.allowHtml`: Permitir HTML (default: false)

**Ejemplo**:
```javascript
const clean = service.sanitizeString('<script>alert("xss")</script>', {
    maxLength: 100,
    allowHtml: false
});
// Resultado: 'alert("xss")'
```

##### `sanitizeHtml(input, options = {})`
**Propósito**: Sanitiza contenido HTML
**Parámetros**:
- `input`: HTML a sanitizar
- `options.allowedTags`: Tags permitidos
- `options.allowedAttributes`: Atributos permitidos

**Ejemplo**:
```javascript
const clean = service.sanitizeHtml('<p onclick="evil()">Hello</p>');
// Resultado: '<p>Hello</p>'
```

##### `sanitizeEmail(input)`
**Propósito**: Valida y normaliza emails
**Retorna**: Email válido o null

**Ejemplo**:
```javascript
const email = service.sanitizeEmail('  USER@EXAMPLE.COM  ');
// Resultado: 'user@example.com'
```

##### `sanitizeUrl(input, options = {})`
**Propósito**: Valida URLs y protocolos
**Parámetros**:
- `input`: URL a validar
- `options.allowedProtocols`: Protocolos permitidos

**Ejemplo**:
```javascript
const url = service.sanitizeUrl('javascript:alert("xss")');
// Resultado: null (protocolo no permitido)
```

##### `sanitizeNumber(input, options = {})`
**Propósito**: Valida y convierte números
**Parámetros**:
- `input`: Valor a convertir
- `options.min`: Valor mínimo
- `options.max`: Valor máximo
- `options.integer`: Solo enteros

##### `sanitizeArray(input, itemSanitizer, options = {})`
**Propósito**: Sanitiza arrays recursivamente
**Parámetros**:
- `input`: Array a sanitizar
- `itemSanitizer`: Función para sanitizar elementos
- `options.maxLength`: Longitud máxima del array

##### `sanitizeObject(input, schema, depth = 0)`
**Propósito**: Sanitiza objetos según esquema
**Parámetros**:
- `input`: Objeto a sanitizar
- `schema`: Esquema de validación
- `depth`: Profundidad actual (previene recursión infinita)

#### 🚨 Métodos de Detección

##### `detectSQLInjection(input)`
**Patrones detectados**:
- `'; DROP TABLE`
- `' OR '1'='1`
- `UNION SELECT`
- `INSERT INTO`
- `DELETE FROM`
- `UPDATE SET`

##### `detectXSS(input)`
**Patrones detectados**:
- `<script>`
- `javascript:`
- `onload=`
- `onerror=`
- `onclick=`
- `<iframe>`

##### `detectPathTraversal(input)`
**Patrones detectados**:
- `../`
- `..\\`
- `/etc/passwd`
- `%2e%2e%2f`

##### `detectCommandInjection(input)`
**Patrones detectados**:
- `; ls`
- `| cat`
- `&& rm`
- `` `whoami` ``
- `$(id)`

##### `detectLDAPInjection(input)`
**Patrones detectados**:
- `*)(uid=*`
- `*)(cn=*`
- `)(objectClass=*`

---

## 🛡️ MIDDLEWARE DE PROTECCIÓN

### 📁 inputSanitizationMiddleware.js

**Ubicación**: `src/middleware/inputSanitizationMiddleware.js`

#### 🔧 Middleware Disponibles

##### `detectAttacks(req, res, next)`
**Propósito**: Detecta y bloquea ataques conocidos
**Comportamiento**:
- Analiza req.body, req.query, req.params
- Bloquea request si detecta amenazas
- Registra intento de ataque
- Retorna 400 con mensaje de error

**Ejemplo de uso**:
```javascript
router.post('/messages', detectAttacks, createMessage);
```

##### `logSanitization(req, res, next)`
**Propósito**: Registra eventos de sanitización
**Información registrada**:
- IP del cliente
- Método y URL
- Timestamp
- Datos sanitizados

##### `sanitizeInputs(req, res, next)`
**Propósito**: Sanitización general de inputs
**Procesa**:
- req.body (recursivamente)
- req.query (parámetros de URL)
- req.params (parámetros de ruta)

##### `sanitizeChatMessage(req, res, next)`
**Propósito**: Sanitización específica para mensajes
**Campos procesados**:
- `content`: Contenido del mensaje
- `contact_id`: ID del contacto
- `message_type`: Tipo de mensaje

**Validaciones**:
```javascript
{
    contact_id: 'number|required',
    content: 'string|required|maxLength:5000',
    message_type: 'string|in:text,image,document,audio,video'
}
```

##### `sanitizeContactData(req, res, next)`
**Propósito**: Sanitización específica para contactos
**Campos procesados**:
- `phone_number`: Número de teléfono
- `name`: Nombre del contacto
- `email`: Email del contacto
- `tags`: Tags asociados

**Validaciones**:
```javascript
{
    phone_number: 'string|required|phone',
    name: 'string|maxLength:100',
    email: 'email|optional',
    tags: 'array|optional'
}
```

##### `sanitizeTemplateData(req, res, next)`
**Propósito**: Sanitización específica para templates
**Campos procesados**:
- `name`: Nombre del template
- `content`: Contenido del template
- `category`: Categoría
- `variables`: Variables del template

##### `sanitizeSearchParams(req, res, next)`
**Propósito**: Sanitización de parámetros de búsqueda
**Campos procesados**:
- `search`: Término de búsqueda
- `page`: Número de página
- `limit`: Límite de resultados
- `sort`: Campo de ordenamiento
- `order`: Dirección de ordenamiento

##### `sanitizeFileUpload(req, res, next)`
**Propósito**: Sanitización de archivos subidos
**Validaciones**:
- Tipo de archivo permitido
- Tamaño máximo
- Nombre de archivo seguro
- Contenido del archivo

---

## 🔗 INTEGRACIÓN EN RUTAS

### 📊 Patrón de Implementación

```javascript
// Patrón estándar para todas las rutas
router.post('/endpoint', 
    detectAttacks,           // 1. Detectar ataques
    logSanitization,         // 2. Registrar evento
    sanitizeSpecificData,    // 3. Sanitizar datos específicos
    validateSchema,          // 4. Validar esquema
    routeHandler            // 5. Procesar request
);
```

### 📁 Rutas Implementadas

#### Message Routes (`src/routes/messageRoutes.js`)

```javascript
// Crear mensaje
router.post('/', 
    detectAttacks, 
    logSanitization, 
    sanitizeChatMessage, 
    validateMessageSchema, 
    createMessage
);

// Actualizar mensaje
router.put('/:id', 
    detectAttacks, 
    logSanitization, 
    sanitizeChatMessage, 
    validateMessageSchema, 
    updateMessage
);

// Buscar mensajes
router.get('/search', 
    detectAttacks, 
    logSanitization, 
    sanitizeSearchParams, 
    validateSearchSchema, 
    searchMessages
);
```

#### Contact Routes (`src/routes/contactRoutes.js`)

```javascript
// Crear contacto
router.post('/', 
    detectAttacks, 
    logSanitization, 
    sanitizeContactData, 
    validateContactSchema, 
    createContact
);

// Importar contactos
router.post('/import', 
    detectAttacks, 
    logSanitization, 
    sanitizeFileUpload, 
    sanitizeContactData, 
    validateImportSchema, 
    importContacts
);
```

#### Template Routes (`src/routes/templateRoutes.js`)

```javascript
// Crear template
router.post('/', 
    detectAttacks, 
    logSanitization, 
    sanitizeTemplateData, 
    validateTemplateSchema, 
    createTemplate
);
```

#### Campaign Routes (`src/routes/campaignRoutes.js`)

```javascript
// Crear campaña
router.post('/', 
    detectAttacks, 
    logSanitization, 
    sanitizeInputs, 
    validateCampaignSchema, 
    createCampaign
);
```

#### Analytics Routes (`src/routes/analyticsRoutes.js`)

```javascript
// Dashboard analytics
router.get('/dashboard', 
    detectAttacks, 
    logSanitization, 
    sanitizeSearchParams, 
    validateAnalyticsSchema, 
    getDashboard
);
```

---

## ⚙️ CONFIGURACIÓN Y PERSONALIZACIÓN

### 🔧 Configuración del Servicio

```javascript
// Personalizar límites
const service = new InputSanitizationService();
service.maxStringLength = 5000;
service.maxArrayLength = 500;
service.maxObjectDepth = 5;

// Configurar XSS
service.xssOptions = {
    whiteList: {
        p: ['class'],
        strong: [],
        em: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
};
```

### 🎯 Configuración de Middleware

```javascript
// Configurar detección de ataques
const detectAttacksConfig = {
    enableSQLInjection: true,
    enableXSS: true,
    enablePathTraversal: true,
    enableCommandInjection: true,
    enableLDAPInjection: false,
    logLevel: 'warn'
};

// Aplicar configuración
router.use(detectAttacks.configure(detectAttacksConfig));
```

### 📝 Esquemas de Validación Personalizados

```javascript
// Esquema personalizado para mensajes
const customMessageSchema = {
    content: {
        type: 'string',
        required: true,
        maxLength: 2000,
        sanitize: true
    },
    contact_id: {
        type: 'number',
        required: true,
        min: 1
    },
    priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    }
};
```

---

## 📊 APIS Y MÉTODOS

### 🔍 API del Servicio de Sanitización

#### Métodos Públicos

```javascript
// Sanitización básica
sanitizeString(input, options)
sanitizeHtml(input, options)
sanitizeEmail(input)
sanitizeUrl(input, options)
sanitizeNumber(input, options)
sanitizeBoolean(input, defaultValue)

// Sanitización compleja
sanitizeArray(input, itemSanitizer, options)
sanitizeObject(input, schema, depth)

// Detección de amenazas
detectSQLInjection(input)
detectXSS(input)
detectPathTraversal(input)
detectCommandInjection(input)
detectLDAPInjection(input)

// Análisis completo
analyzeInput(input, context)

// Middleware helpers
middleware(options)
sanitizeQueryParams(query, schema)
sanitizeRequestBody(body, schema)
sanitizeHeaders(headers, schema)
sanitizeFileUpload(file, options)
```

#### Opciones de Configuración

```javascript
// Opciones para sanitizeString
{
    maxLength: 10000,
    allowHtml: false,
    trim: true,
    toLowerCase: false,
    removeSpecialChars: false
}

// Opciones para sanitizeHtml
{
    allowedTags: ['p', 'strong', 'em'],
    allowedAttributes: {
        'p': ['class'],
        'strong': [],
        'em': []
    },
    allowedSchemes: ['http', 'https', 'mailto']
}

// Opciones para sanitizeUrl
{
    allowedProtocols: ['http', 'https'],
    allowedDomains: [],
    requireTLD: true
}

// Opciones para sanitizeNumber
{
    min: Number.MIN_SAFE_INTEGER,
    max: Number.MAX_SAFE_INTEGER,
    integer: false,
    positive: false
}

// Opciones para sanitizeArray
{
    maxLength: 1000,
    allowEmpty: true,
    uniqueItems: false
}
```

---

## 📝 LOGGING Y MONITOREO

### 🔍 Eventos de Seguridad Registrados

#### Tipos de Eventos

1. **ATTACK_DETECTED**: Ataque detectado y bloqueado
2. **SANITIZATION_APPLIED**: Datos sanitizados
3. **VALIDATION_FAILED**: Validación fallida
4. **SUSPICIOUS_ACTIVITY**: Actividad sospechosa

#### Formato de Logs

```json
{
    "timestamp": "2024-01-20T10:30:00.000Z",
    "level": "warn",
    "event": "ATTACK_DETECTED",
    "context": "SECURITY",
    "details": {
        "ip": "192.168.1.100",
        "method": "POST",
        "url": "/api/messages",
        "attackType": "XSS",
        "payload": "<script>alert('xss')</script>",
        "blocked": true
    }
}
```

### 📊 Métricas de Monitoreo

#### Métricas Clave

- **Ataques detectados por hora**
- **Tipos de ataques más comunes**
- **IPs con actividad sospechosa**
- **Rutas más atacadas**
- **Tiempo de respuesta de sanitización**

#### Dashboard de Seguridad

```javascript
// Obtener métricas de seguridad
const securityMetrics = {
    attacksDetected: 150,
    attacksBlocked: 148,
    topAttackTypes: ['XSS', 'SQL_INJECTION', 'PATH_TRAVERSAL'],
    suspiciousIPs: ['192.168.1.100', '10.0.0.50'],
    mostTargetedRoutes: ['/api/messages', '/api/contacts']
};
```

---

## 🧪 PRUEBAS Y VALIDACIÓN

### 📁 Script de Pruebas

**Ubicación**: `test_sanitization_demo.js`

#### Ejecutar Pruebas

```bash
# Pruebas completas de sanitización
node test_sanitization_demo.js

# Pruebas específicas por tipo
node test_sanitization_demo.js --type=xss
node test_sanitization_demo.js --type=sql
```

#### Tipos de Pruebas

1. **Pruebas de XSS**
   - Scripts maliciosos
   - Event handlers
   - JavaScript URLs
   - Iframes maliciosos

2. **Pruebas de SQL Injection**
   - Union attacks
   - Boolean-based attacks
   - Time-based attacks
   - Error-based attacks

3. **Pruebas de Path Traversal**
   - Directory traversal
   - File inclusion
   - URL encoding bypass

4. **Pruebas de Command Injection**
   - Shell commands
   - System calls
   - Pipe operations

### 📊 Resultados Esperados

```
🔒 DEMOSTRACIÓN DE SANITIZACIÓN DIRECTA
==================================================

🧪 Probando sanitizeChatMessage:
  📝 Tipo de ataque: xss
    ✅ <script>alert("XSS")</script>... - Sanitizado
    ✅ <img src="x" onerror="alert('... - Sanitizado
    
📈 RESUMEN GENERAL:
Total de pruebas: 110
✅ Sanitizadas/Bloqueadas: 104 (94.5%)
🛡️ Bloqueadas por detección: 21 (19.1%)
❌ Posibles bypasses: 6 (5.5%)

🏁 RESULTADO FINAL:
✅ BUENO: La sanitización está funcionando bien
Tasa de protección: 94.5%
```

---

## 🔧 MANTENIMIENTO

### 📅 Tareas de Mantenimiento Regular

#### Diario
- [ ] Revisar logs de seguridad
- [ ] Verificar alertas de ataques
- [ ] Monitorear performance

#### Semanal
- [ ] Analizar tendencias de ataques
- [ ] Revisar IPs sospechosas
- [ ] Actualizar patrones de detección

#### Mensual
- [ ] Ejecutar pruebas completas de seguridad
- [ ] Revisar configuración de sanitización
- [ ] Actualizar documentación

#### Trimestral
- [ ] Auditoría completa de seguridad
- [ ] Actualizar dependencias
- [ ] Revisar y actualizar políticas

### 🔄 Actualizaciones de Patrones

```javascript
// Agregar nuevos patrones de detección
service.addSQLInjectionPattern(/EXEC\s+sp_/i);
service.addXSSPattern(/<svg[^>]*onload/i);
service.addCommandInjectionPattern(/\$\(.*\)/);

// Actualizar configuración XSS
service.updateXSSConfig({
    whiteList: {
        ...service.xssOptions.whiteList,
        'div': ['class', 'id']
    }
});
```

---

## 🚨 TROUBLESHOOTING

### ❓ Problemas Comunes

#### 1. Falsos Positivos en Detección

**Síntoma**: Requests legítimos bloqueados
**Causa**: Patrones de detección muy estrictos
**Solución**:
```javascript
// Ajustar sensibilidad
const config = {
    enableSQLInjection: true,
    sqlInjectionThreshold: 0.8, // Reducir sensibilidad
    enableXSS: true,
    xssThreshold: 0.9
};
```

#### 2. Performance Lenta

**Síntoma**: Tiempo de respuesta alto
**Causa**: Sanitización compleja en objetos grandes
**Solución**:
```javascript
// Optimizar configuración
service.maxObjectDepth = 5; // Reducir profundidad
service.maxArrayLength = 500; // Reducir tamaño de arrays
```

#### 3. Datos Sobre-sanitizados

**Síntoma**: Datos válidos removidos incorrectamente
**Causa**: Configuración muy restrictiva
**Solución**:
```javascript
// Permitir más contenido
service.xssOptions.whiteList = {
    ...service.xssOptions.whiteList,
    'span': ['class', 'style'],
    'div': ['class', 'id']
};
```

### 🔍 Debugging

#### Habilitar Logs Detallados

```javascript
// En desarrollo
process.env.LOG_LEVEL = 'debug';
process.env.SECURITY_DEBUG = 'true';

// Logs específicos de sanitización
logger.debug('Sanitization input:', { input, context });
logger.debug('Sanitization output:', { output, changes });
```

#### Verificar Configuración

```javascript
// Verificar estado del servicio
console.log('Service config:', {
    maxStringLength: service.maxStringLength,
    maxArrayLength: service.maxArrayLength,
    maxObjectDepth: service.maxObjectDepth,
    xssOptions: service.xssOptions
});
```

### 📞 Soporte

Para problemas no resueltos:
1. Revisar logs en `/logs/security/`
2. Ejecutar `node test_sanitization_demo.js`
3. Verificar configuración en `src/services/InputSanitizationService.js`
4. Consultar documentación en `/docs/`

---

## 📚 REFERENCIAS

### 🔗 Enlaces Útiles

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Validator.js Documentation](https://github.com/validatorjs/validator.js)
- [XSS Filter Documentation](https://github.com/leizongmin/js-xss)

### 📖 Lecturas Recomendadas

- "Web Application Security" - OWASP Guide
- "Input Validation and Sanitization Best Practices"
- "Express.js Security Best Practices"

---

**Fecha de Documentación**: $(date)
**Versión**: 1.0.0
**Autor**: Chat-Bot-1-2 Security Team
**Estado**: Documentación Completa ✅
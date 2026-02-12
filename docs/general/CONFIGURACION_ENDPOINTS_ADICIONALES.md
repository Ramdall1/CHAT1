# 🔧 Configuración de Endpoints Adicionales

## Fecha: 26 de Octubre, 2025 - 10:32 PM

---

## 📋 **4 ENDPOINTS QUE REQUIEREN CONFIGURACIÓN**

### **1. MENSAJES DE PRODUCTO** 🛍️

**Endpoints:**
- `POST /api/360dialog/send-product`
- `POST /api/360dialog/send-multi-product`

**Error actual:** ❌ "catalog_id must be a valid id from your catalog"

---

#### **Requisitos:**

1. **Catálogo de Productos en Meta Business Suite**
2. **Productos agregados al catálogo**
3. **Catálogo vinculado a WhatsApp Business**

---

#### **Pasos para configurar:**

##### **1. Crear Catálogo**
```
1. Ir a https://business.facebook.com/
2. Iniciar sesión
3. Ir a "Commerce Manager" o "Administrador de comercio"
4. Click en "Crear catálogo"
5. Seleccionar "Comercio electrónico"
6. Nombrar el catálogo
```

##### **2. Agregar Productos**
```
Para cada producto necesitas:
- SKU o ID único (product_retailer_id)
- Nombre
- Descripción
- Precio
- Imagen (URL o upload)
- Disponibilidad

Ejemplo:
{
  "id": "PROD001",
  "name": "Laptop Dell XPS 15",
  "description": "Laptop profesional de alto rendimiento",
  "price": "3500000 COP",
  "availability": "in stock",
  "image_url": "https://example.com/laptop.jpg"
}
```

##### **3. Obtener Catalog ID**

**Opción A - Desde WhatsApp Manager:**
```
1. Ir a https://business.facebook.com/wa/manage/home/
2. Seleccionar tu cuenta WhatsApp Business
3. Ir a "Catálogo" en el menú
4. El catalog_id aparece en:
   - La URL: /catalogs/{CATALOG_ID}
   - Configuración del catálogo
```

**Opción B - Desde API:**
```bash
curl -X GET "https://graph.facebook.com/v18.0/{WABA_ID}/product_catalogs" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"

# Respuesta:
{
  "data": [
    {
      "id": "1234567890123456",  // Este es tu catalog_id
      "name": "Mi Catálogo"
    }
  ]
}
```

##### **4. Usar el Catálogo**

```bash
# Producto Simple
curl -X POST http://localhost:3000/api/360dialog/send-product \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "catalogId": "1234567890123456",     // Tu catalog_id
    "productId": "PROD001",               // SKU del producto
    "body": "🛍️ Mira este producto increíble",
    "footer": "Tienda Online"
  }'

# Multi-Producto
curl -X POST http://localhost:3000/api/360dialog/send-multi-product \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "catalogId": "1234567890123456",
    "header": "📱 Productos Destacados",
    "body": "Selecciona los que te interesen",
    "footer": "Envío gratis",
    "sections": [
      {
        "title": "Laptops",
        "product_items": [
          {"product_retailer_id": "PROD001"},
          {"product_retailer_id": "PROD002"}
        ]
      },
      {
        "title": "Accesorios",
        "product_items": [
          {"product_retailer_id": "ACC001"},
          {"product_retailer_id": "ACC002"}
        ]
      }
    ]
  }'
```

---

### **2. AUTORIZACIÓN DE LLAMADAS** 📞

**Endpoint:** `GET /api/360dialog/call-permission/:phone`

**Error actual:** ❌ "Business initiated calls not available for this account"

---

#### **Requisitos:**

1. **Cuenta WhatsApp Business VERIFICADA** (badge verde)
2. **Aprobación de Meta** para llamadas salientes
3. **Caso de uso válido** (soporte, emergencias, ventas)

---

#### **Pasos para habilitar:**

##### **1. Verificar Cuenta**
```
1. Ir a https://business.facebook.com/wa/manage/home/
2. Ver estado de verificación
3. Si no está verificada:
   - Click en "Verificar cuenta"
   - Proporcionar documentos legales de la empresa
   - Esperar aprobación (1-3 días hábiles)
```

##### **2. Solicitar Acceso a Llamadas**
```
1. Contactar 360Dialog Support:
   - Email: support@360dialog.com
   - Portal: https://hub.360dialog.com/
   
2. Solicitar "Business-Initiated Calling"

3. Proporcionar:
   - Caso de uso detallado
   - Volumen estimado de llamadas
   - Política de privacidad
   - Términos de servicio
```

##### **3. Requisitos de Uso**
```
- Solo llamar usuarios que hayan dado consentimiento
- Respetar horarios (no llamar de noche)
- Permitir que el usuario rechace futuras llamadas
- Mantener tasa de respuesta alta
```

---

#### **ALTERNATIVA: Botón de Llamada en Template** ✅

**Esto SÍ funciona sin permisos especiales:**

```bash
# 1. Crear template con botón de llamada en WhatsApp Manager
Template:
{
  "name": "call_support",
  "category": "UTILITY",
  "language": "es",
  "components": [
    {
      "type": "BODY",
      "text": "Hola {{1}}, ¿necesitas ayuda inmediata?"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "PHONE_NUMBER",
          "text": "📞 Llamar Soporte",
          "phone_number": "+573113705258"
        }
      ]
    }
  ]
}

# 2. Enviar template (el usuario inicia la llamada)
curl -X POST http://localhost:3000/api/360dialog/send-template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "template": {
      "name": "call_support",
      "language": {"code": "es"},
      "components": [
        {
          "type": "body",
          "parameters": [
            {"type": "text", "text": "Juan Pérez"}
          ]
        }
      ]
    }
  }'
```

---

### **3. CREAR TEMPLATES (Borrador)** 📝

**Endpoint:** `POST /api/360dialog/create-template-draft`

**Error actual:** ❌ "Missing or invalid X-API-KEY header"

---

#### **Requisitos:**

1. **Partner API Key** (diferente al WABA API Key)
2. **Partner ID**
3. **WABA Account ID**

---

#### **Pasos para configurar:**

##### **1. Obtener Partner API Key**
```
1. Ir a https://hub.360dialog.com/
2. Iniciar sesión
3. Ir a "Settings" o "Configuración"
4. Ir a "API Keys"
5. Generar/Copiar "Partner API Key"
   (Es diferente al D360-API-KEY para mensajes)
```

##### **2. Obtener IDs necesarios**

**Partner ID:**
```
- En 360Dialog Hub
- URL después de login: /dashboard/{PARTNER_ID}
- O en Settings → Account Info
```

**WABA Account ID:**
```
- En 360Dialog Hub
- Ir a "WhatsApp Accounts"
- Copiar el ID de tu cuenta
```

##### **3. Configurar .env**

```bash
# Agregar/actualizar en .env:

# API Key para mensajes (existente)
DIALOG360_API_KEY=AgfBv5iKrrsrrENqb4VDfeiZAK

# API Key para Partner Hub (NUEVO)
DIALOG360_PARTNER_API_KEY=tu_partner_api_key_aqui

# IDs necesarios
DIALOG360_PARTNER_ID=tu_partner_id
DIALOG360_WABA_ACCOUNT_ID=tu_waba_account_id
```

##### **4. Usar el endpoint**

```bash
# Crear template borrador
curl -X POST http://localhost:3000/api/360dialog/create-template-draft \
  -H "Content-Type: application/json" \
  -d '{
    "name": "welcome_message",
    "category": "MARKETING",
    "language": "es",
    "components": [
      {
        "type": "BODY",
        "text": "Hola {{1}}, bienvenido a nuestra tienda!"
      },
      {
        "type": "FOOTER",
        "text": "Responde STOP para no recibir más mensajes"
      }
    ]
  }'

# Respuesta esperada:
{
  "success": true,
  "template": {
    "id": "abc123",
    "name": "welcome_message",
    "status": "PENDING",
    "category": "MARKETING"
  },
  "message": "Template creado en estado draft. Debe ser aprobado por WhatsApp."
}
```

##### **5. Aprobar Template**

```
1. El template se crea en estado DRAFT/PENDING
2. WhatsApp lo revisa (24-48 horas)
3. Estados posibles:
   - APPROVED ✅: Listo para usar
   - REJECTED ❌: Corregir y reenviar
   - PENDING ⏳: En revisión

4. Ver estado en:
   - 360Dialog Hub
   - O endpoint GET /api/360dialog/templates
```

---

### **4. LISTAR FLOWS (Detallado)** 🔄

**Endpoints:**
- `GET /api/360dialog/list-flows`
- `GET /api/360dialog/get-flow/:flowId`

**Error actual:** ❌ "Missing or invalid X-API-KEY header"

---

#### **Requisitos:**

**Mismos que create-template-draft:**
1. Partner API Key
2. Partner ID  
3. WABA Account ID

---

#### **Usar los endpoints:**

```bash
# Listar todos los flows
curl -s "http://localhost:3000/api/360dialog/list-flows" | python3 -m json.tool

# Con campos específicos
curl -s "http://localhost:3000/api/360dialog/list-flows?fields=id,name,status,categories" | python3 -m json.tool

# Respuesta esperada:
{
  "success": true,
  "count": 2,
  "flows": [
    {
      "id": "1415690066636480",
      "name": "flow",
      "status": "PUBLISHED"
    },
    {
      "id": "987654321",
      "name": "formulario_contacto",
      "status": "DRAFT"
    }
  ]
}

# Obtener flow específico
curl -s "http://localhost:3000/api/360dialog/get-flow/1415690066636480" | python3 -m json.tool

# Respuesta esperada:
{
  "success": true,
  "flow": {
    "id": "1415690066636480",
    "name": "flow",
    "status": "PUBLISHED",
    "categories": ["SIGN_UP"],
    "validation_errors": [],
    "json_version": "3.0",
    "endpoint_uri": "https://api.example.com/flow"
  }
}
```

---

## 📊 **RESUMEN DE CONFIGURACIONES**

### **Variables de Entorno Necesarias:**

```bash
# .env file

# ===== API Keys =====
# Para envío de mensajes (existente)
DIALOG360_API_KEY=AgfBv5iKrrsrrENqb4VDfeiZAK

# Para Partner Hub (NUEVO - necesario para 3 y 4)
DIALOG360_PARTNER_API_KEY=tu_partner_api_key_aqui

# ===== IDs =====
# Para Partner Hub (NUEVO - necesario para 3 y 4)
DIALOG360_PARTNER_ID=tu_partner_id
DIALOG360_WABA_ACCOUNT_ID=tu_waba_account_id

# ===== Catálogo =====
# Para productos (NUEVO - necesario para 1)
# No se guarda en .env, se usa directamente en las llamadas
# catalog_id: obtener desde WhatsApp Manager
```

---

## ✅ **CHECKLIST DE CONFIGURACIÓN**

### **Para Productos (1):**
- [ ] Crear catálogo en Meta Business Suite
- [ ] Agregar productos al catálogo
- [ ] Vincular catálogo a WhatsApp Business
- [ ] Obtener catalog_id
- [ ] Probar con send-product

### **Para Llamadas (2):**
**Opción A - Permisos especiales:**
- [ ] Verificar cuenta WhatsApp Business
- [ ] Contactar 360Dialog/Meta
- [ ] Solicitar "Business-Initiated Calling"
- [ ] Esperar aprobación
- [ ] Probar con call-permission

**Opción B - Templates (recomendado):**
- [ ] Crear template con botón PHONE_NUMBER
- [ ] Aprobar template
- [ ] Usar send-template

### **Para Templates y Flows (3 y 4):**
- [ ] Obtener Partner API Key desde 360Dialog Hub
- [ ] Obtener Partner ID
- [ ] Obtener WABA Account ID
- [ ] Agregar al .env
- [ ] Reiniciar servidor
- [ ] Probar con create-template-draft
- [ ] Probar con list-flows

---

## 🚀 **DESPUÉS DE CONFIGURAR**

```bash
# 1. Actualizar .env con las nuevas variables

# 2. Reiniciar servidor
lsof -ti:3000 | xargs kill -9
npm start

# 3. Probar cada endpoint configurado
curl -X POST http://localhost:3000/api/360dialog/send-product ...
curl -X POST http://localhost:3000/api/360dialog/create-template-draft ...
curl http://localhost:3000/api/360dialog/list-flows
```

---

## 📞 **SOPORTE**

**360Dialog:**
- Web: https://www.360dialog.com/
- Hub: https://hub.360dialog.com/
- Email: support@360dialog.com
- Docs: https://docs.360dialog.com/

**Meta Business:**
- Web: https://business.facebook.com/
- Soporte: https://www.facebook.com/business/help

---

**Documento creado**: 26 de Octubre, 2025 - 10:35 PM
**Endpoints pendientes**: 4
**Configuraciones necesarias**: 3 principales
**Tiempo estimado**: 30-60 minutos (más tiempo de aprobaciones)

# 👁️ Guía Completa de Previsualización - Templates y Flows

## 📋 TABLA DE CONTENIDOS
1. Preview de Templates
2. Preview de Flows
3. Variables en Templates
4. Ejemplos Completos
5. Mejores Prácticas

---

## 📝 PREVIEW DE TEMPLATES

### **Variables en Templates**

Para que Meta pueda previsualizar tu template, **DEBES** incluir la propiedad `example` cuando uses variables.

#### **Estructura correcta:**
```json
{
  "name": "mi_template",
  "category": "MARKETING",
  "language": "es",
  "allow_category_change": true,
  "components": [
    {
      "type": "BODY",
      "text": "Hola {{1}}, tu pedido {{2}} está listo",
      "example": {
        "body_text": [["Juan", "#12345"]]
      }
    }
  ]
}
```

#### **Ejemplo con HEADER + BODY + BUTTONS:**
```json
{
  "name": "order_confirmation",
  "category": "UTILITY",
  "language": "es",
  "allow_category_change": true,
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Pedido {{1}}",
      "example": {
        "header_text": ["#12345"]
      }
    },
    {
      "type": "BODY",
      "text": "Hola {{1}}, tu pedido {{2}} está {{3}}",
      "example": {
        "body_text": [["María", "#12345", "en camino"]]
      }
    },
    {
      "type": "FOOTER",
      "text": "Gracias por tu compra"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Ver pedido",
          "url": "https://tienda.com/pedido/{{1}}",
          "example": ["12345"]
        }
      ]
    }
  ]
}
```

### **Tipos de Examples por Componente:**

| Componente | Campo Example | Formato |
|------------|---------------|---------|
| **HEADER TEXT** | `header_text` | `["valor"]` |
| **HEADER IMAGE** | `header_handle` | `["https://url-imagen.jpg"]` |
| **HEADER VIDEO** | `header_handle` | `["https://url-video.mp4"]` |
| **HEADER DOCUMENT** | `header_handle` | `["https://url-doc.pdf"]` |
| **BODY** | `body_text` | `[["var1", "var2", "var3"]]` |
| **BUTTON URL** | En `buttons` | `["valor"]` |

---

## 🔄 PREVIEW DE FLOWS

### **Endpoint de Preview:**

```bash
GET http://localhost:3000/api/360dialog/flow-preview/:flowId
```

**Query parameters:**
- `invalidate=true` - Genera un nuevo link (por defecto: false)

#### **Ejemplo de uso:**
```bash
# Preview normal
curl http://localhost:3000/api/360dialog/flow-preview/1415690066636480

# Regenerar link
curl http://localhost:3000/api/360dialog/flow-preview/1415690066636480?invalidate=true
```

#### **Respuesta:**
```json
{
  "success": true,
  "preview": {
    "preview_url": "https://business.facebook.com/...",
    "expires_at": "2025-10-28T02:00:00Z",
    "id": "1415690066636480"
  },
  "preview_url": "https://business.facebook.com/...",
  "expires_at": "2025-10-28T02:00:00Z"
}
```

### **Notas importantes sobre Preview de Flows:**

✅ El preview muestra cómo se verán las pantallas
❌ El preview NO es interactivo
⚠️ Las pantallas finales pueden verse ligeramente diferentes para algunos usuarios
💡 Para probar interactividad, usa Meta Builder o envía como borrador vía API

---

## 🎯 CONSULTAR FLOW ESPECÍFICO

```bash
GET http://localhost:3000/api/360dialog/flows/:flowId
```

**Query parameters opcionales:**
- `fields` - Campos a retornar

**Campos disponibles:**
- `id` - ID del Flow
- `name` - Nombre
- `categories` - Categorías
- `validation_errors` - Errores de validación
- `status` - Estado (DRAFT, PUBLISHED, etc.)
- `json_version` - Versión del JSON
- `data_api_version` - Versión de la API
- `endpoint_uri` - URI del webhook
- `preview` - Datos del preview
- `whatsapp_business_account` - Cuenta de WhatsApp

**Ejemplo:**
```bash
curl "http://localhost:3000/api/360dialog/flows/1415690066636480?fields=id,name,status,validation_errors"
```

**Respuesta:**
```json
{
  "success": true,
  "flow": {
    "id": "1415690066636480",
    "name": "Formulario de Contacto",
    "status": "DRAFT",
    "validation_errors": []
  }
}
```

---

## 📚 EJEMPLOS COMPLETOS

### **Ejemplo 1: Template con Variables en BODY**

**Crear:**
```bash
curl -X POST http://localhost:3000/api/360dialog/create-template \
  -H "Content-Type: application/json" \
  -d '{
    "name": "welcome_user",
    "category": "MARKETING",
    "language": "es",
    "allow_category_change": true,
    "components": [
      {
        "type": "HEADER",
        "format": "TEXT",
        "text": "¡Bienvenido!"
      },
      {
        "type": "BODY",
        "text": "Hola {{1}}, gracias por registrarte. Tu código de descuento es {{2}}",
        "example": {
          "body_text": [["Carlos", "BIENVENIDO25"]]
        }
      },
      {
        "type": "FOOTER",
        "text": "Válido por 30 días"
      }
    ]
  }'
```

**Preview que verá Meta:**
```
┌────────────────────────────────┐
│  ¡Bienvenido!                  │
├────────────────────────────────┤
│                                │
│  Hola Carlos, gracias por      │
│  registrarte. Tu código de     │
│  descuento es BIENVENIDO25     │
│                                │
│  Válido por 30 días            │
└────────────────────────────────┘
```

---

### **Ejemplo 2: Template con Botón URL Dinámico**

```bash
curl -X POST http://localhost:3000/api/360dialog/create-template \
  -H "Content-Type: application/json" \
  -d '{
    "name": "track_order",
    "category": "UTILITY",
    "language": "es",
    "allow_category_change": true,
    "components": [
      {
        "type": "BODY",
        "text": "Tu pedido {{1}} está en camino. Llegará el {{2}}",
        "example": {
          "body_text": [["#ABC123", "15 de marzo"]]
        }
      },
      {
        "type": "BUTTONS",
        "buttons": [
          {
            "type": "URL",
            "text": "Rastrear",
            "url": "https://tienda.com/track/{{1}}",
            "example": ["ABC123"]
          }
        ]
      }
    ]
  }'
```

**Preview:**
```
┌────────────────────────────────┐
│  Tu pedido #ABC123 está en     │
│  camino. Llegará el 15 de      │
│  marzo                         │
│                                │
│  ┌──────────────────────────┐  │
│  │  🌐 Rastrear             │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘

URL del botón: https://tienda.com/track/ABC123
```

---

### **Ejemplo 3: Flow Preview**

```bash
# 1. Crear Flow
curl -X POST http://localhost:3000/api/360dialog/create-flow \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Registro de Usuario",
    "categories": ["SIGN_UP"],
    "endpoint_uri": "https://mi-servidor.com/webhook-flow"
  }'

# Respuesta: {"success": true, "flow": {"id": "123456789"}}

# 2. Obtener Preview
curl "http://localhost:3000/api/360dialog/flow-preview/123456789"

# Respuesta:
{
  "success": true,
  "preview_url": "https://business.facebook.com/...",
  "expires_at": "2025-10-28T02:00:00Z"
}
```

---

## ✅ MEJORES PRÁCTICAS

### **Para Templates:**

1. **Siempre incluye `allow_category_change: true`**
   - Evita rechazos por categorización incorrecta

2. **Proporciona ejemplos realistas**
   - Los ejemplos deben ser representativos de datos reales
   - Evita usar "XXX", "test", "123"

3. **Variables secuenciales**
   - Usa {{1}}, {{2}}, {{3}} en orden
   - No saltes números

4. **Longitud de textos**
   - Header: Max 60 caracteres
   - Body: Max 1024 caracteres
   - Footer: Max 60 caracteres
   - Botón: Max 25 caracteres

5. **URLs en botones**
   - Deben comenzar con https://
   - URL encode si tiene caracteres especiales

### **Para Flows:**

1. **Preview antes de publicar**
   - Siempre genera preview para verificar
   - Usa `invalidate=true` si actualizaste el JSON

2. **Validación de campos**
   - Marca campos obligatorios con `required: true`
   - Usa `input-type` apropiado (email, phone, etc.)

3. **Navegación entre pantallas**
   - Usa `on-click-action` con `navigate`
   - Define claramente el `next.name`

4. **Webhook endpoint**
   - Configura `endpoint_uri` para recibir datos
   - Debe ser HTTPS
   - Debe responder 200 OK

---

## 🎨 VISUALIZACIÓN DE DIFERENTES TIPOS

### **Template con Header de Imagen:**
```json
{
  "type": "HEADER",
  "format": "IMAGE",
  "example": {
    "header_handle": ["https://ejemplo.com/producto.jpg"]
  }
}
```

### **Template con Multiple Variables:**
```json
{
  "type": "BODY",
  "text": "Hola {{1}}, tu cita es el {{2}} a las {{3}} en {{4}}",
  "example": {
    "body_text": [["Ana", "15 de marzo", "10:00 AM", "Calle 123"]]
  }
}
```

### **Flow con Dropdown:**
```json
{
  "type": "Dropdown",
  "name": "city",
  "label": "Ciudad",
  "required": true,
  "data-source": [
    {"id": "1", "title": "Bogotá"},
    {"id": "2", "title": "Medellín"},
    {"id": "3", "title": "Cali"}
  ]
}
```

---

## 🚨 ERRORES COMUNES

### **❌ Error: Variables sin ejemplo**
```json
{
  "type": "BODY",
  "text": "Hola {{1}}"
  // ❌ Falta "example"
}
```

**✅ Correcto:**
```json
{
  "type": "BODY",
  "text": "Hola {{1}}",
  "example": {
    "body_text": [["Juan"]]
  }
}
```

### **❌ Error: Array incorrecto de ejemplos**
```json
"example": {
  "body_text": ["Juan", "#123"]  // ❌ Incorrecto
}
```

**✅ Correcto:**
```json
"example": {
  "body_text": [["Juan", "#123"]]  // ✅ Array de arrays
}
```

### **❌ Error: URL sin ejemplo**
```json
{
  "type": "URL",
  "text": "Ver",
  "url": "https://tienda.com/{{1}}"
  // ❌ Falta "example"
}
```

**✅ Correcto:**
```json
{
  "type": "URL",
  "text": "Ver",
  "url": "https://tienda.com/{{1}}",
  "example": ["ABC123"]
}
```

---

## 📊 CHECKLIST DE PREVIEW

### **Antes de crear template:**
- [ ] Todas las variables tienen `example`
- [ ] Los ejemplos son realistas
- [ ] `allow_category_change: true` está incluido
- [ ] URLs comienzan con https://
- [ ] Longitud de textos dentro de límites

### **Antes de publicar Flow:**
- [ ] Flow JSON es válido
- [ ] Preview generado y verificado
- [ ] Campos obligatorios marcados
- [ ] Webhook configurado
- [ ] Navegación entre pantallas funciona

---

**Actualizado:** 27 de Octubre, 2025 - 01:35 AM
**Versión:** 1.0
**Estado:** ✅ Documentación completa de previsualización

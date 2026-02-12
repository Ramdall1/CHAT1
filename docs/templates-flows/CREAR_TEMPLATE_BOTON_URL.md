# 📝 Cómo Crear Template con Botón URL

## ⭐ ESPECIFICACIÓN OFICIAL

**Los botones URL:**
- Cargan una URL en el navegador cuando el usuario los toca
- **Máximo 2 botones URL** por template
- Texto del botón: **Máximo 25 caracteres**
- URL debe estar **URL-encoded** si incluye variables

### **Sintaxis correcta:**
```json
{
  "type": "URL",
  "text": "Shop Now",
  "url": "https://www.luckyshrub.com/shop/"
}
```

---

## Opción 1: WhatsApp Manager

### **Paso 1: Acceder al Manager**
1. Ir a: https://business.facebook.com/wa/manage/home/
2. Seleccionar tu cuenta de WhatsApp Business
3. En el menú lateral, click en "Message templates"

### **Paso 2: Crear Nuevo Template**
1. Click en "Create template"
2. Seleccionar categoría: **MARKETING** o **UTILITY**
3. Nombrar el template: `visita_tienda_online`
4. Seleccionar idioma: **Spanish**

### **Paso 3: Configurar Header (Opcional)**
- Tipo: **Text**
- Contenido: `🛍️ Ofertas Especiales`

### **Paso 4: Configurar Body**
- Contenido: `Descubre nuestras promociones exclusivas. ¡No te lo pierdas!`

### **Paso 5: Agregar Botón URL ⭐**
1. Click en "+ Add buttons"
2. Seleccionar tipo: **Visit website**
3. Configurar:
   - **Button text**: `Comprar Ahora` (máx 25 caracteres)
   - **Website URL**: 
     - Tipo: **Static** → `https://www.tutienda.com/ofertas`
     - O **Dynamic** → `https://www.tutienda.com/producto/{{1}}` (URL con variable)

### **Paso 6: Enviar para Aprobación**
1. Click en "Submit"
2. WhatsApp revisará el template (24-48 horas)
3. Recibirás notificación cuando sea aprobado

---

## Opción 2: 360Dialog Hub

### **Paso 1: Acceder al Hub**
1. Ir a: https://hub.360dialog.com/
2. Login con tus credenciales
3. Seleccionar "Message Templates"

### **Paso 2: Crear Template**
1. Click en "Create Template"
2. Llenar los campos:
   ```json
   {
     "name": "visita_sitio_web",
     "category": "MARKETING",
     "language": "es",
     "components": [
       {
         "type": "HEADER",
         "format": "TEXT",
         "text": "¡Tenemos algo especial para ti! 🎉"
       },
       {
         "type": "BODY",
         "text": "Visita nuestro sitio web y descubre todas las promociones disponibles."
       },
       {
         "type": "BUTTONS",
         "buttons": [
           {
             "type": "URL",
             "text": "Visitar Sitio",
             "url": "https://www.example.com"
           }
         ]
       }
     ]
   }
   ```

### **Paso 3: Submit**
- Click en "Submit for review"
- Esperar aprobación

---

## 📋 **Ejemplos de Templates con Botón URL**

### **Ejemplo 1: 1 Botón URL Estático**
```json
{
  "name": "visita_tienda",
  "category": "MARKETING",
  "language": "es",
  "components": [
    {
      "type": "BODY",
      "text": "Descubre nuestras ofertas exclusivas."
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Comprar Ahora",
          "url": "https://tienda.com/ofertas"
        }
      ]
    }
  ]
}
```

### **Ejemplo 2: 2 Botones URL (Máximo permitido)**
```json
{
  "name": "opciones_compra",
  "category": "MARKETING",
  "language": "es",
  "components": [
    {
      "type": "BODY",
      "text": "Elige tu método de compra preferido:"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Tienda Online",
          "url": "https://tienda.com/shop"
        },
        {
          "type": "URL",
          "text": "App Móvil",
          "url": "https://tienda.com/app"
        }
      ]
    }
  ]
}
```

### **Ejemplo 3: URL Dinámica (con variable)**
```json
{
  "name": "seguimiento_pedido",
  "category": "UTILITY",
  "language": "es",
  "components": [
    {
      "type": "BODY",
      "text": "Tu pedido está en camino. Rastréalo aquí:"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Rastrear Pedido",
          "url": "https://tienda.com/pedido/{{1}}"
        }
      ]
    }
  ]
}
```

**Al enviar:**
```bash
curl -X POST http://localhost:3000/api/360dialog/send-url-button \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "templateName": "seguimiento_pedido",
    "language": {"code": "es"},
    "url": "ABC12345"
  }'
```

**Resultado:** El botón llevará a `https://tienda.com/pedido/ABC12345`

**Nota:** La URL debe estar URL-encoded si contiene caracteres especiales.

### **Ejemplo 4: Combinación URL + Otros Botones**
```json
{
  "type": "BUTTONS",
  "buttons": [
    {
      "type": "URL",
      "text": "Ver Sitio",
      "url": "https://tienda.com"
    },
    {
      "type": "PHONE_NUMBER",
      "text": "Llamar",
      "phone_number": "+573113705258"
    },
    {
      "type": "QUICK_REPLY",
      "text": "No, gracias"
    }
  ]
}
```

**Límite:** Máximo 2 botones URL + 1 botón Phone + hasta 10 Quick Reply (total máx 13 botones)

---

## ⚡ **Uso del Endpoint**

### **Una vez aprobado el template:**

```bash
# URL estática
curl -X POST http://localhost:3000/api/360dialog/send-url-button \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "templateName": "visita_sitio_web",
    "language": {"code": "es"}
  }'

# URL dinámica
curl -X POST http://localhost:3000/api/360dialog/send-url-button \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "templateName": "seguimiento_pedido",
    "language": {"code": "es"},
    "url": "ABC123"  // Reemplaza {{1}} en la URL del template
  }'
```

---

## 🎯 **Casos de Uso**

### **1. E-commerce**
- Ver producto específico
- Rastrear pedido
- Completar compra

### **2. Servicios**
- Agendar cita online
- Ver cotización
- Pagar factura

### **3. Marketing**
- Landing page de campaña
- Registro a evento
- Descargar recurso

### **4. Soporte**
- Ver ticket de soporte
- Base de conocimientos
- Tutorial en video

---

## 📊 **Límites y Restricciones**

| Característica | Límite |
|----------------|--------|
| **Botones URL por template** | **Máx. 2** ⭐ |
| Caracteres en texto del botón | Máx. 25 |
| Longitud de URL | Máx. 2000 caracteres |
| Variables en URL | Máx. 1 ({{1}}) |
| URL encoding | Requerido si hay variables |
| Tipos de botón combinables | Hasta 2 URL + 1 Phone + hasta 10 Quick Reply |
| Total máximo de botones | 13 botones en un template |

---

## ✅ **Checklist de Creación**

- [ ] Decidir tipo de URL (estática o dinámica)
- [ ] Escribir texto del botón (máx. 25 caracteres)
- [ ] Configurar URL completa con https://
- [ ] Crear template en WhatsApp Manager
- [ ] Esperar aprobación (24-48 horas)
- [ ] Probar con el endpoint send-url-button
- [ ] Verificar que el botón funcione en WhatsApp

---

## 🚨 **Errores Comunes**

### **Error: "Template not found"**
- El template no existe o no está aprobado
- Verificar nombre exacto del template
- Verificar idioma correcto

### **Error: "Invalid URL parameter"**
- URL no comienza con https://
- URL contiene caracteres inválidos
- Variable {{1}} no reemplazada

### **Error: "Button text too long"**
- Texto del botón excede 25 caracteres
- Acortar el texto

---

**Documento creado**: 27 de Octubre, 2025 - 01:10 AM
**Estado**: Template pendiente de creación y aprobación
**Endpoint**: ✅ Listo para usar cuando template esté aprobado

# 🧪 PRUEBAS DE ENDPOINTS - Guía Completa

**Sistema de Pruebas para WhatsApp Business Chat-Bot**  
**Fecha:** 27 de Octubre, 2025 - 03:12 AM  
**Versión:** 5.2.0

---

## 📋 ÍNDICE DE ENDPOINTS

### **SERVIDOR**
- `GET /api/health` - Estado del servidor

### **CAMPAÑAS (16 endpoints)**
- `GET /api/campaigns` - Listar campañas
- `POST /api/campaigns` - Crear campaña
- `GET /api/campaigns/:id` - Obtener campaña
- `PUT /api/campaigns/:id` - Actualizar campaña
- `DELETE /api/campaigns/:id` - Eliminar campaña
- `POST /api/campaigns/:id/send` - Enviar campaña
- `POST /api/campaigns/:id/pause` - Pausar campaña
- `POST /api/campaigns/:id/resume` - Reanudar campaña
- `POST /api/campaigns/:id/cancel` - Cancelar campaña
- `GET /api/campaigns/:id/stats` - Estadísticas
- `GET /api/campaigns/:id/messages` - Mensajes enviados
- `POST /api/campaigns/:id/test` - Envío de prueba
- `GET /api/campaigns/:id/timeline` - Timeline
- `GET /api/campaigns/:id/responses` - Respuestas
- `POST /api/campaigns/:id/schedule` - Programar envío
- `POST /api/campaigns/:id/duplicate` - Duplicar campaña

### **MENSAJERÍA (11 endpoints)**
- `POST /api/360dialog/send-text` - Texto
- `POST /api/360dialog/send-image` - Imagen
- `POST /api/360dialog/send-video` - Video
- `POST /api/360dialog/send-audio` - Audio
- `POST /api/360dialog/send-document` - Documento
- `POST /api/360dialog/send-buttons` - Botones
- `POST /api/360dialog/send-list` - Lista
- `POST /api/360dialog/send-template` - Template
- `POST /api/360dialog/send-url-button` - Botón URL
- `POST /api/360dialog/send-location-request` - Ubicación
- `POST /api/360dialog/send-contact` - Contacto

### **TEMPLATES (5 endpoints)**
- `GET /api/360dialog/templates` - Listar templates
- `POST /api/360dialog/create-template` - Crear template
- `GET /api/360dialog/template-examples` - Ejemplos
- `POST /api/360dialog/send-template` - Enviar template
- `POST /api/360dialog/send-url-button` - Template con URL

### **FLOWS (6 endpoints)**
- `GET /api/360dialog/flows` - Listar flows
- `GET /api/360dialog/flows/:id` - Obtener flow
- `POST /api/360dialog/create-flow` - Crear flow
- `POST /api/360dialog/update-flow-assets/:flowId` - Actualizar JSON
- `GET /api/360dialog/flow-preview/:flowId` - Preview
- `DELETE /api/360dialog/delete-flow/:flowId` - Eliminar flow

### **WEBHOOKS (2 endpoints)**
- `POST /webhook/360dialog` - Recibir eventos
- `GET /webhook/360dialog` - Verificación

---

## 🧪 PRUEBAS DE CAMPAÑAS

### **1. Verificar Estado del Servidor**

```bash
# Test 1: Health Check
curl http://localhost:3000/api/health

# Respuesta esperada:
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-10-27T08:12:00.000Z",
  "version": "6.0.0",
  "uptime": 3600
}
```

---

### **2. Listar Campañas Existentes**

```bash
# Test 2: GET /api/campaigns
curl http://localhost:3000/api/campaigns

# Respuesta esperada:
{
  "success": true,
  "campaigns": [
    {
      "id": 1,
      "name": "Campaña de Prueba",
      "status": "draft",
      "total_recipients": 0,
      "sent_count": 0,
      "created_at": "2025-10-27T08:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1
}
```

**Opciones de filtrado:**
```bash
# Filtrar por estado
curl "http://localhost:3000/api/campaigns?status=sent"

# Filtrar por fecha
curl "http://localhost:3000/api/campaigns?date_from=2025-10-01&date_to=2025-10-31"

# Paginación
curl "http://localhost:3000/api/campaigns?page=1&limit=20"
```

---

### **3. Crear Campaña Nueva**

```bash
# Test 3: POST /api/campaigns
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Campaña de Bienvenida",
    "description": "Mensaje de bienvenida a nuevos contactos",
    "message": "¡Hola! Bienvenido a nuestra tienda",
    "filters": "{}",
    "send_immediately": false
  }'

# Respuesta esperada:
{
  "success": true,
  "campaign": {
    "id": 2,
    "name": "Campaña de Bienvenida",
    "status": "draft",
    "total_recipients": 0
  },
  "message": "Campaña creada exitosamente"
}
```

**Con programación:**
```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Campaña Programada",
    "message": "Mensaje programado",
    "scheduled_at": "2025-10-28 10:00:00",
    "filters": "{}"
  }'
```

---

### **4. Obtener Detalles de Campaña**

```bash
# Test 4: GET /api/campaigns/:id
curl http://localhost:3000/api/campaigns/2

# Respuesta esperada:
{
  "success": true,
  "campaign": {
    "id": 2,
    "name": "Campaña de Bienvenida",
    "description": "Mensaje de bienvenida a nuevos contactos",
    "message": "¡Hola! Bienvenido a nuestra tienda",
    "status": "draft",
    "total_recipients": 0,
    "sent_count": 0,
    "delivered_count": 0,
    "read_count": 0,
    "failed_count": 0,
    "created_at": "2025-10-27T08:15:00.000Z"
  }
}
```

---

### **5. Actualizar Campaña**

```bash
# Test 5: PUT /api/campaigns/:id
curl -X PUT http://localhost:3000/api/campaigns/2 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Campaña de Bienvenida Actualizada",
    "message": "¡Hola! Bienvenido a nuestra tienda - Tenemos ofertas especiales"
  }'

# Respuesta esperada:
{
  "success": true,
  "campaign": {
    "id": 2,
    "name": "Campaña de Bienvenida Actualizada",
    "message": "¡Hola! Bienvenido a nuestra tienda - Tenemos ofertas especiales"
  },
  "message": "Campaña actualizada exitosamente"
}
```

---

### **6. Envío de Prueba**

```bash
# Test 6: POST /api/campaigns/:id/test
curl -X POST http://localhost:3000/api/campaigns/2/test \
  -H "Content-Type: application/json" \
  -d '{
    "test_phone": "573113705258"
  }'

# Respuesta esperada:
{
  "success": true,
  "message": "Mensaje de prueba enviado",
  "message_id": "wamid.ABC123..."
}
```

---

### **7. Enviar Campaña**

```bash
# Test 7: POST /api/campaigns/:id/send
curl -X POST http://localhost:3000/api/campaigns/2/send

# Respuesta esperada:
{
  "success": true,
  "message": "Campaña iniciada",
  "campaign_id": 2,
  "total_recipients": 150,
  "estimated_time": "25 minutos"
}
```

---

### **8. Obtener Estadísticas**

```bash
# Test 8: GET /api/campaigns/:id/stats
curl http://localhost:3000/api/campaigns/2/stats

# Respuesta esperada:
{
  "success": true,
  "stats": {
    "campaign_id": 2,
    "total_recipients": 150,
    "sent": 150,
    "delivered": 145,
    "read": 120,
    "failed": 5,
    "delivery_rate": 96.67,
    "read_rate": 82.76,
    "avg_delivery_time": 3.5,
    "avg_read_time": 45.2
  }
}
```

---

### **9. Pausar Campaña**

```bash
# Test 9: POST /api/campaigns/:id/pause
curl -X POST http://localhost:3000/api/campaigns/2/pause

# Respuesta esperada:
{
  "success": true,
  "message": "Campaña pausada",
  "campaign_id": 2,
  "sent_before_pause": 75,
  "pending": 75
}
```

---

### **10. Reanudar Campaña**

```bash
# Test 10: POST /api/campaigns/:id/resume
curl -X POST http://localhost:3000/api/campaigns/2/resume

# Respuesta esperada:
{
  "success": true,
  "message": "Campaña reanudada",
  "campaign_id": 2,
  "pending_messages": 75
}
```

---

### **11. Cancelar Campaña**

```bash
# Test 11: POST /api/campaigns/:id/cancel
curl -X POST http://localhost:3000/api/campaigns/2/cancel

# Respuesta esperada:
{
  "success": true,
  "message": "Campaña cancelada",
  "campaign_id": 2,
  "sent": 75,
  "cancelled": 75
}
```

---

### **12. Programar Envío**

```bash
# Test 12: POST /api/campaigns/:id/schedule
curl -X POST http://localhost:3000/api/campaigns/2/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "scheduled_at": "2025-10-28 10:00:00",
    "timezone": "America/Bogota"
  }'

# Respuesta esperada:
{
  "success": true,
  "message": "Campaña programada",
  "campaign_id": 2,
  "scheduled_at": "2025-10-28T15:00:00.000Z",
  "local_time": "2025-10-28 10:00:00 America/Bogota"
}
```

---

### **13. Duplicar Campaña**

```bash
# Test 13: POST /api/campaigns/:id/duplicate
curl -X POST http://localhost:3000/api/campaigns/2/duplicate

# Respuesta esperada:
{
  "success": true,
  "message": "Campaña duplicada",
  "original_id": 2,
  "new_campaign": {
    "id": 3,
    "name": "Copia de: Campaña de Bienvenida",
    "status": "draft"
  }
}
```

---

### **14. Eliminar Campaña**

```bash
# Test 14: DELETE /api/campaigns/:id
curl -X DELETE http://localhost:3000/api/campaigns/3

# Respuesta esperada:
{
  "success": true,
  "message": "Campaña eliminada",
  "campaign_id": 3
}
```

---

## 📱 PRUEBAS DE MENSAJERÍA

### **1. Enviar Texto Simple**

```bash
# Test 15: POST /api/360dialog/send-text
curl -X POST http://localhost:3000/api/360dialog/send-text \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "text": "¡Hola! Este es un mensaje de prueba"
  }'

# Respuesta esperada:
{
  "success": true,
  "message_id": "wamid.XYZ789...",
  "status": "sent"
}
```

---

### **2. Enviar Imagen**

```bash
# Test 16: POST /api/360dialog/send-image
curl -X POST http://localhost:3000/api/360dialog/send-image \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "image": "https://ejemplo.com/imagen.jpg",
    "caption": "Mira esta imagen"
  }'

# Respuesta esperada:
{
  "success": true,
  "message_id": "wamid.IMG123...",
  "media_type": "image"
}
```

---

### **3. Enviar Botones Interactivos**

```bash
# Test 17: POST /api/360dialog/send-buttons
curl -X POST http://localhost:3000/api/360dialog/send-buttons \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "body": "¿Te interesa nuestra oferta?",
    "footer": "Responde con una opción",
    "buttons": [
      {"id": "yes", "title": "Sí, me interesa"},
      {"id": "no", "title": "No, gracias"},
      {"id": "info", "title": "Más información"}
    ]
  }'

# Respuesta esperada:
{
  "success": true,
  "message_id": "wamid.BTN456...",
  "type": "interactive"
}
```

---

## 📄 PRUEBAS DE TEMPLATES

### **1. Listar Templates**

```bash
# Test 18: GET /api/360dialog/templates
curl http://localhost:3000/api/360dialog/templates

# Respuesta esperada:
{
  "success": true,
  "templates": [
    {
      "id": "C4WeFMcJ9cVWmQ7vpGkNWT",
      "name": "test_template_1761547545",
      "status": "approved",
      "language": "es",
      "category": "MARKETING"
    },
    {
      "id": "KYzjHNNlXCaIaJ88nMXaWT",
      "name": "prueba",
      "status": "approved",
      "language": "en",
      "category": "MARKETING"
    }
  ],
  "total": 2
}
```

---

### **2. Crear Template**

```bash
# Test 19: POST /api/360dialog/create-template
curl -X POST http://localhost:3000/api/360dialog/create-template \
  -H "Content-Type: application/json" \
  -d '{
    "name": "bienvenida_tienda",
    "category": "MARKETING",
    "language": "es",
    "allow_category_change": true,
    "components": [
      {
        "type": "BODY",
        "text": "Hola {{1}}, bienvenido a nuestra tienda. Tenemos ofertas especiales para ti.",
        "example": {
          "body_text": [["Juan"]]
        }
      }
    ]
  }'

# Respuesta esperada:
{
  "success": true,
  "template": {
    "id": "NEW_TEMPLATE_ID",
    "name": "bienvenida_tienda",
    "status": "pending",
    "message": "Template creado. Pendiente de aprobación por WhatsApp"
  }
}
```

---

### **3. Enviar Template**

```bash
# Test 20: POST /api/360dialog/send-template
curl -X POST http://localhost:3000/api/360dialog/send-template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "template": {
      "name": "test_template_1761547545",
      "language": {
        "code": "es"
      }
    }
  }'

# Respuesta esperada:
{
  "success": true,
  "message_id": "wamid.TPL789...",
  "template_name": "test_template_1761547545"
}
```

---

## 🔄 PRUEBAS DE FLOWS

### **1. Listar Flows**

```bash
# Test 21: GET /api/360dialog/flows
curl http://localhost:3000/api/360dialog/flows

# Respuesta esperada:
{
  "success": true,
  "flows": [
    {
      "id": "1234567890",
      "name": "Formulario de Contacto",
      "status": "PUBLISHED",
      "categories": ["LEAD_GENERATION"]
    }
  ],
  "total": 1
}
```

---

### **2. Crear Flow**

```bash
# Test 22: POST /api/360dialog/create-flow
curl -X POST http://localhost:3000/api/360dialog/create-flow \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Registro de Usuario",
    "categories": ["SIGN_UP"]
  }'

# Respuesta esperada:
{
  "success": true,
  "flow": {
    "id": "NEW_FLOW_ID",
    "name": "Registro de Usuario",
    "status": "DRAFT"
  }
}
```

---

### **3. Preview de Flow**

```bash
# Test 23: GET /api/360dialog/flow-preview/:flowId
curl "http://localhost:3000/api/360dialog/flow-preview/1234567890?invalidate=true"

# Respuesta esperada:
{
  "success": true,
  "preview_url": "https://business.facebook.com/wa/manage/flows/...",
  "expires_at": "2025-10-28T08:00:00.000Z",
  "flow_id": "1234567890"
}
```

---

## 📊 RESULTADOS DE PRUEBAS

### **Resumen de Endpoints Probados:**

| Categoría | Total | Probados | Estado |
|-----------|-------|----------|--------|
| Campañas | 16 | 14 | ✅ 87% |
| Mensajería | 11 | 3 | ⏳ 27% |
| Templates | 5 | 3 | ✅ 60% |
| Flows | 6 | 3 | ✅ 50% |
| **TOTAL** | **38** | **23** | **60%** |

---

## 🎯 ENDPOINTS CLAVE PARA PROBAR

### **Mínimo Viable (Debe funcionar):**

1. ✅ `GET /api/health` - Servidor activo
2. ✅ `GET /api/campaigns` - Listar campañas
3. ✅ `POST /api/campaigns` - Crear campaña
4. ✅ `GET /api/campaigns/:id` - Ver campaña
5. ✅ `POST /api/campaigns/:id/send` - Enviar campaña
6. ✅ `GET /api/campaigns/:id/stats` - Estadísticas
7. ✅ `POST /api/360dialog/send-text` - Enviar mensaje
8. ✅ `GET /api/360dialog/templates` - Listar templates

---

## 🚀 CÓMO EJECUTAR LAS PRUEBAS

### **Opción 1: Desde Terminal**

```bash
# Ir al directorio del proyecto
cd /Users/randallteran/Downloads/Chat-Bot-1-2

# Ejecutar pruebas una por una
curl http://localhost:3000/api/health
curl http://localhost:3000/api/campaigns
# ... etc
```

### **Opción 2: Desde Postman**

1. Importar colección de endpoints
2. Configurar variable `base_url = http://localhost:3000`
3. Ejecutar collection runner

### **Opción 3: Desde el Frontend**

```
Acceder a: http://localhost:3000/campaigns-improved.html

Funcionalidades a probar:
1. Tab "Mis Campañas" - Listar campañas
2. Tab "Crear Campaña" - Constructor de mensajes
3. Seleccionar tipo de mensaje
4. Ver preview en tiempo real
5. Enviar mensaje de prueba
```

---

## 📝 CHECKLIST DE PRUEBAS

### **Campañas:**
- [ ] Listar campañas
- [ ] Crear campaña
- [ ] Actualizar campaña
- [ ] Enviar campaña
- [ ] Pausar campaña
- [ ] Reanudar campaña
- [ ] Ver estadísticas
- [ ] Programar envío
- [ ] Duplicar campaña
- [ ] Eliminar campaña

### **Mensajería:**
- [ ] Enviar texto
- [ ] Enviar imagen
- [ ] Enviar video
- [ ] Enviar botones
- [ ] Enviar lista
- [ ] Enviar template

### **Templates:**
- [ ] Listar templates
- [ ] Crear template
- [ ] Enviar template

### **Flows:**
- [ ] Listar flows
- [ ] Crear flow
- [ ] Preview flow

---

**Última actualización:** 27 de Octubre, 2025 - 03:15 AM  
**Versión:** 5.2.0  
**Estado:** Guía de pruebas completa

🧪 **¡Listo para probar todos los endpoints!**


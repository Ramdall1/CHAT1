# 🚀 Sistema de Campañas y Creación de Mensajes

## Fecha: 27 de Octubre, 2025 - 01:05 AM

---

## ✅ **ENDPOINT NUEVO: BOTÓN CON URL**

### **POST /api/360dialog/send-url-button**

**Descripción:** Envía un template con botón de URL (Call to Action)

**Ejemplo de uso:**
```bash
curl -X POST http://localhost:3000/api/360dialog/send-url-button \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "templateName": "nombre_template_con_url",
    "language": {"code": "es"},
    "url": "https://tuempresa.com/producto"
  }'
```

**Nota:** Requiere tener un template aprobado con botón de tipo URL

---

## 📊 **ENDPOINTS TOTALES: 22**

| # | Endpoint | Tipo | Estado |
|---|----------|------|--------|
| 1 | send-text | Mensaje | ✅ |
| 2 | send-image | Multimedia | ✅ |
| 3 | send-video | Multimedia | ✅ |
| 4 | send-audio | Multimedia | ✅ |
| 5 | send-document | Multimedia | ✅ |
| 6 | send-buttons | Interactivo | ✅ |
| 7 | send-list | Interactivo | ✅ |
| 8 | send-location-request | Interactivo | ✅ |
| 9 | send-url-preview | Texto | ✅ |
| 10 | send-contact | Contacto | ✅ |
| 11 | send-template | Template | ✅ |
| 12 | **send-url-button** | Template | ✅ **NUEVO** |
| 13 | send-product | Producto | ⚠️ Requiere catálogo |
| 14 | send-multi-product | Producto | ⚠️ Requiere catálogo |
| 15 | upload-media | Utilidad | ✅ |
| 16 | template-examples | Utilidad | ✅ |
| 17 | templates | Consulta | ✅ |
| 18 | flows | Consulta | ✅ |
| 19 | list-flows | Consulta | ⚠️ Requiere Partner API Key |
| 20 | get-flow/:id | Consulta | ⚠️ Requiere Partner API Key |
| 21 | create-template-draft | Creación | ⚠️ Requiere Partner API Key |
| 22 | call-permission | Llamadas | ⚠️ No disponible |

---

## 🎯 **PRÓXIMA IMPLEMENTACIÓN: CREADOR DE MENSAJES**

### **Funcionalidades necesarias:**

#### 1. **Selector de Tipo de Mensaje**
- ☐ Texto simple
- ☐ Imagen
- ☐ Video
- ☐ Audio
- ☐ Documento
- ☐ Botones (hasta 3)
- ☐ Lista (múltiples secciones)
- ☐ Template (con variables)
- ☐ Flow (formulario)
- ☐ Contacto

#### 2. **Preview en Tiempo Real**
- ☐ Vista previa del mensaje
- ☐ Simulación de apariencia en WhatsApp
- ☐ Preview de templates con componentes
- ☐ Preview de flows interactivos

#### 3. **Editor de Plantillas**
- ☐ Header (texto, imagen, video, documento)
- ☐ Body (texto con variables {{1}}, {{2}}, etc.)
- ☐ Footer (texto opcional)
- ☐ Botones (Quick Reply, URL, Phone, Copy Code, Flow)

#### 4. **Envío y Programación**
- ☐ Envío inmediato
- ☐ Programar fecha/hora
- ☐ Seleccionar destinatarios
- ☐ Envío masivo

---

## 💬 **VISUALIZACIÓN EN CHAT EN VIVO**

### **Estado actual:**

| Tipo | Enviado | Recibido | Estado |
|------|---------|----------|--------|
| Texto | ✅ | ✅ | OK |
| Imagen | ✅ | ✅ | OK |
| Video | ✅ | ⚠️ | Verificar player |
| Audio | ✅ | ⚠️ | Verificar player |
| Documento | ✅ | ✅ | OK |
| Ubicación | ✅ | ✅ | OK |
| Contacto | ✅ | ✅ | OK |
| Botón (respuesta) | N/A | ⚠️ | Verificar diseño |
| Lista (respuesta) | N/A | ⚠️ | Verificar diseño |
| Flow (respuesta) | N/A | ✅ | OK |

### **Archivos relacionados:**
- `public/js/chat-live.js` - Renderizado de mensajes
- `src/api/routes/webhooks.js` - Recepción de webhooks
- `src/services/core/core/UnifiedWebhookService.js` - Procesamiento

---

## 🔧 **PLAN DE DESARROLLO**

### **Fase 1: Verificación (AHORA)**
1. ✅ Endpoint de botón con URL creado
2. ☐ Probar visualización de videos/audios en chat
3. ☐ Probar visualización de respuestas de botones/listas
4. ☐ Verificar que WebSocket funcione correctamente

### **Fase 2: Creador de Mensajes**
1. ☐ Diseñar interfaz de /campaigns
2. ☐ Implementar selector de tipos
3. ☐ Crear preview en tiempo real
4. ☐ Formularios para cada tipo de mensaje

### **Fase 3: Editor de Plantillas**
1. ☐ Constructor visual de templates
2. ☐ Preview de componentes
3. ☐ Gestión de variables
4. ☐ Preview de botones

### **Fase 4: Editor de Flows**
1. ☐ Visualizador de flows existentes
2. ☐ Preview de estructura
3. ☐ Selector de flow para templates

---

## 📝 **NOTAS IMPORTANTES**

### **Templates con botones:**

**Quick Reply:**
```json
{
  "type": "BUTTONS",
  "buttons": [{
    "type": "QUICK_REPLY",
    "text": "Responder"
  }]
}
```

**URL (Call to Action):**
```json
{
  "type": "BUTTONS",
  "buttons": [{
    "type": "URL",
    "text": "Visitar",
    "url": "https://example.com/{{1}}"  // Variable dinámica
  }]
}
```

**Phone:**
```json
{
  "type": "BUTTONS",
  "buttons": [{
    "type": "PHONE_NUMBER",
    "text": "Llamar",
    "phone_number": "+573113705258"
  }]
}
```

**Copy Code:**
```json
{
  "type": "BUTTONS",
  "buttons": [{
    "type": "COPY_CODE",
    "example": ["CODE123"]
  }]
}
```

**Flow:**
```json
{
  "type": "BUTTONS",
  "buttons": [{
    "type": "FLOW",
    "text": "Completar formulario",
    "flow_id": "1415690066636480",
    "flow_action": "navigate"
  }]
}
```

---

## 🎨 **ESTRUCTURA DE LA NUEVA INTERFAZ**

### **/campaigns mejorado:**

```
┌─────────────────────────────────────────────┐
│  📊 Campañas                                │
│  ┌─────────────────────┐  [+ Nueva Campaña]│
│  │                     │                    │
│  │  SELECTOR DE TIPO   │   PREVIEW         │
│  │                     │   ┌──────────┐    │
│  │  ○ Texto            │   │          │    │
│  │  ○ Imagen           │   │  Vista   │    │
│  │  ● Botones          │   │  Previa  │    │
│  │  ○ Lista            │   │  Mensaje │    │
│  │  ○ Template         │   │          │    │
│  │  ○ Flow             │   └──────────┘    │
│  │                     │                    │
│  │  CONFIGURACIÓN      │   [Enviar]        │
│  │  ┌────────────┐     │   [Programar]     │
│  │  │   ...      │     │                    │
│  └──────────────────── │────────────────────│
└─────────────────────────────────────────────┘
```

---

## ✅ **CHECKLIST DE IMPLEMENTACIÓN**

### **Inmediato:**
- [x] Crear endpoint send-url-button
- [ ] Verificar visualización de videos en chat
- [ ] Verificar visualización de audios en chat
- [ ] Verificar respuestas de botones en chat
- [ ] Verificar respuestas de listas en chat

### **Corto plazo:**
- [ ] Nueva interfaz de /campaigns
- [ ] Selector de tipo de mensaje
- [ ] Preview en tiempo real
- [ ] Formularios dinámicos

### **Mediano plazo:**
- [ ] Editor visual de templates
- [ ] Preview de flows
- [ ] Programación de campañas
- [ ] Envío masivo

---

**Próximo paso:** Verificar visualización completa en el chat en vivo y crear la interfaz de campañas mejorada.

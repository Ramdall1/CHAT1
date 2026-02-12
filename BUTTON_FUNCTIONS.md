# Funciones de Botones - WhatsApp

**Fecha:** 22 de Noviembre, 2025
**Versión:** 1.0
**Estado:** ✅ DOCUMENTADO

---

## 📋 Botones Disponibles

### 1. **Quick Reply - Respuesta Rápida (Máx. 10)**

#### Descripción
Botón que permite al usuario seleccionar una respuesta predefinida rápidamente.

#### Función Principal
```javascript
async function handleTemplateQuickReply(templateResponse, appLocals) {
  const { response_data, from } = templateResponse;
  
  logger.info(`Respuesta rápida de ${from}`, { data: response_data });
  
  if (appLocals.localAutomationManager) {
    await appLocals.localAutomationManager.handleTemplateQuickReply(
      templateResponse
    );
  }
}
```

#### Ubicación
- **Archivo:** `/src/api/routes/webhooks.js` (línea 442-452)
- **Handler:** `InteractiveMessageHandler.handleButtonReply()` (línea 66-101)

#### Estructura de Datos
```json
{
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "button_id",
      "title": "Sí"
    }
  }
}
```

#### Ejemplo de Uso
```
Usuario ve: [Sí] [No] [Quizás]
Usuario presiona: Sí
Sistema recibe: button_reply con id y título
```

---

### 2. **URL Button - Botón de Enlace (Máx. 2)**

#### Descripción
Botón que abre un enlace URL cuando el usuario lo presiona.

#### Función Principal
```javascript
async function handleTemplateUrlClick(templateResponse, appLocals) {
  const { response_data, from } = templateResponse;
  
  logger.info(`URL clickeada por ${from}`, { data: response_data });
  
  if (appLocals.localAutomationManager) {
    await appLocals.localAutomationManager.handleTemplateUrlClick(
      templateResponse
    );
  }
}
```

#### Ubicación
- **Archivo:** `/src/api/routes/webhooks.js` (línea 276)
- **Handler:** `InteractiveMessageHandler.handleButtonReply()` (línea 66-101)

#### Estructura de Datos
```json
{
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "button_id",
      "title": "Visitar Sitio"
    }
  }
}
```

#### Parámetros de URL
```
URL Button puede incluir variables dinámicas:
- {{phone_number}} - Número del cliente
- {{customer_id}} - ID del cliente
- {{timestamp}} - Marca de tiempo
```

#### Ejemplo de Uso
```
Usuario ve: [Visitar Tienda] [Más Info]
Usuario presiona: Visitar Tienda
Sistema abre: https://www.mitienda.com?customer={{phone_number}}
```

---

### 3. **Phone Button - Botón de Teléfono (Máx. 1)**

#### Descripción
Botón que inicia una llamada telefónica cuando el usuario lo presiona.

#### Función Principal
```javascript
async function handlePhoneButtonClick(templateResponse, appLocals) {
  const { response_data, from } = templateResponse;
  
  logger.info(`Botón de teléfono presionado por ${from}`, { 
    data: response_data 
  });
  
  // Registrar intento de llamada
  if (appLocals.localMessagingService) {
    await appLocals.localMessagingService.saveInteractiveResponse({
      from,
      type: 'phone_button_click',
      data: response_data,
      timestamp: new Date()
    });
  }
}
```

#### Ubicación
- **Archivo:** `/src/api/routes/webhooks.js`
- **Handler:** `InteractiveMessageHandler.handleButtonReply()` (línea 66-101)

#### Estructura de Datos
```json
{
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "button_id",
      "title": "Llamar Ahora"
    }
  }
}
```

#### Número de Teléfono
```
El número se configura en la plantilla:
- Formato: +57 300 123 4567
- Debe incluir código de país
- Se abre automáticamente en la app de llamadas
```

#### Ejemplo de Uso
```
Usuario ve: [Llamar Soporte]
Usuario presiona: Llamar Soporte
Sistema inicia: Llamada a +57 300 123 4567
```

---

## 🔄 Flujo de Procesamiento

### Cuando el usuario presiona un botón:

```
1. Usuario presiona botón en WhatsApp
   ↓
2. WhatsApp envía webhook con respuesta
   ↓
3. Sistema recibe en /api/webhooks/360dialog
   ↓
4. Identifica tipo: button_reply, list_reply, nfm_reply
   ↓
5. InteractiveMessageHandler.processInteractiveMessage()
   ↓
6. Ejecuta handleButtonReply()
   ↓
7. Guarda respuesta en BD
   ↓
8. Emite evento via Socket.IO
   ↓
9. Ejecuta acción asociada
```

---

## 📊 Estructura de Respuesta

### Button Reply (Quick Reply, URL, Phone)
```json
{
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "button_id_123",
      "title": "Texto del Botón"
    }
  },
  "from": "573102167640",
  "id": "wamid.HBgMNTczMTAyMTY3NjQwFQIAERgUMkFEQzcyOENDOTExRUIwMDc4M0YA",
  "timestamp": "1763777217"
}
```

### List Reply
```json
{
  "interactive": {
    "type": "list_reply",
    "list_reply": {
      "id": "option_id_123",
      "title": "Opción Seleccionada",
      "description": "Descripción"
    }
  }
}
```

### Flow Reply (NFM)
```json
{
  "interactive": {
    "type": "nfm_reply",
    "nfm_reply": {
      "response_json": "{...}",
      "name": "flow_name"
    }
  }
}
```

---

## 🎯 Casos de Uso

### Quick Reply
```
✅ Encuestas rápidas
✅ Confirmaciones (Sí/No)
✅ Selecciones simples
✅ Respuestas predefinidas
```

### URL Button
```
✅ Ir a tienda online
✅ Ver catálogo
✅ Descargar documento
✅ Acceder a portal
```

### Phone Button
```
✅ Contactar soporte
✅ Llamar ventas
✅ Servicio técnico
✅ Citas/Reservas
```

---

## 🔌 Integración con Automatización

### Cuando se presiona un botón, se ejecuta:

```javascript
// En AutomationManager
await automationManager.handleTemplateButtonClick({
  buttonId: 'button_123',
  from: '573102167640',
  title: 'Sí',
  timestamp: new Date()
});
```

### Acciones posibles:
```
1. Enviar mensaje automático
2. Actualizar estado del contacto
3. Crear ticket/caso
4. Registrar en BD
5. Ejecutar flujo de automatización
6. Notificar a agente
```

---

## 📈 Métricas y Tracking

### Datos registrados:
```javascript
{
  from: '573102167640',           // Número del usuario
  buttonId: 'button_123',         // ID del botón
  title: 'Sí',                    // Texto del botón
  type: 'button_reply',           // Tipo de respuesta
  timestamp: '2025-11-22T14:30:00Z', // Cuándo
  messageId: 'wamid.HBgMN...'    // ID del mensaje
}
```

### Eventos emitidos:
```javascript
// Via Socket.IO
io.emit('button_pressed', {
  from: '573102167640',
  buttonId: 'button_123',
  title: 'Sí',
  timestamp: new Date().toISOString()
});
```

---

## ✅ Checklist de Implementación

- ✅ Quick Reply funciona
- ✅ URL Button funciona
- ✅ Phone Button funciona
- ✅ Webhook recibe respuestas
- ✅ Datos se guardan en BD
- ✅ Eventos se emiten via Socket.IO
- ✅ Automatización se ejecuta
- ✅ Métricas se registran

---

**Última actualización:** 22 de Noviembre, 2025

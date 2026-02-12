# 🔄 Crear y Gestionar Flows - Guía Completa

## 📋 ENDPOINTS IMPLEMENTADOS

### **1. Crear Flow**
```bash
POST http://localhost:3000/api/360dialog/create-flow
```

### **2. Actualizar Flow JSON**
```bash
POST http://localhost:3000/api/360dialog/update-flow-assets/:flowId
```

### **3. Preview de Flow**
```bash
GET http://localhost:3000/api/360dialog/flow-preview/:flowId
```

### **4. Eliminar Flow**
```bash
DELETE http://localhost:3000/api/360dialog/delete-flow/:flowId
```

### **5. Listar Flows**
```bash
GET http://localhost:3000/api/360dialog/flows
```

---

## 🚀 CREAR UN FLOW

### **Paso 1: Crear Flow (Borrador)**

```bash
curl -X POST http://localhost:3000/api/360dialog/create-flow \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Formulario de Contacto",
    "categories": ["LEAD_GENERATION"],
    "endpoint_uri": "https://tu-servidor.com/webhook-flow"
  }'
```

**Categorías disponibles:**
- `SIGN_UP` - Registro de usuarios
- `SIGN_IN` - Inicio de sesión
- `APPOINTMENT_BOOKING` - Reserva de citas
- `LEAD_GENERATION` - Generación de leads
- `CONTACT_US` - Contacto
- `CUSTOMER_SUPPORT` - Soporte al cliente
- `SURVEY` - Encuestas
- `OTHER` - Otros

**Respuesta:**
```json
{
  "success": true,
  "flow": {
    "id": "1415690066636480",
    "name": "Formulario de Contacto",
    "status": "DRAFT",
    "categories": ["LEAD_GENERATION"]
  },
  "message": "Flow creado como borrador. Actualiza el JSON con /update-flow-assets"
}
```

---

### **Paso 2: Actualizar Flow JSON**

```bash
curl -X POST http://localhost:3000/api/360dialog/update-flow-assets/1415690066636480 \
  -H "Content-Type: application/json" \
  -d '{
    "flow_json": {
      "version": "3.0",
      "screens": [
        {
          "id": "WELCOME",
          "title": "Bienvenido",
          "data": {},
          "layout": {
            "type": "SingleColumnLayout",
            "children": [
              {
                "type": "Form",
                "name": "contact_form",
                "children": [
                  {
                    "type": "TextInput",
                    "name": "name",
                    "label": "Nombre completo",
                    "required": true
                  },
                  {
                    "type": "TextInput",
                    "name": "email",
                    "label": "Email",
                    "input-type": "email",
                    "required": true
                  },
                  {
                    "type": "TextInput",
                    "name": "phone",
                    "label": "Teléfono",
                    "input-type": "phone",
                    "required": true
                  },
                  {
                    "type": "Footer",
                    "label": "Enviar",
                    "on-click-action": {
                      "name": "complete",
                      "payload": {
                        "name": "${form.name}",
                        "email": "${form.email}",
                        "phone": "${form.phone}"
                      }
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  }'
```

---

## 📝 EJEMPLOS DE FLOW JSON

### **Ejemplo 1: Formulario Simple**
```json
{
  "version": "3.0",
  "screens": [
    {
      "id": "WELCOME",
      "title": "Registro",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "signup_form",
            "children": [
              {
                "type": "TextInput",
                "name": "first_name",
                "label": "Nombre",
                "required": true
              },
              {
                "type": "TextInput",
                "name": "last_name",
                "label": "Apellido",
                "required": true
              },
              {
                "type": "TextInput",
                "name": "email",
                "label": "Email",
                "input-type": "email",
                "required": true
              },
              {
                "type": "Footer",
                "label": "Enviar",
                "on-click-action": {
                  "name": "complete",
                  "payload": {
                    "first_name": "${form.first_name}",
                    "last_name": "${form.last_name}",
                    "email": "${form.email}"
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### **Ejemplo 2: Con Dropdown**
```json
{
  "version": "3.0",
  "screens": [
    {
      "id": "SURVEY",
      "title": "Encuesta",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "survey_form",
            "children": [
              {
                "type": "Dropdown",
                "name": "satisfaction",
                "label": "¿Qué tan satisfecho estás?",
                "required": true,
                "data-source": [
                  {"id": "1", "title": "Muy satisfecho"},
                  {"id": "2", "title": "Satisfecho"},
                  {"id": "3", "title": "Neutral"},
                  {"id": "4", "title": "Insatisfecho"}
                ]
              },
              {
                "type": "TextArea",
                "name": "comments",
                "label": "Comentarios adicionales",
                "required": false
              },
              {
                "type": "Footer",
                "label": "Enviar",
                "on-click-action": {
                  "name": "complete",
                  "payload": {
                    "satisfaction": "${form.satisfaction}",
                    "comments": "${form.comments}"
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### **Ejemplo 3: Multi-Pantalla**
```json
{
  "version": "3.0",
  "screens": [
    {
      "id": "START",
      "title": "Información Personal",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "personal_info",
            "children": [
              {
                "type": "TextInput",
                "name": "name",
                "label": "Nombre",
                "required": true
              },
              {
                "type": "Footer",
                "label": "Siguiente",
                "on-click-action": {
                  "name": "navigate",
                  "next": {
                    "type": "screen",
                    "name": "CONTACT"
                  },
                  "payload": {
                    "name": "${form.name}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "CONTACT",
      "title": "Información de Contacto",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "contact_info",
            "children": [
              {
                "type": "TextInput",
                "name": "email",
                "label": "Email",
                "input-type": "email",
                "required": true
              },
              {
                "type": "TextInput",
                "name": "phone",
                "label": "Teléfono",
                "input-type": "phone",
                "required": true
              },
              {
                "type": "Footer",
                "label": "Enviar",
                "on-click-action": {
                  "name": "complete",
                  "payload": {
                    "name": "${data.name}",
                    "email": "${form.email}",
                    "phone": "${form.phone}"
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## 🎯 COMPONENTES DISPONIBLES

### **Inputs:**
- `TextInput` - Campo de texto
- `TextArea` - Área de texto
- `Dropdown` - Selector
- `CheckboxGroup` - Grupo de checkboxes
- `RadioButtonsGroup` - Grupo de radio buttons
- `DatePicker` - Selector de fecha
- `OptIn` - Checkbox de consentimiento

### **Display:**
- `TextHeading` - Encabezado
- `TextSubheading` - Subencabezado
- `TextBody` - Texto del cuerpo
- `TextCaption` - Caption
- `Image` - Imagen
- `EmbeddedLink` - Link embebido

### **Layout:**
- `Form` - Formulario
- `Footer` - Pie de página con botón

### **Input Types:**
- `text` - Texto normal
- `number` - Números
- `email` - Email
- `phone` - Teléfono
- `password` - Contraseña

---

## 🔗 PREVIEW DEL FLOW

```bash
curl http://localhost:3000/api/360dialog/flow-preview/1415690066636480
```

**Respuesta:**
```json
{
  "success": true,
  "preview": {
    "preview_url": "https://business.facebook.com/...",
    "expires_at": "2025-10-28T01:30:00Z"
  }
}
```

---

## 📱 ENVIAR FLOW EN TEMPLATE

Una vez que el Flow esté listo:

```bash
curl -X POST http://localhost:3000/api/360dialog/send-template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "573113705258",
    "template": {
      "name": "mi_template_con_flow",
      "language": {"code": "es"},
      "flow_button": {
        "flow_token": "FLOW_TOKEN_123",
        "flow_action_data": {
          "screen": "WELCOME"
        }
      }
    }
  }'
```

---

## 🗑️ ELIMINAR FLOW

```bash
curl -X DELETE http://localhost:3000/api/360dialog/delete-flow/1415690066636480
```

---

## 📊 ESTADOS DE FLOW

- `DRAFT` - Borrador (editable)
- `PUBLISHED` - Publicado (en uso)
- `DEPRECATED` - Obsoleto
- `BLOCKED` - Bloqueado

---

## 🔧 WEBHOOK PARA FLOWS

Configura tu webhook para recibir las respuestas:

```javascript
// En tu servidor
app.post('/webhook-flow', (req, res) => {
  const flowResponse = req.body;
  
  console.log('Flow Response:', {
    flow_token: flowResponse.flow_token,
    data: flowResponse.response_json
  });
  
  // Procesar los datos del flow
  const userData = JSON.parse(flowResponse.response_json);
  console.log('Datos del usuario:', userData);
  
  res.status(200).send('OK');
});
```

---

## 📚 RECURSOS

- [Flows Partner API](https://docs.360dialog.com/partner/flows)
- [Flow JSON de Meta](https://developers.facebook.com/docs/whatsapp/flows/reference)
- [Template "Book an Appointment"](https://developers.facebook.com/docs/whatsapp/flows/examples)

---

## ✅ CHECKLIST

- [ ] Crear Flow con categoría apropiada
- [ ] Actualizar Flow JSON con estructura válida
- [ ] Probar preview del Flow
- [ ] Configurar webhook para recibir respuestas
- [ ] Crear template con botón de Flow
- [ ] Publicar Flow
- [ ] Enviar template a usuarios
- [ ] Procesar respuestas del Flow

---

**Actualizado:** 27 de Octubre, 2025 - 01:30 AM
**Endpoints:** 4 nuevos endpoints de Flows
**Estado:** ✅ Sistema completo de gestión de Flows

# API Documentation - ChatBot Enterprise

## Autenticación

Todas las rutas requieren un JWT token en el header `Authorization`:

```bash
Authorization: Bearer <token>
```

---

## Endpoints

### Contactos

#### GET /api/contacts
Obtener lista de contactos con paginación

**Query Parameters:**
- `page` (int): Número de página (default: 1)
- `limit` (int): Registros por página (default: 50)
- `search` (string): Buscar por nombre o teléfono
- `tags` (string): Filtrar por tags

**Response:**
```json
{
  "success": true,
  "contacts": [
    {
      "id": 1,
      "phone_number": "+34123456789",
      "name": "Juan",
      "email": "juan@example.com",
      "tags": ["importante"],
      "status": "active",
      "created_at": "2025-11-22T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

#### POST /api/contacts
Crear nuevo contacto

**Body:**
```json
{
  "phone_number": "+34123456789",
  "name": "Juan",
  "email": "juan@example.com",
  "tags": ["importante"]
}
```

#### GET /api/contacts/:id
Obtener contacto por ID

#### PUT /api/contacts/:id
Actualizar contacto

#### DELETE /api/contacts/:id
Eliminar contacto

---

### Plantillas

#### GET /api/templates
Obtener lista de plantillas

**Query Parameters:**
- `page` (int): Número de página
- `limit` (int): Registros por página
- `category` (string): Filtrar por categoría
- `status` (string): Filtrar por estado

#### POST /api/templates
Crear nueva plantilla

**Body:**
```json
{
  "name": "Bienvenida",
  "category": "greeting",
  "language": "es",
  "body_text": "¡Hola! Bienvenido a nuestro servicio",
  "buttons": [
    {
      "type": "reply",
      "reply": {
        "id": "1",
        "title": "Sí"
      }
    }
  ],
  "variables": ["nombre", "empresa"]
}
```

#### GET /api/templates/:id
Obtener plantilla por ID

#### PUT /api/templates/:id
Actualizar plantilla

#### DELETE /api/templates/:id
Eliminar plantilla

---

### Campañas

#### GET /api/campaigns
Obtener lista de campañas

#### POST /api/campaigns
Crear nueva campaña

**Body:**
```json
{
  "name": "Campaña Navidad",
  "template_id": 1,
  "target_segments": [1, 2, 3],
  "scheduled_at": "2025-12-25T10:00:00Z"
}
```

#### GET /api/campaigns/:id
Obtener campaña por ID

#### PUT /api/campaigns/:id
Actualizar campaña

#### DELETE /api/campaigns/:id
Eliminar campaña

---

### Mensajes

#### GET /api/messages
Obtener lista de mensajes

#### POST /api/messages
Enviar mensaje

**Body:**
```json
{
  "conversation_id": 1,
  "content": "Hola, ¿cómo estás?",
  "type": "text"
}
```

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

- Límite: 100 requests por minuto
- Header: `X-RateLimit-Remaining`

---

## Ejemplos

### Crear contacto
```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+34123456789",
    "name": "Juan",
    "email": "juan@example.com"
  }'
```

### Obtener contactos
```bash
curl http://localhost:3000/api/contacts?page=1&limit=50 \
  -H "Authorization: Bearer <token>"
```

### Crear plantilla
```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bienvenida",
    "body_text": "¡Hola! Bienvenido",
    "category": "greeting"
  }'
```

---

## Webhooks

### 360Dialog Webhook
Endpoint: `POST /api/webhooks/360dialog`

Recibe eventos de WhatsApp en tiempo real.

---

## Variables de Entorno

```env
# Servidor
PORT=3000
NODE_ENV=development

# Base de Datos
DATABASE_URL=sqlite:///data/database.sqlite

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=1h

# 360Dialog
D360_API_KEY=your-api-key
D360_PARTNER_ID=your-partner-id
D360_WABA_ACCOUNT_ID=your-waba-id

# ngrok
NGROK_AUTH_TOKEN=your-ngrok-token
```

---

## Soporte

Para reportar bugs o sugerencias, contacta al equipo de desarrollo.

# �� CAMPAIGN SYSTEM OVERVIEW - Análisis Completo del Módulo de Campañas

**Análisis Técnico Detallado del Sistema de Campañas**  
**Fecha:** 27 de Octubre, 2025  
**Versión del Sistema:** Chat-Bot Enterprise v5.1.0

---

## 📊 RESUMEN EJECUTIVO

| Métrica | Valor |
|---------|-------|
| **Funciones detectadas** | 25+ endpoints y métodos |
| **Tipos de mensajes soportados** | 11 tipos (texto, multimedia, interactivos) |
| **Tipos posibles a añadir** | 8+ tipos avanzados |
| **Nivel de integración 360Dialog** | ⭐⭐⭐⭐☆ (80% - Alto) |
| **Madurez del módulo** | 85% - Funcionalidades base completas |
| **Estado** | ✅ Operativo y escalable |

---

# �� VISIÓN ACTUAL DEL MÓDULO DE CAMPAÑAS

## 1. Descripción Funcional del Módulo

El **módulo de campañas** es un sistema completo de mensajería masiva diseñado para WhatsApp Business vía 360Dialog API. Permite:

### **Capacidades de Envío:**
- ✅ Crear campañas con nombre, descripción y mensajes personalizados
- ✅ Seleccionar destinatarios mediante filtros avanzados
- ✅ Programar envíos diferidos con fecha/hora específica
- ✅ Envío inmediato o programado
- ✅ Throttling inteligente (mensajes por minuto/segundo)
- ✅ Reintentos automáticos para mensajes fallidos
- ✅ Soporte para templates de WhatsApp aprobados
- ✅ Soporte para mensajes con multimedia (imagen, video, audio, documento)
- ✅ Variables dinámicas en mensajes

### **Capacidades de Gestión:**
- ✅ Listar campañas con filtros (estado, fecha, template)
- ✅ Editar campañas en estado draft
- ✅ Pausar/reanudar campañas en progreso
- ✅ Cancelar campañas programadas
- ✅ Duplicar campañas existentes
- ✅ Exportar resultados (CSV/Excel)

### **Capacidades Analíticas:**
- ✅ Estadísticas en tiempo real (enviados, entregados, leídos, fallidos)
- ✅ Tasa de entrega y lectura
- ✅ Timeline de envíos
- ✅ Log de eventos
- ✅ Progreso visual con barra animada
- ✅ Gráficas de estados (pie chart)

### **Componentes Visuales (Frontend):**

#### **A. Página Principal de Campañas**
```
┌───────────────────────────────────────────────────────┐
│ 📊 Campañas                                           │
├───────────────────────────────────────────────────────┤
│                                                        │
│  [+ Nueva Campaña]  [🔍 Buscar]  [📊 Estadísticas]  │
│                                                        │
│  Filtros:                                             │
│  • Estado: [Todas ▼]                                  │
│  • Fecha: [Desde] - [Hasta]                          │
│  • Template: [Todos ▼]                                │
│                                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Tabla de Campañas                               │ │
│  ├─────┬──────────┬─────────┬──────────┬──────────┤ │
│  │ ID  │ Nombre   │ Estado  │ Enviados │ Acciones │ │
│  ├─────┼──────────┼─────────┼──────────┼──────────┤ │
│  │ 123 │ Promo 1  │ Sent    │ 500/500  │ [📊][✏️] │ │
│  │ 124 │ Bienven. │ Running │ 250/500  │ [⏸️][📊] │ │
│  │ 125 │ Follow   │ Draft   │ 0/300    │ [▶️][✏️] │ │
│  └─────┴──────────┴─────────┴──────────┴──────────┘ │
│                                                        │
│  [← Anterior]  Página 1 de 5  [Siguiente →]          │
└───────────────────────────────────────────────────────┘
```

#### **B. Modal de Creación/Edición**
```
┌───────────────────────────────────────────────────────┐
│ ✏️ Crear Campaña                              [×]     │
├───────────────────────────────────────────────────────┤
│                                                        │
│  1️⃣ INFORMACIÓN BÁSICA                                │
│  ┌───────────────────────────────────────────────┐   │
│  │ Nombre: [_____________________________]       │   │
│  │ Descripción: [________________________]       │   │
│  │ Template: [Seleccionar template ▼]            │   │
│  └───────────────────────────────────────────────┘   │
│                                                        │
│  2️⃣ CONTENIDO DEL MENSAJE                             │
│  ┌───────────────────────────────────────────────┐   │
│  │ [Editor de texto con preview]                 │   │
│  │                                                │   │
│  │ Variables disponibles:                        │   │
│  │ {{nombre}}, {{empresa}}, {{ciudad}}           │   │
│  └───────────────────────────────────────────────┘   │
│                                                        │
│  3️⃣ DESTINATARIOS                                     │
│  ┌───────────────────────────────────────────────┐   │
│  │ Filtros:                                       │   │
│  │ ☐ Todos los contactos                         │   │
│  │ ☐ Por etiqueta: [Seleccionar ▼]              │   │
│  │ ☐ Por campo personalizado                     │   │
│  │ ☐ Selección manual                            │   │
│  │                                                │   │
│  │ [👁️ Vista previa (250 contactos)]             │   │
│  └───────────────────────────────────────────────┘   │
│                                                        │
│  4️⃣ PROGRAMACIÓN                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ ⚡ Enviar inmediatamente                       │   │
│  │ 📅 Programar para: [__/__/__ __:__]           │   │
│  └───────────────────────────────────────────────┘   │
│                                                        │
│  [Cancelar]  [Guardar Borrador]  [Enviar Campaña]   │
└───────────────────────────────────────────────────────┘
```

#### **C. Modal de Estadísticas**
```
┌───────────────────────────────────────────────────────┐
│ 📊 Estadísticas: Campaña "Promo Verano"      [×]     │
├───────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────┬──────────────┬──────────────┐      │
│  │ ✅ Enviados  │ 📨 Entregados│ ✓✓ Leídos    │      │
│  │    500       │     485      │     420      │      │
│  │   100%       │    97%       │    84%       │      │
│  └──────────────┴──────────────┴──────────────┘      │
│                                                        │
│  ┌──────────────┬──────────────┐                     │
│  │ ❌ Fallidos  │ ⏳ Pendientes│                     │
│  │     15       │      0       │                     │
│  │    3%        │     0%       │                     │
│  └──────────────┴──────────────┘                     │
│                                                        │
│  📈 Gráfica de Progreso                               │
│  ┌───────────────────────────────────────────────┐   │
│  │        [Gráfica pie/donut]                    │   │
│  │                                                │   │
│  │   Leídos: 84% ████████████████████████        │   │
│  │   Entregados: 13% ████                        │   │
│  │   Fallidos: 3% █                              │   │
│  └───────────────────────────────────────────────┘   │
│                                                        │
│  📅 Timeline                                          │
│  ┌───────────────────────────────────────────────┐   │
│  │ 10:00 - Campaña iniciada                      │   │
│  │ 10:05 - 100 mensajes enviados                 │   │
│  │ 10:10 - 200 mensajes enviados                 │   │
│  │ 10:15 - 300 mensajes enviados                 │   │
│  │ 10:20 - 400 mensajes enviados                 │   │
│  │ 10:25 - Campaña completada (500 mensajes)     │   │
│  └───────────────────────────────────────────────┘   │
│                                                        │
│  [📥 Exportar CSV]  [📥 Exportar Excel]  [Cerrar]    │
└───────────────────────────────────────────────────────┘
```

### **Componentes Backend:**

#### **Rutas API (campaignRoutes.js):**
```javascript
// 8 endpoints principales
POST   /api/campaigns          - Crear campaña
GET    /api/campaigns          - Listar campañas (con filtros)
GET    /api/campaigns/:id      - Obtener detalles
PUT    /api/campaigns/:id      - Actualizar campaña
DELETE /api/campaigns/:id      - Eliminar campaña
POST   /api/campaigns/:id/send - Enviar campaña
POST   /api/campaigns/:id/test - Envío de prueba
GET    /api/campaigns/:id/stats - Estadísticas detalladas
```

#### **Servicios:**
```javascript
// CampaignMessagingService.js
- sendCampaign(campaignId)
- processBatch(messages)
- handleRetry(messageId)
- updateStatus(messageId, status)
- getStats(campaignId)

// Unified360DialogService.js
- sendMessage(to, message)
- sendTemplate(to, template, variables)

// UnifiedWebhookService.js
- processCampaignStatus(webhook)
- updateCampaignMessage(messageId, status)
```

#### **Base de Datos:**
```sql
-- Tablas principales
campaigns              -- Información de campaña
campaign_messages      -- Mensajes individuales
campaign_contacts      -- Relación campaña-contacto
interactive_responses  -- Respuestas de usuarios
```


## 2. Arquitectura Técnica del Módulo

### **Archivos Involucrados:**

```
BACKEND:
├── src/api/routes/
│   ├── campaignRoutes.js (948 líneas)
│   │   - 8 endpoints principales
│   │   - Validación con Joi
│   │   - Rate limiting (30 req/5min)
│   │   - Autenticación JWT
│   │
│   └── campaignsRoutes.js (alternativo)
│       - Endpoints adicionales
│       - Gestión de audiencias
│
├── src/services/campaigns/
│   └── CampaignMessagingService.js (445 líneas)
│       - Throttling inteligente
│       - Procesamiento en lotes
│       - Reintentos automáticos
│       - Métricas en tiempo real
│       - EventEmitter para progreso
│
├── src/services/core/core/
│   ├── Unified360DialogService.js
│   │   - Integración con 360Dialog API
│   │   - Envío de todos los tipos de mensajes
│   │
│   └── UnifiedWebhookService.js
│       - Procesamiento de webhooks
│       - Actualización de estados
│       - Asociación con campañas
│
└── src/adapters/
    └── SequelizeAdapter.js
        - Modelos de BD (Campaign, CampaignContact)

FRONTEND:
├── client/
│   ├── campaigns.html
│   │   - Interfaz principal
│   │   - Tabla de campañas
│   │   - Modales de creación/edición
│   │   - Modal de estadísticas
│   │
│   └── js/campaigns.js (1111 líneas)
│       - CampaignsManager class
│       - Gestión de estado
│       - Comunicación con API
│       - Rendering de UI
│       - WebSocket para updates en vivo
│
└── public/
    └── campaigns.html (copia/alternativa)

BASE DE DATOS:
└── data/chatbot.db
    ├── campaigns (tabla principal)
    ├── campaign_messages (mensajes individuales)
    ├── campaign_contacts (relación many-to-many)
    └── templates (plantillas de WhatsApp)
```

### **Dependencias Internas:**

```mermaid
CampaignsManager (Frontend)
    ↓ fetch API
RouteManager → campaignRoutes.js
    ↓
CampaignMessagingService
    ↓
├→ Unified360DialogService → 360Dialog API
├→ SQLite Database
└→ EventBus → WebSocket → Frontend

Webhook 360Dialog
    ↓
UnifiedWebhookService
    ↓
├→ Actualizar campaign_messages
├→ Actualizar campaigns (contadores)
└→ Broadcast WebSocket → Frontend
```

### **Configuración de Throttling:**

```javascript
throttleConfig = {
    messagesPerMinute: 60,      // Límite por minuto
    messagesPerSecond: 1,        // 1 mensaje/segundo
    delayBetweenMessages: 1000,  // 1 segundo de delay
    batchSize: 10,               // Lotes de 10 mensajes
    maxRetries: 3                // 3 intentos por mensaje
}
```

## 3. Flujo Completo de Envío

### **Flujo Detallado Paso a Paso:**

```
┌──────────────────────────────────────────────────────────┐
│ 1. CREACIÓN DE CAMPAÑA                                   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Frontend (CampaignsManager):                              │
│   └→ Usuario llena formulario                            │
│   └→ Selecciona template o mensaje personalizado         │
│   └→ Define filtros de destinatarios:                    │
│      • Por etiquetas (tags)                              │
│      • Por campos personalizados                         │
│      • Por estado (activo/inactivo)                      │
│      • Por búsqueda de texto                             │
│      • Selección manual de contactos                     │
│   └→ Vista previa de destinatarios:                      │
│      • Query a /api/contacts con filtros                 │
│      • Muestra lista de contactos seleccionados          │
│      • Cuenta total de destinatarios                     │
│   └→ Configura programación:                             │
│      • Envío inmediato (send_immediately = true)         │
│      • Programado (scheduled_at = fecha/hora)            │
│   └→ POST /api/campaigns                                 │
│                                                           │
│ Backend (campaignRoutes.js):                             │
│   └→ Validación con Joi:                                 │
│      • name: string 1-100 chars                          │
│      • template_id: integer positive                     │
│      • contact_ids: array de integers                    │
│      • scheduled_at: ISO date >= now                     │
│      • variables: object key-value                       │
│   └→ Sanitización de inputs                              │
│   └→ Verificar autenticación JWT                         │
│   └→ INSERT INTO campaigns:                              │
│      • name, description, message                        │
│      • filters (JSON)                                    │
│      • status = 'draft' o 'scheduled'                    │
│      • scheduled_at                                      │
│      • created_by = user.id                              │
│   └→ Obtener destinatarios según filtros:                │
│      • Query a contacts con WHERE clause                 │
│      • Aplicar filtros de etiquetas                      │
│      • Aplicar campos personalizados                     │
│      • Validar teléfonos activos                         │
│   └→ INSERT INTO campaign_contacts:                      │
│      • campaign_id                                       │
│      • contact_id                                        │
│      • variables (JSON) - personalización                │
│   └→ UPDATE campaigns SET total_recipients               │
│   └→ Si send_immediately:                                │
│      • POST /api/campaigns/:id/send                      │
│   └→ Retornar campaignId y resumen                       │
│                                                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ 2. PROCESAMIENTO DE ENVÍO                                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ CampaignMessagingService.sendCampaign(campaignId):       │
│                                                           │
│ a) Verificaciones iniciales:                             │
│   └→ Verificar que campaña existe                        │
│   └→ Verificar que no esté ya procesándose               │
│   └→ Verificar estado = 'draft' o 'scheduled'            │
│   └→ Marcar campaña en activeCampaigns Map               │
│                                                           │
│ b) Actualizar estado en BD:                              │
│   └→ UPDATE campaigns SET                                │
│      status = 'sending',                                 │
│      started_at = CURRENT_TIMESTAMP                      │
│                                                           │
│ c) Obtener destinatarios:                                │
│   └→ SELECT cc.*, c.phone, c.name                        │
│      FROM campaign_contacts cc                           │
│      JOIN contacts c ON cc.contact_id = c.id             │
│      WHERE cc.campaign_id = ?                            │
│   └→ Total de contactos cargado en memoria               │
│                                                           │
│ d) Preparar mensajes:                                    │
│   └→ Por cada contacto:                                  │
│      • Personalizar mensaje con variables                │
│      • Reemplazar {{nombre}}, {{empresa}}, etc.          │
│      • Validar formato de teléfono                       │
│      • Crear registro en campaign_messages:              │
│        INSERT (campaign_id, contact_id, phone, status)   │
│        VALUES (?, ?, ?, 'pending')                       │
│                                                           │
│ e) Procesamiento en lotes (batches):                     │
│   └→ Dividir mensajes en lotes de 10                     │
│   └→ Por cada lote:                                      │
│      ┌─────────────────────────────────────────────┐    │
│      │ processBatch(messages):                     │    │
│      │                                             │    │
│      │ Por cada mensaje en lote:                   │    │
│      │   1. Esperar delay (1 segundo)              │    │
│      │   2. Llamar a sendSingleMessage()           │    │
│      │   3. Actualizar progreso                    │    │
│      │   4. Emit evento 'progress'                 │    │
│      │                                             │    │
│      │ sendSingleMessage(message):                 │    │
│      │   └→ Unified360DialogService.sendMessage()  │    │
│      │      ├→ POST 360Dialog API                  │    │
│      │      ├→ Recibir message_id                  │    │
│      │      └→ UPDATE campaign_messages            │    │
│      │         SET status = 'sent',                │    │
│      │             message_id = ?,                 │    │
│      │             sent_at = NOW()                 │    │
│      │                                             │    │
│      │   Si error:                                 │    │
│      │   └→ handleRetry(message)                   │    │
│      │      ├→ Incrementar retry_count             │    │
│      │      ├→ Si retry_count < 3:                 │    │
│      │      │  └→ Reintentarcurl después de delay       │    │
│      │      │     (1min, 5min, 15min)              │    │
│      │      └→ Si retry_count >= 3:                │    │
│      │         └→ UPDATE status = 'failed',        │    │
│      │            error_message = ?                │    │
│      └─────────────────────────────────────────────┘    │
│                                                           │
│   └→ Delay entre lotes: 1 segundo                        │
│   └→ Control de rate limit:                              │
│      • Máximo 60 mensajes/minuto                         │
│      • Si excede, pausar y esperar                       │
│                                                           │
│ f) Actualización de métricas:                            │
│   └→ Cada 10 mensajes o 30 segundos:                     │
│      • SELECT COUNT(*) FROM campaign_messages            │
│        WHERE campaign_id = ? AND status = 'sent'         │
│      • UPDATE campaigns SET                              │
│        sent_count = ?,                                   │
│        failed_count = ?                                  │
│      • Emit 'campaign_progress' via WebSocket            │
│                                                           │
│ g) Finalización:                                         │
│   └→ Al completar todos los mensajes:                    │
│      • UPDATE campaigns SET                              │
│        status = 'sent',                                  │
│        completed_at = CURRENT_TIMESTAMP                  │
│      • Remover de activeCampaigns Map                    │
│      • Emit 'campaign_completed'                         │
│      • Incrementar metrics.campaignsProcessed            │
│                                                           │
└──────────────────────────────────────────────────────────┘


## 4. Flujo de Recepción y Actualización

### **Webhooks de 360Dialog:**

```
┌──────────────────────────────────────────────────────────┐
│ WEBHOOK: Actualización de Estado de Mensaje              │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ 360Dialog → POST /webhook/360dialog                       │
│                                                           │
│ Payload recibido:                                        │
│ {                                                         │
│   "statuses": [{                                         │
│     "id": "wamid.ABC123...",                            │
│     "status": "delivered|read|failed",                   │
│     "timestamp": "1698360000",                           │
│     "recipient_id": "573113705258",                      │
│     "errors": [...]  // si status = failed               │
│   }]                                                      │
│ }                                                         │
│                                                           │
│ UnifiedWebhookService.process():                         │
│   └→ Identificar tipo de webhook                         │
│   └→ Si es status update:                                │
│      └→ processCampaignStatus(payload)                   │
│                                                           │
│ processCampaignStatus():                                 │
│   a) Extraer message_id del payload                      │
│   b) Buscar en campaign_messages:                        │
│      SELECT * FROM campaign_messages                     │
│      WHERE message_id = ?                                │
│                                                           │
│   c) Si encontrado:                                      │
│      ┌────────────────────────────────────────────┐     │
│      │ Actualizar según estado:                   │     │
│      │                                             │     │
│      │ Si status = 'sent':                         │     │
│      │   UPDATE campaign_messages                  │     │
│      │   SET status = 'sent',                      │     │
│      │       sent_at = FROM_UNIXTIME(timestamp)    │     │
│      │                                             │     │
│      │ Si status = 'delivered':                    │     │
│      │   UPDATE campaign_messages                  │     │
│      │   SET status = 'delivered',                 │     │
│      │       delivered_at = FROM_UNIXTIME(...)     │     │
│      │   UPDATE campaigns                          │     │
│      │   SET delivered_count = delivered_count + 1 │     │
│      │   WHERE id = campaign_id                    │     │
│      │                                             │     │
│      │ Si status = 'read':                         │     │
│      │   UPDATE campaign_messages                  │     │
│      │   SET status = 'read',                      │     │
│      │       read_at = FROM_UNIXTIME(timestamp)    │     │
│      │   UPDATE campaigns                          │     │
│      │   SET read_count = read_count + 1           │     │
│      │   WHERE id = campaign_id                    │     │
│      │                                             │     │
│      │ Si status = 'failed':                       │     │
│      │   UPDATE campaign_messages                  │     │
│      │   SET status = 'failed',                    │     │
│      │       failed_at = FROM_UNIXTIME(...),       │     │
│      │       error_message = errors[0].title       │     │
│      │   UPDATE campaigns                          │     │
│      │   SET failed_count = failed_count + 1       │     │
│      │   WHERE id = campaign_id                    │     │
│      │                                             │     │
│      │   Si retries < 3:                           │     │
│      │     └→ Programar reintento en 5 minutos     │     │
│      └────────────────────────────────────────────┘     │
│                                                           │
│   d) Actualizar métricas de campaña:                    │
│      SELECT                                              │
│        COUNT(*) FILTER (WHERE status='sent') as sent,    │
│        COUNT(*) FILTER (WHERE status='delivered') as dl, │
│        COUNT(*) FILTER (WHERE status='read') as rd,      │
│        COUNT(*) FILTER (WHERE status='failed') as fail   │
│      FROM campaign_messages                              │
│      WHERE campaign_id = ?                               │
│                                                           │
│   e) Broadcast actualización via WebSocket:             │
│      io.emit('campaign_update', {                        │
│        campaignId,                                       │
│        stats: { sent, delivered, read, failed },         │
│        timestamp: Date.now()                             │
│      })                                                  │
│                                                           │
│   f) Si campaña completa y todas procesadas:            │
│      UPDATE campaigns                                    │
│      SET status = 'completed',                           │
│          completed_at = CURRENT_TIMESTAMP                │
│      WHERE id = ? AND sent_count = total_recipients      │
│                                                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ WEBHOOK: Respuesta de Usuario (Interactiva)              │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Si usuario responde a mensaje de campaña:                │
│                                                           │
│ Payload:                                                 │
│ {                                                         │
│   "messages": [{                                         │
│     "from": "573113705258",                             │
│     "id": "wamid.XYZ789...",                            │
│     "type": "interactive",                               │
│     "context": {                                         │
│       "id": "wamid.ABC123..."  // msg original           │
│     },                                                    │
│     "interactive": {                                     │
│       "type": "button_reply|list_reply|nfm_reply",      │
│       "button_reply": {                                  │
│         "id": "btn_1",                                   │
│         "title": "Sí, me interesa"                      │
│       }                                                   │
│     }                                                     │
│   }]                                                      │
│ }                                                         │
│                                                           │
│ UnifiedWebhookService.processInteractiveResponse():      │
│   a) Buscar mensaje original en campaign_messages:      │
│      SELECT cm.*, c.id as campaign_id                    │
│      FROM campaign_messages cm                           │
│      JOIN campaigns c ON cm.campaign_id = c.id           │
│      WHERE cm.message_id = context.id                    │
│                                                           │
│   b) Si es mensaje de campaña:                          │
│      └→ INSERT INTO interactive_responses:               │
│         • message_id (original)                          │
│         • contact_id                                     │
│         • campaign_id                                    │
│         • response_type (button/list/flow)               │
│         • response_data (JSON)                           │
│         • created_at                                     │
│                                                           │
│   c) Actualizar estadísticas de campaña:                │
│      └→ Incrementar contador de respuestas              │
│      └→ Calcular tasa de engagement                     │
│                                                           │
│   d) Triggers automáticos (si configurados):            │
│      └→ Si respuesta = "Sí, me interesa":               │
│         • Agregar etiqueta "Interesado"                  │
│         • Notificar al agente                            │
│         • Iniciar flujo de seguimiento                   │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### **Actualización en Frontend:**

```javascript
// WebSocket listener en campaigns.js
socket.on('campaign_update', (data) => {
    // Actualizar estadísticas en tiempo real
    updateCampaignStats(data.campaignId, data.stats);
    
    // Actualizar barra de progreso
    updateProgressBar(data.campaignId, data.progress);
    
    // Actualizar tabla si está visible
    if (isStatsModalOpen(data.campaignId)) {
        refreshStatsModal(data.campaignId);
    }
});

socket.on('campaign_completed', (data) => {
    // Mostrar notificación
    showNotification(`Campaña ${data.name} completada`, 'success');
    
    // Actualizar estado en tabla
    updateCampaignStatus(data.campaignId, 'completed');
    
    // Reproducir sonido
    playCompletionSound();
});
```

---

# ⚙️ FUNCIONALIDADES ACTUALES DETECTADAS

## Endpoints y Métodos Completos

### **1. Gestión de Campañas**

| Método | Endpoint | Descripción | Validación |
|--------|----------|-------------|------------|
| **POST** | `/api/campaigns` | Crear nueva campaña | Joi schema |
| **GET** | `/api/campaigns` | Listar campañas con filtros | Query params |
| **GET** | `/api/campaigns/:id` | Obtener detalles de campaña | ID validation |
| **PUT** | `/api/campaigns/:id` | Actualizar campaña | Joi schema |
| **DELETE** | `/api/campaigns/:id` | Eliminar campaña | ID + auth |
| **POST** | `/api/campaigns/:id/duplicate` | Duplicar campaña | ID + auth |

### **2. Envío y Ejecución**

| Método | Endpoint | Descripción | Throttling |
|--------|----------|-------------|------------|
| **POST** | `/api/campaigns/:id/send` | Iniciar envío de campaña | Sí (60/min) |
| **POST** | `/api/campaigns/:id/test` | Enviar mensaje de prueba | No |
| **POST** | `/api/campaigns/:id/pause` | Pausar campaña en progreso | No |
| **POST** | `/api/campaigns/:id/resume` | Reanudar campaña pausada | Sí (60/min) |
| **POST** | `/api/campaigns/:id/cancel` | Cancelar campaña | No |

### **3. Análisis y Estadísticas**

| Método | Endpoint | Descripción | Datos |
|--------|----------|-------------|-------|
| **GET** | `/api/campaigns/:id/stats` | Estadísticas completas | sent, delivered, read, failed |
| **GET** | `/api/campaigns/:id/messages` | Mensajes de la campaña | Paginado |
| **GET** | `/api/campaigns/:id/timeline` | Timeline de eventos | Cronológico |
| **GET** | `/api/campaigns/:id/responses` | Respuestas interactivas | Filtrable |
| **GET** | `/api/campaigns/analytics` | Analytics global | Agregado |

### **4. Destinatarios**

| Método | Endpoint | Descripción | Filtros |
|--------|----------|-------------|---------|
| **GET** | `/api/campaigns/:id/contacts` | Contactos de la campaña | Estado |
| **POST** | `/api/campaigns/:id/contacts` | Agregar contactos | Validación |
| **DELETE** | `/api/campaigns/:id/contacts/:contactId` | Remover contacto | Solo draft |
| **POST** | `/api/campaigns/:id/preview-recipients` | Vista previa de destinatarios | Filtros |

### **5. Templates**

| Método | Endpoint | Descripción | Uso |
|--------|----------|-------------|-----|
| **GET** | `/api/campaigns/templates` | Listar templates disponibles | Selector |
| **GET** | `/api/campaigns/templates/:id` | Detalles de template | Preview |
| **POST** | `/api/campaigns/templates/validate` | Validar template con variables | Pre-envío |

### **6. Exportación**

| Método | Endpoint | Descripción | Formato |
|--------|----------|-------------|---------|
| **GET** | `/api/campaigns/:id/export/csv` | Exportar a CSV | CSV |
| **GET** | `/api/campaigns/:id/export/excel` | Exportar a Excel | XLSX |
| **GET** | `/api/campaigns/:id/export/pdf` | Exportar reporte PDF | PDF |

---

## Funcionalidades por Categoría

### **A. Creación y Edición**

✅ **Implementado:**
- Formulario completo de creación
- Validación de campos requeridos
- Selección de template
- Editor de mensaje personalizado
- Variables dinámicas ({{nombre}}, {{empresa}})
- Vista previa de destinatarios
- Programación de envío
- Guardar como borrador
- Duplicar campaña existente

### **B. Segmentación de Audiencia**

✅ **Implementado:**
- Todos los contactos
- Por etiqueta (tags)
- Por campo personalizado
- Por búsqueda de texto
- Selección manual
- Exclusiones (contactos bloqueados)

⚠️ **Limitado:**
- No hay segmentos guardados reutilizables
- No hay filtros complejos (AND/OR)

### **C. Envío y Control**

✅ **Implementado:**
- Envío inmediato
- Envío programado
- Throttling (60 msg/min)
- Rate limiting adaptativo
- Procesamiento en lotes (10 msg/lote)
- Delays entre mensajes (1 seg)
- Reintentos automáticos (3 intentos)
- Backoff exponencial (1min, 5min, 15min)
- Pausar/reanudar campaña
- Cancelar campaña

### **D. Análisis y Reportes**

✅ **Implementado:**
- Contadores en tiempo real:
  - Total enviados
  - Total entregados
  - Total leídos
  - Total fallidos
  - Pendientes
- Tasas de conversión:
  - Tasa de entrega (%)
  - Tasa de lectura (%)
- Gráficas:
  - Pie chart de estados
  - Barra de progreso
- Timeline de eventos
- Exportación CSV/Excel

⚠️ **Limitado:**
- No hay comparación entre campañas
- No hay A/B testing
- No hay análisis de horarios óptimos
- No hay predicción de engagement

### **E. Integración con 360Dialog**

✅ **Implementado:**
- Envío de mensajes de texto
- Envío de multimedia (imagen, video, audio, documento)
- Envío de templates aprobados
- Recepción de webhooks de estado
- Actualización automática de estados
- Manejo de errores de API

⚠️ **Parcial:**
- Mensajes interactivos (botones, listas) - solo recepción
- Flows - solo listado
- Productos - no implementado en campañas
- Ubicación - no implementado en campañas


---

# 🚀 POSIBILIDADES DE MEJORA Y FUNCIONES AVANZADAS

## 1. Funciones Avanzadas de Envío

### **A. Mensajes Interactivos Completos**

**Estado Actual:** Solo se reciben respuestas, no se envían desde campañas

**Mejoras Propuestas:**

```javascript
// 1. Botones de Respuesta Rápida (Quick Reply)
{
  type: 'buttons',
  body: '¿Te interesa nuestra oferta?',
  buttons: [
    { id: 'yes', title: 'Sí, me interesa' },
    { id: 'no', title: 'No, gracias' },
    { id: 'info', title: 'Más información' }
  ]
}

// 2. Listas Interactivas
{
  type: 'list',
  body: 'Selecciona un producto',
  button: 'Ver opciones',
  sections: [
    {
      title: 'Electrónicos',
      rows: [
        { id: 'laptop', title: 'Laptop', description: '$1,200' },
        { id: 'phone', title: 'Teléfono', description: '$800' }
      ]
    },
    {
      title: 'Accesorios',
      rows: [
        { id: 'mouse', title: 'Mouse', description: '$50' }
      ]
    }
  ]
}

// 3. Botones con URL
{
  type: 'template',
  template: {
    name: 'url_button_template',
    language: { code: 'es' },
    components: [
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          { type: 'text', text: 'track123' }
        ]
      }
    ]
  }
}

// 4. Botones de Llamada
{
  type: 'template',
  template: {
    name: 'call_button_template',
    components: [
      {
        type: 'button',
        sub_type: 'phone_number',
        index: '0'
      }
    ]
  }
}

// 5. Productos (requiere catálogo)
{
  type: 'interactive',
  interactive_type: 'product',
  action: {
    catalog_id: 'CATALOG_ID',
    product_retailer_id: 'product_123'
  }
}

// 6. Multi-Productos
{
  type: 'interactive',
  interactive_type: 'product_list',
  header: { type: 'text', text: 'Nuestros productos' },
  body: { text: 'Selecciona lo que te interesa' },
  action: {
    catalog_id: 'CATALOG_ID',
    sections: [
      {
        title: 'En oferta',
        product_items: [
          { product_retailer_id: 'prod_1' },
          { product_retailer_id: 'prod_2' }
        ]
      }
    ]
  }
}

// 7. Solicitar Ubicación
{
  type: 'interactive',
  interactive_type: 'location_request_message',
  body: { text: 'Comparte tu ubicación para encontrar la tienda más cercana' }
}
```

**Implementación Requerida:**
- Agregar campo `interactive_type` en tabla `campaigns`
- Nuevo campo `interactive_payload` (JSON)
- Actualizar `CampaignMessagingService` para construir payloads interactivos
- UI en frontend para configurar botones/listas
- Preview de mensajes interactivos

### **B. Templates Avanzados**

**Mejoras:**

1. **Validación Automática Pre-Envío:**
   ```javascript
   // Antes de enviar campaña
   const validation = await validateTemplateWith360Dialog({
     templateName,
     variables,
     language
   });
   
   if (!validation.approved) {
     throw new Error(`Template no aprobado: ${validation.reason}`);
   }
   ```

2. **Previsualización Exacta:**
   ```javascript
   // Mostrar exactamente cómo se verá en WhatsApp
   const preview = await generateWhatsAppPreview({
     template,
     sampleVariables: { nombre: 'Juan', empresa: 'ABC Corp' }
   });
   
   // Renderizar en frontend con estilos de WhatsApp
   renderWhatsAppBubble(preview);
   ```

3. **Variables Dinámicas Avanzadas:**
   ```javascript
   // Soporte para funciones en variables
   variables: {
     nombre: '{{contact.name}}',
     fecha: '{{NOW|format:DD/MM/YYYY}}',
     descuento: '{{calculateDiscount(contact.tier)}}',
     vencimiento: '{{NOW|addDays:30|format:DD/MM/YYYY}}'
   }
   ```

4. **Multi-idioma:**
   ```javascript
   // Detectar idioma del contacto y enviar template correcto
   const template = await selectTemplateByLanguage(
     contact.language || 'es',
     templateFamily: 'welcome'
   );
   ```

### **C. Aprobación Interna**

**Flujo de Aprobación:**

```
Usuario crea campaña
    ↓
status = 'pending_approval'
    ↓
Notificar a supervisor
    ↓
Supervisor revisa:
  - Contenido del mensaje
  - Audiencia seleccionada
  - Horario de envío
  - Budget estimado
    ↓
Si aprueba:
  → status = 'approved'
  → Programar envío
Si rechaza:
  → status = 'rejected'
  → Notificar a usuario
  → Indicar motivo de rechazo
```

**Tabla Nueva:**
```sql
CREATE TABLE campaign_approvals (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER,
  requested_by INTEGER,
  reviewed_by INTEGER,
  status TEXT, -- pending, approved, rejected
  rejection_reason TEXT,
  requested_at DATETIME,
  reviewed_at DATETIME,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
```

### **D. Multi-Campañas y Prioridades**

```javascript
// Sistema de colas con prioridades
class CampaignQueue {
  queues = {
    high: [],    // Urgentes (promociones flash)
    medium: [],  // Normal
    low: []      // Informativas
  };
  
  async add(campaign, priority = 'medium') {
    this.queues[priority].push(campaign);
    this.process();
  }
  
  async process() {
    // Procesar high primero, luego medium, luego low
    // Respetar rate limits globales
  }
}
```

### **E. Limitador Inteligente según Plan**

```javascript
// Detectar plan de 360Dialog y ajustar throttling
class IntelligentThrottler {
  async detectPlanLimits() {
    // Consultar API de 360Dialog
    const planInfo = await dialog360.getPlanInfo();
    
    return {
      messagesPerDay: planInfo.daily_limit,
      messagesPerMinute: planInfo.rate_limit,
      currentUsage: planInfo.usage_today
    };
  }
  
  async adjustThrottling(campaignSize) {
    const limits = await this.detectPlanLimits();
    const remaining = limits.messagesPerDay - limits.currentUsage;
    
    if (campaignSize > remaining) {
      // Distribuir en múltiples días
      return this.scheduleSplitCampaign(campaignSize, remaining);
    }
    
    // Ajustar velocidad según límite del plan
    return {
      messagesPerMinute: Math.min(
        limits.messagesPerMinute,
        this.config.messagesPerMinute
      )
    };
  }
}
```

---

## 2. Funciones Avanzadas de Recepción

### **A. Registro de Respuestas Interactivas**

**Tabla Mejorada:**
```sql
CREATE TABLE campaign_interactive_responses (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER,
  campaign_message_id INTEGER,
  contact_id INTEGER,
  
  -- Tipo de interacción
  interaction_type TEXT, -- button_reply, list_reply, nfm_reply, location, product
  
  -- Datos de la respuesta
  button_id TEXT,
  button_title TEXT,
  list_id TEXT,
  list_title TEXT,
  list_description TEXT,
  flow_response JSON, -- Respuesta completa de flow
  location_lat REAL,
  location_lng REAL,
  location_name TEXT,
  location_address TEXT,
  product_id TEXT,
  product_name TEXT,
  
  -- Metadatos
  response_time INTEGER, -- segundos desde envío
  created_at DATETIME,
  
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (campaign_message_id) REFERENCES campaign_messages(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE INDEX idx_campaign_responses_campaign ON campaign_interactive_responses(campaign_id);
CREATE INDEX idx_campaign_responses_type ON campaign_interactive_responses(interaction_type);
```

**Procesamiento:**
```javascript
async processInteractiveResponse(webhook) {
  const response = extractResponseData(webhook);
  
  // Guardar respuesta
  await db.insert('campaign_interactive_responses', response);
  
  // Actualizar estadísticas de campaña
  await updateCampaignEngagement(response.campaign_id);
  
  // Triggers automáticos
  await executeResponseTriggers(response);
}
```

### **B. Detección de Intención**

```javascript
class IntentDetector {
  patterns = {
    interested: /sí|si|interesa|quiero|deseo|me gusta/i,
    not_interested: /no|nunca|no gracias|desuscribir/i,
    more_info: /información|info|detalles|más|cuéntame/i,
    price: /precio|costo|cuánto|valor/i,
    availability: /disponible|stock|hay|tienen/i
  };
  
  detectIntent(message) {
    for (const [intent, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(message)) {
        return intent;
      }
    }
    return 'unknown';
  }
  
  async handleIntent(contact, intent, campaign) {
    switch(intent) {
      case 'interested':
        await addTag(contact.id, 'Interesado');
        await assignToSales(contact.id);
        break;
      
      case 'not_interested':
        await addTag(contact.id, 'No Interesado');
        await unsubscribeFromCampaign(contact.id, campaign.id);
        break;
      
      case 'more_info':
        await sendInfoPackage(contact.id);
        break;
      
      case 'price':
        await sendPricing(contact.id);
        break;
    }
  }
}
```

### **C. Asignación Automática de Etiquetas**

```javascript
// Configuración en campaña
campaign.auto_tags = {
  on_send: ['Campaña 2025', 'Promo Verano'],
  on_delivery: ['Mensaje Recibido'],
  on_read: ['Mensaje Leído'],
  on_button_click: {
    'yes': ['Interesado', 'Caliente'],
    'no': ['No Interesado'],
    'info': ['Solicita Info']
  }
};

// Aplicar automáticamente
async applyAutoTags(contact_id, event, data) {
  const tags = campaign.auto_tags[event];
  if (tags) {
    await addTagsToContact(contact_id, tags);
  }
}
```

### **D. Mapa de Ubicaciones Recibidas**

```javascript
// Visualización geográfica de respuestas
class LocationMap {
  async getResponseLocations(campaignId) {
    const locations = await db.query(`
      SELECT 
        location_lat as lat,
        location_lng as lng,
        location_name as name,
        c.name as contact_name
      FROM campaign_interactive_responses cir
      JOIN contacts c ON cir.contact_id = c.id
      WHERE cir.campaign_id = ?
        AND cir.interaction_type = 'location'
        AND cir.location_lat IS NOT NULL
    `, [campaignId]);
    
    return locations;
  }
  
  renderMap(locations) {
    // Usar Leaflet o Google Maps
    const map = L.map('campaign-locations');
    
    locations.forEach(loc => {
      L.marker([loc.lat, loc.lng])
        .bindPopup(`${loc.contact_name}<br>${loc.name}`)
        .addTo(map);
    });
  }
}
```

### **E. Seguimiento Post-Campaña**

```javascript
// Sistema de conversaciones derivadas
class PostCampaignTracker {
  async trackConversation(campaignId, contactId) {
    // Marcar todas las conversaciones posteriores
    await db.update('messages', {
      derived_from_campaign: campaignId
    }, {
      where: {
        contact_id: contactId,
        created_at: { $gte: campaign.started_at }
      }
    });
  }
  
  async getConversionFunnel(campaignId) {
    return {
      sent: await countSent(campaignId),
      delivered: await countDelivered(campaignId),
      read: await countRead(campaignId),
      replied: await countReplied(campaignId),
      interested: await countTagged(campaignId, 'Interesado'),
      converted: await countConverted(campaignId)
    };
  }
}
```


---

## 3. Funciones Analíticas Avanzadas

### **A. Tasa de Conversión por Tipo**

```javascript
// Análisis detallado por tipo de mensaje/botón
async analyzeCampaignPerformance(campaignId) {
  const analysis = {
    overall: {
      sent: 500,
      delivered: 485,
      read: 420,
      replied: 150,
      conversion_rate: 30% // replied / read
    },
    
    by_message_type: {
      text: { sent: 200, conversion: 25% },
      buttons: { sent: 200, conversion: 45% }, // Mejor
      list: { sent: 100, conversion: 35% }
    },
    
    by_button: {
      'yes': { clicks: 120, conversion_to_sale: 40% },
      'no': { clicks: 50 },
      'more_info': { clicks: 80, followup_rate: 70% }
    },
    
    by_time_of_day: {
      '09:00-12:00': { sent: 150, read_rate: 90% }, // Mejor
      '12:00-15:00': { sent: 150, read_rate: 75% },
      '15:00-18:00': { sent: 100, read_rate: 80% },
      '18:00-21:00': { sent: 100, read_rate: 85% }
    },
    
    by_day_of_week: {
      monday: { read_rate: 75% },
      tuesday: { read_rate: 82% },
      wednesday: { read_rate: 88% }, // Mejor
      thursday: { read_rate: 80% },
      friday: { read_rate: 70% }
    }
  };
  
  return analysis;
}
```

### **B. Comparación entre Campañas**

```javascript
// Dashboard comparativo
class CampaignComparison {
  async compare(campaignIds) {
    return {
      metrics: ['delivery_rate', 'read_rate', 'reply_rate', 'conversion_rate'],
      campaigns: campaignIds.map(id => ({
        id,
        name: campaign.name,
        delivery_rate: calculateRate(id, 'delivered'),
        read_rate: calculateRate(id, 'read'),
        reply_rate: calculateRate(id, 'replied'),
        conversion_rate: calculateConversion(id)
      })),
      
      // Gráfica comparativa
      chart: {
        type: 'bar',
        data: comparisonData
      },
      
      // Insights automáticos
      insights: [
        'Campaña "Promo Verano" tiene 15% más engagement',
        'Mensajes con botones tienen 2x más conversión',
        'Miércoles es el mejor día para enviar (88% read rate)'
      ]
    };
  }
}
```

### **C. Predicción de Engagement**

```javascript
// ML para predecir mejor horario/audiencia
class EngagementPredictor {
  async trainModel(historicalCampaigns) {
    // Entrenar con datos históricos
    const features = campaigns.map(c => ({
      day_of_week: c.day,
      hour: c.hour,
      message_length: c.message.length,
      has_media: c.media_url ? 1 : 0,
      has_buttons: c.interactive ? 1 : 0,
      audience_size: c.total_recipients
    }));
    
    const labels = campaigns.map(c => c.read_rate);
    
    // Usar TensorFlow.js (ya incluido como opcional)
    this.model = await tf.sequential();
    // ... entrenamiento
  }
  
  async predictBestTime(campaign) {
    // Predecir mejor horario
    const predictions = [];
    for (let hour = 0; hour < 24; hour++) {
      const pred = await this.model.predict({
        ...campaign,
        hour
      });
      predictions.push({ hour, score: pred });
    }
    
    return predictions.sort((a, b) => b.score - a.score)[0];
  }
}
```

### **D. Exportación Avanzada**

```javascript
// Reportes detallados
class CampaignReporter {
  async generatePDFReport(campaignId) {
    const pdf = new PDFDocument();
    
    // Portada
    pdf.addPage()
       .fontSize(24)
       .text(`Reporte de Campaña: ${campaign.name}`);
    
    // Resumen ejecutivo
    pdf.addPage()
       .fontSize(16)
       .text('Resumen Ejecutivo')
       .fontSize(12)
       .text(`Destinatarios: ${campaign.total_recipients}`)
       .text(`Tasa de entrega: ${campaign.delivery_rate}%`)
       .text(`Tasa de lectura: ${campaign.read_rate}%`)
       .text(`ROI estimado: ${campaign.estimated_roi}`);
    
    // Gráficas
    pdf.addPage()
       .image(chartImage, { fit: [500, 300] });
    
    // Timeline detallado
    pdf.addPage()
       .fontSize(16)
       .text('Timeline de Eventos');
    // ...
    
    return pdf;
  }
  
  async exportToExcel(campaignId) {
    const workbook = new ExcelJS.Workbook();
    
    // Hoja 1: Resumen
    const summary = workbook.addWorksheet('Resumen');
    summary.addRow(['Métrica', 'Valor']);
    summary.addRow(['Total Enviados', campaign.sent_count]);
    // ...
    
    // Hoja 2: Mensajes detallados
    const messages = workbook.addWorksheet('Mensajes');
    messages.addRow(['ID', 'Contacto', 'Estado', 'Enviado', 'Leído']);
    // ...
    
    // Hoja 3: Respuestas interactivas
    const responses = workbook.addWorksheet('Respuestas');
    // ...
    
    return workbook;
  }
}
```

---

## 4. Funciones de Automatización

### **A. Reenvío Automático**

```javascript
class AutomaticReEngagement {
  async setupReengagement(campaignId, config) {
    // Configuración
    const reengagement = {
      campaign_id: campaignId,
      trigger: 'not_read_after_24h',
      action: 'send_followup',
      followup_message: config.followup_message,
      max_attempts: 2,
      delay_hours: 24
    };
    
    // Programar tarea
    cron.schedule('0 */4 * * *', async () => {
      const notRead = await getNotReadMessages(campaignId, '24h');
      
      for (const msg of notRead) {
        if (msg.reengagement_attempts < reengagement.max_attempts) {
          await sendFollowup(msg.contact_id, reengagement.followup_message);
          await incrementReengagementAttempts(msg.id);
        }
      }
    });
  }
}
```

### **B. Recordatorios Programados**

```javascript
// Sistema de recordatorios
class ReminderSystem {
  async createReminder(campaignId, config) {
    // Ejemplo: Recordar evento en 3 días
    const reminder = {
      campaign_id: campaignId,
      trigger_days_before: 3,
      message_template: 'reminder_template',
      target_contacts: 'campaign_recipients'
    };
    
    await scheduleTask({
      execute_at: event_date - 3.days,
      action: 'send_reminder',
      params: reminder
    });
  }
}
```

### **C. Flows Condicionales**

```javascript
// Sistema de decisiones automáticas
class ConditionalFlowEngine {
  flows = {
    welcome_series: [
      {
        trigger: 'campaign_sent',
        wait: '2_days',
        condition: 'not_replied',
        action: 'send_followup_1'
      },
      {
        trigger: 'followup_1_sent',
        wait: '3_days',
        condition: 'not_replied',
        action: 'send_final_offer'
      },
      {
        trigger: 'button_clicked:yes',
        action: 'send_thank_you_and_assign_to_sales'
      }
    ]
  };
  
  async executeFlow(flowName, contactId, context) {
    const flow = this.flows[flowName];
    
    for (const step of flow) {
      if (await evaluateCondition(step.condition, contactId, context)) {
        await wait(step.wait);
        await executeAction(step.action, contactId);
      }
    }
  }
}
```

### **D. IA Local para Personalización**

```javascript
// Usar TensorFlow.js para personalización
class AIPersonalization {
  async personalizeMessage(contact, baseMessage) {
    // Analizar historial del contacto
    const profile = await analyzeContactProfile(contact.id);
    
    // Generar versión personalizada
    const personalized = await this.model.generate({
      base: baseMessage,
      tone: profile.preferred_tone, // formal/casual
      language: profile.language,
      interests: profile.interests,
      purchase_history: profile.purchases
    });
    
    return personalized;
  }
  
  async selectBestTemplate(contact, templates) {
    // Predecir qué template tendrá mejor engagement
    const predictions = await Promise.all(
      templates.map(async t => ({
        template: t,
        score: await this.predictEngagement(contact, t)
      }))
    );
    
    return predictions.sort((a, b) => b.score - a.score)[0].template;
  }
}
```

---

# 🧩 INTEGRACIÓN CON 360DIALOG - DETALLE COMPLETO

## 1. Autenticación

```javascript
// Headers requeridos
const headers = {
  'D360-API-KEY': process.env.DIALOG360_API_KEY,
  'Content-Type': 'application/json'
};

// Endpoints principales
const ENDPOINTS = {
  base: 'https://waba-v2.360dialog.io',
  hub: 'https://hub.360dialog.io/api/v2',
  
  messages: '/messages',
  media: '/media',
  templates: '/v1/configs/templates',
  flows: '/api/v2/partners/srMmoqPA/waba_accounts/FFCPLwWA/flows'
};
```

## 2. Tipos de Mensajes Soportados

### **Actualmente Implementados en Campañas:**

| Tipo | Implementado | Endpoint | Uso en Campañas |
|------|--------------|----------|-----------------|
| **Texto** | ✅ | `/messages` | Sí |
| **Imagen** | ✅ | `/messages` | Sí |
| **Video** | ✅ | `/messages` | Sí |
| **Audio** | ✅ | `/messages` | Sí |
| **Documento** | ✅ | `/messages` | Sí |
| **Template** | ✅ | `/messages` | Sí |
| **Botones** | ⚠️ | `/messages` | Solo recepción |
| **Listas** | ⚠️ | `/messages` | Solo recepción |
| **Ubicación** | ❌ | `/messages` | No |
| **Contacto** | ❌ | `/messages` | No |
| **Productos** | ❌ | `/messages` | No (requiere catálogo) |

### **Tipos a Añadir:**

#### **1. Mensajes Interactivos (Botones)**
```javascript
// Implementación pendiente en campañas
async sendButtonMessage(to, message) {
  return await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message.body },
        footer: { text: message.footer },
        action: {
          buttons: message.buttons.map((btn, i) => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title }
          }))
        }
      }
    })
  });
}
```

#### **2. Listas Interactivas**
```javascript
async sendListMessage(to, message) {
  return await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: message.header },
        body: { text: message.body },
        footer: { text: message.footer },
        action: {
          button: message.button_text,
          sections: message.sections
        }
      }
    })
  });
}
```

#### **3. Productos**
```javascript
// Requiere configuración de catálogo en Meta Business Suite
async sendProductMessage(to, productId, catalogId) {
  return await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'product',
        body: { text: 'Mira este producto' },
        action: {
          catalog_id: catalogId,
          product_retailer_id: productId
        }
      }
    })
  });
}
```

#### **4. Solicitar Ubicación**
```javascript
async requestLocation(to, message) {
  return await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: message }
      }
    })
  });
}
```

## 3. Validaciones Pre-Envío

```javascript
// Validaciones necesarias
class PreSendValidation {
  async validateBeforeSend(campaign) {
    const validations = [];
    
    // 1. Validar template aprobado
    if (campaign.uses_template) {
      const template = await dialog360.getTemplate(campaign.template_id);
      if (template.status !== 'APPROVED') {
        validations.push({
          error: 'Template no aprobado',
          severity: 'critical'
        });
      }
    }
    
    // 2. Validar ventana de 24h
    for (const contact of campaign.contacts) {
      const lastMessage = await getLastMessageFrom(contact.id);
      const hoursSince = (Date.now() - lastMessage.timestamp) / 3600000;
      
      if (hoursSince > 24 && !campaign.uses_template) {
        validations.push({
          error: `Ventana de 24h expirada para ${contact.phone}`,
          severity: 'warning',
          suggestion: 'Usar template aprobado'
        });
      }
    }
    
    // 3. Validar límites del plan
    const planInfo = await dialog360.getPlanInfo();
    if (campaign.total_recipients > planInfo.remaining_messages) {
      validations.push({
        error: 'Excede límite del plan',
        severity: 'critical',
        remaining: planInfo.remaining_messages
      });
    }
    
    // 4. Validar formato de teléfonos
    const invalidPhones = campaign.contacts.filter(c => 
      !this.validatePhoneFormat(c.phone)
    );
    if (invalidPhones.length > 0) {
      validations.push({
        error: `${invalidPhones.length} teléfonos inválidos`,
        severity: 'warning',
        contacts: invalidPhones
      });
    }
    
    return validations;
  }
}
```

## 4. Manejo de Webhooks

```javascript
// Eventos cubiertos actualmente
const WEBHOOK_EVENTS = {
  // Mensajes entrantes
  'messages': {
    'text': processar,
    'image': processImage,
    'video': processVideo,
    'audio': processAudio,
    'document': processDocument,
    'location': processLocation,
    'contacts': processContact,
    'interactive': processInteractive
  },
  
  // Estados de mensajes salientes
  'statuses': {
    'sent': updateStatus,
    'delivered': updateStatus,
    'read': updateStatus,
    'failed': updateStatus
  },
  
  // Eventos del sistema
  'errors': handleError
};

// Procesamiento de webhook de campaña
async function processWebhook(payload) {
  if (payload.statuses) {
    // Actualización de estado
    for (const status of payload.statuses) {
      await updateCampaignMessageStatus(status);
    }
  }
  
  if (payload.messages) {
    // Respuesta del usuario
    for (const message of payload.messages) {
      await processCampaignResponse(message);
    }
  }
}
```


---

# 🗄️ BASE DE DATOS (SQLite)

## Tablas Relacionadas con Campañas

### **1. `campaigns` - Tabla Principal**

```sql
CREATE TABLE campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    message TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT,
    
    -- Filtros de destinatarios (JSON)
    filters TEXT, -- {search: '', status: '', tag: '', custom_field: ''}
    
    -- Estadísticas
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Estado y programación
    status TEXT DEFAULT 'draft', -- draft, scheduled, sending, sent, failed
    scheduled_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    
    -- Metadatos
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices existentes
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON campaigns(scheduled_at);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at);

-- Trigger de actualización
CREATE TRIGGER update_campaigns_timestamp 
AFTER UPDATE ON campaigns 
BEGIN 
    UPDATE campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

**Campos a Agregar:**
```sql
ALTER TABLE campaigns ADD COLUMN template_id INTEGER;
ALTER TABLE campaigns ADD COLUMN interactive_type TEXT; -- button, list, product
ALTER TABLE campaigns ADD COLUMN interactive_payload TEXT; -- JSON
ALTER TABLE campaigns ADD COLUMN priority TEXT DEFAULT 'medium'; -- high, medium, low
ALTER TABLE campaigns ADD COLUMN approval_status TEXT; -- pending, approved, rejected
ALTER TABLE campaigns ADD COLUMN approved_by INTEGER;
ALTER TABLE campaigns ADD COLUMN approved_at DATETIME;
```

### **2. `campaign_messages` - Mensajes Individuales**

```sql
CREATE TABLE campaign_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    
    -- Estado del mensaje
    status TEXT DEFAULT 'pending', -- pending, sent, delivered, read, failed
    error_message TEXT,
    
    -- ID del mensaje de WhatsApp
    message_id TEXT,
    
    -- Reintentos
    retry_count INTEGER DEFAULT 0,
    next_retry_at DATETIME,
    
    -- Timestamps
    sent_at DATETIME,
    delivered_at DATETIME,
    read_at DATETIME,
    failed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- Índices existentes
CREATE INDEX idx_campaign_messages_campaign ON campaign_messages(campaign_id);
CREATE INDEX idx_campaign_messages_status ON campaign_messages(status);
CREATE INDEX idx_campaign_messages_contact ON campaign_messages(contact_id);

-- Índices sugeridos
CREATE INDEX idx_campaign_messages_retry ON campaign_messages(next_retry_at) 
    WHERE status = 'failed' AND retry_count < 3;
CREATE INDEX idx_campaign_messages_message_id ON campaign_messages(message_id);
```

### **3. `campaign_contacts` - Relación Many-to-Many**

```sql
CREATE TABLE campaign_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    
    -- Variables personalizadas para este contacto
    variables TEXT, -- JSON: {nombre: 'Juan', empresa: 'ABC'}
    
    -- Estado de envío
    status TEXT DEFAULT 'pending',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    
    UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_contact ON campaign_contacts(contact_id);
```

### **4. `campaign_interactive_responses` - Nueva Tabla Sugerida**

```sql
CREATE TABLE campaign_interactive_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    campaign_message_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    
    -- Tipo de interacción
    interaction_type TEXT NOT NULL, -- button_reply, list_reply, nfm_reply, location, product
    
    -- Datos de respuesta de botón
    button_id TEXT,
    button_title TEXT,
    
    -- Datos de respuesta de lista
    list_id TEXT,
    list_title TEXT,
    list_description TEXT,
    
    -- Respuesta de flow (JSON completo)
    flow_response TEXT,
    
    -- Ubicación
    location_lat REAL,
    location_lng REAL,
    location_name TEXT,
    location_address TEXT,
    
    -- Producto
    product_id TEXT,
    product_name TEXT,
    
    -- Metadatos
    response_time_seconds INTEGER, -- Tiempo desde envío hasta respuesta
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_message_id) REFERENCES campaign_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX idx_camp_responses_campaign ON campaign_interactive_responses(campaign_id);
CREATE INDEX idx_camp_responses_type ON campaign_interactive_responses(interaction_type);
CREATE INDEX idx_camp_responses_contact ON campaign_interactive_responses(contact_id);
```

### **5. `campaign_segments` - Nueva Tabla Sugerida**

```sql
-- Segmentos reutilizables de audiencia
CREATE TABLE campaign_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Criterios de filtrado (JSON)
    filter_criteria TEXT NOT NULL,
    -- Ejemplo: {tags: ['VIP'], custom_fields: {ciudad: 'Medellín'}, status: 'active'}
    
    -- Caché del conteo
    contact_count INTEGER DEFAULT 0,
    last_calculated_at DATETIME,
    
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_segments_created_by ON campaign_segments(created_by);
```

### **6. `campaign_approvals` - Nueva Tabla Sugerida**

```sql
-- Sistema de aprobación de campañas
CREATE TABLE campaign_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    
    requested_by INTEGER NOT NULL,
    reviewed_by INTEGER,
    
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    rejection_reason TEXT,
    reviewer_notes TEXT,
    
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX idx_approvals_campaign ON campaign_approvals(campaign_id);
CREATE INDEX idx_approvals_status ON campaign_approvals(status);
```

## Relaciones Completas

```
users (1) ─────────── (N) campaigns
                           │
                           ├──── (N) campaign_messages
                           │           │
                           │           └──── (N) campaign_interactive_responses
                           │
                           ├──── (N) campaign_contacts (N) ────── contacts
                           │
                           └──── (1) campaign_approvals
                           
templates (1) ─────── (N) campaigns

campaign_segments (1) ─ (N) campaigns (via filter reference)
```

---

# 🎨 FRONTEND DE CAMPAÑAS

## 1. Componentes Visuales Existentes

### **CampaignsManager Class (`campaigns.js`)**

```javascript
class CampaignsManager {
  // Propiedades principales
  campaigns = [];
  currentPage = 1;
  statusFilter = '';
  cachedTemplates = null;
  cachedFlows = null;
  
  // Métodos implementados
  async loadCampaigns() { ... }
  async createCampaign(data) { ... }
  async updateCampaign(id, data) { ... }
  async deleteCampaign(id) { ... }
  async sendCampaign(id) { ... }
  async loadStats(id) { ... }
  
  // Rendering
  renderCampaignsTable() { ... }
  renderStatsModal(stats) { ... }
  renderCampaignForm() { ... }
}
```

### **Componentes UI Actuales:**

- ✅ Tabla de campañas con paginación
- ✅ Modal de creación/edición
- ✅ Modal de estadísticas
- ✅ Filtros por estado y fecha
- ✅ Búsqueda por nombre
- ✅ Acciones por fila (editar, eliminar, stats, enviar)
- ✅ Preview de destinatarios
- ✅ Selector de templates

## 2. Eventos de Backend

```javascript
// Eventos fetch principales
const apiCalls = {
  // Listar
  GET: '/api/campaigns?page=1&status=all',
  
  // Crear
  POST: '/api/campaigns',
  body: {
    name, description, message,
    template_id, contact_ids,
    scheduled_at, variables
  },
  
  // Actualizar
  PUT: '/api/campaigns/:id',
  body: { ... },
  
  // Eliminar
  DELETE: '/api/campaigns/:id',
  
  // Enviar
  POST: '/api/campaigns/:id/send',
  
  // Estadísticas
  GET: '/api/campaigns/:id/stats'
};
```

## 3. Visualización de Estados

```javascript
// Badges de estado
const statusBadges = {
  draft: '<span class="badge bg-secondary">Borrador</span>',
  scheduled: '<span class="badge bg-primary">Programada</span>',
  sending: '<span class="badge bg-warning">Enviando...</span>',
  sent: '<span class="badge bg-success">Enviada</span>',
  failed: '<span class="badge bg-danger">Fallida</span>',
  paused: '<span class="badge bg-info">Pausada</span>'
};

// Progreso visual
function renderProgress(sent, total) {
  const percent = (sent / total) * 100;
  return `
    <div class="progress">
      <div class="progress-bar" 
           role="progressbar" 
           style="width: ${percent}%"
           aria-valuenow="${sent}" 
           aria-valuemin="0" 
           aria-valuemax="${total}">
        ${sent}/${total}
      </div>
    </div>
  `;
}
```

## 4. Mejoras Sugeridas para Frontend

### **A. Previsualizador de Mensaje Completo**

```html
<div class="message-preview-panel">
  <div class="phone-mockup">
    <div class="whatsapp-chat">
      <!-- Renderizado exacto de WhatsApp -->
      <div class="message-bubble sent">
        <div class="message-header" v-if="hasHeader">
          <img :src="headerImage" />
        </div>
        <div class="message-body">
          {{ processedMessage }}
        </div>
        <div class="message-footer" v-if="hasFooter">
          {{ footer }}
        </div>
        <div class="message-buttons" v-if="hasButtons">
          <button v-for="btn in buttons" class="whatsapp-button">
            🔘 {{ btn.title }}
          </button>
        </div>
        <span class="message-time">{{ time }} ✓✓</span>
      </div>
    </div>
  </div>
  
  <div class="preview-controls">
    <select v-model="sampleContact">
      <option>Ver como: Juan Pérez</option>
      <option>Ver como: María García</option>
    </select>
    <button @click="refreshPreview">🔄 Actualizar</button>
  </div>
</div>
```

### **B. Editor de Variables Dinámicas**

```html
<div class="variable-editor">
  <h4>Variables Disponibles</h4>
  
  <div class="variable-list">
    <div class="variable-item" v-for="var in availableVariables">
      <span class="variable-tag" @click="insertVariable(var)">
        {{ var.tag }}
      </span>
      <span class="variable-description">
        {{ var.description }}
      </span>
      <span class="variable-example">
        Ej: {{ var.example }}
      </span>
    </div>
  </div>
  
  <div class="custom-variables">
    <h5>Agregar Variable Personalizada</h5>
    <input v-model="newVar.name" placeholder="nombre_variable" />
    <input v-model="newVar.value" placeholder="Valor por defecto" />
    <button @click="addCustomVariable">+ Agregar</button>
  </div>
</div>
```

### **C. Panel de Respuestas Interactivas**

```html
<div class="interactive-responses-panel">
  <h4>Respuestas de la Campaña</h4>
  
  <div class="response-filters">
    <select v-model="responseFilter">
      <option value="all">Todas</option>
      <option value="buttons">Botones</option>
      <option value="lists">Listas</option>
      <option value="locations">Ubicaciones</option>
    </select>
  </div>
  
  <div class="response-list">
    <div class="response-item" v-for="response in filteredResponses">
      <div class="response-contact">
        {{ response.contact_name }}
      </div>
      <div class="response-content">
        <span class="response-type-badge">{{ response.type }}</span>
        <span class="response-value">{{ response.value }}</span>
      </div>
      <div class="response-time">
        {{ formatTime(response.created_at) }}
        <span class="response-time-diff">
          ({{ response.time_diff }} después del envío)
        </span>
      </div>
      <div class="response-actions">
        <button @click="viewConversation(response.contact_id)">
          💬 Ver chat
        </button>
        <button @click="addTag(response.contact_id, response.value)">
          🏷️ Etiquetar
        </button>
      </div>
    </div>
  </div>
</div>
```

### **D. Mapa de Ubicaciones**

```html
<div class="locations-map-panel">
  <div id="campaign-map" style="height: 400px;"></div>
  
  <div class="map-legend">
    <div class="legend-item">
      <span class="marker marker-blue"></span>
      Contactos activos
    </div>
    <div class="legend-item">
      <span class="marker marker-green"></span>
      Respondieron con ubicación
    </div>
  </div>
  
  <div class="location-list">
    <h5>Ubicaciones Recibidas ({{ locations.length }})</h5>
    <div v-for="loc in locations" class="location-item">
      <div class="location-contact">{{ loc.contact }}</div>
      <div class="location-name">📍 {{ loc.name }}</div>
      <div class="location-address">{{ loc.address }}</div>
      <div class="location-coords">
        <small>{{ loc.lat }}, {{ loc.lng }}</small>
      </div>
    </div>
  </div>
</div>
```

### **E. Indicador de Progreso en Tiempo Real**

```html
<div class="real-time-progress" v-if="campaign.status === 'sending'">
  <div class="progress-header">
    <h4>Enviando campaña...</h4>
    <span class="progress-percent">{{ progressPercent }}%</span>
  </div>
  
  <div class="progress-bar-container">
    <div class="progress-bar" :style="`width: ${progressPercent}%`">
      <span class="progress-text">
        {{ campaign.sent_count }} / {{ campaign.total_recipients }}
      </span>
    </div>
  </div>
  
  <div class="progress-stats">
    <div class="stat">
      <span class="stat-label">Enviados/min:</span>
      <span class="stat-value">{{ messagesPerMinute }}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Tiempo estimado:</span>
      <span class="stat-value">{{ estimatedTimeRemaining }}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Entregados:</span>
      <span class="stat-value">{{ campaign.delivered_count }}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Fallidos:</span>
      <span class="stat-value text-danger">{{ campaign.failed_count }}</span>
    </div>
  </div>
  
  <div class="progress-actions">
    <button @click="pauseCampaign" class="btn btn-warning">
      ⏸️ Pausar
    </button>
    <button @click="cancelCampaign" class="btn btn-danger">
      ❌ Cancelar
    </button>
  </div>
</div>

<script>
// WebSocket para actualización en tiempo real
socket.on('campaign_progress', (data) => {
  if (data.campaignId === this.campaign.id) {
    this.campaign.sent_count = data.stats.sent;
    this.campaign.delivered_count = data.stats.delivered;
    this.campaign.failed_count = data.stats.failed;
    this.updateProgressMetrics();
  }
});
</script>
```

---

# 💡 CONCLUSIÓN

## 1. Resumen del Estado Actual

### **Nivel de Madurez: 85% de funcionalidades base completas**

**Fortalezas:**
- ✅ Sistema de envío robusto con throttling
- ✅ Reintentos automáticos
- ✅ Integración completa con 360Dialog para mensajes básicos
- ✅ Webhooks de estado funcionando
- ✅ Estadísticas en tiempo real
- ✅ Frontend funcional y usable
- ✅ Segmentación de audiencia flexible
- ✅ Programación de envíos
- ✅ Base de datos bien estructurada

**Áreas de Oportunidad:**
- ⚠️ Mensajes interactivos (botones/listas) solo en recepción
- ⚠️ No hay sistema de aprobación interna
- ⚠️ Análisis limitado (no hay comparación ni predicción)
- ⚠️ Preview básico (no simula WhatsApp exactamente)
- ⚠️ No hay A/B testing
- ⚠️ No hay automatización post-campaña

## 2. Potencial de Expansión

### **A. Sistema Omnicanal**

El módulo actual podría expandirse para soportar:

```
WhatsApp (Actual) → SMS → Email → Push Notifications → Telegram
```

**Arquitectura:**
```javascript
class UnifiedCampaignService {
  channels = {
    whatsapp: WhatsAppChannel,
    sms: SMSChannel,
    email: EmailChannel,
    push: PushChannel
  };
  
  async sendMultiChannel(campaign, channels) {
    await Promise.all(
      channels.map(ch => this.channels[ch].send(campaign))
    );
  }
}
```

### **B. Integración con CRM/ERP**

- Sincronización bidireccional con Salesforce, HubSpot, etc.
- Importación automática de contactos
- Actualización de estados de leads
- Tracking de conversiones

### **C. Sistema de ManyChat Mejorado**

```
Características a implementar:
- ✅ Flujos visuales drag & drop
- ✅ Condiciones y ramificaciones
- ✅ Automatizaciones basadas en tiempo
- ✅ Segmentación dinámica
- ✅ A/B testing de mensajes
- ✅ IA para personalización
- ✅ Dashboard avanzado de analytics
```

## 3. Recomendaciones Técnicas para Escalar

### **Prioridad Alta (0-3 meses):**

1. **Implementar mensajes interactivos completos**
   - Botones, listas, productos
   - Frontend para configurarlos
   - Preview exacto de WhatsApp

2. **Sistema de aprobación de campañas**
   - Tabla `campaign_approvals`
   - Flujo de revisión
   - Notificaciones

3. **Mejorar analytics**
   - Comparación entre campañas
   - Análisis de horarios óptimos
   - Dashboard de métricas

4. **Preview mejorado**
   - Simulación exacta de WhatsApp
   - Vista previa de interactivos
   - Personalización con datos reales

### **Prioridad Media (3-6 meses):**

1. **A/B Testing**
   - Dividir audiencia automáticamente
   - Comparar resultados
   - Seleccionar ganador

2. **Automatización post-campaña**
   - Reenvíos automáticos
   - Flujos condicionales
   - Triggers basados en respuestas

3. **Segmentos reutilizables**
   - Guardar filtros complejos
   - Actualización automática de conteos
   - Compartir entre usuarios

4. **Exportación avanzada**
   - Reportes PDF con gráficas
   - Dashboards personalizables
   - Integración con BI tools

### **Prioridad Baja (6+ meses):**

1. **Sistema omnicanal**
   - SMS, Email, Push
   - Orquestación multi-canal
   - Analytics unificado

2. **IA y ML**
   - Predicción de engagement
   - Personalización automática
   - Optimización de horarios

3. **Escalabilidad**
   - Migrar a PostgreSQL
   - Queue system (Bull/BullMQ)
   - Microservicios

---

## 📊 RESUMEN FINAL

```
┌───────────────────────────────────────────────────────┐
│ MÓDULO DE CAMPAÑAS - ESTADO ACTUAL                    │
├───────────────────────────────────────────────────────┤
│                                                        │
│ Funcionalidades Implementadas: 25+                    │
│ Endpoints API: 16                                     │
│ Tablas BD: 4 principales (2 sugeridas nuevas)        │
│ Tipos de mensajes soportados: 11                     │
│ Tipos de mensajes a añadir: 8+                       │
│                                                        │
│ Integración 360Dialog: ⭐⭐⭐⭐☆ (80%)                │
│ Madurez del módulo: 85%                               │
│                                                        │
│ POTENCIAL:                                            │
│ - Sistema avanzado de campañas similar a ManyChat    │
│ - Automatización completa                            │
│ - Analytics predictivo                               │
│ - Multi-canal (WhatsApp + SMS + Email)              │
│ - Integración CRM                                    │
│                                                        │
│ PRÓXIMOS PASOS RECOMENDADOS:                         │
│ 1. Mensajes interactivos completos                   │
│ 2. Sistema de aprobación                             │
│ 3. Preview mejorado                                  │
│ 4. Analytics avanzado                                │
│ 5. Automatización post-campaña                       │
│                                                        │
└───────────────────────────────────────────────────────┘
```

---

**Documento generado:** 27 de Octubre, 2025  
**Analista:** Sistema Automático de Documentación  
**Módulo:** Campañas  
**Estado:** ✅ Análisis completo y detallado  

**El módulo de campañas está sólido y listo para evolucionar hacia un sistema avanzado de marketing conversacional con 360Dialog.**


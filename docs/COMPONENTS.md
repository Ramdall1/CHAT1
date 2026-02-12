# Documentación de Componentes

## Índice
1. [BaseComponent](#basecomponent)
2. [ChatInterface](#chatinterface)
3. [NavigationManager](#navigationmanager)
4. [TemplateManager](#templatemanager)
5. [DashboardManager](#dashboardmanager)
6. [ContactManager](#contactmanager)
7. [AnalyticsManager](#analyticsmanager)
8. [SettingsManager](#settingsmanager)
9. [ReportsManager](#reportsmanager)
10. [ComponentLoader](#componentloader)

---

## BaseComponent

### Descripción
Clase base que proporciona funcionalidades comunes a todos los componentes del sistema. Actúa como la fundación sobre la cual se construyen todos los demás componentes.

### Ubicación
`client/components/core/BaseComponent.js`

### Características Principales
- Gestión de estado centralizada
- Sistema de eventos unificado
- Validación de datos
- Comunicación HTTP
- Notificaciones toast
- Manejo de errores

### Constructor
```javascript
constructor(container, options = {})
```

**Parámetros:**
- `container` (HTMLElement): Elemento DOM donde se renderizará el componente
- `options` (Object): Configuraciones opcionales del componente

### Propiedades Principales

#### Estado
```javascript
this.state = {
    initialized: false,
    loading: false,
    error: null,
    data: {}
}
```

#### Configuración
```javascript
this.config = {
    autoSave: true,
    validateOnChange: true,
    showNotifications: true,
    apiTimeout: 30000
}
```

### Métodos Principales

#### `async initialize()`
Inicializa el componente y sus dependencias.
```javascript
await component.initialize();
```

#### `render()`
Renderiza el componente en el DOM.
```javascript
component.render();
```

#### `setState(newState)`
Actualiza el estado del componente.
```javascript
component.setState({ loading: true });
```

#### `bindEvents()`
Vincula eventos del DOM al componente.
```javascript
component.bindEvents();
```

#### `validateData(data, rules)`
Valida datos según reglas especificadas.
```javascript
const isValid = component.validateData(userData, {
    email: 'required|email',
    name: 'required|min:2'
});
```

#### `showToast(message, type, duration)`
Muestra notificación toast.
```javascript
component.showToast('Operación exitosa', 'success', 3000);
```

#### `makeRequest(url, options)`
Realiza peticiones HTTP.
```javascript
const response = await component.makeRequest('/api/data', {
    method: 'POST',
    body: JSON.stringify(data)
});
```

#### `destroy()`
Limpia el componente y libera recursos.
```javascript
component.destroy();
```

### Eventos

#### `component:initialized`
Se dispara cuando el componente se inicializa.
```javascript
component.on('component:initialized', () => {
    console.log('Componente inicializado');
});
```

#### `component:state-changed`
Se dispara cuando cambia el estado.
```javascript
component.on('component:state-changed', (newState) => {
    console.log('Estado actualizado:', newState);
});
```

#### `component:error`
Se dispara cuando ocurre un error.
```javascript
component.on('component:error', (error) => {
    console.error('Error en componente:', error);
});
```

### Ejemplo de Uso
```javascript
class MiComponente extends BaseComponent {
    constructor(container, options = {}) {
        super(container, options);
        this.name = 'MiComponente';
    }

    async initialize() {
        await super.initialize();
        this.loadData();
    }

    async loadData() {
        this.setState({ loading: true });
        try {
            const data = await this.makeRequest('/api/mi-data');
            this.setState({ data, loading: false });
        } catch (error) {
            this.setState({ error, loading: false });
        }
    }

    render() {
        const { loading, data, error } = this.state;
        
        if (loading) return this.renderLoading();
        if (error) return this.renderError(error);
        
        this.container.innerHTML = `
            <div class="mi-componente">
                <h2>Mi Componente</h2>
                <div class="data">${JSON.stringify(data)}</div>
            </div>
        `;
    }
}
```

---

## ChatInterface

### Descripción
Componente para la interfaz de chat en tiempo real que permite la comunicación bidireccional con contactos de WhatsApp.

### Ubicación
`client/components/chat/ChatInterface.js`

### Características Principales
- Comunicación WebSocket en tiempo real
- Gestión de conversaciones múltiples
- Envío y recepción de mensajes
- Historial de chat paginado
- Estados de mensaje (enviado, entregado, leído)
- Soporte para diferentes tipos de mensaje

### Dependencias
- BaseComponent
- Socket.io client

### Constructor
```javascript
constructor(container, options = {})
```

**Opciones específicas:**
```javascript
{
    socketUrl: 'http://localhost:3000',
    autoConnect: true,
    messagePageSize: 50,
    enableTypingIndicator: true,
    enableReadReceipts: true
}
```

### Propiedades Específicas

#### Estado del Chat
```javascript
this.chatState = {
    currentConversation: null,
    conversations: [],
    messages: [],
    typing: false,
    connected: false
}
```

#### Socket
```javascript
this.socket = null; // Instancia de Socket.io
```

### Métodos Principales

#### `async connectSocket()`
Establece conexión WebSocket.
```javascript
await chatInterface.connectSocket();
```

#### `async loadConversations()`
Carga lista de conversaciones.
```javascript
await chatInterface.loadConversations();
```

#### `async selectConversation(conversationId)`
Selecciona una conversación específica.
```javascript
await chatInterface.selectConversation('conv_123');
```

#### `async sendMessage(message, type = 'text')`
Envía un mensaje.
```javascript
await chatInterface.sendMessage('Hola mundo', 'text');
```

#### `async loadMessageHistory(conversationId, page = 1)`
Carga historial de mensajes.
```javascript
const messages = await chatInterface.loadMessageHistory('conv_123', 1);
```

#### `handleIncomingMessage(message)`
Maneja mensajes entrantes.
```javascript
chatInterface.handleIncomingMessage({
    id: 'msg_123',
    from: '+1234567890',
    content: 'Hola',
    timestamp: new Date(),
    type: 'text'
});
```

#### `updateMessageStatus(messageId, status)`
Actualiza estado de mensaje.
```javascript
chatInterface.updateMessageStatus('msg_123', 'delivered');
```

### Eventos WebSocket

#### Eventos Enviados
```javascript
// Unirse a conversación
socket.emit('join-conversation', { conversationId });

// Enviar mensaje
socket.emit('send-message', { to, message, type });

// Indicador de escritura
socket.emit('typing', { conversationId, typing: true });
```

#### Eventos Recibidos
```javascript
// Nuevo mensaje
socket.on('new-message', (message) => {
    chatInterface.handleIncomingMessage(message);
});

// Estado de mensaje
socket.on('message-status', ({ messageId, status }) => {
    chatInterface.updateMessageStatus(messageId, status);
});

// Indicador de escritura
socket.on('user-typing', ({ userId, typing }) => {
    chatInterface.showTypingIndicator(userId, typing);
});
```

### Estructura HTML
```html
<div class="chat-interface">
    <div class="chat-header">
        <div class="chat-contact-info">
            <div class="chat-avatar">👤</div>
            <div class="chat-contact-details">
                <h4>Nombre del Contacto</h4>
                <span class="chat-contact-status">En línea</span>
            </div>
        </div>
        <div class="chat-actions">
            <button class="btn btn-sm">📞</button>
            <button class="btn btn-sm">📹</button>
        </div>
    </div>
    
    <div class="chat-messages" id="chatMessages">
        <!-- Mensajes se cargan dinámicamente -->
    </div>
    
    <div class="chat-input-area">
        <textarea class="chat-input" placeholder="Escribe un mensaje..."></textarea>
        <button class="chat-send-btn">📤</button>
    </div>
</div>
```

### Ejemplo de Uso
```javascript
const chatContainer = document.getElementById('chat-container');
const chatInterface = new ChatInterface(chatContainer, {
    socketUrl: 'ws://localhost:3000',
    enableTypingIndicator: true
});

await chatInterface.initialize();

// Seleccionar conversación
await chatInterface.selectConversation('conv_123');

// Enviar mensaje
await chatInterface.sendMessage('Hola, ¿cómo estás?');
```

---

## NavigationManager

### Descripción
Componente responsable de la gestión de navegación de la aplicación, incluyendo menú lateral, breadcrumbs y acciones rápidas.

### Ubicación
`client/components/navigation/NavigationManager.js`

### Características Principales
- Menú lateral dinámico y configurable
- Sistema de breadcrumbs automático
- Búsqueda en navegación
- Acciones rápidas contextuales
- Soporte para navegación anidada
- Indicadores de estado y badges

### Dependencias
- BaseComponent

### Constructor
```javascript
constructor(container, options = {})
```

**Opciones específicas:**
```javascript
{
    collapsible: true,
    searchEnabled: true,
    showBadges: true,
    autoHighlight: true,
    persistState: true
}
```

### Configuración de Navegación

#### Estructura de Secciones
```javascript
this.navigationConfig = {
    sections: [
        {
            title: 'Principal',
            items: [
                {
                    id: 'dashboard',
                    title: 'Dashboard',
                    icon: 'fas fa-tachometer-alt',
                    url: '/',
                    badge: null
                },
                {
                    id: 'chat',
                    title: 'Chat',
                    icon: 'fas fa-comments',
                    url: '/chat',
                    badge: { count: 5, type: 'primary' }
                }
            ]
        },
        {
            title: 'Gestión',
            items: [
                {
                    id: 'contacts',
                    title: 'Contactos',
                    icon: 'fas fa-address-book',
                    url: '/contacts',
                    children: [
                        {
                            id: 'contacts-list',
                            title: 'Lista de Contactos',
                            url: '/contacts/list'
                        },
                        {
                            id: 'contacts-groups',
                            title: 'Grupos',
                            url: '/contacts/groups'
                        }
                    ]
                }
            ]
        }
    ],
    quickActions: [
        {
            id: 'new-message',
            title: 'Nuevo Mensaje',
            icon: 'fas fa-plus',
            action: 'openNewMessage'
        }
    ]
};
```

### Métodos Principales

#### `renderNavigation()`
Renderiza la estructura de navegación completa.
```javascript
navigationManager.renderNavigation();
```

#### `setActiveItem(itemId)`
Establece el elemento activo en la navegación.
```javascript
navigationManager.setActiveItem('dashboard');
```

#### `updateBadge(itemId, badge)`
Actualiza el badge de un elemento.
```javascript
navigationManager.updateBadge('chat', { count: 10, type: 'danger' });
```

#### `addBreadcrumb(item)`
Añade elemento al breadcrumb.
```javascript
navigationManager.addBreadcrumb({
    title: 'Configuración',
    url: '/settings'
});
```

#### `clearBreadcrumbs()`
Limpia todos los breadcrumbs.
```javascript
navigationManager.clearBreadcrumbs();
```

#### `toggleCollapse()`
Alterna el estado colapsado del menú.
```javascript
navigationManager.toggleCollapse();
```

#### `search(query)`
Busca elementos en la navegación.
```javascript
const results = navigationManager.search('chat');
```

#### `addQuickAction(action)`
Añade una acción rápida.
```javascript
navigationManager.addQuickAction({
    id: 'export-data',
    title: 'Exportar Datos',
    icon: 'fas fa-download',
    action: 'exportData'
});
```

### Eventos

#### `navigation:item-clicked`
Se dispara cuando se hace clic en un elemento.
```javascript
navigationManager.on('navigation:item-clicked', (item) => {
    console.log('Navegando a:', item.url);
});
```

#### `navigation:search`
Se dispara cuando se realiza una búsqueda.
```javascript
navigationManager.on('navigation:search', (query, results) => {
    console.log('Búsqueda:', query, 'Resultados:', results);
});
```

#### `navigation:quick-action`
Se dispara cuando se ejecuta una acción rápida.
```javascript
navigationManager.on('navigation:quick-action', (action) => {
    console.log('Acción ejecutada:', action.id);
});
```

### Estructura HTML
```html
<div class="navigation-sidebar">
    <div class="nav-brand">
        <div class="nav-brand-logo">🤖</div>
        <h3 class="nav-brand-text">WhatsApp Bot</h3>
    </div>
    
    <div class="nav-search">
        <input type="text" class="nav-search-input" placeholder="Buscar...">
    </div>
    
    <div class="nav-menu">
        <!-- Secciones de navegación -->
    </div>
    
    <div class="nav-quick-actions">
        <!-- Acciones rápidas -->
    </div>
</div>
```

### Ejemplo de Uso
```javascript
const navContainer = document.getElementById('sidebar');
const navigationManager = new NavigationManager(navContainer, {
    collapsible: true,
    searchEnabled: true
});

await navigationManager.initialize();

// Actualizar badge
navigationManager.updateBadge('chat', { count: 3, type: 'primary' });

// Establecer elemento activo
navigationManager.setActiveItem('dashboard');

// Escuchar navegación
navigationManager.on('navigation:item-clicked', (item) => {
    // Cargar componente correspondiente
    loadComponent(item.component);
});
```

---

## TemplateManager

### Descripción
Componente para la gestión completa de plantillas de WhatsApp, incluyendo creación, edición, validación y gestión del estado de aprobación.

### Ubicación
`client/components/templates/TemplateManager.js`

### Características Principales
- Creación y edición de plantillas
- Validación en tiempo real
- Vista previa de plantillas
- Gestión de estado de aprobación
- Auto-guardado
- Filtrado y búsqueda
- Soporte para variables dinámicas

### Dependencias
- BaseComponent

### Constructor
```javascript
constructor(container, options = {})
```

**Opciones específicas:**
```javascript
{
    autoSave: true,
    autoSaveInterval: 5000,
    enablePreview: true,
    validateOnType: true,
    maxTemplateLength: 1024
}
```

### Propiedades Específicas

#### Estado de Plantillas
```javascript
this.templateState = {
    templates: [],
    currentTemplate: null,
    filters: {
        status: 'all',
        category: 'all',
        search: ''
    },
    editing: false,
    autoSaveTimer: null
}
```

#### Reglas de Validación
```javascript
this.validationRules = {
    name: 'required|min:3|max:50',
    content: 'required|min:10|max:1024',
    category: 'required',
    language: 'required'
}
```

### Métodos Principales

#### `async loadTemplates(filters = {})`
Carga plantillas con filtros opcionales.
```javascript
await templateManager.loadTemplates({
    status: 'approved',
    category: 'marketing'
});
```

#### `async createTemplate(templateData)`
Crea una nueva plantilla.
```javascript
const template = await templateManager.createTemplate({
    name: 'Bienvenida',
    content: 'Hola {{name}}, bienvenido a nuestro servicio',
    category: 'greeting',
    language: 'es'
});
```

#### `async updateTemplate(templateId, data)`
Actualiza una plantilla existente.
```javascript
await templateManager.updateTemplate('tpl_123', {
    content: 'Contenido actualizado'
});
```

#### `async deleteTemplate(templateId)`
Elimina una plantilla.
```javascript
await templateManager.deleteTemplate('tpl_123');
```

#### `validateTemplate(templateData)`
Valida datos de plantilla.
```javascript
const validation = templateManager.validateTemplate({
    name: 'Mi Plantilla',
    content: 'Contenido de la plantilla'
});

if (!validation.isValid) {
    console.log('Errores:', validation.errors);
}
```

#### `previewTemplate(template, variables = {})`
Genera vista previa de plantilla con variables.
```javascript
const preview = templateManager.previewTemplate(
    { content: 'Hola {{name}}, tu pedido {{order}} está listo' },
    { name: 'Juan', order: '#12345' }
);
```

#### `startAutoSave()`
Inicia auto-guardado automático.
```javascript
templateManager.startAutoSave();
```

#### `stopAutoSave()`
Detiene auto-guardado automático.
```javascript
templateManager.stopAutoSave();
```

#### `filterTemplates(filters)`
Filtra plantillas según criterios.
```javascript
templateManager.filterTemplates({
    status: 'pending',
    search: 'bienvenida'
});
```

#### `exportTemplates(format = 'json')`
Exporta plantillas en formato especificado.
```javascript
const data = await templateManager.exportTemplates('csv');
```

#### `importTemplates(file)`
Importa plantillas desde archivo.
```javascript
await templateManager.importTemplates(fileInput.files[0]);
```

### Eventos

#### `template:created`
Se dispara cuando se crea una plantilla.
```javascript
templateManager.on('template:created', (template) => {
    console.log('Plantilla creada:', template);
});
```

#### `template:updated`
Se dispara cuando se actualiza una plantilla.
```javascript
templateManager.on('template:updated', (template) => {
    console.log('Plantilla actualizada:', template);
});
```

#### `template:deleted`
Se dispara cuando se elimina una plantilla.
```javascript
templateManager.on('template:deleted', (templateId) => {
    console.log('Plantilla eliminada:', templateId);
});
```

#### `template:auto-saved`
Se dispara cuando se auto-guarda una plantilla.
```javascript
templateManager.on('template:auto-saved', (template) => {
    console.log('Auto-guardado:', template);
});
```

### Estructura de Plantilla
```javascript
{
    id: 'tpl_123',
    name: 'Plantilla de Bienvenida',
    content: 'Hola {{name}}, bienvenido a {{company}}',
    category: 'greeting',
    language: 'es',
    status: 'approved', // pending, approved, rejected
    variables: ['name', 'company'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    createdBy: 'user_123',
    metadata: {
        usage_count: 150,
        last_used: '2024-01-15T10:30:00Z'
    }
}
```

### Ejemplo de Uso
```javascript
const templateContainer = document.getElementById('template-container');
const templateManager = new TemplateManager(templateContainer, {
    autoSave: true,
    enablePreview: true
});

await templateManager.initialize();

// Crear nueva plantilla
const template = await templateManager.createTemplate({
    name: 'Confirmación de Pedido',
    content: 'Tu pedido {{orderNumber}} ha sido confirmado. Total: {{total}}',
    category: 'order',
    language: 'es'
});

// Previsualizar con variables
const preview = templateManager.previewTemplate(template, {
    orderNumber: '#12345',
    total: '$99.99'
});

console.log('Vista previa:', preview);
```

---

## DashboardManager

### Descripción
Componente principal del dashboard que muestra métricas, estadísticas y widgets configurables con actualizaciones en tiempo real.

### Ubicación
`client/components/dashboard/DashboardManager.js`

### Características Principales
- Widgets configurables y reutilizables
- Gráficos interactivos con Chart.js
- Actualizaciones en tiempo real vía WebSocket
- Métricas de rendimiento
- Dashboard personalizable
- Exportación de datos

### Dependencias
- BaseComponent
- Chart.js
- Socket.io client

### Constructor
```javascript
constructor(container, options = {})
```

**Opciones específicas:**
```javascript
{
    refreshInterval: 30000,
    enableRealTime: true,
    enableCharts: true,
    autoResize: true,
    persistLayout: true
}
```

### Propiedades Específicas

#### Estado del Dashboard
```javascript
this.dashboardState = {
    widgets: [],
    metrics: {},
    charts: {},
    layout: 'default',
    refreshTimer: null,
    realTimeEnabled: true
}
```

#### Configuración de Widgets
```javascript
this.widgetConfig = {
    messages: {
        title: 'Mensajes',
        type: 'metric',
        icon: 'fas fa-comments',
        color: '#25D366',
        endpoint: '/api/metrics/messages'
    },
    contacts: {
        title: 'Contactos',
        type: 'metric',
        icon: 'fas fa-users',
        color: '#007bff',
        endpoint: '/api/metrics/contacts'
    },
    templates: {
        title: 'Plantillas',
        type: 'metric',
        icon: 'fas fa-file-alt',
        color: '#ffc107',
        endpoint: '/api/metrics/templates'
    },
    performance: {
        title: 'Rendimiento',
        type: 'chart',
        chartType: 'line',
        endpoint: '/api/metrics/performance'
    }
}
```

### Métodos Principales

#### `async loadDashboard()`
Carga datos completos del dashboard.
```javascript
await dashboardManager.loadDashboard();
```

#### `async loadMetrics()`
Carga métricas principales.
```javascript
const metrics = await dashboardManager.loadMetrics();
```

#### `renderWidget(widgetId, data)`
Renderiza un widget específico.
```javascript
dashboardManager.renderWidget('messages', {
    value: 1250,
    change: '+15%',
    trend: 'up'
});
```

#### `createChart(containerId, config)`
Crea un gráfico con Chart.js.
```javascript
const chart = dashboardManager.createChart('performance-chart', {
    type: 'line',
    data: chartData,
    options: chartOptions
});
```

#### `updateChart(chartId, newData)`
Actualiza datos de un gráfico existente.
```javascript
dashboardManager.updateChart('performance-chart', newData);
```

#### `addWidget(widgetConfig)`
Añade un nuevo widget al dashboard.
```javascript
dashboardManager.addWidget({
    id: 'custom-metric',
    title: 'Métrica Personalizada',
    type: 'metric',
    endpoint: '/api/custom-metric'
});
```

#### `removeWidget(widgetId)`
Elimina un widget del dashboard.
```javascript
dashboardManager.removeWidget('custom-metric');
```

#### `startRealTimeUpdates()`
Inicia actualizaciones en tiempo real.
```javascript
dashboardManager.startRealTimeUpdates();
```

#### `stopRealTimeUpdates()`
Detiene actualizaciones en tiempo real.
```javascript
dashboardManager.stopRealTimeUpdates();
```

#### `exportDashboard(format = 'pdf')`
Exporta dashboard en formato especificado.
```javascript
await dashboardManager.exportDashboard('png');
```

#### `saveLayout(layout)`
Guarda configuración de layout.
```javascript
dashboardManager.saveLayout({
    widgets: ['messages', 'contacts', 'performance'],
    columns: 3
});
```

#### `loadLayout()`
Carga configuración de layout guardada.
```javascript
const layout = await dashboardManager.loadLayout();
```

### Eventos WebSocket

#### Eventos Recibidos
```javascript
// Actualización de métricas
socket.on('metrics-update', (metrics) => {
    dashboardManager.updateMetrics(metrics);
});

// Nuevo mensaje
socket.on('new-message', (message) => {
    dashboardManager.incrementMetric('messages');
});

// Actualización de rendimiento
socket.on('performance-update', (data) => {
    dashboardManager.updateChart('performance-chart', data);
});
```

### Tipos de Widgets

#### Widget de Métrica
```javascript
{
    type: 'metric',
    value: 1250,
    label: 'Mensajes Enviados',
    change: '+15%',
    trend: 'up', // up, down, stable
    icon: 'fas fa-comments',
    color: '#25D366'
}
```

#### Widget de Gráfico
```javascript
{
    type: 'chart',
    chartType: 'line', // line, bar, pie, doughnut
    data: {
        labels: ['Ene', 'Feb', 'Mar'],
        datasets: [{
            label: 'Mensajes',
            data: [100, 150, 200]
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false
    }
}
```

#### Widget de Lista
```javascript
{
    type: 'list',
    title: 'Últimos Mensajes',
    items: [
        {
            id: 'msg_1',
            title: 'Usuario Ejemplo',
            subtitle: 'Hola, ¿cómo estás?',
            timestamp: '2024-01-15T10:30:00Z',
            status: 'delivered'
        }
    ],
    maxItems: 5
}
```

### Configuración de Gráficos

#### Gráfico de Líneas
```javascript
const lineChartConfig = {
    type: 'line',
    data: {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May'],
        datasets: [{
            label: 'Mensajes Enviados',
            data: [100, 150, 200, 180, 220],
            borderColor: '#25D366',
            backgroundColor: 'rgba(37, 211, 102, 0.1)',
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
};
```

#### Gráfico de Barras
```javascript
const barChartConfig = {
    type: 'bar',
    data: {
        labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
        datasets: [{
            label: 'Mensajes por Día',
            data: [50, 75, 60, 90, 80],
            backgroundColor: '#007bff'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false
    }
};
```

### Ejemplo de Uso
```javascript
const dashboardContainer = document.getElementById('dashboard-container');
const dashboardManager = new DashboardManager(dashboardContainer, {
    refreshInterval: 30000,
    enableRealTime: true
});

await dashboardManager.initialize();

// Cargar dashboard
await dashboardManager.loadDashboard();

// Añadir widget personalizado
dashboardManager.addWidget({
    id: 'conversion-rate',
    title: 'Tasa de Conversión',
    type: 'metric',
    endpoint: '/api/metrics/conversion'
});

// Crear gráfico personalizado
dashboardManager.createChart('custom-chart', {
    type: 'doughnut',
    data: {
        labels: ['Enviados', 'Entregados', 'Leídos'],
        datasets: [{
            data: [100, 85, 70],
            backgroundColor: ['#25D366', '#007bff', '#28a745']
        }]
    }
});

// Escuchar actualizaciones
dashboardManager.on('metrics:updated', (metrics) => {
    console.log('Métricas actualizadas:', metrics);
});
```

---

## ContactManager

### Descripción
Componente para la gestión completa de contactos y grupos, incluyendo operaciones CRUD, búsqueda, filtrado y acciones en lote.

### Ubicación
`client/components/contacts/ContactManager.js`

### Características Principales
- Gestión de contactos y grupos
- Búsqueda y filtrado avanzado
- Acciones en lote (eliminar, exportar, etc.)
- Importación/exportación de contactos
- Paginación eficiente
- Validación de datos de contacto
- Estados de conexión en tiempo real

### Dependencias
- BaseComponent

### Constructor
```javascript
constructor(container, options = {})
```

**Opciones específicas:**
```javascript
{
    pageSize: 50,
    enableBulkActions: true,
    enableImportExport: true,
    enableRealTimeStatus: true,
    validatePhoneNumbers: true
}
```

### Propiedades Específicas

#### Estado de Contactos
```javascript
this.contactState = {
    contacts: [],
    groups: [],
    selectedContacts: [],
    currentPage: 1,
    totalPages: 1,
    totalContacts: 0,
    filters: {
        search: '',
        group: 'all',
        status: 'all'
    },
    sortBy: 'name',
    sortOrder: 'asc'
}
```

#### Reglas de Validación
```javascript
this.validationRules = {
    name: 'required|min:2|max:50',
    phone: 'required|phone',
    email: 'email',
    group: 'string'
}
```

### Métodos Principales

#### `async loadContacts(page = 1, filters = {})`
Carga contactos con paginación y filtros.
```javascript
await contactManager.loadContacts(1, {
    search: 'juan',
    group: 'customers',
    status: 'active'
});
```

#### `async loadGroups()`
Carga lista de grupos.
```javascript
const groups = await contactManager.loadGroups();
```

#### `async createContact(contactData)`
Crea un nuevo contacto.
```javascript
const contact = await contactManager.createContact({
    name: 'Usuario Ejemplo',
    phone: '+1234567890',
    email: 'usuario@example.com',
    group: 'customers'
});
```

#### `async updateContact(contactId, data)`
Actualiza un contacto existente.
```javascript
await contactManager.updateContact('contact_123', {
    name: 'Juan Carlos Pérez',
    email: 'juancarlos@example.com'
});
```

#### `async deleteContact(contactId)`
Elimina un contacto.
```javascript
await contactManager.deleteContact('contact_123');
```

#### `async createGroup(groupData)`
Crea un nuevo grupo.
```javascript
const group = await contactManager.createGroup({
    name: 'Clientes VIP',
    description: 'Clientes con mayor valor'
});
```

#### `selectContact(contactId, selected = true)`
Selecciona/deselecciona un contacto.
```javascript
contactManager.selectContact('contact_123', true);
```

#### `selectAllContacts(selected = true)`
Selecciona/deselecciona todos los contactos visibles.
```javascript
contactManager.selectAllContacts(true);
```

#### `getSelectedContacts()`
Obtiene lista de contactos seleccionados.
```javascript
const selected = contactManager.getSelectedContacts();
```

#### `async bulkDelete(contactIds)`
Elimina múltiples contactos.
```javascript
await contactManager.bulkDelete(['contact_1', 'contact_2']);
```

#### `async bulkUpdateGroup(contactIds, groupId)`
Actualiza grupo de múltiples contactos.
```javascript
await contactManager.bulkUpdateGroup(['contact_1', 'contact_2'], 'group_vip');
```

#### `async exportContacts(format = 'csv', filters = {})`
Exporta contactos en formato especificado.
```javascript
const data = await contactManager.exportContacts('xlsx', {
    group: 'customers'
});
```

#### `async importContacts(file, options = {})`
Importa contactos desde archivo.
```javascript
await contactManager.importContacts(fileInput.files[0], {
    skipDuplicates: true,
    defaultGroup: 'imported'
});
```

#### `searchContacts(query)`
Busca contactos por nombre o teléfono.
```javascript
contactManager.searchContacts('juan');
```

#### `filterContacts(filters)`
Aplica filtros a la lista de contactos.
```javascript
contactManager.filterContacts({
    group: 'customers',
    status: 'active'
});
```

#### `sortContacts(field, order = 'asc')`
Ordena contactos por campo especificado.
```javascript
contactManager.sortContacts('name', 'desc');
```

#### `async validatePhoneNumber(phone)`
Valida formato de número telefónico.
```javascript
const isValid = await contactManager.validatePhoneNumber('+1234567890');
```

### Eventos

#### `contact:created`
Se dispara cuando se crea un contacto.
```javascript
contactManager.on('contact:created', (contact) => {
    console.log('Contacto creado:', contact);
});
```

#### `contact:updated`
Se dispara cuando se actualiza un contacto.
```javascript
contactManager.on('contact:updated', (contact) => {
    console.log('Contacto actualizado:', contact);
});
```

#### `contact:deleted`
Se dispara cuando se elimina un contacto.
```javascript
contactManager.on('contact:deleted', (contactId) => {
    console.log('Contacto eliminado:', contactId);
});
```

#### `contacts:selection-changed`
Se dispara cuando cambia la selección de contactos.
```javascript
contactManager.on('contacts:selection-changed', (selectedIds) => {
    console.log('Selección actualizada:', selectedIds);
});
```

#### `contacts:imported`
Se dispara cuando se importan contactos.
```javascript
contactManager.on('contacts:imported', (result) => {
    console.log('Importación completada:', result);
});
```

### Estructura de Contacto
```javascript
{
    id: 'contact_123',
    name: 'Usuario Ejemplo',
    phone: '+1234567890',
    email: 'usuario@example.com',
    avatar: 'https://example.com/avatar.jpg',
    group: 'customers',
    status: 'active', // active, inactive, blocked
    lastSeen: '2024-01-15T10:30:00Z',
    isOnline: true,
    metadata: {
        source: 'manual',
        tags: ['vip', 'premium'],
        notes: 'Cliente importante'
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z'
}
```

### Estructura de Grupo
```javascript
{
    id: 'group_123',
    name: 'Clientes VIP',
    description: 'Clientes con mayor valor',
    color: '#007bff',
    contactCount: 25,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z'
}
```

### Ejemplo de Uso
```javascript
const contactContainer = document.getElementById('contact-container');
const contactManager = new ContactManager(contactContainer, {
    pageSize: 25,
    enableBulkActions: true
});

await contactManager.initialize();

// Cargar contactos
await contactManager.loadContacts(1);

// Crear nuevo contacto
const contact = await contactManager.createContact({
    name: 'Usuario Ejemplo',
    phone: '+1987654321',
    email: 'usuario@example.com',
    group: 'customers'
});

// Buscar contactos
contactManager.searchContacts('usuario');

// Seleccionar contactos y realizar acción en lote
contactManager.selectContact('contact_1', true);
contactManager.selectContact('contact_2', true);

const selected = contactManager.getSelectedContacts();
await contactManager.bulkUpdateGroup(selected.map(c => c.id), 'vip');

// Exportar contactos
const csvData = await contactManager.exportContacts('csv', {
    group: 'customers'
});

// Escuchar eventos
contactManager.on('contact:created', (contact) => {
    console.log('Nuevo contacto:', contact.name);
});
```

---

## AnalyticsManager

### Descripción
Componente para análisis y visualización de métricas del sistema, incluyendo estadísticas de mensajes, rendimiento y reportes personalizados.

### Ubicación
`client/components/analytics/AnalyticsManager.js`

### Características Principales
- Visualización de métricas y estadísticas
- Gráficos interactivos con Chart.js
- Filtros por fecha y categoría
- Reportes personalizados
- Exportación de datos
- Actualizaciones en tiempo real
- Comparación de períodos

### Dependencias
- BaseComponent
- Chart.js
- Socket.io client

### Constructor
```javascript
constructor(container, options = {})
```

**Opciones específicas:**
```javascript
{
    defaultDateRange: '7d',
    enableRealTime: true,
    enableExport: true,
    enableComparison: true,
    refreshInterval: 60000
}
```

### Propiedades Específicas

#### Estado de Analytics
```javascript
this.analyticsState = {
    metrics: {},
    charts: {},
    dateRange: {
        start: null,
        end: null,
        preset: '7d'
    },
    filters: {
        category: 'all',
        status: 'all'
    },
    comparison: {
        enabled: false,
        period: 'previous'
    }
}
```

#### Configuración de Métricas
```javascript
this.metricsConfig = {
    messages: {
        title: 'Mensajes',
        endpoints: {
            total: '/api/analytics/messages/total',
            sent: '/api/analytics/messages/sent',
            delivered: '/api/analytics/messages/delivered',
            read: '/api/analytics/messages/read'
        }
    },
    contacts: {
        title: 'Contactos',
        endpoints: {
            total: '/api/analytics/contacts/total',
            active: '/api/analytics/contacts/active',
            new: '/api/analytics/contacts/new'
        }
    },
    performance: {
        title: 'Rendimiento',
        endpoints: {
            response_time: '/api/analytics/performance/response-time',
            success_rate: '/api/analytics/performance/success-rate'
        }
    }
}
```

### Métodos Principales

#### `async loadAnalytics(dateRange, filters = {})`
Carga datos de analytics para el rango especificado.
```javascript
await analyticsManager.loadAnalytics({
    start: '2024-01-01',
    end: '2024-01-31'
}, {
    category: 'marketing'
});
```

#### `async loadMetrics(metricType, dateRange)`
Carga métricas específicas.
```javascript
const metrics = await analyticsManager.loadMetrics('messages', {
    start: '2024-01-01',
    end: '2024-01-07'
});
```

#### `setDateRange(start, end, preset = null)`
Establece rango de fechas para análisis.
```javascript
analyticsManager.setDateRange('2024-01-01', '2024-01-31', '1m');
```

#### `setDatePreset(preset)`
Establece preset de fecha (7d, 30d, 3m, etc.).
```javascript
analyticsManager.setDatePreset('30d');
```

#### `createChart(containerId, type, data, options = {})`
Crea gráfico de analytics.
```javascript
const chart = analyticsManager.createChart('messages-chart', 'line', {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
    datasets: [{
        label: 'Mensajes Enviados',
        data: [100, 150, 200, 180, 220]
    }]
});
```

#### `updateChart(chartId, newData)`
Actualiza datos de gráfico existente.
```javascript
analyticsManager.updateChart('messages-chart', newData);
```

#### `enableComparison(period = 'previous')`
Habilita comparación con período anterior.
```javascript
analyticsManager.enableComparison('previous'); // previous, year_ago
```

#### `disableComparison()`
Deshabilita comparación de períodos.
```javascript
analyticsManager.disableComparison();
```

#### `async generateReport(config)`
Genera reporte personalizado.
```javascript
const report = await analyticsManager.generateReport({
    title: 'Reporte Mensual',
    metrics: ['messages', 'contacts'],
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    format: 'pdf'
});
```

#### `async exportData(format = 'csv', filters = {})`
Exporta datos de analytics.
```javascript
const data = await analyticsManager.exportData('xlsx', {
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    metrics: ['messages', 'contacts']
});
```

#### `calculateGrowth(current, previous)`
Calcula porcentaje de crecimiento.
```javascript
const growth = analyticsManager.calculateGrowth(150, 100); // 50%
```

#### `formatMetric(value, type)`
Formatea valor de métrica para visualización.
```javascript
const formatted = analyticsManager.formatMetric(1250, 'number'); // "1.25K"
```

#### `addCustomMetric(metricConfig)`
Añade métrica personalizada.
```javascript
analyticsManager.addCustomMetric({
    id: 'conversion_rate',
    title: 'Tasa de Conversión',
    endpoint: '/api/analytics/conversion-rate',
    format: 'percentage'
});
```

### Eventos

#### `analytics:loaded`
Se dispara cuando se cargan los datos.
```javascript
analyticsManager.on('analytics:loaded', (data) => {
    console.log('Analytics cargados:', data);
});
```

#### `analytics:date-range-changed`
Se dispara cuando cambia el rango de fechas.
```javascript
analyticsManager.on('analytics:date-range-changed', (dateRange) => {
    console.log('Nuevo rango:', dateRange);
});
```

#### `analytics:metric-updated`
Se dispara cuando se actualiza una métrica.
```javascript
analyticsManager.on('analytics:metric-updated', (metric) => {
    console.log('Métrica actualizada:', metric);
});
```

### Tipos de Gráficos

#### Gráfico de Líneas (Tendencias)
```javascript
const lineChart = {
    type: 'line',
    data: {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May'],
        datasets: [{
            label: 'Mensajes Enviados',
            data: [100, 150, 200, 180, 220],
            borderColor: '#25D366',
            backgroundColor: 'rgba(37, 211, 102, 0.1)',
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
};
```

#### Gráfico de Barras (Comparaciones)
```javascript
const barChart = {
    type: 'bar',
    data: {
        labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
        datasets: [{
            label: 'Este Período',
            data: [50, 75, 60, 90, 80],
            backgroundColor: '#007bff'
        }, {
            label: 'Período Anterior',
            data: [40, 65, 55, 80, 70],
            backgroundColor: '#6c757d'
        }]
    }
};
```

#### Gráfico Circular (Distribución)
```javascript
const pieChart = {
    type: 'pie',
    data: {
        labels: ['Enviados', 'Entregados', 'Leídos', 'Fallidos'],
        datasets: [{
            data: [100, 85, 70, 5],
            backgroundColor: [
                '#25D366',
                '#007bff',
                '#28a745',
                '#dc3545'
            ]
        }]
    }
};
```

### Presets de Fecha
```javascript
const datePresets = {
    '7d': { days: 7, label: 'Últimos 7 días' },
    '30d': { days: 30, label: 'Últimos 30 días' },
    '3m': { months: 3, label: 'Últimos 3 meses' },
    '6m': { months: 6, label: 'Últimos 6 meses' },
    '1y': { years: 1, label: 'Último año' },
    'custom': { label: 'Personalizado' }
};
```

### Ejemplo de Uso
```javascript
const analyticsContainer = document.getElementById('analytics-container');
const analyticsManager = new AnalyticsManager(analyticsContainer, {
    defaultDateRange: '30d',
    enableComparison: true
});

await analyticsManager.initialize();

// Establecer rango de fechas
analyticsManager.setDatePreset('30d');

// Cargar analytics
await analyticsManager.loadAnalytics();

// Habilitar comparación
analyticsManager.enableComparison('previous');

// Crear gráfico personalizado
analyticsManager.createChart('custom-chart', 'line', {
    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
    datasets: [{
        label: 'Conversiones',
        data: [25, 30, 45, 60],
        borderColor: '#28a745'
    }]
});

// Generar reporte
const report = await analyticsManager.generateReport({
    title: 'Reporte de Rendimiento',
    metrics: ['messages', 'contacts', 'performance'],
    dateRange: analyticsManager.analyticsState.dateRange,
    format: 'pdf'
});

// Exportar datos
const csvData = await analyticsManager.exportData('csv');

// Escuchar cambios
analyticsManager.on('analytics:date-range-changed', async (dateRange) => {
    await analyticsManager.loadAnalytics(dateRange);
});
```

---

## SettingsManager

### Descripción
Componente para la gestión completa de configuraciones del sistema, incluyendo configuraciones generales, de bot, WhatsApp, base de datos y usuarios.

### Ubicación
`client/components/settings/SettingsManager.js`

### Características Principales
- Gestión de múltiples categorías de configuración
- Auto-guardado de cambios
- Validación en tiempo real
- Backup y restauración de configuraciones
- Importación/exportación de configuraciones
- Interfaz organizada por pestañas
- Historial de cambios

### Dependencias
- BaseComponent

### Constructor
```javascript
constructor(container, options = {})
```

**Opciones específicas:**
```javascript
{
    autoSave: true,
    autoSaveDelay: 2000,
    enableBackup: true,
    enableImportExport: true,
    validateOnChange: true
}
```

### Propiedades Específicas

#### Estado de Configuraciones
```javascript
this.settingsState = {
    settings: {},
    originalSettings: {},
    activeSection: 'general',
    hasChanges: false,
    autoSaveTimer: null,
    validationErrors: {}
}
```

#### Configuración de Secciones
```javascript
this.sectionsConfig = {
    general: {
        title: 'General',
        icon: 'fas fa-cog',
        fields: {
            app_name: { type: 'text', label: 'Nombre de la Aplicación' },
            app_description: { type: 'textarea', label: 'Descripción' },
            timezone: { type: 'select', label: 'Zona Horaria' },
            language: { type: 'select', label: 'Idioma' }
        }
    },
    bot: {
        title: 'Bot',
        icon: 'fas fa-robot',
        fields: {
            bot_name: { type: 'text', label: 'Nombre del Bot' },
            welcome_message: { type: 'textarea', label: 'Mensaje de Bienvenida' },
            auto_reply: { type: 'checkbox', label: 'Respuesta Automática' },
            response_delay: { type: 'number', label: 'Retraso de Respuesta (ms)' }
        }
    },
    whatsapp: {
        title: 'WhatsApp',
        icon: 'fab fa-whatsapp',
        fields: {
            api_url: { type: 'text', label: 'URL de API' },
            api_token: { type: 'password', label: 'Token de API' },
            webhook_url: { type: 'text', label: 'URL de Webhook' },
            phone_number: { type: 'tel', label: 'Número de Teléfono' }
        }
    },
    database: {
        title: 'Base de Datos',
        icon: 'fas fa-database',
        fields: {
            db_type: { type: 'select', label: 'Tipo de Base de Datos' },
            db_host: { type: 'text', label: 'Host' },
            db_port: { type: 'number', label: 'Puerto' },
            db_name: { type: 'text', label: 'Nombre de Base de Datos' }
        }
    },
    api: {
        title: 'API',
        icon: 'fas fa-plug',
        fields: {
            api_rate_limit: { type: 'number', label: 'Límite de Velocidad' },
            api_timeout: { type: 'number', label: 'Timeout (ms)' },
            enable_cors: { type: 'checkbox', label: 'Habilitar CORS' },
            api_version: { type: 'select', label: 'Versión de API' }
        }
    },
    users: {
        title: 'Usuarios',
        icon: 'fas fa-users',
        fields: {
            allow_registration: { type: 'checkbox', label: 'Permitir Registro' },
            require_email_verification: { type: 'checkbox', label: 'Verificación de Email' },
            password_min_length: { type: 'number', label: 'Longitud Mínima de Contraseña' },
            session_timeout: { type: 'number', label: 'Timeout de Sesión (min)' }
        }
    }
}
```

### Métodos Principales

#### `async loadSettings()`
Carga todas las configuraciones del servidor.
```javascript
await settingsManager.loadSettings();
```

#### `async saveSettings(settings = null)`
Guarda configuraciones en el servidor.
```javascript
await settingsManager.saveSettings({
    general: { app_name: 'Mi Bot WhatsApp' },
    bot: { welcome_message: 'Hola, bienvenido' }
});
```

#### `updateSetting(section, key, value)`
Actualiza una configuración específica.
```javascript
settingsManager.updateSetting('general', 'app_name', 'Nuevo Nombre');
```

#### `getSetting(section, key, defaultValue = null)`
Obtiene valor de una configuración.
```javascript
const appName = settingsManager.getSetting('general', 'app_name', 'Bot WhatsApp');
```

#### `validateSettings(settings = null)`
Valida configuraciones según reglas definidas.
```javascript
const validation = settingsManager.validateSettings();
if (!validation.isValid) {
    console.log('Errores:', validation.errors);
}
```

#### `setActiveSection(sectionId)`
Cambia la sección activa de configuración.
```javascript
settingsManager.setActiveSection('whatsapp');
```

#### `hasUnsavedChanges()`
Verifica si hay cambios sin guardar.
```javascript
const hasChanges = settingsManager.hasUnsavedChanges();
```

#### `resetToDefaults(section = null)`
Restaura configuraciones a valores por defecto.
```javascript
settingsManager.resetToDefaults('general'); // Solo sección general
settingsManager.resetToDefaults(); // Todas las secciones
```

#### `async createBackup()`
Crea backup de configuraciones actuales.
```javascript
const backup = await settingsManager.createBackup();
```

#### `async restoreBackup(backupData)`
Restaura configuraciones desde backup.
```javascript
await settingsManager.restoreBackup(backupData);
```

#### `async exportSettings(format = 'json')`
Exporta configuraciones en formato especificado.
```javascript
const data = await settingsManager.exportSettings('json');
```

#### `async importSettings(file)`
Importa configuraciones desde archivo.
```javascript
await settingsManager.importSettings(fileInput.files[0]);
```

#### `startAutoSave()`
Inicia auto-guardado automático.
```javascript
settingsManager.startAutoSave();
```

#### `stopAutoSave()`
Detiene auto-guardado automático.
```javascript
settingsManager.stopAutoSave();
```

#### `addCustomSection(sectionConfig)`
Añade sección personalizada de configuración.
```javascript
settingsManager.addCustomSection({
    id: 'notifications',
    title: 'Notificaciones',
    icon: 'fas fa-bell',
    fields: {
        email_notifications: { type: 'checkbox', label: 'Notificaciones por Email' },
        sms_notifications: { type: 'checkbox', label: 'Notificaciones por SMS' }
    }
});
```

### Eventos

#### `settings:loaded`
Se dispara cuando se cargan las configuraciones.
```javascript
settingsManager.on('settings:loaded', (settings) => {
    console.log('Configuraciones cargadas:', settings);
});
```

#### `settings:changed`
Se dispara cuando cambia una configuración.
```javascript
settingsManager.on('settings:changed', ({ section, key, value }) => {
    console.log(`Configuración cambiada: ${section}.${key} = ${value}`);
});
```

#### `settings:saved`
Se dispara cuando se guardan las configuraciones.
```javascript
settingsManager.on('settings:saved', (settings) => {
    console.log('Configuraciones guardadas:', settings);
});
```

#### `settings:validation-error`
Se dispara cuando hay errores de validación.
```javascript
settingsManager.on('settings:validation-error', (errors) => {
    console.log('Errores de validación:', errors);
});
```

#### `settings:section-changed`
Se dispara cuando cambia la sección activa.
```javascript
settingsManager.on('settings:section-changed', (sectionId) => {
    console.log('Sección activa:', sectionId);
});
```

### Tipos de Campos

#### Campo de Texto
```javascript
{
    type: 'text',
    label: 'Nombre de la Aplicación',
    placeholder: 'Ingrese el nombre',
    required: true,
    validation: 'required|min:3|max:50'
}
```

#### Campo de Contraseña
```javascript
{
    type: 'password',
    label: 'Token de API',
    placeholder: 'Ingrese el token',
    required: true,
    showToggle: true
}
```

#### Campo de Selección
```javascript
{
    type: 'select',
    label: 'Zona Horaria',
    options: [
        { value: 'UTC', label: 'UTC' },
        { value: 'America/New_York', label: 'Nueva York' },
        { value: 'Europe/Madrid', label: 'Madrid' }
    ],
    required: true
}
```

#### Campo de Checkbox
```javascript
{
    type: 'checkbox',
    label: 'Habilitar Notificaciones',
    description: 'Recibir notificaciones por email'
}
```

#### Campo de Número
```javascript
{
    type: 'number',
    label: 'Puerto',
    min: 1,
    max: 65535,
    step: 1,
    required: true
}
```

#### Campo de Área de Texto
```javascript
{
    type: 'textarea',
    label: 'Descripción',
    rows: 4,
    maxlength: 500,
    placeholder: 'Ingrese la descripción'
}
```

### Validación de Configuraciones

#### Reglas de Validación
```javascript
const validationRules = {
    'general.app_name': 'required|min:3|max:50',
    'general.app_description': 'max:500',
    'whatsapp.api_url': 'required|url',
    'whatsapp.api_token': 'required|min:10',
    'whatsapp.phone_number': 'required|phone',
    'database.db_port': 'required|numeric|min:1|max:65535',
    'api.api_rate_limit': 'required|numeric|min:1',
    'users.password_min_length': 'required|numeric|min:6|max:50'
};
```

#### Validadores Personalizados
```javascript
settingsManager.addValidator('phone', (value) => {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(value);
});

settingsManager.addValidator('url', (value) => {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
});
```

### Ejemplo de Uso
```javascript
const settingsContainer = document.getElementById('settings-container');
const settingsManager = new SettingsManager(settingsContainer, {
    autoSave: true,
    autoSaveDelay: 3000
});

await settingsManager.initialize();

// Cargar configuraciones
await settingsManager.loadSettings();

// Cambiar a sección de WhatsApp
settingsManager.setActiveSection('whatsapp');

// Actualizar configuración
settingsManager.updateSetting('whatsapp', 'api_token', 'nuevo_token_123');

// Validar antes de guardar
const validation = settingsManager.validateSettings();
if (validation.isValid) {
    await settingsManager.saveSettings();
} else {
    console.log('Errores de validación:', validation.errors);
}

// Crear backup
const backup = await settingsManager.createBackup();

// Exportar configuraciones
const configData = await settingsManager.exportSettings('json');

// Escuchar cambios
settingsManager.on('settings:changed', ({ section, key, value }) => {
    console.log(`Configuración actualizada: ${section}.${key} = ${value}`);
});

settingsManager.on('settings:saved', () => {
    console.log('Configuraciones guardadas exitosamente');
});
```

---

## ReportsManager

### Descripción
Componente para la generación, visualización y gestión de reportes del sistema, incluyendo reportes predefinidos y personalizados.

### Ubicación
`client/components/reports/ReportsManager.js`

### Características Principales
- Generación de reportes predefinidos y personalizados
- Múltiples formatos de exportación (PDF, Excel, CSV)
- Programación de reportes automáticos
- Filtros avanzados por fecha y categoría
- Visualización de datos con gráficos
- Historial de reportes generados
- Plantillas de reportes reutilizables

### Dependencias
- BaseComponent
- Chart.js

### Constructor
```javascript
constructor(container, options = {})
```

**Opciones específicas:**
```javascript
{
    enableScheduling: true,
    enableCustomReports: true,
    defaultFormat: 'pdf',
    enableCharts: true,
    maxReportHistory: 50
}
```

### Propiedades Específicas

#### Estado de Reportes
```javascript
this.reportsState = {
    reports: [],
    templates: [],
    scheduledReports: [],
    currentReport: null,
    filters: {
        dateRange: { start: null, end: null },
        category: 'all',
        status: 'all'
    },
    generating: false
}
```

#### Configuración de Reportes Predefinidos
```javascript
this.predefinedReports = {
    messages_summary: {
        title: 'Resumen de Mensajes',
        description: 'Estadísticas generales de mensajes enviados y recibidos',
        category: 'messaging',
        fields: ['total_sent', 'total_received', 'delivery_rate', 'read_rate'],
        charts: ['messages_timeline', 'status_distribution']
    },
    contacts_report: {
        title: 'Reporte de Contactos',
        description: 'Análisis de contactos y grupos',
        category: 'contacts',
        fields: ['total_contacts', 'active_contacts', 'groups_count', 'new_contacts'],
        charts: ['contacts_growth', 'groups_distribution']
    },
    performance_report: {
        title: 'Reporte de Rendimiento',
        description: 'Métricas de rendimiento del sistema',
        category: 'performance',
        fields: ['response_time', 'uptime', 'error_rate', 'throughput'],
        charts: ['performance_timeline', 'error_distribution']
    }
}
```

### Métodos Principales

#### `async loadReports(filters = {})`
Carga lista de reportes con filtros opcionales.
```javascript
await reportsManager.loadReports({
    category: 'messaging',
    dateRange: { start: '2024-01-01', end: '2024-01-31' }
});
```

#### `async generateReport(reportConfig)`
Genera un nuevo reporte.
```javascript
const report = await reportsManager.generateReport({
    type: 'messages_summary',
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    format: 'pdf',
    includeCharts: true
});
```

#### `async generateCustomReport(config)`
Genera reporte personalizado.
```javascript
const customReport = await reportsManager.generateCustomReport({
    title: 'Reporte Personalizado',
    metrics: ['messages.sent', 'contacts.active'],
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    groupBy: 'day',
    format: 'excel'
});
```

#### `async scheduleReport(scheduleConfig)`
Programa reporte automático.
```javascript
await reportsManager.scheduleReport({
    reportType: 'messages_summary',
    schedule: 'weekly', // daily, weekly, monthly
    dayOfWeek: 1, // Para reportes semanales
    time: '09:00',
    recipients: ['admin@example.com'],
    format: 'pdf'
});
```

#### `async loadReportTemplates()`
Carga plantillas de reportes disponibles.
```javascript
const templates = await reportsManager.loadReportTemplates();
```

#### `async saveReportTemplate(template)`
Guarda nueva plantilla de reporte.
```javascript
await reportsManager.saveReportTemplate({
    name: 'Reporte Semanal Personalizado',
    config: {
        metrics: ['messages.sent', 'contacts.new'],
        groupBy: 'day',
        includeCharts: true
    }
});
```

#### `async downloadReport(reportId, format = null)`
Descarga reporte generado.
```javascript
await reportsManager.downloadReport('report_123', 'pdf');
```

#### `async deleteReport(reportId)`
Elimina reporte del historial.
```javascript
await reportsManager.deleteReport('report_123');
```

#### `previewReport(reportConfig)`
Genera vista previa de reporte.
```javascript
const preview = await reportsManager.previewReport({
    type: 'contacts_report',
    dateRange: { start: '2024-01-01', end: '2024-01-07' }
});
```

#### `setDateRange(start, end)`
Establece rango de fechas para reportes.
```javascript
reportsManager.setDateRange('2024-01-01', '2024-01-31');
```

#### `addCustomMetric(metricConfig)`
Añade métrica personalizada para reportes.
```javascript
reportsManager.addCustomMetric({
    id: 'conversion_rate',
    name: 'Tasa de Conversión',
    calculation: 'converted_contacts / total_contacts * 100',
    format: 'percentage'
});
```

### Eventos

#### `report:generated`
Se dispara cuando se genera un reporte.
```javascript
reportsManager.on('report:generated', (report) => {
    console.log('Reporte generado:', report);
});
```

#### `report:scheduled`
Se dispara cuando se programa un reporte.
```javascript
reportsManager.on('report:scheduled', (schedule) => {
    console.log('Reporte programado:', schedule);
});
```

#### `report:generation-started`
Se dispara cuando inicia la generación.
```javascript
reportsManager.on('report:generation-started', (config) => {
    console.log('Iniciando generación:', config);
});
```

#### `report:generation-progress`
Se dispara durante el progreso de generación.
```javascript
reportsManager.on('report:generation-progress', (progress) => {
    console.log('Progreso:', progress.percentage + '%');
});
```

### Estructura de Reporte
```javascript
{
    id: 'report_123',
    title: 'Resumen de Mensajes - Enero 2024',
    type: 'messages_summary',
    category: 'messaging',
    dateRange: {
        start: '2024-01-01',
        end: '2024-01-31'
    },
    format: 'pdf',
    status: 'completed', // generating, completed, failed
    data: {
        metrics: {
            total_sent: 1250,
            total_received: 980,
            delivery_rate: 95.2,
            read_rate: 78.5
        },
        charts: [
            {
                type: 'line',
                title: 'Mensajes por Día',
                data: { /* datos del gráfico */ }
            }
        ]
    },
    fileUrl: '/reports/report_123.pdf',
    fileSize: 2048576,
    generatedAt: '2024-02-01T10:00:00Z',
    generatedBy: 'user_123'
}
```

### Configuración de Programación
```javascript
{
    id: 'schedule_123',
    reportType: 'messages_summary',
    title: 'Reporte Semanal de Mensajes',
    schedule: {
        frequency: 'weekly', // daily, weekly, monthly
        dayOfWeek: 1, // 0=Domingo, 1=Lunes, etc.
        time: '09:00',
        timezone: 'America/New_York'
    },
    recipients: [
        'admin@example.com',
        'manager@example.com'
    ],
    format: 'pdf',
    includeCharts: true,
    active: true,
    lastRun: '2024-01-29T09:00:00Z',
    nextRun: '2024-02-05T09:00:00Z'
}
```

### Ejemplo de Uso
```javascript
const reportsContainer = document.getElementById('reports-container');
const reportsManager = new ReportsManager(reportsContainer, {
    enableScheduling: true,
    enableCustomReports: true
});

await reportsManager.initialize();

// Cargar reportes existentes
await reportsManager.loadReports();

// Generar reporte predefinido
const report = await reportsManager.generateReport({
    type: 'messages_summary',
    dateRange: {
        start: '2024-01-01',
        end: '2024-01-31'
    },
    format: 'pdf',
    includeCharts: true
});

// Generar reporte personalizado
const customReport = await reportsManager.generateCustomReport({
    title: 'Análisis de Conversiones',
    metrics: [
        'messages.sent',
        'contacts.converted',
        'templates.usage'
    ],
    dateRange: {
        start: '2024-01-01',
        end: '2024-01-31'
    },
    groupBy: 'week',
    format: 'excel',
    filters: {
        contactGroup: 'customers'
    }
});

// Programar reporte automático
await reportsManager.scheduleReport({
    reportType: 'performance_report',
    schedule: 'monthly',
    dayOfMonth: 1,
    time: '08:00',
    recipients: ['admin@example.com'],
    format: 'pdf'
});

// Escuchar eventos
reportsManager.on('report:generated', (report) => {
    console.log('Reporte listo:', report.title);
    // Mostrar notificación o descargar automáticamente
});

reportsManager.on('report:generation-progress', (progress) => {
    // Actualizar barra de progreso
    updateProgressBar(progress.percentage);
});
```

---

## ComponentLoader

### Descripción
Sistema de carga dinámica de componentes que maneja la inicialización, dependencias y ciclo de vida de todos los componentes modulares.

### Ubicación
`client/components/utils/ComponentLoader.js`

### Características Principales
- Carga asíncrona de componentes
- Gestión de dependencias automática
- Cache de componentes cargados
- Lazy loading para optimización
- Manejo de errores robusto
- Estadísticas de rendimiento
- Hot-reloading en desarrollo

### Dependencias
- Ninguna (es un componente base)

### Constructor
```javascript
constructor(options = {})
```

**Opciones específicas:**
```javascript
{
    basePath: '/client/components',
    enableCache: true,
    enableLazyLoading: true,
    enableHotReload: false,
    timeout: 30000
}
```

### Propiedades Específicas

#### Estado del Loader
```javascript
this.loaderState = {
    loadedComponents: new Map(),
    loadingPromises: new Map(),
    componentInstances: new Map(),
    dependencies: new Map(),
    statistics: {
        totalLoaded: 0,
        totalFailed: 0,
        averageLoadTime: 0
    }
}
```

#### Componentes Registrados
```javascript
this.registeredComponents = {
    'BaseComponent': {
        path: '/client/components/core/BaseComponent.js',
        dependencies: []
    },
    'ChatInterface': {
        path: '/client/components/chat/ChatInterface.js',
        dependencies: ['BaseComponent']
    },
    'NavigationManager': {
        path: '/client/components/navigation/NavigationManager.js',
        dependencies: ['BaseComponent']
    },
    // ... otros componentes
}
```

### Métodos Principales

#### `async loadComponent(componentName, container, options = {})`
Carga y crea instancia de un componente.
```javascript
const chatInterface = await componentLoader.loadComponent(
    'ChatInterface',
    document.getElementById('chat-container'),
    { socketUrl: 'ws://localhost:3000' }
);
```

#### `async preloadComponent(componentName)`
Precarga un componente sin crear instancia.
```javascript
await componentLoader.preloadComponent('TemplateManager');
```

#### `async preloadAll(componentNames = [])`
Precarga múltiples componentes.
```javascript
await componentLoader.preloadAll([
    'ChatInterface',
    'NavigationManager',
    'DashboardManager'
]);
```

#### `registerComponent(name, config)`
Registra un nuevo componente.
```javascript
componentLoader.registerComponent('CustomComponent', {
    path: '/client/components/custom/CustomComponent.js',
    dependencies: ['BaseComponent'],
    lazy: true
});
```

#### `unregisterComponent(name)`
Desregistra un componente.
```javascript
componentLoader.unregisterComponent('CustomComponent');
```

#### `isLoaded(componentName)`
Verifica si un componente está cargado.
```javascript
const isLoaded = componentLoader.isLoaded('ChatInterface');
```

#### `isLoading(componentName)`
Verifica si un componente se está cargando.
```javascript
const isLoading = componentLoader.isLoading('DashboardManager');
```

#### `getInstance(componentName, instanceId = 'default')`
Obtiene instancia existente de un componente.
```javascript
const chatInstance = componentLoader.getInstance('ChatInterface', 'main-chat');
```

#### `destroyInstance(componentName, instanceId = 'default')`
Destruye instancia de un componente.
```javascript
componentLoader.destroyInstance('ChatInterface', 'main-chat');
```

#### `destroyAllInstances(componentName = null)`
Destruye todas las instancias de un componente o todas.
```javascript
componentLoader.destroyAllInstances('ChatInterface'); // Solo ChatInterface
componentLoader.destroyAllInstances(); // Todas las instancias
```

#### `getStatistics()`
Obtiene estadísticas de carga de componentes.
```javascript
const stats = componentLoader.getStatistics();
console.log('Componentes cargados:', stats.totalLoaded);
console.log('Tiempo promedio de carga:', stats.averageLoadTime);
```

#### `clearCache(componentName = null)`
Limpia cache de componentes.
```javascript
componentLoader.clearCache('ChatInterface'); // Solo ChatInterface
componentLoader.clearCache(); // Todo el cache
```

#### `enableHotReload()`
Habilita hot-reloading para desarrollo.
```javascript
componentLoader.enableHotReload();
```

#### `disableHotReload()`
Deshabilita hot-reloading.
```javascript
componentLoader.disableHotReload();
```

### Eventos

#### `component:loading`
Se dispara cuando inicia la carga de un componente.
```javascript
componentLoader.on('component:loading', ({ name, path }) => {
    console.log(`Cargando componente: ${name}`);
});
```

#### `component:loaded`
Se dispara cuando se carga un componente exitosamente.
```javascript
componentLoader.on('component:loaded', ({ name, loadTime }) => {
    console.log(`Componente cargado: ${name} (${loadTime}ms)`);
});
```

#### `component:error`
Se dispara cuando falla la carga de un componente.
```javascript
componentLoader.on('component:error', ({ name, error }) => {
    console.error(`Error cargando ${name}:`, error);
});
```

#### `component:instance-created`
Se dispara cuando se crea una instancia.
```javascript
componentLoader.on('component:instance-created', ({ name, instanceId, instance }) => {
    console.log(`Instancia creada: ${name}#${instanceId}`);
});
```

#### `component:instance-destroyed`
Se dispara cuando se destruye una instancia.
```javascript
componentLoader.on('component:instance-destroyed', ({ name, instanceId }) => {
    console.log(`Instancia destruida: ${name}#${instanceId}`);
});
```

### Gestión de Dependencias

#### Resolución Automática
```javascript
// Al cargar ChatInterface, automáticamente carga BaseComponent primero
const chatInterface = await componentLoader.loadComponent('ChatInterface', container);
```

#### Dependencias Circulares
```javascript
// El sistema detecta y previene dependencias circulares
componentLoader.registerComponent('ComponentA', {
    path: '/components/ComponentA.js',
    dependencies: ['ComponentB']
});

componentLoader.registerComponent('ComponentB', {
    path: '/components/ComponentB.js',
    dependencies: ['ComponentA'] // Esto generará un error
});
```

### Configuración de Componentes

#### Componente Básico
```javascript
{
    path: '/client/components/basic/BasicComponent.js',
    dependencies: ['BaseComponent'],
    lazy: false, // Cargar inmediatamente
    singleton: false, // Permitir múltiples instancias
    preload: false // No precargar automáticamente
}
```

#### Componente Avanzado
```javascript
{
    path: '/client/components/advanced/AdvancedComponent.js',
    dependencies: ['BaseComponent', 'UtilityComponent'],
    lazy: true,
    singleton: true, // Solo una instancia
    preload: true, // Precargar en inicialización
    timeout: 10000, // Timeout personalizado
    retries: 3, // Reintentos en caso de error
    fallback: 'FallbackComponent' // Componente de respaldo
}
```

### Ejemplo de Uso Completo
```javascript
// Inicializar ComponentLoader
const componentLoader = new ComponentLoader({
    basePath: '/client/components',
    enableCache: true,
    enableLazyLoading: true
});

// Registrar componentes personalizados
componentLoader.registerComponent('CustomDashboard', {
    path: '/client/components/custom/CustomDashboard.js',
    dependencies: ['BaseComponent', 'DashboardManager'],
    lazy: true
});

// Precargar componentes críticos
await componentLoader.preloadAll([
    'BaseComponent',
    'NavigationManager',
    'ChatInterface'
]);

// Cargar componente principal
const navigation = await componentLoader.loadComponent(
    'NavigationManager',
    document.getElementById('sidebar'),
    { collapsible: true }
);

// Cargar componente bajo demanda
document.getElementById('load-chat').addEventListener('click', async () => {
    const chatInterface = await componentLoader.loadComponent(
        'ChatInterface',
        document.getElementById('chat-container'),
        { autoConnect: true }
    );
});

// Escuchar eventos de carga
componentLoader.on('component:loaded', ({ name, loadTime }) => {
    console.log(`✅ ${name} cargado en ${loadTime}ms`);
});

componentLoader.on('component:error', ({ name, error }) => {
    console.error(`❌ Error cargando ${name}:`, error.message);
});

// Obtener estadísticas
setInterval(() => {
    const stats = componentLoader.getStatistics();
    console.log('Estadísticas:', stats);
}, 30000);

// Limpiar al cerrar la aplicación
window.addEventListener('beforeunload', () => {
    componentLoader.destroyAllInstances();
});
```

---

## Conclusión

Este sistema de componentes modulares proporciona una arquitectura escalable y mantenible para aplicaciones web complejas. Cada componente está diseñado para ser:

- **Independiente**: Funciona de manera autónoma
- **Reutilizable**: Puede ser usado en diferentes contextos
- **Configurable**: Acepta opciones personalizadas
- **Extensible**: Puede ser extendido para funcionalidades específicas
- **Testeable**: Fácil de probar de manera aislada

### Beneficios del Sistema

1. **Separación de Responsabilidades**: Cada componente tiene una función específica
2. **Facilidad de Mantenimiento**: Cambios aislados no afectan otros componentes
3. **Reutilización de Código**: Componentes pueden ser reutilizados en diferentes partes
4. **Carga Optimizada**: Sistema de lazy loading mejora el rendimiento
5. **Desarrollo Paralelo**: Diferentes desarrolladores pueden trabajar en componentes separados

### Mejores Prácticas

1. **Siempre extender BaseComponent** para nuevos componentes
2. **Usar eventos** para comunicación entre componentes
3. **Validar datos** antes de procesarlos
4. **Manejar errores** de manera consistente
5. **Documentar configuraciones** y métodos públicos
6. **Implementar cleanup** en el método destroy()
7. **Usar el ComponentLoader** para gestión de dependencias

Para más información sobre implementación y ejemplos avanzados, consulte la documentación técnica completa en el archivo README.md.
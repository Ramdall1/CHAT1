# Menú de Opciones del Input de Chat

## Descripción General
Se ha implementado un menú desplegable en el lado izquierdo del input de mensajes con un botón "+" que permite acceder a las siguientes opciones:

## Características Implementadas

### 1. **Botón de Menú (+)**
- Ubicado en el lado izquierdo del input de mensajes
- Diseño circular con gradiente (púrpura)
- Animaciones suaves al pasar el cursor
- Se abre/cierra al hacer clic

### 2. **Opciones del Menú**

#### 📝 Plantillas
- Abre un modal con todas las plantillas disponibles
- Carga dinámicamente desde `/api/templates`
- Permite seleccionar y enviar plantillas predefinidas
- Interfaz de grid con vista previa de plantillas

#### 🖼️ Imágenes
- Modal para seleccionar imágenes
- Soporta múltiples formatos de imagen (JPG, PNG, GIF, etc.)
- Vista previa de imágenes seleccionadas
- Compatible con WhatsApp (formatos soportados)
- Botón para eliminar imágenes antes de enviar

#### 🎥 Videos
- Modal para seleccionar videos
- Soporta múltiples formatos de video (MP4, WebM, etc.)
- Vista previa con reproductor de video
- Compatible con WhatsApp (máximo 16MB)
- Botón para eliminar videos antes de enviar

#### 📄 Documentos
- Modal para seleccionar documentos
- Formatos soportados: PDF, DOC, DOCX, TXT, XLS, XLSX
- Vista previa con icono del tipo de archivo
- Compatible con WhatsApp
- Botón para eliminar documentos antes de enviar

#### 😊 Emojis
- Modal con grid de emojis
- Más de 80 emojis disponibles
- Al hacer clic, se agrega el emoji al input de mensajes
- Interfaz intuitiva y fácil de usar

## Estilos CSS Agregados

### Clases Principales
- `.input-menu-wrapper` - Contenedor del menú
- `.btn-menu-toggle` - Botón del menú (+)
- `.input-menu` - Menú desplegable
- `.menu-item` - Items del menú
- `.modal` - Modales generales
- `.modal-content` - Contenido del modal
- `.modal-header` - Encabezado del modal
- `.modal-body` - Cuerpo del modal
- `.template-item` - Items de plantillas
- `.preview-item` - Items de vista previa
- `.emoji-button` - Botones de emojis

### Animaciones
- `slideUp` - Animación de entrada del menú
- `fadeIn` - Animación de entrada del modal
- `slideInUp` - Animación de entrada del contenido del modal

## Funciones JavaScript Agregadas

### Métodos Principales
- `bindInputMenuEvents()` - Vincula eventos del menú
- `handleMenuAction(action)` - Maneja las acciones del menú
- `openTemplatesModal()` - Abre modal de plantillas
- `loadTemplates()` - Carga plantillas desde API
- `sendTemplate(template)` - Envía una plantilla
- `openImagesModal()` - Abre modal de imágenes
- `handleImageSelect(e)` - Maneja selección de imágenes
- `sendImage(file)` - Envía una imagen
- `openVideosModal()` - Abre modal de videos
- `handleVideoSelect(e)` - Maneja selección de videos
- `sendVideo(file)` - Envía un video
- `openDocumentsModal()` - Abre modal de documentos
- `handleDocumentSelect(e)` - Maneja selección de documentos
- `sendDocument(file)` - Envía un documento
- `openEmojisModal()` - Abre modal de emojis
- `loadEmojis()` - Carga emojis disponibles
- `getFileIcon(fileType)` - Obtiene icono según tipo de archivo

## Endpoints API Utilizados

- `GET /api/templates` - Obtiene plantillas disponibles
- `POST /api/chat-live/conversations/{id}/messages` - Envía mensajes (texto, imágenes, videos, documentos)

## Compatibilidad con WhatsApp

### Imágenes
- Formatos: JPG, PNG, GIF
- Tamaño máximo: 5MB

### Videos
- Formatos: MP4, WebM
- Tamaño máximo: 16MB
- Duración máxima: 3 minutos

### Documentos
- Formatos: PDF, DOC, DOCX, TXT, XLS, XLSX
- Tamaño máximo: 100MB

### Plantillas
- Texto plano o con variables

## Flujo de Uso

1. **Usuario hace clic en el botón "+"**
   - Se abre el menú desplegable

2. **Usuario selecciona una opción**
   - El menú se cierra
   - Se abre el modal correspondiente

3. **Usuario selecciona un archivo/plantilla/emoji**
   - Se muestra una vista previa
   - Usuario puede confirmar o cancelar

4. **Usuario confirma la acción**
   - Se envía el archivo/plantilla/emoji
   - Se muestra notificación de éxito
   - Se actualiza la conversación

## Mejoras Futuras

- [ ] Búsqueda de plantillas
- [ ] Categorías de emojis
- [ ] Historial de archivos enviados
- [ ] Compresión automática de imágenes
- [ ] Edición de plantillas
- [ ] Plantillas personalizadas por usuario

# Sistema Multimedia Avanzado

## Descripción General

El sistema multimedia avanzado proporciona una solución completa para la gestión, procesamiento y almacenamiento de archivos multimedia en el chatbot. Incluye funcionalidades de validación, seguridad, procesamiento de imágenes y videos, y una API REST completa.

## Características Principales

### 🔒 Seguridad y Validación
- Validación estricta de tipos MIME
- Límites de tamaño por tipo de archivo
- Sanitización de nombres de archivos
- Detección de patrones maliciosos
- Verificación de integridad de archivos

### 📁 Gestión de Archivos
- Almacenamiento organizado por categorías
- Nombres únicos con hash criptográfico
- Metadatos completos de archivos
- Sistema de limpieza automática
- Estadísticas en tiempo real

### 🖼️ Procesamiento de Imágenes
- Redimensionado automático
- Compresión optimizada
- Conversión de formatos
- Generación de miniaturas
- Aplicación de marcas de agua
- Efectos y filtros

### 🎥 Procesamiento de Videos
- Extracción de metadatos
- Información de dimensiones y FPS
- Cálculo de duración
- Optimización de calidad
- Generación de previsualizaciones

## Estructura de Archivos

```
src/
├── routes/
│   └── multimedia.js          # API REST endpoints
├── services/
│   └── MultimediaService.js   # Lógica de negocio
public/
├── multimedia-demo.html       # Página de demostración
└── uploads/                   # Almacenamiento de archivos
    ├── images/               # Imágenes
    ├── videos/               # Videos
    ├── audio/                # Archivos de audio
    └── documents/            # Documentos
```

## API REST Endpoints

### Estado del Sistema
```http
GET /api/multimedia/status
```
Retorna el estado actual del sistema multimedia, incluyendo estadísticas de archivos y espacio en disco.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "status": "active",
    "uploadsDirectory": "/path/to/uploads",
    "diskSpace": {},
    "fileCount": {
      "images": 5,
      "videos": 2,
      "audio": 3,
      "documents": 1
    },
    "totalSize": {
      "images": 1024000,
      "videos": 5120000,
      "audio": 2048000,
      "documents": 512000
    }
  },
  "timestamp": "2025-10-21T02:26:20.350Z"
}
```

### Subida de Imágenes
```http
POST /api/multimedia/upload/image
Content-Type: multipart/form-data
```

**Parámetros:**
- `image`: Archivo de imagen (JPEG, PNG, GIF, WebP)
- `resize` (opcional): Dimensiones para redimensionar (ej: "800x600")
- `quality` (opcional): Calidad de compresión (1-100)
- `format` (opcional): Formato de salida

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "originalName": "imagen.jpg",
    "filename": "images_1234567890_hash.jpg",
    "path": "/uploads/images/images_1234567890_hash.jpg",
    "size": 1024000,
    "mimetype": "image/jpeg",
    "url": "/uploads/images/images_1234567890_hash.jpg",
    "processed": {
      "resized": true,
      "compressed": true,
      "originalSize": 2048000,
      "compressionRatio": 0.5
    }
  },
  "message": "Imagen subida y procesada exitosamente"
}
```

### Subida de Videos
```http
POST /api/multimedia/upload/video
Content-Type: multipart/form-data
```

**Parámetros:**
- `video`: Archivo de video (MP4, AVI, MOV, WMV)
- `quality` (opcional): Calidad de procesamiento

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "originalName": "video.mp4",
    "filename": "videos_1234567890_hash.mp4",
    "path": "/uploads/videos/videos_1234567890_hash.mp4",
    "size": 5120000,
    "mimetype": "video/mp4",
    "url": "/uploads/videos/videos_1234567890_hash.mp4",
    "videoInfo": {
      "duration": 120.5,
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "bitrate": "2000k"
    }
  },
  "message": "Video subido y procesado exitosamente"
}
```

### Subida de Audio
```http
POST /api/multimedia/upload/audio
Content-Type: multipart/form-data
```

**Parámetros:**
- `audio`: Archivo de audio (MP3, WAV, OGG, M4A)

### Subida de Documentos
```http
POST /api/multimedia/upload/document
Content-Type: multipart/form-data
```

**Parámetros:**
- `document`: Archivo de documento (PDF, DOC, DOCX, TXT, etc.)

### Listado de Archivos
```http
GET /api/multimedia/files?type=images&limit=50&offset=0
```

**Parámetros de consulta:**
- `type` (opcional): Filtrar por tipo (images, videos, audio, documents)
- `limit` (opcional): Número máximo de resultados (default: 50)
- `offset` (opcional): Desplazamiento para paginación (default: 0)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "name": "images_1234567890_hash.jpg",
        "type": "images",
        "size": 1024000,
        "created": "2025-10-21T02:26:07.853Z",
        "modified": "2025-10-21T02:26:07.854Z",
        "url": "/uploads/images/images_1234567890_hash.jpg"
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

### Eliminación de Archivos
```http
DELETE /api/multimedia/files/:type/:filename
```

**Parámetros:**
- `type`: Tipo de archivo (images, videos, audio, documents)
- `filename`: Nombre del archivo

### Limpieza de Archivos
```http
POST /api/multimedia/cleanup
Content-Type: application/json
```

**Parámetros:**
- `maxAge` (opcional): Edad máxima en días (default: 30)
- `type` (opcional): Tipo específico a limpiar

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "deletedFiles": 5,
    "freedSpace": 10240000,
    "cutoffDate": "2025-09-21T02:26:32.961Z"
  },
  "message": "Limpieza completada: 5 archivos eliminados"
}
```

## Configuración

### Límites de Archivos
- **Imágenes**: 10MB máximo
- **Videos**: 100MB máximo
- **Audio**: 50MB máximo
- **Documentos**: 25MB máximo

### Tipos de Archivos Permitidos

#### Imágenes
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

#### Videos
- MP4 (.mp4)
- AVI (.avi)
- MOV (.mov)
- WMV (.wmv)

#### Audio
- MP3 (.mp3)
- WAV (.wav)
- OGG (.ogg)
- M4A (.m4a)

#### Documentos
- PDF (.pdf)
- Microsoft Word (.doc, .docx)
- Texto plano (.txt)
- RTF (.rtf)
- OpenDocument (.odt)

## Seguridad

### Validaciones Implementadas
1. **Tipo MIME**: Verificación estricta del tipo de contenido
2. **Extensión**: Validación de extensión de archivo
3. **Tamaño**: Límites específicos por tipo
4. **Nombre**: Sanitización de nombres de archivos
5. **Contenido**: Verificación básica de integridad

### Medidas de Protección
- Nombres de archivos únicos con hash criptográfico
- Almacenamiento en directorios separados por tipo
- Validación de patrones maliciosos
- Límites de velocidad de subida
- Registro de actividad

## Uso en la Interfaz Web

La página de demostración (`/multimedia-demo.html`) proporciona una interfaz completa para:

1. **Subida de Archivos**: Drag & drop o selección manual
2. **Opciones de Procesamiento**: Configuración de calidad, redimensionado, etc.
3. **Previsualización**: Vista previa de archivos subidos
4. **Gestión**: Listado, eliminación y limpieza de archivos
5. **Estadísticas**: Información del sistema en tiempo real

## Integración con el Sistema Principal

El sistema multimedia se integra perfectamente con:

- **Sistema de Mensajería**: Envío de archivos multimedia en conversaciones
- **360Dialog API**: Subida automática a la plataforma de WhatsApp
- **Sistema de Backup**: Inclusión en copias de seguridad automáticas
- **Logs y Monitoreo**: Registro de todas las operaciones
- **Sistema de Seguridad**: Validación y autenticación integrada

## Monitoreo y Mantenimiento

### Logs
Todas las operaciones se registran en el sistema de logs principal con información detallada sobre:
- Subidas de archivos
- Procesamientos realizados
- Errores y excepciones
- Operaciones de limpieza

### Métricas
El sistema proporciona métricas en tiempo real sobre:
- Número de archivos por tipo
- Espacio utilizado
- Operaciones por minuto
- Errores y fallos

### Mantenimiento Automático
- Limpieza automática de archivos antiguos
- Optimización de almacenamiento
- Verificación de integridad
- Generación de reportes

## Ejemplos de Uso

### JavaScript (Frontend)
```javascript
// Subir una imagen con opciones de procesamiento
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('resize', '800x600');
formData.append('quality', '85');

const response = await fetch('/api/multimedia/upload/image', {
    method: 'POST',
    body: formData
});

const result = await response.json();
console.log('Imagen subida:', result.data.url);
```

### cURL
```bash
# Subir una imagen
curl -X POST "http://localhost:3000/api/multimedia/upload/image" \
  -F "image=@imagen.jpg" \
  -F "resize=800x600" \
  -F "quality=85"

# Obtener estadísticas
curl -X GET "http://localhost:3000/api/multimedia/status"

# Limpiar archivos antiguos
curl -X POST "http://localhost:3000/api/multimedia/cleanup" \
  -H "Content-Type: application/json" \
  -d '{"maxAge": 30}'
```

## Solución de Problemas

### Errores Comunes

1. **"Tipo de archivo no permitido"**
   - Verificar que el tipo MIME esté en la lista permitida
   - Comprobar la extensión del archivo

2. **"Archivo demasiado grande"**
   - Verificar los límites de tamaño por tipo
   - Comprimir el archivo antes de subir

3. **"Error de procesamiento"**
   - Verificar que las dependencias (Sharp, FFmpeg) estén instaladas
   - Comprobar los logs para detalles específicos

### Dependencias Requeridas
```bash
npm install sharp fluent-ffmpeg mime-types multer
```

## Roadmap Futuro

### Funcionalidades Planificadas
- [ ] Procesamiento de video avanzado (transcoding)
- [ ] Reconocimiento de contenido con IA
- [ ] Compresión automática inteligente
- [ ] CDN integration
- [ ] Streaming de video
- [ ] Análisis de contenido multimedia
- [ ] Watermarking automático
- [ ] Conversión de formatos en tiempo real

---

*Documentación actualizada: 21 de octubre de 2025*
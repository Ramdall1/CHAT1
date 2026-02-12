/**
 * Renderizador de Media (Imágenes, Videos, Documentos)
 * Muestra correctamente archivos multimedia en los mensajes
 */

class MediaRenderer {
  constructor() {
    this.supportedFormats = {
      image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      video: ['mp4', 'webm', 'ogg'],
      document: ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'],
      audio: ['mp3', 'wav', 'ogg', 'm4a']
    };
  }

  /**
   * Renderizar mensaje con media
   */
  renderMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.direction === 'outbound' ? 'outgoing' : 'incoming'}`;
    messageEl.dataset.messageId = message.id;

    // Contenedor de contenido
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    // Si hay media
    if (message.media_url && message.media_type) {
      const mediaEl = this.renderMedia(message);
      contentEl.appendChild(mediaEl);
    }

    // Texto del mensaje
    if (message.content) {
      const textEl = document.createElement('p');
      textEl.className = 'message-text';
      textEl.textContent = message.content;
      contentEl.appendChild(textEl);
    }

    messageEl.appendChild(contentEl);

    // Footer con hora y status
    const footerEl = document.createElement('div');
    footerEl.className = 'message-footer';

    const timeEl = document.createElement('span');
    timeEl.className = 'message-time';
    timeEl.textContent = this.formatTime(message.sent_at || message.created_at);
    footerEl.appendChild(timeEl);

    if (message.status) {
      const statusEl = document.createElement('span');
      statusEl.className = `message-status status-${message.status}`;
      statusEl.innerHTML = this.getStatusIcon(message.status);
      footerEl.appendChild(statusEl);
    }

    messageEl.appendChild(footerEl);

    return messageEl;
  }

  /**
   * Renderizar media según tipo
   */
  renderMedia(message) {
    const type = message.media_type;
    const url = message.media_url;

    if (type.startsWith('image/')) {
      return this.renderImage(url, message);
    } else if (type.startsWith('video/')) {
      return this.renderVideo(url, message);
    } else if (type.startsWith('audio/')) {
      return this.renderAudio(url, message);
    } else if (type === 'application/pdf' || type.includes('document')) {
      return this.renderDocument(url, message);
    } else {
      return this.renderGenericFile(url, message);
    }
  }

  /**
   * Renderizar imagen
   */
  renderImage(url, message) {
    const container = document.createElement('div');
    container.className = 'media-container image-container';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Imagen del mensaje';
    img.className = 'message-image';
    img.loading = 'lazy';

    // Agregar evento para ver en grande
    img.addEventListener('click', () => this.showImagePreview(url));

    container.appendChild(img);

    return container;
  }

  /**
   * Renderizar video
   */
  renderVideo(url, message) {
    const container = document.createElement('div');
    container.className = 'media-container video-container';

    const video = document.createElement('video');
    video.src = url;
    video.className = 'message-video';
    video.controls = true;
    video.preload = 'metadata';
    video.style.maxWidth = '100%';
    video.style.maxHeight = '300px';
    video.style.borderRadius = '8px';

    container.appendChild(video);

    return container;
  }

  /**
   * Renderizar audio
   */
  renderAudio(url, message) {
    const container = document.createElement('div');
    container.className = 'media-container audio-container';

    const audio = document.createElement('audio');
    audio.src = url;
    audio.className = 'message-audio';
    audio.controls = true;
    audio.style.width = '100%';

    container.appendChild(audio);

    return container;
  }

  /**
   * Renderizar documento
   */
  renderDocument(url, message) {
    const container = document.createElement('div');
    container.className = 'media-container document-container';

    const fileName = url.split('/').pop();
    const fileSize = message.metadata?.fileSize || 'Desconocido';

    const docEl = document.createElement('div');
    docEl.className = 'document-preview';
    docEl.innerHTML = `
      <div class="document-icon">
        <i class="fas fa-file-pdf"></i>
      </div>
      <div class="document-info">
        <p class="document-name">${fileName}</p>
        <p class="document-size">${this.formatFileSize(fileSize)}</p>
      </div>
      <a href="${url}" download class="document-download" title="Descargar">
        <i class="fas fa-download"></i>
      </a>
    `;

    container.appendChild(docEl);

    return container;
  }

  /**
   * Renderizar archivo genérico
   */
  renderGenericFile(url, message) {
    const container = document.createElement('div');
    container.className = 'media-container file-container';

    const fileName = url.split('/').pop();
    const fileSize = message.metadata?.fileSize || 'Desconocido';

    const fileEl = document.createElement('div');
    fileEl.className = 'file-preview';
    fileEl.innerHTML = `
      <div class="file-icon">
        <i class="fas fa-file"></i>
      </div>
      <div class="file-info">
        <p class="file-name">${fileName}</p>
        <p class="file-size">${this.formatFileSize(fileSize)}</p>
      </div>
      <a href="${url}" download class="file-download" title="Descargar">
        <i class="fas fa-download"></i>
      </a>
    `;

    container.appendChild(fileEl);

    return container;
  }

  /**
   * Mostrar preview de imagen
   */
  showImagePreview(url) {
    const previewHTML = `
      <div class="image-preview-modal">
        <div class="image-preview-container">
          <button class="image-preview-close" id="previewClose">
            <i class="fas fa-times"></i>
          </button>
          <img src="${url}" alt="Preview" class="image-preview-full">
          <a href="${url}" download class="image-preview-download">
            <i class="fas fa-download"></i> Descargar
          </a>
        </div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.innerHTML = previewHTML;
    document.body.appendChild(modal);

    document.getElementById('previewClose').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Obtener icono de status
   */
  getStatusIcon(status) {
    switch (status) {
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓';
      case 'failed':
        return '✗';
      default:
        return '⏱';
    }
  }

  /**
   * Formatear hora
   */
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
  }

  /**
   * Formatear tamaño de archivo
   */
  formatFileSize(bytes) {
    if (typeof bytes === 'string') return bytes;
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Crear instancia global
window.mediaRenderer = new MediaRenderer();

export default MediaRenderer;

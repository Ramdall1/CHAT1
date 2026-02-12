/**
 * Menú de Opciones para Envío de Mensajes
 * Emoji, Plantillas, Documentos, Imágenes, Videos
 */

class MessageInputMenu {
  constructor() {
    this.isOpen = false;
    this.selectedFile = null;
    
    // Límites de WhatsApp
    this.limits = {
      image: {
        maxSize: 16 * 1024 * 1024,  // 16 MB
        formats: ['image/jpeg', 'image/png'],
        extensions: ['.jpg', '.jpeg', '.png']
      },
      video: {
        maxSize: 16 * 1024 * 1024,  // 16 MB
        formats: ['video/mp4'],
        extensions: ['.mp4']
      },
      document: {
        maxSize: 100 * 1024 * 1024,  // 100 MB
        formats: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        extensions: ['.pdf', '.doc', '.docx']
      },
      audio: {
        maxSize: 16 * 1024 * 1024,  // 16 MB
        formats: ['audio/mpeg', 'audio/ogg'],
        extensions: ['.mp3', '.ogg']
      }
    };
  }

  /**
   * Inicializar el menú
   */
  init() {
    this.createMenuHTML();
    this.attachEventListeners();
  }

  /**
   * Crear HTML del menú
   */
  createMenuHTML() {
    const menuHTML = `
      <div class="message-input-menu">
        <button class="menu-toggle-btn" id="menuToggleBtn" title="Agregar contenido">
          <i class="fas fa-plus"></i>
        </button>
        
        <div class="menu-options" id="menuOptions">
          <button class="menu-option emoji-option" id="emojiBtn" title="Emoji">
            <i class="fas fa-smile"></i>
            <span>Emoji</span>
          </button>
          
          <button class="menu-option template-option" id="templateBtn" title="Plantilla">
            <i class="fas fa-file-alt"></i>
            <span>Plantilla</span>
          </button>
          
          <button class="menu-option image-option" id="imageBtn" title="Imagen">
            <i class="fas fa-image"></i>
            <span>Imagen</span>
          </button>
          
          <button class="menu-option video-option" id="videoBtn" title="Video">
            <i class="fas fa-video"></i>
            <span>Video</span>
          </button>
          
          <button class="menu-option document-option" id="documentBtn" title="Documento">
            <i class="fas fa-file"></i>
            <span>Documento</span>
          </button>
        </div>
        
        <!-- Input oculto para archivos -->
        <input type="file" id="imageInput" accept=".jpg,.jpeg,.png" style="display: none;">
        <input type="file" id="videoInput" accept=".mp4" style="display: none;">
        <input type="file" id="documentInput" accept=".pdf,.doc,.docx" style="display: none;">
      </div>
    `;

    // Buscar el contenedor del input de mensajes
    const messageInputContainer = document.querySelector('.message-input-container') || 
                                  document.querySelector('.chat-input-area') ||
                                  document.querySelector('[data-role="message-input"]');

    if (messageInputContainer) {
      messageInputContainer.insertAdjacentHTML('beforeend', menuHTML);
    }
  }

  /**
   * Adjuntar event listeners
   */
  attachEventListeners() {
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const menuOptions = document.getElementById('menuOptions');
    
    if (menuToggleBtn) {
      menuToggleBtn.addEventListener('click', () => this.toggleMenu());
    }

    // Emoji
    document.getElementById('emojiBtn')?.addEventListener('click', () => this.openEmojiPicker());

    // Plantilla
    document.getElementById('templateBtn')?.addEventListener('click', () => this.openTemplateSelector());

    // Imagen
    document.getElementById('imageBtn')?.addEventListener('click', () => {
      document.getElementById('imageInput').click();
    });
    document.getElementById('imageInput')?.addEventListener('change', (e) => this.handleImageSelect(e));

    // Video
    document.getElementById('videoBtn')?.addEventListener('click', () => {
      document.getElementById('videoInput').click();
    });
    document.getElementById('videoInput')?.addEventListener('change', (e) => this.handleVideoSelect(e));

    // Documento
    document.getElementById('documentBtn')?.addEventListener('click', () => {
      document.getElementById('documentInput').click();
    });
    document.getElementById('documentInput')?.addEventListener('change', (e) => this.handleDocumentSelect(e));

    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.message-input-menu')) {
        this.closeMenu();
      }
    });
  }

  /**
   * Alternar menú
   */
  toggleMenu() {
    if (this.isOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  /**
   * Abrir menú
   */
  openMenu() {
    const menuOptions = document.getElementById('menuOptions');
    if (menuOptions) {
      menuOptions.classList.add('active');
      this.isOpen = true;
    }
  }

  /**
   * Cerrar menú
   */
  closeMenu() {
    const menuOptions = document.getElementById('menuOptions');
    if (menuOptions) {
      menuOptions.classList.remove('active');
      this.isOpen = false;
    }
  }

  /**
   * Abrir selector de emoji
   */
  openEmojiPicker() {
    const emojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👏', '🎉', '🎊', '❤️', '💯'];
    
    const emojiHTML = `
      <div class="emoji-picker">
        <div class="emoji-grid">
          ${emojis.map(emoji => `
            <button class="emoji-btn" data-emoji="${emoji}">${emoji}</button>
          `).join('')}
        </div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'emoji-modal';
    modal.innerHTML = emojiHTML;
    document.body.appendChild(modal);

    document.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emoji = e.target.dataset.emoji;
        this.insertEmojiToInput(emoji);
        modal.remove();
        this.closeMenu();
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Insertar emoji en el input
   */
  insertEmojiToInput(emoji) {
    const input = document.querySelector('[data-role="message-input"]') ||
                  document.querySelector('.message-input') ||
                  document.querySelector('textarea[name="message"]');
    
    if (input) {
      input.value += emoji;
      input.focus();
    }
  }

  /**
   * Abrir selector de plantillas
   */
  openTemplateSelector() {
    // Aquí iría la lógica para mostrar plantillas disponibles
    console.log('Abriendo selector de plantillas');
    // TODO: Implementar selector de plantillas
  }

  /**
   * Manejar selección de imagen
   */
  handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!this.validateFile(file, 'image')) {
      return;
    }

    this.sendMediaMessage(file, 'image');
    this.closeMenu();
  }

  /**
   * Manejar selección de video
   */
  handleVideoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!this.validateFile(file, 'video')) {
      return;
    }

    this.sendMediaMessage(file, 'video');
    this.closeMenu();
  }

  /**
   * Manejar selección de documento
   */
  handleDocumentSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!this.validateFile(file, 'document')) {
      return;
    }

    this.sendMediaMessage(file, 'document');
    this.closeMenu();
  }

  /**
   * Validar archivo según límites de WhatsApp
   */
  validateFile(file, type) {
    const limit = this.limits[type];

    // Validar tamaño
    if (file.size > limit.maxSize) {
      const maxSizeMB = limit.maxSize / (1024 * 1024);
      alert(`❌ El archivo es muy grande. Máximo: ${maxSizeMB}MB`);
      return false;
    }

    // Validar formato
    if (!limit.formats.includes(file.type)) {
      alert(`❌ Formato no permitido. Formatos válidos: ${limit.extensions.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Enviar mensaje con media
   */
  async sendMediaMessage(file, type) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('phone', this.getCurrentPhone());

      const response = await fetch('/api/messages/send-media', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ ${type.toUpperCase()} enviado correctamente`);
        // Actualizar UI con el mensaje enviado
      } else {
        alert(`❌ Error enviando ${type}: ${data.error}`);
      }
    } catch (error) {
      console.error(`Error enviando ${type}:`, error);
      alert(`❌ Error enviando ${type}`);
    }
  }

  /**
   * Obtener teléfono actual
   */
  getCurrentPhone() {
    // Obtener desde el contexto global o del DOM
    return window.currentPhone || document.querySelector('[data-phone]')?.dataset.phone || '';
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.messageInputMenu = new MessageInputMenu();
  window.messageInputMenu.init();
});

export default MessageInputMenu;

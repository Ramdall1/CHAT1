/**
 * Interfaz de Chat Mejorada
 * Componente principal para la gestión de conversaciones
 */
class EnhancedChatInterface {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = null;
    this.isInitialized = false;
    
    // Opciones por defecto
    this.options = {
      enableVoiceMessages: true,
      enableFileUpload: true,
      enableEmojis: true,
      enableTypingIndicator: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', '.doc', '.docx'],
      ...options
    };

    // Estado del componente
    this.state = {
      activeConversation: null,
      conversations: [],
      contacts: [],
      messages: {},
      isTyping: false,
      typingUsers: new Set(),
      searchQuery: '',
      selectedMessages: new Set(),
      isRecording: false,
      mediaRecorder: null
    };

    // Referencias a elementos DOM
    this.elements = {};
    
    // Event listeners
    this.eventListeners = [];
    
    this.init();
  }

  /**
   * Inicializa el componente
   */
  async init() {
    try {
      this.container = document.getElementById(this.containerId);
      if (!this.container) {
        throw new Error(`Contenedor ${this.containerId} no encontrado`);
      }

      await this.render();
      await this.bindEvents();
      await this.loadData();
      await this.setupWebSocket();
      
      this.isInitialized = true;
      this.onInitialized();
    } catch (error) {
      console.error('Error inicializando EnhancedChatInterface:', error);
      this.onError(error);
    }
  }

  /**
   * Renderiza la interfaz
   */
  async render() {
    this.container.innerHTML = this.getTemplate();
    this.cacheElements();
    this.setupDragAndDrop();
  }

  /**
   * Obtiene el template HTML
   */
  getTemplate() {
    return `
      <div class="enhanced-chat-interface">
        <!-- Sidebar de conversaciones -->
        <div class="chat-sidebar">
          <div class="chat-header">
            <h3>Conversaciones</h3>
            <div class="chat-actions">
              <button class="btn-icon" id="newChatBtn" title="Nueva conversación">
                <i class="fas fa-plus"></i>
              </button>
              <button class="btn-icon" id="searchToggleBtn" title="Buscar">
                <i class="fas fa-search"></i>
              </button>
            </div>
          </div>
          
          <div class="search-container" id="searchContainer" style="display: none;">
            <input type="text" id="searchInput" placeholder="Buscar conversaciones..." class="search-input">
          </div>
          
          <div class="conversations-list" id="conversationsList">
            <div class="loading-conversations">
              <div class="spinner"></div>
              <p>Cargando conversaciones...</p>
            </div>
          </div>
        </div>

        <!-- Área principal del chat -->
        <div class="chat-main">
          <div class="chat-conversation" id="chatConversation">
            <div class="no-conversation-selected">
              <div class="no-conversation-icon">💬</div>
              <h3>Selecciona una conversación</h3>
              <p>Elige una conversación de la lista para comenzar a chatear</p>
            </div>
          </div>
        </div>

        <!-- Panel de información del contacto -->
        <div class="chat-info-panel" id="chatInfoPanel" style="display: none;">
          <div class="info-header">
            <h4>Información del contacto</h4>
            <button class="btn-icon" id="closeInfoBtn">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="info-content" id="infoContent">
            <!-- Contenido dinámico -->
          </div>
        </div>
      </div>

      <!-- Modales -->
      <div class="modal" id="filePreviewModal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h4>Vista previa del archivo</h4>
            <button class="btn-close" id="closeFilePreviewBtn">&times;</button>
          </div>
          <div class="modal-body" id="filePreviewContent">
            <!-- Contenido dinámico -->
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancelFileBtn">Cancelar</button>
            <button class="btn btn-primary" id="sendFileBtn">Enviar</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Cachea referencias a elementos DOM
   */
  cacheElements() {
    this.elements = {
      sidebar: this.container.querySelector('.chat-sidebar'),
      conversationsList: this.container.querySelector('#conversationsList'),
      searchContainer: this.container.querySelector('#searchContainer'),
      searchInput: this.container.querySelector('#searchInput'),
      chatMain: this.container.querySelector('.chat-main'),
      chatConversation: this.container.querySelector('#chatConversation'),
      infoPanel: this.container.querySelector('#chatInfoPanel'),
      infoContent: this.container.querySelector('#infoContent'),
      filePreviewModal: this.container.querySelector('#filePreviewModal'),
      filePreviewContent: this.container.querySelector('#filePreviewContent')
    };
  }

  /**
   * Vincula eventos
   */
  async bindEvents() {
    // Botones de la interfaz
    this.addEventListener('#newChatBtn', 'click', this.onNewChat.bind(this));
    this.addEventListener('#searchToggleBtn', 'click', this.toggleSearch.bind(this));
    this.addEventListener('#searchInput', 'input', this.onSearchInput.bind(this));
    this.addEventListener('#closeInfoBtn', 'click', this.closeInfoPanel.bind(this));
    this.addEventListener('#closeFilePreviewBtn', 'click', this.closeFilePreview.bind(this));
    this.addEventListener('#cancelFileBtn', 'click', this.closeFilePreview.bind(this));
    this.addEventListener('#sendFileBtn', 'click', this.sendSelectedFile.bind(this));

    // Eventos globales
    this.addEventListener(window, 'resize', this.onResize.bind(this));
    this.addEventListener(document, 'keydown', this.onKeyDown.bind(this));
  }

  /**
   * Configura drag and drop para archivos
   */
  setupDragAndDrop() {
    const dropZone = this.elements.chatMain;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, this.preventDefaults.bind(this), false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, this.highlight.bind(this), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, this.unhighlight.bind(this), false);
    });

    dropZone.addEventListener('drop', this.handleDrop.bind(this), false);
  }

  /**
   * Carga datos iniciales
   */
  async loadData() {
    try {
      this.showLoading('Cargando conversaciones...');
      
      // Cargar conversaciones y contactos
      const [conversations, contacts] = await Promise.all([
        this.loadConversations(),
        this.loadContacts()
      ]);

      this.state.conversations = conversations;
      this.state.contacts = contacts;
      
      this.renderConversationsList();
      this.hideLoading();
      
    } catch (error) {
      console.error('Error cargando datos:', error);
      this.showError('Error cargando conversaciones');
    }
  }

  /**
   * Carga conversaciones desde la API
   */
  async loadConversations() {
    if (window.ApiService) {
      return await window.ApiService.getConversations();
    }
    return [];
  }

  /**
   * Carga contactos desde la API
   */
  async loadContacts() {
    if (window.ApiService) {
      return await window.ApiService.getContacts();
    }
    return [];
  }

  /**
   * Configura WebSocket
   */
  async setupWebSocket() {
    if (window.ApiService) {
      window.ApiService.on('message:received', this.onMessageReceived.bind(this));
      window.ApiService.on('conversation:updated', this.onConversationUpdated.bind(this));
      window.ApiService.on('typing:start', this.onTypingStart.bind(this));
      window.ApiService.on('typing:stop', this.onTypingStop.bind(this));
      window.ApiService.on('connection:established', this.onConnectionEstablished.bind(this));
      window.ApiService.on('connection:lost', this.onConnectionLost.bind(this));
    }
  }

  /**
   * Renderiza la lista de conversaciones
   */
  renderConversationsList() {
    const filteredConversations = this.filterConversations();
    
    if (filteredConversations.length === 0) {
      this.elements.conversationsList.innerHTML = `
        <div class="no-conversations">
          <p>No hay conversaciones</p>
          <button class="btn btn-primary" id="startNewChatBtn">Iniciar nueva conversación</button>
        </div>
      `;
      return;
    }

    const conversationsHtml = filteredConversations.map(conversation => 
      this.getConversationItemTemplate(conversation)
    ).join('');

    this.elements.conversationsList.innerHTML = conversationsHtml;
    
    // Vincular eventos de conversaciones
    this.elements.conversationsList.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const conversationId = item.dataset.conversationId;
        this.selectConversation(conversationId);
      });
    });
  }

  /**
   * Template para item de conversación
   */
  getConversationItemTemplate(conversation) {
    const contact = this.getContactById(conversation.contact_id);
    const lastMessage = conversation.last_message || {};
    const unreadCount = conversation.unread_count || 0;
    const isActive = this.state.activeConversation === conversation.id;

    return `
      <div class="conversation-item ${isActive ? 'active' : ''}" data-conversation-id="${conversation.id}">
        <div class="conversation-avatar">
          <img src="${contact?.avatar || '/images/default-avatar.png'}" alt="${contact?.name || contact?.phone}">
          ${conversation.is_online ? '<div class="online-indicator"></div>' : ''}
        </div>
        <div class="conversation-content">
          <div class="conversation-header">
            <h4 class="conversation-name">${contact?.name || contact?.phone || 'Desconocido'}</h4>
            <span class="conversation-time">${this.formatTime(lastMessage.timestamp)}</span>
          </div>
          <div class="conversation-preview">
            <p class="last-message">${this.formatLastMessage(lastMessage)}</p>
            ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza la conversación activa
   */
  renderActiveConversation() {
    if (!this.state.activeConversation) {
      this.elements.chatConversation.innerHTML = `
        <div class="no-conversation-selected">
          <div class="no-conversation-icon">💬</div>
          <h3>Selecciona una conversación</h3>
          <p>Elige una conversación de la lista para comenzar a chatear</p>
        </div>
      `;
      return;
    }

    const conversation = this.getConversationById(this.state.activeConversation);
    const contact = this.getContactById(conversation?.contact_id);
    const messages = this.state.messages[this.state.activeConversation] || [];

    this.elements.chatConversation.innerHTML = `
      <div class="conversation-header">
        <div class="contact-info">
          <img src="${contact?.avatar || '/images/default-avatar.png'}" alt="${contact?.name}" class="contact-avatar">
          <div class="contact-details">
            <h4>${contact?.name || contact?.phone || 'Desconocido'}</h4>
            <span class="contact-status">${conversation?.is_online ? 'En línea' : 'Desconectado'}</span>
          </div>
        </div>
        <div class="conversation-actions">
          <button class="btn-icon" id="infoToggleBtn" title="Información del contacto">
            <i class="fas fa-info-circle"></i>
          </button>
          <button class="btn-icon" id="callBtn" title="Llamar">
            <i class="fas fa-phone"></i>
          </button>
          <button class="btn-icon" id="videoCallBtn" title="Videollamada">
            <i class="fas fa-video"></i>
          </button>
        </div>
      </div>
      
      <div class="messages-container" id="messagesContainer">
        ${this.renderMessages(messages)}
      </div>
      
      <div class="typing-indicator" id="typingIndicator" style="display: none;">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="typing-text">Escribiendo...</span>
      </div>
      
      <div class="message-input-container">
        ${this.getMessageInputTemplate()}
      </div>
    `;

    // Vincular eventos específicos de la conversación
    this.bindConversationEvents();
    this.scrollToBottom();
  }

  /**
   * Template para el input de mensajes
   */
  getMessageInputTemplate() {
    return `
      <div class="message-input-wrapper">
        <div class="input-actions-left">
          <button class="btn-icon" id="attachBtn" title="Adjuntar archivo">
            <i class="fas fa-paperclip"></i>
          </button>
          <button class="btn-icon" id="emojiBtn" title="Emojis">
            <i class="fas fa-smile"></i>
          </button>
        </div>
        
        <div class="message-input-area">
          <textarea id="messageInput" placeholder="Escribe un mensaje..." rows="1"></textarea>
        </div>
        
        <div class="input-actions-right">
          <button class="btn-icon" id="voiceBtn" title="Mensaje de voz">
            <i class="fas fa-microphone"></i>
          </button>
          <button class="btn-icon btn-primary" id="sendBtn" title="Enviar">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
      
      <input type="file" id="fileInput" style="display: none;" multiple 
             accept="${this.options.allowedFileTypes.join(',')}">
    `;
  }

  // Métodos de utilidad y eventos...
  
  /**
   * Agrega un event listener y lo registra
   */
  addEventListener(selector, event, handler) {
    const element = typeof selector === 'string' ? 
      this.container.querySelector(selector) : selector;
    
    if (element) {
      element.addEventListener(event, handler);
      this.eventListeners.push({ element, event, handler });
    }
  }

  /**
   * Obtiene una conversación por ID
   */
  getConversationById(id) {
    return this.state.conversations.find(conv => conv.id === id);
  }

  /**
   * Obtiene un contacto por ID
   */
  getContactById(id) {
    return this.state.contacts.find(contact => contact.id === id);
  }

  /**
   * Filtra conversaciones según la búsqueda
   */
  filterConversations() {
    if (!this.state.searchQuery) {
      return this.state.conversations;
    }

    const query = this.state.searchQuery.toLowerCase();
    return this.state.conversations.filter(conversation => {
      const contact = this.getContactById(conversation.contact_id);
      const name = contact?.name?.toLowerCase() || '';
      const phone = contact?.phone?.toLowerCase() || '';
      return name.includes(query) || phone.includes(query);
    });
  }

  /**
   * Formatea el tiempo
   */
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  }

  /**
   * Formatea el último mensaje
   */
  formatLastMessage(message) {
    if (!message.content) return 'Sin mensajes';
    
    if (message.type === 'image') return '📷 Imagen';
    if (message.type === 'video') return '🎥 Video';
    if (message.type === 'audio') return '🎵 Audio';
    if (message.type === 'file') return '📎 Archivo';
    
    return message.content.length > 50 ? 
      message.content.substring(0, 50) + '...' : 
      message.content;
  }

  // Eventos de la interfaz
  onNewChat() {
    // Implementar nueva conversación
    console.log('Nueva conversación');
  }

  toggleSearch() {
    const isVisible = this.elements.searchContainer.style.display !== 'none';
    this.elements.searchContainer.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      this.elements.searchInput.focus();
    } else {
      this.elements.searchInput.value = '';
      this.state.searchQuery = '';
      this.renderConversationsList();
    }
  }

  onSearchInput(event) {
    this.state.searchQuery = event.target.value;
    this.renderConversationsList();
  }

  selectConversation(conversationId) {
    this.state.activeConversation = conversationId;
    this.renderConversationsList(); // Para actualizar el estado activo
    this.renderActiveConversation();
    this.loadMessages(conversationId);
  }

  // Eventos WebSocket
  onMessageReceived(data) {
    // Implementar recepción de mensajes
    console.log('Mensaje recibido:', data);
  }

  onConversationUpdated(data) {
    // Implementar actualización de conversación
    console.log('Conversación actualizada:', data);
  }

  // Métodos de utilidad para drag and drop
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  highlight(e) {
    this.elements.chatMain.classList.add('drag-over');
  }

  unhighlight(e) {
    this.elements.chatMain.classList.remove('drag-over');
  }

  handleDrop(e) {
    const files = e.dataTransfer.files;
    this.handleFiles(files);
  }

  // Métodos de ciclo de vida
  onInitialized() {
    console.log('EnhancedChatInterface inicializado');
  }

  onError(error) {
    console.error('Error en EnhancedChatInterface:', error);
  }

  showLoading(message) {
    // Implementar indicador de carga
  }

  hideLoading() {
    // Ocultar indicador de carga
  }

  showError(message) {
    // Mostrar mensaje de error
  }

  /**
   * Destruye el componente
   */
  destroy() {
    // Limpiar event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Limpiar WebSocket listeners
    if (window.ApiService) {
      window.ApiService.off('message:received', this.onMessageReceived);
      window.ApiService.off('conversation:updated', this.onConversationUpdated);
    }

    // Limpiar contenedor
    if (this.container) {
      this.container.innerHTML = '';
    }

    this.isInitialized = false;
  }
}

export default EnhancedChatInterface;
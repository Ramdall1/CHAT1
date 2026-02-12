/**
 * Componente de interfaz de chat
 * Maneja la visualización y interacción del chat en tiempo real
 */
class ChatInterface extends BaseComponent {
  getDefaultOptions() {
    return {
      ...super.getDefaultOptions(),
      autoRefresh: true,
      refreshInterval: 5000,
      maxMessages: 100,
      enableTyping: true,
      enableRead: true,
    };
  }

  async beforeInit() {
    this.socket = window.io ? window.io() : null;
    this.currentPhone = null;
    this.messages = [];
    this.conversations = [];
    this.isTyping = false;
    this.refreshTimer = null;

    this.state = {
      connected: false,
      loading: false,
      selectedConversation: null,
      unreadCount: 0,
    };
  }

  getTemplate() {
    return `
      <div class="chat-interface">
        <div class="chat-sidebar">
          <div class="chat-header">
            <h3>Conversaciones</h3>
            <button class="btn-refresh" id="refreshInbox">
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
          <div class="conversation-search">
            <input type="text" id="conversationSearch" placeholder="Buscar conversaciones..." />
          </div>
          <div class="conversation-list" id="conversationList">
            <div class="loading-conversations">
              <i class="fas fa-spinner fa-spin"></i>
              <span>Cargando conversaciones...</span>
            </div>
          </div>
        </div>
        
        <div class="chat-main">
          <div class="chat-header" id="chatHeader">
            <div class="chat-title" id="chatTitle">
              Selecciona una conversación
            </div>
            <div class="chat-status" id="chatStatus">
              <span class="status-indicator ${this.state.connected ? 'connected' : 'disconnected'}"></span>
              <span class="status-text">${this.state.connected ? 'Conectado' : 'Desconectado'}</span>
            </div>
          </div>
          
          <div class="messages-container" id="messagesContainer">
            <div class="messages-list" id="messagesList">
              <div class="no-conversation">
                <i class="fas fa-comments"></i>
                <p>Selecciona una conversación para comenzar</p>
              </div>
            </div>
            <div class="typing-indicator" id="typingIndicator" style="display: none;">
              <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span class="typing-text">Escribiendo...</span>
            </div>
          </div>
          
          <div class="message-composer" id="messageComposer">
            <div class="composer-input">
              <textarea 
                id="messageInput" 
                placeholder="Escribe tu mensaje..." 
                rows="1"
                disabled
              ></textarea>
              <button id="sendMessage" class="btn-send" disabled>
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
            <div class="composer-actions">
              <button class="btn-action" id="attachFile" title="Adjuntar archivo">
                <i class="fas fa-paperclip"></i>
              </button>
              <button class="btn-action" id="sendTemplate" title="Enviar plantilla">
                <i class="fas fa-file-alt"></i>
              </button>
              <button class="btn-action" id="sendFlow" title="Iniciar flujo">
                <i class="fas fa-sitemap"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.elements = {
      conversationList: this.container.querySelector('#conversationList'),
      conversationSearch: this.container.querySelector('#conversationSearch'),
      refreshBtn: this.container.querySelector('#refreshInbox'),
      chatTitle: this.container.querySelector('#chatTitle'),
      chatStatus: this.container.querySelector('#chatStatus'),
      messagesList: this.container.querySelector('#messagesList'),
      messagesContainer: this.container.querySelector('#messagesContainer'),
      messageInput: this.container.querySelector('#messageInput'),
      sendBtn: this.container.querySelector('#sendMessage'),
      typingIndicator: this.container.querySelector('#typingIndicator'),
      attachBtn: this.container.querySelector('#attachFile'),
      templateBtn: this.container.querySelector('#sendTemplate'),
      flowBtn: this.container.querySelector('#sendFlow'),
    };
  }

  bindEvents() {
    // Eventos de UI
    this.addEventListener(
      this.elements.refreshBtn,
      'click',
      this.refreshConversations
    );
    this.addEventListener(
      this.elements.conversationSearch,
      'input',
      this.filterConversations
    );
    this.addEventListener(
      this.elements.messageInput,
      'keydown',
      this.handleMessageInput
    );
    this.addEventListener(
      this.elements.messageInput,
      'input',
      this.handleTyping
    );
    this.addEventListener(this.elements.sendBtn, 'click', this.sendMessage);
    this.addEventListener(
      this.elements.attachBtn,
      'click',
      this.handleAttachment
    );
    this.addEventListener(
      this.elements.templateBtn,
      'click',
      this.openTemplateModal
    );
    this.addEventListener(this.elements.flowBtn, 'click', this.openFlowModal);

    // Eventos de Socket.IO
    if (this.socket) {
      this.socket.on('connect', () => this.handleSocketConnect());
      this.socket.on('disconnect', () => this.handleSocketDisconnect());
      this.socket.on('message', data => this.handleNewMessage(data));
      this.socket.on('typing', data => this.handleTypingIndicator(data));
      this.socket.on('conversation_updated', data =>
        this.handleConversationUpdate(data)
      );
    }

    // Auto-refresh
    if (this.options.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  async afterInit() {
    await this.loadConversations();
  }

  // Métodos de Socket.IO
  handleSocketConnect() {
    this.setState({ connected: true });
    this.updateConnectionStatus();
    this.showToast('Conectado al servidor', 'success');
  }

  handleSocketDisconnect() {
    this.setState({ connected: false });
    this.updateConnectionStatus();
    this.showToast('Desconectado del servidor', 'warning');
  }

  handleNewMessage(data) {
    if (data.phone === this.currentPhone) {
      this.addMessageToChat(data);
    }
    this.updateConversationPreview(data);
    this.playNotificationSound();
  }

  handleTypingIndicator(data) {
    if (data.phone === this.currentPhone && this.options.enableTyping) {
      this.showTypingIndicator(data.isTyping);
    }
  }

  handleConversationUpdate(data) {
    this.updateConversationInList(data);
  }

  // Métodos de conversaciones
  async loadConversations() {
    this.setState({ loading: true });

    try {
      const response = await this.request('/api/conversations');
      this.conversations = response.conversations || [];
      this.renderConversations();
    } catch (error) {
      console.error('Error loading conversations:', error);
      this.showToast('Error al cargar conversaciones', 'error');
    } finally {
      this.setState({ loading: false });
    }
  }

  async refreshConversations() {
    await this.loadConversations();
    this.showToast('Conversaciones actualizadas', 'success');
  }

  renderConversations() {
    if (this.conversations.length === 0) {
      this.elements.conversationList.innerHTML = `
        <div class="no-conversations">
          <i class="fas fa-inbox"></i>
          <p>No hay conversaciones</p>
        </div>
      `;
      return;
    }

    const html = this.conversations
      .map(conv => this.getConversationHTML(conv))
      .join('');
    this.elements.conversationList.innerHTML = html;

    // Bind click events for conversations
    this.elements.conversationList
      .querySelectorAll('.conversation-item')
      .forEach(item => {
        this.addEventListener(item, 'click', () => {
          const phone = item.dataset.phone;
          this.selectConversation(phone);
        });
      });
  }

  getConversationHTML(conversation) {
    const isSelected = conversation.phone === this.currentPhone;
    const unreadClass = conversation.unread > 0 ? 'unread' : '';
    const selectedClass = isSelected ? 'selected' : '';

    return `
      <div class="conversation-item ${unreadClass} ${selectedClass}" data-phone="${conversation.phone}">
        <div class="conversation-avatar">
          <img src="${conversation.avatar || '/images/default-avatar.png'}" alt="${conversation.name}" />
          ${conversation.online ? '<span class="online-indicator"></span>' : ''}
        </div>
        <div class="conversation-content">
          <div class="conversation-header">
            <h4 class="conversation-name">${conversation.name || conversation.phone}</h4>
            <span class="conversation-time">${this.formatTime(conversation.lastMessageTime)}</span>
          </div>
          <div class="conversation-preview">
            <p class="last-message">${conversation.lastMessage || 'Sin mensajes'}</p>
            ${conversation.unread > 0 ? `<span class="unread-badge">${conversation.unread}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  filterConversations() {
    const query = this.elements.conversationSearch.value.toLowerCase();
    const items =
      this.elements.conversationList.querySelectorAll('.conversation-item');

    items.forEach(item => {
      const name = item
        .querySelector('.conversation-name')
        .textContent.toLowerCase();
      const phone = item.dataset.phone.toLowerCase();
      const visible = name.includes(query) || phone.includes(query);
      item.style.display = visible ? 'flex' : 'none';
    });
  }

  async selectConversation(phone) {
    if (this.currentPhone === phone) return;

    this.currentPhone = phone;
    this.setState({ selectedConversation: phone });

    // Update UI
    this.updateSelectedConversation();
    this.enableMessageInput();

    // Load messages
    await this.loadMessages(phone);

    // Mark as read
    if (this.options.enableRead) {
      this.markAsRead(phone);
    }
  }

  updateSelectedConversation() {
    // Remove previous selection
    this.elements.conversationList
      .querySelectorAll('.conversation-item')
      .forEach(item => {
        item.classList.remove('selected');
      });

    // Add selection to current
    const selectedItem = this.elements.conversationList.querySelector(
      `[data-phone="${this.currentPhone}"]`
    );
    if (selectedItem) {
      selectedItem.classList.add('selected');

      const conversation = this.conversations.find(
        c => c.phone === this.currentPhone
      );
      if (conversation) {
        this.elements.chatTitle.textContent =
          conversation.name || conversation.phone;
      }
    }
  }

  // Métodos de mensajes
  async loadMessages(phone) {
    try {
      const response = await this.request(
        `/api/conversations/${phone}/messages`
      );
      // Validación robusta para asegurar que this.messages sea siempre un array
      if (response && Array.isArray(response.messages)) {
        this.messages = response.messages;
      } else if (response && response.messages) {
        // Si response.messages existe pero no es un array, intentar convertirlo
        this.messages = Array.isArray(response.messages) ? response.messages : [];
      } else {
        // Si no hay response o response.messages, usar array vacío
        this.messages = [];
      }
      this.renderMessages();
      this.scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
      this.showToast('Error al cargar mensajes', 'error');
      // Asegurar que this.messages sea un array incluso en caso de error
      this.messages = [];
    }
  }

  renderMessages() {
    // Validación adicional para asegurar que this.messages sea un array
    if (!Array.isArray(this.messages)) {
      console.warn('this.messages no es un array, inicializando como array vacío');
      this.messages = [];
    }

    if (this.messages.length === 0) {
      this.elements.messagesList.innerHTML = `
        <div class="no-messages">
          <i class="fas fa-comment"></i>
          <p>No hay mensajes en esta conversación</p>
        </div>
      `;
      return;
    }

    const html = this.messages.map(msg => this.getMessageHTML(msg)).join('');
    this.elements.messagesList.innerHTML = html;
  }

  getMessageHTML(message) {
    const isOutgoing = message.direction === 'outgoing';
    const messageClass = isOutgoing ? 'message-outgoing' : 'message-incoming';

    return `
      <div class="message ${messageClass}" data-id="${message.id}">
        <div class="message-content">
          <div class="message-text">${this.formatMessageContent(message)}</div>
          <div class="message-meta">
            <span class="message-time">${this.formatTime(message.timestamp)}</span>
            ${isOutgoing ? this.getMessageStatus(message.status) : ''}
          </div>
        </div>
      </div>
    `;
  }

  formatMessageContent(message) {
    if (message.type === 'text') {
      return this.escapeHtml(message.text);
    } else if (message.type === 'image') {
      return `<img src="${message.media_url}" alt="Imagen" class="message-image" />`;
    } else if (message.type === 'document') {
      return `<a href="${message.media_url}" class="message-document" target="_blank">
        <i class="fas fa-file"></i> ${message.filename || 'Documento'}
      </a>`;
    }
    return 'Mensaje no soportado';
  }

  getMessageStatus(status) {
    const icons = {
      sent: 'fa-check',
      delivered: 'fa-check-double',
      read: 'fa-check-double text-blue',
    };

    const icon = icons[status] || 'fa-clock';
    return `<i class="fas ${icon} message-status"></i>`;
  }

  addMessageToChat(message) {
    // Validación para asegurar que this.messages sea un array
    if (!Array.isArray(this.messages)) {
      console.warn('this.messages no es un array en addMessageToChat, inicializando como array vacío');
      this.messages = [];
    }

    this.messages.push(message);

    // Limit messages if needed
    if (this.messages.length > this.options.maxMessages) {
      this.messages = this.messages.slice(-this.options.maxMessages);
    }

    // Add to DOM
    const messageHTML = this.getMessageHTML(message);
    this.elements.messagesList.insertAdjacentHTML('beforeend', messageHTML);
    this.scrollToBottom();
  }

  // Métodos de envío
  handleMessageInput(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  handleTyping() {
    if (!this.options.enableTyping || !this.socket) return;

    if (!this.isTyping) {
      this.isTyping = true;
      this.socket.emit('typing', { phone: this.currentPhone, isTyping: true });
    }

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      this.socket.emit('typing', { phone: this.currentPhone, isTyping: false });
    }, 1000);
  }

  async sendMessage() {
    const text = this.elements.messageInput.value.trim();
    if (!text || !this.currentPhone) return;

    try {
      const response = await this.request('/api/messages/send', {
        method: 'POST',
        body: {
          phone: this.currentPhone,
          text: text,
          type: 'text',
        },
      });

      if (response.success) {
        this.elements.messageInput.value = '';
        this.adjustTextareaHeight();
        this.showToast('Mensaje enviado', 'success');
      } else {
        throw new Error(response.error || 'Error al enviar mensaje');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.showToast('Error al enviar mensaje', 'error');
    }
  }

  // Métodos de utilidad
  enableMessageInput() {
    this.elements.messageInput.disabled = false;
    this.elements.sendBtn.disabled = false;
    this.elements.messageInput.placeholder = 'Escribe tu mensaje...';
  }

  disableMessageInput() {
    this.elements.messageInput.disabled = true;
    this.elements.sendBtn.disabled = true;
    this.elements.messageInput.placeholder = 'Selecciona una conversación...';
  }

  updateConnectionStatus() {
    const indicator =
      this.elements.chatStatus.querySelector('.status-indicator');
    const text = this.elements.chatStatus.querySelector('.status-text');

    if (this.state.connected) {
      indicator.className = 'status-indicator connected';
      text.textContent = 'Conectado';
    } else {
      indicator.className = 'status-indicator disconnected';
      text.textContent = 'Desconectado';
    }
  }

  showTypingIndicator(show) {
    this.elements.typingIndicator.style.display = show ? 'flex' : 'none';
    if (show) {
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    this.elements.messagesContainer.scrollTop =
      this.elements.messagesContainer.scrollHeight;
  }

  adjustTextareaHeight() {
    const textarea = this.elements.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';

    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  playNotificationSound() {
    // Implementar sonido de notificación si es necesario
  }

  startAutoRefresh() {
    this.refreshTimer = setInterval(() => {
      if (this.state.connected) {
        this.refreshConversations();
      }
    }, this.options.refreshInterval);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Métodos de modal (placeholder)
  handleAttachment() {
    this.showToast('Función de adjuntos en desarrollo', 'info');
  }

  openTemplateModal() {
    this.showToast('Modal de plantillas en desarrollo', 'info');
  }

  openFlowModal() {
    this.showToast('Modal de flujos en desarrollo', 'info');
  }

  async markAsRead(phone) {
    try {
      await this.request(`/api/conversations/${phone}/read`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  updateConversationPreview(message) {
    const conversation = this.conversations.find(
      c => c.phone === message.phone
    );
    if (conversation) {
      conversation.lastMessage = message.text || 'Archivo multimedia';
      conversation.lastMessageTime = message.timestamp;
      if (
        message.direction === 'incoming' &&
        message.phone !== this.currentPhone
      ) {
        conversation.unread = (conversation.unread || 0) + 1;
      }
      this.renderConversations();
    }
  }

  updateConversationInList(data) {
    const index = this.conversations.findIndex(c => c.phone === data.phone);
    if (index >= 0) {
      this.conversations[index] = { ...this.conversations[index], ...data };
    } else {
      this.conversations.unshift(data);
    }
    this.renderConversations();
  }

  destroy() {
    this.stopAutoRefresh();

    if (this.socket) {
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('message');
      this.socket.off('typing');
      this.socket.off('conversation_updated');
    }

    super.destroy();
  }
}

// Hacer disponible globalmente para compatibilidad
window.ChatInterface = ChatInterface;

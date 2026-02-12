
/**
 * Gestor de Chat en Vivo
 * Maneja todas las funcionalidades del chat en tiempo real
 */

class ChatLiveManager {
    constructor() {
        this.conversations = [];
        this.currentConversation = null;
        this.messages = [];
        this.isTyping = false;
        this.typingTimeout = null;
        this.socket = null;

        // Referencias DOM
        this.elements = {};

        // Configuración
        this.config = {
            typingTimeout: 3000,
            maxMessages: 100,
        };

        // Cache para contact IDs
        this.contactIdCache = new Map();
    }

    init() {
        this.initializeElements();
        this.initializeSocket();
        this.bindEvents();
        this.loadConversations();
        window.chatLiveManager = this;
        window.chatManager = this; // Alias para compatibilidad
        
        // Verificar si hay un teléfono en los parámetros de URL
        const params = new URLSearchParams(window.location.search);
        const phone = params.get('phone');
        if (phone) {
            // Esperar a que se carguen las conversaciones y luego seleccionar la del teléfono
            setTimeout(async () => await this.selectConversationByPhone(phone), 300);
        }
        // Auto-refresh eliminado: Socket.IO maneja todo en tiempo real
    }

    initializeElements() {
        this.elements = {
            conversationsList: document.getElementById('conversationsList'),
            chatHeader: document.getElementById('chatHeader'),
            chatMessages: document.getElementById('chatMessages'),
            chatInputContainer: document.getElementById('chatInputContainer'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            refreshButton: document.getElementById('refreshConversations'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            typingIndicator: document.getElementById('typingIndicator'),
            clientInfoPanel: document.getElementById('clientInfoPanel'),
            clientDetails: document.getElementById('clientDetails')
        };
    }

    /**
     * Inicializa Socket.IO para comunicación en tiempo real
     */
    initializeSocket() {
        if (typeof io === 'undefined') {
            setTimeout(() => this.initializeSocket(), 500);
            return;
        }

        try {
            this.socket = io({ transports: ['websocket', 'polling'] });

            this.socket.on('connect', () => {
                this.updateStatusIndicator('online');
            });

            this.socket.on('disconnect', () => {
                this.updateStatusIndicator('offline');
            });

            this.socket.on('new_message', (payload) => {
                this.handleNewMessage(payload);
            });

            // Escuchar message echoes (confirmación de mensajes enviados)
            this.socket.on('message_echo', (payload) => {
                this.handleMessageEcho(payload);
            });

            // Escuchar actualizaciones de contacto
            this.socket.on('contact_updated', (payload) => {
                this.handleContactUpdate(payload);
            });

            this.socket.on('conversation_update', () => {
                this.loadConversations();
            });
        } catch (error) {
            console.error('❌ Error inicializando Socket.IO:', error);
            this.updateStatusIndicator('offline');
        }
    }

    /**
     * Vincula eventos a los elementos
     */
    bindEvents() {
        // Botón de enviar mensaje
        this.elements.sendButton?.addEventListener('click', () => this.sendMessage());

        // Enter en el input de mensaje
        this.elements.messageInput?.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.sendMessage();
            }
        });

        // Indicador de escritura
        this.elements.messageInput?.addEventListener('input', () => this.handleTyping());
        this.elements.refreshButton?.addEventListener('click', () => this.loadConversations());

        // Botón de cerrar panel de información del cliente
        document.getElementById('closeClientInfoBtn')?.addEventListener('click', () => this.hideClientInfo());

        // Toolbar buttons
        document.getElementById('emojiBtn')?.addEventListener('click', () => this.toggleEmojiPicker());
        document.getElementById('imageBtn')?.addEventListener('click', () => this.selectImage());
        document.getElementById('videoBtn')?.addEventListener('click', () => this.selectVideo());
        document.getElementById('documentBtn')?.addEventListener('click', () => this.selectDocument());
        document.getElementById('attachBtn')?.addEventListener('click', () => this.selectFile());
        document.getElementById('audioBtn')?.addEventListener('click', () => this.recordAudio());
        document.getElementById('templateBtn')?.addEventListener('click', () => this.showTemplates());
        document.getElementById('automationBtn')?.addEventListener('click', () => this.showAutomation());
        document.getElementById('fileInput')?.addEventListener('change', (e) => this.handleFileSelect(e));

        // Eventos del menú de entrada
        this.bindInputMenuEvents();

        // Eventos del sidebar - permitir navegación
        const sidebarLinks = document.querySelectorAll('.sidebar-menu .menu-item');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Permitir que el navegador maneje la navegación normalmente
                // No prevenir el comportamiento por defecto
                const href = link.getAttribute('href');
                if (href) {
                    window.location.href = href;
                }
            });
        });
    }

    /**
     * Vincula eventos del menú de entrada
     */
    bindInputMenuEvents() {
        const menuToggleBtn = document.getElementById('menuToggleBtn');
        const inputMenu = document.getElementById('inputMenu');
        const menuItems = document.querySelectorAll('.menu-item');
        const modalCloseButtons = document.querySelectorAll('.modal-close');

        if (!menuToggleBtn || !inputMenu) {
            console.warn('⚠️ Elementos del menú no encontrados');
            return;
        }

        // Toggle del menú
        menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = inputMenu.style.display !== 'none';
            inputMenu.style.display = isVisible ? 'none' : 'flex';
            inputMenu.style.flexDirection = 'column';
        });

        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.input-menu-wrapper')) {
                inputMenu.style.display = 'none';
            }
        });

        // Eventos de items del menú
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const action = item.dataset.action;
                inputMenu.style.display = 'none';
                this.handleMenuAction(action);
            });
        });

        // Cerrar modales
        modalCloseButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.dataset.modal;
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Cerrar modal al hacer clic en el fondo
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Eventos de botones de selección de archivos
        document.getElementById('selectImageBtn')?.addEventListener('click', () => {
            document.getElementById('imageFileInput')?.click();
        });

        document.getElementById('selectVideoBtn')?.addEventListener('click', () => {
            document.getElementById('videoFileInput')?.click();
        });

        document.getElementById('selectDocumentBtn')?.addEventListener('click', () => {
            document.getElementById('documentFileInput')?.click();
        });

        // Eventos de cambio de archivo
        document.getElementById('imageFileInput')?.addEventListener('change', (e) => {
            this.handleImageSelect(e);
        });

        document.getElementById('videoFileInput')?.addEventListener('change', (e) => {
            this.handleVideoSelect(e);
        });

        document.getElementById('documentFileInput')?.addEventListener('change', (e) => {
            this.handleDocumentSelect(e);
        });
    }

    /**
     * Maneja las acciones del menú
     */
    handleMenuAction(action) {
        switch(action) {
            case 'templates':
                this.openTemplatesModal();
                break;
            case 'images':
                this.openImagesModal();
                break;
            case 'videos':
                this.openVideosModal();
                break;
            case 'documents':
                this.openDocumentsModal();
                break;
            case 'emojis':
                this.openEmojisModal();
                break;
        }
    }

    /**
     * Abre el modal de plantillas
     */
    openTemplatesModal() {
        const modal = document.getElementById('templatesModal');
        if (!modal) return;

        modal.style.display = 'flex';
        this.loadTemplates();
    }

    /**
     * Carga las plantillas disponibles (solo aprobadas/activas)
     */
    async loadTemplates() {
        try {
            // Filtrar solo plantillas activas/aprobadas
            const response = await fetch('/api/templates?is_active=1');
            const data = await response.json();
            const templates = data.templates || [];

            const templatesList = document.getElementById('templatesList');
            if (!templatesList) return;

            if (templates.length === 0) {
                templatesList.innerHTML = `
                    <div class="loading">
                        <i class="fas fa-inbox"></i>
                        <p>No hay plantillas disponibles</p>
                    </div>
                `;
                return;
            }

            templatesList.innerHTML = templates.map(template => `
                <div class="template-item" data-id="${template.id}">
                    <div class="template-item-icon">📝</div>
                    <p class="template-item-name">${template.name}</p>
                </div>
            `).join('');

            // Agregar eventos a los items de plantillas
            document.querySelectorAll('.template-item').forEach(item => {
                item.addEventListener('click', () => {
                    const templateId = item.dataset.id;
                    const template = templates.find(t => t.id === templateId);
                    if (template) {
                        this.sendTemplate(template);
                    }
                });
            });
        } catch (error) {
            console.error('Error cargando plantillas:', error);
            const templatesList = document.getElementById('templatesList');
            if (templatesList) {
                templatesList.innerHTML = `
                    <div class="loading">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Error al cargar plantillas</p>
                    </div>
                `;
            }
        }
    }

    /**
     * Envía una plantilla
     */
    async sendTemplate(template) {
        if (!this.currentConversation) return;

        try {
            const response = await fetch(`/api/chat-live/conversations/${encodeURIComponent(this.currentConversation.id)}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: template.content,
                    sender: 'agent',
                    type: 'text'
                })
            });

            if (response.ok) {
                document.getElementById('templatesModal').style.display = 'none';
                this.showNotification('Plantilla enviada', 'La plantilla se envió correctamente');
                await this.loadConversations();
            }
        } catch (error) {
            console.error('Error enviando plantilla:', error);
            this.showNotification('Error', 'No se pudo enviar la plantilla');
        }
    }

    /**
     * Abre el modal de imágenes
     */
    openImagesModal() {
        const modal = document.getElementById('imagesModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * Maneja la selección de imagen
     */
    handleImageSelect(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const previewContainer = document.getElementById('imagesPreview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';

        Array.from(files).forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const preview = document.createElement('div');
                preview.className = 'preview-item';
                preview.innerHTML = `
                    <img src="${event.target.result}" alt="Preview">
                    <button class="preview-item-remove" data-index="${index}">×</button>
                `;

                const removeBtn = preview.querySelector('.preview-item-remove');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        preview.remove();
                    });
                }

                preview.addEventListener('click', (e) => {
                    if (!e.target.closest('.preview-item-remove')) {
                        this.sendImage(file);
                    }
                });

                previewContainer.appendChild(preview);
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Envía una imagen
     */
    async sendImage(file) {
        if (!this.currentConversation) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'image');

        try {
            const response = await fetch(`/api/chat-live/conversations/${encodeURIComponent(this.currentConversation.id)}/messages`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                document.getElementById('imagesModal').style.display = 'none';
                this.showNotification('Imagen enviada', 'La imagen se envió correctamente');
                await this.loadConversations();
            }
        } catch (error) {
            console.error('Error enviando imagen:', error);
            this.showNotification('Error', 'No se pudo enviar la imagen');
        }
    }

    /**
     * Abre el modal de videos
     */
    openVideosModal() {
        const modal = document.getElementById('videosModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * Maneja la selección de video
     */
    handleVideoSelect(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const previewContainer = document.getElementById('videosPreview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';

        Array.from(files).forEach((file, index) => {
            const preview = document.createElement('div');
            preview.className = 'preview-item';
            const videoUrl = URL.createObjectURL(file);
            preview.innerHTML = `
                <video src="${videoUrl}" controls></video>
                <button class="preview-item-remove" data-index="${index}">×</button>
            `;

            const removeBtn = preview.querySelector('.preview-item-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    preview.remove();
                });
            }

            preview.addEventListener('click', (e) => {
                if (!e.target.closest('.preview-item-remove')) {
                    this.sendVideo(file);
                }
            });

            previewContainer.appendChild(preview);
        });
    }

    /**
     * Envía un video
     */
    async sendVideo(file) {
        if (!this.currentConversation) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'video');

        try {
            const response = await fetch(`/api/chat-live/conversations/${encodeURIComponent(this.currentConversation.id)}/messages`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                document.getElementById('videosModal').style.display = 'none';
                this.showNotification('Video enviado', 'El video se envió correctamente');
                await this.loadConversations();
            }
        } catch (error) {
            console.error('Error enviando video:', error);
            this.showNotification('Error', 'No se pudo enviar el video');
        }
    }

    /**
     * Abre el modal de documentos
     */
    openDocumentsModal() {
        const modal = document.getElementById('documentsModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * Maneja la selección de documento
     */
    handleDocumentSelect(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const previewContainer = document.getElementById('documentsPreview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';

        Array.from(files).forEach((file, index) => {
            const preview = document.createElement('div');
            preview.className = 'preview-item';
            const fileIcon = this.getFileIcon(file.type);
            preview.innerHTML = `
                <div class="preview-item-document">
                    <i class="${fileIcon}"></i>
                    <span>${file.name}</span>
                </div>
                <button class="preview-item-remove" data-index="${index}">×</button>
            `;

            const removeBtn = preview.querySelector('.preview-item-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    preview.remove();
                });
            }

            preview.addEventListener('click', (e) => {
                if (!e.target.closest('.preview-item-remove')) {
                    this.sendDocument(file);
                }
            });

            previewContainer.appendChild(preview);
        });
    }

    /**
     * Obtiene el icono del archivo según su tipo
     */
    getFileIcon(fileType) {
        if (fileType.includes('pdf')) return 'fas fa-file-pdf';
        if (fileType.includes('word') || fileType.includes('document')) return 'fas fa-file-word';
        if (fileType.includes('sheet') || fileType.includes('excel')) return 'fas fa-file-excel';
        if (fileType.includes('text')) return 'fas fa-file-alt';
        return 'fas fa-file';
    }

    /**
     * Envía un documento
     */
    async sendDocument(file) {
        if (!this.currentConversation) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'document');

        try {
            const response = await fetch(`/api/chat-live/conversations/${encodeURIComponent(this.currentConversation.id)}/messages`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                document.getElementById('documentsModal').style.display = 'none';
                this.showNotification('Documento enviado', 'El documento se envió correctamente');
                await this.loadConversations();
            }
        } catch (error) {
            console.error('Error enviando documento:', error);
            this.showNotification('Error', 'No se pudo enviar el documento');
        }
    }

    /**
     * Abre el modal de emojis
     */
    openEmojisModal() {
        const modal = document.getElementById('emojisModal');
        if (!modal) return;

        modal.style.display = 'flex';
        this.loadEmojis();
    }

    /**
     * Carga los emojis
     */
    loadEmojis() {
        const emojis = [
            '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
            '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
            '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
            '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
            '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
            '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒',
            '🤕', '🤢', '🤮', '🤮', '🤐', '🤮', '🤮', '🤮',
            '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏',
            '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👍', '👎',
            '☝️', '👆', '👇', '👈', '👉', '👊', '👏', '🙌',
            '👐', '🫲', '🫳', '🤲', '🤝', '🤜', '🤛', '🦾',
            '🦿', '👂', '👃', '🧠', '🦷', '🦴', '🌟', '✨',
            '⭐', '🌠', '💫', '💥', '⚡', '🔥', '🌪️', '🌈',
            '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️',
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
            '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘',
            '💝', '💟', '👋', '🎉', '🎊', '🎈', '🎁', '🎀',
            '🎂', '🍰', '🧁', '🍪', '🍩', '🍫', '🍬', '🍭'
        ];

        const emojisGrid = document.getElementById('emojisGrid');
        if (!emojisGrid) return;

        emojisGrid.innerHTML = emojis.map(emoji => `
            <button class="emoji-button" data-emoji="${emoji}">
                ${emoji}
            </button>
        `).join('');

        // Agregar eventos a los emojis
        document.querySelectorAll('.emoji-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const emoji = btn.dataset.emoji;
                const messageInput = document.getElementById('messageInput');
                if (messageInput) {
                    messageInput.value += emoji;
                    messageInput.focus();
                }
            });
        });
    }

    /**
     * Carga las conversaciones desde el servidor
     */
    async loadConversations() {
        try {
            const response = await fetch('/api/chat-live/conversations?limit=50&page=1');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = await response.json();

            const list = Array.isArray(payload.data) ? payload.data : [];

            // Normalizar las conversaciones directamente desde el servidor
            // El servidor es la fuente de verdad para el estado de lectura
            this.conversations = list.map(ChatLiveManager.normalizeConversation);

            this.renderConversations();
        } catch (error) {
            console.error('❌ Error cargando conversaciones:', error);
            this.conversations = [];
            this.renderConversations();
        }
    }

    static normalizeConversation(raw) {
        const phone = raw.phone || raw.contact_phone || raw.clientPhone || raw.id;
        return {
            id: raw.id ?? phone,
            phone,
            name: raw.name || raw.contact_name || raw.clientName || phone || 'Contacto',
            avatar: raw.avatar || null,
            lastMessage: raw.lastMessage || raw.last_message || raw.last_message_content || 'Sin mensajes',
            lastMessageTime: raw.lastMessageTime || raw.last_message_at || raw.timestamp || null,
            unreadCount: typeof raw.unreadCount === 'number' ? raw.unreadCount : (raw.unread ? 1 : 0),
            status: raw.status || 'active',
            channel: raw.channel || 'whatsapp',
            priority: raw.priority || 'medium'
        };
    }

    /**
     * Renderiza la lista de conversaciones
     */
    renderConversations() {
        const container = this.elements.conversationsList;
        if (!container) return;

        if (!this.conversations || this.conversations.length === 0) {
            container.innerHTML = `
                <div class="empty-conversations">
                    <i class="fas fa-comments fa-2x"></i>
                    <p>No hay conversaciones activas</p>
                    <small>Las nuevas conversaciones aparecerán aquí</small>
                </div>
            `;
            return;
        }

        // Guardar el ID o teléfono de la conversación actual para restaurar la selección
        const currentIdentifier = this.currentConversation ? 
            (this.currentConversation.id || this.currentConversation.phone) : null;

        container.innerHTML = this.conversations.map((conversation) => {
            // Comprobar si esta conversación es la activa
            const isActive = this.currentConversation &&
                (this.currentConversation.id === conversation.id || this.currentConversation.phone === conversation.phone);
            
            // Clases CSS para la conversación
            let classes = ['conversation-item'];
            if (isActive) classes.push('active');
            if (conversation.unreadCount > 0) classes.push('unread');
            
            // Si la conversación está activa, no mostrar contador de no leídos
            const unreadCount = isActive ? 0 : conversation.unreadCount;
            
            // Procesar el último mensaje para la vista previa
            let lastMessagePreview = conversation.lastMessage || '';
            
            // Detectar mensajes multimedia y mostrar descripciones adecuadas
            if (lastMessagePreview.includes('message-media') || 
                lastMessagePreview.includes('fa-image') || 
                lastMessagePreview.includes('fa-video') || 
                lastMessagePreview.includes('fa-file') ||
                lastMessagePreview.includes('fa-paperclip')) {
                
                if (lastMessagePreview.includes('fa-image')) {
                    lastMessagePreview = '🖼️ Imagen';
                } else if (lastMessagePreview.includes('fa-video')) {
                    lastMessagePreview = '🎥 Video';
                } else if (lastMessagePreview.includes('fa-file')) {
                    lastMessagePreview = '📄 Documento';
                } else if (lastMessagePreview.includes('fa-map-marker')) {
                    lastMessagePreview = '📍 Ubicación';
                } else {
                    lastMessagePreview = '📎 Archivo adjunto';
                }
            } else if (!lastMessagePreview) {
                lastMessagePreview = 'Sin mensajes';
            }
            
            // Usar el mismo formato de tiempo que en la información del cliente
            let timeLabel = '—';
            if (conversation.lastMessageTime) {
                // Si esta es la conversación activa y tenemos mensajes, usar el último mensaje
                if (isActive && this.messages && this.messages.length > 0) {
                    const sortedMessages = [...this.messages].sort((a, b) => {
                        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                    });
                    
                    if (sortedMessages[0] && sortedMessages[0].timestamp) {
                        timeLabel = this.formatTime(sortedMessages[0].timestamp);
                    } else {
                        timeLabel = this.formatTime(conversation.lastMessageTime);
                    }
                } else {
                    timeLabel = this.formatTime(conversation.lastMessageTime);
                }
            }

            return `
                <div class="${classes.join(' ')}"
                     data-conversation-id="${conversation.id}"
                     data-conversation-phone="${conversation.phone}">
                    <div class="conversation-checkbox" style="display: flex; align-items: center; margin-right: 10px;">
                        <input type="checkbox" class="conversation-select" 
                               data-conversation-id="${conversation.id}"
                               data-conversation-phone="${conversation.phone}"
                               style="width: 18px; height: 18px; cursor: pointer;">
                    </div>
                    <div class="conversation-avatar">
                        ${conversation.avatar ?
                            `<img src="${conversation.avatar}" alt="${conversation.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                             <i class="fas fa-user" style="display:none;"></i>` :
                            '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="conversation-info">
                        <div class="conversation-header">
                            <h4 title="${conversation.phone}">${conversation.name}</h4>
                            <span class="conversation-time">${timeLabel}</span>
                        </div>
                        <div class="conversation-preview">
                            <p>${lastMessagePreview}</p>
                            ${unreadCount > 0 ? `<span class="unread-badge-count">${unreadCount}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.conversation-item').forEach((item) => {
            const checkbox = item.querySelector('.conversation-select');
            
            // Click en el item = Abrir conversación
            item.addEventListener('click', (e) => {
                // Si el click fue en el checkbox, no hacer nada (el navegador lo maneja)
                if (e.target.classList.contains('conversation-select')) {
                    return;
                }
                
                const identifier = item.dataset.conversationPhone || item.dataset.conversationId;
                this.selectConversation(identifier);
            });
        });
    }

    /**
     * Selecciona una conversación
     */
    async selectConversation(identifier) {
        const conversation = this.conversations.find((conv) => conv.id === identifier || conv.phone === identifier);
        if (!conversation) return;

        // Verificar si ya está seleccionada esta conversación
        const isAlreadySelected = this.currentConversation && 
            (this.currentConversation.id === conversation.id || 
             this.currentConversation.phone === conversation.phone);
        
        if (isAlreadySelected) {
            return; // Evitar procesamiento innecesario
        }

        // Deseleccionar la conversación anterior si existe
        if (this.currentConversation) {
            const prevItems = document.querySelectorAll('.conversation-item.active');
            prevItems.forEach(item => item.classList.remove('active'));
        }

        // Guardar la referencia a la conversación actual
        this.currentConversation = conversation;
        
        // Seleccionar visualmente la nueva conversación
        const conversationItems = document.querySelectorAll('.conversation-item');
        conversationItems.forEach(item => {
            const itemId = item.dataset.conversationId;
            const itemPhone = item.dataset.conversationPhone;
            const checkbox = item.querySelector('.conversation-select');
            
            if ((itemId && itemId === identifier) || (itemPhone && itemPhone === identifier)) {
                item.classList.add('active');
                
                // ✅ Marcar el checkbox cuando se selecciona
                if (checkbox) {
                    checkbox.checked = true;
                }
                
                // Remover la clase unread si existe
                if (item.classList.contains('unread')) {
                    item.classList.remove('unread');
                }
            } else {
                // ✅ Desmarcar checkboxes de otras conversaciones
                if (checkbox) {
                    checkbox.checked = false;
                }
            }
        });
        
        // Si hay mensajes no leídos, marcarlos como leídos
        if (conversation.unreadCount > 0) {
            try {
                // Actualizar en el servidor
                const result = await this.markConversationAsRead(conversation.id || conversation.phone);

                // Actualizar localmente SOLO si el servidor confirmó la actualización
                if (result && result.success) {
                    conversation.unreadCount = 0;

                    // Actualizar también en el dashboard si está disponible
                    if (window.parent && window.parent.updateUnreadCount) {
                        window.parent.updateUnreadCount(conversation.phone, 0);
                    }

                    // Forzar renderizado para actualizar la UI
                    this.renderConversations();
                }
            } catch (error) {
                console.error('❌ Error marcando conversación como leída:', error);
            }
        }

        this.renderConversations();
        this.updateChatHeader();
        await this.loadMessages(true); // forceReload = true para cargar todos los mensajes
        this.showChatInput();
        // No mostrar automáticamente el panel de información del cliente
    }

    /**
     * Actualiza el header del chat
     */
    updateChatHeader() {
        const header = this.elements.chatHeader;
        if (!header || !this.currentConversation) return;

        const { name, phone } = this.currentConversation;
        const isClientInfoVisible = this.elements.clientInfoPanel && this.elements.clientInfoPanel.style.display !== 'none';

        header.innerHTML = `
            <div class="chat-info clickable" id="chatInfoToggle">
                <div class="client-avatar"><i class="fas fa-user"></i></div>
                <div class="client-details">
                    <h4>${name}</h4>
                    <p>${phone || 'Sin teléfono'}</p>
                </div>
                <div class="info-toggle-icon">
                    <i class="fas fa-${isClientInfoVisible ? 'chevron-right' : 'chevron-left'}"></i>
                </div>
            </div>
            <div class="chat-actions">
                <button class="btn btn-sm btn-outline" id="deleteContactBtn" title="Eliminar contacto">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // Agregar evento click al header
        const chatInfoToggle = document.getElementById('chatInfoToggle');
        if (chatInfoToggle) {
            chatInfoToggle.addEventListener('click', () => this.toggleClientInfo());
        }

        const deleteContactBtn = document.getElementById('deleteContactBtn');
        if (deleteContactBtn) {
            deleteContactBtn.addEventListener('click', () => this.handleDeleteContact());
        }
    }

    async handleDeleteContact() {
        if (!this.currentConversation) {
            alert('Selecciona una conversación antes de eliminar el contacto.');
            return;
        }

        const confirmed = confirm('¿Eliminar el contacto y cerrar la conversación? Esta acción no se puede deshacer.');
        if (!confirmed) return;

        const phone = this.currentConversation.phone;

        try {
            // Primero obtener el ID del contacto desde la base de datos usando el teléfono
            const contactResponse = await fetch(`/api/contacts?search=${encodeURIComponent(phone)}&limit=1`);
            if (!contactResponse.ok) {
                throw new Error(`Error obteniendo información del contacto: HTTP ${contactResponse.status}`);
            }
            const contactData = await contactResponse.json();
            if (!contactData.success || !contactData.data || contactData.data.length === 0) {
                throw new Error('No se encontró el contacto en la base de datos');
            }

            const contactId = contactData.data[0].id;

            // Ahora eliminar el contacto usando su ID real
            const response = await fetch(`/api/contacts/${contactId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'No se pudo eliminar el contacto');
            }

            // Quitar de la lista y resetear UI
            this.conversations = this.conversations.filter(conv => conv.id !== this.currentConversation.id && conv.phone !== phone);
            this.currentConversation = null;
            this.messages = [];
            this.renderConversations();
            this.renderMessages();
            this.updateChatHeader();
            this.hideChatInput();

            alert('Contacto eliminado correctamente');
        } catch (error) {
            console.error('Error eliminando contacto:', error);
            alert('No se pudo eliminar el contacto: ' + (error.message || 'error desconocido'));
        }
    }

    /**
     * Carga los mensajes de una conversación
     */
    async loadMessages(forceReload = false) {
        if (!this.currentConversation) {
            this.messages = [];
            this.renderMessages();
            return;
        }

        try {
            const phone = this.currentConversation.phone;
            const response = await fetch(`/api/chat-live/messages/by-phone/${encodeURIComponent(phone)}?limit=100&page=1`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = await response.json();
            const list = Array.isArray(payload.data) ? payload.data : [];
            const newMessages = list.map(ChatLiveManager.normalizeMessage);
            
            // Si es primera carga o forzada, reemplazar todos los mensajes pero preservar mensajes fallidos locales
            if (forceReload || this.messages.length === 0) {
                // Preservar mensajes fallidos que no estén en la respuesta de la API
                const failedMessages = this.messages.filter(msg =>
                    msg.status === 'failed' &&
                    msg.direction === 'outbound' &&
                    !newMessages.some(newMsg => newMsg.id === msg.id)
                );


                // Combinar mensajes de la API con mensajes fallidos locales
                this.messages = [...newMessages, ...failedMessages].sort((a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                this.renderMessages();

                // Marcar mensajes como leídos (doble check azul)
                if (this.messages.length > 0) {
                    this.markMessagesAsRead(phone);
                }

                return;
            }

            // Merge: mantener mensajes existentes y agregar solo los nuevos de la API
            const existingIds = new Set(this.messages.map(m => m.id));
            const messagesToAdd = newMessages.filter(msg => !existingIds.has(msg.id));

            if (messagesToAdd.length > 0) {
                this.messages = [...this.messages, ...messagesToAdd].sort((a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                this.renderMessages();

                // Marcar mensajes nuevos como leídos
                this.markMessagesAsRead(phone);
            }
        } catch (error) {
            console.error('❌ Error cargando mensajes:', error);
            this.messages = [];
            this.renderMessages();
        }
    }

    static normalizeMessage(raw) {
        // Normalizar mensaje para todos los tipos (texto, imagen, video, audio, etc.)
        const message = {
            id: raw.id || raw.messageId || Date.now().toString(),
            direction: raw.direction || (raw.sender === 'agent' ? 'outbound' : 'inbound'),
            type: raw.type || 'text',
            status: raw.status || 'received',
            content: raw.content || raw.text || raw.message || '',
            timestamp: raw.timestamp || raw.created_at || raw.sentAt || new Date().toISOString(),
            mediaUrl: raw.mediaUrl || raw.media_url || null,
            mediaType: raw.mediaType || raw.media_type || null,
            messageId: raw.messageId || raw.message_id || null, // ID de WhatsApp para marcar como leído
            latitude: raw.latitude || null,
            longitude: raw.longitude || null,
            locationName: raw.locationName || raw.location_name || null,
            locationAddress: raw.locationAddress || raw.location_address || null
        };

        // Handle interactive messages (like flow responses)
        // First check if the raw message already has interactive structure
        if (raw.type === 'interactive' && raw.interactive) {
            message.interactive = raw.interactive;

            // For nfm_reply (flow responses), extract the form data
            if (raw.interactive.type === 'nfm_reply' && raw.interactive.nfm_reply) {
                const nfmReply = raw.interactive.nfm_reply;
                message.flowResponse = {
                    responseJson: nfmReply.response_json,
                    body: nfmReply.body,
                    name: nfmReply.name
                };

                // Parse the response_json if it's a string
                if (typeof nfmReply.response_json === 'string') {
                    try {
                        message.flowResponse.parsedData = JSON.parse(nfmReply.response_json);
                    } catch (e) {
                        console.warn('Failed to parse flow response JSON:', e);
                        message.flowResponse.parsedData = null;
                    }
                } else {
                    message.flowResponse.parsedData = nfmReply.response_json;
                }

                // Update content to show flow completion
                message.content = nfmReply.body || 'Respuesta de flujo completada';
                message.type = 'interactive';
            }
        }
        // Check if the content is a JSON string that contains interactive data
        else if (typeof message.content === 'string' && message.content.trim()) {
            try {
                // Try to parse as JSON - be more flexible with whitespace
                const trimmedContent = message.content.trim();

                // Only try to parse if it looks like JSON (starts with { or [)
                if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
                    const contentObj = JSON.parse(trimmedContent);

                    // Check if this is an interactive message stored as JSON in content
                    if (contentObj && contentObj.type === 'interactive' && contentObj.interactive) {
                        message.interactive = contentObj.interactive;

                        // For nfm_reply (flow responses), extract the form data
                        if (contentObj.interactive.type === 'nfm_reply' && contentObj.interactive.nfm_reply) {
                            const nfmReply = contentObj.interactive.nfm_reply;
                            message.flowResponse = {
                                responseJson: nfmReply.response_json,
                                body: nfmReply.body,
                                name: nfmReply.name
                            };

                            // Parse the response_json if it's a string
                            if (typeof nfmReply.response_json === 'string') {
                                try {
                                    message.flowResponse.parsedData = JSON.parse(nfmReply.response_json);
                                } catch (e) {
                                    console.warn('Failed to parse flow response JSON:', e);
                                    message.flowResponse.parsedData = null;
                                }
                            } else {
                                message.flowResponse.parsedData = nfmReply.response_json;
                            }

                            // Update content to show flow completion
                            message.content = nfmReply.body || 'Respuesta de flujo completada';
                            message.type = 'interactive';
                        }
                    }
                }
                // If content doesn't start with { or [, it's not JSON - continue with normal processing
            } catch (e) {
                // Not a valid JSON, continue with normal processing
                // This is expected for regular text messages, not an error
            }
        }

        return message;
    }
    
    /**
     * Marcar mensajes como leídos (doble check azul en WhatsApp)
     */
    async markMessagesAsRead(phone) {
        try {
            // Filtrar mensajes entrantes que necesitan ser marcados como leídos
            // Incluye todos los tipos de mensajes: texto, imagen, video, audio, ubicación, etc.
            const inboundMessages = this.messages.filter(msg => 
                msg.direction === 'inbound' && 
                msg.messageId // Solo mensajes con ID de WhatsApp
            );
            
            if (inboundMessages.length === 0) {
                return;
            }
            
            // Agrupar por tipo para log
            const messageTypes = {};
            inboundMessages.forEach(msg => {
                messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;
            });
            
            // Extraer IDs de mensajes de WhatsApp
            const messageIds = inboundMessages
                .map(msg => msg.messageId)
                .filter(id => id); // Filtrar IDs nulos

            if (messageIds.length === 0) {
                return;
            }

            // Llamar a la API para marcar como leídos
            const response = await fetch('/api/chat-live/mark-messages-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone,
                    messageIds
                })
            });

            const result = await response.json();

            if (!result.success) {
                console.warn(`⚠️ No se pudieron marcar todos los mensajes como leídos: ${result.error}`);
            }
            
        } catch (error) {
            console.error('❌ Error marcando mensajes como leídos:', error);
        }
    }

    /**
     * Renderiza los mensajes del chat
     */
    renderMessages() {
        const container = this.elements.chatMessages;
        if (!container) return;

        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="empty-chat">
                    <i class="fas fa-comments fa-3x"></i>
                    <p>No hay mensajes en esta conversación</p>
                    <p><a href="/contactos.html">Ver contactos</a></p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.messages.map((message) => {
            const isAgent = message.direction !== 'inbound';
            const timeLabel = this.formatTime(message.timestamp);
            const mediaHtml = this.renderMessageContent(message);
            const statusIcon = this.getMessageStatusIcon(message.status);

            return `
                <div class="message ${isAgent ? 'sent' : 'received'}" data-message-id="${message.id}">
                    <div class="message-content">
                        ${mediaHtml}
                        <div class="message-meta">
                            <span class="message-time">${timeLabel}</span>
                            ${isAgent && statusIcon ? `<span class="message-status ${message.status} ${message.status === 'failed' ? 'clickable' : ''}" ${message.status === 'failed' ? `onclick="chatManager.retryMessage('${message.id}')"` : ''} title="${message.status === 'failed' ? 'Click para reenviar' : ''}">${statusIcon}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add long-press functionality to messages
        this.addMessageLongPressHandlers();

        this.scrollToBottom();
    }

    renderMessageContent(message) {
        const text = message.content || '';
        const type = message.type || 'text';
        const mediaUrl = message.mediaUrl || message.media_url;
        const mediaType = (message.mediaType || message.media_type || '').toLowerCase();

        // Debug log
        if (type === 'image') {
        }

        if (type === 'image' || mediaType.startsWith('image')) {
            // SOLO mostrar imágenes locales (/media/...)
            // Ignorar URLs de 360Dialog que ya expiraron
            if (!mediaUrl || !mediaUrl.startsWith('/media/')) {
                // Para mensajes sin imagen disponible, mostrar el texto del mensaje
                const displayText = text && text !== 'Mensaje multimedia' ? text : '🖼️ Imagen';
                return `<p class="message-text">${displayText}</p>`;
            }

            // Construir URL completa con dominio base
            const baseUrl = window.location.origin;
            const src = `${baseUrl}${mediaUrl}`;


            return `
                <figure class="message-media image" style="margin: 8px 0;">
                    <img src="${src}"
                         alt="Imagen recibida"
                         style="max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer; object-fit: cover;"
                         onclick="window.openImageModal('${src}')"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<p class=\\'message-text\\'>🖼️ Imagen no disponible</p>'">
                    ${text && text !== 'Mensaje multimedia' ? `<figcaption style="font-size: 0.85em; color: #666; margin-top: 4px;">${text}</figcaption>` : ''}
                </figure>
            `;
        }

        if (type === 'video' || mediaType.startsWith('video')) {
            // SOLO mostrar videos locales (/media/...)
            if (!mediaUrl || !mediaUrl.startsWith('/media/')) {
                // Para mensajes echo sin archivo, mostrar el texto del mensaje
                const displayText = text && text !== 'Mensaje multimedia' ? text : '🎥 Video';
                return `<p class="message-text">${displayText}</p>`;
            }

            const baseUrl = window.location.origin;
            const src = `${baseUrl}${mediaUrl}`;

            return `
                <div class="message-media video" style="margin: 8px 0;">
                    <video controls preload="metadata" style="max-width: 280px; max-height: 200px; width: auto; height: auto; border-radius: 8px; object-fit: contain; background: #000; cursor: pointer;" onclick="window.openVideoModal('${src}', '${mediaType || 'video/mp4'}')">
                        <source src="${src}" type="${mediaType || 'video/mp4'}">
                        Tu navegador no soporta el elemento de video.
                    </video>
                    ${text && text !== 'Mensaje multimedia' && text !== 'Message echo: video' ? `<p style="font-size: 0.85em; color: #666; margin-top: 4px;">${text}</p>` : ''}
                </div>
            `;
        }

        if (type === 'audio' || mediaType.startsWith('audio')) {
            // SOLO mostrar audios locales (/media/...)
            if (!mediaUrl || !mediaUrl.startsWith('/media/')) {
                // Para mensajes sin archivo, mostrar el texto del mensaje
                const displayText = text && text !== 'Mensaje multimedia' ? text : '🎤 Audio';
                return `<p class="message-text">${displayText}</p>`;
            }

            const baseUrl = window.location.origin;
            const src = `${baseUrl}${mediaUrl}`;

            // Limpiar mediaType para obtener solo el tipo base
            const cleanMediaType = mediaType ? mediaType.split(';')[0].trim() : 'audio/ogg';


            return `
                <div class="message-media audio" style="margin: 8px 0;">
                    <audio controls preload="metadata" style="width: 300px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <source src="${src}" type="${cleanMediaType}">
                        Tu navegador no soporta el elemento de audio.
                    </audio>
                    <div style="display: none; padding: 8px; background: #f8f9fa; border-radius: 4px; margin-top: 4px;">
                        <i class="fas fa-exclamation-triangle" style="color: #f59e0b; margin-right: 8px;"></i>
                        <span style="font-size: 0.85em; color: #666;">Audio no se puede reproducir</span>
                    </div>
                    ${text && text !== 'Mensaje multimedia' ? `<p style="font-size: 0.85em; color: #666; margin-top: 4px;">${text}</p>` : ''}
                </div>
            `;
        }

        if (type === 'location') {
            // Obtener datos de ubicación desde los campos del mensaje
            const latitude = message.latitude;
            const longitude = message.longitude;
            const name = message.locationName;
            const address = message.locationAddress;

            // Validar que tengamos coordenadas
            if (!latitude || !longitude) {
                return `<p class="message-text">📍 Ubicación compartida</p>`;
            }
            const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

            // Usar OpenStreetMap en lugar de Google Maps (no requiere API key)
            const osmMapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
            const osmStaticMap = `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=300x200&markers=${latitude},${longitude},red-pushpin`;

            return `
                <div class="message-media location" style="margin: 8px 0;">
                    <a href="${osmMapUrl}" target="_blank" rel="noopener" style="text-decoration: none; color: inherit;">
                        <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; max-width: 300px;">
                            <img src="${osmStaticMap}"
                                 alt="Mapa de ubicación"
                                 style="width: 100%; height: 200px; object-fit: cover; display: block;"
                                 onerror="this.parentElement.innerHTML='<div style=\\'padding: 40px; text-align: center; background: #f8f9fa; border-radius: 8px;\\'><i class=\\'fas fa-map-marker-alt fa-2x\\' style=\\'color: #6b7280;\\'></i><p style=\\'margin: 8px 0 0 0; font-size: 0.9em; color: #6b7280;\\'>Mapa no disponible</p></div>'">
                            <div style="padding: 12px; background: white;">
                                ${name ? `<strong style="display: block; margin-bottom: 4px;">${name}</strong>` : ''}
                                ${address ? `<p style="margin: 0 0 8px 0; font-size: 0.9em; color: #666;">${address}</p>` : ''}
                                <p style="margin: 0; font-size: 0.85em; color: #999;">
                                    <i class="fas fa-map-marker-alt"></i> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
                                </p>
                                <p style="margin: 8px 0 0 0; font-size: 0.85em; color: #007bff;">
                                    <i class="fas fa-external-link-alt"></i> Ver en mapa
                                </p>
                            </div>
                        </div>
                    </a>
                </div>
            `;
        }

        if (type === 'document' || mediaType.includes('pdf') || mediaType.includes('officedocument') || mediaType.includes('document') || mediaType.includes('text') || mediaType.includes('application')) {
            // Si no hay mediaUrl, mostrar como texto simple
            if (!mediaUrl || !mediaUrl.startsWith('/media/')) {
                const displayText = text && text !== 'Mensaje multimedia' ? text : '📄 Documento';
                return `<p class="message-text">${displayText}</p>`;
            }

            const filename = text || mediaUrl?.split('/').pop() || 'Archivo adjunto';
            const fileExtension = filename.split('.').pop()?.toLowerCase();
            const baseUrl = window.location.origin;
            const fullUrl = mediaUrl ? `${baseUrl}${mediaUrl}` : '#';

            // Iconos específicos por tipo de archivo
            let fileIcon = 'fas fa-file-alt';
            let fileColor = '#64748b';
            let fileTypeLabel = 'Archivo';

            if (fileExtension === 'pdf') {
                fileIcon = 'fas fa-file-pdf';
                fileColor = '#dc2626';
                fileTypeLabel = 'PDF';
            } else if (['doc', 'docx'].includes(fileExtension)) {
                fileIcon = 'fas fa-file-word';
                fileColor = '#2563eb';
                fileTypeLabel = 'Documento Word';
            } else if (['xls', 'xlsx'].includes(fileExtension)) {
                fileIcon = 'fas fa-file-excel';
                fileColor = '#16a34a';
                fileTypeLabel = 'Hoja de cálculo';
            } else if (['ppt', 'pptx'].includes(fileExtension)) {
                fileIcon = 'fas fa-file-powerpoint';
                fileColor = '#ea580c';
                fileTypeLabel = 'Presentación';
            } else if (['txt', 'md'].includes(fileExtension)) {
                fileIcon = 'fas fa-file-text';
                fileColor = '#64748b';
                fileTypeLabel = 'Texto';
            } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExtension)) {
                fileIcon = 'fas fa-file-archive';
                fileColor = '#7c3aed';
                fileTypeLabel = 'Archivo comprimido';
            } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
                fileIcon = 'fas fa-file-image';
                fileColor = '#059669';
                fileTypeLabel = 'Imagen';
            } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(fileExtension)) {
                fileIcon = 'fas fa-file-video';
                fileColor = '#dc2626';
                fileTypeLabel = 'Video';
            } else if (['mp3', 'wav', 'ogg', 'aac', 'flac'].includes(fileExtension)) {
                fileIcon = 'fas fa-file-audio';
                fileColor = '#7c3aed';
                fileTypeLabel = 'Audio';
            } else if (['vcf', 'vcard'].includes(fileExtension)) {
                fileIcon = 'fas fa-address-card';
                fileColor = '#0891b2';
                fileTypeLabel = 'Contacto';
            }

            return `
                <div class="message-media document" style="margin: 8px 0;">
                    <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="font-size: 24px; color: ${fileColor};">
                            <i class="${fileIcon}"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 500; color: #1a202c; margin-bottom: 2px; word-break: break-word;">${filename}</div>
                            <div style="font-size: 12px; color: #64748b;">${fileTypeLabel}</div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            ${mediaUrl ? `
                                <button onclick="window.open('${fullUrl}', '_blank')" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                                    <i class="fas fa-external-link-alt"></i>
                                    Abrir
                                </button>
                                <button onclick="window.downloadFile('${fullUrl}', '${filename}')" style="padding: 6px 12px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                                    <i class="fas fa-download"></i>
                                    Descargar
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        // Handle interactive messages (like flow responses)
        if (type === 'interactive' && message.flowResponse) {
            const flowResponse = message.flowResponse;
            let interactiveHtml = `<div class="interactive-message">`;

            // Show the flow header with icon, name and status
            interactiveHtml += `<div class="interactive-header">`;
            interactiveHtml += `<div class="flow-info">`;
            interactiveHtml += `<div class="flow-icon">💬</div>`;
            if (flowResponse.name) {
                interactiveHtml += `<span class="flow-name">${flowResponse.name}</span>`;
            }
            interactiveHtml += `</div>`;
            if (flowResponse.body) {
                interactiveHtml += `<div class="flow-status">${flowResponse.body}</div>`;
            }
            interactiveHtml += `</div>`;

            // Show the parsed form data if available
            if (flowResponse.parsedData) {
                interactiveHtml += `<div class="flow-response-data">`;
                interactiveHtml += `<h4>Datos del formulario</h4>`;
                interactiveHtml += `<div class="form-data-grid">`;

                Object.entries(flowResponse.parsedData).forEach(([key, value]) => {
                    // Skip flow_token and other internal fields
                    if (key === 'flow_token' || key.startsWith('screen_')) {
                        return;
                    }

                    const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const displayValue = typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value);

                    // Determine data type for styling
                    let dataType = 'text';
                    if (typeof value === 'boolean') {
                        dataType = 'boolean';
                    } else if (key.toLowerCase().includes('email') || key.toLowerCase().includes('correo')) {
                        dataType = 'email';
                    } else if (key.toLowerCase().includes('telefono') || key.toLowerCase().includes('teléfono') || key.toLowerCase().includes('phone')) {
                        dataType = 'phone';
                    }

                    interactiveHtml += `
                        <div class="form-data-item">
                            <span class="form-data-label">${displayKey}:</span>
                            <span class="form-data-value" data-type="${dataType}">${displayValue}</span>
                        </div>
                    `;
                });

                interactiveHtml += `</div></div>`;
            }

            interactiveHtml += `</div>`;
            return interactiveHtml;
        }

        // Si no hay texto pero es un mensaje multimedia, mostrar el contenido multimedia
        if (!text) {
            // Intentar mostrar el contenido multimedia basado en el tipo
            if (mediaUrl) {
                if (mediaType && mediaType.includes('image')) {
                    // Ya se debe haber manejado arriba en el caso de imagen
                    return `<p class="message-text">🖼️ Imagen</p>`;
                } else if (mediaType && mediaType.includes('video')) {
                    // Ya se debe haber manejado arriba en el caso de video
                    return `<p class="message-text">🎥 Video</p>`;
                } else if (mediaType && mediaType.includes('audio')) {
                    // Ya se debe haber manejado arriba en el caso de audio
                    return `<p class="message-text">🎤 Audio</p>`;
                } else {
                    // Para otros tipos de archivos, mostrar un enlace
                    const filename = mediaUrl.split('/').pop() || 'archivo';
                    return `<p class="message-text">📄 ${filename}</p>`;
                }
            } else {
                // Si no hay URL de media, mostrar un mensaje genérico
                return `<p class="message-text">📎 Archivo adjunto</p>`;
            }
        }

        // Formatear texto con enlaces clickeables
        const formattedText = this.formatTextWithLinks(text);
        return `<p class="message-text">${formattedText}</p>`;
    }
    
    /**
     * Formatea texto para convertir URLs en enlaces clickeables
     */
    formatTextWithLinks(text) {
        if (!text) return '';
        
        // Expresión regular para detectar URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        
        // Reemplazar URLs con enlaces HTML
        return text.replace(urlRegex, url => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`;
        });
    }
    
    /**
     * Formatea el último mensaje para la vista previa de conversación
     * Solo se usa en la lista de conversaciones, no en el chat
     */
    formatLastMessage(message) {
        if (!message) return 'Sin mensajes';
        
        // Detectar mensajes multimedia y mostrar descripciones específicas
        // Esto solo afecta a la vista previa en la lista de conversaciones
        
        // Detectar imágenes
        if (message.includes('<figure class="message-media image"') || 
            message.includes('<div class="message-media image"') || 
            message.includes('<i class="fas fa-image">')) {
            return '🖼️ Imagen';
        } 
        
        // Detectar videos
        else if (message.includes('<div class="message-media video"') || 
                 message.includes('<i class="fas fa-video">') || 
                 message.includes('<video')) {
            return '🎥 Video';
        } 
        
        // Detectar audios
        else if (message.includes('<div class="message-media audio"') || 
                 message.includes('<i class="fas fa-microphone">') || 
                 message.includes('<audio')) {
            return '🎤 Audio';
        } 
        
        // Detectar documentos
        else if (message.includes('<div class="message-media document"') || 
                 message.includes('<i class="fas fa-file">') || 
                 message.includes('<i class="fas fa-file-alt">') || 
                 message.includes('<i class="fas fa-paperclip">')) {
            return '📄 Documento';
        } 
        
        // Detectar ubicaciones
        else if (message.includes('<div class="message-media location"') || 
                 message.includes('<i class="fas fa-map-marker">') || 
                 message.includes('fas fa-map-marker-alt')) {
            return '📍 Ubicación';
        }
        
        // Mensaje multimedia genérico
        else if (message.startsWith('Mensaje multimedia') || 
                 message.includes('message-media')) {
            return '📎 Archivo adjunto';
        }
        
        // Limitar la longitud del mensaje para la vista previa
        const maxLength = 30;
        if (message.length > maxLength) {
            return message.substring(0, maxLength) + '...';
        }
        
        return message;
    }
    
    /**
     * Marca una conversación como leída en el servidor
     */
    async markConversationAsRead(conversationId) {
        try {
            const response = await fetch('/api/chat-live/mark-conversation-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationId
                })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Error desconocido');
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error marcando conversación como leída:', error);
            throw error;
        }
    }

    /**
     * Envía un mensaje
     */
    /**
     * Reemplaza variables en el texto
     * Detecta {{variable}} y las reemplaza con valores reales
     */
    replaceVariables(text) {
        if (!text) return text;
        
        // Obtener datos del contacto actual
        const contact = this.currentConversation;
        if (!contact) return text;
        
        // Mapeo de variables disponibles
        const variables = {
            '1': contact.name || '',           // {{1}} = Nombre del contacto
            '2': contact.phone || '',          // {{2}} = Teléfono
            '3': contact.email || '',          // {{3}} = Email
            'name': contact.name || '',        // {{name}} = Nombre
            'phone': contact.phone || '',      // {{phone}} = Teléfono
            'email': contact.email || '',      // {{email}} = Email
        };
        
        // Reemplazar todas las variables encontradas
        let replacedText = text;
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            replacedText = replacedText.replace(regex, variables[key]);
        });
        
        return replacedText;
    }

    async sendMessage() {
        const input = this.elements.messageInput;
        if (!input || !this.currentConversation) return;

        let text = input.value.trim();
        if (!text) return;
        
        // ✅ Reemplazar variables en el texto
        text = this.replaceVariables(text);

        // Limpiar input inmediatamente
        input.value = '';

        // Mostrar indicador de envío (deshabilitar input temporalmente)
        const sendButton = this.elements.sendButton;
        const originalText = sendButton ? sendButton.innerHTML : '';
        if (sendButton) {
            sendButton.disabled = true;
            sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        input.disabled = true;

        // Crear mensaje temporal con estado "sending"
        const tempMessage = {
            id: `temp_${Date.now()}`,
            direction: 'outbound',
            type: 'text',
            status: 'sending',
            content: text,
            timestamp: new Date().toISOString(),
            messageId: null
        };

        // Agregar mensaje temporal a la lista local inmediatamente
        this.messages.push(tempMessage);
        this.renderMessages();
        this.scrollToBottom();

        try {
            // Preparar body con teléfono si es conversación nueva
            const body = { 
                text, 
                sender: 'agent', 
                type: 'text'
            };
            
            // Si es conversación nueva (iniciada por nosotros), incluir el teléfono
            if (this.currentConversation.isNew) {
                body.phone = this.currentConversation.phone;
            }
            
            const response = await fetch(`/api/chat-live/conversations/${encodeURIComponent(this.currentConversation.id)}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                // Actualizar mensaje temporal con datos reales del servidor
                const sentMessage = result.data;
                const messageIndex = this.messages.findIndex(msg => msg.id === tempMessage.id);

                if (messageIndex !== -1) {
                    this.messages[messageIndex] = {
                        id: sentMessage.id || sentMessage.messageId || tempMessage.id,
                        direction: 'outbound',
                        type: 'text',
                        status: sentMessage.status || 'sent',
                        content: sentMessage.text || sentMessage.content || text,
                        timestamp: sentMessage.timestamp || sentMessage.sentAt || sentMessage.created_at || tempMessage.timestamp,
                        messageId: sentMessage.messageId || sentMessage.id
                    };
                    this.renderMessages();
                }
            } else {
                throw new Error(result.error || 'Error desconocido');
            }

            // Actualizar conversaciones para mostrar el último mensaje
            await this.loadConversations();

        } catch (error) {
            console.error('❌ Error enviando mensaje:', error);

            // Marcar mensaje como fallido
            const messageIndex = this.messages.findIndex(msg => msg.id === tempMessage.id);
            if (messageIndex !== -1) {
                this.messages[messageIndex].status = 'failed';
                this.renderMessages();
            }

            alert('Error enviando mensaje: ' + error.message);
        } finally {
            // Restaurar estado del botón y input
            if (sendButton) {
                sendButton.disabled = false;
                sendButton.innerHTML = originalText;
            }
            input.disabled = false;
            input.focus();
        }
    }

    /**
     * Maneja el indicador de escritura
     */
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
        }, this.config.typingTimeout);
    }

    /**
     * Muestra el input del chat
     */
    showChatInput() {
        if (this.elements.chatInputContainer) {
            this.elements.chatInputContainer.style.display = 'block';
        }
    }

    /**
     * Oculta el input del chat
     */
    hideChatInput() {
        if (this.elements.chatInputContainer) {
            this.elements.chatInputContainer.style.display = 'none';
        }
    }

    /**
     * Reintenta enviar un mensaje fallido
     */
    async retryMessage(messageId) {
        console.log('Intentando reenviar mensaje con ID:', messageId);
        console.log('Mensajes actuales:', this.messages.map(m => ({ id: m.id, status: m.status, content: m.content?.substring(0, 50) })));

        // Intentar encontrar el mensaje por ID exacto primero
        let message = this.messages.find(msg => msg.id === messageId);

        // Si no se encuentra por ID exacto, intentar por ID numérico (en caso de que sea string vs number)
        if (!message) {
            const numericId = parseInt(messageId);
            message = this.messages.find(msg => parseInt(msg.id) === numericId);
        }

        // Si aún no se encuentra, buscar por contenido similar (último mensaje fallido)
        if (!message) {
            const failedMessages = this.messages.filter(msg => msg.status === 'failed' && msg.direction === 'outbound');
            if (failedMessages.length === 1) {
                message = failedMessages[0];
                console.log('Usando mensaje fallido encontrado por contenido:', message.id);
            }
        }

        if (!message) {
            console.warn('Mensaje no encontrado:', messageId);
            alert('Mensaje no encontrado. Es posible que ya haya sido reenviado o eliminado.');
            return;
        }

        if (message.status !== 'failed') {
            console.warn('Mensaje no está fallido:', messageId, 'status:', message.status);
            alert('Este mensaje no está marcado como fallido.');
            return;
        }

        console.log('Reintentando envío de mensaje:', messageId);

        // Cambiar estado a "sending"
        message.status = 'sending';
        this.renderMessages();

        try {
            // Preparar body con teléfono si es conversación nueva
            const body = { 
                text: message.content,
                sender: 'agent',
                type: message.type || 'text'
            };
            
            // Si es conversación nueva (iniciada por nosotros), incluir el teléfono
            if (this.currentConversation.isNew) {
                body.phone = this.currentConversation.phone;
            }
            
            const response = await fetch(`/api/chat-live/conversations/${encodeURIComponent(this.currentConversation.id)}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                // Actualizar mensaje con datos reales del servidor
                const sentMessage = result.data;
                message.id = sentMessage.id || sentMessage.messageId || message.id;
                message.status = sentMessage.status || 'sent';
                message.timestamp = sentMessage.timestamp || sentMessage.sentAt || sentMessage.created_at || message.timestamp;
                message.messageId = sentMessage.messageId || sentMessage.id;

                this.renderMessages();
                console.log('Mensaje reenviado exitosamente:', messageId);
            } else {
                throw new Error(result.error || 'Error desconocido');
            }

        } catch (error) {
            console.error('Error reintentando envío:', error);
            message.status = 'failed';
            this.renderMessages();
            alert('Error reintentando envío: ' + error.message);
        }
    }

    /**
     * Obtiene el icono apropiado para el estado del mensaje
     */
    getMessageStatusIcon(status) {
        switch (status) {
            case 'sending':
                // Círculo rodando de carga
                return '<i class="fas fa-spinner fa-spin" style="color: #6366f1; font-size: 0.9em;"></i>';
            case 'sent':
                // Un chulo (enviado)
                return '<i class="fas fa-check" style="color: #6b7280; font-size: 0.9em;"></i>';
            case 'delivered':
                // Dos chulos (entregado)
                return '<i class="fas fa-check-double" style="color: #6b7280; font-size: 0.9em;"></i>';
            case 'read':
                // Dos chulos en verde (leído)
                return '<i class="fas fa-check-double" style="color: #10b981; font-size: 0.9em;"></i>';
            case 'failed':
                // Exclamación en rojo (fallido)
                return '<i class="fas fa-exclamation-circle" style="color: #ef4444; font-size: 0.9em;"></i>';
            case 'pending':
                // Reloj (pendiente)
                return '<i class="fas fa-clock" style="color: #f59e0b; font-size: 0.9em;"></i>';
            default:
                return '<i class="fas fa-clock" style="color: #9ca3af; font-size: 0.9em;"></i>';
        }
    }

    /**
     * Muestra la información del cliente
     */
    showClientInfo() {
        if (!this.elements.clientInfoPanel || !this.currentConversation) return;

        this.elements.clientInfoPanel.style.display = 'block';
        this.adjustChatLayout(true);

        // Actualizar el icono en el header
        const toggleIcon = document.querySelector('.info-toggle-icon i');
        if (toggleIcon) {
            toggleIcon.className = 'fas fa-chevron-right';
        }

        // Cargar la información del cliente si no está cargada
        this.loadClientDetails();
    }

    // startAutoRefresh eliminado - Socket.IO maneja todas las actualizaciones en tiempo real

    /**
     * Actualiza el indicador de estado
     */
    updateStatusIndicator(status = 'online') {
        // Eliminada la funcionalidad de estado en línea
    }
    
    /**
     * Obtiene el texto de estado
     */
    getStatusText(status) {
        const mapping = {
            active: 'Activo',
            waiting: 'Esperando',
            closed: 'Cerrado',
            offline: 'Desconectado'
        };
        return mapping[status] || 'Desconocido';
    }

    /**
     * Añade manejadores de long-press a los mensajes
     */
    addMessageLongPressHandlers() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            let longPressTimer;
            let isLongPress = false;

            // Touch events for mobile
            message.addEventListener('touchstart', (e) => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    // ✅ Marcar mensaje como seleccionado
                    message.classList.add('selected');
                    this.showMessageContextMenu(e, message);
                }, 500); // 500ms for long press
            }, { passive: true });

            message.addEventListener('touchend', (e) => {
                clearTimeout(longPressTimer);
                if (!isLongPress) {
                    // Normal tap - could add other functionality here
                }
            }, { passive: true });

            message.addEventListener('touchmove', (e) => {
                clearTimeout(longPressTimer);
            }, { passive: true });

            // Mouse events for desktop
            message.addEventListener('mousedown', (e) => {
                if (e.button === 2) { // Right click
                    e.preventDefault();
                    // ✅ Marcar mensaje como seleccionado
                    message.classList.add('selected');
                    this.showMessageContextMenu(e, message);
                    return;
                }

                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    // ✅ Marcar mensaje como seleccionado
                    message.classList.add('selected');
                    this.showMessageContextMenu(e, message);
                }, 500);
            });

            message.addEventListener('mouseup', (e) => {
                clearTimeout(longPressTimer);
            });

            message.addEventListener('mousemove', (e) => {
                clearTimeout(longPressTimer);
            });

            // Prevent context menu on right click since we handle it
            message.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
        });
    }

    /**
     * Muestra el menú contextual para mensajes
     */
    showMessageContextMenu(event, messageElement) {
        const messageId = messageElement.dataset.messageId;
        const message = this.messages.find(m => m.id == messageId);

        if (!message) return;

        // Remove any existing context menu
        this.hideMessageContextMenu();

        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'message-context-menu';
        contextMenu.innerHTML = `
            <div class="context-menu-item delete-message" data-message-id="${messageId}">
                <i class="fas fa-trash"></i>
                <span>Eliminar mensaje</span>
            </div>
        `;

        // Position the menu
        const rect = messageElement.getBoundingClientRect();
        const chatContainer = this.elements.chatMessages;

        let top = rect.top - chatContainer.scrollTop;
        let left = rect.left;

        // Adjust position if menu would go off screen
        if (top + 60 > chatContainer.clientHeight) {
            top = rect.bottom - chatContainer.scrollTop - 60;
        }

        if (left + 150 > window.innerWidth) {
            left = window.innerWidth - 160;
        }

        contextMenu.style.top = `${top}px`;
        contextMenu.style.left = `${left}px`;

        // Add to DOM
        document.body.appendChild(contextMenu);

        // Add click handler for delete
        contextMenu.querySelector('.delete-message').addEventListener('click', () => {
            this.deleteMessage(messageId);
            this.hideMessageContextMenu();
        });

        // Close menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', this.hideMessageContextMenu.bind(this), { once: true });
            document.addEventListener('touchstart', this.hideMessageContextMenu.bind(this), { once: true });
        }, 10);

        // Highlight the selected message
        messageElement.classList.add('message-selected');
    }

    /**
     * Oculta el menú contextual
     */
    hideMessageContextMenu() {
        const contextMenu = document.querySelector('.message-context-menu');
        if (contextMenu) {
            contextMenu.remove();
        }

        // Remove highlight from selected message
        document.querySelectorAll('.message-selected').forEach(el => {
            el.classList.remove('message-selected');
        });
    }

    /**
     * Elimina un mensaje
     */
    async deleteMessage(messageId) {
        const message = this.messages.find(m => m.id == messageId);
        if (!message) return;

        const confirmed = confirm('¿Eliminar este mensaje? Esta acción no se puede deshacer.');
        if (!confirmed) return;

        try {
            // Find message in database by content and timestamp (since we don't have direct message ID mapping)
            const messageIndex = this.messages.findIndex(m => m.id == messageId);

            if (messageIndex === -1) return;

            // Remove from local messages array
            this.messages.splice(messageIndex, 1);

            // Re-render messages
            this.renderMessages();

            // Try to delete from database (this might not work perfectly since we don't have exact ID mapping)
            // For now, just remove from UI - in a real implementation you'd need proper message ID tracking

            console.log(`Mensaje ${messageId} eliminado localmente`);

        } catch (error) {
            console.error('Error eliminando mensaje:', error);
            alert('Error eliminando mensaje');
        }
    }

    /**
     * Desplaza hacia abajo
     */
    scrollToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }
    
    /**
     * Alterna la visibilidad del panel de información del cliente
     */
    toggleClientInfo() {
        const panel = this.elements.clientInfoPanel;
        if (!panel) return;

        const isVisible = panel.style.display !== 'none';
        if (isVisible) {
            this.hideClientInfo();
        } else {
            this.showClientInfo();
        }
    }

    /**
     * Muestra el panel de información del cliente
     */
    showClientInfo() {
        if (!this.elements.clientInfoPanel || !this.currentConversation) return;

        this.elements.clientInfoPanel.style.display = 'block';
        this.adjustChatLayout(true);

        // Actualizar el icono en el header
        const toggleIcon = document.querySelector('.info-toggle-icon i');
        if (toggleIcon) {
            toggleIcon.className = 'fas fa-chevron-right';
        }

        // Cargar la información del cliente si no está cargada
        this.loadClientDetails();
    }

    /**
     * Oculta el panel de información del cliente
     */
    hideClientInfo() {
        if (!this.elements.clientInfoPanel) return;

        this.elements.clientInfoPanel.style.display = 'none';
        this.adjustChatLayout(false);

        // Actualizar el icono en el header
        const toggleIcon = document.querySelector('.info-toggle-icon i');
        if (toggleIcon) {
            toggleIcon.className = 'fas fa-chevron-left';
        }
    }

    /**
     * Ajusta el layout del chat según la visibilidad del panel
     */
    adjustChatLayout(isPanelVisible) {
        const chatPanel = document.querySelector('.chat-panel');
        const clientInfoPanel = document.querySelector('.client-info-panel');

        if (isPanelVisible) {
            // Panel visible - mostrar el panel y ajustar el chat
            if (clientInfoPanel) {
                clientInfoPanel.style.display = 'flex';
            }
            if (chatPanel) {
                chatPanel.style.flex = '1';
            }
        } else {
            // Panel oculto - ocultar el panel y expandir el chat
            if (clientInfoPanel) {
                clientInfoPanel.style.display = 'none';
            }
            if (chatPanel) {
                chatPanel.style.flex = '1';
            }
        }
    }
    
    /**
     * Carga los detalles del cliente en el panel
     */
    async loadClientDetails() {
        if (!this.currentConversation) return;

        // Cachear el contact ID si no está en cache
        if (!this.contactIdCache.has(this.currentConversation.phone)) {
            try {
                const contactResponse = await fetch(`/api/contacts?search=${encodeURIComponent(this.currentConversation.phone)}&limit=1`);
                const contactData = await contactResponse.json();

                if (contactData.success && contactData.data && contactData.data.length > 0) {
                    this.contactIdCache.set(this.currentConversation.phone, contactData.data[0].id);
                }
            } catch (error) {
                console.warn('Error obteniendo contact ID para cache:', error);
            }
        }

        // Obtener el tiempo del último mensaje (enviado o recibido)
        let lastActivity = this.currentConversation.lastMessageTime;

        // Si hay mensajes en la conversación actual, usar el más reciente
        if (this.messages && this.messages.length > 0) {
            // Ordenar mensajes por timestamp (más reciente primero)
            const sortedMessages = [...this.messages].sort((a, b) => {
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });

            // Usar el timestamp del mensaje más reciente
            if (sortedMessages[0] && sortedMessages[0].timestamp) {
                lastActivity = sortedMessages[0].timestamp;
            }
        }

        const { name, phone, status } = this.currentConversation;
        // Si no hay nombre, usar el teléfono formateado
        const displayName = name && name.trim() !== '' ? name : (phone ? `+${phone}` : 'Contacto desconocido');
        const firstName = name?.split(' ')[0] || '';
        const lastName = name?.split(' ').slice(1).join(' ') || '';
        this.elements.clientDetails.innerHTML = `
            <!-- Campos del sistema -->
            <div class="client-info-section">
                <h3 class="section-title">Campos del sistema</h3>
                <div class="client-info-item editable-field">
                    <label>Nombre:</label>
                    <div class="field-value-container" data-field="firstName">
                        <span class="field-value">${firstName || '(vacío)'}</span>
                        <button class="edit-field-btn" data-field="firstName"><i class="fas fa-edit"></i></button>
                    </div>
                </div>
                <div class="client-info-item editable-field">
                    <label>Apellido:</label>
                    <div class="field-value-container" data-field="lastName">
                        <span class="field-value">${lastName || '(vacío)'}</span>
                        <button class="edit-field-btn" data-field="lastName"><i class="fas fa-edit"></i></button>
                    </div>
                </div>
                <div class="client-info-item">
                    <label>Teléfono:</label>
                    <span>${phone}</span>
                </div>
                <div class="client-info-item">
                    <label>Última actividad:</label>
                    <span>${lastActivity ? this.formatTime(lastActivity) : '—'}</span>
                </div>
            </div>


            <!-- Sección de Automatizaciones -->
            <div class="client-info-section">
                <h3 class="section-title">Automatizaciones</h3>
                <div class="automation-controls">
                    <button id="toggleAutomation" class="btn btn-sm btn-outline">
                        <i class="fas fa-pause"></i> Pausar automatizaciones
                    </button>
                </div>
            </div>

            <!-- Etiquetas -->
            <div class="client-info-section">
                <h3 class="section-title">Etiquetas</h3>
                <div id="contactTags" class="contact-tags-container" style="display: none;">
                    <!-- Las etiquetas se cargarán aquí -->
                </div>
                <button id="addTagBtn" class="btn-add-tag">
                    <i class="fas fa-plus"></i> Añadir etiqueta
                </button>
            </div>

            <!-- Campos personalizados -->
            <div class="client-info-section">
                <h3 class="section-title">Campos personalizados</h3>
                <div id="customFields" class="contact-custom-fields-container" style="display: none;">
                    <!-- Los campos personalizados se cargarán aquí -->
                </div>
                <button id="addCustomFieldBtn" class="btn-add-custom-field">
                    <i class="fas fa-plus"></i> Campo personalizado
                </button>
            </div>
        `;

        // Inicializar eventos para edición de campos
        this.initClientInfoEvents();
    }

    /**
     * Alias para compatibilidad
     */
    loadClientInfo() {
        this.loadClientDetails();
    }

    /**
     * Inicializa los eventos del panel de información del cliente
     */
    initClientInfoEvents() {
        if (!this.elements.clientDetails) return;

        // Añadir eventos a los botones de edición de campos
        const editButtons = this.elements.clientDetails.querySelectorAll('.edit-field-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const field = e.currentTarget.dataset.field;
                this.showFieldEditForm(field);
            });
        });

        // Cargar etiquetas del contacto
        this.loadContactTags();

        // Cargar campos personalizados
        this.loadCustomFields();

        // Añadir evento al botón de añadir campo personalizado
        const addCustomFieldBtn = document.getElementById('addCustomFieldBtn');
        if (addCustomFieldBtn) {
            addCustomFieldBtn.addEventListener('click', () => {
                this.showAddCustomFieldModal();
            });
        }

        // Make field values clickable to edit
        const fieldValues = this.elements.clientDetails.querySelectorAll('.field-value');
        fieldValues.forEach(span => {
            span.style.cursor = 'pointer';
            span.addEventListener('click', () => {
                const field = span.closest('.field-value-container').dataset.field;
                this.showFieldEditForm(field);
            });
        });
    }

    /**
     * Muestra el formulario de edición para un campo
     */
    showFieldEditForm(fieldName) {
        if (!this.currentConversation) return;
        
        const fieldContainer = this.elements.clientDetails.querySelector(`.editable-field [data-field="${fieldName}"]`).closest('.editable-field');
        if (!fieldContainer) {
            console.error('No se encontró el contenedor del campo:', fieldName);
            return;
        }
        
        const fieldValue = fieldContainer.querySelector('.field-value').textContent.replace('(vacío)', '');
        
        // Guardar el contenido original para poder restaurarlo si se cancela
        fieldContainer.dataset.originalContent = fieldContainer.innerHTML;
        
        // Crear formulario de edición (sin botones)
        const editForm = document.createElement('div');
        editForm.className = 'field-edit-form';
        editForm.innerHTML = `
            <input type="text" value="${fieldValue}" id="edit-${fieldName}" placeholder="Ingresa el valor">
        `;
        
        // Reemplazar el contenido del campo con el formulario
        fieldContainer.innerHTML = '';
        fieldContainer.appendChild(editForm);
        
        // Enfocar el input
        const input = fieldContainer.querySelector('input');
        input.focus();
        input.select();
        
        // Variable para evitar guardar dos veces
        let isSaving = false;
        
        // Guardar al presionar Enter
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !isSaving) {
                isSaving = true;
                e.preventDefault();
                this.saveFieldEdit(fieldName, 'value', input.value);
            }
        });
        
        // Guardar al hacer clic fuera del input
        input.addEventListener('blur', () => {
            if (!isSaving) {
                isSaving = true;
                this.saveFieldEdit(fieldName, 'value', input.value);
            }
        });
    }

    /**
     * Guarda la edición de un campo
     */
    async saveFieldEdit(fieldName, fieldType, value) {
        if (!this.currentConversation) return;
        
        console.log(`💾 Guardando campo ${fieldName} con valor: "${value}"`);
        
        // Obtener el valor actual para comparar
        let currentValue = '';
        if (fieldName === 'firstName') {
            currentValue = this.currentConversation.name?.split(' ')[0] || '';
        } else if (fieldName === 'lastName') {
            currentValue = this.currentConversation.name?.split(' ').slice(1).join(' ') || '';
        }
        
        console.log(`Valor actual: "${currentValue}", Nuevo valor: "${value}"`);
        
        // Si el valor no ha cambiado, no hacer nada
        if (value.trim() === currentValue.trim()) {
            console.log('El valor no ha cambiado, restaurando vista');
            // Restaurar la vista sin hacer llamada al servidor
            const fieldElement = document.querySelector(`[data-field="${fieldName}"]`);
            if (fieldElement) {
                const fieldContainer = fieldElement.closest('.editable-field');
                if (fieldContainer && fieldContainer.dataset.originalContent) {
                    fieldContainer.innerHTML = fieldContainer.dataset.originalContent;

                    // Volver a añadir el evento al botón de edición
                    const editButton = fieldContainer.querySelector('.edit-field-btn');
                    if (editButton) {
                        editButton.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const field = e.currentTarget.dataset.field;
                            this.showFieldEditForm(field);
                        });
                    }
                }
            }
            return;
        }
        
        try {
            // Mostrar spinner de carga
            const fieldElement = document.querySelector(`[data-field="${fieldName}"]`);
            if (fieldElement) {
                const fieldContainer = fieldElement.closest('.editable-field');
                if (fieldContainer) {
                    // Guardar contenido original
                    fieldContainer.dataset.originalContent = fieldContainer.innerHTML;
                    // Mostrar spinner
                    fieldContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fas fa-spinner fa-spin" style="color: #6366f1; font-size: 1.2em;"></i><span style="color: #6366f1;">Guardando...</span></div>';
                }
            }

            // Obtener el contactId real desde el cache
            const phone = this.currentConversation.phone;
            if (!phone) {
                console.error('No se pudo obtener el teléfono del contacto');
                return;
            }

            // Usar el contact ID del cache
            let realContactId = this.contactIdCache.get(phone);
            if (!realContactId) {
                console.error('Contact ID no encontrado en cache, intentando obtenerlo...');
                // Fallback: buscar el contacto si no está en cache
                try {
                    const contactResponse = await fetch(`/api/contacts?search=${encodeURIComponent(phone)}&limit=1`);
                    const contactData = await contactResponse.json();

                    if (!contactData.success || !contactData.data || contactData.data.length === 0) {
                        console.error('No se encontró el contacto en la base de datos');
                        return;
                    }

                    realContactId = contactData.data[0].id;
                    this.contactIdCache.set(phone, realContactId); // Cachear para futuras llamadas
                } catch (fallbackError) {
                    console.error('Error en fallback para obtener contact ID:', fallbackError);
                    return;
                }
            }

            // Actualizar en el servidor
            const response = await fetch('/api/chat-live/update-contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contactId: realContactId,
                    phone: phone,
                    field: fieldName,
                    value
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Actualizar localmente
                if (fieldName === 'firstName' || fieldName === 'lastName') {
                    // Reconstruir el nombre completo
                    const currentName = this.currentConversation.name || '';
                    const nameParts = currentName.split(' ');

                    if (fieldName === 'firstName') {
                        // Actualizar el primer nombre, mantener el resto
                        nameParts[0] = value;
                    } else if (fieldName === 'lastName') {
                        // Actualizar el apellido (todo después del primer nombre)
                        if (nameParts.length > 1) {
                            // Reemplazar todo después del primer nombre con el nuevo apellido
                            nameParts.splice(1, nameParts.length - 1, value);
                        } else {
                            // Si no hay apellido, añadirlo
                            nameParts.push(value);
                        }
                    }

                    this.currentConversation.name = nameParts.filter(part => part.trim()).join(' ').trim();

                    // Actualizar la vista de conversaciones
                    this.renderConversations();

                    // Actualizar el header del chat
                    this.updateChatHeader();
                }
                
                // Volver a mostrar la información del cliente
                this.showClientInfo();
            } else {
                throw new Error(result.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('❌ Error actualizando campo:', error);
            const fieldElement = document.querySelector(`[data-field="${fieldName}"]`);
            if (fieldElement) {
                const fieldContainer = fieldElement.closest('.editable-field');
                if (fieldContainer) {
                    this.cancelFieldEdit(fieldContainer);
                }
            }
        }
    }

    /**
     * Cancela la edición de un campo
     */
    cancelFieldEdit(fieldContainer) {
        // Restaurar el contenido original
        if (fieldContainer.dataset.originalContent) {
            fieldContainer.innerHTML = fieldContainer.dataset.originalContent;
            
            // Volver a añadir el evento al botón de edición
            const editButton = fieldContainer.querySelector('.edit-field-btn');
            if (editButton) {
                editButton.addEventListener('click', (e) => {
                    const field = e.currentTarget.dataset.field;
                    // Desactivado: no abrir formulario de edición
                    // this.showFieldEditForm(field);
                });
            }
        }
    }

    /**
     * Formatea la fecha para mostrar tiempo relativo
     */
    formatTime(timestamp) {
        if (!timestamp) return '—';
        
        // Asegurarse de que timestamp sea un objeto Date
        let date;
        if (typeof timestamp === 'string') {
            // Manejar diferentes formatos de fecha
            if (timestamp.includes(' ')) {
                // Formato "YYYY-MM-DD HH:MM:SS" - asumimos UTC
                const [datePart, timePart] = timestamp.split(' ');
                date = new Date(`${datePart}T${timePart}Z`); // Añadir Z para indicar UTC
            } else {
                date = new Date(timestamp);
            }
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            return '—';
        }
        
        if (Number.isNaN(date.getTime())) return '—';

        const now = new Date();
        const diffMs = now - date;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        // Calcular el formato de tiempo
        let formattedTime;
        
        // Si es negativo (futuro), mostrar "Ahora"
        if (diffMs < 0) {
            formattedTime = 'Ahora';
        }
        // Menos de 1 minuto
        else if (diffSeconds < 60) {
            formattedTime = 'Ahora';
        }
        // Menos de 1 hora - mostrar minutos
        else if (diffMinutes < 60) {
            formattedTime = `${diffMinutes}m`;
        }
        // Menos de 24 horas - mostrar horas
        else if (diffHours < 24) {
            formattedTime = `${diffHours}h`;
        }
        // Menos de 7 días - mostrar días
        else if (diffDays < 7) {
            formattedTime = `${diffDays}d`;
        }
        // Más de 7 días - mostrar fecha completa
        else {
            formattedTime = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        
        return formattedTime;
    }

    /**
     * Maneja el nuevo mensaje
     */
    handleNewMessage(payload) {
        if (!payload) return;

        const phone = payload.contactPhone || payload.phone || payload.to || payload.from;
        if (!phone) {
            this.loadConversations();
            return;
        }

        const normalized = ChatLiveManager.normalizeMessage({
            id: payload.id,
            direction: payload.direction || 'inbound',
            type: payload.type,
            status: payload.status || 'received',
            content: payload.message || payload.text || payload.content,
            timestamp: payload.timestamp
        });

        const conversation = this.conversations.find((conv) => conv.phone === phone);
        if (!conversation) {
            this.loadConversations();
            return;
        }

        conversation.lastMessage = normalized.content;
        conversation.lastMessageTime = normalized.timestamp;
        if (normalized.direction === 'inbound') {
            conversation.unreadCount = (conversation.unreadCount || 0) + 1;
        }

        // Actualizar la conversación en la lista
        conversation.lastMessage = normalized.content;
        conversation.lastMessageTime = normalized.timestamp;
        if (normalized.direction === 'inbound') {
            conversation.unreadCount = (conversation.unreadCount || 0) + 1;
        }

        // Si estamos en la conversación del mensaje, agregarlo y marcar como leído
        if (this.currentConversation && this.currentConversation.phone === phone) {
            // Prevenir duplicados: verificar si el mensaje ya existe
            const exists = this.messages.some(msg =>
                msg.id === normalized.id ||
                (msg.content === normalized.content &&
                 Math.abs(new Date(msg.timestamp).getTime() - new Date(normalized.timestamp).getTime()) < 1000)
            );

            if (!exists) {
                this.messages.push(normalized);
                this.renderMessages();
                // Marcar como leído inmediatamente si estamos en la conversación
                conversation.unreadCount = 0;
            }
        }

        // Recargar conversaciones desde el servidor para asegurar consistencia
        this.loadConversations();
    }

    /**
     * Maneja message echoes (confirmación de mensajes enviados)
     * Los echoes se muestran como mensajes SALIENTES (outbound)
     */
    handleMessageEcho(payload) {
        if (!payload) return;

        // Los echoes son confirmaciones de mensajes que NOSOTROS enviamos
        // Se muestran como mensajes salientes (outbound)

        const phone = payload.to || payload.contactPhone || payload.phone;
        if (!phone) return;

        // Buscar la conversación
        const conversation = this.conversations.find((conv) => conv.phone === phone);
        if (!conversation) return;

        // Si estamos en la conversación, agregar el echo como mensaje saliente
        if (this.currentConversation && this.currentConversation.phone === phone) {
            // Verificar si el mensaje ya existe
            const exists = this.messages.some(msg => msg.id === payload.id);
            
            if (!exists) {
                // Normalizar el echo como mensaje saliente
                const normalized = ChatLiveManager.normalizeMessage({
                    id: payload.id,
                    direction: 'outbound',  // ✅ IMPORTANTE: Marcar como saliente
                    type: payload.type || 'text',
                    status: payload.status || 'delivered',
                    content: payload.text || payload.message || payload.content,
                    timestamp: payload.timestamp,
                    mediaUrl: payload.mediaUrl,
                    mediaType: payload.mediaType,
                    _isEcho: true
                });

                // Agregar a la lista de mensajes
                this.messages.push(normalized);
                this.renderMessages();
            } else {
                // Si el mensaje ya existe, actualizar su estado
                const message = this.messages.find(msg => msg.id === payload.id);
                if (message) {
                    message.status = payload.status || 'delivered';
                    this.renderMessages();
                }
            }
        }

        // Actualizar el timestamp de la última interacción
        conversation.lastMessageTime = payload.timestamp || new Date().toISOString();
    }

    /**
     * Maneja actualizaciones de contacto
     */
    handleContactUpdate(payload) {
        // Actualizar la lista de conversaciones para mostrar el nuevo nombre
        this.loadConversations();

        // Si estamos viendo el chat de este contacto, actualizar el título
        if (this.currentConversation && this.currentConversation.phone === payload.phone) {
            // Actualizar el nombre en la conversación actual
            this.currentConversation.name = payload.name;

            // Actualizar el header del chat
            this.updateChatHeader();
        }

        // Mostrar notificación de actualización
        this.showNotification('Contacto actualizado', `El nombre de ${payload.phone} ahora es ${payload.name}`);
    }

    
    



    

    /**
     * Muestra una notificación temporal
     */
    showNotification(title, message) {
        // Crear notificación si no existe
        let notification = document.getElementById('chatNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'chatNotification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 300px;
                font-size: 14px;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.3s ease;
            `;
            document.body.appendChild(notification);
        }

        notification.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
            <div style="opacity: 0.9;">${message}</div>
        `;

        // Mostrar notificación
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';

        // Ocultar después de 3 segundos
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Toggle emoji picker
     */
    toggleEmojiPicker() {
        const picker = document.getElementById('emojiPicker');
        if (!picker) return;

        if (picker.style.display === 'none') {
            // Crear emojis si no existen
            if (!picker.innerHTML) {
                const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸'];
                picker.innerHTML = `<div class="emoji-grid">${emojis.map(e => `<span class="emoji-item" onclick="window.insertEmoji('${e}')">${e}</span>`).join('')}</div>`;
            }
            picker.style.display = 'block';
        } else {
            picker.style.display = 'none';
        }
    }

    /**
     * Select image
     */
    selectImage() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.accept = 'image/*';
            fileInput.click();
        }
    }

    /**
     * Select video
     */
    selectVideo() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.accept = 'video/*';
            fileInput.click();
        }
    }

    /**
     * Select file
     */
    selectFile() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.accept = '*/*';
            fileInput.click();
        }
    }

    /**
     * Handle file selection
     */
    async handleFileSelect(event) {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        // Limpiar el input para permitir volver a seleccionar el mismo archivo
        event.target.value = '';

        this.showFilePreviewModal(files);
    }

    /**
     * Show file preview modal
     */
    async showFilePreviewModal(files) {
        const file = files[0];
        if (!file) return;

        let previewHtml = '';
        let detectedInfoHtml = '';

        const extension = (file.name.split('.').pop() || '').toLowerCase();
        const isCsv = file.type.includes('csv') || ['csv'].includes(extension);
        const isExcel = ['xlsx', 'xls'].includes(extension);

        if (isCsv || isExcel) {
            try {
                const tablePreview = await this.readTabularFilePreview(file, { maxRows: 5 });
                const { headers, rows, detectedColumns } = tablePreview;

                const { nameIndex, lastNameIndex, phoneIndex } = detectedColumns || {};

                // Construir encabezados destacando columnas detectadas
                const headerCells = headers.map((h, idx) => {
                    let label = h || `Columna ${idx + 1}`;
                    let highlight = '';
                    if (idx === nameIndex) highlight = 'background-color:#ecfdf5;';
                    if (idx === lastNameIndex) highlight = 'background-color:#eff6ff;';
                    if (idx === phoneIndex) highlight = 'background-color:#fefce8;';
                    return `<th style="padding:6px 8px; border-bottom:1px solid #e5e7eb; font-size:12px; text-align:left; ${highlight}">${label}</th>`;
                }).join('');

                const bodyRows = rows.map(row => {
                    return `<tr>${headers.map((_, idx) => {
                        const value = (row[idx] ?? '').toString();
                        return `<td style="padding:4px 8px; font-size:12px; border-bottom:1px solid #f1f5f9;">${value}</td>`;
                    }).join('')}</tr>`;
                }).join('');

                previewHtml = `
                    <div style="margin-top:12px; max-height:260px; overflow:auto; border:1px solid #e5e7eb; border-radius:8px;">
                        <table style="width:100%; border-collapse:collapse;">
                            <thead><tr>${headerCells}</tr></thead>
                            <tbody>${bodyRows}</tbody>
                        </table>
                    </div>
                `;

                const detectedParts = [];
                if (nameIndex != null) detectedParts.push('Nombre');
                if (lastNameIndex != null) detectedParts.push('Apellido');
                if (phoneIndex != null) detectedParts.push('Número');

                detectedInfoHtml = detectedParts.length
                    ? `<p style="margin-top:8px; font-size:12px; color:#16a34a;">Detectado automáticamente: <strong>${detectedParts.join(', ')}</strong>.</p>`
                    : `<p style="margin-top:8px; font-size:12px; color:#9ca3af;">No se pudieron detectar columnas de nombre/apellido/número automáticamente.</p>`;
            } catch (error) {
                console.error('Error leyendo archivo tabular:', error);
                previewHtml = '<p style="color:#dc2626; font-size:13px; margin-top:8px;">No se pudo leer el archivo para previsualización.</p>';
            }
        } else {
            previewHtml = '<p style="font-size:13px; margin-top:8px; color:#6b7280;">No es un archivo CSV/Excel. Se mostrará solo información básica antes de enviar.</p>';
        }

        const overlay = document.createElement('div');
        overlay.className = 'file-preview-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(15,23,42,0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 11000;
        `;

        overlay.innerHTML = `
            <div class="file-preview-modal" style="background:white; border-radius:12px; max-width:720px; width:100%; margin:0 16px; box-shadow:0 10px 40px rgba(15,23,42,0.3);">
                <div style="padding:14px 18px; border-bottom:1px solid #e5e7eb; display:flex; align-items:center; justify-content:space-between;">
                    <h3 style="margin:0; font-size:15px; font-weight:600; color:#111827;">Previsualizar archivo</h3>
                    <button type="button" style="border:none; background:transparent; cursor:pointer; color:#6b7280;" id="filePreviewCloseBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding:14px 18px;">
                    <p style="margin:0; font-size:13px; color:#4b5563;">
                        <strong>Archivo:</strong> ${file.name}<br>
                        <span style="font-size:12px; color:#9ca3af;">${(file.type || 'tipo desconocido')} · ${(file.size / 1024).toFixed(1)} KB</span>
                    </p>
                    ${previewHtml}
                    ${detectedInfoHtml}
                    <p style="margin-top:10px; font-size:12px; color:#6b7280;">
                        Confirma si deseas continuar con este archivo. El envío real de archivos aún está en desarrollo.
                    </p>
                </div>
                <div style="padding:12px 18px; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" id="filePreviewCancelBtn" style="padding:6px 12px; font-size:13px; border-radius:6px; border:1px solid #e5e7eb; background:white; cursor:pointer;">Cancelar</button>
                    <button type="button" id="filePreviewConfirmBtn" style="padding:6px 14px; font-size:13px; border-radius:6px; border:none; background:linear-gradient(135deg,#6366f1,#4f46e5); color:white; cursor:pointer; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-check"></i> Confirmar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('#filePreviewCloseBtn')?.addEventListener('click', close);
        overlay.querySelector('#filePreviewCancelBtn')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        overlay.querySelector('#filePreviewConfirmBtn')?.addEventListener('click', () => {
            alert('El previsualizador está implementado. El envío de archivos aún está en desarrollo.');
            close();
        });
    }

    /**
     * Read tabular file preview
     */
    readTabularFilePreview(file, options = {}) {
        const maxRows = options.maxRows || 5;

        return new Promise((resolve, reject) => {
            const extension = (file.name.split('.').pop() || '').toLowerCase();
            const isCsv = file.type.includes('csv') || ['csv'].includes(extension);
            const isExcel = ['xlsx', 'xls'].includes(extension);

            const reader = new FileReader();

            reader.onerror = () => reject(reader.error);

            reader.onload = () => {
                try {
                    let headers = [];
                    let rows = [];

                    if (isCsv) {
                        const text = reader.result.toString();
                        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
                        if (!lines.length) {
                            return resolve({ headers: [], rows: [], detectedColumns: {} });
                        }
                        headers = lines[0].split(/[,;\t]/).map(h => h.trim());
                        rows = lines.slice(1, 1 + maxRows).map(line => line.split(/[,;\t]/));
                    } else if (isExcel) {
                        if (typeof XLSX === 'undefined') {
                            throw new Error('Librería XLSX no disponible');
                        }
                        const data = new Uint8Array(reader.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const sheet = workbook.Sheets[sheetName];
                        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                        if (!json.length) {
                            return resolve({ headers: [], rows: [], detectedColumns: {} });
                        }
                        headers = (json[0] || []).map(h => (h || '').toString());
                        rows = json.slice(1, 1 + maxRows);
                    } else {
                        return resolve({ headers: [], rows: [], detectedColumns: {} });
                    }

                    const detectedColumns = this.detectContactColumns(headers);
                    resolve({ headers, rows, detectedColumns });
                } catch (err) {
                    reject(err);
                }
            };

            if (isCsv) {
                reader.readAsText(file, 'utf-8');
            } else if (isExcel) {
                reader.readAsArrayBuffer(file);
            } else {
                reject(new Error('Tipo de archivo no soportado'));
            }
        });
    }

    /**
     * Detect contact columns
     */
    detectContactColumns(headers) {
        const result = { nameIndex: null, lastNameIndex: null, phoneIndex: null };
        if (!Array.isArray(headers)) return result;

        headers.forEach((header, index) => {
            const h = (header || '').toString().toLowerCase();

            if (result.nameIndex == null && (h.includes('nombre') || h.includes('first') || h === 'name')) {
                result.nameIndex = index;
            }
            if (result.lastNameIndex == null && (h.includes('apellido') || h.includes('last'))) {
                result.lastNameIndex = index;
            }
            if (result.phoneIndex == null && (h.includes('telefono') || h.includes('teléfono') || h.includes('phone') || h.includes('celular') || h.includes('whatsapp') || h.includes('numero') || h.includes('número'))) {
                result.phoneIndex = index;
            }
        });

        return result;
    }

    /**
     * Record audio
     */
    recordAudio() {
        alert('Funcionalidad de grabación de audio en desarrollo');
        // TODO: Implementar grabación de audio
    }

    /**
     * Show templates
     */
    showTemplates() {
        alert('Funcionalidad de plantillas en desarrollo');
        // TODO: Implementar selector de plantillas
    }

    /**
     * Show automation
     */
    showAutomation() {
        alert('Funcionalidad de automatización en desarrollo');
        // TODO: Implementar panel de automatización
    }

    /**
     * Carga las etiquetas del contacto actual
     */
    async loadContactTags() {
        if (!this.currentConversation) return;

        const contactTagsContainer = document.getElementById('contactTags');
        if (!contactTagsContainer) return;

        try {
            // Obtener contact_id desde el phone
            const phone = this.currentConversation.phone;
            if (!phone) {
                console.warn('No se pudo obtener el phone del contacto');
                return;
            }

            // Buscar el contacto por teléfono
            const contactResponse = await fetch(`/api/contacts?search=${phone}&limit=1`);
            const contactData = await contactResponse.json();

            if (!contactData.success || !contactData.data || contactData.data.length === 0) {
                console.warn('No se encontró el contacto con phone:', phone);
                // Aún así permitir añadir etiquetas, usar un ID temporal basado en el phone
                this.renderContactTags([], phone);
                return;
            }

            const contactId = contactData.data[0].id;

            // Obtener etiquetas del contacto (IDs)
            const tagsResponse = await fetch(`/api/tags/contact/${contactId}`);
            const tagsData = await tagsResponse.json();

            if (tagsData.success && tagsData.data && tagsData.data.length > 0) {
                // Obtener detalles de las etiquetas
                const allTagsResponse = await fetch('/api/tags');
                const allTagsData = await allTagsResponse.json();

                if (allTagsData.success) {
                    // Filtrar solo las etiquetas del contacto
                    const contactTagDetails = allTagsData.data.filter(tag => tagsData.data.includes(tag.id));
                    this.renderContactTags(contactTagDetails, contactId);
                } else {
                    this.renderContactTags([], contactId);
                }
            } else {
                this.renderContactTags([], contactId);
            }
        } catch (error) {
            console.error('Error cargando etiquetas:', error);
            this.renderContactTags([], null);
        }
    }

    /**
     * Renderiza las etiquetas del contacto
     */
    renderContactTags(tags, contactId) {
        const container = document.getElementById('contactTags');
        if (!container) return;

        if (tags.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
        } else {
            container.style.display = 'flex';
            container.innerHTML = tags.map(tag => `
                <span class="contact-tag-compact">
                    ${tag.name}
                    <button class="remove-tag-btn-compact" onclick="chatManager.removeTag(${contactId}, '${tag.id}')" title="Eliminar etiqueta">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `).join('');
        }

        // Añadir evento al botón de añadir etiqueta
        const addTagBtn = document.getElementById('addTagBtn');
        if (addTagBtn) {
            addTagBtn.onclick = () => this.showTagModal(contactId);
        }
    }

    /**
     * Muestra el modal para añadir etiquetas
     */
    async showTagModal(contactId) {
        try {
            // Obtener todas las etiquetas disponibles
            const response = await fetch('/api/tags');
            const data = await response.json();

            if (!data.success) {
                alert('Error cargando etiquetas');
                return;
            }

            const tags = data.data || [];

            // Crear modal
            const modal = document.createElement('div');
            modal.className = 'tag-modal-overlay';
            modal.innerHTML = `
                <div class="tag-modal">
                    <div class="tag-modal-header">
                        <h3>+ Añadir etiqueta</h3>
                        <button class="close-modal-btn" id="closeTagModalBtn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="tag-modal-body">
                        ${tags.length > 0 ? `
                            <div class="tag-search">
                                <input type="text" id="tagSearchInput" placeholder="Buscar etiqueta..." class="tag-search-input">
                            </div>
                            <div class="tag-list" id="tagList">
                                ${tags.map(tag => `
                                    <div class="tag-item" data-tag-id="${tag.id}" data-tag-name="${tag.name.toLowerCase()}">
                                        <span class="tag-name">${tag.name}</span>
                                        ${tag.folder ? `<span class="tag-folder">${tag.folder}</span>` : ''}
                                        <button class="delete-tag-btn" data-tag-id="${tag.id}" data-tag-name="${tag.name}" title="Eliminar etiqueta completamente">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="empty-state" style="padding: 40px 20px; text-align: center;">
                                <i class="fas fa-tag" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                                <p style="color: #6b7280; margin-bottom: 20px;">No hay etiquetas creadas</p>
                            </div>
                        `}
                        <div class="modal-actions">
                            <button class="btn btn-outline" id="cancelTagModalBtn">Cancelar</button>
                            <button class="btn btn-primary" id="createNewTagBtn">
                                <i class="fas fa-plus"></i> Crear
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Usar event delegation para mejor rendimiento
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'closeTagModalBtn' || e.target.closest('#closeTagModalBtn')) {
                    modal.remove();
                } else if (e.target.id === 'cancelTagModalBtn' || e.target.closest('#cancelTagModalBtn')) {
                    modal.remove();
                } else if (e.target.id === 'createNewTagBtn' || e.target.closest('#createNewTagBtn')) {
                    this.showCreateTagModal(contactId);
                    modal.remove();
                } else if (e.target.closest('.tag-item') && !e.target.closest('.delete-tag-btn')) {
                    const tagItem = e.target.closest('.tag-item');
                    const tagId = tagItem.dataset.tagId;
                    modal.remove();
                    // Agregar etiqueta al contacto
                    this.addTagToContact(contactId, tagId);
                } else if (e.target.closest('.delete-tag-btn')) {
                    e.stopPropagation();
                    const button = e.target.closest('.delete-tag-btn');
                    const tagId = button.dataset.tagId;
                    const tagName = button.dataset.tagName;
                    this.deleteTagGlobally(tagId, tagName, modal);
                }
            });

            // Evento de búsqueda (solo si hay etiquetas)
            if (tags.length > 0) {
                const searchInput = modal.querySelector('#tagSearchInput');
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => {
                        const query = e.target.value.toLowerCase();
                        const tagItems = modal.querySelectorAll('.tag-item');
                        tagItems.forEach(item => {
                            const tagName = item.dataset.tagName;
                            item.style.display = tagName.includes(query) ? 'flex' : 'none';
                        });
                    });
                }
            }

        } catch (error) {
            console.error('Error mostrando modal de etiquetas:', error);
            alert('Error cargando etiquetas');
        }
    }

    /**
     * Muestra el modal para crear una nueva etiqueta
     */
    async showCreateTagModal(contactId) {
        // Cargar carpetas existentes
        let folders = [];
        try {
            const response = await fetch('/api/tags/folders');
            const data = await response.json();
            if (data.success) {
                folders = data.data || [];
            }
        } catch (error) {
            console.error('Error cargando carpetas:', error);
        }

        const modal = document.createElement('div');
        modal.className = 'tag-modal-overlay';
        modal.innerHTML = `
            <div class="tag-modal">
                <div class="tag-modal-header">
                    <h3>Crear etiqueta</h3>
                    <button class="close-modal-btn" id="closeCreateTagBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="tag-modal-body">
                    <div class="form-group">
                        <label>Nombre</label>
                        <input type="text" id="newTagName" class="form-control" placeholder="Introducir nombre de etiqueta">
                    </div>
                    <div class="form-group">
                        <label>Carpeta</label>
                        <input type="text" id="newTagFolder" class="form-control" placeholder="Etiquetas" value="Etiquetas" list="foldersList">
                        <datalist id="foldersList">
                            ${folders.map(folder => `<option value="${folder}">`).join('')}
                        </datalist>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-outline" id="cancelCreateTagBtn">
                            Cancelar
                        </button>
                        <button class="btn btn-primary" id="saveNewTagBtn">
                            Crear
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Guardar referencia al contexto de la clase
        const self = this;

        // Cerrar modal
        document.getElementById('closeCreateTagBtn').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('cancelCreateTagBtn').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('saveNewTagBtn').addEventListener('click', (e) => {
            e.preventDefault();
            const name = document.getElementById('newTagName').value.trim();
            const folder = document.getElementById('newTagFolder').value.trim() || 'Etiquetas';

            if (!name) {
                alert('El nombre es requerido');
                return;
            }

            // Ejecutar asincronamente sin bloquear el click handler
            setTimeout(async () => {
                // Validar que no exista una etiqueta con el mismo nombre
                try {
                    const response = await fetch('/api/tags');
                    const data = await response.json();

                    if (data.success) {
                        const existingTag = data.data.find(tag =>
                            tag.name.toLowerCase() === name.toLowerCase()
                        );

                        if (existingTag) {
                            alert(`Ya existe una etiqueta con el nombre "${name}"`);
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Error verificando etiqueta:', error);
                }

                await self.createAndAddTag(contactId, name, folder);
                modal.remove();
            }, 0);
        });
    }

    /**
     * Crea una nueva etiqueta y la añade al contacto
     */
    async createAndAddTag(contactId, name, folder) {
        try {
            // Crear etiqueta (sin color, se usará el color por defecto)
            const createResponse = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, folder: folder || 'Etiquetas' })
            });

            const createData = await createResponse.json();
            console.log('📝 Respuesta de crear etiqueta:', createData);

            if (!createData.success) {
                alert('Error creando etiqueta: ' + (createData.error || 'Unknown error'));
                return;
            }

            if (!createData.data || !createData.data.id) {
                alert('Error: La etiqueta no tiene ID');
                return;
            }

            // Añadir al contacto
            await this.addTagToContact(contactId, createData.data.id);

        } catch (error) {
            console.error('Error creando etiqueta:', error);
            alert('Error creando etiqueta: ' + error.message);
        }
    }

    /**
     * Añade una etiqueta a un contacto
     */
    async addTagToContact(contactId, tagId) {
        try {
            console.log(`🏷️ Añadiendo etiqueta ${tagId} al contacto ${contactId}`);
            
            if (!tagId) {
                console.error('❌ tagId es undefined o null');
                alert('Error: ID de etiqueta inválido');
                return;
            }
            
            const response = await fetch(`/api/tags/contact/${contactId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagId })
            });

            const data = await response.json();
            console.log('📝 Respuesta de añadir etiqueta:', data);

            if (data.success) {
                console.log('✅ Etiqueta añadida correctamente');
                this.loadContactTags(); // Recargar etiquetas
            } else {
                alert('Error añadiendo etiqueta: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error añadiendo etiqueta:', error);
            alert('Error añadiendo etiqueta');
        }
    }

    /**
     * Elimina una etiqueta de un contacto (sin confirmación)
     */
    async removeTag(contactId, tagId) {
        try {
            // Primero actualizamos visualmente para feedback inmediato
            const tagElement = document.querySelector(`.contact-tag-compact button[onclick*="${tagId}"]`).closest('.contact-tag-compact');
            if (tagElement) {
                tagElement.style.opacity = '0.5';
                tagElement.style.pointerEvents = 'none';
            }

            // Luego hacemos la petición al servidor
            const response = await fetch(`/api/tags/contact/${contactId}/${tagId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                // Eliminar visualmente la etiqueta
                if (tagElement) {
                    tagElement.remove();
                }

                // Si no quedan etiquetas, ocultar el contenedor
                const container = document.getElementById('contactTags');
                if (container && container.children.length === 0) {
                    container.style.display = 'none';
                }
            } else {
                // Restaurar la etiqueta si hubo error
                if (tagElement) {
                    tagElement.style.opacity = '1';
                    tagElement.style.pointerEvents = 'auto';
                }
                alert('Error eliminando etiqueta');
            }
        } catch (error) {
            console.error('Error eliminando etiqueta:', error);
            alert('Error eliminando etiqueta');
            // Recargar para asegurar estado consistente
            this.loadContactTags();
        }
    }

    /**
     * Elimina una etiqueta completamente de todos los contactos
     */
    async deleteTagGlobally(tagId, tagName, modal) {
        const confirmed = confirm(`¿Eliminar completamente la etiqueta "${tagName}"?\n\nEsta acción eliminará la etiqueta de TODOS los contactos y no se puede deshacer.`);

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/tags/${tagId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                // Mostrar notificación de éxito
                this.showNotification('Etiqueta eliminada', `La etiqueta "${tagName}" ha sido eliminada completamente`);

                // Recargar las etiquetas del contacto actual
                this.loadContactTags();

                // Recargar la lista de etiquetas en el modal (sin cerrarlo)
                const tagList = modal.querySelector('#tagList');
                if (tagList) {
                    // Obtener todas las etiquetas actualizadas
                    const tagsResponse = await fetch('/api/tags');
                    const tagsData = await tagsResponse.json();
                    const tags = tagsData.data || [];

                    // Actualizar la lista de etiquetas en el modal
                    tagList.innerHTML = tags.map(tag => `
                        <div class="tag-item" data-tag-id="${tag.id}" data-tag-name="${tag.name.toLowerCase()}">
                            <span class="tag-name">${tag.name}</span>
                            ${tag.folder ? `<span class="tag-folder">${tag.folder}</span>` : ''}
                            <button class="delete-tag-btn" data-tag-id="${tag.id}" data-tag-name="${tag.name}" title="Eliminar etiqueta completamente">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('');

                    // Re-vincular eventos a los nuevos elementos
                    const newTagItems = modal.querySelectorAll('.tag-item');
                    newTagItems.forEach(item => {
                        item.addEventListener('click', (e) => {
                            if (e.target.closest('.delete-tag-btn')) {
                                return;
                            }
                            const newTagId = item.dataset.tagId;
                            // Ejecutar asincronamente sin bloquear el click handler
                            setTimeout(async () => {
                                await this.addTagToContact(this.currentConversation.id, newTagId);
                                modal.remove();
                            }, 0);
                        });
                    });

                    // Re-vincular eventos a los botones de eliminar
                    const newDeleteButtons = modal.querySelectorAll('.delete-tag-btn');
                    newDeleteButtons.forEach(button => {
                        button.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const newTagId = button.dataset.tagId;
                            const newTagName = button.dataset.tagName;
                            // Ejecutar asincronamente sin bloquear el click handler
                            setTimeout(async () => {
                                await this.deleteTagGlobally(newTagId, newTagName, modal);
                            }, 0);
                        });
                    });
                }
            } else {
                alert('Error eliminando etiqueta: ' + (data.error || 'Error desconocido'));
            }
        } catch (error) {
            console.error('Error eliminando etiqueta globalmente:', error);
            alert('Error eliminando etiqueta: ' + error.message);
        }
    }

    /**
     * Selecciona una conversación por teléfono
     */
    async selectConversationByPhone(phone) {
        try {
            // Decodificar el teléfono si está codificado
            const decodedPhone = decodeURIComponent(phone);
            
            // Buscar la conversación que corresponde a este teléfono
            let conversation = this.conversations.find(conv => {
                // Comparar el teléfono normalizando espacios y caracteres especiales
                const convPhone = (conv.phone || '').replace(/\s+/g, '');
                const searchPhone = decodedPhone.replace(/\s+/g, '');
                return convPhone === searchPhone;
            });

            if (conversation) {
                // Hacer clic en la conversación para seleccionarla
                const conversationElement = document.querySelector(`[data-conversation-id="${conversation.id}"]`);
                if (conversationElement) {
                    conversationElement.click();
                    console.log(`✅ Conversación seleccionada para teléfono ${decodedPhone}`);
                } else {
                    console.warn(`⚠️ No se encontró elemento DOM para conversación ${conversation.id}`);
                }
            } else {
                // Si no existe, crear una conversación temporal en blanco
                console.log(`ℹ️ Creando conversación temporal para ${decodedPhone}`);
                
                // Obtener el nombre del contacto si existe
                let contactName = decodedPhone;
                try {
                    const contactResponse = await fetch(`/api/contacts?search=${encodeURIComponent(decodedPhone)}`);
                    if (contactResponse.ok) {
                        const contactData = await contactResponse.json();
                        if (contactData.data && contactData.data.length > 0) {
                            contactName = contactData.data[0].name || decodedPhone;
                        }
                    }
                } catch (error) {
                    console.debug('No se pudo obtener nombre del contacto:', error);
                }
                
                // Crear conversación normal (iniciada por nosotros)
                const newConversation = {
                    id: `new_${Date.now()}`,
                    phone: decodedPhone,
                    name: contactName,
                    avatar: null,
                    lastMessage: 'Nueva conversación',
                    lastMessageTime: new Date().toISOString(),
                    unreadCount: 0,
                    messageCount: 0,
                    status: 'active',
                    channel: 'whatsapp',
                    priority: 'medium',
                    isNew: true  // Marca como nueva (iniciada por nosotros)
                };
                
                // Agregar a la lista de conversaciones
                this.conversations.push(newConversation);
                console.log(`✅ Conversación nueva creada para ${decodedPhone} (${contactName})`);
                
                // Seleccionar la conversación
                this.currentConversation = newConversation;
                this.messages = [];
                this.renderConversations();
                this.renderMessages();
                this.updateChatHeader();
                this.showChatInput(); // Mostrar el input de mensajes
                
                // Actualizar URL
                window.history.replaceState({}, '', `?phone=${encodeURIComponent(decodedPhone)}`);
                
                console.log(`✅ Conversación abierta para ${decodedPhone}`);
            }
        } catch (error) {
            console.error('Error seleccionando conversación:', error);
        }
    }

    /**
     * Abre una imagen en modal
     */
    openImageModal(src) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 8px;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.remove();
        });
        
        modal.addEventListener('click', () => {
            modal.remove();
        });
        
        img.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        modal.appendChild(img);
        modal.appendChild(closeBtn);
        document.body.appendChild(modal);
    }

    /**
     * Destruye el chat
     */
    destroy() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

}

window.ChatLiveManager = ChatLiveManager;

/**
 * Función global para abrir imágenes en modal
 */
window.openImageModal = function(src) {
    if (window.chatManager && typeof window.chatManager.openImageModal === 'function') {
        window.chatManager.openImageModal(src);
    }
};



document.addEventListener('DOMContentLoaded', () => {
    const manager = new ChatLiveManager();
    manager.init();
    window.chatManager = manager;
});
/**
 * ChatBot Enterprise v5.1.0 - Main JavaScript
 * Sistema principal de la interfaz de usuario
 */

class ChatBotMain {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.activeConversations = new Map();
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando ChatBot Enterprise v5.1.0');
        
        try {
            await this.initializeSocket();
            await this.loadUserInterface();
            await this.setupEventListeners();
            await this.loadActiveConversations();
            
            console.log('✅ ChatBot Enterprise inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando ChatBot:', error);
        }
    }

    async initializeSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('🔌 Socket.IO conectado');
                this.updateConnectionStatus(true);
            });

            this.socket.on('disconnect', () => {
                console.log('🔌 Socket.IO desconectado');
                this.updateConnectionStatus(false);
            });

            this.socket.on('new_message', (data) => {
                this.handleNewMessage(data);
            });

            this.socket.on('conversation_update', (data) => {
                this.handleConversationUpdate(data);
            });
        }
    }

    async loadUserInterface() {
        // Cargar componentes de la interfaz
        await this.loadChatInterface();
        await this.loadDashboard();
        await this.loadNavigation();
    }

    async loadChatInterface() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.innerHTML = `
                <div class="chat-header">
                    <h3><i class="fas fa-comments"></i> Chat en Vivo</h3>
                    <div class="chat-status">
                        <span class="status-indicator" id="connection-status"></span>
                        <span id="status-text">Conectando...</span>
                    </div>
                </div>
                <div class="chat-conversations" id="conversations-list">
                    <div class="loading">Cargando conversaciones...</div>
                </div>
                <div class="chat-messages" id="messages-container">
                    <div class="no-conversation">
                        <i class="fas fa-comment-dots"></i>
                        <p>Selecciona una conversación para comenzar</p>
                    </div>
                </div>
                <div class="chat-input" id="chat-input-container" style="display: none;">
                    <div class="input-group">
                        <input type="text" id="message-input" placeholder="Escribe tu mensaje..." class="form-control">
                        <button id="send-button" class="btn btn-primary">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    async loadDashboard() {
        const dashboardContainer = document.getElementById('dashboard-container');
        if (dashboardContainer) {
            // Cargar métricas del dashboard
            try {
                const response = await fetch('/api/dashboard/metrics');
                const metrics = await response.json();
                this.renderDashboard(metrics);
            } catch (error) {
                console.error('Error cargando dashboard:', error);
            }
        }
    }

    renderDashboard(metrics) {
        const dashboardContainer = document.getElementById('dashboard-container');
        if (!dashboardContainer) return;

        // Renderizar métricas del dashboard
        if (metrics && typeof metrics === 'object') {
            // Actualizar contadores si existen
            const totalMessages = document.getElementById('total-messages');
            const activeConversations = document.getElementById('active-conversations');
            const responseTime = document.getElementById('response-time');

            if (totalMessages && metrics.totalMessages) {
                totalMessages.textContent = metrics.totalMessages;
            }
            if (activeConversations && metrics.activeConversations) {
                activeConversations.textContent = metrics.activeConversations;
            }
            if (responseTime && metrics.averageResponseTime) {
                responseTime.textContent = `${metrics.averageResponseTime}s`;
            }

            console.log('Dashboard renderizado con métricas:', metrics);
        } else {
            console.warn('Métricas del dashboard no válidas:', metrics);
        }
    }

    async loadNavigation() {
        // Configurar navegación
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.getAttribute('data-target');
                this.navigateToSection(target);
            });
        });
    }

    setupEventListeners() {
        // Botón de envío de mensajes
        const sendButton = document.getElementById('send-button');
        const messageInput = document.getElementById('message-input');

        if (sendButton && messageInput) {
            sendButton.addEventListener('click', () => this.sendMessage());
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }

        // Búsqueda de conversaciones
        const searchInput = document.getElementById('conversation-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterConversations(e.target.value);
            });
        }
    }

    async loadActiveConversations() {
        try {
            const response = await fetch('/api/conversations');
            const conversations = await response.json();
            this.renderConversations(conversations);
        } catch (error) {
            console.error('Error cargando conversaciones:', error);
        }
    }

    renderConversations(conversations) {
        const container = document.getElementById('conversations-list');
        if (!container) return;

        // Validar que conversations sea un array
        if (!Array.isArray(conversations)) {
            console.warn('conversations no es un array:', conversations);
            conversations = [];
        }

        if (conversations.length === 0) {
            container.innerHTML = `
                <div class="no-conversations">
                    <i class="fas fa-inbox"></i>
                    <p>No hay conversaciones activas</p>
                </div>
            `;
            return;
        }

        container.innerHTML = conversations.map(conv => `
            <div class="conversation-item" data-phone="${conv.phone}" onclick="chatBot.selectConversation('${conv.phone}')">
                <div class="conversation-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${conv.name || conv.phone}</div>
                    <div class="conversation-last-message">${conv.lastMessage || 'Sin mensajes'}</div>
                    <div class="conversation-time">${this.formatTime(conv.lastActivity)}</div>
                </div>
                ${conv.unread > 0 ? `<div class="unread-badge">${conv.unread}</div>` : ''}
            </div>
        `).join('');
    }

    async selectConversation(phone) {
        try {
            // Marcar conversación como activa
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-phone="${phone}"]`).classList.add('active');

            // Cargar mensajes
            const response = await fetch(`/api/conversations/${phone}/messages`);
            const messages = await response.json();
            
            this.renderMessages(messages);
            this.showChatInput();
            this.currentConversation = phone;

            // Marcar como leído
            await fetch(`/api/conversations/${phone}/read`, { method: 'POST' });

        } catch (error) {
            console.error('Error seleccionando conversación:', error);
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messages-container');
        if (!container) return;

        // Validación para asegurar que messages sea un array
        if (!Array.isArray(messages)) {
            console.warn('messages no es un array en renderMessages, usando array vacío');
            messages = [];
        }

        container.innerHTML = messages.map(msg => `
            <div class="message ${msg.direction === 'outbound' ? 'sent' : 'received'}">
                <div class="message-content">${msg.text}</div>
                <div class="message-time">${this.formatTime(msg.timestamp)}</div>
            </div>
        `).join('');

        // Scroll al final
        container.scrollTop = container.scrollHeight;
    }

    showChatInput() {
        const inputContainer = document.getElementById('chat-input-container');
        if (inputContainer) {
            inputContainer.style.display = 'block';
        }
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();

        if (!message || !this.currentConversation) return;

        try {
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: this.currentConversation,
                    text: message
                })
            });

            if (response.ok) {
                input.value = '';
                // El mensaje se agregará automáticamente via socket
            } else {
                throw new Error('Error enviando mensaje');
            }
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            alert('Error enviando mensaje');
        }
    }

    handleNewMessage(data) {
        // Actualizar conversaciones
        this.loadActiveConversations();
        
        // Si es la conversación activa, agregar mensaje
        if (this.currentConversation === data.from) {
            this.addMessageToChat(data);
        }
    }

    addMessageToChat(message) {
        const container = document.getElementById('messages-container');
        if (!container) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.direction === 'outbound' ? 'sent' : 'received'}`;
        messageElement.innerHTML = `
            <div class="message-content">${message.text}</div>
            <div class="message-time">${this.formatTime(message.timestamp)}</div>
        `;

        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connection-status');
        const text = document.getElementById('status-text');

        if (indicator && text) {
            indicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
            text.textContent = connected ? 'Conectado' : 'Desconectado';
        }
    }

    navigateToSection(section) {
        console.log('Navegando a sección:', section);
        
        // Ocultar todas las secciones
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.style.display = 'none';
        });

        // Mostrar sección seleccionada
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.style.display = 'block';
            console.log('Sección mostrada:', section);
        } else {
            console.warn('Sección no encontrada:', section);
        }

        // Actualizar navegación activa
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-target="${section}"]`).classList.add('active');
        
        // Actualizar título de la página
        this.updatePageTitle(section);
    }

    // Actualizar título de la página
    updatePageTitle(sectionId) {
        const titles = {
            'chat-section': 'Chat en Vivo',
            'dashboard-section': 'Dashboard',
            'settings-section': 'Configuración'
        };
        
        const title = titles[sectionId] || 'ChatBot Enterprise';
        document.title = `${title} - ChatBot Enterprise v5.1.0`;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Ahora';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
        return date.toLocaleDateString();
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.chatBot = new ChatBotMain();
});

// Exportar para uso global
window.ChatBotMain = ChatBotMain;
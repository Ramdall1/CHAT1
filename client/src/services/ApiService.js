/**
 * Servicio de API para comunicación con el servidor
 * Maneja todas las peticiones HTTP y WebSocket
 */
class ApiService {
  constructor() {
    this.baseURL = window.location.origin;
    this.socket = null;
    this.isConnected = false;
    this.eventListeners = new Map();
    
    this.initializeSocket();
  }

  /**
   * Inicializa la conexión WebSocket
   */
  initializeSocket() {
    if (typeof io !== 'undefined') {
      this.socket = io(this.baseURL);
      
      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('Conectado al servidor via WebSocket');
        this.emit('connection:established');
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        console.log('Desconectado del servidor');
        this.emit('connection:lost');
      });

      this.socket.on('new_message', (data) => {
        this.emit('message:received', data);
      });

      this.socket.on('conversation_message', (data) => {
        this.emit('conversation:updated', data);
      });
    }
  }

  /**
   * Realiza una petición HTTP
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      console.error('Error en petición API:', error);
      throw error;
    }
  }

  /**
   * Métodos HTTP específicos
   */
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  /**
   * Métodos específicos para el chatbot
   */
  async getContacts() {
    return this.get('/api/contacts');
  }

  async getConversations() {
    return this.get('/api/conversations');
  }

  async getConversationMessages(phone, params = {}) {
    return this.get(`/api/conversations/${phone}/messages`, params);
  }

  async sendMessage(conversationId, message) {
    return this.post('/api/messages', {
      conversation_id: conversationId,
      message
    });
  }

  async getTemplates() {
    return this.get('/api/templates');
  }

  async getAnalytics(period = '7d') {
    return this.get('/api/analytics', { period });
  }

  /**
   * Gestión de eventos
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error en listener de evento ${event}:`, error);
        }
      });
    }
  }

  /**
   * Unirse a una sala de notificaciones
   */
  joinNotificationRoom(userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_notifications', { userId });
    }
  }

  /**
   * Unirse a una conversación
   */
  joinConversation(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_conversation', { conversationId });
    }
  }

  /**
   * Salir de una conversación
   */
  leaveConversation(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_conversation', { conversationId });
    }
  }

  /**
   * Obtener estado de conexión
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id || null
    };
  }

  /**
   * Destruir el servicio
   */
  destroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.eventListeners.clear();
  }
}

// Crear instancia global
window.ApiService = window.ApiService || new ApiService();

export default ApiService;
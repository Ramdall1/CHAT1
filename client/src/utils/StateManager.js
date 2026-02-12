/**
 * Gestor de Estado Simple
 * Maneja el estado global de la aplicación con patrón Observer
 */
class StateManager {
  constructor() {
    this.state = {};
    this.listeners = new Map();
    this.middleware = [];
    this.history = [];
    this.maxHistorySize = 50;
    
    this.initializeDefaultState();
  }

  /**
   * Inicializa el estado por defecto
   */
  initializeDefaultState() {
    this.state = {
      // Estado de la aplicación
      app: {
        isLoading: false,
        currentPage: 'chat',
        theme: localStorage.getItem('theme') || 'light',
        sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true'
      },
      
      // Estado del usuario
      user: {
        isAuthenticated: false,
        profile: null,
        preferences: {}
      },
      
      // Estado de conexión
      connection: {
        isConnected: false,
        socketId: null,
        lastConnected: null
      },
      
      // Estado del chat
      chat: {
        activeConversation: null,
        conversations: [],
        contacts: [],
        messages: {},
        unreadCount: 0
      },
      
      // Estado de notificaciones
      notifications: {
        enabled: true,
        sound: true,
        desktop: true,
        count: 0
      },
      
      // Estado de la UI
      ui: {
        modals: {},
        alerts: [],
        loading: {}
      }
    };
  }

  /**
   * Obtiene el estado completo o una parte específica
   */
  getState(path = null) {
    if (!path) {
      return { ...this.state };
    }
    
    return this.getNestedValue(this.state, path);
  }

  /**
   * Actualiza el estado
   */
  setState(path, value, options = {}) {
    const { silent = false, merge = true } = options;
    
    // Guardar estado anterior para historial
    const previousState = { ...this.state };
    
    // Aplicar middleware
    const action = { type: 'SET_STATE', path, value, options };
    const processedAction = this.applyMiddleware(action, this.state);
    
    if (processedAction === false) {
      return false; // Middleware canceló la acción
    }

    // Actualizar estado
    if (typeof path === 'string') {
      this.setNestedValue(this.state, path, value, merge);
    } else if (typeof path === 'object') {
      // Actualización múltiple
      Object.keys(path).forEach(key => {
        this.setNestedValue(this.state, key, path[key], merge);
      });
    }

    // Guardar en historial
    this.addToHistory(previousState, this.state, action);

    // Notificar listeners
    if (!silent) {
      this.notifyListeners(path, value, previousState);
    }

    return true;
  }

  /**
   * Suscribe un listener a cambios de estado
   */
  subscribe(path, callback, options = {}) {
    const { immediate = false } = options;
    
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    
    const listener = { callback, options };
    this.listeners.get(path).push(listener);
    
    // Ejecutar inmediatamente si se solicita
    if (immediate) {
      const currentValue = this.getState(path);
      callback(currentValue, null, path);
    }
    
    // Retornar función para desuscribir
    return () => {
      const listeners = this.listeners.get(path);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Desuscribe un listener
   */
  unsubscribe(path, callback = null) {
    if (!callback) {
      // Remover todos los listeners del path
      this.listeners.delete(path);
    } else {
      // Remover listener específico
      const listeners = this.listeners.get(path);
      if (listeners) {
        const index = listeners.findIndex(l => l.callback === callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }
  }

  /**
   * Agrega middleware para procesar acciones
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Aplica middleware a una acción
   */
  applyMiddleware(action, state) {
    let processedAction = action;
    
    for (const middleware of this.middleware) {
      try {
        const result = middleware(processedAction, state);
        if (result === false) {
          return false; // Cancelar acción
        }
        if (result && typeof result === 'object') {
          processedAction = result;
        }
      } catch (error) {
        console.error('Error en middleware:', error);
      }
    }
    
    return processedAction;
  }

  /**
   * Notifica a los listeners sobre cambios
   */
  notifyListeners(path, value, previousState) {
    // Notificar listeners específicos del path
    if (this.listeners.has(path)) {
      const listeners = this.listeners.get(path);
      listeners.forEach(({ callback }) => {
        try {
          const previousValue = this.getNestedValue(previousState, path);
          callback(value, previousValue, path);
        } catch (error) {
          console.error('Error en listener:', error);
        }
      });
    }
    
    // Notificar listeners globales
    if (this.listeners.has('*')) {
      const globalListeners = this.listeners.get('*');
      globalListeners.forEach(({ callback }) => {
        try {
          callback(this.state, previousState, path);
        } catch (error) {
          console.error('Error en listener global:', error);
        }
      });
    }
  }

  /**
   * Obtiene un valor anidado del objeto
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Establece un valor anidado en el objeto
   */
  setNestedValue(obj, path, value, merge = true) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    if (merge && typeof target[lastKey] === 'object' && typeof value === 'object' && !Array.isArray(value)) {
      target[lastKey] = { ...target[lastKey], ...value };
    } else {
      target[lastKey] = value;
    }
  }

  /**
   * Agrega al historial de cambios
   */
  addToHistory(previousState, newState, action) {
    this.history.push({
      timestamp: Date.now(),
      previousState: JSON.parse(JSON.stringify(previousState)),
      newState: JSON.parse(JSON.stringify(newState)),
      action
    });
    
    // Mantener tamaño del historial
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Obtiene el historial de cambios
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  /**
   * Resetea el estado a los valores por defecto
   */
  reset() {
    const previousState = { ...this.state };
    this.initializeDefaultState();
    this.notifyListeners('*', this.state, previousState);
  }

  /**
   * Persiste el estado en localStorage
   */
  persist(keys = ['app.theme', 'app.sidebarCollapsed', 'user.preferences']) {
    keys.forEach(key => {
      const value = this.getState(key);
      if (value !== undefined) {
        localStorage.setItem(key.replace('.', '_'), JSON.stringify(value));
      }
    });
  }

  /**
   * Restaura el estado desde localStorage
   */
  restore(keys = ['app.theme', 'app.sidebarCollapsed', 'user.preferences']) {
    keys.forEach(key => {
      const storageKey = key.replace('.', '_');
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const value = JSON.parse(stored);
          this.setState(key, value, { silent: true });
        } catch (error) {
          console.warn(`Error restaurando ${key} desde localStorage:`, error);
        }
      }
    });
  }

  /**
   * Métodos de conveniencia para estados comunes
   */
  
  // Estado de carga
  setLoading(key, isLoading) {
    this.setState(`ui.loading.${key}`, isLoading);
  }
  
  isLoading(key) {
    return this.getState(`ui.loading.${key}`) || false;
  }
  
  // Estado de conexión
  setConnectionStatus(isConnected, socketId = null) {
    this.setState('connection', {
      isConnected,
      socketId,
      lastConnected: isConnected ? Date.now() : this.getState('connection.lastConnected')
    });
  }
  
  // Estado del chat
  setActiveConversation(conversationId) {
    this.setState('chat.activeConversation', conversationId);
  }
  
  addMessage(conversationId, message) {
    const messages = this.getState('chat.messages') || {};
    if (!messages[conversationId]) {
      messages[conversationId] = [];
    }
    messages[conversationId].push(message);
    this.setState('chat.messages', messages);
  }
  
  // Estado de notificaciones
  incrementNotificationCount() {
    const current = this.getState('notifications.count') || 0;
    this.setState('notifications.count', current + 1);
  }
  
  resetNotificationCount() {
    this.setState('notifications.count', 0);
  }

  /**
   * Obtiene estadísticas del estado
   */
  getStats() {
    return {
      stateSize: JSON.stringify(this.state).length,
      listenersCount: Array.from(this.listeners.values()).reduce((total, listeners) => total + listeners.length, 0),
      historySize: this.history.length,
      middlewareCount: this.middleware.length
    };
  }

  /**
   * Destruye el gestor de estado
   */
  destroy() {
    this.listeners.clear();
    this.middleware = [];
    this.history = [];
    this.state = {};
  }
}

// Crear instancia global
window.StateManager = window.StateManager || new StateManager();
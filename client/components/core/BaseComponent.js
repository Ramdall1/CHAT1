/**
 * Clase base para todos los componentes del frontend
 * Proporciona funcionalidad común y estructura estándar
 */
class BaseComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = { ...this.getDefaultOptions(), ...options };
    this.state = {};
    this.eventListeners = new Map();
    this.isInitialized = false;

    this.init();
  }

  /**
   * Opciones por defecto del componente
   */
  getDefaultOptions() {
    return {
      autoInit: true,
      debug: false,
    };
  }

  /**
   * Inicialización del componente
   */
  async init() {
    if (this.isInitialized) return;

    try {
      await this.beforeInit();
      this.render();
      this.bindEvents();
      await this.afterInit();
      this.isInitialized = true;

      if (this.options.debug) {
        console.log(`Component ${this.constructor.name} initialized`);
      }
    } catch (error) {
      console.error(
        `Error initializing component ${this.constructor.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Hook ejecutado antes de la inicialización
   */
  async beforeInit() {
    // Override en componentes hijos
  }

  /**
   * Hook ejecutado después de la inicialización
   */
  async afterInit() {
    // Override en componentes hijos
  }

  /**
   * Renderiza el componente
   */
  render() {
    if (!this.container) {
      throw new Error('Container is required for component rendering');
    }

    const html = this.getTemplate();
    this.container.innerHTML = html;
    this.cacheElements();
  }

  /**
   * Obtiene el template HTML del componente
   */
  getTemplate() {
    return '<div>Base Component</div>';
  }

  /**
   * Cachea elementos DOM importantes
   */
  cacheElements() {
    // Override en componentes hijos
  }

  /**
   * Vincula eventos del componente
   */
  bindEvents() {
    // Override en componentes hijos
  }

  /**
   * Añade un event listener y lo registra para limpieza posterior
   */
  addEventListener(element, event, handler, options = {}) {
    if (!element || !event || !handler) return;

    const boundHandler = handler.bind(this);
    element.addEventListener(event, boundHandler, options);

    const key = `${element.tagName}-${event}-${Date.now()}`;
    this.eventListeners.set(key, {
      element,
      event,
      handler: boundHandler,
      options,
    });

    return key;
  }

  /**
   * Remueve un event listener específico
   */
  removeEventListener(key) {
    const listener = this.eventListeners.get(key);
    if (listener) {
      listener.element.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
      this.eventListeners.delete(key);
    }
  }

  /**
   * Actualiza el estado del componente
   */
  setState(newState, shouldRender = true) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };

    this.onStateChange(prevState, this.state);

    if (shouldRender) {
      this.render();
      this.bindEvents();
    }
  }

  /**
   * Hook ejecutado cuando cambia el estado
   */
  onStateChange(prevState, newState) {
    // Override en componentes hijos
  }

  /**
   * Obtiene el estado actual
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Muestra un toast/notificación
   */
  showToast(message, type = 'info', duration = 3000) {
    // Implementación básica, puede ser sobrescrita
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Colores según tipo
    const colors = {
      info: '#007bff',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
    };

    toast.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(toast);

    // Animación de entrada
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);

    // Remover después del tiempo especificado
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  /**
   * Valida datos usando reglas definidas
   */
  validate(data, rules) {
    const errors = {};

    for (const field in rules) {
      const rule = rules[field];
      const value = data[field];

      if (rule.required && (!value || value.toString().trim() === '')) {
        errors[field] = rule.message || `${field} es requerido`;
        continue;
      }

      if (value && rule.pattern && !rule.pattern.test(value)) {
        errors[field] = rule.message || `${field} tiene formato inválido`;
        continue;
      }

      if (value && rule.minLength && value.length < rule.minLength) {
        errors[field] =
          rule.message ||
          `${field} debe tener al menos ${rule.minLength} caracteres`;
        continue;
      }

      if (value && rule.maxLength && value.length > rule.maxLength) {
        errors[field] =
          rule.message ||
          `${field} no puede tener más de ${rule.maxLength} caracteres`;
        continue;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Limpia el componente y remueve event listeners
   */
  destroy() {
    // Remover todos los event listeners
    for (const [key] of this.eventListeners) {
      this.removeEventListener(key);
    }

    // Limpiar container
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Limpiar estado
    this.state = {};
    this.isInitialized = false;

    if (this.options.debug) {
      console.log(`Component ${this.constructor.name} destroyed`);
    }
  }

  /**
   * Utilidad para crear elementos DOM
   */
  createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        for (const [dataKey, dataValue] of Object.entries(value)) {
          element.dataset[dataKey] = dataValue;
        }
      } else {
        element.setAttribute(key, value);
      }
    }

    if (content) {
      element.innerHTML = content;
    }

    return element;
  }

  /**
   * Utilidad para hacer peticiones HTTP
   */
  async request(url, options = {}) {
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Agregar token de autenticación si está disponible, excepto para rutas del dashboard
    const isDashboardRoute = url.includes('/api/dashboard/') || url.includes('/api/analytics/');
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken && !isDashboardRoute) {
      defaultOptions.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const finalOptions = { ...defaultOptions, ...options };

    // Asegurar que los headers se combinen correctamente
    if (options.headers) {
      finalOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }

    if (finalOptions.body && typeof finalOptions.body === 'object') {
      finalOptions.body = JSON.stringify(finalOptions.body);
    }

    // Agregar AbortController con timeout más largo para rutas del dashboard
    if (isDashboardRoute && !finalOptions.signal) {
      const controller = new AbortController();
      finalOptions.signal = controller.signal;
      
      // Timeout de 10 segundos para rutas del dashboard
      setTimeout(() => {
        controller.abort();
      }, 10000);
    }

    try {
      const response = await fetch(url, finalOptions);

      if (!response.ok) {
        // Si es error 401, limpiar tokens (sistema de login removido)
        if (response.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          console.warn('Token de autenticación inválido - sistema de login removido');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      console.error('Request error:', error);
      throw error;
    }
  }
}

// Hacer disponible globalmente
window.BaseComponent = BaseComponent;

/**
 * Servicio de Notificaciones
 * Maneja notificaciones del navegador, toast y alertas del sistema
 */
class NotificationService {
  constructor() {
    this.permission = 'default';
    this.isSupported = 'Notification' in window;
    this.toastContainer = null;
    this.activeToasts = new Set();
    
    this.init();
  }

  /**
   * Inicializa el servicio de notificaciones
   */
  async init() {
    if (this.isSupported) {
      this.permission = Notification.permission;
      
      if (this.permission === 'default') {
        await this.requestPermission();
      }
    }
    
    this.createToastContainer();
  }

  /**
   * Solicita permisos para notificaciones del navegador
   */
  async requestPermission() {
    if (this.isSupported) {
      try {
        this.permission = await Notification.requestPermission();
        return this.permission === 'granted';
      } catch (error) {
        console.error('Error solicitando permisos de notificación:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Crea el contenedor para toast notifications
   */
  createToastContainer() {
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'toast-container';
      this.toastContainer.className = 'toast-container';
      this.toastContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
      `;
      document.body.appendChild(this.toastContainer);
    }
  }

  /**
   * Muestra una notificación del navegador
   */
  showBrowserNotification(title, options = {}) {
    if (!this.isSupported || this.permission !== 'granted') {
      console.warn('Notificaciones del navegador no disponibles');
      return null;
    }

    const defaultOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'chatbot-notification',
      requireInteraction: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      // Auto-cerrar después de 5 segundos si no requiere interacción
      if (!defaultOptions.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('Error creando notificación:', error);
      return null;
    }
  }

  /**
   * Muestra un toast notification
   */
  showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    const toastId = Date.now() + Math.random();
    
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      background: ${this.getToastColor(type)};
      color: white;
      padding: 12px 20px;
      margin-bottom: 10px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      pointer-events: auto;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    `;

    // Icono según el tipo
    const icon = this.getToastIcon(type);
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 18px;">${icon}</span>
        <span style="flex: 1;">${message}</span>
        <button style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; margin-left: 10px;" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Barra de progreso
    if (duration > 0) {
      const progressBar = document.createElement('div');
      progressBar.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: rgba(255,255,255,0.3);
        width: 100%;
        transform-origin: left;
        animation: toast-progress ${duration}ms linear;
      `;
      toast.appendChild(progressBar);

      // Agregar CSS de animación
      if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
          @keyframes toast-progress {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
        `;
        document.head.appendChild(style);
      }
    }

    this.toastContainer.appendChild(toast);
    this.activeToasts.add(toastId);

    // Animar entrada
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);

    // Auto-remover
    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(toast, toastId);
      }, duration);
    }

    // Click para cerrar
    toast.addEventListener('click', () => {
      this.removeToast(toast, toastId);
    });

    return toastId;
  }

  /**
   * Remueve un toast
   */
  removeToast(toast, toastId) {
    if (toast && toast.parentElement) {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
        this.activeToasts.delete(toastId);
      }, 300);
    }
  }

  /**
   * Obtiene el color del toast según el tipo
   */
  getToastColor(type) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
      default: '#6b7280'
    };
    return colors[type] || colors.default;
  }

  /**
   * Obtiene el icono del toast según el tipo
   */
  getToastIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
      default: '●'
    };
    return icons[type] || icons.default;
  }

  /**
   * Métodos de conveniencia para diferentes tipos de notificaciones
   */
  success(message, duration = 4000) {
    return this.showToast(message, 'success', duration);
  }

  error(message, duration = 6000) {
    return this.showToast(message, 'error', duration);
  }

  warning(message, duration = 5000) {
    return this.showToast(message, 'warning', duration);
  }

  info(message, duration = 4000) {
    return this.showToast(message, 'info', duration);
  }

  /**
   * Notificación para nuevos mensajes
   */
  notifyNewMessage(contact, message) {
    const title = `Nuevo mensaje de ${contact.name || contact.phone}`;
    const options = {
      body: message.length > 100 ? message.substring(0, 100) + '...' : message,
      icon: contact.avatar || '/images/default-avatar.png',
      tag: `message-${contact.id}`,
      data: { contactId: contact.id, type: 'new_message' }
    };

    // Notificación del navegador si la página no está visible
    if (document.hidden) {
      this.showBrowserNotification(title, options);
    }

    // Toast siempre
    this.showToast(`${contact.name || contact.phone}: ${message}`, 'info', 5000);
  }

  /**
   * Notificación de conexión
   */
  notifyConnection(status) {
    if (status === 'connected') {
      this.success('Conectado al servidor');
    } else if (status === 'disconnected') {
      this.warning('Conexión perdida. Reintentando...');
    } else if (status === 'reconnected') {
      this.success('Conexión restablecida');
    }
  }

  /**
   * Limpia todas las notificaciones activas
   */
  clearAll() {
    this.activeToasts.forEach(toastId => {
      const toast = document.querySelector(`[data-toast-id="${toastId}"]`);
      if (toast) {
        this.removeToast(toast, toastId);
      }
    });
  }

  /**
   * Obtiene el estado del servicio
   */
  getStatus() {
    return {
      isSupported: this.isSupported,
      permission: this.permission,
      activeToasts: this.activeToasts.size
    };
  }

  /**
   * Destruye el servicio
   */
  destroy() {
    this.clearAll();
    if (this.toastContainer && this.toastContainer.parentElement) {
      this.toastContainer.remove();
    }
  }
}

// Crear instancia global
window.NotificationService = window.NotificationService || new NotificationService();
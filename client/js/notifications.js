// Sistema de Notificaciones Push - Gestiona notificaciones en tiempo real
console.log('🔔 Sistema de Notificaciones cargado');

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 5;
        this.defaultDuration = 5000; // 5 segundos
        this.container = null;
        this.soundEnabled = true;
        this.init();
    }

    // Inicializar el sistema de notificaciones
    init() {
        this.createContainer();
        this.requestPermission();
        this.setupServiceWorker();
    }

    // Crear contenedor de notificaciones
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);

        // Añadir estilos CSS
        this.addStyles();
    }

    // Añadir estilos CSS para las notificaciones
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .notification-item {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                margin-bottom: 10px;
                padding: 16px;
                border-left: 4px solid #007bff;
                animation: slideIn 0.3s ease-out;
                pointer-events: auto;
                position: relative;
                max-width: 100%;
                word-wrap: break-word;
            }

            .notification-item.success {
                border-left-color: #28a745;
            }

            .notification-item.warning {
                border-left-color: #ffc107;
            }

            .notification-item.error {
                border-left-color: #dc3545;
            }

            .notification-item.info {
                border-left-color: #17a2b8;
            }

            .notification-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .notification-title {
                font-weight: 600;
                font-size: 14px;
                color: #333;
            }

            .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #999;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .notification-close:hover {
                color: #666;
            }

            .notification-message {
                font-size: 13px;
                color: #666;
                line-height: 1.4;
            }

            .notification-timestamp {
                font-size: 11px;
                color: #999;
                margin-top: 8px;
            }

            .notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 2px;
                background: rgba(0,123,255,0.3);
                border-radius: 0 0 8px 8px;
                animation: progress linear;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            @keyframes progress {
                from { width: 100%; }
                to { width: 0%; }
            }

            .notification-item.removing {
                animation: slideOut 0.3s ease-in forwards;
            }
        `;
        document.head.appendChild(style);
    }

    // Solicitar permisos para notificaciones del navegador
    async requestPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            console.log(`🔔 Permisos de notificación: ${permission}`);
            return permission === 'granted';
        }
        return false;
    }

    // Configurar Service Worker para notificaciones push
    async setupServiceWorker() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                // Registrar service worker si no existe
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('📱 Service Worker registrado para notificaciones push');
                return registration;
            } catch (error) {
                console.warn('⚠️ No se pudo registrar Service Worker:', error);
            }
        }
        return null;
    }

    // Mostrar notificación
    show(title, message, type = 'info', options = {}) {
        const notification = {
            id: this.generateId(),
            title,
            message,
            type,
            timestamp: new Date(),
            duration: options.duration || this.defaultDuration,
            persistent: options.persistent || false,
            sound: options.sound !== false && this.soundEnabled
        };

        this.notifications.push(notification);
        this.renderNotification(notification);

        // Limitar número de notificaciones
        if (this.notifications.length > this.maxNotifications) {
            const oldest = this.notifications.shift();
            this.removeNotification(oldest.id);
        }

        // Reproducir sonido si está habilitado
        if (notification.sound) {
            this.playNotificationSound(type);
        }

        // Mostrar notificación del navegador si está permitido
        if (options.browserNotification && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/favicon.ico',
                tag: notification.id
            });
        }

        // Auto-remover si no es persistente
        if (!notification.persistent) {
            setTimeout(() => {
                this.removeNotification(notification.id);
            }, notification.duration);
        }

        return notification.id;
    }

    // Renderizar notificación en el DOM
    renderNotification(notification) {
        const element = document.createElement('div');
        element.className = `notification-item ${notification.type}`;
        element.id = `notification-${notification.id}`;

        const progressDuration = notification.persistent ? 0 : notification.duration;
        
        element.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">${this.escapeHtml(notification.title)}</div>
                <button class="notification-close" onclick="window.NotificationSystem.removeNotification('${notification.id}')">&times;</button>
            </div>
            <div class="notification-message">${this.escapeHtml(notification.message)}</div>
            <div class="notification-timestamp">${notification.timestamp.toLocaleTimeString('es-ES')}</div>
            ${!notification.persistent ? `<div class="notification-progress" style="animation-duration: ${progressDuration}ms;"></div>` : ''}
        `;

        this.container.appendChild(element);
    }

    // Remover notificación
    removeNotification(id) {
        const element = document.getElementById(`notification-${id}`);
        if (element) {
            element.classList.add('removing');
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }, 300);
        }

        this.notifications = this.notifications.filter(n => n.id !== id);
    }

    // Limpiar todas las notificaciones
    clearAll() {
        this.notifications.forEach(notification => {
            this.removeNotification(notification.id);
        });
        this.notifications = [];
    }

    // Reproducir sonido de notificación
    playNotificationSound(type) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Diferentes tonos para diferentes tipos
            const frequencies = {
                success: 800,
                warning: 600,
                error: 400,
                info: 500
            };

            oscillator.frequency.setValueAtTime(frequencies[type] || 500, audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.warn('⚠️ No se pudo reproducir sonido de notificación:', error);
        }
    }

    // Métodos de conveniencia
    success(title, message, options = {}) {
        return this.show(title, message, 'success', options);
    }

    warning(title, message, options = {}) {
        return this.show(title, message, 'warning', options);
    }

    error(title, message, options = {}) {
        return this.show(title, message, 'error', { ...options, persistent: true });
    }

    info(title, message, options = {}) {
        return this.show(title, message, 'info', options);
    }

    // Notificación para actualizaciones de 360Dialog
    dialog360Update(message, type = 'info') {
        return this.show('360Dialog', message, type, {
            browserNotification: true,
            sound: type === 'error'
        });
    }

    // Notificación para actualizaciones de cache
    cacheUpdate(message, type = 'info') {
        return this.show('Cache', message, type, {
            duration: 3000
        });
    }

    // Utilidades
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Configuración
    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
        localStorage.setItem('notificationSoundEnabled', enabled);
    }

    getSoundEnabled() {
        const stored = localStorage.getItem('notificationSoundEnabled');
        return stored !== null ? stored === 'true' : this.soundEnabled;
    }

    // Obtener estadísticas
    getStats() {
        return {
            total: this.notifications.length,
            byType: this.notifications.reduce((acc, n) => {
                acc[n.type] = (acc[n.type] || 0) + 1;
                return acc;
            }, {})
        };
    }
}

// Crear instancia global
window.NotificationSystem = new NotificationSystem();

// Función global de conveniencia
window.showNotification = (title, message, type = 'info', options = {}) => {
    return window.NotificationSystem.show(title, message, type, options);
};

// NotificationSystem está disponible globalmente como window.NotificationSystem
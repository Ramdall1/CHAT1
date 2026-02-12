/**
 * ChatBot Core Service
 * Módulo principal del sistema de chatbot
 */

import { EventEmitter } from 'events';
import logger from '../../shared/utils/logger.js';

export class ChatBot extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            name: 'ChatBot',
            version: '1.0.0',
            maxConcurrentChats: 100,
            defaultLanguage: 'es',
            sessionTimeout: 30 * 60 * 1000, // 30 minutos
            enableAnalytics: true,
            enableLogging: true,
            ...config
        };
        
        this.sessions = new Map();
        this.activeChats = new Map();
        this.messageQueue = [];
        this.plugins = new Map();
        this.handlers = new Map();
        this.middleware = [];
        
        this.stats = {
            totalMessages: 0,
            totalSessions: 0,
            activeUsers: 0,
            startTime: new Date()
        };
        
        this.isRunning = false;
        
        /** @type {NodeJS.Timeout|null} Referencia al timer de limpieza de sesiones para cleanup */
        this.sessionCleanupTimer = null;
        
        // Configurar manejadores por defecto
        this.setupDefaultHandlers();
        
        // Configurar limpieza de sesiones
        this.setupSessionCleanup();
    }

    /**
     * Inicia el chatbot
     * @returns {Promise<boolean>} Éxito del inicio
     */
    async start() {
        try {
            this.emit('starting');
            
            // Inicializar plugins
            await this.initializePlugins();
            
            // Configurar manejadores de eventos
            this.setupEventHandlers();
            
            this.isRunning = true;
            this.stats.startTime = new Date();
            
            this.emit('started');
            logger.info(`ChatBot ${this.config.name} v${this.config.version} started successfully`);
            
            return true;
        } catch (error) {
            this.emit('error', error);
            throw new Error(`Failed to start ChatBot: ${error.message}`);
        }
    }

    /**
     * Detiene el chatbot
     * @returns {Promise<boolean>} Éxito de la detención
     */
    async stop() {
        try {
            this.emit('stopping');
            
            // Limpiar timer de limpieza de sesiones para evitar memory leaks
            if (this.sessionCleanupTimer) {
                clearInterval(this.sessionCleanupTimer);
                this.sessionCleanupTimer = null;
            }
            
            // Finalizar sesiones activas
            await this.closeAllSessions();
            
            // Detener plugins
            await this.shutdownPlugins();
            
            this.isRunning = false;
            
            this.emit('stopped');
            logger.info(`ChatBot ${this.config.name} stopped successfully`);
            
            return true;
        } catch (error) {
            this.emit('error', error);
            throw new Error(`Failed to stop ChatBot: ${error.message}`);
        }
    }

    /**
     * Procesa un mensaje entrante
     * @param {object} message - Mensaje a procesar
     * @param {object} context - Contexto del mensaje
     * @returns {Promise<object>} Respuesta procesada
     */
    async processMessage(message, context = {}) {
        try {
            // Validar mensaje
            if (!this.validateMessage(message)) {
                throw new Error('Invalid message format');
            }
            
            // Obtener o crear sesión
            const session = await this.getOrCreateSession(message.userId, context);
            
            // Aplicar middleware
            const processedMessage = await this.applyMiddleware(message, session);
            
            // Procesar mensaje
            const response = await this.handleMessage(processedMessage, session);
            
            // Actualizar estadísticas
            this.updateStats(message, session);
            
            // Emitir evento
            this.emit('messageProcessed', {
                message: processedMessage,
                response,
                session
            });
            
            return response;
            
        } catch (error) {
            this.emit('messageError', { message, error });
            throw error;
        }
    }

    /**
     * Obtiene o crea una sesión de usuario
     * @param {string} userId - ID del usuario
     * @param {object} context - Contexto adicional
     * @returns {Promise<object>} Sesión del usuario
     */
    async getOrCreateSession(userId, context = {}) {
        let session = this.sessions.get(userId);
        
        if (!session) {
            session = {
                id: userId,
                startTime: new Date(),
                lastActivity: new Date(),
                messageCount: 0,
                context: {
                    language: this.config.defaultLanguage,
                    platform: context.platform || 'unknown',
                    ...context
                },
                state: 'active',
                data: {}
            };
            
            this.sessions.set(userId, session);
            this.stats.totalSessions++;
            
            this.emit('sessionCreated', session);
        } else {
            session.lastActivity = new Date();
        }
        
        return session;
    }

    /**
     * Maneja un mensaje procesado
     * @param {object} message - Mensaje procesado
     * @param {object} session - Sesión del usuario
     * @returns {Promise<object>} Respuesta generada
     */
    async handleMessage(message, session) {
        // Buscar manejador específico
        const handler = this.findHandler(message, session);
        
        if (handler) {
            return await handler.handle(message, session);
        }
        
        // Manejador por defecto
        return this.generateDefaultResponse(message, session);
    }

    /**
     * Busca el manejador apropiado para un mensaje
     * @param {object} message - Mensaje a manejar
     * @param {object} session - Sesión del usuario
     * @returns {object|null} Manejador encontrado
     */
    findHandler(message, session) {
        for (const [name, handler] of this.handlers) {
            if (handler.canHandle && handler.canHandle(message, session)) {
                return handler;
            }
        }
        return null;
    }

    /**
     * Genera respuesta por defecto
     * @param {object} message - Mensaje original
     * @param {object} session - Sesión del usuario
     * @returns {object} Respuesta por defecto
     */
    generateDefaultResponse(message, session) {
        return {
            type: 'text',
            content: 'Lo siento, no entendí tu mensaje. ¿Podrías reformularlo?',
            timestamp: new Date(),
            sessionId: session.id
        };
    }

    /**
     * Registra un manejador de mensajes
     * @param {string} name - Nombre del manejador
     * @param {object} handler - Manejador a registrar
     */
    registerHandler(name, handler) {
        if (!handler.handle || typeof handler.handle !== 'function') {
            throw new Error('Handler must have a handle method');
        }
        
        this.handlers.set(name, handler);
        this.emit('handlerRegistered', { name, handler });
    }

    /**
     * Registra middleware
     * @param {function} middleware - Función middleware
     */
    use(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        
        this.middleware.push(middleware);
    }

    /**
     * Aplica middleware al mensaje
     * @param {object} message - Mensaje original
     * @param {object} session - Sesión del usuario
     * @returns {Promise<object>} Mensaje procesado
     */
    async applyMiddleware(message, session) {
        let processedMessage = { ...message };
        
        for (const middleware of this.middleware) {
            processedMessage = await middleware(processedMessage, session) || processedMessage;
        }
        
        return processedMessage;
    }

    /**
     * Registra un plugin
     * @param {string} name - Nombre del plugin
     * @param {object} plugin - Plugin a registrar
     */
    registerPlugin(name, plugin) {
        if (!plugin.initialize || typeof plugin.initialize !== 'function') {
            throw new Error('Plugin must have an initialize method');
        }
        
        this.plugins.set(name, plugin);
        this.emit('pluginRegistered', { name, plugin });
    }

    /**
     * Inicializa todos los plugins
     * @returns {Promise} Promise de inicialización
     */
    async initializePlugins() {
        const initPromises = Array.from(this.plugins.entries()).map(
            async ([name, plugin]) => {
                try {
                    await plugin.initialize(this);
                    this.emit('pluginInitialized', { name, plugin });
                } catch (error) {
                    this.emit('pluginError', { name, plugin, error });
                    throw new Error(`Failed to initialize plugin ${name}: ${error.message}`);
                }
            }
        );
        
        await Promise.all(initPromises);
    }

    /**
     * Detiene todos los plugins
     * @returns {Promise} Promise de detención
     */
    async shutdownPlugins() {
        const shutdownPromises = Array.from(this.plugins.entries()).map(
            async ([name, plugin]) => {
                try {
                    if (plugin.shutdown) {
                        await plugin.shutdown();
                    }
                    this.emit('pluginShutdown', { name, plugin });
                } catch (error) {
                    this.emit('pluginError', { name, plugin, error });
                }
            }
        );
        
        await Promise.all(shutdownPromises);
    }

    /**
     * Valida formato del mensaje
     * @param {object} message - Mensaje a validar
     * @returns {boolean} Si el mensaje es válido
     */
    validateMessage(message) {
        return message &&
               typeof message === 'object' &&
               message.userId &&
               message.content &&
               message.type;
    }

    /**
     * Actualiza estadísticas
     * @param {object} message - Mensaje procesado
     * @param {object} session - Sesión del usuario
     */
    updateStats(message, session) {
        this.stats.totalMessages++;
        session.messageCount++;
        
        // Actualizar usuarios activos
        this.stats.activeUsers = this.sessions.size;
    }

    /**
     * Configura manejadores por defecto
     */
    setupDefaultHandlers() {
        // Manejador de comandos de sistema
        this.registerHandler('system', {
            canHandle: (message) => message.content.startsWith('/'),
            handle: async (message, session) => {
                const command = message.content.substring(1).toLowerCase();
                
                switch (command) {
                    case 'help':
                        return {
                            type: 'text',
                            content: 'Comandos disponibles: /help, /status, /reset',
                            timestamp: new Date(),
                            sessionId: session.id
                        };
                    
                    case 'status':
                        return {
                            type: 'text',
                            content: `Estado: Activo\nMensajes en sesión: ${session.messageCount}`,
                            timestamp: new Date(),
                            sessionId: session.id
                        };
                    
                    case 'reset':
                        session.data = {};
                        return {
                            type: 'text',
                            content: 'Sesión reiniciada',
                            timestamp: new Date(),
                            sessionId: session.id
                        };
                    
                    default:
                        return {
                            type: 'text',
                            content: 'Comando no reconocido. Usa /help para ver comandos disponibles.',
                            timestamp: new Date(),
                            sessionId: session.id
                        };
                }
            }
        });
    }

    /**
     * Configura manejadores de eventos
     */
    setupEventHandlers() {
        this.on('error', (error) => {
            logger.error('ChatBot Error:', error);
        });
        
        this.on('sessionCreated', (session) => {
            logger.info(`New session created: ${session.id}`);
        });
    }

    /**
     * Configura limpieza automática de sesiones
     */
    setupSessionCleanup() {
        this.sessionCleanupTimer = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // Cada 5 minutos
    }

    /**
     * Limpia sesiones expiradas
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        const expiredSessions = [];
        
        for (const [userId, session] of this.sessions) {
            const timeSinceLastActivity = now - session.lastActivity.getTime();
            
            if (timeSinceLastActivity > this.config.sessionTimeout) {
                expiredSessions.push(userId);
            }
        }
        
        expiredSessions.forEach(userId => {
            const session = this.sessions.get(userId);
            this.sessions.delete(userId);
            this.emit('sessionExpired', session);
        });
        
        if (expiredSessions.length > 0) {
            logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
        }
    }

    /**
     * Cierra todas las sesiones activas
     * @returns {Promise} Promise de cierre
     */
    async closeAllSessions() {
        const sessions = Array.from(this.sessions.values());
        
        for (const session of sessions) {
            session.state = 'closed';
            this.emit('sessionClosed', session);
        }
        
        this.sessions.clear();
        this.activeChats.clear();
    }

    /**
     * Obtiene estadísticas del chatbot
     * @returns {object} Estadísticas actuales
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime.getTime();
        
        return {
            ...this.stats,
            uptime,
            isRunning: this.isRunning,
            activeSessions: this.sessions.size,
            registeredHandlers: this.handlers.size,
            registeredPlugins: this.plugins.size,
            middlewareCount: this.middleware.length
        };
    }

    /**
     * Obtiene información de una sesión
     * @param {string} userId - ID del usuario
     * @returns {object|null} Información de la sesión
     */
    getSession(userId) {
        return this.sessions.get(userId) || null;
    }

    /**
     * Elimina una sesión
     * @param {string} userId - ID del usuario
     * @returns {boolean} Éxito de la eliminación
     */
    removeSession(userId) {
        const session = this.sessions.get(userId);
        if (session) {
            this.sessions.delete(userId);
            this.emit('sessionRemoved', session);
            return true;
        }
        return false;
    }
}

// Instancia singleton
const chatBot = new ChatBot();

export default chatBot;
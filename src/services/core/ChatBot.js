/**
 * ChatBot Core Service
 * Motor principal del sistema ChatBot Enterprise
 */

import { EventEmitter } from 'events';

class ChatBot extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            name: config.name || 'ChatBot Enterprise',
            version: config.version || '1.0.0',
            language: config.language || 'es',
            maxConcurrentChats: config.maxConcurrentChats || 100,
            responseTimeout: config.responseTimeout || 30000,
            enableAnalytics: config.enableAnalytics !== false,
            enableLogging: config.enableLogging !== false,
            ...config
        };

        this.state = 'stopped';
        this.activeChats = new Map();
        this.messageQueue = [];
        this.plugins = new Map();
        this.middleware = [];
        this.stats = {
            messagesProcessed: 0,
            chatsStarted: 0,
            chatsEnded: 0,
            errors: 0,
            uptime: 0,
            startTime: null
        };

        this.setupEventHandlers();
    }

    /**
     * Inicializa el ChatBot
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            this.state = 'initializing';
            this.stats.startTime = new Date();
            
            logger.debug(`[ChatBot] Initializing ${this.config.name} v${this.config.version}`);
            
            // Inicializar componentes
            await this.initializePlugins();
            await this.loadMiddleware();
            
            this.state = 'running';
            this.emit('initialized');
            
            logger.debug('[ChatBot] ChatBot initialized successfully');
            
            // Iniciar procesamiento de cola de mensajes
            this.startMessageProcessing();
            
        } catch (error) {
            this.state = 'error';
            this.stats.errors++;
            logger.error('[ChatBot] Failed to initialize:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Procesa un mensaje entrante
     * @param {Object} message - Mensaje a procesar
     * @returns {Promise<Object>} - Respuesta del chatbot
     */
    async processMessage(message) {
        if (this.state !== 'running') {
            throw new Error('ChatBot is not running');
        }

        try {
            this.stats.messagesProcessed++;
            
            // Validar mensaje
            const validatedMessage = await this.validateMessage(message);
            
            // Aplicar middleware
            const processedMessage = await this.applyMiddleware(validatedMessage);
            
            // Generar respuesta
            const response = await this.generateResponse(processedMessage);
            
            // Registrar actividad
            this.updateChatActivity(processedMessage.chatId);
            
            this.emit('messageProcessed', {
                input: processedMessage,
                output: response
            });

            return response;
            
        } catch (error) {
            this.stats.errors++;
            logger.error('[ChatBot] Error processing message:', error);
            this.emit('error', error);
            
            return {
                type: 'error',
                content: 'Lo siento, ocurrió un error procesando tu mensaje.',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * Valida un mensaje entrante
     * @param {Object} message - Mensaje a validar
     * @returns {Promise<Object>} - Mensaje validado
     */
    async validateMessage(message) {
        if (!message) {
            throw new Error('Message is required');
        }

        if (!message.content && !message.attachments) {
            throw new Error('Message must have content or attachments');
        }

        return {
            id: message.id || this.generateMessageId(),
            chatId: message.chatId || this.generateChatId(),
            userId: message.userId || 'anonymous',
            content: message.content || '',
            type: message.type || 'text',
            timestamp: message.timestamp || new Date().toISOString(),
            attachments: message.attachments || [],
            metadata: message.metadata || {}
        };
    }

    /**
     * Aplica middleware al mensaje
     * @param {Object} message - Mensaje a procesar
     * @returns {Promise<Object>} - Mensaje procesado
     */
    async applyMiddleware(message) {
        let processedMessage = { ...message };

        for (const middleware of this.middleware) {
            try {
                processedMessage = await middleware(processedMessage);
            } catch (error) {
                logger.error('[ChatBot] Middleware error:', error);
                // Continuar con el siguiente middleware
            }
        }

        return processedMessage;
    }

    /**
     * Genera una respuesta para el mensaje
     * @param {Object} message - Mensaje procesado
     * @returns {Promise<Object>} - Respuesta generada
     */
    async generateResponse(message) {
        // Lógica básica de respuesta (en producción sería más compleja)
        const responses = {
            greeting: ['¡Hola! ¿En qué puedo ayudarte?', '¡Bienvenido! ¿Cómo puedo asistirte?'],
            help: ['Puedo ayudarte con información, responder preguntas y asistirte en lo que necesites.'],
            default: ['Entiendo. ¿Puedes darme más detalles?', 'Interesante. ¿Hay algo específico que quieras saber?']
        };

        let responseType = 'default';
        const content = message.content.toLowerCase();

        if (content.includes('hola') || content.includes('buenos') || content.includes('saludos')) {
            responseType = 'greeting';
        } else if (content.includes('ayuda') || content.includes('help') || content.includes('?')) {
            responseType = 'help';
        }

        const responseOptions = responses[responseType];
        const selectedResponse = responseOptions[Math.floor(Math.random() * responseOptions.length)];

        return {
            id: this.generateMessageId(),
            chatId: message.chatId,
            type: 'text',
            content: selectedResponse,
            timestamp: new Date().toISOString(),
            metadata: {
                responseType,
                processingTime: Date.now() - new Date(message.timestamp).getTime()
            }
        };
    }

    /**
     * Inicia una nueva conversación
     * @param {string} userId - ID del usuario
     * @returns {string} - ID de la conversación
     */
    startChat(userId) {
        const chatId = this.generateChatId();
        
        this.activeChats.set(chatId, {
            id: chatId,
            userId,
            startTime: new Date(),
            lastActivity: new Date(),
            messageCount: 0,
            status: 'active'
        });

        this.stats.chatsStarted++;
        this.emit('chatStarted', { chatId, userId });
        
        logger.debug(`[ChatBot] Chat started: ${chatId} for user: ${userId}`);
        return chatId;
    }

    /**
     * Finaliza una conversación
     * @param {string} chatId - ID de la conversación
     */
    endChat(chatId) {
        const chat = this.activeChats.get(chatId);
        if (chat) {
            chat.status = 'ended';
            chat.endTime = new Date();
            this.activeChats.delete(chatId);
            
            this.stats.chatsEnded++;
            this.emit('chatEnded', { chatId, duration: chat.endTime - chat.startTime });
            
            logger.debug(`[ChatBot] Chat ended: ${chatId}`);
        }
    }

    /**
     * Actualiza la actividad de un chat
     * @param {string} chatId - ID del chat
     */
    updateChatActivity(chatId) {
        const chat = this.activeChats.get(chatId);
        if (chat) {
            chat.lastActivity = new Date();
            chat.messageCount++;
        }
    }

    /**
     * Registra un plugin
     * @param {string} name - Nombre del plugin
     * @param {Object} plugin - Plugin a registrar
     */
    registerPlugin(name, plugin) {
        this.plugins.set(name, plugin);
        logger.debug(`[ChatBot] Plugin registered: ${name}`);
    }

    /**
     * Añade middleware
     * @param {Function} middleware - Función middleware
     */
    use(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        this.middleware.push(middleware);
    }

    /**
     * Obtiene estadísticas del chatbot
     * @returns {Object} - Estadísticas
     */
    getStats() {
        const uptime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
        
        return {
            ...this.stats,
            uptime,
            activeChats: this.activeChats.size,
            queueSize: this.messageQueue.length,
            state: this.state
        };
    }

    /**
     * Detiene el chatbot
     * @returns {Promise<void>}
     */
    async stop() {
        this.state = 'stopping';
        
        // Finalizar chats activos
        for (const [chatId] of this.activeChats) {
            this.endChat(chatId);
        }

        this.state = 'stopped';
        this.emit('stopped');
        
        logger.debug('[ChatBot] ChatBot stopped');
    }

    /**
     * Configura manejadores de eventos
     */
    setupEventHandlers() {
        this.on('error', (error) => {
            logger.error('[ChatBot] Error event:', error);
        });

        this.on('messageProcessed', (data) => {
            if (this.config.enableLogging) {
                logger.debug(`[ChatBot] Message processed for chat: ${data.input.chatId}`);
            }
        });
    }

    /**
     * Inicializa plugins
     */
    async initializePlugins() {
        for (const [name, plugin] of this.plugins) {
            try {
                if (plugin.initialize) {
                    await plugin.initialize();
                }
                logger.debug(`[ChatBot] Plugin initialized: ${name}`);
            } catch (error) {
                logger.error(`[ChatBot] Failed to initialize plugin ${name}:`, error);
            }
        }
    }

    /**
     * Carga middleware por defecto
     */
    async loadMiddleware() {
        // Middleware de logging
        this.use(async (message) => {
            if (this.config.enableLogging) {
                logger.debug(`[ChatBot] Processing message: ${message.id}`);
            }
            return message;
        });

        // Middleware de analytics
        if (this.config.enableAnalytics) {
            this.use(async (message) => {
                // Registrar analytics (implementación básica)
                return message;
            });
        }
    }

    /**
     * Inicia el procesamiento de la cola de mensajes
     */
    startMessageProcessing() {
        setInterval(() => {
            if (this.messageQueue.length > 0 && this.state === 'running') {
                const message = this.messageQueue.shift();
                this.processMessage(message).catch(error => {
                    logger.error('[ChatBot] Queue processing error:', error);
                });
            }
        }, 100);
    }

    /**
     * Genera un ID único para mensajes
     * @returns {string} - ID único
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Genera un ID único para chats
     * @returns {string} - ID único
     */
    generateChatId() {
        return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export default ChatBot;
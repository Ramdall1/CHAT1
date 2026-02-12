/**
 * MessagingAgent - Agente Event-Driven para Gestión Inteligente de Mensajes
 * 
 * Transforma el módulo de messaging en un agente inteligente que maneja:
 * - Gestión inteligente de mensajes y conversaciones
 * - Optimización de entrega y routing
 * - Análisis de patrones de comunicación
 * - Automatización de respuestas
 * - Gestión de colas y prioridades
 * - Monitoreo de rendimiento y métricas
 * - Recuperación ante fallos
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import { getDatabase } from './database.js';
import { createLogger } from './logger.js';
import { Message } from '../core/Message.js';
import { getContactService } from '../core/ContactService.js';
import { CONFIG } from '../../../workflows/index.js';

const logger = createLogger('MESSAGING_AGENT');

/**
 * Agente inteligente para gestión de mensajes
 */
export class MessagingAgent extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuraciones evolutivas del agente
    this.config = {
      // Configuración de colas
      maxQueueSize: 10000,
      batchSize: 50,
      processingInterval: 1000,
      
      // Configuración de prioridades
      priorityLevels: ['low', 'normal', 'high', 'urgent'],
      defaultPriority: 'normal',
      
      // Configuración de reintentos
      maxRetries: 3,
      retryDelay: 2000,
      backoffMultiplier: 2,
      
      // Configuración de rate limiting
      rateLimits: {
        perSecond: 10,
        perMinute: 100,
        perHour: 1000,
        perDay: 10000
      },
      
      // Configuración de análisis
      analysisWindow: 24 * 60 * 60 * 1000, // 24 horas
      patternDetectionThreshold: 5,
      
      // Configuración de optimización
      optimizationInterval: 5 * 60 * 1000, // 5 minutos
      learningEnabled: true,
      adaptiveRouting: true,
      
      // Configuración de monitoreo
      metricsRetention: 7 * 24 * 60 * 60 * 1000, // 7 días
      alertThresholds: {
        failureRate: 0.05, // 5%
        avgResponseTime: 5000, // 5 segundos
        queueSize: 1000
      },
      
      ...options
    };
    
    // Estado del agente
    this.state = {
      isActive: false,
      isProcessing: false,
      lastOptimization: null,
      lastHealthCheck: null,
      totalProcessed: 0,
      totalFailed: 0,
      avgResponseTime: 0
    };
    
    // Colas de mensajes por prioridad
    this.messageQueues = new Map();
    this.config.priorityLevels.forEach(level => {
      this.messageQueues.set(level, []);
    });
    
    // Sistema de routing inteligente
    this.routingTable = new Map();
    this.providerStats = new Map();
    this.circuitBreakers = new Map();
    
    // Sistema de análisis y aprendizaje
    this.conversationPatterns = new Map();
    this.responseTemplates = new Map();
    this.userPreferences = new Map();
    this.communicationHistory = [];
    
    // Métricas evolutivas
    this.metrics = {
      messages: {
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        queued: 0
      },
      performance: {
        avgProcessingTime: 0,
        avgDeliveryTime: 0,
        throughput: 0,
        errorRate: 0
      },
      conversations: {
        active: 0,
        total: 0,
        avgLength: 0,
        avgResponseTime: 0
      },
      optimization: {
        routeOptimizations: 0,
        templateOptimizations: 0,
        queueOptimizations: 0
      }
    };
    
    // Rate limiting
    this.rateLimiters = new Map();
    this.initializeRateLimiters();
    
    // Timers y procesos
    this.timers = {
      processing: null,
      optimization: null,
      monitoring: null,
      cleanup: null
    };
    
    // Mutex para operaciones críticas
    this.mutex = {
      processing: false,
      optimization: false,
      persistence: false
    };
    
    // Dependencias
    this.db = getDatabase();
    this.contactService = getContactService();
    this.filename = this.db.files.MESSAGES;
    this.whatsappConfig = CONFIG.DIALOG360;
    
    // Configurar manejo de errores
    this.setMaxListeners(100);
    this.on('error', this.handleError.bind(this));
    
    logger.info('MessagingAgent inicializado');
  }
  
  /**
   * Inicializar el agente
   */
  async initialize() {
    try {
      logger.info('Inicializando MessagingAgent...');
      
      // Cargar estado persistente
      await this.loadState();
      
      // Cargar patrones de aprendizaje
      await this.loadLearningPatterns();
      
      // Inicializar proveedores
      await this.initializeProviders();
      
      // Inicializar circuit breakers
      this.initializeCircuitBreakers();
      
      // Configurar eventos del sistema
      this.setupSystemEvents();
      
      // Configurar eventos de mensajes
      this.setupMessageEvents();
      
      this.state.isActive = true;
      this.emit('agent:initialized', { agent: 'MessagingAgent' });
      
      logger.info('MessagingAgent inicializado exitosamente');
    } catch (error) {
      logger.error('Error inicializando MessagingAgent:', error);
      throw error;
    }
  }
  
  /**
   * Activar el agente
   */
  async activate() {
    if (this.state.isActive) return;
    
    try {
      logger.info('Activando MessagingAgent...');
      
      // Iniciar procesamiento de colas
      this.startQueueProcessing();
      
      // Iniciar optimización
      this.startOptimization();
      
      // Iniciar monitoreo
      this.startMonitoring();
      
      // Iniciar limpieza automática
      this.startCleanup();
      
      this.state.isActive = true;
      this.emit('agent:activated', { agent: 'MessagingAgent' });
      
      logger.info('MessagingAgent activado');
    } catch (error) {
      logger.error('Error activando MessagingAgent:', error);
      throw error;
    }
  }
  
  /**
   * Desactivar el agente
   */
  async deactivate() {
    if (!this.state.isActive) return;
    
    try {
      logger.info('Desactivando MessagingAgent...');
      
      // Detener timers
      this.stopTimers();
      
      // Procesar mensajes pendientes
      await this.processRemainingMessages();
      
      // Guardar estado
      await this.saveState();
      
      this.state.isActive = false;
      this.emit('agent:deactivated', { agent: 'MessagingAgent' });
      
      logger.info('MessagingAgent desactivado');
    } catch (error) {
      logger.error('Error desactivando MessagingAgent:', error);
      throw error;
    }
  }
  
  /**
   * Configurar eventos del sistema
   */
  setupSystemEvents() {
    // Eventos de otros agentes
    this.on('system:shutdown', this.handleSystemShutdown.bind(this));
    this.on('system:restart', this.handleSystemRestart.bind(this));
    this.on('system:optimization', this.handleOptimizationTrigger.bind(this));
    
    // Eventos de configuración
    this.on('config:updated', this.handleConfigUpdate.bind(this));
    this.on('provider:status', this.handleProviderStatus.bind(this));
    
    // Eventos de monitoreo
    this.on('metrics:alert', this.handleMetricsAlert.bind(this));
    this.on('performance:degradation', this.handlePerformanceDegradation.bind(this));
  }
  
  /**
   * Configurar eventos de mensajes
   */
  setupMessageEvents() {
    // Eventos de mensajes entrantes
    this.on('message:received', this.handleIncomingMessage.bind(this));
    this.on('message:send', this.handleSendMessage.bind(this));
    this.on('message:schedule', this.handleScheduleMessage.bind(this));
    
    // Eventos de estado de mensajes
    this.on('message:sent', this.handleMessageSent.bind(this));
    this.on('message:delivered', this.handleMessageDelivered.bind(this));
    this.on('message:read', this.handleMessageRead.bind(this));
    this.on('message:failed', this.handleMessageFailed.bind(this));
    
    // Eventos de conversaciones
    this.on('conversation:started', this.handleConversationStarted.bind(this));
    this.on('conversation:ended', this.handleConversationEnded.bind(this));
    this.on('conversation:analyzed', this.handleConversationAnalyzed.bind(this));
    
    // Eventos de automatización
    this.on('automation:trigger', this.handleAutomationTrigger.bind(this));
    this.on('template:suggested', this.handleTemplateSuggestion.bind(this));
  }
  
  /**
   * Manejar mensaje entrante
   */
  async handleIncomingMessage(event) {
    try {
      const { messageData } = event;
      
      // Crear instancia de mensaje
      const message = new Message({
        ...messageData,
        direction: 'inbound',
        status: 'read'
      });
      
      // Guardar en base de datos
      const savedMessage = await this.db.append(this.filename, message.toJSON());
      const messageInstance = Message.fromJSON(savedMessage);
      
      // Analizar mensaje
      await this.analyzeIncomingMessage(messageInstance);
      
      // Actualizar métricas
      this.updateMetrics('message_received', messageInstance);
      
      // Actualizar contacto
      await this.updateContactLastInteraction(messageInstance.from);
      
      // Emitir evento de procesamiento
      this.emit('message:processed', { 
        message: messageInstance,
        type: 'incoming'
      });
      
      logger.info(`Mensaje entrante procesado de ${messageInstance.from}`);
      
    } catch (error) {
      logger.error('Error procesando mensaje entrante:', error);
      this.emit('error', { type: 'incoming_message', error });
    }
  }
  
  /**
   * Manejar envío de mensaje
   */
  async handleSendMessage(event) {
    try {
      const { to, content, type = 'text', priority = 'normal', options = {} } = event;
      
      // Crear mensaje
      let message;
      switch (type) {
      case 'text':
        message = Message.createTextMessage(to, content, options);
        break;
      case 'template':
        message = Message.createTemplateMessage(to, content.templateId, content.templateData, options);
        break;
      case 'media':
        message = Message.createMediaMessage(to, content.mediaType, content.mediaUrl, options);
        break;
      default:
        throw new Error(`Tipo de mensaje no soportado: ${type}`);
      }
      
      // Añadir a cola con prioridad
      await this.addToQueue(message, priority);
      
      // Emitir evento de encolado
      this.emit('message:queued', { 
        message,
        priority,
        queueSize: this.getQueueSize()
      });
      
      logger.info(`Mensaje encolado para ${to} con prioridad ${priority}`);
      
    } catch (error) {
      logger.error('Error encolando mensaje:', error);
      this.emit('error', { type: 'send_message', error });
    }
  }
  
  /**
   * Añadir mensaje a cola
   */
  async addToQueue(message, priority = 'normal') {
    try {
      // Verificar límites de cola
      if (this.getTotalQueueSize() >= this.config.maxQueueSize) {
        throw new Error('Cola de mensajes llena');
      }
      
      // Verificar rate limiting
      if (!this.checkRateLimit(message.to)) {
        throw new Error('Rate limit excedido');
      }
      
      // Añadir timestamp de encolado
      message.metadata.queuedAt = new Date().toISOString();
      message.metadata.priority = priority;
      
      // Añadir a cola correspondiente
      const queue = this.messageQueues.get(priority);
      queue.push(message);
      
      // Actualizar métricas
      this.metrics.messages.queued++;
      
      // Guardar en base de datos
      await this.db.append(this.filename, message.toJSON());
      
      logger.debug(`Mensaje añadido a cola ${priority}: ${message.id}`);
      
    } catch (error) {
      logger.error('Error añadiendo mensaje a cola:', error);
      throw error;
    }
  }
  
  /**
   * Iniciar procesamiento de colas
   */
  startQueueProcessing() {
    if (this.timers.processing) return;
    
    this.timers.processing = setInterval(async() => {
      if (this.mutex.processing) return;
      
      try {
        this.mutex.processing = true;
        await this.processMessageQueues();
      } catch (error) {
        logger.error('Error en procesamiento de colas:', error);
      } finally {
        this.mutex.processing = false;
      }
    }, this.config.processingInterval);
    
    logger.info('Procesamiento de colas iniciado');
  }
  
  /**
   * Procesar colas de mensajes
   */
  async processMessageQueues() {
    try {
      if (!this.state.isActive) return;
      
      const startTime = Date.now();
      let processedCount = 0;
      
      // Procesar por orden de prioridad
      for (const priority of this.config.priorityLevels.reverse()) {
        const queue = this.messageQueues.get(priority);
        
        if (queue.length === 0) continue;
        
        // Procesar batch de mensajes
        const batch = queue.splice(0, this.config.batchSize);
        
        for (const message of batch) {
          try {
            await this.processMessage(message);
            processedCount++;
          } catch (error) {
            logger.error(`Error procesando mensaje ${message.id}:`, error);
            await this.handleMessageProcessingError(message, error);
          }
        }
        
        // Limitar procesamiento por batch
        if (processedCount >= this.config.batchSize) break;
      }
      
      // Actualizar métricas de rendimiento
      if (processedCount > 0) {
        const processingTime = Date.now() - startTime;
        this.updatePerformanceMetrics(processedCount, processingTime);
        
        logger.debug(`Procesados ${processedCount} mensajes en ${processingTime}ms`);
      }
      
    } catch (error) {
      logger.error('Error en procesamiento de colas:', error);
      throw error;
    }
  }
  
  /**
   * Procesar mensaje individual
   */
  async processMessage(message) {
    try {
      const startTime = Date.now();
      
      // Verificar circuit breaker
      if (!this.isProviderAvailable(message.to)) {
        throw new Error('Proveedor no disponible');
      }
      
      // Seleccionar ruta óptima
      const route = await this.selectOptimalRoute(message);
      
      // Enviar mensaje
      await this.sendMessage(message, route);
      
      // Actualizar métricas
      const processingTime = Date.now() - startTime;
      this.updateMessageMetrics(message, processingTime);
      
      // Aprender de la interacción
      if (this.config.learningEnabled) {
        await this.learnFromMessage(message, route, processingTime);
      }
      
      this.emit('message:processed', { 
        message,
        route,
        processingTime
      });
      
    } catch (error) {
      logger.error(`Error procesando mensaje ${message.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Enviar mensaje a través de la ruta seleccionada
   */
  async sendMessage(message, route) {
    try {
      logger.debug(`Enviando mensaje ${message.id} a ${message.to} via ${route.provider}`);
      
      // Simular envío (aquí iría la integración real)
      await this.simulateMessageSending(message, route);
      
      // Marcar como enviado
      message.markAsSent(`wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      // Actualizar en base de datos
      await this.db.update(this.filename, message.id, message.toJSON());
      
      // Actualizar estadísticas del proveedor
      this.updateProviderStats(route.provider, 'success');
      
      // Emitir evento de envío
      this.emit('message:sent', { message, route });
      
      // Simular entrega después de un tiempo
      setTimeout(async() => {
        try {
          message.markAsDelivered();
          await this.db.update(this.filename, message.id, message.toJSON());
          this.emit('message:delivered', { message });
        } catch (error) {
          logger.error('Error simulando entrega:', error);
        }
      }, Math.random() * 3000 + 1000);
      
    } catch (error) {
      // Marcar como fallido
      message.markAsFailed('SEND_ERROR', error.message);
      await this.db.update(this.filename, message.id, message.toJSON());
      
      // Actualizar estadísticas del proveedor
      this.updateProviderStats(route.provider, 'failure');
      
      // Activar circuit breaker si es necesario
      this.updateCircuitBreaker(route.provider, false);
      
      throw error;
    }
  }
  
  /**
   * Simular envío de mensaje
   */
  async simulateMessageSending(message, route) {
    // Simular delay variable según el proveedor
    const delay = route.avgResponseTime || 1000;
    const jitter = Math.random() * 500;
    
    await new Promise(resolve => setTimeout(resolve, delay + jitter));
    
    // Simular fallo ocasional
    if (Math.random() < 0.02) { // 2% de fallo
      throw new Error('Fallo simulado de envío');
    }
  }
  
  /**
   * Seleccionar ruta óptima para el mensaje
   */
  async selectOptimalRoute(message) {
    try {
      // Obtener rutas disponibles
      const availableRoutes = this.getAvailableRoutes(message.to);
      
      if (availableRoutes.length === 0) {
        throw new Error('No hay rutas disponibles');
      }
      
      // Si solo hay una ruta, usarla
      if (availableRoutes.length === 1) {
        return availableRoutes[0];
      }
      
      // Calcular puntuación para cada ruta
      const routeScores = availableRoutes.map(route => ({
        route,
        score: this.calculateRouteScore(route, message)
      }));
      
      // Ordenar por puntuación (mayor es mejor)
      routeScores.sort((a, b) => b.score - a.score);
      
      // Seleccionar la mejor ruta
      const selectedRoute = routeScores[0].route;
      
      logger.debug(`Ruta seleccionada: ${selectedRoute.provider} (score: ${routeScores[0].score})`);
      
      return selectedRoute;
      
    } catch (error) {
      logger.error('Error seleccionando ruta óptima:', error);
      throw error;
    }
  }
  
  /**
   * Calcular puntuación de ruta
   */
  calculateRouteScore(route, message) {
    let score = 100; // Puntuación base
    
    // Factor de disponibilidad
    score *= route.availability || 1;
    
    // Factor de velocidad (menor tiempo = mayor puntuación)
    const avgTime = route.avgResponseTime || 1000;
    score *= Math.max(0.1, 1 - (avgTime / 10000));
    
    // Factor de costo (menor costo = mayor puntuación)
    const cost = route.cost || 0.01;
    score *= Math.max(0.1, 1 - cost);
    
    // Factor de tasa de éxito
    score *= route.successRate || 0.95;
    
    // Factor de prioridad del mensaje
    const priorityMultiplier = {
      'urgent': 1.5,
      'high': 1.2,
      'normal': 1.0,
      'low': 0.8
    };
    score *= priorityMultiplier[message.metadata.priority] || 1.0;
    
    return score;
  }
  
  /**
   * Obtener rutas disponibles
   */
  getAvailableRoutes(destination) {
    const routes = [];
    
    // Ruta principal (WhatsApp Business API)
    routes.push({
      provider: 'whatsapp_business',
      availability: this.getProviderAvailability('whatsapp_business'),
      avgResponseTime: this.getProviderAvgResponseTime('whatsapp_business'),
      successRate: this.getProviderSuccessRate('whatsapp_business'),
      cost: 0.05,
      priority: 1
    });
    
    // Ruta de respaldo (SMS)
    routes.push({
      provider: 'sms_fallback',
      availability: this.getProviderAvailability('sms_fallback'),
      avgResponseTime: this.getProviderAvgResponseTime('sms_fallback'),
      successRate: this.getProviderSuccessRate('sms_fallback'),
      cost: 0.10,
      priority: 2
    });
    
    // Filtrar rutas disponibles
    return routes.filter(route => 
      route.availability > 0.5 && 
      this.isProviderAvailable(route.provider)
    );
  }
  
  /**
   * Analizar mensaje entrante
   */
  async analyzeIncomingMessage(message) {
    try {
      const analysis = {
        sentiment: await this.analyzeSentiment(message.content.text),
        intent: await this.detectIntent(message.content.text),
        topics: await this.extractTopics(message.content.text),
        urgency: await this.assessUrgency(message.content.text),
        language: await this.detectLanguage(message.content.text)
      };
      
      // Guardar análisis en metadata
      message.metadata.analysis = analysis;
      await this.db.update(this.filename, message.id, message.toJSON());
      
      // Actualizar patrones de conversación
      await this.updateConversationPatterns(message.from, analysis);
      
      // Sugerir respuesta automática si es apropiado
      if (analysis.intent && this.shouldSuggestAutoResponse(analysis)) {
        await this.suggestAutoResponse(message, analysis);
      }
      
      this.emit('message:analyzed', { message, analysis });
      
    } catch (error) {
      logger.error('Error analizando mensaje:', error);
    }
  }
  
  /**
   * Analizar sentimiento del mensaje
   */
  async analyzeSentiment(text) {
    if (!text) return 'neutral';
    
    // Análisis básico de sentimiento
    const positiveWords = ['gracias', 'excelente', 'perfecto', 'bueno', 'genial'];
    const negativeWords = ['problema', 'error', 'mal', 'terrible', 'horrible'];
    
    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
  
  /**
   * Detectar intención del mensaje
   */
  async detectIntent(text) {
    if (!text) return 'unknown';
    
    const lowerText = text.toLowerCase();
    
    // Intenciones básicas
    if (lowerText.includes('hola') || lowerText.includes('buenos')) return 'greeting';
    if (lowerText.includes('ayuda') || lowerText.includes('soporte')) return 'help';
    if (lowerText.includes('precio') || lowerText.includes('costo')) return 'pricing';
    if (lowerText.includes('información') || lowerText.includes('info')) return 'information';
    if (lowerText.includes('problema') || lowerText.includes('error')) return 'complaint';
    if (lowerText.includes('gracias') || lowerText.includes('adiós')) return 'farewell';
    
    return 'general';
  }
  
  /**
   * Extraer temas del mensaje
   */
  async extractTopics(text) {
    if (!text) return [];
    
    const topics = [];
    const lowerText = text.toLowerCase();
    
    // Temas básicos
    if (lowerText.includes('producto') || lowerText.includes('servicio')) topics.push('product');
    if (lowerText.includes('precio') || lowerText.includes('costo')) topics.push('pricing');
    if (lowerText.includes('entrega') || lowerText.includes('envío')) topics.push('delivery');
    if (lowerText.includes('soporte') || lowerText.includes('ayuda')) topics.push('support');
    if (lowerText.includes('factura') || lowerText.includes('pago')) topics.push('billing');
    
    return topics;
  }
  
  /**
   * Evaluar urgencia del mensaje
   */
  async assessUrgency(text) {
    if (!text) return 'low';
    
    const lowerText = text.toLowerCase();
    const urgentWords = ['urgente', 'emergencia', 'inmediato', 'ahora', 'rápido'];
    
    if (urgentWords.some(word => lowerText.includes(word))) return 'high';
    if (lowerText.includes('pronto') || lowerText.includes('cuando')) return 'medium';
    
    return 'low';
  }
  
  /**
   * Detectar idioma del mensaje
   */
  async detectLanguage(text) {
    if (!text) return 'unknown';
    
    // Detección básica de idioma
    const spanishWords = ['hola', 'gracias', 'por favor', 'buenos', 'días'];
    const englishWords = ['hello', 'thank', 'please', 'good', 'morning'];
    
    const lowerText = text.toLowerCase();
    const spanishCount = spanishWords.filter(word => lowerText.includes(word)).length;
    const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
    
    if (spanishCount > englishCount) return 'es';
    if (englishCount > spanishCount) return 'en';
    
    return 'unknown';
  }
  
  /**
   * Inicializar rate limiters
   */
  initializeRateLimiters() {
    const limits = this.config.rateLimits;
    
    this.rateLimiters.set('perSecond', { limit: limits.perSecond, window: 1000, requests: [] });
    this.rateLimiters.set('perMinute', { limit: limits.perMinute, window: 60000, requests: [] });
    this.rateLimiters.set('perHour', { limit: limits.perHour, window: 3600000, requests: [] });
    this.rateLimiters.set('perDay', { limit: limits.perDay, window: 86400000, requests: [] });
  }
  
  /**
   * Verificar rate limit
   */
  checkRateLimit(destination) {
    const now = Date.now();
    
    for (const [period, limiter] of this.rateLimiters) {
      // Limpiar requests antiguos
      limiter.requests = limiter.requests.filter(time => now - time < limiter.window);
      
      // Verificar límite
      if (limiter.requests.length >= limiter.limit) {
        logger.warn(`Rate limit excedido para ${period}: ${limiter.requests.length}/${limiter.limit}`);
        return false;
      }
    }
    
    // Registrar request
    for (const [, limiter] of this.rateLimiters) {
      limiter.requests.push(now);
    }
    
    return true;
  }
  
  /**
   * Inicializar proveedores
   */
  async initializeProviders() {
    const providers = ['whatsapp_business', 'sms_fallback'];
    
    for (const provider of providers) {
      this.providerStats.set(provider, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 1000,
        lastRequest: null,
        availability: 1.0,
        successRate: 0.95
      });
    }
    
    logger.info('Proveedores inicializados');
  }
  
  /**
   * Inicializar circuit breakers
   */
  initializeCircuitBreakers() {
    const providers = ['whatsapp_business', 'sms_fallback'];
    
    for (const provider of providers) {
      this.circuitBreakers.set(provider, {
        state: 'closed', // closed, open, half-open
        failures: 0,
        lastFailure: null,
        threshold: 5,
        timeout: 60000 // 1 minuto
      });
    }
    
    logger.info('Circuit breakers inicializados');
  }
  
  /**
   * Verificar disponibilidad del proveedor
   */
  isProviderAvailable(provider) {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) return true;
    
    const now = Date.now();
    
    switch (breaker.state) {
    case 'closed':
      return true;
    case 'open':
      if (now - breaker.lastFailure > breaker.timeout) {
        breaker.state = 'half-open';
        return true;
      }
      return false;
    case 'half-open':
      return true;
    default:
      return true;
    }
  }
  
  /**
   * Actualizar circuit breaker
   */
  updateCircuitBreaker(provider, success) {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) return;
    
    if (success) {
      breaker.failures = 0;
      breaker.state = 'closed';
    } else {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      
      if (breaker.failures >= breaker.threshold) {
        breaker.state = 'open';
        logger.warn(`Circuit breaker abierto para proveedor ${provider}`);
      }
    }
  }
  
  /**
   * Obtener estadísticas del proveedor
   */
  getProviderAvailability(provider) {
    const stats = this.providerStats.get(provider);
    return stats ? stats.availability : 0.95;
  }
  
  getProviderAvgResponseTime(provider) {
    const stats = this.providerStats.get(provider);
    return stats ? stats.avgResponseTime : 1000;
  }
  
  getProviderSuccessRate(provider) {
    const stats = this.providerStats.get(provider);
    return stats ? stats.successRate : 0.95;
  }
  
  /**
   * Actualizar estadísticas del proveedor
   */
  updateProviderStats(provider, result, responseTime = null) {
    const stats = this.providerStats.get(provider);
    if (!stats) return;
    
    stats.totalRequests++;
    stats.lastRequest = Date.now();
    
    if (result === 'success') {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }
    
    // Actualizar tasa de éxito
    stats.successRate = stats.successfulRequests / stats.totalRequests;
    
    // Actualizar disponibilidad
    stats.availability = Math.max(0.1, stats.successRate);
    
    // Actualizar tiempo de respuesta promedio
    if (responseTime !== null) {
      stats.avgResponseTime = (stats.avgResponseTime + responseTime) / 2;
    }
  }
  
  /**
   * Actualizar métricas del mensaje
   */
  updateMessageMetrics(message, processingTime) {
    this.metrics.messages.sent++;
    this.metrics.performance.avgProcessingTime = 
      (this.metrics.performance.avgProcessingTime + processingTime) / 2;
    
    this.state.totalProcessed++;
    this.state.avgResponseTime = 
      (this.state.avgResponseTime + processingTime) / 2;
  }
  
  /**
   * Actualizar métricas de rendimiento
   */
  updatePerformanceMetrics(processedCount, processingTime) {
    const throughput = (processedCount / processingTime) * 1000; // mensajes por segundo
    this.metrics.performance.throughput = 
      (this.metrics.performance.throughput + throughput) / 2;
  }
  
  /**
   * Actualizar métricas generales
   */
  updateMetrics(type, data) {
    switch (type) {
    case 'message_received':
      // Métricas de mensajes recibidos
      break;
    case 'message_sent':
      this.metrics.messages.sent++;
      break;
    case 'message_delivered':
      this.metrics.messages.delivered++;
      break;
    case 'message_failed':
      this.metrics.messages.failed++;
      this.state.totalFailed++;
      break;
    }
    
    // Calcular tasa de error
    const total = this.state.totalProcessed + this.state.totalFailed;
    if (total > 0) {
      this.metrics.performance.errorRate = this.state.totalFailed / total;
    }
  }
  
  /**
   * Obtener tamaño total de colas
   */
  getTotalQueueSize() {
    let total = 0;
    for (const queue of this.messageQueues.values()) {
      total += queue.length;
    }
    return total;
  }
  
  /**
   * Obtener tamaño de cola específica
   */
  getQueueSize(priority = null) {
    if (priority) {
      const queue = this.messageQueues.get(priority);
      return queue ? queue.length : 0;
    }
    return this.getTotalQueueSize();
  }
  
  /**
   * Iniciar optimización
   */
  startOptimization() {
    if (this.timers.optimization) return;
    
    this.timers.optimization = setInterval(async() => {
      if (this.mutex.optimization) return;
      
      try {
        this.mutex.optimization = true;
        await this.performOptimization();
      } catch (error) {
        logger.error('Error en optimización:', error);
      } finally {
        this.mutex.optimization = false;
      }
    }, this.config.optimizationInterval);
    
    logger.info('Optimización automática iniciada');
  }
  
  /**
   * Realizar optimización
   */
  async performOptimization() {
    try {
      const startTime = Date.now();
      
      // Optimizar rutas
      await this.optimizeRouting();
      
      // Optimizar colas
      await this.optimizeQueues();
      
      // Optimizar rate limiting
      await this.optimizeRateLimiting();
      
      // Optimizar plantillas
      await this.optimizeTemplates();
      
      const optimizationTime = Date.now() - startTime;
      this.state.lastOptimization = new Date().toISOString();
      
      this.emit('optimization:completed', { 
        duration: optimizationTime,
        timestamp: this.state.lastOptimization
      });
      
      logger.info(`Optimización completada en ${optimizationTime}ms`);
      
    } catch (error) {
      logger.error('Error en optimización:', error);
      throw error;
    }
  }
  
  /**
   * Optimizar routing
   */
  async optimizeRouting() {
    // Analizar rendimiento de rutas
    for (const [provider, stats] of this.providerStats) {
      // Ajustar disponibilidad basada en rendimiento reciente
      if (stats.successRate < 0.8) {
        stats.availability = Math.max(0.1, stats.availability * 0.9);
      } else if (stats.successRate > 0.95) {
        stats.availability = Math.min(1.0, stats.availability * 1.1);
      }
    }
    
    this.metrics.optimization.routeOptimizations++;
  }
  
  /**
   * Optimizar colas
   */
  async optimizeQueues() {
    // Rebalancear colas si es necesario
    const totalMessages = this.getTotalQueueSize();
    
    if (totalMessages > this.config.maxQueueSize * 0.8) {
      // Aumentar frecuencia de procesamiento
      if (this.config.processingInterval > 500) {
        this.config.processingInterval = Math.max(500, this.config.processingInterval * 0.9);
      }
    } else if (totalMessages < this.config.maxQueueSize * 0.2) {
      // Reducir frecuencia de procesamiento
      if (this.config.processingInterval < 2000) {
        this.config.processingInterval = Math.min(2000, this.config.processingInterval * 1.1);
      }
    }
    
    this.metrics.optimization.queueOptimizations++;
  }
  
  /**
   * Optimizar rate limiting
   */
  async optimizeRateLimiting() {
    // Ajustar límites basado en rendimiento
    const errorRate = this.metrics.performance.errorRate;
    
    if (errorRate > 0.1) {
      // Reducir límites si hay muchos errores
      for (const [, limiter] of this.rateLimiters) {
        limiter.limit = Math.max(1, Math.floor(limiter.limit * 0.9));
      }
    } else if (errorRate < 0.02) {
      // Aumentar límites si el rendimiento es bueno
      for (const [, limiter] of this.rateLimiters) {
        limiter.limit = Math.floor(limiter.limit * 1.1);
      }
    }
  }
  
  /**
   * Optimizar plantillas
   */
  async optimizeTemplates() {
    // Analizar efectividad de plantillas
    // (Implementación básica)
    this.metrics.optimization.templateOptimizations++;
  }
  
  /**
   * Iniciar monitoreo
   */
  startMonitoring() {
    if (this.timers.monitoring) return;
    
    this.timers.monitoring = setInterval(async() => {
      try {
        await this.performHealthCheck();
        await this.checkAlerts();
      } catch (error) {
        logger.error('Error en monitoreo:', error);
      }
    }, 30000); // Cada 30 segundos
    
    logger.info('Monitoreo iniciado');
  }
  
  /**
   * Realizar health check
   */
  async performHealthCheck() {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        metrics: {
          queueSize: this.getTotalQueueSize(),
          errorRate: this.metrics.performance.errorRate,
          avgResponseTime: this.state.avgResponseTime,
          throughput: this.metrics.performance.throughput
        },
        providers: {}
      };
      
      // Verificar estado de proveedores
      for (const [provider, stats] of this.providerStats) {
        health.providers[provider] = {
          availability: stats.availability,
          successRate: stats.successRate,
          avgResponseTime: stats.avgResponseTime
        };
      }
      
      // Determinar estado general
      if (health.metrics.errorRate > this.config.alertThresholds.failureRate) {
        health.status = 'degraded';
      }
      
      if (health.metrics.queueSize > this.config.alertThresholds.queueSize) {
        health.status = 'overloaded';
      }
      
      this.state.lastHealthCheck = health.timestamp;
      this.emit('health:check', health);
      
    } catch (error) {
      logger.error('Error en health check:', error);
    }
  }
  
  /**
   * Verificar alertas
   */
  async checkAlerts() {
    const alerts = [];
    
    // Alerta de tasa de error alta
    if (this.metrics.performance.errorRate > this.config.alertThresholds.failureRate) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'warning',
        message: `Tasa de error alta: ${(this.metrics.performance.errorRate * 100).toFixed(2)}%`,
        value: this.metrics.performance.errorRate,
        threshold: this.config.alertThresholds.failureRate
      });
    }
    
    // Alerta de cola llena
    const queueSize = this.getTotalQueueSize();
    if (queueSize > this.config.alertThresholds.queueSize) {
      alerts.push({
        type: 'queue_overload',
        severity: 'critical',
        message: `Cola sobrecargada: ${queueSize} mensajes`,
        value: queueSize,
        threshold: this.config.alertThresholds.queueSize
      });
    }
    
    // Alerta de tiempo de respuesta alto
    if (this.state.avgResponseTime > this.config.alertThresholds.avgResponseTime) {
      alerts.push({
        type: 'slow_response',
        severity: 'warning',
        message: `Tiempo de respuesta alto: ${this.state.avgResponseTime}ms`,
        value: this.state.avgResponseTime,
        threshold: this.config.alertThresholds.avgResponseTime
      });
    }
    
    // Emitir alertas
    for (const alert of alerts) {
      this.emit('alert', alert);
    }
  }
  
  /**
   * Iniciar limpieza automática
   */
  startCleanup() {
    if (this.timers.cleanup) return;
    
    this.timers.cleanup = setInterval(async() => {
      try {
        await this.performCleanup();
      } catch (error) {
        logger.error('Error en limpieza:', error);
      }
    }, 60 * 60 * 1000); // Cada hora
    
    logger.info('Limpieza automática iniciada');
  }
  
  /**
   * Realizar limpieza
   */
  async performCleanup() {
    try {
      const now = Date.now();
      const retentionTime = this.config.metricsRetention;
      
      // Limpiar historial de comunicación
      this.communicationHistory = this.communicationHistory.filter(
        entry => now - new Date(entry.timestamp).getTime() < retentionTime
      );
      
      // Limpiar rate limiters
      for (const [, limiter] of this.rateLimiters) {
        limiter.requests = limiter.requests.filter(
          time => now - time < limiter.window
        );
      }
      
      // Limpiar datos antiguos
      await this.cleanupOldData();
      
      logger.debug('Limpieza completada');
      
    } catch (error) {
      logger.error('Error en limpieza:', error);
    }
  }
  
  /**
   * Limpiar datos antiguos
   */
  async cleanupOldData() {
    try {
      // Implementar limpieza de datos antiguos según necesidades
      // Por ejemplo, archivar mensajes antiguos, limpiar logs, etc.
    } catch (error) {
      logger.error('Error limpiando datos antiguos:', error);
    }
  }
  
  /**
   * Manejar error de procesamiento de mensaje
   */
  async handleMessageProcessingError(message, error) {
    try {
      // Incrementar contador de reintentos
      message.metadata.retryCount = (message.metadata.retryCount || 0) + 1;
      
      // Verificar si se pueden hacer más reintentos
      if (message.metadata.retryCount < this.config.maxRetries) {
        // Calcular delay de reintento con backoff exponencial
        const delay = this.config.retryDelay * 
          Math.pow(this.config.backoffMultiplier, message.metadata.retryCount - 1);
        
        // Programar reintento
        setTimeout(() => {
          this.addToQueue(message, message.metadata.priority || 'normal');
        }, delay);
        
        logger.info(`Reintento programado para mensaje ${message.id} en ${delay}ms`);
      } else {
        // Marcar como fallido permanentemente
        message.markAsFailed('MAX_RETRIES_EXCEEDED', error.message);
        await this.db.update(this.filename, message.id, message.toJSON());
        
        this.emit('message:failed_permanently', { message, error });
        logger.error(`Mensaje ${message.id} falló permanentemente después de ${this.config.maxRetries} reintentos`);
      }
      
    } catch (retryError) {
      logger.error('Error manejando error de procesamiento:', retryError);
    }
  }
  
  /**
   * Procesar mensajes restantes al desactivar
   */
  async processRemainingMessages() {
    try {
      logger.info('Procesando mensajes restantes...');
      
      let totalRemaining = this.getTotalQueueSize();
      let processed = 0;
      
      while (totalRemaining > 0 && processed < 1000) { // Límite de seguridad
        await this.processMessageQueues();
        processed++;
        totalRemaining = this.getTotalQueueSize();
      }
      
      if (totalRemaining > 0) {
        logger.warn(`${totalRemaining} mensajes quedaron sin procesar`);
      }
      
    } catch (error) {
      logger.error('Error procesando mensajes restantes:', error);
    }
  }
  
  /**
   * Detener timers
   */
  stopTimers() {
    for (const [name, timer] of Object.entries(this.timers)) {
      if (timer) {
        clearInterval(timer);
        this.timers[name] = null;
      }
    }
    
    logger.info('Timers detenidos');
  }
  
  /**
   * Manejar apagado del sistema
   */
  async handleSystemShutdown(event) {
    try {
      logger.info('Manejando apagado del sistema...');
      await this.deactivate();
    } catch (error) {
      logger.error('Error en apagado del sistema:', error);
    }
  }
  
  /**
   * Actualizar última interacción del contacto
   */
  async updateContactLastInteraction(phone) {
    try {
      const contact = await this.contactService.getContactByPhone(phone);
      if (contact) {
        contact.updateLastInteraction();
        await this.contactService.updateContact(contact.id, contact.toJSON());
      }
    } catch (error) {
      logger.warn(`Error actualizando última interacción para ${phone}:`, error);
    }
  }
  
  /**
   * Guardar estado del agente
   */
  async saveState() {
    try {
      if (this.mutex.persistence) return;
      this.mutex.persistence = true;
      
      const stateDir = path.join(process.cwd(), 'storage', 'agents');
      await fs.ensureDir(stateDir);
      
      const statePath = path.join(stateDir, 'messaging_agent_state.json');
      const state = {
        config: this.config,
        state: this.state,
        metrics: this.metrics,
        providerStats: Object.fromEntries(this.providerStats),
        circuitBreakers: Object.fromEntries(this.circuitBreakers),
        timestamp: new Date().toISOString()
      };
      
      await fs.writeJson(statePath, state, { spaces: 2 });
      logger.debug('Estado del agente guardado');
      
    } catch (error) {
      logger.error('Error guardando estado:', error);
    } finally {
      this.mutex.persistence = false;
    }
  }
  
  /**
   * Cargar estado del agente
   */
  async loadState() {
    try {
      const statePath = path.join(process.cwd(), 'storage', 'agents', 'messaging_agent_state.json');
      
      if (await fs.pathExists(statePath)) {
        const savedState = await fs.readJson(statePath);
        
        // Restaurar configuración
        this.config = { ...this.config, ...savedState.config };
        
        // Restaurar estado
        this.state = { ...this.state, ...savedState.state };
        
        // Restaurar métricas
        this.metrics = { ...this.metrics, ...savedState.metrics };
        
        // Restaurar estadísticas de proveedores
        if (savedState.providerStats) {
          this.providerStats = new Map(Object.entries(savedState.providerStats));
        }
        
        // Restaurar circuit breakers
        if (savedState.circuitBreakers) {
          this.circuitBreakers = new Map(Object.entries(savedState.circuitBreakers));
        }
        
        logger.info('Estado del agente cargado');
      }
    } catch (error) {
      logger.warn('Error cargando estado:', error);
    }
  }
  
  /**
   * Cargar patrones de aprendizaje
   */
  async loadLearningPatterns() {
    try {
      const patternsPath = path.join(process.cwd(), 'storage', 'agents', 'messaging_patterns.json');
      
      if (await fs.pathExists(patternsPath)) {
        const patterns = await fs.readJson(patternsPath);
        
        this.conversationPatterns = new Map(Object.entries(patterns.conversationPatterns || {}));
        this.responseTemplates = new Map(Object.entries(patterns.responseTemplates || {}));
        this.userPreferences = new Map(Object.entries(patterns.userPreferences || {}));
        
        logger.info('Patrones de aprendizaje cargados');
      }
    } catch (error) {
      logger.warn('Error cargando patrones de aprendizaje:', error);
    }
  }
  
  /**
   * Guardar patrones de aprendizaje
   */
  async saveLearningPatterns() {
    try {
      const patternsDir = path.join(process.cwd(), 'storage', 'agents');
      await fs.ensureDir(patternsDir);
      
      const patternsPath = path.join(patternsDir, 'messaging_patterns.json');
      const patterns = {
        conversationPatterns: Object.fromEntries(this.conversationPatterns),
        responseTemplates: Object.fromEntries(this.responseTemplates),
        userPreferences: Object.fromEntries(this.userPreferences),
        timestamp: new Date().toISOString()
      };
      
      await fs.writeJson(patternsPath, patterns, { spaces: 2 });
      logger.debug('Patrones de aprendizaje guardados');
      
    } catch (error) {
      logger.error('Error guardando patrones de aprendizaje:', error);
    }
  }
  
  /**
   * Obtener información del agente
   */
  getAgentInfo() {
    return {
      name: 'MessagingAgent',
      version: '2.0.0',
      status: this.state.isActive ? 'active' : 'inactive',
      state: this.state,
      metrics: this.metrics,
      queueSizes: {
        total: this.getTotalQueueSize(),
        byPriority: Object.fromEntries(
          this.config.priorityLevels.map(level => [level, this.getQueueSize(level)])
        )
      },
      providers: Object.fromEntries(this.providerStats),
      circuitBreakers: Object.fromEntries(this.circuitBreakers)
    };
  }
  
  /**
   * Obtener estadísticas del agente
   */
  getAgentStats() {
    return {
      totalProcessed: this.state.totalProcessed,
      totalFailed: this.state.totalFailed,
      avgResponseTime: this.state.avgResponseTime,
      metrics: this.metrics,
      uptime: this.state.isActive ? Date.now() - new Date(this.state.lastOptimization || Date.now()).getTime() : 0
    };
  }
  
  /**
   * Destruir el agente
   */
  async destroy() {
    try {
      logger.info('Destruyendo MessagingAgent...');
      
      await this.deactivate();
      
      // Limpiar referencias
      this.messageQueues.clear();
      this.routingTable.clear();
      this.providerStats.clear();
      this.circuitBreakers.clear();
      this.conversationPatterns.clear();
      this.responseTemplates.clear();
      this.userPreferences.clear();
      this.rateLimiters.clear();
      
      // Remover listeners
      this.removeAllListeners();
      
      logger.info('MessagingAgent destruido');
    } catch (error) {
      logger.error('Error destruyendo MessagingAgent:', error);
    }
  }
  
  /**
   * Manejar errores del agente
   */
  handleError(error) {
    logger.error('Error en MessagingAgent:', error);
    
    // Emitir evento de error crítico si es necesario
    if (error.critical) {
      this.emit('agent:critical_error', { error, agent: 'MessagingAgent' });
    }
  }
}

// Instancia singleton del agente
let agentInstance = null;

/**
 * Obtener instancia del agente de mensajes
 * @param {object} options - Opciones de configuración
 * @returns {MessagingAgent} Instancia del agente
 */
export function getMessagingAgent(options = {}) {
  if (!agentInstance) {
    agentInstance = new MessagingAgent(options);
  }
  return agentInstance;
}

export default MessagingAgent;
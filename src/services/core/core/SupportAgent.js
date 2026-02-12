import BaseAgent from './BaseAgent.js';
import EventTypes from './EventTypes.js';

/**
 * Agente especializado en soporte al cliente
 * Reacciona a preguntas de usuarios y confusión de IA para brindar asistencia
 */
class SupportAgent extends BaseAgent {
  constructor(eventBus, config = {}) {
    super('SupportAgent', eventBus, {
      priority: 'high',
      maxConcurrentTasks: 15,
      retryAttempts: 2,
      timeout: 20000,
      ...config
    });
        
    this.supportConfig = {
      responseTime: config.responseTime || 'fast', // fast, normal, detailed
      escalationThreshold: config.escalationThreshold || 3, // Intentos antes de escalar
      knowledgeBaseEnabled: config.knowledgeBaseEnabled !== false,
      autoResolutionEnabled: config.autoResolutionEnabled !== false,
      sentimentAnalysisEnabled: config.sentimentAnalysisEnabled !== false,
      priorityKeywords: config.priorityKeywords || ['urgent', 'emergency', 'critical', 'broken', 'error']
    };
        
    this.knowledgeBase = new Map();
    this.activeTickets = new Map();
    this.userSessions = new Map();
    this.escalationQueue = [];
        
    this.supportStats = {
      ticketsCreated: 0,
      ticketsResolved: 0,
      ticketsEscalated: 0,
      averageResolutionTime: 0,
      customerSatisfactionScore: 0,
      commonIssues: new Map(),
      responseTimeMetrics: {
        fast: 0,
        normal: 0,
        slow: 0
      }
    };
        
    this.initializeKnowledgeBase();
  }

  /**
     * Registra los listeners específicos del agente de soporte
     */
  async registerEventListeners() {
    // Eventos de preguntas y problemas de usuarios
    this.on('user.question', this.handleUserQuestion.bind(this));
    this.on('user.complaint', this.handleUserComplaint.bind(this));
    this.on('user.technical_issue', this.handleTechnicalIssue.bind(this));
    this.on('user.feedback', this.handleUserFeedback.bind(this));
    this.on('user.confusion', this.handleUserConfusion.bind(this));
        
    // Eventos de IA y sistema
    this.on('ai.confusion', this.handleAIConfusion.bind(this));
    this.on('ai.error', this.handleAIError.bind(this));
    this.on('ai.unable_to_respond', this.handleAIUnableToRespond.bind(this));
        
    // Eventos de sistema que requieren soporte
    this.on('system.error', this.handleSystemError.bind(this));
    this.on('system.performance_issue', this.handlePerformanceIssue.bind(this));
    this.on('payment.issue', this.handlePaymentIssue.bind(this));
        
    // Eventos de escalación
    this.on('support.escalation_requested', this.handleEscalationRequest.bind(this));
    this.on('support.ticket_update', this.handleTicketUpdate.bind(this));
        
    logger.info(`🎧 ${this.name}: Listeners de soporte registrados`);
  }

  /**
     * Maneja preguntas de usuarios
     */
  async handleUserQuestion(data) {
    const { userId, question, context, urgency, sessionId } = data;
        
    logger.info(`❓ ${this.name}: Pregunta de usuario ${userId}: "${question}"`);
        
    // Crear o actualizar sesión de usuario
    this.updateUserSession(userId, sessionId, { lastQuestion: question });
        
    // Analizar la pregunta
    const questionAnalysis = await this.analyzeQuestion(question, context);
        
    // Crear ticket de soporte
    const ticket = this.createSupportTicket(userId, 'question', question, questionAnalysis.priority);
        
    // Buscar respuesta en la base de conocimiento
    const knowledgeBaseResponse = await this.searchKnowledgeBase(question, questionAnalysis.keywords);
        
    if (knowledgeBaseResponse && knowledgeBaseResponse.confidence > 0.8) {
      // Respuesta automática de alta confianza
      await this.sendAutomaticResponse(userId, ticket.id, knowledgeBaseResponse);
    } else {
      // Generar respuesta personalizada
      const response = await this.generateSupportResponse(userId, question, questionAnalysis, context);
            
      this.emit('support.response_generated', {
        userId,
        ticketId: ticket.id,
        question,
        response,
        responseType: 'generated',
        confidence: response.confidence,
        timestamp: new Date().toISOString()
      });
    }
        
    // Actualizar estadísticas
    this.updateCommonIssues(questionAnalysis.category);
  }

  /**
     * Maneja quejas de usuarios
     */
  async handleUserComplaint(data) {
    const { userId, complaint, severity, affectedService, context } = data;
        
    logger.info(`😠 ${this.name}: Queja de usuario ${userId} (severidad: ${severity})`);
        
    // Las quejas tienen prioridad alta
    const ticket = this.createSupportTicket(userId, 'complaint', complaint, 'high');
        
    // Analizar sentimiento si está habilitado
    let sentimentAnalysis = null;
    if (this.supportConfig.sentimentAnalysisEnabled) {
      sentimentAnalysis = await this.analyzeSentiment(complaint);
    }
        
    // Generar respuesta empática
    const response = await this.generateEmpatheticResponse(userId, complaint, sentimentAnalysis);
        
    this.emit('support.complaint_acknowledged', {
      userId,
      ticketId: ticket.id,
      complaint,
      severity,
      response,
      sentimentAnalysis,
      escalationRecommended: severity === 'critical',
      timestamp: new Date().toISOString()
    });
        
    // Escalar automáticamente si es crítico
    if (severity === 'critical') {
      await this.escalateTicket(ticket.id, 'critical_complaint');
    }
        
    // Notificar a otros sistemas si es necesario
    if (affectedService) {
      this.emit('system.service_complaint_reported', {
        service: affectedService,
        userId,
        ticketId: ticket.id,
        severity,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Maneja problemas técnicos
     */
  async handleTechnicalIssue(data) {
    const { userId, issue, errorCode, systemInfo, steps } = data;
        
    logger.info(`🔧 ${this.name}: Problema técnico de usuario ${userId} - Error: ${errorCode}`);
        
    const ticket = this.createSupportTicket(userId, 'technical', issue, 'medium');
        
    // Buscar soluciones conocidas para el código de error
    const knownSolution = await this.findTechnicalSolution(errorCode, issue, systemInfo);
        
    if (knownSolution) {
      // Enviar solución paso a paso
      await this.sendTechnicalSolution(userId, ticket.id, knownSolution);
    } else {
      // Solicitar más información para diagnóstico
      await this.requestDiagnosticInfo(userId, ticket.id, errorCode);
    }
        
    this.emit('support.technical_issue_processed', {
      userId,
      ticketId: ticket.id,
      errorCode,
      issue,
      solutionFound: !!knownSolution,
      systemInfo,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Maneja confusión de IA
     */
  async handleAIConfusion(data) {
    const { userId, aiQuery, confusionReason, context, attemptCount } = data;
        
    logger.info(`🤖❓ ${this.name}: IA confundida con consulta de usuario ${userId}`);
        
    // Crear ticket para intervención humana
    const ticket = this.createSupportTicket(userId, 'ai_confusion', aiQuery, 'medium');
        
    // Analizar por qué la IA se confundió
    const confusionAnalysis = await this.analyzeAIConfusion(aiQuery, confusionReason, context);
        
    // Generar respuesta de respaldo
    const fallbackResponse = await this.generateFallbackResponse(userId, aiQuery, confusionAnalysis);
        
    this.emit('support.ai_confusion_handled', {
      userId,
      ticketId: ticket.id,
      aiQuery,
      confusionReason,
      fallbackResponse,
      confusionAnalysis,
      requiresTraining: confusionAnalysis.requiresTraining,
      timestamp: new Date().toISOString()
    });
        
    // Si es un patrón recurrente, sugerir entrenamiento
    if (attemptCount > 2) {
      this.emit('ai.training_suggested', {
        query: aiQuery,
        confusionReason,
        frequency: attemptCount,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Maneja errores de IA
     */
  async handleAIError(data) {
    const { userId, error, context, severity } = data;
        
    logger.info(`🤖❌ ${this.name}: Error de IA para usuario ${userId}`);
        
    const ticket = this.createSupportTicket(userId, 'ai_error', error.message, severity || 'high');
        
    // Generar mensaje de disculpa y alternativa
    const apologyResponse = await this.generateAIErrorApology(userId, error);
        
    this.emit('support.ai_error_handled', {
      userId,
      ticketId: ticket.id,
      error,
      apologyResponse,
      alternativeOffered: true,
      timestamp: new Date().toISOString()
    });
        
    // Notificar al equipo de desarrollo si es un error recurrente
    this.emit('development.ai_error_reported', {
      error,
      userId,
      context,
      frequency: this.getErrorFrequency(error.type),
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Maneja problemas de pago
     */
  async handlePaymentIssue(data) {
    const { userId, paymentId, issueType, amount, errorDetails } = data;
        
    logger.info(`💳 ${this.name}: Problema de pago para usuario ${userId} - Tipo: ${issueType}`);
        
    // Los problemas de pago son alta prioridad
    const ticket = this.createSupportTicket(userId, 'payment', `Payment issue: ${issueType}`, 'high');
        
    // Generar respuesta específica para el tipo de problema
    const paymentResponse = await this.generatePaymentIssueResponse(userId, issueType, amount, errorDetails);
        
    this.emit('support.payment_issue_handled', {
      userId,
      ticketId: ticket.id,
      paymentId,
      issueType,
      amount,
      response: paymentResponse,
      requiresManualReview: this.requiresManualPaymentReview(issueType),
      timestamp: new Date().toISOString()
    });
        
    // Escalar automáticamente ciertos tipos de problemas de pago
    if (['fraud_suspected', 'chargeback', 'refund_dispute'].includes(issueType)) {
      await this.escalateTicket(ticket.id, `payment_${issueType}`);
    }
  }

  /**
     * Crea un ticket de soporte
     */
  createSupportTicket(userId, type, description, priority) {
    const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
    const ticket = {
      id: ticketId,
      userId,
      type,
      description,
      priority,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: this.name,
      responses: [],
      escalationCount: 0
    };
        
    this.activeTickets.set(ticketId, ticket);
    this.supportStats.ticketsCreated++;
        
    logger.info(`🎫 ${this.name}: Ticket creado ${ticketId} para usuario ${userId}`);
        
    return ticket;
  }

  /**
     * Analiza una pregunta
     */
  async analyzeQuestion(question, context) {
    const keywords = this.extractKeywords(question);
    const priority = this.determinePriority(question, keywords);
    const category = this.categorizeQuestion(question, keywords);
        
    return {
      keywords,
      priority,
      category,
      complexity: this.assessComplexity(question),
      sentiment: await this.analyzeSentiment(question)
    };
  }

  /**
     * Busca en la base de conocimiento
     */
  async searchKnowledgeBase(question, keywords) {
    if (!this.supportConfig.knowledgeBaseEnabled) return null;
        
    let bestMatch = null;
    let highestScore = 0;
        
    for (const [key, entry] of this.knowledgeBase) {
      const score = this.calculateRelevanceScore(question, keywords, entry);
            
      if (score > highestScore && score > 0.6) {
        highestScore = score;
        bestMatch = entry;
      }
    }
        
    return bestMatch ? {
      ...bestMatch,
      confidence: highestScore
    } : null;
  }

  /**
     * Genera respuesta de soporte
     */
  async generateSupportResponse(userId, question, analysis, context) {
    const userSession = this.userSessions.get(userId);
        
    let response;
        
    switch (analysis.category) {
    case 'technical':
      response = await this.generateTechnicalResponse(question, analysis, context);
      break;
    case 'billing':
      response = await this.generateBillingResponse(question, analysis, userSession);
      break;
    case 'product':
      response = await this.generateProductResponse(question, analysis);
      break;
    case 'general':
    default:
      response = await this.generateGeneralResponse(question, analysis);
      break;
    }
        
    return {
      ...response,
      confidence: this.calculateResponseConfidence(response, analysis),
      responseTime: this.supportConfig.responseTime
    };
  }

  /**
     * Envía respuesta automática
     */
  async sendAutomaticResponse(userId, ticketId, response) {
    const ticket = this.activeTickets.get(ticketId);
        
    if (ticket) {
      ticket.responses.push({
        content: response.content,
        type: 'automatic',
        timestamp: new Date().toISOString(),
        confidence: response.confidence
      });
            
      ticket.status = 'resolved';
      ticket.updatedAt = new Date().toISOString();
            
      this.supportStats.ticketsResolved++;
      this.updateResolutionTime(ticket);
    }
        
    this.emit('support.automatic_response_sent', {
      userId,
      ticketId,
      response: response.content,
      confidence: response.confidence,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Escala un ticket
     */
  async escalateTicket(ticketId, reason) {
    const ticket = this.activeTickets.get(ticketId);
        
    if (!ticket) return;
        
    ticket.escalationCount++;
    ticket.status = 'escalated';
    ticket.escalationReason = reason;
    ticket.escalatedAt = new Date().toISOString();
        
    this.escalationQueue.push({
      ticketId,
      reason,
      priority: ticket.priority,
      escalatedAt: new Date().toISOString()
    });
        
    this.supportStats.ticketsEscalated++;
        
    logger.info(`⬆️ ${this.name}: Ticket ${ticketId} escalado - Razón: ${reason}`);
        
    this.emit('support.ticket_escalated', {
      ticketId,
      userId: ticket.userId,
      reason,
      priority: ticket.priority,
      escalationCount: ticket.escalationCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Inicializa la base de conocimiento
     */
  initializeKnowledgeBase() {
    // Base de conocimiento básica
    const knowledgeEntries = [
      {
        id: 'login_issues',
        keywords: ['login', 'password', 'access', 'signin'],
        category: 'technical',
        content: 'Para problemas de acceso, intenta restablecer tu contraseña usando el enlace "¿Olvidaste tu contraseña?" en la página de login.',
        confidence: 0.9
      },
      {
        id: 'payment_failed',
        keywords: ['payment', 'card', 'declined', 'billing'],
        category: 'billing',
        content: 'Si tu pago fue rechazado, verifica que los datos de tu tarjeta sean correctos y que tengas fondos suficientes. También puedes intentar con otro método de pago.',
        confidence: 0.85
      },
      {
        id: 'slow_performance',
        keywords: ['slow', 'loading', 'performance', 'lag'],
        category: 'technical',
        content: 'Para mejorar el rendimiento, intenta limpiar el caché de tu navegador, cerrar otras pestañas, o verificar tu conexión a internet.',
        confidence: 0.8
      },
      {
        id: 'refund_policy',
        keywords: ['refund', 'return', 'money back', 'cancel'],
        category: 'billing',
        content: 'Nuestra política de reembolso permite devoluciones dentro de 30 días. Contacta a nuestro equipo de facturación para procesar tu solicitud.',
        confidence: 0.9
      }
    ];
        
    knowledgeEntries.forEach(entry => {
      this.knowledgeBase.set(entry.id, entry);
    });
        
    logger.info(`📚 ${this.name}: Base de conocimiento inicializada con ${knowledgeEntries.length} entradas`);
  }

  /**
     * Actualiza sesión de usuario
     */
  updateUserSession(userId, sessionId, updates) {
    const currentSession = this.userSessions.get(userId) || {
      sessionId,
      startTime: new Date().toISOString(),
      interactions: 0,
      issues: []
    };
        
    const updatedSession = {
      ...currentSession,
      ...updates,
      interactions: currentSession.interactions + 1,
      lastUpdate: new Date().toISOString()
    };
        
    this.userSessions.set(userId, updatedSession);
  }

  /**
     * Extrae palabras clave
     */
  extractKeywords(text) {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        
    return words.filter(word => 
      word.length > 2 && 
            !stopWords.includes(word) &&
            /^[a-zA-Z]+$/.test(word)
    );
  }

  /**
     * Determina prioridad
     */
  determinePriority(question, keywords) {
    const priorityKeywords = this.supportConfig.priorityKeywords;
        
    if (keywords.some(keyword => priorityKeywords.includes(keyword))) {
      return 'high';
    }
        
    if (keywords.includes('help') || keywords.includes('problem')) {
      return 'medium';
    }
        
    return 'low';
  }

  /**
     * Categoriza pregunta
     */
  categorizeQuestion(question, keywords) {
    const categories = {
      technical: ['error', 'bug', 'broken', 'not working', 'crash', 'slow'],
      billing: ['payment', 'charge', 'bill', 'refund', 'money', 'price'],
      product: ['feature', 'how to', 'tutorial', 'guide', 'use'],
      general: ['info', 'about', 'contact', 'support']
    };
        
    for (const [category, categoryKeywords] of Object.entries(categories)) {
      if (keywords.some(keyword => categoryKeywords.includes(keyword))) {
        return category;
      }
    }
        
    return 'general';
  }

  /**
     * Calcula puntuación de relevancia
     */
  calculateRelevanceScore(question, keywords, entry) {
    const entryKeywords = entry.keywords;
    const matchingKeywords = keywords.filter(keyword => 
      entryKeywords.some(entryKeyword => 
        keyword.includes(entryKeyword) || entryKeyword.includes(keyword)
      )
    );
        
    return matchingKeywords.length / Math.max(keywords.length, entryKeywords.length);
  }

  /**
     * Actualiza problemas comunes
     */
  updateCommonIssues(category) {
    const currentCount = this.supportStats.commonIssues.get(category) || 0;
    this.supportStats.commonIssues.set(category, currentCount + 1);
  }

  /**
     * Actualiza tiempo de resolución
     */
  updateResolutionTime(ticket) {
    const resolutionTime = new Date() - new Date(ticket.createdAt);
    const currentAvg = this.supportStats.averageResolutionTime;
    const resolvedCount = this.supportStats.ticketsResolved;
        
    this.supportStats.averageResolutionTime = 
            ((currentAvg * (resolvedCount - 1)) + resolutionTime) / resolvedCount;
  }

  /**
     * Obtiene estadísticas de soporte
     */
  getSupportStats() {
    const resolutionRate = this.supportStats.ticketsCreated > 0 ? 
      (this.supportStats.ticketsResolved / this.supportStats.ticketsCreated) * 100 : 0;
        
    const escalationRate = this.supportStats.ticketsCreated > 0 ? 
      (this.supportStats.ticketsEscalated / this.supportStats.ticketsCreated) * 100 : 0;
        
    return {
      ...this.supportStats,
      resolutionRate: resolutionRate.toFixed(2),
      escalationRate: escalationRate.toFixed(2),
      activeTickets: this.activeTickets.size,
      activeSessions: this.userSessions.size,
      knowledgeBaseEntries: this.knowledgeBase.size,
      escalationQueueSize: this.escalationQueue.length
    };
  }

  /**
     * Limpieza al detener el agente
     */
  async onStop() {
    // Guardar tickets activos para transferencia
    const activeTicketsList = Array.from(this.activeTickets.values());
        
    if (activeTicketsList.length > 0) {
      this.emit('support.tickets_transfer_required', {
        tickets: activeTicketsList,
        transferReason: 'agent_shutdown',
        timestamp: new Date().toISOString()
      });
    }
        
    logger.info(`🎧 ${this.name}: Limpieza completada - ${activeTicketsList.length} tickets activos transferidos`);
  }
}

export default SupportAgent;
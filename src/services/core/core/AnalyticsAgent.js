import BaseAgent from './BaseAgent.js';
import EventTypes from './EventTypes.js';

/**
 * Agente especializado en analytics y métricas
 * Recopila datos, genera reportes y emite eventos de análisis
 */
class AnalyticsAgent extends BaseAgent {
  constructor(eventBus, config = {}) {
    super('AnalyticsAgent', eventBus, {
      priority: 'medium',
      maxConcurrentTasks: 20,
      retryAttempts: 3,
      timeout: 15000,
      ...config
    });
        
    this.analyticsConfig = {
      reportInterval: config.reportInterval || 300000, // 5 minutos
      metricsRetention: config.metricsRetention || 86400000, // 24 horas
      realTimeEnabled: config.realTimeEnabled !== false,
      aggregationEnabled: config.aggregationEnabled !== false,
      alertThresholds: {
        errorRate: config.errorRateThreshold || 0.05, // 5%
        responseTime: config.responseTimeThreshold || 5000, // 5 segundos
        throughput: config.throughputThreshold || 100 // eventos por minuto
      },
      ...config.alertThresholds
    };
        
    // Almacenes de datos
    this.metrics = {
      events: new Map(),
      users: new Map(),
      system: new Map(),
      business: new Map(),
      performance: new Map()
    };
        
    this.timeSeries = {
      eventCounts: [],
      responseTimes: [],
      errorRates: [],
      userActivity: [],
      systemHealth: []
    };
        
    this.aggregatedData = {
      hourly: new Map(),
      daily: new Map(),
      weekly: new Map(),
      monthly: new Map()
    };
        
    this.alerts = [];
    this.reportSchedule = null;
        
    this.analyticsStats = {
      eventsProcessed: 0,
      reportsGenerated: 0,
      alertsTriggered: 0,
      dataPointsCollected: 0,
      lastReportTime: null,
      uptime: Date.now()
    };
        
    this.initializeMetricsCollection();
  }

  /**
     * Registra los listeners específicos del agente de analytics
     */
  async registerEventListeners() {
    // Eventos de usuario
    this.on('user.login', this.trackUserLogin.bind(this));
    this.on('user.logout', this.trackUserLogout.bind(this));
    this.on('user.action', this.trackUserAction.bind(this));
    this.on('user.session_start', this.trackSessionStart.bind(this));
    this.on('user.session_end', this.trackSessionEnd.bind(this));
        
    // Eventos de sistema
    this.on('system.performance', this.trackSystemPerformance.bind(this));
    this.on('system.error', this.trackSystemError.bind(this));
    this.on('system.health_check', this.trackSystemHealth.bind(this));
    this.on('system.resource_usage', this.trackResourceUsage.bind(this));
        
    // Eventos de negocio
    this.on('payment.completed', this.trackPaymentCompleted.bind(this));
    this.on('payment.failed', this.trackPaymentFailed.bind(this));
    this.on('sale.completed', this.trackSaleCompleted.bind(this));
    this.on('conversion.funnel', this.trackConversionFunnel.bind(this));
        
    // Eventos de IA
    this.on('ai.response_generated', this.trackAIResponse.bind(this));
    this.on('ai.error', this.trackAIError.bind(this));
    this.on('ai.training_completed', this.trackAITraining.bind(this));
    this.on('ai.model_updated', this.trackModelUpdate.bind(this));
        
    // Eventos de soporte
    this.on('support.ticket_created', this.trackSupportTicket.bind(this));
    this.on('support.ticket_resolved', this.trackTicketResolution.bind(this));
    this.on('support.escalation', this.trackSupportEscalation.bind(this));
        
    // Eventos generales para métricas
    this.on('*', this.trackGeneralEvent.bind(this));
        
    logger.info(`📊 ${this.name}: Listeners de analytics registrados`);
  }

  /**
     * Inicializa la recolección de métricas
     */
  initializeMetricsCollection() {
    // Programar reportes periódicos
    this.reportSchedule = setInterval(() => {
      this.generatePeriodicReport();
    }, this.analyticsConfig.reportInterval);
        
    // Limpiar datos antiguos periódicamente
    setInterval(() => {
      this.cleanupOldData();
    }, this.analyticsConfig.metricsRetention / 24); // Cada hora
        
    logger.info(`📊 ${this.name}: Recolección de métricas inicializada`);
  }

  /**
     * Rastrea login de usuario
     */
  async trackUserLogin(data) {
    const { userId, timestamp, userAgent, ipAddress, loginMethod } = data;
        
    this.updateUserMetrics(userId, 'login', {
      timestamp,
      userAgent,
      ipAddress,
      loginMethod,
      sessionStart: timestamp
    });
        
    this.addTimeSeriesData('userActivity', {
      type: 'login',
      userId,
      timestamp
    });
        
    logger.info(`👤 ${this.name}: Login rastreado para usuario ${userId}`);
  }

  /**
     * Rastrea acciones de usuario
     */
  async trackUserAction(data) {
    const { userId, action, page, duration, metadata } = data;
        
    this.updateUserMetrics(userId, 'action', {
      action,
      page,
      duration,
      metadata,
      timestamp: new Date().toISOString()
    });
        
    // Actualizar métricas de engagement
    this.updateEngagementMetrics(userId, action, duration);
        
    this.analyticsStats.dataPointsCollected++;
  }

  /**
     * Rastrea rendimiento del sistema
     */
  async trackSystemPerformance(data) {
    const { cpuUsage, memoryUsage, responseTime, throughput, timestamp } = data;
        
    this.updateSystemMetrics('performance', {
      cpuUsage,
      memoryUsage,
      responseTime,
      throughput,
      timestamp
    });
        
    this.addTimeSeriesData('systemHealth', {
      cpuUsage,
      memoryUsage,
      responseTime,
      throughput,
      timestamp
    });
        
    // Verificar umbrales de alerta
    await this.checkPerformanceThresholds(data);
  }

  /**
     * Rastrea errores del sistema
     */
  async trackSystemError(data) {
    const { errorType, errorMessage, severity, component, userId, timestamp } = data;
        
    this.updateSystemMetrics('errors', {
      errorType,
      errorMessage,
      severity,
      component,
      userId,
      timestamp
    });
        
    // Calcular tasa de errores
    const errorRate = this.calculateErrorRate();
        
    this.addTimeSeriesData('errorRates', {
      errorRate,
      errorType,
      severity,
      timestamp
    });
        
    // Verificar si se debe generar alerta
    if (errorRate > this.analyticsConfig.alertThresholds.errorRate) {
      await this.triggerAlert('high_error_rate', {
        currentRate: errorRate,
        threshold: this.analyticsConfig.alertThresholds.errorRate,
        recentErrors: this.getRecentErrors()
      });
    }
  }

  /**
     * Rastrea pagos completados
     */
  async trackPaymentCompleted(data) {
    const { userId, amount, currency, paymentMethod, transactionId, timestamp } = data;
        
    this.updateBusinessMetrics('payments', {
      userId,
      amount,
      currency,
      paymentMethod,
      transactionId,
      status: 'completed',
      timestamp
    });
        
    // Actualizar métricas de revenue
    this.updateRevenueMetrics(amount, currency, timestamp);
        
    logger.info(`💰 ${this.name}: Pago completado rastreado - $${amount} ${currency}`);
  }

  /**
     * Rastrea respuestas de IA
     */
  async trackAIResponse(data) {
    const { userId, query, response, responseTime, confidence, model, timestamp } = data;
        
    this.updateAIMetrics('responses', {
      userId,
      query,
      response,
      responseTime,
      confidence,
      model,
      timestamp
    });
        
    this.addTimeSeriesData('responseTimes', {
      responseTime,
      model,
      confidence,
      timestamp
    });
        
    // Verificar tiempo de respuesta
    if (responseTime > this.analyticsConfig.alertThresholds.responseTime) {
      await this.triggerAlert('slow_ai_response', {
        responseTime,
        threshold: this.analyticsConfig.alertThresholds.responseTime,
        model,
        query: query.substring(0, 100) // Primeros 100 caracteres
      });
    }
  }

  /**
     * Rastrea tickets de soporte
     */
  async trackSupportTicket(data) {
    const { ticketId, userId, type, priority, timestamp } = data;
        
    this.updateBusinessMetrics('support', {
      ticketId,
      userId,
      type,
      priority,
      status: 'created',
      timestamp
    });
        
    // Actualizar métricas de satisfacción del cliente
    this.updateCustomerSatisfactionMetrics(type, priority);
  }

  /**
     * Rastrea evento general
     */
  async trackGeneralEvent(eventType, data) {
    // Evitar recursión infinita con eventos de analytics
    if (eventType.startsWith('analytics.')) return;
        
    this.updateEventMetrics(eventType, data);
        
    this.addTimeSeriesData('eventCounts', {
      eventType,
      timestamp: new Date().toISOString()
    });
        
    this.analyticsStats.eventsProcessed++;
  }

  /**
     * Actualiza métricas de usuario
     */
  updateUserMetrics(userId, action, data) {
    const userMetrics = this.metrics.users.get(userId) || {
      userId,
      firstSeen: new Date().toISOString(),
      sessions: [],
      actions: [],
      totalActions: 0,
      totalSessionTime: 0,
      lastActivity: null
    };
        
    if (action === 'login') {
      userMetrics.sessions.push({
        start: data.timestamp,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        loginMethod: data.loginMethod
      });
    } else if (action === 'action') {
      userMetrics.actions.push(data);
      userMetrics.totalActions++;
    }
        
    userMetrics.lastActivity = new Date().toISOString();
    this.metrics.users.set(userId, userMetrics);
  }

  /**
     * Actualiza métricas del sistema
     */
  updateSystemMetrics(category, data) {
    const systemMetrics = this.metrics.system.get(category) || {
      category,
      dataPoints: [],
      summary: {}
    };
        
    systemMetrics.dataPoints.push(data);
        
    // Mantener solo los últimos 1000 puntos de datos
    if (systemMetrics.dataPoints.length > 1000) {
      systemMetrics.dataPoints = systemMetrics.dataPoints.slice(-1000);
    }
        
    // Actualizar resumen
    systemMetrics.summary = this.calculateSummaryStats(systemMetrics.dataPoints);
        
    this.metrics.system.set(category, systemMetrics);
  }

  /**
     * Actualiza métricas de negocio
     */
  updateBusinessMetrics(category, data) {
    const businessMetrics = this.metrics.business.get(category) || {
      category,
      transactions: [],
      summary: {}
    };
        
    businessMetrics.transactions.push(data);
    businessMetrics.summary = this.calculateBusinessSummary(businessMetrics.transactions);
        
    this.metrics.business.set(category, businessMetrics);
  }

  /**
     * Actualiza métricas de eventos
     */
  updateEventMetrics(eventType, data) {
    const eventMetrics = this.metrics.events.get(eventType) || {
      eventType,
      count: 0,
      firstSeen: new Date().toISOString(),
      lastSeen: null,
      averageSize: 0,
      totalSize: 0
    };
        
    eventMetrics.count++;
    eventMetrics.lastSeen = new Date().toISOString();
        
    // Calcular tamaño del evento
    const eventSize = JSON.stringify(data).length;
    eventMetrics.totalSize += eventSize;
    eventMetrics.averageSize = eventMetrics.totalSize / eventMetrics.count;
        
    this.metrics.events.set(eventType, eventMetrics);
  }

  /**
     * Añade datos a series temporales
     */
  addTimeSeriesData(series, data) {
    if (!this.timeSeries[series]) {
      this.timeSeries[series] = [];
    }
        
    this.timeSeries[series].push({
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    });
        
    // Mantener solo los últimos 10000 puntos
    if (this.timeSeries[series].length > 10000) {
      this.timeSeries[series] = this.timeSeries[series].slice(-10000);
    }
  }

  /**
     * Calcula tasa de errores
     */
  calculateErrorRate() {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hora
        
    const recentEvents = this.timeSeries.eventCounts.filter(
      event => new Date(event.timestamp).getTime() > oneHourAgo
    );
        
    const errorEvents = recentEvents.filter(
      event => event.eventType.includes('error')
    );
        
    return recentEvents.length > 0 ? errorEvents.length / recentEvents.length : 0;
  }

  /**
     * Genera reporte periódico
     */
  async generatePeriodicReport() {
    const reportData = await this.generateComprehensiveReport();
        
    this.emit('analytics.report_ready', {
      reportType: 'periodic',
      reportData,
      generatedAt: new Date().toISOString(),
      period: this.analyticsConfig.reportInterval
    });
        
    this.analyticsStats.reportsGenerated++;
    this.analyticsStats.lastReportTime = new Date().toISOString();
        
    logger.info(`📊 ${this.name}: Reporte periódico generado`);
  }

  /**
     * Genera reporte comprehensivo
     */
  async generateComprehensiveReport() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
        
    return {
      summary: {
        reportPeriod: {
          start: oneHourAgo.toISOString(),
          end: now.toISOString()
        },
        totalEvents: this.analyticsStats.eventsProcessed,
        totalUsers: this.metrics.users.size,
        totalErrors: this.getErrorCount(),
        systemHealth: this.calculateSystemHealth()
      },
      userMetrics: this.generateUserReport(),
      systemMetrics: this.generateSystemReport(),
      businessMetrics: this.generateBusinessReport(),
      performanceMetrics: this.generatePerformanceReport(),
      trends: this.generateTrendAnalysis(),
      alerts: this.getActiveAlerts(),
      recommendations: this.generateRecommendations()
    };
  }

  /**
     * Genera reporte de usuarios
     */
  generateUserReport() {
    const users = Array.from(this.metrics.users.values());
        
    return {
      totalUsers: users.length,
      activeUsers: users.filter(user => 
        new Date() - new Date(user.lastActivity) < 3600000 // Activos en la última hora
      ).length,
      newUsers: users.filter(user => 
        new Date() - new Date(user.firstSeen) < 86400000 // Nuevos en las últimas 24 horas
      ).length,
      averageSessionTime: this.calculateAverageSessionTime(users),
      topUsers: users
        .sort((a, b) => b.totalActions - a.totalActions)
        .slice(0, 10)
        .map(user => ({
          userId: user.userId,
          totalActions: user.totalActions,
          lastActivity: user.lastActivity
        }))
    };
  }

  /**
     * Genera reporte del sistema
     */
  generateSystemReport() {
    const systemData = Array.from(this.metrics.system.values());
        
    return {
      uptime: Date.now() - this.analyticsStats.uptime,
      errorRate: this.calculateErrorRate(),
      averageResponseTime: this.calculateAverageResponseTime(),
      throughput: this.calculateThroughput(),
      resourceUsage: this.getLatestResourceUsage(),
      healthScore: this.calculateSystemHealth()
    };
  }

  /**
     * Genera reporte de negocio
     */
  generateBusinessReport() {
    const businessData = Array.from(this.metrics.business.values());
        
    const paymentsData = businessData.find(data => data.category === 'payments');
    const supportData = businessData.find(data => data.category === 'support');
        
    return {
      revenue: this.calculateRevenue(paymentsData),
      conversionRate: this.calculateConversionRate(),
      supportTickets: supportData ? supportData.transactions.length : 0,
      customerSatisfaction: this.calculateCustomerSatisfaction()
    };
  }

  /**
     * Dispara alerta
     */
  async triggerAlert(alertType, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: alertType,
      severity: this.determineAlertSeverity(alertType, data),
      message: this.generateAlertMessage(alertType, data),
      data,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
        
    this.alerts.push(alert);
    this.analyticsStats.alertsTriggered++;
        
    this.emit('analytics.alert_triggered', alert);
        
    logger.info(`🚨 ${this.name}: Alerta disparada - ${alertType}`);
  }

  /**
     * Verifica umbrales de rendimiento
     */
  async checkPerformanceThresholds(data) {
    const { responseTime, throughput } = data;
        
    if (responseTime > this.analyticsConfig.alertThresholds.responseTime) {
      await this.triggerAlert('slow_response_time', {
        responseTime,
        threshold: this.analyticsConfig.alertThresholds.responseTime
      });
    }
        
    if (throughput < this.analyticsConfig.alertThresholds.throughput) {
      await this.triggerAlert('low_throughput', {
        throughput,
        threshold: this.analyticsConfig.alertThresholds.throughput
      });
    }
  }

  /**
     * Limpia datos antiguos
     */
  cleanupOldData() {
    const cutoffTime = Date.now() - this.analyticsConfig.metricsRetention;
        
    // Limpiar series temporales
    Object.keys(this.timeSeries).forEach(series => {
      this.timeSeries[series] = this.timeSeries[series].filter(
        data => new Date(data.timestamp).getTime() > cutoffTime
      );
    });
        
    // Limpiar alertas antiguas
    this.alerts = this.alerts.filter(
      alert => new Date(alert.timestamp).getTime() > cutoffTime
    );
        
    logger.info(`🧹 ${this.name}: Datos antiguos limpiados`);
  }

  /**
     * Obtiene estadísticas de analytics
     */
  getAnalyticsStats() {
    return {
      ...this.analyticsStats,
      metricsCollected: {
        events: this.metrics.events.size,
        users: this.metrics.users.size,
        system: this.metrics.system.size,
        business: this.metrics.business.size
      },
      timeSeriesPoints: Object.keys(this.timeSeries).reduce((acc, series) => {
        acc[series] = this.timeSeries[series].length;
        return acc;
      }, {}),
      activeAlerts: this.alerts.filter(alert => !alert.acknowledged).length,
      totalAlerts: this.alerts.length
    };
  }

  /**
     * Obtiene métricas en tiempo real
     */
  getRealTimeMetrics() {
    if (!this.analyticsConfig.realTimeEnabled) return null;
        
    return {
      currentTimestamp: new Date().toISOString(),
      eventsPerMinute: this.calculateEventsPerMinute(),
      activeUsers: this.getActiveUsersCount(),
      systemHealth: this.calculateSystemHealth(),
      errorRate: this.calculateErrorRate(),
      averageResponseTime: this.calculateAverageResponseTime(),
      alerts: this.getActiveAlerts()
    };
  }

  /**
     * Calcula eventos por minuto
     */
  calculateEventsPerMinute() {
    const oneMinuteAgo = Date.now() - 60000;
    const recentEvents = this.timeSeries.eventCounts.filter(
      event => new Date(event.timestamp).getTime() > oneMinuteAgo
    );
        
    return recentEvents.length;
  }

  /**
     * Obtiene alertas activas
     */
  getActiveAlerts() {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
     * Limpieza al detener el agente
     */
  async onStop() {
    if (this.reportSchedule) {
      clearInterval(this.reportSchedule);
    }
        
    // Generar reporte final
    const finalReport = await this.generateComprehensiveReport();
        
    this.emit('analytics.final_report', {
      reportData: finalReport,
      agentStats: this.getAnalyticsStats(),
      shutdownTime: new Date().toISOString()
    });
        
    logger.info(`📊 ${this.name}: Reporte final generado y limpieza completada`);
  }
}

export default AnalyticsAgent;
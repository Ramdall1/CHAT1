/**
 * STATS AGENT - Agente Evolutivo de Métricas y Estadísticas
 * 
 * Funcionalidades evolutivas:
 * - Métricas de interacción y conversación en tiempo real
 * - Estados de conversación y detección de intenciones
 * - Cálculo de efectividad y tasas de conversión
 * - Reportes agregados por período
 * - Persistencia atómica en JSON
 * - Análisis de patrones de uso
 * - Métricas de rendimiento del sistema
 * - Auto-optimización de métricas
 * - Detección de anomalías en tiempo real
 * 
 * @author Sistema Event-Driven Evolutivo
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../core/evolutive-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StatsAgent {
  constructor(eventHub) {
    this.id = uuidv4();
    this.name = 'StatsAgent';
    this.eventHub = eventHub;
    this.logger = createLogger('StatsAgent');
        
    // Configuración del agente
    this.config = {
      // Estado del agente
      isActive: true,
      autoOptimize: true,
      learningEnabled: true,
            
      // Persistencia
      autoSave: process.env.STATS_AUTO_SAVE !== 'false',
      saveInterval: parseInt(process.env.STATS_SAVE_INTERVAL) || 300,
            
      // Retención de datos
      retentionDays: parseInt(process.env.STATS_RETENTION_DAYS) || 90,
      aggregationLevels: ['hourly', 'daily', 'weekly', 'monthly'],
            
      // Métricas
      trackDetailedMetrics: process.env.TRACK_DETAILED_METRICS !== 'false',
      trackPerformance: process.env.TRACK_PERFORMANCE !== 'false',
      trackUserBehavior: process.env.TRACK_USER_BEHAVIOR !== 'false',
            
      // Alertas y anomalías
      enableAlerts: process.env.STATS_ALERTS !== 'false',
      errorThreshold: parseInt(process.env.ERROR_THRESHOLD) || 10,
      responseTimeThreshold: parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 5000,
      anomalyDetectionEnabled: true,
      anomalyThreshold: 2.5 // Desviaciones estándar
    };
        
    // Rutas de almacenamiento
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    this.agentStateFile = path.join(this.dataDir, 'stats-agent-state.json');
        
    // Estado del agente
    this.agentState = {
      isInitialized: false,
      lastOptimization: null,
      optimizationCount: 0,
      anomaliesDetected: 0,
      performanceBaseline: {},
      learningData: {
        patterns: {},
        trends: {},
        predictions: {}
      }
    };
        
    // Sistema de mutex para operaciones críticas
    this.operationMutex = false;
    this.operationQueue = [];
        
    // Estado en memoria de estadísticas
    this.stats = {
      // Métricas básicas
      totalMessages: 0,
      totalContacts: 0,
      totalConversations: 0,
      totalErrors: 0,
            
      // Métricas de tiempo
      systemStartTime: new Date().toISOString(),
      lastActivity: null,
      uptime: 0,
            
      // Métricas de interacción
      interactions: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        totalResponseTime: 0
      },
            
      // Estados de conversación
      conversationStates: {
        active: 0,
        completed: 0,
        abandoned: 0,
        escalated: 0
      },
            
      // Intenciones detectadas
      intentions: {},
            
      // Métricas por período
      periods: {
        current: {
          hour: this.getCurrentHour(),
          day: this.getCurrentDay(),
          week: this.getCurrentWeek(),
          month: this.getCurrentMonth()
        },
        hourly: {},
        daily: {},
        weekly: {},
        monthly: {}
      },
            
      // Distribución de tiempos de respuesta
      responseTimeDistribution: {
        '0-1s': 0,
        '1-3s': 0,
        '3-5s': 0,
        '5-10s': 0,
        '10s+': 0
      },
            
      // Comportamiento de usuarios
      userBehavior: {},
            
      // Métricas de efectividad
      effectiveness: {
        averageConversationDuration: 0,
        resolutionRate: 0,
        satisfactionScore: 0,
        escalationRate: 0
      },
            
      // Métricas de rendimiento del sistema
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        responseTime: 0,
        throughput: 0,
        errorRate: 0
      }
    };
        
    // Métricas evolutivas
    this.evolutiveMetrics = {
      adaptationRate: 0,
      learningEfficiency: 0,
      predictionAccuracy: 0,
      optimizationImpact: 0,
      anomalyDetectionRate: 0
    };
        
    this.setupEventListeners();
    this.logger.info('🔢 StatsAgent inicializado', { agentId: this.id });
  }
    
  /**
     * Configurar listeners de eventos
     */
  setupEventListeners() {
    // Eventos de sistema
    this.eventHub.on('system.started', this.handleSystemStarted.bind(this));
    this.eventHub.on('system.shutdown', this.handleSystemShutdown.bind(this));
    this.eventHub.on('system.error', this.handleSystemError.bind(this));
        
    // Eventos de usuario
    this.eventHub.on('user.message_received', this.handleMessageReceived.bind(this));
    this.eventHub.on('user.contact_created', this.handleContactCreated.bind(this));
    this.eventHub.on('user.conversation_started', this.handleConversationStarted.bind(this));
    this.eventHub.on('user.conversation_ended', this.handleConversationEnded.bind(this));
        
    // Eventos de IA
    this.eventHub.on('ai.response_generated', this.handleAIResponse.bind(this));
    this.eventHub.on('ai.intention_detected', this.handleIntentionDetected.bind(this));
    this.eventHub.on('ai.decision_made', this.handleAIDecision.bind(this));
        
    // Eventos de tareas
    this.eventHub.on('task.completed', this.handleTaskCompleted.bind(this));
    this.eventHub.on('task.failed', this.handleTaskFailed.bind(this));
    this.eventHub.on('task.performance_measured', this.handlePerformanceMeasured.bind(this));
        
    // Eventos de solicitud de estadísticas
    this.eventHub.on('stats.request', this.handleStatsRequest.bind(this));
    this.eventHub.on('stats.report_request', this.handleReportRequest.bind(this));
    this.eventHub.on('stats.reset_request', this.handleResetRequest.bind(this));
        
    this.logger.info('📡 Event listeners configurados para StatsAgent');
  }
    
  /**
     * Inicializar el agente
     */
  async initialize() {
    try {
      await this.ensureDataDirectory();
      await this.loadStats();
      await this.loadAgentState();
            
      if (this.config.autoSave) {
        this.startAutoSave();
      }
            
      if (this.config.trackPerformance) {
        this.startPerformanceMonitoring();
      }
            
      this.startCleanupScheduler();
      this.startAnomalyDetection();
            
      this.agentState.isInitialized = true;
      await this.saveAgentState();
            
      this.eventHub.emit('system.agent_initialized', {
        agentId: this.id,
        agentName: this.name,
        timestamp: new Date().toISOString()
      });
            
      this.logger.info('✅ StatsAgent inicializado completamente');
    } catch (error) {
      this.logger.error('❌ Error inicializando StatsAgent', { error: error.message });
      throw error;
    }
  }
    
  /**
     * Activar/desactivar el agente
     */
  async setActive(isActive) {
    this.config.isActive = isActive;
    await this.saveAgentState();
        
    this.eventHub.emit('system.agent_status_changed', {
      agentId: this.id,
      agentName: this.name,
      isActive,
      timestamp: new Date().toISOString()
    });
        
    this.logger.info(`🔄 StatsAgent ${isActive ? 'activado' : 'desactivado'}`);
  }
    
  /**
     * Manejar inicio del sistema
     */
  async handleSystemStarted(data) {
    if (!this.config.isActive) return;
        
    this.stats.systemStartTime = new Date().toISOString();
    this.updateUptime();
        
    await this.recordMetric('system.startup', {
      timestamp: data.timestamp,
      version: data.version
    });
        
    this.logger.info('🚀 Sistema iniciado - métricas reiniciadas');
  }
    
  /**
     * Manejar mensaje recibido
     */
  async handleMessageReceived(data) {
    if (!this.config.isActive) return;
        
    const startTime = Date.now();
        
    try {
      await this.recordMessage({
        phoneNumber: data.phoneNumber,
        message: data.message,
        timestamp: data.timestamp,
        type: data.type || 'incoming'
      });
            
      const processingTime = Date.now() - startTime;
      await this.recordPerformanceMetric('message_processing_time', processingTime);
            
    } catch (error) {
      this.logger.error('❌ Error procesando mensaje', { error: error.message });
    }
  }
    
  /**
     * Manejar contacto creado
     */
  async handleContactCreated(data) {
    if (!this.config.isActive) return;
        
    await this.recordContact({
      phoneNumber: data.phoneNumber,
      name: data.name,
      timestamp: data.timestamp
    });
  }
    
  /**
     * Manejar respuesta de IA
     */
  async handleAIResponse(data) {
    if (!this.config.isActive) return;
        
    const responseTime = data.responseTime || 0;
        
    await this.recordInteraction({
      type: 'ai_response',
      responseTime,
      successful: data.successful !== false,
      timestamp: data.timestamp
    });
        
    this.updateResponseTimeDistribution(responseTime);
  }
    
  /**
     * Manejar intención detectada
     */
  async handleIntentionDetected(data) {
    if (!this.config.isActive) return;
        
    const intention = data.intention;
    if (!this.stats.intentions[intention]) {
      this.stats.intentions[intention] = 0;
    }
    this.stats.intentions[intention]++;
        
    this.updatePeriodMetrics('intention_detected', intention);
        
    // Aprender patrones de intenciones
    if (this.config.learningEnabled) {
      await this.learnIntentionPattern(data);
    }
  }
    
  /**
     * Manejar error del sistema
     */
  async handleSystemError(data) {
    if (!this.config.isActive) return;
        
    await this.recordError({
      type: data.type,
      message: data.message,
      stack: data.stack,
      timestamp: data.timestamp,
      source: data.source
    });
        
    // Detectar anomalías en errores
    if (this.config.anomalyDetectionEnabled) {
      await this.detectErrorAnomaly(data);
    }
  }
    
  /**
     * Manejar solicitud de estadísticas
     */
  async handleStatsRequest(data) {
    if (!this.config.isActive) return;
        
    try {
      const stats = await this.getStats(data.options || {});
            
      this.eventHub.emit('stats.response', {
        requestId: data.requestId,
        stats,
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      this.eventHub.emit('stats.error', {
        requestId: data.requestId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
    
  /**
     * Registrar mensaje
     */
  async recordMessage(messageData) {
    await this.executeWithMutex(async() => {
      this.stats.totalMessages++;
      this.stats.lastActivity = new Date().toISOString();
            
      this.updatePeriodMetrics('messages', 1);
            
      if (this.config.trackUserBehavior && messageData.phoneNumber) {
        await this.updateUserBehavior(messageData.phoneNumber, messageData.message);
      }
            
      // Emitir evento de métrica actualizada
      this.eventHub.emit('stats.metric_updated', {
        metric: 'totalMessages',
        value: this.stats.totalMessages,
        timestamp: new Date().toISOString()
      });
    });
  }
    
  /**
     * Registrar contacto
     */
  async recordContact(contactData) {
    await this.executeWithMutex(async() => {
      this.stats.totalContacts++;
      this.updatePeriodMetrics('contacts', 1);
            
      this.eventHub.emit('stats.metric_updated', {
        metric: 'totalContacts',
        value: this.stats.totalContacts,
        timestamp: new Date().toISOString()
      });
    });
  }
    
  /**
     * Registrar interacción
     */
  async recordInteraction(interactionData) {
    await this.executeWithMutex(async() => {
      this.stats.interactions.total++;
            
      if (interactionData.successful) {
        this.stats.interactions.successful++;
      } else {
        this.stats.interactions.failed++;
      }
            
      if (interactionData.responseTime) {
        this.stats.interactions.totalResponseTime += interactionData.responseTime;
        this.stats.interactions.averageResponseTime = 
                    this.stats.interactions.totalResponseTime / this.stats.interactions.total;
      }
            
      this.updatePeriodMetrics('interactions', 1);
    });
  }
    
  /**
     * Registrar error
     */
  async recordError(errorData) {
    await this.executeWithMutex(async() => {
      this.stats.totalErrors++;
      this.updatePeriodMetrics('errors', 1);
            
      // Verificar umbrales de error
      await this.checkErrorThresholds();
            
      this.eventHub.emit('stats.metric_updated', {
        metric: 'totalErrors',
        value: this.stats.totalErrors,
        timestamp: new Date().toISOString()
      });
    });
  }
    
  /**
     * Registrar métrica de rendimiento
     */
  async recordPerformanceMetric(metric, value) {
    if (!this.config.trackPerformance) return;
        
    this.stats.performance[metric] = value;
    this.updatePeriodMetrics(`performance.${metric}`, value);
        
    // Detectar anomalías de rendimiento
    if (this.config.anomalyDetectionEnabled) {
      await this.detectPerformanceAnomaly(metric, value);
    }
  }
    
  /**
     * Detectar anomalías de rendimiento
     */
  async detectPerformanceAnomaly(metric, value) {
    const baseline = this.agentState.performanceBaseline[metric];
        
    if (baseline && baseline.mean && baseline.stdDev) {
      const zScore = Math.abs((value - baseline.mean) / baseline.stdDev);
            
      if (zScore > this.config.anomalyThreshold) {
        this.agentState.anomaliesDetected++;
                
        this.eventHub.emit('system.anomaly_detected', {
          type: 'performance',
          metric,
          value,
          baseline: baseline.mean,
          zScore,
          severity: zScore > 3 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          detectedBy: this.name
        });
                
        this.logger.warn('⚠️ Anomalía de rendimiento detectada', {
          metric,
          value,
          zScore
        });
      }
    }
        
    // Actualizar baseline
    await this.updatePerformanceBaseline(metric, value);
  }
    
  /**
     * Actualizar baseline de rendimiento
     */
  async updatePerformanceBaseline(metric, value) {
    if (!this.agentState.performanceBaseline[metric]) {
      this.agentState.performanceBaseline[metric] = {
        values: [],
        mean: 0,
        stdDev: 0,
        count: 0
      };
    }
        
    const baseline = this.agentState.performanceBaseline[metric];
    baseline.values.push(value);
    baseline.count++;
        
    // Mantener solo los últimos 100 valores
    if (baseline.values.length > 100) {
      baseline.values.shift();
    }
        
    // Calcular nueva media y desviación estándar
    baseline.mean = baseline.values.reduce((a, b) => a + b, 0) / baseline.values.length;
        
    const variance = baseline.values.reduce((acc, val) => {
      return acc + Math.pow(val - baseline.mean, 2);
    }, 0) / baseline.values.length;
        
    baseline.stdDev = Math.sqrt(variance);
  }
    
  /**
     * Aprender patrón de intención
     */
  async learnIntentionPattern(data) {
    const pattern = {
      intention: data.intention,
      confidence: data.confidence,
      context: data.context,
      timestamp: data.timestamp,
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    };
        
    if (!this.agentState.learningData.patterns.intentions) {
      this.agentState.learningData.patterns.intentions = [];
    }
        
    this.agentState.learningData.patterns.intentions.push(pattern);
        
    // Mantener solo los últimos 1000 patrones
    if (this.agentState.learningData.patterns.intentions.length > 1000) {
      this.agentState.learningData.patterns.intentions.shift();
    }
        
    // Generar predicciones cada 100 patrones
    if (this.agentState.learningData.patterns.intentions.length % 100 === 0) {
      await this.generateIntentionPredictions();
    }
  }
    
  /**
     * Generar predicciones de intenciones
     */
  async generateIntentionPredictions() {
    const patterns = this.agentState.learningData.patterns.intentions;
    const predictions = {};
        
    // Analizar patrones por hora
    for (let hour = 0; hour < 24; hour++) {
      const hourPatterns = patterns.filter(p => p.hour === hour);
      if (hourPatterns.length > 0) {
        const intentionCounts = {};
        hourPatterns.forEach(p => {
          intentionCounts[p.intention] = (intentionCounts[p.intention] || 0) + 1;
        });
                
        const mostCommon = Object.entries(intentionCounts)
          .sort(([,a], [,b]) => b - a)[0];
                
        predictions[hour] = {
          mostLikelyIntention: mostCommon[0],
          probability: mostCommon[1] / hourPatterns.length,
          totalSamples: hourPatterns.length
        };
      }
    }
        
    this.agentState.learningData.predictions.intentions = predictions;
        
    this.eventHub.emit('ai.predictions_generated', {
      type: 'intentions',
      predictions,
      accuracy: this.evolutiveMetrics.predictionAccuracy,
      timestamp: new Date().toISOString(),
      generatedBy: this.name
    });
  }
    
  /**
     * Obtener estadísticas
     */
  async getStats(options = {}) {
    const includeDetailed = options.detailed !== false;
    const includePeriods = options.periods !== false;
        
    const result = {
      basic: {
        totalMessages: this.stats.totalMessages,
        totalContacts: this.stats.totalContacts,
        totalConversations: this.stats.totalConversations,
        totalErrors: this.stats.totalErrors,
        uptime: this.getUptime()
      },
      interactions: this.stats.interactions,
      conversationStates: this.stats.conversationStates,
      intentions: this.stats.intentions,
      effectiveness: this.stats.effectiveness,
      performance: this.stats.performance
    };
        
    if (includeDetailed) {
      result.responseTimeDistribution = this.stats.responseTimeDistribution;
      result.userBehavior = this.stats.userBehavior;
      result.evolutiveMetrics = this.evolutiveMetrics;
      result.agentState = {
        isInitialized: this.agentState.isInitialized,
        optimizationCount: this.agentState.optimizationCount,
        anomaliesDetected: this.agentState.anomaliesDetected
      };
    }
        
    if (includePeriods) {
      result.periods = this.stats.periods;
    }
        
    return result;
  }
    
  /**
     * Ejecutar operación con mutex
     */
  async executeWithMutex(operation) {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }
    
  /**
     * Procesar cola de operaciones
     */
  async processQueue() {
    if (this.operationMutex || this.operationQueue.length === 0) {
      return;
    }
        
    this.operationMutex = true;
        
    while (this.operationQueue.length > 0) {
      const { operation, resolve, reject } = this.operationQueue.shift();
            
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
        
    this.operationMutex = false;
  }
    
  /**
     * Asegurar directorio de datos
     */
  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }
    
  /**
     * Cargar estadísticas
     */
  async loadStats() {
    try {
      const data = await fs.readFile(this.statsFile, 'utf8');
      const savedStats = JSON.parse(data);
      this.stats = this.mergeStats(this.stats, savedStats);
      this.logger.info('📊 Estadísticas cargadas desde archivo');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('❌ Error cargando estadísticas', { error: error.message });
      }
    }
  }
    
  /**
     * Cargar estado del agente
     */
  async loadAgentState() {
    try {
      const data = await fs.readFile(this.agentStateFile, 'utf8');
      const savedState = JSON.parse(data);
      this.agentState = { ...this.agentState, ...savedState };
      this.logger.info('🧠 Estado del agente cargado');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('❌ Error cargando estado del agente', { error: error.message });
      }
    }
  }
    
  /**
     * Guardar estadísticas
     */
  async saveStats() {
    try {
      const statsToSave = {
        ...this.stats,
        lastSaved: new Date().toISOString()
      };
            
      await fs.writeFile(this.statsFile, JSON.stringify(statsToSave, null, 2));
      this.logger.debug('💾 Estadísticas guardadas');
    } catch (error) {
      this.logger.error('❌ Error guardando estadísticas', { error: error.message });
    }
  }
    
  /**
     * Guardar estado del agente
     */
  async saveAgentState() {
    try {
      const stateToSave = {
        ...this.agentState,
        lastSaved: new Date().toISOString()
      };
            
      await fs.writeFile(this.agentStateFile, JSON.stringify(stateToSave, null, 2));
      this.logger.debug('🧠 Estado del agente guardado');
    } catch (error) {
      this.logger.error('❌ Error guardando estado del agente', { error: error.message });
    }
  }
    
  /**
     * Fusionar estadísticas
     */
  mergeStats(defaultStats, savedStats) {
    const merged = { ...defaultStats };
        
    for (const [key, value] of Object.entries(savedStats)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = { ...merged[key], ...value };
      } else {
        merged[key] = value;
      }
    }
        
    return merged;
  }
    
  /**
     * Iniciar auto-guardado
     */
  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
        
    this.autoSaveInterval = setInterval(async() => {
      try {
        await this.saveStats();
        await this.saveAgentState();
      } catch (error) {
        this.logger.error('❌ Error en auto-guardado', { error: error.message });
      }
    }, this.config.saveInterval * 1000);
        
    this.logger.info('⏰ Auto-guardado iniciado', { 
      interval: this.config.saveInterval 
    });
  }
    
  /**
     * Iniciar monitoreo de rendimiento
     */
  startPerformanceMonitoring() {
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
    }
        
    this.performanceInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 30000); // Cada 30 segundos
        
    this.logger.info('📈 Monitoreo de rendimiento iniciado');
  }
    
  /**
     * Iniciar detección de anomalías
     */
  startAnomalyDetection() {
    if (this.anomalyInterval) {
      clearInterval(this.anomalyInterval);
    }
        
    this.anomalyInterval = setInterval(async() => {
      await this.runAnomalyDetection();
    }, 60000); // Cada minuto
        
    this.logger.info('🔍 Detección de anomalías iniciada');
  }
    
  /**
     * Ejecutar detección de anomalías
     */
  async runAnomalyDetection() {
    if (!this.config.anomalyDetectionEnabled) return;
        
    // Detectar anomalías en métricas básicas
    const metrics = ['totalMessages', 'totalErrors', 'totalContacts'];
        
    for (const metric of metrics) {
      const currentValue = this.stats[metric];
      const baseline = this.agentState.performanceBaseline[metric];
            
      if (baseline && baseline.mean !== undefined) {
        const zScore = Math.abs((currentValue - baseline.mean) / (baseline.stdDev || 1));
                
        if (zScore > this.config.anomalyThreshold) {
          this.eventHub.emit('system.anomaly_detected', {
            type: 'metric',
            metric,
            value: currentValue,
            baseline: baseline.mean,
            zScore,
            severity: zScore > 3 ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            detectedBy: this.name
          });
        }
      }
            
      await this.updatePerformanceBaseline(metric, currentValue);
    }
  }
    
  /**
     * Actualizar métricas de rendimiento
     */
  updatePerformanceMetrics() {
    const memUsage = process.memoryUsage();
    this.stats.performance.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
        
    this.updateUptime();
        
    // Calcular tasa de error
    if (this.stats.interactions.total > 0) {
      this.stats.performance.errorRate = 
                (this.stats.interactions.failed / this.stats.interactions.total) * 100;
    }
        
    // Calcular throughput (mensajes por minuto)
    const uptimeMinutes = this.getUptime() / 60000;
    if (uptimeMinutes > 0) {
      this.stats.performance.throughput = this.stats.totalMessages / uptimeMinutes;
    }
  }
    
  /**
     * Actualizar tiempo de actividad
     */
  updateUptime() {
    const startTime = new Date(this.stats.systemStartTime);
    this.stats.uptime = Date.now() - startTime.getTime();
  }
    
  /**
     * Obtener tiempo de actividad
     */
  getUptime() {
    return this.stats.uptime;
  }
    
  /**
     * Verificar umbrales de error
     */
  async checkErrorThresholds() {
    if (!this.config.enableAlerts) return;
        
    const recentErrors = this.getRecentErrors();
        
    if (recentErrors >= this.config.errorThreshold) {
      this.eventHub.emit('system.alert', {
        type: 'error_threshold_exceeded',
        threshold: this.config.errorThreshold,
        current: recentErrors,
        severity: 'high',
        timestamp: new Date().toISOString(),
        source: this.name
      });
    }
  }
    
  /**
     * Obtener errores recientes
     */
  getRecentErrors() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const currentHour = this.getCurrentHour();
        
    return this.stats.periods.hourly[currentHour]?.errors || 0;
  }
    
  /**
     * Actualizar métricas por período
     */
  updatePeriodMetrics(metric, value) {
    const periods = {
      hour: this.getCurrentHour(),
      day: this.getCurrentDay(),
      week: this.getCurrentWeek(),
      month: this.getCurrentMonth()
    };
        
    for (const [level, period] of Object.entries(periods)) {
      this.updatePeriodMetric(level + 'ly', period, metric, value);
    }
  }
    
  /**
     * Actualizar métrica de período específico
     */
  updatePeriodMetric(level, period, metric, value) {
    if (!this.stats.periods[level]) {
      this.stats.periods[level] = {};
    }
        
    if (!this.stats.periods[level][period]) {
      this.stats.periods[level][period] = {};
    }
        
    if (typeof value === 'number') {
      this.stats.periods[level][period][metric] = 
                (this.stats.periods[level][period][metric] || 0) + value;
    } else {
      this.stats.periods[level][period][metric] = value;
    }
  }
    
  /**
     * Actualizar distribución de tiempos de respuesta
     */
  updateResponseTimeDistribution(responseTime) {
    if (responseTime < 1000) {
      this.stats.responseTimeDistribution['0-1s']++;
    } else if (responseTime < 3000) {
      this.stats.responseTimeDistribution['1-3s']++;
    } else if (responseTime < 5000) {
      this.stats.responseTimeDistribution['3-5s']++;
    } else if (responseTime < 10000) {
      this.stats.responseTimeDistribution['5-10s']++;
    } else {
      this.stats.responseTimeDistribution['10s+']++;
    }
  }
    
  /**
     * Actualizar comportamiento de usuario
     */
  async updateUserBehavior(phoneNumber, message) {
    if (!this.stats.userBehavior[phoneNumber]) {
      this.stats.userBehavior[phoneNumber] = {
        messageCount: 0,
        firstContact: new Date().toISOString(),
        lastContact: new Date().toISOString(),
        averageMessageLength: 0,
        totalMessageLength: 0,
        conversationCount: 0,
        intentions: {}
      };
    }
        
    const user = this.stats.userBehavior[phoneNumber];
    user.messageCount++;
    user.lastContact = new Date().toISOString();
    user.totalMessageLength += message.length;
    user.averageMessageLength = user.totalMessageLength / user.messageCount;
  }
    
  /**
     * Iniciar programador de limpieza
     */
  startCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
        
    // Ejecutar limpieza diariamente
    this.cleanupInterval = setInterval(async() => {
      await this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
        
    this.logger.info('🧹 Programador de limpieza iniciado');
  }
    
  /**
     * Limpiar datos antiguos
     */
  async cleanupOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        
    let cleanedCount = 0;
        
    // Limpiar datos por período
    for (const level of this.config.aggregationLevels) {
      const periods = this.stats.periods[level];
      if (periods) {
        for (const [period, data] of Object.entries(periods)) {
          const periodDate = this.parsePeriodDate(period, level);
          if (periodDate && periodDate < cutoffDate) {
            delete periods[period];
            cleanedCount++;
          }
        }
      }
    }
        
    if (cleanedCount > 0) {
      this.logger.info('🧹 Datos antiguos limpiados', { cleanedCount });
      await this.saveStats();
    }
  }
    
  /**
     * Parsear fecha de período
     */
  parsePeriodDate(period, level) {
    try {
      switch (level) {
      case 'hourly':
        return new Date(period);
      case 'daily':
        return new Date(period);
      case 'weekly':
        const [year, week] = period.split('-W');
        return new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
      case 'monthly':
        return new Date(period + '-01');
      default:
        return null;
      }
    } catch {
      return null;
    }
  }
    
  /**
     * Obtener hora actual
     */
  getCurrentHour() {
    return new Date().toISOString().slice(0, 13) + ':00:00.000Z';
  }
    
  /**
     * Obtener día actual
     */
  getCurrentDay() {
    return new Date().toISOString().slice(0, 10);
  }
    
  /**
     * Obtener semana actual
     */
  getCurrentWeek() {
    const date = new Date();
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }
    
  /**
     * Obtener mes actual
     */
  getCurrentMonth() {
    return new Date().toISOString().slice(0, 7);
  }
    
  /**
     * Obtener número de semana
     */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
    
  /**
     * Apagar el agente
     */
  async shutdown() {
    this.logger.info('🔄 Iniciando apagado de StatsAgent...');
        
    try {
      // Limpiar intervalos
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
      }
      if (this.performanceInterval) {
        clearInterval(this.performanceInterval);
      }
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      if (this.anomalyInterval) {
        clearInterval(this.anomalyInterval);
      }
            
      // Guardar estado final
      await this.saveStats();
      await this.saveAgentState();
            
      this.eventHub.emit('system.agent_shutdown', {
        agentId: this.id,
        agentName: this.name,
        timestamp: new Date().toISOString()
      });
            
      this.logger.info('✅ StatsAgent apagado correctamente');
    } catch (error) {
      this.logger.error('❌ Error durante apagado', { error: error.message });
      throw error;
    }
  }
}

export default StatsAgent;
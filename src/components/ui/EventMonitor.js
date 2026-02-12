/**
 * EventMonitor - Monitor de Eventos en Tiempo Real
 * 
 * Monitorea, analiza y procesa eventos del sistema en tiempo real
 * para el dashboard de visualización
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../../services/core/core/logger.js';
import { EventEmitter } from 'events';

const logger = createLogger('EVENT_MONITOR');

export class EventMonitor extends EventEmitter {
  constructor(eventBus, options = {}) {
    super();
    
    this.eventBus = eventBus;
    
    // Configuración
    this.config = {
      // Configuración de monitoreo
      maxEvents: options.maxEvents || 1000,
      retentionPeriod: options.retentionPeriod || 3600000, // 1 hora
      
      // Configuración de filtrado
      enableFiltering: options.enableFiltering !== false,
      eventFilters: options.eventFilters || [],
      excludePatterns: options.excludePatterns || [],
      includePatterns: options.includePatterns || [],
      
      // Configuración de análisis
      enablePatternDetection: options.enablePatternDetection !== false,
      patternWindow: options.patternWindow || 60000, // 1 minuto
      minPatternOccurrences: options.minPatternOccurrences || 3,
      
      // Configuración de alertas
      enableAlerts: options.enableAlerts !== false,
      alertThresholds: {
        eventsPerSecond: 100,
        errorRate: 5,
        duplicateEvents: 10,
        unusualPatterns: true
      },
      
      // Configuración de agregación
      enableAggregation: options.enableAggregation !== false,
      aggregationWindow: options.aggregationWindow || 60000, // 1 minuto
      
      ...options
    };
    
    // Estado del monitor
    this.isInitialized = false;
    this.isMonitoring = false;
    this.startTime = null;
    
    // Almacenamiento de eventos
    this.events = [];
    this.eventTypes = new Map();
    this.eventSources = new Map();
    this.eventPatterns = new Map();
    
    // Estadísticas de eventos
    this.stats = {
      totalEvents: 0,
      eventsPerSecond: 0,
      errorEvents: 0,
      errorRate: 0,
      uniqueTypes: 0,
      uniqueSources: 0,
      lastEvent: null,
      lastError: null
    };
    
    // Análisis de patrones
    this.patternAnalysis = {
      detectedPatterns: new Map(),
      anomalies: [],
      trends: new Map(),
      correlations: new Map()
    };
    
    // Filtros activos
    this.activeFilters = new Set();
    
    // Timers
    this.analysisTimer = null;
    this.cleanupTimer = null;
    this.statsTimer = null;
    
    // Buffer para análisis en tiempo real
    this.analysisBuffer = [];
    this.bufferSize = 100;
    
    logger.info('EventMonitor inicializado', {
      maxEvents: this.config.maxEvents,
      enablePatternDetection: this.config.enablePatternDetection
    });
  }
  
  /**
   * Inicializar el monitor
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('EventMonitor ya está inicializado');
      return;
    }
    
    try {
      logger.info('Inicializando EventMonitor...');
      
      // Configurar integración con EventBus
      this.setupEventBusIntegration();
      
      // Configurar filtros iniciales
      this.setupFilters();
      
      // Configurar timers
      this.setupTimers();
      
      this.isInitialized = true;
      this.startTime = new Date().toISOString();
      
      logger.info('EventMonitor inicializado correctamente');
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Error inicializando EventMonitor:', error);
      throw error;
    }
  }
  
  /**
   * Configurar integración con EventBus
   */
  setupEventBusIntegration() {
    if (!this.eventBus) {
      logger.warn('EventBus no proporcionado, funcionando en modo standalone');
      return;
    }
    
    // Escuchar todos los eventos
    this.eventBus.on('*', (eventType, eventData, metadata = {}) => {
      this.processEvent({
        eventType,
        data: eventData,
        metadata,
        timestamp: new Date().toISOString(),
        source: metadata.source || 'unknown'
      });
    });
    
    // Escuchar eventos específicos del sistema
    this.eventBus.on('system:error', (error, metadata) => {
      this.processErrorEvent({
        eventType: 'system:error',
        error,
        metadata,
        timestamp: new Date().toISOString(),
        source: 'system'
      });
    });
    
    this.eventBus.on('agent:*', (eventType, data, metadata) => {
      this.processAgentEvent({
        eventType: `agent:${eventType}`,
        data,
        metadata,
        timestamp: new Date().toISOString(),
        source: 'agent'
      });
    });
    
    this.eventBus.on('adapter:*', (eventType, data, metadata) => {
      this.processAdapterEvent({
        eventType: `adapter:${eventType}`,
        data,
        metadata,
        timestamp: new Date().toISOString(),
        source: 'adapter'
      });
    });
    
    logger.info('Integración con EventBus configurada');
  }
  
  /**
   * Configurar filtros
   */
  setupFilters() {
    // Agregar filtros predefinidos
    for (const filter of this.config.eventFilters) {
      this.addFilter(filter);
    }
    
    // Configurar patrones de exclusión
    for (const pattern of this.config.excludePatterns) {
      this.addExcludePattern(pattern);
    }
    
    // Configurar patrones de inclusión
    for (const pattern of this.config.includePatterns) {
      this.addIncludePattern(pattern);
    }
  }
  
  /**
   * Configurar timers
   */
  setupTimers() {
    // Timer de análisis de patrones
    if (this.config.enablePatternDetection) {
      this.analysisTimer = setInterval(() => {
        this.analyzePatterns();
      }, this.config.patternWindow);
    }
    
    // Timer de limpieza
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldEvents();
    }, 300000); // 5 minutos
    
    // Timer de estadísticas
    this.statsTimer = setInterval(() => {
      this.updateStats();
    }, 10000); // 10 segundos
  }
  
  /**
   * Iniciar monitoreo
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isMonitoring) {
      logger.warn('EventMonitor ya está monitoreando');
      return;
    }
    
    try {
      logger.info('Iniciando monitoreo de eventos...');
      
      this.isMonitoring = true;
      
      logger.info('Monitoreo de eventos iniciado');
      this.emit('started');
      
    } catch (error) {
      logger.error('Error iniciando monitoreo de eventos:', error);
      throw error;
    }
  }
  
  /**
   * Detener monitoreo
   */
  async stop() {
    if (!this.isMonitoring) {
      logger.warn('EventMonitor no está monitoreando');
      return;
    }
    
    try {
      logger.info('Deteniendo monitoreo de eventos...');
      
      // Detener timers
      if (this.analysisTimer) {
        clearInterval(this.analysisTimer);
        this.analysisTimer = null;
      }
      
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      
      if (this.statsTimer) {
        clearInterval(this.statsTimer);
        this.statsTimer = null;
      }
      
      this.isMonitoring = false;
      
      logger.info('Monitoreo de eventos detenido');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Error deteniendo monitoreo de eventos:', error);
      throw error;
    }
  }
  
  /**
   * Procesar evento
   */
  processEvent(event) {
    try {
      // Aplicar filtros
      if (!this.shouldProcessEvent(event)) {
        return;
      }
      
      // Enriquecer evento
      const enrichedEvent = this.enrichEvent(event);
      
      // Almacenar evento
      this.storeEvent(enrichedEvent);
      
      // Agregar al buffer de análisis
      this.addToAnalysisBuffer(enrichedEvent);
      
      // Actualizar estadísticas
      this.updateEventStats(enrichedEvent);
      
      // Emitir evento procesado
      this.emit('event:received', enrichedEvent);
      
      // Verificar alertas
      if (this.config.enableAlerts) {
        this.checkEventAlerts(enrichedEvent);
      }
      
    } catch (error) {
      logger.error('Error procesando evento:', error);
    }
  }
  
  /**
   * Procesar evento de error
   */
  processErrorEvent(errorEvent) {
    const enrichedEvent = {
      ...errorEvent,
      isError: true,
      severity: this.determineSeverity(errorEvent),
      category: 'error'
    };
    
    this.processEvent(enrichedEvent);
    
    // Estadísticas específicas de errores
    this.stats.errorEvents++;
    this.stats.lastError = enrichedEvent.timestamp;
    
    this.emit('event:error', enrichedEvent);
  }
  
  /**
   * Procesar evento de agente
   */
  processAgentEvent(agentEvent) {
    const enrichedEvent = {
      ...agentEvent,
      category: 'agent',
      agentId: agentEvent.data?.agentId || agentEvent.data?.id
    };
    
    this.processEvent(enrichedEvent);
    this.emit('event:agent', enrichedEvent);
  }
  
  /**
   * Procesar evento de adaptador
   */
  processAdapterEvent(adapterEvent) {
    const enrichedEvent = {
      ...adapterEvent,
      category: 'adapter',
      adapterId: adapterEvent.data?.adapterId || adapterEvent.data?.name
    };
    
    this.processEvent(enrichedEvent);
    this.emit('event:adapter', enrichedEvent);
  }
  
  /**
   * Verificar si debe procesar el evento
   */
  shouldProcessEvent(event) {
    if (!this.config.enableFiltering) {
      return true;
    }
    
    // Verificar patrones de exclusión
    for (const pattern of this.config.excludePatterns) {
      if (this.matchesPattern(event, pattern)) {
        return false;
      }
    }
    
    // Verificar patrones de inclusión
    if (this.config.includePatterns.length > 0) {
      let matches = false;
      for (const pattern of this.config.includePatterns) {
        if (this.matchesPattern(event, pattern)) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        return false;
      }
    }
    
    // Verificar filtros activos
    for (const filter of this.activeFilters) {
      if (!filter(event)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Verificar si el evento coincide con un patrón
   */
  matchesPattern(event, pattern) {
    if (typeof pattern === 'string') {
      return event.eventType.includes(pattern) || 
             (event.source && event.source.includes(pattern));
    }
    
    if (pattern instanceof RegExp) {
      return pattern.test(event.eventType) || 
             (event.source && pattern.test(event.source));
    }
    
    if (typeof pattern === 'function') {
      return pattern(event);
    }
    
    return false;
  }
  
  /**
   * Enriquecer evento
   */
  enrichEvent(event) {
    return {
      ...event,
      id: this.generateEventId(),
      receivedAt: new Date().toISOString(),
      size: this.calculateEventSize(event),
      hash: this.calculateEventHash(event),
      category: event.category || this.categorizeEvent(event),
      severity: event.severity || this.determineSeverity(event),
      tags: this.extractTags(event)
    };
  }
  
  /**
   * Generar ID único para el evento
   */
  generateEventId() {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Calcular tamaño del evento
   */
  calculateEventSize(event) {
    return JSON.stringify(event).length;
  }
  
  /**
   * Calcular hash del evento
   */
  calculateEventHash(event) {
    const content = `${event.eventType}_${event.source}_${JSON.stringify(event.data)}`;
    // Hash simple para detección de duplicados
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return hash.toString(36);
  }
  
  /**
   * Categorizar evento
   */
  categorizeEvent(event) {
    const eventType = event.eventType.toLowerCase();
    
    if (eventType.includes('error') || eventType.includes('fail')) {
      return 'error';
    }
    
    if (eventType.includes('warn')) {
      return 'warning';
    }
    
    if (eventType.includes('agent')) {
      return 'agent';
    }
    
    if (eventType.includes('adapter')) {
      return 'adapter';
    }
    
    if (eventType.includes('system')) {
      return 'system';
    }
    
    if (eventType.includes('user')) {
      return 'user';
    }
    
    return 'general';
  }
  
  /**
   * Determinar severidad del evento
   */
  determineSeverity(event) {
    if (event.isError || event.eventType.includes('error')) {
      return 'error';
    }
    
    if (event.eventType.includes('warn')) {
      return 'warning';
    }
    
    if (event.eventType.includes('critical') || event.eventType.includes('fatal')) {
      return 'critical';
    }
    
    return 'info';
  }
  
  /**
   * Extraer tags del evento
   */
  extractTags(event) {
    const tags = [];
    
    if (event.source) {
      tags.push(`source:${event.source}`);
    }
    
    if (event.category) {
      tags.push(`category:${event.category}`);
    }
    
    if (event.severity) {
      tags.push(`severity:${event.severity}`);
    }
    
    if (event.agentId) {
      tags.push(`agent:${event.agentId}`);
    }
    
    if (event.adapterId) {
      tags.push(`adapter:${event.adapterId}`);
    }
    
    return tags;
  }
  
  /**
   * Almacenar evento
   */
  storeEvent(event) {
    // Agregar al inicio del array
    this.events.unshift(event);
    
    // Mantener solo los eventos necesarios
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(0, this.config.maxEvents);
    }
    
    // Actualizar índices
    this.updateEventIndices(event);
  }
  
  /**
   * Actualizar índices de eventos
   */
  updateEventIndices(event) {
    // Índice por tipo de evento
    const typeCount = this.eventTypes.get(event.eventType) || 0;
    this.eventTypes.set(event.eventType, typeCount + 1);
    
    // Índice por fuente
    const sourceCount = this.eventSources.get(event.source) || 0;
    this.eventSources.set(event.source, sourceCount + 1);
    
    // Actualizar estadísticas
    this.stats.uniqueTypes = this.eventTypes.size;
    this.stats.uniqueSources = this.eventSources.size;
  }
  
  /**
   * Agregar al buffer de análisis
   */
  addToAnalysisBuffer(event) {
    this.analysisBuffer.unshift(event);
    
    if (this.analysisBuffer.length > this.bufferSize) {
      this.analysisBuffer = this.analysisBuffer.slice(0, this.bufferSize);
    }
  }
  
  /**
   * Actualizar estadísticas de eventos
   */
  updateEventStats(event) {
    this.stats.totalEvents++;
    this.stats.lastEvent = event.timestamp;
    
    if (event.isError) {
      this.stats.errorEvents++;
    }
    
    this.stats.errorRate = this.stats.totalEvents > 0 ? 
      (this.stats.errorEvents / this.stats.totalEvents) * 100 : 0;
  }
  
  /**
   * Actualizar estadísticas generales
   */
  updateStats() {
    // Calcular eventos por segundo
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    const recentEvents = this.events.filter(event =>
      new Date(event.timestamp).getTime() > oneSecondAgo
    );
    
    this.stats.eventsPerSecond = recentEvents.length;
    
    this.emit('stats:updated', this.stats);
  }
  
  /**
   * Verificar alertas de eventos
   */
  checkEventAlerts(event) {
    const alerts = [];
    
    // Verificar tasa de eventos por segundo
    if (this.stats.eventsPerSecond > this.config.alertThresholds.eventsPerSecond) {
      alerts.push({
        type: 'high_event_rate',
        severity: 'warning',
        message: `Tasa de eventos alta: ${this.stats.eventsPerSecond} eventos/segundo`,
        value: this.stats.eventsPerSecond,
        threshold: this.config.alertThresholds.eventsPerSecond
      });
    }
    
    // Verificar tasa de errores
    if (this.stats.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'error',
        message: `Tasa de errores alta: ${this.stats.errorRate.toFixed(1)}%`,
        value: this.stats.errorRate,
        threshold: this.config.alertThresholds.errorRate
      });
    }
    
    // Verificar eventos duplicados
    const duplicateCount = this.countDuplicateEvents(event);
    if (duplicateCount > this.config.alertThresholds.duplicateEvents) {
      alerts.push({
        type: 'duplicate_events',
        severity: 'warning',
        message: `Eventos duplicados detectados: ${duplicateCount} ocurrencias`,
        value: duplicateCount,
        threshold: this.config.alertThresholds.duplicateEvents
      });
    }
    
    // Emitir alertas
    for (const alert of alerts) {
      this.emit('alert', alert);
    }
  }
  
  /**
   * Contar eventos duplicados
   */
  countDuplicateEvents(event) {
    return this.events.filter(e => e.hash === event.hash).length;
  }
  
  /**
   * Analizar patrones
   */
  analyzePatterns() {
    if (!this.config.enablePatternDetection || this.analysisBuffer.length === 0) {
      return;
    }
    
    try {
      // Detectar patrones de secuencia
      this.detectSequencePatterns();
      
      // Detectar patrones de frecuencia
      this.detectFrequencyPatterns();
      
      // Detectar anomalías
      this.detectAnomalies();
      
      // Detectar correlaciones
      this.detectCorrelations();
      
      this.emit('patterns:analyzed', {
        patterns: Object.fromEntries(this.patternAnalysis.detectedPatterns),
        anomalies: this.patternAnalysis.anomalies,
        trends: Object.fromEntries(this.patternAnalysis.trends),
        correlations: Object.fromEntries(this.patternAnalysis.correlations)
      });
      
    } catch (error) {
      logger.error('Error analizando patrones:', error);
    }
  }
  
  /**
   * Detectar patrones de secuencia
   */
  detectSequencePatterns() {
    const sequences = new Map();
    const windowSize = 3;
    
    for (let i = 0; i <= this.analysisBuffer.length - windowSize; i++) {
      const sequence = this.analysisBuffer.slice(i, i + windowSize)
        .map(event => event.eventType)
        .join(' -> ');
      
      const count = sequences.get(sequence) || 0;
      sequences.set(sequence, count + 1);
    }
    
    // Filtrar patrones significativos
    for (const [sequence, count] of sequences) {
      if (count >= this.config.minPatternOccurrences) {
        this.patternAnalysis.detectedPatterns.set(`sequence:${sequence}`, {
          type: 'sequence',
          pattern: sequence,
          occurrences: count,
          confidence: count / (this.analysisBuffer.length - windowSize + 1),
          lastSeen: new Date().toISOString()
        });
      }
    }
  }
  
  /**
   * Detectar patrones de frecuencia
   */
  detectFrequencyPatterns() {
    const frequencies = new Map();
    
    for (const event of this.analysisBuffer) {
      const key = `${event.eventType}:${event.source}`;
      const count = frequencies.get(key) || 0;
      frequencies.set(key, count + 1);
    }
    
    // Calcular frecuencias esperadas y detectar anomalías
    const totalEvents = this.analysisBuffer.length;
    
    for (const [key, count] of frequencies) {
      const frequency = count / totalEvents;
      
      if (frequency > 0.1) { // Más del 10% de los eventos
        this.patternAnalysis.detectedPatterns.set(`frequency:${key}`, {
          type: 'frequency',
          pattern: key,
          occurrences: count,
          frequency: frequency,
          confidence: frequency,
          lastSeen: new Date().toISOString()
        });
      }
    }
  }
  
  /**
   * Detectar anomalías
   */
  detectAnomalies() {
    // Detectar picos de eventos
    const eventCounts = this.getEventCountsOverTime(60000); // 1 minuto
    const average = eventCounts.reduce((a, b) => a + b, 0) / eventCounts.length;
    const threshold = average * 2; // 2x el promedio
    
    for (let i = 0; i < eventCounts.length; i++) {
      if (eventCounts[i] > threshold) {
        this.patternAnalysis.anomalies.push({
          type: 'event_spike',
          timestamp: new Date(Date.now() - (eventCounts.length - i) * 60000).toISOString(),
          value: eventCounts[i],
          expected: average,
          severity: eventCounts[i] > threshold * 2 ? 'high' : 'medium'
        });
      }
    }
    
    // Mantener solo las anomalías recientes
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    this.patternAnalysis.anomalies = this.patternAnalysis.anomalies.filter(anomaly =>
      new Date(anomaly.timestamp).getTime() > cutoffTime
    );
  }
  
  /**
   * Detectar correlaciones
   */
  detectCorrelations() {
    const eventPairs = new Map();
    const timeWindow = 5000; // 5 segundos
    
    for (let i = 0; i < this.analysisBuffer.length - 1; i++) {
      const event1 = this.analysisBuffer[i];
      const event2 = this.analysisBuffer[i + 1];
      
      const timeDiff = new Date(event1.timestamp).getTime() - new Date(event2.timestamp).getTime();
      
      if (Math.abs(timeDiff) <= timeWindow) {
        const pair = `${event1.eventType} -> ${event2.eventType}`;
        const count = eventPairs.get(pair) || 0;
        eventPairs.set(pair, count + 1);
      }
    }
    
    // Filtrar correlaciones significativas
    for (const [pair, count] of eventPairs) {
      if (count >= this.config.minPatternOccurrences) {
        this.patternAnalysis.correlations.set(pair, {
          type: 'correlation',
          pattern: pair,
          occurrences: count,
          confidence: count / this.analysisBuffer.length,
          timeWindow: timeWindow,
          lastSeen: new Date().toISOString()
        });
      }
    }
  }
  
  /**
   * Obtener conteos de eventos a lo largo del tiempo
   */
  getEventCountsOverTime(windowSize) {
    const now = Date.now();
    const windows = 10; // 10 ventanas de tiempo
    const counts = new Array(windows).fill(0);
    
    for (const event of this.events) {
      const eventTime = new Date(event.timestamp).getTime();
      const windowIndex = Math.floor((now - eventTime) / windowSize);
      
      if (windowIndex >= 0 && windowIndex < windows) {
        counts[windows - 1 - windowIndex]++;
      }
    }
    
    return counts;
  }
  
  /**
   * Agregar filtro
   */
  addFilter(filter) {
    if (typeof filter === 'function') {
      this.activeFilters.add(filter);
      return true;
    }
    return false;
  }
  
  /**
   * Remover filtro
   */
  removeFilter(filter) {
    return this.activeFilters.delete(filter);
  }
  
  /**
   * Agregar patrón de exclusión
   */
  addExcludePattern(pattern) {
    this.config.excludePatterns.push(pattern);
  }
  
  /**
   * Agregar patrón de inclusión
   */
  addIncludePattern(pattern) {
    this.config.includePatterns.push(pattern);
  }
  
  /**
   * Limpiar eventos antiguos
   */
  cleanupOldEvents() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    
    // Limpiar eventos principales
    const originalLength = this.events.length;
    this.events = this.events.filter(event =>
      new Date(event.timestamp).getTime() > cutoffTime
    );
    
    if (this.events.length !== originalLength) {
      logger.debug(`Eventos antiguos limpiados: ${originalLength - this.events.length} eventos removidos`);
    }
    
    // Limpiar buffer de análisis
    this.analysisBuffer = this.analysisBuffer.filter(event =>
      new Date(event.timestamp).getTime() > cutoffTime
    );
    
    // Limpiar patrones antiguos
    for (const [key, pattern] of this.patternAnalysis.detectedPatterns) {
      if (new Date(pattern.lastSeen).getTime() < cutoffTime) {
        this.patternAnalysis.detectedPatterns.delete(key);
      }
    }
  }
  
  /**
   * Obtener eventos recientes
   */
  getRecentEvents(limit = 50) {
    return this.events.slice(0, limit);
  }
  
  /**
   * Obtener eventos por tipo
   */
  getEventsByType(eventType, limit = 50) {
    return this.events
      .filter(event => event.eventType === eventType)
      .slice(0, limit);
  }
  
  /**
   * Obtener eventos por fuente
   */
  getEventsBySource(source, limit = 50) {
    return this.events
      .filter(event => event.source === source)
      .slice(0, limit);
  }
  
  /**
   * Obtener eventos por categoría
   */
  getEventsByCategory(category, limit = 50) {
    return this.events
      .filter(event => event.category === category)
      .slice(0, limit);
  }
  
  /**
   * Obtener eventos por rango de tiempo
   */
  getEventsByTimeRange(startTime, endTime, limit = 100) {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    return this.events
      .filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return eventTime >= start && eventTime <= end;
      })
      .slice(0, limit);
  }
  
  /**
   * Buscar eventos
   */
  searchEvents(query, options = {}) {
    const {
      limit = 50,
      category,
      source,
      severity,
      timeRange
    } = options;
    
    let filteredEvents = this.events;
    
    // Filtrar por consulta de texto
    if (query) {
      const queryLower = query.toLowerCase();
      filteredEvents = filteredEvents.filter(event =>
        event.eventType.toLowerCase().includes(queryLower) ||
        (event.source && event.source.toLowerCase().includes(queryLower)) ||
        JSON.stringify(event.data).toLowerCase().includes(queryLower)
      );
    }
    
    // Filtrar por categoría
    if (category) {
      filteredEvents = filteredEvents.filter(event => event.category === category);
    }
    
    // Filtrar por fuente
    if (source) {
      filteredEvents = filteredEvents.filter(event => event.source === source);
    }
    
    // Filtrar por severidad
    if (severity) {
      filteredEvents = filteredEvents.filter(event => event.severity === severity);
    }
    
    // Filtrar por rango de tiempo
    if (timeRange) {
      const { start, end } = timeRange;
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      
      filteredEvents = filteredEvents.filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return eventTime >= startTime && eventTime <= endTime;
      });
    }
    
    return filteredEvents.slice(0, limit);
  }
  
  /**
   * Obtener estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      isInitialized: this.isInitialized,
      isMonitoring: this.isMonitoring,
      startTime: this.startTime,
      eventsCount: this.events.length,
      eventTypesCount: this.eventTypes.size,
      eventSourcesCount: this.eventSources.size,
      patternsCount: this.patternAnalysis.detectedPatterns.size,
      anomaliesCount: this.patternAnalysis.anomalies.length,
      config: this.config
    };
  }
  
  /**
   * Obtener análisis de patrones
   */
  getPatternAnalysis() {
    return {
      patterns: Object.fromEntries(this.patternAnalysis.detectedPatterns),
      anomalies: this.patternAnalysis.anomalies,
      trends: Object.fromEntries(this.patternAnalysis.trends),
      correlations: Object.fromEntries(this.patternAnalysis.correlations)
    };
  }
  
  /**
   * Obtener resumen de eventos
   */
  getEventSummary() {
    return {
      total: this.stats.totalEvents,
      errors: this.stats.errorEvents,
      errorRate: this.stats.errorRate,
      eventsPerSecond: this.stats.eventsPerSecond,
      uniqueTypes: this.stats.uniqueTypes,
      uniqueSources: this.stats.uniqueSources,
      topEventTypes: this.getTopEventTypes(10),
      topSources: this.getTopSources(10),
      recentEvents: this.getRecentEvents(10)
    };
  }
  
  /**
   * Obtener tipos de eventos más frecuentes
   */
  getTopEventTypes(limit = 10) {
    return Array.from(this.eventTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }
  
  /**
   * Obtener fuentes más frecuentes
   */
  getTopSources(limit = 10) {
    return Array.from(this.eventSources.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([source, count]) => ({ source, count }));
  }
  
  /**
   * Exportar eventos
   */
  exportEvents(format = 'json', options = {}) {
    const events = options.filtered ? 
      this.searchEvents(options.query, options) : 
      this.events;
    
    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(events, null, 2);
    case 'csv':
      return this.convertEventsToCSV(events);
    default:
      throw new Error(`Formato de exportación no soportado: ${format}`);
    }
  }
  
  /**
   * Convertir eventos a CSV
   */
  convertEventsToCSV(events) {
    const lines = [];
    lines.push('timestamp,eventType,source,category,severity,size');
    
    for (const event of events) {
      lines.push([
        event.timestamp,
        event.eventType,
        event.source || '',
        event.category || '',
        event.severity || '',
        event.size || 0
      ].join(','));
    }
    
    return lines.join('\n');
  }
  
  /**
   * Destruir el monitor
   */
  async destroy() {
    logger.info('Destruyendo EventMonitor...');
    
    try {
      // Detener si está monitoreando
      if (this.isMonitoring) {
        await this.stop();
      }
      
      // Limpiar datos
      this.events = [];
      this.analysisBuffer = [];
      this.eventTypes.clear();
      this.eventSources.clear();
      this.patternAnalysis.detectedPatterns.clear();
      this.patternAnalysis.anomalies = [];
      this.patternAnalysis.trends.clear();
      this.patternAnalysis.correlations.clear();
      this.activeFilters.clear();
      
      this.isInitialized = false;
      
      // Remover listeners
      this.removeAllListeners();
      
      logger.info('EventMonitor destruido');
      
    } catch (error) {
      logger.error('Error destruyendo EventMonitor:', error);
      throw error;
    }
  }
}

export default EventMonitor;
/**
 * EventReplayer - Sistema de Reproducción de Eventos
 * 
 * Permite reproducir flujos de eventos pasados para análisis,
 * debugging, testing y simulación de escenarios.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from './logger.js';
import { getEventLogger } from './EventLogger.js';

const logger = createLogger('EVENT_REPLAYER');

export class EventReplayer {
  constructor(eventHub, options = {}) {
    this.eventHub = eventHub;
    this.eventLogger = getEventLogger();
    
    this.options = {
      // Configuración de reproducción
      defaultSpeed: options.defaultSpeed || 1.0, // 1x velocidad real
      maxSpeed: options.maxSpeed || 100.0,
      minSpeed: options.minSpeed || 0.1,
      
      // Configuración de filtros
      enableFiltering: options.enableFiltering !== false,
      defaultFilters: options.defaultFilters || {},
      
      // Configuración de simulación
      enableSimulation: options.enableSimulation !== false,
      simulationMode: options.simulationMode || 'replay', // replay, simulate, hybrid
      
      // Configuración de análisis
      enableAnalysis: options.enableAnalysis !== false,
      analysisDepth: options.analysisDepth || 'full', // basic, detailed, full
      
      // Configuración de debugging
      enableDebugging: options.enableDebugging || false,
      breakpoints: options.breakpoints || [],
      
      ...options
    };
    
    // Estado del replayer
    this.isActive = false;
    this.isPaused = false;
    this.currentSession = null;
    this.currentPosition = 0;
    this.totalEvents = 0;
    this.speed = this.options.defaultSpeed;
    
    // Control de reproducción
    this.playTimer = null;
    this.startTime = null;
    this.pausedTime = 0;
    
    // Eventos y filtros
    this.events = [];
    this.filteredEvents = [];
    this.activeFilters = { ...this.options.defaultFilters };
    
    // Análisis y métricas
    this.analysis = {
      patterns: new Map(),
      anomalies: [],
      performance: {},
      flows: new Map(),
      dependencies: new Map()
    };
    
    // Debugging
    this.breakpoints = new Set(this.options.breakpoints);
    this.debugState = {
      isDebugging: false,
      currentBreakpoint: null,
      stepMode: false,
      watchedEvents: new Set()
    };
    
    // Callbacks
    this.callbacks = {
      onStart: [],
      onPause: [],
      onResume: [],
      onStop: [],
      onEvent: [],
      onComplete: [],
      onError: [],
      onBreakpoint: []
    };
    
    // Estadísticas de sesión
    this.sessionStats = {
      startTime: null,
      endTime: null,
      duration: 0,
      eventsReplayed: 0,
      errorsEncountered: 0,
      breakpointsHit: 0,
      averageEventTime: 0
    };
  }
  
  /**
   * Cargar eventos para reproducir
   */
  async loadEvents(criteria = {}) {
    try {
      logger.info('Cargando eventos para reproducción...', criteria);
      
      const result = await this.eventLogger.searchEvents({
        limit: 10000,
        sortBy: 'timestamp',
        sortOrder: 'asc',
        ...criteria
      });
      
      this.events = result.events;
      this.totalEvents = this.events.length;
      
      // Aplicar filtros iniciales
      this.applyFilters();
      
      // Realizar análisis inicial
      if (this.options.enableAnalysis) {
        await this.analyzeEvents();
      }
      
      logger.info(`Eventos cargados: ${this.totalEvents}, filtrados: ${this.filteredEvents.length}`);
      
      return {
        totalEvents: this.totalEvents,
        filteredEvents: this.filteredEvents.length,
        timeRange: {
          start: this.events[0]?.timestamp,
          end: this.events[this.events.length - 1]?.timestamp
        }
      };
    } catch (error) {
      logger.error('Error cargando eventos:', error);
      throw error;
    }
  }
  
  /**
   * Cargar flujo de eventos por correlación
   */
  async loadEventFlow(correlationId) {
    try {
      const flow = await this.eventLogger.getEventFlow(correlationId);
      
      this.events = flow.events;
      this.totalEvents = this.events.length;
      this.currentSession = {
        type: 'flow',
        correlationId,
        metadata: flow
      };
      
      this.applyFilters();
      
      if (this.options.enableAnalysis) {
        await this.analyzeEventFlow(flow);
      }
      
      return flow;
    } catch (error) {
      logger.error('Error cargando flujo de eventos:', error);
      throw error;
    }
  }
  
  /**
   * Iniciar reproducción
   */
  async startReplay(options = {}) {
    try {
      if (this.isActive) {
        throw new Error('Ya hay una reproducción activa');
      }
      
      if (this.filteredEvents.length === 0) {
        throw new Error('No hay eventos para reproducir');
      }
      
      // Configurar sesión
      this.currentSession = {
        id: this.generateSessionId(),
        type: options.type || 'replay',
        startTime: new Date().toISOString(),
        options: { ...this.options, ...options }
      };
      
      // Configurar estado
      this.isActive = true;
      this.isPaused = false;
      this.currentPosition = options.startPosition || 0;
      this.speed = options.speed || this.options.defaultSpeed;
      this.startTime = Date.now();
      this.pausedTime = 0;
      
      // Resetear estadísticas
      this.resetSessionStats();
      
      // Ejecutar callbacks de inicio
      await this.executeCallbacks('onStart', {
        session: this.currentSession,
        totalEvents: this.filteredEvents.length
      });
      
      // Iniciar reproducción
      await this.scheduleNextEvent();
      
      logger.info(`Reproducción iniciada - Sesión: ${this.currentSession.id}, Eventos: ${this.filteredEvents.length}, Velocidad: ${this.speed}x`);
      
      return this.currentSession;
    } catch (error) {
      logger.error('Error iniciando reproducción:', error);
      await this.executeCallbacks('onError', { error });
      throw error;
    }
  }
  
  /**
   * Pausar reproducción
   */
  async pauseReplay() {
    if (!this.isActive || this.isPaused) return;
    
    this.isPaused = true;
    this.pausedTime = Date.now();
    
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    
    await this.executeCallbacks('onPause', {
      position: this.currentPosition,
      totalEvents: this.filteredEvents.length
    });
    
    logger.info('Reproducción pausada');
  }
  
  /**
   * Reanudar reproducción
   */
  async resumeReplay() {
    if (!this.isActive || !this.isPaused) return;
    
    this.isPaused = false;
    
    // Ajustar tiempo de inicio para compensar la pausa
    if (this.pausedTime) {
      const pauseDuration = Date.now() - this.pausedTime;
      this.startTime += pauseDuration;
      this.pausedTime = 0;
    }
    
    await this.executeCallbacks('onResume', {
      position: this.currentPosition,
      totalEvents: this.filteredEvents.length
    });
    
    await this.scheduleNextEvent();
    
    logger.info('Reproducción reanudada');
  }
  
  /**
   * Detener reproducción
   */
  async stopReplay() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.isPaused = false;
    
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    
    // Finalizar estadísticas de sesión
    this.finalizeSessionStats();
    
    await this.executeCallbacks('onStop', {
      session: this.currentSession,
      stats: this.sessionStats
    });
    
    logger.info(`Reproducción detenida - Eventos reproducidos: ${this.sessionStats.eventsReplayed}`);
    
    const finalStats = { ...this.sessionStats };
    this.currentSession = null;
    
    return finalStats;
  }
  
  /**
   * Avanzar al siguiente evento (modo paso a paso)
   */
  async stepNext() {
    if (!this.isActive) {
      throw new Error('No hay reproducción activa');
    }
    
    this.debugState.stepMode = true;
    await this.replayNextEvent();
    this.debugState.stepMode = false;
  }
  
  /**
   * Ir a una posición específica
   */
  async seekTo(position) {
    if (!this.isActive) {
      throw new Error('No hay reproducción activa');
    }
    
    if (position < 0 || position >= this.filteredEvents.length) {
      throw new Error('Posición fuera de rango');
    }
    
    this.currentPosition = position;
    
    logger.info(`Posición cambiada a: ${position}/${this.filteredEvents.length}`);
    
    if (!this.isPaused) {
      await this.scheduleNextEvent();
    }
  }
  
  /**
   * Cambiar velocidad de reproducción
   */
  setSpeed(speed) {
    if (speed < this.options.minSpeed || speed > this.options.maxSpeed) {
      throw new Error(`Velocidad fuera de rango: ${this.options.minSpeed}-${this.options.maxSpeed}`);
    }
    
    this.speed = speed;
    
    logger.info(`Velocidad cambiada a: ${speed}x`);
    
    // Reprogramar siguiente evento si está activo
    if (this.isActive && !this.isPaused) {
      if (this.playTimer) {
        clearTimeout(this.playTimer);
      }
      this.scheduleNextEvent();
    }
  }
  
  /**
   * Aplicar filtros a los eventos
   */
  applyFilters(filters = null) {
    if (filters) {
      this.activeFilters = { ...this.activeFilters, ...filters };
    }
    
    this.filteredEvents = this.events.filter(event => {
      // Filtro por tipo de evento
      if (this.activeFilters.eventTypes && this.activeFilters.eventTypes.length > 0) {
        if (!this.activeFilters.eventTypes.includes(event.eventType)) {
          return false;
        }
      }
      
      // Filtro por agente
      if (this.activeFilters.agentIds && this.activeFilters.agentIds.length > 0) {
        if (!this.activeFilters.agentIds.includes(event.agentId)) {
          return false;
        }
      }
      
      // Filtro por nivel
      if (this.activeFilters.levels && this.activeFilters.levels.length > 0) {
        if (!this.activeFilters.levels.includes(event.level)) {
          return false;
        }
      }
      
      // Filtro por rango de tiempo
      if (this.activeFilters.startTime || this.activeFilters.endTime) {
        const eventTime = new Date(event.timestamp);
        
        if (this.activeFilters.startTime && eventTime < new Date(this.activeFilters.startTime)) {
          return false;
        }
        
        if (this.activeFilters.endTime && eventTime > new Date(this.activeFilters.endTime)) {
          return false;
        }
      }
      
      return true;
    });
    
    logger.info(`Filtros aplicados: ${this.events.length} -> ${this.filteredEvents.length} eventos`);
  }
  
  /**
   * Programar siguiente evento
   */
  async scheduleNextEvent() {
    if (!this.isActive || this.isPaused || this.currentPosition >= this.filteredEvents.length) {
      if (this.currentPosition >= this.filteredEvents.length) {
        await this.completeReplay();
      }
      return;
    }
    
    const currentEvent = this.filteredEvents[this.currentPosition];
    const nextEvent = this.filteredEvents[this.currentPosition + 1];
    
    let delay = 0;
    
    if (nextEvent && this.speed > 0) {
      const currentTime = new Date(currentEvent.timestamp);
      const nextTime = new Date(nextEvent.timestamp);
      const realDelay = nextTime - currentTime;
      delay = Math.max(0, realDelay / this.speed);
    }
    
    // Verificar breakpoints
    if (this.shouldBreakAt(currentEvent)) {
      await this.handleBreakpoint(currentEvent);
      return;
    }
    
    this.playTimer = setTimeout(async() => {
      await this.replayNextEvent();
    }, delay);
  }
  
  /**
   * Reproducir siguiente evento
   */
  async replayNextEvent() {
    if (!this.isActive || this.currentPosition >= this.filteredEvents.length) {
      return;
    }
    
    const event = this.filteredEvents[this.currentPosition];
    
    try {
      // Reproducir evento
      await this.replayEvent(event);
      
      // Actualizar estadísticas
      this.sessionStats.eventsReplayed++;
      this.updateSessionStats(event);
      
      // Ejecutar callbacks
      await this.executeCallbacks('onEvent', {
        event,
        position: this.currentPosition,
        totalEvents: this.filteredEvents.length
      });
      
      // Avanzar posición
      this.currentPosition++;
      
      // Programar siguiente evento
      if (!this.debugState.stepMode) {
        await this.scheduleNextEvent();
      }
    } catch (error) {
      this.sessionStats.errorsEncountered++;
      logger.error('Error reproduciendo evento:', error);
      
      await this.executeCallbacks('onError', {
        error,
        event,
        position: this.currentPosition
      });
      
      // Continuar con el siguiente evento
      this.currentPosition++;
      if (!this.debugState.stepMode) {
        await this.scheduleNextEvent();
      }
    }
  }
  
  /**
   * Reproducir un evento específico
   */
  async replayEvent(event) {
    const startTime = Date.now();
    
    try {
      // Simular o reproducir según el modo
      switch (this.options.simulationMode) {
      case 'replay':
        await this.replayEventExact(event);
        break;
      case 'simulate':
        await this.simulateEvent(event);
        break;
      case 'hybrid':
        await this.hybridReplayEvent(event);
        break;
      default:
        await this.replayEventExact(event);
      }
      
      const duration = Date.now() - startTime;
      this.updatePerformanceStats(duration);
      
    } catch (error) {
      logger.error(`Error reproduciendo evento ${event.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Reproducir evento exacto
   */
  async replayEventExact(event) {
    // Emitir el evento tal como fue originalmente
    this.eventHub.emit(event.eventType, {
      ...event.data,
      _replay: true,
      _originalTimestamp: event.timestamp,
      _replaySession: this.currentSession?.id
    });
  }
  
  /**
   * Simular evento
   */
  async simulateEvent(event) {
    // Crear una versión simulada del evento
    const simulatedEvent = {
      ...event,
      _simulated: true,
      _originalId: event.id,
      _replaySession: this.currentSession?.id,
      timestamp: new Date().toISOString()
    };
    
    this.eventHub.emit(`simulated:${event.eventType}`, simulatedEvent);
  }
  
  /**
   * Reproducir evento híbrido
   */
  async hybridReplayEvent(event) {
    // Decidir si reproducir o simular basado en el tipo de evento
    const shouldSimulate = this.shouldSimulateEvent(event);
    
    if (shouldSimulate) {
      await this.simulateEvent(event);
    } else {
      await this.replayEventExact(event);
    }
  }
  
  /**
   * Determinar si un evento debe ser simulado
   */
  shouldSimulateEvent(event) {
    // Simular eventos que podrían tener efectos secundarios
    const simulateTypes = [
      'message:send',
      'contact:create',
      'contact:update',
      'automation:execute'
    ];
    
    return simulateTypes.some(type => event.eventType.includes(type));
  }
  
  /**
   * Verificar si debe parar en un breakpoint
   */
  shouldBreakAt(event) {
    if (!this.options.enableDebugging || this.breakpoints.size === 0) {
      return false;
    }
    
    // Verificar breakpoints por tipo de evento
    if (this.breakpoints.has(event.eventType)) {
      return true;
    }
    
    // Verificar breakpoints por agente
    if (this.breakpoints.has(`agent:${event.agentId}`)) {
      return true;
    }
    
    // Verificar breakpoints por posición
    if (this.breakpoints.has(`position:${this.currentPosition}`)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Manejar breakpoint
   */
  async handleBreakpoint(event) {
    this.debugState.isDebugging = true;
    this.debugState.currentBreakpoint = event;
    this.sessionStats.breakpointsHit++;
    
    await this.executeCallbacks('onBreakpoint', {
      event,
      position: this.currentPosition,
      breakpoint: this.getBreakpointInfo(event)
    });
    
    logger.info(`Breakpoint alcanzado en evento: ${event.eventType} (posición ${this.currentPosition})`);
    
    // Pausar automáticamente
    await this.pauseReplay();
  }
  
  /**
   * Obtener información del breakpoint
   */
  getBreakpointInfo(event) {
    const info = {
      type: 'unknown',
      value: null
    };
    
    if (this.breakpoints.has(event.eventType)) {
      info.type = 'eventType';
      info.value = event.eventType;
    } else if (this.breakpoints.has(`agent:${event.agentId}`)) {
      info.type = 'agent';
      info.value = event.agentId;
    } else if (this.breakpoints.has(`position:${this.currentPosition}`)) {
      info.type = 'position';
      info.value = this.currentPosition;
    }
    
    return info;
  }
  
  /**
   * Añadir breakpoint
   */
  addBreakpoint(breakpoint) {
    this.breakpoints.add(breakpoint);
    logger.info(`Breakpoint añadido: ${breakpoint}`);
  }
  
  /**
   * Remover breakpoint
   */
  removeBreakpoint(breakpoint) {
    this.breakpoints.delete(breakpoint);
    logger.info(`Breakpoint removido: ${breakpoint}`);
  }
  
  /**
   * Limpiar todos los breakpoints
   */
  clearBreakpoints() {
    this.breakpoints.clear();
    logger.info('Todos los breakpoints eliminados');
  }
  
  /**
   * Analizar eventos cargados
   */
  async analyzeEvents() {
    try {
      logger.info('Analizando eventos...');
      
      // Resetear análisis
      this.analysis = {
        patterns: new Map(),
        anomalies: [],
        performance: {},
        flows: new Map(),
        dependencies: new Map()
      };
      
      // Análisis de patrones
      await this.analyzePatterns();
      
      // Análisis de anomalías
      await this.analyzeAnomalies();
      
      // Análisis de rendimiento
      await this.analyzePerformance();
      
      // Análisis de flujos
      await this.analyzeFlows();
      
      // Análisis de dependencias
      await this.analyzeDependencies();
      
      logger.info('Análisis de eventos completado');
      
      return this.analysis;
    } catch (error) {
      logger.error('Error analizando eventos:', error);
      throw error;
    }
  }
  
  /**
   * Analizar patrones en los eventos
   */
  async analyzePatterns() {
    const patterns = new Map();
    
    // Patrones por tipo de evento
    const eventTypeCounts = new Map();
    
    // Patrones temporales
    const hourlyDistribution = new Array(24).fill(0);
    const dailyDistribution = new Map();
    
    // Patrones de secuencia
    const sequences = new Map();
    let lastEventType = null;
    
    for (const event of this.events) {
      const eventTime = new Date(event.timestamp);
      
      // Contar tipos de evento
      eventTypeCounts.set(event.eventType, (eventTypeCounts.get(event.eventType) || 0) + 1);
      
      // Distribución por hora
      hourlyDistribution[eventTime.getHours()]++;
      
      // Distribución por día
      const dayKey = eventTime.toISOString().split('T')[0];
      dailyDistribution.set(dayKey, (dailyDistribution.get(dayKey) || 0) + 1);
      
      // Secuencias de eventos
      if (lastEventType) {
        const sequenceKey = `${lastEventType} -> ${event.eventType}`;
        sequences.set(sequenceKey, (sequences.get(sequenceKey) || 0) + 1);
      }
      lastEventType = event.eventType;
    }
    
    patterns.set('eventTypes', eventTypeCounts);
    patterns.set('hourlyDistribution', hourlyDistribution);
    patterns.set('dailyDistribution', dailyDistribution);
    patterns.set('sequences', sequences);
    
    this.analysis.patterns = patterns;
  }
  
  /**
   * Analizar anomalías
   */
  async analyzeAnomalies() {
    const anomalies = [];
    
    // Detectar picos de eventos
    const eventCounts = this.groupEventsByTimeWindow(60000); // 1 minuto
    const avgEventsPerMinute = Array.from(eventCounts.values()).reduce((a, b) => a + b, 0) / eventCounts.size;
    const threshold = avgEventsPerMinute * 3; // 3x el promedio
    
    for (const [timestamp, count] of eventCounts) {
      if (count > threshold) {
        anomalies.push({
          type: 'event_spike',
          timestamp,
          value: count,
          threshold,
          severity: count > threshold * 2 ? 'high' : 'medium'
        });
      }
    }
    
    // Detectar gaps de tiempo
    for (let i = 1; i < this.events.length; i++) {
      const prevTime = new Date(this.events[i - 1].timestamp);
      const currTime = new Date(this.events[i].timestamp);
      const gap = currTime - prevTime;
      
      // Gap mayor a 10 minutos
      if (gap > 10 * 60 * 1000) {
        anomalies.push({
          type: 'time_gap',
          startTime: this.events[i - 1].timestamp,
          endTime: this.events[i].timestamp,
          duration: gap,
          severity: gap > 60 * 60 * 1000 ? 'high' : 'medium' // 1 hora
        });
      }
    }
    
    // Detectar eventos de error frecuentes
    const errorEvents = this.events.filter(e => e.level === 'error');
    const errorTypes = new Map();
    
    for (const event of errorEvents) {
      errorTypes.set(event.eventType, (errorTypes.get(event.eventType) || 0) + 1);
    }
    
    for (const [eventType, count] of errorTypes) {
      if (count > 5) { // Más de 5 errores del mismo tipo
        anomalies.push({
          type: 'frequent_errors',
          eventType,
          count,
          severity: count > 20 ? 'high' : 'medium'
        });
      }
    }
    
    this.analysis.anomalies = anomalies;
  }
  
  /**
   * Analizar rendimiento
   */
  async analyzePerformance() {
    const performance = {
      totalEvents: this.events.length,
      timeSpan: 0,
      eventsPerSecond: 0,
      eventsPerMinute: 0,
      eventsPerHour: 0,
      peakHour: null,
      quietHour: null
    };
    
    if (this.events.length > 0) {
      const firstEvent = new Date(this.events[0].timestamp);
      const lastEvent = new Date(this.events[this.events.length - 1].timestamp);
      
      performance.timeSpan = lastEvent - firstEvent;
      performance.eventsPerSecond = this.events.length / (performance.timeSpan / 1000);
      performance.eventsPerMinute = performance.eventsPerSecond * 60;
      performance.eventsPerHour = performance.eventsPerMinute * 60;
      
      // Encontrar hora pico y hora tranquila
      const hourlyDistribution = this.analysis.patterns.get('hourlyDistribution');
      if (hourlyDistribution) {
        let maxEvents = 0;
        let minEvents = Infinity;
        let peakHour = 0;
        let quietHour = 0;
        
        for (let hour = 0; hour < 24; hour++) {
          const count = hourlyDistribution[hour];
          if (count > maxEvents) {
            maxEvents = count;
            peakHour = hour;
          }
          if (count < minEvents) {
            minEvents = count;
            quietHour = hour;
          }
        }
        
        performance.peakHour = { hour: peakHour, events: maxEvents };
        performance.quietHour = { hour: quietHour, events: minEvents };
      }
    }
    
    this.analysis.performance = performance;
  }
  
  /**
   * Analizar flujos de eventos
   */
  async analyzeFlows() {
    const flows = new Map();
    
    // Agrupar eventos por correlationId
    const correlationGroups = new Map();
    
    for (const event of this.events) {
      if (event.correlationId) {
        if (!correlationGroups.has(event.correlationId)) {
          correlationGroups.set(event.correlationId, []);
        }
        correlationGroups.get(event.correlationId).push(event);
      }
    }
    
    // Analizar cada flujo
    for (const [correlationId, events] of correlationGroups) {
      const sortedEvents = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      const flow = {
        correlationId,
        eventCount: events.length,
        startTime: sortedEvents[0].timestamp,
        endTime: sortedEvents[sortedEvents.length - 1].timestamp,
        duration: new Date(sortedEvents[sortedEvents.length - 1].timestamp) - new Date(sortedEvents[0].timestamp),
        agents: new Set(events.map(e => e.agentId).filter(Boolean)),
        eventTypes: new Set(events.map(e => e.eventType)),
        events: sortedEvents
      };
      
      flow.agents = Array.from(flow.agents);
      flow.eventTypes = Array.from(flow.eventTypes);
      
      flows.set(correlationId, flow);
    }
    
    this.analysis.flows = flows;
  }
  
  /**
   * Analizar dependencias entre agentes
   */
  async analyzeDependencies() {
    const dependencies = new Map();
    
    // Analizar secuencias de eventos entre agentes
    for (let i = 1; i < this.events.length; i++) {
      const prevEvent = this.events[i - 1];
      const currEvent = this.events[i];
      
      if (prevEvent.agentId && currEvent.agentId && prevEvent.agentId !== currEvent.agentId) {
        const depKey = `${prevEvent.agentId} -> ${currEvent.agentId}`;
        
        if (!dependencies.has(depKey)) {
          dependencies.set(depKey, {
            from: prevEvent.agentId,
            to: currEvent.agentId,
            count: 0,
            avgDelay: 0,
            delays: []
          });
        }
        
        const dep = dependencies.get(depKey);
        dep.count++;
        
        const delay = new Date(currEvent.timestamp) - new Date(prevEvent.timestamp);
        dep.delays.push(delay);
        dep.avgDelay = dep.delays.reduce((a, b) => a + b, 0) / dep.delays.length;
      }
    }
    
    this.analysis.dependencies = dependencies;
  }
  
  /**
   * Analizar flujo específico
   */
  async analyzeEventFlow(flow) {
    // Análisis específico para un flujo de eventos
    const analysis = {
      flow,
      patterns: {},
      performance: {},
      anomalies: []
    };
    
    // Análisis de patrones en el flujo
    const eventTypeSequence = flow.events.map(e => e.eventType);
    const agentSequence = flow.events.map(e => e.agentId).filter(Boolean);
    
    analysis.patterns = {
      eventTypeSequence,
      agentSequence,
      uniqueEventTypes: flow.eventTypes.length,
      uniqueAgents: flow.agents.length
    };
    
    // Análisis de rendimiento del flujo
    analysis.performance = {
      totalDuration: flow.duration,
      eventCount: flow.eventCount,
      avgEventInterval: flow.duration / (flow.eventCount - 1),
      eventsPerSecond: flow.eventCount / (flow.duration / 1000)
    };
    
    // Detectar anomalías en el flujo
    const intervals = [];
    for (let i = 1; i < flow.events.length; i++) {
      const interval = new Date(flow.events[i].timestamp) - new Date(flow.events[i - 1].timestamp);
      intervals.push(interval);
    }
    
    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const threshold = avgInterval * 3;
      
      for (let i = 0; i < intervals.length; i++) {
        if (intervals[i] > threshold) {
          analysis.anomalies.push({
            type: 'long_interval',
            position: i + 1,
            interval: intervals[i],
            threshold,
            events: [flow.events[i], flow.events[i + 1]]
          });
        }
      }
    }
    
    return analysis;
  }
  
  /**
   * Agrupar eventos por ventana de tiempo
   */
  groupEventsByTimeWindow(windowMs) {
    const groups = new Map();
    
    for (const event of this.events) {
      const timestamp = new Date(event.timestamp);
      const windowStart = Math.floor(timestamp.getTime() / windowMs) * windowMs;
      
      groups.set(windowStart, (groups.get(windowStart) || 0) + 1);
    }
    
    return groups;
  }
  
  /**
   * Completar reproducción
   */
  async completeReplay() {
    this.finalizeSessionStats();
    
    await this.executeCallbacks('onComplete', {
      session: this.currentSession,
      stats: this.sessionStats
    });
    
    logger.info(`Reproducción completada - Eventos: ${this.sessionStats.eventsReplayed}, Duración: ${this.sessionStats.duration}ms`);
    
    this.isActive = false;
    this.currentSession = null;
  }
  
  /**
   * Resetear estadísticas de sesión
   */
  resetSessionStats() {
    this.sessionStats = {
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      eventsReplayed: 0,
      errorsEncountered: 0,
      breakpointsHit: 0,
      averageEventTime: 0,
      performanceStats: {
        totalProcessingTime: 0,
        minProcessingTime: Infinity,
        maxProcessingTime: 0
      }
    };
  }
  
  /**
   * Actualizar estadísticas de sesión
   */
  updateSessionStats(event) {
    // Actualizar tiempo promedio por evento
    const totalTime = Date.now() - this.startTime;
    this.sessionStats.averageEventTime = totalTime / this.sessionStats.eventsReplayed;
  }
  
  /**
   * Actualizar estadísticas de rendimiento
   */
  updatePerformanceStats(processingTime) {
    const stats = this.sessionStats.performanceStats;
    
    stats.totalProcessingTime += processingTime;
    stats.minProcessingTime = Math.min(stats.minProcessingTime, processingTime);
    stats.maxProcessingTime = Math.max(stats.maxProcessingTime, processingTime);
  }
  
  /**
   * Finalizar estadísticas de sesión
   */
  finalizeSessionStats() {
    this.sessionStats.endTime = new Date().toISOString();
    this.sessionStats.duration = Date.now() - this.startTime - this.pausedTime;
  }
  
  /**
   * Registrar callback
   */
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }
  
  /**
   * Desregistrar callback
   */
  off(event, callback) {
    if (this.callbacks[event]) {
      const index = this.callbacks[event].indexOf(callback);
      if (index > -1) {
        this.callbacks[event].splice(index, 1);
      }
    }
  }
  
  /**
   * Ejecutar callbacks
   */
  async executeCallbacks(event, data) {
    if (this.callbacks[event]) {
      for (const callback of this.callbacks[event]) {
        try {
          await callback(data);
        } catch (error) {
          logger.error(`Error ejecutando callback ${event}:`, error);
        }
      }
    }
  }
  
  /**
   * Generar ID de sesión
   */
  generateSessionId() {
    return `replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Obtener estado actual
   */
  getState() {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      currentPosition: this.currentPosition,
      totalEvents: this.filteredEvents.length,
      speed: this.speed,
      session: this.currentSession,
      stats: this.sessionStats,
      filters: this.activeFilters,
      breakpoints: Array.from(this.breakpoints),
      debugState: this.debugState
    };
  }
  
  /**
   * Obtener información de la sesión
   */
  getSessionInfo() {
    if (!this.currentSession) {
      return null;
    }
    
    return {
      ...this.currentSession,
      progress: {
        current: this.currentPosition,
        total: this.filteredEvents.length,
        percentage: (this.currentPosition / this.filteredEvents.length) * 100
      },
      stats: this.sessionStats
    };
  }
  
  /**
   * Exportar análisis
   */
  exportAnalysis(format = 'json') {
    const analysisData = {
      metadata: {
        totalEvents: this.events.length,
        filteredEvents: this.filteredEvents.length,
        analysisTime: new Date().toISOString(),
        filters: this.activeFilters
      },
      patterns: Object.fromEntries(this.analysis.patterns),
      anomalies: this.analysis.anomalies,
      performance: this.analysis.performance,
      flows: Object.fromEntries(this.analysis.flows),
      dependencies: Object.fromEntries(this.analysis.dependencies)
    };
    
    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(analysisData, null, 2);
    case 'csv':
      // Implementar exportación CSV si es necesario
      return this.analysisToCSV(analysisData);
    default:
      return analysisData;
    }
  }
  
  /**
   * Convertir análisis a CSV (implementación básica)
   */
  analysisToCSV(analysisData) {
    // Implementación simplificada
    return JSON.stringify(analysisData, null, 2);
  }
  
  /**
   * Destruir el replayer
   */
  destroy() {
    if (this.isActive) {
      this.stopReplay();
    }
    
    this.events = [];
    this.filteredEvents = [];
    this.analysis = { patterns: new Map(), anomalies: [], performance: {}, flows: new Map(), dependencies: new Map() };
    this.callbacks = { onStart: [], onPause: [], onResume: [], onStop: [], onEvent: [], onComplete: [], onError: [], onBreakpoint: [] };
    
    logger.info('EventReplayer destruido');
  }
}

export default EventReplayer;
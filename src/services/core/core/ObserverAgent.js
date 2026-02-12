import { createLogger } from '../core/evolutive-logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * ObserverAgent - Agente observador inteligente
 * Analiza todos los eventos del sistema para detectar:
 * - Patrones de comportamiento
 * - Anomalías y problemas
 * - Oportunidades de optimización
 * - Tendencias y predicciones
 */
class ObserverAgent {
  constructor(eventHub) {
    this.eventHub = eventHub;
    this.logger = createLogger('OBSERVER_AGENT');
    this.agentId = uuidv4();
        
    // Estado del agente
    this.isActive = false;
    this.observations = new Map();
    this.patterns = new Map();
    this.anomalies = [];
    this.metrics = {
      eventsObserved: 0,
      patternsDetected: 0,
      anomaliesFound: 0,
      suggestionsGenerated: 0
    };
        
    // Configuración de análisis
    this.config = {
      patternDetectionThreshold: 5, // Mínimo de ocurrencias para considerar patrón
      anomalyDetectionWindow: 300000, // 5 minutos en ms
      analysisInterval: 30000, // Análisis cada 30 segundos
      maxObservations: 1000,
      learningRate: 0.1
    };
        
    // Ventanas de tiempo para análisis
    this.timeWindows = {
      short: 60000,   // 1 minuto
      medium: 300000, // 5 minutos
      long: 1800000   // 30 minutos
    };
        
    this.logger.info('🔍 ObserverAgent inicializado');
  }

  /**
     * Activar el agente observador
     */
  activate() {
    if (this.isActive) {
      this.logger.warn('ObserverAgent ya está activo');
      return;
    }

    this.isActive = true;
        
    // Registrar el agente en el EventHub
    this.eventHub.registerAgent('ObserverAgent', this, [
      'pattern_detection',
      'anomaly_detection',
      'system_analysis',
      'optimization_suggestions'
    ]);

    // Escuchar TODOS los eventos usando wildcard
    this.eventHub.onEvolutive('*', (event) => {
      this.observeEvent(event);
    }, { agentName: 'ObserverAgent' });

    // Iniciar análisis periódico
    this.startPeriodicAnalysis();

    // Emitir evento de activación
    this.eventHub.emitEvolutive('system.observer_activated', {
      agentId: this.agentId,
      timestamp: new Date().toISOString()
    }, { source: 'ObserverAgent', priority: 'medium' });

    this.logger.info('👁️ ObserverAgent activado - Observando todos los eventos del sistema');
  }

  /**
     * Observar y analizar un evento
     */
  observeEvent(event) {
    if (!this.isActive) return;

    try {
      this.metrics.eventsObserved++;
            
      // Registrar observación
      const observation = {
        eventId: event.id,
        eventType: event.type,
        timestamp: new Date(event.metadata.timestamp),
        source: event.metadata.source,
        priority: event.metadata.priority,
        payload: event.payload,
        observedAt: new Date()
      };

      this.recordObservation(observation);
            
      // Análisis inmediato
      this.analyzeEventImmediate(observation);
            
      // Detectar anomalías en tiempo real
      this.detectAnomalies(observation);

    } catch (error) {
      this.logger.error('Error observando evento:', error, { eventId: event.id });
    }
  }

  /**
     * Registrar observación
     */
  recordObservation(observation) {
    const key = `${observation.eventType}_${observation.source}`;
        
    if (!this.observations.has(key)) {
      this.observations.set(key, []);
    }
        
    const observations = this.observations.get(key);
    observations.push(observation);
        
    // Mantener límite de observaciones
    if (observations.length > this.config.maxObservations) {
      observations.shift();
    }
  }

  /**
     * Análisis inmediato del evento
     */
  analyzeEventImmediate(observation) {
    // Detectar eventos de alta frecuencia
    this.detectHighFrequencyEvents(observation);
        
    // Detectar cadenas de eventos
    this.detectEventChains(observation);
        
    // Detectar eventos de error
    this.analyzeErrorEvents(observation);
  }

  /**
     * Detectar eventos de alta frecuencia
     */
  detectHighFrequencyEvents(observation) {
    const now = observation.observedAt.getTime();
    const windowStart = now - this.timeWindows.short;
        
    const recentEvents = Array.from(this.observations.values())
      .flat()
      .filter(obs => 
        obs.eventType === observation.eventType &&
                obs.observedAt.getTime() > windowStart
      );
        
    if (recentEvents.length > 20) { // Más de 20 eventos del mismo tipo en 1 minuto
      this.generateSuggestion('high_frequency_detected', {
        eventType: observation.eventType,
        frequency: recentEvents.length,
        timeWindow: 'short',
        suggestion: 'Consider implementing rate limiting or batching'
      });
    }
  }

  /**
     * Detectar cadenas de eventos
     */
  detectEventChains(observation) {
    const recentObservations = Array.from(this.observations.values())
      .flat()
      .filter(obs => obs.observedAt.getTime() > (observation.observedAt.getTime() - 10000))
      .sort((a, b) => a.observedAt - b.observedAt);
        
    if (recentObservations.length >= 3) {
      const chain = recentObservations.slice(-3).map(obs => obs.eventType).join(' -> ');
            
      if (!this.patterns.has(chain)) {
        this.patterns.set(chain, { count: 0, confidence: 0, lastSeen: null });
      }
            
      const pattern = this.patterns.get(chain);
      pattern.count++;
      pattern.lastSeen = observation.observedAt;
      pattern.confidence = Math.min(pattern.count / this.config.patternDetectionThreshold, 1);
            
      if (pattern.count === this.config.patternDetectionThreshold) {
        this.metrics.patternsDetected++;
        this.generateSuggestion('pattern_detected', {
          pattern: chain,
          confidence: pattern.confidence,
          occurrences: pattern.count,
          suggestion: 'Consider creating a dedicated workflow for this pattern'
        });
      }
    }
  }

  /**
     * Analizar eventos de error
     */
  analyzeErrorEvents(observation) {
    if (observation.eventType.includes('error') || observation.priority === 'high') {
      const errorPattern = {
        type: observation.eventType,
        source: observation.source,
        timestamp: observation.observedAt,
        payload: observation.payload
      };
            
      // Buscar errores similares recientes
      const recentErrors = this.anomalies
        .filter(anomaly => 
          anomaly.type === 'error' &&
                    anomaly.pattern.type === observation.eventType &&
                    (observation.observedAt.getTime() - new Date(anomaly.detectedAt).getTime()) < this.timeWindows.medium
        );
            
      if (recentErrors.length >= 3) {
        this.generateSuggestion('error_pattern_detected', {
          errorType: observation.eventType,
          source: observation.source,
          frequency: recentErrors.length,
          timeWindow: 'medium',
          suggestion: 'Recurring error detected - investigate root cause'
        });
      }
    }
  }

  /**
     * Detectar anomalías
     */
  detectAnomalies(observation) {
    // Detectar tiempos de respuesta anómalos
    this.detectResponseTimeAnomalies(observation);
        
    // Detectar volúmenes anómalos
    this.detectVolumeAnomalies(observation);
        
    // Detectar patrones temporales anómalos
    this.detectTemporalAnomalies(observation);
  }

  /**
     * Detectar anomalías en tiempos de respuesta
     */
  detectResponseTimeAnomalies(observation) {
    if (observation.payload && observation.payload.processingTime) {
      const processingTime = observation.payload.processingTime;
      const key = observation.eventType;
            
      // Obtener tiempos históricos
      const historicalTimes = Array.from(this.observations.values())
        .flat()
        .filter(obs => 
          obs.eventType === key &&
                    obs.payload &&
                    obs.payload.processingTime
        )
        .map(obs => obs.payload.processingTime);
            
      if (historicalTimes.length >= 10) {
        const average = historicalTimes.reduce((a, b) => a + b, 0) / historicalTimes.length;
        const threshold = average * 3; // 3x el promedio
                
        if (processingTime > threshold) {
          this.recordAnomaly('response_time', {
            eventType: observation.eventType,
            processingTime,
            averageTime: average,
            threshold,
            severity: processingTime > threshold * 2 ? 'high' : 'medium'
          });
        }
      }
    }
  }

  /**
     * Detectar anomalías en volumen
     */
  detectVolumeAnomalies(observation) {
    const now = observation.observedAt.getTime();
    const windowStart = now - this.timeWindows.medium;
        
    const recentEvents = Array.from(this.observations.values())
      .flat()
      .filter(obs => 
        obs.eventType === observation.eventType &&
                obs.observedAt.getTime() > windowStart
      );
        
    // Calcular volumen promedio histórico
    const historicalVolumes = this.calculateHistoricalVolumes(observation.eventType);
        
    if (historicalVolumes.length >= 5) {
      const averageVolume = historicalVolumes.reduce((a, b) => a + b, 0) / historicalVolumes.length;
      const currentVolume = recentEvents.length;
            
      if (currentVolume > averageVolume * 2 || currentVolume < averageVolume * 0.3) {
        this.recordAnomaly('volume', {
          eventType: observation.eventType,
          currentVolume,
          averageVolume,
          deviation: Math.abs(currentVolume - averageVolume) / averageVolume,
          type: currentVolume > averageVolume ? 'spike' : 'drop'
        });
      }
    }
  }

  /**
     * Detectar anomalías temporales
     */
  detectTemporalAnomalies(observation) {
    const hour = observation.observedAt.getHours();
    const dayOfWeek = observation.observedAt.getDay();
        
    // Analizar patrones temporales históricos
    const historicalPattern = this.analyzeTemporalPatterns(observation.eventType, hour, dayOfWeek);
        
    if (historicalPattern && historicalPattern.isUnusual) {
      this.recordAnomaly('temporal', {
        eventType: observation.eventType,
        hour,
        dayOfWeek,
        expectedFrequency: historicalPattern.expectedFrequency,
        actualFrequency: historicalPattern.actualFrequency,
        reason: 'Event occurring at unusual time'
      });
    }
  }

  /**
     * Registrar anomalía
     */
  recordAnomaly(type, details) {
    const anomaly = {
      id: uuidv4(),
      type,
      details,
      detectedAt: new Date().toISOString(),
      severity: details.severity || 'medium'
    };
        
    this.anomalies.push(anomaly);
    this.metrics.anomaliesFound++;
        
    // Mantener límite de anomalías
    if (this.anomalies.length > 100) {
      this.anomalies.shift();
    }
        
    // Emitir evento de anomalía
    this.eventHub.emitEvolutive('system.anomaly_detected', {
      anomaly,
      agentId: this.agentId
    }, { source: 'ObserverAgent', priority: anomaly.severity });
        
    this.logger.warn(`🚨 Anomalía detectada: ${type}`, details);
  }

  /**
     * Generar sugerencia
     */
  generateSuggestion(type, details) {
    const suggestion = {
      id: uuidv4(),
      type,
      details,
      generatedAt: new Date().toISOString(),
      agentId: this.agentId,
      confidence: details.confidence || 0.8
    };
        
    this.metrics.suggestionsGenerated++;
        
    // Emitir sugerencia
    this.eventHub.emitEvolutive('ai.suggestion_generated', {
      suggestion,
      agentId: this.agentId
    }, { source: 'ObserverAgent', priority: 'low' });
        
    this.logger.info(`💡 Sugerencia generada: ${type}`, details);
  }

  /**
     * Análisis periódico
     */
  startPeriodicAnalysis() {
    setInterval(() => {
      if (this.isActive) {
        this.performPeriodicAnalysis();
      }
    }, this.config.analysisInterval);
  }

  /**
     * Realizar análisis periódico
     */
  performPeriodicAnalysis() {
    try {
      // Análisis de tendencias
      this.analyzeTrends();
            
      // Análisis de eficiencia del sistema
      this.analyzeSystemEfficiency();
            
      // Limpieza de datos antiguos
      this.cleanupOldData();
            
      this.logger.debug('📊 Análisis periódico completado');
    } catch (error) {
      this.logger.error('Error en análisis periódico:', error);
    }
  }

  /**
     * Analizar tendencias
     */
  analyzeTrends() {
    const now = new Date();
    const trends = new Map();
        
    // Analizar tendencias por tipo de evento
    for (const [key, observations] of this.observations) {
      const recentObs = observations.filter(obs => 
        (now.getTime() - obs.observedAt.getTime()) < this.timeWindows.long
      );
            
      if (recentObs.length >= 5) {
        const trend = this.calculateTrend(recentObs);
        trends.set(key, trend);
                
        if (Math.abs(trend.slope) > 0.1) {
          this.generateSuggestion('trend_detected', {
            eventPattern: key,
            trend: trend.slope > 0 ? 'increasing' : 'decreasing',
            slope: trend.slope,
            confidence: trend.confidence,
            suggestion: `Event frequency is ${trend.slope > 0 ? 'increasing' : 'decreasing'} - monitor for capacity planning`
          });
        }
      }
    }
  }

  /**
     * Analizar eficiencia del sistema
     */
  analyzeSystemEfficiency() {
    const systemMetrics = this.eventHub.getSystemStats();
        
    // Analizar uso de memoria
    if (systemMetrics.memoryUsage) {
      const memoryUsage = systemMetrics.memoryUsage.heapUsed / systemMetrics.memoryUsage.heapTotal;
            
      if (memoryUsage > 0.8) {
        this.generateSuggestion('high_memory_usage', {
          memoryUsage: memoryUsage * 100,
          heapUsed: systemMetrics.memoryUsage.heapUsed,
          heapTotal: systemMetrics.memoryUsage.heapTotal,
          suggestion: 'High memory usage detected - consider optimization'
        });
      }
    }
        
    // Analizar número de agentes activos
    if (systemMetrics.agents && systemMetrics.agents.length > 20) {
      this.generateSuggestion('high_agent_count', {
        agentCount: systemMetrics.agents.length,
        suggestion: 'High number of active agents - monitor performance impact'
      });
    }
  }

  /**
     * Calcular tendencia
     */
  calculateTrend(observations) {
    const n = observations.length;
    const x = observations.map((_, i) => i);
    const y = observations.map((_, i) => i); // Simplificado: usar índice como valor
        
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const confidence = Math.min(n / 20, 1); // Más observaciones = mayor confianza
        
    return { slope, confidence };
  }

  /**
     * Calcular volúmenes históricos
     */
  calculateHistoricalVolumes(eventType) {
    const now = new Date();
    const volumes = [];
        
    // Calcular volúmenes por ventana de tiempo histórica
    for (let i = 1; i <= 10; i++) {
      const windowEnd = now.getTime() - (i * this.timeWindows.medium);
      const windowStart = windowEnd - this.timeWindows.medium;
            
      const eventsInWindow = Array.from(this.observations.values())
        .flat()
        .filter(obs => 
          obs.eventType === eventType &&
                    obs.observedAt.getTime() >= windowStart &&
                    obs.observedAt.getTime() < windowEnd
        ).length;
            
      volumes.push(eventsInWindow);
    }
        
    return volumes;
  }

  /**
     * Analizar patrones temporales
     */
  analyzeTemporalPatterns(eventType, hour, dayOfWeek) {
    const historicalEvents = Array.from(this.observations.values())
      .flat()
      .filter(obs => obs.eventType === eventType);
        
    if (historicalEvents.length < 50) return null;
        
    const sameTimeEvents = historicalEvents.filter(obs => 
      obs.observedAt.getHours() === hour &&
            obs.observedAt.getDay() === dayOfWeek
    );
        
    const expectedFrequency = sameTimeEvents.length / (historicalEvents.length / 7); // Promedio por día de la semana
    const recentEvents = historicalEvents.filter(obs => 
      obs.observedAt.getTime() > (Date.now() - this.timeWindows.medium)
    );
        
    const actualFrequency = recentEvents.filter(obs => 
      obs.observedAt.getHours() === hour &&
            obs.observedAt.getDay() === dayOfWeek
    ).length;
        
    return {
      expectedFrequency,
      actualFrequency,
      isUnusual: Math.abs(actualFrequency - expectedFrequency) > expectedFrequency * 2
    };
  }

  /**
     * Limpiar datos antiguos
     */
  cleanupOldData() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 horas
        
    // Limpiar observaciones antiguas
    for (const [key, observations] of this.observations) {
      const filtered = observations.filter(obs => obs.observedAt.getTime() > cutoffTime);
      this.observations.set(key, filtered);
    }
        
    // Limpiar anomalías antiguas
    this.anomalies = this.anomalies.filter(anomaly => 
      new Date(anomaly.detectedAt).getTime() > cutoffTime
    );
  }

  /**
     * Obtener estadísticas del agente
     */
  getStats() {
    return {
      agentId: this.agentId,
      isActive: this.isActive,
      metrics: this.metrics,
      observationsCount: Array.from(this.observations.values()).reduce((sum, obs) => sum + obs.length, 0),
      patternsCount: this.patterns.size,
      anomaliesCount: this.anomalies.length,
      config: this.config
    };
  }

  /**
     * Desactivar el agente
     */
  deactivate() {
    this.isActive = false;
        
    this.eventHub.emitEvolutive('system.observer_deactivated', {
      agentId: this.agentId,
      finalStats: this.getStats(),
      timestamp: new Date().toISOString()
    }, { source: 'ObserverAgent', priority: 'medium' });
        
    this.logger.info('👁️ ObserverAgent desactivado');
  }
}

export default ObserverAgent;
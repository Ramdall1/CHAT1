import fs from 'fs/promises';
import path from 'path';
import EventTypes from './EventTypes.js';
import { createLogger } from './logger.js';

/**
 * Motor de flujo inteligente que analiza patrones de eventos y optimiza automáticamente
 * el comportamiento del sistema basándose en el tráfico observado.
 */
class FlowManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.logger = createLogger('FLOW_MANAGER');
    this.eventPatterns = new Map();
    this.eventFrequency = new Map();
    this.eventResponseTimes = new Map();
    this.eventSequences = [];
    this.optimizationRules = new Map();
    this.bottleneckThresholds = {
      responseTime: 5000, // 5 segundos
      frequency: 100, // eventos por minuto
      errorRate: 0.1 // 10% de errores
    };
    this.statsFilePath = path.join(process.cwd(), 'logs', 'events_stats.json');
    this.isActive = false;
    this.analysisInterval = null;
    this.eventBuffer = [];
    this.maxBufferSize = 1000;
        
    this.setupEventListeners();
  }

  /**
     * Configura los listeners para observar todos los eventos del sistema
     */
  setupEventListeners() {
    // Escuchar todos los tipos de eventos definidos
    Object.values(EventTypes).forEach(category => {
      if (typeof category === 'object') {
        Object.values(category).forEach(eventType => {
          this.eventBus.on(eventType, (data) => {
            this.analyzeEvent(eventType, data);
          });
        });
      }
    });

    // Escuchar eventos de sistema específicos para optimización
    this.eventBus.on(EventTypes.SYSTEM.ERROR, (data) => {
      this.handleSystemError(data);
    });

    this.eventBus.on(EventTypes.SYSTEM.PERFORMANCE_ALERT, (data) => {
      this.handlePerformanceAlert(data);
    });
  }

  /**
     * Inicia el motor de flujo inteligente
     */
  async start() {
    if (this.isActive) return;
        
    this.isActive = true;
    logger.info('🧠 FlowManager: Motor de flujo inteligente iniciado');
        
    // Cargar estadísticas previas si existen
    await this.loadPreviousStats();
        
    // Iniciar análisis periódico cada 30 segundos
    this.analysisInterval = setInterval(() => {
      this.performPeriodicAnalysis();
    }, 30000);

    // Emitir evento de inicio
    this.eventBus.emit(EventTypes.SYSTEM.FLOW_MANAGER_STARTED, {
      timestamp: new Date().toISOString(),
      status: 'active'
    });
  }

  /**
     * Detiene el motor de flujo inteligente
     */
  async stop() {
    if (!this.isActive) return;
        
    this.isActive = false;
        
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
        
    // Guardar estadísticas finales
    await this.saveStats();
        
    logger.info('🧠 FlowManager: Motor de flujo inteligente detenido');
        
    this.eventBus.emit(EventTypes.SYSTEM.FLOW_MANAGER_STOPPED, {
      timestamp: new Date().toISOString(),
      finalStats: this.getAnalyticsSummary()
    });
  }

  /**
     * Analiza un evento individual y actualiza las métricas
     */
  analyzeEvent(eventType, data) {
    if (!this.isActive) return;

    const timestamp = Date.now();
    const eventInfo = {
      type: eventType,
      timestamp,
      data,
      processingTime: data.processingTime || 0
    };

    // Agregar al buffer de eventos
    this.eventBuffer.push(eventInfo);
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift(); // Remover el más antiguo
    }

    // Actualizar frecuencia de eventos
    this.updateEventFrequency(eventType, timestamp);
        
    // Actualizar tiempos de respuesta
    this.updateResponseTimes(eventType, eventInfo.processingTime);
        
    // Detectar patrones de secuencia
    this.updateEventSequences(eventType, timestamp);
        
    // Detectar eventos repetitivos o inútiles
    this.detectRedundantEvents(eventType, data);
        
    // Verificar cuellos de botella en tiempo real
    this.checkBottlenecks(eventType, eventInfo);
  }

  /**
     * Actualiza la frecuencia de eventos por tipo
     */
  updateEventFrequency(eventType, timestamp) {
    if (!this.eventFrequency.has(eventType)) {
      this.eventFrequency.set(eventType, {
        count: 0,
        lastMinute: [],
        totalCount: 0
      });
    }

    const freq = this.eventFrequency.get(eventType);
    freq.count++;
    freq.totalCount++;
    freq.lastMinute.push(timestamp);

    // Mantener solo eventos del último minuto
    const oneMinuteAgo = timestamp - 60000;
    freq.lastMinute = freq.lastMinute.filter(t => t > oneMinuteAgo);
  }

  /**
     * Actualiza los tiempos de respuesta promedio
     */
  updateResponseTimes(eventType, processingTime) {
    if (!this.eventResponseTimes.has(eventType)) {
      this.eventResponseTimes.set(eventType, {
        total: 0,
        count: 0,
        average: 0,
        min: Infinity,
        max: 0
      });
    }

    const times = this.eventResponseTimes.get(eventType);
    times.total += processingTime;
    times.count++;
    times.average = times.total / times.count;
    times.min = Math.min(times.min, processingTime);
    times.max = Math.max(times.max, processingTime);
  }

  /**
     * Actualiza las secuencias de eventos para detectar patrones
     */
  updateEventSequences(eventType, timestamp) {
    this.eventSequences.push({ type: eventType, timestamp });
        
    // Mantener solo las últimas 100 secuencias
    if (this.eventSequences.length > 100) {
      this.eventSequences.shift();
    }
  }

  /**
     * Detecta eventos redundantes o inútiles que pueden fusionarse
     */
  detectRedundantEvents(eventType, data) {
    const recentEvents = this.eventBuffer
      .filter(e => e.type === eventType && Date.now() - e.timestamp < 5000)
      .slice(-5); // Últimos 5 eventos del mismo tipo

    if (recentEvents.length >= 3) {
      // Verificar si los datos son similares (eventos redundantes)
      const similarEvents = recentEvents.filter(e => 
        JSON.stringify(e.data) === JSON.stringify(data)
      );

      if (similarEvents.length >= 2) {
        this.suggestEventFusion(eventType, similarEvents.length);
      }
    }
  }

  /**
     * Verifica cuellos de botella en tiempo real
     */
  checkBottlenecks(eventType, eventInfo) {
    const freq = this.eventFrequency.get(eventType);
    const times = this.eventResponseTimes.get(eventType);

    let bottleneckDetected = false;
    const issues = [];

    // Verificar tiempo de respuesta
    if (times && times.average > this.bottleneckThresholds.responseTime) {
      bottleneckDetected = true;
      issues.push(`Tiempo de respuesta alto: ${times.average}ms`);
    }

    // Verificar frecuencia excesiva
    if (freq && freq.lastMinute.length > this.bottleneckThresholds.frequency) {
      bottleneckDetected = true;
      issues.push(`Frecuencia excesiva: ${freq.lastMinute.length} eventos/min`);
    }

    if (bottleneckDetected) {
      this.emitBottleneckAlert(eventType, issues);
    }
  }

  /**
     * Emite una alerta de cuello de botella
     */
  emitBottleneckAlert(eventType, issues) {
    const alertData = {
      eventType,
      issues,
      timestamp: new Date().toISOString(),
      suggestion: this.generateOptimizationSuggestion(eventType, issues)
    };

    this.eventBus.emit(EventTypes.SYSTEM.OPTIMIZATION_SUGGESTION, alertData);
        
    logger.warn(`⚠️ FlowManager: Cuello de botella detectado en ${eventType}:`, issues);
  }

  /**
     * Sugiere fusión de eventos redundantes
     */
  suggestEventFusion(eventType, count) {
    const suggestion = {
      type: 'event_fusion',
      eventType,
      redundantCount: count,
      recommendation: `Considerar fusionar ${count} eventos ${eventType} redundantes`,
      timestamp: new Date().toISOString()
    };

    this.eventBus.emit(EventTypes.SYSTEM.OPTIMIZATION_SUGGESTION, suggestion);
        
    logger.info(`🔄 FlowManager: Sugerencia de fusión para ${eventType} (${count} eventos redundantes)`);
  }

  /**
     * Genera sugerencias de optimización basadas en los problemas detectados
     */
  generateOptimizationSuggestion(eventType, issues) {
    const suggestions = [];

    issues.forEach(issue => {
      if (issue.includes('Tiempo de respuesta alto')) {
        suggestions.push('Considerar procesamiento asíncrono o en lotes');
        suggestions.push('Revisar la lógica de procesamiento para optimizaciones');
      }
            
      if (issue.includes('Frecuencia excesiva')) {
        suggestions.push('Implementar debouncing o throttling');
        suggestions.push('Agrupar eventos similares en batches');
      }
    });

    return suggestions;
  }

  /**
     * Realiza análisis periódico del sistema
     */
  async performPeriodicAnalysis() {
    if (!this.isActive) return;

    logger.info('🔍 FlowManager: Realizando análisis periódico...');

    // Analizar patrones de secuencia
    this.analyzeEventSequencePatterns();
        
    // Detectar eventos críticos vs secundarios
    this.prioritizeEventTypes();
        
    // Guardar estadísticas actualizadas
    await this.saveStats();
        
    // Emitir resumen de análisis
    this.eventBus.emit(EventTypes.SYSTEM.FLOW_ANALYSIS_COMPLETE, {
      timestamp: new Date().toISOString(),
      summary: this.getAnalyticsSummary()
    });
  }

  /**
     * Analiza patrones en las secuencias de eventos
     */
  analyzeEventSequencePatterns() {
    if (this.eventSequences.length < 10) return;

    const patterns = new Map();
        
    // Buscar secuencias de 3 eventos
    for (let i = 0; i < this.eventSequences.length - 2; i++) {
      const sequence = [
        this.eventSequences[i].type,
        this.eventSequences[i + 1].type,
        this.eventSequences[i + 2].type
      ].join(' → ');

      patterns.set(sequence, (patterns.get(sequence) || 0) + 1);
    }

    // Identificar patrones frecuentes
    const frequentPatterns = Array.from(patterns.entries())
      .filter(([pattern, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]);

    if (frequentPatterns.length > 0) {
      logger.info('📊 FlowManager: Patrones de secuencia detectados:', frequentPatterns.slice(0, 5));
            
      this.eventBus.emit(EventTypes.SYSTEM.PATTERN_DETECTED, {
        patterns: frequentPatterns.slice(0, 10),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Prioriza tipos de eventos basándose en criticidad
     */
  prioritizeEventTypes() {
    const criticalEvents = [
      'payment_approved', 'payment_declined', 'error_critical',
      'system_failure', 'security_breach'
    ];
        
    const secondaryEvents = [
      'ai_message_sent', 'user_typing', 'ui_interaction',
      'analytics_tracked', 'log_written'
    ];

    // Analizar si eventos críticos están siendo procesados rápidamente
    criticalEvents.forEach(eventType => {
      const times = this.eventResponseTimes.get(eventType);
      if (times && times.average > 1000) { // Más de 1 segundo
        this.eventBus.emit(EventTypes.SYSTEM.CRITICAL_EVENT_SLOW, {
          eventType,
          averageTime: times.average,
          recommendation: 'Aumentar prioridad de procesamiento',
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
     * Maneja errores del sistema
     */
  handleSystemError(errorData) {
    this.logger.error('🚨 FlowManager: Error del sistema detectado:', errorData);
        
    // Incrementar contador de errores para el tipo de evento
    const eventType = errorData.eventType || 'unknown';
    if (!this.eventPatterns.has(eventType)) {
      this.eventPatterns.set(eventType, { errors: 0, total: 0 });
    }
        
    const pattern = this.eventPatterns.get(eventType);
    pattern.errors++;
        
    // Verificar tasa de errores
    const errorRate = pattern.errors / (pattern.total || 1);
    if (errorRate > this.bottleneckThresholds.errorRate) {
      this.eventBus.emit(EventTypes.SYSTEM.HIGH_ERROR_RATE, {
        eventType,
        errorRate,
        totalErrors: pattern.errors,
        totalEvents: pattern.total,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
     * Maneja alertas de rendimiento
     */
  handlePerformanceAlert(alertData) {
    logger.warn('⚡ FlowManager: Alerta de rendimiento:', alertData);
        
    // Analizar y sugerir optimizaciones específicas
    const suggestions = this.generatePerformanceOptimizations(alertData);
        
    this.eventBus.emit(EventTypes.SYSTEM.OPTIMIZATION_SUGGESTION, {
      type: 'performance',
      alert: alertData,
      suggestions,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Genera optimizaciones específicas de rendimiento
     */
  generatePerformanceOptimizations(alertData) {
    const optimizations = [];
        
    if (alertData.memoryUsage > 80) {
      optimizations.push('Implementar limpieza de memoria automática');
      optimizations.push('Reducir tamaño del buffer de eventos');
    }
        
    if (alertData.cpuUsage > 70) {
      optimizations.push('Distribuir procesamiento en workers');
      optimizations.push('Implementar procesamiento en lotes');
    }
        
    if (alertData.queueSize > 1000) {
      optimizations.push('Aumentar número de workers de procesamiento');
      optimizations.push('Implementar priorización dinámica de colas');
    }
        
    return optimizations;
  }

  /**
     * Carga estadísticas previas del archivo
     */
  async loadPreviousStats() {
    try {
      const data = await fs.readFile(this.statsFilePath, 'utf8');
      const stats = JSON.parse(data);
            
      // Restaurar datos previos
      if (stats.eventFrequency) {
        this.eventFrequency = new Map(Object.entries(stats.eventFrequency));
      }
            
      if (stats.eventResponseTimes) {
        this.eventResponseTimes = new Map(Object.entries(stats.eventResponseTimes));
      }
            
      logger.info('📊 FlowManager: Estadísticas previas cargadas');
    } catch (error) {
      logger.info('📊 FlowManager: No se encontraron estadísticas previas, iniciando desde cero');
    }
  }

  /**
     * Guarda las estadísticas actuales en archivo
     */
  async saveStats() {
    try {
      // Asegurar que el directorio logs existe
      const logsDir = path.dirname(this.statsFilePath);
      await fs.mkdir(logsDir, { recursive: true });

      const stats = {
        timestamp: new Date().toISOString(),
        eventFrequency: Object.fromEntries(this.eventFrequency),
        eventResponseTimes: Object.fromEntries(this.eventResponseTimes),
        summary: this.getAnalyticsSummary()
      };

      await fs.writeFile(this.statsFilePath, JSON.stringify(stats, null, 2));
      logger.info('💾 FlowManager: Estadísticas guardadas en', this.statsFilePath);
    } catch (error) {
      this.logger.error('❌ FlowManager: Error guardando estadísticas:', error.message);
    }
  }

  /**
     * Obtiene un resumen de las analíticas actuales
     */
  getAnalyticsSummary() {
    const totalEvents = Array.from(this.eventFrequency.values())
      .reduce((sum, freq) => sum + freq.totalCount, 0);
        
    const avgResponseTime = Array.from(this.eventResponseTimes.values())
      .reduce((sum, times, index, arr) => {
        return sum + (times.average / arr.length);
      }, 0);

    const mostFrequentEvent = Array.from(this.eventFrequency.entries())
      .sort((a, b) => b[1].totalCount - a[1].totalCount)[0];

    const slowestEvent = Array.from(this.eventResponseTimes.entries())
      .sort((a, b) => b[1].average - a[1].average)[0];

    return {
      totalEvents,
      avgResponseTime: Math.round(avgResponseTime),
      mostFrequentEvent: mostFrequentEvent ? {
        type: mostFrequentEvent[0],
        count: mostFrequentEvent[1].totalCount
      } : null,
      slowestEvent: slowestEvent ? {
        type: slowestEvent[0],
        avgTime: Math.round(slowestEvent[1].average)
      } : null,
      activeEventTypes: this.eventFrequency.size,
      bufferSize: this.eventBuffer.length
    };
  }

  /**
     * Obtiene estadísticas detalladas para un tipo de evento específico
     */
  getEventStats(eventType) {
    return {
      frequency: this.eventFrequency.get(eventType) || null,
      responseTimes: this.eventResponseTimes.get(eventType) || null,
      patterns: this.eventPatterns.get(eventType) || null
    };
  }

  /**
     * Obtiene todas las estadísticas del sistema
     */
  getAllStats() {
    return {
      isActive: this.isActive,
      summary: this.getAnalyticsSummary(),
      eventFrequency: Object.fromEntries(this.eventFrequency),
      eventResponseTimes: Object.fromEntries(this.eventResponseTimes),
      recentEvents: this.eventBuffer.slice(-20), // Últimos 20 eventos
      bottleneckThresholds: this.bottleneckThresholds
    };
  }
}

export default FlowManager;
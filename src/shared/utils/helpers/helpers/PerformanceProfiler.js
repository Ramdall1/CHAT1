import { performance, PerformanceObserver } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

/**
 * Profiler de performance avanzado
 * Proporciona análisis detallado de performance, bottlenecks y optimizaciones
 */
class PerformanceProfiler {
  constructor(options = {}) {
    this.config = {
      enabled: process.env.PERFORMANCE_PROFILER_ENABLED !== 'false',
      sampleRate: parseFloat(process.env.PERFORMANCE_SAMPLE_RATE) || 1.0,
      bufferSize: parseInt(process.env.PERFORMANCE_BUFFER_SIZE) || 1000,
      slowThreshold: parseInt(process.env.PERFORMANCE_SLOW_THRESHOLD) || 100, // ms
      verySlowThreshold: parseInt(process.env.PERFORMANCE_VERY_SLOW_THRESHOLD) || 1000, // ms
      enableGC: process.env.PERFORMANCE_ENABLE_GC === 'true',
      enableAsync: process.env.PERFORMANCE_ENABLE_ASYNC !== 'false',
      dataPath: options.dataPath || path.join(process.cwd(), 'data', 'performance'),
      ...options
    };

    this.sessions = new Map();
    this.measurements = [];
    this.observers = [];
    this.gcStats = [];
    this.asyncOperations = new Map();
        
    this.initialize();
  }

  /**
     * Inicializar el profiler
     */
  async initialize() {
    if (!this.config.enabled) {
      logger.info('⚡ Performance Profiler deshabilitado');
      return;
    }

    try {
      await fs.mkdir(this.config.dataPath, { recursive: true });
      this.setupPerformanceObservers();
            
      if (this.config.enableGC) {
        this.setupGCMonitoring();
      }
            
      logger.info('⚡ Performance Profiler inicializado');
    } catch (error) {
      logger.error('❌ Error inicializando Performance Profiler:', error);
    }
  }

  /**
     * Configurar observadores de performance
     */
  setupPerformanceObservers() {
    // Observer para medidas de tiempo
    const measureObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processMeasurement(entry);
      }
    });
    measureObserver.observe({ entryTypes: ['measure'] });
    this.observers.push(measureObserver);

    // Observer para navegación (si está disponible)
    try {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processNavigationTiming(entry);
        }
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    } catch (error) {
      // Navigation timing no disponible en Node.js
    }

    // Observer para recursos
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processResourceTiming(entry);
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    } catch (error) {
      // Resource timing no disponible en Node.js
    }

    // Observer para funciones
    if (this.config.enableAsync) {
      try {
        const functionObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.processFunctionTiming(entry);
          }
        });
        functionObserver.observe({ entryTypes: ['function'] });
        this.observers.push(functionObserver);
      } catch (error) {
        // Function timing no disponible
      }
    }
  }

  /**
     * Configurar monitoreo de Garbage Collection
     */
  setupGCMonitoring() {
    try {
      const gcObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processGCTiming(entry);
        }
      });
      gcObserver.observe({ entryTypes: ['gc'] });
      this.observers.push(gcObserver);
    } catch (error) {
      logger.warn('⚠️ GC monitoring no disponible:', error.message);
    }
  }

  // ==================== SESIONES DE PROFILING ====================

  /**
     * Iniciar sesión de profiling
     */
  startSession(name, metadata = {}) {
    if (!this.config.enabled) return null;

    const session = {
      name,
      id: `${name}_${Date.now()}`,
      startTime: performance.now(),
      startTimestamp: Date.now(),
      metadata,
      measurements: [],
      marks: new Map(),
      status: 'active'
    };

    this.sessions.set(session.id, session);
    performance.mark(`${session.id}_start`);
        
    logger.info(`⚡ [PROFILER] Sesión iniciada: ${name} (${session.id})`);
    return session.id;
  }

  /**
     * Finalizar sesión de profiling
     */
  endSession(sessionId) {
    if (!this.config.enabled || !this.sessions.has(sessionId)) return null;

    const session = this.sessions.get(sessionId);
    const endTime = performance.now();
        
    performance.mark(`${sessionId}_end`);
    performance.measure(sessionId, `${sessionId}_start`, `${sessionId}_end`);
        
    session.endTime = endTime;
    session.endTimestamp = Date.now();
    session.duration = endTime - session.startTime;
    session.status = 'completed';
        
    const summary = this.generateSessionSummary(session);
        
    logger.info(`✅ [PROFILER] Sesión finalizada: ${session.name} (${session.duration.toFixed(2)}ms)`);
        
    if (session.duration > this.config.verySlowThreshold) {
      logger.warn(`🐌 [PROFILER] Sesión muy lenta detectada: ${session.name}`);
    }
        
    return summary;
  }

  /**
     * Crear marca de tiempo
     */
  mark(sessionId, name, metadata = {}) {
    if (!this.config.enabled || !this.sessions.has(sessionId)) return;

    const session = this.sessions.get(sessionId);
    const markTime = performance.now();
    const markName = `${sessionId}_${name}`;
        
    performance.mark(markName);
        
    const mark = {
      name,
      time: markTime,
      relativeTime: markTime - session.startTime,
      timestamp: Date.now(),
      metadata
    };
        
    session.marks.set(name, mark);
    logger.info(`📍 [MARK] ${session.name}.${name}: ${mark.relativeTime.toFixed(2)}ms`);
  }

  /**
     * Medir tiempo entre marcas
     */
  measure(sessionId, name, startMark, endMark) {
    if (!this.config.enabled || !this.sessions.has(sessionId)) return;

    const session = this.sessions.get(sessionId);
    const measureName = `${sessionId}_${name}`;
    const startMarkName = `${sessionId}_${startMark}`;
    const endMarkName = `${sessionId}_${endMark}`;
        
    try {
      performance.measure(measureName, startMarkName, endMarkName);
            
      const startMarkData = session.marks.get(startMark);
      const endMarkData = session.marks.get(endMark);
            
      if (startMarkData && endMarkData) {
        const duration = endMarkData.relativeTime - startMarkData.relativeTime;
                
        const measurement = {
          name,
          startMark,
          endMark,
          duration,
          timestamp: Date.now()
        };
                
        session.measurements.push(measurement);
                
        logger.info(`📏 [MEASURE] ${session.name}.${name}: ${duration.toFixed(2)}ms`);
                
        if (duration > this.config.slowThreshold) {
          logger.warn(`⚠️ [SLOW] Operación lenta: ${session.name}.${name}`);
        }
      }
    } catch (error) {
      logger.error(`❌ Error midiendo ${name}:`, error.message);
    }
  }

  // ==================== PROFILING AUTOMÁTICO ====================

  /**
     * Decorator para profiling automático de funciones
     */
  profileFunction(name, options = {}) {
    const profiler = this;
        
    return function(target, propertyKey, descriptor) {
      if (!profiler.config.enabled) return descriptor;

      const originalMethod = descriptor.value;
      const functionName = name || `${target.constructor.name}.${propertyKey}`;

      descriptor.value = async function(...args) {
        // Sampling
        if (Math.random() > profiler.config.sampleRate) {
          return originalMethod.apply(this, args);
        }

        const sessionId = profiler.startSession(functionName, {
          className: target.constructor.name,
          methodName: propertyKey,
          args: options.logArgs ? args : '[hidden]',
          ...options.metadata
        });

        profiler.mark(sessionId, 'start');

        try {
          const result = await originalMethod.apply(this, args);
          profiler.mark(sessionId, 'success');
          profiler.measure(sessionId, 'execution', 'start', 'success');
          profiler.endSession(sessionId);
          return result;
        } catch (error) {
          profiler.mark(sessionId, 'error');
          profiler.measure(sessionId, 'execution', 'start', 'error');
          profiler.endSession(sessionId);
          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
     * Profiling de operaciones asíncronas
     */
  async profileAsync(name, operation, metadata = {}) {
    if (!this.config.enabled) {
      return await operation();
    }

    const sessionId = this.startSession(name, metadata);
    this.mark(sessionId, 'start');

    try {
      const result = await operation();
      this.mark(sessionId, 'success');
      this.measure(sessionId, 'execution', 'start', 'success');
      this.endSession(sessionId);
      return result;
    } catch (error) {
      this.mark(sessionId, 'error');
      this.measure(sessionId, 'execution', 'start', 'error');
      this.endSession(sessionId);
      throw error;
    }
  }

  /**
     * Profiling de operaciones síncronas
     */
  profileSync(name, operation, metadata = {}) {
    if (!this.config.enabled) {
      return operation();
    }

    const sessionId = this.startSession(name, metadata);
    this.mark(sessionId, 'start');

    try {
      const result = operation();
      this.mark(sessionId, 'success');
      this.measure(sessionId, 'execution', 'start', 'success');
      this.endSession(sessionId);
      return result;
    } catch (error) {
      this.mark(sessionId, 'error');
      this.measure(sessionId, 'execution', 'start', 'error');
      this.endSession(sessionId);
      throw error;
    }
  }

  // ==================== PROCESAMIENTO DE DATOS ====================

  /**
     * Procesar medición de performance
     */
  processMeasurement(entry) {
    const measurement = {
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: Date.now(),
      type: 'measure'
    };

    this.measurements.push(measurement);
        
    if (this.measurements.length > this.config.bufferSize) {
      this.measurements.shift();
    }

    if (entry.duration > this.config.slowThreshold) {
      logger.warn(`⚠️ [SLOW MEASURE] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
    }
  }

  /**
     * Procesar timing de navegación
     */
  processNavigationTiming(entry) {
    logger.info(`🌐 [NAVIGATION] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
  }

  /**
     * Procesar timing de recursos
     */
  processResourceTiming(entry) {
    if (entry.duration > this.config.slowThreshold) {
      logger.warn(`📦 [SLOW RESOURCE] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
    }
  }

  /**
     * Procesar timing de funciones
     */
  processFunctionTiming(entry) {
    if (entry.duration > this.config.slowThreshold) {
      logger.warn(`🔧 [SLOW FUNCTION] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
    }
  }

  /**
     * Procesar timing de GC
     */
  processGCTiming(entry) {
    const gcStat = {
      kind: entry.kind,
      duration: entry.duration,
      timestamp: Date.now()
    };

    this.gcStats.push(gcStat);
        
    if (this.gcStats.length > this.config.bufferSize) {
      this.gcStats.shift();
    }

    if (entry.duration > 50) { // GC > 50ms
      logger.warn(`🗑️ [SLOW GC] ${entry.kind}: ${entry.duration.toFixed(2)}ms`);
    }
  }

  // ==================== ANÁLISIS Y REPORTES ====================

  /**
     * Generar resumen de sesión
     */
  generateSessionSummary(session) {
    const marks = Array.from(session.marks.values());
    const measurements = session.measurements;

    return {
      id: session.id,
      name: session.name,
      duration: session.duration,
      status: session.status,
      metadata: session.metadata,
      marks: marks.length,
      measurements: measurements.length,
      slowOperations: measurements.filter(m => m.duration > this.config.slowThreshold).length,
      averageMeasurement: measurements.length > 0 
        ? measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length 
        : 0,
      timeline: marks.sort((a, b) => a.relativeTime - b.relativeTime)
    };
  }

  /**
     * Analizar bottlenecks
     */
  analyzeBottlenecks() {
    const analysis = {
      slowSessions: [],
      frequentSlowOperations: new Map(),
      gcImpact: 0,
      recommendations: []
    };

    // Analizar sesiones lentas
    for (const session of this.sessions.values()) {
      if (session.status === 'completed' && session.duration > this.config.slowThreshold) {
        analysis.slowSessions.push({
          name: session.name,
          duration: session.duration,
          measurements: session.measurements.length
        });
      }
    }

    // Analizar operaciones frecuentemente lentas
    for (const measurement of this.measurements) {
      if (measurement.duration > this.config.slowThreshold) {
        const count = analysis.frequentSlowOperations.get(measurement.name) || 0;
        analysis.frequentSlowOperations.set(measurement.name, count + 1);
      }
    }

    // Analizar impacto del GC
    const recentGC = this.gcStats.slice(-10);
    analysis.gcImpact = recentGC.reduce((sum, gc) => sum + gc.duration, 0);

    // Generar recomendaciones
    if (analysis.slowSessions.length > 0) {
      analysis.recommendations.push('Optimizar las sesiones más lentas identificadas');
    }
        
    if (analysis.gcImpact > 100) {
      analysis.recommendations.push('Considerar optimización de memoria para reducir GC');
    }

    if (analysis.frequentSlowOperations.size > 0) {
      analysis.recommendations.push('Revisar operaciones frecuentemente lentas');
    }

    return analysis;
  }

  /**
     * Generar reporte de performance
     */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      summary: {
        totalSessions: this.sessions.size,
        completedSessions: Array.from(this.sessions.values()).filter(s => s.status === 'completed').length,
        totalMeasurements: this.measurements.length,
        totalGCEvents: this.gcStats.length,
        averageSessionDuration: this.getAverageSessionDuration(),
        slowSessionsCount: this.getSlowSessionsCount()
      },
      bottlenecks: this.analyzeBottlenecks(),
      recentMeasurements: this.measurements.slice(-20),
      recentGCStats: this.gcStats.slice(-10),
      topSlowOperations: this.getTopSlowOperations(10)
    };

    const reportPath = path.join(this.config.dataPath, `performance-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
    logger.info(`📊 [PERFORMANCE REPORT] Generado: ${reportPath}`);
    return report;
  }

  /**
     * Obtener duración promedio de sesiones
     */
  getAverageSessionDuration() {
    const completedSessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'completed');
        
    if (completedSessions.length === 0) return 0;
        
    return completedSessions.reduce((sum, s) => sum + s.duration, 0) / completedSessions.length;
  }

  /**
     * Obtener cantidad de sesiones lentas
     */
  getSlowSessionsCount() {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'completed' && s.duration > this.config.slowThreshold).length;
  }

  /**
     * Obtener top operaciones lentas
     */
  getTopSlowOperations(limit = 10) {
    return this.measurements
      .filter(m => m.duration > this.config.slowThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
     * Limpiar datos antiguos
     */
  cleanup() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 horas

    // Limpiar sesiones antiguas
    for (const [id, session] of this.sessions) {
      if (session.endTimestamp && session.endTimestamp < cutoffTime) {
        this.sessions.delete(id);
      }
    }

    // Limpiar mediciones antiguas
    this.measurements = this.measurements.filter(m => m.timestamp > cutoffTime);
    this.gcStats = this.gcStats.filter(gc => gc.timestamp > cutoffTime);
  }

  /**
     * Detener el profiler
     */
  stop() {
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers.length = 0;
        
    logger.info('⚡ Performance Profiler detenido');
  }
}

export default PerformanceProfiler;
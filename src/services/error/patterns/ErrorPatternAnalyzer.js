/**
 * ErrorPatternAnalyzer - Analizador de patrones y correlaciones de errores
 * 
 * Funcionalidades:
 * - Detección de patrones de errores
 * - Análisis de correlaciones
 * - Detección de anomalías
 * - Análisis de tendencias
 * - Predicción de patrones futuros
 */
class ErrorPatternAnalyzer {
  constructor(config = {}) {
    this.config = {
      correlationWindow: 300000, // 5 minutos
      trendAnalysisWindow: 3600000, // 1 hora
      patternDetectionEnabled: true,
      anomalyDetectionEnabled: true,
      minPatternOccurrences: 3,
      maxPatterns: 1000,
      ...config
    };

    // Almacenamiento de patrones
    this.errorPatterns = new Map();
    this.correlations = new Map();
    this.trends = new Map();
    this.anomalies = [];
    
    // Historial de errores para análisis
    this.errorHistory = [];
    this.recentErrors = [];
    
    // Métricas de análisis
    this.analysisMetrics = {
      patternsDetected: 0,
      correlationsFound: 0,
      anomaliesDetected: 0,
      trendsAnalyzed: 0,
      lastAnalysis: null
    };
  }

  /**
   * Detectar patrones de errores
   */
  async detectErrorPatterns(errorEntry) {
    if (!this.config.patternDetectionEnabled) return;

    try {
      // Agregar error al historial
      this.addToHistory(errorEntry);
      
      // Detectar patrones temporales
      await this.detectTemporalPatterns(errorEntry);
      
      // Detectar patrones de módulo
      await this.detectModulePatterns(errorEntry);
      
      // Detectar patrones de mensaje
      await this.detectMessagePatterns(errorEntry);
      
      // Detectar patrones de contexto
      await this.detectContextualPatterns(errorEntry);
      
      this.analysisMetrics.patternsDetected++;
      this.analysisMetrics.lastAnalysis = Date.now();
      
    } catch (error) {
      logger.error('Error detectando patrones:', error);
    }
  }

  /**
   * Detectar patrones temporales
   */
  async detectTemporalPatterns(errorEntry) {
    const now = Date.now();
    const timeWindows = [
      { name: '1min', duration: 60000 },
      { name: '5min', duration: 300000 },
      { name: '15min', duration: 900000 },
      { name: '1hour', duration: 3600000 }
    ];

    for (const window of timeWindows) {
      const windowStart = now - window.duration;
      const errorsInWindow = this.errorHistory.filter(
        error => error.timestamp >= windowStart
      );

      if (errorsInWindow.length >= this.config.minPatternOccurrences) {
        const patternKey = `temporal_${window.name}_${errorEntry.module}`;
        this.updatePattern(patternKey, {
          type: 'temporal',
          window: window.name,
          module: errorEntry.module,
          count: errorsInWindow.length,
          frequency: errorsInWindow.length / (window.duration / 60000), // errores por minuto
          lastOccurrence: now,
          errors: errorsInWindow.slice(-5) // Últimos 5 errores
        });
      }
    }
  }

  /**
   * Detectar patrones de módulo
   */
  async detectModulePatterns(errorEntry) {
    const moduleErrors = this.errorHistory.filter(
      error => error.module === errorEntry.module
    );

    if (moduleErrors.length >= this.config.minPatternOccurrences) {
      const patternKey = `module_${errorEntry.module}`;
      
      // Analizar tipos de errores más comunes en el módulo
      const errorTypes = {};
      const severityDistribution = {};
      
      moduleErrors.forEach(error => {
        errorTypes[error.message] = (errorTypes[error.message] || 0) + 1;
        severityDistribution[error.severity] = (severityDistribution[error.severity] || 0) + 1;
      });

      this.updatePattern(patternKey, {
        type: 'module',
        module: errorEntry.module,
        totalErrors: moduleErrors.length,
        errorTypes,
        severityDistribution,
        mostCommonError: Object.keys(errorTypes).reduce((a, b) => 
          errorTypes[a] > errorTypes[b] ? a : b
        ),
        lastOccurrence: Date.now()
      });
    }
  }

  /**
   * Detectar patrones de mensaje
   */
  async detectMessagePatterns(errorEntry) {
    const messageHash = this.generateMessageHash(errorEntry.message);
    const similarErrors = this.errorHistory.filter(
      error => this.generateMessageHash(error.message) === messageHash
    );

    if (similarErrors.length >= this.config.minPatternOccurrences) {
      const patternKey = `message_${messageHash}`;
      
      // Analizar intervalos entre errores similares
      const intervals = [];
      for (let i = 1; i < similarErrors.length; i++) {
        intervals.push(similarErrors[i].timestamp - similarErrors[i-1].timestamp);
      }
      
      const avgInterval = intervals.length > 0 ? 
        intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;

      this.updatePattern(patternKey, {
        type: 'message',
        messageHash,
        originalMessage: errorEntry.message,
        occurrences: similarErrors.length,
        averageInterval: avgInterval,
        modules: [...new Set(similarErrors.map(e => e.module))],
        lastOccurrence: Date.now(),
        intervals
      });
    }
  }

  /**
   * Detectar patrones contextuales
   */
  async detectContextualPatterns(errorEntry) {
    if (!errorEntry.metadata) return;

    // Analizar patrones por contexto específico
    const contextKeys = Object.keys(errorEntry.metadata);
    
    for (const key of contextKeys) {
      const value = errorEntry.metadata[key];
      if (typeof value === 'string' || typeof value === 'number') {
        const contextErrors = this.errorHistory.filter(
          error => error.metadata && error.metadata[key] === value
        );

        if (contextErrors.length >= this.config.minPatternOccurrences) {
          const patternKey = `context_${key}_${value}`;
          
          this.updatePattern(patternKey, {
            type: 'contextual',
            contextKey: key,
            contextValue: value,
            occurrences: contextErrors.length,
            modules: [...new Set(contextErrors.map(e => e.module))],
            severities: [...new Set(contextErrors.map(e => e.severity))],
            lastOccurrence: Date.now()
          });
        }
      }
    }
  }

  /**
   * Verificar correlaciones de errores
   */
  async checkErrorCorrelations(errorEntry) {
    const now = Date.now();
    const correlationWindow = this.config.correlationWindow;
    
    // Obtener errores en la ventana de correlación
    const recentErrors = this.errorHistory.filter(
      error => now - error.timestamp <= correlationWindow && 
               error.id !== errorEntry.id
    );

    for (const recentError of recentErrors) {
      const correlationKey = this.generateCorrelationKey(errorEntry, recentError);
      
      if (!this.correlations.has(correlationKey)) {
        this.correlations.set(correlationKey, {
          error1: {
            module: errorEntry.module,
            message: errorEntry.message,
            severity: errorEntry.severity
          },
          error2: {
            module: recentError.module,
            message: recentError.message,
            severity: recentError.severity
          },
          occurrences: 0,
          timeGaps: [],
          strength: 0,
          lastSeen: now
        });
      }

      const correlation = this.correlations.get(correlationKey);
      correlation.occurrences++;
      correlation.timeGaps.push(errorEntry.timestamp - recentError.timestamp);
      correlation.lastSeen = now;
      
      // Calcular fuerza de correlación
      correlation.strength = this.calculateCorrelationStrength(correlation);
      
      this.analysisMetrics.correlationsFound++;
    }

    // Limpiar correlaciones antiguas
    this.cleanupOldCorrelations();
  }

  /**
   * Calcular fuerza de correlación
   */
  calculateCorrelationStrength(correlation) {
    const occurrences = correlation.occurrences;
    const timeGaps = correlation.timeGaps;
    
    if (timeGaps.length === 0) return 0;
    
    // Calcular consistencia temporal
    const avgGap = timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length;
    const variance = timeGaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / timeGaps.length;
    const consistency = 1 / (1 + Math.sqrt(variance) / avgGap);
    
    // Fuerza basada en ocurrencias y consistencia
    const strength = Math.min(1, (occurrences / 10) * consistency);
    
    return Math.round(strength * 100) / 100;
  }

  /**
   * Analizar tendencias
   */
  async analyzeTrends() {
    const now = Date.now();
    const analysisWindow = this.config.trendAnalysisWindow;
    const windowStart = now - analysisWindow;
    
    const recentErrors = this.errorHistory.filter(
      error => error.timestamp >= windowStart
    );

    if (recentErrors.length === 0) return;

    // Analizar tendencias por módulo
    await this.analyzeModuleTrends(recentErrors, analysisWindow);
    
    // Analizar tendencias por severidad
    await this.analyzeSeverityTrends(recentErrors, analysisWindow);
    
    // Analizar tendencias temporales
    await this.analyzeTemporalTrends(recentErrors, analysisWindow);
    
    this.analysisMetrics.trendsAnalyzed++;
  }

  /**
   * Analizar tendencias por módulo
   */
  async analyzeModuleTrends(errors, window) {
    const moduleGroups = {};
    
    errors.forEach(error => {
      if (!moduleGroups[error.module]) {
        moduleGroups[error.module] = [];
      }
      moduleGroups[error.module].push(error);
    });

    for (const [module, moduleErrors] of Object.entries(moduleGroups)) {
      const trendKey = `module_trend_${module}`;
      
      // Dividir en segmentos temporales para analizar tendencia
      const segments = this.divideIntoTimeSegments(moduleErrors, window, 6);
      const errorCounts = segments.map(segment => segment.length);
      
      const trend = this.calculateTrend(errorCounts);
      
      this.trends.set(trendKey, {
        type: 'module',
        module,
        trend, // 'increasing', 'decreasing', 'stable'
        errorCounts,
        totalErrors: moduleErrors.length,
        rate: moduleErrors.length / (window / 3600000), // errores por hora
        lastUpdate: Date.now()
      });
    }
  }

  /**
   * Analizar tendencias por severidad
   */
  async analyzeSeverityTrends(errors, window) {
    const severityGroups = {};
    
    errors.forEach(error => {
      if (!severityGroups[error.severity]) {
        severityGroups[error.severity] = [];
      }
      severityGroups[error.severity].push(error);
    });

    for (const [severity, severityErrors] of Object.entries(severityGroups)) {
      const trendKey = `severity_trend_${severity}`;
      
      const segments = this.divideIntoTimeSegments(severityErrors, window, 6);
      const errorCounts = segments.map(segment => segment.length);
      
      const trend = this.calculateTrend(errorCounts);
      
      this.trends.set(trendKey, {
        type: 'severity',
        severity,
        trend,
        errorCounts,
        totalErrors: severityErrors.length,
        rate: severityErrors.length / (window / 3600000),
        lastUpdate: Date.now()
      });
    }
  }

  /**
   * Analizar tendencias temporales
   */
  async analyzeTemporalTrends(errors, window) {
    const segments = this.divideIntoTimeSegments(errors, window, 12);
    const errorCounts = segments.map(segment => segment.length);
    
    const trend = this.calculateTrend(errorCounts);
    
    this.trends.set('temporal_trend_overall', {
      type: 'temporal',
      trend,
      errorCounts,
      totalErrors: errors.length,
      rate: errors.length / (window / 3600000),
      lastUpdate: Date.now()
    });
  }

  /**
   * Detectar anomalías
   */
  async detectAnomalies() {
    if (!this.config.anomalyDetectionEnabled) return;

    const now = Date.now();
    const analysisWindow = 3600000; // 1 hora
    const windowStart = now - analysisWindow;
    
    const recentErrors = this.errorHistory.filter(
      error => error.timestamp >= windowStart
    );

    // Detectar picos de errores
    await this.detectErrorSpikes(recentErrors);
    
    // Detectar patrones anómalos
    await this.detectAnomalousPatterns();
    
    // Detectar módulos con comportamiento anómalo
    await this.detectAnomalousModules(recentErrors);
    
    this.analysisMetrics.anomaliesDetected = this.anomalies.length;
  }

  /**
   * Detectar picos de errores
   */
  async detectErrorSpikes(errors) {
    const segments = this.divideIntoTimeSegments(errors, 3600000, 12); // 12 segmentos de 5 minutos
    const errorCounts = segments.map(segment => segment.length);
    
    if (errorCounts.length === 0) return;
    
    const mean = errorCounts.reduce((a, b) => a + b, 0) / errorCounts.length;
    const variance = errorCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / errorCounts.length;
    const stdDev = Math.sqrt(variance);
    
    const threshold = mean + (2 * stdDev); // 2 desviaciones estándar
    
    errorCounts.forEach((count, index) => {
      if (count > threshold && count > 5) { // Mínimo 5 errores para considerar pico
        this.addAnomaly({
          type: 'error_spike',
          description: `Pico de errores detectado: ${count} errores en 5 minutos`,
          severity: 'high',
          timestamp: Date.now(),
          data: {
            errorCount: count,
            threshold,
            mean,
            stdDev,
            segmentIndex: index
          }
        });
      }
    });
  }

  /**
   * Detectar patrones anómalos
   */
  async detectAnomalousPatterns() {
    for (const [patternKey, pattern] of this.errorPatterns.entries()) {
      if (await this.isAnomalousPattern(pattern)) {
        this.addAnomaly({
          type: 'anomalous_pattern',
          description: `Patrón anómalo detectado: ${patternKey}`,
          severity: 'medium',
          timestamp: Date.now(),
          data: {
            patternKey,
            pattern: { ...pattern }
          }
        });
      }
    }
  }

  /**
   * Detectar módulos con comportamiento anómalo
   */
  async detectAnomalousModules(errors) {
    const moduleGroups = {};
    
    errors.forEach(error => {
      if (!moduleGroups[error.module]) {
        moduleGroups[error.module] = [];
      }
      moduleGroups[error.module].push(error);
    });

    const moduleCounts = Object.values(moduleGroups).map(group => group.length);
    
    if (moduleCounts.length === 0) return;
    
    const mean = moduleCounts.reduce((a, b) => a + b, 0) / moduleCounts.length;
    const variance = moduleCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / moduleCounts.length;
    const stdDev = Math.sqrt(variance);
    
    const threshold = mean + (1.5 * stdDev);
    
    for (const [module, moduleErrors] of Object.entries(moduleGroups)) {
      if (moduleErrors.length > threshold && moduleErrors.length > 10) {
        this.addAnomaly({
          type: 'anomalous_module',
          description: `Módulo con comportamiento anómalo: ${module}`,
          severity: 'medium',
          timestamp: Date.now(),
          data: {
            module,
            errorCount: moduleErrors.length,
            threshold,
            mean,
            stdDev
          }
        });
      }
    }
  }

  /**
   * Verificar si un patrón es anómalo
   */
  async isAnomalousPattern(pattern) {
    // Criterios para considerar un patrón como anómalo
    if (pattern.type === 'temporal' && pattern.frequency > 10) { // Más de 10 errores por minuto
      return true;
    }
    
    if (pattern.type === 'message' && pattern.occurrences > 50) { // Mismo mensaje más de 50 veces
      return true;
    }
    
    if (pattern.type === 'module' && pattern.totalErrors > 100) { // Más de 100 errores en un módulo
      return true;
    }
    
    return false;
  }

  /**
   * Utilidades
   */
  
  addToHistory(errorEntry) {
    this.errorHistory.push(errorEntry);
    
    // Mantener solo los últimos 10000 errores
    if (this.errorHistory.length > 10000) {
      this.errorHistory = this.errorHistory.slice(-5000);
    }
  }

  updatePattern(key, patternData) {
    this.errorPatterns.set(key, patternData);
    
    // Limpiar patrones antiguos si hay demasiados
    if (this.errorPatterns.size > this.config.maxPatterns) {
      const entries = Array.from(this.errorPatterns.entries());
      entries.sort((a, b) => a[1].lastOccurrence - b[1].lastOccurrence);
      
      // Eliminar los 200 patrones más antiguos
      for (let i = 0; i < 200; i++) {
        this.errorPatterns.delete(entries[i][0]);
      }
    }
  }

  generateMessageHash(message) {
    // Normalizar mensaje para detectar similitudes
    const normalized = message
      .toLowerCase()
      .replace(/\d+/g, 'N') // Reemplazar números con N
      .replace(/['"]/g, '') // Eliminar comillas
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
    
    return this.simpleHash(normalized);
  }

  generateCorrelationKey(error1, error2) {
    const key1 = `${error1.module}:${error1.severity}`;
    const key2 = `${error2.module}:${error2.severity}`;
    
    // Ordenar para que la clave sea consistente
    return key1 < key2 ? `${key1}|${key2}` : `${key2}|${key1}`;
  }

  divideIntoTimeSegments(errors, totalWindow, segmentCount) {
    const segmentDuration = totalWindow / segmentCount;
    const segments = Array(segmentCount).fill().map(() => []);
    
    const now = Date.now();
    const windowStart = now - totalWindow;
    
    errors.forEach(error => {
      const relativeTime = error.timestamp - windowStart;
      const segmentIndex = Math.floor(relativeTime / segmentDuration);
      
      if (segmentIndex >= 0 && segmentIndex < segmentCount) {
        segments[segmentIndex].push(error);
      }
    });
    
    return segments;
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    let increasing = 0;
    let decreasing = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i-1]) increasing++;
      else if (values[i] < values[i-1]) decreasing++;
    }
    
    const threshold = values.length * 0.6; // 60% de los cambios
    
    if (increasing >= threshold) return 'increasing';
    if (decreasing >= threshold) return 'decreasing';
    return 'stable';
  }

  addAnomaly(anomaly) {
    this.anomalies.push(anomaly);
    
    // Mantener solo las últimas 100 anomalías
    if (this.anomalies.length > 100) {
      this.anomalies = this.anomalies.slice(-50);
    }
  }

  cleanupOldCorrelations() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    
    for (const [key, correlation] of this.correlations.entries()) {
      if (now - correlation.lastSeen > maxAge) {
        this.correlations.delete(key);
      }
    }
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Obtener estadísticas de análisis
   */
  getAnalysisStats() {
    return {
      patterns: {
        total: this.errorPatterns.size,
        byType: this.getPatternsByType()
      },
      correlations: {
        total: this.correlations.size,
        strong: Array.from(this.correlations.values()).filter(c => c.strength > 0.7).length
      },
      trends: {
        total: this.trends.size,
        byType: this.getTrendsByType()
      },
      anomalies: {
        total: this.anomalies.length,
        recent: this.anomalies.filter(a => Date.now() - a.timestamp < 3600000).length
      },
      metrics: { ...this.analysisMetrics }
    };
  }

  getPatternsByType() {
    const byType = {};
    for (const pattern of this.errorPatterns.values()) {
      byType[pattern.type] = (byType[pattern.type] || 0) + 1;
    }
    return byType;
  }

  getTrendsByType() {
    const byType = {};
    for (const trend of this.trends.values()) {
      byType[trend.type] = (byType[trend.type] || 0) + 1;
    }
    return byType;
  }

  /**
   * Limpiar datos
   */
  cleanup() {
    this.errorPatterns.clear();
    this.correlations.clear();
    this.trends.clear();
    this.anomalies = [];
    this.errorHistory = [];
    this.recentErrors = [];
  }
}

export default ErrorPatternAnalyzer;
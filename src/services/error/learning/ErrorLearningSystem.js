/**
 * ErrorLearningSystem - Sistema de aprendizaje inteligente de errores
 * 
 * Funcionalidades:
 * - Aprendizaje de contextos de errores
 * - Identificación de patrones evolutivos
 * - Adaptación de umbrales y configuraciones
 * - Mejora continua de clasificación
 * - Optimización de estrategias de recuperación
 */
class ErrorLearningSystem {
  constructor(config = {}) {
    this.config = {
      learningEnabled: true,
      learningRate: 0.1,
      adaptationThreshold: 0.8,
      maxLearningData: 1000,
      contextWindow: 3600000, // 1 hora
      minSamplesForLearning: 10,
      confidenceDecay: 0.95,
      ...config
    };

    // Base de conocimiento
    this.knowledgeBase = {
      errorContexts: new Map(),
      patternLibrary: new Map(),
      adaptiveThresholds: new Map(),
      recoveryStrategies: new Map(),
      classificationRules: new Map()
    };

    // Datos de aprendizaje
    this.learningData = {
      errorSamples: [],
      contextCorrelations: new Map(),
      temporalPatterns: new Map(),
      moduleRelationships: new Map(),
      severityEvolution: new Map()
    };

    // Métricas de aprendizaje
    this.learningMetrics = {
      totalSamples: 0,
      patternsLearned: 0,
      adaptationsApplied: 0,
      accuracyImprovement: 0,
      lastLearningSession: null,
      learningEfficiency: 0
    };

    // Estado del sistema
    this.isLearning = false;
    this.lastAdaptation = null;
    this.adaptationHistory = [];
  }

  /**
   * Inicializar sistema de aprendizaje
   */
  async initialize() {
    logger.debug('🧠 Inicializando sistema de aprendizaje de errores...');
    
    try {
      // Cargar base de conocimiento existente
      await this.loadKnowledgeBase();
      
      // Inicializar modelos de aprendizaje
      await this.initializeLearningModels();
      
      logger.debug('✅ Sistema de aprendizaje inicializado correctamente');
      
    } catch (error) {
      logger.error('❌ Error inicializando sistema de aprendizaje:', error);
      throw error;
    }
  }

  /**
   * Cargar base de conocimiento
   */
  async loadKnowledgeBase() {
    // En implementación real, cargar desde persistencia
    logger.debug('📚 Cargando base de conocimiento...');
    
    // Simular carga de datos
    this.knowledgeBase.errorContexts.clear();
    this.knowledgeBase.patternLibrary.clear();
    
    logger.debug(`📖 Base de conocimiento cargada: ${this.knowledgeBase.errorContexts.size} contextos`);
  }

  /**
   * Inicializar modelos de aprendizaje
   */
  async initializeLearningModels() {
    // Configurar modelos de aprendizaje específicos
    this.contextLearner = new ContextLearner(this.config);
    this.patternLearner = new PatternLearner(this.config);
    this.thresholdAdapter = new ThresholdAdapter(this.config);
    this.strategyOptimizer = new StrategyOptimizer(this.config);
    
    await this.contextLearner.initialize();
    await this.patternLearner.initialize();
    await this.thresholdAdapter.initialize();
    await this.strategyOptimizer.initialize();
  }

  /**
   * Aprender de nuevo error
   */
  async learnFromError(errorData, context = {}) {
    if (!this.config.learningEnabled) return;

    try {
      this.isLearning = true;
      
      // Agregar muestra de aprendizaje
      await this.addLearningSample(errorData, context);
      
      // Aprender contextos
      await this.learnErrorContext(errorData, context);
      
      // Aprender patrones
      await this.learnErrorPatterns(errorData);
      
      // Adaptar umbrales si es necesario
      await this.adaptThresholds(errorData);
      
      // Optimizar estrategias de recuperación
      await this.optimizeRecoveryStrategies(errorData, context);
      
      // Actualizar métricas
      this.updateLearningMetrics();
      
      this.isLearning = false;
      
    } catch (error) {
      logger.error('Error en proceso de aprendizaje:', error);
      this.isLearning = false;
    }
  }

  /**
   * Agregar muestra de aprendizaje
   */
  async addLearningSample(errorData, context) {
    const sample = {
      timestamp: Date.now(),
      error: {
        module: errorData.module,
        severity: errorData.severity,
        message: errorData.message,
        category: errorData.metadata?.category || 'unknown'
      },
      context: {
        systemLoad: context.systemLoad || 0,
        memoryUsage: context.memoryUsage || 0,
        activeConnections: context.activeConnections || 0,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        ...context
      },
      features: this.extractLearningFeatures(errorData, context)
    };

    this.learningData.errorSamples.push(sample);
    
    // Mantener límite de muestras
    if (this.learningData.errorSamples.length > this.config.maxLearningData) {
      this.learningData.errorSamples = this.learningData.errorSamples.slice(-500);
    }
    
    this.learningMetrics.totalSamples++;
  }

  /**
   * Aprender contextos de errores
   */
  async learnErrorContext(errorData, context) {
    const contextKey = this.generateContextKey(errorData);
    
    if (!this.knowledgeBase.errorContexts.has(contextKey)) {
      this.knowledgeBase.errorContexts.set(contextKey, {
        samples: [],
        patterns: {},
        confidence: 0,
        lastUpdate: Date.now()
      });
    }

    const contextData = this.knowledgeBase.errorContexts.get(contextKey);
    contextData.samples.push({
      timestamp: Date.now(),
      context,
      severity: errorData.severity
    });

    // Mantener solo muestras recientes
    const cutoff = Date.now() - this.config.contextWindow;
    contextData.samples = contextData.samples.filter(sample => 
      sample.timestamp > cutoff
    );

    // Analizar patrones de contexto
    if (contextData.samples.length >= this.config.minSamplesForLearning) {
      await this.analyzeContextPatterns(contextKey, contextData);
    }
  }

  /**
   * Analizar patrones de contexto
   */
  async analyzeContextPatterns(contextKey, contextData) {
    const patterns = {};
    
    // Analizar correlaciones de contexto
    const contextKeys = Object.keys(contextData.samples[0]?.context || {});
    
    for (const key of contextKeys) {
      if (typeof contextData.samples[0].context[key] === 'number') {
        patterns[key] = this.analyzeNumericPattern(contextData.samples, key);
      } else {
        patterns[key] = this.analyzeCategoricalPattern(contextData.samples, key);
      }
    }

    // Actualizar patrones en la base de conocimiento
    contextData.patterns = patterns;
    contextData.confidence = this.calculateContextConfidence(contextData.samples);
    contextData.lastUpdate = Date.now();

    logger.debug(`🧠 Patrones de contexto actualizados para ${contextKey}: confianza ${(contextData.confidence * 100).toFixed(1)}%`);
  }

  /**
   * Analizar patrón numérico
   */
  analyzeNumericPattern(samples, key) {
    const values = samples.map(s => s.context[key]).filter(v => v !== undefined);
    
    if (values.length === 0) return null;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      type: 'numeric',
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      threshold: mean + (2 * stdDev) // Umbral de anomalía
    };
  }

  /**
   * Analizar patrón categórico
   */
  analyzeCategoricalPattern(samples, key) {
    const values = samples.map(s => s.context[key]).filter(v => v !== undefined);
    const frequency = {};
    
    values.forEach(value => {
      frequency[value] = (frequency[value] || 0) + 1;
    });

    const total = values.length;
    const distribution = {};
    
    Object.entries(frequency).forEach(([value, count]) => {
      distribution[value] = count / total;
    });

    return {
      type: 'categorical',
      distribution,
      mostCommon: Object.entries(frequency).sort(([,a], [,b]) => b - a)[0]?.[0],
      entropy: this.calculateEntropy(distribution)
    };
  }

  /**
   * Calcular entropía
   */
  calculateEntropy(distribution) {
    return -Object.values(distribution).reduce((entropy, prob) => {
      return entropy + (prob > 0 ? prob * Math.log2(prob) : 0);
    }, 0);
  }

  /**
   * Calcular confianza del contexto
   */
  calculateContextConfidence(samples) {
    const sampleCount = samples.length;
    const timeSpan = samples[samples.length - 1].timestamp - samples[0].timestamp;
    const consistency = this.calculateConsistency(samples);
    
    // Confianza basada en cantidad de muestras, tiempo y consistencia
    const sampleFactor = Math.min(sampleCount / 50, 1);
    const timeFactor = Math.min(timeSpan / (24 * 3600000), 1); // normalizar a días
    
    return (sampleFactor * 0.4 + timeFactor * 0.3 + consistency * 0.3);
  }

  /**
   * Calcular consistencia de muestras
   */
  calculateConsistency(samples) {
    if (samples.length < 2) return 0;
    
    // Calcular variabilidad en severidad
    const severities = samples.map(s => s.severity);
    const severityVariability = new Set(severities).size / severities.length;
    
    return 1 - severityVariability; // Menos variabilidad = más consistencia
  }

  /**
   * Aprender patrones de errores
   */
  async learnErrorPatterns(errorData) {
    const patternKey = `${errorData.module}_${errorData.severity}`;
    
    if (!this.knowledgeBase.patternLibrary.has(patternKey)) {
      this.knowledgeBase.patternLibrary.set(patternKey, {
        occurrences: [],
        frequency: 0,
        temporalPattern: null,
        confidence: 0
      });
    }

    const pattern = this.knowledgeBase.patternLibrary.get(patternKey);
    pattern.occurrences.push(Date.now());
    pattern.frequency++;

    // Mantener solo ocurrencias recientes
    const cutoff = Date.now() - (24 * 3600000); // 24 horas
    pattern.occurrences = pattern.occurrences.filter(time => time > cutoff);

    // Analizar patrón temporal
    if (pattern.occurrences.length >= this.config.minSamplesForLearning) {
      pattern.temporalPattern = this.analyzeTemporalPattern(pattern.occurrences);
      pattern.confidence = Math.min(pattern.occurrences.length / 100, 1);
      
      this.learningMetrics.patternsLearned++;
      logger.debug(`🔍 Patrón temporal aprendido para ${patternKey}`);
    }
  }

  /**
   * Analizar patrón temporal
   */
  analyzeTemporalPattern(occurrences) {
    if (occurrences.length < 3) return null;

    // Calcular intervalos entre ocurrencias
    const intervals = [];
    for (let i = 1; i < occurrences.length; i++) {
      intervals.push(occurrences[i] - occurrences[i-1]);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

    // Detectar periodicidad
    const periodicity = this.detectPeriodicity(occurrences);

    return {
      averageInterval: avgInterval,
      variance,
      periodicity,
      predictedNext: occurrences[occurrences.length - 1] + avgInterval
    };
  }

  /**
   * Detectar periodicidad
   */
  detectPeriodicity(occurrences) {
    // Análisis simple de periodicidad por hora del día
    const hours = occurrences.map(time => new Date(time).getHours());
    const hourFrequency = {};
    
    hours.forEach(hour => {
      hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
    });

    const maxFreq = Math.max(...Object.values(hourFrequency));
    const peakHours = Object.entries(hourFrequency)
      .filter(([, freq]) => freq === maxFreq)
      .map(([hour]) => parseInt(hour));

    return {
      type: 'hourly',
      peakHours,
      strength: maxFreq / hours.length
    };
  }

  /**
   * Adaptar umbrales
   */
  async adaptThresholds(errorData) {
    const moduleKey = errorData.module;
    const recentErrors = this.getRecentErrorsForModule(moduleKey);
    
    if (recentErrors.length < this.config.minSamplesForLearning) return;

    const currentThreshold = this.knowledgeBase.adaptiveThresholds.get(moduleKey) || {
      errorRate: 10, // errores por hora
      severity: 'warning',
      confidence: 0
    };

    // Calcular nueva tasa de errores
    const timeWindow = 3600000; // 1 hora
    const errorRate = recentErrors.length / (timeWindow / 3600000);
    
    // Adaptar umbral basado en tendencia
    const adaptation = this.calculateThresholdAdaptation(currentThreshold, errorRate, recentErrors);
    
    if (adaptation.shouldAdapt) {
      currentThreshold.errorRate = adaptation.newThreshold;
      currentThreshold.confidence = adaptation.confidence;
      
      this.knowledgeBase.adaptiveThresholds.set(moduleKey, currentThreshold);
      this.learningMetrics.adaptationsApplied++;
      
      logger.debug(`⚙️ Umbral adaptado para ${moduleKey}: ${adaptation.newThreshold.toFixed(1)} errores/hora`);
    }
  }

  /**
   * Calcular adaptación de umbral
   */
  calculateThresholdAdaptation(currentThreshold, observedRate, recentErrors) {
    const rateDifference = Math.abs(observedRate - currentThreshold.errorRate);
    const adaptationThreshold = currentThreshold.errorRate * 0.3; // 30% de diferencia
    
    if (rateDifference > adaptationThreshold) {
      // Adaptar gradualmente hacia la tasa observada
      const adaptationRate = this.config.learningRate;
      const newThreshold = currentThreshold.errorRate + 
        (observedRate - currentThreshold.errorRate) * adaptationRate;
      
      return {
        shouldAdapt: true,
        newThreshold,
        confidence: Math.min(recentErrors.length / 50, 1)
      };
    }
    
    return { shouldAdapt: false };
  }

  /**
   * Optimizar estrategias de recuperación
   */
  async optimizeRecoveryStrategies(errorData, context) {
    const strategyKey = `${errorData.module}_${errorData.severity}`;
    
    if (!this.knowledgeBase.recoveryStrategies.has(strategyKey)) {
      this.knowledgeBase.recoveryStrategies.set(strategyKey, {
        strategies: new Map(),
        bestStrategy: null,
        successRate: 0
      });
    }

    const recoveryData = this.knowledgeBase.recoveryStrategies.get(strategyKey);
    
    // Si hay información de recuperación en el contexto
    if (context.recoveryAttempt) {
      const strategy = context.recoveryAttempt.strategy;
      const success = context.recoveryAttempt.success;
      
      if (!recoveryData.strategies.has(strategy)) {
        recoveryData.strategies.set(strategy, {
          attempts: 0,
          successes: 0,
          successRate: 0
        });
      }
      
      const strategyStats = recoveryData.strategies.get(strategy);
      strategyStats.attempts++;
      
      if (success) {
        strategyStats.successes++;
      }
      
      strategyStats.successRate = strategyStats.successes / strategyStats.attempts;
      
      // Actualizar mejor estrategia
      this.updateBestStrategy(recoveryData);
    }
  }

  /**
   * Actualizar mejor estrategia
   */
  updateBestStrategy(recoveryData) {
    let bestStrategy = null;
    let bestRate = 0;
    
    for (const [strategy, stats] of recoveryData.strategies) {
      if (stats.attempts >= 3 && stats.successRate > bestRate) {
        bestStrategy = strategy;
        bestRate = stats.successRate;
      }
    }
    
    if (bestStrategy) {
      recoveryData.bestStrategy = bestStrategy;
      recoveryData.successRate = bestRate;
    }
  }

  /**
   * Obtener errores recientes para módulo
   */
  getRecentErrorsForModule(module) {
    const cutoff = Date.now() - 3600000; // 1 hora
    return this.learningData.errorSamples.filter(sample => 
      sample.error.module === module && sample.timestamp > cutoff
    );
  }

  /**
   * Extraer características de aprendizaje
   */
  extractLearningFeatures(errorData, context) {
    return {
      messageLength: errorData.message.length,
      hasStackTrace: !!(errorData.stack),
      moduleDepth: (errorData.module || '').split('/').length,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      contextSize: Object.keys(context).length,
      numericContexts: Object.values(context).filter(v => typeof v === 'number').length
    };
  }

  /**
   * Generar clave de contexto
   */
  generateContextKey(errorData) {
    return `${errorData.module}_${errorData.severity}_${errorData.metadata?.category || 'unknown'}`;
  }

  /**
   * Actualizar métricas de aprendizaje
   */
  updateLearningMetrics() {
    this.learningMetrics.lastLearningSession = Date.now();
    
    // Calcular eficiencia de aprendizaje
    const totalPatterns = this.knowledgeBase.patternLibrary.size;
    const totalContexts = this.knowledgeBase.errorContexts.size;
    
    this.learningMetrics.learningEfficiency = 
      (this.learningMetrics.patternsLearned + totalContexts) / 
      Math.max(this.learningMetrics.totalSamples, 1);
  }

  /**
   * Obtener recomendaciones basadas en aprendizaje
   */
  getRecommendations(errorData) {
    const recommendations = [];
    
    // Recomendaciones de contexto
    const contextKey = this.generateContextKey(errorData);
    const contextData = this.knowledgeBase.errorContexts.get(contextKey);
    
    if (contextData && contextData.confidence > 0.7) {
      recommendations.push({
        type: 'context',
        message: `Patrón de contexto conocido detectado (confianza: ${(contextData.confidence * 100).toFixed(1)}%)`,
        patterns: contextData.patterns
      });
    }

    // Recomendaciones de recuperación
    const strategyKey = `${errorData.module}_${errorData.severity}`;
    const recoveryData = this.knowledgeBase.recoveryStrategies.get(strategyKey);
    
    if (recoveryData && recoveryData.bestStrategy) {
      recommendations.push({
        type: 'recovery',
        message: `Estrategia de recuperación recomendada: ${recoveryData.bestStrategy}`,
        strategy: recoveryData.bestStrategy,
        successRate: recoveryData.successRate
      });
    }

    // Recomendaciones de umbral
    const thresholdData = this.knowledgeBase.adaptiveThresholds.get(errorData.module);
    
    if (thresholdData && thresholdData.confidence > 0.6) {
      recommendations.push({
        type: 'threshold',
        message: `Umbral adaptativo sugerido: ${thresholdData.errorRate.toFixed(1)} errores/hora`,
        threshold: thresholdData.errorRate
      });
    }

    return recommendations;
  }

  /**
   * Obtener estadísticas de aprendizaje
   */
  getLearningStats() {
    return {
      ...this.learningMetrics,
      knowledgeBase: {
        contexts: this.knowledgeBase.errorContexts.size,
        patterns: this.knowledgeBase.patternLibrary.size,
        thresholds: this.knowledgeBase.adaptiveThresholds.size,
        strategies: this.knowledgeBase.recoveryStrategies.size
      },
      recentSamples: this.learningData.errorSamples.slice(-10),
      isLearning: this.isLearning
    };
  }

  /**
   * Limpiar datos de aprendizaje
   */
  cleanup() {
    this.learningData.errorSamples = [];
    this.learningData.contextCorrelations.clear();
    this.learningData.temporalPatterns.clear();
    this.adaptationHistory = [];
  }
}

/**
 * Clases auxiliares para aprendizaje especializado
 */

class ContextLearner {
  async initialize(config) {
    this.config = config;
  }
}

class PatternLearner {
  async initialize(config) {
    this.config = config;
  }
}

class ThresholdAdapter {
  async initialize(config) {
    this.config = config;
  }
}

class StrategyOptimizer {
  async initialize(config) {
    this.config = config;
  }
}

export default ErrorLearningSystem;
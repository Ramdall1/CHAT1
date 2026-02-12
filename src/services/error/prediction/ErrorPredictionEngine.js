/**
 * ErrorPredictionEngine - Motor de predicción de fallos inteligente
 * 
 * Funcionalidades:
 * - Predicción de errores basada en patrones históricos
 * - Análisis de tendencias y anomalías
 * - Alertas tempranas de posibles fallos
 * - Modelos de machine learning simples
 * - Predicción de cascadas de errores
 */
class ErrorPredictionEngine {
  constructor(config = {}) {
    this.config = {
      predictionEnabled: true,
      predictionWindow: 3600000, // 1 hora en ms
      minDataPoints: 10,
      confidenceThreshold: 0.7,
      alertThreshold: 0.8,
      maxPredictions: 100,
      learningRate: 0.1,
      ...config
    };

    // Modelos de predicción
    this.predictionModels = {
      temporal: new TemporalPredictionModel(),
      frequency: new FrequencyPredictionModel(),
      pattern: new PatternPredictionModel(),
      cascade: new CascadePredictionModel()
    };

    // Datos históricos para predicción
    this.historicalData = [];
    this.errorSequences = [];
    this.predictionCache = new Map();
    
    // Predicciones activas
    this.activePredictions = [];
    this.predictionHistory = [];
    
    // Métricas de predicción
    this.predictionMetrics = {
      totalPredictions: 0,
      accuratePredictions: 0,
      falsePositives: 0,
      falseNegatives: 0,
      accuracy: 0,
      precision: 0,
      recall: 0,
      lastUpdate: null
    };

    // Configuración de alertas
    this.alertConfig = {
      enabled: true,
      channels: ['console', 'log'],
      severityLevels: {
        low: { threshold: 0.6, color: 'yellow' },
        medium: { threshold: 0.75, color: 'orange' },
        high: { threshold: 0.9, color: 'red' }
      }
    };

    // Estado del motor
    this.isActive = false;
    this.lastPredictionTime = null;
  }

  /**
   * Inicializar motor de predicción
   */
  async initialize() {
    logger.debug('🔮 Inicializando motor de predicción de errores...');
    
    try {
      // Inicializar modelos
      await this.initializePredictionModels();
      
      // Cargar datos históricos si existen
      await this.loadHistoricalData();
      
      this.isActive = true;
      logger.debug('✅ Motor de predicción inicializado correctamente');
      
    } catch (error) {
      logger.error('❌ Error inicializando motor de predicción:', error);
      throw error;
    }
  }

  /**
   * Inicializar modelos de predicción
   */
  async initializePredictionModels() {
    for (const [name, model] of Object.entries(this.predictionModels)) {
      try {
        await model.initialize(this.config);
        logger.debug(`✅ Modelo ${name} inicializado`);
      } catch (error) {
        logger.error(`❌ Error inicializando modelo ${name}:`, error);
      }
    }
  }

  /**
   * Cargar datos históricos
   */
  async loadHistoricalData() {
    // En implementación real, cargar desde base de datos o archivo
    logger.debug('📊 Cargando datos históricos para predicción...');
    
    // Simular carga de datos históricos
    this.historicalData = [];
    this.errorSequences = [];
    
    logger.debug(`📈 ${this.historicalData.length} registros históricos cargados`);
  }

  /**
   * Procesar nuevo error para predicción
   */
  async processErrorForPrediction(errorData) {
    if (!this.isActive || !this.config.predictionEnabled) return;

    try {
      // Agregar a datos históricos
      this.addToHistoricalData(errorData);
      
      // Actualizar secuencias de errores
      this.updateErrorSequences(errorData);
      
      // Generar predicciones
      const predictions = await this.generatePredictions(errorData);
      
      // Procesar predicciones
      await this.processPredictions(predictions);
      
      // Limpiar predicciones expiradas
      this.cleanupExpiredPredictions();
      
    } catch (error) {
      logger.error('Error procesando error para predicción:', error);
    }
  }

  /**
   * Agregar error a datos históricos
   */
  addToHistoricalData(errorData) {
    const dataPoint = {
      timestamp: Date.now(),
      module: errorData.module,
      severity: errorData.severity,
      category: errorData.metadata?.category || 'unknown',
      message: errorData.message,
      context: errorData.context || {},
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      features: this.extractFeatures(errorData)
    };

    this.historicalData.push(dataPoint);
    
    // Mantener solo los últimos 1000 registros
    if (this.historicalData.length > 1000) {
      this.historicalData = this.historicalData.slice(-500);
    }
  }

  /**
   * Actualizar secuencias de errores
   */
  updateErrorSequences(errorData) {
    const now = Date.now();
    const sequenceWindow = 300000; // 5 minutos
    
    // Encontrar secuencia activa o crear nueva
    let activeSequence = this.errorSequences.find(seq => 
      now - seq.lastUpdate < sequenceWindow
    );
    
    if (!activeSequence) {
      activeSequence = {
        id: this.generateSequenceId(),
        startTime: now,
        lastUpdate: now,
        errors: [],
        modules: new Set(),
        severities: new Set()
      };
      this.errorSequences.push(activeSequence);
    }
    
    // Agregar error a la secuencia
    activeSequence.errors.push({
      timestamp: now,
      module: errorData.module,
      severity: errorData.severity,
      message: errorData.message
    });
    
    activeSequence.lastUpdate = now;
    activeSequence.modules.add(errorData.module);
    activeSequence.severities.add(errorData.severity);
    
    // Limpiar secuencias antiguas
    this.errorSequences = this.errorSequences.filter(seq => 
      now - seq.lastUpdate < sequenceWindow * 2
    );
  }

  /**
   * Generar predicciones
   */
  async generatePredictions(triggerError) {
    const predictions = [];
    
    try {
      // Predicción temporal
      const temporalPrediction = await this.predictionModels.temporal
        .predict(this.historicalData, triggerError);
      if (temporalPrediction) predictions.push(temporalPrediction);
      
      // Predicción por frecuencia
      const frequencyPrediction = await this.predictionModels.frequency
        .predict(this.historicalData, triggerError);
      if (frequencyPrediction) predictions.push(frequencyPrediction);
      
      // Predicción por patrones
      const patternPrediction = await this.predictionModels.pattern
        .predict(this.historicalData, triggerError);
      if (patternPrediction) predictions.push(patternPrediction);
      
      // Predicción de cascada
      const cascadePrediction = await this.predictionModels.cascade
        .predict(this.errorSequences, triggerError);
      if (cascadePrediction) predictions.push(cascadePrediction);
      
    } catch (error) {
      logger.error('Error generando predicciones:', error);
    }
    
    return predictions;
  }

  /**
   * Procesar predicciones generadas
   */
  async processPredictions(predictions) {
    for (const prediction of predictions) {
      // Validar predicción
      if (!this.validatePrediction(prediction)) continue;
      
      // Verificar si ya existe predicción similar
      const existingPrediction = this.findSimilarPrediction(prediction);
      if (existingPrediction) {
        this.updateExistingPrediction(existingPrediction, prediction);
        continue;
      }
      
      // Agregar nueva predicción
      this.activePredictions.push({
        ...prediction,
        id: this.generatePredictionId(),
        createdAt: Date.now(),
        status: 'active',
        alerts: []
      });
      
      // Generar alerta si es necesario
      if (prediction.confidence >= this.config.alertThreshold) {
        await this.generateAlert(prediction);
      }
      
      logger.debug(`🔮 Nueva predicción: ${prediction.type} - Confianza: ${(prediction.confidence * 100).toFixed(1)}%`);
    }
    
    // Mantener límite de predicciones activas
    if (this.activePredictions.length > this.config.maxPredictions) {
      this.activePredictions = this.activePredictions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.config.maxPredictions);
    }
  }

  /**
   * Validar predicción
   */
  validatePrediction(prediction) {
    return prediction &&
           prediction.confidence >= this.config.confidenceThreshold &&
           prediction.type &&
           prediction.expectedTime &&
           prediction.expectedTime > Date.now();
  }

  /**
   * Buscar predicción similar
   */
  findSimilarPrediction(newPrediction) {
    return this.activePredictions.find(existing => 
      existing.type === newPrediction.type &&
      existing.module === newPrediction.module &&
      Math.abs(existing.expectedTime - newPrediction.expectedTime) < 300000 // 5 minutos
    );
  }

  /**
   * Actualizar predicción existente
   */
  updateExistingPrediction(existing, newPrediction) {
    // Promediar confianza
    existing.confidence = (existing.confidence + newPrediction.confidence) / 2;
    
    // Actualizar tiempo esperado
    existing.expectedTime = (existing.expectedTime + newPrediction.expectedTime) / 2;
    
    // Incrementar contador de refuerzos
    existing.reinforcements = (existing.reinforcements || 0) + 1;
    
    logger.debug(`🔄 Predicción reforzada: ${existing.type} - Nueva confianza: ${(existing.confidence * 100).toFixed(1)}%`);
  }

  /**
   * Generar alerta de predicción
   */
  async generateAlert(prediction) {
    const severity = this.calculateAlertSeverity(prediction.confidence);
    const timeToError = prediction.expectedTime - Date.now();
    
    const alert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      type: 'prediction',
      severity,
      prediction: prediction.type,
      module: prediction.module,
      confidence: prediction.confidence,
      timeToError,
      message: this.generateAlertMessage(prediction, timeToError)
    };
    
    // Enviar alerta
    await this.sendAlert(alert);
    
    // Agregar alerta a la predicción
    const activePrediction = this.activePredictions.find(p => 
      p.type === prediction.type && p.module === prediction.module
    );
    if (activePrediction) {
      activePrediction.alerts.push(alert);
    }
  }

  /**
   * Calcular severidad de alerta
   */
  calculateAlertSeverity(confidence) {
    if (confidence >= this.alertConfig.severityLevels.high.threshold) return 'high';
    if (confidence >= this.alertConfig.severityLevels.medium.threshold) return 'medium';
    return 'low';
  }

  /**
   * Generar mensaje de alerta
   */
  generateAlertMessage(prediction, timeToError) {
    const timeStr = this.formatTimeToError(timeToError);
    const confidenceStr = (prediction.confidence * 100).toFixed(1);
    
    return `🚨 Predicción de error: ${prediction.type} en módulo ${prediction.module} ` +
           `en aproximadamente ${timeStr} (confianza: ${confidenceStr}%)`;
  }

  /**
   * Formatear tiempo hasta error
   */
  formatTimeToError(timeMs) {
    const minutes = Math.floor(timeMs / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${Math.floor(timeMs / 1000)}s`;
    }
  }

  /**
   * Enviar alerta
   */
  async sendAlert(alert) {
    if (!this.alertConfig.enabled) return;
    
    for (const channel of this.alertConfig.channels) {
      try {
        await this.sendAlertToChannel(alert, channel);
      } catch (error) {
        logger.error(`Error enviando alerta a ${channel}:`, error);
      }
    }
  }

  /**
   * Enviar alerta a canal específico
   */
  async sendAlertToChannel(alert, channel) {
    switch (channel) {
      case 'console':
        const color = this.alertConfig.severityLevels[alert.severity].color;
        logger.debug(`\x1b[33m${alert.message}\x1b[0m`);
        break;
        
      case 'log':
        // En implementación real, escribir a archivo de log
        logger.debug(`[PREDICTION ALERT] ${alert.message}`);
        break;
        
      default:
        logger.debug(`Alerta: ${alert.message}`);
    }
  }

  /**
   * Verificar predicciones cumplidas
   */
  async verifyPredictions(actualError) {
    const now = Date.now();
    const verificationWindow = 600000; // 10 minutos
    
    for (const prediction of this.activePredictions) {
      if (prediction.status !== 'active') continue;
      
      // Verificar si la predicción se cumplió
      const timeDiff = Math.abs(now - prediction.expectedTime);
      const isMatch = this.isPredictionMatch(prediction, actualError);
      
      if (isMatch && timeDiff <= verificationWindow) {
        // Predicción correcta
        prediction.status = 'fulfilled';
        prediction.actualTime = now;
        prediction.accuracy = 1 - (timeDiff / verificationWindow);
        
        this.updatePredictionMetrics(prediction, true);
        logger.debug(`✅ Predicción cumplida: ${prediction.type} - Precisión: ${(prediction.accuracy * 100).toFixed(1)}%`);
        
      } else if (now > prediction.expectedTime + verificationWindow) {
        // Predicción expirada sin cumplirse
        prediction.status = 'expired';
        this.updatePredictionMetrics(prediction, false);
        logger.debug(`❌ Predicción expirada: ${prediction.type}`);
      }
    }
    
    // Mover predicciones completadas al historial
    const completedPredictions = this.activePredictions.filter(p => 
      p.status === 'fulfilled' || p.status === 'expired'
    );
    
    this.predictionHistory.push(...completedPredictions);
    this.activePredictions = this.activePredictions.filter(p => p.status === 'active');
    
    // Mantener historial limitado
    if (this.predictionHistory.length > 200) {
      this.predictionHistory = this.predictionHistory.slice(-100);
    }
  }

  /**
   * Verificar si predicción coincide con error actual
   */
  isPredictionMatch(prediction, actualError) {
    return prediction.module === actualError.module &&
           prediction.type === actualError.metadata?.category &&
           prediction.severity === actualError.severity;
  }

  /**
   * Actualizar métricas de predicción
   */
  updatePredictionMetrics(prediction, wasAccurate) {
    this.predictionMetrics.totalPredictions++;
    
    if (wasAccurate) {
      this.predictionMetrics.accuratePredictions++;
    } else {
      this.predictionMetrics.falsePositives++;
    }
    
    // Calcular métricas
    const total = this.predictionMetrics.totalPredictions;
    this.predictionMetrics.accuracy = this.predictionMetrics.accuratePredictions / total;
    this.predictionMetrics.precision = this.predictionMetrics.accuratePredictions / 
      (this.predictionMetrics.accuratePredictions + this.predictionMetrics.falsePositives);
    
    this.predictionMetrics.lastUpdate = Date.now();
  }

  /**
   * Limpiar predicciones expiradas
   */
  cleanupExpiredPredictions() {
    const now = Date.now();
    const maxAge = this.config.predictionWindow * 2;
    
    this.activePredictions = this.activePredictions.filter(prediction => 
      now - prediction.createdAt < maxAge
    );
  }

  /**
   * Extraer características del error
   */
  extractFeatures(errorData) {
    return {
      messageLength: errorData.message.length,
      hasStackTrace: !!(errorData.stack),
      moduleDepth: (errorData.module || '').split('/').length,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      hasMetadata: !!(errorData.metadata && Object.keys(errorData.metadata).length > 0)
    };
  }

  /**
   * Generar IDs únicos
   */
  generatePredictionId() {
    return `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSequenceId() {
    return `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtener estadísticas de predicción
   */
  getPredictionStats() {
    return {
      ...this.predictionMetrics,
      activePredictions: this.activePredictions.length,
      historicalDataPoints: this.historicalData.length,
      errorSequences: this.errorSequences.length,
      recentPredictions: this.predictionHistory.slice(-10),
      topPredictionTypes: this.getTopPredictionTypes()
    };
  }

  /**
   * Obtener tipos de predicción más comunes
   */
  getTopPredictionTypes() {
    const typeCounts = {};
    
    this.predictionHistory.forEach(prediction => {
      typeCounts[prediction.type] = (typeCounts[prediction.type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Limpiar datos del motor
   */
  cleanup() {
    this.historicalData = [];
    this.errorSequences = [];
    this.activePredictions = [];
    this.predictionHistory = [];
    this.predictionCache.clear();
  }
}

/**
 * Modelos de predicción especializados
 */

class TemporalPredictionModel {
  async initialize(config) {
    this.config = config;
    this.patterns = new Map();
  }

  async predict(historicalData, triggerError) {
    // Análisis temporal simple
    const recentErrors = historicalData.filter(error => 
      Date.now() - error.timestamp < 3600000 && // última hora
      error.module === triggerError.module
    );

    if (recentErrors.length < 3) return null;

    const avgInterval = this.calculateAverageInterval(recentErrors);
    const confidence = Math.min(recentErrors.length / 10, 0.9);

    return {
      type: 'temporal_pattern',
      module: triggerError.module,
      expectedTime: Date.now() + avgInterval,
      confidence,
      model: 'temporal'
    };
  }

  calculateAverageInterval(errors) {
    if (errors.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < errors.length; i++) {
      intervals.push(errors[i].timestamp - errors[i-1].timestamp);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }
}

class FrequencyPredictionModel {
  async initialize(config) {
    this.config = config;
    this.frequencies = new Map();
  }

  async predict(historicalData, triggerError) {
    const moduleErrors = historicalData.filter(error => 
      error.module === triggerError.module
    );

    if (moduleErrors.length < 5) return null;

    const frequency = moduleErrors.length / (Date.now() - moduleErrors[0].timestamp) * 3600000;
    const confidence = Math.min(frequency / 10, 0.8);

    if (confidence < 0.5) return null;

    return {
      type: 'frequency_pattern',
      module: triggerError.module,
      expectedTime: Date.now() + (1 / frequency * 3600000),
      confidence,
      model: 'frequency'
    };
  }
}

class PatternPredictionModel {
  async initialize(config) {
    this.config = config;
    this.patterns = new Map();
  }

  async predict(historicalData, triggerError) {
    // Buscar patrones de secuencia
    const pattern = this.findSequencePattern(historicalData, triggerError);
    
    if (!pattern) return null;

    return {
      type: 'sequence_pattern',
      module: pattern.nextModule,
      expectedTime: Date.now() + pattern.avgDelay,
      confidence: pattern.confidence,
      model: 'pattern'
    };
  }

  findSequencePattern(historicalData, triggerError) {
    // Implementación simplificada de detección de patrones
    const sequences = this.extractSequences(historicalData);
    const matchingSequences = sequences.filter(seq => 
      seq.includes(triggerError.module)
    );

    if (matchingSequences.length < 2) return null;

    // Encontrar módulo que sigue más frecuentemente
    const nextModules = {};
    matchingSequences.forEach(seq => {
      const index = seq.indexOf(triggerError.module);
      if (index < seq.length - 1) {
        const nextModule = seq[index + 1];
        nextModules[nextModule] = (nextModules[nextModule] || 0) + 1;
      }
    });

    const mostCommon = Object.entries(nextModules)
      .sort(([,a], [,b]) => b - a)[0];

    if (!mostCommon) return null;

    return {
      nextModule: mostCommon[0],
      avgDelay: 300000, // 5 minutos promedio
      confidence: Math.min(mostCommon[1] / matchingSequences.length, 0.8)
    };
  }

  extractSequences(historicalData) {
    // Simplificado: extraer secuencias de módulos en ventanas de tiempo
    const sequences = [];
    const windowSize = 600000; // 10 minutos
    
    for (let i = 0; i < historicalData.length - 1; i++) {
      const sequence = [historicalData[i].module];
      let j = i + 1;
      
      while (j < historicalData.length && 
             historicalData[j].timestamp - historicalData[i].timestamp < windowSize) {
        sequence.push(historicalData[j].module);
        j++;
      }
      
      if (sequence.length > 1) {
        sequences.push(sequence);
      }
    }
    
    return sequences;
  }
}

class CascadePredictionModel {
  async initialize(config) {
    this.config = config;
    this.cascadePatterns = new Map();
  }

  async predict(errorSequences, triggerError) {
    // Buscar patrones de cascada en secuencias activas
    const activeSequence = errorSequences.find(seq => 
      seq.modules.has(triggerError.module)
    );

    if (!activeSequence || activeSequence.errors.length < 2) return null;

    const cascadeRisk = this.calculateCascadeRisk(activeSequence);
    
    if (cascadeRisk < 0.6) return null;

    return {
      type: 'cascade_failure',
      module: this.predictNextCascadeModule(activeSequence),
      expectedTime: Date.now() + 120000, // 2 minutos
      confidence: cascadeRisk,
      model: 'cascade'
    };
  }

  calculateCascadeRisk(sequence) {
    const errorCount = sequence.errors.length;
    const moduleCount = sequence.modules.size;
    const timeSpan = sequence.lastUpdate - sequence.startTime;
    
    // Riesgo basado en velocidad de errores y diversidad de módulos
    const errorRate = errorCount / (timeSpan / 60000); // errores por minuto
    const moduleSpread = moduleCount / errorCount;
    
    return Math.min((errorRate * 0.3 + moduleSpread * 0.7), 0.95);
  }

  predictNextCascadeModule(sequence) {
    // Predicción simple: módulo que aún no ha fallado pero está relacionado
    const failedModules = Array.from(sequence.modules);
    const relatedModules = ['database', 'cache', 'api', 'auth', 'storage'];
    
    const candidates = relatedModules.filter(module => 
      !failedModules.includes(module)
    );
    
    return candidates[0] || 'unknown';
  }
}

export default ErrorPredictionEngine;
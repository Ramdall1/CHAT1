import { createLogger } from '../core/evolutive-logger.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

/**
 * LearningAgent - Agente de aprendizaje automático evolutivo
 * Responsable de:
 * - Analizar patrones históricos de eventos
 * - Detectar rutas exitosas y optimizaciones
 * - Reordenar prioridades dinámicamente
 * - Generar recomendaciones automáticas
 * - Actualizar reglas sin reiniciar el sistema
 * - Predecir comportamientos futuros
 */
class LearningAgent {
  constructor(eventHub) {
    this.eventHub = eventHub;
    this.logger = createLogger('LEARNING_AGENT');
    this.agentId = uuidv4();
        
    // Estado del agente
    this.isActive = false;
    this.learningModel = new Map();
    this.successfulPatterns = new Map();
    this.optimizationRules = new Map();
    this.predictions = new Map();
    this.performanceMetrics = new Map();
        
    // Métricas
    this.metrics = {
      patternsLearned: 0,
      optimizationsApplied: 0,
      predictionsGenerated: 0,
      rulesUpdated: 0,
      successfulPredictions: 0,
      modelAccuracy: 0
    };
        
    // Configuración
    this.config = {
      learningWindow: 3600000, // 1 hora
      minPatternOccurrences: 10,
      confidenceThreshold: 0.7,
      learningRate: 0.1,
      maxModelSize: 1000,
      predictionHorizon: 300000, // 5 minutos
      optimizationInterval: 60000, // 1 minuto
      modelPersistenceInterval: 300000, // 5 minutos
      adaptationThreshold: 0.8
    };
        
    // Rutas de almacenamiento
    this.storageDir = path.join(process.cwd(), 'storage', 'learning');
    this.modelPath = path.join(this.storageDir, 'learning_model.json');
    this.patternsPath = path.join(this.storageDir, 'successful_patterns.json');
    this.rulesPath = path.join(this.storageDir, 'optimization_rules.json');
        
    // Tipos de aprendizaje
    this.learningTypes = {
      PATTERN_RECOGNITION: 'pattern_recognition',
      PERFORMANCE_OPTIMIZATION: 'performance_optimization',
      PREDICTIVE_ANALYSIS: 'predictive_analysis',
      ADAPTIVE_RULES: 'adaptive_rules'
    };
        
    this.logger.info('🧠 LearningAgent inicializado');
  }

  /**
     * Activar el agente de aprendizaje
     */
  async activate() {
    if (this.isActive) {
      this.logger.warn('LearningAgent ya está activo');
      return;
    }

    this.isActive = true;
        
    // Asegurar directorio de almacenamiento
    await this.ensureStorageDirectory();
        
    // Cargar modelo persistido
    await this.loadPersistedModel();
        
    // Registrar el agente
    this.eventHub.registerAgent('LearningAgent', this, [
      'pattern_learning',
      'performance_optimization',
      'predictive_analysis',
      'rule_adaptation',
      'continuous_improvement'
    ]);

    // Configurar listeners
    this.setupLearningListeners();
        
    // Iniciar procesos de aprendizaje
    this.startLearningProcesses();
        
    // Emitir evento de activación
    this.eventHub.emitEvolutive('system.learning_activated', {
      agentId: this.agentId,
      modelSize: this.learningModel.size,
      patternsCount: this.successfulPatterns.size,
      timestamp: new Date().toISOString()
    }, { source: 'LearningAgent', priority: 'medium' });

    this.logger.info('🧠 LearningAgent activado - Iniciando aprendizaje continuo');
  }

  /**
     * Configurar listeners para aprendizaje
     */
  setupLearningListeners() {
    // Aprender de todos los eventos
    this.eventHub.onEvolutive('*', (event) => {
      this.learnFromEvent(event);
    }, { agentName: 'LearningAgent' });
        
    // Aprender de patrones detectados por ObserverAgent
    this.eventHub.onEvolutive('ai.pattern_discovered', (event) => {
      this.learnFromPattern(event);
    }, { agentName: 'LearningAgent' });
        
    // Aprender de recuperaciones exitosas
    this.eventHub.onEvolutive('system.recovery_successful', (event) => {
      this.learnFromRecovery(event);
    }, { agentName: 'LearningAgent' });
        
    // Aprender de sugerencias aplicadas
    this.eventHub.onEvolutive('system.suggestion_applied', (event) => {
      this.learnFromSuggestion(event);
    }, { agentName: 'LearningAgent' });
  }

  /**
     * Aprender de un evento individual
     */
  learnFromEvent(event) {
    if (!this.isActive) return;

    try {
      // Extraer características del evento
      const features = this.extractEventFeatures(event);
            
      // Actualizar modelo de aprendizaje
      this.updateLearningModel(features);
            
      // Analizar rendimiento
      this.analyzePerformance(event, features);
            
      // Detectar oportunidades de optimización
      this.detectOptimizationOpportunities(event, features);
            
    } catch (error) {
      this.logger.error('Error aprendiendo de evento:', error, { eventId: event.id });
    }
  }

  /**
     * Extraer características de un evento
     */
  extractEventFeatures(event) {
    const timestamp = new Date(event.metadata.timestamp);
        
    return {
      eventType: event.type,
      category: event.type.split('.')[0],
      source: event.metadata.source,
      priority: event.metadata.priority,
      hour: timestamp.getHours(),
      dayOfWeek: timestamp.getDay(),
      payloadSize: JSON.stringify(event.payload).length,
      hasError: event.type.includes('error'),
      processingTime: event.payload.processingTime || null,
      sequence: event.metadata.sequence,
      correlationId: event.metadata.correlationId
    };
  }

  /**
     * Actualizar modelo de aprendizaje
     */
  updateLearningModel(features) {
    const key = `${features.category}_${features.eventType}`;
        
    if (!this.learningModel.has(key)) {
      this.learningModel.set(key, {
        count: 0,
        features: {},
        performance: {
          avgProcessingTime: 0,
          successRate: 1,
          errorRate: 0
        },
        patterns: [],
        lastUpdated: new Date()
      });
    }
        
    const model = this.learningModel.get(key);
    model.count++;
    model.lastUpdated = new Date();
        
    // Actualizar características promedio
    for (const [feature, value] of Object.entries(features)) {
      if (typeof value === 'number') {
        if (!model.features[feature]) {
          model.features[feature] = { sum: 0, count: 0, avg: 0 };
        }
        model.features[feature].sum += value;
        model.features[feature].count++;
        model.features[feature].avg = model.features[feature].sum / model.features[feature].count;
      }
    }
        
    // Actualizar métricas de rendimiento
    if (features.processingTime) {
      model.performance.avgProcessingTime = 
                (model.performance.avgProcessingTime + features.processingTime) / 2;
    }
        
    if (features.hasError) {
      model.performance.errorRate = 
                (model.performance.errorRate * (model.count - 1) + 1) / model.count;
      model.performance.successRate = 1 - model.performance.errorRate;
    }
        
    // Mantener tamaño del modelo
    if (this.learningModel.size > this.config.maxModelSize) {
      this.pruneModel();
    }
  }

  /**
     * Aprender de un patrón detectado
     */
  learnFromPattern(event) {
    const pattern = event.payload;
    const patternKey = pattern.sequence || pattern.pattern;
        
    if (!this.successfulPatterns.has(patternKey)) {
      this.successfulPatterns.set(patternKey, {
        sequence: patternKey,
        confidence: pattern.confidence,
        occurrences: 1,
        avgTimeBetween: pattern.avgTimeBetween || 0,
        category: pattern.category || 'unknown',
        learnedAt: new Date(),
        lastSeen: new Date(),
        effectiveness: 1.0
      });
    } else {
      const existing = this.successfulPatterns.get(patternKey);
      existing.occurrences++;
      existing.confidence = Math.max(existing.confidence, pattern.confidence);
      existing.lastSeen = new Date();
            
      // Actualizar efectividad basada en frecuencia
      existing.effectiveness = Math.min(existing.occurrences / 100, 1.0);
    }
        
    this.metrics.patternsLearned++;
        
    // Generar regla de optimización si el patrón es muy efectivo
    const patternData = this.successfulPatterns.get(patternKey);
    if (patternData.effectiveness > this.config.adaptationThreshold) {
      this.generateOptimizationRule(patternData);
    }
  }

  /**
     * Aprender de una recuperación exitosa
     */
  learnFromRecovery(event) {
    const recovery = event.payload;
    const strategyKey = `${recovery.component}_${recovery.strategy}`;
        
    // Registrar estrategia exitosa
    if (!this.successfulPatterns.has(strategyKey)) {
      this.successfulPatterns.set(strategyKey, {
        type: 'recovery_strategy',
        component: recovery.component,
        strategy: recovery.strategy,
        successCount: 1,
        totalAttempts: 1,
        successRate: 1.0,
        learnedAt: new Date(),
        lastUsed: new Date()
      });
    } else {
      const existing = this.successfulPatterns.get(strategyKey);
      existing.successCount++;
      existing.totalAttempts++;
      existing.successRate = existing.successCount / existing.totalAttempts;
      existing.lastUsed = new Date();
    }
        
    // Generar recomendación para priorizar esta estrategia
    this.generateRecommendation('prioritize_recovery_strategy', {
      component: recovery.component,
      strategy: recovery.strategy,
      successRate: this.successfulPatterns.get(strategyKey).successRate,
      confidence: 0.9
    });
  }

  /**
     * Analizar rendimiento
     */
  analyzePerformance(event, features) {
    const performanceKey = `${features.category}_performance`;
        
    if (!this.performanceMetrics.has(performanceKey)) {
      this.performanceMetrics.set(performanceKey, {
        totalEvents: 0,
        avgProcessingTime: 0,
        errorRate: 0,
        throughput: 0,
        lastAnalysis: new Date(),
        trends: []
      });
    }
        
    const metrics = this.performanceMetrics.get(performanceKey);
    metrics.totalEvents++;
        
    if (features.processingTime) {
      metrics.avgProcessingTime = 
                (metrics.avgProcessingTime + features.processingTime) / 2;
    }
        
    if (features.hasError) {
      metrics.errorRate = 
                (metrics.errorRate * (metrics.totalEvents - 1) + 1) / metrics.totalEvents;
    }
        
    // Calcular throughput (eventos por minuto)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentEvents = Array.from(this.learningModel.values())
      .filter(model => model.lastUpdated > oneMinuteAgo)
      .reduce((sum, model) => sum + model.count, 0);
        
    metrics.throughput = recentEvents;
    metrics.lastAnalysis = now;
        
    // Detectar degradación de rendimiento
    if (metrics.trends.length >= 5) {
      const recentTrend = metrics.trends.slice(-5);
      const avgRecent = recentTrend.reduce((sum, t) => sum + t.value, 0) / 5;
      const previousTrend = metrics.trends.slice(-10, -5);
            
      if (previousTrend.length === 5) {
        const avgPrevious = previousTrend.reduce((sum, t) => sum + t.value, 0) / 5;
                
        if (avgRecent < avgPrevious * 0.8) { // 20% degradación
          this.generateRecommendation('performance_degradation', {
            category: features.category,
            currentPerformance: avgRecent,
            previousPerformance: avgPrevious,
            degradation: (avgPrevious - avgRecent) / avgPrevious,
            suggestion: 'Performance degradation detected - investigate bottlenecks'
          });
        }
      }
    }
        
    // Agregar punto de tendencia
    metrics.trends.push({
      timestamp: now,
      value: features.processingTime || metrics.throughput,
      type: features.processingTime ? 'processing_time' : 'throughput'
    });
        
    // Mantener solo las últimas 20 tendencias
    if (metrics.trends.length > 20) {
      metrics.trends.shift();
    }
  }

  /**
     * Detectar oportunidades de optimización
     */
  detectOptimizationOpportunities(event, features) {
    // Detectar eventos lentos
    if (features.processingTime && features.processingTime > 5000) { // > 5 segundos
      this.generateRecommendation('slow_processing', {
        eventType: features.eventType,
        processingTime: features.processingTime,
        source: features.source,
        suggestion: 'Consider optimizing processing logic or adding caching'
      });
    }
        
    // Detectar eventos de alta frecuencia sin batching
    const recentSimilar = this.getRecentSimilarEvents(features, 60000); // 1 minuto
    if (recentSimilar.length > 20) {
      this.generateRecommendation('high_frequency_batching', {
        eventType: features.eventType,
        frequency: recentSimilar.length,
        timeWindow: '1 minute',
        suggestion: 'Consider implementing event batching for better performance'
      });
    }
        
    // Detectar patrones de error recurrentes
    if (features.hasError) {
      const errorPattern = this.analyzeErrorPattern(features);
      if (errorPattern.isRecurring) {
        this.generateRecommendation('recurring_error_pattern', {
          eventType: features.eventType,
          source: features.source,
          frequency: errorPattern.frequency,
          suggestion: 'Recurring error pattern detected - implement preventive measures'
        });
      }
    }
  }

  /**
     * Obtener eventos similares recientes
     */
  getRecentSimilarEvents(features, timeWindow) {
    const cutoff = Date.now() - timeWindow;
    const similar = [];
        
    for (const model of this.learningModel.values()) {
      if (model.lastUpdated.getTime() > cutoff &&
                model.features.eventType === features.eventType) {
        similar.push(model);
      }
    }
        
    return similar;
  }

  /**
     * Analizar patrón de error
     */
  analyzeErrorPattern(features) {
    const errorKey = `${features.eventType}_${features.source}`;
    const recentErrors = this.getRecentSimilarEvents(features, 300000); // 5 minutos
        
    return {
      isRecurring: recentErrors.length >= 3,
      frequency: recentErrors.length,
      pattern: errorKey
    };
  }

  /**
     * Generar regla de optimización
     */
  generateOptimizationRule(patternData) {
    const ruleId = uuidv4();
    const rule = {
      id: ruleId,
      type: 'pattern_optimization',
      pattern: patternData.sequence,
      condition: (event) => {
        // Verificar si el evento coincide con el patrón
        return event.type.includes(patternData.sequence.split(' -> ')[0]);
      },
      action: (event, eventHub) => {
        // Aplicar optimización basada en el patrón aprendido
        eventHub.emitEvolutive('system.pattern_optimization_applied', {
          ruleId,
          pattern: patternData.sequence,
          eventId: event.id,
          optimization: 'Pattern-based priority adjustment'
        }, { source: 'LearningAgent', priority: 'low' });
      },
      confidence: patternData.effectiveness,
      createdAt: new Date(),
      appliedCount: 0
    };
        
    this.optimizationRules.set(ruleId, rule);
    this.metrics.rulesUpdated++;
        
    // Agregar regla al EventHub
    this.eventHub.addAdaptiveRule(`learning_rule_${ruleId}`, rule.condition, rule.action);
        
    this.logger.info(`📋 Nueva regla de optimización creada: ${rule.pattern}`);
  }

  /**
     * Generar recomendación
     */
  generateRecommendation(type, details) {
    const recommendation = {
      id: uuidv4(),
      type,
      details,
      confidence: details.confidence || 0.8,
      generatedAt: new Date().toISOString(),
      agentId: this.agentId,
      category: 'learning_optimization'
    };
        
    this.metrics.predictionsGenerated++;
        
    this.eventHub.emitEvolutive('ai.learning_recommendation', {
      recommendation,
      agentId: this.agentId
    }, { source: 'LearningAgent', priority: 'low' });
        
    this.logger.info(`🎯 Recomendación generada: ${type}`, details);
  }

  /**
     * Generar predicciones
     */
  generatePredictions() {
    const now = new Date();
    const predictions = [];
        
    // Predecir volumen de eventos basado en patrones históricos
    for (const [key, model] of this.learningModel) {
      if (model.count >= this.config.minPatternOccurrences) {
        const prediction = this.predictEventVolume(key, model);
        if (prediction.confidence > this.config.confidenceThreshold) {
          predictions.push(prediction);
        }
      }
    }
        
    // Predecir posibles problemas
    const problemPredictions = this.predictPotentialProblems();
    predictions.push(...problemPredictions);
        
    // Emitir predicciones
    if (predictions.length > 0) {
      this.eventHub.emitEvolutive('ai.predictions_generated', {
        predictions,
        generatedAt: now.toISOString(),
        agentId: this.agentId
      }, { source: 'LearningAgent', priority: 'low' });
    }
        
    return predictions;
  }

  /**
     * Predecir volumen de eventos
     */
  predictEventVolume(eventKey, model) {
    const hourlyPattern = this.analyzeHourlyPattern(model);
    const currentHour = new Date().getHours();
    const expectedVolume = hourlyPattern[currentHour] || model.count / 24;
        
    return {
      type: 'volume_prediction',
      eventType: eventKey,
      expectedVolume: Math.round(expectedVolume),
      timeHorizon: '1 hour',
      confidence: Math.min(model.count / 100, 0.9),
      basedOn: 'historical_patterns'
    };
  }

  /**
     * Predecir problemas potenciales
     */
  predictPotentialProblems() {
    const predictions = [];
        
    // Predecir sobrecarga basada en tendencias
    for (const [key, metrics] of this.performanceMetrics) {
      if (metrics.trends.length >= 5) {
        const recentTrend = this.calculateTrendSlope(metrics.trends.slice(-5));
                
        if (recentTrend > 0.1) { // Tendencia creciente
          predictions.push({
            type: 'potential_overload',
            category: key.replace('_performance', ''),
            trend: recentTrend,
            confidence: 0.7,
            timeToOverload: this.estimateTimeToOverload(metrics),
            suggestion: 'Consider scaling resources or optimizing performance'
          });
        }
      }
    }
        
    return predictions;
  }

  /**
     * Analizar patrón horario
     */
  analyzeHourlyPattern(model) {
    const hourlyCount = new Array(24).fill(0);
        
    // Simplificado: distribución uniforme con variaciones
    for (let hour = 0; hour < 24; hour++) {
      // Simular patrón típico de actividad
      if (hour >= 9 && hour <= 17) { // Horas laborales
        hourlyCount[hour] = model.count * 0.08; // 8% por hora
      } else if (hour >= 18 && hour <= 22) { // Tarde
        hourlyCount[hour] = model.count * 0.04; // 4% por hora
      } else { // Noche/madrugada
        hourlyCount[hour] = model.count * 0.01; // 1% por hora
      }
    }
        
    return hourlyCount;
  }

  /**
     * Calcular pendiente de tendencia
     */
  calculateTrendSlope(trends) {
    if (trends.length < 2) return 0;
        
    const n = trends.length;
    const x = trends.map((_, i) => i);
    const y = trends.map(t => t.value);
        
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
     * Estimar tiempo hasta sobrecarga
     */
  estimateTimeToOverload(metrics) {
    const currentThroughput = metrics.throughput;
    const maxCapacity = currentThroughput * 5; // Asumiendo 5x capacidad actual
    const growthRate = this.calculateTrendSlope(metrics.trends.slice(-5));
        
    if (growthRate <= 0) return Infinity;
        
    const timeToOverload = (maxCapacity - currentThroughput) / growthRate;
    return Math.max(0, timeToOverload * 60000); // Convertir a milisegundos
  }

  /**
     * Podar modelo para mantener tamaño
     */
  pruneModel() {
    // Eliminar modelos con menos actividad
    const sortedModels = Array.from(this.learningModel.entries())
      .sort((a, b) => a[1].count - b[1].count);
        
    const toRemove = sortedModels.slice(0, Math.floor(this.config.maxModelSize * 0.1));
        
    for (const [key] of toRemove) {
      this.learningModel.delete(key);
    }
        
    this.logger.debug(`🧹 Modelo podado: eliminados ${toRemove.length} elementos`);
  }

  /**
     * Iniciar procesos de aprendizaje
     */
  startLearningProcesses() {
    // Optimización periódica
    setInterval(() => {
      if (this.isActive) {
        this.performOptimization();
      }
    }, this.config.optimizationInterval);
        
    // Generación de predicciones
    setInterval(() => {
      if (this.isActive) {
        this.generatePredictions();
      }
    }, this.config.predictionHorizon);
        
    // Persistencia del modelo
    setInterval(() => {
      if (this.isActive) {
        this.persistModel();
      }
    }, this.config.modelPersistenceInterval);
  }

  /**
     * Realizar optimización
     */
  performOptimization() {
    try {
      // Actualizar reglas basadas en nuevos aprendizajes
      this.updateOptimizationRules();
            
      // Calcular precisión del modelo
      this.calculateModelAccuracy();
            
      // Limpiar datos antiguos
      this.cleanupOldData();
            
      this.metrics.optimizationsApplied++;
            
      this.logger.debug('🔧 Optimización periódica completada');
    } catch (error) {
      this.logger.error('Error en optimización:', error);
    }
  }

  /**
     * Actualizar reglas de optimización
     */
  updateOptimizationRules() {
    for (const [ruleId, rule] of this.optimizationRules) {
      // Evaluar efectividad de la regla
      if (rule.appliedCount > 10) {
        const effectiveness = rule.appliedCount / (rule.appliedCount + 1); // Simplificado
                
        if (effectiveness < 0.5) {
          // Eliminar regla inefectiva
          this.optimizationRules.delete(ruleId);
          this.logger.info(`🗑️ Regla inefectiva eliminada: ${ruleId}`);
        } else {
          // Actualizar confianza de la regla
          rule.confidence = Math.min(rule.confidence * 1.1, 1.0);
        }
      }
    }
  }

  /**
     * Calcular precisión del modelo
     */
  calculateModelAccuracy() {
    // Simplificado: basado en la efectividad de las predicciones
    const totalPredictions = this.metrics.predictionsGenerated;
    const successfulPredictions = this.metrics.successfulPredictions;
        
    if (totalPredictions > 0) {
      this.metrics.modelAccuracy = successfulPredictions / totalPredictions;
    }
  }

  /**
     * Limpiar datos antiguos
     */
  cleanupOldData() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 horas
        
    // Limpiar modelos antiguos sin actividad reciente
    for (const [key, model] of this.learningModel) {
      if (model.lastUpdated.getTime() < cutoff && model.count < 5) {
        this.learningModel.delete(key);
      }
    }
        
    // Limpiar patrones antiguos
    for (const [key, pattern] of this.successfulPatterns) {
      if (pattern.lastSeen && pattern.lastSeen.getTime() < cutoff) {
        this.successfulPatterns.delete(key);
      }
    }
  }

  /**
     * Asegurar directorio de almacenamiento
     */
  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      this.logger.error('Error creando directorio de almacenamiento:', error);
    }
  }

  /**
     * Persistir modelo
     */
  async persistModel() {
    try {
      const modelData = {
        learningModel: Object.fromEntries(this.learningModel),
        successfulPatterns: Object.fromEntries(this.successfulPatterns),
        optimizationRules: Object.fromEntries(this.optimizationRules),
        performanceMetrics: Object.fromEntries(this.performanceMetrics),
        metrics: this.metrics,
        lastPersisted: new Date().toISOString()
      };
            
      await fs.writeFile(this.modelPath, JSON.stringify(modelData, null, 2));
            
      this.logger.debug('💾 Modelo persistido correctamente');
    } catch (error) {
      this.logger.error('Error persistiendo modelo:', error);
    }
  }

  /**
     * Cargar modelo persistido
     */
  async loadPersistedModel() {
    try {
      const data = await fs.readFile(this.modelPath, 'utf8');
      const modelData = JSON.parse(data);
            
      this.learningModel = new Map(Object.entries(modelData.learningModel || {}));
      this.successfulPatterns = new Map(Object.entries(modelData.successfulPatterns || {}));
      this.optimizationRules = new Map(Object.entries(modelData.optimizationRules || {}));
      this.performanceMetrics = new Map(Object.entries(modelData.performanceMetrics || {}));
      this.metrics = { ...this.metrics, ...modelData.metrics };
            
      this.logger.info(`📚 Modelo cargado: ${this.learningModel.size} elementos, ${this.successfulPatterns.size} patrones`);
    } catch (error) {
      this.logger.info('No se encontró modelo persistido, iniciando con modelo vacío');
    }
  }

  /**
     * Obtener estadísticas del agente
     */
  getStats() {
    return {
      agentId: this.agentId,
      isActive: this.isActive,
      metrics: this.metrics,
      modelSize: this.learningModel.size,
      patternsCount: this.successfulPatterns.size,
      rulesCount: this.optimizationRules.size,
      performanceMetricsCount: this.performanceMetrics.size,
      config: this.config
    };
  }

  /**
     * Desactivar el agente
     */
  async deactivate() {
    this.isActive = false;
        
    // Persistir modelo final
    await this.persistModel();
        
    this.eventHub.emitEvolutive('system.learning_deactivated', {
      agentId: this.agentId,
      finalStats: this.getStats(),
      timestamp: new Date().toISOString()
    }, { source: 'LearningAgent', priority: 'medium' });
        
    this.logger.info('🧠 LearningAgent desactivado');
  }
}

export default LearningAgent;
/**
 * AILearningSystem - Sistema de aprendizaje para IA
 * 
 * Implementa aprendizaje automático para mejorar continuamente
 * la selección de modelos, optimización de prompts y predicción de patrones.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../core/core/logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('AI_LEARNING');

export class AILearningSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: true,
      learningRate: 0.01,
      minSamples: 50,
      maxMemory: 10000,
      adaptationThreshold: 0.1,
      patternDetectionWindow: 100,
      feedbackWeight: 0.3,
      performanceWeight: 0.7,
      persistLearning: true,
      learningDir: './learning/ai',
      ...config
    };

    this.patterns = new Map();
    this.userPreferences = new Map();
    this.contextCorrelations = new Map();
    this.performanceHistory = new Map();
    this.feedbackData = new Map();
    this.adaptations = new Map();
    this.knowledgeBase = {
      successful_patterns: new Map(),
      failed_patterns: new Map(),
      user_behaviors: new Map(),
      context_insights: new Map()
    };
  }

  /**
   * Inicializar el sistema de aprendizaje
   */
  async initialize() {
    try {
      logger.info('Inicializando sistema de aprendizaje de IA...');
      
      if (this.config.persistLearning) {
        await this.ensureLearningDirectory();
        await this.loadLearningData();
      }
      
      logger.info('Sistema de aprendizaje inicializado');
      this.emit('learning:initialized');
      
    } catch (error) {
      logger.error('Error inicializando aprendizaje', error);
      throw error;
    }
  }

  /**
   * Asegurar que el directorio de aprendizaje existe
   */
  async ensureLearningDirectory() {
    try {
      await fs.mkdir(this.config.learningDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Cargar datos de aprendizaje desde disco
   */
  async loadLearningData() {
    try {
      const learningFile = path.join(this.config.learningDir, 'learning-data.json');
      const data = await fs.readFile(learningFile, 'utf8');
      const learningData = JSON.parse(data);
      
      // Restaurar Maps desde objetos serializados
      this.patterns = new Map(learningData.patterns || []);
      this.userPreferences = new Map(learningData.userPreferences || []);
      this.contextCorrelations = new Map(learningData.contextCorrelations || []);
      this.performanceHistory = new Map(learningData.performanceHistory || []);
      
      // Restaurar base de conocimiento
      for (const [key, value] of Object.entries(learningData.knowledgeBase || {})) {
        this.knowledgeBase[key] = new Map(value || []);
      }
      
      logger.info('Datos de aprendizaje cargados desde disco');
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Error cargando datos de aprendizaje', error);
      }
    }
  }

  /**
   * Guardar datos de aprendizaje en disco
   */
  async saveLearningData() {
    if (!this.config.persistLearning) return;
    
    try {
      const learningFile = path.join(this.config.learningDir, 'learning-data.json');
      
      // Convertir Maps a arrays para serialización
      const learningData = {
        patterns: Array.from(this.patterns.entries()),
        userPreferences: Array.from(this.userPreferences.entries()),
        contextCorrelations: Array.from(this.contextCorrelations.entries()),
        performanceHistory: Array.from(this.performanceHistory.entries()),
        knowledgeBase: {}
      };
      
      // Convertir base de conocimiento
      for (const [key, map] of Object.entries(this.knowledgeBase)) {
        learningData.knowledgeBase[key] = Array.from(map.entries());
      }
      
      await fs.writeFile(learningFile, JSON.stringify(learningData, null, 2));
      logger.debug('Datos de aprendizaje guardados en disco');
      
    } catch (error) {
      logger.error('Error guardando datos de aprendizaje', error);
    }
  }

  /**
   * Aprender de una interacción
   */
  async learnFromInteraction(interaction) {
    if (!this.config.enabled) return;
    
    const {
      userId,
      prompt,
      context,
      provider,
      model,
      response,
      responseTime,
      cost,
      feedback,
      success
    } = interaction;
    
    // Extraer patrones del prompt
    await this.extractPromptPatterns(prompt, { provider, model, success, responseTime, cost });
    
    // Aprender preferencias del usuario
    await this.learnUserPreferences(userId, { provider, model, success, feedback });
    
    // Analizar correlaciones de contexto
    await this.analyzeContextCorrelations(context, { provider, model, success, responseTime });
    
    // Actualizar historial de rendimiento
    await this.updatePerformanceHistory(provider, model, { responseTime, cost, success });
    
    // Procesar feedback si existe
    if (feedback) {
      await this.processFeedback(interaction, feedback);
    }
    
    // Detectar nuevos patrones
    await this.detectPatterns();
    
    this.emit('interaction:learned', {
      userId,
      patterns: this.patterns.size,
      preferences: this.userPreferences.size
    });
  }

  /**
   * Extraer patrones del prompt
   */
  async extractPromptPatterns(prompt, outcome) {
    const features = this.extractPromptFeatures(prompt);
    const patternKey = this.generatePatternKey(features);
    
    if (!this.patterns.has(patternKey)) {
      this.patterns.set(patternKey, {
        features,
        outcomes: [],
        successRate: 0,
        avgResponseTime: 0,
        avgCost: 0,
        count: 0
      });
    }
    
    const pattern = this.patterns.get(patternKey);
    pattern.outcomes.push(outcome);
    pattern.count++;
    
    // Mantener solo los últimos N outcomes
    if (pattern.outcomes.length > this.config.patternDetectionWindow) {
      pattern.outcomes = pattern.outcomes.slice(-this.config.patternDetectionWindow);
    }
    
    // Recalcular métricas
    const successfulOutcomes = pattern.outcomes.filter(o => o.success);
    pattern.successRate = successfulOutcomes.length / pattern.outcomes.length;
    pattern.avgResponseTime = pattern.outcomes.reduce((sum, o) => sum + o.responseTime, 0) / pattern.outcomes.length;
    pattern.avgCost = pattern.outcomes.reduce((sum, o) => sum + o.cost, 0) / pattern.outcomes.length;
    
    // Clasificar patrón como exitoso o fallido
    if (pattern.count >= this.config.minSamples) {
      if (pattern.successRate >= 0.8) {
        this.knowledgeBase.successful_patterns.set(patternKey, pattern);
      } else if (pattern.successRate <= 0.3) {
        this.knowledgeBase.failed_patterns.set(patternKey, pattern);
      }
    }
  }

  /**
   * Extraer características del prompt
   */
  extractPromptFeatures(prompt) {
    const features = {
      length: prompt.length,
      wordCount: prompt.split(' ').length,
      sentenceCount: prompt.split(/[.!?]+/).length,
      questionCount: (prompt.match(/\?/g) || []).length,
      hasContext: prompt.toLowerCase().includes('context'),
      hasExample: prompt.toLowerCase().includes('example'),
      hasFormat: prompt.toLowerCase().includes('format'),
      complexity: this.calculatePromptComplexity(prompt),
      domain: this.detectPromptDomain(prompt),
      intent: this.detectPromptIntent(prompt)
    };
    
    return features;
  }

  /**
   * Calcular complejidad del prompt
   */
  calculatePromptComplexity(prompt) {
    const factors = {
      length: Math.min(prompt.length / 1000, 1),
      vocabulary: this.calculateVocabularyComplexity(prompt),
      structure: this.calculateStructuralComplexity(prompt)
    };
    
    return (factors.length + factors.vocabulary + factors.structure) / 3;
  }

  /**
   * Calcular complejidad del vocabulario
   */
  calculateVocabularyComplexity(prompt) {
    const words = prompt.toLowerCase().split(/\W+/);
    const uniqueWords = new Set(words);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    return Math.min((uniqueWords.size / words.length) + (avgWordLength / 10), 1);
  }

  /**
   * Calcular complejidad estructural
   */
  calculateStructuralComplexity(prompt) {
    const indicators = [
      prompt.includes('if'),
      prompt.includes('then'),
      prompt.includes('because'),
      prompt.includes('however'),
      prompt.includes('therefore'),
      /\d+\./.test(prompt), // Listas numeradas
      /\*/.test(prompt),    // Listas con viñetas
      /\n/.test(prompt)     // Múltiples líneas
    ];
    
    return indicators.filter(Boolean).length / indicators.length;
  }

  /**
   * Detectar dominio del prompt
   */
  detectPromptDomain(prompt) {
    const domains = {
      technical: ['code', 'programming', 'software', 'algorithm', 'database'],
      business: ['strategy', 'marketing', 'sales', 'revenue', 'customer'],
      creative: ['story', 'creative', 'design', 'art', 'imagination'],
      analytical: ['analyze', 'data', 'statistics', 'research', 'study'],
      educational: ['explain', 'teach', 'learn', 'understand', 'concept']
    };
    
    const lowerPrompt = prompt.toLowerCase();
    
    for (const [domain, keywords] of Object.entries(domains)) {
      const matches = keywords.filter(keyword => lowerPrompt.includes(keyword)).length;
      if (matches >= 2) return domain;
    }
    
    return 'general';
  }

  /**
   * Detectar intención del prompt
   */
  detectPromptIntent(prompt) {
    const intents = {
      question: /\?|what|how|why|when|where|who/i,
      instruction: /please|create|generate|write|make|build/i,
      analysis: /analyze|compare|evaluate|assess|review/i,
      explanation: /explain|describe|tell me|clarify/i,
      translation: /translate|convert|transform/i
    };
    
    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(prompt)) return intent;
    }
    
    return 'unknown';
  }

  /**
   * Generar clave de patrón
   */
  generatePatternKey(features) {
    const keyComponents = [
      Math.floor(features.length / 100) * 100,
      Math.floor(features.wordCount / 50) * 50,
      features.domain,
      features.intent,
      Math.floor(features.complexity * 10) / 10
    ];
    
    return keyComponents.join('|');
  }

  /**
   * Aprender preferencias del usuario
   */
  async learnUserPreferences(userId, outcome) {
    if (!userId) return;
    
    if (!this.userPreferences.has(userId)) {
      this.userPreferences.set(userId, {
        providerPreferences: new Map(),
        modelPreferences: new Map(),
        qualityThreshold: 0.8,
        speedPreference: 0.5,
        costSensitivity: 0.5,
        feedbackHistory: []
      });
    }
    
    const preferences = this.userPreferences.get(userId);
    
    // Actualizar preferencias de proveedor
    const providerKey = outcome.provider;
    if (!preferences.providerPreferences.has(providerKey)) {
      preferences.providerPreferences.set(providerKey, {
        usage: 0,
        satisfaction: 0,
        avgResponseTime: 0
      });
    }
    
    const providerPref = preferences.providerPreferences.get(providerKey);
    providerPref.usage++;
    
    if (outcome.success) {
      providerPref.satisfaction = this.updateMovingAverage(
        providerPref.satisfaction,
        1,
        providerPref.usage,
        this.config.learningRate
      );
    }
    
    // Actualizar preferencias de modelo
    const modelKey = `${outcome.provider}:${outcome.model}`;
    if (!preferences.modelPreferences.has(modelKey)) {
      preferences.modelPreferences.set(modelKey, {
        usage: 0,
        satisfaction: 0,
        performance: 0
      });
    }
    
    const modelPref = preferences.modelPreferences.get(modelKey);
    modelPref.usage++;
    
    if (outcome.feedback) {
      const feedbackScore = this.normalizeFeedback(outcome.feedback);
      modelPref.satisfaction = this.updateMovingAverage(
        modelPref.satisfaction,
        feedbackScore,
        modelPref.usage,
        this.config.learningRate
      );
    }
  }

  /**
   * Analizar correlaciones de contexto
   */
  async analyzeContextCorrelations(context, outcome) {
    if (!context || typeof context !== 'object') return;
    
    const contextFeatures = this.extractContextFeatures(context);
    const correlationKey = this.generateContextKey(contextFeatures);
    
    if (!this.contextCorrelations.has(correlationKey)) {
      this.contextCorrelations.set(correlationKey, {
        features: contextFeatures,
        outcomes: [],
        bestProvider: null,
        bestModel: null,
        avgPerformance: 0
      });
    }
    
    const correlation = this.contextCorrelations.get(correlationKey);
    correlation.outcomes.push(outcome);
    
    // Mantener ventana deslizante
    if (correlation.outcomes.length > this.config.patternDetectionWindow) {
      correlation.outcomes = correlation.outcomes.slice(-this.config.patternDetectionWindow);
    }
    
    // Encontrar mejor proveedor y modelo para este contexto
    const providerPerformance = new Map();
    const modelPerformance = new Map();
    
    for (const o of correlation.outcomes) {
      if (o.success) {
        const providerScore = 1 / (1 + o.responseTime / 1000); // Score basado en velocidad
        providerPerformance.set(o.provider, 
          (providerPerformance.get(o.provider) || 0) + providerScore
        );
        
        const modelKey = `${o.provider}:${o.model}`;
        modelPerformance.set(modelKey,
          (modelPerformance.get(modelKey) || 0) + providerScore
        );
      }
    }
    
    // Actualizar mejores opciones
    if (providerPerformance.size > 0) {
      correlation.bestProvider = Array.from(providerPerformance.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
    }
    
    if (modelPerformance.size > 0) {
      correlation.bestModel = Array.from(modelPerformance.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  /**
   * Extraer características del contexto
   */
  extractContextFeatures(context) {
    return {
      hasUser: !!context.user,
      hasSession: !!context.session,
      hasHistory: !!(context.history && context.history.length > 0),
      userType: context.user?.type || 'unknown',
      sessionLength: context.session?.duration || 0,
      historySize: context.history?.length || 0,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    };
  }

  /**
   * Generar clave de contexto
   */
  generateContextKey(features) {
    return [
      features.userType,
      features.hasHistory ? 'with_history' : 'no_history',
      Math.floor(features.timeOfDay / 6) * 6, // Agrupado por cuartos de día
      features.dayOfWeek < 5 ? 'weekday' : 'weekend'
    ].join('|');
  }

  /**
   * Actualizar historial de rendimiento
   */
  async updatePerformanceHistory(provider, model, metrics) {
    const key = `${provider}:${model}`;
    
    if (!this.performanceHistory.has(key)) {
      this.performanceHistory.set(key, {
        samples: [],
        avgResponseTime: 0,
        avgCost: 0,
        successRate: 0,
        trend: 'stable'
      });
    }
    
    const history = this.performanceHistory.get(key);
    history.samples.push({
      timestamp: Date.now(),
      responseTime: metrics.responseTime,
      cost: metrics.cost,
      success: metrics.success
    });
    
    // Mantener ventana deslizante
    if (history.samples.length > this.config.patternDetectionWindow) {
      history.samples = history.samples.slice(-this.config.patternDetectionWindow);
    }
    
    // Recalcular métricas
    const recentSamples = history.samples.slice(-20); // Últimas 20 muestras
    history.avgResponseTime = recentSamples.reduce((sum, s) => sum + s.responseTime, 0) / recentSamples.length;
    history.avgCost = recentSamples.reduce((sum, s) => sum + s.cost, 0) / recentSamples.length;
    history.successRate = recentSamples.filter(s => s.success).length / recentSamples.length;
    
    // Detectar tendencia
    if (recentSamples.length >= 10) {
      const oldSamples = recentSamples.slice(0, 10);
      const newSamples = recentSamples.slice(-10);
      
      const oldAvg = oldSamples.reduce((sum, s) => sum + s.responseTime, 0) / oldSamples.length;
      const newAvg = newSamples.reduce((sum, s) => sum + s.responseTime, 0) / newSamples.length;
      
      const change = (newAvg - oldAvg) / oldAvg;
      
      if (change > 0.1) history.trend = 'degrading';
      else if (change < -0.1) history.trend = 'improving';
      else history.trend = 'stable';
    }
  }

  /**
   * Procesar feedback del usuario
   */
  async processFeedback(interaction, feedback) {
    const feedbackKey = `${interaction.provider}:${interaction.model}`;
    
    if (!this.feedbackData.has(feedbackKey)) {
      this.feedbackData.set(feedbackKey, {
        samples: [],
        avgRating: 0,
        categories: new Map()
      });
    }
    
    const data = this.feedbackData.get(feedbackKey);
    
    const feedbackEntry = {
      timestamp: Date.now(),
      rating: feedback.rating || 0,
      category: feedback.category || 'general',
      comment: feedback.comment || '',
      userId: interaction.userId
    };
    
    data.samples.push(feedbackEntry);
    
    // Mantener ventana deslizante
    if (data.samples.length > this.config.maxMemory) {
      data.samples = data.samples.slice(-this.config.maxMemory);
    }
    
    // Actualizar rating promedio
    data.avgRating = data.samples.reduce((sum, s) => sum + s.rating, 0) / data.samples.length;
    
    // Actualizar categorías
    const category = feedbackEntry.category;
    if (!data.categories.has(category)) {
      data.categories.set(category, { count: 0, avgRating: 0 });
    }
    
    const categoryData = data.categories.get(category);
    categoryData.count++;
    categoryData.avgRating = this.updateMovingAverage(
      categoryData.avgRating,
      feedbackEntry.rating,
      categoryData.count,
      this.config.learningRate
    );
  }

  /**
   * Detectar nuevos patrones
   */
  async detectPatterns() {
    // Detectar patrones de uso temporal
    await this.detectTemporalPatterns();
    
    // Detectar patrones de rendimiento
    await this.detectPerformancePatterns();
    
    // Detectar patrones de usuario
    await this.detectUserPatterns();
    
    // Generar adaptaciones basadas en patrones
    await this.generateAdaptations();
  }

  /**
   * Detectar patrones temporales
   */
  async detectTemporalPatterns() {
    const timePatterns = new Map();
    
    for (const [key, history] of this.performanceHistory.entries()) {
      for (const sample of history.samples) {
        const hour = new Date(sample.timestamp).getHours();
        const timeSlot = Math.floor(hour / 4) * 4; // Agrupado por 4 horas
        
        if (!timePatterns.has(timeSlot)) {
          timePatterns.set(timeSlot, {
            samples: [],
            avgResponseTime: 0,
            successRate: 0
          });
        }
        
        timePatterns.get(timeSlot).samples.push(sample);
      }
    }
    
    // Analizar patrones por franja horaria
    for (const [timeSlot, data] of timePatterns.entries()) {
      if (data.samples.length >= this.config.minSamples) {
        data.avgResponseTime = data.samples.reduce((sum, s) => sum + s.responseTime, 0) / data.samples.length;
        data.successRate = data.samples.filter(s => s.success).length / data.samples.length;
        
        this.knowledgeBase.context_insights.set(`time_${timeSlot}`, data);
      }
    }
  }

  /**
   * Detectar patrones de rendimiento
   */
  async detectPerformancePatterns() {
    for (const [key, history] of this.performanceHistory.entries()) {
      if (history.samples.length >= this.config.minSamples) {
        const pattern = {
          key,
          avgResponseTime: history.avgResponseTime,
          successRate: history.successRate,
          trend: history.trend,
          reliability: this.calculateReliability(history.samples)
        };
        
        if (pattern.successRate >= 0.9 && pattern.reliability >= 0.8) {
          this.knowledgeBase.successful_patterns.set(`performance_${key}`, pattern);
        }
      }
    }
  }

  /**
   * Detectar patrones de usuario
   */
  async detectUserPatterns() {
    for (const [userId, preferences] of this.userPreferences.entries()) {
      const pattern = {
        userId,
        preferredProviders: this.getTopPreferences(preferences.providerPreferences, 3),
        preferredModels: this.getTopPreferences(preferences.modelPreferences, 3),
        qualityThreshold: preferences.qualityThreshold,
        avgSatisfaction: this.calculateAvgSatisfaction(preferences)
      };
      
      this.knowledgeBase.user_behaviors.set(userId, pattern);
    }
  }

  /**
   * Generar adaptaciones basadas en patrones
   */
  async generateAdaptations() {
    const adaptations = [];
    
    // Adaptaciones basadas en patrones exitosos
    for (const [key, pattern] of this.knowledgeBase.successful_patterns.entries()) {
      if (pattern.successRate >= 0.9) {
        adaptations.push({
          type: 'promote_pattern',
          pattern: key,
          confidence: pattern.successRate,
          recommendation: `Promover uso de ${key} por alta tasa de éxito`
        });
      }
    }
    
    // Adaptaciones basadas en patrones fallidos
    for (const [key, pattern] of this.knowledgeBase.failed_patterns.entries()) {
      if (pattern.successRate <= 0.3) {
        adaptations.push({
          type: 'avoid_pattern',
          pattern: key,
          confidence: 1 - pattern.successRate,
          recommendation: `Evitar uso de ${key} por baja tasa de éxito`
        });
      }
    }
    
    // Aplicar adaptaciones significativas
    for (const adaptation of adaptations) {
      if (adaptation.confidence >= this.config.adaptationThreshold) {
        this.adaptations.set(adaptation.pattern, adaptation);
        
        this.emit('adaptation:generated', adaptation);
      }
    }
  }

  /**
   * Obtener recomendaciones basadas en aprendizaje
   */
  getRecommendations(prompt, context, userId) {
    const recommendations = {
      provider: null,
      model: null,
      confidence: 0,
      reasoning: []
    };
    
    // Analizar prompt
    const promptFeatures = this.extractPromptFeatures(prompt);
    const promptPatternKey = this.generatePatternKey(promptFeatures);
    
    // Buscar patrón exitoso similar
    const successfulPattern = this.knowledgeBase.successful_patterns.get(promptPatternKey);
    if (successfulPattern) {
      recommendations.reasoning.push(`Patrón exitoso encontrado: ${promptPatternKey}`);
      recommendations.confidence += 0.3;
    }
    
    // Analizar contexto
    if (context) {
      const contextFeatures = this.extractContextFeatures(context);
      const contextKey = this.generateContextKey(contextFeatures);
      const contextCorrelation = this.contextCorrelations.get(contextKey);
      
      if (contextCorrelation && contextCorrelation.bestProvider) {
        recommendations.provider = contextCorrelation.bestProvider;
        recommendations.model = contextCorrelation.bestModel;
        recommendations.reasoning.push(`Mejor proveedor para contexto: ${contextKey}`);
        recommendations.confidence += 0.4;
      }
    }
    
    // Analizar preferencias del usuario
    if (userId && this.userPreferences.has(userId)) {
      const userPrefs = this.userPreferences.get(userId);
      const topProvider = this.getTopPreferences(userPrefs.providerPreferences, 1)[0];
      
      if (topProvider && (!recommendations.provider || recommendations.confidence < 0.7)) {
        recommendations.provider = topProvider.key;
        recommendations.reasoning.push(`Preferencia del usuario: ${topProvider.key}`);
        recommendations.confidence += 0.3;
      }
    }
    
    return recommendations;
  }

  /**
   * Obtener estadísticas de aprendizaje
   */
  getLearningStats() {
    return {
      patterns: this.patterns.size,
      userPreferences: this.userPreferences.size,
      contextCorrelations: this.contextCorrelations.size,
      performanceHistory: this.performanceHistory.size,
      knowledgeBase: {
        successfulPatterns: this.knowledgeBase.successful_patterns.size,
        failedPatterns: this.knowledgeBase.failed_patterns.size,
        userBehaviors: this.knowledgeBase.user_behaviors.size,
        contextInsights: this.knowledgeBase.context_insights.size
      },
      adaptations: this.adaptations.size
    };
  }

  /**
   * Utilidades
   */
  updateMovingAverage(current, newValue, count, learningRate) {
    if (count === 1) return newValue;
    return current + learningRate * (newValue - current);
  }

  normalizeFeedback(feedback) {
    if (typeof feedback === 'number') return Math.max(0, Math.min(1, feedback / 5));
    if (feedback.rating) return Math.max(0, Math.min(1, feedback.rating / 5));
    return 0.5; // Neutral por defecto
  }

  calculateReliability(samples) {
    if (samples.length < 5) return 0;
    
    const responseTimes = samples.map(s => s.responseTime);
    const mean = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    const variance = responseTimes.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / responseTimes.length;
    const stdDev = Math.sqrt(variance);
    
    // Confiabilidad inversamente proporcional a la desviación estándar
    return Math.max(0, Math.min(1, 1 - (stdDev / mean)));
  }

  getTopPreferences(preferencesMap, limit) {
    return Array.from(preferencesMap.entries())
      .sort((a, b) => b[1].satisfaction - a[1].satisfaction)
      .slice(0, limit)
      .map(([key, data]) => ({ key, satisfaction: data.satisfaction }));
  }

  calculateAvgSatisfaction(preferences) {
    const allSatisfactions = [
      ...Array.from(preferences.providerPreferences.values()).map(p => p.satisfaction),
      ...Array.from(preferences.modelPreferences.values()).map(p => p.satisfaction)
    ];
    
    return allSatisfactions.length > 0 
      ? allSatisfactions.reduce((sum, s) => sum + s, 0) / allSatisfactions.length 
      : 0;
  }

  /**
   * Cerrar el sistema de aprendizaje
   */
  async shutdown() {
    logger.info('Cerrando sistema de aprendizaje de IA...');
    
    if (this.config.persistLearning) {
      await this.saveLearningData();
    }
    
    this.emit('learning:shutdown');
  }
}

export default AILearningSystem;
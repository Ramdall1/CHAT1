/**
 * AIQualityAssurance - Sistema de aseguramiento de calidad para IA
 * 
 * Evalúa la calidad de las respuestas de IA mediante múltiples métricas
 * y filtros para garantizar respuestas apropiadas y útiles.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../core/core/logger.js';

const logger = createLogger('AI_QUALITY');

export class AIQualityAssurance extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: true,
      minQualityScore: 0.7,
      maxResponseLength: 10000,
      minResponseLength: 10,
      checkRelevance: true,
      checkCoherence: true,
      checkSafety: true,
      checkFactuality: true,
      enableContentFiltering: true,
      enableToxicityDetection: true,
      enableBiasDetection: true,
      qualityWeights: {
        relevance: 0.3,
        coherence: 0.25,
        completeness: 0.2,
        accuracy: 0.15,
        safety: 0.1
      },
      ...config
    };

    this.qualityMetrics = new Map();
    this.contentFilters = new Map();
    this.qualityHistory = new Map();
    this.flaggedContent = new Map();
    
    this.initializeFilters();
  }

  /**
   * Inicializar filtros de contenido
   */
  initializeFilters() {
    // Filtros de seguridad
    this.contentFilters.set('toxicity', {
      patterns: [
        /\b(hate|violence|threat|harm|kill|die|suicide)\b/gi,
        /\b(racist|sexist|homophobic|discriminat)\w*\b/gi
      ],
      severity: 'high'
    });

    this.contentFilters.set('inappropriate', {
      patterns: [
        /\b(explicit|nsfw|adult|sexual)\b/gi,
        /\b(drug|illegal|criminal)\b/gi
      ],
      severity: 'medium'
    });

    this.contentFilters.set('spam', {
      patterns: [
        /(.)\1{10,}/g, // Repetición excesiva de caracteres
        /\b(click here|buy now|limited time|act now)\b/gi
      ],
      severity: 'low'
    });

    // Filtros de calidad
    this.contentFilters.set('coherence', {
      patterns: [
        /\b(lorem ipsum|placeholder|todo|fixme)\b/gi,
        /\b(asdf|qwerty|test test)\b/gi
      ],
      severity: 'medium'
    });
  }

  /**
   * Evaluar calidad de respuesta
   */
  async evaluateResponse(prompt, response, context = {}) {
    if (!this.config.enabled) {
      return { passed: true, score: 1.0, details: {} };
    }

    logger.debug('Evaluando calidad de respuesta', { 
      promptLength: prompt.length, 
      responseLength: response.length 
    });

    const evaluation = {
      passed: false,
      score: 0,
      details: {},
      flags: [],
      recommendations: []
    };

    try {
      // Verificaciones básicas
      const basicChecks = await this.performBasicChecks(response);
      evaluation.details.basic = basicChecks;

      if (!basicChecks.passed) {
        evaluation.flags.push(...basicChecks.flags);
        return evaluation;
      }

      // Evaluación de relevancia
      if (this.config.checkRelevance) {
        const relevance = await this.evaluateRelevance(prompt, response);
        evaluation.details.relevance = relevance;
      }

      // Evaluación de coherencia
      if (this.config.checkCoherence) {
        const coherence = await this.evaluateCoherence(response);
        evaluation.details.coherence = coherence;
      }

      // Evaluación de completitud
      const completeness = await this.evaluateCompleteness(prompt, response);
      evaluation.details.completeness = completeness;

      // Evaluación de seguridad
      if (this.config.checkSafety) {
        const safety = await this.evaluateSafety(response);
        evaluation.details.safety = safety;
        
        if (!safety.passed) {
          evaluation.flags.push(...safety.flags);
        }
      }

      // Evaluación de factualidad
      if (this.config.checkFactuality) {
        const factuality = await this.evaluateFactuality(response, context);
        evaluation.details.factuality = factuality;
      }

      // Calcular puntuación total
      evaluation.score = this.calculateOverallScore(evaluation.details);
      evaluation.passed = evaluation.score >= this.config.minQualityScore && evaluation.flags.length === 0;

      // Generar recomendaciones
      evaluation.recommendations = this.generateRecommendations(evaluation.details);

      // Registrar métricas
      await this.recordQualityMetrics(evaluation);

      this.emit('quality:evaluated', {
        score: evaluation.score,
        passed: evaluation.passed,
        flags: evaluation.flags.length
      });

      return evaluation;

    } catch (error) {
      logger.error('Error evaluando calidad', error);
      return {
        passed: false,
        score: 0,
        details: { error: error.message },
        flags: ['evaluation_error'],
        recommendations: ['Revisar manualmente la respuesta']
      };
    }
  }

  /**
   * Verificaciones básicas
   */
  async performBasicChecks(response) {
    const checks = {
      passed: true,
      flags: [],
      details: {}
    };

    // Verificar longitud
    if (response.length < this.config.minResponseLength) {
      checks.passed = false;
      checks.flags.push('response_too_short');
      checks.details.length = 'Respuesta demasiado corta';
    }

    if (response.length > this.config.maxResponseLength) {
      checks.passed = false;
      checks.flags.push('response_too_long');
      checks.details.length = 'Respuesta demasiado larga';
    }

    // Verificar contenido vacío o inválido
    const trimmedResponse = response.trim();
    if (!trimmedResponse) {
      checks.passed = false;
      checks.flags.push('empty_response');
      checks.details.content = 'Respuesta vacía';
    }

    // Verificar caracteres de control o corrupción
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(response)) {
      checks.passed = false;
      checks.flags.push('corrupted_content');
      checks.details.encoding = 'Contenido corrupto detectado';
    }

    return checks;
  }

  /**
   * Evaluar relevancia de la respuesta
   */
  async evaluateRelevance(prompt, response) {
    const relevance = {
      score: 0,
      details: {}
    };

    try {
      // Extraer palabras clave del prompt
      const promptKeywords = this.extractKeywords(prompt);
      const responseKeywords = this.extractKeywords(response);

      // Calcular intersección de palabras clave
      const intersection = promptKeywords.filter(keyword => 
        responseKeywords.some(rKeyword => 
          rKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(rKeyword.toLowerCase())
        )
      );

      const keywordRelevance = promptKeywords.length > 0 
        ? intersection.length / promptKeywords.length 
        : 0;

      // Evaluar estructura de respuesta
      const structureRelevance = this.evaluateResponseStructure(prompt, response);

      // Evaluar contexto semántico
      const semanticRelevance = this.evaluateSemanticRelevance(prompt, response);

      relevance.score = (keywordRelevance * 0.4 + structureRelevance * 0.3 + semanticRelevance * 0.3);
      relevance.details = {
        keywordRelevance,
        structureRelevance,
        semanticRelevance,
        promptKeywords: promptKeywords.length,
        matchedKeywords: intersection.length
      };

    } catch (error) {
      logger.warn('Error evaluando relevancia', error);
      relevance.score = 0.5; // Puntuación neutral en caso de error
    }

    return relevance;
  }

  /**
   * Evaluar coherencia de la respuesta
   */
  async evaluateCoherence(response) {
    const coherence = {
      score: 0,
      details: {}
    };

    try {
      // Evaluar estructura de oraciones
      const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
      
      const sentenceStructure = this.evaluateSentenceStructure(sentences);
      
      // Evaluar flujo lógico
      const logicalFlow = this.evaluateLogicalFlow(sentences);
      
      // Evaluar consistencia terminológica
      const terminologyConsistency = this.evaluateTerminologyConsistency(response);
      
      // Detectar contradicciones
      const contradictions = this.detectContradictions(sentences);
      
      coherence.score = (
        sentenceStructure * 0.3 +
        logicalFlow * 0.3 +
        terminologyConsistency * 0.2 +
        (1 - contradictions) * 0.2
      );

      coherence.details = {
        sentenceCount: sentences.length,
        avgSentenceLength,
        sentenceStructure,
        logicalFlow,
        terminologyConsistency,
        contradictions
      };

    } catch (error) {
      logger.warn('Error evaluando coherencia', error);
      coherence.score = 0.5;
    }

    return coherence;
  }

  /**
   * Evaluar completitud de la respuesta
   */
  async evaluateCompleteness(prompt, response) {
    const completeness = {
      score: 0,
      details: {}
    };

    try {
      // Detectar tipo de pregunta
      const questionType = this.detectQuestionType(prompt);
      
      // Evaluar si la respuesta aborda todos los aspectos
      const aspectsCovered = this.evaluateAspectsCoverage(prompt, response, questionType);
      
      // Evaluar profundidad de la respuesta
      const depth = this.evaluateResponseDepth(response, questionType);
      
      // Evaluar si hay información faltante obvia
      const missingInfo = this.detectMissingInformation(prompt, response);
      
      completeness.score = (
        aspectsCovered * 0.4 +
        depth * 0.3 +
        (1 - missingInfo) * 0.3
      );

      completeness.details = {
        questionType,
        aspectsCovered,
        depth,
        missingInfo
      };

    } catch (error) {
      logger.warn('Error evaluando completitud', error);
      completeness.score = 0.5;
    }

    return completeness;
  }

  /**
   * Evaluar seguridad del contenido
   */
  async evaluateSafety(response) {
    const safety = {
      passed: true,
      score: 1.0,
      flags: [],
      details: {}
    };

    try {
      // Aplicar filtros de contenido
      for (const [filterName, filter] of this.contentFilters.entries()) {
        const violations = this.applyContentFilter(response, filter);
        
        if (violations.length > 0) {
          safety.flags.push(`${filterName}_violation`);
          safety.details[filterName] = violations;
          
          // Ajustar puntuación según severidad
          const severityPenalty = {
            'high': 0.8,
            'medium': 0.3,
            'low': 0.1
          };
          
          safety.score -= severityPenalty[filter.severity] || 0.1;
        }
      }

      // Verificar si hay contenido potencialmente dañino
      const harmfulContent = this.detectHarmfulContent(response);
      if (harmfulContent.detected) {
        safety.flags.push('harmful_content');
        safety.details.harmful = harmfulContent;
        safety.score -= 0.5;
      }

      safety.passed = safety.flags.length === 0 && safety.score >= 0.7;
      safety.score = Math.max(0, safety.score);

    } catch (error) {
      logger.warn('Error evaluando seguridad', error);
      safety.passed = false;
      safety.flags.push('safety_evaluation_error');
    }

    return safety;
  }

  /**
   * Evaluar factualidad (básica)
   */
  async evaluateFactuality(response, context) {
    const factuality = {
      score: 0.8, // Puntuación por defecto (neutral)
      details: {},
      confidence: 'medium'
    };

    try {
      // Detectar afirmaciones fácticas
      const factualClaims = this.extractFactualClaims(response);
      
      // Evaluar confianza en las afirmaciones
      const confidenceIndicators = this.evaluateConfidenceIndicators(response);
      
      // Detectar posibles inexactitudes obvias
      const obviousErrors = this.detectObviousErrors(response);
      
      factuality.score = Math.max(0, 0.8 - (obviousErrors * 0.2) + (confidenceIndicators * 0.1));
      factuality.details = {
        factualClaims: factualClaims.length,
        confidenceIndicators,
        obviousErrors
      };

      if (factuality.score >= 0.9) factuality.confidence = 'high';
      else if (factuality.score <= 0.5) factuality.confidence = 'low';

    } catch (error) {
      logger.warn('Error evaluando factualidad', error);
    }

    return factuality;
  }

  /**
   * Calcular puntuación general
   */
  calculateOverallScore(details) {
    const weights = this.config.qualityWeights;
    let totalScore = 0;
    let totalWeight = 0;

    if (details.relevance) {
      totalScore += details.relevance.score * weights.relevance;
      totalWeight += weights.relevance;
    }

    if (details.coherence) {
      totalScore += details.coherence.score * weights.coherence;
      totalWeight += weights.coherence;
    }

    if (details.completeness) {
      totalScore += details.completeness.score * weights.completeness;
      totalWeight += weights.completeness;
    }

    if (details.factuality) {
      totalScore += details.factuality.score * weights.accuracy;
      totalWeight += weights.accuracy;
    }

    if (details.safety) {
      totalScore += details.safety.score * weights.safety;
      totalWeight += weights.safety;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Generar recomendaciones de mejora
   */
  generateRecommendations(details) {
    const recommendations = [];

    if (details.relevance && details.relevance.score < 0.7) {
      recommendations.push('Mejorar relevancia: incluir más palabras clave del prompt');
    }

    if (details.coherence && details.coherence.score < 0.7) {
      recommendations.push('Mejorar coherencia: revisar estructura y flujo lógico');
    }

    if (details.completeness && details.completeness.score < 0.7) {
      recommendations.push('Mejorar completitud: abordar todos los aspectos de la pregunta');
    }

    if (details.safety && !details.safety.passed) {
      recommendations.push('Revisar contenido por posibles problemas de seguridad');
    }

    return recommendations;
  }

  /**
   * Registrar métricas de calidad
   */
  async recordQualityMetrics(evaluation) {
    const timestamp = Date.now();
    const metrics = {
      timestamp,
      score: evaluation.score,
      passed: evaluation.passed,
      flags: evaluation.flags,
      details: evaluation.details
    };

    // Mantener historial limitado
    const historyKey = 'overall';
    if (!this.qualityHistory.has(historyKey)) {
      this.qualityHistory.set(historyKey, []);
    }

    const history = this.qualityHistory.get(historyKey);
    history.push(metrics);

    // Mantener solo las últimas 1000 evaluaciones
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Métodos auxiliares
   */
  extractKeywords(text) {
    // Extraer palabras significativas (más de 3 caracteres, no stop words)
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 20); // Limitar a 20 palabras clave
  }

  evaluateResponseStructure(prompt, response) {
    // Evaluar si la estructura de respuesta es apropiada para el tipo de pregunta
    const isQuestion = /\?/.test(prompt);
    const isList = /\d+\.|[-*]/.test(prompt);
    const isExplanation = /explain|describe|how|why/i.test(prompt);

    let structureScore = 0.5; // Base

    if (isQuestion && response.includes('?')) structureScore += 0.1;
    if (isList && /\d+\.|[-*]/.test(response)) structureScore += 0.2;
    if (isExplanation && response.length > 100) structureScore += 0.2;

    return Math.min(1, structureScore);
  }

  evaluateSemanticRelevance(prompt, response) {
    // Evaluación semántica básica basada en contexto
    const promptContext = this.extractContext(prompt);
    const responseContext = this.extractContext(response);
    
    const contextOverlap = promptContext.filter(ctx => 
      responseContext.some(rCtx => rCtx.includes(ctx) || ctx.includes(rCtx))
    ).length;

    return promptContext.length > 0 ? contextOverlap / promptContext.length : 0.5;
  }

  extractContext(text) {
    // Extraer contexto semántico básico
    const contexts = [];
    
    // Detectar dominios técnicos
    if (/code|programming|software|algorithm/i.test(text)) contexts.push('technical');
    if (/business|marketing|strategy|sales/i.test(text)) contexts.push('business');
    if (/science|research|study|analysis/i.test(text)) contexts.push('scientific');
    if (/creative|art|design|story/i.test(text)) contexts.push('creative');
    
    return contexts;
  }

  evaluateSentenceStructure(sentences) {
    if (sentences.length === 0) return 0;

    let structureScore = 0;
    
    // Evaluar variedad en longitud de oraciones
    const lengths = sentences.map(s => s.length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    
    // Penalizar oraciones muy cortas o muy largas
    const appropriateLengths = lengths.filter(len => len >= 20 && len <= 200).length;
    structureScore += (appropriateLengths / lengths.length) * 0.5;
    
    // Recompensar variedad (pero no demasiada)
    const varietyScore = Math.min(1, Math.sqrt(variance) / avgLength);
    structureScore += varietyScore * 0.5;

    return Math.min(1, structureScore);
  }

  evaluateLogicalFlow(sentences) {
    if (sentences.length <= 1) return 1;

    let flowScore = 0;
    
    // Buscar conectores lógicos
    const connectors = ['however', 'therefore', 'furthermore', 'additionally', 'consequently', 'meanwhile'];
    const connectorsFound = sentences.filter(sentence => 
      connectors.some(connector => sentence.toLowerCase().includes(connector))
    ).length;
    
    flowScore += Math.min(0.5, connectorsFound / sentences.length);
    
    // Evaluar progresión temática (básica)
    const topicConsistency = this.evaluateTopicConsistency(sentences);
    flowScore += topicConsistency * 0.5;

    return Math.min(1, flowScore);
  }

  evaluateTopicConsistency(sentences) {
    // Evaluación básica de consistencia temática
    const allWords = sentences.join(' ').toLowerCase().split(/\W+/);
    const wordFreq = new Map();
    
    allWords.forEach(word => {
      if (word.length > 4) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });
    
    // Calcular palabras que aparecen en múltiples oraciones
    const repeatedWords = Array.from(wordFreq.entries())
      .filter(([word, freq]) => freq > 1)
      .length;
    
    return Math.min(1, repeatedWords / Math.max(1, wordFreq.size));
  }

  evaluateTerminologyConsistency(response) {
    // Detectar uso consistente de terminología
    const terms = this.extractTechnicalTerms(response);
    const variations = this.detectTermVariations(terms);
    
    return Math.max(0, 1 - (variations / Math.max(1, terms.length)));
  }

  extractTechnicalTerms(text) {
    // Extraer términos técnicos básicos
    const technicalPatterns = [
      /\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b/g, // CamelCase
      /\b[a-z]+_[a-z_]+\b/g,            // snake_case
      /\b[A-Z]{2,}\b/g                  // ACRONYMS
    ];
    
    const terms = [];
    technicalPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      terms.push(...matches);
    });
    
    return [...new Set(terms)]; // Eliminar duplicados
  }

  detectTermVariations(terms) {
    // Detectar variaciones de los mismos términos
    let variations = 0;
    
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        const similarity = this.calculateStringSimilarity(terms[i], terms[j]);
        if (similarity > 0.8 && similarity < 1) {
          variations++;
        }
      }
    }
    
    return variations;
  }

  calculateStringSimilarity(str1, str2) {
    // Algoritmo de similitud básico (Levenshtein simplificado)
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  detectContradictions(sentences) {
    // Detectar contradicciones básicas
    let contradictions = 0;
    
    const negationPatterns = [
      /\bnot\b/gi,
      /\bno\b/gi,
      /\bnever\b/gi,
      /\bcan't\b/gi,
      /\bwon't\b/gi,
      /\bisn't\b/gi,
      /\baren't\b/gi
    ];
    
    for (let i = 0; i < sentences.length; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        const sent1 = sentences[i].toLowerCase();
        const sent2 = sentences[j].toLowerCase();
        
        // Buscar patrones contradictorios básicos
        const hasNegation1 = negationPatterns.some(pattern => pattern.test(sent1));
        const hasNegation2 = negationPatterns.some(pattern => pattern.test(sent2));
        
        if (hasNegation1 !== hasNegation2) {
          const similarity = this.calculateStringSimilarity(
            sent1.replace(/\b(not|no|never|can't|won't|isn't|aren't)\b/gi, ''),
            sent2.replace(/\b(not|no|never|can't|won't|isn't|aren't)\b/gi, '')
          );
          
          if (similarity > 0.7) {
            contradictions++;
          }
        }
      }
    }
    
    return Math.min(1, contradictions / Math.max(1, sentences.length));
  }

  detectQuestionType(prompt) {
    const types = {
      'what': /\bwhat\b/i,
      'how': /\bhow\b/i,
      'why': /\bwhy\b/i,
      'when': /\bwhen\b/i,
      'where': /\bwhere\b/i,
      'who': /\bwho\b/i,
      'list': /\blist\b|\benumerate\b/i,
      'explain': /\bexplain\b|\bdescribe\b/i,
      'compare': /\bcompare\b|\bcontrast\b/i,
      'analyze': /\banalyze\b|\bevaluate\b/i
    };
    
    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(prompt)) return type;
    }
    
    return 'general';
  }

  evaluateAspectsCoverage(prompt, response, questionType) {
    // Evaluar si la respuesta cubre los aspectos esperados según el tipo de pregunta
    const expectedAspects = {
      'what': ['definition', 'characteristics'],
      'how': ['steps', 'process', 'method'],
      'why': ['reasons', 'causes', 'explanation'],
      'compare': ['similarities', 'differences'],
      'analyze': ['components', 'relationships', 'implications'],
      'list': ['items', 'enumeration']
    };
    
    const aspects = expectedAspects[questionType] || ['information'];
    let coverage = 0;
    
    aspects.forEach(aspect => {
      if (this.responseContainsAspect(response, aspect)) {
        coverage += 1 / aspects.length;
      }
    });
    
    return coverage;
  }

  responseContainsAspect(response, aspect) {
    const aspectPatterns = {
      'definition': /\bis\b|\bmeans\b|\bdefined as\b/i,
      'characteristics': /\bfeatures\b|\bproperties\b|\bcharacteristics\b/i,
      'steps': /\bstep\b|\bfirst\b|\bthen\b|\bnext\b|\bfinally\b/i,
      'process': /\bprocess\b|\bprocedure\b|\bmethod\b/i,
      'reasons': /\bbecause\b|\breason\b|\bdue to\b|\bcaused by\b/i,
      'similarities': /\bsimilar\b|\balike\b|\bboth\b|\bcommon\b/i,
      'differences': /\bdifferent\b|\bunlike\b|\bhowever\b|\bwhereas\b/i,
      'components': /\bparts\b|\belements\b|\bcomponents\b|\bconsists of\b/i,
      'items': /\d+\.|[-*]\s|\bfirst\b|\bsecond\b|\bthird\b/i
    };
    
    const pattern = aspectPatterns[aspect];
    return pattern ? pattern.test(response) : true;
  }

  evaluateResponseDepth(response, questionType) {
    // Evaluar profundidad según el tipo de pregunta
    const minDepthRequirements = {
      'explain': 200,
      'analyze': 300,
      'compare': 250,
      'how': 150,
      'why': 150,
      'general': 100
    };
    
    const minLength = minDepthRequirements[questionType] || 100;
    const lengthScore = Math.min(1, response.length / minLength);
    
    // Evaluar estructura (párrafos, listas, etc.)
    const paragraphs = response.split('\n\n').filter(p => p.trim().length > 0);
    const structureScore = Math.min(1, paragraphs.length / 2);
    
    return (lengthScore * 0.7 + structureScore * 0.3);
  }

  detectMissingInformation(prompt, response) {
    // Detectar información obviamente faltante
    const promptQuestions = (prompt.match(/\?/g) || []).length;
    const responseAnswers = this.countAnswerIndicators(response);
    
    if (promptQuestions > 0 && responseAnswers === 0) {
      return 0.8; // Alta probabilidad de información faltante
    }
    
    if (promptQuestions > responseAnswers) {
      return 0.3; // Alguna información podría faltar
    }
    
    return 0; // No hay información obviamente faltante
  }

  countAnswerIndicators(response) {
    const indicators = [
      /\byes\b|\bno\b/gi,
      /\bbecause\b|\bdue to\b/gi,
      /\bthe answer is\b|\bthe result is\b/gi,
      /\bin conclusion\b|\bto summarize\b/gi
    ];
    
    return indicators.reduce((count, pattern) => {
      const matches = response.match(pattern) || [];
      return count + matches.length;
    }, 0);
  }

  applyContentFilter(content, filter) {
    const violations = [];
    
    filter.patterns.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({
          pattern: index,
          matches: matches.length,
          examples: matches.slice(0, 3) // Primeros 3 ejemplos
        });
      }
    });
    
    return violations;
  }

  detectHarmfulContent(response) {
    const harmfulIndicators = [
      /\b(suicide|self-harm|kill yourself)\b/gi,
      /\b(bomb|weapon|violence|attack)\b/gi,
      /\b(illegal|criminal|fraud|scam)\b/gi
    ];
    
    const detected = harmfulIndicators.some(pattern => pattern.test(response));
    
    return {
      detected,
      confidence: detected ? 0.8 : 0.1
    };
  }

  extractFactualClaims(response) {
    // Extraer afirmaciones que parecen fácticas
    const factualPatterns = [
      /\b\d{4}\b/g, // Años
      /\b\d+%\b/g,  // Porcentajes
      /\b\d+\s*(million|billion|thousand)\b/gi, // Números grandes
      /\baccording to\b|\bstudies show\b|\bresearch indicates\b/gi // Referencias
    ];
    
    const claims = [];
    factualPatterns.forEach(pattern => {
      const matches = response.match(pattern) || [];
      claims.push(...matches);
    });
    
    return claims;
  }

  evaluateConfidenceIndicators(response) {
    const highConfidence = [
      /\bcertainly\b|\bdefinitely\b|\bclearly\b/gi,
      /\balways\b|\bnever\b|\ball\b|\bnone\b/gi
    ];
    
    const lowConfidence = [
      /\bmight\b|\bmay\b|\bcould\b|\bpossibly\b/gi,
      /\bprobably\b|\blikely\b|\bseems\b|\bappears\b/gi
    ];
    
    const highCount = highConfidence.reduce((count, pattern) => {
      return count + (response.match(pattern) || []).length;
    }, 0);
    
    const lowCount = lowConfidence.reduce((count, pattern) => {
      return count + (response.match(pattern) || []).length;
    }, 0);
    
    // Retornar puntuación de confianza (0-1)
    const total = highCount + lowCount;
    return total > 0 ? (lowCount / total) : 0.5; // Más confianza con indicadores de incertidumbre
  }

  detectObviousErrors(response) {
    let errors = 0;
    
    // Detectar errores matemáticos obvios
    const mathErrors = [
      /2\s*\+\s*2\s*=\s*5/gi,
      /1\s*\+\s*1\s*=\s*3/gi
    ];
    
    mathErrors.forEach(pattern => {
      if (pattern.test(response)) errors++;
    });
    
    // Detectar fechas imposibles
    if (/February 30|February 31|April 31|June 31|September 31|November 31/gi.test(response)) {
      errors++;
    }
    
    return Math.min(1, errors / 5); // Normalizar a 0-1
  }

  /**
   * Obtener estadísticas de calidad
   */
  getQualityStats() {
    const stats = {
      totalEvaluations: 0,
      averageScore: 0,
      passRate: 0,
      commonFlags: new Map(),
      qualityTrends: []
    };

    for (const [key, history] of this.qualityHistory.entries()) {
      stats.totalEvaluations += history.length;
      
      if (history.length > 0) {
        const scores = history.map(h => h.score);
        const passed = history.filter(h => h.passed).length;
        
        stats.averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        stats.passRate = passed / history.length;
        
        // Contar flags comunes
        history.forEach(h => {
          h.flags.forEach(flag => {
            stats.commonFlags.set(flag, (stats.commonFlags.get(flag) || 0) + 1);
          });
        });
        
        // Calcular tendencias (últimas 10 evaluaciones vs anteriores)
        if (history.length >= 20) {
          const recent = history.slice(-10);
          const previous = history.slice(-20, -10);
          
          const recentAvg = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
          const previousAvg = previous.reduce((sum, h) => sum + h.score, 0) / previous.length;
          
          stats.qualityTrends.push({
            key,
            trend: recentAvg > previousAvg ? 'improving' : 'declining',
            change: ((recentAvg - previousAvg) / previousAvg * 100).toFixed(2)
          });
        }
      }
    }

    return stats;
  }

  /**
   * Limpiar historial antiguo
   */
  cleanupHistory(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 días por defecto
    const cutoff = Date.now() - maxAge;
    
    for (const [key, history] of this.qualityHistory.entries()) {
      const filtered = history.filter(h => h.timestamp > cutoff);
      this.qualityHistory.set(key, filtered);
    }
  }
}

export default AIQualityAssurance;
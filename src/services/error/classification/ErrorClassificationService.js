/**
 * ErrorClassificationService - Servicio de clasificación inteligente de errores
 * 
 * Funcionalidades:
 * - Clasificación automática de errores por severidad
 * - Categorización contextual
 * - Análisis semántico de mensajes
 * - Filtrado inteligente de duplicados
 * - Etiquetado automático
 */
class ErrorClassificationService {
  constructor(config = {}) {
    this.config = {
      intelligentClassification: true,
      contextualClassification: true,
      semanticAnalysis: true,
      autoTagging: true,
      duplicateWindow: 60000, // 1 minuto
      similarityThreshold: 0.8,
      noiseReduction: true,
      contextAware: true,
      ...config
    };

    // Niveles de severidad con configuración evolutiva
    this.severityLevels = {
      debug: {
        weight: 1,
        color: '\x1b[36m', // Cyan
        emoji: '🔍',
        threshold: 100,
        autoFlush: false
      },
      info: {
        weight: 2,
        color: '\x1b[32m', // Verde
        emoji: 'ℹ️',
        threshold: 50,
        autoFlush: false
      },
      warn: {
        weight: 3,
        color: '\x1b[33m', // Amarillo
        emoji: '⚠️',
        threshold: 20,
        autoFlush: true
      },
      error: {
        weight: 4,
        color: '\x1b[31m', // Rojo
        emoji: '❌',
        threshold: 10,
        autoFlush: true
      },
      critical: {
        weight: 5,
        color: '\x1b[35m', // Magenta
        emoji: '🚨',
        threshold: 1,
        autoFlush: true,
        requiresImmediate: true
      }
    };

    // Categorías contextuales
    this.categories = {
      system: {
        keywords: ['system', 'startup', 'shutdown', 'memory', 'cpu', 'disk'],
        patterns: [/system/i, /startup/i, /shutdown/i, /memory/i, /cpu/i]
      },
      business: {
        keywords: ['business', 'logic', 'validation', 'rule', 'workflow'],
        patterns: [/business/i, /logic/i, /validation/i, /rule/i, /workflow/i]
      },
      security: {
        keywords: ['auth', 'permission', 'security', 'token', 'unauthorized'],
        patterns: [/auth/i, /permission/i, /security/i, /token/i, /unauthorized/i]
      },
      performance: {
        keywords: ['timeout', 'slow', 'performance', 'latency', 'bottleneck'],
        patterns: [/timeout/i, /slow/i, /performance/i, /latency/i, /bottleneck/i]
      },
      integration: {
        keywords: ['api', 'service', 'external', 'integration', 'webhook'],
        patterns: [/api/i, /service/i, /external/i, /integration/i, /webhook/i]
      }
    };

    // Patrones de clasificación inteligente
    this.classificationPatterns = {
      critical: [
        /fatal/i,
        /critical/i,
        /system.*crash/i,
        /out of memory/i,
        /segmentation fault/i,
        /stack overflow/i
      ],
      error: [
        /error/i,
        /exception/i,
        /failed/i,
        /cannot/i,
        /unable/i,
        /invalid/i
      ],
      warn: [
        /warning/i,
        /deprecated/i,
        /slow/i,
        /retry/i,
        /fallback/i
      ],
      info: [
        /info/i,
        /started/i,
        /completed/i,
        /success/i
      ],
      debug: [
        /debug/i,
        /trace/i,
        /verbose/i
      ]
    };

    // Cache de clasificaciones recientes
    this.classificationCache = new Map();
    this.recentClassifications = [];
  }

  /**
   * Clasificar error de forma inteligente
   */
  async classifyErrorIntelligently(originalSeverity, message, metadata = {}, errorObj = null) {
    if (!this.config.intelligentClassification) {
      return originalSeverity;
    }

    try {
      // Análisis semántico del mensaje
      const semanticSeverity = this.analyzeMessageSemantics(message);
      
      // Análisis contextual
      const contextualSeverity = this.analyzeContext(metadata, errorObj);
      
      // Análisis de patrones
      const patternSeverity = this.analyzePatterns(message, metadata);
      
      // Combinar análisis para determinar severidad final
      const finalSeverity = this.combineSeverityAnalysis(
        originalSeverity,
        semanticSeverity,
        contextualSeverity,
        patternSeverity
      );

      // Cache de la clasificación
      this.cacheClassification(message, metadata, finalSeverity);

      return finalSeverity;
    } catch (error) {
      logger.error('Error en clasificación inteligente:', error);
      return originalSeverity;
    }
  }

  /**
   * Análisis semántico del mensaje
   */
  analyzeMessageSemantics(message) {
    const lowerMessage = message.toLowerCase();
    
    // Buscar patrones de severidad en orden de importancia
    for (const [severity, patterns] of Object.entries(this.classificationPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerMessage)) {
          return severity;
        }
      }
    }
    
    return null;
  }

  /**
   * Análisis contextual
   */
  analyzeContext(metadata, errorObj) {
    let contextSeverity = null;
    
    // Analizar stack trace si está disponible
    if (errorObj && errorObj.stack) {
      if (errorObj.stack.includes('OutOfMemoryError') || 
          errorObj.stack.includes('StackOverflowError')) {
        contextSeverity = 'critical';
      } else if (errorObj.stack.includes('TypeError') || 
                 errorObj.stack.includes('ReferenceError')) {
        contextSeverity = 'error';
      }
    }
    
    // Analizar metadata
    if (metadata.module) {
      if (metadata.module.includes('security') || metadata.module.includes('auth')) {
        contextSeverity = this.escalateSeverity(contextSeverity, 'error');
      }
    }
    
    if (metadata.category === 'system' && metadata.critical) {
      contextSeverity = 'critical';
    }
    
    return contextSeverity;
  }

  /**
   * Análisis de patrones
   */
  analyzePatterns(message, metadata) {
    // Buscar patrones específicos conocidos
    const patterns = {
      'database connection': 'error',
      'network timeout': 'warn',
      'authentication failed': 'error',
      'permission denied': 'error',
      'rate limit exceeded': 'warn',
      'service unavailable': 'error'
    };
    
    const lowerMessage = message.toLowerCase();
    for (const [pattern, severity] of Object.entries(patterns)) {
      if (lowerMessage.includes(pattern)) {
        return severity;
      }
    }
    
    return null;
  }

  /**
   * Combinar análisis de severidad
   */
  combineSeverityAnalysis(original, semantic, contextual, pattern) {
    const severities = [original, semantic, contextual, pattern].filter(Boolean);
    
    if (severities.length === 0) return 'info';
    
    // Obtener la severidad más alta
    const severityWeights = {
      debug: 1,
      info: 2,
      warn: 3,
      error: 4,
      critical: 5
    };
    
    let highestWeight = 0;
    let finalSeverity = original;
    
    for (const severity of severities) {
      const weight = severityWeights[severity] || 0;
      if (weight > highestWeight) {
        highestWeight = weight;
        finalSeverity = severity;
      }
    }
    
    return finalSeverity;
  }

  /**
   * Escalar severidad
   */
  escalateSeverity(currentSeverity, newSeverity) {
    const weights = {
      debug: 1,
      info: 2,
      warn: 3,
      error: 4,
      critical: 5
    };
    
    const currentWeight = weights[currentSeverity] || 0;
    const newWeight = weights[newSeverity] || 0;
    
    return newWeight > currentWeight ? newSeverity : currentSeverity;
  }

  /**
   * Clasificar error por categoría
   */
  async classifyError(message, metadata = {}) {
    const lowerMessage = message.toLowerCase();
    
    for (const [category, config] of Object.entries(this.categories)) {
      // Verificar keywords
      for (const keyword of config.keywords) {
        if (lowerMessage.includes(keyword)) {
          return category;
        }
      }
      
      // Verificar patrones
      for (const pattern of config.patterns) {
        if (pattern.test(lowerMessage)) {
          return category;
        }
      }
    }
    
    return 'general';
  }

  /**
   * Generar etiquetas automáticas
   */
  generateAutoTags(message, metadata = {}, category = null) {
    if (!this.config.autoTagging) return [];
    
    const tags = [];
    const lowerMessage = message.toLowerCase();
    
    // Tags basados en categoría
    if (category) {
      tags.push(category);
    }
    
    // Tags basados en contenido
    if (lowerMessage.includes('timeout')) tags.push('timeout');
    if (lowerMessage.includes('connection')) tags.push('connection');
    if (lowerMessage.includes('auth')) tags.push('authentication');
    if (lowerMessage.includes('permission')) tags.push('authorization');
    if (lowerMessage.includes('database')) tags.push('database');
    if (lowerMessage.includes('network')) tags.push('network');
    if (lowerMessage.includes('api')) tags.push('api');
    
    // Tags basados en metadata
    if (metadata.module) tags.push(`module:${metadata.module}`);
    if (metadata.source) tags.push(`source:${metadata.source}`);
    
    return [...new Set(tags)]; // Eliminar duplicados
  }

  /**
   * Verificar si es un error duplicado
   */
  isDuplicateError(message, metadata = {}) {
    if (!this.config.noiseReduction) return false;
    
    const now = Date.now();
    const key = this.generateErrorKey(message, metadata);
    
    // Limpiar entradas antiguas
    this.recentClassifications = this.recentClassifications.filter(
      entry => now - entry.timestamp < this.config.duplicateWindow
    );
    
    // Verificar duplicados
    const isDuplicate = this.recentClassifications.some(entry => 
      entry.key === key || this.calculateSimilarity(entry.message, message) > this.config.similarityThreshold
    );
    
    if (!isDuplicate) {
      this.recentClassifications.push({
        key,
        message,
        metadata,
        timestamp: now
      });
    }
    
    return isDuplicate;
  }

  /**
   * Calcular similitud entre mensajes
   */
  calculateSimilarity(message1, message2) {
    const words1 = message1.toLowerCase().split(/\s+/);
    const words2 = message2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Generar clave de error
   */
  generateErrorKey(message, metadata) {
    const keyParts = [
      message.substring(0, 100),
      metadata.module || '',
      metadata.source || ''
    ];
    
    return this.simpleHash(keyParts.join('|'));
  }

  /**
   * Hash simple para generar claves
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache de clasificación
   */
  cacheClassification(message, metadata, severity) {
    const key = this.generateErrorKey(message, metadata);
    this.classificationCache.set(key, {
      severity,
      timestamp: Date.now(),
      count: (this.classificationCache.get(key)?.count || 0) + 1
    });
    
    // Limpiar cache antiguo
    if (this.classificationCache.size > 1000) {
      const entries = Array.from(this.classificationCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Eliminar las 200 entradas más antiguas
      for (let i = 0; i < 200; i++) {
        this.classificationCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Obtener estadísticas de clasificación
   */
  getClassificationStats() {
    const stats = {
      totalClassifications: this.classificationCache.size,
      severityDistribution: {},
      categoryDistribution: {},
      recentDuplicates: this.recentClassifications.length
    };
    
    // Calcular distribución de severidad
    for (const [severity] of Object.entries(this.severityLevels)) {
      stats.severityDistribution[severity] = 0;
    }
    
    for (const entry of this.classificationCache.values()) {
      stats.severityDistribution[entry.severity] = 
        (stats.severityDistribution[entry.severity] || 0) + entry.count;
    }
    
    return stats;
  }

  /**
   * Limpiar cache y datos temporales
   */
  cleanup() {
    this.classificationCache.clear();
    this.recentClassifications = [];
  }
}

export default ErrorClassificationService;
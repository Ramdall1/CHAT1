/**
 * @fileoverview Generador de Respuestas Inteligente
 * 
 * Sistema avanzado para generar respuestas contextuales con soporte para:
 * - Análisis de sentimiento
 * - Detección de intención
 * - Personalización basada en perfil
 * - Caché de respuestas
 * - Validación de calidad
 * 
 * @author ChatBot Enterprise Team
 * @version 2.0.0
 */

class ResponseGenerator {
  constructor(config = {}) {
    this.config = {
      maxResponseLength: config.maxResponseLength || 1000,
      minConfidence: config.minConfidence || 0.5,
      enablePersonalization: config.enablePersonalization !== false,
      enableSentimentAnalysis: config.enableSentimentAnalysis !== false,
      cacheResponses: config.cacheResponses !== false,
      ...config
    };
    
    this.responseCache = new Map();
    this.intentPatterns = this.initializeIntentPatterns();
    this.sentimentKeywords = this.initializeSentimentKeywords();
  }

  /**
   * Inicializar patrones de intención
   */
  initializeIntentPatterns() {
    return {
      greeting: {
        patterns: ['hola', 'hi', 'buenos días', 'buenas tardes', 'buenas noches', 'hey', 'ey'],
        responses: [
          '¡Hola {name}! ¿En qué puedo ayudarte hoy?',
          'Bienvenido {name}, ¿qué necesitas?',
          '¡Hola! Me alegra verte {name}. ¿Cómo estás?'
        ]
      },
      help: {
        patterns: ['ayuda', 'help', 'necesito ayuda', 'puedes ayudarme', 'soporte', 'asistencia'],
        responses: [
          'Estoy aquí para ayudarte. ¿Cuál es tu pregunta específica?',
          'Claro, estoy disponible para asistirte. ¿Qué necesitas?',
          'Por supuesto, cuéntame cómo puedo ayudarte.'
        ]
      },
      thanks: {
        patterns: ['gracias', 'thanks', 'muchas gracias', 'agradezco', 'thank you'],
        responses: [
          '¡De nada! Estoy aquí para ayudarte cuando lo necesites.',
          'Es un placer ayudarte. ¿Hay algo más?',
          'Gracias por tu confianza. ¿Necesitas algo más?'
        ]
      },
      goodbye: {
        patterns: ['adiós', 'bye', 'hasta luego', 'chao', 'nos vemos', 'goodbye'],
        responses: [
          '¡Hasta luego! Que tengas un excelente día.',
          'Fue un placer hablar contigo. ¡Hasta pronto!',
          '¡Que tengas un gran día! Vuelve pronto.'
        ]
      },
      complaint: {
        patterns: ['problema', 'error', 'no funciona', 'queja', 'insatisfecho', 'mal servicio'],
        responses: [
          'Lamento escuchar eso. ¿Puedes describir el problema con más detalle?',
          'Entiendo tu preocupación. Vamos a resolver esto juntos.',
          'Disculpa las molestias. ¿Qué específicamente no está funcionando?'
        ]
      },
      inquiry: {
        patterns: ['precio', 'costo', 'cuánto', 'disponibilidad', 'información', 'detalles'],
        responses: [
          'Con gusto te proporciono esa información. ¿Qué específicamente te interesa?',
          'Puedo ayudarte con eso. Cuéntame más detalles.',
          'Excelente pregunta. Déjame ayudarte con esa información.'
        ]
      }
    };
  }

  /**
   * Inicializar palabras clave de sentimiento
   */
  initializeSentimentKeywords() {
    return {
      positive: ['excelente', 'genial', 'perfecto', 'amor', 'feliz', 'adorable', 'increíble'],
      negative: ['terrible', 'horrible', 'malo', 'odio', 'triste', 'decepcionado', 'furioso'],
      neutral: ['ok', 'bien', 'normal', 'regular', 'promedio', 'aceptable']
    };
  }

  /**
   * Detectar intención del mensaje
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();
    let detectedIntent = null;
    let confidence = 0;

    for (const [intent, config] of Object.entries(this.intentPatterns)) {
      for (const pattern of config.patterns) {
        if (lowerMessage.includes(pattern)) {
          const patternConfidence = pattern.length / lowerMessage.length;
          if (patternConfidence > confidence) {
            confidence = Math.min(patternConfidence, 1);
            detectedIntent = intent;
          }
        }
      }
    }

    return {
      intent: detectedIntent || 'unknown',
      confidence: Math.round(confidence * 100) / 100
    };
  }

  /**
   * Analizar sentimiento del mensaje
   */
  analyzeSentiment(message) {
    const lowerMessage = message.toLowerCase();
    let sentiment = 'neutral';
    let score = 0;

    for (const keyword of this.sentimentKeywords.positive) {
      if (lowerMessage.includes(keyword)) score += 1;
    }

    for (const keyword of this.sentimentKeywords.negative) {
      if (lowerMessage.includes(keyword)) score -= 1;
    }

    if (score > 0) sentiment = 'positive';
    else if (score < 0) sentiment = 'negative';

    return {
      sentiment,
      score: Math.max(-1, Math.min(1, score / 3))
    };
  }

  /**
   * Personalizar respuesta
   */
  personalizeResponse(response, contact, context = {}) {
    let personalized = response;

    personalized = personalized.replace('{name}', contact.name || 'usuario');
    personalized = personalized.replace('{firstName}', (contact.name || '').split(' ')[0]);
    personalized = personalized.replace('{timestamp}', new Date().toLocaleTimeString('es-ES'));

    if (context.sentiment === 'negative') {
      personalized = `Entiendo tu preocupación. ${personalized}`;
    } else if (context.sentiment === 'positive') {
      personalized = `¡Excelente! ${personalized}`;
    }

    return personalized;
  }

  /**
   * Validar calidad de respuesta
   */
  validateResponse(response) {
    const issues = [];

    if (!response || response.trim().length === 0) {
      issues.push('Respuesta vacía');
    }

    if (response.length > this.config.maxResponseLength) {
      issues.push(`Respuesta demasiado larga (${response.length} caracteres)`);
    }

    if (response.length < 10) {
      issues.push('Respuesta demasiado corta');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Generar respuesta completa
   */
  async generateResponse(message, contact, context = {}) {
    try {
      // Detectar intención
      const intentAnalysis = this.detectIntent(message);
      
      // Analizar sentimiento
      const sentimentAnalysis = this.analyzeSentiment(message);

      // Buscar en caché
      const cacheKey = `${intentAnalysis.intent}_${contact.id || 'default'}`;
      if (this.config.cacheResponses && this.responseCache.has(cacheKey)) {
        return this.responseCache.get(cacheKey);
      }

      // Seleccionar respuesta base
      let baseResponse;
      if (intentAnalysis.confidence >= this.config.minConfidence) {
        const intentConfig = this.intentPatterns[intentAnalysis.intent];
        baseResponse = intentConfig.responses[
          Math.floor(Math.random() * intentConfig.responses.length)
        ];
      } else {
        baseResponse = `Gracias por tu mensaje. He recibido: "${message}". ¿Hay algo específico en lo que pueda ayudarte?`;
      }

      // Personalizar respuesta
      const finalResponse = this.config.enablePersonalization
        ? this.personalizeResponse(baseResponse, contact, sentimentAnalysis)
        : baseResponse;

      // Validar respuesta
      const validation = this.validateResponse(finalResponse);
      if (!validation.valid) {
        logger.warn('Validación de respuesta falló:', validation.issues);
      }

      // Guardar en caché
      if (this.config.cacheResponses) {
        this.responseCache.set(cacheKey, finalResponse);
      }

      return finalResponse;
    } catch (error) {
      logger.error('Error generando respuesta:', error);
      return `Disculpa, tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo?`;
    }
  }

  /**
   * Limpiar caché
   */
  clearCache() {
    this.responseCache.clear();
  }

  /**
   * Obtener estadísticas de caché
   */
  getCacheStats() {
    return {
      size: this.responseCache.size,
      entries: Array.from(this.responseCache.keys())
    };
  }
}

/**
 * Función legacy para compatibilidad
 */
async function generateResponse(message, contact) {
  const generator = new ResponseGenerator();
  return await generator.generateResponse(message, contact);
}

export { ResponseGenerator, generateResponse };
export default ResponseGenerator;
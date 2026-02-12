import { enviarPlantillaPrueba } from '../api/enviarPlantillaPrueba.js';
import { messageUtils } from '../../../../src/shared/utils/helpers/helpers/MessageUtils.js';
import { createLocalDB } from '../core/localDB.js';
import { Persuader } from './persuader.js';
import analyticsService from '../services/AnalyticsService.js';

const db = createLocalDB();

/**
 * Clase principal para la lógica conversacional de la IA
 * Actúa como "Asesor comercial con contexto persistente"
 */
export class ChatLogic {
  constructor() {
    this.contextCache = new Map(); // Cache de contexto por usuario
    this.intentionThreshold = 0.7; // Umbral de confianza para detectar intención
    this.persuader = new Persuader(); // Sistema de persuasión emocional

    // Palabras que indican desinterés o rechazo
    this.rejectionKeywords = [
      'no me interesa',
      'no quiero',
      'no gracias',
      'déjame en paz',
      'no molestes',
      'estafa',
      'fraude',
      'no confío',
      'eliminar',
      'borrar',
      'stop',
      'basta',
    ];
  }

  /**
   * Procesa un mensaje entrante y determina la respuesta apropiada
   */
  async processMessage(phone, message, messageHistory = []) {
    try {
      // Normalizar número de teléfono
      const normalizedPhone = db.normalizePhone(phone);

      // Obtener o crear contexto del usuario
      const userContext = await this.getUserContext(
        normalizedPhone,
        messageHistory
      );

      // Actualizar contexto con el nuevo mensaje
      this.updateContext(normalizedPhone, message, userContext);

      // Detectar intención de compra
      const intentionResult = this.detectPurchaseIntention(
        message,
        userContext
      );

      // Manejar rechazo explícito
      if (intentionResult.isRejection) {
        console.log(`🚫 Rechazo detectado de ${normalizedPhone}`);

        const rejectionMessage =
          'Entiendo perfectamente 😊 No hay problema. Si en algún momento cambias de opinión o tienes alguna pregunta, estaré aquí para ayudarte. ¡Que tengas un excelente día! 🌟';

        const messageResult = await messageUtils.sendTextMessage(
          normalizedPhone,
          rejectionMessage
        );

        // Marcar usuario como no interesado temporalmente
        this.updateUserContext(normalizedPhone, {
          rejectionTime: Date.now(),
          isRejected: true,
          rejectionCount: (userContext.rejectionCount || 0) + 1,
        });

        return {
          success: true,
          action: 'rejection_handled',
          response: rejectionMessage,
          intentionResult,
        };
      }

      // Si se detecta intención de compra, ejecutar flujo de venta
      if (
        intentionResult.detected &&
        intentionResult.confidence >= this.intentionThreshold
      ) {
        return await this.handlePurchaseIntention(
          normalizedPhone,
          userContext,
          intentionResult,
          message
        );
      }

      // Si no hay intención de compra, generar respuesta informativa
      return await this.generateInformativeResponse(message, userContext);
    } catch (error) {
      console.error('❌ Error procesando mensaje en ChatLogic:', error);
      return {
        success: false,
        error: error.message,
        response:
          'Disculpa, hubo un error procesando tu mensaje. ¿Podrías intentar de nuevo?',
      };
    }
  }

  /**
   * Obtiene el contexto del usuario desde la base de datos
   */
  async getUserContext(phone, messageHistory) {
    // Verificar cache primero
    if (this.contextCache.has(phone)) {
      const cached = this.contextCache.get(phone);
      // Si el cache es reciente (menos de 30 minutos), usarlo
      if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
        return cached.context;
      }
    }

    // Obtener historial de mensajes de la base de datos
    const dbHistory = db.getHistoryByPhone(phone);
    const recentMessages = dbHistory.slice(-20); // Últimos 20 mensajes

    // Obtener información del contacto
    const contact = db.getContact(phone) || {};

    const context = {
      phone,
      name: contact.name || null,
      messageCount: dbHistory.length,
      recentMessages: recentMessages.map(m => ({
        text: m.text || m.caption || '',
        from: m.from,
        timestamp: m.ts,
        type: m.type || 'text',
      })),
      interests: this.extractInterests(recentMessages),
      previousQuestions: this.extractQuestions(recentMessages),
      engagementLevel: this.calculateEngagementLevel(recentMessages),
      lastInteraction:
        recentMessages.length > 0
          ? recentMessages[recentMessages.length - 1].ts
          : null,
      purchaseSignals: this.extractPurchaseSignals(recentMessages),
    };

    // Guardar en cache
    this.contextCache.set(phone, {
      context,
      timestamp: Date.now(),
    });

    return context;
  }

  /**
   * Actualiza el contexto del usuario con nueva información
   */
  updateContext(phone, newMessage, context) {
    // Agregar nuevo mensaje al contexto
    context.recentMessages.push({
      text: newMessage,
      from: phone,
      timestamp: Date.now(),
      type: 'text',
    });

    // Mantener solo los últimos 20 mensajes
    if (context.recentMessages.length > 20) {
      context.recentMessages = context.recentMessages.slice(-20);
    }

    // Actualizar métricas
    context.messageCount++;
    context.lastInteraction = Date.now();
    context.interests = this.extractInterests(context.recentMessages);
    context.previousQuestions = this.extractQuestions(context.recentMessages);
    context.engagementLevel = this.calculateEngagementLevel(
      context.recentMessages
    );
    context.purchaseSignals = this.extractPurchaseSignals(
      context.recentMessages
    );

    // Actualizar cache
    this.contextCache.set(phone, {
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Detecta intención de compra en el mensaje
   */
  detectPurchaseIntention(message, context) {
    const text = message.toLowerCase().trim();

    // Verificar si es un rechazo explícito
    const isRejection = this.rejectionKeywords.some(keyword =>
      text.includes(keyword)
    );

    if (isRejection) {
      return {
        detected: false,
        confidence: 0,
        intentionType: 'rejection',
        detectedPhrases: ['rechazo'],
        contextFactors: this.getContextFactors(context),
        isRejection: true,
      };
    }

    // Frases directas de intención de compra (alta confianza)
    const highIntentionPhrases = [
      'quiero participar',
      'quiero comprar',
      'como participo',
      'mándame la info',
      'envíame la información',
      'me interesa participar',
      'quiero los números',
      'como hago para participar',
      'necesito el link',
      'quiero el formulario',
      'estoy interesado',
      'me apunto',
      'cuenta conmigo',
    ];

    // Frases de interés medio (confianza media)
    const mediumIntentionPhrases = [
      'cuánto vale',
      'cuánto cuesta',
      'qué precio',
      'como se paga',
      'métodos de pago',
      'cuál es el precio',
      'info del precio',
      'cuánto es',
      'valor de',
      'costo de',
    ];

    // Frases de consulta (baja confianza, pero indica interés)
    const lowIntentionPhrases = [
      'cómo funciona',
      'qué es esto',
      'de qué se trata',
      'más información',
      'cuéntame más',
      'explícame',
      'no entiendo',
      'qué premios',
      'cuándo es',
      'hasta cuándo',
    ];

    let confidence = 0;
    const detectedPhrases = [];
    let intentionType = 'none';

    // Verificar frases de alta intención
    for (const phrase of highIntentionPhrases) {
      if (text.includes(phrase)) {
        confidence = Math.max(confidence, 0.9);
        detectedPhrases.push(phrase);
        intentionType = 'high_purchase';
      }
    }

    // Verificar frases de intención media
    for (const phrase of mediumIntentionPhrases) {
      if (text.includes(phrase)) {
        confidence = Math.max(confidence, 0.7);
        detectedPhrases.push(phrase);
        if (intentionType === 'none') intentionType = 'price_inquiry';
      }
    }

    // Verificar frases de baja intención
    for (const phrase of lowIntentionPhrases) {
      if (text.includes(phrase)) {
        confidence = Math.max(confidence, 0.4);
        detectedPhrases.push(phrase);
        if (intentionType === 'none') intentionType = 'information_seeking';
      }
    }

    // Ajustar confianza basado en el contexto del usuario
    confidence = this.adjustConfidenceByContext(confidence, context);

    const result = {
      detected: confidence >= this.intentionThreshold,
      confidence,
      intentionType,
      detectedPhrases,
      contextFactors: this.getContextFactors(context),
      isRejection: false,
    };

    // Track AI interaction analytics
    analyticsService.trackAIInteraction(
      intentionType,
      confidence,
      result.detected,
      false // No emotional persuasion yet
    );

    return result;
  }

  /**
   * Ajusta la confianza de intención basado en el contexto del usuario
   */
  adjustConfidenceByContext(baseConfidence, context) {
    let adjustedConfidence = baseConfidence;

    // Si el usuario ya ha mostrado interés antes, aumentar confianza
    if (context.purchaseSignals.length > 0) {
      adjustedConfidence += 0.1;
    }

    // Si el usuario ha hecho muchas preguntas, aumentar confianza
    if (context.previousQuestions.length >= 3) {
      adjustedConfidence += 0.1;
    }

    // Si el nivel de engagement es alto, aumentar confianza
    if (context.engagementLevel > 0.7) {
      adjustedConfidence += 0.1;
    }

    // Si es un usuario nuevo con pocas interacciones, ser más conservador
    if (context.messageCount < 3) {
      adjustedConfidence -= 0.1;
    }

    return Math.min(1.0, Math.max(0.0, adjustedConfidence));
  }

  /**
   * Maneja cuando se detecta intención de compra
   */
  async handlePurchaseIntention(phone, context, intentionResult, message) {
    try {
      console.log(
        `🎯 Intención de compra detectada para ${phone} con confianza ${intentionResult.confidence}`
      );

      // Verificar si ya se envió plantilla recientemente (evitar spam)
      if (
        context.lastTemplateTime &&
        Date.now() - context.lastTemplateTime < 300000
      ) {
        // 5 minutos
        console.log(
          `⏰ Plantilla enviada recientemente a ${phone}, esperando...`
        );

        // Enviar mensaje de seguimiento en lugar de plantilla
        const followUpMessage =
          'Ya te envié el formulario hace un momento 😊 ¿Pudiste verlo? Si tienes algún problema para llenarlo, avísame y te ayudo 🤝';
        await messageUtils.sendTextMessage(phone, followUpMessage);

        return {
          success: true,
          action: 'follow_up_sent',
          message: 'Mensaje de seguimiento enviado',
        };
      }

      // Crear contexto para el persuader
      const contextoPersuasion = {
        interes: this.extractKeywords(message),
        pregunta: message,
        nivelEngagement: this.determinarNivelEngagement(context, message),
        historial: context?.recentMessages || [],
      };

      // Generar mensaje persuasivo personalizado
      const persuasiveMessage =
        this.persuader.generarMensajePersuasivo(contextoPersuasion);

      // Enviar mensaje persuasivo
      const messageResult = await messageUtils.sendTextMessage(
        phone,
        persuasiveMessage
      );

      if (messageResult.success) {
        console.log(`💬 Mensaje persuasivo enviado a ${phone}`);

        // Esperar un momento antes de enviar la plantilla
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Generar mensaje para acompañar el formulario
        const formularioMessage = this.persuader.generarMensajeFormulario();

        // Enviar mensaje del formulario
        await messageUtils.sendTextMessage(phone, formularioMessage);

        // Esperar otro momento
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Enviar plantilla de prueba
        const templateResult = await enviarPlantillaPrueba(phone);

        if (templateResult.success) {
          console.log(`📋 Plantilla enviada exitosamente a ${phone}`);

          // Actualizar contexto del usuario
          this.updateUserContext(phone, {
            lastTemplateTime: Date.now(),
            templatesSent: (context.templatesSent || 0) + 1,
            purchaseIntentDetected: true,
            persuasionLevel: (context.persuasionLevel || 0) + 1,
            lastInteractionTime: Date.now(),
          });

          // Registrar la acción en el contexto
          context.purchaseSignals.push({
            type: 'template_sent',
            timestamp: Date.now(),
            confidence: intentionResult.confidence,
          });

          return {
            success: true,
            action: 'template_sent',
            message: 'Plantilla enviada exitosamente',
            response: persuasiveMessage,
            templateResult,
            intentionResult,
          };
        } else {
          console.error(
            `❌ Error enviando plantilla a ${phone}:`,
            templateResult.error
          );

          // Enviar mensaje de disculpa
          const errorMessage =
            "Disculpa, hubo un pequeño problema técnico 😅 ¿Podrías escribirme 'FORMULARIO' para intentar de nuevo? Te ayudo enseguida 🤝";
          await messageUtils.sendTextMessage(phone, errorMessage);

          return {
            success: false,
            error: 'Error enviando plantilla',
            details: templateResult.error,
            response: persuasiveMessage,
          };
        }
      } else {
        console.error(
          `❌ Error enviando mensaje persuasivo a ${phone}:`,
          messageResult.error
        );
        return {
          success: false,
          error: 'Error enviando mensaje persuasivo',
          details: messageResult.error,
        };
      }
    } catch (error) {
      console.error('❌ Error manejando intención de compra:', error);
      return {
        success: false,
        error: error.message,
        response:
          'Perfecto, veo que estás interesado. Déjame enviarte la información por otro medio. ¿Podrías confirmarme tu nombre completo?',
      };
    }
  }

  /**
   * Genera una respuesta informativa cuando no hay intención de compra
   */
  async generateInformativeResponse(message, context) {
    const text = message.toLowerCase();

    // Verificar si es una pregunta frecuente que el persuader puede manejar
    const respuestaFrecuente =
      this.persuader.responderPreguntaFrecuente(message);
    if (respuestaFrecuente) {
      return {
        success: true,
        response: respuestaFrecuente,
      };
    }

    // Determinar el nivel de engagement del usuario
    const nivelEngagement = this.determinarNivelEngagement(context, text);

    // Crear contexto para el persuader
    const contextoPersuasion = {
      interes: text,
      pregunta: message,
      nivelEngagement,
      historial: context?.recentMessages || [],
    };

    // Si hay alta intención, usar mensaje persuasivo
    if (
      nivelEngagement === 'alto' ||
      text.includes('quiero') ||
      text.includes('interesa') ||
      text.includes('participo') ||
      text.includes('comprar')
    ) {
      return {
        success: true,
        response: this.persuader.generarMensajePersuasivo(contextoPersuasion),
      };
    }

    // Respuestas basadas en palabras clave con toque persuasivo
    if (
      text.includes('precio') ||
      text.includes('costo') ||
      text.includes('vale')
    ) {
      return {
        success: true,
        response:
          'Cada número de 4 dígitos cuesta solo $1.000 COP 💰 ¡Es como comprar un café pero con la posibilidad de ganar $4.000.000 COP! 🎯 Imagínate todo lo que podrías hacer con esa cantidad. ¿Te interesa participar?',
      };
    }

    if (
      text.includes('premio') ||
      text.includes('ganar') ||
      text.includes('cuánto')
    ) {
      return {
        success: true,
        response:
          '¡El premio es increíble! 🤩 Son $4.000.000 COP completos para el ganador. Piensa en todo lo que podrías hacer: ayudar a tu familia, cumplir tus sueños, cambiar tu vida completamente 💫✨ ¿Quieres saber cómo participar?',
      };
    }

    if (
      text.includes('segur') ||
      text.includes('confiable') ||
      text.includes('legal')
    ) {
      return {
        success: true,
        response:
          'Puedes estar 100% tranquilo/a 🛡️ Somos una empresa seria con años de experiencia y cientos de ganadores reales. Tu dinero está completamente seguro y trabajamos con total transparencia ✅ ¿Quieres ver algunos testimonios de nuestros ganadores?',
      };
    }

    if (
      text.includes('pago') ||
      text.includes('nequi') ||
      text.includes('transferencia')
    ) {
      return {
        success: true,
        response:
          'Puedes pagar de forma súper fácil y segura 📱 Aceptamos Nequi, transferencias bancarias y otros métodos. El pago es solo después de confirmar tus números, así tienes total tranquilidad 💳✨ ¿Te interesa conocer más detalles?',
      };
    }

    // Respuesta general amigable con toque persuasivo
    return {
      success: true,
      response:
        '¡Hola! 👋 Te cuento sobre esta increíble oportunidad que está cambiando vidas: puedes ganar $4.000.000 COP con números de solo $1.000 COP cada uno 🎯✨ ¡Es tu momento de brillar! ¿Qué te gustaría saber específicamente?',
    };
  }

  /**
   * Determina el nivel de engagement del usuario
   */
  determinarNivelEngagement(context, text) {
    if (!context) return 'bajo';

    let score = 0;

    // Factores que aumentan el engagement
    if (context.messageCount > 3) score += 1;
    if (context.interests && context.interests.includes('pricing')) score += 2;
    if (context.purchaseSignals && context.purchaseSignals.length > 0)
      score += 2;
    if (
      text.includes('quiero') ||
      text.includes('interesa') ||
      text.includes('me gusta')
    )
      score += 3;
    if (
      text.includes('participar') ||
      text.includes('comprar') ||
      text.includes('números')
    )
      score += 3;

    if (score >= 6) return 'alto';
    if (score >= 3) return 'medio';
    return 'bajo';
  }

  /**
   * Genera mensaje persuasivo personalizado
   */
  generatePersuasiveMessage(context, intentionResult) {
    const name = context.name ? `, ${context.name}` : '';

    const messages = [
      `¡Qué alegría que quieras participar${name}! 🌟\nEsta actividad tiene un premio total de $4.000.000 COP 💰\nCada número cuesta solo $1.000 COP y tiene 4 dígitos.\nTe enviaré ahora un pequeño formulario para registrar tus datos y asegurarte tus números bendecidos 🙏✨`,

      `Perfecto${name} 🙌 Me alegra que quieras participar.\nTe enviaré un formulario rápido para registrar tu nombre, ciudad y cantidad de números.\n¡Solo te tomará unos segundos! 💫`,

      `¡Excelente decisión${name}! 🎉\nEl premio de $4.000.000 COP puede ser tuyo.\nTe voy a enviar un formulario súper sencillo para confirmar tus datos.\n¡Es tu oportunidad de oro! ✨`,
    ];

    // Seleccionar mensaje basado en el tipo de intención
    let selectedMessage;
    if (intentionResult.intentionType === 'high_purchase') {
      selectedMessage = messages[0];
    } else if (intentionResult.confidence > 0.8) {
      selectedMessage = messages[1];
    } else {
      selectedMessage = messages[2];
    }

    return selectedMessage;
  }

  // === MÉTODOS AUXILIARES ===

  extractInterests(messages) {
    const interests = [];
    const keywords = {
      precio: 'pricing',
      premio: 'prizes',
      pago: 'payment',
      seguridad: 'security',
      números: 'numbers',
    };

    messages.forEach(msg => {
      const text = (msg.text || '').toLowerCase();
      Object.entries(keywords).forEach(([keyword, interest]) => {
        if (text.includes(keyword) && !interests.includes(interest)) {
          interests.push(interest);
        }
      });
    });

    return interests;
  }

  extractQuestions(messages) {
    return messages
      .filter(msg => {
        const text = msg.text || '';
        return (
          text.includes('?') ||
          text.toLowerCase().includes('cómo') ||
          text.toLowerCase().includes('cuándo') ||
          text.toLowerCase().includes('dónde') ||
          text.toLowerCase().includes('qué') ||
          text.toLowerCase().includes('cuánto')
        );
      })
      .map(msg => ({
        text: msg.text,
        timestamp: msg.timestamp,
      }));
  }

  calculateEngagementLevel(messages) {
    if (messages.length === 0) return 0;

    const recentMessages = messages.slice(-10);
    const questionCount = this.extractQuestions(recentMessages).length;
    const messageLength = recentMessages.reduce(
      (sum, msg) => sum + (msg.text || '').length,
      0
    );
    const avgLength = messageLength / recentMessages.length;

    // Calcular engagement basado en preguntas y longitud de mensajes
    const questionScore = Math.min(questionCount / 5, 1); // Máximo 5 preguntas
    const lengthScore = Math.min(avgLength / 50, 1); // Mensajes de 50+ caracteres

    return (questionScore + lengthScore) / 2;
  }

  extractPurchaseSignals(messages) {
    const signals = [];
    const purchaseKeywords = [
      'quiero',
      'comprar',
      'participar',
      'interesa',
      'precio',
      'pago',
      'números',
    ];

    messages.forEach(msg => {
      const text = (msg.text || '').toLowerCase();
      purchaseKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          signals.push({
            keyword,
            timestamp: msg.timestamp,
            message: msg.text,
          });
        }
      });
    });

    return signals;
  }

  getContextFactors(context) {
    return {
      messageCount: context.messageCount,
      engagementLevel: context.engagementLevel,
      questionCount: context.previousQuestions.length,
      purchaseSignalCount: context.purchaseSignals.length,
      hasName: !!context.name,
      isReturningUser: context.messageCount > 5,
    };
  }
}

// Instancia singleton
export const chatLogic = new ChatLogic();

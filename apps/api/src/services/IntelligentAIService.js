/**
 * Servicio de IA Inteligente para LM Studio
 * Análisis de mensajes, detección de intención de compra y generación de respuestas empáticas
 */

import axios from 'axios';
import { log } from '../core/logger.js';
import { contextManager } from './ContextManager.js';

export class IntelligentAIService {
  constructor() {
    this.lmStudioEndpoint =
      process.env.AI_ENDPOINT || 'http://localhost:1234/v1/chat/completions';
    this.model = process.env.AI_MODEL || 'local-model';
    this.maxTokens = 500;
    this.temperature = 0.7;

    // Palabras clave para detección de intención de compra
    this.purchaseKeywords = [
      'quiero participar',
      'cómo se paga',
      'me interesa',
      'mándame la info',
      'quiero comprar',
      'cómo funciona',
      'cuánto cuesta',
      'precio',
      'inscribir',
      'apuntar',
      'participar',
      'información',
      'detalles',
    ];

    // Palabras de rechazo
    this.rejectionKeywords = [
      'no me interesa',
      'no quiero',
      'no gracias',
      'déjame en paz',
      'no molestes',
      'estafa',
      'fraude',
      'no confío',
      'stop',
      'basta',
    ];
  }

  /**
   * Analiza un mensaje y determina la respuesta apropiada
   */
  async analizarMensaje(phone, mensaje, contexto = null) {
    try {
      // Cargar contexto si no se proporciona
      if (!contexto) {
        contexto = await contextManager.cargarContexto(phone);
      }

      // Detectar intención de compra
      const intencionCompra = this.detectarIntencionCompra(mensaje, contexto);

      // Detectar rechazo
      const esRechazo = this.detectarRechazo(mensaje);

      // Generar respuesta empática basada en contexto
      const respuesta = await this.generarRespuestaEmpatica(
        mensaje,
        contexto,
        intencionCompra,
        esRechazo
      );

      return {
        intencionCompra,
        esRechazo,
        respuesta,
        contextoActualizado: contexto,
      };
    } catch (error) {
      log(`❌ Error analizando mensaje para ${phone}: ${error.message}`);
      return {
        intencionCompra: { detectada: false, confianza: 0 },
        esRechazo: false,
        respuesta:
          'Disculpa, hubo un error procesando tu mensaje. ¿Podrías repetirlo?',
        contextoActualizado: contexto,
      };
    }
  }

  /**
   * Detecta intención de compra en el mensaje
   */
  detectarIntencionCompra(mensaje, contexto) {
    const textoLower = mensaje.toLowerCase();
    let confianza = 0;
    const palabrasEncontradas = [];

    // Buscar palabras clave directas
    this.purchaseKeywords.forEach(keyword => {
      if (textoLower.includes(keyword)) {
        confianza += 0.3;
        palabrasEncontradas.push(keyword);
      }
    });

    // Analizar contexto para ajustar confianza
    if (contexto.nivelEngagement > 60) {
      confianza += 0.2;
    }

    if (contexto.preguntas.length > 2) {
      confianza += 0.1;
    }

    if (contexto.intereses.length > 0) {
      confianza += 0.1;
    }

    // Palabras de urgencia
    const urgencyWords = ['urgente', 'rápido', 'ya', 'ahora', 'inmediato'];
    if (urgencyWords.some(word => textoLower.includes(word))) {
      confianza += 0.15;
    }

    // Preguntas sobre proceso
    const processQuestions = ['cómo', 'cuándo', 'dónde', 'qué necesito'];
    if (processQuestions.some(word => textoLower.includes(word))) {
      confianza += 0.1;
    }

    return {
      detectada: confianza >= 0.6,
      confianza: Math.min(confianza, 1.0),
      palabrasClave: palabrasEncontradas,
      timestamp: Date.now(),
    };
  }

  /**
   * Detecta si el mensaje es un rechazo
   */
  detectarRechazo(mensaje) {
    const textoLower = mensaje.toLowerCase();
    return this.rejectionKeywords.some(keyword => textoLower.includes(keyword));
  }

  /**
   * Genera una respuesta empática usando LM Studio
   */
  async generarRespuestaEmpatica(
    mensaje,
    contexto,
    intencionCompra,
    esRechazo
  ) {
    try {
      const prompt = this.construirPrompt(
        mensaje,
        contexto,
        intencionCompra,
        esRechazo
      );

      const response = await axios.post(
        this.lmStudioEndpoint,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          stream: false,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const respuestaIA = response.data.choices[0].message.content.trim();
        log(`🤖 Respuesta generada por IA para contexto: ${contexto.estado}`);
        return respuestaIA;
      }

      // Fallback si la IA no responde
      return this.generarRespuestaFallback(
        contexto,
        intencionCompra,
        esRechazo
      );
    } catch (error) {
      log(`❌ Error conectando con LM Studio: ${error.message}`);
      return this.generarRespuestaFallback(
        contexto,
        intencionCompra,
        esRechazo
      );
    }
  }

  /**
   * Construye el prompt para la IA basado en el contexto
   */
  construirPrompt(mensaje, contexto, intencionCompra, esRechazo) {
    let prompt = `Mensaje del cliente: "${mensaje}"\n\n`;

    prompt += 'Contexto del cliente:\n';
    prompt += `- Estado actual: ${contexto.estado}\n`;
    prompt += `- Nivel de engagement: ${contexto.nivelEngagement}/100\n`;
    prompt += `- Número de mensajes: ${contexto.mensajes.length}\n`;
    prompt += `- Intereses detectados: ${contexto.intereses.join(', ') || 'ninguno'}\n`;
    prompt += `- Template enviado: ${contexto.templateEnviado ? 'Sí' : 'No'}\n`;

    if (contexto.mensajes.length > 0) {
      prompt += '\nÚltimos mensajes:\n';
      contexto.mensajes.slice(-3).forEach((msg, index) => {
        prompt += `${index + 1}. "${msg.texto}"\n`;
      });
    }

    prompt += '\nAnálisis:\n';
    prompt += `- Intención de compra detectada: ${intencionCompra.detectada ? 'Sí' : 'No'} (${Math.round(intencionCompra.confianza * 100)}%)\n`;
    prompt += `- Es rechazo: ${esRechazo ? 'Sí' : 'No'}\n`;

    prompt += '\nGenera una respuesta empática y persuasiva que:';

    if (esRechazo) {
      prompt +=
        '\n- Respete la decisión del cliente pero deje la puerta abierta';
      prompt += '\n- Sea cordial y no insistente';
    } else if (intencionCompra.detectada) {
      prompt += '\n- Confirme el interés del cliente';
      prompt += '\n- Prepare para el envío del formulario';
      prompt += '\n- Genere expectativa sobre el proceso';
    } else {
      prompt += '\n- Responda a la consulta específica';
      prompt += '\n- Mantenga el interés sin ser agresivo';
      prompt += '\n- Proporcione información valiosa';
      prompt += '\n- Invite sutilmente a conocer más';
    }

    return prompt;
  }

  /**
   * Prompt del sistema para la IA
   */
  getSystemPrompt() {
    return `Eres un asesor comercial experto y empático especializado en sorteos y premios. Tu trabajo es:

1. PERSONALIDAD:
- Ser cálido, empático y profesional
- Usar emojis apropiados pero sin exceso
- Adaptar el tono al nivel de engagement del cliente
- Ser persuasivo sin ser agresivo

2. CONOCIMIENTO DEL PRODUCTO:
- Sorteo de números de 4 dígitos
- Precio: $1.000 COP por número
- Premio total: $4.000.000 COP
- Proceso simple y confiable

3. ESTRATEGIA DE COMUNICACIÓN:
- Responder directamente a las preguntas
- Crear urgencia sutil cuando sea apropiado
- Usar prueba social y testimonios
- Manejar objeciones con empatía
- Guiar hacia la acción sin presionar

4. RESTRICCIONES:
- Máximo 2-3 oraciones por respuesta
- Usar lenguaje natural y conversacional
- No hacer promesas exageradas
- Mantener la credibilidad siempre

Responde SOLO con el mensaje que enviarías al cliente, sin explicaciones adicionales.`;
  }

  /**
   * Genera respuesta de fallback cuando la IA no está disponible
   */
  generarRespuestaFallback(contexto, intencionCompra, esRechazo) {
    if (esRechazo) {
      return 'Entiendo perfectamente 😊 No hay problema. Si en algún momento cambias de opinión, estaré aquí para ayudarte. ¡Que tengas un excelente día! 🌟';
    }

    if (intencionCompra.detectada) {
      return '¡Perfecto! Me alegra saber que te interesa 🎉 Te voy a enviar toda la información para que puedas participar. Es muy fácil y rápido 😊';
    }

    // Respuestas según el estado del contexto
    switch (contexto.estado) {
      case 'nuevo':
        return '¡Hola! 👋 Te cuento que tenemos un sorteo increíble con premio de $4.000.000 💰 ¿Te gustaría conocer los detalles?';

      case 'interesado':
        return 'Genial que sigas interesado/a 😊 ¿Hay algo específico que te gustaría saber sobre el sorteo?';

      default:
        return 'Gracias por tu mensaje 😊 ¿En qué puedo ayudarte hoy con el sorteo?';
    }
  }

  /**
   * Verifica si LM Studio está disponible
   */
  async verificarConexionIA() {
    try {
      const response = await axios.get(
        this.lmStudioEndpoint.replace('/chat/completions', '/models'),
        {
          timeout: 5000,
        }
      );

      log('✅ Conexión con LM Studio establecida');
      return true;
    } catch (error) {
      log(`❌ LM Studio no disponible: ${error.message}`);
      return false;
    }
  }

  /**
   * Analiza el sentimiento del mensaje
   */
  analizarSentimiento(mensaje) {
    const textoLower = mensaje.toLowerCase();

    const palabrasPositivas = [
      'genial',
      'perfecto',
      'excelente',
      'bueno',
      'sí',
      'si',
      'ok',
      'vale',
    ];
    const palabrasNegativas = [
      'malo',
      'terrible',
      'no',
      'nunca',
      'jamás',
      'imposible',
    ];

    let scorePositivo = 0;
    let scoreNegativo = 0;

    palabrasPositivas.forEach(palabra => {
      if (textoLower.includes(palabra)) scorePositivo++;
    });

    palabrasNegativas.forEach(palabra => {
      if (textoLower.includes(palabra)) scoreNegativo++;
    });

    if (scorePositivo > scoreNegativo) return 'positivo';
    if (scoreNegativo > scorePositivo) return 'negativo';
    return 'neutral';
  }
}

// Instancia singleton
export const intelligentAI = new IntelligentAIService();

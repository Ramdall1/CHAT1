import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { CONFIG, sendTemplate, e164 } from './config.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROCESSED_IDS_FILE = path.join(DATA_DIR, 'processed_ids.json');

// ===== Stores en memoria =====
const processed = new Map(); // msgId -> ts (idempotencia en memoria)
const lastReplyAt = new Map(); // phone -> ts (throttle)

export const IA_ENABLED = true;

export async function alreadyProcessed(id) {
  if (!id) return false;
  const now = Date.now();
  for (const [mid, ts] of processed) {
    if (now - ts > 30 * 60 * 1000) processed.delete(mid);
  }
  if (processed.has(id)) return true;
  processed.set(id, now);

  // También persistimos en archivo (cola corta)
  try {
    const processedIds = await fs.readJson(PROCESSED_IDS_FILE).catch(() => []);
    const filteredIds = processedIds.filter(x => x && typeof x === 'string');
    filteredIds.push(id);
    if (filteredIds.length > 5000)
      filteredIds.splice(0, filteredIds.length - 5000);
    await fs.writeJson(PROCESSED_IDS_FILE, filteredIds, { spaces: 2 });
  } catch {}
  return false;
}

export function throttled(phone, ms = 1000) {
  const now = Date.now();
  const last = lastReplyAt.get(phone) || 0;
  if (now - last < ms) {
    return true; // Está throttled, no actualizar timestamp
  }
  // Solo actualizar timestamp cuando NO está throttled
  lastReplyAt.set(phone, now);
  return false;
}

// Función para limpiar el throttling (útil para debugging)
export function clearThrottling(phone = null) {
  if (phone) {
    lastReplyAt.delete(phone);
    console.log(`🔄 Throttling limpiado para ${phone}`);
  } else {
    lastReplyAt.clear();
    console.log('🔄 Throttling limpiado para todos los contactos');
  }
}

// ===== DETECCIÓN AUTOMÁTICA DE NOMBRES =====
export function detectNameFromMessage(message) {
  if (!message || typeof message !== 'string') return null;

  const text = message.trim();

  // Patrones comunes para detectar nombres
  const namePatterns = [
    // "Mi nombre es Juan", "Me llamo María", "Soy Pedro"
    /(?:mi nombre es|me llamo|soy|mi nombre|llamame)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,

    // "Hola, soy Juan", "Buenos días, mi nombre es María"
    /(?:hola|buenos días|buenas tardes|buenas noches|saludos),?\s*(?:soy|mi nombre es|me llamo)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,

    // Al inicio del mensaje: "Juan aquí", "María escribiendo"
    /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s+(?:aquí|escribiendo|por aquí|de nuevo)/i,

    // "Habla Juan", "Es María"
    /(?:habla|es|aquí es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,

    // Presentación formal: "Buenos días, Usuario Ejemplo al habla"
    /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s+al habla/i,

    // "Soy Juan de la empresa", "Mi nombre es María del departamento"
    /(?:soy|mi nombre es|me llamo)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s+(?:de|del|desde)/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const detectedName = match[1].trim();

      // Validar que el nombre detectado sea válido
      if (isValidName(detectedName)) {
        console.log(
          `👤 Nombre detectado: "${detectedName}" en mensaje: "${text.substring(0, 50)}..."`
        );
        return detectedName;
      }
    }
  }

  return null;
}

// Función auxiliar para validar nombres detectados
function isValidName(name) {
  if (!name || name.length < 2 || name.length > 50) return false;

  // Lista de palabras que NO son nombres
  const excludeWords = [
    'hola',
    'buenos',
    'días',
    'tardes',
    'noches',
    'saludos',
    'gracias',
    'por',
    'favor',
    'información',
    'servicio',
    'servicios',
    'producto',
    'productos',
    'precio',
    'precios',
    'comprar',
    'vender',
    'empresa',
    'negocio',
    'trabajo',
    'ayuda',
    'soporte',
    'consulta',
    'pregunta',
    'duda',
    'problema',
    'solución',
    'whatsapp',
    'mensaje',
    'chat',
    'contacto',
    'teléfono',
    'número',
    'llamada',
    'email',
    'correo',
    'dirección',
    'ubicación',
    'interesado',
    'interesada',
    'necesito',
    'quiero',
    'busco',
    'solicito',
    'requiero',
  ];

  const nameLower = name.toLowerCase();

  // Verificar que no sea una palabra excluida
  if (excludeWords.includes(nameLower)) return false;

  // Verificar que no contenga solo palabras excluidas
  const words = name.split(/\s+/);
  const validWords = words.filter(
    word => !excludeWords.includes(word.toLowerCase())
  );

  if (validWords.length === 0) return false;

  // Verificar que tenga formato de nombre (solo letras, espacios y acentos)
  if (!/^[A-Za-záéíóúñÁÉÍÓÚÑ\s]+$/.test(name)) return false;

  return true;
}

// ===== Detección de intención de compra/participación =====
// Función auxiliar para análisis de IA
async function analyzeWithAI(userText) {
  try {
    // Si no hay API key configurada, usar fallback directamente
    if (!CONFIG.AI_API_KEY) {
      console.log('⚠️ No hay API key de IA configurada, usando fallback');
      throw new Error('No AI API key configured');
    }

    const ai = await axios.post(
      CONFIG.AI_ENDPOINT,
      {
        model: CONFIG.AI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              "Analiza si el siguiente mensaje indica intención de compra o interés en servicios. Responde solo 'true' o 'false'. Considera palabras como: quiero, necesito, me interesa, precio, información, participar, comprar, etc.",
          },
          { role: 'user', content: userText },
        ],
        temperature: 0.1,
        max_tokens: 10,
      },
      {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${CONFIG.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const response = ai?.data?.choices?.[0]?.message?.content
      ?.trim()
      .toLowerCase();
    return response === 'true';
  } catch (error) {
    console.log('⚠️ Error en análisis de IA, usando fallback:', error.message);

    // Fallback a palabras clave si falla la IA
    const intentionKeywords = [
      'quiero comprar',
      'quiero adquirir',
      'deseo comprar',
      'me gustaría comprar',
      'estoy interesado en comprar',
      'necesito comprar',
      'busco comprar',
      'comprar',
      'adquirir',
      'obtener',
      'conseguir',
      'quiero participar',
      'me interesa',
      'quiero saber más',
      'información',
      'precio',
      'costo',
      'cuánto',
      'inscribir',
      'apuntar',
      'registrar',
      'participar',
      'unir',
      'formar parte',
      'incluir',
      'actividad',
      'bendición',
      'transformar',
      'cambiar',
      'mejorar',
      'ayuda',
      'sí',
      'si',
      'ok',
      'vale',
      'perfecto',
      'genial',
      'excelente',
      'acepto',
      'de acuerdo',
      'claro',
      'por supuesto',
      'cuenta conmigo',
    ];

    const textLower = userText.toLowerCase();
    return intentionKeywords.some(keyword => textLower.includes(keyword));
  }
}

export async function detectPurchaseIntention(from, userText, db, io) {
  try {
    console.log(
      `🚀 [UTILS.JS] detectPurchaseIntention INICIADO - from: ${from}, text: "${userText}"`
    );

    // Validar que userText existe y es una cadena
    if (!userText || typeof userText !== 'string') {
      console.log(
        `❌ [DEBUG] userText inválido: ${typeof userText}, valor: ${userText}`
      );
      return false;
    }

    const textLower = userText.toLowerCase();
    console.log(`🔍 [DEBUG] textLower: "${textLower}"`);

    // Análisis de IA para detectar intención de compra
    const hasIntention = await analyzeWithAI(userText);
    console.log(`🔍 [DEBUG] hasIntention (IA): ${hasIntention}`);

    if (hasIntention) {
      console.log(`🎯 Intención de compra detectada de ${from}: "${userText}"`);

      // Obtener nombre del contacto
      const contact = db.getContact(from);
      const userName = contact?.name || 'Amigo/a';

      // Enviar plantilla "prueba" aprobada en 360dialog con componentes para botón FLOW
      try {
        await sendTemplate({
          to: from,
          name: 'prueba',
          languageCode: 'en',
          components: [
            {
              type: 'button',
              sub_type: 'flow',
              index: 0,
              parameters: [
                {
                  type: 'action',
                  action: {
                    flow_action_data: {
                      navigate_screen: 'SIGN_UP',
                    },
                  },
                },
              ],
            },
          ],
        });
        console.log('✅ [DEBUG] sendTemplate ejecutado exitosamente');
      } catch (templateError) {
        console.log(
          '⚠️ [DEBUG] Error en sendTemplate (modo local):',
          templateError.message
        );
        // En modo local, continuamos aunque falle el envío de la plantilla
      }

      console.log(
        `📋 Plantilla 'prueba' enviada automáticamente a ${from} (${userName})`
      );

      // Registrar en conversación para el panel
      const templateMsg = {
        id: `template-${Date.now()}`,
        ts: Date.now(),
        type: 'template',
        from: 'BOT',
        to: from,
        text: '🌟 Plantilla aprobada enviada: Click para ver el flujo',
        template_name: 'prueba',
      };

      const saved = db.ensureMessage(templateMsg.id, templateMsg);
      if (saved && io) {
        io.emit('new_message', templateMsg);
        io.emit('inbox_snapshot', db.inboxSnapshot());
      }
    }

    console.log(
      `🏁 [UTILS.JS] detectPurchaseIntention FINALIZADO - from: ${from}`
    );
  } catch (error) {
    console.log('❌ Error en detección de intención:', error.message);
    console.error('❌ Stack trace:', error.stack);
  }
}

// ===== Gestión de flujos (ManyChat) =====
export function checkForFlowTrigger(userText) {
  // Importar flowManager dinámicamente para evitar dependencias circulares
  try {
    // Usar import dinámico en lugar de require para ES modules
    return import('../../../../flow_manager.js')
      .then(module => {
        const flowManager = module.default;
        return flowManager.checkForFlowTrigger(userText);
      })
      .catch(e => {
        console.log('⚠️ FlowManager no disponible:', e.message);
        return null;
      });
  } catch (e) {
    console.log('⚠️ FlowManager no disponible:', e.message);
    return null;
  }
}

// ===== Detección de contexto para plantillas automáticas =====
export function detectTemplateContext(userText) {
  const text = userText.toLowerCase();

  // Palabras clave para diferentes contextos
  const interestKeywords = [
    'interesa',
    'quiero',
    'me gusta',
    'información',
    'detalles',
    'precio',
    'costo',
    'cuánto',
  ];
  const urgencyKeywords = [
    'urgente',
    'rápido',
    'pronto',
    'ya',
    'ahora',
    'inmediato',
  ];
  const positiveKeywords = [
    'sí',
    'si',
    'ok',
    'vale',
    'perfecto',
    'genial',
    'excelente',
    'me apunto',
  ];
  const questionKeywords = [
    'cómo',
    'qué',
    'cuándo',
    'dónde',
    'por qué',
    'para qué',
  ];

  // Detectar contexto de interés alto
  const hasInterest = interestKeywords.some(keyword => text.includes(keyword));
  const hasUrgency = urgencyKeywords.some(keyword => text.includes(keyword));
  const isPositive = positiveKeywords.some(keyword => text.includes(keyword));
  const hasQuestions = questionKeywords.some(keyword => text.includes(keyword));

  // Determinar si debe enviar plantilla
  if ((hasInterest && hasUrgency) || (isPositive && hasInterest)) {
    return {
      shouldSendTemplate: true,
      templateName: 'prueba',
      context: 'high_interest',
      variables: {
        1: 'Amigo/a', // Nombre genérico
        2: '5', // Cupos disponibles
      },
    };
  }

  if (hasQuestions && hasInterest) {
    return {
      shouldSendTemplate: true,
      templateName: 'prueba',
      context: 'information_request',
      variables: {
        1: 'Amigo/a',
        2: '3',
      },
    };
  }

  return {
    shouldSendTemplate: false,
    context: 'normal_conversation',
  };
}

// ===== Respuesta de IA =====
export async function processAIResponse(
  from,
  userText,
  db,
  io,
  isThrottled = null
) {
  // Si no se pasa el estado de throttling, verificarlo
  if (isThrottled === null) {
    isThrottled = throttled(from);
  }
  console.log(
    `🤖 processAIResponse llamada - from: ${from}, text: ${userText}, IA_ENABLED: ${IA_ENABLED}, throttled: ${isThrottled}`
  );

  if (!userText || !IA_ENABLED || isThrottled) {
    console.log(
      `❌ processAIResponse cancelada - userText: ${!!userText}, IA_ENABLED: ${IA_ENABLED}, throttled: ${isThrottled}`
    );
    return false;
  }

  try {
    // Detectar si debe enviar plantilla automáticamente
    const templateContext = detectTemplateContext(userText);
    console.log('📋 Contexto de plantilla detectado:', templateContext);

    // Si debe enviar plantilla, enviarla en lugar de respuesta de IA
    if (templateContext.shouldSendTemplate) {
      try {
        console.log(
          `📤 Enviando plantilla automática: ${templateContext.templateName} a ${from}`
        );

        // Construir componentes para la plantilla
        const components = [
          {
            type: 'body',
            parameters: Object.entries(templateContext.variables).map(
              ([key, value]) => ({
                type: 'text',
                text: value,
              })
            ),
          },
        ];

        // Enviar plantilla
        await sendTemplate({
          to: from,
          name: templateContext.templateName,
          languageCode: 'es',
          components: components,
        });

        // Registrar mensaje de plantilla en la base de datos
        const templateMsg = {
          id: `template-${Date.now()}`,
          ts: Date.now(),
          type: 'template',
          from: 'BOT',
          to: from,
          text: `📋 Plantilla enviada: ${templateContext.templateName}`,
          templateName: templateContext.templateName,
          context: templateContext.context,
        };

        const saved = db.ensureMessage(templateMsg.id, templateMsg);
        if (saved && io) {
          io.emit('new_message', templateMsg);
          io.emit('inbox_snapshot', db.inboxSnapshot());
        }

        console.log(`✅ Plantilla automática enviada exitosamente a ${from}`);
        return true;
      } catch (templateError) {
        console.error('❌ Error enviando plantilla automática:', templateError);
        // Si falla la plantilla, continuar con respuesta de IA normal
      }
    }

    const ai = await axios.post(
      CONFIG.AI_ENDPOINT,
      {
        model: CONFIG.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente de ventas para servicios de transformación personal. Responde en español de forma breve y profesional. Ofrece coaching personalizado, talleres prácticos y programas de desarrollo personal.',
          },
          { role: 'user', content: userText },
        ],
        temperature: 0.3,
        max_tokens: 300,
        stream: false,
      },
      { timeout: 30000 }
    );

    const message = ai?.data?.choices?.[0]?.message;
    let reply = message?.content?.trim();

    // Si el content está vacío, intentar usar reasoning_content (para modelos de thinking)
    if (!reply && message?.reasoning_content) {
      const reasoningContent = message.reasoning_content.trim();

      // Extraer solo la respuesta final del reasoning_content
      // Buscar específicamente el patrón RESPUESTA FINAL:
      const finalResponsePatterns = [
        /RESPUESTA FINAL:\s*(.+?)(?:\n|$)/i,
        /(?:respuesta final|final response):\s*(.+?)(?:\n|$)/i,
        /(?:debo responder|should respond|responder):\s*["']?([^"'\n]+)["']?/i,
        /["']([^"'\n]{10,})["']\s*(?:sería|would be|es|is)\s+(?:mi|my|la|the)\s+respuesta/i,
        /¡([^!\n]{10,})!/,
      ];

      let extractedReply = null;
      for (const pattern of finalResponsePatterns) {
        const match = reasoningContent.match(pattern);
        if (match && match[1]) {
          extractedReply = match[1].trim();
          break;
        }
      }

      // Si no se encuentra un patrón específico, tomar las últimas líneas que parezcan una respuesta
      if (!extractedReply) {
        const lines = reasoningContent.split('\n').filter(line => line.trim());

        // Buscar líneas que contengan respuestas en español
        for (const line of lines.reverse()) {
          const cleanLine = line.trim();
          if (
            cleanLine.length > 15 &&
            (cleanLine.includes('Ofrecemos') ||
              cleanLine.includes('Tenemos') ||
              cleanLine.includes('Nuestros servicios') ||
              cleanLine.includes('¡') ||
              (cleanLine.includes('coaching') &&
                cleanLine.includes('talleres')))
          ) {
            extractedReply = cleanLine;
            break;
          }
        }
      }

      // Si aún no hay respuesta, generar una respuesta por defecto
      reply =
        extractedReply ||
        '¡Hola! Ofrecemos coaching personalizado, talleres prácticos y programas de transformación personal. ¿Te interesa algún servicio en particular?';
    }

    if (!reply) {
      console.log('⚠️ IA sin respuesta de contenido');
      return false;
    }

    // Importar sendWhatsAppText dinámicamente
    const { sendWhatsAppText } = await import('./config.js');
    await sendWhatsAppText(from, reply);

    const botMsg = {
      id: `bot-${Date.now()}`,
      ts: Date.now(),
      type: 'text',
      from: 'BOT',
      to: from,
      text: reply,
    };

    const saved = db.ensureMessage(botMsg.id, botMsg);
    if (saved && io) {
      io.emit('new_message', botMsg);
      io.emit('inbox_snapshot', db.inboxSnapshot());
    }

    return true;
  } catch (e) {
    const errMsg = e?.message || String(e);
    console.log('⚠️ Error IA:', errMsg);
    // Aviso solo en el panel, no enviar nada por WhatsApp
    if (io) {
      io.emit('system_notice', {
        to: from,
        text: `⚠️ Error IA: ${errMsg}`,
        ts: Date.now(),
      });
    }
    return false;
  }
}

import { procesarRespuestaFormulario } from './updateContact.js';
import { messageUtils } from '../../../../src/shared/utils/helpers/helpers/MessageUtils.js';
import { chatLogic } from '../ai/chatLogic.js';
import { createLocalDB } from '../core/localDB.js';
import crypto from 'crypto';
import {
  validateAndSanitizeMessage,
  validatePhoneNumber,
  MESSAGE_LIMITS,
  VALID_MESSAGE_TYPES,
} from '../utils/helpers/helpers/messageValidation.js';

const db = createLocalDB();

/**
 * Valida la firma HMAC SHA-256 del webhook según estándares de 360Dialog
 * @param {string} payload - Cuerpo del webhook en formato string
 * @param {string} signature - Firma recibida en el header
 * @param {string} secret - Secreto compartido para validación
 * @returns {boolean} - True si la firma es válida
 */
function validateWebhookSignature(payload, signature, secret) {
  try {
    if (!payload || !signature || !secret) {
      console.error('❌ Parámetros faltantes para validación de firma');
      return false;
    }

    // Generar firma esperada usando HMAC SHA-256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    // Remover prefijo si existe (ej: "sha256=")
    const cleanSignature = signature.replace(/^sha256=/, '');

    // Comparación segura contra timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ Error validando firma webhook:', error);
    return false;
  }
}

/**
 * Valida el timestamp del webhook para prevenir ataques de replay
 * @param {string} timestamp - Timestamp del header
 * @param {number} tolerance - Tolerancia en milisegundos (default: 5 minutos)
 * @returns {boolean} - True si el timestamp es válido
 */
function validateWebhookTimestamp(timestamp, tolerance = 300000) {
  try {
    if (!timestamp) return false;

    const webhookTime = parseInt(timestamp) * 1000; // Convertir a ms
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - webhookTime);

    return timeDiff <= tolerance;
  } catch (error) {
    console.error('❌ Error validando timestamp webhook:', error);
    return false;
  }
}

/**
 * Maneja los webhooks entrantes de 360dialog
 * Procesa tanto mensajes regulares como respuestas de formularios
 * Incluye validación de seguridad según estándares de 360Dialog
 */
export async function manejarWebhook360Dialog(req, res) {
  const startTime = Date.now();

  try {
    console.log('🔄 Procesando webhook de 360Dialog...');

    // Validar firma del webhook
    const signature =
      req.headers['x-webhook-signature'] || req.headers['x-signature-sha256'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const webhookSecret =
      process.env.WEBHOOK_SECRET || process.env.D360_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const rawBody = JSON.stringify(req.body);
      const isValidSignature = validateWebhookSignature(
        rawBody,
        signature,
        webhookSecret
      );

      if (!isValidSignature) {
        console.error('❌ Firma del webhook inválida');
        return res
          .status(401)
          .json({ error: 'Unauthorized: Invalid signature' });
      }
    }

    // Validar timestamp para prevenir ataques de repetición
    if (timestamp) {
      const isValidTimestamp = validateWebhookTimestamp(timestamp);
      if (!isValidTimestamp) {
        console.error('❌ Timestamp del webhook inválido o expirado');
        return res
          .status(401)
          .json({ error: 'Unauthorized: Invalid or expired timestamp' });
      }
    }

    const { messages, statuses, errors, contacts } = req.body;

    console.log(`🔍 WEBHOOK DEBUG - messages: ${messages ? messages.length : 'null'}, statuses: ${statuses ? statuses.length : 'null'}, errors: ${errors ? errors.length : 'null'}, contacts: ${contacts ? contacts.length : 'null'}`);

    // Validar estructura básica del webhook
    if (!req.body || typeof req.body !== 'object') {
      console.error('❌ Estructura del webhook inválida');
      return res.status(400).json({ error: 'Invalid webhook structure' });
    }

    let totalMessages = 0;
    let totalStatuses = 0;
    let totalErrors = 0;

    // Procesar mensajes entrantes
    if (messages && messages.length > 0) {
      console.log(`📨 Procesando ${messages.length} mensajes entrantes`);
      totalMessages = messages.length;
      for (const mensaje of messages) {
        await procesarMensajeWebhook(mensaje, contacts);
      }
    }

    // Procesar eventos de estado
    if (statuses && statuses.length > 0) {
      console.log(`📊 Procesando ${statuses.length} eventos de estado`);
      totalStatuses = statuses.length;
      await procesarEventosEstado(statuses);
    }

    // Procesar errores
    if (errors && errors.length > 0) {
      console.log(`🚨 Procesando ${errors.length} errores`);
      totalErrors = errors.length;
      await procesarEventosError(errors);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Webhook procesado exitosamente en ${processingTime}ms`);

    res.status(200).json({
      status: 'success',
      processed: {
        messages: totalMessages,
        statuses: totalStatuses,
        errors: totalErrors,
      },
      processing_time_ms: processingTime,
    });
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Procesa eventos de estado de mensaje (sent, delivered, read, failed)
 * Según documentación oficial: https://docs.360dialog.com/docs/waba-messaging/webhook
 */
async function procesarEventosEstado(statuses) {
  try {
    console.log(`📊 Procesando ${statuses.length} eventos de estado`);

    for (const status of statuses) {
      const {
        id,
        status: messageStatus,
        timestamp,
        recipient_id,
        errors,
      } = status;

      console.log(
        `📱 Estado de mensaje ${id}: ${messageStatus} para ${recipient_id}`
      );

      // Registrar evento de estado en la base de datos
      const eventoEstado = {
        id: `status_${id}_${Date.now()}`,
        message_id: id,
        status: messageStatus,
        recipient_id,
        timestamp: timestamp || Date.now(),
        created_at: new Date().toISOString(),
        type: 'message_status',
      };

      // Agregar información de errores si existen
      if (errors && errors.length > 0) {
        eventoEstado.errors = errors;
        console.error(`❌ Errores en mensaje ${id}:`, errors);
      }

      db.addMessage(eventoEstado);

      // Procesar según el tipo de estado
      switch (messageStatus) {
        case 'sent':
          console.log(`📤 Mensaje ${id} enviado exitosamente`);
          await actualizarEstadoMensaje(id, 'sent');
          break;

        case 'delivered':
          console.log(`📬 Mensaje ${id} entregado (dos ticks grises)`);
          await actualizarEstadoMensaje(id, 'delivered');
          break;

        case 'read':
          console.log(`👁️ Mensaje ${id} leído (dos ticks azules)`);
          await actualizarEstadoMensaje(id, 'read');
          break;

        case 'failed':
          console.error(`💥 Mensaje ${id} falló en la entrega`);
          await actualizarEstadoMensaje(id, 'failed', errors);
          break;

        default:
          console.warn(`⚠️ Estado de mensaje desconocido: ${messageStatus}`);
      }
    }
  } catch (error) {
    console.error('❌ Error procesando eventos de estado:', error);
  }
}

/**
 * Procesa errores fuera de banda del webhook
 * Según documentación oficial: https://docs.360dialog.com/docs/waba-messaging/webhook
 */
async function procesarEventosError(errors) {
  try {
    console.log(`🚨 Procesando ${errors.length} errores fuera de banda`);

    for (const error of errors) {
      const { code, title, message, error_data } = error;

      console.error(`🚨 Error ${code}: ${title} - ${message}`);

      // Registrar error en la base de datos
      const eventoError = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        error_code: code,
        error_title: title,
        error_message: message,
        error_data: error_data,
        timestamp: Date.now(),
        created_at: new Date().toISOString(),
        type: 'webhook_error',
      };

      db.addMessage(eventoError);

      // Manejar errores específicos según el código
      switch (code) {
        case 1:
          console.error('🚨 Error de autenticación - Verificar API key');
          break;
        case 2:
          console.error(
            '🚨 Error de límite de velocidad - Reducir frecuencia de envío'
          );
          break;
        case 100:
          console.error('🚨 Error de parámetro inválido');
          break;
        case 131000:
          console.error('🚨 Error de plantilla - Verificar configuración');
          break;
        default:
          console.error(`🚨 Error no manejado específicamente: ${code}`);
      }
    }
  } catch (error) {
    console.error('❌ Error procesando eventos de error:', error);
  }
}

/**
 * Actualiza el estado de un mensaje en la base de datos
 */
async function actualizarEstadoMensaje(messageId, status, errors = null) {
  try {
    // Buscar el mensaje en la base de datos
    const mensajes = db.getAllMessages();
    const mensaje = mensajes.find(
      m => m.wa_message_id === messageId || m.id === messageId
    );

    if (mensaje) {
      mensaje.delivery_status = status;
      mensaje.status_updated_at = new Date().toISOString();

      if (errors) {
        mensaje.delivery_errors = errors;
      }

      // Actualizar en la base de datos (simulado)
      console.log(`✅ Estado de mensaje ${messageId} actualizado a: ${status}`);
    } else {
      console.warn(
        `⚠️ Mensaje ${messageId} no encontrado para actualizar estado`
      );
    }
  } catch (error) {
    console.error('❌ Error actualizando estado de mensaje:', error);
  }
}

/**
 * Procesa un mensaje individual del webhook
 */
async function procesarMensajeWebhook(mensaje, contactos) {
  try {
    const contacto = contactos?.[0];
    if (!contacto) {
      console.log('⚠️ No se encontró información de contacto');
      return;
    }

    const telefono = contacto.wa_id;
    const telefonoNormalizado = db.normalizePhone(telefono);

    // Asegurar que el contacto existe en la base de datos
    db.ensureContact(telefonoNormalizado, {
      name: contacto.profile?.name || null,
      auto_created: true,
    });

    // Procesar según el tipo de mensaje
    switch (mensaje.type) {
      case 'interactive':
        await procesarMensajeInteractivo(
          mensaje,
          telefonoNormalizado,
          contacto
        );
        break;

      case 'text':
        await procesarMensajeTexto(mensaje, telefonoNormalizado, contacto);
        break;

      case 'image':
      case 'document':
      case 'audio':
      case 'video':
        await procesarMensajeMultimedia(mensaje, telefonoNormalizado, contacto);
        break;

      case 'location':
        await procesarMensajeUbicacion(mensaje, telefonoNormalizado, contacto);
        break;

      case 'contacts':
        await procesarMensajeContacto(mensaje, telefonoNormalizado, contacto);
        break;

      case 'reaction':
        await procesarMensajeReaccion(mensaje, telefonoNormalizado, contacto);
        break;

      default:
        console.log(`📝 Tipo de mensaje no manejado: ${mensaje.type}`);
        await registrarMensajeGenerico(mensaje, telefonoNormalizado);
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje individual:', error);
  }
}

/**
 * Procesa mensajes interactivos (formularios, botones, etc.)
 */
async function procesarMensajeInteractivo(mensaje, telefono, contacto) {
  try {
    console.log(`🔄 Procesando mensaje interactivo de ${telefono}`);

    if (mensaje.interactive?.type === 'form_response') {
      // Es una respuesta de formulario
      console.log('📋 Respuesta de formulario detectada');

      const resultado = await procesarRespuestaFormulario({
        contacts: [contacto],
        messages: [mensaje],
      });

      if (resultado.success) {
        console.log(`✅ Formulario procesado exitosamente para ${telefono}`);

        // Enviar mensaje de agradecimiento
        await messageUtils.sendThankYouMessage(telefono, resultado.datos);

        // Registrar evento en el historial
        await registrarEventoFormulario(telefono, resultado.datos, mensaje);
      } else {
        console.error(
          `❌ Error procesando formulario para ${telefono}:`,
          resultado.error
        );

        // Enviar mensaje de error amigable
        await messageUtils.sendErrorMessage(
          telefono,
          'Hubo un problema procesando tu información. ¿Podrías intentar de nuevo o contactarnos directamente?'
        );
      }
    } else if (mensaje.interactive?.type === 'button_reply') {
      // Es una respuesta de botón
      console.log('🔘 Respuesta de botón detectada');
      await procesarMensajeBoton(mensaje, telefono, contacto);
    } else if (mensaje.interactive?.type === 'list_reply') {
      // Es una respuesta de lista
      console.log('📋 Respuesta de lista detectada');
      await procesarMensajeLista(mensaje, telefono, contacto);
    } else {
      console.log(
        `🔄 Tipo de interacción no manejado: ${mensaje.interactive?.type}`
      );
      await registrarMensajeGenerico(mensaje, telefono);
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje interactivo:', error);
  }
}

/**
 * Procesa mensajes de texto regulares
 */
async function procesarMensajeTexto(mensaje, telefono, contacto) {
  try {
    const textoMensaje = mensaje.text?.body || '';

    // Validar estructura del mensaje
    const validationResult = validateAndSanitizeMessage({
      type: 'text',
      text: textoMensaje,
      from: telefono,
      timestamp: mensaje.timestamp,
    });

    if (!validationResult.isValid) {
      console.error(
        `❌ Mensaje inválido de ${telefono}:`,
        validationResult.errors
      );
      return;
    }

    // Usar texto sanitizado
    const textoSanitizado = validationResult.sanitizedMessage.text;

    // Registrar mensaje en la base de datos
    const mensajeRegistrado = {
      id: mensaje.id,
      from: telefono,
      to: 'BOT',
      type: 'text',
      text: textoSanitizado,
      ts: Date.now(),
      timestamp: new Date().toISOString(),
      wa_message_id: mensaje.id,
      status: 'received',
      direction: 'inbound'
    };

    try {
      const resultado = db.addMessage(mensajeRegistrado);
    } catch (error) {
      console.error(`❌ Error guardando mensaje:`, error);
    }

    // Obtener historial de mensajes para contexto
    const historial = db.getHistoryByPhone(telefono);

    // Procesar con la IA
    const respuestaIA = await chatLogic.processMessage(
      telefono,
      textoSanitizado,
      historial
    );

    if (respuestaIA.success) {
      if (respuestaIA.action === 'template_sent') {
        console.log(`📋 Plantilla enviada automáticamente a ${telefono}`);
      }
    } else {
      console.error(`❌ Error en IA para ${telefono}:`, respuestaIA.error);
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje de texto:', error);
  }
}

/**
 * Procesa mensajes multimedia
 */
async function procesarMensajeMultimedia(mensaje, telefono, contacto) {
  try {
    let textoCaption = '';
    let mediaInfo = {};

    switch (mensaje.type) {
      case 'image':
        textoCaption = mensaje.image?.caption || '';

        mediaInfo = {
          id: mensaje.image?.id,
          mime_type: mensaje.image?.mime_type,
          sha256: mensaje.image?.sha256,
        };
        break;

      case 'document':
        textoCaption = mensaje.document?.caption || '';
        mediaInfo = {
          id: mensaje.document?.id,
          filename: mensaje.document?.filename,
          mime_type: mensaje.document?.mime_type,
          sha256: mensaje.document?.sha256,
        };
        break;

      case 'audio':
        mediaInfo = {
          id: mensaje.audio?.id,
          mime_type: mensaje.audio?.mime_type,
          sha256: mensaje.audio?.sha256,
        };
        break;

      case 'video':
        textoCaption = mensaje.video?.caption || '';
        mediaInfo = {
          id: mensaje.video?.id,
          mime_type: mensaje.video?.mime_type,
          sha256: mensaje.video?.sha256,
        };
        break;
    }

    // Registrar mensaje multimedia
    const mensajeRegistrado = {
      id: mensaje.id,
      from: telefono,
      to: 'BOT',
      type: mensaje.type,
      text: textoCaption,
      caption: textoCaption,
      media_info: mediaInfo,
      ts: Date.now(),
      timestamp: new Date().toISOString(),
      wa_message_id: mensaje.id,
    };

    db.addMessage(mensajeRegistrado);

    // Si hay caption, procesarlo con la IA
    if (textoCaption.trim()) {
      const historial = db.getHistoryByPhone(telefono);
      const respuestaIA = await chatLogic.processMessage(
        telefono,
        textoCaption,
        historial
      );

      if (respuestaIA.success && respuestaIA.response) {
        console.log(`🤖 IA respondió a multimedia de ${telefono}`);
      }
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje multimedia:', error);
  }
}

/**
 * Procesa respuestas de botones
 */
async function procesarRespuestaBoton(mensaje, telefono, contacto) {
  try {
    const botonId = mensaje.interactive?.button_reply?.id;
    const botonTitulo = mensaje.interactive?.button_reply?.title;

    console.log(
      `🔘 Botón presionado por ${telefono}: ${botonId} - ${botonTitulo}`
    );

    // Registrar interacción de botón
    const mensajeRegistrado = {
      id: mensaje.id,
      from: telefono,
      to: 'BOT',
      type: 'button_reply',
      text: `Botón: ${botonTitulo}`,
      button_id: botonId,
      button_title: botonTitulo,
      ts: Date.now(),
      timestamp: new Date().toISOString(),
      wa_message_id: mensaje.id,
    };

    db.addMessage(mensajeRegistrado);

    // Procesar respuesta del botón con la IA
    const historial = db.getHistoryByPhone(telefono);
    const respuestaIA = await chatLogic.processMessage(
      telefono,
      `Seleccionó: ${botonTitulo}`,
      historial
    );

    if (respuestaIA.success && respuestaIA.response) {
      console.log(`🤖 IA respondió a botón de ${telefono}`);
    }
  } catch (error) {
    console.error('❌ Error procesando respuesta de botón:', error);
  }
}

/**
 * Registra un mensaje genérico que no se pudo procesar específicamente
 */
async function registrarMensajeGenerico(mensaje, telefono) {
  try {
    const mensajeRegistrado = {
      id: mensaje.id,
      from: telefono,
      to: 'BOT',
      type: mensaje.type || 'unknown',
      text: JSON.stringify(mensaje),
      ts: Date.now(),
      timestamp: new Date().toISOString(),
      wa_message_id: mensaje.id,
      raw_message: mensaje,
    };

    db.addMessage(mensajeRegistrado);
    console.log(`📝 Mensaje genérico registrado para ${telefono}`);
  } catch (error) {
    console.error('❌ Error registrando mensaje genérico:', error);
  }
}

/**
 * Procesa mensajes de ubicación
 * Según documentación oficial: https://docs.360dialog.com/docs/waba-messaging/message-structure
 */
async function procesarMensajeUbicacion(mensaje, telefono, contacto) {
  try {
    const { location } = mensaje;
    const { latitude, longitude, name, address } = location;

    console.log(
      `📍 Ubicación recibida de ${telefono}: ${name || 'Sin nombre'} (${latitude}, ${longitude})`
    );

    // Registrar mensaje de ubicación
    const mensajeUbicacion = {
      id: `location_${mensaje.id}_${Date.now()}`,
      wa_message_id: mensaje.id,
      from: telefono,
      to: mensaje.to || process.env.WHATSAPP_PHONE_NUMBER,
      type: 'location',
      timestamp: mensaje.timestamp || Date.now(),
      location: {
        latitude,
        longitude,
        name: name || null,
        address: address || null,
      },
      contact: contacto,
      created_at: new Date().toISOString(),
    };

    db.addMessage(mensajeUbicacion);

    // Procesar con IA si está habilitado
    if (process.env.AI_ENABLED === 'true') {
      const contextoUbicacion = `Usuario compartió ubicación: ${name || 'Ubicación'} en ${address || `${latitude}, ${longitude}`}`;
      await chatLogic.processMessage(telefono, contextoUbicacion, 'location');
    }

    console.log(`✅ Mensaje de ubicación procesado para ${telefono}`);
  } catch (error) {
    console.error('❌ Error procesando mensaje de ubicación:', error);
  }
}

/**
 * Procesa mensajes de contacto
 * Según documentación oficial: https://docs.360dialog.com/docs/waba-messaging/message-structure
 */
async function procesarMensajeContacto(mensaje, telefono, contacto) {
  try {
    const { contacts } = mensaje;

    console.log(
      `👤 Contacto(s) recibido(s) de ${telefono}: ${contacts.length} contacto(s)`
    );

    for (const contactInfo of contacts) {
      const { name, phones, emails, addresses, org, urls } = contactInfo;

      // Registrar mensaje de contacto
      const mensajeContacto = {
        id: `contact_${mensaje.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        wa_message_id: mensaje.id,
        from: telefono,
        to: mensaje.to || process.env.WHATSAPP_PHONE_NUMBER,
        type: 'contacts',
        timestamp: mensaje.timestamp || Date.now(),
        contact_info: {
          name: name?.formatted_name || name?.first_name || 'Sin nombre',
          phones: phones || [],
          emails: emails || [],
          addresses: addresses || [],
          organization: org?.company || null,
          urls: urls || [],
        },
        contact: contacto,
        created_at: new Date().toISOString(),
      };

      db.addMessage(mensajeContacto);

      console.log(
        `👤 Contacto registrado: ${name?.formatted_name || 'Sin nombre'}`
      );
    }

    // Procesar con IA si está habilitado
    if (process.env.AI_ENABLED === 'true') {
      const contextoContacto = `Usuario compartió ${contacts.length} contacto(s)`;
      await chatLogic.processMessage(telefono, contextoContacto, 'contacts');
    }

    console.log(`✅ Mensaje de contacto procesado para ${telefono}`);
  } catch (error) {
    console.error('❌ Error procesando mensaje de contacto:', error);
  }
}

/**
 * Procesa mensajes de reacción
 * Según documentación oficial: https://docs.360dialog.com/docs/waba-messaging/message-structure
 */
async function procesarMensajeReaccion(mensaje, telefono, contacto) {
  try {
    const { reaction } = mensaje;

    console.log(
      `😀 Reacción recibida de ${telefono}: ${reaction.emoji} al mensaje ${reaction.message_id}`
    );

    // Registrar mensaje de reacción
    const mensajeReaccion = {
      id: `reaction_${mensaje.id}_${Date.now()}`,
      wa_message_id: mensaje.id,
      from: telefono,
      to: mensaje.to || process.env.WHATSAPP_PHONE_NUMBER,
      type: 'reaction',
      timestamp: mensaje.timestamp || Date.now(),
      reaction: {
        message_id: reaction.message_id,
        emoji: reaction.emoji,
      },
      contact: contacto,
      created_at: new Date().toISOString(),
    };

    db.addMessage(mensajeReaccion);

    // Procesar con IA si está habilitado
    if (process.env.AI_ENABLED === 'true') {
      const contextoReaccion = `Usuario reaccionó con ${reaction.emoji} al mensaje ${reaction.message_id}`;
      await chatLogic.processMessage(telefono, contextoReaccion, 'reaction');
    }

    console.log(`✅ Mensaje de reacción procesado para ${telefono}`);
  } catch (error) {
    console.error('❌ Error procesando mensaje de reacción:', error);
  }
}

/**
 * Procesa mensajes de lista interactiva
 * Según documentación oficial: https://docs.360dialog.com/docs/waba-messaging/message-structure
 */
async function procesarMensajeLista(mensaje, telefono, contacto) {
  try {
    const { interactive } = mensaje;

    console.log(
      `📋 Lista interactiva recibida de ${telefono}: ${interactive.list_reply?.title}`
    );

    // Registrar mensaje de lista
    const mensajeLista = {
      id: `list_${mensaje.id}_${Date.now()}`,
      wa_message_id: mensaje.id,
      from: telefono,
      to: mensaje.to || process.env.WHATSAPP_PHONE_NUMBER,
      type: 'list_reply',
      timestamp: mensaje.timestamp || Date.now(),
      list_reply: {
        id: interactive.list_reply?.id,
        title: interactive.list_reply?.title,
        description: interactive.list_reply?.description,
      },
      contact: contacto,
      created_at: new Date().toISOString(),
    };

    db.addMessage(mensajeLista);

    // Procesar con IA si está habilitado
    if (process.env.AI_ENABLED === 'true') {
      const opcionSeleccionada =
        interactive.list_reply?.title || interactive.list_reply?.id;
      const contextoLista = `Usuario seleccionó la opción: ${opcionSeleccionada}`;
      await chatLogic.processMessage(telefono, contextoLista, 'list_reply');
    }

    console.log(`✅ Mensaje de lista interactiva procesado para ${telefono}`);
  } catch (error) {
    console.error('❌ Error procesando mensaje de lista interactiva:', error);
  }
}

/**
 * Procesa mensajes de botón interactivo
 * Según documentación oficial: https://docs.360dialog.com/docs/waba-messaging/message-structure
 */
async function procesarMensajeBoton(mensaje, telefono, contacto) {
  try {
    const { interactive } = mensaje;

    console.log(
      `🔘 Botón interactivo recibido de ${telefono}: ${interactive.button_reply?.title}`
    );

    // Registrar mensaje de botón
    const mensajeBoton = {
      id: `button_${mensaje.id}_${Date.now()}`,
      wa_message_id: mensaje.id,
      from: telefono,
      to: mensaje.to || process.env.WHATSAPP_PHONE_NUMBER,
      type: 'button_reply',
      timestamp: mensaje.timestamp || Date.now(),
      button_reply: {
        id: interactive.button_reply?.id,
        title: interactive.button_reply?.title,
      },
      contact: contacto,
      created_at: new Date().toISOString(),
    };

    db.addMessage(mensajeBoton);

    // Procesar con IA si está habilitado
    if (process.env.AI_ENABLED === 'true') {
      const botonSeleccionado =
        interactive.button_reply?.title || interactive.button_reply?.id;
      const contextoBoton = `Usuario presionó el botón: ${botonSeleccionado}`;
      await chatLogic.processMessage(telefono, contextoBoton, 'button_reply');
    }

    console.log(`✅ Mensaje de botón interactivo procesado para ${telefono}`);
  } catch (error) {
    console.error('❌ Error procesando mensaje de botón interactivo:', error);
  }
}

/**
 * Envía mensaje de lista interactiva
 * Según documentación oficial: https://docs.360dialog.com/partner/messaging-and-calling/sending-and-receiving-messages/text-messages/interactive-messages
 */
async function enviarMensajeLista(
  telefono,
  headerText,
  bodyText,
  footerText,
  buttonText,
  sections
) {
  try {
    // Validar número de teléfono
    if (!validatePhoneNumber(telefono)) {
      throw new Error('Número de teléfono inválido');
    }

    // Validar textos según límites de 360Dialog
    if (
      headerText &&
      headerText.length > MESSAGE_LIMITS.INTERACTIVE.HEADER_MAX_LENGTH
    ) {
      throw new Error(
        `Header excede el límite de ${MESSAGE_LIMITS.INTERACTIVE.HEADER_MAX_LENGTH} caracteres`
      );
    }

    if (
      bodyText &&
      bodyText.length > MESSAGE_LIMITS.INTERACTIVE.BODY_MAX_LENGTH
    ) {
      throw new Error(
        `Body excede el límite de ${MESSAGE_LIMITS.INTERACTIVE.BODY_MAX_LENGTH} caracteres`
      );
    }

    if (
      footerText &&
      footerText.length > MESSAGE_LIMITS.INTERACTIVE.FOOTER_MAX_LENGTH
    ) {
      throw new Error(
        `Footer excede el límite de ${MESSAGE_LIMITS.INTERACTIVE.FOOTER_MAX_LENGTH} caracteres`
      );
    }

    if (
      buttonText &&
      buttonText.length > MESSAGE_LIMITS.INTERACTIVE.BUTTON_MAX_LENGTH
    ) {
      throw new Error(
        `Button text excede el límite de ${MESSAGE_LIMITS.INTERACTIVE.BUTTON_MAX_LENGTH} caracteres`
      );
    }

    // Validar número de secciones y opciones
    if (!sections || sections.length === 0) {
      throw new Error('Se requiere al menos una sección');
    }

    if (sections.length > MESSAGE_LIMITS.INTERACTIVE.MAX_SECTIONS) {
      throw new Error(
        `Máximo ${MESSAGE_LIMITS.INTERACTIVE.MAX_SECTIONS} secciones permitidas`
      );
    }

    let totalOptions = 0;
    sections.forEach((section, index) => {
      if (!section.rows || section.rows.length === 0) {
        throw new Error(
          `La sección ${index + 1} debe tener al menos una opción`
        );
      }
      totalOptions += section.rows.length;

      section.rows.forEach((row, rowIndex) => {
        if (!row.id || !row.title) {
          throw new Error(
            `Opción ${rowIndex + 1} en sección ${index + 1} debe tener id y title`
          );
        }
        if (
          row.title.length > MESSAGE_LIMITS.INTERACTIVE.OPTION_TITLE_MAX_LENGTH
        ) {
          throw new Error(
            `Título de opción excede ${MESSAGE_LIMITS.INTERACTIVE.OPTION_TITLE_MAX_LENGTH} caracteres`
          );
        }
        if (
          row.description &&
          row.description.length >
            MESSAGE_LIMITS.INTERACTIVE.OPTION_DESCRIPTION_MAX_LENGTH
        ) {
          throw new Error(
            `Descripción de opción excede ${MESSAGE_LIMITS.INTERACTIVE.OPTION_DESCRIPTION_MAX_LENGTH} caracteres`
          );
        }
      });
    });

    if (totalOptions > MESSAGE_LIMITS.INTERACTIVE.MAX_LIST_OPTIONS) {
      throw new Error(
        `Máximo ${MESSAGE_LIMITS.INTERACTIVE.MAX_LIST_OPTIONS} opciones permitidas en total`
      );
    }
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: headerText,
        },
        body: {
          text: bodyText,
        },
        footer: {
          text: footerText,
        },
        action: {
          button: buttonText,
          sections: sections,
        },
      },
    };

    const response = await fetch(`${process.env.WHATSAPP_API_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error enviando mensaje de lista: ${response.status}`);
    }

    const result = await response.json();
    console.log('📋 Mensaje de lista enviado:', result.messages[0].id);
    return result;
  } catch (error) {
    console.error('❌ Error enviando mensaje de lista:', error);
    throw error;
  }
}

/**
 * Envía mensaje con botones de respuesta
 * Según documentación oficial: https://docs.360dialog.com/partner/messaging-and-calling/sending-and-receiving-messages/text-messages/interactive-messages
 */
async function enviarMensajeBotones(telefono, bodyText, buttons) {
  try {
    // Validar número de teléfono
    if (!validatePhoneNumber(telefono)) {
      throw new Error('Número de teléfono inválido');
    }

    // Validar texto del cuerpo
    if (!bodyText || bodyText.trim().length === 0) {
      throw new Error('El texto del cuerpo es requerido');
    }

    if (bodyText.length > MESSAGE_LIMITS.INTERACTIVE.BODY_MAX_LENGTH) {
      throw new Error(
        `Body excede el límite de ${MESSAGE_LIMITS.INTERACTIVE.BODY_MAX_LENGTH} caracteres`
      );
    }

    // Validar botones
    if (!buttons || buttons.length === 0) {
      throw new Error('Se requiere al menos un botón');
    }

    if (buttons.length > MESSAGE_LIMITS.INTERACTIVE.MAX_BUTTONS) {
      throw new Error(
        `Máximo ${MESSAGE_LIMITS.INTERACTIVE.MAX_BUTTONS} botones permitidos`
      );
    }

    // Validar cada botón
    buttons.forEach((button, index) => {
      if (!button.id || !button.title) {
        throw new Error(`Botón ${index + 1} debe tener id y title`);
      }
      if (
        button.title.length > MESSAGE_LIMITS.INTERACTIVE.BUTTON_TITLE_MAX_LENGTH
      ) {
        throw new Error(
          `Título del botón ${index + 1} excede ${MESSAGE_LIMITS.INTERACTIVE.BUTTON_TITLE_MAX_LENGTH} caracteres`
        );
      }
    });
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText,
        },
        action: {
          buttons: buttons.map(button => ({
            type: 'reply',
            reply: {
              id: button.id,
              title: button.title,
            },
          })),
        },
      },
    };

    const response = await fetch(`${process.env.WHATSAPP_API_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error enviando mensaje con botones: ${response.status}`);
    }

    const result = await response.json();
    console.log('🔘 Mensaje con botones enviado:', result.messages[0].id);
    return result;
  } catch (error) {
    console.error('❌ Error enviando mensaje con botones:', error);
    throw error;
  }
}

/**
 * Envía mensaje de reacción
 * Según documentación oficial: https://docs.360dialog.com/partner/messaging-and-calling/sending-and-receiving-messages/text-messages/interactive-messages
 */
async function enviarMensajeReaccion(telefono, messageId, emoji) {
  try {
    // Validar número de teléfono
    if (!validatePhoneNumber(telefono)) {
      throw new Error('Número de teléfono inválido');
    }

    // Validar messageId
    if (!messageId || messageId.trim().length === 0) {
      throw new Error('ID del mensaje es requerido');
    }

    // Validar emoji
    if (!emoji || emoji.trim().length === 0) {
      throw new Error('Emoji es requerido');
    }

    // Validar que sea un emoji válido (básico)
    const emojiRegex =
      /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u;
    if (!emojiRegex.test(emoji)) {
      throw new Error('Emoji inválido');
    }
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji: emoji,
      },
    };

    const response = await fetch(`${process.env.WHATSAPP_API_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error enviando reacción: ${response.status}`);
    }

    const result = await response.json();
    console.log('😀 Reacción enviada:', result.messages[0].id);
    return result;
  } catch (error) {
    console.error('❌ Error enviando reacción:', error);
    throw error;
  }
}

/**
 * Registra evento de formulario completado
 */
async function registrarEventoFormulario(telefono, datos, mensaje) {
  try {
    const evento = {
      id: `form_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: telefono,
      to: 'SYSTEM',
      type: 'form_completed',
      text: `Formulario completado: ${datos.nombre} de ${datos.ciudad}`,
      form_data: datos,
      ts: Date.now(),
      timestamp: new Date().toISOString(),
      wa_message_id: mensaje.id,
      event_type: 'form_completion',
    };

    db.addMessage(evento);
    console.log(`📋 Evento de formulario registrado para ${telefono}`);
  } catch (error) {
    console.error('❌ Error registrando evento de formulario:', error);
  }
}

// Exportar funciones para uso externo
export {
  enviarMensajeLista,
  enviarMensajeBotones,
  enviarMensajeReaccion,
  validateWebhookSignature,
  validateWebhookTimestamp,
};

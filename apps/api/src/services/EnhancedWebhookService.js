/**
 * Servicio Mejorado de Webhooks para Sistema de IA Conversacional
 * Integra IA, gestión de contexto y procesamiento de flows
 */

import logger from '../../../../src/services/core/core/logger.js';
import { contextManager } from './ContextManager.js';
import { intelligentAI } from './IntelligentAIService.js';
import { templateService } from './TemplateService.js';
import Database from 'better-sqlite3';
import path from 'path';

export class EnhancedWebhookService {
  constructor() {
    // Usar base de datos SQLite en lugar de archivos JSON
    this.dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    this.db = new Database(this.dbPath);
    this.io = null; // Socket.IO instance

    // Palabras clave para detección de intención de compra
    this.purchaseKeywords = [
      'quiero participar',
      'como se paga',
      'cómo se paga',
      'me interesa',
      'mandame la info',
      'mándame la info',
      'envíame la info',
      'enviame la info',
      'quiero comprar',
      'participar',
      'inscribirme',
      'registrarme',
    ];
  }

  /**
   * Procesa mensajes entrantes con IA
   */
  async procesarMensajeConIA(message, appLocals) {
    try {
      const { from, text, id: messageId, timestamp } = message;
      const contenido = text?.body || '';

      logger.info(`🤖 Procesando mensaje con IA de ${from}: "${contenido}"`);

      // Cargar contexto del cliente
      const contexto = await contextManager.cargarContexto(from);

      // Verificar si el cliente está rechazado
      if (contexto.estado === 'rechazado') {
        logger.warn(
          `⛔ Cliente ${from} está marcado como rechazado. Ignorando mensaje.`
        );
        return;
      }

      // Agregar mensaje al historial
      await contextManager.agregarAlHistorial(from, {
        tipo: 'recibido',
        contenido: contenido,
        timestamp: Date.now(),
        messageId: messageId,
      });

      // Analizar intención con IA
      const analisisIA = await intelligentAI.analizarMensaje(
        contenido,
        contexto
      );

      logger.info('🧠 Análisis IA:', {
        intencionCompra: analisisIA.intencionCompra,
        confianza: analisisIA.confianza,
        esRechazo: analisisIA.esRechazo,
        sentimiento: analisisIA.sentimiento,
      });

      // Manejar rechazo explícito
      if (analisisIA.esRechazo) {
        await this.manejarRechazo(from, appLocals);
        return;
      }

      // Detectar intención de compra
      if (analisisIA.intencionCompra && analisisIA.confianza > 0.7) {
        await this.manejarIntencionCompra(from, contexto, appLocals);
        return;
      }

      // Generar respuesta contextual con IA usando el análisis existente
      const respuestaIA = analisisIA.respuesta;

      if (respuestaIA && respuestaIA.trim()) {
        await this.enviarRespuesta(from, respuestaIA, appLocals);

        // Agregar respuesta al historial
        await contextManager.agregarAlHistorial(from, {
          tipo: 'enviado',
          contenido: respuestaIA,
          timestamp: Date.now(),
          generadoPorIA: true,
        });
      }
    } catch (error) {
      logger.error(`❌ Error procesando mensaje con IA: ${error.message}`);

      // Enviar respuesta de fallback
      const respuestaFallback =
        'Disculpa, estoy teniendo problemas técnicos. ¿Podrías repetir tu mensaje? 🤖';
      await this.enviarRespuesta(message.from, respuestaFallback, appLocals);
    }
  }

  /**
   * Maneja la intención de compra detectada
   */
  async manejarIntencionCompra(phone, contexto, appLocals) {
    try {
      logger.info(`🎯 Intención de compra detectada para ${phone}`);

      // Verificar si puede recibir template
      const puedeEnviar = await templateService.puedeEnviarTemplate(phone);

      if (!puedeEnviar.puede) {
        logger.warn(`⚠️ No se puede enviar template a ${phone}: ${puedeEnviar.razon}`);

        // Enviar mensaje alternativo
        const mensajeAlternativo =
          '¡Perfecto! Ya tienes toda la información necesaria. Si tienes alguna duda específica, estaré aquí para ayudarte. 😊';
        await this.enviarRespuesta(phone, mensajeAlternativo, appLocals);
        return;
      }

      // Extraer nombre del contexto o detectarlo
      const nombre =
        contexto.datosCliente?.nombre ||
        this.extraerNombreDeContexto(contexto) ||
        'Amigo/a';

      // Actualizar estado antes de enviar template
      await contextManager.actualizarEstado(phone, 'detectada_intencion', {
        intencionDetectada: true,
        timestamp: Date.now(),
      });

      // Enviar plantilla "prueba"
      const resultadoTemplate = await templateService.enviarPlantillaPrueba(
        phone,
        nombre
      );

      if (resultadoTemplate.success) {
        logger.info(`✅ Template "prueba" enviado exitosamente a ${phone}`);

        // Actualizar contexto con información del template enviado
        await contextManager.actualizarEstado(phone, 'template_enviado', {
          templateEnviado: true,
          messageId: resultadoTemplate.messageId,
          timestamp: Date.now(),
        });

        // Enviar mensaje de confirmación
        const mensajeConfirmacion = `¡Excelente ${nombre}! 🎉 Te he enviado el formulario para participar en nuestro sorteo. Solo completa tus datos y estarás participando por $4.000.000 💰`;
        await this.enviarRespuesta(phone, mensajeConfirmacion, appLocals);
      } else {
        logger.error(
          `❌ Error enviando template a ${phone}: ${resultadoTemplate.error}`
        );

        // Enviar mensaje de fallback
        const mensajeFallback =
          '¡Perfecto! Me encanta tu interés. Déjame preparar toda la información para ti. En un momento te envío los detalles completos. 😊';
        await this.enviarRespuesta(phone, mensajeFallback, appLocals);
      }
    } catch (error) {
      logger.error(`❌ Error manejando intención de compra: ${error.message}`);
    }
  }

  /**
   * Maneja el rechazo explícito del cliente
   */
  async manejarRechazo(phone, appLocals) {
    try {
      logger.info(`⛔ Rechazo detectado para ${phone}`);

      // Marcar cliente como rechazado
      await contextManager.actualizarEstado(phone, 'rechazado', {
        rechazado: true,
        fechaRechazo: Date.now(),
      });

      // Enviar mensaje de despedida
      const mensajeDespedida =
        'Entiendo perfectamente. Gracias por tu tiempo y que tengas un excelente día. Si cambias de opinión, estaré aquí para ayudarte. 😊🙏';
      await this.enviarRespuesta(phone, mensajeDespedida, appLocals);
    } catch (error) {
      logger.error(`❌ Error manejando rechazo: ${error.message}`);
    }
  }

  /**
   * Procesa respuestas de flows (formularios)
   */
  async procesarRespuestaFlow(flowResponse, appLocals) {
    try {
      const { from, flow_name, response_json, message_id } = flowResponse;

      logger.info(`📋 Procesando respuesta de flow "${flow_name}" de ${from}`);
      logger.info('📋 Datos recibidos:', response_json);

      // Verificar que es el flow "prueba"
      if (flow_name !== 'prueba') {
        logger.warn(`⚠️ Flow "${flow_name}" no es el esperado ("prueba")`);
        return;
      }

      // Extraer datos del formulario
      const datosFormulario = this.extraerDatosFormulario(response_json);

      if (!datosFormulario) {
        logger.error('❌ No se pudieron extraer datos del formulario');
        return;
      }

      logger.info('📝 Datos extraídos del formulario:', datosFormulario);

      // Actualizar contacto en contacts.json
      await this.actualizarContactoConDatos(from, datosFormulario);

      // Actualizar contexto del cliente
      await contextManager.actualizarEstado(from, 'formulario_completado', {
        formularioCompletado: true,
        datosFormulario: datosFormulario,
        timestamp: Date.now(),
      });

      // Generar y enviar mensaje de agradecimiento personalizado
      await this.enviarMensajeAgradecimiento(from, datosFormulario, appLocals);

      // Continuar conversación con IA
      await this.continuarConversacionPostFormulario(
        from,
        datosFormulario,
        appLocals
      );
    } catch (error) {
      log(`❌ Error procesando respuesta de flow: ${error.message}`);
    }
  }

  /**
   * Extrae datos del formulario de la respuesta del flow
   */
  extraerDatosFormulario(responseJson) {
    try {
      // Estructura esperada del formulario "prueba"
      const datos = {
        nombre: null,
        ciudad: null,
        cantidad: null,
        metodoPago: null,
      };

      // Extraer datos según la estructura del flow
      if (responseJson && typeof responseJson === 'object') {
        // Buscar campos comunes
        datos.nombre =
          responseJson.nombre || responseJson.name || responseJson.full_name;
        datos.ciudad =
          responseJson.ciudad || responseJson.city || responseJson.location;
        datos.cantidad =
          responseJson.cantidad ||
          responseJson.quantity ||
          responseJson.numbers;
        datos.metodoPago =
          responseJson.metodo_pago ||
          responseJson.payment_method ||
          responseJson.pago;

        // Validar que al menos el nombre esté presente
        if (datos.nombre) {
          return datos;
        }
      }

      return null;
    } catch (error) {
      log(`❌ Error extrayendo datos del formulario: ${error.message}`);
      return null;
    }
  }

  /**
   * Actualiza el contacto en la base de datos con los datos del formulario
   */
  async actualizarContactoConDatos(phone, datosFormulario) {
    try {
      // Buscar contacto existente en la base de datos
      const contactoExistente = this.db.prepare(`
        SELECT * FROM messages WHERE phone_number = ? LIMIT 1
      `).get(phone);

      if (contactoExistente) {
        // Actualizar contacto existente
        this.db.prepare(`
          UPDATE messages 
          SET contact_name = ?, 
              metadata = json_set(
                COALESCE(metadata, '{}'),
                '$.ciudad', ?,
                '$.cantidad_numeros', ?,
                '$.metodo_pago', ?,
                '$.formulario_completado', true,
                '$.fecha_formulario', ?,
                '$.updated_at', ?
              )
          WHERE phone_number = ?
        `).run(
          datosFormulario.nombre || contactoExistente.contact_name,
          datosFormulario.ciudad,
          datosFormulario.cantidad,
          datosFormulario.metodoPago,
          new Date().toISOString(),
          new Date().toISOString(),
          phone
        );
      } else {
        // Crear nuevo registro de contacto
        this.db.prepare(`
          INSERT INTO messages (
            phone_number, contact_name, message_text, direction, 
            message_type, created_at, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          phone,
          datosFormulario.nombre,
          'Formulario completado',
          'incoming',
          'form_completion',
          new Date().toISOString(),
          JSON.stringify({
            ciudad: datosFormulario.ciudad,
            cantidad_numeros: datosFormulario.cantidad,
            metodo_pago: datosFormulario.metodoPago,
            formulario_completado: true,
            fecha_formulario: new Date().toISOString(),
            tags: ['formulario_completado', 'lead_calificado']
          })
        );
      }

      logger.info(`✅ Contacto ${phone} actualizado con datos del formulario`);
      
      // Emitir evento Socket.IO para actualización de contacto
      this.emitContactUpdate(phone, {
        nombre: datosFormulario.nombre,
        ciudad: datosFormulario.ciudad,
        cantidad_numeros: datosFormulario.cantidad,
        metodo_pago: datosFormulario.metodoPago,
        formulario_completado: true,
        fecha_formulario: new Date().toISOString(),
        tags: ['formulario_completado', 'lead_calificado']
      });
    } catch (error) {
      logger.error(`❌ Error actualizando contacto: ${error.message}`);
    }
  }

  /**
   * Envía mensaje de agradecimiento personalizado
   */
  async enviarMensajeAgradecimiento(phone, datosFormulario, appLocals) {
    try {
      const { nombre, cantidad } = datosFormulario;

      // Calcular valores
      const cantidadNumeros = parseInt(cantidad) || 1;
      const valorUnitario = 1000;
      const valorTotal = cantidadNumeros * valorUnitario;
      const premioTotal = 4000000;

      // Generar mensaje personalizado
      const mensaje = `Gracias ${nombre} 🙏 ya registramos tus datos. Tienes ${cantidadNumeros} números de 4 dígitos a $${valorUnitario.toLocaleString()} COP c/u. ¡El premio total es de $${premioTotal.toLocaleString()}! 💰 ¿Deseas pagar por Nequi o Link de pago?`;

      await this.enviarRespuesta(phone, mensaje, appLocals);

      // Agregar al historial
      await contextManager.agregarAlHistorial(phone, {
        tipo: 'enviado',
        contenido: mensaje,
        timestamp: Date.now(),
        esAgradecimiento: true,
      });

      logger.info(`✅ Mensaje de agradecimiento enviado a ${phone}`);
    } catch (error) {
      logger.error(`❌ Error enviando mensaje de agradecimiento: ${error.message}`);
    }
  }

  /**
   * Continúa la conversación después del formulario
   */
  async continuarConversacionPostFormulario(phone, datosFormulario, appLocals) {
    try {
      // Actualizar contexto con nueva información
      const contexto = await contextManager.cargarContexto(phone);
      contexto.datosCliente = { ...contexto.datosCliente, ...datosFormulario };
      contexto.estado = 'post_formulario';

      await contextManager.guardarContexto(phone, contexto);

      logger.info(`🔄 Conversación post-formulario iniciada para ${phone}`);
    } catch (error) {
      logger.error(
        `❌ Error continuando conversación post-formulario: ${error.message}`
      );
    }
  }

  /**
   * Envía respuesta al cliente
   */
  async enviarRespuesta(phone, mensaje, appLocals) {
    try {
      if (appLocals.localMessagingService) {
        await appLocals.localMessagingService.sendMessage(phone, mensaje);
        log(`📤 Respuesta enviada a ${phone}: "${mensaje}"`);
        
        // Emitir evento Socket.IO para nuevo mensaje
        this.emitNewMessage(phone, {
          id: Date.now().toString(),
          from: 'bot',
          to: phone,
          text: { body: mensaje },
          timestamp: Date.now(),
          type: 'text'
        });
      } else {
        log(
          `⚠️ localMessagingService no disponible para enviar mensaje a ${phone}`
        );
      }
    } catch (error) {
      log(`❌ Error enviando respuesta: ${error.message}`);
    }
  }

  /**
   * Extrae nombre del contexto de mensajes anteriores
   */
  extraerNombreDeContexto(contexto) {
    try {
      if (contexto.historial && contexto.historial.length > 0) {
        for (const mensaje of contexto.historial) {
          if (mensaje.tipo === 'recibido') {
            // Buscar patrones de nombre en el mensaje
            const contenido = mensaje.contenido.toLowerCase();
            const palabrasNombre = [
              'me llamo',
              'soy',
              'mi nombre es',
              'nombre:',
            ];

            for (const patron of palabrasNombre) {
              if (contenido.includes(patron)) {
                const partes = contenido.split(patron);
                if (partes.length > 1) {
                  const posibleNombre = partes[1].trim().split(' ')[0];
                  if (posibleNombre.length > 2) {
                    return (
                      posibleNombre.charAt(0).toUpperCase() +
                      posibleNombre.slice(1)
                    );
                  }
                }
              }
            }
          }
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  async obtenerEstadisticas() {
    try {
      const contextDir = path.join(process.cwd(), 'data', 'context');

      if (!(await fs.pathExists(contextDir))) {
        return {
          totalClientes: 0,
          templatesEnviados: 0,
          formulariosCompletados: 0,
          clientesRechazados: 0,
          tasaConversion: 0,
        };
      }

      const files = await fs.readdir(contextDir);
      let totalClientes = 0;
      let templatesEnviados = 0;
      let formulariosCompletados = 0;
      let clientesRechazados = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          totalClientes++;
          const filePath = path.join(contextDir, file);
          const contexto = await fs.readJson(filePath);

          if (contexto.templateEnviado) templatesEnviados++;
          if (contexto.formularioCompletado) formulariosCompletados++;
          if (contexto.estado === 'rechazado') clientesRechazados++;
        }
      }

      const tasaConversion =
        templatesEnviados > 0
          ? ((formulariosCompletados / templatesEnviados) * 100).toFixed(2)
          : 0;

      return {
        totalClientes,
        templatesEnviados,
        formulariosCompletados,
        clientesRechazados,
        tasaConversion,
      };
    } catch (error) {
      log(`❌ Error obteniendo estadísticas: ${error.message}`);
      return {
        totalClientes: 0,
        templatesEnviados: 0,
        formulariosCompletados: 0,
        clientesRechazados: 0,
        tasaConversion: 0,
      };
    }
  }

  /**
   * Configura la instancia de Socket.IO
   */
  setSocketIO(io) {
    this.io = io;
    logger.info('🔌 Socket.IO configurado en EnhancedWebhookService');
  }

  /**
   * Emite evento de nuevo mensaje a través de Socket.IO
   */
  emitNewMessage(conversationId, message) {
    if (this.io) {
      this.io.emit('new_message', {
        conversationId,
        message,
        timestamp: new Date().toISOString()
      });
      logger.info(`📡 Evento new_message emitido para conversación ${conversationId}`);
    }
  }

  /**
   * Emite evento de actualización de contacto a través de Socket.IO
   */
  emitContactUpdate(phone, contactData) {
    if (this.io) {
      this.io.emit('contact_updated', {
        phone,
        contactData,
        timestamp: new Date().toISOString()
      });
      logger.info(`📡 Evento contact_updated emitido para ${phone}`);
    }
  }
}

// Instancia singleton
export const enhancedWebhookService = new EnhancedWebhookService();

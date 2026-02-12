/**
 * @deprecated Este archivo está marcado como OBSOLETO
 * 
 * IMPORTANTE: Este módulo ha sido consolidado en el sistema de mensajería unificado.
 * 
 * ⚠️  NO USAR ESTE ARCHIVO PARA NUEVAS IMPLEMENTACIONES
 * 
 * En su lugar, utilizar:
 * - Para endpoints REST: /Users/randallteran/Downloads/Chat-Bot-1-2/apps/api/src/routes/messaging.js
 * - Para utilidades de mensajes: /Users/randallteran/Downloads/Chat-Bot-1-2/src/shared/utils/helpers/helpers/MessageUtils.js
 * 
 * Este archivo se mantiene temporalmente para compatibilidad hacia atrás,
 * pero será eliminado en futuras versiones.
 * 
 * Fecha de obsolescencia: 2024-12-19
 */

import fetch from 'node-fetch';
import { CONFIG } from '../core/config.js';
import { normalizePhone } from '../core/localDB.js';
import { Persuader } from '../ai/persuader.js';

/**
 * Envía un mensaje de texto simple a un número específico
 * Utilizado para respuestas de agradecimiento y mensajes informativos
 */
export async function enviarMensajeTexto(numero, texto) {
  try {
    console.log(
      `📩 Enviando mensaje de texto a ${numero}: ${texto.substring(0, 50)}...`
    );

    // Normalizar número de teléfono
    const numeroNormalizado = numero.startsWith('+') ? numero : `+${numero}`;

    // Configurar el payload para la API de 360dialog
    const payload = {
      to: numeroNormalizado,
      type: 'text',
      text: {
        body: texto,
      },
    };

    // Realizar la petición a la API de 360dialog
    const response = await fetch('https://waba.360dialog.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': CONFIG.D360_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Mensaje de texto enviado exitosamente a ${numero}`);
      console.log('📊 Respuesta de la API:', JSON.stringify(data, null, 2));

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        status: data.messages?.[0]?.message_status,
        data: data,
      };
    } else {
      console.error(`❌ Error enviando mensaje de texto a ${numero}:`, data);

      return {
        success: false,
        error: data.error || 'Error desconocido',
        details: data,
      };
    }
  } catch (error) {
    console.error(
      `❌ Error crítico enviando mensaje de texto a ${numero}:`,
      error
    );

    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Envía mensaje de agradecimiento personalizado después de completar formulario
 */
export async function enviarMensajeAgradecimiento(numero, datos) {
  try {
    const numeroNormalizado = numero.startsWith('+') ? numero : `+${numero}`;

    // Importar dinámicamente el persuader para generar mensaje personalizado
    const { Persuader } = await import('../ai/persuader.js');
    const persuader = new Persuader();

    // Generar mensaje de agradecimiento personalizado
    const mensaje = persuader.generarMensajeAgradecimiento(datos);

    const resultado = await enviarMensajeTexto(numeroNormalizado, mensaje);

    if (resultado.success) {
      console.log(
        `✅ Mensaje de agradecimiento enviado a ${numeroNormalizado}`
      );
      return {
        success: true,
        message: 'Mensaje de agradecimiento enviado exitosamente',
        data: resultado,
        messageText: mensaje,
      };
    } else {
      throw new Error(
        resultado.error || 'Error enviando mensaje de agradecimiento'
      );
    }
  } catch (error) {
    console.error('❌ Error enviando mensaje de agradecimiento:', error);

    // Fallback a mensaje básico si falla el persuader
    const mensajeBasico = `Gracias ${datos.nombre || 'amigo/a'} 🙏 Ya registré tus datos correctamente. Tienes ${datos.cantidad || '1'} números de 4 dígitos por solo $1.000 COP c/u. ¡El premio es de $4.000.000! 💰`;

    try {
      const numeroNormalizado = numero.startsWith('+') ? numero : `+${numero}`;
      await enviarMensajeTexto(numeroNormalizado, mensajeBasico);
      return {
        success: true,
        message: 'Mensaje básico de agradecimiento enviado',
        messageText: mensajeBasico,
      };
    } catch (fallbackError) {
      return {
        success: false,
        error: fallbackError.message,
        numero: numero,
      };
    }
  }
}

/**
 * Envía mensaje con información de pago
 */
export async function enviarInformacionPago(numero, metodoPago = 'nequi') {
  try {
    let mensaje = '';

    switch (metodoPago.toLowerCase()) {
      case 'nequi':
        mensaje = `💳 Información de pago por Nequi:

📱 Número: 300-123-4567
👤 Nombre: [Tu Nombre]
💰 Valor: $1.000 COP por número

Una vez realices el pago, envíanos el comprobante y tus números quedarán confirmados.

¡Gracias por participar! 🎉`;
        break;

      case 'transferencia':
      case 'bancaria':
        mensaje = `🏦 Información de pago por transferencia:

🏛️ Banco: [Tu Banco]
💳 Cuenta: [Número de cuenta]
👤 Titular: [Tu Nombre]
💰 Valor: $1.000 COP por número

Una vez realices la transferencia, envíanos el comprobante y tus números quedarán confirmados.

¡Gracias por participar! 🎉`;
        break;

      default:
        mensaje = `💰 Información de pago:

💳 Valor: $1.000 COP por número
📱 Métodos disponibles: Nequi, transferencia bancaria

Responde con el método que prefieres y te envío los datos específicos.

¡Gracias por participar! 🎉`;
    }

    console.log(`💳 Enviando información de pago (${metodoPago}) a ${numero}`);

    return await enviarMensajeTexto(numero, mensaje);
  } catch (error) {
    console.error(`❌ Error enviando información de pago a ${numero}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Envía mensaje de seguimiento para usuarios que no han completado el pago
 */
export async function enviarMensajeSeguimiento(numero, nombreContacto = '') {
  try {
    const nombre = nombreContacto ? `, ${nombreContacto}` : '';

    const mensajeSeguimiento = `¡Hola${nombre}! 👋

Veo que te interesó participar en nuestra actividad.
¿Necesitas ayuda con algo o tienes alguna pregunta?

Recuerda que el premio es de $4.000.000 COP 💰
Y cada número cuesta solo $1.000 COP.

¿Te gustaría continuar con tu participación? 😊`;

    console.log(`🔔 Enviando mensaje de seguimiento a ${numero}`);

    return await enviarMensajeTexto(numero, mensajeSeguimiento);
  } catch (error) {
    console.error(
      `❌ Error enviando mensaje de seguimiento a ${numero}:`,
      error
    );
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Envía mensaje de confirmación de números asignados
 */
export async function enviarConfirmacionNumeros(
  numero,
  datosContacto,
  numerosAsignados
) {
  try {
    const { nombre, cantidad } = datosContacto;

    const numerosTexto = numerosAsignados.join(', ');

    const mensajeConfirmacion = `🎉 ¡Confirmado ${nombre}!

✅ Pago recibido correctamente
🎯 Tus números asignados: ${numerosTexto}
📊 Total de números: ${cantidad}
💰 Premio en juego: $4.000.000 COP

¡Ya estás participando oficialmente!
Te notificaremos cuando sea el sorteo.

¡Mucha suerte! 🍀✨`;

    console.log(`🎯 Enviando confirmación de números a ${numero}`);

    return await enviarMensajeTexto(numero, mensajeConfirmacion);
  } catch (error) {
    console.error(
      `❌ Error enviando confirmación de números a ${numero}:`,
      error
    );
    return {
      success: false,
      error: error.message,
    };
  }
}

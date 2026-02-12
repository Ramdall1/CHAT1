import fs from 'fs/promises';
import path from 'path';
import { createLocalDB } from '../core/localDB.js';

const db = createLocalDB();

/**
 * Actualiza un contacto con los datos recibidos del formulario interactivo
 */
export async function actualizarContacto(datosFormulario) {
  try {
    const { telefono, nombre, ciudad, cantidad, metodo_pago } = datosFormulario;

    console.log(
      `📝 Actualizando contacto ${telefono} con datos del formulario`
    );

    // Normalizar número de teléfono
    const telefonoNormalizado = db.normalizePhone(telefono);

    // Preparar datos de actualización
    const datosActualizacion = {
      name: nombre || null,
      ciudad: ciudad || null,
      cantidad_numeros: parseInt(cantidad) || 1,
      metodo_pago: metodo_pago || 'nequi',
      estado_participacion: 'formulario_completado',
      fecha_formulario: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Agregar campos personalizados
      customFields: {
        ciudad: ciudad || null,
        cantidad_numeros: parseInt(cantidad) || 1,
        metodo_pago: metodo_pago || 'nequi',
        estado_participacion: 'formulario_completado',
        fecha_formulario: new Date().toISOString(),
      },
      // Agregar tags relevantes
      tags: [
        'interesado',
        'formulario_completado',
        `metodo_${metodo_pago || 'nequi'}`,
      ],
    };

    // Actualizar en la base de datos local
    const contactoActualizado = db.updateContact(
      telefonoNormalizado,
      datosActualizacion
    );

    // Archivo contacts.json ya no se usa - ahora todo está en SQLite

    console.log(
      `✅ Contacto actualizado exitosamente: ${nombre} (${telefonoNormalizado})`
    );

    return {
      success: true,
      contacto: contactoActualizado,
      telefono: telefonoNormalizado,
      datos: datosActualizacion,
    };
  } catch (error) {
    console.error('❌ Error actualizando contacto:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

// Función actualizarArchivoContactos eliminada - ya no se usa contacts.json
// Toda la gestión de contactos ahora se hace a través de SQLite

/**
 * Procesa la respuesta completa del formulario interactivo de WhatsApp
 */
export async function procesarRespuestaFormulario(webhookData) {
  try {
    console.log('📋 Procesando respuesta de formulario interactivo...');
    console.log('📊 Datos recibidos:', JSON.stringify(webhookData, null, 2));

    // Extraer información del webhook
    const contacto = webhookData.contacts?.[0];
    const mensaje = webhookData.messages?.[0];

    if (!contacto || !mensaje) {
      throw new Error(
        'Datos de contacto o mensaje no encontrados en el webhook'
      );
    }

    const telefono = contacto.wa_id;

    // Verificar que es una respuesta de formulario
    if (
      mensaje.type !== 'interactive' ||
      mensaje.interactive?.type !== 'form_response'
    ) {
      throw new Error(
        'El mensaje no es una respuesta de formulario interactivo'
      );
    }

    // Extraer respuestas del formulario
    const respuestas = mensaje.interactive.form_response?.responses || {};

    // Mapear respuestas a nuestro formato
    const datosFormulario = {
      telefono: telefono,
      nombre: respuestas.nombre || respuestas.name || '',
      ciudad: respuestas.ciudad || respuestas.city || '',
      cantidad: respuestas.cantidad || respuestas.quantity || '1',
      metodo_pago:
        respuestas.metodo_pago || respuestas.payment_method || 'nequi',
    };

    console.log('📝 Datos extraídos del formulario:', datosFormulario);

    // Actualizar contacto con los datos
    const resultado = await actualizarContacto(datosFormulario);

    if (resultado.success) {
      console.log(`✅ Formulario procesado exitosamente para ${telefono}`);

      // Registrar evento en el historial
      await registrarEventoFormulario(telefono, datosFormulario);

      return {
        success: true,
        telefono: telefono,
        datos: datosFormulario,
        contacto: resultado.contacto,
      };
    } else {
      throw new Error(`Error actualizando contacto: ${resultado.error}`);
    }
  } catch (error) {
    console.error('❌ Error procesando respuesta de formulario:', error);
    return {
      success: false,
      error: error.message,
      webhookData: webhookData,
    };
  }
}

/**
 * Registra el evento de formulario completado en el historial
 */
async function registrarEventoFormulario(telefono, datosFormulario) {
  try {
    const evento = {
      id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: telefono,
      to: 'SYSTEM',
      type: 'form_response',
      text: `Formulario completado: ${datosFormulario.nombre} de ${datosFormulario.ciudad}, ${datosFormulario.cantidad} números`,
      ts: Date.now(),
      timestamp: new Date().toISOString(),
      form_data: datosFormulario,
      event_type: 'form_completed',
    };

    // Agregar al historial de mensajes
    db.addMessage(evento);

    console.log(`📝 Evento de formulario registrado para ${telefono}`);
  } catch (error) {
    console.error('❌ Error registrando evento de formulario:', error);
  }
}

/**
 * Obtiene estadísticas de formularios completados
 */
export async function obtenerEstadisticasFormularios() {
  try {
    const contactos = db.getAllContacts();

    const estadisticas = {
      total_contactos: contactos.length,
      formularios_completados: 0,
      total_numeros_solicitados: 0,
      metodos_pago: {},
      ciudades: {},
      fecha_generacion: new Date().toISOString(),
    };

    contactos.forEach(contacto => {
      if (contacto.estado_participacion === 'formulario_completado') {
        estadisticas.formularios_completados++;

        const cantidad = contacto.cantidad_numeros || 0;
        estadisticas.total_numeros_solicitados += cantidad;

        const metodoPago = contacto.metodo_pago || 'no_especificado';
        estadisticas.metodos_pago[metodoPago] =
          (estadisticas.metodos_pago[metodoPago] || 0) + 1;

        const ciudad = contacto.ciudad || 'no_especificada';
        estadisticas.ciudades[ciudad] =
          (estadisticas.ciudades[ciudad] || 0) + 1;
      }
    });

    console.log('📊 Estadísticas de formularios generadas:', estadisticas);

    return estadisticas;
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de formularios:', error);
    return {
      error: error.message,
    };
  }
}

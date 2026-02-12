import fetch from 'node-fetch';
import { CONFIG } from '../core/config.js';

/**
 * Envía la plantilla "prueba" a un número específico
 * Esta función se ejecuta automáticamente cuando la IA detecta intención de compra
 */
export async function enviarPlantillaPrueba(numero) {
  try {
    console.log(`📋 Enviando plantilla "prueba" a ${numero}`);

    // Normalizar número de teléfono
    const numeroNormalizado = numero.startsWith('+') ? numero : `+${numero}`;

    // Configurar el payload para la API de 360dialog
    const payload = {
      to: numeroNormalizado,
      type: 'template',
      template: {
        namespace: CONFIG.D360_NAMESPACE || 'your_namespace_here',
        name: 'prueba',
        language: {
          policy: 'deterministic',
          code: 'es',
        },
        components: [],
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
      console.log(`✅ Plantilla "prueba" enviada exitosamente a ${numero}`);
      console.log('📊 Respuesta de la API:', JSON.stringify(data, null, 2));

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        status: data.messages?.[0]?.message_status,
        data: data,
      };
    } else {
      console.error(`❌ Error enviando plantilla a ${numero}:`, data);

      return {
        success: false,
        error: data.error || 'Error desconocido',
        details: data,
      };
    }
  } catch (error) {
    console.error(`❌ Error crítico enviando plantilla a ${numero}:`, error);

    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Función auxiliar para validar que la plantilla "prueba" existe
 */
export async function validarPlantillaPrueba() {
  try {
    console.log('🔍 Validando existencia de plantilla "prueba"...');

    const response = await fetch(
      'https://waba.360dialog.com/v1/configs/templates',
      {
        method: 'GET',
        headers: {
          'D360-API-KEY': CONFIG.D360_API_KEY,
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      const plantillaPrueba = data.templates?.find(t => t.name === 'prueba');

      if (plantillaPrueba) {
        console.log('✅ Plantilla "prueba" encontrada y disponible');
        console.log(
          '📋 Detalles de la plantilla:',
          JSON.stringify(plantillaPrueba, null, 2)
        );
        return {
          exists: true,
          template: plantillaPrueba,
        };
      } else {
        console.warn(
          '⚠️ Plantilla "prueba" no encontrada en las plantillas disponibles'
        );
        return {
          exists: false,
          availableTemplates: data.templates?.map(t => t.name) || [],
        };
      }
    } else {
      console.error('❌ Error obteniendo plantillas:', data);
      return {
        exists: false,
        error: data.error || 'Error obteniendo plantillas',
      };
    }
  } catch (error) {
    console.error('❌ Error crítico validando plantilla:', error);
    return {
      exists: false,
      error: error.message,
    };
  }
}

/**
 * Función para enviar plantilla con parámetros personalizados
 * Útil si la plantilla "prueba" requiere parámetros específicos
 */
export async function enviarPlantillaPruebaConParametros(
  numero,
  parametros = {}
) {
  try {
    console.log(`📋 Enviando plantilla "prueba" con parámetros a ${numero}`);

    const numeroNormalizado = numero.startsWith('+') ? numero : `+${numero}`;

    // Construir componentes con parámetros si existen
    const components = [];

    if (parametros.header && parametros.header.length > 0) {
      components.push({
        type: 'header',
        parameters: parametros.header.map(param => ({
          type: 'text',
          text: param,
        })),
      });
    }

    if (parametros.body && parametros.body.length > 0) {
      components.push({
        type: 'body',
        parameters: parametros.body.map(param => ({
          type: 'text',
          text: param,
        })),
      });
    }

    const payload = {
      to: numeroNormalizado,
      type: 'template',
      template: {
        namespace: CONFIG.D360_NAMESPACE || 'your_namespace_here',
        name: 'prueba',
        language: {
          policy: 'deterministic',
          code: 'es',
        },
        components: components,
      },
    };

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
      console.log(`✅ Plantilla "prueba" con parámetros enviada a ${numero}`);
      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        status: data.messages?.[0]?.message_status,
        data: data,
      };
    } else {
      console.error('❌ Error enviando plantilla con parámetros:', data);
      return {
        success: false,
        error: data.error || 'Error desconocido',
        details: data,
      };
    }
  } catch (error) {
    console.error('❌ Error crítico enviando plantilla con parámetros:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

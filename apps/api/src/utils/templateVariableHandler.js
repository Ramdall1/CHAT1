/**
 * Manejador de Variables en Plantillas WhatsApp
 * Gestiona la detección, validación y envío de variables en plantillas
 */

import { validateTemplateVariablesInText } from './templateValidation.js';

/**
 * Detecta variables en un texto de plantilla
 * @param {string} text - Texto a analizar
 * @returns {array} - Array de variables encontradas [{number: 1, full: "{{1}}"}, ...]
 */
export function detectVariablesInText(text) {
  if (!text) return [];

  const variableRegex = /\{\{(\d+)\}\}/g;
  const variables = [];
  let match;

  while ((match = variableRegex.exec(text)) !== null) {
    variables.push({
      number: parseInt(match[1]),
      full: match[0],
      index: match.index,
    });
  }

  return variables;
}

/**
 * Detecta todas las variables en una plantilla completa
 * @param {object} template - Plantilla con componentes
 * @returns {object} - Variables por componente {header: [...], body: [...], footer: [...]}
 */
export function detectVariablesInTemplate(template) {
  const result = {
    header: [],
    body: [],
    footer: [],
    total: 0,
  };

  if (!template.components) return result;

  template.components.forEach(component => {
    if (component.type === 'header' && component.text) {
      result.header = detectVariablesInText(component.text);
    }

    if (component.type === 'body' && component.text) {
      result.body = detectVariablesInText(component.text);
    }

    if (component.type === 'footer' && component.text) {
      result.footer = detectVariablesInText(component.text);
    }
  });

  result.total = result.header.length + result.body.length + result.footer.length;

  return result;
}

/**
 * Construye los parámetros para enviar una plantilla con variables
 * @param {object} template - Plantilla a enviar
 * @param {object} values - Valores a reemplazar {1: "valor1", 2: "valor2", ...}
 * @returns {object} - Objeto con estructura de componentes para 360Dialog
 * 
 * Ejemplo:
 * template: {
 *   components: [
 *     { type: 'header', text: 'Hola {{1}}' },
 *     { type: 'body', text: 'Tu pedido {{2}} está listo' }
 *   ]
 * }
 * values: { 1: 'María', 2: 'ABC123' }
 * 
 * Resultado:
 * {
 *   header: {
 *     type: 'header',
 *     parameters: [{ type: 'text', text: 'María' }]
 *   },
 *   body: {
 *     type: 'body',
 *     parameters: [
 *       { type: 'text', text: 'María' },
 *       { type: 'text', text: 'ABC123' }
 *     ]
 *   }
 * }
 */
export function buildTemplateParameters(template, values) {
  if (!template.components || !values) {
    throw new Error('Template y values son requeridos');
  }

  const result = {};
  const errors = [];

  template.components.forEach(component => {
    if (!component.type || !component.text) return;

    const variables = detectVariablesInText(component.text);

    if (variables.length === 0) {
      // Sin variables, no agregar parámetros
      return;
    }

    // Validar que todos los valores requeridos estén disponibles
    variables.forEach(variable => {
      if (values[variable.number] === undefined) {
        errors.push(
          `❌ Valor faltante para variable {{${variable.number}}} en componente ${component.type}`
        );
      }
    });

    // Construir parámetros en orden
    const parameters = variables.map(variable => ({
      type: 'text',
      text: String(values[variable.number] || ''),
    }));

    result[component.type] = {
      type: component.type,
      parameters,
    };
  });

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return result;
}

/**
 * Prepara el payload completo para enviar una plantilla a 360Dialog
 * @param {string} templateName - Nombre de la plantilla
 * @param {string} phoneNumber - Número de teléfono del destinatario
 * @param {object} template - Objeto de plantilla con componentes
 * @param {object} values - Valores para las variables {1: "valor1", 2: "valor2"}
 * @param {string} languageCode - Código de idioma (default: 'es')
 * @returns {object} - Payload listo para enviar a 360Dialog
 * 
 * Ejemplo de uso:
 * const payload = prepareTemplatePayload(
 *   'confirmacion_pedido',
 *   '573113705258',
 *   templateObject,
 *   { 1: 'María', 2: 'PED-001', 3: '$150' },
 *   'es'
 * );
 */
export function prepareTemplatePayload(
  templateName,
  phoneNumber,
  template,
  values,
  languageCode = 'es'
) {
  // Validar inputs
  if (!templateName || !phoneNumber || !template) {
    throw new Error('templateName, phoneNumber y template son requeridos');
  }

  // Detectar variables en la plantilla
  const detectedVariables = detectVariablesInTemplate(template);

  // Si hay variables, validar que se proporcionen valores
  if (detectedVariables.total > 0 && (!values || Object.keys(values).length === 0)) {
    throw new Error(
      `La plantilla requiere ${detectedVariables.total} variable(s), pero no se proporcionaron valores`
    );
  }

  // Construir parámetros
  const parameters = buildTemplateParameters(template, values || {});

  // Construir componentes para el payload
  const components = [];

  // Agregar header si tiene parámetros
  if (parameters.header) {
    components.push(parameters.header);
  }

  // Agregar body si tiene parámetros
  if (parameters.body) {
    components.push(parameters.body);
  }

  // Agregar footer si tiene parámetros
  if (parameters.footer) {
    components.push(parameters.footer);
  }

  // Si no hay componentes con parámetros, crear estructura básica
  if (components.length === 0) {
    components.push({
      type: 'body',
      parameters: [],
    });
  }

  // Construir payload final
  const payload = {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components,
    },
  };

  return payload;
}

/**
 * Valida que los valores proporcionados coincidan con las variables de la plantilla
 * @param {object} template - Plantilla con componentes
 * @param {object} values - Valores a validar {1: "valor1", 2: "valor2"}
 * @returns {object} - {isValid: boolean, errors: []}
 */
export function validateTemplateValues(template, values) {
  const errors = [];

  if (!template || !template.components) {
    errors.push('Plantilla inválida');
    return { isValid: false, errors };
  }

  if (!values || typeof values !== 'object') {
    errors.push('Values debe ser un objeto');
    return { isValid: false, errors };
  }

  // Detectar variables requeridas
  const detectedVariables = detectVariablesInTemplate(template);

  // Validar que se proporcionen todos los valores requeridos
  const requiredNumbers = new Set();
  [...detectedVariables.header, ...detectedVariables.body, ...detectedVariables.footer].forEach(
    v => requiredNumbers.add(v.number)
  );

  requiredNumbers.forEach(number => {
    if (values[number] === undefined || values[number] === null) {
      errors.push(`❌ Valor requerido para variable {{${number}}}`);
    } else if (typeof values[number] !== 'string' && typeof values[number] !== 'number') {
      errors.push(`❌ Valor para {{${number}}} debe ser string o number, recibido: ${typeof values[number]}`);
    } else if (String(values[number]).length > 1000) {
      errors.push(`❌ Valor para {{${number}}} excede 1000 caracteres`);
    }
  });

  // Validar que no haya valores extra
  Object.keys(values).forEach(key => {
    const num = parseInt(key);
    if (!requiredNumbers.has(num)) {
      errors.push(`⚠️ Valor extra para {{${num}}} que no está en la plantilla`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Reemplaza variables en un texto con valores reales
 * @param {string} text - Texto con variables {{1}}, {{2}}, etc.
 * @param {object} values - Valores {1: "valor1", 2: "valor2"}
 * @returns {string} - Texto con variables reemplazadas
 */
export function replaceVariablesInText(text, values) {
  if (!text || !values) return text;

  let result = text;

  Object.keys(values).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(values[key]));
  });

  return result;
}

/**
 * Obtiene una vista previa de cómo se vería la plantilla con los valores
 * @param {object} template - Plantilla con componentes
 * @param {object} values - Valores {1: "valor1", 2: "valor2"}
 * @returns {object} - Preview con componentes reemplazados
 */
export function getTemplatePreview(template, values) {
  if (!template || !template.components) {
    return null;
  }

  const preview = {
    header: null,
    body: null,
    footer: null,
  };

  template.components.forEach(component => {
    if (component.text) {
      const replaced = replaceVariablesInText(component.text, values);
      preview[component.type] = replaced;
    }
  });

  return preview;
}

/**
 * Ejemplo de uso completo
 */
export const EXAMPLE_USAGE = `
// 1. Detectar variables en una plantilla
const template = {
  components: [
    { type: 'header', text: 'Hola {{1}}' },
    { type: 'body', text: 'Tu pedido {{2}} está listo. Total: {{3}}' }
  ]
};

const variables = detectVariablesInTemplate(template);
// Resultado: { header: [{number: 1, ...}], body: [{number: 2, ...}, {number: 3, ...}], total: 3 }

// 2. Validar valores
const values = { 1: 'María', 2: 'PED-001', 3: '$150' };
const validation = validateTemplateValues(template, values);
// Resultado: { isValid: true, errors: [] }

// 3. Obtener preview
const preview = getTemplatePreview(template, values);
// Resultado: { header: 'Hola María', body: 'Tu pedido PED-001 está listo. Total: $150' }

// 4. Preparar payload para enviar
const payload = prepareTemplatePayload(
  'confirmacion_pedido',
  '573113705258',
  template,
  values,
  'es'
);
// Resultado: Objeto listo para enviar a 360Dialog API

// 5. Enviar a 360Dialog
const response = await axios.post('https://waba-v2.360dialog.io/messages', payload, {
  headers: { 'D360-API-KEY': apiKey }
});
`;

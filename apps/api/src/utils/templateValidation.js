/**
 * Sistema de validación de plantillas para 360Dialog
 * Basado en la documentación oficial: https://docs.360dialog.com/partner/messaging-and-calling/sending-and-receiving-messages/message-templates
 */

// Límites para plantillas según 360Dialog
export const TEMPLATE_LIMITS = {
  MAX_TEMPLATES_PER_ACCOUNT: 250,
  NAME_MAX_LENGTH: 512,
  CONTENT_MAX_LENGTH: 1024,
  HEADER_MAX_LENGTH: 60,
  BODY_MAX_LENGTH: 1024,
  FOOTER_MAX_LENGTH: 60,
  BUTTON_TEXT_MAX_LENGTH: 25,
  MAX_BUTTONS: 3,
  MAX_QUICK_REPLY_BUTTONS: 3,
  MAX_CALL_TO_ACTION_BUTTONS: 2,
  VARIABLE_MAX_LENGTH: 1000,
};

// Categorías válidas de plantillas
export const TEMPLATE_CATEGORIES = {
  MARKETING: 'marketing',
  UTILITY: 'utility',
  AUTHENTICATION: 'authentication',
};

// Tipos de componentes válidos
export const COMPONENT_TYPES = {
  HEADER: 'header',
  BODY: 'body',
  FOOTER: 'footer',
  BUTTONS: 'buttons',
};

// Tipos de header válidos
export const HEADER_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
};

// Tipos de botones válidos
export const BUTTON_TYPES = {
  QUICK_REPLY: 'quick_reply',
  URL: 'url',
  PHONE_NUMBER: 'phone_number',
};

// Estados válidos de plantillas
export const VALID_TEMPLATE_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'DISABLED',
  'PAUSED',
  'LIMIT_EXCEEDED',
  'IN_APPEAL',
  'PENDING_DELETION',
];

/**
 * Valida el nombre de una plantilla
 * @param {string} name - Nombre de la plantilla
 * @returns {object} - Resultado de validación
 */
export function validateTemplateName(name) {
  const errors = [];

  if (!name || typeof name !== 'string') {
    errors.push('El nombre de la plantilla es requerido');
    return { isValid: false, errors };
  }

  if (name.length > TEMPLATE_LIMITS.NAME_MAX_LENGTH) {
    errors.push(
      `El nombre excede el límite de ${TEMPLATE_LIMITS.NAME_MAX_LENGTH} caracteres`
    );
  }

  // Validar formato del nombre (solo letras minúsculas, números y guiones bajos)
  const nameRegex = /^[a-z0-9_]+$/;
  if (!nameRegex.test(name)) {
    errors.push(
      'El nombre solo puede contener letras minúsculas, números y guiones bajos'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida la categoría de una plantilla
 * @param {string} category - Categoría de la plantilla
 * @returns {object} - Resultado de validación
 */
export function validateTemplateCategory(category) {
  const errors = [];

  if (!category) {
    errors.push('La categoría de la plantilla es requerida');
    return { isValid: false, errors };
  }

  if (!Object.values(TEMPLATE_CATEGORIES).includes(category)) {
    errors.push(
      `Categoría inválida. Debe ser: ${Object.values(TEMPLATE_CATEGORIES).join(', ')}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida el componente header de una plantilla
 * @param {object} header - Componente header
 * @returns {object} - Resultado de validación
 */
export function validateTemplateHeader(header) {
  const errors = [];

  if (!header) {
    return { isValid: true, errors }; // Header es opcional
  }

  if (!header.type || !Object.values(HEADER_TYPES).includes(header.type)) {
    errors.push(
      `Tipo de header inválido. Debe ser: ${Object.values(HEADER_TYPES).join(', ')}`
    );
  }

  if (header.type === HEADER_TYPES.TEXT) {
    if (!header.text) {
      errors.push('El texto del header es requerido');
    } else if (header.text.length > TEMPLATE_LIMITS.HEADER_MAX_LENGTH) {
      errors.push(
        `El header excede el límite de ${TEMPLATE_LIMITS.HEADER_MAX_LENGTH} caracteres`
      );
    }

    // ✅ Validar variables en el header (máximo 1)
    if (header.text) {
      const variables = header.text.match(/\{\{\d+\}\}/g) || [];
      
      if (variables.length > 1) {
        errors.push(
          `❌ El header soporta máximo 1 variable, se encontraron ${variables.length}`
        );
      } else if (variables.length === 1) {
        // Validar que la única variable sea {{1}}
        if (variables[0] !== '{{1}}') {
          errors.push(
            `❌ El header debe usar {{1}} como única variable, no ${variables[0]}`
          );
        }
        // Validar reglas generales de variables
        validateTemplateVariablesInText(header.text, errors);
      }
    }
  }

  if (
    [HEADER_TYPES.IMAGE, HEADER_TYPES.VIDEO, HEADER_TYPES.DOCUMENT].includes(
      header.type
    )
  ) {
    if (!header.example || !header.example.header_url) {
      errors.push('Se requiere una URL de ejemplo para headers multimedia');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida el componente body de una plantilla
 * @param {object} body - Componente body
 * @returns {object} - Resultado de validación
 */
export function validateTemplateBody(body) {
  const errors = [];

  if (!body || !body.text) {
    errors.push('El texto del cuerpo es requerido');
    return { isValid: false, errors };
  }

  if (body.text.length > TEMPLATE_LIMITS.BODY_MAX_LENGTH) {
    errors.push(
      `El cuerpo excede el límite de ${TEMPLATE_LIMITS.BODY_MAX_LENGTH} caracteres`
    );
  }

  // ✅ Validar variables en el texto
  validateTemplateVariablesInText(body.text, errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida las variables dentro de un texto de plantilla
 * Reglas:
 * 1. Deben ser secuenciales ({{1}}, {{2}}, {{3}}, sin saltos)
 * 2. No pueden estar al inicio o final
 * 3. No pueden estar juntas ({{1}}{{2}})
 * 4. Solo números, sin caracteres especiales
 * @param {string} text - Texto a validar
 * @param {array} errors - Array de errores para agregar
 */
function validateTemplateVariablesInText(text, errors) {
  // Detectar variables con formato {{número}}
  const variableRegex = /\{\{(\d+)\}\}/g;
  const variables = [];
  let match;

  while ((match = variableRegex.exec(text)) !== null) {
    variables.push({
      full: match[0],
      number: parseInt(match[1]),
      index: match.index,
    });
  }

  if (variables.length === 0) {
    return; // Sin variables, sin validación
  }

  // ✅ Regla 1: Verificar que sean secuenciales (1, 2, 3, sin saltos)
  const expectedNumbers = Array.from(
    { length: variables.length },
    (_, i) => i + 1
  );
  const actualNumbers = variables.map(v => v.number);

  if (!actualNumbers.every((num, index) => num === expectedNumbers[index])) {
    errors.push(
      `❌ Las variables deben ser secuenciales: {{1}}, {{2}}, {{3}}, etc. (sin saltos)`
    );
  }

  // ✅ Regla 2: No pueden estar al inicio
  if (variables[0].index === 0) {
    errors.push('❌ Las variables no pueden estar al inicio de la plantilla');
  }

  // ✅ Regla 2: No pueden estar al final
  const lastVarEnd = variables[variables.length - 1].index + variables[variables.length - 1].full.length;
  if (lastVarEnd === text.length) {
    errors.push('❌ Las variables no pueden estar al final de la plantilla');
  }

  // ✅ Regla 3: No pueden estar juntas
  for (let i = 0; i < variables.length - 1; i++) {
    const currentVarEnd = variables[i].index + variables[i].full.length;
    const nextVarStart = variables[i + 1].index;

    if (currentVarEnd === nextVarStart) {
      errors.push(
        `❌ Las variables no pueden estar juntas. Agrega espacio entre {{${variables[i].number}}} y {{${variables[i + 1].number}}}}`
      );
    }
  }

  // ✅ Regla 4: Solo números, sin caracteres especiales
  // (Ya validado por el regex \d+, pero podemos ser más explícito)
  const invalidVarRegex = /\{\{[^}]*[#$%&@!^*()+=\[\]{};:'",.<>/?\\|`~]+[^}]*\}\}/g;
  if (invalidVarRegex.test(text)) {
    errors.push(
      '❌ Las variables solo pueden contener números. No se permiten caracteres especiales (#, $, %, &, @, !, etc.)'
    );
  }
}

/**
 * Valida el componente footer de una plantilla
 * @param {object} footer - Componente footer
 * @returns {object} - Resultado de validación
 */
export function validateTemplateFooter(footer) {
  const errors = [];

  if (!footer) {
    return { isValid: true, errors }; // Footer es opcional
  }

  if (!footer.text) {
    errors.push('El texto del footer es requerido si se incluye footer');
  } else if (footer.text.length > TEMPLATE_LIMITS.FOOTER_MAX_LENGTH) {
    errors.push(
      `El footer excede el límite de ${TEMPLATE_LIMITS.FOOTER_MAX_LENGTH} caracteres`
    );
  }

  // ✅ Validar variables en el footer
  if (footer.text) {
    validateTemplateVariablesInText(footer.text, errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida los botones de una plantilla
 * @param {array} buttons - Array de botones
 * @returns {object} - Resultado de validación
 */
export function validateTemplateButtons(buttons) {
  const errors = [];

  if (!buttons) {
    return { isValid: true, errors }; // Botones son opcionales
  }

  if (!Array.isArray(buttons)) {
    errors.push('Los botones deben ser un array');
    return { isValid: false, errors };
  }

  if (buttons.length > TEMPLATE_LIMITS.MAX_BUTTONS) {
    errors.push(`Máximo ${TEMPLATE_LIMITS.MAX_BUTTONS} botones permitidos`);
  }

  const buttonTypes = buttons.map(b => b.type);
  const quickReplyCount = buttonTypes.filter(
    t => t === BUTTON_TYPES.QUICK_REPLY
  ).length;
  const callToActionCount = buttonTypes.filter(t =>
    [BUTTON_TYPES.URL, BUTTON_TYPES.PHONE_NUMBER].includes(t)
  ).length;

  if (quickReplyCount > TEMPLATE_LIMITS.MAX_QUICK_REPLY_BUTTONS) {
    errors.push(
      `Máximo ${TEMPLATE_LIMITS.MAX_QUICK_REPLY_BUTTONS} botones de respuesta rápida permitidos`
    );
  }

  if (callToActionCount > TEMPLATE_LIMITS.MAX_CALL_TO_ACTION_BUTTONS) {
    errors.push(
      `Máximo ${TEMPLATE_LIMITS.MAX_CALL_TO_ACTION_BUTTONS} botones de llamada a la acción permitidos`
    );
  }

  buttons.forEach((button, index) => {
    if (!button.type || !Object.values(BUTTON_TYPES).includes(button.type)) {
      errors.push(
        `Tipo de botón ${index + 1} inválido. Debe ser: ${Object.values(BUTTON_TYPES).join(', ')}`
      );
    }

    if (!button.text) {
      errors.push(`El texto del botón ${index + 1} es requerido`);
    } else if (button.text.length > TEMPLATE_LIMITS.BUTTON_TEXT_MAX_LENGTH) {
      errors.push(
        `El texto del botón ${index + 1} excede ${TEMPLATE_LIMITS.BUTTON_TEXT_MAX_LENGTH} caracteres`
      );
    }

    if (button.type === BUTTON_TYPES.URL && !button.url) {
      errors.push(`La URL del botón ${index + 1} es requerida`);
    }

    if (button.type === BUTTON_TYPES.PHONE_NUMBER && !button.phone_number) {
      errors.push(`El número de teléfono del botón ${index + 1} es requerido`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida un componente individual de una plantilla
 * @param {object} component - Componente a validar
 * @returns {object} - Resultado de validación
 */
export function validateTemplateComponent(component) {
  if (!component || !component.type) {
    return {
      isValid: false,
      error: 'El componente debe tener un tipo válido',
    };
  }

  switch (component.type) {
    case COMPONENT_TYPES.HEADER:
      const headerValidation = validateTemplateHeader(component);
      return {
        isValid: headerValidation.isValid,
        error: headerValidation.errors.join(', '),
      };

    case COMPONENT_TYPES.BODY:
      const bodyValidation = validateTemplateBody(component);
      return {
        isValid: bodyValidation.isValid,
        error: bodyValidation.errors.join(', '),
      };

    case COMPONENT_TYPES.FOOTER:
      const footerValidation = validateTemplateFooter(component);
      return {
        isValid: footerValidation.isValid,
        error: footerValidation.errors.join(', '),
      };

    case COMPONENT_TYPES.BUTTONS:
      const buttonsValidation = validateTemplateButtons(component);
      return {
        isValid: buttonsValidation.isValid,
        error: buttonsValidation.errors.join(', '),
      };

    default:
      return {
        isValid: false,
        error: `Tipo de componente no válido: ${component.type}`,
      };
  }
}

/**
 * Valida una plantilla completa
 * @param {object} template - Plantilla a validar
 * @returns {object} - Resultado de validación
 */
export function validateTemplate(template) {
  const errors = [];

  if (!template || typeof template !== 'object') {
    errors.push('La plantilla debe ser un objeto válido');
    return { isValid: false, errors };
  }

  // Validar nombre
  const nameValidation = validateTemplateName(template.name);
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors);
  }

  // Validar categoría
  const categoryValidation = validateTemplateCategory(template.category);
  if (!categoryValidation.isValid) {
    errors.push(...categoryValidation.errors);
  }

  // Validar componentes
  if (!template.components || !Array.isArray(template.components)) {
    errors.push('Los componentes de la plantilla son requeridos');
    return { isValid: false, errors };
  }

  const headerComponent = template.components.find(
    c => c.type === COMPONENT_TYPES.HEADER
  );
  const bodyComponent = template.components.find(
    c => c.type === COMPONENT_TYPES.BODY
  );
  const footerComponent = template.components.find(
    c => c.type === COMPONENT_TYPES.FOOTER
  );
  const buttonsComponent = template.components.find(
    c => c.type === COMPONENT_TYPES.BUTTONS
  );

  // Validar cada componente
  const headerValidation = validateTemplateHeader(headerComponent);
  if (!headerValidation.isValid) {
    errors.push(...headerValidation.errors);
  }

  const bodyValidation = validateTemplateBody(bodyComponent);
  if (!bodyValidation.isValid) {
    errors.push(...bodyValidation.errors);
  }

  const footerValidation = validateTemplateFooter(footerComponent);
  if (!footerValidation.isValid) {
    errors.push(...footerValidation.errors);
  }

  const buttonsValidation = validateTemplateButtons(buttonsComponent?.buttons);
  if (!buttonsValidation.isValid) {
    errors.push(...buttonsValidation.errors);
  }

  // ✅ Validar ejemplos si hay variables
  const examplesValidation = validateTemplateExamples(template);
  if (!examplesValidation.isValid) {
    errors.push(...examplesValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    template: template,
  };
}

/**
 * Valida que las plantillas con variables tengan ejemplos
 * @param {object} template - Plantilla a validar
 * @returns {object} - Resultado de validación
 */
function validateTemplateExamples(template) {
  const errors = [];

  if (!template.components) {
    return { isValid: true, errors };
  }

  // Contar variables en todos los componentes
  let headerVarCount = 0;
  let bodyVarCount = 0;
  let footerVarCount = 0;

  const headerComponent = template.components.find(
    c => c.type === COMPONENT_TYPES.HEADER
  );
  const bodyComponent = template.components.find(
    c => c.type === COMPONENT_TYPES.BODY
  );
  const footerComponent = template.components.find(
    c => c.type === COMPONENT_TYPES.FOOTER
  );

  if (headerComponent && headerComponent.text) {
    const headerVars = headerComponent.text.match(/\{\{\d+\}\}/g) || [];
    headerVarCount = headerVars.length;
  }

  if (bodyComponent && bodyComponent.text) {
    const bodyVars = bodyComponent.text.match(/\{\{\d+\}\}/g) || [];
    bodyVarCount = bodyVars.length;
  }

  if (footerComponent && footerComponent.text) {
    const footerVars = footerComponent.text.match(/\{\{\d+\}\}/g) || [];
    footerVarCount = footerVars.length;
  }

  const totalVariables = headerVarCount + bodyVarCount + footerVarCount;

  // Si hay variables, validar que existan ejemplos
  if (totalVariables > 0) {
    if (!template.example) {
      errors.push(
        `❌ Se requieren ejemplos para plantillas con variables. Agrega la propiedad "example" con ejemplos para cada variable.`
      );
      return { isValid: false, errors };
    }

    // ✅ Validar ejemplos del header
    if (headerVarCount > 0) {
      if (!template.example.header_text) {
        errors.push(
          `❌ Se requiere la propiedad "example.header_text" con ejemplos para la variable del encabezado.`
        );
      } else if (!Array.isArray(template.example.header_text)) {
        errors.push(
          `❌ "example.header_text" debe ser un array de arrays. Formato: [["valor1"], ["valor2"]]`
        );
      } else if (template.example.header_text.length === 0) {
        errors.push(
          `❌ "example.header_text" no puede estar vacío. Debe contener al menos un conjunto de ejemplos.`
        );
      } else {
        // Validar que cada ejemplo tenga exactamente 1 valor
        template.example.header_text.forEach((exampleSet, setIndex) => {
          if (!Array.isArray(exampleSet)) {
            errors.push(
              `❌ El ejemplo del header ${setIndex + 1} debe ser un array de valores.`
            );
          } else if (exampleSet.length !== 1) {
            errors.push(
              `❌ El ejemplo del header ${setIndex + 1} debe tener exactamente 1 valor (para {{1}}).`
            );
          }
        });
      }
    }

    // ✅ Validar ejemplos del body
    if (bodyVarCount > 0) {
      if (!template.example.body_text) {
        errors.push(
          `❌ Se requiere la propiedad "example.body_text" con ejemplos para las variables del cuerpo.`
        );
      } else if (!Array.isArray(template.example.body_text)) {
        errors.push(
          `❌ "example.body_text" debe ser un array de arrays. Formato: [["valor1", "valor2", ...]]`
        );
      } else if (template.example.body_text.length === 0) {
        errors.push(
          `❌ "example.body_text" no puede estar vacío. Debe contener al menos un conjunto de ejemplos.`
        );
      } else {
        // Validar que cada ejemplo tenga el número correcto de valores
        template.example.body_text.forEach((exampleSet, setIndex) => {
          if (!Array.isArray(exampleSet)) {
            errors.push(
              `❌ El ejemplo del body ${setIndex + 1} debe ser un array de valores.`
            );
          } else if (exampleSet.length !== bodyVarCount) {
            errors.push(
              `❌ El ejemplo del body ${setIndex + 1} tiene ${exampleSet.length} valores pero se requieren ${bodyVarCount} (uno por cada variable).`
            );
          }
        });
      }
    }

    // ✅ Validar ejemplos del footer
    if (footerVarCount > 0) {
      if (!template.example.footer_text) {
        errors.push(
          `❌ Se requiere la propiedad "example.footer_text" con ejemplos para las variables del pie de página.`
        );
      } else if (!Array.isArray(template.example.footer_text)) {
        errors.push(
          `❌ "example.footer_text" debe ser un array de arrays. Formato: [["valor1", "valor2", ...]]`
        );
      } else if (template.example.footer_text.length === 0) {
        errors.push(
          `❌ "example.footer_text" no puede estar vacío. Debe contener al menos un conjunto de ejemplos.`
        );
      } else {
        // Validar que cada ejemplo tenga el número correcto de valores
        template.example.footer_text.forEach((exampleSet, setIndex) => {
          if (!Array.isArray(exampleSet)) {
            errors.push(
              `❌ El ejemplo del footer ${setIndex + 1} debe ser un array de valores.`
            );
          } else if (exampleSet.length !== footerVarCount) {
            errors.push(
              `❌ El ejemplo del footer ${setIndex + 1} tiene ${exampleSet.length} valores pero se requieren ${footerVarCount} (uno por cada variable).`
            );
          }
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida variables para envío de plantilla
 * @param {array} variables - Array de variables
 * @param {object} template - Plantilla que requiere las variables
 * @returns {object} - Resultado de validación
 */
export function validateTemplateVariables(variables, template) {
  const errors = [];

  if (!template || !template.components) {
    errors.push('Plantilla inválida para validar variables');
    return { isValid: false, errors };
  }

  // Contar variables requeridas en cada componente
  let totalVariablesRequired = 0;

  template.components.forEach(component => {
    if (component.type === COMPONENT_TYPES.HEADER && component.text) {
      const headerVars = component.text.match(/\{\{\d+\}\}/g) || [];
      totalVariablesRequired += headerVars.length;
    }

    if (component.type === COMPONENT_TYPES.BODY && component.text) {
      const bodyVars = component.text.match(/\{\{\d+\}\}/g) || [];
      totalVariablesRequired += bodyVars.length;
    }
  });

  if (totalVariablesRequired > 0) {
    if (!variables || !Array.isArray(variables)) {
      errors.push('Se requieren variables para esta plantilla');
      return { isValid: false, errors };
    }

    if (variables.length !== totalVariablesRequired) {
      errors.push(
        `Se requieren exactamente ${totalVariablesRequired} variables, se proporcionaron ${variables.length}`
      );
    }

    variables.forEach((variable, index) => {
      if (typeof variable !== 'string') {
        errors.push(`La variable ${index + 1} debe ser una cadena de texto`);
      } else if (variable.length > TEMPLATE_LIMITS.VARIABLE_MAX_LENGTH) {
        errors.push(
          `La variable ${index + 1} excede el límite de ${TEMPLATE_LIMITS.VARIABLE_MAX_LENGTH} caracteres`
        );
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

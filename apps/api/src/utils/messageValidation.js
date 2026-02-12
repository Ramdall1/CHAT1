/**
 * Validación de mensajes según estándares de 360Dialog
 * Basado en la documentación oficial de WhatsApp Business API y 360Dialog
 */

// Límites de caracteres según documentación oficial
const MESSAGE_LIMITS = {
  TEXT: {
    MAX_LENGTH: 4096, // Máximo para mensajes de texto
    PREVIEW_CHARS: 65, // Primeros caracteres visibles en preview
  },
  TEMPLATE: {
    NAME_MAX_LENGTH: 512, // Nombre de template
    CONTENT_MAX_LENGTH: 1024, // Contenido de template
    FIRST_LINES_VISIBLE: 5, // Líneas visibles antes de truncamiento
  },
  INTERACTIVE: {
    LIST: {
      MAX_OPTIONS: 10, // Máximo 10 opciones en lista
      TITLE_MAX_LENGTH: 24, // Título de sección
      ROW_TITLE_MAX_LENGTH: 24, // Título de fila
      ROW_DESCRIPTION_MAX_LENGTH: 72, // Descripción de fila
      BUTTON_TEXT_MAX_LENGTH: 20, // Texto del botón principal
      HEADER_MAX_LENGTH: 60, // Encabezado
      BODY_MAX_LENGTH: 1024, // Cuerpo del mensaje
      FOOTER_MAX_LENGTH: 60, // Pie de página
    },
    BUTTON: {
      MAX_BUTTONS: 3, // Máximo 3 botones
      TITLE_MAX_LENGTH: 20, // Título del botón
      BODY_MAX_LENGTH: 1024, // Cuerpo del mensaje
    },
  },
  MEDIA: {
    RETENTION_DAYS: 14, // 360dialog almacena media por 14 días
  },
  PHONE: {
    E164_FORMAT: /^\+[1-9]\d{1,14}$/, // Formato E.164
  },
};

// Tipos de mensaje válidos
const VALID_MESSAGE_TYPES = [
  'text',
  'image',
  'audio',
  'video',
  'document',
  'location',
  'contacts',
  'interactive',
  'template',
  'reaction',
];

// Tipos de mensaje interactivo válidos
const VALID_INTERACTIVE_TYPES = ['list', 'button'];

// Categorías de template válidas
const VALID_TEMPLATE_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

/**
 * Valida un número de teléfono en formato E.164
 * @param {string} phoneNumber - Número de teléfono
 * @returns {Object} Resultado de validación
 */
function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      isValid: false,
      error: 'Número de teléfono requerido',
    };
  }

  if (!MESSAGE_LIMITS.PHONE.E164_FORMAT.test(phoneNumber)) {
    return {
      isValid: false,
      error: 'Número de teléfono debe estar en formato E.164 (+1234567890)',
    };
  }

  return { isValid: true };
}

/**
 * Valida un mensaje de texto
 * @param {Object} textMessage - Objeto del mensaje de texto
 * @returns {Object} Resultado de validación
 */
function validateTextMessage(textMessage) {
  if (!textMessage || !textMessage.body) {
    return {
      isValid: false,
      error: 'Cuerpo del mensaje de texto requerido',
    };
  }

  if (textMessage.body.length > MESSAGE_LIMITS.TEXT.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Mensaje de texto excede el límite de ${MESSAGE_LIMITS.TEXT.MAX_LENGTH} caracteres`,
    };
  }

  // Validar URLs si preview_url está habilitado
  if (textMessage.preview_url && textMessage.body) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = textMessage.body.match(urlRegex);

    if (urls) {
      for (const url of urls) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return {
            isValid: false,
            error: 'URLs deben comenzar con http:// o https:// para preview',
          };
        }
      }
    }
  }

  return { isValid: true };
}

/**
 * Valida un mensaje de lista interactivo
 * @param {Object} listMessage - Objeto del mensaje de lista
 * @returns {Object} Resultado de validación
 */
function validateListMessage(listMessage) {
  const { header, body, footer, action } = listMessage;

  // Validar encabezado
  if (
    header &&
    header.text &&
    header.text.length > MESSAGE_LIMITS.INTERACTIVE.LIST.HEADER_MAX_LENGTH
  ) {
    return {
      isValid: false,
      error: `Encabezado excede ${MESSAGE_LIMITS.INTERACTIVE.LIST.HEADER_MAX_LENGTH} caracteres`,
    };
  }

  // Validar cuerpo (requerido)
  if (!body || !body.text) {
    return {
      isValid: false,
      error: 'Cuerpo del mensaje de lista requerido',
    };
  }

  if (body.text.length > MESSAGE_LIMITS.INTERACTIVE.LIST.BODY_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Cuerpo excede ${MESSAGE_LIMITS.INTERACTIVE.LIST.BODY_MAX_LENGTH} caracteres`,
    };
  }

  // Validar pie de página
  if (
    footer &&
    footer.text &&
    footer.text.length > MESSAGE_LIMITS.INTERACTIVE.LIST.FOOTER_MAX_LENGTH
  ) {
    return {
      isValid: false,
      error: `Pie de página excede ${MESSAGE_LIMITS.INTERACTIVE.LIST.FOOTER_MAX_LENGTH} caracteres`,
    };
  }

  // Validar acción
  if (!action || !action.button || !action.sections) {
    return {
      isValid: false,
      error: 'Acción con botón y secciones requerida',
    };
  }

  if (
    action.button.length >
    MESSAGE_LIMITS.INTERACTIVE.LIST.BUTTON_TEXT_MAX_LENGTH
  ) {
    return {
      isValid: false,
      error: `Texto del botón excede ${MESSAGE_LIMITS.INTERACTIVE.LIST.BUTTON_TEXT_MAX_LENGTH} caracteres`,
    };
  }

  // Contar total de opciones
  let totalRows = 0;
  for (const section of action.sections) {
    if (!section.title || !section.rows) {
      return {
        isValid: false,
        error: 'Cada sección debe tener título y filas',
      };
    }

    if (
      section.title.length > MESSAGE_LIMITS.INTERACTIVE.LIST.TITLE_MAX_LENGTH
    ) {
      return {
        isValid: false,
        error: `Título de sección excede ${MESSAGE_LIMITS.INTERACTIVE.LIST.TITLE_MAX_LENGTH} caracteres`,
      };
    }

    totalRows += section.rows.length;

    // Validar cada fila
    for (const row of section.rows) {
      if (!row.id || !row.title) {
        return {
          isValid: false,
          error: 'Cada fila debe tener id y título',
        };
      }

      if (
        row.title.length > MESSAGE_LIMITS.INTERACTIVE.LIST.ROW_TITLE_MAX_LENGTH
      ) {
        return {
          isValid: false,
          error: `Título de fila excede ${MESSAGE_LIMITS.INTERACTIVE.LIST.ROW_TITLE_MAX_LENGTH} caracteres`,
        };
      }

      if (
        row.description &&
        row.description.length >
          MESSAGE_LIMITS.INTERACTIVE.LIST.ROW_DESCRIPTION_MAX_LENGTH
      ) {
        return {
          isValid: false,
          error: `Descripción de fila excede ${MESSAGE_LIMITS.INTERACTIVE.LIST.ROW_DESCRIPTION_MAX_LENGTH} caracteres`,
        };
      }
    }
  }

  if (totalRows > MESSAGE_LIMITS.INTERACTIVE.LIST.MAX_OPTIONS) {
    return {
      isValid: false,
      error: `Total de opciones (${totalRows}) excede el límite de ${MESSAGE_LIMITS.INTERACTIVE.LIST.MAX_OPTIONS}`,
    };
  }

  return { isValid: true };
}

/**
 * Valida un mensaje de botones interactivo
 * @param {Object} buttonMessage - Objeto del mensaje de botones
 * @returns {Object} Resultado de validación
 */
function validateButtonMessage(buttonMessage) {
  const { body, action } = buttonMessage;

  // Validar cuerpo (requerido)
  if (!body || !body.text) {
    return {
      isValid: false,
      error: 'Cuerpo del mensaje de botones requerido',
    };
  }

  if (body.text.length > MESSAGE_LIMITS.INTERACTIVE.BUTTON.BODY_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Cuerpo excede ${MESSAGE_LIMITS.INTERACTIVE.BUTTON.BODY_MAX_LENGTH} caracteres`,
    };
  }

  // Validar acción
  if (!action || !action.buttons || !Array.isArray(action.buttons)) {
    return {
      isValid: false,
      error: 'Acción con array de botones requerida',
    };
  }

  if (action.buttons.length > MESSAGE_LIMITS.INTERACTIVE.BUTTON.MAX_BUTTONS) {
    return {
      isValid: false,
      error: `Número de botones (${action.buttons.length}) excede el límite de ${MESSAGE_LIMITS.INTERACTIVE.BUTTON.MAX_BUTTONS}`,
    };
  }

  // Validar cada botón
  for (const button of action.buttons) {
    if (!button.type || button.type !== 'reply') {
      return {
        isValid: false,
        error: 'Cada botón debe tener type "reply"',
      };
    }

    if (!button.reply || !button.reply.id || !button.reply.title) {
      return {
        isValid: false,
        error: 'Cada botón debe tener reply con id y title',
      };
    }

    if (
      button.reply.title.length >
      MESSAGE_LIMITS.INTERACTIVE.BUTTON.TITLE_MAX_LENGTH
    ) {
      return {
        isValid: false,
        error: `Título de botón excede ${MESSAGE_LIMITS.INTERACTIVE.BUTTON.TITLE_MAX_LENGTH} caracteres`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Valida un mensaje interactivo
 * @param {Object} interactiveMessage - Objeto del mensaje interactivo
 * @returns {Object} Resultado de validación
 */
function validateInteractiveMessage(interactiveMessage) {
  if (!interactiveMessage || !interactiveMessage.type) {
    return {
      isValid: false,
      error: 'Tipo de mensaje interactivo requerido',
    };
  }

  if (!VALID_INTERACTIVE_TYPES.includes(interactiveMessage.type)) {
    return {
      isValid: false,
      error: `Tipo de mensaje interactivo inválido. Válidos: ${VALID_INTERACTIVE_TYPES.join(', ')}`,
    };
  }

  switch (interactiveMessage.type) {
    case 'list':
      return validateListMessage(interactiveMessage);
    case 'button':
      return validateButtonMessage(interactiveMessage);
    default:
      return {
        isValid: false,
        error: 'Tipo de mensaje interactivo no soportado',
      };
  }
}

/**
 * Valida un template de mensaje
 * @param {Object} template - Objeto del template
 * @returns {Object} Resultado de validación
 */
function validateTemplate(template) {
  if (!template.name) {
    return {
      isValid: false,
      error: 'Nombre del template requerido',
    };
  }

  if (template.name.length > MESSAGE_LIMITS.TEMPLATE.NAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Nombre del template excede ${MESSAGE_LIMITS.TEMPLATE.NAME_MAX_LENGTH} caracteres`,
    };
  }

  if (
    !template.category ||
    !VALID_TEMPLATE_CATEGORIES.includes(template.category)
  ) {
    return {
      isValid: false,
      error: `Categoría de template inválida. Válidas: ${VALID_TEMPLATE_CATEGORIES.join(', ')}`,
    };
  }

  if (!template.language) {
    return {
      isValid: false,
      error: 'Idioma del template requerido',
    };
  }

  // Validar componentes
  if (!template.components || !Array.isArray(template.components)) {
    return {
      isValid: false,
      error: 'Componentes del template requeridos',
    };
  }

  // Validar contenido del cuerpo
  const bodyComponent = template.components.find(c => c.type === 'BODY');
  if (
    bodyComponent &&
    bodyComponent.text &&
    bodyComponent.text.length > MESSAGE_LIMITS.TEMPLATE.CONTENT_MAX_LENGTH
  ) {
    return {
      isValid: false,
      error: `Contenido del template excede ${MESSAGE_LIMITS.TEMPLATE.CONTENT_MAX_LENGTH} caracteres`,
    };
  }

  return { isValid: true };
}

/**
 * Valida un mensaje de reacción
 * @param {Object} reactionMessage - Objeto del mensaje de reacción
 * @returns {Object} Resultado de validación
 */
function validateReactionMessage(reactionMessage) {
  if (!reactionMessage.message_id) {
    return {
      isValid: false,
      error: 'ID del mensaje para reaccionar requerido',
    };
  }

  if (!reactionMessage.emoji) {
    return {
      isValid: false,
      error: 'Emoji para la reacción requerido',
    };
  }

  // Validar que sea un emoji válido (básico)
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  if (!emojiRegex.test(reactionMessage.emoji)) {
    return {
      isValid: false,
      error: 'Emoji inválido',
    };
  }

  return { isValid: true };
}

/**
 * Valida la estructura general de un mensaje
 * @param {Object} message - Objeto del mensaje
 * @returns {Object} Resultado de validación
 */
function validateMessage(message) {
  // Validar estructura básica
  if (!message || typeof message !== 'object') {
    return {
      isValid: false,
      error: 'Mensaje debe ser un objeto válido',
    };
  }

  // Validar destinatario
  if (!message.to) {
    return {
      isValid: false,
      error: 'Destinatario (to) requerido',
    };
  }

  const phoneValidation = validatePhoneNumber(message.to);
  if (!phoneValidation.isValid) {
    return phoneValidation;
  }

  // Validar tipo de mensaje
  if (!message.type || !VALID_MESSAGE_TYPES.includes(message.type)) {
    return {
      isValid: false,
      error: `Tipo de mensaje inválido. Válidos: ${VALID_MESSAGE_TYPES.join(', ')}`,
    };
  }

  // Validar messaging_product
  if (!message.messaging_product || message.messaging_product !== 'whatsapp') {
    return {
      isValid: false,
      error: 'messaging_product debe ser "whatsapp"',
    };
  }

  // Validar recipient_type
  if (!message.recipient_type || message.recipient_type !== 'individual') {
    return {
      isValid: false,
      error: 'recipient_type debe ser "individual"',
    };
  }

  // Validaciones específicas por tipo
  switch (message.type) {
    case 'text':
      return validateTextMessage(message.text);
    case 'interactive':
      return validateInteractiveMessage(message.interactive);
    case 'template':
      return validateTemplate(message.template);
    case 'reaction':
      return validateReactionMessage(message.reaction);
    default:
      // Para otros tipos (image, audio, video, document, location, contacts)
      // se pueden agregar validaciones específicas aquí
      return { isValid: true };
  }
}

/**
 * Valida límites de tiempo para mensajes
 * @param {string} lastUserMessage - Timestamp del último mensaje del usuario
 * @returns {Object} Resultado de validación
 */
function validateMessageTiming(lastUserMessage) {
  if (!lastUserMessage) {
    return {
      isValid: false,
      error: 'Se requiere template para iniciar conversación',
      requiresTemplate: true,
    };
  }

  const lastMessageTime = new Date(lastUserMessage);
  const now = new Date();
  const hoursDiff = (now - lastMessageTime) / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    return {
      isValid: false,
      error: 'Han pasado más de 24 horas desde el último mensaje del usuario',
      requiresTemplate: true,
    };
  }

  return { isValid: true };
}

/**
 * Sanitiza texto para prevenir inyecciones
 * @param {string} text - Texto a sanitizar
 * @returns {string} Texto sanitizado
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(/[<>]/g, '') // Remover caracteres HTML básicos
    .replace(/javascript:/gi, '') // Remover javascript:
    .replace(/on\w+=/gi, '') // Remover event handlers
    .trim();
}

/**
 * Valida y sanitiza un mensaje completo
 * @param {Object} message - Mensaje a validar
 * @param {string} lastUserMessage - Timestamp del último mensaje del usuario
 * @returns {Object} Resultado de validación con mensaje sanitizado
 */
function validateAndSanitizeMessage(message, lastUserMessage = null) {
  // Validar estructura
  const structureValidation = validateMessage(message);
  if (!structureValidation.isValid) {
    return structureValidation;
  }

  // Validar timing para mensajes no-template
  if (message.type !== 'template') {
    const timingValidation = validateMessageTiming(lastUserMessage);
    if (!timingValidation.isValid) {
      return timingValidation;
    }
  }

  // Sanitizar contenido de texto
  const sanitizedMessage = { ...message };

  if (message.type === 'text' && message.text && message.text.body) {
    sanitizedMessage.text.body = sanitizeText(message.text.body);
  }

  if (message.type === 'interactive') {
    if (message.interactive.body && message.interactive.body.text) {
      sanitizedMessage.interactive.body.text = sanitizeText(
        message.interactive.body.text
      );
    }
    if (message.interactive.header && message.interactive.header.text) {
      sanitizedMessage.interactive.header.text = sanitizeText(
        message.interactive.header.text
      );
    }
    if (message.interactive.footer && message.interactive.footer.text) {
      sanitizedMessage.interactive.footer.text = sanitizeText(
        message.interactive.footer.text
      );
    }
  }

  return {
    isValid: true,
    sanitizedMessage,
  };
}

export {
  MESSAGE_LIMITS,
  VALID_MESSAGE_TYPES,
  VALID_INTERACTIVE_TYPES,
  VALID_TEMPLATE_CATEGORIES,
  validatePhoneNumber,
  validateTextMessage,
  validateListMessage,
  validateButtonMessage,
  validateInteractiveMessage,
  validateTemplate,
  validateReactionMessage,
  validateMessage,
  validateMessageTiming,
  sanitizeText,
  validateAndSanitizeMessage,
};

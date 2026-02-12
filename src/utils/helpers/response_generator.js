/**
 * Generador de respuestas para el sistema de chat bot
 */

/**
 * Genera una respuesta basada en el mensaje del usuario y el contacto
 * @param {string} message - Mensaje del usuario
 * @param {Object} contact - Información del contacto
 * @returns {Promise<string>} Respuesta generada
 */
export async function generateResponse(message, contact) {
  const lowerMessage = message.toLowerCase();
  const userName = contact?.name || 'Usuario';

  // Saludos
  if (lowerMessage.includes('hola') || lowerMessage.includes('buenos días') || lowerMessage.includes('buenas tardes')) {
    return `¡Hola ${userName}! ¿En qué puedo ayudarte hoy?`;
  }

  // Solicitudes de ayuda
  if (lowerMessage.includes('ayuda') || lowerMessage.includes('help')) {
    return 'Estoy aquí para ayudarte. Puedes preguntarme sobre nuestros servicios o cualquier duda que tengas.';
  }

  // Agradecimientos
  if (lowerMessage.includes('gracias') || lowerMessage.includes('thank')) {
    return '¡De nada! Estoy aquí para ayudarte cuando lo necesites.';
  }

  // Despedidas
  if (lowerMessage.includes('adiós') || lowerMessage.includes('hasta luego') || lowerMessage.includes('bye')) {
    return '¡Hasta luego! Que tengas un excelente día.';
  }

  // Respuesta por defecto
  return `Gracias por tu mensaje, ${userName}. He recibido: "${message}". ¿Hay algo específico en lo que pueda ayudarte?`;
}

/**
 * Genera una respuesta de éxito
 * @param {string} message - Mensaje de éxito
 * @param {Object} data - Datos adicionales
 * @returns {Object} Respuesta de éxito
 */
export function successResponse(message, data = null) {
  return generateResponse('success', message, data);
}

/**
 * Genera una respuesta de error
 * @param {string} message - Mensaje de error
 * @param {Object} data - Datos adicionales
 * @returns {Object} Respuesta de error
 */
export function errorResponse(message, data = null) {
  return generateResponse('error', message, data);
}

/**
 * Genera una respuesta informativa
 * @param {string} message - Mensaje informativo
 * @param {Object} data - Datos adicionales
 * @returns {Object} Respuesta informativa
 */
export function infoResponse(message, data = null) {
  return generateResponse('info', message, data);
}

/**
 * Genera una respuesta de advertencia
 * @param {string} message - Mensaje de advertencia
 * @param {Object} data - Datos adicionales
 * @returns {Object} Respuesta de advertencia
 */
export function warningResponse(message, data = null) {
  return generateResponse('warning', message, data);
}

// Exportación por defecto
export default {
  generateResponse,
  successResponse,
  errorResponse,
  infoResponse,
  warningResponse
};
import logger from '../utils/logger.js';

class TemplateErrorHandler {
  constructor() {
    this.retryAttempts = new Map(); // messageId -> attempts
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 segundos
    this.backoffMultiplier = 2;
    this.fallbackTemplates = new Map(); // templateName -> fallbackTemplateName
  }

  /**
   * Maneja errores de plantillas con retry logic y fallbacks
   */
  async handleTemplateError(error, templateData, attempt = 1) {
    const { to, name: templateName, languageCode, components } = templateData;
    const errorKey = `${to}_${templateName}_${Date.now()}`;

    logger.templateError('template_send_failed', {
      templateName,
      to,
      attempt,
      error: error.message,
      statusCode: error.response?.status,
      errorKey,
    });

    // Verificar si es un error 403 (pago bloqueado)
    if (error.response?.status === 403) {
      return this.handle403Error(error, templateData, attempt, errorKey);
    }

    // Verificar si es un error de plantilla no encontrada o inválida
    if (error.response?.status === 400 || error.response?.status === 404) {
      return this.handleTemplateNotFoundError(
        error,
        templateData,
        attempt,
        errorKey
      );
    }

    // Para otros errores, intentar retry
    if (attempt < this.maxRetries) {
      return this.scheduleRetry(templateData, attempt, errorKey);
    }

    // Si se agotaron los reintentos, registrar fallo final
    logger.error('Template send failed after all retries', {
      templateName,
      to,
      totalAttempts: attempt,
      errorKey,
    });

    return {
      success: false,
      error: 'Template send failed after all retries',
      finalAttempt: attempt,
    };
  }

  /**
   * Maneja errores 403 específicamente (problemas de pago)
   */
  async handle403Error(error, templateData, attempt, errorKey) {
    const { to, name: templateName } = templateData;

    logger.warn('403 error detected - payment issue', {
      templateName,
      to,
      attempt,
      errorKey,
      suggestion: 'Check 360Dialog account payment status',
    });

    // Para errores 403, intentar con plantilla de fallback si existe
    const fallbackTemplate = this.fallbackTemplates.get(templateName);
    if (fallbackTemplate && attempt === 1) {
      logger.info('Attempting fallback template', {
        originalTemplate: templateName,
        fallbackTemplate,
        to,
        errorKey,
      });

      const fallbackData = {
        ...templateData,
        name: fallbackTemplate,
      };

      // Intentar enviar con plantilla de fallback
      try {
        // Aquí se llamaría al servicio de envío de plantillas
        // Por ahora solo registramos el intento
        logger.info('Fallback template attempt logged', {
          fallbackTemplate,
          to,
          errorKey,
        });

        return {
          success: false,
          usedFallback: true,
          fallbackTemplate,
          error: '403 error - payment issue, fallback attempted',
        };
      } catch (fallbackError) {
        logger.error('Fallback template also failed', {
          fallbackTemplate,
          to,
          error: fallbackError.message,
          errorKey,
        });
      }
    }

    // Si no hay fallback o también falló, programar retry con delay más largo
    if (attempt < this.maxRetries) {
      const delay =
        this.retryDelay * Math.pow(this.backoffMultiplier, attempt) * 2; // Delay más largo para 403
      return this.scheduleRetry(templateData, attempt, errorKey, delay);
    }

    return {
      success: false,
      error: '403 - Payment issue, check 360Dialog account',
      statusCode: 403,
    };
  }

  /**
   * Maneja errores de plantilla no encontrada o inválida
   */
  async handleTemplateNotFoundError(error, templateData, attempt, errorKey) {
    const { to, name: templateName } = templateData;

    logger.error('Template not found or invalid', {
      templateName,
      to,
      attempt,
      statusCode: error.response?.status,
      errorKey,
      suggestion: 'Check template name and approval status',
    });

    // Para errores 400/404, no reintentar, pero intentar fallback
    const fallbackTemplate = this.fallbackTemplates.get(templateName);
    if (fallbackTemplate) {
      logger.info('Attempting fallback for invalid template', {
        originalTemplate: templateName,
        fallbackTemplate,
        to,
        errorKey,
      });

      return {
        success: false,
        usedFallback: true,
        fallbackTemplate,
        error: 'Original template invalid, fallback attempted',
      };
    }

    return {
      success: false,
      error: 'Template not found or invalid, no fallback available',
      statusCode: error.response?.status,
    };
  }

  /**
   * Programa un reintento con delay exponencial
   */
  async scheduleRetry(templateData, attempt, errorKey, customDelay = null) {
    const delay =
      customDelay ||
      this.retryDelay * Math.pow(this.backoffMultiplier, attempt - 1);

    logger.info('Scheduling template retry', {
      templateName: templateData.name,
      to: templateData.to,
      attempt: attempt + 1,
      delay,
      errorKey,
    });

    // En una implementación real, aquí se programaría el reintento
    // Por ahora solo registramos la intención
    setTimeout(() => {
      logger.debug('Retry scheduled execution', {
        templateName: templateData.name,
        to: templateData.to,
        attempt: attempt + 1,
        errorKey,
      });
    }, delay);

    return {
      success: false,
      retryScheduled: true,
      nextAttempt: attempt + 1,
      delay,
    };
  }

  /**
   * Configura plantillas de fallback
   */
  setFallbackTemplate(originalTemplate, fallbackTemplate) {
    this.fallbackTemplates.set(originalTemplate, fallbackTemplate);
    logger.info('Fallback template configured', {
      originalTemplate,
      fallbackTemplate,
    });
  }

  /**
   * Obtiene estadísticas de errores
   */
  getErrorStats() {
    return {
      activeRetries: this.retryAttempts.size,
      configuredFallbacks: this.fallbackTemplates.size,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
    };
  }

  /**
   * Limpia intentos antiguos
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    for (const [key, data] of this.retryAttempts.entries()) {
      if (now - data.timestamp > maxAge) {
        this.retryAttempts.delete(key);
      }
    }

    logger.debug('Template error handler cleanup completed', {
      remainingRetries: this.retryAttempts.size,
    });
  }
}

export default TemplateErrorHandler;

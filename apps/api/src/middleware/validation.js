import Joi from 'joi';
import { validationResult } from 'express-validator';

/**
 * Middleware de validación genérico
 */
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    // Reemplazar los datos originales con los datos validados y limpiados
    req[property] = value;
    next();
  };
};

/**
 * Middleware para validar parámetros de consulta
 */
export const validateQuery = schema => validate(schema, 'query');

/**
 * Middleware para validar parámetros de ruta
 */
export const validateParams = schema => validate(schema, 'params');

/**
 * Middleware para validar headers
 */
export const validateHeaders = schema => validate(schema, 'headers');

/**
 * Esquemas de validación comunes
 */
export const commonSchemas = {
  // Validación de ID
  id: Joi.object({
    id: Joi.string().required().min(1).max(100),
  }),

  // Validación de paginación
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().default('createdAt'),
  }),

  // Validación de fechas
  dateRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
  }),

  // Validación de filtros
  filters: Joi.object({
    status: Joi.string(),
    category: Joi.string(),
    search: Joi.string().max(255),
  }),
};

/**
 * Middleware para sanitizar entrada
 */
export const sanitize = (req, res, next) => {
  // Función para limpiar strings
  const cleanString = str => {
    if (typeof str !== 'string') return str;
    return str.trim().replace(/[<>]/g, '');
  };

  // Función recursiva para limpiar objetos
  const cleanObject = obj => {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      return cleanString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(cleanObject);
    }

    if (typeof obj === 'object') {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        cleaned[key] = cleanObject(value);
      }
      return cleaned;
    }

    return obj;
  };

  // Limpiar body, query y params
  if (req.body) req.body = cleanObject(req.body);
  if (req.query) req.query = cleanObject(req.query);
  if (req.params) req.params = cleanObject(req.params);

  next();
};

/**
 * Middleware para validar tipos de contenido
 */
export const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    const contentType = req.get('Content-Type');

    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }

    if (
      !contentType ||
      !allowedTypes.some(type => contentType.includes(type))
    ) {
      return res.status(415).json({
        error: 'Tipo de contenido no soportado',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        allowed: allowedTypes,
        received: contentType,
      });
    }

    next();
  };
};

/**
 * Alias para validate con body por defecto (para compatibilidad)
 */
export const validateSchema = schema => validate(schema, 'body');

/**
 * Middleware para validar request usando express-validator
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array(),
    });
  }
  next();
};

export default {
  validate,
  validateQuery,
  validateParams,
  validateHeaders,
  validateSchema,
  validateRequest,
  commonSchemas,
  sanitize,
  validateContentType,
};

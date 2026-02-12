/**
 * @fileoverview Middleware de Validación Centralizado
 * 
 * Proporciona validadores reutilizables para todas las rutas de API
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import { body, param, query, validationResult } from 'express-validator';
import { createLogger } from '../services/core/core/logger.js';

const logger = createLogger('VALIDATION_MIDDLEWARE');

/**
 * Middleware para manejar errores de validación
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Validación fallida: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validadores para Contactos
 */
export const validateContact = {
  create: [
    body('phone_number')
      .notEmpty().withMessage('Número de teléfono es requerido')
      .isLength({ min: 10 }).withMessage('Número de teléfono debe tener al menos 10 dígitos')
      .matches(/^[0-9+\-\s()]+$/).withMessage('Número de teléfono inválido'),
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Nombre debe tener entre 2 y 100 caracteres'),
    body('email')
      .optional()
      .isEmail().withMessage('Email inválido'),
    body('tags')
      .optional()
      .isArray().withMessage('Tags debe ser un array'),
    handleValidationErrors
  ],
  
  update: [
    param('id')
      .isInt().withMessage('ID debe ser un número entero'),
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Nombre debe tener entre 2 y 100 caracteres'),
    body('email')
      .optional()
      .isEmail().withMessage('Email inválido'),
    body('tags')
      .optional()
      .isArray().withMessage('Tags debe ser un array'),
    handleValidationErrors
  ]
};

/**
 * Validadores para Plantillas
 */
export const validateTemplate = {
  create: [
    body('name')
      .notEmpty().withMessage('Nombre es requerido')
      .isLength({ min: 3, max: 100 }).withMessage('Nombre debe tener entre 3 y 100 caracteres'),
    body('body_text')
      .notEmpty().withMessage('Cuerpo de texto es requerido')
      .isLength({ min: 10, max: 4096 }).withMessage('Cuerpo debe tener entre 10 y 4096 caracteres'),
    body('category')
      .optional()
      .isLength({ min: 2, max: 50 }).withMessage('Categoría inválida'),
    body('language')
      .optional()
      .isLength({ min: 2, max: 10 }).withMessage('Idioma inválido'),
    body('buttons')
      .optional()
      .isArray().withMessage('Botones debe ser un array'),
    body('variables')
      .optional()
      .isArray().withMessage('Variables debe ser un array'),
    handleValidationErrors
  ],
  
  update: [
    param('id')
      .isInt().withMessage('ID debe ser un número entero'),
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 }).withMessage('Nombre debe tener entre 3 y 100 caracteres'),
    body('body_text')
      .optional()
      .isLength({ min: 10, max: 4096 }).withMessage('Cuerpo debe tener entre 10 y 4096 caracteres'),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'archived']).withMessage('Status inválido'),
    handleValidationErrors
  ]
};

/**
 * Validadores para Campañas
 */
export const validateCampaign = {
  create: [
    body('name')
      .notEmpty().withMessage('Nombre es requerido')
      .isLength({ min: 3, max: 100 }).withMessage('Nombre debe tener entre 3 y 100 caracteres'),
    body('template_id')
      .notEmpty().withMessage('Template ID es requerido')
      .isInt().withMessage('Template ID debe ser un número entero'),
    body('target_segments')
      .optional()
      .isArray().withMessage('Segmentos debe ser un array'),
    body('scheduled_at')
      .optional()
      .isISO8601().withMessage('Fecha de programación inválida'),
    handleValidationErrors
  ],
  
  update: [
    param('id')
      .isInt().withMessage('ID debe ser un número entero'),
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 }).withMessage('Nombre debe tener entre 3 y 100 caracteres'),
    body('status')
      .optional()
      .isIn(['draft', 'scheduled', 'sent', 'failed']).withMessage('Status inválido'),
    handleValidationErrors
  ]
};

/**
 * Validadores para Mensajes
 */
export const validateMessage = {
  create: [
    body('conversation_id')
      .notEmpty().withMessage('Conversation ID es requerido')
      .isInt().withMessage('Conversation ID debe ser un número entero'),
    body('content')
      .notEmpty().withMessage('Contenido es requerido')
      .isLength({ min: 1, max: 4096 }).withMessage('Contenido debe tener entre 1 y 4096 caracteres'),
    body('type')
      .optional()
      .isIn(['text', 'image', 'document', 'audio', 'video']).withMessage('Tipo de mensaje inválido'),
    handleValidationErrors
  ]
};

/**
 * Validadores para Paginación
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página debe ser mayor a 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  handleValidationErrors
];

/**
 * Validadores para ID
 */
export const validateId = [
  param('id')
    .isInt().withMessage('ID debe ser un número entero'),
  handleValidationErrors
];

export default {
  validateContact,
  validateTemplate,
  validateCampaign,
  validateMessage,
  validatePagination,
  validateId,
  handleValidationErrors
};

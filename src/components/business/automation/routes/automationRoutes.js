/**
 * Rutas de Automatización
 * 
 * Define todas las rutas HTTP para la gestión de reglas de automatización,
 * incluyendo middleware de validación, autenticación y limitación de velocidad.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import express from 'express';
import { getAutomationController } from '../controllers/AutomationController.js';
import { 
  authMiddleware, 
  validateData, 
  errorHandler, 
  rateLimitMiddleware,
  cacheMiddleware,
  validateParams,
  timeoutMiddleware
} from '../../../../services/core/core/middleware.js';
import { createLogger } from '../../../../services/core/core/logger.js';

const router = express.Router();
const controller = getAutomationController();
const logger = createLogger('AUTOMATION_ROUTES');

// Aplicar middleware global
const automationRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: 'Demasiadas peticiones de automatización'
});

const processRateLimit = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máximo 10 procesamientos por hora
  message: 'Límite de procesamiento automático alcanzado'
});

// Esquemas de validación
const ruleValidationSchema = {
  name: { type: 'string', required: true, minLength: 3, maxLength: 100 },
  description: { type: 'string', required: false, maxLength: 500 },
  isActive: { type: 'boolean', required: false },
  priority: { type: 'number', required: false, min: 1, max: 10 },
  conditions: { 
    type: 'array', 
    required: true, 
    minItems: 1,
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', required: true },
        operator: { type: 'string', required: true },
        value: { required: true }
      }
    }
  },
  actions: { 
    type: 'array', 
    required: true, 
    minItems: 1,
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', required: true },
        parameters: { type: 'object', required: false }
      }
    }
  },
  tags: { type: 'array', required: false },
  category: { type: 'string', required: false },
  triggerType: { 
    type: 'string', 
    required: false, 
    enum: ['immediate', 'scheduled', 'manual'] 
  }
};

const updateRuleValidationSchema = {
  name: { type: 'string', required: false, minLength: 3, maxLength: 100 },
  description: { type: 'string', required: false, maxLength: 500 },
  isActive: { type: 'boolean', required: false },
  priority: { type: 'number', required: false, min: 1, max: 10 },
  conditions: { 
    type: 'array', 
    required: false, 
    minItems: 1,
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', required: true },
        operator: { type: 'string', required: true },
        value: { required: true }
      }
    }
  },
  actions: { 
    type: 'array', 
    required: false, 
    minItems: 1,
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', required: true },
        parameters: { type: 'object', required: false }
      }
    }
  },
  tags: { type: 'array', required: false },
  category: { type: 'string', required: false },
  triggerType: { 
    type: 'string', 
    required: false, 
    enum: ['immediate', 'scheduled', 'manual'] 
  }
};

const toggleStatusValidationSchema = {
  isActive: { type: 'boolean', required: true }
};

const evaluateValidationSchema = {
  context: { type: 'object', required: false }
};

const processValidationSchema = {
  contactLimit: { type: 'number', required: false, min: 1, max: 1000 },
  ruleTypes: { 
    type: 'array', 
    required: false,
    items: { 
      type: 'string', 
      enum: ['immediate', 'scheduled', 'manual'] 
    }
  },
  skipRecentlyProcessed: { type: 'boolean', required: false }
};

// Aplicar middleware global
router.use(automationRateLimit);
router.use(authMiddleware);
router.use(timeoutMiddleware(30000)); // 30 segundos timeout

/**
 * @route GET /api/automation/rules
 * @desc Obtener todas las reglas con filtros y paginación
 * @access Private
 */
router.get('/rules', 
  cacheMiddleware(300), // Cache por 5 minutos
  async(req, res, next) => {
    try {
      await controller.getAllRules(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/automation/rules/:id
 * @desc Obtener regla por ID
 * @access Private
 */
router.get('/rules/:id',
  validateParams({ id: { type: 'string', required: true } }),
  cacheMiddleware(300), // Cache por 5 minutos
  async(req, res, next) => {
    try {
      await controller.getRuleById(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/automation/rules
 * @desc Crear nueva regla
 * @access Private
 */
router.post('/rules',
  validateData(ruleValidationSchema),
  async(req, res, next) => {
    try {
      await controller.createRule(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /api/automation/rules/:id
 * @desc Actualizar regla existente
 * @access Private
 */
router.put('/rules/:id',
  validateParams({ id: { type: 'string', required: true } }),
  validateData(updateRuleValidationSchema),
  async(req, res, next) => {
    try {
      await controller.updateRule(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /api/automation/rules/:id
 * @desc Eliminar regla
 * @access Private
 */
router.delete('/rules/:id',
  validateParams({ id: { type: 'string', required: true } }),
  async(req, res, next) => {
    try {
      await controller.deleteRule(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PATCH /api/automation/rules/:id/toggle
 * @desc Activar o desactivar regla
 * @access Private
 */
router.patch('/rules/:id/toggle',
  validateParams({ id: { type: 'string', required: true } }),
  validateData(toggleStatusValidationSchema),
  async(req, res, next) => {
    try {
      await controller.toggleRuleStatus(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/automation/evaluate/:contactId
 * @desc Evaluar reglas para un contacto específico
 * @access Private
 */
router.post('/evaluate/:contactId',
  validateParams({ contactId: { type: 'string', required: true } }),
  validateData(evaluateValidationSchema),
  async(req, res, next) => {
    try {
      await controller.evaluateRulesForContact(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/automation/process
 * @desc Procesar todas las reglas automáticas
 * @access Private
 */
router.post('/process',
  processRateLimit,
  validateData(processValidationSchema),
  timeoutMiddleware(120000), // 2 minutos timeout para procesamiento
  async(req, res, next) => {
    try {
      await controller.processAutomaticRules(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/automation/stats
 * @desc Obtener estadísticas de reglas
 * @access Private
 */
router.get('/stats', 
  cacheMiddleware(600), // Cache por 10 minutos
  async(req, res, next) => {
    try {
      await controller.getRuleStats(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/automation/categories
 * @desc Obtener categorías disponibles
 * @access Private
 */
router.get('/categories', 
  cacheMiddleware(3600), // Cache por 1 hora
  async(req, res, next) => {
    try {
      await controller.getCategories(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/automation/condition-types
 * @desc Obtener tipos de condiciones disponibles
 * @access Private
 */
router.get('/condition-types',
  cacheMiddleware(3600), // Cache por 1 hora
  async(req, res, next) => {
    try {
      await controller.getConditionTypes(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/automation/action-types
 * @desc Obtener tipos de acciones disponibles
 * @access Private
 */
router.get('/action-types',
  cacheMiddleware(3600), // Cache por 1 hora
  async(req, res, next) => {
    try {
      await controller.getActionTypes(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/automation/validate
 * @desc Validar regla antes de guardar
 * @access Private
 */
router.post('/validate',
  validateData(ruleValidationSchema),
  async(req, res, next) => {
    try {
      await controller.validateRule(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// Middleware de manejo de errores específico para automatización
router.use((error, req, res, next) => {
  logger.error('Error en rutas de automatización', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  errorHandler(error, req, res, next);
});

export default router;
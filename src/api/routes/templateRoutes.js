import express from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import SecurityManager from '../../services/core/core/auth/SecurityManager.js';
import { createLogger } from '../../services/core/core/logger.js';
import { 
  sanitizeTemplateData, 
  sanitizeSearchParams, 
  detectAttacks, 
  logSanitization 
} from '../middleware/inputSanitizationMiddleware.js';

const router = express.Router();
const logger = createLogger('TEMPLATE_ROUTES');

// Rate limiting para templates
const templateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 50, // máximo 50 requests por 5 minutos
  message: {
    error: 'Demasiadas operaciones con templates',
    code: 'TOO_MANY_TEMPLATE_REQUESTS',
    retryAfter: '5 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar autenticación, rate limiting y sanitización a todas las rutas
router.use(SecurityManager.authenticateToken);
router.use(templateRateLimit);
router.use(detectAttacks);
router.use(logSanitization);

// Esquemas de validación
const createTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  content: Joi.string().min(1).max(4096).required(),
  category: Joi.string().valid('greeting', 'follow_up', 'promotion', 'support', 'notification', 'custom').default('custom'),
  variables: Joi.array().items(Joi.string().min(1).max(50)).optional(),
  is_active: Joi.boolean().default(true),
  description: Joi.string().max(500).optional(),
  tags: Joi.array().items(Joi.string().min(1).max(30)).optional()
});

const updateTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  content: Joi.string().min(1).max(4096).optional(),
  category: Joi.string().valid('greeting', 'follow_up', 'promotion', 'support', 'notification', 'custom').optional(),
  variables: Joi.array().items(Joi.string().min(1).max(50)).optional(),
  is_active: Joi.boolean().optional(),
  description: Joi.string().max(500).optional(),
  tags: Joi.array().items(Joi.string().min(1).max(30)).optional()
});

const searchTemplatesSchema = Joi.object({
  search: Joi.string().min(1).max(100).optional(),
  category: Joi.string().valid('greeting', 'follow_up', 'promotion', 'support', 'notification', 'custom').optional(),
  is_active: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string().min(1).max(30)).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort_by: Joi.string().valid('name', 'category', 'created_at', 'updated_at', 'usage_count').default('created_at'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc')
});

const previewTemplateSchema = Joi.object({
  template_id: Joi.number().integer().positive().required(),
  variables: Joi.object().pattern(Joi.string(), Joi.string()).optional()
});

// Middleware de validación
const validate = (schema) => {
  return (req, res, next) => {
    const dataToValidate = req.method === 'GET' ? req.query : req.body;
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    req.validatedData = value;
    next();
  };
};

// Función para procesar variables en templates
const processTemplate = (content, variables = {}) => {
  let processedContent = content;
    
  // Reemplazar variables en formato {{variable}}
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    processedContent = processedContent.replace(regex, variables[key] || '');
  });
    
  return processedContent;
};

// Función para extraer variables de un template
const extractVariables = (content) => {
  const variableRegex = /{{(\s*\w+\s*)}}/g;
  const variables = [];
  let match;
    
  while ((match = variableRegex.exec(content)) !== null) {
    const variable = match[1].trim();
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }
    
  return variables;
};

// POST /api/templates - Crear nuevo template
router.post('/', sanitizeTemplateData, validate(createTemplateSchema), async(req, res) => {
  try {
    const { name, content, category, variables, is_active, description, tags } = req.validatedData;
    const db = req.database.getManager();

    // Verificar que no existe un template con el mismo nombre para este usuario
    const existingTemplate = await db.get(`
            SELECT id FROM templates 
            WHERE name = ? AND user_id = ?
        `, [name, req.user.id]);

    if (existingTemplate) {
      return res.status(409).json({
        error: 'Ya existe un template con este nombre',
        code: 'TEMPLATE_NAME_EXISTS'
      });
    }

    // Extraer variables automáticamente del contenido
    const extractedVariables = extractVariables(content);
    const finalVariables = variables || extractedVariables;

    // Crear template
    const result = await db.run(`
            INSERT INTO templates (
                user_id, name, content, category, variables, is_active, 
                description, tags, usage_count, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
      req.user.id,
      name,
      content,
      category,
      JSON.stringify(finalVariables),
      is_active ? 1 : 0,
      description || null,
      JSON.stringify(tags || [])
    ]);

    // Obtener el template creado
    const newTemplate = await db.get(`
            SELECT * FROM templates WHERE id = ?
        `, [result.lastID]);

    SecurityManager.logSecurityEvent('template_created', {
      template_id: result.lastID,
      user_id: req.user.id,
      name,
      category
    }, req);

    res.status(201).json({
      message: 'Template creado exitosamente',
      template: {
        id: newTemplate.id,
        name: newTemplate.name,
        content: newTemplate.content,
        category: newTemplate.category,
        variables: JSON.parse(newTemplate.variables || '[]'),
        is_active: newTemplate.is_active === 1,
        description: newTemplate.description,
        tags: JSON.parse(newTemplate.tags || '[]'),
        usage_count: newTemplate.usage_count,
        created_at: newTemplate.created_at,
        updated_at: newTemplate.updated_at
      }
    });

  } catch (error) {
    logger.error('Error creando template:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/templates - Obtener templates con filtros y paginación
router.get('/', sanitizeSearchParams, validate(searchTemplatesSchema), async(req, res) => {
  try {
    const {
      search,
      category,
      is_active,
      tags,
      page,
      limit,
      sort_by,
      sort_order
    } = req.validatedData;

    const db = req.database.getManager();
    const offset = (page - 1) * limit;

    // Construir query dinámicamente
    const whereConditions = ['user_id = ?'];
    const queryParams = [req.user.id];

    if (search) {
      whereConditions.push('(name LIKE ? OR content LIKE ? OR description LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      whereConditions.push('category = ?');
      queryParams.push(category);
    }

    if (is_active !== undefined) {
      whereConditions.push('is_active = ?');
      queryParams.push(is_active ? 1 : 0);
    }

    if (tags && tags.length > 0) {
      // Buscar templates que contengan al menos uno de los tags
      const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
      whereConditions.push(`(${tagConditions})`);
      tags.forEach(tag => queryParams.push(`%"${tag}"%`));
    }

    const whereClause = whereConditions.join(' AND ');

    // Query para contar total
    const countQuery = `
            SELECT COUNT(*) as total
            FROM templates
            WHERE ${whereClause}
        `;

    const countResult = await db.get(countQuery, queryParams);
    const total = countResult.total;

    // Query principal
    const query = `
            SELECT *
            FROM templates
            WHERE ${whereClause}
            ORDER BY ${sort_by} ${sort_order.toUpperCase()}
            LIMIT ? OFFSET ?
        `;

    queryParams.push(limit, offset);
    const templates = await db.all(query, queryParams);

    // Formatear respuesta
    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      content: template.content,
      category: template.category,
      variables: JSON.parse(template.variables || '[]'),
      is_active: template.is_active === 1,
      description: template.description,
      tags: JSON.parse(template.tags || '[]'),
      usage_count: template.usage_count,
      created_at: template.created_at,
      updated_at: template.updated_at
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      templates: formattedTemplates,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_items: total,
        items_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      filters: {
        search,
        category,
        is_active,
        tags
      }
    });

  } catch (error) {
    logger.error('Error obteniendo templates:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/templates/:id - Obtener template específico
router.get('/:id', async(req, res) => {
  try {
    const templateId = parseInt(req.params.id);
        
    if (isNaN(templateId)) {
      return res.status(400).json({
        error: 'ID de template inválido',
        code: 'INVALID_TEMPLATE_ID'
      });
    }

    const db = req.database.getManager();

    const template = await db.get(`
            SELECT * FROM templates 
            WHERE id = ? AND user_id = ?
        `, [templateId, req.user.id]);

    if (!template) {
      return res.status(404).json({
        error: 'Template no encontrado',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    res.json({
      template: {
        id: template.id,
        name: template.name,
        content: template.content,
        category: template.category,
        variables: JSON.parse(template.variables || '[]'),
        is_active: template.is_active === 1,
        description: template.description,
        tags: JSON.parse(template.tags || '[]'),
        usage_count: template.usage_count,
        created_at: template.created_at,
        updated_at: template.updated_at
      }
    });

  } catch (error) {
    logger.error('Error obteniendo template:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// PUT /api/templates/:id - Actualizar template
router.put('/:id', sanitizeTemplateData, validate(updateTemplateSchema), async(req, res) => {
  try {
    const templateId = parseInt(req.params.id);
        
    if (isNaN(templateId)) {
      return res.status(400).json({
        error: 'ID de template inválido',
        code: 'INVALID_TEMPLATE_ID'
      });
    }

    const db = req.database.getManager();

    // Verificar que el template existe y pertenece al usuario
    const existingTemplate = await db.get(`
            SELECT * FROM templates 
            WHERE id = ? AND user_id = ?
        `, [templateId, req.user.id]);

    if (!existingTemplate) {
      return res.status(404).json({
        error: 'Template no encontrado',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    const { name, content, category, variables, is_active, description, tags } = req.validatedData;

    // Si se cambia el nombre, verificar que no existe otro template con ese nombre
    if (name && name !== existingTemplate.name) {
      const nameExists = await db.get(`
                SELECT id FROM templates 
                WHERE name = ? AND user_id = ? AND id != ?
            `, [name, req.user.id, templateId]);

      if (nameExists) {
        return res.status(409).json({
          error: 'Ya existe un template con este nombre',
          code: 'TEMPLATE_NAME_EXISTS'
        });
      }
    }

    // Construir query de actualización dinámicamente
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
            
      // Actualizar variables automáticamente si se cambia el contenido
      const extractedVariables = extractVariables(content);
      updates.push('variables = ?');
      params.push(JSON.stringify(variables || extractedVariables));
    } else if (variables !== undefined) {
      updates.push('variables = ?');
      params.push(JSON.stringify(variables));
    }

    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No hay campos para actualizar',
        code: 'NO_FIELDS_TO_UPDATE'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(templateId);

    const updateQuery = `
            UPDATE templates 
            SET ${updates.join(', ')}
            WHERE id = ?
        `;

    await db.run(updateQuery, params);

    // Obtener template actualizado
    const updatedTemplate = await db.get(`
            SELECT * FROM templates WHERE id = ?
        `, [templateId]);

    SecurityManager.logSecurityEvent('template_updated', {
      template_id: templateId,
      user_id: req.user.id,
      updated_fields: Object.keys(req.validatedData)
    }, req);

    res.json({
      message: 'Template actualizado exitosamente',
      template: {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        content: updatedTemplate.content,
        category: updatedTemplate.category,
        variables: JSON.parse(updatedTemplate.variables || '[]'),
        is_active: updatedTemplate.is_active === 1,
        description: updatedTemplate.description,
        tags: JSON.parse(updatedTemplate.tags || '[]'),
        usage_count: updatedTemplate.usage_count,
        created_at: updatedTemplate.created_at,
        updated_at: updatedTemplate.updated_at
      }
    });

  } catch (error) {
    logger.error('Error actualizando template:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// DELETE /api/templates/:id - Eliminar template
router.delete('/:id', async(req, res) => {
  try {
    const templateId = parseInt(req.params.id);
        
    if (isNaN(templateId)) {
      return res.status(400).json({
        error: 'ID de template inválido',
        code: 'INVALID_TEMPLATE_ID'
      });
    }

    const db = req.database.getManager();

    // Verificar que el template existe y pertenece al usuario
    const existingTemplate = await db.get(`
            SELECT id, name FROM templates 
            WHERE id = ? AND user_id = ?
        `, [templateId, req.user.id]);

    if (!existingTemplate) {
      return res.status(404).json({
        error: 'Template no encontrado',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    // Eliminar template
    await db.run(`
            DELETE FROM templates WHERE id = ?
        `, [templateId]);

    SecurityManager.logSecurityEvent('template_deleted', {
      template_id: templateId,
      template_name: existingTemplate.name,
      user_id: req.user.id
    }, req);

    res.json({
      message: 'Template eliminado exitosamente'
    });

  } catch (error) {
    logger.error('Error eliminando template:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// POST /api/templates/preview - Vista previa de template con variables
router.post('/preview', sanitizeTemplateData, validate(previewTemplateSchema), async(req, res) => {
  try {
    const { template_id, variables } = req.validatedData;
    const db = req.database.getManager();

    // Obtener template
    const template = await db.get(`
            SELECT * FROM templates 
            WHERE id = ? AND user_id = ?
        `, [template_id, req.user.id]);

    if (!template) {
      return res.status(404).json({
        error: 'Template no encontrado',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    // Procesar template con variables
    const processedContent = processTemplate(template.content, variables || {});
    const templateVariables = JSON.parse(template.variables || '[]');

    // Identificar variables faltantes
    const missingVariables = templateVariables.filter(variable => 
      !variables || !variables.hasOwnProperty(variable)
    );

    res.json({
      template: {
        id: template.id,
        name: template.name,
        original_content: template.content,
        processed_content: processedContent,
        variables: templateVariables,
        provided_variables: variables || {},
        missing_variables: missingVariables
      }
    });

  } catch (error) {
    logger.error('Error generando vista previa:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// POST /api/templates/:id/duplicate - Duplicar template
router.post('/:id/duplicate', async(req, res) => {
  try {
    const templateId = parseInt(req.params.id);
        
    if (isNaN(templateId)) {
      return res.status(400).json({
        error: 'ID de template inválido',
        code: 'INVALID_TEMPLATE_ID'
      });
    }

    const db = req.database.getManager();

    // Obtener template original
    const originalTemplate = await db.get(`
            SELECT * FROM templates 
            WHERE id = ? AND user_id = ?
        `, [templateId, req.user.id]);

    if (!originalTemplate) {
      return res.status(404).json({
        error: 'Template no encontrado',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    // Generar nombre único para la copia
    let copyName = `${originalTemplate.name} (Copia)`;
    let counter = 1;
        
    while (true) {
      const existingCopy = await db.get(`
                SELECT id FROM templates 
                WHERE name = ? AND user_id = ?
            `, [copyName, req.user.id]);
            
      if (!existingCopy) break;
            
      counter++;
      copyName = `${originalTemplate.name} (Copia ${counter})`;
    }

    // Crear copia del template
    const result = await db.run(`
            INSERT INTO templates (
                user_id, name, content, category, variables, is_active, 
                description, tags, usage_count, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
      req.user.id,
      copyName,
      originalTemplate.content,
      originalTemplate.category,
      originalTemplate.variables,
      originalTemplate.is_active,
      originalTemplate.description,
      originalTemplate.tags
    ]);

    // Obtener template duplicado
    const duplicatedTemplate = await db.get(`
            SELECT * FROM templates WHERE id = ?
        `, [result.lastID]);

    SecurityManager.logSecurityEvent('template_duplicated', {
      original_template_id: templateId,
      new_template_id: result.lastID,
      user_id: req.user.id
    }, req);

    res.status(201).json({
      message: 'Template duplicado exitosamente',
      template: {
        id: duplicatedTemplate.id,
        name: duplicatedTemplate.name,
        content: duplicatedTemplate.content,
        category: duplicatedTemplate.category,
        variables: JSON.parse(duplicatedTemplate.variables || '[]'),
        is_active: duplicatedTemplate.is_active === 1,
        description: duplicatedTemplate.description,
        tags: JSON.parse(duplicatedTemplate.tags || '[]'),
        usage_count: duplicatedTemplate.usage_count,
        created_at: duplicatedTemplate.created_at,
        updated_at: duplicatedTemplate.updated_at
      }
    });

  } catch (error) {
    logger.error('Error duplicando template:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/templates/categories/stats - Estadísticas por categoría
router.get('/categories/stats', async(req, res) => {
  try {
    const db = req.database.getManager();

    const stats = await db.all(`
            SELECT 
                category,
                COUNT(*) as total_templates,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_templates,
                SUM(usage_count) as total_usage
            FROM templates 
            WHERE user_id = ?
            GROUP BY category
            ORDER BY total_templates DESC
        `, [req.user.id]);

    res.json({
      category_stats: stats.map(stat => ({
        category: stat.category,
        total_templates: stat.total_templates,
        active_templates: stat.active_templates,
        inactive_templates: stat.total_templates - stat.active_templates,
        total_usage: stat.total_usage || 0
      }))
    });

  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

export default router;
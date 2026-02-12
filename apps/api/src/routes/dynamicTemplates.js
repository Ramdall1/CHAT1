import express from 'express';
import dynamicTemplateService from '../services/DynamicTemplateService.js';
import { log } from '../core/logger.js';
import {
  validateTemplateName,
  validateTemplateCategory,
  validateTemplateComponent,
  validateTemplateVariables,
  TEMPLATE_LIMITS,
  TEMPLATE_CATEGORIES,
  COMPONENT_TYPES,
} from '../utils/templateValidation.js';

const router = express.Router();

/**
 * @route GET /api/dynamic-templates
 * @desc Obtener todas las plantillas dinámicas
 */
router.get('/', async (req, res) => {
  try {
    const { category, active } = req.query;
    const filters = {};

    if (category) filters.category = category;
    if (active !== undefined) filters.active = active === 'true';

    const templates = await dynamicTemplateService.listTemplates(filters);

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    log('Error getting dynamic templates:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/dynamic-templates/:id
 * @desc Obtener una plantilla específica
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await dynamicTemplateService.getTemplate(id);

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    log('Error getting dynamic template:', error);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/dynamic-templates
 * @desc Crear una nueva plantilla dinámica
 */
router.post('/', async (req, res) => {
  try {
    const templateData = req.body;

    // Validar nombre de plantilla
    if (templateData.name) {
      const nameValidation = validateTemplateName(templateData.name);
      if (!nameValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: `Nombre de plantilla inválido: ${nameValidation.error}`,
        });
      }
    }

    // Validar categoría de plantilla
    if (templateData.category) {
      const categoryValidation = validateTemplateCategory(
        templateData.category
      );
      if (!categoryValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: `Categoría de plantilla inválida: ${categoryValidation.error}`,
        });
      }
    }

    // Validar componentes de plantilla
    if (templateData.components && Array.isArray(templateData.components)) {
      for (const component of templateData.components) {
        const componentValidation = validateTemplateComponent(component);
        if (!componentValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: `Componente de plantilla inválido: ${componentValidation.error}`,
          });
        }
      }
    }

    const template = await dynamicTemplateService.createTemplate(templateData);

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully',
    });
  } catch (error) {
    log('Error creating dynamic template:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route PUT /api/dynamic-templates/:id
 * @desc Actualizar una plantilla existente
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await dynamicTemplateService.updateTemplate(id, updates);

    res.json({
      success: true,
      data: template,
      message: 'Template updated successfully',
    });
  } catch (error) {
    log('Error updating dynamic template:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route DELETE /api/dynamic-templates/:id
 * @desc Eliminar una plantilla
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dynamicTemplateService.deleteTemplate(id);

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    log('Error deleting dynamic template:', error);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/dynamic-templates/:id/compile
 * @desc Compilar una plantilla con variables
 */
router.post('/:id/compile', async (req, res) => {
  try {
    const { id } = req.params;
    const context = req.body.context || {};

    const compiled = await dynamicTemplateService.compileTemplate(id, context);

    res.json({
      success: true,
      data: compiled,
    });
  } catch (error) {
    log('Error compiling dynamic template:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/dynamic-templates/:id/preview
 * @desc Vista previa de una plantilla con variables de ejemplo
 */
router.post('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const customContext = req.body.context || {};

    // Crear contexto de ejemplo
    const exampleContext = {
      user: {
        name: 'Usuario Ejemplo',
        phone: '+1234567890',
        ...customContext.user,
      },
      conversation: {
        lastMessage: 'Hola, necesito información',
        messageCount: 5,
        startedAt: new Date().toISOString(),
        ...customContext.conversation,
      },
      product: {
        name: 'Producto Ejemplo',
        price: '$99.99',
        ...customContext.product,
      },
      ...customContext,
    };

    const compiled = await dynamicTemplateService.compileTemplate(
      id,
      exampleContext
    );

    res.json({
      success: true,
      data: {
        ...compiled,
        exampleContext,
      },
    });
  } catch (error) {
    log('Error previewing dynamic template:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/dynamic-templates/:id/variables
 * @desc Obtener todas las variables utilizadas en una plantilla
 */
router.get('/:id/variables', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await dynamicTemplateService.getTemplate(id);

    // Extraer variables del contenido
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const matches = [...template.content.matchAll(variablePattern)];
    const variables = [...new Set(matches.map(match => match[1].trim()))];

    res.json({
      success: true,
      data: {
        templateId: id,
        variables,
        definedVariables: template.variables || [],
        count: variables.length,
      },
    });
  } catch (error) {
    log('Error getting template variables:', error);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/dynamic-templates/validate
 * @desc Validar estructura de plantilla
 */
router.post('/validate', async (req, res) => {
  try {
    const { template } = req.body;
    const validationResults = [];

    // Validar nombre
    if (template.name) {
      const nameValidation = validateTemplateName(template.name);
      validationResults.push({
        field: 'name',
        isValid: nameValidation.isValid,
        error: nameValidation.error,
      });
    }

    // Validar categoría
    if (template.category) {
      const categoryValidation = validateTemplateCategory(template.category);
      validationResults.push({
        field: 'category',
        isValid: categoryValidation.isValid,
        error: categoryValidation.error,
      });
    }

    // Validar componentes
    if (template.components && Array.isArray(template.components)) {
      template.components.forEach((component, index) => {
        const componentValidation = validateTemplateComponent(component);
        validationResults.push({
          field: `component_${index}`,
          isValid: componentValidation.isValid,
          error: componentValidation.error,
        });
      });
    }

    // Validar variables si existen
    if (template.variables && Array.isArray(template.variables)) {
      const variablesValidation = validateTemplateVariables(template.variables);
      validationResults.push({
        field: 'variables',
        isValid: variablesValidation.isValid,
        error: variablesValidation.error,
      });
    }

    const isValid = validationResults.every(result => result.isValid);

    res.json({
      success: true,
      data: {
        isValid,
        validationResults,
        limits: TEMPLATE_LIMITS,
        validCategories: TEMPLATE_CATEGORIES,
        validComponentTypes: COMPONENT_TYPES,
      },
    });
  } catch (error) {
    log('Error validating template:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/dynamic-templates/stats
 * @desc Obtener estadísticas de plantillas
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await dynamicTemplateService.getTemplateStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log('Error getting template stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/dynamic-templates/variables
 * @desc Guardar una variable personalizada
 */
router.post('/variables', async (req, res) => {
  try {
    const { name, value, metadata } = req.body;

    if (!name || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Name and value are required',
      });
    }

    const variable = await dynamicTemplateService.saveVariable(
      name,
      value,
      metadata
    );

    res.status(201).json({
      success: true,
      data: variable,
      message: 'Variable saved successfully',
    });
  } catch (error) {
    log('Error saving variable:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/dynamic-templates/variables/:name
 * @desc Obtener una variable guardada
 */
router.get('/variables/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const value = await dynamicTemplateService.getSavedVariable(name);

    if (value === null) {
      return res.status(404).json({
        success: false,
        error: 'Variable not found',
      });
    }

    res.json({
      success: true,
      data: {
        name,
        value,
      },
    });
  } catch (error) {
    log('Error getting variable:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/dynamic-templates/export
 * @desc Exportar plantillas
 */
router.post('/export', async (req, res) => {
  try {
    const { templateIds } = req.body;
    const exportData =
      await dynamicTemplateService.exportTemplates(templateIds);

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    log('Error exporting templates:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/dynamic-templates/import
 * @desc Importar plantillas
 */
router.post('/import', async (req, res) => {
  try {
    const importData = req.body;
    const { overwrite = false } = req.query;

    const result = await dynamicTemplateService.importTemplates(importData, {
      overwrite,
    });

    res.json({
      success: true,
      data: result,
      message: `Imported ${result.imported.length} templates`,
    });
  } catch (error) {
    log('Error importing templates:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route DELETE /api/dynamic-templates/cache
 * @desc Limpiar caché de plantillas compiladas
 */
router.delete('/cache', async (req, res) => {
  try {
    dynamicTemplateService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error) {
    log('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/dynamic-templates/categories
 * @desc Obtener todas las categorías de plantillas
 */
router.get('/categories/list', async (req, res) => {
  try {
    const templates = await dynamicTemplateService.listTemplates();
    const categories = [
      ...new Set(templates.map(t => t.category || 'general')),
    ];

    const categoriesWithCount = categories.map(category => ({
      name: category,
      count: templates.filter(t => (t.category || 'general') === category)
        .length,
    }));

    res.json({
      success: true,
      data: categoriesWithCount,
    });
  } catch (error) {
    log('Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/dynamic-templates/bulk-compile
 * @desc Compilar múltiples plantillas con el mismo contexto
 */
router.post('/bulk-compile', async (req, res) => {
  try {
    const { templateIds, context = {} } = req.body;

    if (!templateIds || !Array.isArray(templateIds)) {
      return res.status(400).json({
        success: false,
        error: 'templateIds array is required',
      });
    }

    const results = [];
    const errors = [];

    for (const templateId of templateIds) {
      try {
        const compiled = await dynamicTemplateService.compileTemplate(
          templateId,
          context
        );
        results.push(compiled);
      } catch (error) {
        errors.push({
          templateId,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        errors,
        compiled: results.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    log('Error bulk compiling templates:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

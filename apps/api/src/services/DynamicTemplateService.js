import fs from 'fs-extra';
import path from 'path';
import logger from '../../../../src/services/core/core/logger.js';

class DynamicTemplateService {
  constructor() {
    this.templatesDir = path.join(process.cwd(), 'data', 'dynamic_templates');
    this.variablesDir = path.join(process.cwd(), 'data', 'template_variables');
    this.compiledTemplatesCache = new Map();
    this.variableResolvers = new Map();

    this.initializeDirectories();
    this.setupDefaultResolvers();
  }

  async initializeDirectories() {
    try {
      await fs.ensureDir(this.templatesDir);
      await fs.ensureDir(this.variablesDir);
      logger.info('Dynamic template directories initialized');
    } catch (error) {
      logger.error('Error initializing template directories:', error);
    }
  }

  setupDefaultResolvers() {
    // Resolvers para variables del sistema
    this.variableResolvers.set('system.date', () =>
      new Date().toLocaleDateString('es-ES')
    );
    this.variableResolvers.set('system.time', () =>
      new Date().toLocaleTimeString('es-ES')
    );
    this.variableResolvers.set('system.datetime', () =>
      new Date().toLocaleString('es-ES')
    );
    this.variableResolvers.set('system.day', () =>
      new Date().toLocaleDateString('es-ES', { weekday: 'long' })
    );
    this.variableResolvers.set('system.month', () =>
      new Date().toLocaleDateString('es-ES', { month: 'long' })
    );
    this.variableResolvers.set('system.year', () =>
      new Date().getFullYear().toString()
    );

    // Resolvers para variables de usuario
    this.variableResolvers.set(
      'user.name',
      context => context.user?.name || 'Usuario'
    );
    this.variableResolvers.set(
      'user.phone',
      context => context.user?.phone || ''
    );
    this.variableResolvers.set('user.first_name', context => {
      const name = context.user?.name || '';
      return name.split(' ')[0] || 'Usuario';
    });
    this.variableResolvers.set('user.last_name', context => {
      const name = context.user?.name || '';
      const parts = name.split(' ');
      return parts.length > 1 ? parts[parts.length - 1] : '';
    });

    // Resolvers para variables de conversación
    this.variableResolvers.set(
      'conversation.last_message',
      context => context.conversation?.lastMessage || ''
    );
    this.variableResolvers.set(
      'conversation.message_count',
      context => context.conversation?.messageCount || 0
    );
    this.variableResolvers.set('conversation.started_at', context => {
      if (context.conversation?.startedAt) {
        return new Date(context.conversation.startedAt).toLocaleString('es-ES');
      }
      return '';
    });

    // Resolvers para variables de negocio
    this.variableResolvers.set(
      'business.name',
      () => process.env.BUSINESS_NAME || 'Nuestra Empresa'
    );
    this.variableResolvers.set(
      'business.phone',
      () => process.env.BUSINESS_PHONE || ''
    );
    this.variableResolvers.set(
      'business.email',
      () => process.env.BUSINESS_EMAIL || ''
    );
    this.variableResolvers.set(
      'business.website',
      () => process.env.BUSINESS_WEBSITE || ''
    );
    this.variableResolvers.set(
      'business.address',
      () => process.env.BUSINESS_ADDRESS || ''
    );

    // Resolvers para variables de productos
    this.variableResolvers.set('product.featured', async () => {
      // Aquí podrías conectar con tu base de datos de productos
      return 'Producto Destacado';
    });
    this.variableResolvers.set('product.discount', () => '20%');
    this.variableResolvers.set(
      'product.price',
      context => context.product?.price || '0'
    );
  }

  /**
   * Crear una nueva plantilla dinámica
   */
  async createTemplate(templateData) {
    try {
      const {
        name,
        category,
        content,
        variables,
        conditions,
        metadata = {},
      } = templateData;

      if (!name || !content) {
        throw new Error('Name and content are required');
      }

      const template = {
        id: this.generateTemplateId(),
        name,
        category: category || 'general',
        content,
        variables: variables || [],
        conditions: conditions || [],
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
        },
        active: true,
      };

      // Validar la plantilla
      await this.validateTemplate(template);

      // Guardar la plantilla
      const templatePath = path.join(this.templatesDir, `${template.id}.json`);
      await fs.writeJson(templatePath, template, { spaces: 2 });

      // Limpiar caché
      this.compiledTemplatesCache.delete(template.id);

      logger.info(`Dynamic template created: ${template.name} (${template.id})`);
      return template;
    } catch (error) {
      logger.error('Error creating dynamic template:', error);
      throw error;
    }
  }

  /**
   * Obtener una plantilla por ID
   */
  async getTemplate(templateId) {
    try {
      const templatePath = path.join(this.templatesDir, `${templateId}.json`);

      if (!(await fs.pathExists(templatePath))) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const template = await fs.readJson(templatePath);
      return template;
    } catch (error) {
      logger.error('Error getting template:', error);
      throw error;
    }
  }

  /**
   * Listar todas las plantillas
   */
  async listTemplates(filters = {}) {
    try {
      const files = await fs.readdir(this.templatesDir);
      const templates = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const templatePath = path.join(this.templatesDir, file);
          const template = await fs.readJson(templatePath);

          // Aplicar filtros
          if (filters.category && template.category !== filters.category)
            continue;
          if (
            filters.active !== undefined &&
            template.active !== filters.active
          )
            continue;

          templates.push(template);
        }
      }

      return templates.sort(
        (a, b) =>
          new Date(b.metadata.updatedAt) - new Date(a.metadata.updatedAt)
      );
    } catch (error) {
      logger.error('Error listing templates:', error);
      throw error;
    }
  }

  /**
   * Compilar una plantilla con variables
   */
  async compileTemplate(templateId, context = {}) {
    try {
      // Verificar caché
      const cacheKey = `${templateId}_${JSON.stringify(context)}`;
      if (this.compiledTemplatesCache.has(cacheKey)) {
        return this.compiledTemplatesCache.get(cacheKey);
      }

      const template = await this.getTemplate(templateId);

      if (!template.active) {
        throw new Error(`Template is not active: ${templateId}`);
      }

      // Evaluar condiciones
      if (!(await this.evaluateConditions(template.conditions, context))) {
        throw new Error(`Template conditions not met: ${templateId}`);
      }

      // Resolver variables
      let compiledContent = template.content;
      const resolvedVariables = {};

      // Buscar todas las variables en el contenido
      const variablePattern = /\{\{([^}]+)\}\}/g;
      const matches = [...compiledContent.matchAll(variablePattern)];

      for (const match of matches) {
        const variableName = match[1].trim();
        const variableValue = await this.resolveVariable(variableName, context);
        resolvedVariables[variableName] = variableValue;

        // Reemplazar en el contenido
        compiledContent = compiledContent.replace(match[0], variableValue);
      }

      const result = {
        templateId,
        originalContent: template.content,
        compiledContent,
        resolvedVariables,
        metadata: template.metadata,
        compiledAt: new Date().toISOString(),
      };

      // Guardar en caché por 5 minutos
      this.compiledTemplatesCache.set(cacheKey, result);
      setTimeout(
        () => {
          this.compiledTemplatesCache.delete(cacheKey);
        },
        5 * 60 * 1000
      );

      return result;
    } catch (error) {
      logger.error('Error compiling template:', error);
      throw error;
    }
  }

  /**
   * Resolver una variable específica
   */
  async resolveVariable(variableName, context) {
    try {
      // Verificar si hay un resolver personalizado
      if (this.variableResolvers.has(variableName)) {
        const resolver = this.variableResolvers.get(variableName);
        const value = await resolver(context);
        return value !== undefined ? value.toString() : '';
      }

      // Buscar en el contexto directo
      if (context[variableName] !== undefined) {
        return context[variableName].toString();
      }

      // Buscar en variables anidadas (ej: user.name)
      const parts = variableName.split('.');
      let value = context;

      for (const part of parts) {
        if (value && typeof value === 'object' && value[part] !== undefined) {
          value = value[part];
        } else {
          value = undefined;
          break;
        }
      }

      if (value !== undefined) {
        return value.toString();
      }

      // Buscar en variables guardadas
      const savedVariable = await this.getSavedVariable(variableName);
      if (savedVariable !== null) {
        return savedVariable.toString();
      }

      logger.warn(`Variable not resolved: ${variableName}`);
      return `{{${variableName}}}`;
    } catch (error) {
      logger.error('Error resolving variable:', error);
      return `{{${variableName}}}`;
    }
  }

  /**
   * Evaluar condiciones de la plantilla
   */
  async evaluateConditions(conditions, context) {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      if (!result) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluar una condición específica
   */
  async evaluateCondition(condition, context) {
    try {
      const { type, variable, operator, value } = condition;

      const variableValue = await this.resolveVariable(variable, context);

      switch (operator) {
        case 'equals':
          return variableValue === value;
        case 'not_equals':
          return variableValue !== value;
        case 'contains':
          return variableValue.includes(value);
        case 'not_contains':
          return !variableValue.includes(value);
        case 'greater_than':
          return parseFloat(variableValue) > parseFloat(value);
        case 'less_than':
          return parseFloat(variableValue) < parseFloat(value);
        case 'exists':
          return variableValue !== `{{${variable}}}`;
        case 'not_exists':
          return variableValue === `{{${variable}}}`;
        default:
          logger.warn(`Unknown condition operator: ${operator}`);
          return true;
      }
    } catch (error) {
      logger.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Guardar una variable personalizada
   */
  async saveVariable(name, value, metadata = {}) {
    try {
      const variable = {
        name,
        value,
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      const variablePath = path.join(this.variablesDir, `${name}.json`);
      await fs.writeJson(variablePath, variable, { spaces: 2 });

      logger.info(`Variable saved: ${name}`);
      return variable;
    } catch (error) {
      logger.error('Error saving variable:', error);
      throw error;
    }
  }

  /**
   * Obtener una variable guardada
   */
  async getSavedVariable(name) {
    try {
      const variablePath = path.join(this.variablesDir, `${name}.json`);

      if (!(await fs.pathExists(variablePath))) {
        return null;
      }

      const variable = await fs.readJson(variablePath);
      return variable.value;
    } catch (error) {
      logger.error('Error getting saved variable:', error);
      return null;
    }
  }

  /**
   * Registrar un resolver personalizado
   */
  registerVariableResolver(variableName, resolver) {
    this.variableResolvers.set(variableName, resolver);
    logger.info(`Variable resolver registered: ${variableName}`);
  }

  /**
   * Validar una plantilla
   */
  async validateTemplate(template) {
    const errors = [];

    // Validar campos requeridos
    if (!template.name) errors.push('Name is required');
    if (!template.content) errors.push('Content is required');

    // Validar sintaxis de variables
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const matches = [...template.content.matchAll(variablePattern)];

    for (const match of matches) {
      const variableName = match[1].trim();
      if (!variableName) {
        errors.push(`Empty variable found: ${match[0]}`);
      }
    }

    // Validar condiciones
    if (template.conditions) {
      for (const condition of template.conditions) {
        if (!condition.variable || !condition.operator) {
          errors.push('Invalid condition: variable and operator are required');
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Actualizar una plantilla existente
   */
  async updateTemplate(templateId, updates) {
    try {
      const template = await this.getTemplate(templateId);

      const updatedTemplate = {
        ...template,
        ...updates,
        metadata: {
          ...template.metadata,
          ...updates.metadata,
          updatedAt: new Date().toISOString(),
          version: this.incrementVersion(template.metadata.version),
        },
      };

      // Validar la plantilla actualizada
      await this.validateTemplate(updatedTemplate);

      // Guardar la plantilla
      const templatePath = path.join(this.templatesDir, `${templateId}.json`);
      await fs.writeJson(templatePath, updatedTemplate, { spaces: 2 });

      // Limpiar caché
      this.compiledTemplatesCache.clear();

      logger.info(`Template updated: ${templateId}`);
      return updatedTemplate;
    } catch (error) {
      logger.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Eliminar una plantilla
   */
  async deleteTemplate(templateId) {
    try {
      const templatePath = path.join(this.templatesDir, `${templateId}.json`);

      if (!(await fs.pathExists(templatePath))) {
        throw new Error(`Template not found: ${templateId}`);
      }

      await fs.remove(templatePath);
      this.compiledTemplatesCache.clear();

      logger.info(`Template deleted: ${templateId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de uso de plantillas
   */
  async getTemplateStats() {
    try {
      const templates = await this.listTemplates();

      const stats = {
        total: templates.length,
        active: templates.filter(t => t.active).length,
        inactive: templates.filter(t => !t.active).length,
        byCategory: {},
        recentlyUpdated: templates.filter(t => {
          const updatedAt = new Date(t.metadata.updatedAt);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return updatedAt > weekAgo;
        }).length,
        cacheSize: this.compiledTemplatesCache.size,
      };

      // Agrupar por categoría
      templates.forEach(template => {
        const category = template.category || 'general';
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting template stats:', error);
      throw error;
    }
  }

  /**
   * Generar ID único para plantilla
   */
  generateTemplateId() {
    return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Incrementar versión
   */
  incrementVersion(version) {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || 0) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Limpiar caché
   */
  clearCache() {
    this.compiledTemplatesCache.clear();
    logger.info('Template cache cleared');
  }

  /**
   * Exportar plantillas
   */
  async exportTemplates(templateIds = null) {
    try {
      const templates = await this.listTemplates();
      const toExport = templateIds
        ? templates.filter(t => templateIds.includes(t.id))
        : templates;

      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        templates: toExport,
      };

      return exportData;
    } catch (error) {
      logger.error('Error exporting templates:', error);
      throw error;
    }
  }

  /**
   * Importar plantillas
   */
  async importTemplates(importData, options = {}) {
    try {
      const { overwrite = false } = options;
      const imported = [];
      const errors = [];

      for (const templateData of importData.templates) {
        try {
          // Verificar si ya existe
          const existingPath = path.join(
            this.templatesDir,
            `${templateData.id}.json`
          );
          const exists = await fs.pathExists(existingPath);

          if (exists && !overwrite) {
            errors.push(`Template already exists: ${templateData.id}`);
            continue;
          }

          // Validar y crear
          await this.validateTemplate(templateData);

          const templatePath = path.join(
            this.templatesDir,
            `${templateData.id}.json`
          );
          await fs.writeJson(templatePath, templateData, { spaces: 2 });

          imported.push(templateData.id);
        } catch (error) {
          errors.push(`Error importing ${templateData.id}: ${error.message}`);
        }
      }

      this.compiledTemplatesCache.clear();

      logger.info(`Templates imported: ${imported.length}, errors: ${errors.length}`);
      return { imported, errors };
    } catch (error) {
      logger.error('Error importing templates:', error);
      throw error;
    }
  }
}

export default new DynamicTemplateService();

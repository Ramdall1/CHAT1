/**
 * @fileoverview Controlador de Plantillas
 * 
 * Maneja las operaciones CRUD de plantillas de WhatsApp
 * 
 * @author ChatBot Enterprise Team
 * @version 2.0.0
 */

import { createLogger } from '../../../services/core/core/logger.js';
import { getDatabaseService } from '../../../services/DatabaseService.js';

const logger = createLogger('TEMPLATE_CONTROLLER');

class TemplateController {
  /**
   * Obtener todas las plantillas
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async getTemplates(req, res) {
    try {
      const { page = 1, limit = 50, category, status } = req.query;
      logger.info('📋 Obteniendo plantillas...');
      
      const db = getDatabaseService();
      const offset = (page - 1) * limit;
      
      const conditions = {};
      if (category) conditions.category = category;
      if (status) conditions.status = status;
      
      const templates = await db.findAll('templates', conditions, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        orderBy: 'created_at',
        orderDirection: 'DESC'
      });
      
      const total = await db.count('templates', conditions);
      
      res.json({
        success: true,
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        message: 'Plantillas obtenidas correctamente'
      });
    } catch (error) {
      logger.error('❌ Error obteniendo plantillas:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener plantilla por ID
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async getTemplateById(req, res) {
    try {
      const { id } = req.params;
      logger.info(`📋 Obteniendo plantilla ${id}...`);

      const db = getDatabaseService();
      const template = await db.findById('templates', id);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Plantilla no encontrada'
        });
      }
      
      res.json({
        success: true,
        template,
        message: 'Plantilla obtenida correctamente'
      });
    } catch (error) {
      logger.error('❌ Error obteniendo plantilla:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Crear nueva plantilla
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async createTemplate(req, res) {
    try {
      const { name, category, language, body_text, buttons, variables, description, tags } = req.body;
      logger.info(`📝 Creando plantilla: ${name}...`);

      // Validar campos requeridos
      if (!name || !body_text) {
        return res.status(400).json({
          success: false,
          error: 'Nombre y cuerpo de texto son requeridos'
        });
      }

      const db = getDatabaseService();
      const result = await db.insert('templates', {
        name,
        category: category || 'general',
        language: language || 'es',
        body_text,
        buttons: buttons ? JSON.stringify(buttons) : null,
        variables: variables ? JSON.stringify(variables) : null,
        description: description || '',
        tags: tags ? JSON.stringify(tags) : null,
        status: 'active',
        is_active: 1,
        usage_count: 0
      });
      
      res.status(201).json({
        success: true,
        template: {
          id: result.lastID,
          name,
          category,
          language,
          body_text,
          buttons,
          variables,
          description,
          tags
        },
        message: 'Plantilla creada correctamente'
      });
    } catch (error) {
      logger.error('❌ Error creando plantilla:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Actualizar plantilla
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const { name, category, language, body_text, buttons, variables, description, tags, status } = req.body;
      logger.info(`✏️ Actualizando plantilla ${id}...`);

      const db = getDatabaseService();
      const template = await db.findById('templates', id);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Plantilla no encontrada'
        });
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (category) updateData.category = category;
      if (language) updateData.language = language;
      if (body_text) updateData.body_text = body_text;
      if (buttons) updateData.buttons = JSON.stringify(buttons);
      if (variables) updateData.variables = JSON.stringify(variables);
      if (description) updateData.description = description;
      if (tags) updateData.tags = JSON.stringify(tags);
      if (status) updateData.status = status;
      updateData.updated_at = new Date().toISOString();

      await db.update('templates', id, updateData);
      
      res.json({
        success: true,
        template: { id, ...updateData },
        message: 'Plantilla actualizada correctamente'
      });
    } catch (error) {
      logger.error('❌ Error actualizando plantilla:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Eliminar plantilla
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      logger.info(`🗑️ Eliminando plantilla ${id}...`);

      const db = getDatabaseService();
      const template = await db.findById('templates', id);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Plantilla no encontrada'
        });
      }

      await db.delete('templates', id);
      
      res.json({
        success: true,
        message: 'Plantilla eliminada correctamente'
      });
    } catch (error) {
      logger.error('❌ Error eliminando plantilla:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default TemplateController;

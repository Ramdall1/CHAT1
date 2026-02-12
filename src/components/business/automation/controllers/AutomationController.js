/**
 * Controlador de Automatización
 * 
 * Maneja las peticiones HTTP relacionadas con reglas de automatización,
 * coordinando entre las rutas y el servicio de automatización.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { getAutomationService } from '../services/AutomationService.js';
import { createLogger } from '../../../../services/core/core/logger.js';

const logger = createLogger('AUTOMATION_CONTROLLER');

/**
 * Controlador para gestión de automatización
 */
export class AutomationController {
  constructor() {
    this.automationService = getAutomationService();
  }
  
  /**
   * Obtener todas las reglas con filtros y paginación
   * GET /api/automation/rules
   */
  async getAllRules(req, res) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        isActive: req.query.isActive || '',
        category: req.query.category || '',
        triggerType: req.query.triggerType || '',
        sortBy: req.query.sortBy || 'priority',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await this.automationService.getAllRules(options);
      
      res.json({
        success: true,
        data: result,
        message: 'Reglas obtenidas exitosamente'
      });
    } catch (error) {
      logger.error('Error obteniendo reglas', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
  
  /**
   * Obtener regla por ID
   * GET /api/automation/rules/:id
   */
  async getRuleById(req, res) {
    try {
      const { id } = req.params;
      const rule = await this.automationService.getRuleById(id);
      
      if (!rule) {
        return res.status(404).json({
          success: false,
          message: 'Regla no encontrada'
        });
      }
      
      res.json({
        success: true,
        data: rule.toJSON(),
        message: 'Regla obtenida exitosamente'
      });
    } catch (error) {
      logger.error(`Error obteniendo regla ${req.params.id}`, error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
  
  /**
   * Crear nueva regla
   * POST /api/automation/rules
   */
  async createRule(req, res) {
    try {
      const ruleData = req.body;
      
      if (!ruleData.name || !ruleData.conditions || !ruleData.actions) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, condiciones y acciones son requeridos'
        });
      }
      
      const rule = await this.automationService.createRule(ruleData);
      
      res.status(201).json({
        success: true,
        data: rule.toJSON(),
        message: 'Regla creada exitosamente'
      });
    } catch (error) {
      logger.error('Error creando regla', error);
      res.status(400).json({
        success: false,
        message: 'Error creando regla',
        error: error.message
      });
    }
  }
  
  /**
   * Actualizar regla existente
   * PUT /api/automation/rules/:id
   */
  async updateRule(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const rule = await this.automationService.updateRule(id, updateData);
      
      res.json({
        success: true,
        data: rule.toJSON(),
        message: 'Regla actualizada exitosamente'
      });
    } catch (error) {
      logger.error(`Error actualizando regla ${req.params.id}`, error);
      
      if (error.message.includes('no encontrada')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Error actualizando regla',
          error: error.message
        });
      }
    }
  }
  
  /**
   * Eliminar regla
   * DELETE /api/automation/rules/:id
   */
  async deleteRule(req, res) {
    try {
      const { id } = req.params;
      
      await this.automationService.deleteRule(id);
      
      res.json({
        success: true,
        message: 'Regla eliminada exitosamente'
      });
    } catch (error) {
      logger.error(`Error eliminando regla ${req.params.id}`, error);
      
      if (error.message.includes('no encontrada')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error eliminando regla',
          error: error.message
        });
      }
    }
  }
  
  /**
   * Activar o desactivar regla
   * PATCH /api/automation/rules/:id/toggle
   */
  async toggleRuleStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'El campo isActive debe ser un booleano'
        });
      }
      
      const rule = await this.automationService.toggleRuleStatus(id, isActive);
      
      res.json({
        success: true,
        data: rule.toJSON(),
        message: `Regla ${isActive ? 'activada' : 'desactivada'} exitosamente`
      });
    } catch (error) {
      logger.error(`Error cambiando estado de regla ${req.params.id}`, error);
      
      if (error.message.includes('no encontrada')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error cambiando estado de regla',
          error: error.message
        });
      }
    }
  }
  
  /**
   * Evaluar reglas para un contacto específico
   * POST /api/automation/evaluate/:contactId
   */
  async evaluateRulesForContact(req, res) {
    try {
      const { contactId } = req.params;
      const context = req.body.context || {};
      
      const result = await this.automationService.evaluateRulesForContact(contactId, context);
      
      res.json({
        success: true,
        data: result,
        message: 'Evaluación de reglas completada exitosamente'
      });
    } catch (error) {
      logger.error(`Error evaluando reglas para contacto ${req.params.contactId}`, error);
      
      if (error.message.includes('no encontrado')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error evaluando reglas',
          error: error.message
        });
      }
    }
  }
  
  /**
   * Procesar todas las reglas automáticas
   * POST /api/automation/process
   */
  async processAutomaticRules(req, res) {
    try {
      const options = {
        contactLimit: parseInt(req.body.contactLimit) || 100,
        ruleTypes: req.body.ruleTypes || ['immediate'],
        skipRecentlyProcessed: req.body.skipRecentlyProcessed !== false
      };
      
      const result = await this.automationService.processAutomaticRules(options);
      
      res.json({
        success: true,
        data: result,
        message: 'Procesamiento automático completado exitosamente'
      });
    } catch (error) {
      logger.error('Error en procesamiento automático', error);
      res.status(500).json({
        success: false,
        message: 'Error en procesamiento automático',
        error: error.message
      });
    }
  }
  
  /**
   * Obtener estadísticas de reglas
   * GET /api/automation/stats
   */
  async getRuleStats(req, res) {
    try {
      const filters = {
        dateFrom: req.query.dateFrom || '',
        dateTo: req.query.dateTo || ''
      };
      
      const stats = await this.automationService.getRuleStats(filters);
      
      res.json({
        success: true,
        data: stats,
        message: 'Estadísticas obtenidas exitosamente'
      });
    } catch (error) {
      logger.error('Error obteniendo estadísticas de reglas', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas',
        error: error.message
      });
    }
  }
  
  /**
   * Obtener categorías disponibles
   * GET /api/automation/categories
   */
  async getCategories(req, res) {
    try {
      const categories = [
        { id: 'general', name: 'General', description: 'Reglas generales de automatización' },
        { id: 'engagement', name: 'Engagement', description: 'Reglas para mejorar el engagement' },
        { id: 'sales', name: 'Ventas', description: 'Reglas orientadas a ventas' },
        { id: 'support', name: 'Soporte', description: 'Reglas para atención al cliente' },
        { id: 'marketing', name: 'Marketing', description: 'Reglas de marketing y promociones' },
        { id: 'retention', name: 'Retención', description: 'Reglas para retención de clientes' }
      ];
      
      res.json({
        success: true,
        data: categories,
        message: 'Categorías obtenidas exitosamente'
      });
    } catch (error) {
      logger.error('Error obteniendo categorías', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo categorías',
        error: error.message
      });
    }
  }
  
  /**
   * Obtener tipos de condiciones disponibles
   * GET /api/automation/condition-types
   */
  async getConditionTypes(req, res) {
    try {
      const conditionTypes = [
        {
          id: 'message_count',
          name: 'Cantidad de Mensajes',
          description: 'Número total de mensajes del contacto',
          operators: ['equals', 'greater_than', 'less_than'],
          valueType: 'number'
        },
        {
          id: 'last_message_time',
          name: 'Tiempo desde Último Mensaje',
          description: 'Horas transcurridas desde el último mensaje',
          operators: ['greater_than', 'less_than'],
          valueType: 'number'
        },
        {
          id: 'message_contains',
          name: 'Mensaje Contiene',
          description: 'El último mensaje contiene texto específico',
          operators: ['contains', 'not_contains'],
          valueType: 'string'
        },
        {
          id: 'contact_tag',
          name: 'Tag del Contacto',
          description: 'El contacto tiene un tag específico',
          operators: ['contains', 'not_contains'],
          valueType: 'string'
        },
        {
          id: 'contact_status',
          name: 'Estado del Contacto',
          description: 'Estado actual del contacto',
          operators: ['equals', 'not_equals'],
          valueType: 'select',
          options: ['active', 'inactive', 'blocked', 'vip']
        },
        {
          id: 'interaction_frequency',
          name: 'Frecuencia de Interacción',
          description: 'Mensajes por día en la última semana',
          operators: ['greater_than', 'less_than'],
          valueType: 'number'
        },
        {
          id: 'time_of_day',
          name: 'Hora del Día',
          description: 'Hora actual del sistema',
          operators: ['equals', 'greater_than', 'less_than'],
          valueType: 'time'
        },
        {
          id: 'day_of_week',
          name: 'Día de la Semana',
          description: 'Día actual de la semana',
          operators: ['equals', 'not_equals'],
          valueType: 'select',
          options: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }
      ];
      
      res.json({
        success: true,
        data: conditionTypes,
        message: 'Tipos de condiciones obtenidos exitosamente'
      });
    } catch (error) {
      logger.error('Error obteniendo tipos de condiciones', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo tipos de condiciones',
        error: error.message
      });
    }
  }
  
  /**
   * Obtener tipos de acciones disponibles
   * GET /api/automation/action-types
   */
  async getActionTypes(req, res) {
    try {
      const actionTypes = [
        {
          id: 'add_tag',
          name: 'Agregar Tag',
          description: 'Agregar un tag al contacto',
          parameters: [
            { name: 'tag', type: 'string', required: true, description: 'Tag a agregar' }
          ]
        },
        {
          id: 'remove_tag',
          name: 'Remover Tag',
          description: 'Remover un tag del contacto',
          parameters: [
            { name: 'tag', type: 'string', required: true, description: 'Tag a remover' }
          ]
        },
        {
          id: 'send_message',
          name: 'Enviar Mensaje',
          description: 'Enviar un mensaje de texto al contacto',
          parameters: [
            { name: 'message', type: 'string', required: true, description: 'Texto del mensaje' }
          ]
        },
        {
          id: 'send_template',
          name: 'Enviar Template',
          description: 'Enviar un template de WhatsApp al contacto',
          parameters: [
            { name: 'templateId', type: 'string', required: true, description: 'ID del template' },
            { name: 'templateData', type: 'object', required: false, description: 'Datos del template' }
          ]
        },
        {
          id: 'update_status',
          name: 'Actualizar Estado',
          description: 'Cambiar el estado del contacto',
          parameters: [
            { 
              name: 'status', 
              type: 'select', 
              required: true, 
              description: 'Nuevo estado',
              options: ['active', 'inactive', 'blocked', 'vip']
            }
          ]
        },
        {
          id: 'create_task',
          name: 'Crear Tarea',
          description: 'Crear una tarea de seguimiento',
          parameters: [
            { name: 'title', type: 'string', required: true, description: 'Título de la tarea' },
            { name: 'description', type: 'string', required: false, description: 'Descripción de la tarea' }
          ]
        },
        {
          id: 'send_notification',
          name: 'Enviar Notificación',
          description: 'Enviar notificación al equipo',
          parameters: [
            { name: 'message', type: 'string', required: true, description: 'Mensaje de notificación' },
            { name: 'priority', type: 'select', required: false, options: ['low', 'medium', 'high'] }
          ]
        },
        {
          id: 'move_to_segment',
          name: 'Mover a Segmento',
          description: 'Mover contacto a un segmento específico',
          parameters: [
            { name: 'segment', type: 'string', required: true, description: 'Nombre del segmento' }
          ]
        }
      ];
      
      res.json({
        success: true,
        data: actionTypes,
        message: 'Tipos de acciones obtenidos exitosamente'
      });
    } catch (error) {
      logger.error('Error obteniendo tipos de acciones', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo tipos de acciones',
        error: error.message
      });
    }
  }
  
  /**
   * Validar regla antes de guardar
   * POST /api/automation/validate
   */
  async validateRule(req, res) {
    try {
      const ruleData = req.body;
      
      // Intentar crear la regla para validar
      const rule = new (await import('../business/Rule.js')).Rule(ruleData);
      
      res.json({
        success: true,
        data: {
          valid: true,
          rule: rule.toJSON()
        },
        message: 'Regla válida'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: {
          valid: false,
          errors: error.message.split(', ')
        },
        message: 'Regla inválida'
      });
    }
  }
}

// Instancia singleton del controlador
let controllerInstance = null;

/**
 * Obtener instancia del controlador de automatización
 * @returns {AutomationController} Instancia del controlador
 */
export function getAutomationController() {
  if (!controllerInstance) {
    controllerInstance = new AutomationController();
  }
  return controllerInstance;
}

export default AutomationController;
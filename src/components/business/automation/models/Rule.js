/**
 * Modelo de Regla de Automatización
 * 
 * Define la estructura y validación para reglas de automatización
 * que permiten etiquetar contactos basado en comportamientos.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { createLogger } from '../../../../services/core/core/logger.js';

const logger = createLogger('RULE_MODEL');

/**
 * Clase que representa una regla de automatización
 */
export class Rule {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.description = data.description || '';
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.priority = data.priority || 1;
    this.conditions = data.conditions || [];
    this.actions = data.actions || [];
    this.tags = data.tags || [];
    this.category = data.category || 'general';
    this.triggerType = data.triggerType || 'immediate'; // immediate, scheduled, manual
    this.executionCount = data.executionCount || 0;
    this.lastExecuted = data.lastExecuted || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy || 'system';
    
    this.validate();
  }
  
  /**
   * Validar los datos de la regla
   * @throws {Error} Si los datos no son válidos
   */
  validate() {
    const errors = [];
    
    // Validar nombre
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      errors.push('El nombre de la regla es requerido');
    }
    
    if (this.name.length > 100) {
      errors.push('El nombre de la regla no puede exceder 100 caracteres');
    }
    
    // Validar descripción
    if (this.description && this.description.length > 500) {
      errors.push('La descripción no puede exceder 500 caracteres');
    }
    
    // Validar prioridad
    if (typeof this.priority !== 'number' || this.priority < 1 || this.priority > 10) {
      errors.push('La prioridad debe ser un número entre 1 y 10');
    }
    
    // Validar condiciones
    if (!Array.isArray(this.conditions) || this.conditions.length === 0) {
      errors.push('La regla debe tener al menos una condición');
    }
    
    this.conditions.forEach((condition, index) => {
      const conditionErrors = this.validateCondition(condition, index);
      errors.push(...conditionErrors);
    });
    
    // Validar acciones
    if (!Array.isArray(this.actions) || this.actions.length === 0) {
      errors.push('La regla debe tener al menos una acción');
    }
    
    this.actions.forEach((action, index) => {
      const actionErrors = this.validateAction(action, index);
      errors.push(...actionErrors);
    });
    
    // Validar tipo de trigger
    const validTriggerTypes = ['immediate', 'scheduled', 'manual'];
    if (!validTriggerTypes.includes(this.triggerType)) {
      errors.push(`Tipo de trigger inválido. Debe ser uno de: ${validTriggerTypes.join(', ')}`);
    }
    
    // Validar categoría
    const validCategories = ['general', 'engagement', 'sales', 'support', 'marketing', 'retention'];
    if (!validCategories.includes(this.category)) {
      errors.push(`Categoría inválida. Debe ser una de: ${validCategories.join(', ')}`);
    }
    
    if (errors.length > 0) {
      throw new Error(`Errores de validación en la regla: ${errors.join(', ')}`);
    }
  }
  
  /**
   * Validar una condición específica
   * @param {object} condition - Condición a validar
   * @param {number} index - Índice de la condición
   * @returns {string[]} Array de errores
   */
  validateCondition(condition, index) {
    const errors = [];
    const prefix = `Condición ${index + 1}:`;
    
    if (!condition || typeof condition !== 'object') {
      errors.push(`${prefix} debe ser un objeto válido`);
      return errors;
    }
    
    // Validar tipo de condición
    const validTypes = [
      'message_count', 'last_message_time', 'message_contains', 
      'contact_tag', 'contact_status', 'interaction_frequency',
      'response_time', 'message_type', 'time_of_day', 'day_of_week'
    ];
    
    if (!condition.type || !validTypes.includes(condition.type)) {
      errors.push(`${prefix} tipo inválido. Debe ser uno de: ${validTypes.join(', ')}`);
    }
    
    // Validar operador
    const validOperators = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains', 'in', 'not_in'];
    if (!condition.operator || !validOperators.includes(condition.operator)) {
      errors.push(`${prefix} operador inválido. Debe ser uno de: ${validOperators.join(', ')}`);
    }
    
    // Validar valor
    if (condition.value === undefined || condition.value === null) {
      errors.push(`${prefix} valor es requerido`);
    }
    
    // Validaciones específicas por tipo
    switch (condition.type) {
    case 'message_count':
    case 'interaction_frequency':
      if (typeof condition.value !== 'number' || condition.value < 0) {
        errors.push(`${prefix} valor debe ser un número positivo`);
      }
      break;
        
    case 'last_message_time':
      if (typeof condition.value !== 'number' || condition.value < 0) {
        errors.push(`${prefix} valor debe ser un número de horas positivo`);
      }
      break;
        
    case 'message_contains':
      if (typeof condition.value !== 'string' || condition.value.trim().length === 0) {
        errors.push(`${prefix} valor debe ser un texto no vacío`);
      }
      break;
        
    case 'contact_tag':
      if (typeof condition.value !== 'string' || condition.value.trim().length === 0) {
        errors.push(`${prefix} valor debe ser un tag válido`);
      }
      break;
        
    case 'time_of_day':
      if (typeof condition.value !== 'string' || !/^\d{2}:\d{2}$/.test(condition.value)) {
        errors.push(`${prefix} valor debe tener formato HH:MM`);
      }
      break;
        
    case 'day_of_week':
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      if (!validDays.includes(condition.value)) {
        errors.push(`${prefix} valor debe ser un día válido: ${validDays.join(', ')}`);
      }
      break;
    }
    
    return errors;
  }
  
  /**
   * Validar una acción específica
   * @param {object} action - Acción a validar
   * @param {number} index - Índice de la acción
   * @returns {string[]} Array de errores
   */
  validateAction(action, index) {
    const errors = [];
    const prefix = `Acción ${index + 1}:`;
    
    if (!action || typeof action !== 'object') {
      errors.push(`${prefix} debe ser un objeto válido`);
      return errors;
    }
    
    // Validar tipo de acción
    const validTypes = [
      'add_tag', 'remove_tag', 'send_message', 'send_template',
      'update_status', 'create_task', 'send_notification', 'move_to_segment'
    ];
    
    if (!action.type || !validTypes.includes(action.type)) {
      errors.push(`${prefix} tipo inválido. Debe ser uno de: ${validTypes.join(', ')}`);
    }
    
    // Validar parámetros según el tipo
    switch (action.type) {
    case 'add_tag':
    case 'remove_tag':
      if (!action.tag || typeof action.tag !== 'string' || action.tag.trim().length === 0) {
        errors.push(`${prefix} debe especificar un tag válido`);
      }
      break;
        
    case 'send_message':
      if (!action.message || typeof action.message !== 'string' || action.message.trim().length === 0) {
        errors.push(`${prefix} debe especificar un mensaje válido`);
      }
      break;
        
    case 'send_template':
      if (!action.templateId || typeof action.templateId !== 'string') {
        errors.push(`${prefix} debe especificar un ID de template válido`);
      }
      break;
        
    case 'update_status':
      const validStatuses = ['active', 'inactive', 'blocked', 'vip'];
      if (!action.status || !validStatuses.includes(action.status)) {
        errors.push(`${prefix} estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`);
      }
      break;
        
    case 'move_to_segment':
      if (!action.segment || typeof action.segment !== 'string') {
        errors.push(`${prefix} debe especificar un segmento válido`);
      }
      break;
    }
    
    return errors;
  }
  
  /**
   * Evaluar si la regla se aplica a un contacto
   * @param {object} contact - Datos del contacto
   * @param {object} context - Contexto adicional (mensajes, etc.)
   * @returns {boolean} True si la regla se aplica
   */
  evaluate(contact, context = {}) {
    if (!this.isActive) {
      return false;
    }
    
    try {
      // Evaluar todas las condiciones
      const conditionResults = this.conditions.map(condition => 
        this.evaluateCondition(condition, contact, context)
      );
      
      // Por defecto, todas las condiciones deben cumplirse (AND)
      // TODO: Implementar lógica OR y combinaciones más complejas
      return conditionResults.every(result => result === true);
    } catch (error) {
      logger.error(`Error evaluando regla ${this.id}`, error);
      return false;
    }
  }
  
  /**
   * Evaluar una condición específica
   * @param {object} condition - Condición a evaluar
   * @param {object} contact - Datos del contacto
   * @param {object} context - Contexto adicional
   * @returns {boolean} Resultado de la evaluación
   */
  evaluateCondition(condition, contact, context) {
    const { type, operator, value } = condition;
    let actualValue;
    
    // Obtener el valor actual según el tipo de condición
    switch (type) {
    case 'message_count':
      actualValue = context.messageCount || 0;
      break;
        
    case 'last_message_time':
      const lastMessage = context.lastMessageTime;
      if (!lastMessage) return false;
      const hoursSinceLastMessage = (Date.now() - new Date(lastMessage).getTime()) / (1000 * 60 * 60);
      actualValue = hoursSinceLastMessage;
      break;
        
    case 'message_contains':
      const lastMessageText = context.lastMessageText || '';
      actualValue = lastMessageText.toLowerCase();
      break;
        
    case 'contact_tag':
      actualValue = contact.tags || [];
      break;
        
    case 'contact_status':
      actualValue = contact.status || 'active';
      break;
        
    case 'interaction_frequency':
      actualValue = context.interactionFrequency || 0;
      break;
        
    case 'time_of_day':
      const now = new Date();
      actualValue = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      break;
        
    case 'day_of_week':
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      actualValue = days[new Date().getDay()];
      break;
        
    default:
      return false;
    }
    
    // Aplicar el operador
    return this.applyOperator(actualValue, operator, value);
  }
  
  /**
   * Aplicar operador de comparación
   * @param {any} actualValue - Valor actual
   * @param {string} operator - Operador
   * @param {any} expectedValue - Valor esperado
   * @returns {boolean} Resultado de la comparación
   */
  applyOperator(actualValue, operator, expectedValue) {
    switch (operator) {
    case 'equals':
      return actualValue === expectedValue;
        
    case 'not_equals':
      return actualValue !== expectedValue;
        
    case 'greater_than':
      return actualValue > expectedValue;
        
    case 'less_than':
      return actualValue < expectedValue;
        
    case 'contains':
      if (Array.isArray(actualValue)) {
        return actualValue.includes(expectedValue);
      }
      return String(actualValue).includes(String(expectedValue));
        
    case 'not_contains':
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(expectedValue);
      }
      return !String(actualValue).includes(String(expectedValue));
        
    case 'in':
      return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
        
    case 'not_in':
      return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
        
    default:
      return false;
    }
  }
  
  /**
   * Ejecutar las acciones de la regla
   * @param {object} contact - Contacto objetivo
   * @param {object} context - Contexto de ejecución
   * @returns {Promise<object>} Resultado de la ejecución
   */
  async execute(contact, context = {}) {
    const results = {
      success: true,
      actionsExecuted: 0,
      actionsFailed: 0,
      errors: []
    };
    
    try {
      for (const action of this.actions) {
        try {
          await this.executeAction(action, contact, context);
          results.actionsExecuted++;
        } catch (error) {
          results.actionsFailed++;
          results.errors.push({
            action: action.type,
            error: error.message
          });
        }
      }
      
      // Actualizar contadores
      this.executionCount++;
      this.lastExecuted = new Date().toISOString();
      this.updatedAt = new Date().toISOString();
      
      if (results.actionsFailed > 0) {
        results.success = false;
      }
      
    } catch (error) {
      results.success = false;
      results.errors.push({ error: error.message });
    }
    
    return results;
  }
  
  /**
   * Ejecutar una acción específica
   * @param {object} action - Acción a ejecutar
   * @param {object} contact - Contacto objetivo
   * @param {object} context - Contexto de ejecución
   */
  async executeAction(action, contact, context) {
    // Esta implementación sería completada con los servicios reales
    logger.info(`Ejecutando acción ${action.type} para contacto ${contact.phone}`);
    
    switch (action.type) {
    case 'add_tag':
      // Implementar con ContactService
      logger.info(`Agregando tag ${action.tag} a contacto ${contact.phone}`);
      break;
        
    case 'remove_tag':
      // Implementar con ContactService
      logger.info(`Removiendo tag ${action.tag} de contacto ${contact.phone}`);
      break;
        
    case 'send_message':
      // Implementar con MessageService
      logger.info(`Enviando mensaje a contacto ${contact.phone}: ${action.message}`);
      break;
        
    case 'send_template':
      // Implementar con MessageService
      logger.info(`Enviando template ${action.templateId} a contacto ${contact.phone}`);
      break;
        
    default:
      logger.warn(`Tipo de acción no implementado: ${action.type}`);
    }
  }
  
  /**
   * Generar ID único para la regla
   * @returns {string} ID único
   */
  generateId() {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Convertir a JSON
   * @returns {object} Representación JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      isActive: this.isActive,
      priority: this.priority,
      conditions: this.conditions,
      actions: this.actions,
      tags: this.tags,
      category: this.category,
      triggerType: this.triggerType,
      executionCount: this.executionCount,
      lastExecuted: this.lastExecuted,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy
    };
  }
  
  /**
   * Crear instancia desde JSON
   * @param {object} data - Datos JSON
   * @returns {Rule} Instancia de Rule
   */
  static fromJSON(data) {
    return new Rule(data);
  }
  
  /**
   * Crear regla básica para agregar tag
   * @param {string} name - Nombre de la regla
   * @param {object} condition - Condición
   * @param {string} tag - Tag a agregar
   * @returns {Rule} Nueva regla
   */
  static createAddTagRule(name, condition, tag) {
    return new Rule({
      name,
      description: `Regla automática para agregar tag ${tag}`,
      conditions: [condition],
      actions: [{ type: 'add_tag', tag }],
      category: 'general'
    });
  }
}

export default Rule;
/**
 * Servicio de Automatización
 * 
 * Maneja toda la lógica de negocio relacionada con reglas de automatización,
 * incluyendo evaluación, ejecución y gestión de reglas.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { getDatabase } from '../../../../services/core/core/database.js';
import { createLogger } from '../../../../services/core/core/logger.js';
import { Rule } from '../models/Rule.js';
import { getContactService } from '../../contacts/services/ContactService.js';
import { getMessageService } from '../../messaging/services/MessageService.js';

const logger = createLogger('AUTOMATION_SERVICE');

/**
 * Servicio para gestión de automatización
 */
export class AutomationService {
  constructor() {
    this.db = getDatabase();
    this.filename = this.db.files.RULES;
    this.contactService = getContactService();
    this.messageService = getMessageService();
    this.isProcessing = false;
  }
  
  /**
   * Obtener todas las reglas con filtros y paginación
   * @param {object} options - Opciones de filtrado y paginación
   * @returns {Promise<object>} Lista de reglas con metadata
   */
  async getAllRules(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        isActive = '',
        category = '',
        triggerType = '',
        sortBy = 'priority',
        sortOrder = 'desc'
      } = options;
      
      let rules = await this.db.read(this.filename) || [];
      
      // Convertir a instancias de Rule
      rules = rules.map(data => Rule.fromJSON(data));
      
      // Aplicar filtros
      if (isActive !== '') {
        const activeFilter = isActive === 'true';
        rules = rules.filter(rule => rule.isActive === activeFilter);
      }
      
      if (category) {
        rules = rules.filter(rule => rule.category === category);
      }
      
      if (triggerType) {
        rules = rules.filter(rule => rule.triggerType === triggerType);
      }
      
      // Ordenar
      rules.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        
        if (sortBy.includes('At')) {
          aValue = new Date(aValue || 0);
          bValue = new Date(bValue || 0);
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
      
      // Paginación
      const total = rules.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRules = rules.slice(startIndex, endIndex);
      
      return {
        rules: paginatedRules.map(rule => rule.toJSON()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: endIndex < total,
          hasPrev: page > 1
        },
        filters: options
      };
    } catch (error) {
      logger.error('Error obteniendo reglas', error);
      throw error;
    }
  }
  
  /**
   * Obtener regla por ID
   * @param {string} id - ID de la regla
   * @returns {Promise<Rule|null>} Regla encontrada
   */
  async getRuleById(id) {
    try {
      const rule = await this.db.findOne(this.filename, item => item.id === id);
      return rule ? Rule.fromJSON(rule) : null;
    } catch (error) {
      logger.error(`Error obteniendo regla ${id}`, error);
      throw error;
    }
  }
  
  /**
   * Crear nueva regla
   * @param {object} ruleData - Datos de la regla
   * @returns {Promise<Rule>} Regla creada
   */
  async createRule(ruleData) {
    try {
      const rule = new Rule(ruleData);
      const savedRule = await this.db.append(this.filename, rule.toJSON());
      
      logger.info(`Regla creada: ${rule.name} (${rule.id})`);
      return Rule.fromJSON(savedRule);
    } catch (error) {
      logger.error('Error creando regla', error);
      throw error;
    }
  }
  
  /**
   * Actualizar regla existente
   * @param {string} id - ID de la regla
   * @param {object} updateData - Datos a actualizar
   * @returns {Promise<Rule>} Regla actualizada
   */
  async updateRule(id, updateData) {
    try {
      const existingRule = await this.getRuleById(id);
      if (!existingRule) {
        throw new Error(`Regla con ID ${id} no encontrada`);
      }
      
      // Crear nueva instancia con datos actualizados
      const updatedRuleData = {
        ...existingRule.toJSON(),
        ...updateData,
        id, // Mantener el ID original
        updatedAt: new Date().toISOString()
      };
      
      const updatedRule = new Rule(updatedRuleData);
      const savedRule = await this.db.update(this.filename, id, updatedRule.toJSON());
      
      logger.info(`Regla actualizada: ${updatedRule.name} (${id})`);
      return Rule.fromJSON(savedRule);
    } catch (error) {
      logger.error(`Error actualizando regla ${id}`, error);
      throw error;
    }
  }
  
  /**
   * Eliminar regla
   * @param {string} id - ID de la regla
   * @returns {Promise<boolean>} True si se eliminó exitosamente
   */
  async deleteRule(id) {
    try {
      const rule = await this.getRuleById(id);
      if (!rule) {
        throw new Error(`Regla con ID ${id} no encontrada`);
      }
      
      await this.db.delete(this.filename, id);
      
      logger.info(`Regla eliminada: ${rule.name} (${id})`);
      return true;
    } catch (error) {
      logger.error(`Error eliminando regla ${id}`, error);
      throw error;
    }
  }
  
  /**
   * Activar o desactivar regla
   * @param {string} id - ID de la regla
   * @param {boolean} isActive - Estado activo
   * @returns {Promise<Rule>} Regla actualizada
   */
  async toggleRuleStatus(id, isActive) {
    try {
      const updatedRule = await this.updateRule(id, { isActive });
      
      logger.info(`Regla ${isActive ? 'activada' : 'desactivada'}: ${updatedRule.name} (${id})`);
      return updatedRule;
    } catch (error) {
      logger.error(`Error cambiando estado de regla ${id}`, error);
      throw error;
    }
  }
  
  /**
   * Evaluar reglas para un contacto específico
   * @param {string} contactId - ID del contacto
   * @param {object} context - Contexto adicional
   * @returns {Promise<object>} Resultado de la evaluación
   */
  async evaluateRulesForContact(contactId, context = {}) {
    try {
      const contact = await this.contactService.getContactById(contactId);
      if (!contact) {
        throw new Error(`Contacto con ID ${contactId} no encontrado`);
      }
      
      // Obtener reglas activas ordenadas por prioridad
      const activeRules = await this.getActiveRulesByPriority();
      
      // Obtener contexto del contacto
      const contactContext = await this.buildContactContext(contact, context);
      
      const results = {
        contactId,
        rulesEvaluated: 0,
        rulesMatched: 0,
        rulesExecuted: 0,
        rulesFailed: 0,
        matchedRules: [],
        executionResults: [],
        errors: []
      };
      
      for (const rule of activeRules) {
        results.rulesEvaluated++;
        
        try {
          // Evaluar si la regla se aplica
          if (rule.evaluate(contact.toJSON(), contactContext)) {
            results.rulesMatched++;
            results.matchedRules.push({
              id: rule.id,
              name: rule.name,
              priority: rule.priority
            });
            
            // Ejecutar la regla
            const executionResult = await rule.execute(contact.toJSON(), contactContext);
            results.executionResults.push({
              ruleId: rule.id,
              ruleName: rule.name,
              ...executionResult
            });
            
            if (executionResult.success) {
              results.rulesExecuted++;
              
              // Actualizar contadores en la base de datos
              await this.updateRule(rule.id, {
                executionCount: rule.executionCount,
                lastExecuted: rule.lastExecuted
              });
            } else {
              results.rulesFailed++;
            }
          }
        } catch (error) {
          results.rulesFailed++;
          results.errors.push({
            ruleId: rule.id,
            ruleName: rule.name,
            error: error.message
          });
        }
      }
      
      logger.info(`Evaluación completada para contacto ${contactId}: ${results.rulesMatched} reglas aplicadas`);
      return results;
    } catch (error) {
      logger.error(`Error evaluando reglas para contacto ${contactId}`, error);
      throw error;
    }
  }
  
  /**
   * Procesar todas las reglas automáticas
   * @param {object} options - Opciones de procesamiento
   * @returns {Promise<object>} Resultado del procesamiento
   */
  async processAutomaticRules(options = {}) {
    if (this.isProcessing) {
      logger.warn('Ya hay un procesamiento de reglas en curso');
      return { message: 'Procesamiento ya en curso' };
    }
    
    this.isProcessing = true;
    
    try {
      const { 
        contactLimit = 100,
        ruleTypes = ['immediate'],
        skipRecentlyProcessed = true 
      } = options;
      
      logger.info('Iniciando procesamiento automático de reglas');
      
      // Obtener contactos para procesar
      const contacts = await this.getContactsForProcessing(contactLimit, skipRecentlyProcessed);
      
      // Obtener reglas activas del tipo especificado
      const rules = await this.getActiveRulesByType(ruleTypes);
      
      const results = {
        startTime: new Date().toISOString(),
        contactsProcessed: 0,
        rulesEvaluated: 0,
        rulesExecuted: 0,
        totalMatches: 0,
        errors: [],
        summary: {}
      };
      
      for (const contact of contacts) {
        try {
          const contactResult = await this.evaluateRulesForContact(contact.id);
          
          results.contactsProcessed++;
          results.rulesEvaluated += contactResult.rulesEvaluated;
          results.rulesExecuted += contactResult.rulesExecuted;
          results.totalMatches += contactResult.rulesMatched;
          
          if (contactResult.errors.length > 0) {
            results.errors.push(...contactResult.errors);
          }
        } catch (error) {
          results.errors.push({
            contactId: contact.id,
            error: error.message
          });
        }
      }
      
      results.endTime = new Date().toISOString();
      results.duration = new Date(results.endTime) - new Date(results.startTime);
      
      logger.info(`Procesamiento automático completado: ${results.contactsProcessed} contactos, ${results.totalMatches} coincidencias`);
      return results;
    } catch (error) {
      logger.error('Error en procesamiento automático de reglas', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Obtener estadísticas de reglas
   * @param {object} filters - Filtros para las estadísticas
   * @returns {Promise<object>} Estadísticas
   */
  async getRuleStats(filters = {}) {
    try {
      let rules = await this.db.read(this.filename) || [];
      
      // Aplicar filtros de fecha si existen
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        rules = rules.filter(rule => 
          new Date(rule.createdAt) >= fromDate
        );
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        rules = rules.filter(rule => 
          new Date(rule.createdAt) <= toDate
        );
      }
      
      const stats = {
        total: rules.length,
        active: 0,
        inactive: 0,
        byCategory: {},
        byTriggerType: {},
        totalExecutions: 0,
        averageExecutions: 0,
        mostExecutedRule: null,
        recentlyExecuted: 0
      };
      
      let maxExecutions = 0;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      rules.forEach(rule => {
        // Contar por estado
        if (rule.isActive) {
          stats.active++;
        } else {
          stats.inactive++;
        }
        
        // Contar por categoría
        stats.byCategory[rule.category] = (stats.byCategory[rule.category] || 0) + 1;
        
        // Contar por tipo de trigger
        stats.byTriggerType[rule.triggerType] = (stats.byTriggerType[rule.triggerType] || 0) + 1;
        
        // Sumar ejecuciones
        const executions = rule.executionCount || 0;
        stats.totalExecutions += executions;
        
        // Encontrar regla más ejecutada
        if (executions > maxExecutions) {
          maxExecutions = executions;
          stats.mostExecutedRule = {
            id: rule.id,
            name: rule.name,
            executions
          };
        }
        
        // Contar ejecuciones recientes
        if (rule.lastExecuted && new Date(rule.lastExecuted) > oneDayAgo) {
          stats.recentlyExecuted++;
        }
      });
      
      // Calcular promedio
      if (rules.length > 0) {
        stats.averageExecutions = (stats.totalExecutions / rules.length).toFixed(2);
      }
      
      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de reglas', error);
      throw error;
    }
  }
  
  /**
   * Obtener reglas activas ordenadas por prioridad
   * @private
   * @returns {Promise<Rule[]>} Reglas activas
   */
  async getActiveRulesByPriority() {
    const rules = await this.db.find(this.filename, rule => rule.isActive === true);
    return rules
      .map(data => Rule.fromJSON(data))
      .sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Obtener reglas activas por tipo
   * @private
   * @param {string[]} types - Tipos de trigger
   * @returns {Promise<Rule[]>} Reglas filtradas
   */
  async getActiveRulesByType(types) {
    const rules = await this.db.find(this.filename, rule => 
      rule.isActive === true && types.includes(rule.triggerType)
    );
    return rules
      .map(data => Rule.fromJSON(data))
      .sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Construir contexto para evaluación de reglas
   * @private
   * @param {object} contact - Datos del contacto
   * @param {object} additionalContext - Contexto adicional
   * @returns {Promise<object>} Contexto completo
   */
  async buildContactContext(contact, additionalContext = {}) {
    try {
      // Obtener conversación del contacto
      const conversation = await this.messageService.getConversation(contact.phone, { limit: 50 });
      const messages = conversation.messages || [];
      
      // Calcular métricas
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const recentMessages = messages.filter(msg => new Date(msg.createdAt) > oneDayAgo);
      const weeklyMessages = messages.filter(msg => new Date(msg.createdAt) > oneWeekAgo);
      
      const lastMessage = messages.length > 0 ? messages[0] : null;
      const lastInboundMessage = messages.find(msg => msg.direction === 'inbound');
      
      return {
        messageCount: messages.length,
        recentMessageCount: recentMessages.length,
        weeklyMessageCount: weeklyMessages.length,
        lastMessageTime: lastMessage ? lastMessage.createdAt : null,
        lastMessageText: lastMessage ? (lastMessage.content?.text || '') : '',
        lastInboundMessageTime: lastInboundMessage ? lastInboundMessage.createdAt : null,
        interactionFrequency: weeklyMessages.length / 7, // mensajes por día
        responseTime: this.calculateAverageResponseTime(messages),
        ...additionalContext
      };
    } catch (error) {
      logger.warn(`Error construyendo contexto para contacto ${contact.phone}`, error);
      return additionalContext;
    }
  }
  
  /**
   * Calcular tiempo promedio de respuesta
   * @private
   * @param {object[]} messages - Mensajes de la conversación
   * @returns {number} Tiempo promedio en horas
   */
  calculateAverageResponseTime(messages) {
    const responseTimes = [];
    
    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i];
      const next = messages[i + 1];
      
      // Si hay un mensaje entrante seguido de uno saliente
      if (current.direction === 'inbound' && next.direction === 'outbound') {
        const responseTime = (new Date(next.createdAt) - new Date(current.createdAt)) / (1000 * 60 * 60);
        responseTimes.push(responseTime);
      }
    }
    
    if (responseTimes.length === 0) return 0;
    
    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }
  
  /**
   * Obtener contactos para procesamiento
   * @private
   * @param {number} limit - Límite de contactos
   * @param {boolean} skipRecent - Omitir procesados recientemente
   * @returns {Promise<object[]>} Lista de contactos
   */
  async getContactsForProcessing(limit, skipRecent) {
    const contacts = await this.contactService.getAllContacts({ 
      limit, 
      status: 'active' 
    });
    
    if (!skipRecent) {
      return contacts.contacts;
    }
    
    // Filtrar contactos procesados en las últimas 2 horas
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    return contacts.contacts.filter(contact => {
      const lastProcessed = contact.lastAutomationProcessed;
      return !lastProcessed || new Date(lastProcessed) < twoHoursAgo;
    });
  }
}

// Instancia singleton del servicio
let serviceInstance = null;

/**
 * Obtener instancia del servicio de automatización
 * @returns {AutomationService} Instancia del servicio
 */
export function getAutomationService() {
  if (!serviceInstance) {
    serviceInstance = new AutomationService();
  }
  return serviceInstance;
}

export default AutomationService;
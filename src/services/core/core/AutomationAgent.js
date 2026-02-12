/**
 * Agente de Automatización Event-Driven
 * 
 * Transforma el módulo de automatización en un agente inteligente que maneja
 * reglas, workflows, triggers y ejecución automática de forma reactiva.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from './logger.js';
import { getDatabase } from './database.js';
import { Rule } from '../core/Rule.js';

const logger = createLogger('AUTOMATION_AGENT');

export class AutomationAgent {
  constructor(eventHub) {
    this.eventHub = eventHub;
    this.logger = logger;
    this.agentId = 'automation-agent';
    this.isActive = false;
    
    // Configuraciones evolutivas
    this.config = {
      // Evaluación de reglas
      evaluation: {
        enabled: true,
        batchSize: 50,
        maxConcurrent: 10,
        retryAttempts: 3,
        timeoutMs: 30000,
        cooldownMs: 5000
      },
      
      // Ejecución de workflows
      execution: {
        enabled: true,
        maxParallel: 5,
        queueSize: 1000,
        priorityLevels: 5,
        timeoutMs: 60000,
        retryDelayMs: 2000
      },
      
      // Triggers automáticos
      triggers: {
        enabled: true,
        realTimeProcessing: true,
        batchProcessing: true,
        scheduleInterval: 300000, // 5 minutos
        maxTriggerDepth: 10
      },
      
      // Optimización
      optimization: {
        enabled: true,
        ruleOptimization: true,
        performanceMonitoring: true,
        adaptivePriority: true,
        cacheResults: true,
        cacheExpiryMs: 600000 // 10 minutos
      },
      
      // Análisis y aprendizaje
      analytics: {
        enabled: true,
        patternDetection: true,
        performanceAnalysis: true,
        successRateTracking: true,
        anomalyDetection: true
      },
      
      // Alertas y monitoreo
      alerts: {
        enabled: true,
        failureThreshold: 5,
        performanceThreshold: 1000,
        queueSizeThreshold: 500,
        errorRateThreshold: 0.1
      }
    };
    
    // Estado del agente
    this.state = {
      rulesTotal: 0,
      rulesActive: 0,
      workflowsRunning: 0,
      triggersActive: 0,
      lastActivity: null,
      eventsProcessed: 0,
      errors: 0
    };
    
    // Gestión de reglas y workflows
    this.rules = new Map();
    this.workflows = new Map();
    this.triggers = new Map();
    this.schedules = new Map();
    this.ruleCache = new Map();
    this.executionHistory = new Map();
    
    // Sistema de colas y procesamiento
    this.queues = {
      evaluation: [],
      execution: [],
      triggers: [],
      schedules: [],
      optimization: []
    };
    
    // Métricas evolutivas
    this.metrics = {
      rules: {
        created: 0,
        updated: 0,
        deleted: 0,
        executed: 0,
        failed: 0,
        avgExecutionTime: 0
      },
      workflows: {
        started: 0,
        completed: 0,
        failed: 0,
        avgDuration: 0,
        successRate: 0
      },
      triggers: {
        fired: 0,
        processed: 0,
        skipped: 0,
        avgResponseTime: 0
      },
      performance: {
        queueSize: 0,
        processingTime: 0,
        memoryUsage: 0,
        errorRate: 0,
        throughput: 0
      }
    };
    
    // Sistema de análisis y patrones
    this.patterns = {
      rulePerformance: new Map(),
      triggerFrequency: new Map(),
      executionPatterns: new Map(),
      errorPatterns: new Map(),
      optimizationSuggestions: []
    };
    
    // Timers y control
    this.timers = {
      evaluation: null,
      optimization: null,
      analytics: null,
      cleanup: null
    };
    
    this.mutex = {
      evaluation: false,
      execution: false,
      optimization: false
    };
    
    this.db = getDatabase();
  }
  
  /**
   * Inicializar el agente
   */
  async initialize() {
    try {
      this.logger.info('Inicializando AutomationAgent...');
      
      await this.loadRules();
      await this.loadWorkflows();
      await this.loadTriggers();
      await this.loadState();
      
      this.setupEventListeners();
      
      this.logger.info(`AutomationAgent inicializado - ${this.rules.size} reglas, ${this.workflows.size} workflows`);
      return true;
    } catch (error) {
      this.logger.error('Error inicializando AutomationAgent:', error);
      throw error;
    }
  }
  
  /**
   * Activar el agente
   */
  async activate() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.state.lastActivity = new Date().toISOString();
    
    // Iniciar timers de procesamiento
    this.startEvaluationTimer();
    this.startOptimizationTimer();
    this.startAnalyticsTimer();
    this.startCleanupTimer();
    
    this.eventHub.emit('agent:activated', {
      agentId: this.agentId,
      timestamp: new Date().toISOString()
    });
    
    this.logger.info('AutomationAgent activado');
  }
  
  /**
   * Desactivar el agente
   */
  async deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Detener timers
    this.stopTimers();
    
    // Procesar colas restantes
    await this.processRemainingQueues();
    
    // Guardar estado
    await this.saveState();
    
    this.eventHub.emit('agent:deactivated', {
      agentId: this.agentId,
      timestamp: new Date().toISOString()
    });
    
    this.logger.info('AutomationAgent desactivado');
  }
  
  /**
   * Configurar listeners de eventos
   */
  setupEventListeners() {
    // Eventos del sistema
    this.eventHub.on('system:shutdown', this.handleSystemShutdown.bind(this));
    this.eventHub.on('system:restart', this.handleSystemRestart.bind(this));
    
    // Eventos de automatización
    this.eventHub.on('automation:rule:create', this.handleRuleCreate.bind(this));
    this.eventHub.on('automation:rule:update', this.handleRuleUpdate.bind(this));
    this.eventHub.on('automation:rule:delete', this.handleRuleDelete.bind(this));
    this.eventHub.on('automation:rule:execute', this.handleRuleExecute.bind(this));
    this.eventHub.on('automation:workflow:start', this.handleWorkflowStart.bind(this));
    this.eventHub.on('automation:workflow:complete', this.handleWorkflowComplete.bind(this));
    this.eventHub.on('automation:trigger:fire', this.handleTriggerFire.bind(this));
    this.eventHub.on('automation:schedule:run', this.handleScheduleRun.bind(this));
    
    // Eventos de contactos y mensajes
    this.eventHub.on('contact:created', this.handleContactEvent.bind(this));
    this.eventHub.on('contact:updated', this.handleContactEvent.bind(this));
    this.eventHub.on('message:received', this.handleMessageEvent.bind(this));
    this.eventHub.on('message:sent', this.handleMessageEvent.bind(this));
    
    // Eventos de optimización
    this.eventHub.on('automation:optimize', this.handleOptimization.bind(this));
    this.eventHub.on('automation:analyze', this.handleAnalytics.bind(this));
  }
  
  /**
   * Manejar creación de regla
   */
  async handleRuleCreate(event) {
    try {
      const { ruleData } = event;
      const rule = new Rule(ruleData);
      
      this.rules.set(rule.id, rule);
      this.state.rulesTotal++;
      if (rule.isActive) this.state.rulesActive++;
      
      this.metrics.rules.created++;
      this.updateMetrics();
      
      // Evaluar regla inmediatamente si es de tipo inmediato
      if (rule.triggerType === 'immediate' && rule.isActive) {
        this.queues.evaluation.push({
          type: 'rule_evaluation',
          ruleId: rule.id,
          priority: rule.priority,
          timestamp: Date.now()
        });
      }
      
      this.logger.info(`Regla creada: ${rule.name} (${rule.id})`);
      
      this.eventHub.emit('automation:rule:created', {
        ruleId: rule.id,
        ruleName: rule.name,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError('handleRuleCreate', error, event);
    }
  }
  
  /**
   * Manejar actualización de regla
   */
  async handleRuleUpdate(event) {
    try {
      const { ruleId, updateData } = event;
      const existingRule = this.rules.get(ruleId);
      
      if (!existingRule) {
        throw new Error(`Regla ${ruleId} no encontrada`);
      }
      
      const wasActive = existingRule.isActive;
      const updatedRuleData = { ...existingRule.toJSON(), ...updateData };
      const updatedRule = new Rule(updatedRuleData);
      
      this.rules.set(ruleId, updatedRule);
      
      // Actualizar contadores de estado
      if (wasActive && !updatedRule.isActive) {
        this.state.rulesActive--;
      } else if (!wasActive && updatedRule.isActive) {
        this.state.rulesActive++;
      }
      
      this.metrics.rules.updated++;
      this.updateMetrics();
      
      // Limpiar cache relacionado
      this.clearRuleCache(ruleId);
      
      this.logger.info(`Regla actualizada: ${updatedRule.name} (${ruleId})`);
      
      this.eventHub.emit('automation:rule:updated', {
        ruleId,
        ruleName: updatedRule.name,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError('handleRuleUpdate', error, event);
    }
  }
  
  /**
   * Manejar eliminación de regla
   */
  async handleRuleDelete(event) {
    try {
      const { ruleId } = event;
      const rule = this.rules.get(ruleId);
      
      if (!rule) {
        throw new Error(`Regla ${ruleId} no encontrada`);
      }
      
      this.rules.delete(ruleId);
      this.state.rulesTotal--;
      if (rule.isActive) this.state.rulesActive--;
      
      this.metrics.rules.deleted++;
      this.updateMetrics();
      
      // Limpiar cache y datos relacionados
      this.clearRuleCache(ruleId);
      this.executionHistory.delete(ruleId);
      this.patterns.rulePerformance.delete(ruleId);
      
      this.logger.info(`Regla eliminada: ${rule.name} (${ruleId})`);
      
      this.eventHub.emit('automation:rule:deleted', {
        ruleId,
        ruleName: rule.name,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError('handleRuleDelete', error, event);
    }
  }
  
  /**
   * Manejar ejecución de regla
   */
  async handleRuleExecute(event) {
    try {
      const { ruleId, contactId, context = {} } = event;
      const rule = this.rules.get(ruleId);
      
      if (!rule || !rule.isActive) {
        throw new Error(`Regla ${ruleId} no encontrada o inactiva`);
      }
      
      // Añadir a cola de ejecución
      this.queues.execution.push({
        type: 'rule_execution',
        ruleId,
        contactId,
        context,
        priority: rule.priority,
        timestamp: Date.now(),
        retries: 0
      });
      
      this.logger.debug(`Regla añadida a cola de ejecución: ${rule.name} (${ruleId})`);
    } catch (error) {
      this.handleError('handleRuleExecute', error, event);
    }
  }
  
  /**
   * Manejar inicio de workflow
   */
  async handleWorkflowStart(event) {
    try {
      const { workflowId, contactId, context = {} } = event;
      
      const workflow = {
        id: workflowId,
        contactId,
        context,
        startTime: Date.now(),
        status: 'running',
        steps: [],
        currentStep: 0
      };
      
      this.workflows.set(workflowId, workflow);
      this.state.workflowsRunning++;
      this.metrics.workflows.started++;
      
      this.logger.info(`Workflow iniciado: ${workflowId} para contacto ${contactId}`);
      
      this.eventHub.emit('automation:workflow:started', {
        workflowId,
        contactId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError('handleWorkflowStart', error, event);
    }
  }
  
  /**
   * Manejar finalización de workflow
   */
  async handleWorkflowComplete(event) {
    try {
      const { workflowId, success = true, result = {} } = event;
      const workflow = this.workflows.get(workflowId);
      
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} no encontrado`);
      }
      
      workflow.status = success ? 'completed' : 'failed';
      workflow.endTime = Date.now();
      workflow.duration = workflow.endTime - workflow.startTime;
      workflow.result = result;
      
      this.state.workflowsRunning--;
      
      if (success) {
        this.metrics.workflows.completed++;
      } else {
        this.metrics.workflows.failed++;
      }
      
      // Actualizar métricas de duración
      this.updateWorkflowMetrics(workflow);
      
      this.logger.info(`Workflow ${success ? 'completado' : 'fallido'}: ${workflowId}`);
      
      this.eventHub.emit('automation:workflow:finished', {
        workflowId,
        success,
        duration: workflow.duration,
        timestamp: new Date().toISOString()
      });
      
      // Mover a historial después de un tiempo
      setTimeout(() => {
        this.workflows.delete(workflowId);
      }, 300000); // 5 minutos
    } catch (error) {
      this.handleError('handleWorkflowComplete', error, event);
    }
  }
  
  /**
   * Manejar disparo de trigger
   */
  async handleTriggerFire(event) {
    try {
      const { triggerType, data, context = {} } = event;
      
      // Buscar reglas que coincidan con el trigger
      const matchingRules = Array.from(this.rules.values())
        .filter(rule => rule.isActive && rule.triggerType === triggerType);
      
      this.metrics.triggers.fired++;
      
      for (const rule of matchingRules) {
        // Evaluar condiciones del trigger
        if (await this.evaluateTriggerConditions(rule, data, context)) {
          this.queues.execution.push({
            type: 'trigger_execution',
            ruleId: rule.id,
            triggerType,
            data,
            context,
            priority: rule.priority,
            timestamp: Date.now(),
            retries: 0
          });
          
          this.metrics.triggers.processed++;
        } else {
          this.metrics.triggers.skipped++;
        }
      }
      
      this.updateTriggerPatterns(triggerType);
      
      this.logger.debug(`Trigger procesado: ${triggerType}, ${matchingRules.length} reglas evaluadas`);
    } catch (error) {
      this.handleError('handleTriggerFire', error, event);
    }
  }
  
  /**
   * Manejar eventos de contacto
   */
  async handleContactEvent(event) {
    try {
      const { contactId, action, data } = event;
      
      // Disparar triggers relacionados con contactos
      this.eventHub.emit('automation:trigger:fire', {
        triggerType: `contact:${action}`,
        data: { contactId, ...data },
        context: { source: 'contact_event' }
      });
    } catch (error) {
      this.handleError('handleContactEvent', error, event);
    }
  }
  
  /**
   * Manejar eventos de mensaje
   */
  async handleMessageEvent(event) {
    try {
      const { messageId, contactId, direction, content } = event;
      
      // Disparar triggers relacionados con mensajes
      this.eventHub.emit('automation:trigger:fire', {
        triggerType: `message:${direction}`,
        data: { messageId, contactId, content },
        context: { source: 'message_event' }
      });
    } catch (error) {
      this.handleError('handleMessageEvent', error, event);
    }
  }
  
  /**
   * Procesar cola de evaluación
   */
  async processEvaluationQueue() {
    if (this.mutex.evaluation || this.queues.evaluation.length === 0) return;
    
    this.mutex.evaluation = true;
    
    try {
      const batch = this.queues.evaluation.splice(0, this.config.evaluation.batchSize);
      const startTime = Date.now();
      
      await Promise.all(
        batch.map(item => this.processEvaluationItem(item))
      );
      
      const processingTime = Date.now() - startTime;
      this.metrics.performance.processingTime = processingTime;
      
      this.logger.debug(`Procesado lote de evaluación: ${batch.length} elementos en ${processingTime}ms`);
    } catch (error) {
      this.logger.error('Error procesando cola de evaluación:', error);
    } finally {
      this.mutex.evaluation = false;
    }
  }
  
  /**
   * Procesar elemento de evaluación
   */
  async processEvaluationItem(item) {
    try {
      const { type, ruleId } = item;
      const rule = this.rules.get(ruleId);
      
      if (!rule || !rule.isActive) return;
      
      // Implementar lógica de evaluación específica según el tipo
      switch (type) {
      case 'rule_evaluation':
        await this.evaluateRuleForAllContacts(rule);
        break;
      case 'scheduled_evaluation':
        await this.evaluateScheduledRule(rule, item);
        break;
      default:
        this.logger.warn(`Tipo de evaluación desconocido: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Error procesando evaluación ${item.type}:`, error);
    }
  }
  
  /**
   * Procesar cola de ejecución
   */
  async processExecutionQueue() {
    if (this.mutex.execution || this.queues.execution.length === 0) return;
    
    this.mutex.execution = true;
    
    try {
      // Ordenar por prioridad
      this.queues.execution.sort((a, b) => b.priority - a.priority);
      
      const batch = this.queues.execution.splice(0, this.config.execution.maxParallel);
      
      await Promise.all(
        batch.map(item => this.processExecutionItem(item))
      );
      
      this.logger.debug(`Procesado lote de ejecución: ${batch.length} elementos`);
    } catch (error) {
      this.logger.error('Error procesando cola de ejecución:', error);
    } finally {
      this.mutex.execution = false;
    }
  }
  
  /**
   * Procesar elemento de ejecución
   */
  async processExecutionItem(item) {
    const startTime = Date.now();
    
    try {
      const { type, ruleId, contactId, context } = item;
      const rule = this.rules.get(ruleId);
      
      if (!rule || !rule.isActive) return;
      
      // Ejecutar regla
      const result = await this.executeRule(rule, contactId, context);
      
      const executionTime = Date.now() - startTime;
      
      if (result.success) {
        this.metrics.rules.executed++;
        this.updateRulePerformance(ruleId, executionTime, true);
      } else {
        this.metrics.rules.failed++;
        this.updateRulePerformance(ruleId, executionTime, false);
        
        // Reintentar si es necesario
        if (item.retries < this.config.evaluation.retryAttempts) {
          item.retries++;
          setTimeout(() => {
            this.queues.execution.push(item);
          }, this.config.execution.retryDelayMs * Math.pow(2, item.retries));
        }
      }
      
      this.logger.debug(`Regla ejecutada: ${rule.name} en ${executionTime}ms`);
    } catch (error) {
      this.logger.error(`Error ejecutando regla ${item.ruleId}:`, error);
      this.metrics.rules.failed++;
    }
  }
  
  /**
   * Ejecutar regla
   */
  async executeRule(rule, contactId, context) {
    try {
      // Obtener datos del contacto
      const contact = await this.getContactData(contactId);
      if (!contact) {
        throw new Error(`Contacto ${contactId} no encontrado`);
      }
      
      // Evaluar condiciones de la regla
      const evaluationResult = await rule.evaluate(contact, context);
      if (!evaluationResult) {
        return { success: false, reason: 'Condiciones no cumplidas' };
      }
      
      // Ejecutar acciones de la regla
      const executionResult = await rule.execute(contact, context);
      
      // Actualizar contadores
      rule.executionCount = (rule.executionCount || 0) + 1;
      rule.lastExecuted = new Date().toISOString();
      
      return {
        success: true,
        result: executionResult,
        executionCount: rule.executionCount
      };
    } catch (error) {
      this.logger.error(`Error ejecutando regla ${rule.id}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Evaluar condiciones de trigger
   */
  async evaluateTriggerConditions(rule, data, context) {
    try {
      // Implementar lógica de evaluación de condiciones
      // Esto dependerá de la estructura específica de las reglas
      
      if (!rule.conditions || rule.conditions.length === 0) {
        return true; // Sin condiciones = siempre se ejecuta
      }
      
      for (const condition of rule.conditions) {
        const result = await this.evaluateCondition(condition, data, context);
        if (!result) {
          return false; // Todas las condiciones deben cumplirse
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error evaluando condiciones de trigger:', error);
      return false;
    }
  }
  
  /**
   * Evaluar condición individual
   */
  async evaluateCondition(condition, data, context) {
    try {
      const { field, operator, value } = condition;
      const fieldValue = this.getFieldValue(field, data, context);
      
      switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).includes(value);
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      default:
        this.logger.warn(`Operador desconocido: ${operator}`);
        return false;
      }
    } catch (error) {
      this.logger.error('Error evaluando condición:', error);
      return false;
    }
  }
  
  /**
   * Obtener valor de campo
   */
  getFieldValue(field, data, context) {
    try {
      // Buscar en data primero
      if (data && data.hasOwnProperty(field)) {
        return data[field];
      }
      
      // Buscar en context
      if (context && context.hasOwnProperty(field)) {
        return context[field];
      }
      
      // Buscar en campos anidados (ej: "contact.name")
      const parts = field.split('.');
      let value = data;
      
      for (const part of parts) {
        if (value && value.hasOwnProperty(part)) {
          value = value[part];
        } else {
          return undefined;
        }
      }
      
      return value;
    } catch (error) {
      this.logger.error(`Error obteniendo valor de campo ${field}:`, error);
      return undefined;
    }
  }
  
  /**
   * Optimización del agente
   */
  async handleOptimization() {
    if (this.mutex.optimization) return;
    
    this.mutex.optimization = true;
    
    try {
      this.logger.info('Iniciando optimización del AutomationAgent...');
      
      // Optimizar reglas
      await this.optimizeRules();
      
      // Optimizar colas
      await this.optimizeQueues();
      
      // Limpiar cache
      await this.cleanupCache();
      
      // Analizar patrones
      await this.analyzePatterns();
      
      this.logger.info('Optimización completada');
    } catch (error) {
      this.logger.error('Error en optimización:', error);
    } finally {
      this.mutex.optimization = false;
    }
  }
  
  /**
   * Optimizar reglas
   */
  async optimizeRules() {
    try {
      // Identificar reglas con bajo rendimiento
      const lowPerformanceRules = [];
      
      for (const [ruleId, performance] of this.patterns.rulePerformance) {
        if (performance.successRate < 0.5 || performance.avgExecutionTime > 5000) {
          lowPerformanceRules.push(ruleId);
        }
      }
      
      // Sugerir optimizaciones
      if (lowPerformanceRules.length > 0) {
        this.patterns.optimizationSuggestions.push({
          type: 'low_performance_rules',
          rules: lowPerformanceRules,
          timestamp: Date.now(),
          suggestion: 'Revisar condiciones y acciones de estas reglas'
        });
      }
      
      // Reordenar reglas por prioridad y rendimiento
      const sortedRules = Array.from(this.rules.values())
        .sort((a, b) => {
          const perfA = this.patterns.rulePerformance.get(a.id);
          const perfB = this.patterns.rulePerformance.get(b.id);
          
          if (perfA && perfB) {
            return (perfB.successRate * perfB.priority) - (perfA.successRate * perfA.priority);
          }
          
          return b.priority - a.priority;
        });
      
      this.logger.debug(`Optimización de reglas completada: ${lowPerformanceRules.length} reglas identificadas para mejora`);
    } catch (error) {
      this.logger.error('Error optimizando reglas:', error);
    }
  }
  
  /**
   * Optimizar colas
   */
  async optimizeQueues() {
    try {
      // Limpiar elementos expirados
      const now = Date.now();
      const maxAge = 3600000; // 1 hora
      
      for (const queueName in this.queues) {
        const queue = this.queues[queueName];
        const originalLength = queue.length;
        
        this.queues[queueName] = queue.filter(item => 
          (now - item.timestamp) < maxAge
        );
        
        const removed = originalLength - this.queues[queueName].length;
        if (removed > 0) {
          this.logger.debug(`Limpiados ${removed} elementos expirados de cola ${queueName}`);
        }
      }
      
      // Reordenar por prioridad
      for (const queueName in this.queues) {
        this.queues[queueName].sort((a, b) => b.priority - a.priority);
      }
    } catch (error) {
      this.logger.error('Error optimizando colas:', error);
    }
  }
  
  /**
   * Limpiar cache
   */
  async cleanupCache() {
    try {
      const now = Date.now();
      const maxAge = this.config.optimization.cacheExpiryMs;
      
      for (const [key, entry] of this.ruleCache) {
        if ((now - entry.timestamp) > maxAge) {
          this.ruleCache.delete(key);
        }
      }
      
      this.logger.debug(`Cache limpiado: ${this.ruleCache.size} entradas restantes`);
    } catch (error) {
      this.logger.error('Error limpiando cache:', error);
    }
  }
  
  /**
   * Analizar patrones
   */
  async analyzePatterns() {
    try {
      // Analizar patrones de ejecución
      this.analyzeExecutionPatterns();
      
      // Analizar frecuencia de triggers
      this.analyzeTriggerFrequency();
      
      // Detectar anomalías
      this.detectAnomalies();
      
      this.logger.debug('Análisis de patrones completado');
    } catch (error) {
      this.logger.error('Error analizando patrones:', error);
    }
  }
  
  /**
   * Analizar patrones de ejecución
   */
  analyzeExecutionPatterns() {
    try {
      const now = Date.now();
      const oneHour = 3600000;
      const patterns = new Map();
      
      // Analizar ejecuciones por hora
      for (const [ruleId, performance] of this.patterns.rulePerformance) {
        const hourlyExecutions = performance.executions.filter(exec => 
          (now - exec.timestamp) < oneHour
        ).length;
        
        patterns.set(ruleId, {
          hourlyExecutions,
          avgExecutionTime: performance.avgExecutionTime,
          successRate: performance.successRate
        });
      }
      
      this.patterns.executionPatterns = patterns;
    } catch (error) {
      this.logger.error('Error analizando patrones de ejecución:', error);
    }
  }
  
  /**
   * Analizar frecuencia de triggers
   */
  analyzeTriggerFrequency() {
    try {
      const now = Date.now();
      const oneHour = 3600000;
      const frequency = new Map();
      
      for (const [triggerType, data] of this.patterns.triggerFrequency) {
        const recentFires = data.fires.filter(fire => 
          (now - fire.timestamp) < oneHour
        ).length;
        
        frequency.set(triggerType, {
          hourlyFires: recentFires,
          totalFires: data.fires.length,
          avgResponseTime: data.avgResponseTime
        });
      }
      
      this.patterns.triggerFrequency = frequency;
    } catch (error) {
      this.logger.error('Error analizando frecuencia de triggers:', error);
    }
  }
  
  /**
   * Detectar anomalías
   */
  detectAnomalies() {
    try {
      const anomalies = [];
      
      // Detectar picos de errores
      if (this.metrics.performance.errorRate > this.config.alerts.errorRateThreshold) {
        anomalies.push({
          type: 'high_error_rate',
          value: this.metrics.performance.errorRate,
          threshold: this.config.alerts.errorRateThreshold,
          timestamp: Date.now()
        });
      }
      
      // Detectar colas sobrecargadas
      const totalQueueSize = Object.values(this.queues).reduce((sum, queue) => sum + queue.length, 0);
      if (totalQueueSize > this.config.alerts.queueSizeThreshold) {
        anomalies.push({
          type: 'queue_overload',
          value: totalQueueSize,
          threshold: this.config.alerts.queueSizeThreshold,
          timestamp: Date.now()
        });
      }
      
      // Detectar rendimiento degradado
      if (this.metrics.performance.processingTime > this.config.alerts.performanceThreshold) {
        anomalies.push({
          type: 'performance_degradation',
          value: this.metrics.performance.processingTime,
          threshold: this.config.alerts.performanceThreshold,
          timestamp: Date.now()
        });
      }
      
      if (anomalies.length > 0) {
        this.eventHub.emit('automation:anomaly:detected', {
          agentId: this.agentId,
          anomalies,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Error detectando anomalías:', error);
    }
  }
  
  /**
   * Cargar reglas desde la base de datos
   */
  async loadRules() {
    try {
      const rulesData = await this.db.read(this.db.files.RULES) || [];
      
      for (const ruleData of rulesData) {
        const rule = Rule.fromJSON(ruleData);
        this.rules.set(rule.id, rule);
        
        if (rule.isActive) {
          this.state.rulesActive++;
        }
      }
      
      this.state.rulesTotal = this.rules.size;
      this.logger.info(`Cargadas ${this.rules.size} reglas (${this.state.rulesActive} activas)`);
    } catch (error) {
      this.logger.error('Error cargando reglas:', error);
    }
  }
  
  /**
   * Cargar workflows
   */
  async loadWorkflows() {
    try {
      // Implementar carga de workflows desde base de datos
      this.logger.debug('Workflows cargados');
    } catch (error) {
      this.logger.error('Error cargando workflows:', error);
    }
  }
  
  /**
   * Cargar triggers
   */
  async loadTriggers() {
    try {
      // Implementar carga de triggers desde base de datos
      this.logger.debug('Triggers cargados');
    } catch (error) {
      this.logger.error('Error cargando triggers:', error);
    }
  }
  
  /**
   * Obtener datos del contacto
   */
  async getContactData(contactId) {
    try {
      // Implementar obtención de datos del contacto
      // Esto se conectaría con el ContactsAgent o servicio de contactos
      return null;
    } catch (error) {
      this.logger.error(`Error obteniendo datos del contacto ${contactId}:`, error);
      return null;
    }
  }
  
  /**
   * Actualizar métricas
   */
  updateMetrics() {
    this.state.eventsProcessed++;
    this.state.lastActivity = new Date().toISOString();
    
    // Calcular métricas derivadas
    const totalWorkflows = this.metrics.workflows.started;
    if (totalWorkflows > 0) {
      this.metrics.workflows.successRate = 
        this.metrics.workflows.completed / totalWorkflows;
    }
    
    const totalRuleExecutions = this.metrics.rules.executed + this.metrics.rules.failed;
    if (totalRuleExecutions > 0) {
      this.metrics.performance.errorRate = 
        this.metrics.rules.failed / totalRuleExecutions;
    }
    
    // Actualizar métricas de rendimiento
    this.metrics.performance.queueSize = 
      Object.values(this.queues).reduce((sum, queue) => sum + queue.length, 0);
  }
  
  /**
   * Actualizar métricas de workflow
   */
  updateWorkflowMetrics(workflow) {
    const durations = Array.from(this.workflows.values())
      .filter(w => w.status === 'completed' && w.duration)
      .map(w => w.duration);
    
    if (durations.length > 0) {
      this.metrics.workflows.avgDuration = 
        durations.reduce((sum, d) => sum + d, 0) / durations.length;
    }
  }
  
  /**
   * Actualizar rendimiento de regla
   */
  updateRulePerformance(ruleId, executionTime, success) {
    if (!this.patterns.rulePerformance.has(ruleId)) {
      this.patterns.rulePerformance.set(ruleId, {
        executions: [],
        totalExecutions: 0,
        successfulExecutions: 0,
        avgExecutionTime: 0,
        successRate: 0
      });
    }
    
    const performance = this.patterns.rulePerformance.get(ruleId);
    
    performance.executions.push({
      timestamp: Date.now(),
      executionTime,
      success
    });
    
    performance.totalExecutions++;
    if (success) {
      performance.successfulExecutions++;
    }
    
    // Mantener solo las últimas 100 ejecuciones
    if (performance.executions.length > 100) {
      performance.executions = performance.executions.slice(-100);
    }
    
    // Calcular métricas
    const recentExecutions = performance.executions.slice(-50);
    performance.avgExecutionTime = 
      recentExecutions.reduce((sum, e) => sum + e.executionTime, 0) / recentExecutions.length;
    
    performance.successRate = 
      performance.successfulExecutions / performance.totalExecutions;
  }
  
  /**
   * Actualizar patrones de trigger
   */
  updateTriggerPatterns(triggerType) {
    if (!this.patterns.triggerFrequency.has(triggerType)) {
      this.patterns.triggerFrequency.set(triggerType, {
        fires: [],
        totalFires: 0,
        avgResponseTime: 0
      });
    }
    
    const pattern = this.patterns.triggerFrequency.get(triggerType);
    
    pattern.fires.push({
      timestamp: Date.now()
    });
    
    pattern.totalFires++;
    
    // Mantener solo los últimos 1000 disparos
    if (pattern.fires.length > 1000) {
      pattern.fires = pattern.fires.slice(-1000);
    }
  }
  
  /**
   * Limpiar cache de regla
   */
  clearRuleCache(ruleId) {
    for (const [key, entry] of this.ruleCache) {
      if (entry.ruleId === ruleId) {
        this.ruleCache.delete(key);
      }
    }
  }
  
  /**
   * Iniciar timer de evaluación
   */
  startEvaluationTimer() {
    this.timers.evaluation = setInterval(() => {
      this.processEvaluationQueue();
    }, 5000); // Cada 5 segundos
  }
  
  /**
   * Iniciar timer de optimización
   */
  startOptimizationTimer() {
    this.timers.optimization = setInterval(() => {
      this.handleOptimization();
    }, 300000); // Cada 5 minutos
  }
  
  /**
   * Iniciar timer de analytics
   */
  startAnalyticsTimer() {
    this.timers.analytics = setInterval(() => {
      this.handleAnalytics();
    }, 60000); // Cada minuto
  }
  
  /**
   * Iniciar timer de limpieza
   */
  startCleanupTimer() {
    this.timers.cleanup = setInterval(() => {
      this.cleanupCache();
    }, 600000); // Cada 10 minutos
  }
  
  /**
   * Detener timers
   */
  stopTimers() {
    for (const timer in this.timers) {
      if (this.timers[timer]) {
        clearInterval(this.timers[timer]);
        this.timers[timer] = null;
      }
    }
  }
  
  /**
   * Procesar colas restantes
   */
  async processRemainingQueues() {
    try {
      // Procesar elementos restantes en las colas
      await this.processEvaluationQueue();
      await this.processExecutionQueue();
      
      this.logger.info('Colas procesadas antes del apagado');
    } catch (error) {
      this.logger.error('Error procesando colas restantes:', error);
    }
  }
  
  /**
   * Manejar apagado del sistema
   */
  async handleSystemShutdown() {
    this.logger.info('Iniciando apagado del AutomationAgent...');
    await this.deactivate();
  }
  
  /**
   * Manejar reinicio del sistema
   */
  async handleSystemRestart() {
    this.logger.info('Reiniciando AutomationAgent...');
    await this.deactivate();
    await this.initialize();
    await this.activate();
  }
  
  /**
   * Manejar analytics
   */
  async handleAnalytics() {
    try {
      this.analyzePatterns();
      this.updateMetrics();
      
      // Emitir métricas
      this.eventHub.emit('automation:metrics:updated', {
        agentId: this.agentId,
        metrics: this.metrics,
        state: this.state,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error en analytics:', error);
    }
  }
  
  /**
   * Guardar estado del agente
   */
  async saveState() {
    try {
      const stateData = {
        state: this.state,
        metrics: this.metrics,
        patterns: {
          rulePerformance: Array.from(this.patterns.rulePerformance.entries()),
          triggerFrequency: Array.from(this.patterns.triggerFrequency.entries()),
          executionPatterns: Array.from(this.patterns.executionPatterns.entries()),
          optimizationSuggestions: this.patterns.optimizationSuggestions
        },
        timestamp: new Date().toISOString()
      };
      
      await this.db.write('automation_agent_state.json', stateData);
      this.logger.debug('Estado del agente guardado');
    } catch (error) {
      this.logger.error('Error guardando estado:', error);
    }
  }
  
  /**
   * Cargar estado del agente
   */
  async loadState() {
    try {
      const stateData = await this.db.read('automation_agent_state.json');
      
      if (stateData) {
        this.state = { ...this.state, ...stateData.state };
        this.metrics = { ...this.metrics, ...stateData.metrics };
        
        if (stateData.patterns) {
          this.patterns.rulePerformance = new Map(stateData.patterns.rulePerformance || []);
          this.patterns.triggerFrequency = new Map(stateData.patterns.triggerFrequency || []);
          this.patterns.executionPatterns = new Map(stateData.patterns.executionPatterns || []);
          this.patterns.optimizationSuggestions = stateData.patterns.optimizationSuggestions || [];
        }
        
        this.logger.debug('Estado del agente cargado');
      }
    } catch (error) {
      this.logger.error('Error cargando estado:', error);
    }
  }
  
  /**
   * Obtener información del agente
   */
  getAgentInfo() {
    return {
      agentId: this.agentId,
      isActive: this.isActive,
      state: this.state,
      metrics: this.metrics,
      config: this.config,
      queueSizes: Object.fromEntries(
        Object.entries(this.queues).map(([name, queue]) => [name, queue.length])
      ),
      rulesCount: this.rules.size,
      workflowsCount: this.workflows.size,
      triggersCount: this.triggers.size
    };
  }
  
  /**
   * Obtener estadísticas del agente
   */
  getAgentStats() {
    return {
      agentId: this.agentId,
      uptime: this.isActive ? Date.now() - new Date(this.state.lastActivity).getTime() : 0,
      performance: this.metrics.performance,
      rules: this.metrics.rules,
      workflows: this.metrics.workflows,
      triggers: this.metrics.triggers,
      patterns: {
        topPerformingRules: this.getTopPerformingRules(),
        mostFrequentTriggers: this.getMostFrequentTriggers(),
        optimizationSuggestions: this.patterns.optimizationSuggestions.slice(-5)
      }
    };
  }
  
  /**
   * Obtener reglas con mejor rendimiento
   */
  getTopPerformingRules() {
    return Array.from(this.patterns.rulePerformance.entries())
      .sort((a, b) => b[1].successRate - a[1].successRate)
      .slice(0, 5)
      .map(([ruleId, performance]) => ({
        ruleId,
        successRate: performance.successRate,
        avgExecutionTime: performance.avgExecutionTime,
        totalExecutions: performance.totalExecutions
      }));
  }
  
  /**
   * Obtener triggers más frecuentes
   */
  getMostFrequentTriggers() {
    return Array.from(this.patterns.triggerFrequency.entries())
      .sort((a, b) => b[1].totalFires - a[1].totalFires)
      .slice(0, 5)
      .map(([triggerType, data]) => ({
        triggerType,
        totalFires: data.totalFires,
        avgResponseTime: data.avgResponseTime
      }));
  }
  
  /**
   * Manejar errores
   */
  handleError(method, error, context = {}) {
    this.state.errors++;
    this.logger.error(`Error en ${method}:`, error, context);
    
    this.eventHub.emit('automation:error', {
      agentId: this.agentId,
      method,
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Destruir el agente
   */
  async destroy() {
    await this.deactivate();
    this.rules.clear();
    this.workflows.clear();
    this.triggers.clear();
    this.patterns.rulePerformance.clear();
    this.patterns.triggerFrequency.clear();
    this.patterns.executionPatterns.clear();
    
    this.logger.info('AutomationAgent destruido');
  }
}

export default AutomationAgent;
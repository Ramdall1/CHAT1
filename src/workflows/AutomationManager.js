import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import WorkflowEngine from './WorkflowEngine.js';
import RuleEngine from './RuleEngine.js';

/**
 * Gestor de automatización que coordina workflows y reglas de negocio
 * Proporciona una interfaz unificada para la automatización completa
 */
class AutomationManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración general
      enabled: config.enabled !== false,
      maxAutomations: config.maxAutomations || 500,
            
      // Configuración de workflows
      workflows: {
        enabled: config.workflows?.enabled !== false,
        config: config.workflows?.config || {}
      },
            
      // Configuración de reglas
      rules: {
        enabled: config.rules?.enabled !== false,
        config: config.rules?.config || {}
      },
            
      // Configuración de integración
      integration: {
        shareVariables: config.integration?.shareVariables !== false,
        shareEvents: config.integration?.shareEvents !== false,
        crossTriggers: config.integration?.crossTriggers !== false,
        conflictResolution: config.integration?.conflictResolution || 'priority' // priority, first, last
      },
            
      // Configuración de eventos
      events: {
        enabled: config.events?.enabled !== false,
        maxListeners: config.events?.maxListeners || 100,
        eventHistory: config.events?.eventHistory !== false,
        historySize: config.events?.historySize || 1000
      },
            
      // Configuración de triggers
      triggers: {
        enabled: config.triggers?.enabled !== false,
        debounceTime: config.triggers?.debounceTime || 1000,
        maxPerAutomation: config.triggers?.maxPerAutomation || 10,
        globalTriggers: config.triggers?.globalTriggers || []
      },
            
      // Configuración de contexto
      context: {
        global: config.context?.global || {},
        persistent: config.context?.persistent !== false,
        encryption: config.context?.encryption !== false,
        maxSize: config.context?.maxSize || 10 * 1024 * 1024 // 10MB
      },
            
      // Configuración de monitoreo
      monitoring: {
        enabled: config.monitoring?.enabled !== false,
        healthChecks: config.monitoring?.healthChecks !== false,
        performanceMetrics: config.monitoring?.performanceMetrics !== false,
        alerting: config.monitoring?.alerting !== false
      },
            
      // Configuración de logging
      logging: {
        enabled: config.logging?.enabled !== false,
        level: config.logging?.level || 'info',
        includeContext: config.logging?.includeContext !== false,
        maxLogs: config.logging?.maxLogs || 10000
      }
    };
        
    // Motores
    this.workflowEngine = null;
    this.ruleEngine = null;
        
    // Estado interno
    this.automations = new Map();
    this.globalContext = new Map(Object.entries(this.config.context.global));
    this.eventHistory = [];
    this.triggers = new Map();
    this.logs = [];
    this.metrics = {
      automationsCreated: 0,
      automationsExecuted: 0,
      automationsCompleted: 0,
      automationsFailed: 0,
      eventsProcessed: 0,
      triggersActivated: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0
    };
        
    // Timers
    this.healthCheckTimer = null;
    this.metricsTimer = null;
        
    this.initialized = false;
  }
    
  /**
     * Inicializa el gestor de automatización
     */
  async initialize() {
    if (this.initialized) return;
        
    try {
      this._validateConfig();
            
      // Inicializar motores
      if (this.config.workflows.enabled) {
        this.workflowEngine = new WorkflowEngine(this.config.workflows.config);
        await this.workflowEngine.initialize();
        this._setupWorkflowEngineIntegration();
      }
            
      if (this.config.rules.enabled) {
        this.ruleEngine = new RuleEngine(this.config.rules.config);
        await this.ruleEngine.initialize();
        this._setupRuleEngineIntegration();
      }
            
      this._setupEventHandlers();
      this._setupTimers();
      this._setupGlobalTriggers();
            
      this.initialized = true;
      this.emit('initialized');
            
      this._log('info', 'AutomationManager initialized successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Crea una nueva automatización
     */
  async createAutomation(definition) {
    if (!this.initialized) {
      throw new Error('AutomationManager not initialized');
    }
        
    if (this.automations.size >= this.config.maxAutomations) {
      throw new Error('Maximum number of automations reached');
    }
        
    const automation = {
      id: definition.id || uuidv4(),
      name: definition.name || 'Unnamed Automation',
      description: definition.description || '',
      type: definition.type || 'hybrid', // workflow, rule, hybrid
      enabled: definition.enabled !== false,
            
      // Configuración
      config: {
        priority: definition.config?.priority || 'normal',
        timeout: definition.config?.timeout || 300000, // 5 minutos
        retryAttempts: definition.config?.retryAttempts || 3,
        tags: definition.config?.tags || [],
        category: definition.config?.category || 'general'
      },
            
      // Triggers que activan la automatización
      triggers: this._validateTriggers(definition.triggers || []),
            
      // Definición del workflow (si aplica)
      workflow: definition.workflow || null,
            
      // Definición de reglas (si aplica)
      rules: definition.rules || [],
            
      // Variables locales
      variables: definition.variables || {},
            
      // Condiciones previas
      preconditions: definition.preconditions || [],
            
      // Acciones post-ejecución
      postActions: definition.postActions || [],
            
      // Metadatos
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: definition.metadata?.createdBy || 'system',
        version: definition.metadata?.version || '1.0.0'
      },
            
      // Estadísticas
      stats: {
        executions: 0,
        successes: 0,
        failures: 0,
        averageExecutionTime: 0,
        lastExecution: null,
        lastSuccess: null,
        lastFailure: null
      }
    };
        
    // Validar y crear componentes según el tipo
    await this._createAutomationComponents(automation);
        
    this.automations.set(automation.id, automation);
    this._registerAutomationTriggers(automation);
        
    this.metrics.automationsCreated++;
    this.emit('automationCreated', automation);
        
    this._log('info', `Automation created: ${automation.name} (${automation.id})`);
        
    return automation;
  }
    
  /**
     * Ejecuta una automatización
     */
  async executeAutomation(automationId, context = {}, options = {}) {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation not found: ${automationId}`);
    }
        
    if (!automation.enabled) {
      throw new Error(`Automation is disabled: ${automationId}`);
    }
        
    const executionId = uuidv4();
    const startTime = Date.now();
        
    try {
      // Crear contexto de ejecución
      const executionContext = this._createExecutionContext(automation, context);
            
      // Verificar precondiciones
      if (automation.preconditions.length > 0) {
        const preconditionsResult = await this._evaluatePreconditions(
          automation.preconditions, 
          executionContext
        );
                
        if (!preconditionsResult.passed) {
          throw new Error(`Preconditions not met: ${preconditionsResult.reason}`);
        }
      }
            
      this.metrics.automationsExecuted++;
      automation.stats.executions++;
      automation.stats.lastExecution = new Date().toISOString();
            
      this.emit('automationStarted', automation, executionContext, executionId);
      this._log('info', `Automation execution started: ${automation.name} (${executionId})`);
            
      let result;
            
      // Ejecutar según el tipo de automatización
      switch (automation.type) {
      case 'workflow':
        result = await this._executeWorkflowAutomation(automation, executionContext, options);
        break;
      case 'rule':
        result = await this._executeRuleAutomation(automation, executionContext, options);
        break;
      case 'hybrid':
        result = await this._executeHybridAutomation(automation, executionContext, options);
        break;
      default:
        throw new Error(`Unknown automation type: ${automation.type}`);
      }
            
      // Ejecutar acciones post-ejecución
      if (automation.postActions.length > 0) {
        const postActionsResult = await this._executePostActions(
          automation.postActions,
          executionContext,
          result
        );
        result.postActions = postActionsResult;
      }
            
      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;
      result.executionId = executionId;
            
      // Actualizar estadísticas
      this.metrics.automationsCompleted++;
      automation.stats.successes++;
      automation.stats.lastSuccess = new Date().toISOString();
            
      const totalTime = this.metrics.totalExecutionTime + executionTime;
      this.metrics.totalExecutionTime = totalTime;
      this.metrics.averageExecutionTime = totalTime / this.metrics.automationsExecuted;
            
      automation.stats.averageExecutionTime = 
                ((automation.stats.averageExecutionTime * (automation.stats.successes - 1)) + executionTime) / 
                automation.stats.successes;
            
      this.emit('automationCompleted', automation, result, executionContext);
      this._log('info', `Automation execution completed: ${automation.name} (${executionId})`);
            
      return result;
            
    } catch (error) {
      const executionTime = Date.now() - startTime;
            
      this.metrics.automationsFailed++;
      automation.stats.failures++;
      automation.stats.lastFailure = new Date().toISOString();
            
      const errorResult = {
        success: false,
        error: error.message,
        executionTime,
        executionId
      };
            
      this.emit('automationFailed', automation, error, executionContext);
      this._log('error', `Automation execution failed: ${automation.name} (${executionId}) - ${error.message}`);
            
      throw error;
    }
  }
    
  /**
     * Ejecuta automatización de tipo workflow
     */
  async _executeWorkflowAutomation(automation, context, options) {
    if (!this.workflowEngine) {
      throw new Error('Workflow engine not available');
    }
        
    if (!automation.workflow) {
      throw new Error('Workflow definition not found');
    }
        
    // Ejecutar workflow
    const workflowResult = await this.workflowEngine.executeWorkflow(
      automation.workflow.id,
      {
        ...context.data,
        variables: Object.fromEntries(context.variables)
      },
      {
        triggeredBy: 'automation',
        automationId: automation.id,
        ...options
      }
    );
        
    return {
      success: true,
      type: 'workflow',
      workflow: workflowResult
    };
  }
    
  /**
     * Ejecuta automatización de tipo regla
     */
  async _executeRuleAutomation(automation, context, options) {
    if (!this.ruleEngine) {
      throw new Error('Rule engine not available');
    }
        
    if (!automation.rules || automation.rules.length === 0) {
      throw new Error('Rules definition not found');
    }
        
    // Ejecutar reglas
    const rulesResult = await this.ruleEngine.evaluateRules(
      {
        data: context.data,
        variables: Object.fromEntries(context.variables)
      },
      {
        ruleIds: automation.rules.map(r => r.id),
        ...options
      }
    );
        
    return {
      success: true,
      type: 'rule',
      rules: rulesResult
    };
  }
    
  /**
     * Ejecuta automatización híbrida (workflow + reglas)
     */
  async _executeHybridAutomation(automation, context, options) {
    const results = {
      success: true,
      type: 'hybrid',
      workflow: null,
      rules: null
    };
        
    // Ejecutar reglas primero (para determinar si continuar)
    if (automation.rules && automation.rules.length > 0) {
      results.rules = await this._executeRuleAutomation(automation, context, options);
            
      // Si las reglas no coinciden, no ejecutar workflow
      if (results.rules.rules.matchedRules === 0) {
        return {
          success: true,
          type: 'hybrid',
          skipped: 'No rules matched',
          rules: results.rules
        };
      }
    }
        
    // Ejecutar workflow si las reglas coincidieron o no hay reglas
    if (automation.workflow) {
      results.workflow = await this._executeWorkflowAutomation(automation, context, options);
    }
        
    return results;
  }
    
  /**
     * Evalúa precondiciones
     */
  async _evaluatePreconditions(preconditions, context) {
    for (const precondition of preconditions) {
      try {
        const result = await this._evaluateCondition(precondition, context);
        if (!result) {
          return {
            passed: false,
            reason: `Precondition failed: ${precondition.name || 'unnamed'}`
          };
        }
      } catch (error) {
        return {
          passed: false,
          reason: `Precondition error: ${error.message}`
        };
      }
    }
        
    return { passed: true };
  }
    
  /**
     * Ejecuta acciones post-ejecución
     */
  async _executePostActions(postActions, context, result) {
    const results = [];
        
    for (const action of postActions) {
      try {
        const actionResult = await this._executeAction(action, context, result);
        results.push({
          action: action.name || action.type,
          success: true,
          result: actionResult
        });
      } catch (error) {
        results.push({
          action: action.name || action.type,
          success: false,
          error: error.message
        });
      }
    }
        
    return results;
  }
    
  /**
     * Evalúa una condición
     */
  async _evaluateCondition(condition, context) {
    if (this.ruleEngine) {
      // Usar el motor de reglas para evaluar condiciones complejas
      const tempRule = {
        id: 'temp-condition',
        conditions: condition,
        actions: []
      };
            
      const result = await this.ruleEngine._evaluateConditions(condition, context);
      return result.result;
    }
        
    // Evaluación básica si no hay motor de reglas
    return this._basicConditionEvaluation(condition, context);
  }
    
  /**
     * Evaluación básica de condiciones
     */
  _basicConditionEvaluation(condition, context) {
    if (typeof condition === 'boolean') {
      return condition;
    }
        
    if (typeof condition === 'object' && condition.operator) {
      const { operator, left, right } = condition;
      const leftValue = this._resolveValue(left, context);
      const rightValue = this._resolveValue(right, context);
            
      switch (operator) {
      case 'eq': return leftValue === rightValue;
      case 'ne': return leftValue !== rightValue;
      case 'gt': return leftValue > rightValue;
      case 'gte': return leftValue >= rightValue;
      case 'lt': return leftValue < rightValue;
      case 'lte': return leftValue <= rightValue;
      default: return false;
      }
    }
        
    return false;
  }
    
  /**
     * Ejecuta una acción
     */
  async _executeAction(action, context, result) {
    const { type, config = {} } = action;
        
    switch (type) {
    case 'log':
      this._log(config.level || 'info', config.message || '');
      return { logged: true };
                
    case 'variable':
      return this._executeVariableAction(config, context);
                
    case 'event':
      this.emit(config.event, { context, result, config: config.data });
      return { eventEmitted: config.event };
                
    case 'notification':
      this.emit('notificationRequested', config);
      return { notificationRequested: true };
                
    default:
      throw new Error(`Unknown action type: ${type}`);
    }
  }
    
  /**
     * Ejecuta acción de variable
     */
  _executeVariableAction(config, context) {
    const { operation, name, value, scope = 'local' } = config;
        
    const targetMap = scope === 'global' ? this.globalContext : context.variables;
        
    switch (operation) {
    case 'set':
      targetMap.set(name, value);
      return { variableSet: name, value, scope };
    case 'delete':
      targetMap.delete(name);
      return { variableDeleted: name, scope };
    case 'increment':
      const currentValue = targetMap.get(name) || 0;
      const newValue = currentValue + (value || 1);
      targetMap.set(name, newValue);
      return { variableIncremented: name, value: newValue, scope };
    default:
      throw new Error(`Unknown variable operation: ${operation}`);
    }
  }
    
  /**
     * Resuelve un valor con variables del contexto
     */
  _resolveValue(value, context) {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      const varName = value.slice(2, -1);
            
      if (context.variables.has(varName)) {
        return context.variables.get(varName);
      }
            
      if (this.globalContext.has(varName)) {
        return this.globalContext.get(varName);
      }
            
      return value;
    }
        
    return value;
  }
    
  /**
     * Crea contexto de ejecución
     */
  _createExecutionContext(automation, context) {
    return {
      data: context.data || {},
      variables: new Map([
        ...this.globalContext,
        ...Object.entries(automation.variables),
        ...Object.entries(context.variables || {})
      ]),
      automation: {
        id: automation.id,
        name: automation.name,
        type: automation.type
      },
      timestamp: new Date().toISOString(),
      metadata: context.metadata || {}
    };
  }
    
  /**
     * Crea componentes de automatización según el tipo
     */
  async _createAutomationComponents(automation) {
    switch (automation.type) {
    case 'workflow':
      if (automation.workflow && this.workflowEngine) {
        // Crear workflow si no existe
        if (!this.workflowEngine.getWorkflow(automation.workflow.id)) {
          await this.workflowEngine.createWorkflow(automation.workflow);
        }
      }
      break;
                
    case 'rule':
      if (automation.rules && automation.rules.length > 0 && this.ruleEngine) {
        // Crear reglas si no existen
        for (const rule of automation.rules) {
          if (!this.ruleEngine.getRule(rule.id)) {
            await this.ruleEngine.createRule(rule);
          }
        }
      }
      break;
                
    case 'hybrid':
      // Crear tanto workflow como reglas
      if (automation.workflow && this.workflowEngine) {
        if (!this.workflowEngine.getWorkflow(automation.workflow.id)) {
          await this.workflowEngine.createWorkflow(automation.workflow);
        }
      }
                
      if (automation.rules && automation.rules.length > 0 && this.ruleEngine) {
        for (const rule of automation.rules) {
          if (!this.ruleEngine.getRule(rule.id)) {
            await this.ruleEngine.createRule(rule);
          }
        }
      }
      break;
    }
  }
    
  /**
     * Registra triggers de automatización
     */
  _registerAutomationTriggers(automation) {
    automation.triggers.forEach(trigger => {
      if (!trigger.enabled) return;
            
      const triggerKey = `${automation.id}:${trigger.id}`;
      this.triggers.set(triggerKey, {
        automationId: automation.id,
        trigger,
        lastTriggered: null
      });
            
      this._setupTrigger(automation, trigger);
    });
  }
    
  /**
     * Configura un trigger
     */
  _setupTrigger(automation, trigger) {
    const { type, config } = trigger;
        
    switch (type) {
    case 'event':
      this._setupEventTrigger(automation, trigger);
      break;
    case 'schedule':
      this._setupScheduleTrigger(automation, trigger);
      break;
    case 'webhook':
      this._setupWebhookTrigger(automation, trigger);
      break;
    case 'condition':
      this._setupConditionTrigger(automation, trigger);
      break;
    }
  }
    
  /**
     * Configura trigger de evento
     */
  _setupEventTrigger(automation, trigger) {
    const { event, condition } = trigger.config;
        
    this.on(event, async(data) => {
      try {
        if (condition) {
          const conditionMet = await this._evaluateCondition(condition, {
            data,
            variables: new Map([...this.globalContext, ['event', data]])
          });
                    
          if (!conditionMet) return;
        }
                
        this.metrics.triggersActivated++;
                
        await this.executeAutomation(automation.id, { event: data }, {
          triggeredBy: 'event',
          triggerData: { event, data }
        });
      } catch (error) {
        this._log('error', `Event trigger failed for automation ${automation.id}: ${error.message}`);
      }
    });
  }
    
  /**
     * Configura trigger de programación
     */
  _setupScheduleTrigger(automation, trigger) {
    const { schedule } = trigger.config;
        
    // Implementación simplificada - en producción usar node-cron
    this._log('info', `Schedule trigger configured for automation ${automation.id}: ${schedule}`);
  }
    
  /**
     * Configura trigger de webhook
     */
  _setupWebhookTrigger(automation, trigger) {
    const { path, method = 'POST' } = trigger.config;
        
    this._log('info', `Webhook trigger configured for automation ${automation.id}: ${method} ${path}`);
  }
    
  /**
     * Configura trigger de condición
     */
  _setupConditionTrigger(automation, trigger) {
    const { condition, checkInterval = 60000 } = trigger.config;
        
    // Verificar condición periódicamente
    const intervalId = setInterval(async() => {
      try {
        const conditionMet = await this._evaluateCondition(condition, {
          data: {},
          variables: this.globalContext
        });
                
        if (conditionMet) {
          this.metrics.triggersActivated++;
                    
          await this.executeAutomation(automation.id, {}, {
            triggeredBy: 'condition',
            triggerData: { condition }
          });
        }
      } catch (error) {
        this._log('error', `Condition trigger failed for automation ${automation.id}: ${error.message}`);
      }
    }, checkInterval);
        
    // Guardar referencia para limpieza
    trigger._intervalId = intervalId;
  }
    
  /**
     * Configura integración con WorkflowEngine
     */
  _setupWorkflowEngineIntegration() {
    if (!this.workflowEngine) return;
        
    // Compartir eventos si está habilitado
    if (this.config.integration.shareEvents) {
      this.workflowEngine.on('workflowCompleted', (instance, result) => {
        this.emit('workflowCompleted', instance, result);
        this._addToEventHistory('workflowCompleted', { instance, result });
      });
            
      this.workflowEngine.on('workflowFailed', (instance, error) => {
        this.emit('workflowFailed', instance, error);
        this._addToEventHistory('workflowFailed', { instance, error });
      });
    }
        
    // Compartir variables si está habilitado
    if (this.config.integration.shareVariables) {
      this.workflowEngine.globalVariables = this.globalContext;
    }
  }
    
  /**
     * Configura integración con RuleEngine
     */
  _setupRuleEngineIntegration() {
    if (!this.ruleEngine) return;
        
    // Compartir eventos si está habilitado
    if (this.config.integration.shareEvents) {
      this.ruleEngine.on('ruleMatched', (rule, match, context) => {
        this.emit('ruleMatched', rule, match, context);
        this._addToEventHistory('ruleMatched', { rule, match, context });
      });
            
      this.ruleEngine.on('actionExecuted', (action, result, context) => {
        this.emit('actionExecuted', action, result, context);
        this._addToEventHistory('actionExecuted', { action, result, context });
      });
    }
        
    // Compartir variables si está habilitado
    if (this.config.integration.shareVariables) {
      this.ruleEngine.globalVariables = this.globalContext;
    }
  }
    
  /**
     * Configura triggers globales
     */
  _setupGlobalTriggers() {
    this.config.triggers.globalTriggers.forEach(trigger => {
      this._setupGlobalTrigger(trigger);
    });
  }
    
  /**
     * Configura un trigger global
     */
  _setupGlobalTrigger(trigger) {
    const { event, actions = [] } = trigger;
        
    this.on(event, async(data) => {
      for (const action of actions) {
        try {
          await this._executeAction(action, {
            data,
            variables: this.globalContext
          });
        } catch (error) {
          this._log('error', `Global trigger action failed: ${error.message}`);
        }
      }
    });
  }
    
  /**
     * Agrega evento al historial
     */
  _addToEventHistory(event, data) {
    if (!this.config.events.eventHistory) return;
        
    this.eventHistory.push({
      event,
      data,
      timestamp: new Date().toISOString()
    });
        
    // Limitar tamaño del historial
    if (this.eventHistory.length > this.config.events.historySize) {
      this.eventHistory.shift();
    }
        
    this.metrics.eventsProcessed++;
  }
    
  /**
     * Valida triggers
     */
  _validateTriggers(triggers) {
    if (!Array.isArray(triggers)) {
      throw new Error('Triggers must be an array');
    }
        
    if (triggers.length > this.config.triggers.maxPerAutomation) {
      throw new Error(`Maximum ${this.config.triggers.maxPerAutomation} triggers per automation`);
    }
        
    return triggers.map(trigger => ({
      id: trigger.id || uuidv4(),
      type: trigger.type || 'event',
      config: trigger.config || {},
      enabled: trigger.enabled !== false
    }));
  }
    
  /**
     * Procesa evento
     */
  async processEvent(event, data = {}) {
    this.emit(event, data);
    this._addToEventHistory(event, data);
        
    this._log('debug', `Event processed: ${event}`);
  }
    
  /**
     * Obtiene una automatización por ID
     */
  getAutomation(automationId) {
    return this.automations.get(automationId);
  }
    
  /**
     * Lista todas las automatizaciones
     */
  listAutomations(filter = {}) {
    let automations = Array.from(this.automations.values());
        
    if (filter.type) {
      automations = automations.filter(a => a.type === filter.type);
    }
        
    if (filter.enabled !== undefined) {
      automations = automations.filter(a => a.enabled === filter.enabled);
    }
        
    if (filter.category) {
      automations = automations.filter(a => a.config.category === filter.category);
    }
        
    if (filter.tags && filter.tags.length > 0) {
      automations = automations.filter(a => 
        filter.tags.some(tag => a.config.tags.includes(tag))
      );
    }
        
    return automations;
  }
    
  /**
     * Actualiza una automatización
     */
  async updateAutomation(automationId, updates) {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation not found: ${automationId}`);
    }
        
    const allowedUpdates = [
      'name', 'description', 'enabled', 'config', 'triggers', 
      'workflow', 'rules', 'variables', 'preconditions', 'postActions'
    ];
        
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'triggers') {
          automation[field] = this._validateTriggers(updates[field]);
          this._registerAutomationTriggers(automation);
        } else {
          automation[field] = updates[field];
        }
      }
    });
        
    automation.metadata.updatedAt = new Date().toISOString();
        
    // Recrear componentes si es necesario
    await this._createAutomationComponents(automation);
        
    this.emit('automationUpdated', automation);
        
    return automation;
  }
    
  /**
     * Elimina una automatización
     */
  async deleteAutomation(automationId) {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation not found: ${automationId}`);
    }
        
    // Limpiar triggers
    for (const [triggerKey] of this.triggers) {
      if (triggerKey.startsWith(`${automationId}:`)) {
        const triggerData = this.triggers.get(triggerKey);
                
        // Limpiar intervalos si existen
        if (triggerData.trigger._intervalId) {
          clearInterval(triggerData.trigger._intervalId);
        }
                
        this.triggers.delete(triggerKey);
      }
    }
        
    this.automations.delete(automationId);
    this.emit('automationDeleted', automation);
        
    return true;
  }
    
  /**
     * Obtiene estadísticas del gestor
     */
  getStats() {
    const workflowStats = this.workflowEngine ? this.workflowEngine.getStats() : null;
    const ruleStats = this.ruleEngine ? this.ruleEngine.getStats() : null;
        
    return {
      ...this.metrics,
      automations: {
        total: this.automations.size,
        enabled: Array.from(this.automations.values()).filter(a => a.enabled).length,
        byType: {
          workflow: Array.from(this.automations.values()).filter(a => a.type === 'workflow').length,
          rule: Array.from(this.automations.values()).filter(a => a.type === 'rule').length,
          hybrid: Array.from(this.automations.values()).filter(a => a.type === 'hybrid').length
        }
      },
      triggers: {
        total: this.triggers.size,
        active: Array.from(this.triggers.values()).filter(t => t.trigger.enabled).length
      },
      events: {
        historySize: this.eventHistory.length,
        processed: this.metrics.eventsProcessed
      },
      engines: {
        workflow: workflowStats,
        rule: ruleStats
      }
    };
  }
    
  /**
     * Obtiene estado de salud
     */
  getHealthStatus() {
    const status = {
      healthy: true,
      components: {},
      timestamp: new Date().toISOString()
    };
        
    // Verificar motores
    if (this.workflowEngine) {
      status.components.workflowEngine = {
        healthy: this.workflowEngine.initialized,
        stats: this.workflowEngine.getStats()
      };
    }
        
    if (this.ruleEngine) {
      status.components.ruleEngine = {
        healthy: this.ruleEngine.initialized,
        stats: this.ruleEngine.getStats()
      };
    }
        
    // Verificar automatizaciones
    status.components.automations = {
      healthy: this.automations.size > 0,
      count: this.automations.size,
      enabled: Array.from(this.automations.values()).filter(a => a.enabled).length
    };
        
    // Estado general
    status.healthy = Object.values(status.components).every(comp => comp.healthy);
        
    return status;
  }
    
  /**
     * Configura timers del sistema
     */
  _setupTimers() {
    if (this.config.monitoring.healthChecks) {
      this.healthCheckTimer = setInterval(() => {
        const health = this.getHealthStatus();
        this.emit('healthCheck', health);
                
        if (!health.healthy) {
          this._log('warn', 'Health check failed');
        }
      }, 60000); // Cada minuto
    }
        
    if (this.config.monitoring.performanceMetrics) {
      this.metricsTimer = setInterval(() => {
        const stats = this.getStats();
        this.emit('metricsUpdate', stats);
      }, 300000); // Cada 5 minutos
    }
  }
    
  /**
     * Configura manejadores de eventos
     */
  _setupEventHandlers() {
    this.on('error', (error) => {
      this._log('error', `AutomationManager error: ${error.message}`);
    });
        
    // Configurar límite de listeners
    this.setMaxListeners(this.config.events.maxListeners);
  }
    
  /**
     * Valida configuración
     */
  _validateConfig() {
    if (this.config.maxAutomations <= 0) {
      throw new Error('maxAutomations must be greater than 0');
    }
        
    if (!this.config.workflows.enabled && !this.config.rules.enabled) {
      throw new Error('At least one engine (workflows or rules) must be enabled');
    }
  }
    
  /**
     * Registra un log
     */
  _log(level, message) {
    if (!this.config.logging.enabled) return;
        
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      component: 'AutomationManager'
    };
        
    this.logs.push(logEntry);
    this.emit('log', logEntry);
        
    if (this.logs.length > this.config.logging.maxLogs) {
      this.logs.shift();
    }
  }
    
  /**
     * Destruye el gestor de automatización
     */
  async destroy() {
    // Limpiar timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
        
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
        
    // Limpiar triggers
    for (const [, triggerData] of this.triggers) {
      if (triggerData.trigger._intervalId) {
        clearInterval(triggerData.trigger._intervalId);
      }
    }
        
    // Destruir motores
    if (this.workflowEngine) {
      await this.workflowEngine.destroy();
    }
        
    if (this.ruleEngine) {
      await this.ruleEngine.destroy();
    }
        
    this.removeAllListeners();
    this.initialized = false;
        
    this._log('info', 'AutomationManager destroyed');
  }
}

export default AutomationManager;
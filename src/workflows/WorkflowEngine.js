import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Motor de workflows para automatización y reglas de negocio
 * Gestiona la ejecución de flujos de trabajo complejos
 */
class WorkflowEngine extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración general
      enabled: config.enabled !== false,
      maxConcurrentWorkflows: config.maxConcurrentWorkflows || 100,
      defaultTimeout: config.defaultTimeout || 300000, // 5 minutos
            
      // Configuración de persistencia
      persistence: {
        enabled: config.persistence?.enabled !== false,
        type: config.persistence?.type || 'memory', // memory, file, database
        path: config.persistence?.path || './data/workflows',
        autoSave: config.persistence?.autoSave !== false,
        saveInterval: config.persistence?.saveInterval || 30000
      },
            
      // Configuración de ejecución
      execution: {
        retryAttempts: config.execution?.retryAttempts || 3,
        retryDelay: config.execution?.retryDelay || 1000,
        parallelSteps: config.execution?.parallelSteps !== false,
        stepTimeout: config.execution?.stepTimeout || 30000,
        errorHandling: config.execution?.errorHandling || 'stop' // stop, continue, retry
      },
            
      // Configuración de variables
      variables: {
        global: config.variables?.global || {},
        encryption: config.variables?.encryption !== false,
        maxSize: config.variables?.maxSize || 1024 * 1024, // 1MB
        allowedTypes: config.variables?.allowedTypes || ['string', 'number', 'boolean', 'object', 'array']
      },
            
      // Configuración de condiciones
      conditions: {
        maxDepth: config.conditions?.maxDepth || 10,
        allowedOperators: config.conditions?.allowedOperators || [
          'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin',
          'contains', 'startsWith', 'endsWith', 'matches',
          'and', 'or', 'not', 'exists'
        ],
        customFunctions: config.conditions?.customFunctions || {}
      },
            
      // Configuración de triggers
      triggers: {
        enabled: config.triggers?.enabled !== false,
        maxPerWorkflow: config.triggers?.maxPerWorkflow || 10,
        debounceTime: config.triggers?.debounceTime || 1000,
        types: config.triggers?.types || ['event', 'schedule', 'webhook', 'manual']
      },
            
      // Configuración de logging
      logging: {
        enabled: config.logging?.enabled !== false,
        level: config.logging?.level || 'info',
        maxLogs: config.logging?.maxLogs || 10000,
        retention: config.logging?.retention || 7 * 24 * 60 * 60 * 1000 // 7 días
      },
            
      // Configuración de métricas
      metrics: {
        enabled: config.metrics?.enabled !== false,
        collectStepMetrics: config.metrics?.collectStepMetrics !== false,
        collectVariableMetrics: config.metrics?.collectVariableMetrics !== false
      }
    };
        
    // Estado interno
    this.workflows = new Map();
    this.runningInstances = new Map();
    this.templates = new Map();
    this.globalVariables = new Map(Object.entries(this.config.variables.global));
    this.triggers = new Map();
    this.logs = [];
    this.metrics = {
      workflowsCreated: 0,
      workflowsExecuted: 0,
      workflowsCompleted: 0,
      workflowsFailed: 0,
      stepsExecuted: 0,
      stepsFailed: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0
    };
        
    // Timers
    this.saveTimer = null;
    this.cleanupTimer = null;
        
    this.initialized = false;
  }
    
  /**
     * Inicializa el motor de workflows
     */
  async initialize() {
    if (this.initialized) return;
        
    try {
      this._validateConfig();
            
      if (this.config.persistence.enabled) {
        await this._loadPersistedData();
      }
            
      this._setupTimers();
      this._setupEventHandlers();
            
      this.initialized = true;
      this.emit('initialized');
            
      this._log('info', 'WorkflowEngine initialized successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Crea un nuevo workflow
     */
  async createWorkflow(definition) {
    if (!this.initialized) {
      throw new Error('WorkflowEngine not initialized');
    }
        
    const workflow = {
      id: definition.id || uuidv4(),
      name: definition.name || 'Unnamed Workflow',
      description: definition.description || '',
      version: definition.version || '1.0.0',
      enabled: definition.enabled !== false,
            
      // Configuración del workflow
      config: {
        timeout: definition.config?.timeout || this.config.defaultTimeout,
        retryAttempts: definition.config?.retryAttempts || this.config.execution.retryAttempts,
        errorHandling: definition.config?.errorHandling || this.config.execution.errorHandling,
        variables: definition.config?.variables || {},
        tags: definition.config?.tags || []
      },
            
      // Triggers que inician el workflow
      triggers: this._validateTriggers(definition.triggers || []),
            
      // Pasos del workflow
      steps: this._validateSteps(definition.steps || []),
            
      // Metadatos
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: definition.metadata?.createdBy || 'system',
        tags: definition.metadata?.tags || []
      },
            
      // Estadísticas
      stats: {
        executions: 0,
        successes: 0,
        failures: 0,
        averageExecutionTime: 0,
        lastExecution: null
      }
    };
        
    this.workflows.set(workflow.id, workflow);
    this._registerTriggers(workflow);
        
    this.metrics.workflowsCreated++;
    this.emit('workflowCreated', workflow);
        
    this._log('info', `Workflow created: ${workflow.name} (${workflow.id})`);
        
    if (this.config.persistence.autoSave) {
      await this._saveData();
    }
        
    return workflow;
  }
    
  /**
     * Ejecuta un workflow
     */
  async executeWorkflow(workflowId, context = {}, options = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
        
    if (!workflow.enabled) {
      throw new Error(`Workflow is disabled: ${workflowId}`);
    }
        
    if (this.runningInstances.size >= this.config.maxConcurrentWorkflows) {
      throw new Error('Maximum concurrent workflows reached');
    }
        
    const instance = {
      id: uuidv4(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      context: { ...context },
      variables: new Map([
        ...this.globalVariables,
        ...Object.entries(workflow.config.variables),
        ...Object.entries(context.variables || {})
      ]),
      currentStep: 0,
      stepResults: [],
      errors: [],
      metadata: {
        triggeredBy: options.triggeredBy || 'manual',
        triggerData: options.triggerData || {},
        executionId: options.executionId || uuidv4()
      }
    };
        
    this.runningInstances.set(instance.id, instance);
    this.metrics.workflowsExecuted++;
    workflow.stats.executions++;
        
    this.emit('workflowStarted', instance);
    this._log('info', `Workflow execution started: ${workflow.name} (${instance.id})`);
        
    try {
      const result = await this._executeWorkflowSteps(workflow, instance);
            
      instance.status = 'completed';
      instance.endTime = Date.now();
      instance.executionTime = instance.endTime - instance.startTime;
            
      this.metrics.workflowsCompleted++;
      workflow.stats.successes++;
      workflow.stats.lastExecution = new Date().toISOString();
            
      // Actualizar tiempo promedio de ejecución
      const totalTime = this.metrics.totalExecutionTime + instance.executionTime;
      this.metrics.totalExecutionTime = totalTime;
      this.metrics.averageExecutionTime = totalTime / this.metrics.workflowsExecuted;
            
      workflow.stats.averageExecutionTime = 
                ((workflow.stats.averageExecutionTime * (workflow.stats.successes - 1)) + instance.executionTime) / 
                workflow.stats.successes;
            
      this.emit('workflowCompleted', instance, result);
      this._log('info', `Workflow execution completed: ${workflow.name} (${instance.id})`);
            
      return result;
            
    } catch (error) {
      instance.status = 'failed';
      instance.endTime = Date.now();
      instance.executionTime = instance.endTime - instance.startTime;
      instance.errors.push({
        step: instance.currentStep,
        error: error.message,
        timestamp: new Date().toISOString()
      });
            
      this.metrics.workflowsFailed++;
      workflow.stats.failures++;
      workflow.stats.lastExecution = new Date().toISOString();
            
      this.emit('workflowFailed', instance, error);
      this._log('error', `Workflow execution failed: ${workflow.name} (${instance.id}) - ${error.message}`);
            
      throw error;
            
    } finally {
      this.runningInstances.delete(instance.id);
    }
  }
    
  /**
     * Ejecuta los pasos de un workflow
     */
  async _executeWorkflowSteps(workflow, instance) {
    const results = [];
        
    for (let i = 0; i < workflow.steps.length; i++) {
      instance.currentStep = i;
      const step = workflow.steps[i];
            
      try {
        // Evaluar condiciones del paso
        if (step.condition && !await this._evaluateCondition(step.condition, instance)) {
          this._log('debug', `Step ${i} skipped due to condition: ${step.name}`);
          continue;
        }
                
        const stepResult = await this._executeStep(step, instance, workflow);
        results.push(stepResult);
        instance.stepResults.push(stepResult);
                
        this.metrics.stepsExecuted++;
                
        // Actualizar variables si el paso las produce
        if (stepResult.variables) {
          Object.entries(stepResult.variables).forEach(([key, value]) => {
            instance.variables.set(key, value);
          });
        }
                
        this.emit('stepCompleted', instance, step, stepResult);
                
      } catch (error) {
        this.metrics.stepsFailed++;
                
        const stepError = {
          step: i,
          stepName: step.name,
          error: error.message,
          timestamp: new Date().toISOString()
        };
                
        instance.errors.push(stepError);
        this.emit('stepFailed', instance, step, error);
                
        // Manejar error según configuración
        if (workflow.config.errorHandling === 'stop') {
          throw error;
        } else if (workflow.config.errorHandling === 'retry') {
          // Implementar lógica de reintentos
          let retryCount = 0;
          while (retryCount < workflow.config.retryAttempts) {
            try {
              await new Promise(resolve => setTimeout(resolve, this.config.execution.retryDelay));
              const retryResult = await this._executeStep(step, instance, workflow);
              results.push(retryResult);
              instance.stepResults.push(retryResult);
              break;
            } catch (retryError) {
              retryCount++;
              if (retryCount >= workflow.config.retryAttempts) {
                throw retryError;
              }
            }
          }
        }
        // Si errorHandling es 'continue', simplemente continúa
      }
    }
        
    return {
      workflowId: workflow.id,
      instanceId: instance.id,
      status: 'completed',
      results,
      variables: Object.fromEntries(instance.variables),
      executionTime: instance.executionTime,
      stepsExecuted: results.length
    };
  }
    
  /**
     * Ejecuta un paso individual
     */
  async _executeStep(step, instance, workflow) {
    const startTime = Date.now();
        
    this._log('debug', `Executing step: ${step.name} (${step.type})`);
        
    let result;
        
    switch (step.type) {
    case 'action':
      result = await this._executeAction(step, instance);
      break;
    case 'condition':
      result = await this._executeCondition(step, instance);
      break;
    case 'loop':
      result = await this._executeLoop(step, instance, workflow);
      break;
    case 'parallel':
      result = await this._executeParallel(step, instance, workflow);
      break;
    case 'delay':
      result = await this._executeDelay(step, instance);
      break;
    case 'variable':
      result = await this._executeVariable(step, instance);
      break;
    case 'webhook':
      result = await this._executeWebhook(step, instance);
      break;
    case 'notification':
      result = await this._executeNotification(step, instance);
      break;
    default:
      throw new Error(`Unknown step type: ${step.type}`);
    }
        
    const executionTime = Date.now() - startTime;
        
    return {
      stepName: step.name,
      stepType: step.type,
      status: 'completed',
      result,
      executionTime,
      timestamp: new Date().toISOString()
    };
  }
    
  /**
     * Ejecuta una acción
     */
  async _executeAction(step, instance) {
    const { action, parameters = {} } = step.config;
        
    // Resolver parámetros con variables
    const resolvedParams = this._resolveVariables(parameters, instance);
        
    // Ejecutar la acción
    switch (action) {
    case 'log':
      this._log(resolvedParams.level || 'info', resolvedParams.message || '');
      return { logged: true, message: resolvedParams.message };
                
    case 'http_request':
      return await this._executeHttpRequest(resolvedParams);
                
    case 'database_query':
      return await this._executeDatabaseQuery(resolvedParams);
                
    case 'file_operation':
      return await this._executeFileOperation(resolvedParams);
                
    case 'email':
      return await this._executeEmailAction(resolvedParams);
                
    case 'custom':
      if (resolvedParams.function && typeof resolvedParams.function === 'function') {
        return await resolvedParams.function(resolvedParams, instance);
      }
      throw new Error('Custom action function not provided');
                
    default:
      throw new Error(`Unknown action: ${action}`);
    }
  }
    
  /**
     * Ejecuta una condición
     */
  async _executeCondition(step, instance) {
    const result = await this._evaluateCondition(step.config.condition, instance);
    return { conditionMet: result };
  }
    
  /**
     * Ejecuta un bucle
     */
  async _executeLoop(step, instance, workflow) {
    const { type, condition, items, steps } = step.config;
    const results = [];
        
    if (type === 'for_each' && items) {
      const itemsArray = this._resolveVariables(items, instance);
            
      for (const item of itemsArray) {
        // Crear contexto temporal para el item
        const tempInstance = {
          ...instance,
          variables: new Map([...instance.variables, ['item', item], ['index', itemsArray.indexOf(item)]])
        };
                
        for (const loopStep of steps) {
          const stepResult = await this._executeStep(loopStep, tempInstance, workflow);
          results.push(stepResult);
        }
      }
    } else if (type === 'while' && condition) {
      while (await this._evaluateCondition(condition, instance)) {
        for (const loopStep of steps) {
          const stepResult = await this._executeStep(loopStep, instance, workflow);
          results.push(stepResult);
        }
      }
    }
        
    return { loopResults: results, iterations: results.length };
  }
    
  /**
     * Ejecuta pasos en paralelo
     */
  async _executeParallel(step, instance, workflow) {
    const { steps } = step.config;
        
    const promises = steps.map(parallelStep => 
      this._executeStep(parallelStep, instance, workflow)
    );
        
    const results = await Promise.allSettled(promises);
        
    return {
      parallelResults: results.map((result, index) => ({
        stepIndex: index,
        status: result.status,
        value: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
      }))
    };
  }
    
  /**
     * Ejecuta un delay
     */
  async _executeDelay(step, instance) {
    const delay = this._resolveVariables(step.config.delay, instance);
    await new Promise(resolve => setTimeout(resolve, delay));
    return { delayed: delay };
  }
    
  /**
     * Ejecuta operación de variable
     */
  async _executeVariable(step, instance) {
    const { operation, name, value, expression } = step.config;
        
    switch (operation) {
    case 'set':
      const resolvedValue = this._resolveVariables(value, instance);
      instance.variables.set(name, resolvedValue);
      return { variableSet: name, value: resolvedValue };
                
    case 'get':
      const currentValue = instance.variables.get(name);
      return { variableValue: currentValue };
                
    case 'delete':
      instance.variables.delete(name);
      return { variableDeleted: name };
                
    case 'calculate':
      const calculatedValue = this._evaluateExpression(expression, instance);
      instance.variables.set(name, calculatedValue);
      return { variableCalculated: name, value: calculatedValue };
                
    default:
      throw new Error(`Unknown variable operation: ${operation}`);
    }
  }
    
  /**
     * Ejecuta un webhook
     */
  async _executeWebhook(step, instance) {
    const { url, method = 'POST', headers = {}, body } = step.config;
        
    const resolvedUrl = this._resolveVariables(url, instance);
    const resolvedHeaders = this._resolveVariables(headers, instance);
    const resolvedBody = this._resolveVariables(body, instance);
        
    return await this._executeHttpRequest({
      url: resolvedUrl,
      method,
      headers: resolvedHeaders,
      body: resolvedBody
    });
  }
    
  /**
     * Ejecuta una notificación
     */
  async _executeNotification(step, instance) {
    const { channel, message, recipients } = step.config;
        
    const resolvedMessage = this._resolveVariables(message, instance);
    const resolvedRecipients = this._resolveVariables(recipients, instance);
        
    // Aquí se integraría con el sistema de notificaciones
    this.emit('notificationRequested', {
      channel,
      message: resolvedMessage,
      recipients: resolvedRecipients,
      workflowId: instance.workflowId,
      instanceId: instance.id
    });
        
    return {
      notificationSent: true,
      channel,
      recipients: resolvedRecipients
    };
  }
    
  /**
     * Ejecuta una petición HTTP
     */
  async _executeHttpRequest(params) {
    const { url, method = 'GET', headers = {}, body, timeout = 30000 } = params;
        
    // Implementación simplificada - en producción usar axios o fetch
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('HTTP request timeout'));
      }, timeout);
            
      // Simular petición HTTP
      setTimeout(() => {
        clearTimeout(timeoutId);
        resolve({
          status: 200,
          data: { success: true, url, method },
          headers: { 'content-type': 'application/json' }
        });
      }, 100);
    });
  }
    
  /**
     * Ejecuta una consulta de base de datos
     */
  async _executeDatabaseQuery(params) {
    const { query, parameters = [] } = params;
        
    // Implementación simplificada - en producción conectar a base de datos real
    return {
      query,
      parameters,
      results: [],
      rowCount: 0,
      executionTime: 10
    };
  }
    
  /**
     * Ejecuta una operación de archivo
     */
  async _executeFileOperation(params) {
    const { operation, path, content, encoding = 'utf8' } = params;
        
    // Implementación simplificada - en producción usar fs
    switch (operation) {
    case 'read':
      return { content: 'file content', size: 100 };
    case 'write':
      return { written: true, size: content?.length || 0 };
    case 'delete':
      return { deleted: true };
    case 'exists':
      return { exists: true };
    default:
      throw new Error(`Unknown file operation: ${operation}`);
    }
  }
    
  /**
     * Ejecuta una acción de email
     */
  async _executeEmailAction(params) {
    const { to, subject, body, attachments = [] } = params;
        
    // Integración con sistema de notificaciones de email
    this.emit('emailRequested', {
      to,
      subject,
      body,
      attachments
    });
        
    return {
      emailSent: true,
      recipients: Array.isArray(to) ? to : [to],
      subject
    };
  }
    
  /**
     * Evalúa una condición
     */
  async _evaluateCondition(condition, instance) {
    if (typeof condition === 'boolean') {
      return condition;
    }
        
    if (typeof condition === 'string') {
      return this._evaluateExpression(condition, instance);
    }
        
    if (typeof condition === 'object') {
      return this._evaluateConditionObject(condition, instance);
    }
        
    return false;
  }
    
  /**
     * Evalúa un objeto de condición
     */
  _evaluateConditionObject(condition, instance) {
    const { operator, left, right, conditions } = condition;
        
    switch (operator) {
    case 'and':
      return conditions.every(cond => this._evaluateCondition(cond, instance));
    case 'or':
      return conditions.some(cond => this._evaluateCondition(cond, instance));
    case 'not':
      return !this._evaluateCondition(conditions[0], instance);
    case 'eq':
      return this._resolveVariables(left, instance) === this._resolveVariables(right, instance);
    case 'ne':
      return this._resolveVariables(left, instance) !== this._resolveVariables(right, instance);
    case 'gt':
      return this._resolveVariables(left, instance) > this._resolveVariables(right, instance);
    case 'gte':
      return this._resolveVariables(left, instance) >= this._resolveVariables(right, instance);
    case 'lt':
      return this._resolveVariables(left, instance) < this._resolveVariables(right, instance);
    case 'lte':
      return this._resolveVariables(left, instance) <= this._resolveVariables(right, instance);
    case 'in':
      const rightArray = this._resolveVariables(right, instance);
      return Array.isArray(rightArray) && rightArray.includes(this._resolveVariables(left, instance));
    case 'contains':
      const leftStr = String(this._resolveVariables(left, instance));
      const rightStr = String(this._resolveVariables(right, instance));
      return leftStr.includes(rightStr);
    case 'exists':
      return instance.variables.has(left);
    default:
      throw new Error(`Unknown condition operator: ${operator}`);
    }
  }
    
  /**
     * Evalúa una expresión
     */
  _evaluateExpression(expression, instance) {
    // Implementación simplificada de evaluación de expresiones
    // En producción usar un parser más robusto como mathjs
        
    if (typeof expression !== 'string') {
      return expression;
    }
        
    // Reemplazar variables en la expresión
    let resolvedExpression = expression;
        
    for (const [key, value] of instance.variables) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      resolvedExpression = resolvedExpression.replace(regex, JSON.stringify(value));
    }
        
    try {
      // Evaluación básica - en producción usar un evaluador seguro
      return Function(`"use strict"; return (${resolvedExpression})`)();
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${expression}`);
    }
  }
    
  /**
     * Resuelve variables en un valor
     */
  _resolveVariables(value, instance) {
    if (typeof value === 'string') {
      // Reemplazar variables ${variable}
      return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        if (instance.variables.has(varName)) {
          return String(instance.variables.get(varName));
        }
        return match;
      });
    }
        
    if (Array.isArray(value)) {
      return value.map(item => this._resolveVariables(item, instance));
    }
        
    if (typeof value === 'object' && value !== null) {
      const resolved = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this._resolveVariables(val, instance);
      }
      return resolved;
    }
        
    return value;
  }
    
  /**
     * Valida los triggers de un workflow
     */
  _validateTriggers(triggers) {
    return triggers.map(trigger => {
      if (!trigger.type || !this.config.triggers.types.includes(trigger.type)) {
        throw new Error(`Invalid trigger type: ${trigger.type}`);
      }
            
      return {
        id: trigger.id || uuidv4(),
        type: trigger.type,
        config: trigger.config || {},
        enabled: trigger.enabled !== false
      };
    });
  }
    
  /**
     * Valida los pasos de un workflow
     */
  _validateSteps(steps) {
    const validStepTypes = [
      'action', 'condition', 'loop', 'parallel', 
      'delay', 'variable', 'webhook', 'notification'
    ];
        
    return steps.map((step, index) => {
      if (!step.type || !validStepTypes.includes(step.type)) {
        throw new Error(`Invalid step type at index ${index}: ${step.type}`);
      }
            
      return {
        id: step.id || uuidv4(),
        name: step.name || `Step ${index + 1}`,
        type: step.type,
        config: step.config || {},
        condition: step.condition,
        enabled: step.enabled !== false
      };
    });
  }
    
  /**
     * Registra los triggers de un workflow
     */
  _registerTriggers(workflow) {
    workflow.triggers.forEach(trigger => {
      if (!trigger.enabled) return;
            
      const triggerKey = `${workflow.id}:${trigger.id}`;
      this.triggers.set(triggerKey, {
        workflowId: workflow.id,
        trigger,
        lastTriggered: null
      });
            
      // Configurar trigger según tipo
      switch (trigger.type) {
      case 'event':
        this._setupEventTrigger(workflow, trigger);
        break;
      case 'schedule':
        this._setupScheduleTrigger(workflow, trigger);
        break;
      case 'webhook':
        this._setupWebhookTrigger(workflow, trigger);
        break;
      }
    });
  }
    
  /**
     * Configura un trigger de evento
     */
  _setupEventTrigger(workflow, trigger) {
    const { event, condition } = trigger.config;
        
    this.on(event, async(data) => {
      try {
        if (condition) {
          const conditionMet = await this._evaluateCondition(condition, {
            variables: new Map([...this.globalVariables, ['event', data]])
          });
                    
          if (!conditionMet) return;
        }
                
        await this.executeWorkflow(workflow.id, { event: data }, {
          triggeredBy: 'event',
          triggerData: { event, data }
        });
      } catch (error) {
        this._log('error', `Event trigger failed for workflow ${workflow.id}: ${error.message}`);
      }
    });
  }
    
  /**
     * Configura un trigger de programación
     */
  _setupScheduleTrigger(workflow, trigger) {
    const { schedule, timezone = 'UTC' } = trigger.config;
        
    // Implementación simplificada - en producción usar node-cron
    this._log('info', `Schedule trigger configured for workflow ${workflow.id}: ${schedule}`);
  }
    
  /**
     * Configura un trigger de webhook
     */
  _setupWebhookTrigger(workflow, trigger) {
    const { path, method = 'POST' } = trigger.config;
        
    this._log('info', `Webhook trigger configured for workflow ${workflow.id}: ${method} ${path}`);
  }
    
  /**
     * Obtiene un workflow por ID
     */
  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }
    
  /**
     * Lista todos los workflows
     */
  listWorkflows(filter = {}) {
    const workflows = Array.from(this.workflows.values());
        
    if (filter.enabled !== undefined) {
      return workflows.filter(w => w.enabled === filter.enabled);
    }
        
    if (filter.tags && filter.tags.length > 0) {
      return workflows.filter(w => 
        filter.tags.some(tag => w.metadata.tags.includes(tag))
      );
    }
        
    return workflows;
  }
    
  /**
     * Actualiza un workflow
     */
  async updateWorkflow(workflowId, updates) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
        
    // Actualizar campos permitidos
    const allowedUpdates = ['name', 'description', 'enabled', 'config', 'steps', 'triggers'];
        
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'steps') {
          workflow[field] = this._validateSteps(updates[field]);
        } else if (field === 'triggers') {
          workflow[field] = this._validateTriggers(updates[field]);
          this._registerTriggers(workflow);
        } else {
          workflow[field] = updates[field];
        }
      }
    });
        
    workflow.metadata.updatedAt = new Date().toISOString();
        
    this.emit('workflowUpdated', workflow);
        
    if (this.config.persistence.autoSave) {
      await this._saveData();
    }
        
    return workflow;
  }
    
  /**
     * Elimina un workflow
     */
  async deleteWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
        
    // Cancelar instancias en ejecución
    for (const [instanceId, instance] of this.runningInstances) {
      if (instance.workflowId === workflowId) {
        this.runningInstances.delete(instanceId);
        this.emit('workflowCancelled', instance);
      }
    }
        
    // Eliminar triggers
    for (const [triggerKey] of this.triggers) {
      if (triggerKey.startsWith(`${workflowId}:`)) {
        this.triggers.delete(triggerKey);
      }
    }
        
    this.workflows.delete(workflowId);
    this.emit('workflowDeleted', workflow);
        
    if (this.config.persistence.autoSave) {
      await this._saveData();
    }
        
    return true;
  }
    
  /**
     * Obtiene las instancias en ejecución
     */
  getRunningInstances(workflowId = null) {
    const instances = Array.from(this.runningInstances.values());
        
    if (workflowId) {
      return instances.filter(instance => instance.workflowId === workflowId);
    }
        
    return instances;
  }
    
  /**
     * Cancela una instancia en ejecución
     */
  cancelInstance(instanceId) {
    const instance = this.runningInstances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }
        
    instance.status = 'cancelled';
    instance.endTime = Date.now();
    instance.executionTime = instance.endTime - instance.startTime;
        
    this.runningInstances.delete(instanceId);
    this.emit('workflowCancelled', instance);
        
    return true;
  }
    
  /**
     * Obtiene estadísticas del motor
     */
  getStats() {
    return {
      ...this.metrics,
      workflows: {
        total: this.workflows.size,
        enabled: Array.from(this.workflows.values()).filter(w => w.enabled).length,
        disabled: Array.from(this.workflows.values()).filter(w => !w.enabled).length
      },
      instances: {
        running: this.runningInstances.size,
        maxConcurrent: this.config.maxConcurrentWorkflows
      },
      triggers: {
        total: this.triggers.size,
        active: Array.from(this.triggers.values()).filter(t => t.trigger.enabled).length
      }
    };
  }
    
  /**
     * Configura los timers del sistema
     */
  _setupTimers() {
    if (this.config.persistence.autoSave && this.config.persistence.saveInterval > 0) {
      this.saveTimer = setInterval(() => {
        this._saveData().catch(error => {
          this._log('error', `Auto-save failed: ${error.message}`);
        });
      }, this.config.persistence.saveInterval);
    }
        
    // Timer de limpieza de logs
    if (this.config.logging.retention > 0) {
      this.cleanupTimer = setInterval(() => {
        this._cleanupLogs();
      }, 60000); // Cada minuto
    }
  }
    
  /**
     * Configura los manejadores de eventos
     */
  _setupEventHandlers() {
    this.on('error', (error) => {
      this._log('error', `WorkflowEngine error: ${error.message}`);
    });
  }
    
  /**
     * Limpia logs antiguos
     */
  _cleanupLogs() {
    const cutoff = Date.now() - this.config.logging.retention;
    this.logs = this.logs.filter(log => new Date(log.timestamp).getTime() > cutoff);
        
    if (this.logs.length > this.config.logging.maxLogs) {
      this.logs = this.logs.slice(-this.config.logging.maxLogs);
    }
  }
    
  /**
     * Carga datos persistidos
     */
  async _loadPersistedData() {
    // Implementación simplificada - en producción cargar desde archivo/BD
    this._log('info', 'Loading persisted workflow data...');
  }
    
  /**
     * Guarda datos
     */
  async _saveData() {
    if (!this.config.persistence.enabled) return;
        
    const data = {
      workflows: Array.from(this.workflows.entries()),
      globalVariables: Array.from(this.globalVariables.entries()),
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    };
        
    // Implementación simplificada - en producción guardar en archivo/BD
    this._log('debug', 'Workflow data saved');
  }
    
  /**
     * Valida la configuración
     */
  _validateConfig() {
    if (this.config.maxConcurrentWorkflows <= 0) {
      throw new Error('maxConcurrentWorkflows must be greater than 0');
    }
        
    if (this.config.defaultTimeout <= 0) {
      throw new Error('defaultTimeout must be greater than 0');
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
      component: 'WorkflowEngine'
    };
        
    this.logs.push(logEntry);
    this.emit('log', logEntry);
        
    // Limitar logs en memoria
    if (this.logs.length > this.config.logging.maxLogs) {
      this.logs.shift();
    }
  }
    
  /**
     * Destruye el motor de workflows
     */
  async destroy() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
        
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    // Cancelar todas las instancias en ejecución
    for (const [instanceId] of this.runningInstances) {
      this.cancelInstance(instanceId);
    }
        
    if (this.config.persistence.enabled) {
      await this._saveData();
    }
        
    this.removeAllListeners();
    this.initialized = false;
        
    this._log('info', 'WorkflowEngine destroyed');
  }
}

export default WorkflowEngine;
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Motor de reglas de negocio para evaluación y ejecución de reglas complejas
 * Permite definir reglas condicionales con acciones automáticas
 */
class RuleEngine extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración general
      enabled: config.enabled !== false,
      maxRules: config.maxRules || 1000,
      maxConditionDepth: config.maxConditionDepth || 10,
            
      // Configuración de evaluación
      evaluation: {
        timeout: config.evaluation?.timeout || 5000,
        maxIterations: config.evaluation?.maxIterations || 1000,
        cacheResults: config.evaluation?.cacheResults !== false,
        cacheTimeout: config.evaluation?.cacheTimeout || 300000, // 5 minutos
        parallelEvaluation: config.evaluation?.parallelEvaluation !== false
      },
            
      // Configuración de operadores
      operators: {
        comparison: config.operators?.comparison || [
          'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin',
          'contains', 'startsWith', 'endsWith', 'matches', 'between'
        ],
        logical: config.operators?.logical || ['and', 'or', 'not', 'xor'],
        arithmetic: config.operators?.arithmetic || ['+', '-', '*', '/', '%', '**'],
        custom: config.operators?.custom || {}
      },
            
      // Configuración de funciones
      functions: {
        builtin: config.functions?.builtin !== false,
        custom: config.functions?.custom || {},
        allowUnsafe: config.functions?.allowUnsafe === true,
        timeout: config.functions?.timeout || 1000
      },
            
      // Configuración de variables
      variables: {
        global: config.variables?.global || {},
        readonly: config.variables?.readonly || [],
        maxSize: config.variables?.maxSize || 1024 * 1024, // 1MB
        allowedTypes: config.variables?.allowedTypes || [
          'string', 'number', 'boolean', 'object', 'array', 'null', 'undefined'
        ]
      },
            
      // Configuración de acciones
      actions: {
        maxPerRule: config.actions?.maxPerRule || 10,
        timeout: config.actions?.timeout || 30000,
        retryAttempts: config.actions?.retryAttempts || 3,
        retryDelay: config.actions?.retryDelay || 1000,
        allowAsync: config.actions?.allowAsync !== false
      },
            
      // Configuración de prioridades
      priorities: {
        enabled: config.priorities?.enabled !== false,
        levels: config.priorities?.levels || ['low', 'normal', 'high', 'critical'],
        defaultLevel: config.priorities?.defaultLevel || 'normal'
      },
            
      // Configuración de grupos
      groups: {
        enabled: config.groups?.enabled !== false,
        maxPerGroup: config.groups?.maxPerGroup || 100,
        executionMode: config.groups?.executionMode || 'sequential' // sequential, parallel, first-match
      },
            
      // Configuración de logging
      logging: {
        enabled: config.logging?.enabled !== false,
        level: config.logging?.level || 'info',
        logEvaluations: config.logging?.logEvaluations !== false,
        logActions: config.logging?.logActions !== false,
        maxLogs: config.logging?.maxLogs || 10000
      },
            
      // Configuración de métricas
      metrics: {
        enabled: config.metrics?.enabled !== false,
        collectTiming: config.metrics?.collectTiming !== false,
        collectMemory: config.metrics?.collectMemory !== false
      }
    };
        
    // Estado interno
    this.rules = new Map();
    this.ruleGroups = new Map();
    this.globalVariables = new Map(Object.entries(this.config.variables.global));
    this.evaluationCache = new Map();
    this.logs = [];
    this.metrics = {
      rulesCreated: 0,
      rulesEvaluated: 0,
      rulesMatched: 0,
      actionsExecuted: 0,
      actionsFailed: 0,
      averageEvaluationTime: 0,
      totalEvaluationTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
        
    // Funciones built-in
    this.builtinFunctions = this._initializeBuiltinFunctions();
        
    // Timers
    this.cacheCleanupTimer = null;
        
    this.initialized = false;
  }
    
  /**
     * Inicializa el motor de reglas
     */
  async initialize() {
    if (this.initialized) return;
        
    try {
      this._validateConfig();
      this._setupTimers();
      this._setupEventHandlers();
            
      this.initialized = true;
      this.emit('initialized');
            
      this._log('info', 'RuleEngine initialized successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Crea una nueva regla
     */
  async createRule(definition) {
    if (!this.initialized) {
      throw new Error('RuleEngine not initialized');
    }
        
    if (this.rules.size >= this.config.maxRules) {
      throw new Error('Maximum number of rules reached');
    }
        
    const rule = {
      id: definition.id || uuidv4(),
      name: definition.name || 'Unnamed Rule',
      description: definition.description || '',
      enabled: definition.enabled !== false,
            
      // Configuración de la regla
      config: {
        priority: definition.config?.priority || this.config.priorities.defaultLevel,
        group: definition.config?.group || null,
        tags: definition.config?.tags || [],
        timeout: definition.config?.timeout || this.config.evaluation.timeout,
        retryOnFailure: definition.config?.retryOnFailure !== false
      },
            
      // Condiciones de la regla
      conditions: this._validateConditions(definition.conditions),
            
      // Acciones a ejecutar cuando la regla coincide
      actions: this._validateActions(definition.actions || []),
            
      // Variables locales de la regla
      variables: definition.variables || {},
            
      // Metadatos
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: definition.metadata?.createdBy || 'system',
        version: definition.metadata?.version || '1.0.0'
      },
            
      // Estadísticas
      stats: {
        evaluations: 0,
        matches: 0,
        actionsExecuted: 0,
        actionsFailed: 0,
        averageEvaluationTime: 0,
        lastEvaluation: null,
        lastMatch: null
      }
    };
        
    this.rules.set(rule.id, rule);
        
    // Agregar a grupo si está especificado
    if (rule.config.group) {
      this._addRuleToGroup(rule);
    }
        
    this.metrics.rulesCreated++;
    this.emit('ruleCreated', rule);
        
    this._log('info', `Rule created: ${rule.name} (${rule.id})`);
        
    return rule;
  }
    
  /**
     * Evalúa reglas contra un contexto
     */
  async evaluateRules(context = {}, options = {}) {
    const startTime = Date.now();
        
    try {
      const {
        ruleIds = null,
        groups = null,
        priority = null,
        tags = null,
        stopOnFirstMatch = false,
        maxMatches = null
      } = options;
            
      // Filtrar reglas a evaluar
      let rulesToEvaluate = this._filterRules({
        ruleIds,
        groups,
        priority,
        tags,
        enabled: true
      });
            
      // Ordenar por prioridad
      rulesToEvaluate = this._sortRulesByPriority(rulesToEvaluate);
            
      const results = {
        evaluatedRules: 0,
        matchedRules: 0,
        executedActions: 0,
        failedActions: 0,
        matches: [],
        errors: [],
        executionTime: 0
      };
            
      // Crear contexto de evaluación
      const evaluationContext = this._createEvaluationContext(context);
            
      let matchCount = 0;
            
      for (const rule of rulesToEvaluate) {
        if (maxMatches && matchCount >= maxMatches) {
          break;
        }
                
        try {
          const ruleResult = await this._evaluateRule(rule, evaluationContext);
          results.evaluatedRules++;
                    
          if (ruleResult.matched) {
            results.matchedRules++;
            matchCount++;
                        
            const match = {
              ruleId: rule.id,
              ruleName: rule.name,
              priority: rule.config.priority,
              conditions: ruleResult.conditions,
              actions: ruleResult.actions,
              executionTime: ruleResult.executionTime,
              timestamp: new Date().toISOString()
            };
                        
            results.matches.push(match);
            results.executedActions += ruleResult.actions.filter(a => a.status === 'success').length;
            results.failedActions += ruleResult.actions.filter(a => a.status === 'failed').length;
                        
            this.emit('ruleMatched', rule, match, evaluationContext);
                        
            if (stopOnFirstMatch) {
              break;
            }
          }
                    
        } catch (error) {
          results.errors.push({
            ruleId: rule.id,
            ruleName: rule.name,
            error: error.message,
            timestamp: new Date().toISOString()
          });
                    
          this._log('error', `Rule evaluation failed: ${rule.name} - ${error.message}`);
        }
      }
            
      results.executionTime = Date.now() - startTime;
            
      // Actualizar métricas
      this.metrics.rulesEvaluated += results.evaluatedRules;
      this.metrics.rulesMatched += results.matchedRules;
      this.metrics.actionsExecuted += results.executedActions;
      this.metrics.actionsFailed += results.failedActions;
            
      const totalTime = this.metrics.totalEvaluationTime + results.executionTime;
      this.metrics.totalEvaluationTime = totalTime;
      this.metrics.averageEvaluationTime = totalTime / this.metrics.rulesEvaluated;
            
      this.emit('evaluationCompleted', results);
            
      return results;
            
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Evalúa una regla individual
     */
  async _evaluateRule(rule, context) {
    const startTime = Date.now();
        
    try {
      // Verificar caché
      const cacheKey = this._generateCacheKey(rule.id, context);
      if (this.config.evaluation.cacheResults && this.evaluationCache.has(cacheKey)) {
        this.metrics.cacheHits++;
        return this.evaluationCache.get(cacheKey);
      }
            
      this.metrics.cacheMisses++;
            
      // Crear contexto local con variables de la regla
      const localContext = {
        ...context,
        variables: new Map([
          ...context.variables,
          ...Object.entries(rule.variables)
        ])
      };
            
      // Evaluar condiciones
      const conditionsResult = await this._evaluateConditions(rule.conditions, localContext);
            
      const result = {
        matched: conditionsResult.result,
        conditions: conditionsResult,
        actions: [],
        executionTime: 0
      };
            
      // Si la regla coincide, ejecutar acciones
      if (result.matched) {
        result.actions = await this._executeActions(rule.actions, localContext);
                
        rule.stats.matches++;
        rule.stats.lastMatch = new Date().toISOString();
                
        this.emit('ruleMatched', rule, result, localContext);
      }
            
      // Actualizar estadísticas de la regla
      rule.stats.evaluations++;
      rule.stats.lastEvaluation = new Date().toISOString();
            
      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;
            
      rule.stats.averageEvaluationTime = 
                ((rule.stats.averageEvaluationTime * (rule.stats.evaluations - 1)) + executionTime) / 
                rule.stats.evaluations;
            
      // Guardar en caché
      if (this.config.evaluation.cacheResults) {
        this.evaluationCache.set(cacheKey, result);
      }
            
      return result;
            
    } catch (error) {
      this._log('error', `Rule evaluation error: ${rule.name} - ${error.message}`);
      throw error;
    }
  }
    
  /**
     * Evalúa condiciones
     */
  async _evaluateConditions(conditions, context) {
    if (!conditions) {
      return { result: true, details: [] };
    }
        
    const result = await this._evaluateConditionNode(conditions, context);
        
    return {
      result: result.value,
      details: result.details || [],
      evaluationTime: result.evaluationTime || 0
    };
  }
    
  /**
     * Evalúa un nodo de condición
     */
  async _evaluateConditionNode(node, context, depth = 0) {
    if (depth > this.config.maxConditionDepth) {
      throw new Error('Maximum condition depth exceeded');
    }
        
    const startTime = Date.now();
        
    try {
      let result;
            
      if (typeof node === 'boolean') {
        result = { value: node, type: 'literal' };
      } else if (typeof node === 'string') {
        result = { value: this._evaluateExpression(node, context), type: 'expression' };
      } else if (typeof node === 'object' && node !== null) {
        result = await this._evaluateConditionObject(node, context, depth);
      } else {
        result = { value: false, type: 'unknown' };
      }
            
      result.evaluationTime = Date.now() - startTime;
            
      return result;
            
    } catch (error) {
      throw new Error(`Condition evaluation failed: ${error.message}`);
    }
  }
    
  /**
     * Evalúa un objeto de condición
     */
  async _evaluateConditionObject(condition, context, depth) {
    const { operator, operands, left, right, value, field, conditions } = condition;
        
    if (!operator) {
      throw new Error('Condition operator is required');
    }
        
    const details = [];
        
    switch (operator) {
    // Operadores lógicos
    case 'and':
      return await this._evaluateLogicalAnd(conditions || operands, context, depth, details);
    case 'or':
      return await this._evaluateLogicalOr(conditions || operands, context, depth, details);
    case 'not':
      return await this._evaluateLogicalNot(conditions?.[0] || operands?.[0], context, depth, details);
    case 'xor':
      return await this._evaluateLogicalXor(conditions || operands, context, depth, details);
            
      // Operadores de comparación
    case 'eq':
    case 'ne':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return this._evaluateComparison(operator, left, right, context, details);
            
    case 'in':
    case 'nin':
      return this._evaluateInclusion(operator, left, right, context, details);
            
    case 'contains':
    case 'startsWith':
    case 'endsWith':
      return this._evaluateStringOperation(operator, left, right, context, details);
            
    case 'matches':
      return this._evaluateRegex(left, right, context, details);
            
    case 'between':
      return this._evaluateBetween(left, right, context, details);
            
    case 'exists':
      return this._evaluateExists(field || left, context, details);
            
    case 'function':
      return await this._evaluateFunction(condition, context, details);
            
      // Operadores personalizados
    default:
      if (this.config.operators.custom[operator]) {
        return await this._evaluateCustomOperator(operator, condition, context, details);
      }
      throw new Error(`Unknown operator: ${operator}`);
    }
  }
    
  /**
     * Evalúa operador AND lógico
     */
  async _evaluateLogicalAnd(conditions, context, depth, details) {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return { value: true, type: 'logical', operator: 'and', details };
    }
        
    for (const condition of conditions) {
      const result = await this._evaluateConditionNode(condition, context, depth + 1);
      details.push(result);
            
      if (!result.value) {
        return { value: false, type: 'logical', operator: 'and', details };
      }
    }
        
    return { value: true, type: 'logical', operator: 'and', details };
  }
    
  /**
     * Evalúa operador OR lógico
     */
  async _evaluateLogicalOr(conditions, context, depth, details) {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return { value: false, type: 'logical', operator: 'or', details };
    }
        
    for (const condition of conditions) {
      const result = await this._evaluateConditionNode(condition, context, depth + 1);
      details.push(result);
            
      if (result.value) {
        return { value: true, type: 'logical', operator: 'or', details };
      }
    }
        
    return { value: false, type: 'logical', operator: 'or', details };
  }
    
  /**
     * Evalúa operador NOT lógico
     */
  async _evaluateLogicalNot(condition, context, depth, details) {
    if (!condition) {
      return { value: true, type: 'logical', operator: 'not', details };
    }
        
    const result = await this._evaluateConditionNode(condition, context, depth + 1);
    details.push(result);
        
    return { value: !result.value, type: 'logical', operator: 'not', details };
  }
    
  /**
     * Evalúa operador XOR lógico
     */
  async _evaluateLogicalXor(conditions, context, depth, details) {
    if (!Array.isArray(conditions) || conditions.length !== 2) {
      throw new Error('XOR operator requires exactly 2 conditions');
    }
        
    const results = await Promise.all(
      conditions.map(condition => this._evaluateConditionNode(condition, context, depth + 1))
    );
        
    details.push(...results);
        
    const trueCount = results.filter(r => r.value).length;
    return { value: trueCount === 1, type: 'logical', operator: 'xor', details };
  }
    
  /**
     * Evalúa operadores de comparación
     */
  _evaluateComparison(operator, left, right, context, details) {
    const leftValue = this._resolveValue(left, context);
    const rightValue = this._resolveValue(right, context);
        
    let result;
        
    switch (operator) {
    case 'eq':
      result = leftValue === rightValue;
      break;
    case 'ne':
      result = leftValue !== rightValue;
      break;
    case 'gt':
      result = leftValue > rightValue;
      break;
    case 'gte':
      result = leftValue >= rightValue;
      break;
    case 'lt':
      result = leftValue < rightValue;
      break;
    case 'lte':
      result = leftValue <= rightValue;
      break;
    default:
      throw new Error(`Unknown comparison operator: ${operator}`);
    }
        
    const detail = {
      value: result,
      type: 'comparison',
      operator,
      left: leftValue,
      right: rightValue
    };
        
    details.push(detail);
        
    return { value: result, type: 'comparison', operator, details };
  }
    
  /**
     * Evalúa operadores de inclusión
     */
  _evaluateInclusion(operator, left, right, context, details) {
    const leftValue = this._resolveValue(left, context);
    const rightValue = this._resolveValue(right, context);
        
    if (!Array.isArray(rightValue)) {
      throw new Error('Right operand for inclusion operator must be an array');
    }
        
    const result = operator === 'in' 
      ? rightValue.includes(leftValue)
      : !rightValue.includes(leftValue);
        
    const detail = {
      value: result,
      type: 'inclusion',
      operator,
      left: leftValue,
      right: rightValue
    };
        
    details.push(detail);
        
    return { value: result, type: 'inclusion', operator, details };
  }
    
  /**
     * Evalúa operaciones de string
     */
  _evaluateStringOperation(operator, left, right, context, details) {
    const leftValue = String(this._resolveValue(left, context));
    const rightValue = String(this._resolveValue(right, context));
        
    let result;
        
    switch (operator) {
    case 'contains':
      result = leftValue.includes(rightValue);
      break;
    case 'startsWith':
      result = leftValue.startsWith(rightValue);
      break;
    case 'endsWith':
      result = leftValue.endsWith(rightValue);
      break;
    default:
      throw new Error(`Unknown string operator: ${operator}`);
    }
        
    const detail = {
      value: result,
      type: 'string',
      operator,
      left: leftValue,
      right: rightValue
    };
        
    details.push(detail);
        
    return { value: result, type: 'string', operator, details };
  }
    
  /**
     * Evalúa expresión regular
     */
  _evaluateRegex(left, right, context, details) {
    const leftValue = String(this._resolveValue(left, context));
    const rightValue = this._resolveValue(right, context);
        
    let regex;
    if (typeof rightValue === 'string') {
      regex = new RegExp(rightValue);
    } else if (rightValue instanceof RegExp) {
      regex = rightValue;
    } else {
      throw new Error('Right operand for matches operator must be a string or RegExp');
    }
        
    const result = regex.test(leftValue);
        
    const detail = {
      value: result,
      type: 'regex',
      operator: 'matches',
      left: leftValue,
      right: rightValue
    };
        
    details.push(detail);
        
    return { value: result, type: 'regex', operator: 'matches', details };
  }
    
  /**
     * Evalúa operador between
     */
  _evaluateBetween(left, right, context, details) {
    const leftValue = this._resolveValue(left, context);
    const rightValue = this._resolveValue(right, context);
        
    if (!Array.isArray(rightValue) || rightValue.length !== 2) {
      throw new Error('Right operand for between operator must be an array with 2 elements');
    }
        
    const [min, max] = rightValue;
    const result = leftValue >= min && leftValue <= max;
        
    const detail = {
      value: result,
      type: 'range',
      operator: 'between',
      left: leftValue,
      right: rightValue
    };
        
    details.push(detail);
        
    return { value: result, type: 'range', operator: 'between', details };
  }
    
  /**
     * Evalúa existencia de campo
     */
  _evaluateExists(field, context, details) {
    const result = context.variables.has(field) || 
                      (context.data && field in context.data);
        
    const detail = {
      value: result,
      type: 'existence',
      operator: 'exists',
      field
    };
        
    details.push(detail);
        
    return { value: result, type: 'existence', operator: 'exists', details };
  }
    
  /**
     * Evalúa función
     */
  async _evaluateFunction(condition, context, details) {
    const { name, args = [] } = condition;
        
    if (!name) {
      throw new Error('Function name is required');
    }
        
    // Resolver argumentos
    const resolvedArgs = args.map(arg => this._resolveValue(arg, context));
        
    let result;
        
    // Buscar función built-in
    if (this.builtinFunctions[name]) {
      result = await this.builtinFunctions[name](...resolvedArgs);
    }
    // Buscar función personalizada
    else if (this.config.functions.custom[name]) {
      const customFunction = this.config.functions.custom[name];
            
      if (typeof customFunction !== 'function') {
        throw new Error(`Custom function ${name} is not a function`);
      }
            
      // Ejecutar con timeout
      result = await this._executeWithTimeout(
        () => customFunction(...resolvedArgs),
        this.config.functions.timeout
      );
    } else {
      throw new Error(`Unknown function: ${name}`);
    }
        
    const detail = {
      value: result,
      type: 'function',
      name,
      args: resolvedArgs
    };
        
    details.push(detail);
        
    return { value: result, type: 'function', name, details };
  }
    
  /**
     * Evalúa operador personalizado
     */
  async _evaluateCustomOperator(operator, condition, context, details) {
    const customOperator = this.config.operators.custom[operator];
        
    if (typeof customOperator !== 'function') {
      throw new Error(`Custom operator ${operator} is not a function`);
    }
        
    const result = await customOperator(condition, context);
        
    const detail = {
      value: result,
      type: 'custom',
      operator,
      condition
    };
        
    details.push(detail);
        
    return { value: result, type: 'custom', operator, details };
  }
    
  /**
     * Ejecuta acciones
     */
  async _executeActions(actions, context) {
    const results = [];
        
    for (const action of actions) {
      try {
        const result = await this._executeAction(action, context);
        results.push({
          actionId: action.id,
          actionType: action.type,
          status: 'success',
          result,
          executionTime: result.executionTime || 0,
          timestamp: new Date().toISOString()
        });
                
        this.emit('actionExecuted', action, result, context);
                
      } catch (error) {
        results.push({
          actionId: action.id,
          actionType: action.type,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
                
        this.emit('actionFailed', action, error, context);
                
        this._log('error', `Action execution failed: ${action.type} - ${error.message}`);
      }
    }
        
    return results;
  }
    
  /**
     * Ejecuta una acción individual
     */
  async _executeAction(action, context) {
    const startTime = Date.now();
        
    const { type, config = {} } = action;
        
    // Resolver configuración con variables
    const resolvedConfig = this._resolveActionConfig(config, context);
        
    let result;
        
    switch (type) {
    case 'log':
      result = this._executeLogAction(resolvedConfig);
      break;
    case 'variable':
      result = this._executeVariableAction(resolvedConfig, context);
      break;
    case 'webhook':
      result = await this._executeWebhookAction(resolvedConfig);
      break;
    case 'notification':
      result = await this._executeNotificationAction(resolvedConfig);
      break;
    case 'workflow':
      result = await this._executeWorkflowAction(resolvedConfig);
      break;
    case 'custom':
      result = await this._executeCustomAction(resolvedConfig, context);
      break;
    default:
      throw new Error(`Unknown action type: ${type}`);
    }
        
    result.executionTime = Date.now() - startTime;
        
    return result;
  }
    
  /**
     * Ejecuta acción de log
     */
  _executeLogAction(config) {
    const { level = 'info', message = '' } = config;
    this._log(level, message);
    return { logged: true, level, message };
  }
    
  /**
     * Ejecuta acción de variable
     */
  _executeVariableAction(config, context) {
    const { operation, name, value } = config;
        
    switch (operation) {
    case 'set':
      context.variables.set(name, value);
      return { variableSet: name, value };
    case 'delete':
      context.variables.delete(name);
      return { variableDeleted: name };
    case 'increment':
      const currentValue = context.variables.get(name) || 0;
      const newValue = currentValue + (value || 1);
      context.variables.set(name, newValue);
      return { variableIncremented: name, value: newValue };
    default:
      throw new Error(`Unknown variable operation: ${operation}`);
    }
  }
    
  /**
     * Ejecuta acción de webhook
     */
  async _executeWebhookAction(config) {
    const { url, method = 'POST', headers = {}, body } = config;
        
    // Implementación simplificada - en producción usar cliente HTTP real
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          webhookCalled: true,
          url,
          method,
          status: 200
        });
      }, 100);
    });
  }
    
  /**
     * Ejecuta acción de notificación
     */
  async _executeNotificationAction(config) {
    const { channel, message, recipients } = config;
        
    this.emit('notificationRequested', {
      channel,
      message,
      recipients
    });
        
    return {
      notificationSent: true,
      channel,
      recipients
    };
  }
    
  /**
     * Ejecuta acción de workflow
     */
  async _executeWorkflowAction(config) {
    const { workflowId, context: workflowContext = {} } = config;
        
    this.emit('workflowRequested', {
      workflowId,
      context: workflowContext
    });
        
    return {
      workflowTriggered: true,
      workflowId
    };
  }
    
  /**
     * Ejecuta acción personalizada
     */
  async _executeCustomAction(config, context) {
    const { function: customFunction, parameters = {} } = config;
        
    if (typeof customFunction !== 'function') {
      throw new Error('Custom action function is required');
    }
        
    return await this._executeWithTimeout(
      () => customFunction(parameters, context),
      this.config.actions.timeout
    );
  }
    
  /**
     * Resuelve configuración de acción con variables
     */
  _resolveActionConfig(config, context) {
    return this._resolveValue(config, context);
  }
    
  /**
     * Resuelve un valor con variables del contexto
     */
  _resolveValue(value, context) {
    if (typeof value === 'string') {
      // Reemplazar variables ${variable}
      return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        if (context.variables.has(varName)) {
          return String(context.variables.get(varName));
        }
        if (context.data && varName in context.data) {
          return String(context.data[varName]);
        }
        return match;
      });
    }
        
    if (Array.isArray(value)) {
      return value.map(item => this._resolveValue(item, context));
    }
        
    if (typeof value === 'object' && value !== null) {
      const resolved = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this._resolveValue(val, context);
      }
      return resolved;
    }
        
    return value;
  }
    
  /**
     * Evalúa una expresión
     */
  _evaluateExpression(expression, context) {
    // Implementación simplificada - en producción usar un evaluador seguro
    if (typeof expression !== 'string') {
      return expression;
    }
        
    // Reemplazar variables
    let resolvedExpression = expression;
        
    for (const [key, value] of context.variables) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      resolvedExpression = resolvedExpression.replace(regex, JSON.stringify(value));
    }
        
    try {
      return Function(`"use strict"; return (${resolvedExpression})`)();
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${expression}`);
    }
  }
    
  /**
     * Crea contexto de evaluación
     */
  _createEvaluationContext(context) {
    return {
      data: context.data || {},
      variables: new Map([
        ...this.globalVariables,
        ...Object.entries(context.variables || {})
      ]),
      timestamp: new Date().toISOString(),
      metadata: context.metadata || {}
    };
  }
    
  /**
     * Filtra reglas según criterios
     */
  _filterRules(criteria) {
    let rules = Array.from(this.rules.values());
        
    if (criteria.ruleIds) {
      const ruleIdSet = new Set(criteria.ruleIds);
      rules = rules.filter(rule => ruleIdSet.has(rule.id));
    }
        
    if (criteria.groups) {
      const groupSet = new Set(criteria.groups);
      rules = rules.filter(rule => rule.config.group && groupSet.has(rule.config.group));
    }
        
    if (criteria.priority) {
      rules = rules.filter(rule => rule.config.priority === criteria.priority);
    }
        
    if (criteria.tags && criteria.tags.length > 0) {
      rules = rules.filter(rule => 
        criteria.tags.some(tag => rule.config.tags.includes(tag))
      );
    }
        
    if (criteria.enabled !== undefined) {
      rules = rules.filter(rule => rule.enabled === criteria.enabled);
    }
        
    return rules;
  }
    
  /**
     * Ordena reglas por prioridad
     */
  _sortRulesByPriority(rules) {
    const priorityOrder = {
      'critical': 0,
      'high': 1,
      'normal': 2,
      'low': 3
    };
        
    return rules.sort((a, b) => {
      const aPriority = priorityOrder[a.config.priority] || 2;
      const bPriority = priorityOrder[b.config.priority] || 2;
      return aPriority - bPriority;
    });
  }
    
  /**
     * Agrega regla a grupo
     */
  _addRuleToGroup(rule) {
    const groupName = rule.config.group;
        
    if (!this.ruleGroups.has(groupName)) {
      this.ruleGroups.set(groupName, {
        name: groupName,
        rules: [],
        config: {
          executionMode: this.config.groups.executionMode,
          maxRules: this.config.groups.maxPerGroup
        }
      });
    }
        
    const group = this.ruleGroups.get(groupName);
        
    if (group.rules.length >= group.config.maxRules) {
      throw new Error(`Group ${groupName} has reached maximum rules limit`);
    }
        
    group.rules.push(rule.id);
  }
    
  /**
     * Genera clave de caché
     */
  _generateCacheKey(ruleId, context) {
    const contextHash = this._hashObject({
      data: context.data,
      variables: Object.fromEntries(context.variables)
    });
        
    return `${ruleId}:${contextHash}`;
  }
    
  /**
     * Genera hash de objeto
     */
  _hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
        
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
        
    return hash.toString(36);
  }
    
  /**
     * Ejecuta función con timeout
     */
  async _executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Function execution timeout'));
      }, timeout);
            
      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
    
  /**
     * Inicializa funciones built-in
     */
  _initializeBuiltinFunctions() {
    return {
      // Funciones matemáticas
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      max: Math.max,
      min: Math.min,
            
      // Funciones de string
      length: (str) => String(str).length,
      upper: (str) => String(str).toUpperCase(),
      lower: (str) => String(str).toLowerCase(),
      trim: (str) => String(str).trim(),
            
      // Funciones de array
      size: (arr) => Array.isArray(arr) ? arr.length : 0,
      includes: (arr, item) => Array.isArray(arr) ? arr.includes(item) : false,
            
      // Funciones de fecha
      now: () => Date.now(),
      today: () => new Date().toISOString().split('T')[0],
            
      // Funciones de tipo
      isString: (value) => typeof value === 'string',
      isNumber: (value) => typeof value === 'number',
      isBoolean: (value) => typeof value === 'boolean',
      isArray: (value) => Array.isArray(value),
      isObject: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
      isNull: (value) => value === null,
      isUndefined: (value) => value === undefined
    };
  }
    
  /**
     * Valida condiciones
     */
  _validateConditions(conditions) {
    if (!conditions) return null;
        
    // Validación básica - en producción implementar validación más robusta
    return conditions;
  }
    
  /**
     * Valida acciones
     */
  _validateActions(actions) {
    if (!Array.isArray(actions)) {
      throw new Error('Actions must be an array');
    }
        
    if (actions.length > this.config.actions.maxPerRule) {
      throw new Error(`Maximum ${this.config.actions.maxPerRule} actions per rule`);
    }
        
    return actions.map((action, index) => ({
      id: action.id || uuidv4(),
      type: action.type || 'log',
      config: action.config || {},
      enabled: action.enabled !== false
    }));
  }
    
  /**
     * Obtiene una regla por ID
     */
  getRule(ruleId) {
    return this.rules.get(ruleId);
  }
    
  /**
     * Lista todas las reglas
     */
  listRules(filter = {}) {
    return this._filterRules(filter);
  }
    
  /**
     * Actualiza una regla
     */
  async updateRule(ruleId, updates) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
        
    const allowedUpdates = ['name', 'description', 'enabled', 'config', 'conditions', 'actions', 'variables'];
        
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'conditions') {
          rule[field] = this._validateConditions(updates[field]);
        } else if (field === 'actions') {
          rule[field] = this._validateActions(updates[field]);
        } else {
          rule[field] = updates[field];
        }
      }
    });
        
    rule.metadata.updatedAt = new Date().toISOString();
        
    this.emit('ruleUpdated', rule);
        
    return rule;
  }
    
  /**
     * Elimina una regla
     */
  async deleteRule(ruleId) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
        
    // Remover de grupos
    if (rule.config.group) {
      const group = this.ruleGroups.get(rule.config.group);
      if (group) {
        group.rules = group.rules.filter(id => id !== ruleId);
        if (group.rules.length === 0) {
          this.ruleGroups.delete(rule.config.group);
        }
      }
    }
        
    this.rules.delete(ruleId);
    this.emit('ruleDeleted', rule);
        
    return true;
  }
    
  /**
     * Obtiene estadísticas del motor
     */
  getStats() {
    return {
      ...this.metrics,
      rules: {
        total: this.rules.size,
        enabled: Array.from(this.rules.values()).filter(r => r.enabled).length,
        disabled: Array.from(this.rules.values()).filter(r => !r.enabled).length
      },
      groups: {
        total: this.ruleGroups.size
      },
      cache: {
        size: this.evaluationCache.size,
        hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
      }
    };
  }
    
  /**
     * Limpia caché de evaluación
     */
  clearCache() {
    this.evaluationCache.clear();
    this._log('info', 'Evaluation cache cleared');
  }
    
  /**
     * Configura timers del sistema
     */
  _setupTimers() {
    if (this.config.evaluation.cacheTimeout > 0) {
      this.cacheCleanupTimer = setInterval(() => {
        this._cleanupCache();
      }, this.config.evaluation.cacheTimeout);
    }
  }
    
  /**
     * Configura manejadores de eventos
     */
  _setupEventHandlers() {
    this.on('error', (error) => {
      this._log('error', `RuleEngine error: ${error.message}`);
    });
  }
    
  /**
     * Limpia caché expirado
     */
  _cleanupCache() {
    // Implementación simplificada - en producción implementar TTL real
    if (this.evaluationCache.size > 1000) {
      this.evaluationCache.clear();
      this._log('debug', 'Cache cleaned up due to size limit');
    }
  }
    
  /**
     * Valida configuración
     */
  _validateConfig() {
    if (this.config.maxRules <= 0) {
      throw new Error('maxRules must be greater than 0');
    }
        
    if (this.config.maxConditionDepth <= 0) {
      throw new Error('maxConditionDepth must be greater than 0');
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
      component: 'RuleEngine'
    };
        
    this.logs.push(logEntry);
    this.emit('log', logEntry);
        
    if (this.logs.length > this.config.logging.maxLogs) {
      this.logs.shift();
    }
  }
    
  /**
     * Destruye el motor de reglas
     */
  async destroy() {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
        
    this.clearCache();
    this.removeAllListeners();
    this.initialized = false;
        
    this._log('info', 'RuleEngine destroyed');
  }
}

export default RuleEngine;
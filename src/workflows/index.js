import WorkflowEngine from './WorkflowEngine.js';
import RuleEngine from './RuleEngine.js';
import AutomationManager from './AutomationManager.js';

/**
 * Configuración por defecto para el sistema de workflows
 */
const DEFAULT_WORKFLOW_CONFIG = {
  // Configuración del motor de workflows
  workflowEngine: {
    enabled: true,
    maxWorkflows: 100,
    maxConcurrentExecutions: 10,
    persistence: {
      type: 'memory',
      config: {}
    },
    execution: {
      timeout: 300000, // 5 minutos
      retryAttempts: 3,
      retryDelay: 1000,
      errorHandling: 'continue'
    },
    variables: {
      global: {},
      encryption: false
    },
    conditions: {
      operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'regex'],
      customFunctions: {}
    },
    triggers: {
      event: { enabled: true },
      schedule: { enabled: true },
      webhook: { enabled: true }
    },
    logging: {
      enabled: true,
      level: 'info',
      maxLogs: 1000
    },
    metrics: {
      enabled: true,
      retention: 86400000 // 24 horas
    }
  },
    
  // Configuración del motor de reglas
  ruleEngine: {
    enabled: true,
    maxRules: 500,
    maxConditions: 50,
    evaluation: {
      timeout: 30000,
      maxIterations: 1000,
      cache: true,
      parallel: false
    },
    operators: {
      comparison: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
      logical: ['and', 'or', 'not'],
      arithmetic: ['add', 'sub', 'mul', 'div', 'mod'],
      custom: {}
    },
    functions: {
      builtin: true,
      custom: {},
      security: true
    },
    variables: {
      global: {},
      readonly: [],
      maxSize: 1024 * 1024, // 1MB
      allowedTypes: ['string', 'number', 'boolean', 'object', 'array']
    },
    actions: {
      maxPerRule: 10,
      timeout: 10000,
      retryAttempts: 2,
      async: true
    },
    priorities: {
      enabled: true,
      default: 'normal'
    },
    groups: {
      enabled: true,
      executionMode: 'sequential'
    },
    logging: {
      enabled: true,
      level: 'info',
      maxLogs: 1000
    },
    metrics: {
      enabled: true,
      retention: 86400000
    }
  },
    
  // Configuración del gestor de automatización
  automationManager: {
    enabled: true,
    maxAutomations: 500,
    workflows: {
      enabled: true,
      config: {}
    },
    rules: {
      enabled: true,
      config: {}
    },
    integration: {
      shareVariables: true,
      shareEvents: true,
      crossTriggers: true,
      conflictResolution: 'priority'
    },
    events: {
      enabled: true,
      maxListeners: 100,
      eventHistory: true,
      historySize: 1000
    },
    triggers: {
      enabled: true,
      debounceTime: 1000,
      maxPerAutomation: 10,
      globalTriggers: []
    },
    context: {
      global: {},
      persistent: true,
      encryption: false,
      maxSize: 10 * 1024 * 1024 // 10MB
    },
    monitoring: {
      enabled: true,
      healthChecks: true,
      performanceMetrics: true,
      alerting: false
    },
    logging: {
      enabled: true,
      level: 'info',
      includeContext: true,
      maxLogs: 10000
    }
  }
};

/**
 * Constantes del sistema de workflows
 */
const WORKFLOW_CONSTANTS = {
  // Estados de workflow
  WORKFLOW_STATES: {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    PAUSED: 'paused'
  },
    
  // Estados de instancia
  INSTANCE_STATES: {
    CREATED: 'created',
    STARTED: 'started',
    RUNNING: 'running',
    WAITING: 'waiting',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  },
    
  // Tipos de paso
  STEP_TYPES: {
    ACTION: 'action',
    CONDITION: 'condition',
    LOOP: 'loop',
    PARALLEL: 'parallel',
    DELAY: 'delay',
    VARIABLE: 'variable',
    WEBHOOK: 'webhook',
    NOTIFICATION: 'notification'
  },
    
  // Tipos de acción
  ACTION_TYPES: {
    LOG: 'log',
    HTTP: 'http',
    DATABASE: 'database',
    FILE: 'file',
    EMAIL: 'email',
    CUSTOM: 'custom'
  },
    
  // Tipos de trigger
  TRIGGER_TYPES: {
    EVENT: 'event',
    SCHEDULE: 'schedule',
    WEBHOOK: 'webhook',
    CONDITION: 'condition'
  },
    
  // Operadores de condición
  CONDITION_OPERATORS: {
    EQ: 'eq',
    NE: 'ne',
    GT: 'gt',
    GTE: 'gte',
    LT: 'lt',
    LTE: 'lte',
    IN: 'in',
    CONTAINS: 'contains',
    REGEX: 'regex',
    AND: 'and',
    OR: 'or',
    NOT: 'not'
  },
    
  // Estados de regla
  RULE_STATES: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DISABLED: 'disabled'
  },
    
  // Prioridades
  PRIORITIES: {
    CRITICAL: 'critical',
    HIGH: 'high',
    NORMAL: 'normal',
    LOW: 'low'
  },
    
  // Tipos de automatización
  AUTOMATION_TYPES: {
    WORKFLOW: 'workflow',
    RULE: 'rule',
    HYBRID: 'hybrid'
  },
    
  // Eventos del sistema
  EVENTS: {
    // Workflow events
    WORKFLOW_CREATED: 'workflowCreated',
    WORKFLOW_STARTED: 'workflowStarted',
    WORKFLOW_COMPLETED: 'workflowCompleted',
    WORKFLOW_FAILED: 'workflowFailed',
    WORKFLOW_CANCELLED: 'workflowCancelled',
    STEP_STARTED: 'stepStarted',
    STEP_COMPLETED: 'stepCompleted',
    STEP_FAILED: 'stepFailed',
        
    // Rule events
    RULE_CREATED: 'ruleCreated',
    RULE_MATCHED: 'ruleMatched',
    RULE_FAILED: 'ruleFailed',
    ACTION_EXECUTED: 'actionExecuted',
        
    // Automation events
    AUTOMATION_CREATED: 'automationCreated',
    AUTOMATION_STARTED: 'automationStarted',
    AUTOMATION_COMPLETED: 'automationCompleted',
    AUTOMATION_FAILED: 'automationFailed',
    AUTOMATION_UPDATED: 'automationUpdated',
    AUTOMATION_DELETED: 'automationDeleted',
        
    // System events
    HEALTH_CHECK: 'healthCheck',
    METRICS_UPDATE: 'metricsUpdate',
    LOG: 'log',
    ERROR: 'error'
  }
};

/**
 * Utilidades para el sistema de workflows
 */
class WorkflowUtils {
  /**
     * Valida configuración de workflow
     */
  static validateWorkflowConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Workflow config must be an object');
    }
        
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Workflow name is required and must be a string');
    }
        
    if (!config.steps || !Array.isArray(config.steps)) {
      throw new Error('Workflow steps are required and must be an array');
    }
        
    if (config.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }
        
    return true;
  }
    
  /**
     * Valida configuración de regla
     */
  static validateRuleConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Rule config must be an object');
    }
        
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Rule name is required and must be a string');
    }
        
    if (!config.conditions) {
      throw new Error('Rule conditions are required');
    }
        
    if (!config.actions || !Array.isArray(config.actions)) {
      throw new Error('Rule actions are required and must be an array');
    }
        
    return true;
  }
    
  /**
     * Valida configuración de automatización
     */
  static validateAutomationConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Automation config must be an object');
    }
        
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Automation name is required and must be a string');
    }
        
    if (!config.type || !Object.values(WORKFLOW_CONSTANTS.AUTOMATION_TYPES).includes(config.type)) {
      throw new Error('Automation type is required and must be valid');
    }
        
    if (config.type === 'workflow' && !config.workflow) {
      throw new Error('Workflow automation must have workflow definition');
    }
        
    if (config.type === 'rule' && (!config.rules || config.rules.length === 0)) {
      throw new Error('Rule automation must have rule definitions');
    }
        
    return true;
  }
    
  /**
     * Combina configuraciones
     */
  static mergeConfigs(defaultConfig, userConfig) {
    const merged = JSON.parse(JSON.stringify(defaultConfig));
        
    function deepMerge(target, source) {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
        
    deepMerge(merged, userConfig);
    return merged;
  }
    
  /**
     * Crea configuración optimizada para desarrollo
     */
  static createDevelopmentConfig(overrides = {}) {
    const devConfig = {
      workflowEngine: {
        maxWorkflows: 50,
        maxConcurrentExecutions: 5,
        execution: {
          timeout: 60000, // 1 minuto
          retryAttempts: 1
        },
        logging: {
          level: 'debug'
        }
      },
      ruleEngine: {
        maxRules: 100,
        evaluation: {
          timeout: 10000,
          cache: false
        },
        logging: {
          level: 'debug'
        }
      },
      automationManager: {
        maxAutomations: 100,
        monitoring: {
          healthChecks: false,
          performanceMetrics: false
        },
        logging: {
          level: 'debug'
        }
      }
    };
        
    return this.mergeConfigs(DEFAULT_WORKFLOW_CONFIG, this.mergeConfigs(devConfig, overrides));
  }
    
  /**
     * Crea configuración optimizada para producción
     */
  static createProductionConfig(overrides = {}) {
    const prodConfig = {
      workflowEngine: {
        persistence: {
          type: 'database'
        },
        logging: {
          level: 'warn'
        }
      },
      ruleEngine: {
        evaluation: {
          cache: true,
          parallel: true
        },
        logging: {
          level: 'warn'
        }
      },
      automationManager: {
        context: {
          encryption: true
        },
        monitoring: {
          alerting: true
        },
        logging: {
          level: 'warn'
        }
      }
    };
        
    return this.mergeConfigs(DEFAULT_WORKFLOW_CONFIG, this.mergeConfigs(prodConfig, overrides));
  }
    
  /**
     * Obtiene información del sistema
     */
  static getSystemInfo() {
    return {
      version: '1.0.0',
      components: ['WorkflowEngine', 'RuleEngine', 'AutomationManager'],
      constants: WORKFLOW_CONSTANTS,
      defaultConfig: DEFAULT_WORKFLOW_CONFIG
    };
  }
    
  /**
     * Formatea estadísticas para visualización
     */
  static formatStats(stats) {
    return {
      summary: {
        totalWorkflows: stats.workflows?.total || 0,
        totalRules: stats.rules?.total || 0,
        totalAutomations: stats.automations?.total || 0,
        totalExecutions: stats.workflowsExecuted + stats.rulesEvaluated + stats.automationsExecuted,
        successRate: this._calculateSuccessRate(stats)
      },
      workflows: stats.workflows || {},
      rules: stats.rules || {},
      automations: stats.automations || {},
      performance: {
        averageExecutionTime: stats.averageExecutionTime || 0,
        totalExecutionTime: stats.totalExecutionTime || 0
      },
      timestamp: new Date().toISOString()
    };
  }
    
  /**
     * Calcula tasa de éxito
     */
  static _calculateSuccessRate(stats) {
    const total = (stats.workflowsExecuted || 0) + (stats.rulesEvaluated || 0) + (stats.automationsExecuted || 0);
    const successful = (stats.workflowsCompleted || 0) + (stats.rulesMatched || 0) + (stats.automationsCompleted || 0);
        
    return total > 0 ? Math.round((successful / total) * 100) : 0;
  }
}

/**
 * Funciones de fábrica para crear instancias
 */

/**
 * Crea una instancia del motor de workflows
 */
function createWorkflowEngine(config = {}) {
  const mergedConfig = WorkflowUtils.mergeConfigs(DEFAULT_WORKFLOW_CONFIG.workflowEngine, config);
  return new WorkflowEngine(mergedConfig);
}

/**
 * Crea una instancia del motor de reglas
 */
function createRuleEngine(config = {}) {
  const mergedConfig = WorkflowUtils.mergeConfigs(DEFAULT_WORKFLOW_CONFIG.ruleEngine, config);
  return new RuleEngine(mergedConfig);
}

/**
 * Crea una instancia del gestor de automatización
 */
function createAutomationManager(config = {}) {
  const mergedConfig = WorkflowUtils.mergeConfigs(DEFAULT_WORKFLOW_CONFIG.automationManager, config);
  return new AutomationManager(mergedConfig);
}

/**
 * Crea un sistema completo de workflows
 */
async function createWorkflowSystem(config = {}) {
  const systemConfig = WorkflowUtils.mergeConfigs(DEFAULT_WORKFLOW_CONFIG, config);
    
  // Crear componentes
  const workflowEngine = systemConfig.workflowEngine.enabled ? 
    createWorkflowEngine(systemConfig.workflowEngine) : null;
    
  const ruleEngine = systemConfig.ruleEngine.enabled ? 
    createRuleEngine(systemConfig.ruleEngine) : null;
    
  const automationManager = createAutomationManager({
    ...systemConfig.automationManager,
    workflows: {
      enabled: !!workflowEngine,
      config: systemConfig.workflowEngine
    },
    rules: {
      enabled: !!ruleEngine,
      config: systemConfig.ruleEngine
    }
  });
    
  // Inicializar componentes
  if (workflowEngine) {
    await workflowEngine.initialize();
  }
    
  if (ruleEngine) {
    await ruleEngine.initialize();
  }
    
  await automationManager.initialize();
    
  return {
    workflowEngine,
    ruleEngine,
    automationManager,
        
    // Métodos de conveniencia
    async createWorkflow(definition) {
      if (!workflowEngine) throw new Error('Workflow engine not available');
      return workflowEngine.createWorkflow(definition);
    },
        
    async createRule(definition) {
      if (!ruleEngine) throw new Error('Rule engine not available');
      return ruleEngine.createRule(definition);
    },
        
    async createAutomation(definition) {
      return automationManager.createAutomation(definition);
    },
        
    async executeWorkflow(workflowId, context, options) {
      if (!workflowEngine) throw new Error('Workflow engine not available');
      return workflowEngine.executeWorkflow(workflowId, context, options);
    },
        
    async evaluateRules(context, options) {
      if (!ruleEngine) throw new Error('Rule engine not available');
      return ruleEngine.evaluateRules(context, options);
    },
        
    async executeAutomation(automationId, context, options) {
      return automationManager.executeAutomation(automationId, context, options);
    },
        
    getStats() {
      return {
        workflow: workflowEngine ? workflowEngine.getStats() : null,
        rule: ruleEngine ? ruleEngine.getStats() : null,
        automation: automationManager.getStats()
      };
    },
        
    getHealthStatus() {
      return {
        workflow: workflowEngine ? workflowEngine.getHealthStatus() : null,
        rule: ruleEngine ? ruleEngine.getHealthStatus() : null,
        automation: automationManager.getHealthStatus()
      };
    },
        
    async destroy() {
      if (workflowEngine) await workflowEngine.destroy();
      if (ruleEngine) await ruleEngine.destroy();
      await automationManager.destroy();
    }
  };
}

// Exportaciones ES Modules
export {
  // Clases principales
  WorkflowEngine,
  RuleEngine,
  AutomationManager,
    
  // Configuración y constantes
  DEFAULT_WORKFLOW_CONFIG,
  WORKFLOW_CONSTANTS,
    
  // Utilidades
  WorkflowUtils,
    
  // Funciones de fábrica
  createWorkflowEngine,
  createRuleEngine,
  createAutomationManager,
  createWorkflowSystem
};

// Exportación por defecto
export default {
  WorkflowEngine,
  RuleEngine,
  AutomationManager,
  DEFAULT_WORKFLOW_CONFIG,
  WORKFLOW_CONSTANTS,
  WorkflowUtils,
  createWorkflowEngine,
  createRuleEngine,
  createAutomationManager,
  createWorkflowSystem
};
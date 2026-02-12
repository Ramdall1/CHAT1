/**
 * @fileoverview Strategy Pattern Implementation
 * 
 * Implementa el patrón Strategy para encapsular algoritmos intercambiables,
 * eliminando código condicional complejo y mejorando la mantenibilidad.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 5.0.0
 */

import logger from '../logger.js';

/**
 * Interfaz base para estrategias
 * 
 * Define el contrato que deben cumplir todas las estrategias,
 * proporcionando una interfaz consistente para su ejecución.
 * 
 * @abstract
 * @class BaseStrategy
 */
export class BaseStrategy {
  /**
   * Constructor de la estrategia base
   * 
   * @param {Object} config - Configuración de la estrategia
   * @param {string} config.name - Nombre de la estrategia
   * @param {number} config.priority - Prioridad de ejecución
   * @param {boolean} config.enabled - Si está habilitada
   */
  constructor(config = {}) {
    this.name = config.name || 'BaseStrategy';
    this.priority = config.priority || 0;
    this.enabled = config.enabled !== false;
    this.metadata = config.metadata || {};
    
    if (this.constructor === BaseStrategy) {
      throw new Error('BaseStrategy es una clase abstracta');
    }
  }

  /**
   * Ejecuta la estrategia (método abstracto)
   * 
   * @abstract
   * @param {*} context - Contexto de ejecución
   * @returns {Promise<*>} Resultado de la estrategia
   * @throws {Error} Si no está implementado
   */
  async execute(context) {
    throw new Error('El método execute debe ser implementado');
  }

  /**
   * Valida si la estrategia puede ejecutarse
   * 
   * @param {*} context - Contexto de ejecución
   * @returns {boolean} True si puede ejecutarse
   */
  canExecute(context) {
    return this.enabled;
  }

  /**
   * Obtiene información de la estrategia
   * 
   * @returns {Object} Información de la estrategia
   */
  getInfo() {
    return {
      name: this.name,
      priority: this.priority,
      enabled: this.enabled,
      metadata: this.metadata
    };
  }
}

/**
 * Contexto que maneja las estrategias
 * 
 * Gestiona la selección y ejecución de estrategias basado en el contexto,
 * proporcionando flexibilidad en el comportamiento del sistema.
 * 
 * @class StrategyContext
 */
export class StrategyContext {
  /**
   * Constructor del contexto de estrategias
   * 
   * @param {Object} config - Configuración del contexto
   * @param {string} config.name - Nombre del contexto
   * @param {boolean} config.enableLogging - Habilitar logging
   */
  constructor(config = {}) {
    this.name = config.name || 'StrategyContext';
    this.enableLogging = config.enableLogging !== false;
    this.strategies = new Map();
    this.defaultStrategy = null;
    
    if (this.enableLogging) {
      logger.info(`🎯 Contexto de estrategias ${this.name} inicializado`);
    }
  }

  /**
   * Registra una estrategia
   * 
   * @param {string} key - Clave de la estrategia
   * @param {BaseStrategy} strategy - Instancia de la estrategia
   * @throws {Error} Si la estrategia no es válida
   */
  registerStrategy(key, strategy) {
    if (!(strategy instanceof BaseStrategy)) {
      throw new Error('La estrategia debe extender BaseStrategy');
    }

    this.strategies.set(key, strategy);
    
    if (this.enableLogging) {
      logger.debug(`📝 Estrategia '${key}' registrada en ${this.name}`);
    }
  }

  /**
   * Establece la estrategia por defecto
   * 
   * @param {string} key - Clave de la estrategia por defecto
   * @throws {Error} Si la estrategia no existe
   */
  setDefaultStrategy(key) {
    if (!this.strategies.has(key)) {
      throw new Error(`Estrategia '${key}' no está registrada`);
    }
    
    this.defaultStrategy = key;
    
    if (this.enableLogging) {
      logger.debug(`🎯 Estrategia por defecto establecida: '${key}'`);
    }
  }

  /**
   * Ejecuta una estrategia específica
   * 
   * @param {string} key - Clave de la estrategia
   * @param {*} context - Contexto de ejecución
   * @returns {Promise<*>} Resultado de la estrategia
   * @throws {Error} Si la estrategia no existe o falla
   */
  async executeStrategy(key, context) {
    const strategy = this.strategies.get(key);
    
    if (!strategy) {
      throw new Error(`Estrategia '${key}' no encontrada en ${this.name}`);
    }

    if (!strategy.canExecute(context)) {
      throw new Error(`Estrategia '${key}' no puede ejecutarse en el contexto actual`);
    }

    try {
      if (this.enableLogging) {
        logger.debug(`🚀 Ejecutando estrategia '${key}' en ${this.name}`);
      }

      const result = await strategy.execute(context);
      
      if (this.enableLogging) {
        logger.debug(`✅ Estrategia '${key}' ejecutada exitosamente`);
      }

      return result;
    } catch (error) {
      logger.error(`❌ Error ejecutando estrategia '${key}':`, error);
      throw error;
    }
  }

  /**
   * Ejecuta la estrategia por defecto
   * 
   * @param {*} context - Contexto de ejecución
   * @returns {Promise<*>} Resultado de la estrategia
   * @throws {Error} Si no hay estrategia por defecto
   */
  async executeDefault(context) {
    if (!this.defaultStrategy) {
      throw new Error(`No hay estrategia por defecto en ${this.name}`);
    }

    return this.executeStrategy(this.defaultStrategy, context);
  }

  /**
   * Ejecuta la mejor estrategia basada en prioridad
   * 
   * @param {*} context - Contexto de ejecución
   * @returns {Promise<*>} Resultado de la estrategia
   * @throws {Error} Si no hay estrategias disponibles
   */
  async executeBest(context) {
    const availableStrategies = Array.from(this.strategies.entries())
      .filter(([, strategy]) => strategy.canExecute(context))
      .sort(([, a], [, b]) => b.priority - a.priority);

    if (availableStrategies.length === 0) {
      throw new Error(`No hay estrategias disponibles en ${this.name}`);
    }

    const [bestKey] = availableStrategies[0];
    return this.executeStrategy(bestKey, context);
  }

  /**
   * Obtiene todas las estrategias registradas
   * 
   * @returns {Object[]} Array de información de estrategias
   */
  getStrategies() {
    return Array.from(this.strategies.entries()).map(([key, strategy]) => ({
      key,
      ...strategy.getInfo()
    }));
  }

  /**
   * Obtiene estadísticas del contexto
   * 
   * @returns {Object} Estadísticas del contexto
   */
  getStats() {
    return {
      name: this.name,
      totalStrategies: this.strategies.size,
      defaultStrategy: this.defaultStrategy,
      strategies: this.getStrategies()
    };
  }
}

/**
 * Estrategia para procesamiento de mensajes de texto
 * 
 * @class TextMessageStrategy
 * @extends BaseStrategy
 */
export class TextMessageStrategy extends BaseStrategy {
  constructor(config = {}) {
    super({
      name: 'TextMessageStrategy',
      priority: 1,
      ...config
    });
  }

  async execute(context) {
    const { message, options = {} } = context;
    
    // Procesar mensaje de texto
    return {
      type: 'text',
      content: message,
      processed: true,
      timestamp: new Date().toISOString(),
      options
    };
  }

  canExecute(context) {
    return super.canExecute(context) && 
           context.message && 
           typeof context.message === 'string';
  }
}

/**
 * Estrategia para procesamiento de mensajes multimedia
 * 
 * @class MediaMessageStrategy
 * @extends BaseStrategy
 */
export class MediaMessageStrategy extends BaseStrategy {
  constructor(config = {}) {
    super({
      name: 'MediaMessageStrategy',
      priority: 2,
      ...config
    });
  }

  async execute(context) {
    const { mediaUrl, mediaType, caption = '', options = {} } = context;
    
    // Procesar mensaje multimedia
    return {
      type: 'media',
      mediaUrl,
      mediaType,
      caption,
      processed: true,
      timestamp: new Date().toISOString(),
      options
    };
  }

  canExecute(context) {
    return super.canExecute(context) && 
           context.mediaUrl && 
           context.mediaType;
  }
}

/**
 * Estrategia para procesamiento de plantillas
 * 
 * @class TemplateMessageStrategy
 * @extends BaseStrategy
 */
export class TemplateMessageStrategy extends BaseStrategy {
  constructor(config = {}) {
    super({
      name: 'TemplateMessageStrategy',
      priority: 3,
      ...config
    });
  }

  async execute(context) {
    const { templateName, templateData = {}, languageCode = 'es', options = {} } = context;
    
    // Procesar mensaje de plantilla
    return {
      type: 'template',
      templateName,
      templateData,
      languageCode,
      processed: true,
      timestamp: new Date().toISOString(),
      options
    };
  }

  canExecute(context) {
    return super.canExecute(context) && 
           context.templateName;
  }
}

// Contexto global para estrategias de mensajería
export const messageProcessingContext = new StrategyContext({
  name: 'MessageProcessingContext'
});

// Registrar estrategias por defecto
messageProcessingContext.registerStrategy('text', new TextMessageStrategy());
messageProcessingContext.registerStrategy('media', new MediaMessageStrategy());
messageProcessingContext.registerStrategy('template', new TemplateMessageStrategy());
messageProcessingContext.setDefaultStrategy('text');

export default StrategyContext;
/**
 * @fileoverview Factory Pattern Implementation
 * 
 * Implementa el patrón Factory para la creación centralizada de servicios,
 * eliminando duplicación de código y proporcionando una interfaz consistente
 * para la instanciación de objetos complejos.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 5.0.0
 */

import logger from '../logger.js';

/**
 * Clase base para implementar el patrón Factory
 * 
 * Proporciona una interfaz común para la creación de objetos,
 * con soporte para configuración, validación y logging.
 * 
 * @abstract
 * @class BaseFactory
 */
export class BaseFactory {
  /**
   * Constructor de la factory base
   * 
   * @param {Object} config - Configuración de la factory
   * @param {string} config.name - Nombre de la factory
   * @param {Object} config.defaultOptions - Opciones por defecto
   * @param {boolean} config.enableLogging - Habilitar logging
   */
  constructor(config = {}) {
    this.name = config.name || 'BaseFactory';
    this.defaultOptions = config.defaultOptions || {};
    this.enableLogging = config.enableLogging !== false;
    this.instances = new Map();
    this.registry = new Map();
    
    if (this.enableLogging) {
      logger.info(`🏭 Factory ${this.name} inicializada`);
    }
  }

  /**
   * Registra un tipo de objeto en la factory
   * 
   * @param {string} type - Tipo de objeto
   * @param {Function} constructor - Constructor del objeto
   * @param {Object} options - Opciones específicas del tipo
   * @throws {Error} Si el tipo ya está registrado
   */
  register(type, constructor, options = {}) {
    if (this.registry.has(type)) {
      throw new Error(`Tipo '${type}' ya está registrado en ${this.name}`);
    }

    this.registry.set(type, {
      constructor,
      options: { ...this.defaultOptions, ...options }
    });

    if (this.enableLogging) {
      logger.debug(`📝 Tipo '${type}' registrado en ${this.name}`);
    }
  }

  /**
   * Crea una instancia del tipo especificado
   * 
   * @param {string} type - Tipo de objeto a crear
   * @param {Object} config - Configuración específica
   * @param {boolean} singleton - Si debe ser singleton
   * @returns {Object} Instancia creada
   * @throws {Error} Si el tipo no está registrado
   */
  create(type, config = {}, singleton = false) {
    if (!this.registry.has(type)) {
      throw new Error(`Tipo '${type}' no está registrado en ${this.name}`);
    }

    // Verificar si ya existe una instancia singleton
    if (singleton && this.instances.has(type)) {
      if (this.enableLogging) {
        logger.debug(`♻️ Retornando instancia singleton de '${type}'`);
      }
      return this.instances.get(type);
    }

    const { constructor: Constructor, options } = this.registry.get(type);
    const finalConfig = { ...options, ...config };

    try {
      const instance = new Constructor(finalConfig);
      
      if (singleton) {
        this.instances.set(type, instance);
      }

      if (this.enableLogging) {
        logger.debug(`✅ Instancia de '${type}' creada en ${this.name}`);
      }

      return instance;
    } catch (error) {
      logger.error(`❌ Error creando instancia de '${type}':`, error);
      throw error;
    }
  }

  /**
   * Obtiene todos los tipos registrados
   * 
   * @returns {string[]} Array de tipos registrados
   */
  getRegisteredTypes() {
    return Array.from(this.registry.keys());
  }

  /**
   * Verifica si un tipo está registrado
   * 
   * @param {string} type - Tipo a verificar
   * @returns {boolean} True si está registrado
   */
  isRegistered(type) {
    return this.registry.has(type);
  }

  /**
   * Limpia todas las instancias singleton
   */
  clearInstances() {
    this.instances.clear();
    if (this.enableLogging) {
      logger.debug(`🧹 Instancias singleton limpiadas en ${this.name}`);
    }
  }

  /**
   * Obtiene estadísticas de la factory
   * 
   * @returns {Object} Estadísticas de uso
   */
  getStats() {
    return {
      name: this.name,
      registeredTypes: this.registry.size,
      singletonInstances: this.instances.size,
      types: this.getRegisteredTypes()
    };
  }
}

/**
 * Factory específica para servicios de mensajería
 * 
 * Centraliza la creación de todos los servicios de mensajería,
 * eliminando la duplicación de código encontrada en el análisis.
 * 
 * @class MessagingServiceFactory
 * @extends BaseFactory
 */
export class MessagingServiceFactory extends BaseFactory {
  constructor() {
    super({
      name: 'MessagingServiceFactory',
      defaultOptions: {
        timeout: 30000,
        retries: 3,
        enableLogging: true
      }
    });
  }

  /**
   * Crea un servicio de mensajería configurado
   * 
   * @param {string} provider - Proveedor (whatsapp, sms, email)
   * @param {Object} config - Configuración del servicio
   * @returns {Object} Servicio de mensajería
   */
  createMessagingService(provider, config = {}) {
    return this.create(provider, config, true);
  }
}

/**
 * Factory para servicios de integración
 * 
 * @class IntegrationServiceFactory
 * @extends BaseFactory
 */
export class IntegrationServiceFactory extends BaseFactory {
  constructor() {
    super({
      name: 'IntegrationServiceFactory',
      defaultOptions: {
        timeout: 60000,
        retries: 5,
        enableCache: true
      }
    });
  }
}

/**
 * Factory para servicios de base de datos
 * 
 * @class DatabaseServiceFactory
 * @extends BaseFactory
 */
export class DatabaseServiceFactory extends BaseFactory {
  constructor() {
    super({
      name: 'DatabaseServiceFactory',
      defaultOptions: {
        poolSize: 10,
        timeout: 30000,
        enableTransactions: true
      }
    });
  }
}

// Instancias singleton de las factories principales
export const messagingFactory = new MessagingServiceFactory();
export const integrationFactory = new IntegrationServiceFactory();
export const databaseFactory = new DatabaseServiceFactory();

export default BaseFactory;
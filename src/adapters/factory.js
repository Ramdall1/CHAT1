/**
 * Factory de Adaptadores de Comunicación
 * 
 * Factory para crear e inicializar adaptadores de comunicación
 * de manera simplificada y consistente
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../services/core/core/logger.js';
import { BaseAdapter } from './BaseAdapter.js';
import { WebSocketAdapter } from './WebSocketAdapter.js';
import { PubSubAdapter } from './PubSubAdapter.js';
import { MQTTAdapter } from './MQTTAdapter.js';
import { LocalAdapter } from './LocalAdapter.js';
import { AdapterManager } from './AdapterManager.js';
import { getAdapterConfig, validateAdapterConfig } from './adapters.config.js';

const logger = createLogger('ADAPTER_FACTORY');

// Registro de tipos de adaptadores
const ADAPTER_TYPES = {
  base: BaseAdapter,
  websocket: WebSocketAdapter,
  pubsub: PubSubAdapter,
  mqtt: MQTTAdapter,
  local: LocalAdapter
};

/**
 * Crear adaptador específico
 * 
 * @param {string} type - Tipo de adaptador ('websocket', 'pubsub', 'mqtt', 'local')
 * @param {Object} config - Configuración del adaptador
 * @param {Object} options - Opciones adicionales
 * @returns {BaseAdapter} Instancia del adaptador
 */
export function createAdapter(type, config = {}, options = {}) {
  try {
    // Validar tipo
    if (!type || typeof type !== 'string') {
      throw new Error('Tipo de adaptador requerido');
    }
    
    const normalizedType = type.toLowerCase();
    const AdapterClass = ADAPTER_TYPES[normalizedType];
    
    if (!AdapterClass) {
      throw new Error(`Tipo de adaptador desconocido: ${type}. Tipos disponibles: ${Object.keys(ADAPTER_TYPES).join(', ')}`);
    }
    
    // Obtener configuración por defecto para el tipo
    const defaultConfig = getDefaultConfigForType(normalizedType);
    
    // Merge configuraciones
    const finalConfig = mergeConfigs(defaultConfig, config);
    
    // Validar configuración si hay validador específico
    if (options.validate !== false) {
      validateAdapterTypeConfig(normalizedType, finalConfig);
    }
    
    // Crear instancia
    const adapter = new AdapterClass(finalConfig);
    
    // Configurar opciones adicionales
    if (options.autoConnect) {
      adapter.connect().catch(error => {
        logger.error(`Error en auto-conexión de adaptador ${type}:`, error);
      });
    }
    
    logger.info(`Adaptador ${type} creado correctamente`);
    
    return adapter;
    
  } catch (error) {
    logger.error(`Error creando adaptador ${type}:`, error);
    throw error;
  }
}

/**
 * Crear gestor de adaptadores
 * 
 * @param {Object} eventBus - EventBus del sistema
 * @param {Object} config - Configuración del gestor
 * @param {Object} options - Opciones adicionales
 * @returns {AdapterManager} Instancia del gestor
 */
export function createAdapterManager(eventBus, config = {}, options = {}) {
  try {
    // Obtener configuración por defecto
    const environment = options.environment || process.env.NODE_ENV || 'development';
    const defaultConfig = getAdapterConfig(environment);
    
    // Merge configuraciones
    const finalConfig = mergeConfigs(defaultConfig, config);
    
    // Validar configuración
    if (options.validate !== false) {
      const validation = validateAdapterConfig(finalConfig);
      if (!validation.isValid) {
        throw new Error(`Configuración inválida: ${validation.errors.join(', ')}`);
      }
    }
    
    // Crear instancia del gestor
    const manager = new AdapterManager(eventBus, finalConfig);
    
    // Auto-inicializar si está habilitado
    if (options.autoInitialize !== false) {
      manager.initialize().catch(error => {
        logger.error('Error en auto-inicialización del AdapterManager:', error);
      });
    }
    
    logger.info('AdapterManager creado correctamente', {
      environment,
      enabledAdapters: finalConfig.enabledAdapters
    });
    
    return manager;
    
  } catch (error) {
    logger.error('Error creando AdapterManager:', error);
    throw error;
  }
}

/**
 * Crear múltiples adaptadores
 * 
 * @param {Array} adapters - Array de configuraciones de adaptadores
 * @param {Object} options - Opciones globales
 * @returns {Map} Map con los adaptadores creados
 */
export function createAdapters(adapters, options = {}) {
  const createdAdapters = new Map();
  const errors = [];
  
  for (const adapterConfig of adapters) {
    try {
      const { name, type, config = {}, ...adapterOptions } = adapterConfig;
      
      if (!name || !type) {
        throw new Error('Nombre y tipo de adaptador requeridos');
      }
      
      const adapter = createAdapter(type, config, {
        ...options,
        ...adapterOptions
      });
      
      createdAdapters.set(name, adapter);
      
    } catch (error) {
      logger.error(`Error creando adaptador ${adapterConfig.name || 'unknown'}:`, error);
      errors.push({
        adapter: adapterConfig.name || 'unknown',
        error: error.message
      });
      
      if (options.failFast) {
        throw error;
      }
    }
  }
  
  if (errors.length > 0 && options.throwOnErrors) {
    throw new Error(`Errores creando adaptadores: ${JSON.stringify(errors)}`);
  }
  
  logger.info(`Adaptadores creados: ${createdAdapters.size}/${adapters.length}`);
  
  return {
    adapters: createdAdapters,
    errors
  };
}

/**
 * Crear adaptador desde URL
 * 
 * @param {string} url - URL del adaptador (ej: ws://localhost:8080, mqtt://broker.com)
 * @param {Object} options - Opciones adicionales
 * @returns {BaseAdapter} Instancia del adaptador
 */
export function createAdapterFromUrl(url, options = {}) {
  try {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol.replace(':', '');
    
    // Mapear protocolos a tipos de adaptadores
    const protocolMap = {
      'ws': 'websocket',
      'wss': 'websocket',
      'mqtt': 'mqtt',
      'mqtts': 'mqtt',
      'redis': 'pubsub',
      'local': 'local'
    };
    
    const adapterType = protocolMap[protocol];
    if (!adapterType) {
      throw new Error(`Protocolo no soportado: ${protocol}`);
    }
    
    // Generar configuración desde URL
    const config = generateConfigFromUrl(adapterType, parsedUrl, options);
    
    return createAdapter(adapterType, config, options);
    
  } catch (error) {
    logger.error(`Error creando adaptador desde URL ${url}:`, error);
    throw error;
  }
}

/**
 * Registrar tipo de adaptador personalizado
 * 
 * @param {string} type - Nombre del tipo
 * @param {Class} AdapterClass - Clase del adaptador
 */
export function registerAdapterType(type, AdapterClass) {
  if (!type || typeof type !== 'string') {
    throw new Error('Tipo de adaptador requerido');
  }
  
  if (!AdapterClass || typeof AdapterClass !== 'function') {
    throw new Error('Clase de adaptador requerida');
  }
  
  // Verificar que extiende BaseAdapter
  if (!AdapterClass.prototype instanceof BaseAdapter) {
    throw new Error('La clase debe extender BaseAdapter');
  }
  
  const normalizedType = type.toLowerCase();
  
  if (ADAPTER_TYPES[normalizedType]) {
    logger.warn(`Sobrescribiendo tipo de adaptador existente: ${normalizedType}`);
  }
  
  ADAPTER_TYPES[normalizedType] = AdapterClass;
  
  logger.info(`Tipo de adaptador registrado: ${normalizedType}`);
}

/**
 * Obtener tipos de adaptadores disponibles
 * 
 * @returns {Array} Array con los tipos disponibles
 */
export function getAvailableAdapterTypes() {
  return Object.keys(ADAPTER_TYPES);
}

/**
 * Verificar si un tipo de adaptador está disponible
 * 
 * @param {string} type - Tipo a verificar
 * @returns {boolean} True si está disponible
 */
export function isAdapterTypeAvailable(type) {
  return ADAPTER_TYPES.hasOwnProperty(type.toLowerCase());
}

/**
 * Obtener configuración por defecto para un tipo
 */
function getDefaultConfigForType(type) {
  const defaultConfigs = getAdapterConfig();
  return defaultConfigs.adapters?.[type] || {};
}

/**
 * Validar configuración específica del tipo
 */
function validateAdapterTypeConfig(type, config) {
  // Validaciones específicas por tipo
  switch (type) {
  case 'websocket':
    validateWebSocketConfig(config);
    break;
  case 'pubsub':
    validatePubSubConfig(config);
    break;
  case 'mqtt':
    validateMQTTConfig(config);
    break;
  case 'local':
    validateLocalConfig(config);
    break;
  }
}

/**
 * Validar configuración WebSocket
 */
function validateWebSocketConfig(config) {
  if (config.mode === 'server' && !config.server?.port) {
    throw new Error('Puerto del servidor WebSocket requerido');
  }
  
  if (config.mode === 'client' && !config.client?.url) {
    throw new Error('URL del cliente WebSocket requerida');
  }
}

/**
 * Validar configuración Pub/Sub
 */
function validatePubSubConfig(config) {
  if (!config.provider) {
    throw new Error('Proveedor Pub/Sub requerido');
  }
  
  const validProviders = ['local', 'redis', 'gcp', 'aws'];
  if (!validProviders.includes(config.provider)) {
    throw new Error(`Proveedor Pub/Sub inválido: ${config.provider}. Válidos: ${validProviders.join(', ')}`);
  }
}

/**
 * Validar configuración MQTT
 */
function validateMQTTConfig(config) {
  if (!config.connection?.host) {
    throw new Error('Host MQTT requerido');
  }
  
  if (config.connection.port && (config.connection.port < 1 || config.connection.port > 65535)) {
    throw new Error('Puerto MQTT inválido');
  }
}

/**
 * Validar configuración Local
 */
function validateLocalConfig(config) {
  // Validaciones básicas para adaptador local
  if (config.eventBus && typeof config.eventBus !== 'object') {
    throw new Error('EventBus debe ser un objeto');
  }
}

/**
 * Generar configuración desde URL
 */
function generateConfigFromUrl(type, url, options) {
  const config = {};
  
  switch (type) {
  case 'websocket':
    config.mode = 'client';
    config.client = {
      url: url.toString(),
      protocols: options.protocols || []
    };
    break;
      
  case 'mqtt':
    config.connection = {
      host: url.hostname,
      port: url.port ? parseInt(url.port) : (url.protocol === 'mqtts:' ? 8883 : 1883),
      protocol: url.protocol === 'mqtts:' ? 'mqtts' : 'mqtt'
    };
      
    if (url.username) {
      config.connection.username = url.username;
    }
      
    if (url.password) {
      config.connection.password = url.password;
    }
    break;
      
  case 'pubsub':
    if (url.protocol === 'redis:') {
      config.provider = 'redis';
      config.redis = {
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 6379
      };
        
      if (url.password) {
        config.redis.password = url.password;
      }
    }
    break;
  }
  
  return config;
}

/**
 * Merge profundo de configuraciones
 */
function mergeConfigs(base, override) {
  const result = { ...base };
  
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeConfigs(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// Exportar factory por defecto
export default {
  createAdapter,
  createAdapterManager,
  createAdapters,
  createAdapterFromUrl,
  registerAdapterType,
  getAvailableAdapterTypes,
  isAdapterTypeAvailable
};
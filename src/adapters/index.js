/**
 * Adaptadores de Comunicación - Índice Principal
 * 
 * Punto de entrada centralizado para todos los adaptadores de comunicación
 * del sistema event-driven
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

// Adaptadores base
export { BaseAdapter } from './BaseAdapter.js';

// Adaptadores específicos
export { WebSocketAdapter } from './WebSocketAdapter.js';
export { PubSubAdapter } from './PubSubAdapter.js';
export { MQTTAdapter } from './MQTTAdapter.js';
export { LocalAdapter } from './LocalAdapter.js';

// Gestor de adaptadores
export { AdapterManager } from './AdapterManager.js';

// Configuración
export {
  adapterManagerConfig,
  environmentConfigs,
  loggingConfig,
  metricsConfig,
  securityConfig,
  getAdapterConfig,
  validateAdapterConfig
} from './adapters.config.js';

// Factory para crear adaptadores
export { createAdapter, createAdapterManager } from './factory.js';

// Utilidades
export { AdapterUtils } from './utils.js';

// Re-exportar todo como default
export default {
  // Adaptadores
  BaseAdapter,
  WebSocketAdapter,
  PubSubAdapter,
  MQTTAdapter,
  LocalAdapter,
  
  // Gestor
  AdapterManager,
  
  // Configuración
  adapterManagerConfig,
  environmentConfigs,
  loggingConfig,
  metricsConfig,
  securityConfig,
  getAdapterConfig,
  validateAdapterConfig,
  
  // Factory
  createAdapter,
  createAdapterManager,
  
  // Utilidades
  AdapterUtils
};
import PluginManager from './PluginManager.js';
import PluginRegistry from './PluginRegistry.js';
import { PluginAPI, BasePlugin } from './PluginAPI.js';

/**
 * Configuración por defecto para el sistema de plugins
 */
const DEFAULT_PLUGIN_CONFIG = {
  manager: {
    enabled: true,
    autoLoad: true,
    autoStart: false,
    pluginDir: './plugins',
    configDir: './config/plugins',
    tempDir: './temp/plugins',
    maxPlugins: 100,
    loadTimeout: 30000,
    startTimeout: 10000,
    stopTimeout: 5000,
    allowRemotePlugins: false,
    sandboxed: true,
    validateSignatures: false,
        
    dependencies: {
      autoResolve: true,
      allowCircular: false,
      maxDepth: 10,
      timeout: 15000
    },
        
    hooks: {
      enabled: true,
      timeout: 5000,
      maxListeners: 50
    },
        
    security: {
      allowNativeModules: false,
      allowFileSystem: false,
      allowNetwork: false,
      allowProcess: false,
      memoryLimit: 100 * 1024 * 1024,
      cpuLimit: 1000
    },
        
    cache: {
      enabled: true,
      ttl: 3600000,
      maxSize: 50
    }
  },
    
  registry: {
    enabled: true,
    registryFile: './config/plugin-registry.json',
    cacheFile: './cache/plugin-cache.json',
    autoSave: true,
    autoLoad: true,
    validateChecksums: true,
    allowDuplicates: false,
    maxVersions: 5,
        
    search: {
      enabled: true,
      indexFields: ['name', 'description', 'tags', 'author'],
      fuzzySearch: true,
      maxResults: 50
    },
        
    cache: {
      enabled: true,
      ttl: 3600000,
      maxSize: 1000
    },
        
    validation: {
      strictMode: false,
      requireDescription: false,
      requireAuthor: false,
      requireLicense: false,
      maxNameLength: 100,
      maxDescriptionLength: 500
    }
  }
};

/**
 * Funciones de fábrica para crear instancias de componentes
 */

/**
 * Crea una instancia del gestor de plugins
 */
function createPluginManager(config = {}) {
  const managerConfig = {
    ...DEFAULT_PLUGIN_CONFIG.manager,
    ...config
  };
    
  return new PluginManager(managerConfig);
}

/**
 * Crea una instancia del registro de plugins
 */
function createPluginRegistry(config = {}) {
  const registryConfig = {
    ...DEFAULT_PLUGIN_CONFIG.registry,
    ...config
  };
    
  return new PluginRegistry(registryConfig);
}

/**
 * Crea una instancia de PluginAPI
 */
function createPluginAPI(config = {}) {
  return new PluginAPI(config);
}

/**
 * Crea un sistema completo de plugins
 */
function createPluginSystem(config = {}) {
  const systemConfig = {
    ...DEFAULT_PLUGIN_CONFIG,
    ...config
  };
    
  const manager = createPluginManager(systemConfig.manager);
  const registry = createPluginRegistry(systemConfig.registry);
    
  // Conectar manager y registry
  manager.registry = registry;
  registry.manager = manager;
    
  return {
    manager,
    registry,
        
    // Métodos de conveniencia
    async start() {
      await registry.load();
      await manager.start();
    },
        
    async stop() {
      await manager.stop();
      await registry.save();
    },
        
    async destroy() {
      await manager.destroy();
      await registry.destroy();
    },
        
    // Proxy para métodos del manager
    loadPlugin: (name, options) => manager.loadPlugin(name, options),
    startPlugin: (name) => manager.startPlugin(name),
    stopPlugin: (name) => manager.stopPlugin(name),
    unloadPlugin: (name) => manager.unloadPlugin(name),
    getPlugin: (name) => manager.getPlugin(name),
    getPlugins: () => manager.getPlugins(),
        
    // Proxy para métodos del registry
    registerPlugin: (data) => registry.registerPlugin(data),
    unregisterPlugin: (id) => registry.unregisterPlugin(id),
    searchPlugins: (query, options) => registry.search(query, options),
    getPluginById: (id) => registry.getPlugin(id),
    getLatestVersion: (name) => registry.getLatestVersion(name),
        
    // Estadísticas combinadas
    getStatistics() {
      return {
        manager: manager.getStatistics(),
        registry: registry.getStatistics()
      };
    }
  };
}

/**
 * Utilidades para el sistema de plugins
 */
const PluginUtils = {
  /**
     * Valida la configuración del sistema de plugins
     */
  validateConfig(config) {
    const errors = [];
        
    if (config.manager) {
      if (config.manager.maxPlugins && config.manager.maxPlugins < 1) {
        errors.push('maxPlugins must be greater than 0');
      }
            
      if (config.manager.loadTimeout && config.manager.loadTimeout < 1000) {
        errors.push('loadTimeout must be at least 1000ms');
      }
            
      if (config.manager.security) {
        const security = config.manager.security;
        if (security.memoryLimit && security.memoryLimit < 1024 * 1024) {
          errors.push('memoryLimit must be at least 1MB');
        }
      }
    }
        
    if (config.registry) {
      if (config.registry.maxVersions && config.registry.maxVersions < 1) {
        errors.push('maxVersions must be greater than 0');
      }
            
      if (config.registry.validation) {
        const validation = config.registry.validation;
        if (validation.maxNameLength && validation.maxNameLength < 1) {
          errors.push('maxNameLength must be greater than 0');
        }
      }
    }
        
    if (errors.length > 0) {
      throw new Error(`Plugin configuration validation failed: ${errors.join(', ')}`);
    }
        
    return true;
  },
    
  /**
     * Crea una configuración optimizada para desarrollo
     */
  createDevelopmentConfig() {
    return {
      manager: {
        ...DEFAULT_PLUGIN_CONFIG.manager,
        autoLoad: true,
        autoStart: true,
        loadTimeout: 60000,
        startTimeout: 30000,
        sandboxed: false,
        security: {
          allowNativeModules: true,
          allowFileSystem: true,
          allowNetwork: true,
          allowProcess: false,
          memoryLimit: 500 * 1024 * 1024,
          cpuLimit: 5000
        }
      },
      registry: {
        ...DEFAULT_PLUGIN_CONFIG.registry,
        validateChecksums: false,
        allowDuplicates: true,
        validation: {
          strictMode: false,
          requireDescription: false,
          requireAuthor: false,
          requireLicense: false,
          maxNameLength: 200,
          maxDescriptionLength: 1000
        }
      }
    };
  },
    
  /**
     * Crea una configuración optimizada para producción
     */
  createProductionConfig() {
    return {
      manager: {
        ...DEFAULT_PLUGIN_CONFIG.manager,
        autoLoad: false,
        autoStart: false,
        loadTimeout: 15000,
        startTimeout: 5000,
        sandboxed: true,
        validateSignatures: true,
        security: {
          allowNativeModules: false,
          allowFileSystem: false,
          allowNetwork: false,
          allowProcess: false,
          memoryLimit: 50 * 1024 * 1024,
          cpuLimit: 500
        }
      },
      registry: {
        ...DEFAULT_PLUGIN_CONFIG.registry,
        validateChecksums: true,
        allowDuplicates: false,
        validation: {
          strictMode: true,
          requireDescription: true,
          requireAuthor: true,
          requireLicense: true,
          maxNameLength: 50,
          maxDescriptionLength: 200
        }
      }
    };
  },
    
  /**
     * Obtiene información del sistema de plugins
     */
  getSystemInfo(pluginSystem) {
    const managerStats = pluginSystem.manager.getStatistics();
    const registryStats = pluginSystem.registry.getStatistics();
        
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      manager: {
        state: pluginSystem.manager.state,
        statistics: managerStats,
        config: pluginSystem.manager.config
      },
      registry: {
        state: pluginSystem.registry.state,
        statistics: registryStats,
        config: pluginSystem.registry.config
      },
      summary: {
        totalPlugins: managerStats.totalPlugins,
        loadedPlugins: managerStats.loadedPlugins,
        activePlugins: managerStats.activePlugins,
        registeredPlugins: registryStats.totalPlugins,
        totalVersions: registryStats.totalVersions,
        totalAuthors: registryStats.totalAuthors,
        totalTags: registryStats.totalTags
      }
    };
  },
    
  /**
     * Formatea estadísticas para visualización
     */
  formatStatistics(statistics) {
    const formatBytes = (bytes) => {
      const sizes = ['B', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 B';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };
        
    const formatTime = (ms) => {
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${Math.round(ms / 1000)}s`;
      if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
      return `${Math.round(ms / 3600000)}h`;
    };
        
    return {
      manager: {
        plugins: {
          total: statistics.manager.totalPlugins,
          loaded: statistics.manager.loadedPlugins,
          active: statistics.manager.activePlugins,
          failed: statistics.manager.failedPlugins
        },
        performance: {
          loadTime: formatTime(statistics.manager.loadTime),
          startTime: formatTime(statistics.manager.startTime),
          errors: statistics.manager.errors,
          warnings: statistics.manager.warnings
        }
      },
      registry: {
        content: {
          plugins: statistics.registry.totalPlugins,
          versions: statistics.registry.totalVersions,
          authors: statistics.registry.totalAuthors,
          tags: statistics.registry.totalTags,
          categories: statistics.registry.totalCategories
        },
        activity: {
          searchQueries: statistics.registry.searchQueries,
          cacheHits: statistics.registry.cacheHits,
          cacheMisses: statistics.registry.cacheMisses,
          lastUpdate: statistics.registry.lastUpdate
        }
      }
    };
  },
    
  /**
     * Genera colores para visualización
     */
  generateColors(count) {
    const colors = [];
    const hueStep = 360 / count;
        
    for (let i = 0; i < count; i++) {
      const hue = i * hueStep;
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }
        
    return colors;
  },
    
  /**
     * Calcula estadísticas de uso
     */
  calculateUsageStats(plugins) {
    const stats = {
      byCategory: new Map(),
      byAuthor: new Map(),
      byVersion: new Map(),
      byState: new Map()
    };
        
    for (const plugin of plugins.values()) {
      // Por categoría
      const category = plugin.metadata?.category || 'unknown';
      stats.byCategory.set(category, (stats.byCategory.get(category) || 0) + 1);
            
      // Por autor
      const author = plugin.metadata?.author || 'unknown';
      stats.byAuthor.set(author, (stats.byAuthor.get(author) || 0) + 1);
            
      // Por versión
      const version = plugin.metadata?.version || 'unknown';
      stats.byVersion.set(version, (stats.byVersion.get(version) || 0) + 1);
            
      // Por estado
      const state = plugin.state || 'unknown';
      stats.byState.set(state, (stats.byState.get(state) || 0) + 1);
    }
        
    return {
      byCategory: Object.fromEntries(stats.byCategory),
      byAuthor: Object.fromEntries(stats.byAuthor),
      byVersion: Object.fromEntries(stats.byVersion),
      byState: Object.fromEntries(stats.byState)
    };
  }
};

/**
 * Constantes del sistema de plugins
 */
const PLUGIN_EVENTS = {
  // Eventos del manager
  MANAGER_INITIALIZED: 'initialized',
  MANAGER_STARTED: 'started',
  MANAGER_STOPPED: 'stopped',
  MANAGER_DESTROYED: 'destroyed',
  MANAGER_ENABLED: 'enabled',
  MANAGER_DISABLED: 'disabled',
    
  // Eventos de plugins
  PLUGIN_LOADED: 'pluginLoaded',
  PLUGIN_STARTED: 'pluginStarted',
  PLUGIN_STOPPED: 'pluginStopped',
  PLUGIN_UNLOADED: 'pluginUnloaded',
  PLUGIN_CONFIGURED: 'pluginConfigured',
    
  // Eventos de errores
  PLUGIN_LOAD_ERROR: 'pluginLoadError',
  PLUGIN_START_ERROR: 'pluginStartError',
  PLUGIN_STOP_ERROR: 'pluginStopError',
  PLUGIN_UNLOAD_ERROR: 'pluginUnloadError',
    
  // Eventos del registry
  REGISTRY_INITIALIZED: 'initialized',
  REGISTRY_LOADED: 'loaded',
  REGISTRY_SAVED: 'saved',
  REGISTRY_CLEARED: 'cleared',
  REGISTRY_DESTROYED: 'destroyed',
    
  // Eventos de registro
  PLUGIN_REGISTERED: 'pluginRegistered',
  PLUGIN_UNREGISTERED: 'pluginUnregistered',
  REGISTRATION_ERROR: 'registrationError',
  UNREGISTRATION_ERROR: 'unregistrationError',
  SEARCH_ERROR: 'searchError',
    
  // Eventos de hooks
  HOOK_ERROR: 'hookError',
    
  // Eventos generales
  ERROR: 'error',
  WARNING: 'warning',
  LOG: 'log'
};

const PLUGIN_STATES = {
  LOADED: 'loaded',
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error'
};

const PLUGIN_PERMISSIONS = {
  FILESYSTEM: 'filesystem',
  NETWORK: 'network',
  PROCESS: 'process',
  NATIVE: 'native'
};

const PLUGIN_HOOKS = {
  BEFORE_LOAD: 'beforeLoad',
  AFTER_LOAD: 'afterLoad',
  BEFORE_START: 'beforeStart',
  AFTER_START: 'afterStart',
  BEFORE_STOP: 'beforeStop',
  AFTER_STOP: 'afterStop',
  BEFORE_UNLOAD: 'beforeUnload',
  AFTER_UNLOAD: 'afterUnload',
  ON_ERROR: 'onError',
  ON_WARNING: 'onWarning',
  ON_STATE_CHANGE: 'onStateChange'
};

const PLUGIN_TYPES = {
  CORE: 'core',
  EXTENSION: 'extension',
  MIDDLEWARE: 'middleware',
  INTEGRATION: 'integration',
  UTILITY: 'utility'
};

const HOOK_TYPES = {
  SYNC: 'sync',
  ASYNC: 'async',
  WATERFALL: 'waterfall',
  PARALLEL: 'parallel'
};

// Exportaciones ES Modules
export {
  // Clases principales
  PluginManager,
  PluginRegistry,
  PluginAPI,
  
  // Configuración
  DEFAULT_PLUGIN_CONFIG,
  
  // Constantes
  PLUGIN_EVENTS,
  PLUGIN_STATES,
  PLUGIN_TYPES,
  HOOK_TYPES,
  
  // Funciones de fábrica
  createPluginManager,
  createPluginRegistry,
  createPluginAPI,
  createPluginSystem,
  
  // Utilidades
  PluginUtils
};

// Exportación por defecto
export default {
  PluginManager,
  PluginRegistry,
  PluginAPI,
  DEFAULT_PLUGIN_CONFIG,
  PLUGIN_EVENTS,
  PLUGIN_STATES,
  PLUGIN_TYPES,
  HOOK_TYPES,
  createPluginManager,
  createPluginRegistry,
  createPluginAPI,
  createPluginSystem,
  PluginUtils
};
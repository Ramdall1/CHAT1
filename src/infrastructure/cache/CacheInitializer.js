/**
 * Cache System Initializer
 * Inicializador del sistema de cache distribuido
 * Coordina la inicialización de todos los componentes de cache
 */

import distributedCacheManager from './DistributedCacheManager.js';
import cacheMonitoring from './CacheMonitoring.js';
import cacheInvalidation from './CacheInvalidation.js';
import cacheConfig from '../config/cache/CacheConfig.js';
import { CacheStrategies } from './CacheStrategies.js';
import logger from '../core/core/logger.js';

class CacheInitializer {
  constructor() {
    this.isInitialized = false;
    this.components = {
      manager: false,
      monitoring: false,
      invalidation: false,
      strategies: false
    };
    this.initializationPromise = null;
  }

  /**
   * Inicializar sistema completo de cache
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      logger.info('Sistema de cache ya está inicializado');
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization(options);
    return this.initializationPromise;
  }

  /**
   * Realizar inicialización
   */
  async _performInitialization(options) {
    try {
      logger.info('Iniciando sistema de cache distribuido...');

      // 1. Validar configuración
      await this.validateConfiguration();

      // 2. Inicializar cache manager
      await this.initializeCacheManager(options);

      // 3. Inicializar estrategias de cache
      await this.initializeCacheStrategies();

      // 4. Inicializar sistema de invalidación
      await this.initializeCacheInvalidation();

      // 5. Inicializar monitoreo
      await this.initializeCacheMonitoring();

      // 6. Configurar patrones de invalidación
      await this.setupInvalidationPatterns();

      // 7. Configurar dependencias
      await this.setupCacheDependencies();

      // 8. Realizar health check inicial
      await this.performInitialHealthCheck();

      this.isInitialized = true;
      logger.info('Sistema de cache distribuido inicializado correctamente');

      // Emitir evento de inicialización completada
      this.emitInitializationComplete();

    } catch (error) {
      logger.error('Error inicializando sistema de cache:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Validar configuración
   */
  async validateConfiguration() {
    try {
      logger.info('Validando configuración de cache...');
      
      // Validar configuración principal
      cacheConfig.validate();
      
      // Verificar variables de entorno requeridas
      const requiredEnvVars = ['REDIS_HOST'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
      }

      logger.info('Configuración de cache validada correctamente');

    } catch (error) {
      logger.error('Error validando configuración de cache:', error);
      throw error;
    }
  }

  /**
   * Inicializar cache manager
   */
  async initializeCacheManager(options) {
    try {
      logger.info('Inicializando cache manager...');
      
      const config = cacheConfig.getConfig();
      await distributedCacheManager.initialize({
        ...config,
        ...options
      });

      this.components.manager = true;
      logger.info('Cache manager inicializado correctamente');

    } catch (error) {
      logger.error('Error inicializando cache manager:', error);
      throw error;
    }
  }

  /**
   * Inicializar estrategias de cache
   */
  async initializeCacheStrategies() {
    try {
      logger.info('Inicializando estrategias de cache...');
      
      // Las estrategias se inicializan automáticamente al importarse
      // Aquí podemos configurar estrategias personalizadas si es necesario
      
      this.components.strategies = true;
      logger.info('Estrategias de cache inicializadas correctamente');

    } catch (error) {
      logger.error('Error inicializando estrategias de cache:', error);
      throw error;
    }
  }

  /**
   * Inicializar sistema de invalidación
   */
  async initializeCacheInvalidation() {
    try {
      logger.info('Inicializando sistema de invalidación...');
      
      // El sistema de invalidación se inicializa automáticamente
      // Aquí configuramos listeners adicionales si es necesario
      
      this.components.invalidation = true;
      logger.info('Sistema de invalidación inicializado correctamente');

    } catch (error) {
      logger.error('Error inicializando sistema de invalidación:', error);
      throw error;
    }
  }

  /**
   * Inicializar monitoreo
   */
  async initializeCacheMonitoring() {
    try {
      logger.info('Inicializando monitoreo de cache...');
      
      const monitoringConfig = cacheConfig.getMonitoringConfig();
      
      if (monitoringConfig.enabled) {
        await cacheMonitoring.startMonitoring();
        this.components.monitoring = true;
        logger.info('Monitoreo de cache inicializado correctamente');
      } else {
        logger.info('Monitoreo de cache deshabilitado');
        this.components.monitoring = true; // Marcamos como completado aunque esté deshabilitado
      }

    } catch (error) {
      logger.error('Error inicializando monitoreo de cache:', error);
      throw error;
    }
  }

  /**
   * Configurar patrones de invalidación
   */
  async setupInvalidationPatterns() {
    try {
      logger.info('Configurando patrones de invalidación...');

      // Patrón para invalidación de datos de usuario
      cacheInvalidation.registerPattern('userDataChange', {
        keyPattern: 'user:*',
        triggers: ['userAction', 'dataChanged'],
        strategy: 'lazy',
        condition: (event) => event.entity === 'user'
      });

      // Patrón para invalidación de conversaciones
      cacheInvalidation.registerPattern('conversationChange', {
        keyPattern: 'conv:*',
        triggers: ['dataChanged'],
        strategy: 'immediate',
        condition: (event) => event.entity === 'conversation'
      });

      // Patrón para invalidación de plantillas
      cacheInvalidation.registerPattern('templateChange', {
        keyPattern: 'tmpl:*',
        triggers: ['dataChanged', 'systemEvent'],
        strategy: 'batch',
        condition: (event) => event.entity === 'template' || event.type === 'deployment'
      });

      // Patrón para invalidación de APIs
      cacheInvalidation.registerPattern('apiChange', {
        keyPattern: 'api:*',
        triggers: ['systemEvent'],
        strategy: 'immediate',
        condition: (event) => event.type === 'deployment' || event.type === 'configuration_change'
      });

      logger.info('Patrones de invalidación configurados correctamente');

    } catch (error) {
      logger.error('Error configurando patrones de invalidación:', error);
      throw error;
    }
  }

  /**
   * Configurar dependencias de cache
   */
  async setupCacheDependencies() {
    try {
      logger.info('Configurando dependencias de cache...');

      // Dependencias de usuario
      cacheInvalidation.registerDependency('user:profile:*', ['user:*', 'user:list:*']);
      cacheInvalidation.registerDependency('user:settings:*', ['user:*']);

      // Dependencias de conversaciones
      cacheInvalidation.registerDependency('conv:messages:*', ['conv:*', 'conv:list:*']);
      cacheInvalidation.registerDependency('conv:summary:*', ['conv:*']);

      // Dependencias de plantillas
      cacheInvalidation.registerDependency('tmpl:content:*', ['tmpl:*', 'tmpl:list:*']);

      // Dependencias de analíticas
      cacheInvalidation.registerDependency('analytics:user:*', ['user:*', 'conv:*']);
      cacheInvalidation.registerDependency('analytics:conv:*', ['conv:*']);

      logger.info('Dependencias de cache configuradas correctamente');

    } catch (error) {
      logger.error('Error configurando dependencias de cache:', error);
      throw error;
    }
  }

  /**
   * Realizar health check inicial
   */
  async performInitialHealthCheck() {
    try {
      logger.info('Realizando health check inicial...');

      // Health check del cache manager
      const managerHealth = await distributedCacheManager.healthCheck();
      if (!managerHealth.healthy) {
        throw new Error(`Cache manager no saludable: ${managerHealth.error}`);
      }

      // Health check del monitoreo
      const monitoringHealth = await cacheMonitoring.healthCheck();
      if (monitoringHealth.status !== 'healthy' && monitoringHealth.status !== 'stopped') {
        logger.warn('Monitoreo de cache no está completamente saludable:', monitoringHealth);
      }

      // Test básico de operaciones
      await this.performBasicOperationTest();

      logger.info('Health check inicial completado correctamente');

    } catch (error) {
      logger.error('Error en health check inicial:', error);
      throw error;
    }
  }

  /**
   * Realizar test básico de operaciones
   */
  async performBasicOperationTest() {
    const testKey = 'cache:init:test';
    const testValue = { test: true, timestamp: Date.now() };

    try {
      // Test set
      await distributedCacheManager.set(testKey, testValue, 60);

      // Test get
      const retrieved = await distributedCacheManager.get(testKey);
      if (!retrieved || retrieved.test !== true) {
        throw new Error('Test de get falló');
      }

      // Test delete
      await distributedCacheManager.del(testKey);

      // Verificar que fue eliminado
      const afterDelete = await distributedCacheManager.get(testKey);
      if (afterDelete !== null) {
        throw new Error('Test de delete falló');
      }

      logger.info('Test básico de operaciones completado correctamente');

    } catch (error) {
      logger.error('Error en test básico de operaciones:', error);
      throw error;
    }
  }

  /**
   * Emitir evento de inicialización completada
   */
  emitInitializationComplete() {
    const event = {
      type: 'cache_system_initialized',
      timestamp: new Date().toISOString(),
      components: { ...this.components },
      config: {
        environment: cacheConfig.environment,
        redis: cacheConfig.getRedisConfig(),
        monitoring: cacheConfig.getMonitoringConfig()
      }
    };

    // Emitir a través de los componentes
    distributedCacheManager.emit('systemInitialized', event);
    cacheMonitoring.emit('systemInitialized', event);
    cacheInvalidation.emit('systemInitialized', event);

    logger.info('Evento de inicialización emitido');
  }

  /**
   * Verificar si está inicializado
   */
  isSystemInitialized() {
    return this.isInitialized;
  }

  /**
   * Obtener estado de componentes
   */
  getComponentsStatus() {
    return {
      initialized: this.isInitialized,
      components: { ...this.components },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reinicializar sistema
   */
  async reinitialize(options = {}) {
    logger.info('Reinicializando sistema de cache...');
    
    await this.cleanup();
    this.isInitialized = false;
    this.initializationPromise = null;
    
    Object.keys(this.components).forEach(key => {
      this.components[key] = false;
    });

    return this.initialize(options);
  }

  /**
   * Limpiar recursos
   */
  async cleanup() {
    try {
      logger.info('Limpiando recursos del sistema de cache...');

      // Detener monitoreo
      if (this.components.monitoring) {
        await cacheMonitoring.stopMonitoring();
      }

      // Limpiar invalidación
      if (this.components.invalidation) {
        cacheInvalidation.destroy();
      }

      // Cerrar conexiones del cache manager
      if (this.components.manager) {
        await distributedCacheManager.close();
      }

      logger.info('Recursos del sistema de cache limpiados');

    } catch (error) {
      logger.error('Error limpiando recursos del sistema de cache:', error);
    }
  }

  /**
   * Obtener métricas del sistema
   */
  async getSystemMetrics() {
    if (!this.isInitialized) {
      return { error: 'Sistema no inicializado' };
    }

    try {
      const [managerMetrics, monitoringMetrics] = await Promise.all([
        distributedCacheManager.getMetrics(),
        cacheMonitoring.getCurrentMetrics()
      ]);

      return {
        manager: managerMetrics,
        monitoring: monitoringMetrics,
        invalidation: cacheInvalidation.getMetrics(),
        components: this.getComponentsStatus(),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error obteniendo métricas del sistema:', error);
      return { error: error.message };
    }
  }
}

// Instancia singleton
const cacheInitializer = new CacheInitializer();

export { CacheInitializer, cacheInitializer };
export default cacheInitializer;
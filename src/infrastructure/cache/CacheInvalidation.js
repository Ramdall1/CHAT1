/**
 * Cache Invalidation System
 * Sistema de invalidación inteligente de cache
 * Incluye patrones, dependencias y estrategias automáticas
 */

import { EventEmitter } from 'events';
import distributedCacheManager from './DistributedCacheManager.js';
import logger from '../core/core/logger.js';

/**
 * Tipos de invalidación
 */
const INVALIDATION_TYPES = {
  MANUAL: 'manual',
  AUTOMATIC: 'automatic',
  DEPENDENCY: 'dependency',
  PATTERN: 'pattern',
  TIME_BASED: 'time_based',
  EVENT_BASED: 'event_based'
};

/**
 * Estrategias de invalidación
 */
const INVALIDATION_STRATEGIES = {
  IMMEDIATE: 'immediate',
  LAZY: 'lazy',
  BATCH: 'batch',
  SCHEDULED: 'scheduled',
  CASCADING: 'cascading'
};

class CacheInvalidation extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      batchSize: 100,
      batchInterval: 5000, // 5 segundos
      maxRetries: 3,
      retryDelay: 1000,
      enableMetrics: true,
      enableLogging: true,
      ...options
    };

    // Registro de dependencias
    this.dependencies = new Map();
    
    // Cola de invalidaciones pendientes
    this.invalidationQueue = [];
    
    // Patrones de invalidación
    this.patterns = new Map();
    
    // Métricas
    this.metrics = {
      totalInvalidations: 0,
      successfulInvalidations: 0,
      failedInvalidations: 0,
      batchInvalidations: 0,
      patternInvalidations: 0,
      dependencyInvalidations: 0
    };

    // Timers para procesamiento batch
    this.batchTimer = null;
    this.isProcessing = false;

    this.setupEventListeners();
  }

  /**
   * Configurar listeners de eventos
   */
  setupEventListeners() {
    // Escuchar eventos de cambio de datos
    this.on('dataChanged', (event) => {
      this.handleDataChange(event);
    });

    // Escuchar eventos de usuario
    this.on('userAction', (event) => {
      this.handleUserAction(event);
    });

    // Escuchar eventos del sistema
    this.on('systemEvent', (event) => {
      this.handleSystemEvent(event);
    });
  }

  /**
   * Registrar dependencia entre claves de cache
   */
  registerDependency(dependentKey, dependsOnKeys) {
    if (!Array.isArray(dependsOnKeys)) {
      dependsOnKeys = [dependsOnKeys];
    }

    for (const dependsOnKey of dependsOnKeys) {
      if (!this.dependencies.has(dependsOnKey)) {
        this.dependencies.set(dependsOnKey, new Set());
      }
      this.dependencies.get(dependsOnKey).add(dependentKey);
    }

    this.log(`Dependencia registrada: ${dependentKey} depende de [${dependsOnKeys.join(', ')}]`);
  }

  /**
   * Registrar patrón de invalidación
   */
  registerPattern(patternName, config) {
    const pattern = {
      name: patternName,
      keyPattern: config.keyPattern,
      triggers: config.triggers || [],
      strategy: config.strategy || INVALIDATION_STRATEGIES.IMMEDIATE,
      condition: config.condition || (() => true),
      action: config.action || 'delete',
      ...config
    };

    this.patterns.set(patternName, pattern);
    this.log(`Patrón de invalidación registrado: ${patternName}`);
  }

  /**
   * Invalidar clave específica
   */
  async invalidate(key, options = {}) {
    const invalidationRequest = {
      id: this.generateId(),
      key,
      type: INVALIDATION_TYPES.MANUAL,
      strategy: options.strategy || INVALIDATION_STRATEGIES.IMMEDIATE,
      timestamp: new Date().toISOString(),
      metadata: options.metadata || {},
      retries: 0
    };

    return this.processInvalidation(invalidationRequest);
  }

  /**
   * Invalidar múltiples claves
   */
  async invalidateMultiple(keys, options = {}) {
    const invalidationRequests = keys.map(key => ({
      id: this.generateId(),
      key,
      type: INVALIDATION_TYPES.MANUAL,
      strategy: options.strategy || INVALIDATION_STRATEGIES.BATCH,
      timestamp: new Date().toISOString(),
      metadata: options.metadata || {},
      retries: 0
    }));

    if (options.strategy === INVALIDATION_STRATEGIES.BATCH) {
      return this.addToBatch(invalidationRequests);
    }

    const results = await Promise.allSettled(
      invalidationRequests.map(req => this.processInvalidation(req))
    );

    return this.processResults(results);
  }

  /**
   * Invalidar por patrón
   */
  async invalidateByPattern(pattern, options = {}) {
    try {
      const keys = await this.findKeysByPattern(pattern);
      
      if (keys.length === 0) {
        this.log(`No se encontraron claves para el patrón: ${pattern}`);
        return { success: true, invalidated: 0, keys: [] };
      }

      this.metrics.patternInvalidations++;
      
      const result = await this.invalidateMultiple(keys, {
        ...options,
        metadata: { pattern, ...options.metadata }
      });

      this.log(`Invalidación por patrón completada: ${pattern}, ${keys.length} claves`);
      return result;

    } catch (error) {
      this.log(`Error en invalidación por patrón ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Invalidar por dependencias
   */
  async invalidateByDependency(sourceKey, options = {}) {
    const dependentKeys = this.dependencies.get(sourceKey);
    
    if (!dependentKeys || dependentKeys.size === 0) {
      return { success: true, invalidated: 0, keys: [] };
    }

    this.metrics.dependencyInvalidations++;

    const keysArray = Array.from(dependentKeys);
    const result = await this.invalidateMultiple(keysArray, {
      ...options,
      strategy: INVALIDATION_STRATEGIES.CASCADING,
      metadata: { sourceKey, type: 'dependency', ...options.metadata }
    });

    this.log(`Invalidación por dependencia completada: ${sourceKey} -> [${keysArray.join(', ')}]`);
    return result;
  }

  /**
   * Procesar invalidación individual
   */
  async processInvalidation(invalidationRequest) {
    try {
      this.metrics.totalInvalidations++;

      const { key, strategy, metadata } = invalidationRequest;

      // Verificar si la clave existe
      const exists = await distributedCacheManager.exists(key);
      if (!exists) {
        this.log(`Clave no existe en cache: ${key}`);
        return { success: true, key, action: 'skip', reason: 'not_found' };
      }

      // Ejecutar invalidación según estrategia
      let result;
      switch (strategy) {
        case INVALIDATION_STRATEGIES.IMMEDIATE:
          result = await this.executeImmediate(invalidationRequest);
          break;
          
        case INVALIDATION_STRATEGIES.LAZY:
          result = await this.executeLazy(invalidationRequest);
          break;
          
        case INVALIDATION_STRATEGIES.BATCH:
          result = await this.addToBatch([invalidationRequest]);
          break;
          
        case INVALIDATION_STRATEGIES.SCHEDULED:
          result = await this.executeScheduled(invalidationRequest);
          break;
          
        case INVALIDATION_STRATEGIES.CASCADING:
          result = await this.executeCascading(invalidationRequest);
          break;
          
        default:
          result = await this.executeImmediate(invalidationRequest);
      }

      // Procesar dependencias si es necesario
      if (result.success && strategy !== INVALIDATION_STRATEGIES.CASCADING) {
        await this.invalidateByDependency(key, { 
          strategy: INVALIDATION_STRATEGIES.CASCADING,
          metadata: { ...metadata, cascadeSource: key }
        });
      }

      this.metrics.successfulInvalidations++;
      this.emit('invalidationCompleted', { ...invalidationRequest, result });

      return result;

    } catch (error) {
      this.metrics.failedInvalidations++;
      
      // Reintentar si es posible
      if (invalidationRequest.retries < this.options.maxRetries) {
        invalidationRequest.retries++;
        this.log(`Reintentando invalidación: ${invalidationRequest.key} (intento ${invalidationRequest.retries})`);
        
        await this.delay(this.options.retryDelay * invalidationRequest.retries);
        return this.processInvalidation(invalidationRequest);
      }

      this.log(`Error en invalidación: ${invalidationRequest.key}`, error);
      this.emit('invalidationFailed', { ...invalidationRequest, error });
      
      throw error;
    }
  }

  /**
   * Ejecutar invalidación inmediata
   */
  async executeImmediate(invalidationRequest) {
    const { key } = invalidationRequest;
    
    await distributedCacheManager.del(key);
    
    this.log(`Invalidación inmediata completada: ${key}`);
    return {
      success: true,
      key,
      action: 'delete',
      strategy: INVALIDATION_STRATEGIES.IMMEDIATE,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Ejecutar invalidación lazy (marcar como expirado)
   */
  async executeLazy(invalidationRequest) {
    const { key } = invalidationRequest;
    
    // Marcar como expirado inmediatamente
    await distributedCacheManager.expire(key, 1);
    
    this.log(`Invalidación lazy completada: ${key}`);
    return {
      success: true,
      key,
      action: 'expire',
      strategy: INVALIDATION_STRATEGIES.LAZY,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Ejecutar invalidación programada
   */
  async executeScheduled(invalidationRequest) {
    const { key, metadata } = invalidationRequest;
    const delay = metadata.delay || 0;
    
    if (delay > 0) {
      setTimeout(async () => {
        await this.executeImmediate(invalidationRequest);
      }, delay);
      
      this.log(`Invalidación programada: ${key} en ${delay}ms`);
      return {
        success: true,
        key,
        action: 'scheduled',
        strategy: INVALIDATION_STRATEGIES.SCHEDULED,
        delay,
        timestamp: new Date().toISOString()
      };
    }
    
    return this.executeImmediate(invalidationRequest);
  }

  /**
   * Ejecutar invalidación en cascada
   */
  async executeCascading(invalidationRequest) {
    const result = await this.executeImmediate(invalidationRequest);
    
    // No procesar dependencias adicionales para evitar loops infinitos
    result.strategy = INVALIDATION_STRATEGIES.CASCADING;
    
    return result;
  }

  /**
   * Agregar a lote de procesamiento
   */
  async addToBatch(invalidationRequests) {
    this.invalidationQueue.push(...invalidationRequests);
    
    // Iniciar timer de batch si no está activo
    if (!this.batchTimer && !this.isProcessing) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.options.batchInterval);
    }

    return {
      success: true,
      action: 'queued',
      count: invalidationRequests.length,
      queueSize: this.invalidationQueue.length
    };
  }

  /**
   * Procesar lote de invalidaciones
   */
  async processBatch() {
    if (this.isProcessing || this.invalidationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.batchTimer = null;

    try {
      const batch = this.invalidationQueue.splice(0, this.options.batchSize);
      this.metrics.batchInvalidations++;

      this.log(`Procesando lote de invalidaciones: ${batch.length} elementos`);

      // Agrupar por tipo de operación
      const deleteKeys = batch
        .filter(req => !req.metadata?.action || req.metadata.action === 'delete')
        .map(req => req.key);

      const expireRequests = batch
        .filter(req => req.metadata?.action === 'expire');

      // Ejecutar eliminaciones en lote
      if (deleteKeys.length > 0) {
        await distributedCacheManager.del(...deleteKeys);
        this.log(`Eliminadas ${deleteKeys.length} claves en lote`);
      }

      // Ejecutar expiraciones
      for (const req of expireRequests) {
        await distributedCacheManager.expire(req.key, req.metadata.ttl || 1);
      }

      // Emitir evento de lote completado
      this.emit('batchCompleted', {
        processed: batch.length,
        deleted: deleteKeys.length,
        expired: expireRequests.length,
        timestamp: new Date().toISOString()
      });

      // Continuar procesando si hay más elementos
      if (this.invalidationQueue.length > 0) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.options.batchInterval);
      }

    } catch (error) {
      this.log('Error procesando lote de invalidaciones:', error);
      this.emit('batchFailed', { error, queueSize: this.invalidationQueue.length });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manejar cambio de datos
   */
  async handleDataChange(event) {
    const { entity, action, id, data } = event;
    
    try {
      // Invalidar cache específico de la entidad
      const entityKey = `${entity}:${id}`;
      await this.invalidate(entityKey, {
        metadata: { event: 'dataChanged', entity, action }
      });

      // Invalidar listas relacionadas
      const listPatterns = [
        `${entity}:list:*`,
        `${entity}:search:*`,
        `${entity}:count:*`
      ];

      for (const pattern of listPatterns) {
        await this.invalidateByPattern(pattern, {
          strategy: INVALIDATION_STRATEGIES.BATCH,
          metadata: { event: 'dataChanged', entity, action, pattern }
        });
      }

      // Aplicar patrones registrados
      await this.applyPatterns('dataChanged', event);

    } catch (error) {
      this.log(`Error manejando cambio de datos para ${entity}:${id}:`, error);
    }
  }

  /**
   * Manejar acción de usuario
   */
  async handleUserAction(event) {
    const { userId, action, resource } = event;
    
    try {
      // Invalidar cache específico del usuario
      const userPatterns = [
        `user:${userId}:*`,
        `session:${userId}:*`,
        `preferences:${userId}:*`
      ];

      for (const pattern of userPatterns) {
        await this.invalidateByPattern(pattern, {
          strategy: INVALIDATION_STRATEGIES.LAZY,
          metadata: { event: 'userAction', userId, action, resource }
        });
      }

      // Aplicar patrones registrados
      await this.applyPatterns('userAction', event);

    } catch (error) {
      this.log(`Error manejando acción de usuario ${userId}:`, error);
    }
  }

  /**
   * Manejar evento del sistema
   */
  async handleSystemEvent(event) {
    const { type, data } = event;
    
    try {
      switch (type) {
        case 'deployment':
          await this.handleDeployment(data);
          break;
          
        case 'maintenance':
          await this.handleMaintenance(data);
          break;
          
        case 'configuration_change':
          await this.handleConfigurationChange(data);
          break;
          
        default:
          this.log(`Evento de sistema no manejado: ${type}`);
      }

      // Aplicar patrones registrados
      await this.applyPatterns('systemEvent', event);

    } catch (error) {
      this.log(`Error manejando evento del sistema ${type}:`, error);
    }
  }

  /**
   * Manejar despliegue
   */
  async handleDeployment(data) {
    // Invalidar cache de configuración y estático
    const patterns = [
      'config:*',
      'static:*',
      'template:*',
      'api:version:*'
    ];

    for (const pattern of patterns) {
      await this.invalidateByPattern(pattern, {
        strategy: INVALIDATION_STRATEGIES.IMMEDIATE,
        metadata: { event: 'deployment', ...data }
      });
    }
  }

  /**
   * Manejar mantenimiento
   */
  async handleMaintenance(data) {
    if (data.clearCache) {
      // Limpiar todo el cache
      await distributedCacheManager.flushAll();
      this.log('Cache completamente limpiado por mantenimiento');
    }
  }

  /**
   * Manejar cambio de configuración
   */
  async handleConfigurationChange(data) {
    const { component, setting } = data;
    
    // Invalidar cache relacionado con la configuración
    const patterns = [
      `config:${component}:*`,
      `settings:${setting}:*`,
      'cache:config:*'
    ];

    for (const pattern of patterns) {
      await this.invalidateByPattern(pattern, {
        strategy: INVALIDATION_STRATEGIES.IMMEDIATE,
        metadata: { event: 'configurationChange', component, setting }
      });
    }
  }

  /**
   * Aplicar patrones registrados
   */
  async applyPatterns(eventType, event) {
    for (const [patternName, pattern] of this.patterns) {
      if (pattern.triggers.includes(eventType) && pattern.condition(event)) {
        try {
          await this.invalidateByPattern(pattern.keyPattern, {
            strategy: pattern.strategy,
            metadata: { 
              event: eventType, 
              pattern: patternName,
              ...event 
            }
          });
        } catch (error) {
          this.log(`Error aplicando patrón ${patternName}:`, error);
        }
      }
    }
  }

  /**
   * Encontrar claves por patrón
   */
  async findKeysByPattern(pattern) {
    try {
      // Usar SCAN para encontrar claves que coincidan con el patrón
      const keys = [];
      const client = distributedCacheManager.getClient('main');
      
      let cursor = '0';
      do {
        const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      return keys;

    } catch (error) {
      this.log(`Error buscando claves por patrón ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Procesar resultados de invalidaciones múltiples
   */
  processResults(results) {
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return {
      success: failed === 0,
      total: results.length,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
    };
  }

  /**
   * Obtener métricas
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.invalidationQueue.length,
      dependenciesCount: this.dependencies.size,
      patternsCount: this.patterns.size,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Limpiar cola de invalidaciones
   */
  clearQueue() {
    const queueSize = this.invalidationQueue.length;
    this.invalidationQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.log(`Cola de invalidaciones limpiada: ${queueSize} elementos removidos`);
    return queueSize;
  }

  /**
   * Generar ID único
   */
  generateId() {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log helper
   */
  log(message, data = null) {
    if (this.options.enableLogging) {
      if (data) {
        logger.info(`[CacheInvalidation] ${message}`, data);
      } else {
        logger.info(`[CacheInvalidation] ${message}`);
      }
    }
  }

  /**
   * Destructor
   */
  destroy() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.removeAllListeners();
    this.dependencies.clear();
    this.patterns.clear();
    this.invalidationQueue = [];
  }
}

// Instancia singleton
const cacheInvalidation = new CacheInvalidation();

export { 
  CacheInvalidation, 
  INVALIDATION_TYPES, 
  INVALIDATION_STRATEGIES, 
  cacheInvalidation 
};
export default cacheInvalidation;
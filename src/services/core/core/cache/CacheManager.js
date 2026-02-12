/**
 * @fileoverview Advanced Cache Management System
 * 
 * Sistema avanzado de gestión de caché con múltiples estrategias,
 * TTL configurable, invalidación inteligente, compresión y métricas
 * detalladas para optimización de rendimiento.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 5.0.0
 */

import { BaseError, ErrorType, ErrorSeverity } from '../errors/ErrorHandler.js';
import { systemObservable } from '../Observer.js';
import logger from '../logger.js';

/**
 * Estrategias de caché
 * 
 * @enum {string}
 */
export const CacheStrategy = {
  LRU: 'lru',           // Least Recently Used
  LFU: 'lfu',           // Least Frequently Used
  FIFO: 'fifo',         // First In, First Out
  TTL: 'ttl',           // Time To Live
  ADAPTIVE: 'adaptive'   // Adaptativo basado en patrones
};

/**
 * Tipos de invalidación
 * 
 * @enum {string}
 */
export const InvalidationType = {
  MANUAL: 'manual',
  TTL: 'ttl',
  DEPENDENCY: 'dependency',
  PATTERN: 'pattern',
  MEMORY_PRESSURE: 'memory_pressure'
};

/**
 * Configuración de caché
 * 
 * @typedef {Object} CacheConfig
 * @property {number} maxSize - Tamaño máximo del caché
 * @property {number} defaultTTL - TTL por defecto en ms
 * @property {CacheStrategy} strategy - Estrategia de caché
 * @property {boolean} enableCompression - Habilitar compresión
 * @property {boolean} enableMetrics - Habilitar métricas
 * @property {boolean} enablePersistence - Habilitar persistencia
 * @property {number} cleanupInterval - Intervalo de limpieza en ms
 * @property {number} memoryThreshold - Umbral de memoria en %
 */

/**
 * Entrada de caché
 * 
 * @typedef {Object} CacheEntry
 * @property {*} value - Valor almacenado
 * @property {number} timestamp - Timestamp de creación
 * @property {number} ttl - Time to live en ms
 * @property {number} accessCount - Número de accesos
 * @property {number} lastAccess - Último acceso
 * @property {number} size - Tamaño en bytes
 * @property {Array<string>} dependencies - Dependencias
 * @property {Object} metadata - Metadatos adicionales
 */

/**
 * Métricas de caché
 * 
 * @typedef {Object} CacheMetrics
 * @property {number} hits - Número de hits
 * @property {number} misses - Número de misses
 * @property {number} sets - Número de sets
 * @property {number} deletes - Número de deletes
 * @property {number} evictions - Número de evictions
 * @property {number} size - Tamaño actual
 * @property {number} memoryUsage - Uso de memoria en bytes
 * @property {number} hitRate - Tasa de hits
 * @property {number} averageAccessTime - Tiempo promedio de acceso
 */

/**
 * Gestor de caché avanzado
 * 
 * @class CacheManager
 */
export class CacheManager {
  /**
   * Constructor del gestor de caché
   * 
   * @param {CacheConfig} config - Configuración del caché
   */
  constructor(config = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTTL: config.defaultTTL || 3600000, // 1 hora
      strategy: config.strategy || CacheStrategy.LRU,
      enableCompression: config.enableCompression === true,
      enableMetrics: config.enableMetrics !== false,
      enablePersistence: config.enablePersistence === true,
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutos
      memoryThreshold: config.memoryThreshold || 80,
      ...config
    };

    this.cache = new Map();
    this.accessOrder = new Map(); // Para LRU
    this.accessCount = new Map(); // Para LFU
    this.dependencies = new Map(); // Para invalidación por dependencias
    
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      memoryUsage: 0,
      hitRate: 0,
      averageAccessTime: 0,
      totalAccessTime: 0,
      accessCount: 0
    };

    this.cleanupTimer = null;
    this.compressionEnabled = this.config.enableCompression;
    
    this.setupCleanupTimer();
    this.setupObservers();
    
    logger.info(`🗄️ CacheManager inicializado con estrategia ${this.config.strategy}`);
  }

  /**
   * Configura observadores del sistema
   * 
   * @private
   */
  setupObservers() {
    if (this.config.enableMetrics) {
      systemObservable.addObserver('cache:operation', (data) => {
        this.updateMetrics(data);
      });
    }
  }

  /**
   * Configura el timer de limpieza automática
   * 
   * @private
   */
  setupCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Obtiene un valor del caché
   * 
   * @param {string} key - Clave del caché
   * @returns {*} Valor almacenado o undefined
   */
  get(key) {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.recordMiss(key, startTime);
        return undefined;
      }

      // Verificar TTL
      if (this.isExpired(entry)) {
        this.delete(key, InvalidationType.TTL);
        this.recordMiss(key, startTime);
        return undefined;
      }

      // Actualizar estadísticas de acceso
      this.updateAccessStats(key, entry);
      
      this.recordHit(key, startTime);
      
      return this.deserializeValue(entry.value);
    } catch (error) {
      logger.error(`❌ Error obteniendo clave ${key}:`, error);
      this.recordMiss(key, startTime);
      return undefined;
    }
  }

  /**
   * Almacena un valor en el caché
   * 
   * @param {string} key - Clave del caché
   * @param {*} value - Valor a almacenar
   * @param {Object} options - Opciones de almacenamiento
   * @param {number} options.ttl - TTL específico en ms
   * @param {Array<string>} options.dependencies - Dependencias
   * @param {Object} options.metadata - Metadatos adicionales
   * @returns {boolean} True si se almacenó exitosamente
   */
  set(key, value, options = {}) {
    try {
      const ttl = options.ttl || this.config.defaultTTL;
      const serializedValue = this.serializeValue(value);
      const size = this.calculateSize(serializedValue);
      
      const entry = {
        value: serializedValue,
        timestamp: Date.now(),
        ttl,
        accessCount: 0,
        lastAccess: Date.now(),
        size,
        dependencies: options.dependencies || [],
        metadata: options.metadata || {}
      };

      // Verificar si necesitamos hacer espacio
      if (this.needsEviction(size)) {
        this.evictEntries(size);
      }

      // Almacenar entrada
      this.cache.set(key, entry);
      
      // Actualizar estructuras de datos para estrategias
      this.updateStrategyData(key, entry);
      
      // Registrar dependencias
      this.registerDependencies(key, entry.dependencies);
      
      // Actualizar métricas
      this.metrics.sets++;
      this.metrics.size = this.cache.size;
      this.metrics.memoryUsage += size;
      
      // Notificar observadores
      systemObservable.notifyObservers('cache:operation', {
        operation: 'set',
        key,
        size,
        ttl
      });

      logger.debug(`📦 Clave ${key} almacenada en caché`);
      return true;
    } catch (error) {
      logger.error(`❌ Error almacenando clave ${key}:`, error);
      return false;
    }
  }

  /**
   * Elimina una entrada del caché
   * 
   * @param {string} key - Clave a eliminar
   * @param {InvalidationType} reason - Razón de la eliminación
   * @returns {boolean} True si se eliminó
   */
  delete(key, reason = InvalidationType.MANUAL) {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return false;
      }

      // Eliminar de estructuras de datos
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.accessCount.delete(key);
      
      // Limpiar dependencias
      this.cleanupDependencies(key);
      
      // Actualizar métricas
      this.metrics.deletes++;
      this.metrics.size = this.cache.size;
      this.metrics.memoryUsage -= entry.size;
      
      if (reason !== InvalidationType.MANUAL) {
        this.metrics.evictions++;
      }

      // Notificar observadores
      systemObservable.notifyObservers('cache:operation', {
        operation: 'delete',
        key,
        reason,
        size: entry.size
      });

      logger.debug(`🗑️ Clave ${key} eliminada del caché (${reason})`);
      return true;
    } catch (error) {
      logger.error(`❌ Error eliminando clave ${key}:`, error);
      return false;
    }
  }

  /**
   * Verifica si una clave existe en el caché
   * 
   * @param {string} key - Clave a verificar
   * @returns {boolean} True si existe y no ha expirado
   */
  has(key) {
    const entry = this.cache.get(key);
    return entry && !this.isExpired(entry);
  }

  /**
   * Limpia todo el caché
   * 
   * @returns {number} Número de entradas eliminadas
   */
  clear() {
    const size = this.cache.size;
    
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCount.clear();
    this.dependencies.clear();
    
    this.metrics.size = 0;
    this.metrics.memoryUsage = 0;
    
    logger.info(`🧹 Caché limpiado: ${size} entradas eliminadas`);
    return size;
  }

  /**
   * Invalida entradas por patrón
   * 
   * @param {RegExp|string} pattern - Patrón de invalidación
   * @returns {number} Número de entradas invalidadas
   */
  invalidateByPattern(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key, InvalidationType.PATTERN));
    
    logger.info(`🔄 Invalidadas ${keysToDelete.length} entradas por patrón`);
    return keysToDelete.length;
  }

  /**
   * Invalida entradas por dependencia
   * 
   * @param {string} dependency - Dependencia a invalidar
   * @returns {number} Número de entradas invalidadas
   */
  invalidateByDependency(dependency) {
    const dependentKeys = this.dependencies.get(dependency) || new Set();
    let invalidated = 0;
    
    for (const key of dependentKeys) {
      if (this.delete(key, InvalidationType.DEPENDENCY)) {
        invalidated++;
      }
    }
    
    this.dependencies.delete(dependency);
    
    logger.info(`🔗 Invalidadas ${invalidated} entradas por dependencia ${dependency}`);
    return invalidated;
  }

  /**
   * Ejecuta limpieza automática
   * 
   * @private
   */
  cleanup() {
    const startTime = Date.now();
    let cleaned = 0;
    
    // Limpiar entradas expiradas
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key, InvalidationType.TTL);
        cleaned++;
      }
    }
    
    // Verificar presión de memoria
    if (this.getMemoryUsagePercent() > this.config.memoryThreshold) {
      const evicted = this.evictByMemoryPressure();
      cleaned += evicted;
    }
    
    const duration = Date.now() - startTime;
    
    if (cleaned > 0) {
      logger.debug(`🧹 Limpieza automática: ${cleaned} entradas eliminadas en ${duration}ms`);
    }
  }

  /**
   * Verifica si una entrada ha expirado
   * 
   * @private
   * @param {CacheEntry} entry - Entrada a verificar
   * @returns {boolean} True si ha expirado
   */
  isExpired(entry) {
    if (entry.ttl <= 0) return false; // TTL infinito
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Actualiza estadísticas de acceso
   * 
   * @private
   * @param {string} key - Clave accedida
   * @param {CacheEntry} entry - Entrada accedida
   */
  updateAccessStats(key, entry) {
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    // Actualizar para LRU
    this.accessOrder.set(key, Date.now());
    
    // Actualizar para LFU
    const currentCount = this.accessCount.get(key) || 0;
    this.accessCount.set(key, currentCount + 1);
  }

  /**
   * Registra un hit en el caché
   * 
   * @private
   * @param {string} key - Clave del hit
   * @param {number} startTime - Tiempo de inicio
   */
  recordHit(key, startTime) {
    const accessTime = Date.now() - startTime;
    
    this.metrics.hits++;
    this.metrics.totalAccessTime += accessTime;
    this.metrics.accessCount++;
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses);
    this.metrics.averageAccessTime = this.metrics.totalAccessTime / this.metrics.accessCount;
  }

  /**
   * Registra un miss en el caché
   * 
   * @private
   * @param {string} key - Clave del miss
   * @param {number} startTime - Tiempo de inicio
   */
  recordMiss(key, startTime) {
    const accessTime = Date.now() - startTime;
    
    this.metrics.misses++;
    this.metrics.totalAccessTime += accessTime;
    this.metrics.accessCount++;
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses);
    this.metrics.averageAccessTime = this.metrics.totalAccessTime / this.metrics.accessCount;
  }

  /**
   * Verifica si necesita eviction
   * 
   * @private
   * @param {number} newEntrySize - Tamaño de la nueva entrada
   * @returns {boolean} True si necesita eviction
   */
  needsEviction(newEntrySize) {
    return this.cache.size >= this.config.maxSize;
  }

  /**
   * Ejecuta eviction de entradas
   * 
   * @private
   * @param {number} requiredSpace - Espacio requerido
   * @returns {number} Número de entradas evicted
   */
  evictEntries(requiredSpace) {
    let evicted = 0;
    
    switch (this.config.strategy) {
      case CacheStrategy.LRU:
        evicted = this.evictLRU();
        break;
      case CacheStrategy.LFU:
        evicted = this.evictLFU();
        break;
      case CacheStrategy.FIFO:
        evicted = this.evictFIFO();
        break;
      case CacheStrategy.TTL:
        evicted = this.evictByTTL();
        break;
      case CacheStrategy.ADAPTIVE:
        evicted = this.evictAdaptive();
        break;
      default:
        evicted = this.evictLRU();
    }
    
    return evicted;
  }

  /**
   * Eviction LRU (Least Recently Used)
   * 
   * @private
   * @returns {number} Número de entradas evicted
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey, InvalidationType.MEMORY_PRESSURE);
      return 1;
    }
    
    return 0;
  }

  /**
   * Eviction LFU (Least Frequently Used)
   * 
   * @private
   * @returns {number} Número de entradas evicted
   */
  evictLFU() {
    let leastUsedKey = null;
    let leastCount = Infinity;
    
    for (const [key, count] of this.accessCount.entries()) {
      if (count < leastCount) {
        leastCount = count;
        leastUsedKey = key;
      }
    }
    
    if (leastUsedKey) {
      this.delete(leastUsedKey, InvalidationType.MEMORY_PRESSURE);
      return 1;
    }
    
    return 0;
  }

  /**
   * Eviction FIFO (First In, First Out)
   * 
   * @private
   * @returns {number} Número de entradas evicted
   */
  evictFIFO() {
    const firstKey = this.cache.keys().next().value;
    
    if (firstKey) {
      this.delete(firstKey, InvalidationType.MEMORY_PRESSURE);
      return 1;
    }
    
    return 0;
  }

  /**
   * Eviction por TTL
   * 
   * @private
   * @returns {number} Número de entradas evicted
   */
  evictByTTL() {
    let shortestTTLKey = null;
    let shortestTTL = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      const remainingTTL = entry.ttl - (Date.now() - entry.timestamp);
      if (remainingTTL < shortestTTL) {
        shortestTTL = remainingTTL;
        shortestTTLKey = key;
      }
    }
    
    if (shortestTTLKey) {
      this.delete(shortestTTLKey, InvalidationType.MEMORY_PRESSURE);
      return 1;
    }
    
    return 0;
  }

  /**
   * Eviction adaptativo
   * 
   * @private
   * @returns {number} Número de entradas evicted
   */
  evictAdaptive() {
    // Combina LRU y LFU basado en patrones de acceso
    const hitRate = this.metrics.hitRate;
    
    if (hitRate > 0.8) {
      // Alta tasa de hits, usar LFU
      return this.evictLFU();
    } else {
      // Baja tasa de hits, usar LRU
      return this.evictLRU();
    }
  }

  /**
   * Eviction por presión de memoria
   * 
   * @private
   * @returns {number} Número de entradas evicted
   */
  evictByMemoryPressure() {
    const targetSize = Math.floor(this.cache.size * 0.8); // Reducir al 80%
    let evicted = 0;
    
    while (this.cache.size > targetSize) {
      const removed = this.evictEntries(0);
      if (removed === 0) break; // Evitar bucle infinito
      evicted += removed;
    }
    
    return evicted;
  }

  /**
   * Actualiza datos para estrategias
   * 
   * @private
   * @param {string} key - Clave
   * @param {CacheEntry} entry - Entrada
   */
  updateStrategyData(key, entry) {
    this.accessOrder.set(key, entry.timestamp);
    this.accessCount.set(key, 0);
  }

  /**
   * Registra dependencias
   * 
   * @private
   * @param {string} key - Clave
   * @param {Array<string>} deps - Dependencias
   */
  registerDependencies(key, deps) {
    for (const dep of deps) {
      if (!this.dependencies.has(dep)) {
        this.dependencies.set(dep, new Set());
      }
      this.dependencies.get(dep).add(key);
    }
  }

  /**
   * Limpia dependencias
   * 
   * @private
   * @param {string} key - Clave
   */
  cleanupDependencies(key) {
    for (const [dep, keys] of this.dependencies.entries()) {
      keys.delete(key);
      if (keys.size === 0) {
        this.dependencies.delete(dep);
      }
    }
  }

  /**
   * Serializa un valor
   * 
   * @private
   * @param {*} value - Valor a serializar
   * @returns {*} Valor serializado
   */
  serializeValue(value) {
    if (!this.compressionEnabled) {
      return value;
    }
    
    // Implementar compresión si es necesario
    return value;
  }

  /**
   * Deserializa un valor
   * 
   * @private
   * @param {*} value - Valor a deserializar
   * @returns {*} Valor deserializado
   */
  deserializeValue(value) {
    if (!this.compressionEnabled) {
      return value;
    }
    
    // Implementar descompresión si es necesario
    return value;
  }

  /**
   * Calcula el tamaño de un valor
   * 
   * @private
   * @param {*} value - Valor a medir
   * @returns {number} Tamaño en bytes
   */
  calculateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    }
    
    return 8; // Tamaño por defecto
  }

  /**
   * Obtiene el porcentaje de uso de memoria
   * 
   * @private
   * @returns {number} Porcentaje de uso
   */
  getMemoryUsagePercent() {
    const maxMemory = this.config.maxSize * 1024; // Estimación
    return (this.metrics.memoryUsage / maxMemory) * 100;
  }

  /**
   * Actualiza métricas
   * 
   * @private
   * @param {Object} data - Datos de la operación
   */
  updateMetrics(data) {
    // Implementación específica si es necesario
  }

  /**
   * Obtiene métricas del caché
   * 
   * @returns {CacheMetrics} Métricas del caché
   */
  getMetrics() {
    return {
      ...this.metrics,
      memoryUsagePercent: this.getMemoryUsagePercent(),
      efficiency: this.metrics.hitRate * 100,
      averageEntrySize: this.metrics.memoryUsage / this.cache.size || 0
    };
  }

  /**
   * Obtiene información del caché
   * 
   * @returns {Object} Información del caché
   */
  getInfo() {
    return {
      config: this.config,
      metrics: this.getMetrics(),
      size: this.cache.size,
      memoryUsage: this.metrics.memoryUsage,
      dependenciesCount: this.dependencies.size
    };
  }

  /**
   * Destruye el gestor de caché
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.clear();
    logger.info('🗄️ CacheManager destruido');
  }
}

// Instancia global del gestor de caché
export const globalCacheManager = new CacheManager({
  maxSize: 5000,
  defaultTTL: 3600000, // 1 hora
  strategy: CacheStrategy.ADAPTIVE,
  enableCompression: false,
  enableMetrics: true,
  enablePersistence: false
});

export default CacheManager;
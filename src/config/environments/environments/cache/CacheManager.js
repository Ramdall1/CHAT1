import { EventEmitter } from 'events';
import { createLogger } from '../services/core/logger.js';

/**
 * Gestor de caché inteligente con múltiples estrategias
 * Soporta diferentes tipos de almacenamiento y políticas de expiración
 */
class CacheManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      enabled: true,
            
      // Configuración de almacenamiento
      storage: {
        type: 'memory', // memory, redis, file, hybrid
        maxSize: 100 * 1024 * 1024, // 100MB
        maxItems: 10000,
        compression: false,
        serialization: 'json' // json, msgpack, binary
      },
            
      // Configuración de expiración
      expiration: {
        defaultTTL: 3600000, // 1 hora
        maxTTL: 24 * 3600000, // 24 horas
        checkInterval: 60000, // 1 minuto
        strategy: 'ttl' // ttl, lru, lfu, fifo
      },
            
      // Configuración de políticas de evicción
      eviction: {
        policy: 'lru', // lru, lfu, fifo, random, ttl
        threshold: 0.8, // Evictar cuando se alcance el 80% de capacidad
        batchSize: 100, // Número de elementos a evictar por lote
        aggressive: false // Evicción agresiva cuando se alcanza el límite
      },
            
      // Configuración de particionado
      partitioning: {
        enabled: false,
        strategy: 'hash', // hash, range, consistent
        partitions: 4,
        replication: 1
      },
            
      // Configuración de persistencia
      persistence: {
        enabled: false,
        path: './cache',
        format: 'json',
        interval: 300000, // 5 minutos
        compression: true
      },
            
      // Configuración de estadísticas
      statistics: {
        enabled: true,
        detailed: false,
        historySize: 1000
      },
            
      // Configuración de warming
      warming: {
        enabled: false,
        strategies: ['preload', 'background'],
        preloadKeys: [],
        backgroundInterval: 60000
      },
            
      // Configuración de clustering
      clustering: {
        enabled: false,
        nodes: [],
        consistency: 'eventual', // strong, eventual
        replication: 2
      },
            
      ...config
    };
        
    this.state = 'initialized';
        
    // Almacenamiento principal
    this.storage = new Map();
    this.metadata = new Map(); // Metadatos de cada entrada
    this.accessLog = new Map(); // Log de accesos para LRU/LFU
    this.expirationQueue = new Map(); // Cola de expiración
        
    // Particiones (si está habilitado)
    this.partitions = [];
        
    // Estadísticas
    this.statistics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      expirations: 0,
      size: 0,
      memoryUsage: 0,
      operations: 0,
      errors: 0
    };
        
    this.operationHistory = [];
    this.performanceMetrics = {
      averageGetTime: 0,
      averageSetTime: 0,
      averageDeleteTime: 0,
      peakMemoryUsage: 0,
      hitRate: 0
    };
        
    // Logger centralizado
    this.logger = createLogger('CACHE_MANAGER');
        
    // Timers
    this.expirationTimer = null;
    this.persistenceTimer = null;
    this.warmingTimer = null;
    this.statisticsTimer = null;
        
    this._initializeTimers();
  }
    
  /**
     * Inicializa el gestor de caché
     */
  async initialize() {
    try {
      this._validateConfig();
      this._setupEventHandlers();
            
      // Inicializar particiones si está habilitado
      if (this.config.partitioning.enabled) {
        this._initializePartitions();
      }
            
      // Cargar datos persistidos
      if (this.config.persistence.enabled) {
        await this._loadPersistedData();
      }
            
      // Inicializar warming
      if (this.config.warming.enabled) {
        await this._initializeWarming();
      }
            
      this.state = 'ready';
      this.emit('initialized');
            
      return true;
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Obtiene un valor del caché
     */
  async get(key, options = {}) {
    const startTime = Date.now();
        
    try {
      if (!this.config.enabled) {
        return null;
      }
            
      const partition = this._getPartition(key);
      const storage = partition || this.storage;
      const metadata = partition ? partition.metadata : this.metadata;
            
      if (!storage.has(key)) {
        this.statistics.misses++;
        this._recordOperation('miss', key, Date.now() - startTime);
        return null;
      }
            
      const entry = storage.get(key);
      const meta = metadata.get(key);
            
      // Verificar expiración
      if (meta && meta.expiresAt && meta.expiresAt < Date.now()) {
        await this.delete(key);
        this.statistics.misses++;
        this.statistics.expirations++;
        this._recordOperation('miss', key, Date.now() - startTime);
        return null;
      }
            
      // Actualizar estadísticas de acceso
      this._updateAccessLog(key);
            
      this.statistics.hits++;
      this._recordOperation('hit', key, Date.now() - startTime);
            
      // Deserializar si es necesario
      const value = this._deserialize(entry.value, entry.type);
            
      this.emit('hit', { key, value, metadata: meta });
            
      return value;
    } catch (error) {
      this.statistics.errors++;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Establece un valor en el caché
     */
  async set(key, value, options = {}) {
    const startTime = Date.now();
        
    try {
      if (!this.config.enabled) {
        return false;
      }
            
      const ttl = options.ttl || this.config.expiration.defaultTTL;
      const expiresAt = ttl > 0 ? Date.now() + ttl : null;
            
      // Verificar límites antes de agregar
      await this._checkLimitsAndEvict();
            
      const partition = this._getPartition(key);
      const storage = partition || this.storage;
      const metadata = partition ? partition.metadata : this.metadata;
            
      // Serializar valor
      const serialized = this._serialize(value);
            
      const entry = {
        value: serialized.data,
        type: serialized.type,
        size: this._calculateSize(serialized.data),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
            
      const meta = {
        key: key,
        expiresAt: expiresAt,
        ttl: ttl,
        accessCount: 0,
        lastAccessed: Date.now(),
        tags: options.tags || [],
        priority: options.priority || 'normal'
      };
            
      // Actualizar o crear entrada
      const isUpdate = storage.has(key);
      const oldSize = isUpdate ? metadata.get(key)?.size || 0 : 0;
            
      storage.set(key, entry);
      metadata.set(key, meta);
            
      // Actualizar cola de expiración
      if (expiresAt) {
        this.expirationQueue.set(key, expiresAt);
      }
            
      // Actualizar estadísticas
      this.statistics.sets++;
      this.statistics.size += entry.size - oldSize;
      this.statistics.memoryUsage = this._calculateMemoryUsage();
            
      this._recordOperation('set', key, Date.now() - startTime);
            
      this.emit('set', { key, value, metadata: meta, isUpdate });
            
      return true;
    } catch (error) {
      this.statistics.errors++;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Elimina un valor del caché
     */
  async delete(key) {
    const startTime = Date.now();
        
    try {
      if (!this.config.enabled) {
        return false;
      }
            
      const partition = this._getPartition(key);
      const storage = partition || this.storage;
      const metadata = partition ? partition.metadata : this.metadata;
            
      if (!storage.has(key)) {
        return false;
      }
            
      const meta = metadata.get(key);
      const entry = storage.get(key);
            
      storage.delete(key);
      metadata.delete(key);
      this.accessLog.delete(key);
      this.expirationQueue.delete(key);
            
      // Actualizar estadísticas
      this.statistics.deletes++;
      this.statistics.size -= entry?.size || 0;
      this.statistics.memoryUsage = this._calculateMemoryUsage();
            
      this._recordOperation('delete', key, Date.now() - startTime);
            
      this.emit('delete', { key, metadata: meta });
            
      return true;
    } catch (error) {
      this.statistics.errors++;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Verifica si existe una clave en el caché
     */
  async has(key) {
    try {
      if (!this.config.enabled) {
        return false;
      }
            
      const partition = this._getPartition(key);
      const storage = partition || this.storage;
      const metadata = partition ? partition.metadata : this.metadata;
            
      if (!storage.has(key)) {
        return false;
      }
            
      const meta = metadata.get(key);
            
      // Verificar expiración
      if (meta && meta.expiresAt && meta.expiresAt < Date.now()) {
        await this.delete(key);
        return false;
      }
            
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }
    
  /**
     * Obtiene múltiples valores del caché
     */
  async mget(keys) {
    try {
      const results = {};
            
      for (const key of keys) {
        results[key] = await this.get(key);
      }
            
      return results;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Establece múltiples valores en el caché
     */
  async mset(entries, options = {}) {
    try {
      const results = {};
            
      for (const [key, value] of Object.entries(entries)) {
        results[key] = await this.set(key, value, options);
      }
            
      return results;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Elimina múltiples valores del caché
     */
  async mdel(keys) {
    try {
      const results = {};
            
      for (const key of keys) {
        results[key] = await this.delete(key);
      }
            
      return results;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Limpia todo el caché
     */
  async clear() {
    try {
      const clearedCount = this.storage.size;
            
      this.storage.clear();
      this.metadata.clear();
      this.accessLog.clear();
      this.expirationQueue.clear();
            
      // Limpiar particiones
      if (this.config.partitioning.enabled) {
        for (const partition of this.partitions) {
          partition.storage.clear();
          partition.metadata.clear();
        }
      }
            
      // Resetear estadísticas de tamaño
      this.statistics.size = 0;
      this.statistics.memoryUsage = 0;
            
      this.emit('cleared', { clearedCount });
            
      return clearedCount;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Obtiene todas las claves del caché
     */
  async keys(pattern = null) {
    try {
      let keys = Array.from(this.storage.keys());
            
      // Agregar claves de particiones
      if (this.config.partitioning.enabled) {
        for (const partition of this.partitions) {
          keys = keys.concat(Array.from(partition.storage.keys()));
        }
      }
            
      // Filtrar por patrón si se proporciona
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        keys = keys.filter(key => regex.test(key));
      }
            
      return keys;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Obtiene el tamaño del caché
     */
  size() {
    let totalSize = this.storage.size;
        
    if (this.config.partitioning.enabled) {
      for (const partition of this.partitions) {
        totalSize += partition.storage.size;
      }
    }
        
    return totalSize;
  }
    
  /**
     * Actualiza el TTL de una clave
     */
  async expire(key, ttl) {
    try {
      const partition = this._getPartition(key);
      const metadata = partition ? partition.metadata : this.metadata;
            
      if (!metadata.has(key)) {
        return false;
      }
            
      const meta = metadata.get(key);
      meta.expiresAt = ttl > 0 ? Date.now() + ttl : null;
      meta.ttl = ttl;
            
      if (meta.expiresAt) {
        this.expirationQueue.set(key, meta.expiresAt);
      } else {
        this.expirationQueue.delete(key);
      }
            
      this.emit('expire', { key, ttl });
            
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }
    
  /**
     * Obtiene el TTL restante de una clave
     */
  async ttl(key) {
    try {
      const partition = this._getPartition(key);
      const metadata = partition ? partition.metadata : this.metadata;
            
      if (!metadata.has(key)) {
        return -2; // Clave no existe
      }
            
      const meta = metadata.get(key);
            
      if (!meta.expiresAt) {
        return -1; // Sin expiración
      }
            
      const remaining = meta.expiresAt - Date.now();
      return remaining > 0 ? remaining : 0;
    } catch (error) {
      this.emit('error', error);
      return -2;
    }
  }
    
  /**
     * Busca claves por tags
     */
  async findByTags(tags) {
    try {
      const results = [];
            
      for (const [key, meta] of this.metadata) {
        if (meta.tags && tags.some(tag => meta.tags.includes(tag))) {
          results.push(key);
        }
      }
            
      // Buscar en particiones
      if (this.config.partitioning.enabled) {
        for (const partition of this.partitions) {
          for (const [key, meta] of partition.metadata) {
            if (meta.tags && tags.some(tag => meta.tags.includes(tag))) {
              results.push(key);
            }
          }
        }
      }
            
      return results;
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }
    
  /**
     * Invalida claves por tags
     */
  async invalidateByTags(tags) {
    try {
      const keys = await this.findByTags(tags);
      const results = await this.mdel(keys);
            
      this.emit('invalidated', { tags, keys, results });
            
      return results;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Obtiene estadísticas del caché
     */
  getStatistics() {
    const hitRate = this.statistics.hits + this.statistics.misses > 0 
      ? (this.statistics.hits / (this.statistics.hits + this.statistics.misses)) * 100 
      : 0;
        
    return {
      ...this.statistics,
      hitRate: hitRate,
      size: this.size(),
      memoryUsage: this._calculateMemoryUsage(),
      performance: this.performanceMetrics,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }
    
  /**
     * Obtiene información detallada del caché
     */
  getInfo() {
    return {
      config: this.config,
      state: this.state,
      statistics: this.getStatistics(),
      partitions: this.config.partitioning.enabled ? this.partitions.length : 0,
      memoryUsage: this._calculateMemoryUsage(),
      size: this.size()
    };
  }
    
  /**
     * Fuerza la limpieza de elementos expirados
     */
  async cleanup() {
    const now = Date.now();
    const expiredKeys = [];
        
    // Buscar claves expiradas
    for (const [key, expiresAt] of this.expirationQueue) {
      if (expiresAt <= now) {
        expiredKeys.push(key);
      }
    }
        
    // Eliminar claves expiradas
    for (const key of expiredKeys) {
      await this.delete(key);
    }
        
    this.emit('cleanup', { expiredKeys: expiredKeys.length });
        
    return expiredKeys.length;
  }
    
  /**
     * Habilita o deshabilita el caché
     */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    this.emit(enabled ? 'enabled' : 'disabled');
  }
    
  /**
     * Destruye el gestor de caché
     */
  async destroy() {
    this.state = 'destroyed';
        
    // Limpiar timers
    if (this.expirationTimer) clearInterval(this.expirationTimer);
    if (this.persistenceTimer) clearInterval(this.persistenceTimer);
    if (this.warmingTimer) clearInterval(this.warmingTimer);
    if (this.statisticsTimer) clearInterval(this.statisticsTimer);
        
    // Persistir datos si está habilitado
    if (this.config.persistence.enabled) {
      await this._persistData();
    }
        
    // Limpiar almacenamiento
    await this.clear();
        
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  _validateConfig() {
    if (this.config.storage.maxSize <= 0) {
      throw new Error('Max size must be greater than 0');
    }
        
    if (this.config.storage.maxItems <= 0) {
      throw new Error('Max items must be greater than 0');
    }
        
    if (this.config.expiration.defaultTTL < 0) {
      throw new Error('Default TTL cannot be negative');
    }
  }
    
  _setupEventHandlers() {
    this.on('error', (error) => {
      if (this.config.statistics.enabled) {
        if (this.logger) this.logger.error('Cache error:', error);
      }
    });
        
    this.startTime = Date.now();
  }
    
  _initializeTimers() {
    // Timer de limpieza de expiración
    this.expirationTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.emit('error', error);
      });
    }, this.config.expiration.checkInterval);
        
    // Timer de persistencia
    if (this.config.persistence.enabled) {
      this.persistenceTimer = setInterval(() => {
        this._persistData().catch(error => {
          this.emit('error', error);
        });
      }, this.config.persistence.interval);
    }
        
    // Timer de estadísticas
    if (this.config.statistics.enabled) {
      this.statisticsTimer = setInterval(() => {
        this._updatePerformanceMetrics();
      }, 60000); // Cada minuto
    }
  }
    
  _initializePartitions() {
    for (let i = 0; i < this.config.partitioning.partitions; i++) {
      this.partitions.push({
        id: i,
        storage: new Map(),
        metadata: new Map()
      });
    }
  }
    
  _getPartition(key) {
    if (!this.config.partitioning.enabled) {
      return null;
    }
        
    const hash = this._hash(key);
    const partitionIndex = hash % this.config.partitioning.partitions;
    return this.partitions[partitionIndex];
  }
    
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return Math.abs(hash);
  }
    
  _serialize(value) {
    const type = typeof value;
        
    if (this.config.storage.serialization === 'json') {
      return {
        data: JSON.stringify(value),
        type: type
      };
    }
        
    return {
      data: value,
      type: type
    };
  }
    
  _deserialize(data, type) {
    if (this.config.storage.serialization === 'json') {
      return JSON.parse(data);
    }
        
    return data;
  }
    
  _calculateSize(data) {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    }
        
    return JSON.stringify(data).length * 2; // Aproximación
  }
    
  _calculateMemoryUsage() {
    let totalSize = 0;
        
    for (const [key, entry] of this.storage) {
      totalSize += this._calculateSize(key) + (entry.size || 0);
    }
        
    if (this.config.partitioning.enabled) {
      for (const partition of this.partitions) {
        for (const [key, entry] of partition.storage) {
          totalSize += this._calculateSize(key) + (entry.size || 0);
        }
      }
    }
        
    return totalSize;
  }
    
  _updateAccessLog(key) {
    const now = Date.now();
    const access = this.accessLog.get(key) || { count: 0, lastAccessed: now };
        
    access.count++;
    access.lastAccessed = now;
        
    this.accessLog.set(key, access);
        
    // Actualizar metadata
    const partition = this._getPartition(key);
    const metadata = partition ? partition.metadata : this.metadata;
        
    if (metadata.has(key)) {
      const meta = metadata.get(key);
      meta.accessCount = access.count;
      meta.lastAccessed = now;
    }
  }
    
  async _checkLimitsAndEvict() {
    const currentSize = this._calculateMemoryUsage();
    const currentItems = this.size();
        
    const sizeThreshold = this.config.storage.maxSize * this.config.eviction.threshold;
    const itemsThreshold = this.config.storage.maxItems * this.config.eviction.threshold;
        
    if (currentSize >= sizeThreshold || currentItems >= itemsThreshold) {
      await this._evictItems();
    }
  }
    
  async _evictItems() {
    const policy = this.config.eviction.policy;
    const batchSize = this.config.eviction.batchSize;
        
    let keysToEvict = [];
        
    switch (policy) {
    case 'lru':
      keysToEvict = this._getLRUKeys(batchSize);
      break;
    case 'lfu':
      keysToEvict = this._getLFUKeys(batchSize);
      break;
    case 'fifo':
      keysToEvict = this._getFIFOKeys(batchSize);
      break;
    case 'random':
      keysToEvict = this._getRandomKeys(batchSize);
      break;
    case 'ttl':
      keysToEvict = this._getTTLKeys(batchSize);
      break;
    }
        
    for (const key of keysToEvict) {
      await this.delete(key);
      this.statistics.evictions++;
    }
        
    this.emit('eviction', { policy, evictedKeys: keysToEvict.length });
  }
    
  _getLRUKeys(count) {
    const entries = Array.from(this.accessLog.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      .slice(0, count);
        
    return entries.map(([key]) => key);
  }
    
  _getLFUKeys(count) {
    const entries = Array.from(this.accessLog.entries())
      .sort((a, b) => a[1].count - b[1].count)
      .slice(0, count);
        
    return entries.map(([key]) => key);
  }
    
  _getFIFOKeys(count) {
    const entries = Array.from(this.metadata.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, count);
        
    return entries.map(([key]) => key);
  }
    
  _getRandomKeys(count) {
    const keys = Array.from(this.storage.keys());
    const randomKeys = [];
        
    for (let i = 0; i < Math.min(count, keys.length); i++) {
      const randomIndex = Math.floor(Math.random() * keys.length);
      randomKeys.push(keys[randomIndex]);
      keys.splice(randomIndex, 1);
    }
        
    return randomKeys;
  }
    
  _getTTLKeys(count) {
    const entries = Array.from(this.expirationQueue.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, count);
        
    return entries.map(([key]) => key);
  }
    
  _recordOperation(type, key, duration) {
    this.statistics.operations++;
        
    if (this.config.statistics.detailed) {
      const operation = {
        type: type,
        key: key,
        duration: duration,
        timestamp: Date.now()
      };
            
      this.operationHistory.push(operation);
            
      // Mantener solo las últimas operaciones
      if (this.operationHistory.length > this.config.statistics.historySize) {
        this.operationHistory = this.operationHistory.slice(-this.config.statistics.historySize);
      }
    }
  }
    
  _updatePerformanceMetrics() {
    if (this.operationHistory.length === 0) return;
        
    const recentOps = this.operationHistory.slice(-100); // Últimas 100 operaciones
        
    const getOps = recentOps.filter(op => op.type === 'hit' || op.type === 'miss');
    const setOps = recentOps.filter(op => op.type === 'set');
    const deleteOps = recentOps.filter(op => op.type === 'delete');
        
    this.performanceMetrics.averageGetTime = getOps.length > 0 
      ? getOps.reduce((sum, op) => sum + op.duration, 0) / getOps.length 
      : 0;
        
    this.performanceMetrics.averageSetTime = setOps.length > 0 
      ? setOps.reduce((sum, op) => sum + op.duration, 0) / setOps.length 
      : 0;
        
    this.performanceMetrics.averageDeleteTime = deleteOps.length > 0 
      ? deleteOps.reduce((sum, op) => sum + op.duration, 0) / deleteOps.length 
      : 0;
        
    const currentMemory = this._calculateMemoryUsage();
    if (currentMemory > this.performanceMetrics.peakMemoryUsage) {
      this.performanceMetrics.peakMemoryUsage = currentMemory;
    }
        
    this.performanceMetrics.hitRate = this.statistics.hits + this.statistics.misses > 0 
      ? (this.statistics.hits / (this.statistics.hits + this.statistics.misses)) * 100 
      : 0;
  }
    
  async _loadPersistedData() {
    // Implementación de carga de datos persistidos
    // Esto dependería del tipo de almacenamiento configurado
  }
    
  async _persistData() {
    // Implementación de persistencia de datos
    // Esto dependería del tipo de almacenamiento configurado
  }
    
  async _initializeWarming() {
    if (this.config.warming.strategies.includes('preload')) {
      // Precargar claves específicas
      for (const key of this.config.warming.preloadKeys) {
        // Lógica de precarga
      }
    }
        
    if (this.config.warming.strategies.includes('background')) {
      // Configurar warming en background
      this.warmingTimer = setInterval(() => {
        // Lógica de warming en background
      }, this.config.warming.backgroundInterval);
    }
  }
}

export default CacheManager;
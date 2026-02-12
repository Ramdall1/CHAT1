import { EventEmitter } from 'events';

/**
 * Estrategias de caché con diferentes algoritmos de evicción y políticas
 */
class CacheStrategy extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Estrategia de evicción
      eviction: {
        policy: 'lru', // lru, lfu, fifo, lifo, random, ttl, adaptive
        maxSize: 1000,
        maxMemory: 100 * 1024 * 1024, // 100MB
        threshold: 0.8, // Comenzar evicción al 80%
        batchSize: 10, // Evictar en lotes
        adaptiveWindow: 1000 // Ventana para estrategia adaptativa
      },
            
      // Políticas de TTL
      ttl: {
        default: 3600000, // 1 hora
        sliding: false, // TTL deslizante
        absolute: true, // TTL absoluto
        maxAge: 86400000, // 24 horas máximo
        refreshThreshold: 0.8 // Refrescar al 80% del TTL
      },
            
      // Configuración de warming
      warming: {
        enabled: false,
        strategies: ['preload', 'predictive', 'scheduled'],
        preloadKeys: [],
        predictiveThreshold: 5, // Predecir después de N accesos
        scheduledInterval: 3600000 // 1 hora
      },
            
      // Configuración de particionado
      partitioning: {
        enabled: false,
        strategy: 'hash', // hash, range, consistent
        partitions: 4,
        rebalanceThreshold: 0.7,
        virtualNodes: 150 // Para consistent hashing
      },
            
      // Configuración de replicación
      replication: {
        enabled: false,
        factor: 2, // Número de réplicas
        strategy: 'sync', // sync, async
        consistency: 'eventual' // strong, eventual
      },
            
      ...config
    };
        
    // Estructuras de datos para diferentes estrategias
    this.accessOrder = new Map(); // Para LRU
    this.accessCount = new Map(); // Para LFU
    this.insertionOrder = []; // Para FIFO/LIFO
    this.accessHistory = []; // Para estrategia adaptativa
    this.partitions = new Map(); // Para particionado
    this.replicas = new Map(); // Para replicación
        
    // Métricas de rendimiento
    this.metrics = {
      evictions: 0,
      hits: 0,
      misses: 0,
      refreshes: 0,
      predictions: 0,
      partitionRebalances: 0,
      replicationSyncs: 0
    };
        
    // Timers
    this.cleanupTimer = null;
    this.warmingTimer = null;
    this.rebalanceTimer = null;
  }
    
  /**
     * Inicializa la estrategia
     */
  initialize() {
    this._setupCleanupTimer();
        
    if (this.config.warming.enabled) {
      this._setupWarmingTimer();
    }
        
    if (this.config.partitioning.enabled) {
      this._initializePartitions();
      this._setupRebalanceTimer();
    }
        
    this.emit('initialized');
  }
    
  /**
     * Determina si un elemento debe ser evictado
     */
  shouldEvict(currentSize, currentMemory) {
    const sizeThreshold = this.config.eviction.maxSize * this.config.eviction.threshold;
    const memoryThreshold = this.config.eviction.maxMemory * this.config.eviction.threshold;
        
    return currentSize >= sizeThreshold || currentMemory >= memoryThreshold;
  }
    
  /**
     * Selecciona elementos para evicción
     */
  selectForEviction(cache, count = null) {
    const evictCount = count || this.config.eviction.batchSize;
    const candidates = [];
        
    switch (this.config.eviction.policy) {
    case 'lru':
      candidates.push(...this._selectLRU(cache, evictCount));
      break;
    case 'lfu':
      candidates.push(...this._selectLFU(cache, evictCount));
      break;
    case 'fifo':
      candidates.push(...this._selectFIFO(cache, evictCount));
      break;
    case 'lifo':
      candidates.push(...this._selectLIFO(cache, evictCount));
      break;
    case 'random':
      candidates.push(...this._selectRandom(cache, evictCount));
      break;
    case 'ttl':
      candidates.push(...this._selectTTL(cache, evictCount));
      break;
    case 'adaptive':
      candidates.push(...this._selectAdaptive(cache, evictCount));
      break;
    default:
      candidates.push(...this._selectLRU(cache, evictCount));
    }
        
    this.metrics.evictions += candidates.length;
    return candidates;
  }
    
  /**
     * Registra un acceso a un elemento
     */
  recordAccess(key, metadata = {}) {
    const now = Date.now();
        
    // Actualizar orden de acceso (LRU)
    this.accessOrder.set(key, now);
        
    // Actualizar contador de acceso (LFU)
    const count = this.accessCount.get(key) || 0;
    this.accessCount.set(key, count + 1);
        
    // Registrar en historial para estrategia adaptativa
    this.accessHistory.push({
      key,
      timestamp: now,
      metadata
    });
        
    // Mantener ventana de historial
    if (this.accessHistory.length > this.config.eviction.adaptiveWindow) {
      this.accessHistory.shift();
    }
        
    this.metrics.hits++;
        
    // Verificar si necesita predicción
    if (this.config.warming.enabled && 
            this.config.warming.strategies.includes('predictive')) {
      this._checkPredictiveWarming(key);
    }
  }
    
  /**
     * Registra la inserción de un elemento
     */
  recordInsertion(key, metadata = {}) {
    const now = Date.now();
        
    // Agregar al orden de inserción (FIFO/LIFO)
    this.insertionOrder.push({
      key,
      timestamp: now,
      metadata
    });
        
    // Inicializar contadores
    this.accessOrder.set(key, now);
    this.accessCount.set(key, 0);
  }
    
  /**
     * Registra la eliminación de un elemento
     */
  recordRemoval(key) {
    this.accessOrder.delete(key);
    this.accessCount.delete(key);
        
    // Remover del orden de inserción
    this.insertionOrder = this.insertionOrder.filter(item => item.key !== key);
        
    // Limpiar del historial
    this.accessHistory = this.accessHistory.filter(item => item.key !== key);
  }
    
  /**
     * Calcula el TTL para un elemento
     */
  calculateTTL(key, metadata = {}) {
    let ttl = metadata.ttl || this.config.ttl.default;
        
    // TTL máximo
    if (ttl > this.config.ttl.maxAge) {
      ttl = this.config.ttl.maxAge;
    }
        
    // TTL deslizante
    if (this.config.ttl.sliding) {
      const accessCount = this.accessCount.get(key) || 0;
      if (accessCount > 0) {
        // Extender TTL basado en uso
        ttl = Math.min(ttl * (1 + accessCount * 0.1), this.config.ttl.maxAge);
      }
    }
        
    return ttl;
  }
    
  /**
     * Verifica si un elemento debe ser refrescado
     */
  shouldRefresh(key, createdAt, ttl) {
    const age = Date.now() - createdAt;
    const refreshTime = ttl * this.config.ttl.refreshThreshold;
        
    return age >= refreshTime;
  }
    
  /**
     * Obtiene la partición para una clave
     */
  getPartition(key) {
    if (!this.config.partitioning.enabled) {
      return 0;
    }
        
    switch (this.config.partitioning.strategy) {
    case 'hash':
      return this._hashPartition(key);
    case 'range':
      return this._rangePartition(key);
    case 'consistent':
      return this._consistentHashPartition(key);
    default:
      return this._hashPartition(key);
    }
  }
    
  /**
     * Obtiene las réplicas para una clave
     */
  getReplicas(key) {
    if (!this.config.replication.enabled) {
      return [];
    }
        
    const primary = this.getPartition(key);
    const replicas = [];
        
    for (let i = 1; i < this.config.replication.factor; i++) {
      const replica = (primary + i) % this.config.partitioning.partitions;
      replicas.push(replica);
    }
        
    return replicas;
  }
    
  /**
     * Obtiene estadísticas de la estrategia
     */
  getStatistics() {
    return {
      ...this.metrics,
      hitRate: this.metrics.hits > 0 
        ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100 
        : 0,
      accessOrderSize: this.accessOrder.size,
      accessCountSize: this.accessCount.size,
      insertionOrderSize: this.insertionOrder.length,
      accessHistorySize: this.accessHistory.length,
      partitionsCount: this.partitions.size
    };
  }
    
  /**
     * Destruye la estrategia
     */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
    }
    if (this.rebalanceTimer) {
      clearInterval(this.rebalanceTimer);
    }
        
    this.accessOrder.clear();
    this.accessCount.clear();
    this.insertionOrder = [];
    this.accessHistory = [];
    this.partitions.clear();
    this.replicas.clear();
        
    this.emit('destroyed');
  }
    
  // Métodos privados para estrategias de evicción
    
  _selectLRU(cache, count) {
    const entries = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1]) // Ordenar por timestamp ascendente
      .slice(0, count)
      .map(entry => entry[0]);
        
    return entries;
  }
    
  _selectLFU(cache, count) {
    const entries = Array.from(this.accessCount.entries())
      .sort((a, b) => a[1] - b[1]) // Ordenar por count ascendente
      .slice(0, count)
      .map(entry => entry[0]);
        
    return entries;
  }
    
  _selectFIFO(cache, count) {
    return this.insertionOrder
      .slice(0, count)
      .map(item => item.key);
  }
    
  _selectLIFO(cache, count) {
    return this.insertionOrder
      .slice(-count)
      .map(item => item.key);
  }
    
  _selectRandom(cache, count) {
    const keys = Array.from(cache.keys());
    const selected = [];
        
    for (let i = 0; i < Math.min(count, keys.length); i++) {
      const randomIndex = Math.floor(Math.random() * keys.length);
      const key = keys.splice(randomIndex, 1)[0];
      selected.push(key);
    }
        
    return selected;
  }
    
  _selectTTL(cache, count) {
    const now = Date.now();
    const expired = [];
        
    for (const [key, entry] of cache.entries()) {
      if (entry.metadata && entry.metadata.expiresAt && 
                entry.metadata.expiresAt <= now) {
        expired.push(key);
        if (expired.length >= count) break;
      }
    }
        
    return expired;
  }
    
  _selectAdaptive(cache, count) {
    // Analizar patrones de acceso recientes
    const recentAccesses = this.accessHistory
      .filter(access => Date.now() - access.timestamp < 300000) // Últimos 5 minutos
      .reduce((acc, access) => {
        acc[access.key] = (acc[access.key] || 0) + 1;
        return acc;
      }, {});
        
    // Combinar LRU y LFU basado en patrones recientes
    const lruCandidates = this._selectLRU(cache, count * 2);
    const lfuCandidates = this._selectLFU(cache, count * 2);
        
    // Priorizar elementos con pocos accesos recientes
    const candidates = [...new Set([...lruCandidates, ...lfuCandidates])]
      .sort((a, b) => {
        const aRecent = recentAccesses[a] || 0;
        const bRecent = recentAccesses[b] || 0;
        return aRecent - bRecent;
      })
      .slice(0, count);
        
    return candidates;
  }
    
  // Métodos privados para particionado
    
  _hashPartition(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return Math.abs(hash) % this.config.partitioning.partitions;
  }
    
  _rangePartition(key) {
    // Particionado por rango alfabético
    const firstChar = key.charAt(0).toLowerCase();
    const charCode = firstChar.charCodeAt(0);
    const range = Math.floor((charCode - 97) / (26 / this.config.partitioning.partitions));
    return Math.min(range, this.config.partitioning.partitions - 1);
  }
    
  _consistentHashPartition(key) {
    // Implementación simplificada de consistent hashing
    const hash = this._hashPartition(key + 'virtual');
    return hash % this.config.partitioning.partitions;
  }
    
  _initializePartitions() {
    for (let i = 0; i < this.config.partitioning.partitions; i++) {
      this.partitions.set(i, {
        size: 0,
        memory: 0,
        keys: new Set()
      });
    }
  }
    
  // Métodos privados para warming
    
  _checkPredictiveWarming(key) {
    const accessCount = this.accessCount.get(key) || 0;
        
    if (accessCount >= this.config.warming.predictiveThreshold) {
      this._predictRelatedKeys(key);
    }
  }
    
  _predictRelatedKeys(key) {
    // Predicción simple basada en patrones de clave
    const patterns = [
      key + '_related',
      key.replace(/\d+$/, (match) => String(parseInt(match) + 1)),
      key + '_metadata'
    ];
        
    this.metrics.predictions++;
    this.emit('prediction', { key, patterns });
  }
    
  // Métodos de configuración de timers
    
  _setupCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this._cleanup();
    }, 60000); // Cada minuto
  }
    
  _setupWarmingTimer() {
    if (this.config.warming.strategies.includes('scheduled')) {
      this.warmingTimer = setInterval(() => {
        this._performScheduledWarming();
      }, this.config.warming.scheduledInterval);
    }
  }
    
  _setupRebalanceTimer() {
    this.rebalanceTimer = setInterval(() => {
      this._checkRebalance();
    }, 300000); // Cada 5 minutos
  }
    
  _cleanup() {
    // Limpiar estructuras de datos antiguas
    const cutoff = Date.now() - 3600000; // 1 hora
        
    // Limpiar historial de acceso
    this.accessHistory = this.accessHistory.filter(
      access => access.timestamp > cutoff
    );
        
    // Limpiar orden de inserción
    this.insertionOrder = this.insertionOrder.filter(
      item => item.timestamp > cutoff
    );
  }
    
  _performScheduledWarming() {
    // Warming programado
    if (this.config.warming.preloadKeys.length > 0) {
      this.emit('scheduledWarming', { 
        keys: this.config.warming.preloadKeys 
      });
    }
  }
    
  _checkRebalance() {
    if (!this.config.partitioning.enabled) return;
        
    // Verificar si las particiones están desbalanceadas
    const partitionSizes = Array.from(this.partitions.values())
      .map(partition => partition.size);
        
    const maxSize = Math.max(...partitionSizes);
    const minSize = Math.min(...partitionSizes);
    const imbalance = maxSize > 0 ? (maxSize - minSize) / maxSize : 0;
        
    if (imbalance > this.config.partitioning.rebalanceThreshold) {
      this.metrics.partitionRebalances++;
      this.emit('rebalanceNeeded', { imbalance, partitionSizes });
    }
  }
}

export default CacheStrategy;
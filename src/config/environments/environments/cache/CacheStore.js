import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createLogger } from '../services/core/logger.js';

/**
 * Almacén de caché con soporte para múltiples backends
 * Soporta almacenamiento en memoria, archivos y Redis
 */
class CacheStore extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      type: 'memory', // memory, file, redis, hybrid
            
      // Configuración de almacenamiento en memoria
      memory: {
        maxSize: 100 * 1024 * 1024, // 100MB
        maxItems: 10000,
        compression: false
      },
            
      // Configuración de almacenamiento en archivos
      file: {
        directory: './cache',
        maxFileSize: 10 * 1024 * 1024, // 10MB por archivo
        maxFiles: 1000,
        compression: true,
        format: 'json', // json, binary, msgpack
        sync: false, // Escritura síncrona o asíncrona
        backup: true,
        encryption: false
      },
            
      // Configuración de Redis
      redis: {
        host: 'localhost',
        port: 6379,
        password: null,
        db: 0,
        keyPrefix: 'cache:',
        maxRetries: 3,
        retryDelay: 1000,
        compression: true
      },
            
      // Configuración híbrida
      hybrid: {
        l1: 'memory', // Cache L1 (más rápido)
        l2: 'file',   // Cache L2 (más capacidad)
        l1MaxSize: 50 * 1024 * 1024, // 50MB
        l2MaxSize: 500 * 1024 * 1024, // 500MB
        promoteThreshold: 3, // Promover a L1 después de N accesos
        demoteThreshold: 0.8 // Degradar cuando L1 esté al 80%
      },
            
      // Configuración de serialización
      serialization: {
        format: 'json', // json, msgpack, binary
        compression: false,
        encryption: false,
        encryptionKey: null
      },
            
      // Configuración de persistencia
      persistence: {
        enabled: false,
        interval: 300000, // 5 minutos
        atomic: true, // Escritura atómica
        backup: true,
        maxBackups: 5
      },
            
      ...config
    };
        
    this.state = 'initialized';
        
    // Almacenes específicos
    this.memoryStore = new Map();
    this.fileStore = new Map(); // Índice de archivos
    this.redisClient = null;
        
    // Para almacenamiento híbrido
    this.l1Store = new Map(); // Cache L1 (memoria)
    this.l2Store = new Map(); // Cache L2 (archivo/redis)
    this.accessCounts = new Map(); // Contadores de acceso
        
    // Estadísticas
    this.statistics = {
      reads: 0,
      writes: 0,
      deletes: 0,
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l2Hits: 0,
      promotions: 0,
      demotions: 0,
      errors: 0,
      totalSize: 0,
      fileCount: 0
    };
        
    // Timers
    this.persistenceTimer = null;
    this.cleanupTimer = null;
        
    // Logger
    this.logger = createLogger('CACHE_STORE');
  }
    
  /**
     * Inicializa el almacén de caché
     */
  async initialize() {
    try {
      this._validateConfig();
      this._setupEventHandlers();
            
      switch (this.config.type) {
      case 'memory':
        await this._initializeMemoryStore();
        break;
      case 'file':
        await this._initializeFileStore();
        break;
      case 'redis':
        await this._initializeRedisStore();
        break;
      case 'hybrid':
        await this._initializeHybridStore();
        break;
      default:
        throw new Error(`Unsupported store type: ${this.config.type}`);
      }
            
      // Inicializar persistencia si está habilitada
      if (this.config.persistence.enabled) {
        this._initializePersistence();
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
     * Obtiene un valor del almacén
     */
  async get(key) {
    try {
      this.statistics.reads++;
            
      let value = null;
            
      switch (this.config.type) {
      case 'memory':
        value = await this._getFromMemory(key);
        break;
      case 'file':
        value = await this._getFromFile(key);
        break;
      case 'redis':
        value = await this._getFromRedis(key);
        break;
      case 'hybrid':
        value = await this._getFromHybrid(key);
        break;
      }
            
      if (value !== null) {
        this.statistics.hits++;
      } else {
        this.statistics.misses++;
      }
            
      return value;
    } catch (error) {
      this.statistics.errors++;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Establece un valor en el almacén
     */
  async set(key, value, metadata = {}) {
    try {
      this.statistics.writes++;
            
      const serialized = await this._serialize(value, metadata);
            
      switch (this.config.type) {
      case 'memory':
        await this._setInMemory(key, serialized);
        break;
      case 'file':
        await this._setInFile(key, serialized);
        break;
      case 'redis':
        await this._setInRedis(key, serialized);
        break;
      case 'hybrid':
        await this._setInHybrid(key, serialized);
        break;
      }
            
      this._updateStatistics();
            
      return true;
    } catch (error) {
      this.statistics.errors++;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Elimina un valor del almacén
     */
  async delete(key) {
    try {
      this.statistics.deletes++;
            
      let deleted = false;
            
      switch (this.config.type) {
      case 'memory':
        deleted = await this._deleteFromMemory(key);
        break;
      case 'file':
        deleted = await this._deleteFromFile(key);
        break;
      case 'redis':
        deleted = await this._deleteFromRedis(key);
        break;
      case 'hybrid':
        deleted = await this._deleteFromHybrid(key);
        break;
      }
            
      this._updateStatistics();
            
      return deleted;
    } catch (error) {
      this.statistics.errors++;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Verifica si existe una clave
     */
  async has(key) {
    try {
      switch (this.config.type) {
      case 'memory':
        return this.memoryStore.has(key);
      case 'file':
        return this.fileStore.has(key);
      case 'redis':
        return await this._hasInRedis(key);
      case 'hybrid':
        return this.l1Store.has(key) || this.l2Store.has(key);
      default:
        return false;
      }
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }
    
  /**
     * Obtiene todas las claves
     */
  async keys() {
    try {
      switch (this.config.type) {
      case 'memory':
        return Array.from(this.memoryStore.keys());
      case 'file':
        return Array.from(this.fileStore.keys());
      case 'redis':
        return await this._getKeysFromRedis();
      case 'hybrid':
        const l1Keys = Array.from(this.l1Store.keys());
        const l2Keys = Array.from(this.l2Store.keys());
        return [...new Set([...l1Keys, ...l2Keys])];
      default:
        return [];
      }
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }
    
  /**
     * Limpia todo el almacén
     */
  async clear() {
    try {
      switch (this.config.type) {
      case 'memory':
        this.memoryStore.clear();
        break;
      case 'file':
        await this._clearFileStore();
        break;
      case 'redis':
        await this._clearRedisStore();
        break;
      case 'hybrid':
        this.l1Store.clear();
        this.l2Store.clear();
        this.accessCounts.clear();
        break;
      }
            
      this._resetStatistics();
            
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Obtiene el tamaño del almacén
     */
  async size() {
    try {
      switch (this.config.type) {
      case 'memory':
        return this.memoryStore.size;
      case 'file':
        return this.fileStore.size;
      case 'redis':
        return await this._getSizeFromRedis();
      case 'hybrid':
        return this.l1Store.size + this.l2Store.size;
      default:
        return 0;
      }
    } catch (error) {
      this.emit('error', error);
      return 0;
    }
  }
    
  /**
     * Obtiene estadísticas del almacén
     */
  getStatistics() {
    return {
      ...this.statistics,
      hitRate: this.statistics.reads > 0 
        ? (this.statistics.hits / this.statistics.reads) * 100 
        : 0,
      type: this.config.type,
      state: this.state
    };
  }
    
  /**
     * Compacta el almacén (para almacenamiento en archivos)
     */
  async compact() {
    if (this.config.type === 'file' || 
            (this.config.type === 'hybrid' && this.config.hybrid.l2 === 'file')) {
      await this._compactFileStore();
    }
  }
    
  /**
     * Destruye el almacén
     */
  async destroy() {
    this.state = 'destroyed';
        
    // Limpiar timers
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    // Cerrar conexiones
    if (this.redisClient) {
      await this.redisClient.quit();
    }
        
    // Limpiar almacenamiento
    await this.clear();
        
    this.emit('destroyed');
  }
    
  // Métodos privados para almacenamiento en memoria
    
  async _initializeMemoryStore() {
    // El Map ya está inicializado
    this.emit('memoryStoreInitialized');
  }
    
  async _getFromMemory(key) {
    const entry = this.memoryStore.get(key);
    return entry ? await this._deserialize(entry) : null;
  }
    
  async _setInMemory(key, serializedValue) {
    this.memoryStore.set(key, serializedValue);
  }
    
  async _deleteFromMemory(key) {
    return this.memoryStore.delete(key);
  }
    
  // Métodos privados para almacenamiento en archivos
    
  async _initializeFileStore() {
    const dir = this.config.file.directory;
        
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
        
    // Cargar índice existente
    await this._loadFileIndex();
        
    this.emit('fileStoreInitialized');
  }
    
  async _getFromFile(key) {
    const fileInfo = this.fileStore.get(key);
    if (!fileInfo) return null;
        
    try {
      const filePath = path.join(this.config.file.directory, fileInfo.filename);
      const data = await fs.readFile(filePath, 'utf8');
            
      if (this.config.file.format === 'json') {
        const parsed = JSON.parse(data);
        return await this._deserialize(parsed);
      }
            
      return await this._deserialize(data);
    } catch (error) {
      // Archivo corrupto o no existe, eliminar del índice
      this.fileStore.delete(key);
      return null;
    }
  }
    
  async _setInFile(key, serializedValue) {
    const filename = this._generateFilename(key);
    const filePath = path.join(this.config.file.directory, filename);
        
    let data;
    if (this.config.file.format === 'json') {
      data = JSON.stringify(serializedValue, null, 2);
    } else {
      data = serializedValue;
    }
        
    if (this.config.file.sync) {
      await fs.writeFile(filePath, data, 'utf8');
    } else {
      // Escritura asíncrona
      fs.writeFile(filePath, data, 'utf8').catch(error => {
        this.emit('error', error);
      });
    }
        
    this.fileStore.set(key, {
      filename: filename,
      size: Buffer.byteLength(data, 'utf8'),
      createdAt: Date.now()
    });
        
    await this._saveFileIndex();
  }
    
  async _deleteFromFile(key) {
    const fileInfo = this.fileStore.get(key);
    if (!fileInfo) return false;
        
    try {
      const filePath = path.join(this.config.file.directory, fileInfo.filename);
      await fs.unlink(filePath);
      this.fileStore.delete(key);
      await this._saveFileIndex();
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }
    
  async _clearFileStore() {
    const dir = this.config.file.directory;
        
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        await fs.unlink(path.join(dir, file));
      }
    } catch (error) {
      this.emit('error', error);
    }
        
    this.fileStore.clear();
  }
    
  async _loadFileIndex() {
    const indexPath = path.join(this.config.file.directory, 'index.json');
        
    try {
      const data = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(data);
            
      for (const [key, info] of Object.entries(index)) {
        this.fileStore.set(key, info);
      }
    } catch {
      // Índice no existe o está corrupto, crear uno nuevo
    }
  }
    
  async _saveFileIndex() {
    const indexPath = path.join(this.config.file.directory, 'index.json');
    const index = Object.fromEntries(this.fileStore);
        
    try {
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
    } catch (error) {
      this.emit('error', error);
    }
  }
    
  async _compactFileStore() {
    // Implementar compactación de archivos
    // Eliminar archivos huérfanos, reorganizar, etc.
  }
    
  _generateFilename(key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return `${hash.substring(0, 8)}.cache`;
  }
    
  // Métodos privados para Redis
    
  async _initializeRedisStore() {
    // Aquí se inicializaría la conexión a Redis
    // Por simplicidad, simulamos la conexión
    this.redisClient = {
      connected: true,
      get: async(key) => null,
      set: async(key, value) => true,
      del: async(key) => true,
      exists: async(key) => false,
      keys: async(pattern) => [],
      flushdb: async() => true,
      dbsize: async() => 0,
      quit: async() => true
    };
        
    this.emit('redisStoreInitialized');
  }
    
  async _getFromRedis(key) {
    const prefixedKey = this.config.redis.keyPrefix + key;
    const data = await this.redisClient.get(prefixedKey);
    return data ? await this._deserialize(JSON.parse(data)) : null;
  }
    
  async _setInRedis(key, serializedValue) {
    const prefixedKey = this.config.redis.keyPrefix + key;
    const data = JSON.stringify(serializedValue);
    await this.redisClient.set(prefixedKey, data);
  }
    
  async _deleteFromRedis(key) {
    const prefixedKey = this.config.redis.keyPrefix + key;
    const result = await this.redisClient.del(prefixedKey);
    return result > 0;
  }
    
  async _hasInRedis(key) {
    const prefixedKey = this.config.redis.keyPrefix + key;
    return await this.redisClient.exists(prefixedKey);
  }
    
  async _getKeysFromRedis() {
    const pattern = this.config.redis.keyPrefix + '*';
    const keys = await this.redisClient.keys(pattern);
    return keys.map(key => key.replace(this.config.redis.keyPrefix, ''));
  }
    
  async _clearRedisStore() {
    await this.redisClient.flushdb();
  }
    
  async _getSizeFromRedis() {
    return await this.redisClient.dbsize();
  }
    
  // Métodos privados para almacenamiento híbrido
    
  async _initializeHybridStore() {
    // Inicializar ambos niveles
    await this._initializeMemoryStore();
        
    if (this.config.hybrid.l2 === 'file') {
      await this._initializeFileStore();
    } else if (this.config.hybrid.l2 === 'redis') {
      await this._initializeRedisStore();
    }
        
    this.emit('hybridStoreInitialized');
  }
    
  async _getFromHybrid(key) {
    // Intentar L1 primero
    if (this.l1Store.has(key)) {
      this.statistics.l1Hits++;
      this._updateAccessCount(key);
      return await this._deserialize(this.l1Store.get(key));
    }
        
    // Intentar L2
    let value = null;
    if (this.config.hybrid.l2 === 'file') {
      value = await this._getFromFile(key);
    } else if (this.config.hybrid.l2 === 'redis') {
      value = await this._getFromRedis(key);
    }
        
    if (value !== null) {
      this.statistics.l2Hits++;
      this._updateAccessCount(key);
            
      // Promover a L1 si cumple el umbral
      const accessCount = this.accessCounts.get(key) || 0;
      if (accessCount >= this.config.hybrid.promoteThreshold) {
        await this._promoteToL1(key, value);
      }
    }
        
    return value;
  }
    
  async _setInHybrid(key, serializedValue) {
    // Verificar si L1 está lleno
    const l1Size = this._calculateL1Size();
    if (l1Size >= this.config.hybrid.l1MaxSize * this.config.hybrid.demoteThreshold) {
      await this._demoteFromL1();
    }
        
    // Establecer en L1
    this.l1Store.set(key, serializedValue);
        
    // También establecer en L2 para persistencia
    if (this.config.hybrid.l2 === 'file') {
      await this._setInFile(key, serializedValue);
    } else if (this.config.hybrid.l2 === 'redis') {
      await this._setInRedis(key, serializedValue);
    }
  }
    
  async _deleteFromHybrid(key) {
    let deleted = false;
        
    if (this.l1Store.has(key)) {
      this.l1Store.delete(key);
      deleted = true;
    }
        
    if (this.config.hybrid.l2 === 'file') {
      const fileDeleted = await this._deleteFromFile(key);
      deleted = deleted || fileDeleted;
    } else if (this.config.hybrid.l2 === 'redis') {
      const redisDeleted = await this._deleteFromRedis(key);
      deleted = deleted || redisDeleted;
    }
        
    this.accessCounts.delete(key);
        
    return deleted;
  }
    
  async _promoteToL1(key, value) {
    const serialized = await this._serialize(value);
    this.l1Store.set(key, serialized);
    this.statistics.promotions++;
    this.emit('promotion', { key });
  }
    
  async _demoteFromL1() {
    // Encontrar elementos menos accedidos en L1
    const entries = Array.from(this.l1Store.keys())
      .map(key => ({
        key,
        accessCount: this.accessCounts.get(key) || 0
      }))
      .sort((a, b) => a.accessCount - b.accessCount);
        
    // Degradar el 20% menos accedido
    const toDemote = Math.ceil(entries.length * 0.2);
        
    for (let i = 0; i < toDemote; i++) {
      const key = entries[i].key;
      this.l1Store.delete(key);
      this.statistics.demotions++;
      this.emit('demotion', { key });
    }
  }
    
  _updateAccessCount(key) {
    const count = this.accessCounts.get(key) || 0;
    this.accessCounts.set(key, count + 1);
  }
    
  _calculateL1Size() {
    let size = 0;
    for (const value of this.l1Store.values()) {
      size += JSON.stringify(value).length;
    }
    return size;
  }
    
  // Métodos de serialización
    
  async _serialize(value, metadata = {}) {
    const serialized = {
      data: value,
      metadata: metadata,
      timestamp: Date.now()
    };
        
    if (this.config.serialization.compression) {
      // Implementar compresión
    }
        
    if (this.config.serialization.encryption && this.config.serialization.encryptionKey) {
      // Implementar encriptación
    }
        
    return serialized;
  }
    
  async _deserialize(serialized) {
    if (!serialized || typeof serialized !== 'object') {
      return serialized;
    }
        
    if (this.config.serialization.encryption && this.config.serialization.encryptionKey) {
      // Implementar desencriptación
    }
        
    if (this.config.serialization.compression) {
      // Implementar descompresión
    }
        
    return serialized.data;
  }
    
  // Métodos de utilidad
    
  _validateConfig() {
    const validTypes = ['memory', 'file', 'redis', 'hybrid'];
    if (!validTypes.includes(this.config.type)) {
      throw new Error(`Invalid store type: ${this.config.type}`);
    }
        
    if (this.config.type === 'hybrid') {
      const validL2Types = ['file', 'redis'];
      if (!validL2Types.includes(this.config.hybrid.l2)) {
        throw new Error(`Invalid L2 store type: ${this.config.hybrid.l2}`);
      }
    }
  }
    
  _setupEventHandlers() {
    this.on('error', (error) => {
      if (this.logger) this.logger.error('Cache store error:', error);
    });
  }
    
  _initializePersistence() {
    this.persistenceTimer = setInterval(async() => {
      try {
        await this._persistData();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.persistence.interval);
  }
    
  async _persistData() {
    // Implementar persistencia de datos
    if (this.config.type === 'memory') {
      // Guardar datos de memoria a disco
    }
  }
    
  _updateStatistics() {
    this.statistics.totalSize = this._calculateTotalSize();
        
    if (this.config.type === 'file') {
      this.statistics.fileCount = this.fileStore.size;
    }
  }
    
  _resetStatistics() {
    Object.keys(this.statistics).forEach(key => {
      if (typeof this.statistics[key] === 'number') {
        this.statistics[key] = 0;
      }
    });
  }
    
  _calculateTotalSize() {
    let size = 0;
        
    switch (this.config.type) {
    case 'memory':
      for (const value of this.memoryStore.values()) {
        size += JSON.stringify(value).length;
      }
      break;
    case 'file':
      for (const info of this.fileStore.values()) {
        size += info.size || 0;
      }
      break;
    case 'hybrid':
      size += this._calculateL1Size();
      // L2 size would need to be calculated separately
      break;
    }
        
    return size;
  }
}

export default CacheStore;
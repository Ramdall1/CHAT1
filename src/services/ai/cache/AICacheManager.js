/**
 * AICacheManager - Gestor de caché para respuestas de IA
 * 
 * Implementa un sistema de caché inteligente para optimizar
 * el rendimiento y reducir costos de las consultas a IA.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../core/core/logger.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('AI_CACHE_MANAGER');

export class AICacheManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: true,
      maxSize: 1000, // Máximo número de entradas
      ttl: 24 * 60 * 60 * 1000, // 24 horas en milisegundos
      persistToDisk: true,
      cacheDir: './cache/ai',
      compressionEnabled: true,
      similarityThreshold: 0.85, // Para búsqueda de respuestas similares
      cleanupInterval: 60 * 60 * 1000, // 1 hora
      ...config
    };

    this.cache = new Map();
    this.accessTimes = new Map();
    this.hitCount = 0;
    this.missCount = 0;
    this.cleanupTimer = null;
  }

  /**
   * Inicializar el gestor de caché
   */
  async initialize() {
    try {
      logger.info('Inicializando gestor de caché de IA...');
      
      if (this.config.persistToDisk) {
        await this.ensureCacheDirectory();
        await this.loadFromDisk();
      }
      
      this.startCleanupTimer();
      
      logger.info(`Caché inicializado con ${this.cache.size} entradas`);
      this.emit('cache:initialized', { size: this.cache.size });
      
    } catch (error) {
      logger.error('Error inicializando caché', error);
      throw error;
    }
  }

  /**
   * Asegurar que el directorio de caché existe
   */
  async ensureCacheDirectory() {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Cargar caché desde disco
   */
  async loadFromDisk() {
    try {
      const cacheFile = path.join(this.config.cacheDir, 'ai-cache.json');
      const data = await fs.readFile(cacheFile, 'utf8');
      const cacheData = JSON.parse(data);
      
      for (const [key, entry] of Object.entries(cacheData)) {
        if (this.isEntryValid(entry)) {
          this.cache.set(key, entry);
          this.accessTimes.set(key, entry.lastAccessed);
        }
      }
      
      logger.info(`${this.cache.size} entradas cargadas desde disco`);
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Error cargando caché desde disco', error);
      }
    }
  }

  /**
   * Guardar caché en disco
   */
  async saveToDisk() {
    if (!this.config.persistToDisk) return;
    
    try {
      const cacheFile = path.join(this.config.cacheDir, 'ai-cache.json');
      const cacheData = Object.fromEntries(this.cache);
      
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
      logger.debug('Caché guardado en disco');
      
    } catch (error) {
      logger.error('Error guardando caché en disco', error);
    }
  }

  /**
   * Generar clave de caché
   */
  generateCacheKey(prompt, context = {}, options = {}) {
    const normalizedPrompt = this.normalizePrompt(prompt);
    const contextHash = this.hashObject(context);
    const optionsHash = this.hashObject(options);
    
    return crypto
      .createHash('sha256')
      .update(`${normalizedPrompt}:${contextHash}:${optionsHash}`)
      .digest('hex');
  }

  /**
   * Normalizar prompt para caché
   */
  normalizePrompt(prompt) {
    return prompt
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  /**
   * Generar hash de objeto
   */
  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Obtener respuesta del caché
   */
  async get(prompt, context = {}, options = {}) {
    if (!this.config.enabled) return null;
    
    const key = this.generateCacheKey(prompt, context, options);
    const entry = this.cache.get(key);
    
    if (entry && this.isEntryValid(entry)) {
      // Actualizar tiempo de acceso
      entry.lastAccessed = Date.now();
      this.accessTimes.set(key, entry.lastAccessed);
      
      this.hitCount++;
      
      logger.debug(`Cache HIT para clave: ${key.substring(0, 8)}...`);
      this.emit('cache:hit', { key, prompt: prompt.substring(0, 50) });
      
      return {
        ...entry.response,
        fromCache: true,
        cacheKey: key
      };
    }
    
    // Buscar respuestas similares
    const similarEntry = await this.findSimilarEntry(prompt, context, options);
    if (similarEntry) {
      this.hitCount++;
      
      logger.debug(`Cache HIT similar para: ${prompt.substring(0, 50)}...`);
      this.emit('cache:similar_hit', { 
        key: similarEntry.key, 
        similarity: similarEntry.similarity 
      });
      
      return {
        ...similarEntry.response,
        fromCache: true,
        similarity: similarEntry.similarity,
        cacheKey: similarEntry.key
      };
    }
    
    this.missCount++;
    logger.debug(`Cache MISS para: ${prompt.substring(0, 50)}...`);
    this.emit('cache:miss', { key, prompt: prompt.substring(0, 50) });
    
    return null;
  }

  /**
   * Buscar entrada similar en el caché
   */
  async findSimilarEntry(prompt, context = {}, options = {}) {
    if (this.cache.size === 0) return null;
    
    const normalizedPrompt = this.normalizePrompt(prompt);
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isEntryValid(entry)) continue;
      
      const similarity = this.calculateSimilarity(
        normalizedPrompt, 
        this.normalizePrompt(entry.originalPrompt)
      );
      
      if (similarity > bestSimilarity && similarity >= this.config.similarityThreshold) {
        bestSimilarity = similarity;
        bestMatch = {
          key,
          response: entry.response,
          similarity
        };
      }
    }
    
    return bestMatch;
  }

  /**
   * Calcular similitud entre dos textos
   */
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Almacenar respuesta en caché
   */
  async set(prompt, context = {}, options = {}, response) {
    if (!this.config.enabled) return;
    
    const key = this.generateCacheKey(prompt, context, options);
    const now = Date.now();
    
    const entry = {
      originalPrompt: prompt,
      context,
      options,
      response,
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
      size: this.calculateEntrySize(response)
    };
    
    // Verificar límite de tamaño
    if (this.cache.size >= this.config.maxSize) {
      await this.evictLeastRecentlyUsed();
    }
    
    this.cache.set(key, entry);
    this.accessTimes.set(key, now);
    
    logger.debug(`Respuesta almacenada en caché: ${key.substring(0, 8)}...`);
    this.emit('cache:set', { 
      key, 
      prompt: prompt.substring(0, 50),
      size: entry.size 
    });
    
    // Guardar en disco periódicamente
    if (this.config.persistToDisk && this.cache.size % 10 === 0) {
      await this.saveToDisk();
    }
  }

  /**
   * Calcular tamaño de entrada
   */
  calculateEntrySize(response) {
    return JSON.stringify(response).length;
  }

  /**
   * Verificar si una entrada es válida
   */
  isEntryValid(entry) {
    if (!entry || !entry.createdAt) return false;
    
    const age = Date.now() - entry.createdAt;
    return age < this.config.ttl;
  }

  /**
   * Eliminar entrada menos recientemente usada
   */
  async evictLeastRecentlyUsed() {
    if (this.cache.size === 0) return;
    
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, time] of this.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
      
      logger.debug(`Entrada eliminada por LRU: ${oldestKey.substring(0, 8)}...`);
      this.emit('cache:evicted', { key: oldestKey, reason: 'LRU' });
    }
  }

  /**
   * Limpiar entradas expiradas
   */
  async cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isEntryValid(entry)) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`${cleanedCount} entradas expiradas eliminadas del caché`);
      this.emit('cache:cleaned', { count: cleanedCount });
      
      if (this.config.persistToDisk) {
        await this.saveToDisk();
      }
    }
  }

  /**
   * Iniciar timer de limpieza
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        logger.error('Error en limpieza automática del caché', error);
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Invalidar entrada específica
   */
  invalidate(prompt, context = {}, options = {}) {
    const key = this.generateCacheKey(prompt, context, options);
    const deleted = this.cache.delete(key);
    this.accessTimes.delete(key);
    
    if (deleted) {
      logger.debug(`Entrada invalidada: ${key.substring(0, 8)}...`);
      this.emit('cache:invalidated', { key });
    }
    
    return deleted;
  }

  /**
   * Invalidar entradas por patrón
   */
  invalidateByPattern(pattern) {
    let invalidatedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.originalPrompt.includes(pattern)) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        invalidatedCount++;
      }
    }
    
    if (invalidatedCount > 0) {
      logger.info(`${invalidatedCount} entradas invalidadas por patrón: ${pattern}`);
      this.emit('cache:pattern_invalidated', { pattern, count: invalidatedCount });
    }
    
    return invalidatedCount;
  }

  /**
   * Limpiar todo el caché
   */
  async clear() {
    const size = this.cache.size;
    
    this.cache.clear();
    this.accessTimes.clear();
    this.hitCount = 0;
    this.missCount = 0;
    
    if (this.config.persistToDisk) {
      await this.saveToDisk();
    }
    
    logger.info(`Caché limpiado: ${size} entradas eliminadas`);
    this.emit('cache:cleared', { count: size });
  }

  /**
   * Obtener estadísticas del caché
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    
    let totalSize = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;
    
    for (const entry of this.cache.values()) {
      totalSize += entry.size || 0;
      if (entry.createdAt < oldestEntry) oldestEntry = entry.createdAt;
      if (entry.createdAt > newestEntry) newestEntry = entry.createdAt;
    }
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: Math.round(hitRate * 100) / 100,
      totalSize,
      averageSize: this.cache.size > 0 ? Math.round(totalSize / this.cache.size) : 0,
      oldestEntry: oldestEntry === Date.now() ? null : new Date(oldestEntry).toISOString(),
      newestEntry: newestEntry === 0 ? null : new Date(newestEntry).toISOString(),
      ttl: this.config.ttl,
      enabled: this.config.enabled
    };
  }

  /**
   * Obtener información de una entrada específica
   */
  getEntryInfo(prompt, context = {}, options = {}) {
    const key = this.generateCacheKey(prompt, context, options);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    return {
      key,
      valid: this.isEntryValid(entry),
      createdAt: new Date(entry.createdAt).toISOString(),
      lastAccessed: new Date(entry.lastAccessed).toISOString(),
      accessCount: entry.accessCount,
      size: entry.size,
      age: Date.now() - entry.createdAt,
      timeToExpiry: this.config.ttl - (Date.now() - entry.createdAt)
    };
  }

  /**
   * Exportar caché
   */
  async export() {
    const data = {
      config: this.config,
      stats: this.getStats(),
      entries: Object.fromEntries(this.cache),
      exportedAt: new Date().toISOString()
    };
    
    return data;
  }

  /**
   * Importar caché
   */
  async import(data) {
    if (!data || !data.entries) {
      throw new Error('Datos de importación inválidos');
    }
    
    let importedCount = 0;
    
    for (const [key, entry] of Object.entries(data.entries)) {
      if (this.isEntryValid(entry)) {
        this.cache.set(key, entry);
        this.accessTimes.set(key, entry.lastAccessed);
        importedCount++;
      }
    }
    
    logger.info(`${importedCount} entradas importadas al caché`);
    this.emit('cache:imported', { count: importedCount });
    
    return importedCount;
  }

  /**
   * Cerrar el gestor de caché
   */
  async shutdown() {
    logger.info('Cerrando gestor de caché de IA...');
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.config.persistToDisk) {
      await this.saveToDisk();
    }
    
    this.emit('cache:shutdown');
  }
}

export default AICacheManager;
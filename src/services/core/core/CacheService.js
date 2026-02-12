/**
 * Redis Cache Service
 * Implementa cache distribuido para optimizar rendimiento
 * Recomendación #16: Redis Cache
 */

import Redis from 'ioredis';
import logger from './logger.js';

class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 hora por defecto
    this.keyPrefix = 'chatbot:';
        
    // Configuración de Redis
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000
    };
  }

  /**
     * Inicializar conexión Redis
     */
  async initialize() {
    try {
      this.redis = new Redis(this.config);
            
      // Event listeners
      this.redis.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis conectado exitosamente');
      });

      this.redis.on('error', (error) => {
        this.isConnected = false;
        logger.error('Error de Redis:', error);
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        logger.warn('Conexión Redis cerrada');
      });

      // Verificar conexión
      await this.redis.ping();
      logger.info('CacheService inicializado correctamente');
            
    } catch (error) {
      logger.error('Error inicializando CacheService:', error);
      // Continuar sin cache si Redis no está disponible
      this.redis = null;
    }
  }

  /**
     * Obtener valor del cache
     */
  async get(key) {
    if (!this.isConnected || !this.redis) {
      return null;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.redis.get(fullKey);
            
      if (value) {
        logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(value);
      }
            
      logger.debug(`Cache MISS: ${key}`);
      return null;
            
    } catch (error) {
      logger.error(`Error obteniendo cache ${key}:`, error);
      return null;
    }
  }

  /**
     * Establecer valor en cache
     */
  async set(key, value, ttl = null) {
    if (!this.isConnected || !this.redis) {
      return false;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const serializedValue = JSON.stringify(value);
      const expiration = ttl || this.defaultTTL;
            
      await this.redis.setex(fullKey, expiration, serializedValue);
      logger.debug(`Cache SET: ${key} (TTL: ${expiration}s)`);
      return true;
            
    } catch (error) {
      logger.error(`Error estableciendo cache ${key}:`, error);
      return false;
    }
  }

  /**
     * Eliminar valor del cache
     */
  async del(key) {
    if (!this.isConnected || !this.redis) {
      return false;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.redis.del(fullKey);
      logger.debug(`Cache DEL: ${key}`);
      return result > 0;
            
    } catch (error) {
      logger.error(`Error eliminando cache ${key}:`, error);
      return false;
    }
  }

  /**
     * Eliminar múltiples claves por patrón
     */
  async delPattern(pattern) {
    if (!this.isConnected || !this.redis) {
      return 0;
    }

    try {
      const fullPattern = this.keyPrefix + pattern;
      const keys = await this.redis.keys(fullPattern);
            
      if (keys.length > 0) {
        const result = await this.redis.del(...keys);
        logger.debug(`Cache DEL PATTERN: ${pattern} (${result} claves)`);
        return result;
      }
            
      return 0;
            
    } catch (error) {
      logger.error(`Error eliminando patrón ${pattern}:`, error);
      return 0;
    }
  }

  /**
     * Verificar si existe una clave
     */
  async exists(key) {
    if (!this.isConnected || !this.redis) {
      return false;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.redis.exists(fullKey);
      return result === 1;
            
    } catch (error) {
      logger.error(`Error verificando existencia ${key}:`, error);
      return false;
    }
  }

  /**
     * Incrementar valor numérico
     */
  async incr(key, amount = 1) {
    if (!this.isConnected || !this.redis) {
      return null;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.redis.incrby(fullKey, amount);
      logger.debug(`Cache INCR: ${key} (+${amount}) = ${result}`);
      return result;
            
    } catch (error) {
      logger.error(`Error incrementando ${key}:`, error);
      return null;
    }
  }

  /**
     * Establecer TTL para una clave existente
     */
  async expire(key, ttl) {
    if (!this.isConnected || !this.redis) {
      return false;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.redis.expire(fullKey, ttl);
      logger.debug(`Cache EXPIRE: ${key} (${ttl}s)`);
      return result === 1;
            
    } catch (error) {
      logger.error(`Error estableciendo TTL ${key}:`, error);
      return false;
    }
  }

  /**
     * Obtener múltiples valores
     */
  async mget(keys) {
    if (!this.isConnected || !this.redis || !keys.length) {
      return {};
    }

    try {
      const fullKeys = keys.map(key => this.keyPrefix + key);
      const values = await this.redis.mget(...fullKeys);
            
      const result = {};
      keys.forEach((key, index) => {
        if (values[index]) {
          try {
            result[key] = JSON.parse(values[index]);
          } catch (e) {
            result[key] = values[index];
          }
        }
      });
            
      logger.debug(`Cache MGET: ${keys.length} claves`);
      return result;
            
    } catch (error) {
      logger.error('Error obteniendo múltiples valores:', error);
      return {};
    }
  }

  /**
     * Cache con función de fallback
     */
  async remember(key, ttl, fallbackFn) {
    // Intentar obtener del cache
    let value = await this.get(key);
        
    if (value !== null) {
      return value;
    }
        
    // Si no está en cache, ejecutar función fallback
    try {
      value = await fallbackFn();
            
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttl);
      }
            
      return value;
            
    } catch (error) {
      logger.error(`Error en función fallback para ${key}:`, error);
      throw error;
    }
  }

  /**
     * Limpiar todo el cache
     */
  async flush() {
    if (!this.isConnected || !this.redis) {
      return false;
    }

    try {
      await this.redis.flushdb();
      logger.info('Cache completamente limpiado');
      return true;
            
    } catch (error) {
      logger.error('Error limpiando cache:', error);
      return false;
    }
  }

  /**
     * Obtener estadísticas del cache
     */
  async getStats() {
    if (!this.isConnected || !this.redis) {
      return null;
    }

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
            
      return {
        connected: this.isConnected,
        memory: info,
        keyspace: keyspace,
        prefix: this.keyPrefix
      };
            
    } catch (error) {
      logger.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }

  /**
     * Cerrar conexión
     */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Conexión Redis cerrada');
    }
  }

  /**
     * Métodos de conveniencia para casos específicos
     */

  // Cache para contactos
  async cacheContact(contactId, contactData, ttl = 1800) {
    return await this.set(`contact:${contactId}`, contactData, ttl);
  }

  async getContact(contactId) {
    return await this.get(`contact:${contactId}`);
  }

  // Cache para conversaciones
  async cacheConversation(conversationId, conversationData, ttl = 3600) {
    return await this.set(`conversation:${conversationId}`, conversationData, ttl);
  }

  async getConversation(conversationId) {
    return await this.get(`conversation:${conversationId}`);
  }

  // Cache para plantillas
  async cacheTemplate(templateId, templateData, ttl = 7200) {
    return await this.set(`template:${templateId}`, templateData, ttl);
  }

  async getTemplate(templateId) {
    return await this.get(`template:${templateId}`);
  }

  // Cache para sesiones de usuario
  async cacheSession(sessionId, sessionData, ttl = 1800) {
    return await this.set(`session:${sessionId}`, sessionData, ttl);
  }

  async getSession(sessionId) {
    return await this.get(`session:${sessionId}`);
  }

  // Invalidar cache relacionado
  async invalidateContactCache(contactId) {
    await this.delPattern(`contact:${contactId}*`);
    await this.delPattern(`conversation:*:${contactId}*`);
  }

  async invalidateConversationCache(conversationId) {
    await this.delPattern(`conversation:${conversationId}*`);
  }
}

// Singleton instance
const cacheService = new CacheService();

export { cacheService, CacheService };
export default cacheService;
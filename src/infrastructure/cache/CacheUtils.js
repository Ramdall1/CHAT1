/**
 * Cache Utilities
 * Utilidades comunes para el sistema de cache distribuido
 */

import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Utilidades para generación de claves
 */
export class CacheKeyUtils {
  /**
   * Generar clave de cache normalizada
   */
  static generateKey(prefix, ...parts) {
    const normalizedParts = parts
      .filter(part => part !== null && part !== undefined)
      .map(part => {
        if (typeof part === 'object') {
          return this.hashObject(part);
        }
        return String(part).toLowerCase().replace(/[^a-z0-9]/g, '_');
      });

    return `${prefix}:${normalizedParts.join(':')}`;
  }

  /**
   * Generar hash de objeto
   */
  static hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  /**
   * Generar clave para usuario
   */
  static userKey(userId, type = 'profile') {
    return this.generateKey('user', type, userId);
  }

  /**
   * Generar clave para conversación
   */
  static conversationKey(conversationId, type = 'data') {
    return this.generateKey('conv', type, conversationId);
  }

  /**
   * Generar clave para plantilla
   */
  static templateKey(templateId, type = 'content') {
    return this.generateKey('tmpl', type, templateId);
  }

  /**
   * Generar clave para sesión
   */
  static sessionKey(sessionId) {
    return this.generateKey('sess', sessionId);
  }

  /**
   * Generar clave para API
   */
  static apiKey(endpoint, params = {}) {
    return this.generateKey('api', endpoint, params);
  }

  /**
   * Generar clave para analíticas
   */
  static analyticsKey(type, period, filters = {}) {
    return this.generateKey('analytics', type, period, filters);
  }

  /**
   * Extraer información de clave
   */
  static parseKey(key) {
    const parts = key.split(':');
    return {
      prefix: parts[0],
      type: parts[1],
      identifier: parts.slice(2).join(':'),
      parts
    };
  }

  /**
   * Validar formato de clave
   */
  static isValidKey(key) {
    if (typeof key !== 'string' || key.length === 0) {
      return false;
    }

    const parts = key.split(':');
    return parts.length >= 2 && parts.every(part => part.length > 0);
  }

  /**
   * Generar patrón de búsqueda
   */
  static generatePattern(prefix, type = '*') {
    return `${prefix}:${type}:*`;
  }
}

/**
 * Utilidades para serialización
 */
export class CacheSerializationUtils {
  /**
   * Serializar datos
   */
  static serialize(data, options = {}) {
    try {
      const { compression = false, format = 'json' } = options;
      
      let serialized;
      
      switch (format) {
        case 'json':
          serialized = JSON.stringify(data);
          break;
        case 'msgpack':
          // Implementar MessagePack si es necesario
          serialized = JSON.stringify(data);
          break;
        default:
          serialized = JSON.stringify(data);
      }

      if (compression && serialized.length > 1024) {
        return this.compress(serialized);
      }

      return serialized;

    } catch (error) {
      throw new Error(`Error serializando datos: ${error.message}`);
    }
  }

  /**
   * Deserializar datos
   */
  static deserialize(data, options = {}) {
    try {
      if (!data) return null;

      const { compression = false, format = 'json' } = options;
      
      let decompressed = data;
      
      if (compression && this.isCompressed(data)) {
        decompressed = this.decompress(data);
      }

      switch (format) {
        case 'json':
          return JSON.parse(decompressed);
        case 'msgpack':
          // Implementar MessagePack si es necesario
          return JSON.parse(decompressed);
        default:
          return JSON.parse(decompressed);
      }

    } catch (error) {
      throw new Error(`Error deserializando datos: ${error.message}`);
    }
  }

  /**
   * Comprimir datos
   */
  static async compress(data) {
    try {
      const compressed = await gzip(Buffer.from(data, 'utf8'));
      return `gzip:${compressed.toString('base64')}`;
    } catch (error) {
      throw new Error(`Error comprimiendo datos: ${error.message}`);
    }
  }

  /**
   * Descomprimir datos
   */
  static async decompress(data) {
    try {
      if (!this.isCompressed(data)) {
        return data;
      }

      const [algorithm, compressedData] = data.split(':', 2);
      
      if (algorithm === 'gzip') {
        const buffer = Buffer.from(compressedData, 'base64');
        const decompressed = await gunzip(buffer);
        return decompressed.toString('utf8');
      }

      return data;

    } catch (error) {
      throw new Error(`Error descomprimiendo datos: ${error.message}`);
    }
  }

  /**
   * Verificar si los datos están comprimidos
   */
  static isCompressed(data) {
    return typeof data === 'string' && data.startsWith('gzip:');
  }

  /**
   * Calcular tamaño de datos
   */
  static calculateSize(data) {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    }
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }
}

/**
 * Utilidades para TTL
 */
export class CacheTTLUtils {
  /**
   * Convertir TTL a segundos
   */
  static toSeconds(ttl, unit = 'seconds') {
    const multipliers = {
      seconds: 1,
      minutes: 60,
      hours: 3600,
      days: 86400,
      weeks: 604800
    };

    return ttl * (multipliers[unit] || 1);
  }

  /**
   * Generar TTL dinámico basado en tipo de datos
   */
  static getDynamicTTL(dataType, size = 0, accessFrequency = 1) {
    const baseTTLs = {
      session: 3600,      // 1 hora
      user: 1800,         // 30 minutos
      conversation: 900,   // 15 minutos
      template: 7200,     // 2 horas
      api: 300,           // 5 minutos
      analytics: 600      // 10 minutos
    };

    let baseTTL = baseTTLs[dataType] || 300;

    // Ajustar por tamaño (datos más grandes, TTL más corto)
    if (size > 10000) {
      baseTTL *= 0.5;
    } else if (size > 1000) {
      baseTTL *= 0.8;
    }

    // Ajustar por frecuencia de acceso (más acceso, TTL más largo)
    if (accessFrequency > 10) {
      baseTTL *= 1.5;
    } else if (accessFrequency > 5) {
      baseTTL *= 1.2;
    }

    return Math.max(60, Math.floor(baseTTL)); // Mínimo 1 minuto
  }

  /**
   * Calcular TTL con jitter
   */
  static addJitter(ttl, jitterPercent = 10) {
    const jitter = ttl * (jitterPercent / 100);
    const randomJitter = (Math.random() - 0.5) * 2 * jitter;
    return Math.max(60, Math.floor(ttl + randomJitter));
  }

  /**
   * Verificar si TTL está próximo a expirar
   */
  static isNearExpiration(remainingTTL, originalTTL, threshold = 0.1) {
    return remainingTTL <= (originalTTL * threshold);
  }
}

/**
 * Utilidades para patrones
 */
export class CachePatternUtils {
  /**
   * Verificar si una clave coincide con un patrón
   */
  static matchesPattern(key, pattern) {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  /**
   * Generar patrones comunes
   */
  static getCommonPatterns() {
    return {
      allUsers: 'user:*',
      userProfiles: 'user:profile:*',
      userSessions: 'sess:*',
      allConversations: 'conv:*',
      conversationMessages: 'conv:messages:*',
      allTemplates: 'tmpl:*',
      apiResponses: 'api:*',
      analytics: 'analytics:*'
    };
  }

  /**
   * Extraer claves que coinciden con patrón
   */
  static filterKeysByPattern(keys, pattern) {
    return keys.filter(key => this.matchesPattern(key, pattern));
  }
}

/**
 * Utilidades para métricas
 */
export class CacheMetricsUtils {
  /**
   * Calcular tasa de aciertos
   */
  static calculateHitRate(hits, misses) {
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  }

  /**
   * Calcular throughput
   */
  static calculateThroughput(operations, timeWindowMs) {
    return (operations / timeWindowMs) * 1000; // operaciones por segundo
  }

  /**
   * Calcular percentiles
   */
  static calculatePercentiles(values, percentiles = [50, 90, 95, 99]) {
    if (values.length === 0) return {};

    const sorted = [...values].sort((a, b) => a - b);
    const result = {};

    percentiles.forEach(p => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[`p${p}`] = sorted[Math.max(0, index)];
    });

    return result;
  }

  /**
   * Formatear tamaño en bytes
   */
  static formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Formatear duración
   */
  static formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
    return `${(ms / 3600000).toFixed(2)}h`;
  }
}

/**
 * Utilidades para validación
 */
export class CacheValidationUtils {
  /**
   * Validar configuración de cache
   */
  static validateCacheConfig(config) {
    const errors = [];

    if (!config.host) {
      errors.push('Host de Redis es requerido');
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Puerto de Redis debe estar entre 1 y 65535');
    }

    if (config.maxMemory && config.maxMemory < 1024 * 1024) {
      errors.push('Memoria máxima debe ser al menos 1MB');
    }

    if (config.ttl && config.ttl < 1) {
      errors.push('TTL debe ser mayor a 0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validar datos para cache
   */
  static validateCacheData(data) {
    if (data === null || data === undefined) {
      return { valid: false, error: 'Datos no pueden ser null o undefined' };
    }

    try {
      JSON.stringify(data);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Datos no son serializables' };
    }
  }

  /**
   * Sanitizar clave de cache
   */
  static sanitizeKey(key) {
    return key
      .replace(/[^a-zA-Z0-9:_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}

/**
 * Utilidades para debugging
 */
export class CacheDebugUtils {
  /**
   * Generar información de debug
   */
  static generateDebugInfo(operation, key, data, options = {}) {
    return {
      operation,
      key,
      keyInfo: CacheKeyUtils.parseKey(key),
      dataSize: data ? CacheSerializationUtils.calculateSize(data) : 0,
      options,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack
    };
  }

  /**
   * Log de operación de cache
   */
  static logCacheOperation(operation, key, result, duration) {
    const info = {
      operation,
      key,
      success: result !== null && result !== undefined,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };

    console.debug('Cache Operation:', info);
    return info;
  }
}

// Exportar todas las utilidades
export default {
  CacheKeyUtils,
  CacheSerializationUtils,
  CacheTTLUtils,
  CachePatternUtils,
  CacheMetricsUtils,
  CacheValidationUtils,
  CacheDebugUtils
};
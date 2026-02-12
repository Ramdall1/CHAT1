/**
 * Utilidades para Adaptadores de Comunicación
 * 
 * Funciones de utilidad comunes para todos los adaptadores
 * del sistema event-driven
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../services/core/core/logger.js';
import { EventEmitter } from 'events';

const logger = createLogger('ADAPTER_UTILS');

export class AdapterUtils {
  /**
   * Formatear tamaño de bytes en formato legible
   */
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  /**
   * Generar ID único
   */
  static generateId(prefix = '', length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return prefix ? `${prefix}_${result}` : result;
  }
  
  /**
   * Generar timestamp ISO
   */
  static getTimestamp() {
    return new Date().toISOString();
  }
  
  /**
   * Calcular latencia entre timestamps
   */
  static calculateLatency(startTime, endTime = null) {
    const end = endTime ? new Date(endTime) : new Date();
    const start = new Date(startTime);
    return end.getTime() - start.getTime();
  }
  
  /**
   * Validar formato de evento
   */
  static validateEvent(event) {
    const errors = [];
    
    if (!event || typeof event !== 'object') {
      errors.push('Evento debe ser un objeto');
      return { isValid: false, errors };
    }
    
    if (!event.eventType || typeof event.eventType !== 'string') {
      errors.push('eventType es requerido y debe ser string');
    }
    
    if (!event.timestamp) {
      errors.push('timestamp es requerido');
    } else if (isNaN(new Date(event.timestamp).getTime())) {
      errors.push('timestamp debe ser una fecha válida');
    }
    
    if (event.id && typeof event.id !== 'string') {
      errors.push('id debe ser string');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Sanitizar evento
   */
  static sanitizeEvent(event) {
    const sanitized = { ...event };
    
    // Asegurar campos requeridos
    if (!sanitized.id) {
      sanitized.id = this.generateId('evt');
    }
    
    if (!sanitized.timestamp) {
      sanitized.timestamp = this.getTimestamp();
    }
    
    // Limpiar campos sensibles
    if (sanitized.password) delete sanitized.password;
    if (sanitized.secret) delete sanitized.secret;
    if (sanitized.token) delete sanitized.token;
    
    // Limitar tamaño de campos de texto
    const maxTextLength = 10000;
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && value.length > maxTextLength) {
        sanitized[key] = value.substring(0, maxTextLength) + '...';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Comprimir datos usando algoritmo simple
   */
  static compress(data, algorithm = 'gzip') {
    try {
      if (typeof data !== 'string') {
        data = JSON.stringify(data);
      }
      
      // Implementación básica de compresión
      // En producción usar librerías como zlib
      switch (algorithm) {
      case 'gzip':
        return this.simpleCompress(data);
      default:
        return data;
      }
    } catch (error) {
      logger.error('Error comprimiendo datos:', error);
      return data;
    }
  }
  
  /**
   * Descomprimir datos
   */
  static decompress(data, algorithm = 'gzip') {
    try {
      switch (algorithm) {
      case 'gzip':
        return this.simpleDecompress(data);
      default:
        return data;
      }
    } catch (error) {
      logger.error('Error descomprimiendo datos:', error);
      return data;
    }
  }
  
  /**
   * Compresión simple (placeholder para implementación real)
   */
  static simpleCompress(data) {
    // Implementación básica - en producción usar zlib
    return Buffer.from(data).toString('base64');
  }
  
  /**
   * Descompresión simple (placeholder para implementación real)
   */
  static simpleDecompress(data) {
    // Implementación básica - en producción usar zlib
    return Buffer.from(data, 'base64').toString();
  }
  
  /**
   * Serializar datos
   */
  static serialize(data, format = 'json') {
    try {
      switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data);
      case 'msgpack':
        // Placeholder para MessagePack
        return JSON.stringify(data);
      case 'protobuf':
        // Placeholder para Protocol Buffers
        return JSON.stringify(data);
      default:
        return String(data);
      }
    } catch (error) {
      logger.error('Error serializando datos:', error);
      throw error;
    }
  }
  
  /**
   * Deserializar datos
   */
  static deserialize(data, format = 'json') {
    try {
      switch (format.toLowerCase()) {
      case 'json':
        return JSON.parse(data);
      case 'msgpack':
        // Placeholder para MessagePack
        return JSON.parse(data);
      case 'protobuf':
        // Placeholder para Protocol Buffers
        return JSON.parse(data);
      default:
        return data;
      }
    } catch (error) {
      logger.error('Error deserializando datos:', error);
      throw error;
    }
  }
  
  /**
   * Validar URL
   */
  static validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Parsear URL de conexión
   */
  static parseConnectionUrl(url) {
    try {
      const parsed = new URL(url);
      
      return {
        protocol: parsed.protocol.replace(':', ''),
        hostname: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port) : null,
        pathname: parsed.pathname,
        search: parsed.search,
        username: parsed.username || null,
        password: parsed.password || null,
        hash: parsed.hash || null
      };
    } catch (error) {
      throw new Error(`URL inválida: ${url}`);
    }
  }
  
  /**
   * Crear patrón de retry con backoff exponencial
   */
  static createRetryPattern(maxAttempts = 5, baseDelay = 1000, maxDelay = 30000) {
    return {
      maxAttempts,
      baseDelay,
      maxDelay,
      
      getDelay(attempt) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        return Math.min(delay, maxDelay);
      },
      
      shouldRetry(attempt, error) {
        return attempt < maxAttempts && this.isRetryableError(error);
      },
      
      isRetryableError(error) {
        // Errores que permiten retry
        const retryableErrors = [
          'ECONNREFUSED',
          'ENOTFOUND',
          'ETIMEDOUT',
          'ECONNRESET',
          'EPIPE'
        ];
        
        return retryableErrors.some(code => 
          error.code === code || error.message?.includes(code)
        );
      }
    };
  }
  
  /**
   * Ejecutar función con retry
   */
  static async executeWithRetry(fn, retryPattern = null) {
    const pattern = retryPattern || this.createRetryPattern();
    let lastError;
    
    for (let attempt = 1; attempt <= pattern.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (!pattern.shouldRetry(attempt, error)) {
          break;
        }
        
        if (attempt < pattern.maxAttempts) {
          const delay = pattern.getDelay(attempt);
          logger.warn(`Intento ${attempt} falló, reintentando en ${delay}ms:`, error.message);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Sleep/delay asíncrono
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Crear timeout para promesas
   */
  static withTimeout(promise, timeoutMs, timeoutMessage = 'Operación timeout') {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      )
    ]);
  }
  
  /**
   * Debounce para funciones
   */
  static debounce(func, wait) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  /**
   * Throttle para funciones
   */
  static throttle(func, limit) {
    let inThrottle;
    
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  /**
   * Crear circuit breaker simple
   */
  static createCircuitBreaker(options = {}) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitoringPeriod = 10000
    } = options;
    
    let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    let failureCount = 0;
    let lastFailureTime = null;
    let successCount = 0;
    
    return {
      async execute(fn) {
        if (state === 'OPEN') {
          if (Date.now() - lastFailureTime >= resetTimeout) {
            state = 'HALF_OPEN';
            successCount = 0;
          } else {
            throw new Error('Circuit breaker is OPEN');
          }
        }
        
        try {
          const result = await fn();
          
          if (state === 'HALF_OPEN') {
            successCount++;
            if (successCount >= 3) {
              state = 'CLOSED';
              failureCount = 0;
            }
          } else {
            failureCount = 0;
          }
          
          return result;
          
        } catch (error) {
          failureCount++;
          lastFailureTime = Date.now();
          
          if (failureCount >= failureThreshold) {
            state = 'OPEN';
          }
          
          throw error;
        }
      },
      
      getState() {
        return {
          state,
          failureCount,
          lastFailureTime,
          successCount
        };
      }
    };
  }
  
  /**
   * Validar configuración de conexión
   */
  static validateConnectionConfig(config) {
    const errors = [];
    
    if (!config || typeof config !== 'object') {
      errors.push('Configuración de conexión requerida');
      return { isValid: false, errors };
    }
    
    // Validar host
    if (!config.host || typeof config.host !== 'string') {
      errors.push('Host es requerido');
    }
    
    // Validar puerto
    if (config.port !== undefined) {
      const port = parseInt(config.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push('Puerto debe ser un número entre 1 y 65535');
      }
    }
    
    // Validar timeout
    if (config.timeout !== undefined) {
      const timeout = parseInt(config.timeout);
      if (isNaN(timeout) || timeout < 0) {
        errors.push('Timeout debe ser un número positivo');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Crear métricas básicas
   */
  static createMetrics() {
    const metrics = {
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map(),
      timers: new Map()
    };
    
    return {
      // Incrementar contador
      increment(name, value = 1, tags = {}) {
        const key = this.createKey(name, tags);
        const current = metrics.counters.get(key) || 0;
        metrics.counters.set(key, current + value);
      },
      
      // Establecer gauge
      gauge(name, value, tags = {}) {
        const key = this.createKey(name, tags);
        metrics.gauges.set(key, value);
      },
      
      // Agregar valor a histograma
      histogram(name, value, tags = {}) {
        const key = this.createKey(name, tags);
        const values = metrics.histograms.get(key) || [];
        values.push(value);
        metrics.histograms.set(key, values);
      },
      
      // Iniciar timer
      startTimer(name, tags = {}) {
        const key = this.createKey(name, tags);
        metrics.timers.set(key, Date.now());
        
        return () => {
          const startTime = metrics.timers.get(key);
          if (startTime) {
            const duration = Date.now() - startTime;
            this.histogram(name + '_duration', duration, tags);
            metrics.timers.delete(key);
            return duration;
          }
          return 0;
        };
      },
      
      // Obtener todas las métricas
      getAll() {
        return {
          counters: Object.fromEntries(metrics.counters),
          gauges: Object.fromEntries(metrics.gauges),
          histograms: Object.fromEntries(
            Array.from(metrics.histograms.entries()).map(([key, values]) => [
              key,
              {
                count: values.length,
                sum: values.reduce((a, b) => a + b, 0),
                avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
                min: Math.min(...values),
                max: Math.max(...values)
              }
            ])
          ),
          timestamp: new Date().toISOString()
        };
      },
      
      // Resetear métricas
      reset() {
        metrics.counters.clear();
        metrics.gauges.clear();
        metrics.histograms.clear();
        metrics.timers.clear();
      },
      
      // Crear clave con tags
      createKey(name, tags) {
        if (Object.keys(tags).length === 0) {
          return name;
        }
        
        const tagString = Object.entries(tags)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => `${key}=${value}`)
          .join(',');
        
        return `${name}{${tagString}}`;
      }
    };
  }
  
  /**
   * Crear rate limiter simple
   */
  static createRateLimiter(maxRequests, windowMs) {
    const requests = new Map();
    
    return {
      isAllowed(key = 'default') {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Limpiar requests antiguos
        const keyRequests = requests.get(key) || [];
        const validRequests = keyRequests.filter(time => time > windowStart);
        
        if (validRequests.length >= maxRequests) {
          return false;
        }
        
        validRequests.push(now);
        requests.set(key, validRequests);
        
        return true;
      },
      
      getRemaining(key = 'default') {
        const now = Date.now();
        const windowStart = now - windowMs;
        const keyRequests = requests.get(key) || [];
        const validRequests = keyRequests.filter(time => time > windowStart);
        
        return Math.max(0, maxRequests - validRequests.length);
      },
      
      reset(key = null) {
        if (key) {
          requests.delete(key);
        } else {
          requests.clear();
        }
      }
    };
  }
}

export default AdapterUtils;
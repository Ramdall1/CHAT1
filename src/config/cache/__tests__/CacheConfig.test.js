/**
 * Tests para Cache Config
 * 
 * Pruebas unitarias de la configuración de caché
 */

import CacheConfig from '../CacheConfig.js';

describe('CacheConfig', () => {
  describe('Configuración de Redis', () => {
    test('debería retornar configuración de Redis', () => {
      const config = CacheConfig.getRedisConfig();

      expect(config).toBeDefined();
      expect(config.host).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.db).toBeDefined();
    });

    test('debería tener valores por defecto', () => {
      const config = CacheConfig.getRedisConfig();

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(6379);
      expect(config.db).toBe(0);
    });

    test('debería tener retry strategy', () => {
      const config = CacheConfig.getRedisConfig();

      expect(config.retryStrategy).toBeDefined();
      expect(typeof config.retryStrategy).toBe('function');
    });

    test('debería tener reconnect on error handler', () => {
      const config = CacheConfig.getRedisConfig();

      expect(config.reconnectOnError).toBeDefined();
      expect(typeof config.reconnectOnError).toBe('function');
    });
  });

  describe('Configuración de Memory Cache', () => {
    test('debería retornar configuración de memory cache', () => {
      const config = CacheConfig.getMemoryConfig();

      expect(config).toBeDefined();
      expect(config.maxSize).toBeDefined();
      expect(config.ttl).toBeDefined();
    });

    test('debería tener valores por defecto', () => {
      const config = CacheConfig.getMemoryConfig();

      expect(config.maxSize).toBe(1000);
      expect(config.ttl).toBe(3600);
    });

    test('debería tener checkperiod', () => {
      const config = CacheConfig.getMemoryConfig();

      expect(config.checkperiod).toBeDefined();
      expect(config.checkperiod).toBe(600);
    });
  });

  describe('Configuración Hybrid', () => {
    test('debería retornar configuración hybrid', () => {
      const config = CacheConfig.getHybridConfig();

      expect(config).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.redis).toBeDefined();
    });

    test('debería tener fallback a memory', () => {
      const config = CacheConfig.getHybridConfig();

      expect(config.fallbackToMemory).toBe(true);
    });

    test('debería tener sync interval', () => {
      const config = CacheConfig.getHybridConfig();

      expect(config.syncInterval).toBeDefined();
      expect(typeof config.syncInterval).toBe('number');
    });
  });

  describe('Estrategia de Caché', () => {
    test('debería retornar estrategia válida', () => {
      const strategy = CacheConfig.getCacheStrategy();

      expect(['memory', 'redis', 'hybrid']).toContain(strategy);
    });

    test('debería usar memory por defecto', () => {
      const strategy = CacheConfig.getCacheStrategy();

      expect(strategy).toBe('memory');
    });
  });

  describe('Configuración de Compresión', () => {
    test('debería retornar configuración de compresión', () => {
      const config = CacheConfig.getCompressionConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBeDefined();
      expect(config.algorithm).toBeDefined();
      expect(config.level).toBeDefined();
    });

    test('debería tener algoritmo por defecto', () => {
      const config = CacheConfig.getCompressionConfig();

      expect(config.algorithm).toBe('gzip');
    });
  });

  describe('Configuración de Serialización', () => {
    test('debería retornar configuración de serialización', () => {
      const config = CacheConfig.getSerializationConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBeDefined();
      expect(config.format).toBeDefined();
    });

    test('debería tener formato por defecto', () => {
      const config = CacheConfig.getSerializationConfig();

      expect(config.format).toBe('json');
    });
  });

  describe('Configuración de Invalidación', () => {
    test('debería retornar configuración de invalidación', () => {
      const config = CacheConfig.getInvalidationConfig();

      expect(config).toBeDefined();
      expect(config.strategy).toBeDefined();
      expect(config.maxAge).toBeDefined();
    });

    test('debería tener estrategia por defecto', () => {
      const config = CacheConfig.getInvalidationConfig();

      expect(config.strategy).toBe('ttl');
    });

    test('debería tener stale while revalidate', () => {
      const config = CacheConfig.getInvalidationConfig();

      expect(config.staleWhileRevalidate).toBeDefined();
      expect(typeof config.staleWhileRevalidate).toBe('number');
    });
  });

  describe('Configuración de Monitoreo', () => {
    test('debería retornar configuración de monitoreo', () => {
      const config = CacheConfig.getMonitoringConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBeDefined();
      expect(config.metricsInterval).toBeDefined();
    });

    test('debería rastrear hit rate', () => {
      const config = CacheConfig.getMonitoringConfig();

      expect(config.trackHitRate).toBe(true);
    });

    test('debería rastrear uso de memoria', () => {
      const config = CacheConfig.getMonitoringConfig();

      expect(config.trackMemoryUsage).toBe(true);
    });
  });

  describe('Configuración Completa', () => {
    test('debería retornar configuración completa', () => {
      const config = CacheConfig.getFullConfig();

      expect(config).toBeDefined();
      expect(config.strategy).toBeDefined();
      expect(config.redis).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.hybrid).toBeDefined();
      expect(config.compression).toBeDefined();
      expect(config.serialization).toBeDefined();
      expect(config.invalidation).toBeDefined();
      expect(config.monitoring).toBeDefined();
    });

    test('debería tener namespace', () => {
      const config = CacheConfig.getFullConfig();

      expect(config.namespace).toBeDefined();
      expect(typeof config.namespace).toBe('string');
    });

    test('debería tener key prefix', () => {
      const config = CacheConfig.getFullConfig();

      expect(config.keyPrefix).toBeDefined();
      expect(config.keyPrefix).toBe('cache:');
    });
  });

  describe('Validación de Configuración', () => {
    test('debería validar configuración correcta', () => {
      const validation = CacheConfig.validateConfig();

      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(validation.errors).toBeDefined();
    });

    test('debería retornar errores si hay problemas', () => {
      // Simular configuración inválida
      process.env.CACHE_MAX_SIZE = '5'; // Muy pequeño

      const validation = CacheConfig.validateConfig();

      expect(Array.isArray(validation.errors)).toBe(true);
    });

    test('debería retornar warnings', () => {
      const validation = CacheConfig.validateConfig();

      expect(Array.isArray(validation.warnings)).toBe(true);
    });
  });
});

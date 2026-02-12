/**
 * CacheManager - Sistema de gestión de caché para el chatbot
 * Proporciona funcionalidades de almacenamiento temporal para mejorar el rendimiento
 */

import { EventEmitter } from 'events';

class CacheManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.caches = new Map();
        this.defaultTTL = options.defaultTTL || 300000; // 5 minutos por defecto
        this.maxSize = options.maxSize || 1000;
        this.cleanupInterval = options.cleanupInterval || 60000; // 1 minuto
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
        
        this.startCleanupTimer();
    }

    /**
     * Crea o obtiene una instancia de caché
     */
    getCache(name, options = {}) {
        if (!this.caches.has(name)) {
            this.caches.set(name, new Cache({
                name,
                ttl: options.ttl || this.defaultTTL,
                maxSize: options.maxSize || this.maxSize,
                manager: this
            }));
        }
        return this.caches.get(name);
    }

    /**
     * Elimina una caché específica
     */
    deleteCache(name) {
        if (this.caches.has(name)) {
            const cache = this.caches.get(name);
            cache.clear();
            this.caches.delete(name);
            this.emit('cacheDeleted', { name });
            return true;
        }
        return false;
    }

    /**
     * Limpia todas las cachés
     */
    clearAll() {
        for (const [name, cache] of this.caches) {
            cache.clear();
        }
        this.emit('allCachesCleared');
    }

    /**
     * Obtiene estadísticas globales
     */
    getStats() {
        const cacheStats = {};
        for (const [name, cache] of this.caches) {
            cacheStats[name] = cache.getStats();
        }
        
        return {
            global: this.stats,
            caches: cacheStats,
            totalCaches: this.caches.size
        };
    }

    /**
     * Inicia el timer de limpieza automática
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    /**
     * Detiene el timer de limpieza
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Ejecuta limpieza de elementos expirados
     */
    cleanup() {
        let totalCleaned = 0;
        for (const [name, cache] of this.caches) {
            totalCleaned += cache.cleanup();
        }
        
        if (totalCleaned > 0) {
            this.emit('cleanup', { itemsCleaned: totalCleaned });
        }
    }

    /**
     * Actualiza estadísticas globales
     */
    updateStats(operation) {
        if (this.stats[operation] !== undefined) {
            this.stats[operation]++;
        }
    }
}

class Cache {
    constructor(options) {
        this.name = options.name;
        this.ttl = options.ttl;
        this.maxSize = options.maxSize;
        this.manager = options.manager;
        this.data = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
    }

    /**
     * Obtiene un valor del caché
     */
    get(key) {
        const item = this.data.get(key);
        
        if (!item) {
            this.stats.misses++;
            this.manager.updateStats('misses');
            return null;
        }

        if (this.isExpired(item)) {
            this.data.delete(key);
            this.stats.misses++;
            this.manager.updateStats('misses');
            return null;
        }

        this.stats.hits++;
        this.manager.updateStats('hits');
        item.lastAccessed = Date.now();
        return item.value;
    }

    /**
     * Establece un valor en el caché
     */
    set(key, value, customTTL = null) {
        const ttl = customTTL || this.ttl;
        const now = Date.now();
        
        // Verificar si necesitamos hacer espacio
        if (this.data.size >= this.maxSize && !this.data.has(key)) {
            this.evictLRU();
        }

        const item = {
            value,
            createdAt: now,
            lastAccessed: now,
            expiresAt: now + ttl
        };

        this.data.set(key, item);
        this.stats.sets++;
        this.manager.updateStats('sets');
        
        this.manager.emit('cacheSet', {
            cache: this.name,
            key,
            ttl
        });

        return true;
    }

    /**
     * Elimina un valor del caché
     */
    delete(key) {
        const deleted = this.data.delete(key);
        if (deleted) {
            this.stats.deletes++;
            this.manager.updateStats('deletes');
            this.manager.emit('cacheDelete', {
                cache: this.name,
                key
            });
        }
        return deleted;
    }

    /**
     * Verifica si un elemento ha expirado
     */
    isExpired(item) {
        return Date.now() > item.expiresAt;
    }

    /**
     * Elimina el elemento menos recientemente usado
     */
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, item] of this.data) {
            if (item.lastAccessed < oldestTime) {
                oldestTime = item.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.data.delete(oldestKey);
            this.stats.evictions++;
            this.manager.updateStats('evictions');
            this.manager.emit('cacheEviction', {
                cache: this.name,
                key: oldestKey
            });
        }
    }

    /**
     * Limpia elementos expirados
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.data) {
            if (now > item.expiresAt) {
                this.data.delete(key);
                cleaned++;
            }
        }

        return cleaned;
    }

    /**
     * Limpia toda la caché
     */
    clear() {
        this.data.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
    }

    /**
     * Obtiene estadísticas de la caché
     */
    getStats() {
        return {
            ...this.stats,
            size: this.data.size,
            maxSize: this.maxSize,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
        };
    }

    /**
     * Verifica si existe una clave
     */
    has(key) {
        const item = this.data.get(key);
        if (!item) return false;
        
        if (this.isExpired(item)) {
            this.data.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * Obtiene todas las claves válidas
     */
    keys() {
        const validKeys = [];
        const now = Date.now();
        
        for (const [key, item] of this.data) {
            if (now <= item.expiresAt) {
                validKeys.push(key);
            }
        }
        
        return validKeys;
    }
}

// Instancia singleton del gestor de caché
const cacheManager = new CacheManager();

export {
    CacheManager,
    Cache,
    cacheManager
};

export default CacheManager;
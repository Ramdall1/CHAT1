// 360Dialog Enhanced Module
console.log('360Dialog Enhanced module loaded');

// 360Dialog API Integration
const Dialog360API = {
    baseUrl: '/api/360dialog',
    cache: new Map(),
    cacheKey: '360dialog_templates_cache',
    cacheTTL: 5 * 60 * 1000, // 5 minutos en millisegundos
    lastCacheUpdate: null,
    
    // Inicializar cache desde localStorage
    initCache() {
        try {
            const cachedData = localStorage.getItem(this.cacheKey);
            if (cachedData) {
                const { templates, timestamp } = JSON.parse(cachedData);
                const now = Date.now();
                
                // Verificar si el cache no ha expirado
                if (now - timestamp < this.cacheTTL) {
                    templates.forEach(template => {
                        this.cache.set(template.id, template);
                    });
                    this.lastCacheUpdate = timestamp;
                    console.log(`✅ Cache cargado desde localStorage: ${this.cache.size} plantillas`);
                    return true;
                } else {
                    console.log('⏰ Cache expirado, se limpiará');
                    localStorage.removeItem(this.cacheKey);
                }
            }
        } catch (error) {
            console.error('❌ Error cargando cache desde localStorage:', error);
            localStorage.removeItem(this.cacheKey);
        }
        return false;
    },
    
    // Guardar cache en localStorage
    saveCache() {
        try {
            const templates = Array.from(this.cache.values());
            const cacheData = {
                templates,
                timestamp: Date.now()
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
            this.lastCacheUpdate = cacheData.timestamp;
            console.log('💾 Cache guardado en localStorage');
        } catch (error) {
            console.error('❌ Error guardando cache:', error);
        }
    },
    
    // Verificar si el cache necesita actualización
    needsCacheUpdate() {
        if (!this.lastCacheUpdate) return true;
        return (Date.now() - this.lastCacheUpdate) > this.cacheTTL;
    },

    async getStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/status`);
            if (response.status === 429) {
                console.warn('⚠️ Rate limit alcanzado para status');
                return { message: 'Rate limit activo', status: 'limited' };
            }
            if (response.ok) {
                const data = await response.json();
                console.log('✅ 360Dialog Status:', data);
                // Normalizar respuesta para compatibilidad
                return {
                    success: data.success || true,
                    message: data.data?.message || data.message || 'Servicio disponible',
                    status: data.data?.status || data.status || 'available',
                    ...data
                };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Error getting 360Dialog status:', error);
            throw error;
        }
    },
    
    async getTemplates(forceRefresh = false) {
        // Si no se fuerza la actualización y tenemos cache válido, usarlo
        if (!forceRefresh && !this.needsCacheUpdate() && this.cache.size > 0) {
            console.log('📋 Usando plantillas desde cache local');
            return {
                success: true,
                templates: Array.from(this.cache.values()),
                source: 'cache'
            };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/templates`);
            if (response.status === 429) {
                console.warn('⚠️ Rate limit alcanzado para templates, usando cache');
                if (this.cache.size > 0) {
                    return {
                        success: true,
                        templates: Array.from(this.cache.values()),
                        source: 'cache_fallback'
                    };
                }
                throw new Error('Rate limit alcanzado y no hay cache disponible');
            }
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔄 360Dialog Templates actualizadas desde API:', data);
                
                // Actualizar cache si hay plantillas (compatible con ambas estructuras)
                const templates = data.data || data.templates || [];
                if (Array.isArray(templates)) {
                    this.updateCache(templates);
                    
                    // Notificar actualización exitosa
                    if (window.NotificationSystem) {
                        window.NotificationSystem.dialog360Update(
                            `${templates.length} plantillas actualizadas`,
                            'success'
                        );
                    }
                }
                
                // Normalizar respuesta para compatibilidad
                return {
                    success: data.success || true,
                    templates: templates,
                    source: 'api'
                };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Error getting 360Dialog templates:', error);
            
            // Notificar error
            if (window.NotificationSystem) {
                window.NotificationSystem.dialog360Update(
                    `Error conectando con 360Dialog: ${error.message}`,
                    'error'
                );
            }
            
            // Fallback al cache si hay error
            if (this.cache.size > 0) {
                console.log('🔄 Usando cache como fallback');
                
                // Notificar uso de cache
                if (window.NotificationSystem) {
                    window.NotificationSystem.cacheUpdate(
                        'Usando plantillas desde cache local',
                        'warning'
                    );
                }
                
                return {
                    success: true,
                    templates: Array.from(this.cache.values()),
                    source: 'cache_fallback'
                };
            }
            
            throw error;
        }
    },
    
    // Actualizar cache con nuevas plantillas
    updateCache(templates) {
        this.cache.clear();
        templates.forEach(template => {
            this.cache.set(template.id, template);
        });
        this.saveCache();
        console.log(`✅ Cache actualizado: ${this.cache.size} plantillas`);
        
        // Notificar actualización de cache
        if (window.NotificationSystem) {
            window.NotificationSystem.cacheUpdate(
                `Cache actualizado: ${this.cache.size} plantillas`,
                'success'
            );
        }
    },
    
    async loadTemplateCache(forceRefresh = false) {
        try {
            const templates = await this.getTemplates(forceRefresh);
            return this.cache;
        } catch (error) {
            console.error('❌ Error loading template cache:', error);
            return this.cache;
        }
    },
    
    getTemplateFromCache(templateId) {
        return this.cache.get(templateId) || null;
    },
    
    getAllTemplatesFromCache() {
        return Array.from(this.cache.values());
    },
    
    // Limpiar cache manualmente
    clearCache() {
        this.cache.clear();
        localStorage.removeItem(this.cacheKey);
        this.lastCacheUpdate = null;
        console.log('🗑️ Cache limpiado');
        
        // Notificar limpieza de cache
        if (window.NotificationSystem) {
            window.NotificationSystem.cacheUpdate(
                'Cache limpiado completamente',
                'info'
            );
        }
    },
    
    // Obtener estadísticas del cache
    getCacheStats() {
        return {
            size: this.cache.size,
            lastUpdate: this.lastCacheUpdate,
            isExpired: this.needsCacheUpdate(),
            ttl: this.cacheTTL
        };
    }
};

// Status Display Module
const StatusDisplay = {
    async updateStatus() {
        try {
            const statusElement = document.getElementById('360dialog-status');
            if (statusElement) {
                statusElement.innerHTML = '<span class="text-warning">🔄 Verificando...</span>';
                
                const status = await Dialog360API.getStatus();
                if (status && status.message) {
                    const statusClass = status.status === 'limited' ? 'text-warning' : 'text-success';
                    statusElement.innerHTML = `<span class="${statusClass}">✅ ${status.message}</span>`;
                } else {
                    statusElement.innerHTML = '<span class="text-danger">❌ Error en la respuesta</span>';
                }
            }
        } catch (error) {
            console.error('Error updating status:', error);
            const statusElement = document.getElementById('360dialog-status');
            if (statusElement) {
                statusElement.innerHTML = '<span class="text-danger">❌ Error de conexión</span>';
            }
        }
    }
};

// Inicialización mejorada con cache
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando 360Dialog Enhanced...');
    
    // Inicializar cache desde localStorage
    const cacheLoaded = Dialog360API.initCache();
    
    if (cacheLoaded) {
        console.log('📋 Cache cargado exitosamente');
        // Si hay cache, cargar plantillas inmediatamente
        if (window.TemplateBuilder && typeof window.TemplateBuilder.renderTemplates === 'function') {
            const templates = Dialog360API.getAllTemplatesFromCache();
            window.TemplateBuilder.renderTemplates(templates);
        }
    }
    
    // Actualizar status
    await StatusDisplay.updateStatus();
    
    // Cargar plantillas (usará cache si está disponible y válido)
    try {
        await Dialog360API.loadTemplateCache();
        console.log('✅ Sistema 360Dialog inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando sistema 360Dialog:', error);
    }
});

// Exportar funciones globales
window.Dialog360API = Dialog360API;
window.StatusDisplay = StatusDisplay;
window.loadTemplateCache = (forceRefresh = false) => Dialog360API.loadTemplateCache(forceRefresh);
window.clearTemplateCache = () => Dialog360API.clearCache();
window.getCacheStats = () => Dialog360API.getCacheStats();
// Builder Module - Template Builder
console.log('Builder module loaded');

// Template Builder functionality
const TemplateBuilder = {
    templates: [],
    isLoading: false,
    
    async loadTemplates(forceRefresh = false) {
        if (this.isLoading) {
            console.log('⏳ Carga de plantillas ya en progreso...');
            return this.templates;
        }
        
        this.isLoading = true;
        this.showLoadingIndicator();
        
        try {
            // Usar el sistema de cache de Dialog360API si está disponible
            if (window.Dialog360API && typeof window.Dialog360API.getTemplates === 'function') {
                console.log('🔄 Cargando plantillas con sistema de cache...');
                const data = await window.Dialog360API.getTemplates(forceRefresh);
                
                // Compatibilidad con ambas estructuras: data.templates y data.data
                const templates = data && (data.templates || data.data);
                if (templates && Array.isArray(templates)) {
                    this.templates = templates;
                    const source = data.source || 'api';
                    console.log(`✅ Plantillas cargadas desde: ${source} (${this.templates.length} plantillas)`);
                    
                    // Mostrar indicador de fuente
                    this.showSourceIndicator(source);
                } else {
                    this.templates = [];
                    console.warn('⚠️ No se recibieron plantillas válidas');
                }
            } else {
                // Fallback al método original
                console.log('🔄 Cargando plantillas (método fallback)...');
                const response = await fetch('/api/360dialog/templates');
                if (response.ok) {
                    const data = await response.json();
                    // Compatibilidad con ambas estructuras: data.data y data.templates
                    this.templates = data.data || data.templates || [];
                    console.log('✅ Plantillas cargadas:', this.templates.length);
                } else {
                    console.warn('⚠️ Error cargando plantillas:', response.status);
                    this.templates = [];
                }
            }
            
            return this.templates;
        } catch (error) {
            console.error('❌ Error loading templates:', error);
            
            // Intentar usar cache como fallback
            if (window.Dialog360API && typeof window.Dialog360API.getAllTemplatesFromCache === 'function') {
                this.templates = window.Dialog360API.getAllTemplatesFromCache();
                if (this.templates.length > 0) {
                    console.log('🔄 Usando cache como fallback:', this.templates.length);
                    this.showSourceIndicator('cache_fallback');
                }
            }
            
            return this.templates;
        } finally {
            this.isLoading = false;
            this.hideLoadingIndicator();
        }
    },
    
    renderTemplates(templates = null) {
        const container = document.getElementById('templates-container');
        if (!container) return;
        
        const templatesToRender = templates || this.templates;
        
        if (templatesToRender.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    No hay plantillas disponibles
                </div>
            `;
            return;
        }
        
        container.innerHTML = templatesToRender.map(template => `
            <div class="template-card card mb-3 shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="card-title">
                                <i class="fas fa-file-alt text-primary"></i>
                                ${template.name}
                            </h5>
                            <p class="card-text text-muted">
                                <small><strong>ID:</strong> ${template.id}</small>
                            </p>
                            <p class="card-text">
                                <i class="fas fa-language"></i>
                                <strong>Idioma:</strong> ${template.language}
                            </p>
                        </div>
                        <span class="badge bg-success fs-6">
                            <i class="fas fa-check-circle"></i>
                            ${template.status}
                        </span>
                    </div>
                    ${template.category ? `
                        <div class="mt-2">
                            <span class="badge bg-secondary">
                                <i class="fas fa-tag"></i>
                                ${template.category}
                            </span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        console.log(`📋 Renderizadas ${templatesToRender.length} plantillas`);
    },
    
    showLoadingIndicator() {
        const container = document.getElementById('templates-container');
        if (container) {
            container.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2 text-muted">Cargando plantillas...</p>
                </div>
            `;
        }
    },
    
    hideLoadingIndicator() {
        // El indicador se oculta automáticamente al renderizar las plantillas
    },
    
    showSourceIndicator(source) {
        const sourceMessages = {
            'cache': '📋 Cargado desde cache local',
            'cache_fallback': '🔄 Usando cache (API no disponible)',
            'api': '🌐 Actualizado desde API'
        };
        
        const message = sourceMessages[source] || '✅ Plantillas cargadas';
        
        // Mostrar notificación temporal
        this.showNotification(message, source === 'api' ? 'success' : 'info');
    },
    
    showNotification(message, type = 'info') {
        // Usar la función global de notificaciones si está disponible
        if (window.chatLiveManager && window.chatLiveManager.showNotification) {
            window.chatLiveManager.showNotification('Plantillas', message);
        } else {
            // Fallback a Bootstrap si no está disponible
            const notification = document.createElement('div');
            notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
            notification.style.cssText = 'top: 20px; right: 20px; z-index: 1050; max-width: 300px;';
            notification.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            document.body.appendChild(notification);
            
            // Auto-remover después de 3 segundos
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 3000);
        }
    },
    
    // Método para refrescar plantillas forzadamente
    async refreshTemplates() {
        console.log('🔄 Refrescando plantillas...');
        await this.loadTemplates(true);
        this.renderTemplates();
    },

    // Método para forzar actualización desde API (sin cache)
    async forceRefreshFromAPI() {
        console.log('🌐 Forzando actualización desde API...');
        this.showLoadingIndicator();
        
        try {
            // Limpiar cache primero
            if (window.Dialog360API && typeof window.Dialog360API.clearCache === 'function') {
                window.Dialog360API.clearCache();
            }
            
            // Cargar directamente desde API
            const response = await fetch('/api/360dialog/templates');
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            // Compatibilidad con ambas estructuras: data.data y data.templates
            const templates = data.data || data.templates;
            if (templates && Array.isArray(templates)) {
                this.templates = templates;
                
                // Actualizar cache con nuevos datos
                if (window.Dialog360API && typeof window.Dialog360API.updateCache === 'function') {
                    window.Dialog360API.updateCache(this.templates);
                }
                
                this.renderTemplates();
                console.log('✅ Plantillas actualizadas forzadamente desde API');
                this.showNotification('Plantillas actualizadas desde API', 'success');
            } else {
                throw new Error('Respuesta inválida de la API');
            }
        } catch (error) {
            console.error('❌ Error forzando actualización:', error);
            this.showNotification(`Error forzando actualización: ${error.message}`, 'danger');
        } finally {
            this.hideLoadingIndicator();
        }
    },
    
    // Obtener estadísticas del cache
    getCacheInfo() {
        if (window.Dialog360API && typeof window.Dialog360API.getCacheStats === 'function') {
            return window.Dialog360API.getCacheStats();
        }
        return null;
    }
};

// Initialize template builder
async function initTemplateBuilder() {
    console.log('🚀 Inicializando constructor de plantillas...');
    try {
        await TemplateBuilder.loadTemplates();
        TemplateBuilder.renderTemplates();
        console.log('✅ Constructor de plantillas inicializado');
    } catch (error) {
        console.error('❌ Error inicializando constructor de plantillas:', error);
    }
}

// Auto-inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initTemplateBuilder);

// Exportar para acceso global
window.TemplateBuilder = TemplateBuilder;
window.initTemplateBuilder = initTemplateBuilder;
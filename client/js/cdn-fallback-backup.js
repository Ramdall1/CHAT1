// CDN Fallback Manager - Maneja la carga de recursos externos con fallbacks locales
console.log('🔗 CDN Fallback Manager cargado');

class CDNFallbackManager {
    constructor() {
        this.loadedResources = new Set();
        this.failedResources = new Set();
        this.retryAttempts = new Map();
        this.maxRetries = 2;
        this.timeout = 5000; // 5 segundos
    }

    // Verificar si un CSS está cargado
    isCSSLoaded(href) {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        for (let link of links) {
            if (link.href.includes(href) && link.sheet) {
                try {
                    // Intentar acceder a las reglas CSS
                    return link.sheet.cssRules.length > 0;
                } catch (e) {
                    return false;
                }
            }
        }
        return false;
    }

    // Verificar si un JS está cargado
    isJSLoaded(src, testFunction) {
        if (testFunction && typeof window[testFunction] !== 'undefined') {
            return true;
        }
        const scripts = document.querySelectorAll('script[src]');
        for (let script of scripts) {
            if (script.src.includes(src)) {
                return script.readyState === 'complete' || script.readyState === 'loaded';
            }
        }
        return false;
    }

    // Cargar CSS con fallback
    async loadCSS(cdnUrl, fallbackUrl = null, id = null) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cdnUrl;
            if (id) link.id = id;

            const timeout = setTimeout(() => {
                console.warn(`⚠️ Timeout cargando CSS: ${cdnUrl}`);
                if (fallbackUrl) {
                    this.loadFallbackCSS(fallbackUrl, id).then(resolve).catch(reject);
                } else {
                    reject(new Error(`Timeout loading CSS: ${cdnUrl}`));
                }
            }, this.timeout);

            link.onload = () => {
                clearTimeout(timeout);
                console.log(`✅ CSS cargado exitosamente: ${cdnUrl}`);
                this.loadedResources.add(cdnUrl);
                resolve(link);
            };

            link.onerror = () => {
                clearTimeout(timeout);
                console.error(`❌ Error cargando CSS: ${cdnUrl}`);
                this.failedResources.add(cdnUrl);
                if (fallbackUrl) {
                    this.loadFallbackCSS(fallbackUrl, id).then(resolve).catch(reject);
                } else {
                    reject(new Error(`Failed to load CSS: ${cdnUrl}`));
                }
            };

            document.head.appendChild(link);
        });
    }

    // Cargar CSS de fallback
    async loadFallbackCSS(fallbackUrl, id = null) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = fallbackUrl;
            if (id) link.id = id + '-fallback';

            link.onload = () => {
                console.log(`✅ CSS fallback cargado: ${fallbackUrl}`);
                resolve(link);
            };

            link.onerror = () => {
                console.error(`❌ Error cargando CSS fallback: ${fallbackUrl}`);
                reject(new Error(`Failed to load fallback CSS: ${fallbackUrl}`));
            };

            document.head.appendChild(link);
        });
    }

    // Cargar JS con fallback
    async loadJS(cdnUrl, fallbackUrl = null, testFunction = null) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = cdnUrl;
            script.async = true;

            const timeout = setTimeout(() => {
                console.warn(`⚠️ Timeout cargando JS: ${cdnUrl}`);
                if (fallbackUrl) {
                    this.loadFallbackJS(fallbackUrl, testFunction).then(resolve).catch(reject);
                } else {
                    reject(new Error(`Timeout loading JS: ${cdnUrl}`));
                }
            }, this.timeout);

            script.onload = () => {
                clearTimeout(timeout);
                // Verificar si la función de test existe
                if (testFunction && typeof window[testFunction] === 'undefined') {
                    console.warn(`⚠️ Función de test no encontrada: ${testFunction}`);
                    if (fallbackUrl) {
                        this.loadFallbackJS(fallbackUrl, testFunction).then(resolve).catch(reject);
                        return;
                    }
                }
                console.log(`✅ JS cargado exitosamente: ${cdnUrl}`);
                this.loadedResources.add(cdnUrl);
                resolve(script);
            };

            script.onerror = () => {
                clearTimeout(timeout);
                console.error(`❌ Error cargando JS: ${cdnUrl}`);
                this.failedResources.add(cdnUrl);
                if (fallbackUrl) {
                    this.loadFallbackJS(fallbackUrl, testFunction).then(resolve).catch(reject);
                } else {
                    reject(new Error(`Failed to load JS: ${cdnUrl}`));
                }
            };

            document.head.appendChild(script);
        });
    }

    // Cargar JS de fallback
    async loadFallbackJS(fallbackUrl, testFunction = null) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = fallbackUrl;
            script.async = true;

            script.onload = () => {
                console.log(`✅ JS fallback cargado: ${fallbackUrl}`);
                resolve(script);
            };

            script.onerror = () => {
                console.error(`❌ Error cargando JS fallback: ${fallbackUrl}`);
                reject(new Error(`Failed to load fallback JS: ${fallbackUrl}`));
            };

            document.head.appendChild(script);
        });
    }

    // Verificar estado de recursos críticos
    async checkCriticalResources() {
        const checks = [];

        // Verificar Bootstrap
        if (!this.isCSSLoaded('bootstrap')) {
            console.warn('⚠️ Bootstrap CSS no detectado, cargando fallback...');
            checks.push(this.loadCSS('', 'css/bootstrap-fallback.css', 'bootstrap-fallback'));
        }

        // Verificar FontAwesome
        if (!this.isCSSLoaded('font-awesome') && !this.isCSSLoaded('fontawesome')) {
            console.warn('⚠️ FontAwesome no detectado');
            // Podríamos cargar un fallback de iconos aquí
        }

        // Verificar Chart.js
        if (!this.isJSLoaded('chart.js', 'Chart')) {
            console.warn('⚠️ Chart.js no detectado');
            // El sistema puede funcionar sin Chart.js
        }

        if (checks.length > 0) {
            try {
                await Promise.all(checks);
                console.log('✅ Recursos críticos verificados y fallbacks cargados');
            } catch (error) {
                console.error('❌ Error cargando recursos críticos:', error);
            }
        }
    }

    // Obtener estadísticas de carga
    getStats() {
        return {
            loaded: Array.from(this.loadedResources),
            failed: Array.from(this.failedResources),
            loadedCount: this.loadedResources.size,
            failedCount: this.failedResources.size
        };
    }

    // Mostrar notificación de estado de CDN
    showCDNStatus() {
        const stats = this.getStats();
        if (stats.failedCount > 0) {
            console.warn(`⚠️ ${stats.failedCount} recursos CDN fallaron, usando fallbacks locales`);
            
            // Mostrar notificación visual si existe el sistema de notificaciones
            if (window.showNotification) {
                window.showNotification(
                    `Algunos recursos externos no están disponibles. Usando versiones locales.`,
                    'warning'
                );
            }
        } else {
            console.log('✅ Todos los recursos CDN cargados correctamente');
        }
    }
}

// Crear instancia global
window.CDNFallbackManager = new CDNFallbackManager();

// Verificar recursos críticos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔍 Verificando recursos críticos...');
    await window.CDNFallbackManager.checkCriticalResources();
    
    // Mostrar estado después de un breve delay
    setTimeout(() => {
        window.CDNFallbackManager.showCDNStatus();
    }, 1000);
});

// CDNFallbackManager está disponible globalmente como window.CDNFallbackManager
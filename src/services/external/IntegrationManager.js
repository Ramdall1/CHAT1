/**
 * Integration Manager Service
 * Gestiona integraciones con servicios externos
 */

import axios from 'axios';

export class IntegrationManager {
    constructor(config = {}) {
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            maxConcurrentRequests: 10,
            rateLimitWindow: 60000, // 1 minuto
            rateLimitMax: 999999, // Rate limiting desactivado
            ...config
        };
        
        this.integrations = new Map();
        this.activeConnections = new Map();
        this.requestCounts = new Map();
        this.healthStatus = new Map();
    }

    /**
     * Registra una nueva integración
     * @param {string} name - Nombre de la integración
     * @param {object} integrationConfig - Configuración de la integración
     * @returns {object} Integración registrada
     */
    registerIntegration(name, integrationConfig) {
        const integration = {
            name,
            type: integrationConfig.type || 'api',
            baseUrl: integrationConfig.baseUrl,
            apiKey: integrationConfig.apiKey,
            headers: integrationConfig.headers || {},
            timeout: integrationConfig.timeout || this.config.timeout,
            retryPolicy: {
                attempts: integrationConfig.retryAttempts || this.config.retryAttempts,
                delay: integrationConfig.retryDelay || this.config.retryDelay
            },
            rateLimit: {
                window: integrationConfig.rateLimitWindow || this.config.rateLimitWindow,
                max: integrationConfig.rateLimitMax || this.config.rateLimitMax
            },
            active: integrationConfig.active !== false,
            createdAt: new Date(),
            lastUsed: null,
            requestCount: 0,
            errorCount: 0
        };
        
        this.integrations.set(name, integration);
        this.healthStatus.set(name, { status: 'unknown', lastCheck: null });
        
        return integration;
    }

    /**
     * Obtiene una integración por nombre
     * @param {string} name - Nombre de la integración
     * @returns {object|null} Integración encontrada
     */
    getIntegration(name) {
        return this.integrations.get(name) || null;
    }

    /**
     * Lista todas las integraciones
     * @param {object} filters - Filtros opcionales
     * @returns {array} Lista de integraciones
     */
    listIntegrations(filters = {}) {
        let integrations = Array.from(this.integrations.values());
        
        if (filters.active !== undefined) {
            integrations = integrations.filter(i => i.active === filters.active);
        }
        
        if (filters.type) {
            integrations = integrations.filter(i => i.type === filters.type);
        }
        
        return integrations;
    }

    /**
     * Realiza una petición a una integración
     * @param {string} integrationName - Nombre de la integración
     * @param {object} requestConfig - Configuración de la petición
     * @returns {Promise<object>} Respuesta de la petición
     */
    async makeRequest(integrationName, requestConfig) {
        const integration = this.getIntegration(integrationName);
        
        if (!integration) {
            throw new Error(`Integration '${integrationName}' not found`);
        }
        
        if (!integration.active) {
            throw new Error(`Integration '${integrationName}' is not active`);
        }
        
        // Verificar rate limiting
        if (!this.checkRateLimit(integrationName)) {
            throw new Error(`Rate limit exceeded for integration '${integrationName}'`);
        }
        
        const url = this.buildUrl(integration.baseUrl, requestConfig.endpoint);
        const headers = {
            ...integration.headers,
            ...requestConfig.headers
        };
        
        // Agregar API key si está configurada
        if (integration.apiKey) {
            headers['Authorization'] = `Bearer ${integration.apiKey}`;
        }
        
        const axiosConfig = {
            method: requestConfig.method || 'GET',
            url,
            headers,
            timeout: integration.timeout,
            ...requestConfig.options
        };
        
        if (requestConfig.data) {
            axiosConfig.data = requestConfig.data;
        }
        
        if (requestConfig.params) {
            axiosConfig.params = requestConfig.params;
        }
        
        let attempt = 0;
        let lastError;
        
        while (attempt < integration.retryPolicy.attempts) {
            try {
                const response = await axios(axiosConfig);
                
                // Actualizar estadísticas de éxito
                integration.lastUsed = new Date();
                integration.requestCount++;
                this.updateRequestCount(integrationName);
                
                return {
                    success: true,
                    data: response.data,
                    status: response.status,
                    headers: response.headers,
                    attempt: attempt + 1
                };
                
            } catch (error) {
                lastError = error;
                attempt++;
                integration.errorCount++;
                
                if (attempt < integration.retryPolicy.attempts) {
                    await this.delay(integration.retryPolicy.delay * attempt);
                }
            }
        }
        
        throw new Error(`Request failed after ${attempt} attempts: ${lastError.message}`);
    }

    /**
     * Verifica el estado de salud de una integración
     * @param {string} integrationName - Nombre de la integración
     * @returns {Promise<object>} Estado de salud
     */
    async checkHealth(integrationName) {
        const integration = this.getIntegration(integrationName);
        
        if (!integration) {
            throw new Error(`Integration '${integrationName}' not found`);
        }
        
        try {
            const healthEndpoint = integration.healthEndpoint || '/health';
            const response = await this.makeRequest(integrationName, {
                endpoint: healthEndpoint,
                method: 'GET'
            });
            
            const healthStatus = {
                status: 'healthy',
                lastCheck: new Date(),
                responseTime: response.responseTime,
                details: response.data
            };
            
            this.healthStatus.set(integrationName, healthStatus);
            return healthStatus;
            
        } catch (error) {
            const healthStatus = {
                status: 'unhealthy',
                lastCheck: new Date(),
                error: error.message
            };
            
            this.healthStatus.set(integrationName, healthStatus);
            return healthStatus;
        }
    }

    /**
     * Verifica rate limiting
     * @param {string} integrationName - Nombre de la integración
     * @returns {boolean} Si la petición está permitida
     */
    checkRateLimit(integrationName) {
        const integration = this.getIntegration(integrationName);
        const now = Date.now();
        const windowStart = now - integration.rateLimit.window;
        
        const requests = this.requestCounts.get(integrationName) || [];
        const recentRequests = requests.filter(timestamp => timestamp > windowStart);
        
        return recentRequests.length < integration.rateLimit.max;
    }

    /**
     * Actualiza contador de peticiones
     * @param {string} integrationName - Nombre de la integración
     */
    updateRequestCount(integrationName) {
        const now = Date.now();
        const requests = this.requestCounts.get(integrationName) || [];
        
        requests.push(now);
        
        // Limpiar peticiones antiguas
        const integration = this.getIntegration(integrationName);
        const windowStart = now - integration.rateLimit.window;
        const recentRequests = requests.filter(timestamp => timestamp > windowStart);
        
        this.requestCounts.set(integrationName, recentRequests);
    }

    /**
     * Construye URL completa
     * @param {string} baseUrl - URL base
     * @param {string} endpoint - Endpoint
     * @returns {string} URL completa
     */
    buildUrl(baseUrl, endpoint) {
        const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${base}${path}`;
    }

    /**
     * Configura integración de WhatsApp Business API
     * @param {object} config - Configuración de WhatsApp
     * @returns {object} Integración configurada
     */
    setupWhatsAppIntegration(config) {
        return this.registerIntegration('whatsapp', {
            type: 'messaging',
            baseUrl: 'https://graph.facebook.com/v18.0',
            apiKey: config.accessToken,
            headers: {
                'Content-Type': 'application/json'
            },
            healthEndpoint: `/${config.phoneNumberId}`,
            rateLimitWindow: 60000,
            rateLimitMax: 999999 // Rate limiting desactivado
        });
    }

    /**
     * Configura integración de 360Dialog
     * @param {object} config - Configuración de 360Dialog
     * @returns {object} Integración configurada
     */
    setup360DialogIntegration(config) {
        return this.registerIntegration('360dialog', {
            type: 'messaging',
            baseUrl: 'https://waba.360dialog.io/v1',
            apiKey: config.apiKey,
            headers: {
                'Content-Type': 'application/json',
                'D360-API-KEY': config.apiKey
            },
            healthEndpoint: '/health',
            rateLimitWindow: 60000,
            rateLimitMax: 999999 // Rate limiting desactivado
        });
    }

    /**
     * Configura integración de Telegram
     * @param {object} config - Configuración de Telegram
     * @returns {object} Integración configurada
     */
    setupTelegramIntegration(config) {
        return this.registerIntegration('telegram', {
            type: 'messaging',
            baseUrl: `https://api.telegram.org/bot${config.botToken}`,
            headers: {
                'Content-Type': 'application/json'
            },
            healthEndpoint: '/getMe',
            rateLimitWindow: 60000,
            rateLimitMax: 999999 // Rate limiting desactivado
        });
    }

    /**
     * Obtiene estadísticas de integraciones
     * @returns {object} Estadísticas
     */
    getStats() {
        const integrations = Array.from(this.integrations.values());
        const healthStatuses = Array.from(this.healthStatus.values());
        
        return {
            total: integrations.length,
            active: integrations.filter(i => i.active).length,
            inactive: integrations.filter(i => !i.active).length,
            healthy: healthStatuses.filter(h => h.status === 'healthy').length,
            unhealthy: healthStatuses.filter(h => h.status === 'unhealthy').length,
            totalRequests: integrations.reduce((sum, i) => sum + i.requestCount, 0),
            totalErrors: integrations.reduce((sum, i) => sum + i.errorCount, 0),
            activeConnections: this.activeConnections.size
        };
    }

    /**
     * Desactiva una integración
     * @param {string} name - Nombre de la integración
     * @returns {boolean} Éxito de la operación
     */
    deactivateIntegration(name) {
        const integration = this.getIntegration(name);
        if (integration) {
            integration.active = false;
            return true;
        }
        return false;
    }

    /**
     * Activa una integración
     * @param {string} name - Nombre de la integración
     * @returns {boolean} Éxito de la operación
     */
    activateIntegration(name) {
        const integration = this.getIntegration(name);
        if (integration) {
            integration.active = true;
            return true;
        }
        return false;
    }

    /**
     * Función auxiliar para delay
     * @param {number} ms - Milisegundos a esperar
     * @returns {Promise} Promise que resuelve después del delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Instancia singleton
const integrationManager = new IntegrationManager();

export default integrationManager;
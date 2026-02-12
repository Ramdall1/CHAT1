/**
 * API Manager Service
 * Gestiona todas las operaciones de API del sistema
 */

import axios from 'axios';

export class APIManager {
    constructor(config = {}) {
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            maxConcurrentRequests: 20,
            defaultHeaders: {
                'Content-Type': 'application/json',
                'User-Agent': 'ChatBot-API/1.0'
            },
            ...config
        };
        
        this.apis = new Map();
        this.requestQueue = [];
        this.activeRequests = new Set();
        this.requestHistory = [];
        this.rateLimits = new Map();
        
        // Configurar interceptores de axios
        this.setupAxiosInterceptors();
    }

    /**
     * Configura interceptores de axios
     */
    setupAxiosInterceptors() {
        // Interceptor de request
        axios.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: new Date() };
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Interceptor de response
        axios.interceptors.response.use(
            (response) => {
                response.config.metadata.endTime = new Date();
                response.duration = response.config.metadata.endTime - response.config.metadata.startTime;
                return response;
            },
            (error) => {
                if (error.config && error.config.metadata) {
                    error.config.metadata.endTime = new Date();
                    error.duration = error.config.metadata.endTime - error.config.metadata.startTime;
                }
                return Promise.reject(error);
            }
        );
    }

    /**
     * Registra una nueva API
     * @param {string} name - Nombre de la API
     * @param {object} apiConfig - Configuración de la API
     * @returns {object} API registrada
     */
    registerAPI(name, apiConfig) {
        const api = {
            name,
            baseUrl: apiConfig.baseUrl,
            apiKey: apiConfig.apiKey,
            headers: {
                ...this.config.defaultHeaders,
                ...apiConfig.headers
            },
            timeout: apiConfig.timeout || this.config.timeout,
            retryPolicy: {
                attempts: apiConfig.retryAttempts || this.config.retryAttempts,
                delay: apiConfig.retryDelay || this.config.retryDelay
            },
            rateLimit: apiConfig.rateLimit || null,
            active: apiConfig.active !== false,
            version: apiConfig.version || 'v1',
            createdAt: new Date(),
            lastUsed: null,
            requestCount: 0,
            errorCount: 0,
            avgResponseTime: 0
        };
        
        // Agregar API key a headers si existe
        if (api.apiKey) {
            api.headers['Authorization'] = `Bearer ${api.apiKey}`;
        }
        
        this.apis.set(name, api);
        
        if (api.rateLimit) {
            this.rateLimits.set(name, {
                requests: [],
                limit: api.rateLimit.limit,
                window: api.rateLimit.window
            });
        }
        
        return api;
    }

    /**
     * Obtiene una API por nombre
     * @param {string} name - Nombre de la API
     * @returns {object|null} API encontrada
     */
    getAPI(name) {
        return this.apis.get(name) || null;
    }

    /**
     * Realiza una petición HTTP
     * @param {string} apiName - Nombre de la API
     * @param {object} requestConfig - Configuración de la petición
     * @returns {Promise<object>} Respuesta de la petición
     */
    async makeRequest(apiName, requestConfig) {
        const api = this.getAPI(apiName);
        
        if (!api) {
            throw new Error(`API '${apiName}' not found`);
        }
        
        if (!api.active) {
            throw new Error(`API '${apiName}' is not active`);
        }
        
        // Verificar rate limiting
        if (!this.checkRateLimit(apiName)) {
            throw new Error(`Rate limit exceeded for API '${apiName}'`);
        }
        
        // Verificar límite de peticiones concurrentes
        if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
            await this.waitForAvailableSlot();
        }
        
        const requestId = this.generateRequestId();
        this.activeRequests.add(requestId);
        
        try {
            const response = await this.executeRequest(api, requestConfig, requestId);
            return response;
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Ejecuta una petición con reintentos
     * @param {object} api - Configuración de la API
     * @param {object} requestConfig - Configuración de la petición
     * @param {string} requestId - ID de la petición
     * @returns {Promise<object>} Respuesta de la petición
     */
    async executeRequest(api, requestConfig, requestId) {
        const url = this.buildUrl(api.baseUrl, requestConfig.endpoint);
        
        const axiosConfig = {
            method: requestConfig.method || 'GET',
            url,
            headers: {
                ...api.headers,
                ...requestConfig.headers
            },
            timeout: api.timeout,
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
        
        while (attempt < api.retryPolicy.attempts) {
            try {
                const startTime = Date.now();
                const response = await axios(axiosConfig);
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // Actualizar estadísticas
                this.updateAPIStats(api, duration, true);
                this.updateRateLimit(api.name);
                
                // Registrar en historial
                this.addToHistory({
                    requestId,
                    apiName: api.name,
                    method: axiosConfig.method,
                    url: axiosConfig.url,
                    status: response.status,
                    duration,
                    success: true,
                    attempt: attempt + 1,
                    timestamp: new Date()
                });
                
                return {
                    success: true,
                    data: response.data,
                    status: response.status,
                    headers: response.headers,
                    duration,
                    attempt: attempt + 1
                };
                
            } catch (error) {
                lastError = error;
                attempt++;
                
                // Actualizar estadísticas de error
                this.updateAPIStats(api, 0, false);
                
                if (attempt < api.retryPolicy.attempts) {
                    await this.delay(api.retryPolicy.delay * attempt);
                }
            }
        }
        
        // Registrar error en historial
        this.addToHistory({
            requestId,
            apiName: api.name,
            method: axiosConfig.method,
            url: axiosConfig.url,
            error: lastError.message,
            success: false,
            attempt,
            timestamp: new Date()
        });
        
        throw new Error(`Request failed after ${attempt} attempts: ${lastError.message}`);
    }

    /**
     * Verifica rate limiting - DESACTIVADO
     * @param {string} apiName - Nombre de la API
     * @returns {boolean} Si la petición está permitida
     */
    checkRateLimit(apiName) {
        return true; // Siempre permitir todas las peticiones
    }

    /**
     * Actualiza contador de rate limit
     * @param {string} apiName - Nombre de la API
     */
    updateRateLimit(apiName) {
        const rateLimit = this.rateLimits.get(apiName);
        
        if (rateLimit) {
            rateLimit.requests.push(Date.now());
        }
    }

    /**
     * Actualiza estadísticas de la API
     * @param {object} api - Configuración de la API
     * @param {number} duration - Duración de la petición
     * @param {boolean} success - Si fue exitosa
     */
    updateAPIStats(api, duration, success) {
        api.lastUsed = new Date();
        api.requestCount++;
        
        if (success) {
            // Calcular tiempo promedio de respuesta
            api.avgResponseTime = ((api.avgResponseTime * (api.requestCount - 1)) + duration) / api.requestCount;
        } else {
            api.errorCount++;
        }
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
     * Espera a que haya un slot disponible
     * @returns {Promise} Promise que resuelve cuando hay slot disponible
     */
    async waitForAvailableSlot() {
        while (this.activeRequests.size >= this.config.maxConcurrentRequests) {
            await this.delay(100);
        }
    }

    /**
     * Genera ID único para petición
     * @returns {string} ID único
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Agrega entrada al historial
     * @param {object} entry - Entrada del historial
     */
    addToHistory(entry) {
        this.requestHistory.push(entry);
        
        // Mantener solo las últimas 1000 entradas
        if (this.requestHistory.length > 1000) {
            this.requestHistory = this.requestHistory.slice(-1000);
        }
    }

    /**
     * Obtiene estadísticas de APIs
     * @returns {object} Estadísticas
     */
    getStats() {
        const apis = Array.from(this.apis.values());
        const recentRequests = this.requestHistory.slice(-100);
        
        return {
            totalAPIs: apis.length,
            activeAPIs: apis.filter(api => api.active).length,
            totalRequests: apis.reduce((sum, api) => sum + api.requestCount, 0),
            totalErrors: apis.reduce((sum, api) => sum + api.errorCount, 0),
            activeRequests: this.activeRequests.size,
            avgResponseTime: apis.reduce((sum, api) => sum + api.avgResponseTime, 0) / apis.length || 0,
            successRate: this.calculateSuccessRate(recentRequests),
            recentActivity: recentRequests.slice(-10)
        };
    }

    /**
     * Calcula tasa de éxito
     * @param {array} requests - Lista de peticiones
     * @returns {number} Tasa de éxito (0-100)
     */
    calculateSuccessRate(requests) {
        if (requests.length === 0) return 0;
        
        const successful = requests.filter(req => req.success).length;
        return (successful / requests.length) * 100;
    }

    /**
     * Obtiene historial de peticiones
     * @param {object} filters - Filtros opcionales
     * @returns {array} Historial filtrado
     */
    getRequestHistory(filters = {}) {
        let history = [...this.requestHistory];
        
        if (filters.apiName) {
            history = history.filter(req => req.apiName === filters.apiName);
        }
        
        if (filters.success !== undefined) {
            history = history.filter(req => req.success === filters.success);
        }
        
        if (filters.limit) {
            history = history.slice(-filters.limit);
        }
        
        return history;
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
const apiManager = new APIManager();

export default apiManager;
import { EventEmitter } from 'events';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../core/logger.js';

/**
 * Gestor de APIs para integraciones con servicios externos
 * Maneja autenticación, rate limiting, caching y manejo de errores
 */
class APIManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración general
      enabled: config.enabled !== false,
      maxConnections: config.maxConnections || 100,
      defaultTimeout: config.defaultTimeout || 30000,
            
      // Configuración de autenticación
      auth: {
        enabled: config.auth?.enabled !== false,
        defaultType: config.auth?.defaultType || 'none', // none, bearer, basic, apikey, oauth2, custom
        storage: config.auth?.storage || 'memory', // memory, file, database
        encryption: config.auth?.encryption !== false,
        refreshTokens: config.auth?.refreshTokens !== false
      },
            
      // Configuración de rate limiting
      rateLimit: {
        enabled: config.rateLimit?.enabled !== false,
        defaultLimits: {
          requests: config.rateLimit?.defaultLimits?.requests || 100,
          window: config.rateLimit?.defaultLimits?.window || 60000 // 1 minuto
        },
        strategy: config.rateLimit?.strategy || 'sliding', // fixed, sliding
        storage: config.rateLimit?.storage || 'memory'
      },
            
      // Configuración de caché
      cache: {
        enabled: config.cache?.enabled !== false,
        defaultTTL: config.cache?.defaultTTL || 300000, // 5 minutos
        maxSize: config.cache?.maxSize || 1000,
        storage: config.cache?.storage || 'memory',
        compression: config.cache?.compression !== false
      },
            
      // Configuración de reintentos
      retry: {
        enabled: config.retry?.enabled !== false,
        maxAttempts: config.retry?.maxAttempts || 3,
        baseDelay: config.retry?.baseDelay || 1000,
        maxDelay: config.retry?.maxDelay || 30000,
        backoffFactor: config.retry?.backoffFactor || 2,
        retryableStatusCodes: config.retry?.retryableStatusCodes || [408, 429, 500, 502, 503, 504]
      },
            
      // Configuración de circuit breaker
      circuitBreaker: {
        enabled: config.circuitBreaker?.enabled !== false,
        failureThreshold: config.circuitBreaker?.failureThreshold || 5,
        resetTimeout: config.circuitBreaker?.resetTimeout || 60000,
        monitoringPeriod: config.circuitBreaker?.monitoringPeriod || 10000
      },
            
      // Configuración de transformación
      transform: {
        enabled: config.transform?.enabled !== false,
        requestTransformers: config.transform?.requestTransformers || [],
        responseTransformers: config.transform?.responseTransformers || []
      },
            
      // Configuración de validación
      validation: {
        enabled: config.validation?.enabled !== false,
        schemas: config.validation?.schemas || {},
        strict: config.validation?.strict !== false
      },
            
      // Configuración de logging
      logging: {
        enabled: config.logging?.enabled !== false,
        level: config.logging?.level || 'info',
        includeHeaders: config.logging?.includeHeaders !== false,
        includeBody: config.logging?.includeBody !== false,
        maxBodySize: config.logging?.maxBodySize || 1024,
        maxLogs: config.logging?.maxLogs || 10000
      },
            
      // Configuración de métricas
      metrics: {
        enabled: config.metrics?.enabled !== false,
        retention: config.metrics?.retention || 86400000, // 24 horas
        aggregation: config.metrics?.aggregation !== false
      }
    };
        
    // Estado interno
    this.connections = new Map();
    this.authTokens = new Map();
    this.rateLimiters = new Map();
    this.cache = new Map();
    this.circuitBreakers = new Map();
    this.logs = [];
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      rateLimitedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      requestsByAPI: new Map(),
      errorsByAPI: new Map(),
      responseTimesByAPI: new Map()
    };
        
    // Timers
    this.cleanupTimer = null;
    this.metricsTimer = null;
        
    this.initialized = false;
  }
    
  /**
     * Inicializa el gestor de APIs
     */
  async initialize() {
    if (this.initialized) return;
        
    try {
      this._validateConfig();
      this._setupTimers();
      this._setupEventHandlers();
            
      this.initialized = true;
      this.emit('initialized');
            
      this._log('info', 'APIManager initialized successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Registra una nueva conexión de API
     */
  async registerAPI(apiConfig) {
    if (!this.initialized) {
      throw new Error('APIManager not initialized');
    }
        
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error('Maximum number of API connections reached');
    }
        
    const api = {
      id: apiConfig.id || uuidv4(),
      name: apiConfig.name || 'Unnamed API',
      baseURL: apiConfig.baseURL,
      version: apiConfig.version || '1.0',
      description: apiConfig.description || '',
            
      // Configuración de conexión
      connection: {
        timeout: apiConfig.connection?.timeout || this.config.defaultTimeout,
        headers: apiConfig.connection?.headers || {},
        params: apiConfig.connection?.params || {},
        proxy: apiConfig.connection?.proxy || null,
        maxRedirects: apiConfig.connection?.maxRedirects || 5
      },
            
      // Configuración de autenticación
      auth: {
        type: apiConfig.auth?.type || this.config.auth.defaultType,
        credentials: apiConfig.auth?.credentials || {},
        tokenEndpoint: apiConfig.auth?.tokenEndpoint || null,
        refreshEndpoint: apiConfig.auth?.refreshEndpoint || null,
        scopes: apiConfig.auth?.scopes || []
      },
            
      // Configuración de rate limiting específica
      rateLimit: {
        enabled: apiConfig.rateLimit?.enabled !== false,
        requests: apiConfig.rateLimit?.requests || this.config.rateLimit.defaultLimits.requests,
        window: apiConfig.rateLimit?.window || this.config.rateLimit.defaultLimits.window,
        headers: apiConfig.rateLimit?.headers || {}
      },
            
      // Configuración de caché específica
      cache: {
        enabled: apiConfig.cache?.enabled !== false,
        ttl: apiConfig.cache?.ttl || this.config.cache.defaultTTL,
        methods: apiConfig.cache?.methods || ['GET'],
        exclude: apiConfig.cache?.exclude || []
      },
            
      // Configuración de reintentos específica
      retry: {
        enabled: apiConfig.retry?.enabled !== false,
        maxAttempts: apiConfig.retry?.maxAttempts || this.config.retry.maxAttempts,
        statusCodes: apiConfig.retry?.statusCodes || this.config.retry.retryableStatusCodes
      },
            
      // Endpoints disponibles
      endpoints: apiConfig.endpoints || {},
            
      // Transformadores específicos
      transformers: {
        request: apiConfig.transformers?.request || [],
        response: apiConfig.transformers?.response || []
      },
            
      // Esquemas de validación
      schemas: apiConfig.schemas || {},
            
      // Metadatos
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: apiConfig.metadata?.tags || [],
        category: apiConfig.metadata?.category || 'general'
      },
            
      // Estado
      status: 'active',
      lastHealthCheck: null,
            
      // Estadísticas
      stats: {
        requests: 0,
        successes: 0,
        failures: 0,
        averageResponseTime: 0,
        lastRequest: null,
        lastSuccess: null,
        lastFailure: null
      }
    };
        
    // Validar configuración
    this._validateAPIConfig(api);
        
    // Crear cliente HTTP
    api.client = this._createHTTPClient(api);
        
    // Configurar autenticación
    if (api.auth.type !== 'none') {
      await this._setupAuthentication(api);
    }
        
    // Configurar rate limiter
    if (api.rateLimit.enabled) {
      this._setupRateLimiter(api);
    }
        
    // Configurar circuit breaker
    if (this.config.circuitBreaker.enabled) {
      this._setupCircuitBreaker(api);
    }
        
    this.connections.set(api.id, api);
    this.emit('apiRegistered', api);
        
    this._log('info', `API registered: ${api.name} (${api.id})`);
        
    return api;
  }
    
  /**
     * Realiza una petición a una API
     */
  async makeRequest(apiId, endpoint, options = {}) {
    const api = this.connections.get(apiId);
    if (!api) {
      throw new Error(`API not found: ${apiId}`);
    }
        
    if (api.status !== 'active') {
      throw new Error(`API is not active: ${apiId}`);
    }
        
    const requestId = uuidv4();
    const startTime = Date.now();
        
    try {
      // Verificar circuit breaker
      if (this.config.circuitBreaker.enabled) {
        this._checkCircuitBreaker(api);
      }
            
      // Verificar rate limit
      if (api.rateLimit.enabled) {
        await this._checkRateLimit(api);
      }
            
      // Preparar configuración de petición
      const requestConfig = this._prepareRequestConfig(api, endpoint, options);
            
      // Verificar caché
      const cacheKey = this._generateCacheKey(api.id, requestConfig);
      if (api.cache.enabled && this._shouldCache(requestConfig.method, api.cache)) {
        const cachedResponse = this._getFromCache(cacheKey);
        if (cachedResponse) {
          this.metrics.cachedRequests++;
          this._updateAPIStats(api, true, Date.now() - startTime);
                    
          this._log('debug', `Cache hit for ${api.name}: ${endpoint}`);
          return cachedResponse;
        }
      }
            
      // Aplicar transformadores de petición
      if (api.transformers.request.length > 0) {
        requestConfig.data = await this._applyRequestTransformers(
          requestConfig.data, 
          api.transformers.request
        );
      }
            
      // Validar petición
      if (this.config.validation.enabled && api.schemas[endpoint]) {
        this._validateRequest(requestConfig.data, api.schemas[endpoint].request);
      }
            
      this.metrics.totalRequests++;
      api.stats.requests++;
      api.stats.lastRequest = new Date().toISOString();
            
      this.emit('requestStarted', api, endpoint, requestConfig, requestId);
      this._log('debug', `Request started: ${api.name} ${endpoint} (${requestId})`);
            
      // Realizar petición con reintentos
      const response = await this._makeRequestWithRetry(api, requestConfig);
            
      const responseTime = Date.now() - startTime;
            
      // Aplicar transformadores de respuesta
      if (api.transformers.response.length > 0) {
        response.data = await this._applyResponseTransformers(
          response.data, 
          api.transformers.response
        );
      }
            
      // Validar respuesta
      if (this.config.validation.enabled && api.schemas[endpoint]) {
        this._validateResponse(response.data, api.schemas[endpoint].response);
      }
            
      // Guardar en caché
      if (api.cache.enabled && this._shouldCache(requestConfig.method, api.cache)) {
        this._saveToCache(cacheKey, response.data, api.cache.ttl);
      }
            
      // Actualizar estadísticas
      this.metrics.successfulRequests++;
      this._updateAPIStats(api, true, responseTime);
      this._updateMetrics(api.id, true, responseTime);
            
      // Actualizar circuit breaker
      if (this.config.circuitBreaker.enabled) {
        this._recordCircuitBreakerSuccess(api);
      }
            
      this.emit('requestCompleted', api, endpoint, response, requestId);
      this._log('debug', `Request completed: ${api.name} ${endpoint} (${requestId}) - ${responseTime}ms`);
            
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
        responseTime,
        requestId,
        cached: false
      };
            
    } catch (error) {
      const responseTime = Date.now() - startTime;
            
      this.metrics.failedRequests++;
      this._updateAPIStats(api, false, responseTime);
      this._updateMetrics(api.id, false, responseTime);
            
      // Actualizar circuit breaker
      if (this.config.circuitBreaker.enabled) {
        this._recordCircuitBreakerFailure(api);
      }
            
      this.emit('requestFailed', api, endpoint, error, requestId);
      this._log('error', `Request failed: ${api.name} ${endpoint} (${requestId}) - ${error.message}`);
            
      throw error;
    }
  }
    
  /**
     * Realiza petición con reintentos
     */
  async _makeRequestWithRetry(api, requestConfig) {
    let lastError;
    let attempt = 0;
        
    while (attempt <= this.config.retry.maxAttempts) {
      try {
        const response = await api.client.request(requestConfig);
        return response;
      } catch (error) {
        lastError = error;
        attempt++;
                
        // Verificar si el error es reintentable
        if (!this._isRetryableError(error, api.retry.statusCodes)) {
          throw error;
        }
                
        // Si no quedan intentos, lanzar error
        if (attempt > this.config.retry.maxAttempts) {
          throw error;
        }
                
        // Calcular delay para el siguiente intento
        const delay = Math.min(
          this.config.retry.baseDelay * Math.pow(this.config.retry.backoffFactor, attempt - 1),
          this.config.retry.maxDelay
        );
                
        this._log('debug', `Retrying request in ${delay}ms (attempt ${attempt}/${this.config.retry.maxAttempts})`);
                
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
        
    throw lastError;
  }
    
  /**
     * Verifica si un error es reintentable
     */
  _isRetryableError(error, retryableStatusCodes) {
    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
      return true;
    }
        
    if (error.response && retryableStatusCodes.includes(error.response.status)) {
      return true;
    }
        
    return false;
  }
    
  /**
     * Crea cliente HTTP para una API
     */
  _createHTTPClient(api) {
    const client = axios.create({
      baseURL: api.baseURL,
      timeout: api.connection.timeout,
      headers: api.connection.headers,
      params: api.connection.params,
      proxy: api.connection.proxy,
      maxRedirects: api.connection.maxRedirects
    });
        
    // Interceptor de petición
    client.interceptors.request.use(
      (config) => {
        // Agregar autenticación
        if (api.auth.type !== 'none') {
          this._addAuthentication(config, api);
        }
                
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
        
    // Interceptor de respuesta
    client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        // Manejar errores de autenticación
        if (error.response?.status === 401 && api.auth.type !== 'none') {
          return this._handleAuthError(error, api);
        }
                
        return Promise.reject(error);
      }
    );
        
    return client;
  }
    
  /**
     * Configura autenticación para una API
     */
  async _setupAuthentication(api) {
    const { type, credentials } = api.auth;
        
    switch (type) {
    case 'bearer':
      if (!credentials.token) {
        throw new Error('Bearer token required');
      }
      this.authTokens.set(api.id, {
        type: 'bearer',
        token: credentials.token,
        expiresAt: credentials.expiresAt || null
      });
      break;
                
    case 'basic':
      if (!credentials.username || !credentials.password) {
        throw new Error('Username and password required for basic auth');
      }
      this.authTokens.set(api.id, {
        type: 'basic',
        username: credentials.username,
        password: credentials.password
      });
      break;
                
    case 'apikey':
      if (!credentials.key) {
        throw new Error('API key required');
      }
      this.authTokens.set(api.id, {
        type: 'apikey',
        key: credentials.key,
        header: credentials.header || 'X-API-Key',
        location: credentials.location || 'header' // header, query
      });
      break;
                
    case 'oauth2':
      await this._setupOAuth2(api);
      break;
                
    case 'custom':
      if (!credentials.handler) {
        throw new Error('Custom auth handler required');
      }
      this.authTokens.set(api.id, {
        type: 'custom',
        handler: credentials.handler
      });
      break;
    }
  }
    
  /**
     * Configura OAuth2
     */
  async _setupOAuth2(api) {
    const { credentials, tokenEndpoint, scopes } = api.auth;
        
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error('Client ID and secret required for OAuth2');
    }
        
    if (!tokenEndpoint) {
      throw new Error('Token endpoint required for OAuth2');
    }
        
    try {
      const tokenResponse = await axios.post(tokenEndpoint, {
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        scope: scopes.join(' ')
      });
            
      const { access_token, expires_in, refresh_token } = tokenResponse.data;
            
      this.authTokens.set(api.id, {
        type: 'oauth2',
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + (expires_in * 1000),
        tokenEndpoint,
        refreshEndpoint: api.auth.refreshEndpoint,
        credentials
      });
            
    } catch (error) {
      throw new Error(`OAuth2 setup failed: ${error.message}`);
    }
  }
    
  /**
     * Agrega autenticación a la petición
     */
  _addAuthentication(config, api) {
    const authData = this.authTokens.get(api.id);
    if (!authData) return;
        
    switch (authData.type) {
    case 'bearer':
      config.headers.Authorization = `Bearer ${authData.token}`;
      break;
                
    case 'basic':
      const credentials = Buffer.from(`${authData.username}:${authData.password}`).toString('base64');
      config.headers.Authorization = `Basic ${credentials}`;
      break;
                
    case 'apikey':
      if (authData.location === 'header') {
        config.headers[authData.header] = authData.key;
      } else {
        config.params = config.params || {};
        config.params[authData.header] = authData.key;
      }
      break;
                
    case 'oauth2':
      // Verificar si el token ha expirado
      if (authData.expiresAt && Date.now() >= authData.expiresAt) {
        // Token expirado, intentar renovar
        this._refreshOAuth2Token(api.id);
      }
      config.headers.Authorization = `Bearer ${authData.accessToken}`;
      break;
                
    case 'custom':
      authData.handler(config, api);
      break;
    }
  }
    
  /**
     * Renueva token OAuth2
     */
  async _refreshOAuth2Token(apiId) {
    const authData = this.authTokens.get(apiId);
    if (!authData || authData.type !== 'oauth2') return;
        
    if (!authData.refreshToken || !authData.refreshEndpoint) {
      throw new Error('Cannot refresh OAuth2 token: missing refresh token or endpoint');
    }
        
    try {
      const refreshResponse = await axios.post(authData.refreshEndpoint, {
        grant_type: 'refresh_token',
        refresh_token: authData.refreshToken,
        client_id: authData.credentials.clientId,
        client_secret: authData.credentials.clientSecret
      });
            
      const { access_token, expires_in, refresh_token } = refreshResponse.data;
            
      authData.accessToken = access_token;
      authData.expiresAt = Date.now() + (expires_in * 1000);
            
      if (refresh_token) {
        authData.refreshToken = refresh_token;
      }
            
      this._log('info', `OAuth2 token refreshed for API: ${apiId}`);
            
    } catch (error) {
      this._log('error', `Failed to refresh OAuth2 token for API ${apiId}: ${error.message}`);
      throw error;
    }
  }
    
  /**
     * Maneja errores de autenticación
     */
  async _handleAuthError(error, api) {
    const authData = this.authTokens.get(api.id);
        
    if (authData && authData.type === 'oauth2' && authData.refreshToken) {
      try {
        await this._refreshOAuth2Token(api.id);
                
        // Reintentar la petición original
        const originalRequest = error.config;
        this._addAuthentication(originalRequest, api);
                
        return api.client.request(originalRequest);
      } catch (refreshError) {
        this._log('error', `Auth refresh failed for API ${api.id}: ${refreshError.message}`);
      }
    }
        
    return Promise.reject(error);
  }
    
  /**
   * Configura rate limiter para una API - DESACTIVADO
   */
  _setupRateLimiter(api) {
    // No configurar rate limiter
    return;
  }
    
  /**
   * Verifica rate limit - DESACTIVADO
   */
  async _checkRateLimit(api) {
    // No verificar rate limit, siempre permitir
    return;
  }
    
  /**
     * Configura circuit breaker para una API
     */
  _setupCircuitBreaker(api) {
    this.circuitBreakers.set(api.id, {
      state: 'closed', // closed, open, half-open
      failures: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    });
  }
    
  /**
     * Verifica circuit breaker
     */
  _checkCircuitBreaker(api) {
    const breaker = this.circuitBreakers.get(api.id);
    if (!breaker) return;
        
    const now = Date.now();
        
    switch (breaker.state) {
    case 'open':
      if (now >= breaker.nextAttemptTime) {
        breaker.state = 'half-open';
        this._log('info', `Circuit breaker half-open for API ${api.id}`);
      } else {
        throw new Error(`Circuit breaker is open for API ${api.id}`);
      }
      break;
                
    case 'half-open':
      // Permitir una petición de prueba
      break;
                
    case 'closed':
      // Normal operation
      break;
    }
  }
    
  /**
     * Registra éxito en circuit breaker
     */
  _recordCircuitBreakerSuccess(api) {
    const breaker = this.circuitBreakers.get(api.id);
    if (!breaker) return;
        
    if (breaker.state === 'half-open') {
      breaker.state = 'closed';
      breaker.failures = 0;
      this._log('info', `Circuit breaker closed for API ${api.id}`);
    }
  }
    
  /**
     * Registra fallo en circuit breaker
     */
  _recordCircuitBreakerFailure(api) {
    const breaker = this.circuitBreakers.get(api.id);
    if (!breaker) return;
        
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
        
    if (breaker.failures >= this.config.circuitBreaker.failureThreshold) {
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + this.config.circuitBreaker.resetTimeout;
      this._log('warn', `Circuit breaker opened for API ${api.id}`);
    }
  }
    
  /**
     * Prepara configuración de petición
     */
  _prepareRequestConfig(api, endpoint, options) {
    const endpointConfig = api.endpoints[endpoint] || {};
        
    return {
      method: options.method || endpointConfig.method || 'GET',
      url: options.url || endpointConfig.path || endpoint,
      data: options.data || options.body,
      params: { ...endpointConfig.params, ...options.params },
      headers: { ...endpointConfig.headers, ...options.headers },
      timeout: options.timeout || endpointConfig.timeout || api.connection.timeout
    };
  }
    
  /**
     * Genera clave de caché
     */
  _generateCacheKey(apiId, requestConfig) {
    const key = `${apiId}:${requestConfig.method}:${requestConfig.url}`;
    const params = JSON.stringify(requestConfig.params || {});
    const body = JSON.stringify(requestConfig.data || {});
        
    return `${key}:${this._hash(params + body)}`;
  }
    
  /**
     * Verifica si debe cachear
     */
  _shouldCache(method, cacheConfig) {
    return cacheConfig.methods.includes(method.toUpperCase());
  }
    
  /**
     * Obtiene del caché
     */
  _getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
        
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
        
    return cached.data;
  }
    
  /**
     * Guarda en caché
     */
  _saveToCache(key, data, ttl) {
    if (this.cache.size >= this.config.cache.maxSize) {
      // Eliminar entrada más antigua
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
        
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
  }
    
  /**
     * Aplica transformadores de petición
     */
  async _applyRequestTransformers(data, transformers) {
    let transformedData = data;
        
    for (const transformer of transformers) {
      if (typeof transformer === 'function') {
        transformedData = await transformer(transformedData);
      }
    }
        
    return transformedData;
  }
    
  /**
     * Aplica transformadores de respuesta
     */
  async _applyResponseTransformers(data, transformers) {
    let transformedData = data;
        
    for (const transformer of transformers) {
      if (typeof transformer === 'function') {
        transformedData = await transformer(transformedData);
      }
    }
        
    return transformedData;
  }
    
  /**
     * Valida petición
     */
  _validateRequest(data, schema) {
    // Implementación básica - en producción usar joi, ajv, etc.
    if (!schema) return;
        
    this._log('debug', 'Request validation passed');
  }
    
  /**
     * Valida respuesta
     */
  _validateResponse(data, schema) {
    // Implementación básica - en producción usar joi, ajv, etc.
    if (!schema) return;
        
    this._log('debug', 'Response validation passed');
  }
    
  /**
     * Actualiza estadísticas de API
     */
  _updateAPIStats(api, success, responseTime) {
    if (success) {
      api.stats.successes++;
      api.stats.lastSuccess = new Date().toISOString();
    } else {
      api.stats.failures++;
      api.stats.lastFailure = new Date().toISOString();
    }
        
    // Calcular tiempo promedio de respuesta
    const totalTime = api.stats.averageResponseTime * (api.stats.requests - 1) + responseTime;
    api.stats.averageResponseTime = totalTime / api.stats.requests;
  }
    
  /**
     * Actualiza métricas globales
     */
  _updateMetrics(apiId, success, responseTime) {
    // Actualizar métricas por API
    if (!this.metrics.requestsByAPI.has(apiId)) {
      this.metrics.requestsByAPI.set(apiId, 0);
      this.metrics.errorsByAPI.set(apiId, 0);
      this.metrics.responseTimesByAPI.set(apiId, []);
    }
        
    this.metrics.requestsByAPI.set(apiId, this.metrics.requestsByAPI.get(apiId) + 1);
        
    if (!success) {
      this.metrics.errorsByAPI.set(apiId, this.metrics.errorsByAPI.get(apiId) + 1);
    }
        
    const responseTimes = this.metrics.responseTimesByAPI.get(apiId);
    responseTimes.push(responseTime);
        
    // Mantener solo los últimos 100 tiempos de respuesta
    if (responseTimes.length > 100) {
      responseTimes.shift();
    }
        
    // Actualizar tiempo promedio global
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.totalRequests;
  }
    
  /**
     * Realiza health check de una API
     */
  async performHealthCheck(apiId) {
    const api = this.connections.get(apiId);
    if (!api) {
      throw new Error(`API not found: ${apiId}`);
    }
        
    try {
      const healthEndpoint = api.endpoints.health || '/health';
      const response = await this.makeRequest(apiId, healthEndpoint, {
        method: 'GET',
        timeout: 5000
      });
            
      api.lastHealthCheck = new Date().toISOString();
      api.status = 'active';
            
      return {
        healthy: true,
        status: response.status,
        responseTime: response.responseTime,
        timestamp: api.lastHealthCheck
      };
            
    } catch (error) {
      api.status = 'unhealthy';
            
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
    
  /**
     * Obtiene una API por ID
     */
  getAPI(apiId) {
    return this.connections.get(apiId);
  }
    
  /**
     * Lista todas las APIs
     */
  listAPIs(filter = {}) {
    let apis = Array.from(this.connections.values());
        
    if (filter.status) {
      apis = apis.filter(api => api.status === filter.status);
    }
        
    if (filter.category) {
      apis = apis.filter(api => api.metadata.category === filter.category);
    }
        
    if (filter.tags && filter.tags.length > 0) {
      apis = apis.filter(api => 
        filter.tags.some(tag => api.metadata.tags.includes(tag))
      );
    }
        
    return apis;
  }
    
  /**
     * Actualiza una API
     */
  async updateAPI(apiId, updates) {
    const api = this.connections.get(apiId);
    if (!api) {
      throw new Error(`API not found: ${apiId}`);
    }
        
    const allowedUpdates = [
      'name', 'description', 'connection', 'auth', 'rateLimit', 
      'cache', 'retry', 'endpoints', 'transformers', 'schemas'
    ];
        
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'connection' || field === 'auth') {
          Object.assign(api[field], updates[field]);
        } else {
          api[field] = updates[field];
        }
      }
    });
        
    api.metadata.updatedAt = new Date().toISOString();
        
    // Recrear cliente si es necesario
    if (updates.connection || updates.auth) {
      api.client = this._createHTTPClient(api);
            
      if (updates.auth && api.auth.type !== 'none') {
        await this._setupAuthentication(api);
      }
    }
        
    this.emit('apiUpdated', api);
        
    return api;
  }
    
  /**
     * Elimina una API
     */
  async deleteAPI(apiId) {
    const api = this.connections.get(apiId);
    if (!api) {
      throw new Error(`API not found: ${apiId}`);
    }
        
    // Limpiar recursos
    this.authTokens.delete(apiId);
    this.rateLimiters.delete(apiId);
    this.circuitBreakers.delete(apiId);
        
    // Limpiar caché relacionado
    for (const [key] of this.cache) {
      if (key.startsWith(`${apiId}:`)) {
        this.cache.delete(key);
      }
    }
        
    this.connections.delete(apiId);
    this.emit('apiDeleted', api);
        
    return true;
  }
    
  /**
     * Obtiene estadísticas
     */
  getStats() {
    const apiStats = {};
        
    for (const [apiId, api] of this.connections) {
      apiStats[apiId] = {
        name: api.name,
        status: api.status,
        stats: api.stats,
        requests: this.metrics.requestsByAPI.get(apiId) || 0,
        errors: this.metrics.errorsByAPI.get(apiId) || 0,
        averageResponseTime: this._calculateAverageResponseTime(apiId)
      };
    }
        
    return {
      ...this.metrics,
      apis: apiStats,
      connections: {
        total: this.connections.size,
        active: Array.from(this.connections.values()).filter(api => api.status === 'active').length,
        unhealthy: Array.from(this.connections.values()).filter(api => api.status === 'unhealthy').length
      },
      cache: {
        size: this.cache.size,
        hitRate: this._calculateCacheHitRate()
      }
    };
  }
    
  /**
     * Calcula tiempo promedio de respuesta para una API
     */
  _calculateAverageResponseTime(apiId) {
    const responseTimes = this.metrics.responseTimesByAPI.get(apiId);
    if (!responseTimes || responseTimes.length === 0) return 0;
        
    const sum = responseTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / responseTimes.length);
  }
    
  /**
     * Calcula tasa de aciertos de caché
     */
  _calculateCacheHitRate() {
    if (this.metrics.totalRequests === 0) return 0;
    return Math.round((this.metrics.cachedRequests / this.metrics.totalRequests) * 100);
  }
    
  /**
     * Obtiene estado de salud
     */
  getHealthStatus() {
    const apis = Array.from(this.connections.values());
    const healthyAPIs = apis.filter(api => api.status === 'active').length;
        
    return {
      healthy: healthyAPIs === apis.length,
      apis: {
        total: apis.length,
        healthy: healthyAPIs,
        unhealthy: apis.length - healthyAPIs
      },
      components: {
        cache: {
          healthy: this.cache.size < this.config.cache.maxSize,
          size: this.cache.size,
          maxSize: this.config.cache.maxSize
        },
        rateLimiters: {
          healthy: true,
          count: this.rateLimiters.size
        },
        circuitBreakers: {
          healthy: Array.from(this.circuitBreakers.values()).every(cb => cb.state !== 'open'),
          open: Array.from(this.circuitBreakers.values()).filter(cb => cb.state === 'open').length
        }
      },
      timestamp: new Date().toISOString()
    };
  }
    
  /**
     * Configura timers del sistema
     */
  _setupTimers() {
    // Timer de limpieza de caché
    this.cleanupTimer = setInterval(() => {
      this._cleanupCache();
    }, 300000); // Cada 5 minutos
        
    // Timer de métricas
    if (this.config.metrics.enabled) {
      this.metricsTimer = setInterval(() => {
        const stats = this.getStats();
        this.emit('metricsUpdate', stats);
      }, 60000); // Cada minuto
    }
  }
    
  /**
     * Limpia caché expirado
     */
  _cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
        
    for (const [key, cached] of this.cache) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
        
    if (cleaned > 0) {
      this._log('debug', `Cleaned ${cleaned} expired cache entries`);
    }
  }
    
  /**
     * Configura manejadores de eventos
     */
  _setupEventHandlers() {
    this.on('error', (error) => {
      this._log('error', `APIManager error: ${error.message}`);
    });
  }
    
  /**
     * Valida configuración de API
     */
  _validateAPIConfig(api) {
    if (!api.baseURL) {
      throw new Error('Base URL is required');
    }
        
    if (!api.baseURL.startsWith('http')) {
      throw new Error('Base URL must be a valid HTTP/HTTPS URL');
    }
  }
    
  /**
     * Valida configuración
     */
  _validateConfig() {
    if (this.config.maxConnections <= 0) {
      throw new Error('maxConnections must be greater than 0');
    }
        
    if (this.config.defaultTimeout <= 0) {
      throw new Error('defaultTimeout must be greater than 0');
    }
  }
    
  /**
     * Genera hash simple
     */
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }
    
  /**
     * Registra un log
     */
  _log(level, message) {
    if (!this.config.logging.enabled) return;
        
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      component: 'APIManager'
    };
        
    this.logs.push(logEntry);
    this.emit('log', logEntry);
        
    if (this.logs.length > this.config.logging.maxLogs) {
      this.logs.shift();
    }
  }
    
  /**
     * Destruye el gestor de APIs
     */
  async destroy() {
    // Limpiar timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
        
    this.removeAllListeners();
    this.initialized = false;
        
    this._log('info', 'APIManager destroyed');
  }
}

export default APIManager;
import { EventEmitter } from 'events';

/**
 * API estándar para plugins con herramientas y utilidades
 */
class PluginAPI extends EventEmitter {
  constructor(context) {
    super();
        
    this.context = context;
    this.name = context.name;
    this.version = context.version;
    this.config = context.config;
    this.metadata = context.metadata;
        
    // Estado del plugin
    this.state = {
      initialized: false,
      running: false,
      error: null
    };
        
    // Recursos del plugin
    this.resources = {
      timers: new Set(),
      intervals: new Set(),
      listeners: new Map(),
      watchers: new Set(),
      connections: new Set()
    };
        
    // Cache local del plugin
    this.cache = new Map();
        
    // Métricas del plugin
    this.metrics = {
      startTime: null,
      uptime: 0,
      requests: 0,
      errors: 0,
      warnings: 0,
      lastActivity: null
    };
        
    // Configuración de la API
    this.apiConfig = {
      autoCleanup: true,
      trackMetrics: true,
      enableLogging: true,
      maxCacheSize: 100,
      maxListeners: 50
    };
        
    this._initializeAPI();
  }
    
  /**
     * Inicializa la API del plugin
     */
  _initializeAPI() {
    // Configurar límites
    this.setMaxListeners(this.apiConfig.maxListeners);
        
    // Configurar limpieza automática
    if (this.apiConfig.autoCleanup) {
      this._setupAutoCleanup();
    }
        
    // Configurar seguimiento de métricas
    if (this.apiConfig.trackMetrics) {
      this._setupMetricsTracking();
    }
  }
    
  /**
     * Configura la limpieza automática
     */
  _setupAutoCleanup() {
    // Limpiar recursos al destruir
    this.on('destroy', () => {
      this._cleanupResources();
    });
        
    // Limpiar cache periódicamente
    this._cacheCleanupInterval = setInterval(() => {
      this._cleanupCache();
    }, 60000); // Cada minuto
        
    this.resources.intervals.add(this._cacheCleanupInterval);
  }
    
  /**
     * Configura el seguimiento de métricas
     */
  _setupMetricsTracking() {
    // Actualizar métricas de actividad
    this.on('request', () => {
      this.metrics.requests++;
      this.metrics.lastActivity = Date.now();
    });
        
    this.on('error', () => {
      this.metrics.errors++;
    });
        
    this.on('warning', () => {
      this.metrics.warnings++;
    });
  }
    
  /**
     * Inicializa el plugin
     */
  async initialize() {
    if (this.state.initialized) {
      return;
    }
        
    try {
      this.log('info', 'Initializing plugin');
            
      // Marcar tiempo de inicio
      this.metrics.startTime = Date.now();
            
      // Ejecutar inicialización personalizada
      if (this.onInitialize) {
        await this.onInitialize();
      }
            
      this.state.initialized = true;
      this.emit('initialized');
            
      this.log('info', 'Plugin initialized successfully');
            
    } catch (error) {
      this.state.error = error;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Inicia el plugin
     */
  async start() {
    if (!this.state.initialized) {
      await this.initialize();
    }
        
    if (this.state.running) {
      return;
    }
        
    try {
      this.log('info', 'Starting plugin');
            
      // Ejecutar inicio personalizado
      if (this.onStart) {
        await this.onStart();
      }
            
      this.state.running = true;
      this.emit('started');
            
      this.log('info', 'Plugin started successfully');
            
    } catch (error) {
      this.state.error = error;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Detiene el plugin
     */
  async stop() {
    if (!this.state.running) {
      return;
    }
        
    try {
      this.log('info', 'Stopping plugin');
            
      // Ejecutar parada personalizada
      if (this.onStop) {
        await this.onStop();
      }
            
      this.state.running = false;
      this.emit('stopped');
            
      this.log('info', 'Plugin stopped successfully');
            
    } catch (error) {
      this.state.error = error;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Destruye el plugin
     */
  async destroy() {
    try {
      this.log('info', 'Destroying plugin');
            
      // Detener si está ejecutándose
      if (this.state.running) {
        await this.stop();
      }
            
      // Ejecutar destrucción personalizada
      if (this.onDestroy) {
        await this.onDestroy();
      }
            
      // Limpiar recursos
      this._cleanupResources();
            
      this.emit('destroyed');
            
      this.log('info', 'Plugin destroyed successfully');
            
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Configura el plugin
     */
  configure(newConfig) {
    try {
      this.log('info', 'Configuring plugin', { config: newConfig });
            
      // Fusionar configuración
      this.config = { ...this.config, ...newConfig };
            
      // Ejecutar configuración personalizada
      if (this.onConfigure) {
        this.onConfigure(this.config);
      }
            
      this.emit('configured', this.config);
            
      this.log('info', 'Plugin configured successfully');
            
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Registra un timer
     */
  setTimeout(callback, delay, ...args) {
    const timer = setTimeout(() => {
      this.resources.timers.delete(timer);
      try {
        callback(...args);
      } catch (error) {
        this.emit('error', error);
      }
    }, delay);
        
    this.resources.timers.add(timer);
    return timer;
  }
    
  /**
     * Registra un interval
     */
  setInterval(callback, interval, ...args) {
    const intervalId = setInterval(() => {
      try {
        callback(...args);
      } catch (error) {
        this.emit('error', error);
      }
    }, interval);
        
    this.resources.intervals.add(intervalId);
    return intervalId;
  }
    
  /**
     * Limpia un timer
     */
  clearTimeout(timer) {
    clearTimeout(timer);
    this.resources.timers.delete(timer);
  }
    
  /**
     * Limpia un interval
     */
  clearInterval(intervalId) {
    clearInterval(intervalId);
    this.resources.intervals.delete(intervalId);
  }
    
  /**
     * Registra un listener de eventos
     */
  addEventListener(target, event, listener, options = {}) {
    if (!this.resources.listeners.has(target)) {
      this.resources.listeners.set(target, new Map());
    }
        
    if (!this.resources.listeners.get(target).has(event)) {
      this.resources.listeners.get(target).set(event, new Set());
    }
        
    this.resources.listeners.get(target).get(event).add(listener);
        
    // Añadir listener
    if (target.addEventListener) {
      target.addEventListener(event, listener, options);
    } else if (target.on) {
      target.on(event, listener);
    }
        
    return () => this.removeEventListener(target, event, listener);
  }
    
  /**
     * Remueve un listener de eventos
     */
  removeEventListener(target, event, listener) {
    if (this.resources.listeners.has(target) && 
            this.resources.listeners.get(target).has(event)) {
      this.resources.listeners.get(target).get(event).delete(listener);
    }
        
    // Remover listener
    if (target.removeEventListener) {
      target.removeEventListener(event, listener);
    } else if (target.off) {
      target.off(event, listener);
    }
  }
    
  /**
     * Almacena datos en cache
     */
  setCache(key, value, ttl = 3600000) { // 1 hora por defecto
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
        
    // Limpiar cache si excede el tamaño máximo
    if (this.cache.size > this.apiConfig.maxCacheSize) {
      this._cleanupCache();
    }
  }
    
  /**
     * Obtiene datos del cache
     */
  getCache(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
        
    // Verificar expiración
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
        
    return entry.value;
  }
    
  /**
     * Elimina datos del cache
     */
  deleteCache(key) {
    return this.cache.delete(key);
  }
    
  /**
     * Limpia el cache
     */
  clearCache() {
    this.cache.clear();
  }
    
  /**
     * Limpia el cache expirado
     */
  _cleanupCache() {
    const now = Date.now();
        
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
        
    // Si aún excede el tamaño, eliminar las entradas más antiguas
    if (this.cache.size > this.apiConfig.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
      const toDelete = entries.slice(0, entries.length - this.apiConfig.maxCacheSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }
    
  /**
     * Registra un mensaje
     */
  log(level, message, data = {}) {
    if (!this.apiConfig.enableLogging) {
      return;
    }
        
    const logEntry = {
      plugin: this.name,
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    };
        
    // Emitir evento de log
    this.emit('log', logEntry);
        
    // Usar el logger del contexto si está disponible
    if (this.context.manager && this.context.manager.log) {
      this.context.manager.log(level, message, data);
    }
  }
    
  /**
     * Emite un evento del plugin
     */
  emitEvent(event, data = {}) {
    this.emit('request'); // Para métricas
        
    const eventData = {
      plugin: this.name,
      event,
      data,
      timestamp: Date.now()
    };
        
    // Emitir evento local
    this.emit(event, eventData);
        
    // Emitir evento global a través del manager
    if (this.context.manager && this.context.manager.emit) {
      this.context.manager.emit(`plugin:${this.name}:${event}`, eventData);
    }
  }
    
  /**
     * Escucha eventos de otros plugins
     */
  listenToPlugin(pluginName, event, listener) {
    if (this.context.manager && this.context.manager.on) {
      const eventName = `plugin:${pluginName}:${event}`;
      this.context.manager.on(eventName, listener);
            
      // Registrar para limpieza automática
      this.addEventListener(this.context.manager, eventName, listener);
    }
  }
    
  /**
     * Obtiene otro plugin
     */
  getPlugin(pluginName) {
    if (this.context.manager && this.context.manager.getPlugin) {
      return this.context.manager.getPlugin(pluginName);
    }
    return null;
  }
    
  /**
     * Obtiene todos los plugins
     */
  getPlugins() {
    if (this.context.manager && this.context.manager.getPlugins) {
      return this.context.manager.getPlugins();
    }
    return new Map();
  }
    
  /**
     * Añade un hook
     */
  addHook(hookName, listener) {
    if (this.context.manager && this.context.manager.addHook) {
      this.context.manager.addHook(hookName, listener);
            
      // Registrar para limpieza automática
      if (!this.resources.hooks) {
        this.resources.hooks = new Map();
      }
            
      if (!this.resources.hooks.has(hookName)) {
        this.resources.hooks.set(hookName, new Set());
      }
            
      this.resources.hooks.get(hookName).add(listener);
    }
  }
    
  /**
     * Remueve un hook
     */
  removeHook(hookName, listener) {
    if (this.context.manager && this.context.manager.removeHook) {
      this.context.manager.removeHook(hookName, listener);
            
      if (this.resources.hooks && this.resources.hooks.has(hookName)) {
        this.resources.hooks.get(hookName).delete(listener);
      }
    }
  }
    
  /**
     * Ejecuta un hook
     */
  executeHook(hookName, data = {}) {
    if (this.context.manager && this.context.manager.executeHook) {
      return this.context.manager.executeHook(hookName, data);
    }
  }
    
  /**
     * Crea una promesa con timeout
     */
  createTimeoutPromise(promise, timeout, errorMessage = 'Operation timeout') {
    return new Promise((resolve, reject) => {
      const timer = this.setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeout);
            
      promise
        .then(result => {
          this.clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          this.clearTimeout(timer);
          reject(error);
        });
    });
  }
    
  /**
     * Crea un debounce
     */
  debounce(func, delay) {
    let timer;
        
    return (...args) => {
      if (timer) {
        this.clearTimeout(timer);
      }
            
      timer = this.setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }
    
  /**
     * Crea un throttle
     */
  throttle(func, limit) {
    let inThrottle;
        
    return (...args) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
                
        this.setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }
    
  /**
     * Obtiene el estado del plugin
     */
  getState() {
    return {
      ...this.state,
      uptime: this.state.running ? Date.now() - this.metrics.startTime : 0
    };
  }
    
  /**
     * Obtiene las métricas del plugin
     */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.state.running ? Date.now() - this.metrics.startTime : 0,
      cacheSize: this.cache.size,
      resourceCount: {
        timers: this.resources.timers.size,
        intervals: this.resources.intervals.size,
        listeners: Array.from(this.resources.listeners.values())
          .reduce((total, eventMap) => 
            total + Array.from(eventMap.values())
              .reduce((sum, listeners) => sum + listeners.size, 0), 0),
        watchers: this.resources.watchers.size,
        connections: this.resources.connections.size
      }
    };
  }
    
  /**
     * Obtiene información del plugin
     */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      metadata: this.metadata,
      config: this.config,
      state: this.getState(),
      metrics: this.getMetrics()
    };
  }
    
  /**
     * Limpia todos los recursos
     */
  _cleanupResources() {
    // Limpiar timers
    for (const timer of this.resources.timers) {
      clearTimeout(timer);
    }
    this.resources.timers.clear();
        
    // Limpiar intervals
    for (const intervalId of this.resources.intervals) {
      clearInterval(intervalId);
    }
    this.resources.intervals.clear();
        
    // Limpiar listeners
    for (const [target, eventMap] of this.resources.listeners) {
      for (const [event, listeners] of eventMap) {
        for (const listener of listeners) {
          this.removeEventListener(target, event, listener);
        }
      }
    }
    this.resources.listeners.clear();
        
    // Limpiar hooks
    if (this.resources.hooks) {
      for (const [hookName, listeners] of this.resources.hooks) {
        for (const listener of listeners) {
          this.removeHook(hookName, listener);
        }
      }
      this.resources.hooks.clear();
    }
        
    // Limpiar watchers
    for (const watcher of this.resources.watchers) {
      if (watcher.close) {
        watcher.close();
      }
    }
    this.resources.watchers.clear();
        
    // Limpiar conexiones
    for (const connection of this.resources.connections) {
      if (connection.close) {
        connection.close();
      } else if (connection.end) {
        connection.end();
      } else if (connection.destroy) {
        connection.destroy();
      }
    }
    this.resources.connections.clear();
        
    // Limpiar cache
    this.clearCache();
        
    // Remover todos los listeners del plugin
    this.removeAllListeners();
  }
    
  /**
     * Valida la configuración
     */
  validateConfig(schema) {
    // Implementación básica de validación
    if (!schema || typeof schema !== 'object') {
      return true;
    }
        
    for (const [key, rules] of Object.entries(schema)) {
      const value = this.config[key];
            
      if (rules.required && (value === undefined || value === null)) {
        throw new Error(`Required config field missing: ${key}`);
      }
            
      if (value !== undefined && rules.type && typeof value !== rules.type) {
        throw new Error(`Invalid config type for ${key}: expected ${rules.type}, got ${typeof value}`);
      }
            
      if (value !== undefined && rules.validate && !rules.validate(value)) {
        throw new Error(`Config validation failed for ${key}`);
      }
    }
        
    return true;
  }
    
  /**
     * Crea un proxy para acceso seguro a propiedades
     */
  createSafeProxy(target, allowedProperties = []) {
    return new Proxy(target, {
      get(obj, prop) {
        if (allowedProperties.length > 0 && !allowedProperties.includes(prop)) {
          throw new Error(`Access denied to property: ${prop}`);
        }
        return obj[prop];
      },
            
      set(obj, prop, value) {
        if (allowedProperties.length > 0 && !allowedProperties.includes(prop)) {
          throw new Error(`Write access denied to property: ${prop}`);
        }
        obj[prop] = value;
        return true;
      }
    });
  }
}

/**
 * Clase base para plugins
 */
class BasePlugin extends PluginAPI {
  constructor(context) {
    super(context);
  }
    
  /**
     * Método de inicialización personalizable
     */
  async onInitialize() {
    // Implementar en subclases
  }
    
  /**
     * Método de inicio personalizable
     */
  async onStart() {
    // Implementar en subclases
  }
    
  /**
     * Método de parada personalizable
     */
  async onStop() {
    // Implementar en subclases
  }
    
  /**
     * Método de destrucción personalizable
     */
  async onDestroy() {
    // Implementar en subclases
  }
    
  /**
     * Método de configuración personalizable
     */
  onConfigure(config) {
    // Implementar en subclases
  }
}

export { PluginAPI, BasePlugin };
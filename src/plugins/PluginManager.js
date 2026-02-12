import { EventEmitter } from 'events';
import path from 'path';
import { promises as fs } from 'fs';
import { createRequire } from 'module';

/**
 * Gestor de plugins extensible con carga dinámica y gestión de dependencias
 */
class PluginManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      enabled: true,
      autoLoad: true,
      autoStart: false,
      pluginDir: './plugins',
      configDir: './config/plugins',
      tempDir: './temp/plugins',
      maxPlugins: 100,
      loadTimeout: 30000,
      startTimeout: 10000,
      stopTimeout: 5000,
      allowRemotePlugins: false,
      sandboxed: true,
      validateSignatures: false,
            
      // Configuración de dependencias
      dependencies: {
        autoResolve: true,
        allowCircular: false,
        maxDepth: 10,
        timeout: 15000
      },
            
      // Configuración de hooks
      hooks: {
        enabled: true,
        timeout: 5000,
        maxListeners: 50
      },
            
      // Configuración de seguridad
      security: {
        allowNativeModules: false,
        allowFileSystem: false,
        allowNetwork: false,
        allowProcess: false,
        memoryLimit: 100 * 1024 * 1024, // 100MB
        cpuLimit: 1000 // ms
      },
            
      // Configuración de cache
      cache: {
        enabled: true,
        ttl: 3600000, // 1 hora
        maxSize: 50
      },
            
      ...config
    };
        
    // Estado del gestor
    this.state = {
      initialized: false,
      running: false,
      loading: false
    };
        
    // Almacenamiento de plugins
    this.plugins = new Map();
    this.pluginConfigs = new Map();
    this.pluginStates = new Map();
    this.pluginDependencies = new Map();
    this.pluginMetadata = new Map();
        
    // Gestión de hooks
    this.hooks = new Map();
    this.hookListeners = new Map();
        
    // Cache y estadísticas
    this.cache = new Map();
    this.statistics = {
      totalPlugins: 0,
      loadedPlugins: 0,
      activePlugins: 0,
      failedPlugins: 0,
      loadTime: 0,
      startTime: 0,
      errors: 0,
      warnings: 0
    };
        
    // Timers y limpieza
    this.timers = new Map();
    this.cleanupInterval = null;
        
    // Require personalizado para plugins
    this.pluginRequire = null;
        
    this._initializeManager();
  }
    
  /**
     * Inicializa el gestor de plugins
     */
  async _initializeManager() {
    try {
      // Crear directorios necesarios
      await this._createDirectories();
            
      // Configurar require personalizado
      this._setupPluginRequire();
            
      // Configurar hooks por defecto
      this._setupDefaultHooks();
            
      // Configurar limpieza automática
      this._setupCleanup();
            
      this.state.initialized = true;
      this.emit('initialized');
            
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Crea los directorios necesarios
     */
  async _createDirectories() {
    const dirs = [
      this.config.pluginDir,
      this.config.configDir,
      this.config.tempDir
    ];
        
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }
  }
    
  /**
     * Configura el require personalizado para plugins
     */
  _setupPluginRequire() {
    this.pluginRequire = createRequire(import.meta.url);
  }
    
  /**
     * Configura hooks por defecto
     */
  _setupDefaultHooks() {
    const defaultHooks = [
      'beforeLoad', 'afterLoad', 'beforeStart', 'afterStart',
      'beforeStop', 'afterStop', 'beforeUnload', 'afterUnload',
      'onError', 'onWarning', 'onStateChange'
    ];
        
    defaultHooks.forEach(hook => {
      this.hooks.set(hook, new Set());
    });
  }
    
  /**
     * Configura la limpieza automática
     */
  _setupCleanup() {
    if (this.config.cache.enabled) {
      this.cleanupInterval = setInterval(() => {
        this._cleanupCache();
      }, this.config.cache.ttl / 2);
    }
  }
    
  /**
     * Inicia el gestor de plugins
     */
  async start() {
    if (!this.state.initialized) {
      throw new Error('Plugin manager not initialized');
    }
        
    if (this.state.running) {
      return;
    }
        
    try {
      this.state.running = true;
            
      if (this.config.autoLoad) {
        await this.loadAllPlugins();
      }
            
      if (this.config.autoStart) {
        await this.startAllPlugins();
      }
            
      this.emit('started');
            
    } catch (error) {
      this.state.running = false;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Detiene el gestor de plugins
     */
  async stop() {
    if (!this.state.running) {
      return;
    }
        
    try {
      // Detener todos los plugins
      await this.stopAllPlugins();
            
      // Descargar todos los plugins
      await this.unloadAllPlugins();
            
      this.state.running = false;
      this.emit('stopped');
            
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Carga un plugin
     */
  async loadPlugin(pluginName, options = {}) {
    if (!this.state.initialized) {
      throw new Error('Plugin manager not initialized');
    }
        
    if (this.plugins.has(pluginName)) {
      throw new Error(`Plugin ${pluginName} already loaded`);
    }
        
    const startTime = Date.now();
        
    try {
      this.state.loading = true;
            
      // Ejecutar hook beforeLoad
      await this._executeHook('beforeLoad', { pluginName, options });
            
      // Cargar metadatos del plugin
      const metadata = await this._loadPluginMetadata(pluginName);
            
      // Validar plugin
      await this._validatePlugin(pluginName, metadata);
            
      // Resolver dependencias
      if (this.config.dependencies.autoResolve) {
        await this._resolveDependencies(pluginName, metadata);
      }
            
      // Cargar configuración del plugin
      const config = await this._loadPluginConfig(pluginName);
            
      // Cargar el módulo del plugin
      const pluginModule = await this._loadPluginModule(pluginName, metadata);
            
      // Crear instancia del plugin
      const pluginInstance = await this._createPluginInstance(
        pluginName, 
        pluginModule, 
        config, 
        metadata
      );
            
      // Almacenar plugin
      this.plugins.set(pluginName, pluginInstance);
      this.pluginConfigs.set(pluginName, config);
      this.pluginStates.set(pluginName, 'loaded');
      this.pluginMetadata.set(pluginName, metadata);
            
      // Actualizar estadísticas
      this.statistics.loadedPlugins++;
      this.statistics.loadTime += Date.now() - startTime;
            
      // Ejecutar hook afterLoad
      await this._executeHook('afterLoad', { 
        pluginName, 
        plugin: pluginInstance, 
        metadata 
      });
            
      this.emit('pluginLoaded', { pluginName, plugin: pluginInstance });
            
      return pluginInstance;
            
    } catch (error) {
      this.statistics.failedPlugins++;
      this.statistics.errors++;
            
      await this._executeHook('onError', { 
        pluginName, 
        error, 
        phase: 'load' 
      });
            
      this.emit('pluginLoadError', { pluginName, error });
      throw error;
            
    } finally {
      this.state.loading = false;
    }
  }
    
  /**
     * Carga los metadatos de un plugin
     */
  async _loadPluginMetadata(pluginName) {
    const metadataPath = path.join(this.config.pluginDir, pluginName, 'plugin.json');
        
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
            
      // Validar metadatos requeridos
      const requiredFields = ['name', 'version', 'main'];
      for (const field of requiredFields) {
        if (!metadata[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
            
      return {
        name: metadata.name,
        version: metadata.version,
        description: metadata.description || '',
        author: metadata.author || '',
        main: metadata.main,
        dependencies: metadata.dependencies || {},
        peerDependencies: metadata.peerDependencies || {},
        permissions: metadata.permissions || [],
        hooks: metadata.hooks || [],
        config: metadata.config || {},
        ...metadata
      };
            
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Plugin metadata not found: ${metadataPath}`);
      }
      throw error;
    }
  }
    
  /**
     * Valida un plugin
     */
  async _validatePlugin(pluginName, metadata) {
    // Validar nombre
    if (metadata.name !== pluginName) {
      throw new Error(`Plugin name mismatch: ${metadata.name} !== ${pluginName}`);
    }
        
    // Validar versión
    if (!this._isValidVersion(metadata.version)) {
      throw new Error(`Invalid plugin version: ${metadata.version}`);
    }
        
    // Validar archivo principal
    const mainPath = path.join(this.config.pluginDir, pluginName, metadata.main);
    try {
      await fs.access(mainPath);
    } catch (error) {
      throw new Error(`Plugin main file not found: ${mainPath}`);
    }
        
    // Validar permisos
    if (metadata.permissions && metadata.permissions.length > 0) {
      await this._validatePermissions(metadata.permissions);
    }
        
    // Validar límites
    if (this.plugins.size >= this.config.maxPlugins) {
      throw new Error(`Maximum number of plugins reached: ${this.config.maxPlugins}`);
    }
  }
    
  /**
     * Valida una versión
     */
  _isValidVersion(version) {
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/;
    return versionRegex.test(version);
  }
    
  /**
     * Valida permisos
     */
  async _validatePermissions(permissions) {
    const allowedPermissions = [];
        
    if (this.config.security.allowFileSystem) {
      allowedPermissions.push('filesystem');
    }
        
    if (this.config.security.allowNetwork) {
      allowedPermissions.push('network');
    }
        
    if (this.config.security.allowProcess) {
      allowedPermissions.push('process');
    }
        
    if (this.config.security.allowNativeModules) {
      allowedPermissions.push('native');
    }
        
    for (const permission of permissions) {
      if (!allowedPermissions.includes(permission)) {
        throw new Error(`Permission not allowed: ${permission}`);
      }
    }
  }
    
  /**
     * Resuelve las dependencias de un plugin
     */
  async _resolveDependencies(pluginName, metadata) {
    const dependencies = metadata.dependencies || {};
    const peerDependencies = metadata.peerDependencies || {};
        
    // Resolver dependencias directas
    for (const [depName, depVersion] of Object.entries(dependencies)) {
      if (!this.plugins.has(depName)) {
        await this.loadPlugin(depName);
      }
            
      // Validar versión de dependencia
      const depMetadata = this.pluginMetadata.get(depName);
      if (depMetadata && !this._isVersionCompatible(depMetadata.version, depVersion)) {
        throw new Error(
          `Incompatible dependency version: ${depName}@${depMetadata.version} ` +
                    `(required: ${depVersion})`
        );
      }
    }
        
    // Validar peer dependencies
    for (const [peerName, peerVersion] of Object.entries(peerDependencies)) {
      if (this.plugins.has(peerName)) {
        const peerMetadata = this.pluginMetadata.get(peerName);
        if (!this._isVersionCompatible(peerMetadata.version, peerVersion)) {
          throw new Error(
            `Incompatible peer dependency version: ${peerName}@${peerMetadata.version} ` +
                        `(required: ${peerVersion})`
          );
        }
      }
    }
        
    // Almacenar dependencias
    this.pluginDependencies.set(pluginName, {
      dependencies: Object.keys(dependencies),
      peerDependencies: Object.keys(peerDependencies)
    });
  }
    
  /**
     * Verifica si una versión es compatible
     */
  _isVersionCompatible(actualVersion, requiredVersion) {
    // Implementación simplificada de compatibilidad semver
    if (requiredVersion.startsWith('^')) {
      const required = requiredVersion.slice(1);
      return this._compareVersions(actualVersion, required) >= 0;
    }
        
    if (requiredVersion.startsWith('~')) {
      const required = requiredVersion.slice(1);
      return this._compareVersions(actualVersion, required) >= 0;
    }
        
    return actualVersion === requiredVersion;
  }
    
  /**
     * Compara dos versiones
     */
  _compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
        
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
            
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
        
    return 0;
  }
    
  /**
     * Carga la configuración de un plugin
     */
  async _loadPluginConfig(pluginName) {
    const configPath = path.join(this.config.configDir, `${pluginName}.json`);
        
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {}; // Configuración por defecto vacía
      }
      throw error;
    }
  }
    
  /**
     * Carga el módulo de un plugin
     */
  async _loadPluginModule(pluginName, metadata) {
    const modulePath = path.join(this.config.pluginDir, pluginName, metadata.main);
        
    try {
      // Limpiar cache si existe
      delete this.pluginRequire.cache[this.pluginRequire.resolve(modulePath)];
            
      // Cargar módulo
      const pluginModule = this.pluginRequire(modulePath);
            
      return pluginModule;
            
    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error.message}`);
    }
  }
    
  /**
     * Crea una instancia del plugin
     */
  async _createPluginInstance(pluginName, pluginModule, config, metadata) {
    try {
      // Crear contexto del plugin
      const context = this._createPluginContext(pluginName, config, metadata);
            
      // Crear instancia
      let pluginInstance;
            
      if (typeof pluginModule === 'function') {
        // Plugin como función constructora
        pluginInstance = new pluginModule(context);
      } else if (pluginModule.default && typeof pluginModule.default === 'function') {
        // Plugin ES6 con export default
        pluginInstance = new pluginModule.default(context);
      } else if (pluginModule.Plugin && typeof pluginModule.Plugin === 'function') {
        // Plugin con export named
        pluginInstance = new pluginModule.Plugin(context);
      } else if (typeof pluginModule === 'object') {
        // Plugin como objeto
        pluginInstance = pluginModule;
        pluginInstance.context = context;
      } else {
        throw new Error('Invalid plugin module format');
      }
            
      // Validar interfaz del plugin
      await this._validatePluginInterface(pluginInstance);
            
      return pluginInstance;
            
    } catch (error) {
      throw new Error(`Failed to create plugin instance: ${error.message}`);
    }
  }
    
  /**
     * Crea el contexto para un plugin
     */
  _createPluginContext(pluginName, config, metadata) {
    return {
      name: pluginName,
      version: metadata.version,
      config: config,
      metadata: metadata,
            
      // API del plugin manager
      manager: {
        getPlugin: (name) => this.getPlugin(name),
        getPlugins: () => this.getPlugins(),
        emit: (event, data) => this.emit(`plugin:${pluginName}:${event}`, data),
        on: (event, listener) => this.on(`plugin:${pluginName}:${event}`, listener),
        off: (event, listener) => this.off(`plugin:${pluginName}:${event}`, listener),
                
        // Hooks
        addHook: (hook, listener) => this.addHook(hook, listener),
        removeHook: (hook, listener) => this.removeHook(hook, listener),
        executeHook: (hook, data) => this._executeHook(hook, data),
                
        // Logging
        log: (level, message, data) => this.emit('log', {
          plugin: pluginName,
          level,
          message,
          data,
          timestamp: new Date().toISOString()
        })
      },
            
      // Utilidades
      utils: {
        path: path,
        require: this.pluginRequire
      }
    };
  }
    
  /**
     * Valida la interfaz de un plugin
     */
  async _validatePluginInterface(pluginInstance) {
    // Métodos requeridos
    const requiredMethods = ['start', 'stop'];
        
    for (const method of requiredMethods) {
      if (typeof pluginInstance[method] !== 'function') {
        throw new Error(`Plugin missing required method: ${method}`);
      }
    }
        
    // Métodos opcionales
    const optionalMethods = ['initialize', 'destroy', 'configure'];
        
    for (const method of optionalMethods) {
      if (pluginInstance[method] && typeof pluginInstance[method] !== 'function') {
        throw new Error(`Plugin method ${method} must be a function`);
      }
    }
  }
    
  /**
     * Inicia un plugin
     */
  async startPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
        
    const currentState = this.pluginStates.get(pluginName);
    if (currentState === 'running') {
      return;
    }
        
    try {
      // Ejecutar hook beforeStart
      await this._executeHook('beforeStart', { pluginName, plugin });
            
      // Inicializar plugin si es necesario
      if (plugin.initialize && currentState === 'loaded') {
        await this._executeWithTimeout(
          plugin.initialize(),
          this.config.startTimeout,
          `Plugin ${pluginName} initialization timeout`
        );
      }
            
      // Iniciar plugin
      await this._executeWithTimeout(
        plugin.start(),
        this.config.startTimeout,
        `Plugin ${pluginName} start timeout`
      );
            
      // Actualizar estado
      this.pluginStates.set(pluginName, 'running');
      this.statistics.activePlugins++;
            
      // Ejecutar hook afterStart
      await this._executeHook('afterStart', { pluginName, plugin });
            
      this.emit('pluginStarted', { pluginName, plugin });
            
    } catch (error) {
      this.statistics.errors++;
            
      await this._executeHook('onError', { 
        pluginName, 
        error, 
        phase: 'start' 
      });
            
      this.emit('pluginStartError', { pluginName, error });
      throw error;
    }
  }
    
  /**
     * Detiene un plugin
     */
  async stopPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
        
    const currentState = this.pluginStates.get(pluginName);
    if (currentState !== 'running') {
      return;
    }
        
    try {
      // Ejecutar hook beforeStop
      await this._executeHook('beforeStop', { pluginName, plugin });
            
      // Detener plugin
      await this._executeWithTimeout(
        plugin.stop(),
        this.config.stopTimeout,
        `Plugin ${pluginName} stop timeout`
      );
            
      // Actualizar estado
      this.pluginStates.set(pluginName, 'stopped');
      this.statistics.activePlugins--;
            
      // Ejecutar hook afterStop
      await this._executeHook('afterStop', { pluginName, plugin });
            
      this.emit('pluginStopped', { pluginName, plugin });
            
    } catch (error) {
      this.statistics.errors++;
            
      await this._executeHook('onError', { 
        pluginName, 
        error, 
        phase: 'stop' 
      });
            
      this.emit('pluginStopError', { pluginName, error });
      throw error;
    }
  }
    
  /**
     * Descarga un plugin
     */
  async unloadPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return;
    }
        
    try {
      // Detener plugin si está ejecutándose
      const currentState = this.pluginStates.get(pluginName);
      if (currentState === 'running') {
        await this.stopPlugin(pluginName);
      }
            
      // Ejecutar hook beforeUnload
      await this._executeHook('beforeUnload', { pluginName, plugin });
            
      // Destruir plugin si es necesario
      if (plugin.destroy) {
        await this._executeWithTimeout(
          plugin.destroy(),
          this.config.stopTimeout,
          `Plugin ${pluginName} destroy timeout`
        );
      }
            
      // Remover plugin
      this.plugins.delete(pluginName);
      this.pluginConfigs.delete(pluginName);
      this.pluginStates.delete(pluginName);
      this.pluginDependencies.delete(pluginName);
      this.pluginMetadata.delete(pluginName);
            
      // Actualizar estadísticas
      this.statistics.loadedPlugins--;
            
      // Ejecutar hook afterUnload
      await this._executeHook('afterUnload', { pluginName });
            
      this.emit('pluginUnloaded', { pluginName });
            
    } catch (error) {
      this.statistics.errors++;
            
      await this._executeHook('onError', { 
        pluginName, 
        error, 
        phase: 'unload' 
      });
            
      this.emit('pluginUnloadError', { pluginName, error });
      throw error;
    }
  }
    
  /**
     * Carga todos los plugins disponibles
     */
  async loadAllPlugins() {
    try {
      const pluginDirs = await fs.readdir(this.config.pluginDir);
      const loadPromises = [];
            
      for (const pluginDir of pluginDirs) {
        const pluginPath = path.join(this.config.pluginDir, pluginDir);
        const stat = await fs.stat(pluginPath);
                
        if (stat.isDirectory() && !this.plugins.has(pluginDir)) {
          loadPromises.push(
            this.loadPlugin(pluginDir).catch(error => {
              this.emit('pluginLoadError', { 
                pluginName: pluginDir, 
                error 
              });
            })
          );
        }
      }
            
      await Promise.all(loadPromises);
            
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Inicia todos los plugins cargados
     */
  async startAllPlugins() {
    const startPromises = [];
        
    for (const [pluginName] of this.plugins) {
      const state = this.pluginStates.get(pluginName);
      if (state === 'loaded' || state === 'stopped') {
        startPromises.push(
          this.startPlugin(pluginName).catch(error => {
            this.emit('pluginStartError', { 
              pluginName, 
              error 
            });
          })
        );
      }
    }
        
    await Promise.all(startPromises);
  }
    
  /**
     * Detiene todos los plugins activos
     */
  async stopAllPlugins() {
    const stopPromises = [];
        
    for (const [pluginName] of this.plugins) {
      const state = this.pluginStates.get(pluginName);
      if (state === 'running') {
        stopPromises.push(
          this.stopPlugin(pluginName).catch(error => {
            this.emit('pluginStopError', { 
              pluginName, 
              error 
            });
          })
        );
      }
    }
        
    await Promise.all(stopPromises);
  }
    
  /**
     * Descarga todos los plugins
     */
  async unloadAllPlugins() {
    const unloadPromises = [];
        
    for (const [pluginName] of this.plugins) {
      unloadPromises.push(
        this.unloadPlugin(pluginName).catch(error => {
          this.emit('pluginUnloadError', { 
            pluginName, 
            error 
          });
        })
      );
    }
        
    await Promise.all(unloadPromises);
  }
    
  /**
     * Ejecuta una operación con timeout
     */
  async _executeWithTimeout(promise, timeout, errorMessage) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeout);
            
      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
    
  /**
     * Añade un hook
     */
  addHook(hookName, listener) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set());
    }
        
    const hookListeners = this.hooks.get(hookName);
    if (hookListeners.size >= this.config.hooks.maxListeners) {
      throw new Error(`Maximum hook listeners reached for ${hookName}`);
    }
        
    hookListeners.add(listener);
        
    // Actualizar índice de listeners
    if (!this.hookListeners.has(listener)) {
      this.hookListeners.set(listener, new Set());
    }
    this.hookListeners.get(listener).add(hookName);
  }
    
  /**
     * Remueve un hook
     */
  removeHook(hookName, listener) {
    if (this.hooks.has(hookName)) {
      this.hooks.get(hookName).delete(listener);
    }
        
    if (this.hookListeners.has(listener)) {
      this.hookListeners.get(listener).delete(hookName);
      if (this.hookListeners.get(listener).size === 0) {
        this.hookListeners.delete(listener);
      }
    }
  }
    
  /**
     * Ejecuta un hook
     */
  async _executeHook(hookName, data = {}) {
    if (!this.config.hooks.enabled || !this.hooks.has(hookName)) {
      return;
    }
        
    const listeners = this.hooks.get(hookName);
    const promises = [];
        
    for (const listener of listeners) {
      try {
        const promise = this._executeWithTimeout(
          Promise.resolve(listener(data)),
          this.config.hooks.timeout,
          `Hook ${hookName} timeout`
        );
        promises.push(promise);
      } catch (error) {
        this.emit('hookError', { hookName, listener, error });
      }
    }
        
    try {
      await Promise.all(promises);
    } catch (error) {
      this.emit('hookError', { hookName, error });
    }
  }
    
  /**
     * Obtiene un plugin
     */
  getPlugin(pluginName) {
    return this.plugins.get(pluginName);
  }
    
  /**
     * Obtiene todos los plugins
     */
  getPlugins() {
    return new Map(this.plugins);
  }
    
  /**
     * Obtiene el estado de un plugin
     */
  getPluginState(pluginName) {
    return this.pluginStates.get(pluginName);
  }
    
  /**
     * Obtiene los metadatos de un plugin
     */
  getPluginMetadata(pluginName) {
    return this.pluginMetadata.get(pluginName);
  }
    
  /**
     * Obtiene la configuración de un plugin
     */
  getPluginConfig(pluginName) {
    return this.pluginConfigs.get(pluginName);
  }
    
  /**
     * Obtiene las dependencias de un plugin
     */
  getPluginDependencies(pluginName) {
    return this.pluginDependencies.get(pluginName);
  }
    
  /**
     * Obtiene estadísticas del gestor
     */
  getStatistics() {
    return {
      ...this.statistics,
      totalPlugins: this.plugins.size
    };
  }
    
  /**
     * Limpia el cache
     */
  _cleanupCache() {
    if (!this.config.cache.enabled) {
      return;
    }
        
    const now = Date.now();
    const ttl = this.config.cache.ttl;
        
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > ttl) {
        this.cache.delete(key);
      }
    }
        
    // Limitar tamaño del cache
    if (this.cache.size > this.config.cache.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
      const toDelete = entries.slice(0, entries.length - this.config.cache.maxSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }
    
  /**
     * Habilita el gestor de plugins
     */
  enable() {
    this.config.enabled = true;
    this.emit('enabled');
  }
    
  /**
     * Deshabilita el gestor de plugins
     */
  disable() {
    this.config.enabled = false;
    this.emit('disabled');
  }
    
  /**
     * Destruye el gestor de plugins
     */
  async destroy() {
    try {
      // Detener el gestor
      await this.stop();
            
      // Limpiar timers
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
            
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
            
      // Limpiar datos
      this.plugins.clear();
      this.pluginConfigs.clear();
      this.pluginStates.clear();
      this.pluginDependencies.clear();
      this.pluginMetadata.clear();
      this.hooks.clear();
      this.hookListeners.clear();
      this.cache.clear();
      this.timers.clear();
            
      // Remover todos los listeners
      this.removeAllListeners();
            
      this.emit('destroyed');
            
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
}

export default PluginManager;
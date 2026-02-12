/**
 * Module Communicator - Comunicador central entre módulos
 * Optimiza la comunicación, eventos y dependencias entre todos los módulos del sistema
 */

import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import { createLogger } from '../services/core/core/logger.js';

class ModuleCommunicator extends EventEmitter {
  constructor() {
    super();
    this.baseDir = process.cwd();
    this.modulesDir = path.join(this.baseDir, 'src', 'modules');
    this.configDir = path.join(this.baseDir, 'config');
        
    this.modules = new Map();
    this.moduleStatus = new Map();
    this.dependencies = new Map();
    this.eventHistory = [];
    this.maxEventHistory = 1000;
        
    this.config = {
      autoRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      eventTimeout: 10000,
      logLevel: 'info'
    };

    this.isInitialized = false;
    this.healthCheckTimer = null;
    this.logger = createLogger('MODULE_COMMUNICATOR');
        
    // Configurar manejo de errores
    this.setMaxListeners(50);
    this.on('error', this.handleModuleError.bind(this));
  }

  /**
     * Inicializar el comunicador de módulos
     */
  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.ensureDirectories();
      await this.loadConfig();
      await this.discoverModules();
      await this.initializeModules();
      await this.setupDependencies();
      this.startHealthCheck();
            
      this.isInitialized = true;
      this.logger.info('ModuleCommunicator inicializado correctamente');
            
      this.emit('system:initialized');
            
      return { success: true, message: 'ModuleCommunicator inicializado' };
            
    } catch (error) {
      this.logger.error('Error inicializando ModuleCommunicator:', error);
      throw error;
    }
  }

  /**
     * Asegurar directorios necesarios
     */
  async ensureDirectories() {
    const directories = [
      this.configDir,
      path.join(this.baseDir, 'data', 'modules'),
      path.join(this.baseDir, 'logs', 'modules')
    ];

    for (const dir of directories) {
      await fs.ensureDir(dir);
    }
  }

  /**
     * Cargar configuración
     */
  async loadConfig() {
    try {
      const configPath = path.join(this.configDir, 'module-communicator.json');
      if (await fs.pathExists(configPath)) {
        const savedConfig = await fs.readJson(configPath);
        this.config = { ...this.config, ...savedConfig };
      } else {
        await this.saveConfig();
      }
    } catch (error) {
      this.logger.warn('Error cargando configuración, usando valores por defecto');
    }
  }

  /**
     * Guardar configuración
     */
  async saveConfig() {
    try {
      const configPath = path.join(this.configDir, 'module-communicator.json');
      await fs.writeJson(configPath, this.config, { spaces: 2 });
    } catch (error) {
      this.logger.error('Error guardando configuración:', error);
    }
  }

  /**
     * Descubrir módulos disponibles
     */
  async discoverModules() {
    try {
      const moduleFiles = await fs.readdir(this.modulesDir);
      const jsFiles = moduleFiles.filter(file => 
        file.endsWith('.js') && 
                file !== 'module_communicator.js' &&
                !file.startsWith('.')
      );

      this.logger.info(`Descubriendo ${jsFiles.length} módulos...`);

      for (const file of jsFiles) {
        const moduleName = path.basename(file, '.js');
        const modulePath = path.join(this.modulesDir, file);
                
        try {
          // Importar módulo dinámicamente
          const moduleExport = await import(`file://${modulePath}`);
          let moduleInstance;

          if (typeof moduleExport.default === 'function') {
            // If the default export is a class, instantiate it with the communicator
            moduleInstance = new moduleExport.default(this);
          } else {
            // Otherwise, use the default export as the instance
            moduleInstance = moduleExport.default;
          }
                    
          if (moduleInstance && typeof moduleInstance === 'object') {
            this.modules.set(moduleName, {
              instance: moduleInstance,
              path: modulePath,
              name: moduleName,
              status: 'discovered',
              lastHealthCheck: null,
              errors: [],
              dependencies: this.extractDependencies(moduleInstance)
            });
                        
            this.logger.info(`Módulo descubierto: ${moduleName}`);
          }
        } catch (error) {
          this.logger.error(`Error importando módulo ${moduleName}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error descubriendo módulos:', error);
      throw error;
    }
  }

  /**
     * Inicializar todos los módulos
     */
  async initializeModules() {
    const initOrder = this.calculateInitializationOrder();
        
    for (const moduleName of initOrder) {
      await this.initializeModule(moduleName);
    }
  }

  /**
     * Inicializar un módulo específico
     */
  async initializeModule(moduleName) {
    const moduleData = this.modules.get(moduleName);
    if (!moduleData) {
      throw new Error(`Módulo no encontrado: ${moduleName}`);
    }

    try {
      this.logger.info(`Inicializando módulo: ${moduleName}`);
            
      const instance = moduleData.instance;
            
      // Verificar si el módulo tiene método initialize
      if (typeof instance.initialize === 'function') {
        await instance.initialize();
      }
            
      // Actualizar estado
      moduleData.status = 'initialized';
      moduleData.lastHealthCheck = Date.now();
      this.moduleStatus.set(moduleName, 'healthy');
            
      // Configurar eventos del módulo si los tiene
      this.setupModuleEvents(moduleName, instance);
            
      this.logger.info(`Módulo inicializado: ${moduleName}`);
      this.emit('module:initialized', { moduleName, instance });
            
    } catch (error) {
      moduleData.status = 'error';
      moduleData.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        action: 'initialize'
      });
            
      this.logger.error(`Error inicializando módulo ${moduleName}:`, error);
      this.emit('module:error', { moduleName, error });
            
      if (this.config.autoRetry) {
        await this.retryModuleInitialization(moduleName);
      }
    }
  }

  /**
     * Configurar eventos de un módulo
     */
  setupModuleEvents(moduleName, instance) {
    // Si el módulo es un EventEmitter, reenviar sus eventos
    if (instance instanceof EventEmitter) {
      instance.on('error', (error) => {
        this.emit('module:error', { moduleName, error });
      });
            
      instance.on('warning', (warning) => {
        this.emit('module:warning', { moduleName, warning });
      });
            
      instance.on('status', (status) => {
        this.moduleStatus.set(moduleName, status);
        this.emit('module:status', { moduleName, status });
      });
    }
  }

  /**
     * Calcular orden de inicialización basado en dependencias
     */
  calculateInitializationOrder() {
    const order = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (moduleName) => {
      if (visiting.has(moduleName)) {
        throw new Error(`Dependencia circular detectada: ${moduleName}`);
      }
            
      if (visited.has(moduleName)) {
        return;
      }

      visiting.add(moduleName);
            
      const moduleData = this.modules.get(moduleName);
      if (moduleData && moduleData.dependencies) {
        for (const dep of moduleData.dependencies) {
          if (this.modules.has(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(moduleName);
      visited.add(moduleName);
      order.push(moduleName);
    };

    for (const moduleName of this.modules.keys()) {
      visit(moduleName);
    }

    return order;
  }

  /**
     * Extraer dependencias de un módulo
     */
  extractDependencies(moduleInstance) {
    const dependencies = [];
        
    // Buscar imports o referencias a otros módulos
    if (moduleInstance.dependencies && Array.isArray(moduleInstance.dependencies)) {
      dependencies.push(...moduleInstance.dependencies);
    }
        
    return dependencies;
  }

  /**
     * Configurar dependencias entre módulos
     */
  async setupDependencies() {
    for (const [moduleName, moduleData] of this.modules) {
      if (moduleData.dependencies && moduleData.dependencies.length > 0) {
        this.dependencies.set(moduleName, moduleData.dependencies);
                
        // Verificar que todas las dependencias estén disponibles
        for (const dep of moduleData.dependencies) {
          if (!this.modules.has(dep)) {
            this.logger.warn(`Dependencia no encontrada para ${moduleName}: ${dep}`);
          }
        }
      }
    }
  }

  /**
     * Comunicación entre módulos
     */
  async callModule(moduleName, methodName, ...args) {
    const moduleData = this.modules.get(moduleName);
    if (!moduleData) {
      throw new Error(`Módulo no encontrado: ${moduleName}`);
    }

    if (moduleData.status !== 'initialized') {
      throw new Error(`Módulo no inicializado: ${moduleName}`);
    }

    const instance = moduleData.instance;
    if (typeof instance[methodName] !== 'function') {
      throw new Error(`Método no encontrado: ${moduleName}.${methodName}`);
    }

    try {
      this.logger.debug(`Llamando ${moduleName}.${methodName}`);
            
      const result = await Promise.race([
        instance[methodName](...args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.config.eventTimeout)
        )
      ]);
            
      this.emit('module:call', { moduleName, methodName, success: true });
      return result;
            
    } catch (error) {
      this.logger.error(`Error llamando ${moduleName}.${methodName}:`, error);
      this.emit('module:call', { moduleName, methodName, success: false, error });
      throw error;
    }
  }

  /**
     * Enviar evento a módulos específicos
     */
  async broadcastEvent(eventName, data, targetModules = null) {
    const timestamp = new Date().toISOString();
    const eventId = this.generateId();
        
    const eventData = {
      id: eventId,
      name: eventName,
      data,
      timestamp,
      targets: targetModules
    };

    // Agregar a historial
    this.addToEventHistory(eventData);

    const targets = targetModules || Array.from(this.modules.keys());
    const results = [];

    for (const moduleName of targets) {
      const moduleData = this.modules.get(moduleName);
      if (!moduleData || moduleData.status !== 'initialized') {
        continue;
      }

      try {
        const instance = moduleData.instance;
                
        // Si el módulo tiene método handleEvent
        if (typeof instance.handleEvent === 'function') {
          const result = await instance.handleEvent(eventName, data);
          results.push({ moduleName, success: true, result });
        }
                
        // Si el módulo es EventEmitter
        if (instance instanceof EventEmitter) {
          instance.emit(eventName, data);
          results.push({ moduleName, success: true, result: 'emitted' });
        }
                
      } catch (error) {
        this.logger.error(`Error enviando evento ${eventName} a ${moduleName}:`, error);
        results.push({ moduleName, success: false, error: error.message });
      }
    }

    this.emit('event:broadcast', { eventData, results });
    return results;
  }

  /**
     * Obtener estado de un módulo
     */
  getModuleStatus(moduleName) {
    const moduleData = this.modules.get(moduleName);
    if (!moduleData) {
      return null;
    }

    return {
      name: moduleName,
      status: moduleData.status,
      health: this.moduleStatus.get(moduleName) || 'unknown',
      lastHealthCheck: moduleData.lastHealthCheck,
      errors: moduleData.errors,
      dependencies: moduleData.dependencies
    };
  }

  /**
     * Obtener estado de todos los módulos
     */
  getAllModulesStatus() {
    const status = {};
        
    for (const moduleName of this.modules.keys()) {
      status[moduleName] = this.getModuleStatus(moduleName);
    }
        
    return status;
  }

  /**
     * Verificar salud de los módulos
     */
  async performHealthCheck() {
    const results = {};
        
    for (const [moduleName, moduleData] of this.modules) {
      if (moduleData.status !== 'initialized') {
        results[moduleName] = 'not_initialized';
        continue;
      }

      try {
        const instance = moduleData.instance;
                
        // Si el módulo tiene método healthCheck
        if (typeof instance.healthCheck === 'function') {
          const health = await instance.healthCheck();
          results[moduleName] = health ? 'healthy' : 'unhealthy';
        } else {
          // Verificación básica
          results[moduleName] = 'healthy';
        }
                
        moduleData.lastHealthCheck = Date.now();
        this.moduleStatus.set(moduleName, results[moduleName]);
                
      } catch (error) {
        results[moduleName] = 'error';
        this.moduleStatus.set(moduleName, 'error');
                
        moduleData.errors.push({
          timestamp: new Date().toISOString(),
          error: error.message,
          action: 'health_check'
        });
                
        this.logger.error(`Error en health check de ${moduleName}:`, error);
      }
    }

    this.emit('health:check', results);
    return results;
  }

  /**
     * Iniciar verificación periódica de salud
     */
  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async() => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.logger.info('Health check iniciado');
  }

  /**
     * Detener verificación de salud
     */
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.logger.info('Health check detenido');
    }
  }

  /**
     * Reintentar inicialización de módulo
     */
  async retryModuleInitialization(moduleName, attempt = 1) {
    if (attempt > this.config.maxRetries) {
      this.logger.error(`Máximo de reintentos alcanzado para ${moduleName}`);
      return false;
    }

    this.logger.info(`Reintentando inicialización de ${moduleName} (intento ${attempt})`);
        
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        
    try {
      await this.initializeModule(moduleName);
      return true;
    } catch (error) {
      return await this.retryModuleInitialization(moduleName, attempt + 1);
    }
  }

  /**
     * Manejar errores de módulos
     */
  handleModuleError(error) {
    this.logger.error('Error en módulo:', error);
        
    // Aquí se podría implementar lógica de recuperación automática
    // Por ejemplo, reiniciar módulos críticos
  }

  /**
     * Agregar evento al historial
     */
  addToEventHistory(eventData) {
    this.eventHistory.push(eventData);
        
    // Mantener solo los últimos eventos
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxEventHistory);
    }
  }

  /**
     * Obtener historial de eventos
     */
  getEventHistory(limit = 100) {
    return this.eventHistory.slice(-limit);
  }

  /**
     * Limpiar historial de eventos
     */
  clearEventHistory() {
    this.eventHistory = [];
    this.emit('history:cleared');
  }

  /**
     * Obtener estadísticas del comunicador
     */
  getStats() {
    const totalModules = this.modules.size;
    const initializedModules = Array.from(this.modules.values())
      .filter(m => m.status === 'initialized').length;
    const healthyModules = Array.from(this.moduleStatus.values())
      .filter(status => status === 'healthy').length;
        
    return {
      totalModules,
      initializedModules,
      healthyModules,
      totalEvents: this.eventHistory.length,
      uptime: this.isInitialized ? Date.now() - this.initTime : 0,
      dependencies: this.dependencies.size
    };
  }

  /**
     * Cerrar comunicador
     */
  async shutdown() {
    this.logger.info('Cerrando ModuleCommunicator...');
        
    this.stopHealthCheck();
        
    // Cerrar módulos en orden inverso
    const shutdownOrder = this.calculateInitializationOrder().reverse();
        
    for (const moduleName of shutdownOrder) {
      await this.shutdownModule(moduleName);
    }
        
    this.modules.clear();
    this.moduleStatus.clear();
    this.dependencies.clear();
    this.isInitialized = false;
        
    this.emit('system:shutdown');
    this.logger.info('ModuleCommunicator cerrado');
  }

  /**
     * Cerrar un módulo específico
     */
  async shutdownModule(moduleName) {
    const moduleData = this.modules.get(moduleName);
    if (!moduleData) return;

    try {
      const instance = moduleData.instance;
            
      if (typeof instance.shutdown === 'function') {
        await instance.shutdown();
      }
            
      moduleData.status = 'shutdown';
      this.logger.info(`Módulo cerrado: ${moduleName}`);
            
    } catch (error) {
      this.logger.error(`Error cerrando módulo ${moduleName}:`, error);
    }
  }

  // Métodos de utilidad

  /**
     * Generar ID único
     */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }


}

// Crear instancia global
const moduleCommunicator = new ModuleCommunicator();

export default moduleCommunicator;
export { ModuleCommunicator };
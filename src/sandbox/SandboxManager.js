import { SecureSandbox } from './SecureSandbox.js';
import { createLogger } from '../services/core/core/logger.js';
import { EventEmitter } from 'events';
import path from 'path';

const logger = createLogger('SANDBOX_MANAGER');

/**
 * Manager para múltiples entornos sandbox
 * Coordina la creación, gestión y limpieza de sandboxes seguros
 */
export class SandboxManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Configuración de sandboxes
      maxSandboxes: options.maxSandboxes || 10,
      defaultTimeout: options.defaultTimeout || 5000,
      defaultMemoryLimit: options.defaultMemoryLimit || 50 * 1024 * 1024,
      
      // Configuración de limpieza
      cleanupInterval: options.cleanupInterval || 300000, // 5 minutos
      maxIdleTime: options.maxIdleTime || 600000, // 10 minutos
      
      // Configuración de perfiles
      profiles: {
        // Perfil básico para pruebas simples
        basic: {
          timeout: 3000,
          memoryLimit: 10 * 1024 * 1024, // 10MB
          allowedModules: ['crypto', 'util'],
          allowFileSystem: false,
          allowNetwork: false,
          allowProcess: false
        },
        
        // Perfil estándar para desarrollo
        standard: {
          timeout: 5000,
          memoryLimit: 50 * 1024 * 1024, // 50MB
          allowedModules: ['crypto', 'util', 'events', 'stream', 'buffer'],
          allowFileSystem: false,
          allowNetwork: false,
          allowProcess: true
        },
        
        // Perfil avanzado para testing
        testing: {
          timeout: 10000,
          memoryLimit: 100 * 1024 * 1024, // 100MB
          allowedModules: ['crypto', 'util', 'events', 'stream', 'buffer', 'assert'],
          allowFileSystem: true,
          allowNetwork: false,
          allowProcess: true,
          customGlobals: {
            test: true,
            jest: global.jest || undefined
          }
        },
        
        // Perfil de desarrollo con más permisos
        development: {
          timeout: 15000,
          memoryLimit: 200 * 1024 * 1024, // 200MB
          allowedModules: ['crypto', 'util', 'events', 'stream', 'buffer', 'path', 'url'],
          allowFileSystem: true,
          allowNetwork: true,
          allowProcess: true
        }
      },
      
      ...options
    };
    
    this.sandboxes = new Map();
    this.sandboxStats = new Map();
    this.cleanupTimer = null;
    
    this.initialize();
  }
  
  /**
   * Inicializar el manager
   */
  initialize() {
    logger.info('Inicializando SandboxManager...');
    
    // Configurar limpieza automática
    this.setupCleanup();
    
    // Configurar manejo de eventos
    this.setupEventHandlers();
    
    logger.info(`SandboxManager inicializado - Máximo ${this.config.maxSandboxes} sandboxes`);
  }
  
  /**
   * Configurar limpieza automática
   */
  setupCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleSandboxes();
    }, this.config.cleanupInterval);
  }
  
  /**
   * Configurar manejo de eventos
   */
  setupEventHandlers() {
    // Manejar cierre del proceso
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('exit', () => this.shutdown());
  }
  
  /**
   * Crear un nuevo sandbox
   */
  async createSandbox(id, profile = 'standard', customOptions = {}) {
    if (this.sandboxes.has(id)) {
      throw new Error(`Sandbox con ID '${id}' ya existe`);
    }
    
    if (this.sandboxes.size >= this.config.maxSandboxes) {
      throw new Error(`Límite de sandboxes alcanzado: ${this.config.maxSandboxes}`);
    }
    
    // Obtener configuración del perfil
    const profileConfig = this.config.profiles[profile];
    if (!profileConfig) {
      throw new Error(`Perfil de sandbox desconocido: ${profile}`);
    }
    
    // Combinar configuraciones
    const sandboxConfig = {
      ...profileConfig,
      ...customOptions
    };
    
    try {
      // Crear sandbox
      const sandbox = new SecureSandbox(sandboxConfig);
      
      // Configurar eventos del sandbox
      this.setupSandboxEvents(sandbox, id);
      
      // Registrar sandbox
      this.sandboxes.set(id, {
        sandbox,
        profile,
        config: sandboxConfig,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        executionCount: 0
      });
      
      // Inicializar estadísticas
      this.sandboxStats.set(id, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        memoryUsage: 0
      });
      
      logger.info(`Sandbox '${id}' creado con perfil '${profile}'`);
      this.emit('sandbox:created', { id, profile, config: sandboxConfig });
      
      return sandbox;
      
    } catch (error) {
      logger.error(`Error creando sandbox '${id}':`, error);
      throw error;
    }
  }
  
  /**
   * Configurar eventos del sandbox
   */
  setupSandboxEvents(sandbox, id) {
    sandbox.on('execution:success', (data) => {
      this.updateSandboxStats(id, true, data.executionTime);
      this.emit('execution:success', { sandboxId: id, ...data });
    });
    
    sandbox.on('execution:error', (data) => {
      this.updateSandboxStats(id, false, data.executionTime);
      this.emit('execution:error', { sandboxId: id, ...data });
    });
  }
  
  /**
   * Obtener sandbox por ID
   */
  getSandbox(id) {
    const sandboxInfo = this.sandboxes.get(id);
    if (!sandboxInfo) {
      throw new Error(`Sandbox '${id}' no encontrado`);
    }
    
    // Actualizar último uso
    sandboxInfo.lastUsed = Date.now();
    
    return sandboxInfo.sandbox;
  }
  
  /**
   * Ejecutar código en un sandbox
   */
  async execute(sandboxId, code, options = {}) {
    const sandbox = this.getSandbox(sandboxId);
    const sandboxInfo = this.sandboxes.get(sandboxId);
    
    try {
      // Incrementar contador de ejecuciones
      sandboxInfo.executionCount++;
      
      // Ejecutar código
      const result = await sandbox.execute(code, options);
      
      logger.debug(`Código ejecutado exitosamente en sandbox '${sandboxId}'`);
      return result;
      
    } catch (error) {
      logger.error(`Error ejecutando código en sandbox '${sandboxId}':`, error);
      throw error;
    }
  }
  
  /**
   * Ejecutar código con sandbox temporal
   */
  async executeTemporary(code, profile = 'basic', options = {}) {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Crear sandbox temporal
      const sandbox = await this.createSandbox(tempId, profile);
      
      // Ejecutar código
      const result = await this.execute(tempId, code, options);
      
      // Limpiar sandbox temporal
      await this.destroySandbox(tempId);
      
      return result;
      
    } catch (error) {
      // Asegurar limpieza en caso de error
      if (this.sandboxes.has(tempId)) {
        await this.destroySandbox(tempId);
      }
      throw error;
    }
  }
  
  /**
   * Actualizar estadísticas del sandbox
   */
  updateSandboxStats(id, success, executionTime) {
    const stats = this.sandboxStats.get(id);
    if (!stats) return;
    
    stats.totalExecutions++;
    stats.totalExecutionTime += executionTime;
    stats.averageExecutionTime = stats.totalExecutionTime / stats.totalExecutions;
    
    if (success) {
      stats.successfulExecutions++;
    } else {
      stats.failedExecutions++;
    }
    
    // Actualizar uso de memoria
    if (process.memoryUsage) {
      stats.memoryUsage = process.memoryUsage().heapUsed;
    }
  }
  
  /**
   * Obtener estadísticas de un sandbox
   */
  getSandboxStats(id) {
    const sandboxInfo = this.sandboxes.get(id);
    const stats = this.sandboxStats.get(id);
    
    if (!sandboxInfo || !stats) {
      throw new Error(`Sandbox '${id}' no encontrado`);
    }
    
    return {
      id,
      profile: sandboxInfo.profile,
      createdAt: sandboxInfo.createdAt,
      lastUsed: sandboxInfo.lastUsed,
      executionCount: sandboxInfo.executionCount,
      uptime: Date.now() - sandboxInfo.createdAt,
      idleTime: Date.now() - sandboxInfo.lastUsed,
      ...stats,
      successRate: stats.totalExecutions > 0 
        ? (stats.successfulExecutions / stats.totalExecutions) * 100 
        : 0
    };
  }
  
  /**
   * Obtener estadísticas globales
   */
  getGlobalStats() {
    const sandboxes = Array.from(this.sandboxes.keys());
    const totalStats = {
      totalSandboxes: sandboxes.length,
      activeSandboxes: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalMemoryUsage: 0,
      profiles: {}
    };
    
    let totalExecutionTime = 0;
    
    for (const id of sandboxes) {
      const sandboxInfo = this.sandboxes.get(id);
      const stats = this.sandboxStats.get(id);
      
      if (!sandboxInfo || !stats) continue;
      
      // Contar sandboxes activos (usados en los últimos 5 minutos)
      if (Date.now() - sandboxInfo.lastUsed < 300000) {
        totalStats.activeSandboxes++;
      }
      
      // Acumular estadísticas
      totalStats.totalExecutions += stats.totalExecutions;
      totalStats.successfulExecutions += stats.successfulExecutions;
      totalStats.failedExecutions += stats.failedExecutions;
      totalExecutionTime += stats.totalExecutionTime;
      totalStats.totalMemoryUsage += stats.memoryUsage;
      
      // Contar por perfil
      const profile = sandboxInfo.profile;
      if (!totalStats.profiles[profile]) {
        totalStats.profiles[profile] = 0;
      }
      totalStats.profiles[profile]++;
    }
    
    // Calcular promedios
    if (totalStats.totalExecutions > 0) {
      totalStats.averageExecutionTime = totalExecutionTime / totalStats.totalExecutions;
      totalStats.successRate = (totalStats.successfulExecutions / totalStats.totalExecutions) * 100;
    }
    
    return totalStats;
  }
  
  /**
   * Listar todos los sandboxes
   */
  listSandboxes() {
    return Array.from(this.sandboxes.keys()).map(id => {
      const sandboxInfo = this.sandboxes.get(id);
      return {
        id,
        profile: sandboxInfo.profile,
        createdAt: sandboxInfo.createdAt,
        lastUsed: sandboxInfo.lastUsed,
        executionCount: sandboxInfo.executionCount,
        uptime: Date.now() - sandboxInfo.createdAt,
        idleTime: Date.now() - sandboxInfo.lastUsed
      };
    });
  }
  
  /**
   * Limpiar sandboxes inactivos
   */
  cleanupIdleSandboxes() {
    const now = Date.now();
    const toCleanup = [];
    
    for (const [id, sandboxInfo] of this.sandboxes) {
      const idleTime = now - sandboxInfo.lastUsed;
      if (idleTime > this.config.maxIdleTime) {
        toCleanup.push(id);
      }
    }
    
    if (toCleanup.length > 0) {
      logger.info(`Limpiando ${toCleanup.length} sandboxes inactivos`);
      
      for (const id of toCleanup) {
        this.destroySandbox(id).catch(error => {
          logger.error(`Error limpiando sandbox '${id}':`, error);
        });
      }
    }
  }
  
  /**
   * Destruir un sandbox
   */
  async destroySandbox(id) {
    const sandboxInfo = this.sandboxes.get(id);
    if (!sandboxInfo) {
      throw new Error(`Sandbox '${id}' no encontrado`);
    }
    
    try {
      // Destruir sandbox
      sandboxInfo.sandbox.destroy();
      
      // Remover de registros
      this.sandboxes.delete(id);
      this.sandboxStats.delete(id);
      
      logger.info(`Sandbox '${id}' destruido`);
      this.emit('sandbox:destroyed', { id });
      
    } catch (error) {
      logger.error(`Error destruyendo sandbox '${id}':`, error);
      throw error;
    }
  }
  
  /**
   * Destruir todos los sandboxes
   */
  async destroyAll() {
    const sandboxIds = Array.from(this.sandboxes.keys());
    
    logger.info(`Destruyendo ${sandboxIds.length} sandboxes...`);
    
    for (const id of sandboxIds) {
      try {
        await this.destroySandbox(id);
      } catch (error) {
        logger.error(`Error destruyendo sandbox '${id}':`, error);
      }
    }
  }
  
  /**
   * Apagar el manager
   */
  async shutdown() {
    logger.info('Apagando SandboxManager...');
    
    // Limpiar timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Destruir todos los sandboxes
    await this.destroyAll();
    
    // Limpiar eventos
    this.removeAllListeners();
    
    logger.info('SandboxManager apagado');
  }
}

export default SandboxManager;
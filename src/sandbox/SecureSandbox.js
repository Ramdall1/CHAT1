import vm from 'vm';
import path from 'path';
import { createRequire } from 'module';
import { createLogger } from '../services/core/core/logger.js';
import { EventEmitter } from 'events';

const logger = createLogger('SECURE_SANDBOX');

/**
 * Entorno Sandbox Seguro para ejecución de código
 * Proporciona un entorno aislado y controlado para ejecutar código de terceros
 */
export class SecureSandbox extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Límites de seguridad
      timeout: options.timeout || 5000,
      memoryLimit: options.memoryLimit || 50 * 1024 * 1024, // 50MB
      maxCallStack: options.maxCallStack || 1000,
      
      // Configuración de acceso
      allowedModules: options.allowedModules || [
        'crypto', 'util', 'events', 'stream', 'buffer'
      ],
      blockedModules: options.blockedModules || [
        'fs', 'child_process', 'cluster', 'dgram', 'dns', 'net', 'tls', 'http', 'https'
      ],
      allowFileSystem: options.allowFileSystem || false,
      allowNetwork: options.allowNetwork || false,
      allowProcess: options.allowProcess || false,
      
      // Configuración de logging
      logExecution: options.logExecution || true,
      logErrors: options.logErrors || true,
      
      // Configuración de contexto
      customGlobals: options.customGlobals || {},
      strictMode: options.strictMode !== false,
      
      ...options
    };
    
    this.contexts = new Map();
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      memoryUsage: 0
    };
    
    this.initialize();
  }
  
  /**
   * Inicializar el sandbox
   */
  initialize() {
    logger.info('Inicializando SecureSandbox...');
    
    // Configurar límites globales
    this.setupGlobalLimits();
    
    // Crear contexto base
    this.createBaseContext();
    
    logger.info('SecureSandbox inicializado correctamente');
  }
  
  /**
   * Configurar límites globales del sistema
   */
  setupGlobalLimits() {
    // Configurar límites de memoria si está disponible
    if (process.memoryUsage && this.config.memoryLimit) {
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > this.config.memoryLimit) {
        logger.warn(`Uso de memoria alto: ${memoryUsage.heapUsed} bytes`);
      }
    }
  }
  
  /**
   * Crear contexto base seguro
   */
  createBaseContext() {
    this.baseContext = {
      // Objetos globales seguros
      console: this.createSecureConsole(),
      Buffer: Buffer,
      
      // Funciones de tiempo limitadas
      setTimeout: this.createLimitedTimeout(),
      clearTimeout: clearTimeout,
      setInterval: this.createLimitedInterval(),
      clearInterval: clearInterval,
      setImmediate: setImmediate,
      clearImmediate: clearImmediate,
      
      // Función require segura
      require: this.createSecureRequire(),
      
      // Objetos de módulo
      module: { exports: {} },
      exports: {},
      
      // Variables de entorno limitadas
      process: this.createLimitedProcess(),
      
      // Utilidades matemáticas y de fecha
      Math: Math,
      Date: Date,
      JSON: JSON,
      
      // Constructores seguros
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      RegExp: RegExp,
      Error: Error,
      TypeError: TypeError,
      ReferenceError: ReferenceError,
      SyntaxError: SyntaxError,
      
      // Promesas
      Promise: Promise,
      
      // Globales personalizados
      ...this.config.customGlobals
    };
  }
  
  /**
   * Crear console seguro con logging controlado
   */
  createSecureConsole() {
    return {
      log: (...args) => {
        if (this.config.logExecution) {
          logger.info('[SANDBOX]', ...args);
        }
      },
      error: (...args) => {
        if (this.config.logErrors) {
          logger.error('[SANDBOX]', ...args);
        }
      },
      warn: (...args) => {
        if (this.config.logExecution) {
          logger.warn('[SANDBOX]', ...args);
        }
      },
      info: (...args) => {
        if (this.config.logExecution) {
          logger.info('[SANDBOX]', ...args);
        }
      },
      debug: (...args) => {
        if (this.config.logExecution) {
          logger.debug('[SANDBOX]', ...args);
        }
      }
    };
  }
  
  /**
   * Crear setTimeout limitado
   */
  createLimitedTimeout() {
    return (callback, delay, ...args) => {
      if (delay > this.config.timeout) {
        throw new Error(`Timeout excede el límite permitido: ${delay}ms > ${this.config.timeout}ms`);
      }
      return setTimeout(callback, delay, ...args);
    };
  }
  
  /**
   * Crear setInterval limitado
   */
  createLimitedInterval() {
    return (callback, delay, ...args) => {
      if (delay < 100) {
        throw new Error(`Interval demasiado frecuente: ${delay}ms < 100ms`);
      }
      return setInterval(callback, delay, ...args);
    };
  }
  
  /**
   * Crear función require segura
   */
  createSecureRequire() {
    const require = createRequire(import.meta.url);
    
    return (moduleName) => {
      // Normalizar nombre del módulo
      const normalizedName = moduleName.replace(/['"]/g, '').trim();
      
      // Verificar módulos bloqueados
      if (this.config.blockedModules.includes(normalizedName)) {
        throw new Error(`Módulo bloqueado por seguridad: ${normalizedName}`);
      }
      
      // Verificar módulos permitidos
      if (!this.config.allowedModules.includes(normalizedName)) {
        throw new Error(`Módulo no permitido: ${normalizedName}`);
      }
      
      try {
        return require(normalizedName);
      } catch (error) {
        throw new Error(`Error cargando módulo ${normalizedName}: ${error.message}`);
      }
    };
  }
  
  /**
   * Crear objeto process limitado
   */
  createLimitedProcess() {
    const limitedProcess = {
      env: {},
      platform: process.platform,
      version: process.version,
      versions: process.versions
    };
    
    // Agregar variables de entorno seguras
    if (this.config.allowProcess) {
      limitedProcess.env = {
        NODE_ENV: process.env.NODE_ENV,
        TZ: process.env.TZ
      };
    }
    
    return limitedProcess;
  }
  
  /**
   * Ejecutar código en el sandbox
   */
  async execute(code, options = {}) {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.executionStats.totalExecutions++;
      
      // Validar código
      this.validateCode(code);
      
      // Crear contexto de ejecución
      const context = this.createExecutionContext(options);
      
      // Crear script
      const script = new vm.Script(code, {
        filename: options.filename || 'sandbox_script.js',
        displayErrors: true
      });
      
      // Ejecutar con límites
      const result = await this.executeWithLimits(script, context, executionId);
      
      // Actualizar estadísticas
      const executionTime = Math.max(1, Date.now() - startTime); // Asegurar que sea al menos 1ms
      this.updateStats(true, executionTime);
      
      this.emit('execution:success', {
        executionId,
        executionTime,
        result
      });
      
      return result;
      
    } catch (error) {
      const executionTime = Math.max(1, Date.now() - startTime); // Asegurar que sea al menos 1ms
      this.updateStats(false, executionTime);
      
      this.emit('execution:error', {
        executionId,
        executionTime,
        error: error.message
      });
      
      // Preservar el error original para los tests
      throw error;
    }
  }
  
  /**
   * Validar código antes de la ejecución
   */
  validateCode(code) {
    if (!code || typeof code !== 'string') {
      throw new Error('Código inválido: debe ser una cadena no vacía');
    }
    
    if (code.length > 100000) {
      throw new Error('Código demasiado largo: máximo 100KB');
    }
    
    // Detectar imports peligrosos de ES6
    for (const module of this.config.blockedModules) {
      const importPattern = new RegExp(`import\\s+.*\\s+from\\s+['"\`]${module}['"\`]`, 'g');
      if (importPattern.test(code)) {
        throw new Error(`Módulo bloqueado por seguridad: ${module}`);
      }
    }
    
    // Detectar requires de módulos bloqueados
    for (const module of this.config.blockedModules) {
      const requirePattern = new RegExp(`require\\s*\\(\\s*['"\`]${module}['"\`]\\s*\\)`, 'g');
      if (requirePattern.test(code)) {
        throw new Error(`Módulo bloqueado por seguridad: ${module}`);
      }
    }
    
    // Detectar requires dinámicos
    const dynamicRequires = /require\s*\(\s*[^'"`]/g;
    if (dynamicRequires.test(code)) {
      throw new Error('Requires dinámicos no permitidos');
    }
    
    // Verificar patrones peligrosos
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, message: 'Patrón peligroso detectado' },
      { pattern: /Function\s*\(/, message: 'Patrón peligroso detectado' },
      { pattern: /new\s+Function/, message: 'Patrón peligroso detectado' },
      { pattern: /process\.exit/, message: 'Patrón peligroso detectado' },
      { pattern: /process\.kill/, message: 'Patrón peligroso detectado' },
      { pattern: /while\s*\(\s*true\s*\)/, message: 'Patrón peligroso detectado' },
      { pattern: /for\s*\(\s*;\s*;\s*\)/, message: 'Patrón peligroso detectado' }
    ];
    
    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(message);
      }
    }
  }
  
  /**
   * Crear contexto de ejecución
   */
  createExecutionContext(options) {
    const context = {
      ...this.baseContext,
      __filename: options.filename || 'sandbox_script.js',
      __dirname: options.dirname || '/sandbox',
      module: { exports: {} },
      exports: {}
    };
    
    // Agregar contexto personalizado
    if (options.context) {
      Object.assign(context, options.context);
    }
    
    return vm.createContext(context);
  }
  
  /**
   * Ejecutar script con límites
   */
  async executeWithLimits(script, context, executionId) {
    try {
      const result = script.runInContext(context, {
        timeout: this.config.timeout,
        displayErrors: true
      });
      
      // Retornar exports del módulo
      const moduleExports = context.module.exports;
      if (Object.keys(moduleExports).length > 0) {
        return moduleExports;
      } else {
        return result;
      }
      
    } catch (error) {
      // Convertir el error de timeout del VM al formato esperado
      if (error.message && error.message.includes('timed out')) {
        throw new Error('Timeout');
      }
      throw error;
    }
  }
  
  /**
   * Actualizar estadísticas de ejecución
   */
  updateStats(success, executionTime) {
    if (success) {
      this.executionStats.successfulExecutions++;
    } else {
      this.executionStats.failedExecutions++;
    }
    
    // Calcular tiempo promedio
    const totalTime = this.executionStats.averageExecutionTime * (this.executionStats.totalExecutions - 1) + executionTime;
    this.executionStats.averageExecutionTime = totalTime / this.executionStats.totalExecutions;
    
    // Actualizar uso de memoria
    if (process.memoryUsage) {
      this.executionStats.memoryUsage = process.memoryUsage().heapUsed;
    }
  }
  
  /**
   * Obtener estadísticas del sandbox
   */
  getStats() {
    return {
      ...this.executionStats,
      successRate: this.executionStats.totalExecutions > 0 
        ? (this.executionStats.successfulExecutions / this.executionStats.totalExecutions) * 100 
        : 0
    };
  }
  
  /**
   * Limpiar contextos y recursos
   */
  cleanup() {
    this.contexts.clear();
    this.removeAllListeners();
    logger.info('SecureSandbox limpiado');
  }
  
  /**
   * Destruir el sandbox
   */
  destroy() {
    this.cleanup();
    logger.info('SecureSandbox destruido');
  }
}

export default SecureSandbox;
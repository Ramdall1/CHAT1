import BaseService from './BaseService.js';
import { createLogger } from './logger.js';
import { getDatabase } from './database.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Servicio de Health Check refactorizado
 * Extiende BaseService para proporcionar funcionalidad de monitoreo de salud del sistema
 */
class HealthCheckService extends BaseService {
  constructor(options = {}) {
    super('HealthCheckService', options);
        
    this.serviceDependencies = options;
    this.checks = new Map();
    this.checkInterval = 30000; // 30 segundos
    this.lastResults = new Map();
    this.intervalId = null;
        
    this.setupChecks();
  }

  /**
     * Configurar todos los health checks
     */
  setupChecks() {
    // Check del servicio de mensajería local
    this.checks.set('localMessagingService', {
      name: 'Local Messaging Service',
      check: () => this.checkLocalMessagingService(),
      critical: true,
      timeout: 5000
    });
        
    // Check del contact manager
    this.checks.set('contactManager', {
      name: 'Contact Manager',
      check: () => this.checkContactManager(),
      critical: true,
      timeout: 3000
    });
        
    // Check de Socket.IO
    this.checks.set('socketIO', {
      name: 'Socket.IO',
      check: () => this.checkSocketIO(),
      critical: false,
      timeout: 3000
    });
        
    // Check del sistema de archivos
    this.checks.set('filesystem', {
      name: 'File System',
      check: () => this.checkFileSystem(),
      critical: true,
      timeout: 5000
    });
        
    // Check de memoria
    this.checks.set('memory', {
      name: 'Memory Usage',
      check: () => this.checkMemoryUsage(),
      critical: false,
      timeout: 2000
    });
        
    // Check de la base de datos
    this.checks.set('database', {
      name: 'Database',
      check: () => this.checkDatabase(),
      critical: true,
      timeout: 5000
    });
        
    // Check de la API de 360Dialog
    this.checks.set('360dialog', {
      name: '360Dialog API',
      check: () => this.check360DialogAPI(),
      critical: false,
      timeout: 10000
    });

    this.logger.info(`Health checks configurados: ${this.checks.size} checks`);
  }

  /**
     * Inicializar el servicio
     */
  async initialize() {
    await super.initialize();
        
    try {
      // Verificar dependencias críticas
      await this.checkDependencies(['database']);
            
      this.logger.info('HealthCheckService inicializado correctamente');
            
    } catch (error) {
      this.logger.error('Error inicializando HealthCheckService:', error);
      throw error;
    }
  }

  /**
     * Iniciar el servicio
     */
  async start() {
    await super.start();
        
    try {
      // Ejecutar checks inmediatamente
      await this.runAllChecks();
            
      // Programar checks periódicos
      this.intervalId = setInterval(async() => {
        try {
          await this.runAllChecks();
        } catch (error) {
          this.logger.error('Error en health check periódico:', error);
        }
      }, this.checkInterval);
            
      this.logger.info(`Health checks iniciados con intervalo de ${this.checkInterval}ms`);
            
    } catch (error) {
      this.logger.error('Error iniciando HealthCheckService:', error);
      throw error;
    }
  }

  /**
     * Detener el servicio
     */
  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
        
    await super.stop();
    this.logger.info('HealthCheckService detenido');
  }

  /**
     * Check del servicio de mensajería local
     */
  async checkLocalMessagingService() {
    const startTime = Date.now();
        
    try {
      const service = this.serviceDependencies.localMessagingService;
            
      if (!service) {
        return {
          status: 'unhealthy',
          message: 'LocalMessagingService no disponible',
          details: { available: false },
          responseTime: Date.now() - startTime
        };
      }
            
      // Verificar métodos críticos
      const criticalMethods = ['sendText', 'receiveMessage', 'updateMessageStatus'];
      const missingMethods = criticalMethods.filter(method => 
        typeof service[method] !== 'function'
      );
            
      if (missingMethods.length > 0) {
        return {
          status: 'unhealthy',
          message: 'Métodos críticos faltantes',
          details: { missingMethods },
          responseTime: Date.now() - startTime
        };
      }
            
      return {
        status: 'healthy',
        message: 'LocalMessagingService funcionando correctamente',
        details: {
          available: true,
          messageCount: service.messages?.length || 0,
          templateCount: service.templates?.size || 0
        },
        responseTime: Date.now() - startTime
      };
            
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando LocalMessagingService',
        details: { error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
     * Check del contact manager
     */
  async checkContactManager() {
    const startTime = Date.now();
        
    try {
      const manager = this.serviceDependencies.localContactManager;
            
      if (!manager) {
        return {
          status: 'unhealthy',
          message: 'ContactManager no disponible',
          details: { available: false },
          responseTime: Date.now() - startTime
        };
      }
            
      return {
        status: 'healthy',
        message: 'ContactManager funcionando correctamente',
        details: {
          available: true,
          contactCount: manager.contacts?.size || 0
        },
        responseTime: Date.now() - startTime
      };
            
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando ContactManager',
        details: { error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
     * Check de Socket.IO
     */
  async checkSocketIO() {
    const startTime = Date.now();
        
    try {
      const io = this.serviceDependencies.io;
            
      if (!io) {
        return {
          status: 'unhealthy',
          message: 'Socket.IO no disponible',
          details: { available: false },
          responseTime: Date.now() - startTime
        };
      }
            
      return {
        status: 'healthy',
        message: 'Socket.IO funcionando correctamente',
        details: {
          available: true,
          connectedClients: io.engine?.clientsCount || 0
        },
        responseTime: Date.now() - startTime
      };
            
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando Socket.IO',
        details: { error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
     * Check del sistema de archivos
     */
  async checkFileSystem() {
    const startTime = Date.now();
        
    try {
      const testDir = path.join(process.cwd(), 'data');
      const testFile = path.join(testDir, 'health-check.tmp');
            
      // Verificar que podemos escribir
      await fs.ensureDir(testDir);
      await fs.writeFile(testFile, 'health-check-test');
            
      // Verificar que podemos leer
      const content = await fs.readFile(testFile, 'utf8');
            
      // Limpiar archivo de prueba
      await fs.remove(testFile);
            
      if (content !== 'health-check-test') {
        throw new Error('Contenido del archivo no coincide');
      }
            
      return {
        status: 'healthy',
        message: 'Sistema de archivos funcionando correctamente',
        details: { readable: true, writable: true },
        responseTime: Date.now() - startTime
      };
            
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error en sistema de archivos',
        details: { error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
     * Check de uso de memoria
     */
  async checkMemoryUsage() {
    const startTime = Date.now();
        
    try {
      const usage = process.memoryUsage();
      const totalMB = Math.round(usage.rss / 1024 / 1024);
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
            
      // Considerar warning si usa más de 512MB, unhealthy si más de 1GB
      let status = 'healthy';
      if (totalMB > 1024) {
        status = 'unhealthy';
      } else if (totalMB > 512) {
        status = 'warning';
      }
            
      return {
        status,
        message: `Uso de memoria: ${totalMB}MB`,
        details: {
          rss: totalMB,
          heapUsed: heapUsedMB,
          heapTotal: heapTotalMB,
          external: Math.round(usage.external / 1024 / 1024),
          arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024)
        },
        responseTime: Date.now() - startTime
      };
            
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando memoria',
        details: { error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
     * Check de la base de datos
     */
  async checkDatabase() {
    const startTime = Date.now();
        
    try {
      const db = getDatabase();
            
      if (!db) {
        return {
          status: 'unhealthy',
          message: 'Base de datos no disponible',
          details: { available: false },
          responseTime: Date.now() - startTime
        };
      }
            
      // Intentar una operación de lectura simple
      const testData = await db.read('health_check', 'test');
            
      return {
        status: 'healthy',
        message: 'Base de datos funcionando correctamente',
        details: {
          available: true,
          type: db.constructor.name
        },
        responseTime: Date.now() - startTime
      };
            
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando base de datos',
        details: { error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
     * Check de la API de 360Dialog
     */
  async check360DialogAPI() {
    const startTime = Date.now();
        
    try {
      // Verificar variables de entorno necesarias
      const requiredEnvVars = ['D360_API_KEY', 'D360_PHONE_NUMBER_ID'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
            
      if (missingVars.length > 0) {
        return {
          status: 'warning',
          message: 'Variables de entorno faltantes para 360Dialog',
          details: { missingVars },
          responseTime: Date.now() - startTime
        };
      }
            
      // En modo local, no hacer llamadas reales a la API
      if (process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'development') {
        return {
          status: 'healthy',
          message: '360Dialog API (modo local)',
          details: { mode: 'local', configured: true },
          responseTime: Date.now() - startTime
        };
      }
            
      return {
        status: 'healthy',
        message: '360Dialog API configurado',
        details: { configured: true },
        responseTime: Date.now() - startTime
      };
            
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando 360Dialog API',
        details: { error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
     * Ejecutar todos los health checks
     */
  async runAllChecks() {
    const startTime = Date.now();
    const results = new Map();
        
    this.logger.debug('Ejecutando health checks...');
        
    for (const [key, checkConfig] of this.checks) {
      try {
        // Ejecutar check con timeout
        const checkPromise = checkConfig.check();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), checkConfig.timeout);
        });
                
        const result = await Promise.race([checkPromise, timeoutPromise]);
                
        results.set(key, {
          ...result,
          name: checkConfig.name,
          critical: checkConfig.critical,
          timestamp: new Date().toISOString()
        });
                
        // Actualizar métricas
        this.recordOperation(result.responseTime || 0);
                
      } catch (error) {
        const errorResult = {
          status: 'unhealthy',
          message: `Error ejecutando check: ${error.message}`,
          name: checkConfig.name,
          critical: checkConfig.critical,
          timestamp: new Date().toISOString(),
          details: { error: error.message },
          responseTime: Date.now() - startTime
        };
                
        results.set(key, errorResult);
        this.logger.error(`Error en health check ${key}:`, error);
      }
    }
        
    this.lastResults = results;
        
    // Log del resumen
    const overall = this.getOverallHealth();
    this.logger.info(`Health check completado: ${overall.status}`, {
      duration: Date.now() - startTime,
      checksCount: results.size,
      status: overall.status
    });
        
    return results;
  }

  /**
     * Obtener salud general del sistema
     */
  getOverallHealth() {
    if (this.lastResults.size === 0) {
      return { 
        status: 'unknown', 
        message: 'No se han ejecutado checks',
        timestamp: new Date().toISOString()
      };
    }
        
    let hasUnhealthy = false;
    let hasWarning = false;
    const criticalIssues = [];
        
    for (const [key, result] of this.lastResults) {
      if (result.status === 'unhealthy') {
        hasUnhealthy = true;
        if (result.critical) {
          criticalIssues.push(key);
        }
      } else if (result.status === 'warning') {
        hasWarning = true;
      }
    }
        
    if (criticalIssues.length > 0) {
      return {
        status: 'critical',
        message: `Servicios críticos con problemas: ${criticalIssues.join(', ')}`,
        criticalIssues,
        timestamp: new Date().toISOString()
      };
    }
        
    if (hasUnhealthy) {
      return {
        status: 'unhealthy',
        message: 'Algunos servicios tienen problemas',
        timestamp: new Date().toISOString()
      };
    }
        
    if (hasWarning) {
      return {
        status: 'warning',
        message: 'Algunos servicios tienen advertencias',
        timestamp: new Date().toISOString()
      };
    }
        
    return {
      status: 'healthy',
      message: 'Todos los servicios funcionando correctamente',
      timestamp: new Date().toISOString()
    };
  }

  /**
     * Obtener resultados detallados
     */
  getResults() {
    return {
      overall: this.getOverallHealth(),
      checks: Object.fromEntries(this.lastResults),
      lastUpdate: this.lastResults.size > 0 ? 
        Math.max(...Array.from(this.lastResults.values()).map(r => new Date(r.timestamp).getTime())) :
        null,
      service: this.getStatus()
    };
  }

  /**
     * Ejecutar un check específico
     */
  async runSpecificCheck(checkName) {
    const checkConfig = this.checks.get(checkName);
    if (!checkConfig) {
      throw new Error(`Check no encontrado: ${checkName}`);
    }
        
    try {
      const result = await checkConfig.check();
            
      // Actualizar resultado en cache
      this.lastResults.set(checkName, {
        ...result,
        name: checkConfig.name,
        critical: checkConfig.critical,
        timestamp: new Date().toISOString()
      });
            
      return result;
            
    } catch (error) {
      const errorResult = {
        status: 'unhealthy',
        message: `Error ejecutando check: ${error.message}`,
        name: checkConfig.name,
        critical: checkConfig.critical,
        timestamp: new Date().toISOString(),
        details: { error: error.message }
      };
            
      this.lastResults.set(checkName, errorResult);
      throw error;
    }
  }

  /**
     * Obtener health check específico para BaseService
     */
  async getHealth() {
    const overall = this.getOverallHealth();
        
    return {
      status: overall.status === 'healthy' ? 'healthy' : 'unhealthy',
      service: this.serviceName,
      message: overall.message,
      details: {
        overall: overall,
        checksCount: this.checks.size,
        lastUpdate: this.lastResults.size > 0 ? 
          Math.max(...Array.from(this.lastResults.values()).map(r => new Date(r.timestamp).getTime())) :
          null
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
     * Configurar dependencias
     */
  setDependencies(dependencies) {
    this.serviceDependencies = { ...this.serviceDependencies, ...dependencies };
    this.logger.info('Dependencias actualizadas para HealthCheckService');
  }
}

export default HealthCheckService;
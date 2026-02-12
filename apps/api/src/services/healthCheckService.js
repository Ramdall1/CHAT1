import logger from '../utils/logger.js';
import fs from 'fs-extra';
import path from 'path';

class HealthCheckService {
  constructor(appLocals) {
    this.appLocals = appLocals;
    this.checks = new Map();
    this.checkInterval = 30000; // 30 segundos
    this.isRunning = false;
    this.lastResults = new Map();

    this.setupChecks();
  }

  setupChecks() {
    // Check del servicio de mensajería local
    this.checks.set('localMessagingService', {
      name: 'Local Messaging Service',
      check: () => this.checkLocalMessagingService(),
      critical: true,
    });

    // Check del contact manager
    this.checks.set('contactManager', {
      name: 'Contact Manager',
      check: () => this.checkContactManager(),
      critical: true,
    });

    // Check de Socket.IO
    this.checks.set('socketIO', {
      name: 'Socket.IO',
      check: () => this.checkSocketIO(),
      critical: false,
    });

    // Check del sistema de archivos
    this.checks.set('filesystem', {
      name: 'File System',
      check: () => this.checkFileSystem(),
      critical: true,
    });

    // Check de memoria
    this.checks.set('memory', {
      name: 'Memory Usage',
      check: () => this.checkMemoryUsage(),
      critical: false,
    });

    // Check de la API de 360Dialog
    this.checks.set('360dialog', {
      name: '360Dialog API',
      check: () => this.check360DialogAPI(),
      critical: false,
    });
  }

  async checkLocalMessagingService() {
    try {
      const service = this.appLocals.localMessagingService;

      if (!service) {
        return {
          status: 'unhealthy',
          message: 'LocalMessagingService no disponible',
          details: { available: false },
        };
      }

      // Verificar que los métodos críticos existen
      const criticalMethods = [
        'sendText',
        'receiveMessage',
        'updateMessageStatus',
      ];
      const missingMethods = criticalMethods.filter(
        method => typeof service[method] !== 'function'
      );

      if (missingMethods.length > 0) {
        return {
          status: 'unhealthy',
          message: 'Métodos críticos faltantes',
          details: { missingMethods },
        };
      }

      // Verificar que los archivos de datos existen
      const dataFiles = [service.messagesFile, service.templatesFile];
      const missingFiles = [];

      for (const file of dataFiles) {
        if (!(await fs.pathExists(file))) {
          missingFiles.push(file);
        }
      }

      return {
        status: 'healthy',
        message: 'LocalMessagingService funcionando correctamente',
        details: {
          available: true,
          messageCount: service.messages?.length || 0,
          templateCount: service.templates?.size || 0,
          missingFiles: missingFiles.length > 0 ? missingFiles : undefined,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando LocalMessagingService',
        details: { error: error.message },
      };
    }
  }

  async checkContactManager() {
    try {
      const manager = this.appLocals.localContactManager;

      if (!manager) {
        return {
          status: 'unhealthy',
          message: 'ContactManager no disponible',
          details: { available: false },
        };
      }

      return {
        status: 'healthy',
        message: 'ContactManager funcionando correctamente',
        details: {
          available: true,
          contactCount: manager.contacts?.size || 0,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando ContactManager',
        details: { error: error.message },
      };
    }
  }

  async checkSocketIO() {
    try {
      const io = this.appLocals.io;

      if (!io) {
        return {
          status: 'unhealthy',
          message: 'Socket.IO no disponible',
          details: { available: false },
        };
      }

      return {
        status: 'healthy',
        message: 'Socket.IO funcionando correctamente',
        details: {
          available: true,
          connectedClients: io.engine?.clientsCount || 0,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando Socket.IO',
        details: { error: error.message },
      };
    }
  }

  async checkFileSystem() {
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
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error en sistema de archivos',
        details: { error: error.message },
      };
    }
  }

  async checkMemoryUsage() {
    try {
      const usage = process.memoryUsage();
      const totalMB = Math.round(usage.rss / 1024 / 1024);
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

      // Considerar unhealthy si usa más de 1GB
      const isHealthy = totalMB < 1024;

      return {
        status: isHealthy ? 'healthy' : 'warning',
        message: `Uso de memoria: ${totalMB}MB`,
        details: {
          rss: totalMB,
          heapUsed: heapUsedMB,
          heapTotal: heapTotalMB,
          external: Math.round(usage.external / 1024 / 1024),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando memoria',
        details: { error: error.message },
      };
    }
  }

  async check360DialogAPI() {
    try {
      // Verificar variables de entorno necesarias
      const requiredEnvVars = ['D360_API_KEY', 'D360_PHONE_NUMBER_ID'];
      const missingVars = requiredEnvVars.filter(
        varName => !process.env[varName]
      );

      if (missingVars.length > 0) {
        return {
          status: 'warning',
          message: 'Variables de entorno faltantes para 360Dialog',
          details: { missingVars },
        };
      }

      // En modo local, no hacer llamadas reales a la API
      if (process.env.NODE_ENV === 'local') {
        return {
          status: 'healthy',
          message: '360Dialog API (modo local)',
          details: { mode: 'local', configured: true },
        };
      }

      return {
        status: 'healthy',
        message: '360Dialog API configurado',
        details: { configured: true },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error verificando 360Dialog API',
        details: { error: error.message },
      };
    }
  }

  async runAllChecks() {
    const results = new Map();

    for (const [key, checkConfig] of this.checks) {
      try {
        const result = await checkConfig.check();
        results.set(key, {
          ...result,
          name: checkConfig.name,
          critical: checkConfig.critical,
          timestamp: new Date().toISOString(),
        });

        // Log del resultado
        logger.healthCheck(checkConfig.name, result.status, result.details);
      } catch (error) {
        const errorResult = {
          status: 'unhealthy',
          message: `Error ejecutando check: ${error.message}`,
          name: checkConfig.name,
          critical: checkConfig.critical,
          timestamp: new Date().toISOString(),
          details: { error: error.message },
        };

        results.set(key, errorResult);
        logger.healthCheck(checkConfig.name, 'unhealthy', {
          error: error.message,
        });
      }
    }

    this.lastResults = results;
    return results;
  }

  getOverallHealth() {
    if (this.lastResults.size === 0) {
      return { status: 'unknown', message: 'No se han ejecutado checks' };
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
      };
    }

    if (hasUnhealthy) {
      return {
        status: 'unhealthy',
        message: 'Algunos servicios tienen problemas',
      };
    }

    if (hasWarning) {
      return {
        status: 'warning',
        message: 'Algunos servicios tienen advertencias',
      };
    }

    return {
      status: 'healthy',
      message: 'Todos los servicios funcionando correctamente',
    };
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Health Check Service iniciado', {
      interval: this.checkInterval,
      checksCount: this.checks.size,
      category: 'HEALTH_CHECK_START',
    });

    // Ejecutar checks inmediatamente
    this.runAllChecks();

    // Programar checks periódicos
    this.intervalId = setInterval(() => {
      this.runAllChecks();
    }, this.checkInterval);
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Health Check Service detenido', {
      category: 'HEALTH_CHECK_STOP',
    });
  }

  getResults() {
    return {
      overall: this.getOverallHealth(),
      checks: Object.fromEntries(this.lastResults),
      lastUpdate:
        this.lastResults.size > 0
          ? Math.max(
              ...Array.from(this.lastResults.values()).map(r =>
                new Date(r.timestamp).getTime()
              )
            )
          : null,
    };
  }
}

export default HealthCheckService;

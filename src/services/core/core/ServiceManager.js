import { createLogger } from './logger.js';
import BaseService from './BaseService.js';

/**
 * Gestor centralizado de servicios
 * Maneja el ciclo de vida de todos los servicios del sistema
 */
class ServiceManager {
  constructor() {
    this.logger = createLogger('SERVICE_MANAGER');
    this.services = new Map();
    this.serviceOrder = [];
    this.isInitialized = false;
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 30000; // 30 segundos
  }

  /**
     * Registrar un servicio
     */
  registerService(name, serviceInstance, dependencies = []) {
    if (!(serviceInstance instanceof BaseService)) {
      throw new Error(`El servicio ${name} debe extender BaseService`);
    }

    this.services.set(name, {
      instance: serviceInstance,
      dependencies,
      status: 'registered'
    });

    this.logger.info(`Servicio registrado: ${name}`);
  }

  /**
     * Obtener un servicio
     */
  getService(name) {
    const service = this.services.get(name);
    return service ? service.instance : null;
  }

  /**
     * Verificar si un servicio existe
     */
  hasService(name) {
    return this.services.has(name);
  }

  /**
     * Calcular orden de inicialización basado en dependencias
     */
  calculateInitializationOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (serviceName) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Dependencia circular detectada: ${serviceName}`);
      }

      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);

      const service = this.services.get(serviceName);
      if (service) {
        // Visitar dependencias primero
        for (const dependency of service.dependencies) {
          visit(dependency);
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    // Visitar todos los servicios
    for (const serviceName of this.services.keys()) {
      visit(serviceName);
    }

    this.serviceOrder = order;
    this.logger.info('Orden de inicialización calculado:', order);
  }

  /**
     * Inicializar todos los servicios
     */
  async initializeAll() {
    try {
      this.logger.info('Inicializando todos los servicios...');

      // Calcular orden de inicialización
      this.calculateInitializationOrder();

      // Inicializar servicios en orden
      for (const serviceName of this.serviceOrder) {
        const service = this.services.get(serviceName);
        if (service) {
          this.logger.info(`Inicializando servicio: ${serviceName}`);
          await service.instance.initialize();
          service.status = 'initialized';
        }
      }

      this.isInitialized = true;
      this.logger.info('✅ Todos los servicios inicializados correctamente');

    } catch (error) {
      this.logger.error('❌ Error inicializando servicios:', error);
      throw error;
    }
  }

  /**
     * Iniciar todos los servicios
     */
  async startAll() {
    try {
      if (!this.isInitialized) {
        await this.initializeAll();
      }

      this.logger.info('Iniciando todos los servicios...');

      // Iniciar servicios en orden
      for (const serviceName of this.serviceOrder) {
        const service = this.services.get(serviceName);
        if (service) {
          this.logger.info(`Iniciando servicio: ${serviceName}`);
          await service.instance.start();
          service.status = 'running';
        }
      }

      // Iniciar health checks
      this.startHealthChecks();

      this.logger.info('✅ Todos los servicios iniciados correctamente');

    } catch (error) {
      this.logger.error('❌ Error iniciando servicios:', error);
      throw error;
    }
  }

  /**
     * Detener todos los servicios
     */
  async stopAll() {
    try {
      this.logger.info('Deteniendo todos los servicios...');

      // Detener health checks
      this.stopHealthChecks();

      // Detener servicios en orden inverso
      const reverseOrder = [...this.serviceOrder].reverse();
            
      for (const serviceName of reverseOrder) {
        const service = this.services.get(serviceName);
        if (service && service.status === 'running') {
          this.logger.info(`Deteniendo servicio: ${serviceName}`);
          await service.instance.stop();
          service.status = 'stopped';
        }
      }

      this.logger.info('✅ Todos los servicios detenidos correctamente');

    } catch (error) {
      this.logger.error('❌ Error deteniendo servicios:', error);
      throw error;
    }
  }

  /**
     * Reiniciar un servicio específico
     */
  async restartService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Servicio no encontrado: ${serviceName}`);
    }

    this.logger.info(`Reiniciando servicio: ${serviceName}`);
    await service.instance.restart();
    this.logger.info(`✅ Servicio reiniciado: ${serviceName}`);
  }

  /**
     * Obtener estado de todos los servicios
     */
  getAllStatus() {
    const status = {};
        
    for (const [name, service] of this.services) {
      status[name] = service.instance.getStatus();
    }

    return {
      manager: {
        isInitialized: this.isInitialized,
        servicesCount: this.services.size,
        initializationOrder: this.serviceOrder
      },
      services: status
    };
  }

  /**
     * Obtener salud de todos los servicios
     */
  async getAllHealth() {
    const health = {};
    let overallStatus = 'healthy';
    const issues = [];

    for (const [name, service] of this.services) {
      try {
        const serviceHealth = await service.instance.getHealth();
        health[name] = serviceHealth;

        if (serviceHealth.status !== 'healthy') {
          overallStatus = 'unhealthy';
          issues.push({
            service: name,
            status: serviceHealth.status,
            error: serviceHealth.error
          });
        }
      } catch (error) {
        health[name] = {
          status: 'error',
          service: name,
          error: error.message
        };
        overallStatus = 'unhealthy';
        issues.push({
          service: name,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      overall: {
        status: overallStatus,
        servicesCount: this.services.size,
        healthyCount: Object.values(health).filter(h => h.status === 'healthy').length,
        issues: issues.length > 0 ? issues : undefined
      },
      services: health,
      timestamp: new Date().toISOString()
    };
  }

  /**
     * Iniciar health checks periódicos
     */
  startHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async() => {
      try {
        const health = await this.getAllHealth();
                
        if (health.overall.status !== 'healthy') {
          this.logger.warn('Health check detectó problemas:', health.overall.issues);
        }

        // Log de métricas cada 5 minutos
        if (Date.now() % (5 * 60 * 1000) < this.healthCheckIntervalMs) {
          this.logMetrics();
        }

      } catch (error) {
        this.logger.error('Error en health check:', error);
      }
    }, this.healthCheckIntervalMs);

    this.logger.info('Health checks iniciados');
  }

  /**
     * Detener health checks
     */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.info('Health checks detenidos');
    }
  }

  /**
     * Log de métricas de todos los servicios
     */
  logMetrics() {
    const status = this.getAllStatus();
    const metrics = {};

    for (const [name, serviceStatus] of Object.entries(status.services)) {
      metrics[name] = {
        operations: serviceStatus.metrics.operationsCount,
        errors: serviceStatus.metrics.errorsCount,
        avgResponseTime: Math.round(serviceStatus.metrics.averageResponseTime),
        uptime: serviceStatus.uptime
      };
    }

    this.logger.info('Métricas de servicios:', metrics);
  }

  /**
     * Obtener servicio por tipo
     */
  getServicesByType(type) {
    const services = [];
        
    for (const [name, service] of this.services) {
      if (service.instance.constructor.name.includes(type)) {
        services.push({
          name,
          instance: service.instance
        });
      }
    }

    return services;
  }

  /**
     * Verificar dependencias de un servicio
     */
  checkServiceDependencies(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      return { valid: false, error: 'Servicio no encontrado' };
    }

    const missingDependencies = [];
        
    for (const dependency of service.dependencies) {
      if (!this.services.has(dependency)) {
        missingDependencies.push(dependency);
      }
    }

    return {
      valid: missingDependencies.length === 0,
      dependencies: service.dependencies,
      missing: missingDependencies
    };
  }
}

// Instancia singleton
const serviceManager = new ServiceManager();

export default serviceManager;
export { ServiceManager };
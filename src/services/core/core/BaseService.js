import { createLogger } from './logger.js';
import { getDatabase } from './database.js';

/**
 * Clase base para todos los servicios del sistema
 * Proporciona funcionalidad común y estructura estándar
 */
class BaseService {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.logger = createLogger(serviceName.toUpperCase());
    this.db = null;
    this.isInitialized = false;
    this.config = options.config || {};
    this.dependencies = options.dependencies || [];
        
    // Estado del servicio
    this.status = 'stopped';
    this.startTime = null;
    this.lastError = null;
    this.metrics = {
      operationsCount: 0,
      errorsCount: 0,
      lastOperation: null,
      averageResponseTime: 0
    };
  }

  /**
     * Inicializar el servicio
     */
  async initialize() {
    try {
      this.logger.info(`Inicializando ${this.serviceName}...`);
      this.status = 'initializing';

      // Obtener base de datos
      this.db = getDatabase();

      // Verificar dependencias
      await this.checkDependencies();

      // Inicialización específica del servicio
      await this.onInitialize();

      this.isInitialized = true;
      this.status = 'initialized';
      this.logger.info(`✅ ${this.serviceName} inicializado correctamente`);

    } catch (error) {
      this.status = 'error';
      this.lastError = error;
      this.logger.error(`❌ Error inicializando ${this.serviceName}:`, error);
      throw error;
    }
  }

  /**
     * Iniciar el servicio
     */
  async start() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      this.logger.info(`Iniciando ${this.serviceName}...`);
      this.status = 'starting';
      this.startTime = Date.now();

      // Inicio específico del servicio
      await this.onStart();

      this.status = 'running';
      this.logger.info(`✅ ${this.serviceName} iniciado correctamente`);

    } catch (error) {
      this.status = 'error';
      this.lastError = error;
      this.logger.error(`❌ Error iniciando ${this.serviceName}:`, error);
      throw error;
    }
  }

  /**
     * Detener el servicio
     */
  async stop() {
    try {
      this.logger.info(`Deteniendo ${this.serviceName}...`);
      this.status = 'stopping';

      // Detención específica del servicio
      await this.onStop();

      this.status = 'stopped';
      this.startTime = null;
      this.logger.info(`✅ ${this.serviceName} detenido correctamente`);

    } catch (error) {
      this.status = 'error';
      this.lastError = error;
      this.logger.error(`❌ Error deteniendo ${this.serviceName}:`, error);
      throw error;
    }
  }

  /**
     * Verificar dependencias del servicio
     */
  async checkDependencies() {
    for (const dependency of this.dependencies) {
      if (!dependency.isAvailable()) {
        throw new Error(`Dependencia no disponible: ${dependency.name}`);
      }
    }
  }

  /**
     * Ejecutar operación con métricas
     */
  async executeWithMetrics(operationName, operation) {
    const startTime = Date.now();
        
    try {
      this.logger.debug(`Ejecutando operación: ${operationName}`);
            
      const result = await operation();
            
      const duration = Date.now() - startTime;
      this.updateMetrics(operationName, duration, true);
            
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(operationName, duration, false);
            
      this.logger.error(`Error en operación ${operationName}:`, error);
      throw error;
    }
  }

  /**
     * Actualizar métricas del servicio
     */
  updateMetrics(operationName, duration, success) {
    this.metrics.operationsCount++;
    this.metrics.lastOperation = {
      name: operationName,
      duration,
      success,
      timestamp: new Date().toISOString()
    };

    if (!success) {
      this.metrics.errorsCount++;
    }

    // Calcular tiempo promedio de respuesta
    const currentAvg = this.metrics.averageResponseTime;
    const count = this.metrics.operationsCount;
    this.metrics.averageResponseTime = ((currentAvg * (count - 1)) + duration) / count;
  }

  /**
     * Obtener estado del servicio
     */
  getStatus() {
    return {
      serviceName: this.serviceName,
      status: this.status,
      isInitialized: this.isInitialized,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      lastError: this.lastError ? {
        message: this.lastError.message,
        timestamp: this.lastError.timestamp || new Date().toISOString()
      } : null,
      metrics: { ...this.metrics }
    };
  }

  /**
     * Obtener información de salud del servicio
     */
  async getHealth() {
    try {
      // Health check específico del servicio
      const healthData = await this.onHealthCheck();
            
      return {
        status: this.status === 'running' ? 'healthy' : 'unhealthy',
        service: this.serviceName,
        uptime: this.startTime ? Date.now() - this.startTime : 0,
        metrics: this.metrics,
        ...healthData
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        service: this.serviceName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
     * Reiniciar el servicio
     */
  async restart() {
    this.logger.info(`Reiniciando ${this.serviceName}...`);
        
    if (this.status === 'running') {
      await this.stop();
    }
        
    await this.start();
  }

  // Métodos que deben ser implementados por las clases hijas

  /**
     * Inicialización específica del servicio
     * Debe ser implementado por las clases hijas
     */
  async onInitialize() {
    // Implementar en clases hijas
  }

  /**
     * Inicio específico del servicio
     * Debe ser implementado por las clases hijas
     */
  async onStart() {
    // Implementar en clases hijas
  }

  /**
     * Detención específica del servicio
     * Debe ser implementado por las clases hijas
     */
  async onStop() {
    // Implementar en clases hijas
  }

  /**
     * Health check específico del servicio
     * Debe ser implementado por las clases hijas
     */
  async onHealthCheck() {
    return {
      message: 'Servicio funcionando correctamente'
    };
  }
}

export default BaseService;
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Monitor de salud del sistema
 * Supervisa métricas del sistema, recursos, conectividad y estado general
 */
class SystemHealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
        
    this.config = {
      enabled: process.env.HEALTH_MONITOR_ENABLED !== 'false',
      checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 segundos
      alertThresholds: {
        memoryUsage: parseFloat(process.env.MEMORY_ALERT_THRESHOLD) || 0.85, // 85%
        cpuUsage: parseFloat(process.env.CPU_ALERT_THRESHOLD) || 0.80, // 80%
        diskUsage: parseFloat(process.env.DISK_ALERT_THRESHOLD) || 0.90, // 90%
        responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 5000, // 5 segundos
        errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD) || 0.05 // 5%
      },
      retentionPeriod: parseInt(process.env.HEALTH_RETENTION_PERIOD) || 86400000, // 24 horas
      dataPath: options.dataPath || path.join(process.cwd(), 'data', 'health'),
      ...options
    };

    this.healthData = {
      system: [],
      application: [],
      network: [],
      database: [],
      external: []
    };

    this.alerts = new Map();
    this.services = new Map();
    this.healthChecks = new Map();
    this.isRunning = false;
        
    this.initialize();
  }

  /**
     * Inicializar el monitor de salud
     */
  async initialize() {
    if (!this.config.enabled) {
      logger.info('🏥 Health Monitor deshabilitado');
      return;
    }

    try {
      await fs.mkdir(this.config.dataPath, { recursive: true });
      this.setupDefaultHealthChecks();
      this.startMonitoring();
            
      logger.info('🏥 Health Monitor inicializado');
      this.emit('health.monitor.started');
    } catch (error) {
      logger.error('❌ Error inicializando Health Monitor:', error);
      this.emit('health.monitor.error', { error: error.message });
    }
  }

  /**
     * Configurar health checks por defecto
     */
  setupDefaultHealthChecks() {
    // Health check del sistema
    this.addHealthCheck('system', async() => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();
            
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryPercentage = usedMemory / totalMemory;

      return {
        status: memoryPercentage < this.config.alertThresholds.memoryUsage ? 'healthy' : 'warning',
        metrics: {
          memory: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
            system: {
              used: usedMemory,
              total: totalMemory,
              percentage: memoryPercentage * 100
            }
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
            cores: os.cpus().length
          },
          uptime: uptime,
          loadAverage: os.loadavg(),
          platform: os.platform(),
          arch: os.arch()
        }
      };
    });

    // Health check de la aplicación
    this.addHealthCheck('application', async() => {
      const activeHandles = process._getActiveHandles().length;
      const activeRequests = process._getActiveRequests().length;
            
      return {
        status: 'healthy',
        metrics: {
          pid: process.pid,
          version: process.version,
          activeHandles,
          activeRequests,
          environment: process.env.NODE_ENV || 'development'
        }
      };
    });

    // Health check de red
    this.addHealthCheck('network', async() => {
      const networkInterfaces = os.networkInterfaces();
      const activeInterfaces = Object.keys(networkInterfaces).length;
            
      return {
        status: activeInterfaces > 0 ? 'healthy' : 'error',
        metrics: {
          interfaces: activeInterfaces,
          hostname: os.hostname(),
          details: networkInterfaces
        }
      };
    });
  }

  /**
     * Añadir health check personalizado
     */
  addHealthCheck(name, checkFunction, options = {}) {
    this.healthChecks.set(name, {
      name,
      check: checkFunction,
      interval: options.interval || this.config.checkInterval,
      timeout: options.timeout || 5000,
      retries: options.retries || 3,
      lastCheck: null,
      lastResult: null,
      enabled: options.enabled !== false
    });

    logger.info(`🏥 [HEALTH CHECK] Añadido: ${name}`);
  }

  /**
     * Remover health check
     */
  removeHealthCheck(name) {
    if (this.healthChecks.delete(name)) {
      logger.info(`🏥 [HEALTH CHECK] Removido: ${name}`);
    }
  }

  /**
     * Registrar servicio para monitoreo
     */
  registerService(name, config) {
    this.services.set(name, {
      name,
      url: config.url,
      method: config.method || 'GET',
      timeout: config.timeout || 5000,
      expectedStatus: config.expectedStatus || 200,
      headers: config.headers || {},
      enabled: config.enabled !== false,
      lastCheck: null,
      lastResult: null
    });

    logger.info(`🏥 [SERVICE] Registrado: ${name}`);
  }

  /**
     * Iniciar monitoreo
     */
  startMonitoring() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.runHealthChecks();
    }, this.config.checkInterval);

    logger.info('🏥 Monitoreo de salud iniciado');
  }

  /**
     * Detener monitoreo
     */
  stopMonitoring() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    logger.info('🏥 Monitoreo de salud detenido');
  }

  /**
     * Ejecutar todos los health checks
     */
  async runHealthChecks() {
    const timestamp = Date.now();
    const results = new Map();

    // Ejecutar health checks
    for (const [name, healthCheck] of this.healthChecks) {
      if (!healthCheck.enabled) continue;

      try {
        const result = await this.executeHealthCheck(healthCheck);
        results.set(name, result);
        healthCheck.lastCheck = timestamp;
        healthCheck.lastResult = result;
                
        this.storeHealthData(name, result, timestamp);
        this.checkAlerts(name, result);
                
      } catch (error) {
        const errorResult = {
          status: 'error',
          error: error.message,
          timestamp
        };
                
        results.set(name, errorResult);
        healthCheck.lastResult = errorResult;
                
        logger.error(`❌ [HEALTH CHECK] Error en ${name}:`, error.message);
        this.emit('health.check.error', { name, error: error.message });
      }
    }

    // Ejecutar checks de servicios
    for (const [name, service] of this.services) {
      if (!service.enabled) continue;

      try {
        const result = await this.checkService(service);
        results.set(`service_${name}`, result);
        service.lastCheck = timestamp;
        service.lastResult = result;
                
        this.storeHealthData(`service_${name}`, result, timestamp);
        this.checkAlerts(`service_${name}`, result);
                
      } catch (error) {
        const errorResult = {
          status: 'error',
          error: error.message,
          timestamp
        };
                
        results.set(`service_${name}`, errorResult);
        service.lastResult = errorResult;
                
        logger.error(`❌ [SERVICE CHECK] Error en ${name}:`, error.message);
        this.emit('service.check.error', { name, error: error.message });
      }
    }

    // Emitir evento con resultados
    this.emit('health.check.completed', {
      timestamp,
      results: Object.fromEntries(results),
      overallStatus: this.calculateOverallStatus(results)
    });
  }

  /**
     * Ejecutar un health check individual
     */
  async executeHealthCheck(healthCheck) {
    const startTime = Date.now();
        
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout);
    });

    try {
      const result = await Promise.race([
        healthCheck.check(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
            
      return {
        ...result,
        duration,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
     * Verificar estado de un servicio
     */
  async checkService(service) {
    const startTime = Date.now();
        
    try {
      // Simulación de check HTTP (en un entorno real usarías fetch o axios)
      const duration = Math.random() * 100 + 50; // Simular latencia
      const isHealthy = Math.random() > 0.1; // 90% de éxito
            
      return {
        status: isHealthy ? 'healthy' : 'error',
        responseTime: duration,
        timestamp: Date.now(),
        url: service.url,
        method: service.method
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        url: service.url
      };
    }
  }

  /**
     * Almacenar datos de salud
     */
  storeHealthData(category, data, timestamp) {
    const categoryKey = category.startsWith('service_') ? 'external' : category;
        
    if (!this.healthData[categoryKey]) {
      this.healthData[categoryKey] = [];
    }

    this.healthData[categoryKey].push({
      ...data,
      timestamp,
      category
    });

    // Limpiar datos antiguos
    const cutoffTime = timestamp - this.config.retentionPeriod;
    this.healthData[categoryKey] = this.healthData[categoryKey]
      .filter(item => item.timestamp > cutoffTime);
  }

  /**
     * Verificar alertas
     */
  checkAlerts(name, result) {
    const alertKey = `${name}_${result.status}`;
        
    if (result.status === 'error' || result.status === 'warning') {
      if (!this.alerts.has(alertKey)) {
        this.alerts.set(alertKey, {
          name,
          status: result.status,
          firstOccurrence: Date.now(),
          count: 1,
          lastOccurrence: Date.now()
        });
                
        this.emit('health.alert.new', {
          name,
          status: result.status,
          result
        });
                
        logger.warn(`🚨 [ALERT] ${name}: ${result.status}`);
      } else {
        const alert = this.alerts.get(alertKey);
        alert.count++;
        alert.lastOccurrence = Date.now();
      }
    } else if (result.status === 'healthy') {
      // Limpiar alertas resueltas
      const errorAlert = `${name}_error`;
      const warningAlert = `${name}_warning`;
            
      if (this.alerts.has(errorAlert)) {
        this.alerts.delete(errorAlert);
        this.emit('health.alert.resolved', { name, status: 'error' });
        logger.info(`✅ [ALERT RESOLVED] ${name}: error`);
      }
            
      if (this.alerts.has(warningAlert)) {
        this.alerts.delete(warningAlert);
        this.emit('health.alert.resolved', { name, status: 'warning' });
        logger.info(`✅ [ALERT RESOLVED] ${name}: warning`);
      }
    }
  }

  /**
     * Calcular estado general del sistema
     */
  calculateOverallStatus(results) {
    const statuses = Array.from(results.values()).map(r => r.status);
        
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  /**
     * Obtener estado actual del sistema
     */
  getSystemStatus() {
    const timestamp = Date.now();
    const healthChecks = {};
    const services = {};
        
    // Recopilar resultados de health checks
    for (const [name, check] of this.healthChecks) {
      healthChecks[name] = {
        enabled: check.enabled,
        lastCheck: check.lastCheck,
        lastResult: check.lastResult,
        status: check.lastResult?.status || 'unknown'
      };
    }
        
    // Recopilar resultados de servicios
    for (const [name, service] of this.services) {
      services[name] = {
        enabled: service.enabled,
        url: service.url,
        lastCheck: service.lastCheck,
        lastResult: service.lastResult,
        status: service.lastResult?.status || 'unknown'
      };
    }
        
    const allResults = new Map();
    for (const check of Object.values(healthChecks)) {
      if (check.lastResult) {
        allResults.set(check.name || 'unknown', check.lastResult);
      }
    }
    for (const service of Object.values(services)) {
      if (service.lastResult) {
        allResults.set(service.name || 'unknown', service.lastResult);
      }
    }
        
    return {
      timestamp,
      overallStatus: this.calculateOverallStatus(allResults),
      healthChecks,
      services,
      alerts: Object.fromEntries(this.alerts),
      uptime: process.uptime(),
      isMonitoring: this.isRunning
    };
  }

  /**
     * Obtener métricas históricas
     */
  getHistoricalMetrics(category, timeRange = 3600000) { // 1 hora por defecto
    const cutoffTime = Date.now() - timeRange;
        
    if (!this.healthData[category]) {
      return [];
    }
        
    return this.healthData[category]
      .filter(item => item.timestamp > cutoffTime)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
     * Generar reporte de salud
     */
  async generateHealthReport() {
    const report = {
      timestamp: new Date().toISOString(),
      systemStatus: this.getSystemStatus(),
      metrics: {
        system: this.getHistoricalMetrics('system'),
        application: this.getHistoricalMetrics('application'),
        network: this.getHistoricalMetrics('network'),
        external: this.getHistoricalMetrics('external')
      },
      alerts: {
        active: Array.from(this.alerts.values()),
        total: this.alerts.size
      },
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(this.config.dataPath, `health-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
    logger.info(`📊 [HEALTH REPORT] Generado: ${reportPath}`);
    this.emit('health.report.generated', { report, path: reportPath });
        
    return report;
  }

  /**
     * Generar recomendaciones
     */
  generateRecommendations() {
    const recommendations = [];
        
    // Analizar alertas activas
    for (const alert of this.alerts.values()) {
      if (alert.status === 'error') {
        recommendations.push({
          type: 'critical',
          message: `Resolver error crítico en ${alert.name}`,
          priority: 'high'
        });
      } else if (alert.status === 'warning') {
        recommendations.push({
          type: 'warning',
          message: `Investigar advertencia en ${alert.name}`,
          priority: 'medium'
        });
      }
    }
        
    // Analizar métricas del sistema
    const systemMetrics = this.getHistoricalMetrics('system', 1800000); // 30 minutos
    if (systemMetrics.length > 0) {
      const latestMetrics = systemMetrics[systemMetrics.length - 1];
            
      if (latestMetrics.metrics?.memory?.system?.percentage > 85) {
        recommendations.push({
          type: 'performance',
          message: 'Uso de memoria del sistema alto, considerar optimización',
          priority: 'medium'
        });
      }
            
      if (latestMetrics.metrics?.loadAverage?.[0] > os.cpus().length) {
        recommendations.push({
          type: 'performance',
          message: 'Carga del CPU alta, revisar procesos activos',
          priority: 'medium'
        });
      }
    }
        
    return recommendations;
  }

  /**
     * Exportar métricas para monitoreo externo
     */
  exportMetrics(format = 'json') {
    const metrics = this.getSystemStatus();
        
    switch (format) {
    case 'prometheus':
      return this.formatPrometheusMetrics(metrics);
    case 'influxdb':
      return this.formatInfluxDBMetrics(metrics);
    default:
      return JSON.stringify(metrics, null, 2);
    }
  }

  /**
     * Formatear métricas para Prometheus
     */
  formatPrometheusMetrics(metrics) {
    let output = '';
        
    // Métricas de estado general
    output += '# HELP system_health_status Overall system health status\n';
    output += '# TYPE system_health_status gauge\n';
    output += `system_health_status{status="${metrics.overallStatus}"} ${metrics.overallStatus === 'healthy' ? 1 : 0}\n\n`;
        
    // Métricas de uptime
    output += '# HELP system_uptime_seconds System uptime in seconds\n';
    output += '# TYPE system_uptime_seconds counter\n';
    output += `system_uptime_seconds ${metrics.uptime}\n\n`;
        
    // Métricas de alertas
    output += '# HELP system_alerts_total Total number of active alerts\n';
    output += '# TYPE system_alerts_total gauge\n';
    output += `system_alerts_total ${Object.keys(metrics.alerts).length}\n\n`;
        
    return output;
  }

  /**
     * Limpiar datos antiguos
     */
  cleanup() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
        
    for (const category in this.healthData) {
      this.healthData[category] = this.healthData[category]
        .filter(item => item.timestamp > cutoffTime);
    }
        
    logger.info('🧹 [CLEANUP] Datos de salud antiguos limpiados');
  }

  /**
     * Detener el monitor
     */
  stop() {
    this.stopMonitoring();
    this.healthChecks.clear();
    this.services.clear();
    this.alerts.clear();
        
    logger.info('🏥 Health Monitor detenido');
    this.emit('health.monitor.stopped');
  }
}

export default SystemHealthMonitor;
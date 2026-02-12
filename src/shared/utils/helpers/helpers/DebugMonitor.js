import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

/**
 * Sistema avanzado de debugging y monitoreo
 * Proporciona herramientas para debugging, profiling, métricas y monitoreo en tiempo real
 */
class DebugMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
        
    this.config = {
      enabled: process.env.DEBUG_MONITOR_ENABLED !== 'false',
      logLevel: process.env.DEBUG_LOG_LEVEL || 'info',
      metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 30000, // 30 segundos
      maxMemorySnapshots: parseInt(process.env.MAX_MEMORY_SNAPSHOTS) || 100,
      performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD) || 1000, // 1 segundo
      enableProfiling: process.env.ENABLE_PROFILING === 'true',
      enableMemoryTracking: process.env.ENABLE_MEMORY_TRACKING !== 'false',
      enablePerformanceTracking: process.env.ENABLE_PERFORMANCE_TRACKING !== 'false',
      dataPath: options.dataPath || path.join(process.cwd(), 'data', 'debug'),
      ...options
    };

    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      performance: new Map(),
      memory: [],
      cpu: [],
      activeConnections: 0,
      totalRequests: 0,
      totalErrors: 0
    };

    this.profilers = new Map();
    this.watchers = new Map();
    this.alerts = new Map();
        
    this.initialize();
  }

  /**
     * Inicializar el sistema de monitoreo
     */
  async initialize() {
    if (!this.config.enabled) {
      logger.info('🔧 Debug Monitor deshabilitado');
      return;
    }

    try {
      await fs.mkdir(this.config.dataPath, { recursive: true });
            
      if (this.config.enableMemoryTracking) {
        this.startMemoryTracking();
      }
            
      if (this.config.enablePerformanceTracking) {
        this.startPerformanceTracking();
      }
            
      this.startMetricsCollection();
      this.setupProcessMonitoring();
            
      logger.info('🔍 Debug Monitor inicializado correctamente');
      this.emit('monitor.initialized');
    } catch (error) {
      logger.error('❌ Error inicializando Debug Monitor:', error);
      this.emit('monitor.error', { error: error.message });
    }
  }

  // ==================== DEBUGGING ====================

  /**
     * Crear un punto de debugging
     */
  debug(label, data = {}) {
    if (!this.config.enabled) return;

    const debugInfo = {
      timestamp: new Date().toISOString(),
      label,
      data,
      stack: new Error().stack,
      memory: process.memoryUsage(),
      pid: process.pid
    };

    logger.info(`🐛 [DEBUG] ${label}:`, data);
    this.emit('debug.point', debugInfo);
        
    return debugInfo;
  }

  /**
     * Crear un breakpoint condicional
     */
  breakpoint(condition, label, data = {}) {
    if (!this.config.enabled || !condition) return false;

    logger.info(`🛑 [BREAKPOINT] ${label}:`, data);
    console.trace('Breakpoint stack trace:');
        
    this.emit('debug.breakpoint', { label, data, condition });
    return true;
  }

  /**
     * Inspeccionar objeto en profundidad
     */
  inspect(obj, label = 'Object', depth = 3) {
    if (!this.config.enabled) return;

    const inspection = {
      label,
      type: typeof obj,
      constructor: obj?.constructor?.name,
      keys: obj && typeof obj === 'object' ? Object.keys(obj) : null,
      prototype: obj && typeof obj === 'object' ? Object.getPrototypeOf(obj)?.constructor?.name : null,
      value: obj
    };

    logger.info(`🔍 [INSPECT] ${label}:`, JSON.stringify(inspection, null, 2));
    this.emit('debug.inspect', inspection);
        
    return inspection;
  }

  // ==================== PROFILING ====================

  /**
     * Iniciar profiling de una función
     */
  startProfiling(name) {
    if (!this.config.enabled || !this.config.enableProfiling) return null;

    const profiler = {
      name,
      startTime: performance.now(),
      startMemory: process.memoryUsage(),
      startCpu: process.cpuUsage()
    };

    this.profilers.set(name, profiler);
    logger.info(`⏱️ [PROFILING] Iniciado: ${name}`);
        
    return profiler;
  }

  /**
     * Finalizar profiling
     */
  endProfiling(name) {
    if (!this.config.enabled || !this.profilers.has(name)) return null;

    const profiler = this.profilers.get(name);
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(profiler.startCpu);

    const result = {
      name,
      duration: endTime - profiler.startTime,
      memoryDelta: {
        rss: endMemory.rss - profiler.startMemory.rss,
        heapUsed: endMemory.heapUsed - profiler.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - profiler.startMemory.heapTotal
      },
      cpuUsage: {
        user: endCpu.user,
        system: endCpu.system
      },
      timestamp: new Date().toISOString()
    };

    this.profilers.delete(name);
        
    if (result.duration > this.config.performanceThreshold) {
      logger.warn(`⚠️ [PERFORMANCE] Operación lenta detectada: ${name} (${result.duration.toFixed(2)}ms)`);
      this.emit('performance.slow', result);
    }

    logger.info(`✅ [PROFILING] Finalizado: ${name} (${result.duration.toFixed(2)}ms)`);
    this.emit('profiling.complete', result);
        
    return result;
  }

  /**
     * Decorator para profiling automático
     */
  profile(target, propertyKey, descriptor) {
    if (!this.config.enabled) return descriptor;

    const originalMethod = descriptor.value;
    const monitor = this;

    descriptor.value = async function(...args) {
      const profileName = `${target.constructor.name}.${propertyKey}`;
      monitor.startProfiling(profileName);
            
      try {
        const result = await originalMethod.apply(this, args);
        monitor.endProfiling(profileName);
        return result;
      } catch (error) {
        monitor.endProfiling(profileName);
        monitor.trackError(error, profileName);
        throw error;
      }
    };

    return descriptor;
  }

  // ==================== MÉTRICAS ====================

  /**
     * Rastrear una métrica
     */
  trackMetric(name, value, tags = {}) {
    if (!this.config.enabled) return;

    const metric = {
      name,
      value,
      tags,
      timestamp: Date.now()
    };

    if (!this.metrics.performance.has(name)) {
      this.metrics.performance.set(name, []);
    }

    this.metrics.performance.get(name).push(metric);
    this.emit('metric.tracked', metric);
  }

  /**
     * Rastrear error
     */
  trackError(error, context = '') {
    if (!this.config.enabled) return;

    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      memory: process.memoryUsage()
    };

    const errorKey = `${error.name}:${context}`;
    if (!this.metrics.errors.has(errorKey)) {
      this.metrics.errors.set(errorKey, 0);
    }
    this.metrics.errors.set(errorKey, this.metrics.errors.get(errorKey) + 1);
    this.metrics.totalErrors++;

    logger.error(`❌ [ERROR] ${context}:`, error);
    this.emit('error.tracked', errorInfo);
  }

  /**
     * Rastrear request
     */
  trackRequest(method, path, duration, statusCode) {
    if (!this.config.enabled) return;

    const requestKey = `${method}:${path}`;
    if (!this.metrics.requests.has(requestKey)) {
      this.metrics.requests.set(requestKey, {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        statusCodes: new Map()
      });
    }

    const requestMetric = this.metrics.requests.get(requestKey);
    requestMetric.count++;
    requestMetric.totalDuration += duration;
    requestMetric.avgDuration = requestMetric.totalDuration / requestMetric.count;
        
    if (!requestMetric.statusCodes.has(statusCode)) {
      requestMetric.statusCodes.set(statusCode, 0);
    }
    requestMetric.statusCodes.set(statusCode, requestMetric.statusCodes.get(statusCode) + 1);

    this.metrics.totalRequests++;
    this.emit('request.tracked', { method, path, duration, statusCode });
  }

  // ==================== MONITOREO DE MEMORIA ====================

  /**
     * Iniciar tracking de memoria
     */
  startMemoryTracking() {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memorySnapshot = {
        timestamp: Date.now(),
        ...memoryUsage,
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024)
      };

      this.metrics.memory.push(memorySnapshot);
            
      // Mantener solo los últimos snapshots
      if (this.metrics.memory.length > this.config.maxMemorySnapshots) {
        this.metrics.memory.shift();
      }

      // Alertas de memoria
      if (memorySnapshot.heapUsedMB > 500) { // 500MB
        this.emit('memory.high', memorySnapshot);
      }

    }, this.config.metricsInterval);
  }

  /**
     * Iniciar tracking de performance
     */
  startPerformanceTracking() {
    setInterval(() => {
      const cpuUsage = process.cpuUsage();
      const performanceSnapshot = {
        timestamp: Date.now(),
        cpuUsage,
        uptime: process.uptime(),
        activeHandles: process._getActiveHandles().length,
        activeRequests: process._getActiveRequests().length
      };

      this.metrics.cpu.push(performanceSnapshot);
            
      // Mantener solo los últimos snapshots
      if (this.metrics.cpu.length > this.config.maxMemorySnapshots) {
        this.metrics.cpu.shift();
      }

    }, this.config.metricsInterval);
  }

  /**
     * Configurar monitoreo de proceso
     */
  setupProcessMonitoring() {
    process.on('uncaughtException', (error) => {
      logger.error('🚨 [UNCAUGHT EXCEPTION]:', error);
      this.trackError(error, 'uncaughtException');
      this.emit('process.uncaughtException', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('🚨 [UNHANDLED REJECTION]:', reason);
      this.trackError(new Error(reason), 'unhandledRejection');
      this.emit('process.unhandledRejection', { reason, promise });
    });

    process.on('warning', (warning) => {
      logger.warn('⚠️ [PROCESS WARNING]:', warning);
      this.emit('process.warning', warning);
    });
  }

  /**
     * Iniciar colección de métricas
     */
  startMetricsCollection() {
    setInterval(() => {
      this.emit('metrics.collected', this.getMetricsSummary());
    }, this.config.metricsInterval);
  }

  // ==================== WATCHERS ====================

  /**
     * Observar cambios en una variable
     */
  watch(name, getValue, onChange) {
    if (!this.config.enabled) return;

    const watcher = {
      name,
      getValue,
      onChange,
      lastValue: getValue(),
      interval: setInterval(() => {
        const currentValue = getValue();
        if (currentValue !== watcher.lastValue) {
          onChange(currentValue, watcher.lastValue);
          watcher.lastValue = currentValue;
          this.emit('watcher.changed', { name, currentValue, previousValue: watcher.lastValue });
        }
      }, 1000)
    };

    this.watchers.set(name, watcher);
    logger.info(`👁️ [WATCHER] Observando: ${name}`);
  }

  /**
     * Detener watcher
     */
  unwatch(name) {
    if (this.watchers.has(name)) {
      clearInterval(this.watchers.get(name).interval);
      this.watchers.delete(name);
      logger.info(`👁️ [WATCHER] Detenido: ${name}`);
    }
  }

  // ==================== ALERTAS ====================

  /**
     * Configurar alerta
     */
  setAlert(name, condition, action) {
    this.alerts.set(name, { condition, action });
    logger.info(`🚨 [ALERT] Configurada: ${name}`);
  }

  /**
     * Verificar alertas
     */
  checkAlerts() {
    for (const [name, alert] of this.alerts) {
      try {
        if (alert.condition()) {
          alert.action();
          this.emit('alert.triggered', { name });
        }
      } catch (error) {
        logger.error(`❌ Error verificando alerta ${name}:`, error);
      }
    }
  }

  // ==================== REPORTES ====================

  /**
     * Obtener resumen de métricas
     */
  getMetricsSummary() {
    const latestMemory = this.metrics.memory[this.metrics.memory.length - 1];
    const latestCpu = this.metrics.cpu[this.metrics.cpu.length - 1];

    return {
      timestamp: new Date().toISOString(),
      requests: {
        total: this.metrics.totalRequests,
        byEndpoint: Object.fromEntries(this.metrics.requests)
      },
      errors: {
        total: this.metrics.totalErrors,
        byType: Object.fromEntries(this.metrics.errors)
      },
      memory: latestMemory,
      cpu: latestCpu,
      activeConnections: this.metrics.activeConnections,
      uptime: process.uptime()
    };
  }

  /**
     * Generar reporte de debugging
     */
  async generateDebugReport() {
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      metrics: this.getMetricsSummary(),
      profilers: Array.from(this.profilers.keys()),
      watchers: Array.from(this.watchers.keys()),
      alerts: Array.from(this.alerts.keys()),
      memoryHistory: this.metrics.memory.slice(-10), // Últimos 10 snapshots
      cpuHistory: this.metrics.cpu.slice(-10),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        cwd: process.cwd()
      }
    };

    const reportPath = path.join(this.config.dataPath, `debug-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
    logger.info(`📊 [REPORT] Reporte generado: ${reportPath}`);
    this.emit('report.generated', { report, path: reportPath });
        
    return report;
  }

  /**
     * Exportar métricas para herramientas externas
     */
  exportMetrics(format = 'json') {
    const metrics = this.getMetricsSummary();
        
    switch (format) {
    case 'prometheus':
      return this.formatPrometheusMetrics(metrics);
    case 'csv':
      return this.formatCSVMetrics(metrics);
    default:
      return JSON.stringify(metrics, null, 2);
    }
  }

  /**
     * Formatear métricas para Prometheus
     */
  formatPrometheusMetrics(metrics) {
    let output = '';
        
    output += '# HELP nodejs_memory_heap_used_bytes Memory heap used\n';
    output += '# TYPE nodejs_memory_heap_used_bytes gauge\n';
    output += `nodejs_memory_heap_used_bytes ${metrics.memory?.heapUsed || 0}\n\n`;
        
    output += '# HELP nodejs_requests_total Total number of requests\n';
    output += '# TYPE nodejs_requests_total counter\n';
    output += `nodejs_requests_total ${metrics.requests.total}\n\n`;
        
    output += '# HELP nodejs_errors_total Total number of errors\n';
    output += '# TYPE nodejs_errors_total counter\n';
    output += `nodejs_errors_total ${metrics.errors.total}\n\n`;
        
    return output;
  }

  /**
     * Limpiar datos antiguos
     */
  cleanup() {
    this.metrics.memory = this.metrics.memory.slice(-this.config.maxMemorySnapshots);
    this.metrics.cpu = this.metrics.cpu.slice(-this.config.maxMemorySnapshots);
        
    // Limpiar profilers antiguos
    for (const [name, profiler] of this.profilers) {
      if (Date.now() - profiler.startTime > 300000) { // 5 minutos
        this.profilers.delete(name);
        logger.warn(`⚠️ [CLEANUP] Profiler abandonado: ${name}`);
      }
    }
  }

  /**
     * Detener el monitor
     */
  stop() {
    for (const watcher of this.watchers.values()) {
      clearInterval(watcher.interval);
    }
    this.watchers.clear();
    this.alerts.clear();
    this.profilers.clear();
        
    logger.info('🔍 Debug Monitor detenido');
    this.emit('monitor.stopped');
  }
}

export default DebugMonitor;
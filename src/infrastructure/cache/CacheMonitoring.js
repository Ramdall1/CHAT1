/**
 * Cache Monitoring System
 * Sistema de monitoreo y métricas para cache distribuido
 * Incluye alertas, dashboards y análisis de rendimiento
 */

import { EventEmitter } from 'events';
import os from 'os';
import distributedCacheManager from './DistributedCacheManager.js';
import logger from '../core/core/logger.js';

class CacheMonitoring extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      metricsInterval: 30000, // 30 segundos
      alertThresholds: {
        hitRateMin: 0.8, // 80%
        errorRateMax: 0.05, // 5%
        responseTimeMax: 100, // 100ms
        memoryUsageMax: 0.85, // 85%
        connectionCountMax: 100
      },
      enableAlerts: true,
      enableDashboard: true,
      retentionPeriod: 86400000, // 24 horas
      ...options
    };

    this.metrics = {
      current: this.initializeMetrics(),
      history: [],
      alerts: [],
      performance: {
        hitRate: [],
        responseTime: [],
        errorRate: [],
        throughput: []
      }
    };

    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.alertCooldowns = new Map();
  }

  /**
   * Inicializar métricas base
   */
  initializeMetrics() {
    return {
      timestamp: new Date().toISOString(),
      cache: {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        totalOperations: 0,
        hitRate: 0,
        errorRate: 0
      },
      performance: {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        operationsPerSecond: 0
      },
      redis: {
        memoryUsage: 0,
        memoryPeak: 0,
        connectedClients: 0,
        commandsProcessed: 0,
        keyspaceHits: 0,
        keyspaceMisses: 0,
        evictedKeys: 0,
        expiredKeys: 0
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        networkIn: 0,
        networkOut: 0
      }
    };
  }

  /**
   * Iniciar monitoreo
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Cache monitoring ya está activo');
      return;
    }

    try {
      logger.info('Iniciando cache monitoring...');
      
      // Configurar listeners de eventos
      this.setupEventListeners();
      
      // Iniciar recolección periódica de métricas
      this.monitoringInterval = setInterval(
        () => this.collectMetrics(),
        this.options.metricsInterval
      );

      this.isMonitoring = true;
      this.emit('monitoringStarted');
      
      logger.info('Cache monitoring iniciado correctamente');

    } catch (error) {
      logger.error('Error iniciando cache monitoring:', error);
      throw error;
    }
  }

  /**
   * Detener monitoreo
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.removeAllListeners();
    this.isMonitoring = false;
    this.emit('monitoringStopped');
    
    logger.info('Cache monitoring detenido');
  }

  /**
   * Configurar listeners de eventos
   */
  setupEventListeners() {
    // Escuchar métricas del cache manager
    distributedCacheManager.on('metrics', (metrics) => {
      this.updateCacheMetrics(metrics);
    });

    // Escuchar métricas HTTP de cache
    distributedCacheManager.on('httpCacheMetrics', (httpMetrics) => {
      this.updateHTTPMetrics(httpMetrics);
    });

    // Escuchar eventos de error
    distributedCacheManager.on('error', (error) => {
      this.handleCacheError(error);
    });
  }

  /**
   * Recolectar métricas periódicamente
   */
  async collectMetrics() {
    try {
      const timestamp = new Date().toISOString();
      
      // Obtener métricas del cache manager
      const cacheMetrics = distributedCacheManager.getMetrics();
      
      // Obtener métricas de Redis
      const redisMetrics = await this.collectRedisMetrics();
      
      // Obtener métricas del sistema
      const systemMetrics = await this.collectSystemMetrics();
      
      // Calcular métricas de rendimiento
      const performanceMetrics = this.calculatePerformanceMetrics();

      // Actualizar métricas actuales
      this.metrics.current = {
        timestamp,
        cache: cacheMetrics,
        performance: performanceMetrics,
        redis: redisMetrics,
        system: systemMetrics
      };

      // Agregar a historial
      this.addToHistory(this.metrics.current);
      
      // Verificar alertas
      if (this.options.enableAlerts) {
        await this.checkAlerts(this.metrics.current);
      }

      // Emitir métricas actualizadas
      this.emit('metricsUpdated', this.metrics.current);

    } catch (error) {
      logger.error('Error recolectando métricas de cache:', error);
    }
  }

  /**
   * Recolectar métricas de Redis
   */
  async collectRedisMetrics() {
    try {
      const redisInfo = await this.getRedisInfo();
      
      return {
        memoryUsage: this.parseRedisMemory(redisInfo.used_memory),
        memoryPeak: this.parseRedisMemory(redisInfo.used_memory_peak),
        connectedClients: parseInt(redisInfo.connected_clients) || 0,
        commandsProcessed: parseInt(redisInfo.total_commands_processed) || 0,
        keyspaceHits: parseInt(redisInfo.keyspace_hits) || 0,
        keyspaceMisses: parseInt(redisInfo.keyspace_misses) || 0,
        evictedKeys: parseInt(redisInfo.evicted_keys) || 0,
        expiredKeys: parseInt(redisInfo.expired_keys) || 0,
        instantaneousOps: parseInt(redisInfo.instantaneous_ops_per_sec) || 0
      };

    } catch (error) {
      logger.error('Error obteniendo métricas de Redis:', error);
      return this.initializeMetrics().redis;
    }
  }

  /**
   * Obtener información de Redis
   */
  async getRedisInfo() {
    try {
      const client = distributedCacheManager.getClient('main');
      const info = await client.info();
      
      // Parsear información de Redis
      const infoObj = {};
      info.split('\r\n').forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          infoObj[key] = value;
        }
      });

      return infoObj;

    } catch (error) {
      logger.error('Error obteniendo info de Redis:', error);
      return {};
    }
  }

  /**
   * Parsear memoria de Redis
   */
  parseRedisMemory(memoryStr) {
    if (!memoryStr) return 0;
    
    const units = { B: 1, K: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024 };
    const match = memoryStr.match(/^(\d+(?:\.\d+)?)([BKMG]?)$/);
    
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2] || 'B';
      return value * (units[unit] || 1);
    }
    
    return parseInt(memoryStr) || 0;
  }

  /**
   * Recolectar métricas del sistema
   */
  async collectSystemMetrics() {
    try {
      
      return {
        cpuUsage: this.getCPUUsage(),
        memoryUsage: (os.totalmem() - os.freemem()) / os.totalmem(),
        networkIn: 0, // Implementar si es necesario
        networkOut: 0 // Implementar si es necesario
      };

    } catch (error) {
      logger.error('Error obteniendo métricas del sistema:', error);
      return this.initializeMetrics().system;
    }
  }

  /**
   * Obtener uso de CPU
   */
  getCPUUsage() {
    const cpus = os.cpus();
    
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    return 1 - (totalIdle / totalTick);
  }

  /**
   * Calcular métricas de rendimiento
   */
  calculatePerformanceMetrics() {
    const recentHistory = this.metrics.history.slice(-10); // Últimas 10 mediciones
    
    if (recentHistory.length === 0) {
      return this.initializeMetrics().performance;
    }

    const responseTimes = recentHistory
      .map(h => h.performance?.avgResponseTime || 0)
      .filter(rt => rt > 0);

    const throughputs = recentHistory
      .map(h => h.cache?.totalOperations || 0);

    return {
      avgResponseTime: this.calculateAverage(responseTimes),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      throughput: this.calculateThroughput(throughputs),
      operationsPerSecond: this.calculateOpsPerSecond(throughputs)
    };
  }

  /**
   * Calcular promedio
   */
  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calcular percentil
   */
  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Calcular throughput
   */
  calculateThroughput(operations) {
    if (operations.length < 2) return 0;
    
    const latest = operations[operations.length - 1];
    const previous = operations[operations.length - 2];
    const intervalSeconds = this.options.metricsInterval / 1000;
    
    return (latest - previous) / intervalSeconds;
  }

  /**
   * Calcular operaciones por segundo
   */
  calculateOpsPerSecond(operations) {
    return this.calculateThroughput(operations);
  }

  /**
   * Agregar métricas al historial
   */
  addToHistory(metrics) {
    this.metrics.history.push(metrics);
    
    // Limpiar historial antiguo
    const cutoffTime = Date.now() - this.options.retentionPeriod;
    this.metrics.history = this.metrics.history.filter(
      m => new Date(m.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Actualizar métricas de cache
   */
  updateCacheMetrics(cacheMetrics) {
    Object.assign(this.metrics.current.cache, cacheMetrics);
  }

  /**
   * Actualizar métricas HTTP
   */
  updateHTTPMetrics(httpMetrics) {
    // Agregar métricas HTTP a las métricas de rendimiento
    this.metrics.performance.responseTime.push({
      timestamp: httpMetrics.timestamp,
      value: httpMetrics.responseTime,
      url: httpMetrics.url,
      cacheStatus: httpMetrics.cacheStatus
    });

    // Mantener solo las últimas 1000 mediciones
    if (this.metrics.performance.responseTime.length > 1000) {
      this.metrics.performance.responseTime = 
        this.metrics.performance.responseTime.slice(-1000);
    }
  }

  /**
   * Manejar errores de cache
   */
  handleCacheError(error) {
    this.metrics.current.cache.errors++;
    
    const alert = {
      type: 'error',
      severity: 'high',
      message: `Cache error: ${error.message}`,
      timestamp: new Date().toISOString(),
      details: error
    };

    this.addAlert(alert);
  }

  /**
   * Verificar alertas
   */
  async checkAlerts(metrics) {
    const alerts = [];
    const thresholds = this.options.alertThresholds;

    // Verificar hit rate
    if (metrics.cache.hitRate < thresholds.hitRateMin) {
      alerts.push({
        type: 'hitRate',
        severity: 'medium',
        message: `Hit rate bajo: ${(metrics.cache.hitRate * 100).toFixed(2)}%`,
        value: metrics.cache.hitRate,
        threshold: thresholds.hitRateMin
      });
    }

    // Verificar error rate
    if (metrics.cache.errorRate > thresholds.errorRateMax) {
      alerts.push({
        type: 'errorRate',
        severity: 'high',
        message: `Error rate alto: ${(metrics.cache.errorRate * 100).toFixed(2)}%`,
        value: metrics.cache.errorRate,
        threshold: thresholds.errorRateMax
      });
    }

    // Verificar tiempo de respuesta
    if (metrics.performance.avgResponseTime > thresholds.responseTimeMax) {
      alerts.push({
        type: 'responseTime',
        severity: 'medium',
        message: `Tiempo de respuesta alto: ${metrics.performance.avgResponseTime}ms`,
        value: metrics.performance.avgResponseTime,
        threshold: thresholds.responseTimeMax
      });
    }

    // Verificar uso de memoria
    const memoryUsagePercent = metrics.redis.memoryUsage / (1024 * 1024 * 1024); // GB
    if (memoryUsagePercent > thresholds.memoryUsageMax) {
      alerts.push({
        type: 'memoryUsage',
        severity: 'high',
        message: `Uso de memoria alto: ${(memoryUsagePercent * 100).toFixed(2)}%`,
        value: memoryUsagePercent,
        threshold: thresholds.memoryUsageMax
      });
    }

    // Verificar conexiones
    if (metrics.redis.connectedClients > thresholds.connectionCountMax) {
      alerts.push({
        type: 'connectionCount',
        severity: 'medium',
        message: `Muchas conexiones: ${metrics.redis.connectedClients}`,
        value: metrics.redis.connectedClients,
        threshold: thresholds.connectionCountMax
      });
    }

    // Procesar alertas
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Procesar alerta
   */
  async processAlert(alert) {
    const alertKey = `${alert.type}_${alert.severity}`;
    const cooldownTime = 300000; // 5 minutos
    const now = Date.now();

    // Verificar cooldown
    if (this.alertCooldowns.has(alertKey)) {
      const lastAlert = this.alertCooldowns.get(alertKey);
      if (now - lastAlert < cooldownTime) {
        return; // Saltar alerta por cooldown
      }
    }

    // Agregar timestamp y ID
    alert.id = `${alertKey}_${now}`;
    alert.timestamp = new Date().toISOString();

    // Agregar a lista de alertas
    this.addAlert(alert);

    // Actualizar cooldown
    this.alertCooldowns.set(alertKey, now);

    // Emitir alerta
    this.emit('alert', alert);

    // Log alerta
    logger.warn(`Cache Alert [${alert.severity}]: ${alert.message}`, alert);

    // Enviar notificación si está configurado
    await this.sendAlertNotification(alert);
  }

  /**
   * Agregar alerta
   */
  addAlert(alert) {
    this.metrics.alerts.unshift(alert);
    
    // Mantener solo las últimas 100 alertas
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts = this.metrics.alerts.slice(0, 100);
    }
  }

  /**
   * Enviar notificación de alerta
   */
  async sendAlertNotification(alert) {
    try {
      // Implementar notificaciones (Slack, email, etc.)
      // Por ahora solo log
      logger.info(`Enviando notificación de alerta: ${alert.message}`);
      
    } catch (error) {
      logger.error('Error enviando notificación de alerta:', error);
    }
  }

  /**
   * Obtener métricas actuales
   */
  getCurrentMetrics() {
    return this.metrics.current;
  }

  /**
   * Obtener historial de métricas
   */
  getMetricsHistory(hours = 1) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.history.filter(
      m => new Date(m.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Obtener alertas recientes
   */
  getRecentAlerts(hours = 24) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.alerts.filter(
      a => new Date(a.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Generar reporte de rendimiento
   */
  generatePerformanceReport(hours = 24) {
    const history = this.getMetricsHistory(hours);
    const alerts = this.getRecentAlerts(hours);

    if (history.length === 0) {
      return {
        period: `${hours} hours`,
        status: 'no_data',
        message: 'No hay datos suficientes para generar el reporte'
      };
    }

    const hitRates = history.map(h => h.cache.hitRate).filter(hr => hr > 0);
    const responseTimes = history.map(h => h.performance.avgResponseTime).filter(rt => rt > 0);
    const throughputs = history.map(h => h.performance.throughput).filter(tp => tp > 0);

    return {
      period: `${hours} hours`,
      timestamp: new Date().toISOString(),
      summary: {
        avgHitRate: this.calculateAverage(hitRates),
        avgResponseTime: this.calculateAverage(responseTimes),
        avgThroughput: this.calculateAverage(throughputs),
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'high').length
      },
      trends: {
        hitRate: {
          min: Math.min(...hitRates),
          max: Math.max(...hitRates),
          avg: this.calculateAverage(hitRates)
        },
        responseTime: {
          min: Math.min(...responseTimes),
          max: Math.max(...responseTimes),
          avg: this.calculateAverage(responseTimes),
          p95: this.calculatePercentile(responseTimes, 95),
          p99: this.calculatePercentile(responseTimes, 99)
        },
        throughput: {
          min: Math.min(...throughputs),
          max: Math.max(...throughputs),
          avg: this.calculateAverage(throughputs)
        }
      },
      alerts: alerts.slice(0, 10), // Últimas 10 alertas
      recommendations: this.generateRecommendations(history, alerts)
    };
  }

  /**
   * Generar recomendaciones
   */
  generateRecommendations(history, alerts) {
    const recommendations = [];
    
    // Analizar hit rate
    const avgHitRate = this.calculateAverage(history.map(h => h.cache.hitRate));
    if (avgHitRate < 0.8) {
      recommendations.push({
        type: 'hitRate',
        priority: 'high',
        message: 'Hit rate bajo. Considerar aumentar TTL o revisar estrategias de cache.',
        action: 'Revisar configuración de TTL y patrones de acceso'
      });
    }

    // Analizar tiempo de respuesta
    const avgResponseTime = this.calculateAverage(history.map(h => h.performance.avgResponseTime));
    if (avgResponseTime > 50) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Tiempo de respuesta alto. Considerar optimizar queries o aumentar recursos.',
        action: 'Optimizar queries de cache y revisar configuración de Redis'
      });
    }

    // Analizar alertas frecuentes
    const alertTypes = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {});

    Object.entries(alertTypes).forEach(([type, count]) => {
      if (count > 5) {
        recommendations.push({
          type: 'alerts',
          priority: 'high',
          message: `Alertas frecuentes de tipo ${type}. Revisar configuración.`,
          action: `Investigar y resolver problemas recurrentes de ${type}`
        });
      }
    });

    return recommendations;
  }

  /**
   * Health check del sistema de monitoreo
   */
  async healthCheck() {
    return {
      status: this.isMonitoring ? 'healthy' : 'stopped',
      monitoring: this.isMonitoring,
      metricsCollected: this.metrics.history.length,
      lastUpdate: this.metrics.current.timestamp,
      alertsActive: this.metrics.alerts.filter(
        a => Date.now() - new Date(a.timestamp).getTime() < 3600000 // 1 hora
      ).length
    };
  }
}

// Instancia singleton
const cacheMonitoring = new CacheMonitoring();

export { CacheMonitoring, cacheMonitoring };
export default cacheMonitoring;
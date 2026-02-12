/**
 * MetricsCollector - Recopilador de Métricas del Sistema
 * 
 * Recopila, procesa y almacena métricas del sistema en tiempo real
 * para el dashboard de monitoreo
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../../services/core/core/logger.js';
import { EventEmitter } from 'events';
import os from 'os';
import process from 'process';

const logger = createLogger('METRICS_COLLECTOR');

export class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuración
    this.config = {
      // Configuración de recopilación
      collectionInterval: options.collectionInterval || 5000, // 5 segundos
      retentionPeriod: options.retentionPeriod || 3600000, // 1 hora
      maxDataPoints: options.maxDataPoints || 720, // 1 hora a 5 segundos
      
      // Métricas habilitadas
      enabledMetrics: options.enabledMetrics || [
        'system',
        'process',
        'memory',
        'cpu',
        'network',
        'disk',
        'events',
        'custom'
      ],
      
      // Configuración de agregación
      aggregationWindow: options.aggregationWindow || 60000, // 1 minuto
      aggregationMethods: options.aggregationMethods || ['avg', 'min', 'max', 'sum'],
      
      // Configuración de alertas
      enableAlerts: options.enableAlerts !== false,
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        diskUsage: 90,
        errorRate: 5,
        responseTime: 2000
      },
      
      ...options
    };
    
    // Estado del collector
    this.isInitialized = false;
    this.isCollecting = false;
    this.startTime = null;
    
    // Almacenamiento de métricas
    this.metrics = new Map();
    this.aggregatedMetrics = new Map();
    this.customMetrics = new Map();
    
    // Timers
    this.collectionTimer = null;
    this.aggregationTimer = null;
    this.cleanupTimer = null;
    
    // Estadísticas de recopilación
    this.stats = {
      totalCollections: 0,
      totalMetrics: 0,
      lastCollection: null,
      errors: 0
    };
    
    // Métricas base del sistema
    this.baselineMetrics = null;
    
    logger.info('MetricsCollector inicializado', {
      collectionInterval: this.config.collectionInterval,
      enabledMetrics: this.config.enabledMetrics
    });
  }
  
  /**
   * Inicializar el collector
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('MetricsCollector ya está inicializado');
      return;
    }
    
    try {
      logger.info('Inicializando MetricsCollector...');
      
      // Inicializar métricas base
      this.initializeMetrics();
      
      // Recopilar métricas base del sistema
      await this.collectBaselineMetrics();
      
      // Configurar timers
      this.setupTimers();
      
      this.isInitialized = true;
      this.startTime = new Date().toISOString();
      
      logger.info('MetricsCollector inicializado correctamente');
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Error inicializando MetricsCollector:', error);
      throw error;
    }
  }
  
  /**
   * Inicializar estructuras de métricas
   */
  initializeMetrics() {
    // Métricas del sistema
    this.metrics.set('system', {
      name: 'system',
      type: 'system',
      data: [],
      lastUpdate: null,
      config: {
        retention: this.config.retentionPeriod,
        maxPoints: this.config.maxDataPoints
      }
    });
    
    // Métricas del proceso
    this.metrics.set('process', {
      name: 'process',
      type: 'process',
      data: [],
      lastUpdate: null,
      config: {
        retention: this.config.retentionPeriod,
        maxPoints: this.config.maxDataPoints
      }
    });
    
    // Métricas de memoria
    this.metrics.set('memory', {
      name: 'memory',
      type: 'memory',
      data: [],
      lastUpdate: null,
      config: {
        retention: this.config.retentionPeriod,
        maxPoints: this.config.maxDataPoints
      }
    });
    
    // Métricas de CPU
    this.metrics.set('cpu', {
      name: 'cpu',
      type: 'cpu',
      data: [],
      lastUpdate: null,
      config: {
        retention: this.config.retentionPeriod,
        maxPoints: this.config.maxDataPoints
      }
    });
    
    // Métricas de red
    this.metrics.set('network', {
      name: 'network',
      type: 'network',
      data: [],
      lastUpdate: null,
      config: {
        retention: this.config.retentionPeriod,
        maxPoints: this.config.maxDataPoints
      }
    });
    
    // Métricas de disco
    this.metrics.set('disk', {
      name: 'disk',
      type: 'disk',
      data: [],
      lastUpdate: null,
      config: {
        retention: this.config.retentionPeriod,
        maxPoints: this.config.maxDataPoints
      }
    });
    
    // Métricas de eventos
    this.metrics.set('events', {
      name: 'events',
      type: 'events',
      data: [],
      lastUpdate: null,
      config: {
        retention: this.config.retentionPeriod,
        maxPoints: this.config.maxDataPoints
      }
    });
  }
  
  /**
   * Recopilar métricas base del sistema
   */
  async collectBaselineMetrics() {
    try {
      this.baselineMetrics = {
        system: {
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          uptime: os.uptime(),
          loadavg: os.loadavg(),
          cpus: os.cpus().length,
          totalmem: os.totalmem(),
          freemem: os.freemem()
        },
        process: {
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          title: process.title,
          argv: process.argv,
          execPath: process.execPath,
          cwd: process.cwd()
        },
        timestamp: new Date().toISOString()
      };
      
      logger.info('Métricas base recopiladas', {
        platform: this.baselineMetrics.system.platform,
        cpus: this.baselineMetrics.system.cpus,
        totalMemory: Math.round(this.baselineMetrics.system.totalmem / 1024 / 1024) + 'MB'
      });
      
    } catch (error) {
      logger.error('Error recopilando métricas base:', error);
      throw error;
    }
  }
  
  /**
   * Configurar timers
   */
  setupTimers() {
    // Timer de recopilación principal
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectionInterval);
    
    // Timer de agregación
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.config.aggregationWindow);
    
    // Timer de limpieza
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // 5 minutos
  }
  
  /**
   * Iniciar recopilación de métricas
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isCollecting) {
      logger.warn('MetricsCollector ya está recopilando');
      return;
    }
    
    try {
      logger.info('Iniciando recopilación de métricas...');
      
      // Realizar primera recopilación
      await this.collectMetrics();
      
      this.isCollecting = true;
      
      logger.info('Recopilación de métricas iniciada');
      this.emit('started');
      
    } catch (error) {
      logger.error('Error iniciando recopilación de métricas:', error);
      throw error;
    }
  }
  
  /**
   * Detener recopilación de métricas
   */
  async stop() {
    if (!this.isCollecting) {
      logger.warn('MetricsCollector no está recopilando');
      return;
    }
    
    try {
      logger.info('Deteniendo recopilación de métricas...');
      
      // Detener timers
      if (this.collectionTimer) {
        clearInterval(this.collectionTimer);
        this.collectionTimer = null;
      }
      
      if (this.aggregationTimer) {
        clearInterval(this.aggregationTimer);
        this.aggregationTimer = null;
      }
      
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      
      this.isCollecting = false;
      
      logger.info('Recopilación de métricas detenida');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Error deteniendo recopilación de métricas:', error);
      throw error;
    }
  }
  
  /**
   * Recopilar todas las métricas
   */
  async collectMetrics() {
    try {
      const timestamp = new Date().toISOString();
      const collectedMetrics = {};
      
      // Recopilar métricas habilitadas
      for (const metricType of this.config.enabledMetrics) {
        try {
          let metricData = null;
          
          switch (metricType) {
          case 'system':
            metricData = await this.collectSystemMetrics();
            break;
          case 'process':
            metricData = await this.collectProcessMetrics();
            break;
          case 'memory':
            metricData = await this.collectMemoryMetrics();
            break;
          case 'cpu':
            metricData = await this.collectCPUMetrics();
            break;
          case 'network':
            metricData = await this.collectNetworkMetrics();
            break;
          case 'disk':
            metricData = await this.collectDiskMetrics();
            break;
          case 'events':
            metricData = await this.collectEventMetrics();
            break;
          case 'custom':
            metricData = await this.collectCustomMetrics();
            break;
          }
          
          if (metricData) {
            collectedMetrics[metricType] = metricData;
            this.addMetricData(metricType, metricData, timestamp);
          }
          
        } catch (error) {
          logger.error(`Error recopilando métricas ${metricType}:`, error);
          this.stats.errors++;
        }
      }
      
      // Actualizar estadísticas
      this.stats.totalCollections++;
      this.stats.totalMetrics += Object.keys(collectedMetrics).length;
      this.stats.lastCollection = timestamp;
      
      // Emitir evento de métricas actualizadas
      this.emit('metrics:updated', collectedMetrics);
      
      // Verificar alertas
      if (this.config.enableAlerts) {
        this.checkAlerts(collectedMetrics);
      }
      
    } catch (error) {
      logger.error('Error recopilando métricas:', error);
      this.stats.errors++;
    }
  }
  
  /**
   * Recopilar métricas del sistema
   */
  async collectSystemMetrics() {
    return {
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      usedMemory: os.totalmem() - os.freemem(),
      memoryUsagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
    };
  }
  
  /**
   * Recopilar métricas del proceso
   */
  async collectProcessMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      version: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }
  
  /**
   * Recopilar métricas de memoria
   */
  async collectMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };
    
    return {
      system: {
        total: systemMem.total,
        free: systemMem.free,
        used: systemMem.used,
        usagePercent: (systemMem.used / systemMem.total) * 100
      },
      process: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      }
    };
  }
  
  /**
   * Recopilar métricas de CPU
   */
  async collectCPUMetrics() {
    const cpus = os.cpus();
    const loadavg = os.loadavg();
    const cpuUsage = process.cpuUsage();
    
    // Calcular uso promedio de CPU
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return {
      count: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0,
      loadAverage: {
        '1min': loadavg[0],
        '5min': loadavg[1],
        '15min': loadavg[2]
      },
      usage: {
        total: usage,
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      cores: cpus.map((cpu, index) => ({
        core: index,
        model: cpu.model,
        speed: cpu.speed,
        times: cpu.times
      }))
    };
  }
  
  /**
   * Recopilar métricas de red
   */
  async collectNetworkMetrics() {
    const networkInterfaces = os.networkInterfaces();
    const interfaces = [];
    
    for (const [name, addresses] of Object.entries(networkInterfaces)) {
      for (const address of addresses) {
        interfaces.push({
          interface: name,
          family: address.family,
          address: address.address,
          netmask: address.netmask,
          mac: address.mac,
          internal: address.internal,
          cidr: address.cidr
        });
      }
    }
    
    return {
      interfaces,
      interfaceCount: Object.keys(networkInterfaces).length,
      // Nota: Para métricas de tráfico de red en tiempo real,
      // se necesitaría integración con herramientas del sistema
      traffic: {
        bytesReceived: 0, // Placeholder
        bytesSent: 0, // Placeholder
        packetsReceived: 0, // Placeholder
        packetsSent: 0 // Placeholder
      }
    };
  }
  
  /**
   * Recopilar métricas de disco
   */
  async collectDiskMetrics() {
    // Nota: Para métricas de disco en tiempo real,
    // se necesitaría integración con herramientas del sistema
    return {
      usage: {
        total: 0, // Placeholder
        used: 0, // Placeholder
        free: 0, // Placeholder
        usagePercent: 0 // Placeholder
      },
      io: {
        readBytes: 0, // Placeholder
        writeBytes: 0, // Placeholder
        readOps: 0, // Placeholder
        writeOps: 0 // Placeholder
      }
    };
  }
  
  /**
   * Recopilar métricas de eventos
   */
  async collectEventMetrics() {
    // Estas métricas serían actualizadas por el EventBus
    return {
      totalEvents: 0,
      eventsPerSecond: 0,
      eventTypes: {},
      errors: 0,
      errorRate: 0
    };
  }
  
  /**
   * Recopilar métricas personalizadas
   */
  async collectCustomMetrics() {
    const customData = {};
    
    for (const [name, metric] of this.customMetrics) {
      try {
        if (typeof metric.collector === 'function') {
          customData[name] = await metric.collector();
        } else {
          customData[name] = metric.value;
        }
      } catch (error) {
        logger.error(`Error recopilando métrica personalizada ${name}:`, error);
      }
    }
    
    return customData;
  }
  
  /**
   * Agregar datos de métrica
   */
  addMetricData(metricType, data, timestamp) {
    const metric = this.metrics.get(metricType);
    if (!metric) return;
    
    // Agregar nuevo punto de datos
    metric.data.unshift({
      timestamp,
      data,
      value: this.extractNumericValue(data)
    });
    
    // Mantener solo los puntos de datos necesarios
    if (metric.data.length > metric.config.maxPoints) {
      metric.data = metric.data.slice(0, metric.config.maxPoints);
    }
    
    metric.lastUpdate = timestamp;
  }
  
  /**
   * Extraer valor numérico para gráficos
   */
  extractNumericValue(data) {
    if (typeof data === 'number') {
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      // Intentar extraer un valor representativo
      if (data.usagePercent !== undefined) return data.usagePercent;
      if (data.usage !== undefined) return data.usage;
      if (data.total !== undefined) return data.total;
      if (data.count !== undefined) return data.count;
      
      // Para objetos complejos, usar el primer valor numérico encontrado
      for (const value of Object.values(data)) {
        if (typeof value === 'number') {
          return value;
        }
      }
    }
    
    return 0;
  }
  
  /**
   * Agregar métrica personalizada
   */
  addCustomMetric(name, options = {}) {
    this.customMetrics.set(name, {
      name,
      type: options.type || 'custom',
      collector: options.collector,
      value: options.value || 0,
      description: options.description || '',
      unit: options.unit || '',
      tags: options.tags || {},
      created: new Date().toISOString()
    });
    
    logger.info(`Métrica personalizada agregada: ${name}`);
  }
  
  /**
   * Remover métrica personalizada
   */
  removeCustomMetric(name) {
    const removed = this.customMetrics.delete(name);
    if (removed) {
      logger.info(`Métrica personalizada removida: ${name}`);
    }
    return removed;
  }
  
  /**
   * Actualizar valor de métrica personalizada
   */
  updateCustomMetric(name, value) {
    const metric = this.customMetrics.get(name);
    if (metric) {
      metric.value = value;
      metric.lastUpdate = new Date().toISOString();
      return true;
    }
    return false;
  }
  
  /**
   * Agregar métricas de eventos
   */
  updateEventMetrics(eventData) {
    const eventsMetric = this.metrics.get('events');
    if (!eventsMetric || !eventsMetric.data.length) return;
    
    const latestData = eventsMetric.data[0];
    if (latestData && latestData.data) {
      latestData.data.totalEvents = (latestData.data.totalEvents || 0) + 1;
      
      // Actualizar tipos de eventos
      const eventType = eventData.eventType || 'unknown';
      latestData.data.eventTypes = latestData.data.eventTypes || {};
      latestData.data.eventTypes[eventType] = (latestData.data.eventTypes[eventType] || 0) + 1;
      
      // Actualizar errores si es un evento de error
      if (eventType.includes('error') || eventData.error) {
        latestData.data.errors = (latestData.data.errors || 0) + 1;
        latestData.data.errorRate = (latestData.data.errors / latestData.data.totalEvents) * 100;
      }
    }
  }
  
  /**
   * Agregar métricas de adaptadores
   */
  updateAdapterMetrics(adapterId, metrics) {
    const adapterMetricName = `adapter_${adapterId}`;
    
    if (!this.customMetrics.has(adapterMetricName)) {
      this.addCustomMetric(adapterMetricName, {
        type: 'adapter',
        description: `Métricas del adaptador ${adapterId}`,
        value: metrics
      });
    } else {
      this.updateCustomMetric(adapterMetricName, metrics);
    }
  }
  
  /**
   * Agregar métricas de agentes
   */
  updateAgentMetrics(agentId, metrics) {
    const agentMetricName = `agent_${agentId}`;
    
    if (!this.customMetrics.has(agentMetricName)) {
      this.addCustomMetric(agentMetricName, {
        type: 'agent',
        description: `Métricas del agente ${agentId}`,
        value: metrics
      });
    } else {
      this.updateCustomMetric(agentMetricName, metrics);
    }
  }
  
  /**
   * Agregar métricas de rendimiento
   */
  updatePerformanceMetrics(operation, duration, success = true) {
    const perfMetricName = `performance_${operation}`;
    
    if (!this.customMetrics.has(perfMetricName)) {
      this.addCustomMetric(perfMetricName, {
        type: 'performance',
        description: `Métricas de rendimiento para ${operation}`,
        value: {
          totalOperations: 0,
          totalDuration: 0,
          averageDuration: 0,
          successCount: 0,
          errorCount: 0,
          successRate: 0
        }
      });
    }
    
    const metric = this.customMetrics.get(perfMetricName);
    if (metric && metric.value) {
      metric.value.totalOperations++;
      metric.value.totalDuration += duration;
      metric.value.averageDuration = metric.value.totalDuration / metric.value.totalOperations;
      
      if (success) {
        metric.value.successCount++;
      } else {
        metric.value.errorCount++;
      }
      
      metric.value.successRate = (metric.value.successCount / metric.value.totalOperations) * 100;
      metric.lastUpdate = new Date().toISOString();
    }
  }
  
  /**
   * Agregar métricas
   */
  aggregateMetrics() {
    try {
      const now = Date.now();
      const windowStart = now - this.config.aggregationWindow;
      
      for (const [metricName, metric] of this.metrics) {
        const windowData = metric.data.filter(point => 
          new Date(point.timestamp).getTime() >= windowStart
        );
        
        if (windowData.length === 0) continue;
        
        const aggregated = this.calculateAggregations(windowData);
        
        // Almacenar métricas agregadas
        if (!this.aggregatedMetrics.has(metricName)) {
          this.aggregatedMetrics.set(metricName, []);
        }
        
        const aggregatedData = this.aggregatedMetrics.get(metricName);
        aggregatedData.unshift({
          timestamp: new Date().toISOString(),
          window: this.config.aggregationWindow,
          dataPoints: windowData.length,
          ...aggregated
        });
        
        // Mantener solo las agregaciones recientes
        if (aggregatedData.length > 100) {
          this.aggregatedMetrics.set(metricName, aggregatedData.slice(0, 100));
        }
      }
      
      this.emit('metrics:aggregated', Object.fromEntries(this.aggregatedMetrics));
      
    } catch (error) {
      logger.error('Error agregando métricas:', error);
    }
  }
  
  /**
   * Calcular agregaciones
   */
  calculateAggregations(dataPoints) {
    const values = dataPoints.map(point => point.value).filter(v => typeof v === 'number');
    
    if (values.length === 0) {
      return { avg: 0, min: 0, max: 0, sum: 0, count: 0 };
    }
    
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
      avg: Math.round(avg * 100) / 100,
      min,
      max,
      sum,
      count: values.length
    };
  }
  
  /**
   * Verificar alertas
   */
  checkAlerts(metrics) {
    const alerts = [];
    
    // Verificar uso de CPU
    if (metrics.cpu && metrics.cpu.usage && metrics.cpu.usage.total > this.config.alertThresholds.cpuUsage) {
      alerts.push({
        type: 'cpu_usage',
        severity: 'warning',
        message: `Uso de CPU alto: ${metrics.cpu.usage.total.toFixed(1)}%`,
        value: metrics.cpu.usage.total,
        threshold: this.config.alertThresholds.cpuUsage
      });
    }
    
    // Verificar uso de memoria
    if (metrics.memory && metrics.memory.system && metrics.memory.system.usagePercent > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'memory_usage',
        severity: 'warning',
        message: `Uso de memoria alto: ${metrics.memory.system.usagePercent.toFixed(1)}%`,
        value: metrics.memory.system.usagePercent,
        threshold: this.config.alertThresholds.memoryUsage
      });
    }
    
    // Verificar tasa de errores
    if (metrics.events && metrics.events.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'error',
        message: `Tasa de errores alta: ${metrics.events.errorRate.toFixed(1)}%`,
        value: metrics.events.errorRate,
        threshold: this.config.alertThresholds.errorRate
      });
    }
    
    // Emitir alertas
    for (const alert of alerts) {
      this.emit('alert', alert);
    }
  }
  
  /**
   * Limpiar métricas antiguas
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    
    for (const [metricName, metric] of this.metrics) {
      const filteredData = metric.data.filter(point =>
        new Date(point.timestamp).getTime() > cutoffTime
      );
      
      if (filteredData.length !== metric.data.length) {
        metric.data = filteredData;
        logger.debug(`Métricas antiguas limpiadas para ${metricName}: ${metric.data.length} puntos restantes`);
      }
    }
    
    // Limpiar métricas agregadas
    for (const [metricName, aggregatedData] of this.aggregatedMetrics) {
      const filteredData = aggregatedData.filter(point =>
        new Date(point.timestamp).getTime() > cutoffTime
      );
      
      if (filteredData.length !== aggregatedData.length) {
        this.aggregatedMetrics.set(metricName, filteredData);
      }
    }
  }
  
  /**
   * Obtener métricas actuales
   */
  getCurrentMetrics() {
    const current = {};
    
    for (const [metricName, metric] of this.metrics) {
      if (metric.data.length > 0) {
        current[metricName] = metric.data[0];
      }
    }
    
    return current;
  }
  
  /**
   * Obtener métricas históricas
   */
  getHistoricalMetrics(metricName, timeRange = 3600000) {
    const metric = this.metrics.get(metricName);
    if (!metric) return null;
    
    const cutoffTime = Date.now() - timeRange;
    
    return metric.data.filter(point =>
      new Date(point.timestamp).getTime() > cutoffTime
    );
  }
  
  /**
   * Obtener métricas agregadas
   */
  getAggregatedMetrics(metricName) {
    return this.aggregatedMetrics.get(metricName) || [];
  }
  
  /**
   * Obtener todas las métricas
   */
  getAllMetrics() {
    return {
      current: this.getCurrentMetrics(),
      historical: Object.fromEntries(this.metrics),
      aggregated: Object.fromEntries(this.aggregatedMetrics),
      custom: Object.fromEntries(this.customMetrics),
      baseline: this.baselineMetrics,
      stats: this.stats
    };
  }
  
  /**
   * Obtener estadísticas del collector
   */
  getStats() {
    return {
      ...this.stats,
      isInitialized: this.isInitialized,
      isCollecting: this.isCollecting,
      startTime: this.startTime,
      metricsCount: this.metrics.size,
      customMetricsCount: this.customMetrics.size,
      config: this.config
    };
  }
  
  /**
   * Exportar métricas
   */
  exportMetrics(format = 'json', options = {}) {
    const data = this.getAllMetrics();
    
    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'csv':
      return this.convertMetricsToCSV(data);
    default:
      throw new Error(`Formato de exportación no soportado: ${format}`);
    }
  }
  
  /**
   * Convertir métricas a CSV
   */
  convertMetricsToCSV(data) {
    const lines = [];
    lines.push('timestamp,metric,value,type');
    
    for (const [metricName, metric] of Object.entries(data.historical)) {
      for (const point of metric.data) {
        lines.push(`${point.timestamp},${metricName},${point.value},historical`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Destruir el collector
   */
  async destroy() {
    logger.info('Destruyendo MetricsCollector...');
    
    try {
      // Detener si está recopilando
      if (this.isCollecting) {
        await this.stop();
      }
      
      // Limpiar datos
      this.metrics.clear();
      this.aggregatedMetrics.clear();
      this.customMetrics.clear();
      
      this.isInitialized = false;
      
      // Remover listeners
      this.removeAllListeners();
      
      logger.info('MetricsCollector destruido');
      
    } catch (error) {
      logger.error('Error destruyendo MetricsCollector:', error);
      throw error;
    }
  }
}

export default MetricsCollector;
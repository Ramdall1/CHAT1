/**
 * PerformanceAnalyzer - Analizador de Rendimiento del Sistema
 * 
 * Analiza el rendimiento del sistema, identifica cuellos de botella,
 * genera reportes de optimización y métricas de rendimiento
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../../services/core/core/logger.js';
import { EventEmitter } from 'events';
import os from 'os';
import process from 'process';

const logger = createLogger('PERFORMANCE_ANALYZER');

export class PerformanceAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuración
    this.config = {
      // Configuración de análisis
      analysisInterval: options.analysisInterval || 60000, // 1 minuto
      samplingInterval: options.samplingInterval || 5000, // 5 segundos
      retentionPeriod: options.retentionPeriod || 3600000, // 1 hora
      
      // Configuración de métricas
      enabledMetrics: options.enabledMetrics || [
        'cpu',
        'memory',
        'disk',
        'network',
        'process',
        'eventloop',
        'gc',
        'custom'
      ],
      
      // Configuración de análisis
      analysis: {
        enableTrendAnalysis: options.analysis?.enableTrendAnalysis !== false,
        enableAnomalyDetection: options.analysis?.enableAnomalyDetection !== false,
        enableBottleneckDetection: options.analysis?.enableBottleneckDetection !== false,
        enablePrediction: options.analysis?.enablePrediction !== false,
        trendWindow: options.analysis?.trendWindow || 300000, // 5 minutos
        anomalyThreshold: options.analysis?.anomalyThreshold || 2.0, // Desviaciones estándar
        bottleneckThreshold: options.analysis?.bottleneckThreshold || 80, // Porcentaje
        predictionWindow: options.analysis?.predictionWindow || 600000 // 10 minutos
      },
      
      // Configuración de alertas
      alerts: {
        enabled: options.alerts?.enabled !== false,
        thresholds: {
          cpuUsage: options.alerts?.thresholds?.cpuUsage || 85,
          memoryUsage: options.alerts?.thresholds?.memoryUsage || 90,
          diskUsage: options.alerts?.thresholds?.diskUsage || 95,
          responseTime: options.alerts?.thresholds?.responseTime || 5000,
          errorRate: options.alerts?.thresholds?.errorRate || 10,
          throughput: options.alerts?.thresholds?.throughput || 100,
          ...options.alerts?.thresholds
        },
        cooldown: options.alerts?.cooldown || 300000 // 5 minutos
      },
      
      // Configuración de reportes
      reports: {
        enabled: options.reports?.enabled !== false,
        interval: options.reports?.interval || 3600000, // 1 hora
        includeRecommendations: options.reports?.includeRecommendations !== false,
        includeGraphs: options.reports?.includeGraphs !== false
      },
      
      ...options
    };
    
    // Estado del analizador
    this.isInitialized = false;
    this.isAnalyzing = false;
    this.startTime = null;
    
    // Datos de rendimiento
    this.performanceData = {
      cpu: [],
      memory: [],
      disk: [],
      network: [],
      process: [],
      eventloop: [],
      gc: [],
      custom: new Map()
    };
    
    // Análisis de rendimiento
    this.performanceAnalysis = {
      trends: new Map(),
      anomalies: [],
      bottlenecks: [],
      predictions: new Map(),
      recommendations: [],
      lastAnalysis: null
    };
    
    // Estadísticas de rendimiento
    this.performanceStats = {
      totalSamples: 0,
      analysisCount: 0,
      anomaliesDetected: 0,
      bottlenecksDetected: 0,
      alertsTriggered: 0,
      reportsGenerated: 0,
      averageResponseTime: 0,
      peakCpuUsage: 0,
      peakMemoryUsage: 0
    };
    
    // Timers
    this.samplingTimer = null;
    this.analysisTimer = null;
    this.reportTimer = null;
    this.cleanupTimer = null;
    
    // Cache de alertas
    this.alertCache = new Map();
    
    // Métricas personalizadas
    this.customMetrics = new Map();
    
    logger.info('PerformanceAnalyzer inicializado', {
      analysisInterval: this.config.analysisInterval,
      enabledMetrics: this.config.enabledMetrics
    });
  }
  
  /**
   * Inicializar el analizador
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('PerformanceAnalyzer ya está inicializado');
      return;
    }
    
    try {
      logger.info('Inicializando PerformanceAnalyzer...');
      
      // Configurar timers
      this.setupTimers();
      
      // Realizar primera muestra
      await this.collectSample();
      
      this.isInitialized = true;
      this.startTime = new Date().toISOString();
      
      logger.info('PerformanceAnalyzer inicializado correctamente');
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Error inicializando PerformanceAnalyzer:', error);
      throw error;
    }
  }
  
  /**
   * Configurar timers
   */
  setupTimers() {
    // Timer de muestreo
    this.samplingTimer = setInterval(() => {
      this.collectSample();
    }, this.config.samplingInterval);
    
    // Timer de análisis
    this.analysisTimer = setInterval(() => {
      this.performAnalysis();
    }, this.config.analysisInterval);
    
    // Timer de reportes
    if (this.config.reports.enabled) {
      this.reportTimer = setInterval(() => {
        this.generateReport();
      }, this.config.reports.interval);
    }
    
    // Timer de limpieza
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, 600000); // 10 minutos
  }
  
  /**
   * Iniciar análisis
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isAnalyzing) {
      logger.warn('PerformanceAnalyzer ya está analizando');
      return;
    }
    
    try {
      logger.info('Iniciando análisis de rendimiento...');
      
      this.isAnalyzing = true;
      
      logger.info('Análisis de rendimiento iniciado');
      this.emit('started');
      
    } catch (error) {
      logger.error('Error iniciando análisis de rendimiento:', error);
      throw error;
    }
  }
  
  /**
   * Detener análisis
   */
  async stop() {
    if (!this.isAnalyzing) {
      logger.warn('PerformanceAnalyzer no está analizando');
      return;
    }
    
    try {
      logger.info('Deteniendo análisis de rendimiento...');
      
      // Detener timers
      if (this.samplingTimer) {
        clearInterval(this.samplingTimer);
        this.samplingTimer = null;
      }
      
      if (this.analysisTimer) {
        clearInterval(this.analysisTimer);
        this.analysisTimer = null;
      }
      
      if (this.reportTimer) {
        clearInterval(this.reportTimer);
        this.reportTimer = null;
      }
      
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      
      this.isAnalyzing = false;
      
      logger.info('Análisis de rendimiento detenido');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Error deteniendo análisis de rendimiento:', error);
      throw error;
    }
  }
  
  /**
   * Recopilar muestra de rendimiento
   */
  async collectSample() {
    try {
      const timestamp = new Date().toISOString();
      const sample = {
        timestamp,
        cpu: null,
        memory: null,
        disk: null,
        network: null,
        process: null,
        eventloop: null,
        gc: null
      };
      
      // Recopilar métricas habilitadas
      if (this.config.enabledMetrics.includes('cpu')) {
        sample.cpu = await this.collectCPUMetrics();
      }
      
      if (this.config.enabledMetrics.includes('memory')) {
        sample.memory = await this.collectMemoryMetrics();
      }
      
      if (this.config.enabledMetrics.includes('disk')) {
        sample.disk = await this.collectDiskMetrics();
      }
      
      if (this.config.enabledMetrics.includes('network')) {
        sample.network = await this.collectNetworkMetrics();
      }
      
      if (this.config.enabledMetrics.includes('process')) {
        sample.process = await this.collectProcessMetrics();
      }
      
      if (this.config.enabledMetrics.includes('eventloop')) {
        sample.eventloop = await this.collectEventLoopMetrics();
      }
      
      if (this.config.enabledMetrics.includes('gc')) {
        sample.gc = await this.collectGCMetrics();
      }
      
      // Almacenar muestra
      this.storeSample(sample);
      
      // Actualizar estadísticas
      this.updateStats(sample);
      
      // Emitir evento
      this.emit('sample:collected', sample);
      
      logger.debug('Muestra de rendimiento recopilada');
      
    } catch (error) {
      logger.error('Error recopilando muestra de rendimiento:', error);
    }
  }
  
  /**
   * Recopilar métricas de CPU
   */
  async collectCPUMetrics() {
    try {
      const cpus = os.cpus();
      const loadavg = os.loadavg();
      
      // Calcular uso de CPU (simplificado)
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
        usage,
        cores: cpus.length,
        loadavg: {
          '1m': loadavg[0],
          '5m': loadavg[1],
          '15m': loadavg[2]
        },
        model: cpus[0]?.model || 'Unknown',
        speed: cpus[0]?.speed || 0
      };
      
    } catch (error) {
      logger.error('Error recopilando métricas de CPU:', error);
      return null;
    }
  }
  
  /**
   * Recopilar métricas de memoria
   */
  async collectMemoryMetrics() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const processMemory = process.memoryUsage();
      
      return {
        system: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          usage: (usedMem / totalMem) * 100
        },
        process: {
          rss: processMemory.rss,
          heapTotal: processMemory.heapTotal,
          heapUsed: processMemory.heapUsed,
          external: processMemory.external,
          arrayBuffers: processMemory.arrayBuffers,
          heapUsage: (processMemory.heapUsed / processMemory.heapTotal) * 100
        }
      };
      
    } catch (error) {
      logger.error('Error recopilando métricas de memoria:', error);
      return null;
    }
  }
  
  /**
   * Recopilar métricas de disco
   */
  async collectDiskMetrics() {
    try {
      // Implementación básica - en producción usar librerías específicas
      return {
        usage: 0,
        total: 0,
        free: 0,
        reads: 0,
        writes: 0,
        readTime: 0,
        writeTime: 0
      };
    } catch (error) {
      logger.error('Error recopilando métricas de disco:', error);
      return null;
    }
  }
  
  /**
   * Recopilar métricas de red
   */
  async collectNetworkMetrics() {
    try {
      const networkInterfaces = os.networkInterfaces();
      const totalBytesReceived = 0;
      const totalBytesSent = 0;
      
      // Implementación básica - en producción usar librerías específicas
      return {
        interfaces: Object.keys(networkInterfaces).length,
        bytesReceived: totalBytesReceived,
        bytesSent: totalBytesSent,
        packetsReceived: 0,
        packetsSent: 0,
        errors: 0,
        dropped: 0
      };
      
    } catch (error) {
      logger.error('Error recopilando métricas de red:', error);
      return null;
    }
  }
  
  /**
   * Recopilar métricas del proceso
   */
  async collectProcessMetrics() {
    try {
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();
      const pid = process.pid;
      const version = process.version;
      
      return {
        pid,
        uptime,
        version,
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        handles: process._getActiveHandles ? process._getActiveHandles().length : 0,
        requests: process._getActiveRequests ? process._getActiveRequests().length : 0
      };
      
    } catch (error) {
      logger.error('Error recopilando métricas del proceso:', error);
      return null;
    }
  }
  
  /**
   * Recopilar métricas del event loop
   */
  async collectEventLoopMetrics() {
    try {
      // Implementación básica - en producción usar perf_hooks
      return {
        lag: 0,
        utilization: 0,
        min: 0,
        max: 0,
        mean: 0,
        stddev: 0
      };
    } catch (error) {
      logger.error('Error recopilando métricas del event loop:', error);
      return null;
    }
  }
  
  /**
   * Recopilar métricas de garbage collection
   */
  async collectGCMetrics() {
    try {
      // Implementación básica - en producción usar perf_hooks
      return {
        collections: 0,
        duration: 0,
        type: 'unknown',
        heapBefore: 0,
        heapAfter: 0,
        freed: 0
      };
    } catch (error) {
      logger.error('Error recopilando métricas de GC:', error);
      return null;
    }
  }
  
  /**
   * Almacenar muestra
   */
  storeSample(sample) {
    // Almacenar en arrays correspondientes
    for (const [metric, data] of Object.entries(sample)) {
      if (metric === 'timestamp') continue;
      
      if (data && this.performanceData[metric]) {
        this.performanceData[metric].push({
          timestamp: sample.timestamp,
          data
        });
        
        // Limitar tamaño del array
        const maxSamples = Math.ceil(this.config.retentionPeriod / this.config.samplingInterval);
        if (this.performanceData[metric].length > maxSamples) {
          this.performanceData[metric] = this.performanceData[metric].slice(-maxSamples);
        }
      }
    }
    
    // Almacenar métricas personalizadas
    for (const [name, metric] of this.customMetrics) {
      if (!this.performanceData.custom.has(name)) {
        this.performanceData.custom.set(name, []);
      }
      
      const customData = this.performanceData.custom.get(name);
      customData.push({
        timestamp: sample.timestamp,
        value: metric.getValue ? metric.getValue() : metric.value
      });
      
      // Limitar tamaño
      const maxSamples = Math.ceil(this.config.retentionPeriod / this.config.samplingInterval);
      if (customData.length > maxSamples) {
        this.performanceData.custom.set(name, customData.slice(-maxSamples));
      }
    }
  }
  
  /**
   * Actualizar estadísticas
   */
  updateStats(sample) {
    this.performanceStats.totalSamples++;
    
    // Actualizar picos
    if (sample.cpu?.usage > this.performanceStats.peakCpuUsage) {
      this.performanceStats.peakCpuUsage = sample.cpu.usage;
    }
    
    if (sample.memory?.system?.usage > this.performanceStats.peakMemoryUsage) {
      this.performanceStats.peakMemoryUsage = sample.memory.system.usage;
    }
  }
  
  /**
   * Realizar análisis de rendimiento
   */
  async performAnalysis() {
    try {
      logger.debug('Iniciando análisis de rendimiento...');
      
      const analysisStartTime = Date.now();
      
      // Análisis de tendencias
      if (this.config.analysis.enableTrendAnalysis) {
        await this.analyzeTrends();
      }
      
      // Detección de anomalías
      if (this.config.analysis.enableAnomalyDetection) {
        await this.detectAnomalies();
      }
      
      // Detección de cuellos de botella
      if (this.config.analysis.enableBottleneckDetection) {
        await this.detectBottlenecks();
      }
      
      // Predicciones
      if (this.config.analysis.enablePrediction) {
        await this.generatePredictions();
      }
      
      // Generar recomendaciones
      await this.generateRecommendations();
      
      // Verificar alertas
      if (this.config.alerts.enabled) {
        await this.checkPerformanceAlerts();
      }
      
      // Actualizar estadísticas
      this.performanceStats.analysisCount++;
      this.performanceAnalysis.lastAnalysis = new Date().toISOString();
      
      // Emitir evento
      this.emit('analysis:completed', {
        duration: Date.now() - analysisStartTime,
        trends: this.performanceAnalysis.trends.size,
        anomalies: this.performanceAnalysis.anomalies.length,
        bottlenecks: this.performanceAnalysis.bottlenecks.length,
        recommendations: this.performanceAnalysis.recommendations.length
      });
      
      logger.debug(`Análisis de rendimiento completado en ${Date.now() - analysisStartTime}ms`);
      
    } catch (error) {
      logger.error('Error en análisis de rendimiento:', error);
    }
  }
  
  /**
   * Analizar tendencias
   */
  async analyzeTrends() {
    const trendWindow = this.config.analysis.trendWindow;
    const cutoffTime = Date.now() - trendWindow;
    
    for (const [metric, samples] of Object.entries(this.performanceData)) {
      if (metric === 'custom') continue;
      
      const recentSamples = samples.filter(s => 
        new Date(s.timestamp).getTime() > cutoffTime
      );
      
      if (recentSamples.length < 2) continue;
      
      const trend = this.calculateTrend(recentSamples, metric);
      if (trend) {
        this.performanceAnalysis.trends.set(metric, trend);
      }
    }
    
    // Analizar métricas personalizadas
    for (const [name, samples] of this.performanceData.custom) {
      const recentSamples = samples.filter(s => 
        new Date(s.timestamp).getTime() > cutoffTime
      );
      
      if (recentSamples.length < 2) continue;
      
      const trend = this.calculateCustomTrend(recentSamples);
      if (trend) {
        this.performanceAnalysis.trends.set(`custom_${name}`, trend);
      }
    }
  }
  
  /**
   * Calcular tendencia
   */
  calculateTrend(samples, metric) {
    try {
      // Extraer valores según el tipo de métrica
      const values = samples.map(sample => {
        switch (metric) {
        case 'cpu':
          return sample.data.usage;
        case 'memory':
          return sample.data.system.usage;
        case 'process':
          return sample.data.cpu.user + sample.data.cpu.system;
        default:
          return 0;
        }
      });
      
      if (values.length < 2) return null;
      
      // Calcular regresión lineal simple
      const n = values.length;
      const x = Array.from({ length: n }, (_, i) => i);
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
      const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // Calcular R²
      const yMean = sumY / n;
      const ssRes = values.reduce((sum, yi, i) => {
        const predicted = slope * i + intercept;
        return sum + Math.pow(yi - predicted, 2);
      }, 0);
      const ssTot = values.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
      const rSquared = 1 - (ssRes / ssTot);
      
      return {
        metric,
        slope,
        intercept,
        rSquared,
        direction: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
        strength: Math.abs(rSquared),
        samples: n,
        period: this.config.analysis.trendWindow,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Error calculando tendencia para ${metric}:`, error);
      return null;
    }
  }
  
  /**
   * Calcular tendencia personalizada
   */
  calculateCustomTrend(samples) {
    try {
      const values = samples.map(s => s.value);
      
      if (values.length < 2) return null;
      
      // Calcular regresión lineal simple
      const n = values.length;
      const x = Array.from({ length: n }, (_, i) => i);
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
      const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      return {
        slope,
        intercept,
        direction: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
        samples: n,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Error calculando tendencia personalizada:', error);
      return null;
    }
  }
  
  /**
   * Detectar anomalías
   */
  async detectAnomalies() {
    const threshold = this.config.analysis.anomalyThreshold;
    const currentAnomalies = [];
    
    for (const [metric, samples] of Object.entries(this.performanceData)) {
      if (metric === 'custom' || samples.length < 10) continue;
      
      const anomalies = this.detectMetricAnomalies(samples, metric, threshold);
      currentAnomalies.push(...anomalies);
    }
    
    // Detectar anomalías en métricas personalizadas
    for (const [name, samples] of this.performanceData.custom) {
      if (samples.length < 10) continue;
      
      const anomalies = this.detectCustomAnomalies(samples, name, threshold);
      currentAnomalies.push(...anomalies);
    }
    
    this.performanceAnalysis.anomalies = currentAnomalies;
    this.performanceStats.anomaliesDetected += currentAnomalies.length;
  }
  
  /**
   * Detectar anomalías en métrica
   */
  detectMetricAnomalies(samples, metric, threshold) {
    try {
      const recentSamples = samples.slice(-50); // Últimas 50 muestras
      
      // Extraer valores
      const values = recentSamples.map(sample => {
        switch (metric) {
        case 'cpu':
          return sample.data.usage;
        case 'memory':
          return sample.data.system.usage;
        case 'process':
          return sample.data.cpu.user + sample.data.cpu.system;
        default:
          return 0;
        }
      });
      
      // Calcular estadísticas
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      // Detectar anomalías
      const anomalies = [];
      const lowerBound = mean - threshold * stdDev;
      const upperBound = mean + threshold * stdDev;
      
      recentSamples.forEach((sample, index) => {
        const value = values[index];
        
        if (value < lowerBound || value > upperBound) {
          anomalies.push({
            metric,
            timestamp: sample.timestamp,
            value,
            expected: mean,
            deviation: Math.abs(value - mean) / stdDev,
            type: value > upperBound ? 'high' : 'low',
            severity: Math.abs(value - mean) / stdDev > threshold * 1.5 ? 'critical' : 'warning'
          });
        }
      });
      
      return anomalies;
      
    } catch (error) {
      logger.error(`Error detectando anomalías en ${metric}:`, error);
      return [];
    }
  }
  
  /**
   * Detectar anomalías personalizadas
   */
  detectCustomAnomalies(samples, name, threshold) {
    try {
      const recentSamples = samples.slice(-50);
      const values = recentSamples.map(s => s.value);
      
      // Calcular estadísticas
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      // Detectar anomalías
      const anomalies = [];
      const lowerBound = mean - threshold * stdDev;
      const upperBound = mean + threshold * stdDev;
      
      recentSamples.forEach((sample, index) => {
        const value = values[index];
        
        if (value < lowerBound || value > upperBound) {
          anomalies.push({
            metric: `custom_${name}`,
            timestamp: sample.timestamp,
            value,
            expected: mean,
            deviation: Math.abs(value - mean) / stdDev,
            type: value > upperBound ? 'high' : 'low',
            severity: Math.abs(value - mean) / stdDev > threshold * 1.5 ? 'critical' : 'warning'
          });
        }
      });
      
      return anomalies;
      
    } catch (error) {
      logger.error(`Error detectando anomalías en métrica personalizada ${name}:`, error);
      return [];
    }
  }
  
  /**
   * Detectar cuellos de botella
   */
  async detectBottlenecks() {
    const threshold = this.config.analysis.bottleneckThreshold;
    const currentBottlenecks = [];
    
    // Verificar CPU
    const cpuSamples = this.performanceData.cpu.slice(-10);
    if (cpuSamples.length > 0) {
      const avgCpuUsage = cpuSamples.reduce((sum, s) => sum + s.data.usage, 0) / cpuSamples.length;
      
      if (avgCpuUsage > threshold) {
        currentBottlenecks.push({
          type: 'cpu',
          severity: avgCpuUsage > threshold + 10 ? 'critical' : 'warning',
          value: avgCpuUsage,
          threshold,
          message: `Alto uso de CPU: ${avgCpuUsage.toFixed(1)}%`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Verificar memoria
    const memorySamples = this.performanceData.memory.slice(-10);
    if (memorySamples.length > 0) {
      const avgMemoryUsage = memorySamples.reduce((sum, s) => sum + s.data.system.usage, 0) / memorySamples.length;
      
      if (avgMemoryUsage > threshold) {
        currentBottlenecks.push({
          type: 'memory',
          severity: avgMemoryUsage > threshold + 10 ? 'critical' : 'warning',
          value: avgMemoryUsage,
          threshold,
          message: `Alto uso de memoria: ${avgMemoryUsage.toFixed(1)}%`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    this.performanceAnalysis.bottlenecks = currentBottlenecks;
    this.performanceStats.bottlenecksDetected += currentBottlenecks.length;
  }
  
  /**
   * Generar predicciones
   */
  async generatePredictions() {
    const predictionWindow = this.config.analysis.predictionWindow;
    
    for (const [metric, trend] of this.performanceAnalysis.trends) {
      if (trend.rSquared > 0.7) { // Solo predecir si la tendencia es fuerte
        const futureSteps = Math.ceil(predictionWindow / this.config.samplingInterval);
        const currentSamples = this.performanceData[metric]?.length || 0;
        
        const prediction = {
          metric,
          currentValue: trend.intercept + trend.slope * currentSamples,
          predictedValue: trend.intercept + trend.slope * (currentSamples + futureSteps),
          confidence: trend.rSquared,
          timeframe: predictionWindow,
          trend: trend.direction,
          timestamp: new Date().toISOString()
        };
        
        this.performanceAnalysis.predictions.set(metric, prediction);
      }
    }
  }
  
  /**
   * Generar recomendaciones
   */
  async generateRecommendations() {
    const recommendations = [];
    
    // Recomendaciones basadas en cuellos de botella
    for (const bottleneck of this.performanceAnalysis.bottlenecks) {
      switch (bottleneck.type) {
      case 'cpu':
        recommendations.push({
          type: 'optimization',
          priority: bottleneck.severity === 'critical' ? 'high' : 'medium',
          category: 'cpu',
          title: 'Optimizar uso de CPU',
          description: 'El uso de CPU está por encima del umbral recomendado',
          suggestions: [
            'Revisar procesos que consumen más CPU',
            'Optimizar algoritmos computacionalmente intensivos',
            'Considerar escalado horizontal',
            'Implementar cache para reducir cálculos'
          ],
          impact: 'high',
          effort: 'medium',
          timestamp: new Date().toISOString()
        });
        break;
          
      case 'memory':
        recommendations.push({
          type: 'optimization',
          priority: bottleneck.severity === 'critical' ? 'high' : 'medium',
          category: 'memory',
          title: 'Optimizar uso de memoria',
          description: 'El uso de memoria está por encima del umbral recomendado',
          suggestions: [
            'Revisar memory leaks potenciales',
            'Optimizar estructuras de datos',
            'Implementar garbage collection más agresivo',
            'Considerar aumentar memoria disponible'
          ],
          impact: 'high',
          effort: 'medium',
          timestamp: new Date().toISOString()
        });
        break;
      }
    }
    
    // Recomendaciones basadas en tendencias
    for (const [metric, trend] of this.performanceAnalysis.trends) {
      if (trend.direction === 'increasing' && trend.strength > 0.7) {
        recommendations.push({
          type: 'preventive',
          priority: 'medium',
          category: metric,
          title: `Tendencia creciente en ${metric}`,
          description: `Se detectó una tendencia creciente sostenida en ${metric}`,
          suggestions: [
            'Monitorear de cerca la evolución',
            'Planificar optimizaciones preventivas',
            'Considerar escalado proactivo'
          ],
          impact: 'medium',
          effort: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Recomendaciones basadas en anomalías
    const criticalAnomalies = this.performanceAnalysis.anomalies.filter(a => a.severity === 'critical');
    if (criticalAnomalies.length > 0) {
      recommendations.push({
        type: 'investigation',
        priority: 'high',
        category: 'anomalies',
        title: 'Investigar anomalías críticas',
        description: `Se detectaron ${criticalAnomalies.length} anomalías críticas`,
        suggestions: [
          'Revisar logs del sistema en los momentos de las anomalías',
          'Verificar cambios recientes en el código',
          'Analizar correlaciones con eventos externos'
        ],
        impact: 'high',
        effort: 'high',
        timestamp: new Date().toISOString()
      });
    }
    
    this.performanceAnalysis.recommendations = recommendations;
  }
  
  /**
   * Verificar alertas de rendimiento
   */
  async checkPerformanceAlerts() {
    const alerts = [];
    const thresholds = this.config.alerts.thresholds;
    
    // Alertas de CPU
    const latestCpu = this.performanceData.cpu[this.performanceData.cpu.length - 1];
    if (latestCpu && latestCpu.data.usage > thresholds.cpuUsage) {
      const alertKey = `cpu_usage_${latestCpu.data.usage > thresholds.cpuUsage + 10 ? 'critical' : 'warning'}`;
      
      if (this.shouldTriggerAlert(alertKey)) {
        alerts.push({
          id: alertKey,
          type: 'performance',
          metric: 'cpu',
          severity: latestCpu.data.usage > thresholds.cpuUsage + 10 ? 'critical' : 'warning',
          message: `Alto uso de CPU: ${latestCpu.data.usage.toFixed(1)}%`,
          value: latestCpu.data.usage,
          threshold: thresholds.cpuUsage,
          timestamp: new Date().toISOString()
        });
        
        this.alertCache.set(alertKey, Date.now());
      }
    }
    
    // Alertas de memoria
    const latestMemory = this.performanceData.memory[this.performanceData.memory.length - 1];
    if (latestMemory && latestMemory.data.system.usage > thresholds.memoryUsage) {
      const alertKey = `memory_usage_${latestMemory.data.system.usage > thresholds.memoryUsage + 5 ? 'critical' : 'warning'}`;
      
      if (this.shouldTriggerAlert(alertKey)) {
        alerts.push({
          id: alertKey,
          type: 'performance',
          metric: 'memory',
          severity: latestMemory.data.system.usage > thresholds.memoryUsage + 5 ? 'critical' : 'warning',
          message: `Alto uso de memoria: ${latestMemory.data.system.usage.toFixed(1)}%`,
          value: latestMemory.data.system.usage,
          threshold: thresholds.memoryUsage,
          timestamp: new Date().toISOString()
        });
        
        this.alertCache.set(alertKey, Date.now());
      }
    }
    
    // Emitir alertas
    for (const alert of alerts) {
      this.emit('performance:alert', alert);
    }
    
    this.performanceStats.alertsTriggered += alerts.length;
  }
  
  /**
   * Verificar si debe activar alerta (cooldown)
   */
  shouldTriggerAlert(alertKey) {
    const lastAlert = this.alertCache.get(alertKey);
    
    if (!lastAlert) {
      return true;
    }
    
    return Date.now() - lastAlert > this.config.alerts.cooldown;
  }
  
  /**
   * Generar reporte
   */
  async generateReport() {
    try {
      logger.info('Generando reporte de rendimiento...');
      
      const report = {
        id: `performance_report_${Date.now()}`,
        timestamp: new Date().toISOString(),
        period: {
          start: this.startTime,
          end: new Date().toISOString(),
          duration: this.startTime ? Date.now() - new Date(this.startTime).getTime() : 0
        },
        summary: this.generateReportSummary(),
        metrics: this.generateMetricsSummary(),
        analysis: {
          trends: Object.fromEntries(this.performanceAnalysis.trends),
          anomalies: this.performanceAnalysis.anomalies,
          bottlenecks: this.performanceAnalysis.bottlenecks,
          predictions: Object.fromEntries(this.performanceAnalysis.predictions)
        },
        recommendations: this.performanceAnalysis.recommendations,
        stats: this.performanceStats
      };
      
      this.performanceStats.reportsGenerated++;
      
      this.emit('report:generated', report);
      
      logger.info('Reporte de rendimiento generado');
      
      return report;
      
    } catch (error) {
      logger.error('Error generando reporte de rendimiento:', error);
      throw error;
    }
  }
  
  /**
   * Generar resumen del reporte
   */
  generateReportSummary() {
    return {
      overallHealth: this.calculateOverallHealth(),
      totalSamples: this.performanceStats.totalSamples,
      analysisCount: this.performanceStats.analysisCount,
      anomaliesDetected: this.performanceStats.anomaliesDetected,
      bottlenecksDetected: this.performanceStats.bottlenecksDetected,
      alertsTriggered: this.performanceStats.alertsTriggered,
      peakCpuUsage: this.performanceStats.peakCpuUsage,
      peakMemoryUsage: this.performanceStats.peakMemoryUsage,
      averageResponseTime: this.performanceStats.averageResponseTime
    };
  }
  
  /**
   * Generar resumen de métricas
   */
  generateMetricsSummary() {
    const summary = {};
    
    for (const [metric, samples] of Object.entries(this.performanceData)) {
      if (metric === 'custom' || samples.length === 0) continue;
      
      summary[metric] = {
        samples: samples.length,
        latest: samples[samples.length - 1],
        average: this.calculateMetricAverage(samples, metric),
        min: this.calculateMetricMin(samples, metric),
        max: this.calculateMetricMax(samples, metric)
      };
    }
    
    return summary;
  }
  
  /**
   * Calcular salud general
   */
  calculateOverallHealth() {
    let score = 100;
    
    // Penalizar por cuellos de botella
    score -= this.performanceAnalysis.bottlenecks.length * 10;
    
    // Penalizar por anomalías críticas
    const criticalAnomalies = this.performanceAnalysis.anomalies.filter(a => a.severity === 'critical');
    score -= criticalAnomalies.length * 15;
    
    // Penalizar por tendencias negativas
    const negativeTrends = Array.from(this.performanceAnalysis.trends.values())
      .filter(t => t.direction === 'increasing' && t.strength > 0.7);
    score -= negativeTrends.length * 5;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calcular promedio de métrica
   */
  calculateMetricAverage(samples, metric) {
    if (samples.length === 0) return 0;
    
    const values = samples.map(sample => {
      switch (metric) {
      case 'cpu':
        return sample.data.usage;
      case 'memory':
        return sample.data.system.usage;
      case 'process':
        return sample.data.cpu.user + sample.data.cpu.system;
      default:
        return 0;
      }
    });
    
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  /**
   * Calcular mínimo de métrica
   */
  calculateMetricMin(samples, metric) {
    if (samples.length === 0) return 0;
    
    const values = samples.map(sample => {
      switch (metric) {
      case 'cpu':
        return sample.data.usage;
      case 'memory':
        return sample.data.system.usage;
      case 'process':
        return sample.data.cpu.user + sample.data.cpu.system;
      default:
        return 0;
      }
    });
    
    return Math.min(...values);
  }
  
  /**
   * Calcular máximo de métrica
   */
  calculateMetricMax(samples, metric) {
    if (samples.length === 0) return 0;
    
    const values = samples.map(sample => {
      switch (metric) {
      case 'cpu':
        return sample.data.usage;
      case 'memory':
        return sample.data.system.usage;
      case 'process':
        return sample.data.cpu.user + sample.data.cpu.system;
      default:
        return 0;
      }
    });
    
    return Math.max(...values);
  }
  
  /**
   * Registrar métrica personalizada
   */
  registerCustomMetric(name, metric) {
    this.customMetrics.set(name, {
      name,
      description: metric.description || '',
      unit: metric.unit || '',
      getValue: metric.getValue,
      value: metric.value,
      registered: new Date().toISOString()
    });
    
    logger.info(`Métrica personalizada registrada: ${name}`);
  }
  
  /**
   * Desregistrar métrica personalizada
   */
  unregisterCustomMetric(name) {
    const removed = this.customMetrics.delete(name);
    if (removed) {
      this.performanceData.custom.delete(name);
      logger.info(`Métrica personalizada desregistrada: ${name}`);
    }
    return removed;
  }
  
  /**
   * Limpiar datos antiguos
   */
  cleanupOldData() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    
    // Limpiar datos de rendimiento
    for (const [metric, samples] of Object.entries(this.performanceData)) {
      if (metric === 'custom') continue;
      
      this.performanceData[metric] = samples.filter(s => 
        new Date(s.timestamp).getTime() > cutoffTime
      );
    }
    
    // Limpiar métricas personalizadas
    for (const [name, samples] of this.performanceData.custom) {
      const filteredSamples = samples.filter(s => 
        new Date(s.timestamp).getTime() > cutoffTime
      );
      this.performanceData.custom.set(name, filteredSamples);
    }
    
    // Limpiar anomalías antiguas
    this.performanceAnalysis.anomalies = this.performanceAnalysis.anomalies.filter(a => 
      new Date(a.timestamp).getTime() > cutoffTime
    );
    
    // Limpiar cache de alertas
    const now = Date.now();
    for (const [alertKey, timestamp] of this.alertCache) {
      if (now - timestamp > this.config.alerts.cooldown * 2) {
        this.alertCache.delete(alertKey);
      }
    }
    
    logger.debug('Datos antiguos de rendimiento limpiados');
  }
  
  /**
   * Obtener datos de rendimiento
   */
  getPerformanceData(metric = null, limit = null) {
    if (metric) {
      const data = this.performanceData[metric] || [];
      return limit ? data.slice(-limit) : data;
    }
    
    const result = {};
    for (const [key, data] of Object.entries(this.performanceData)) {
      if (key === 'custom') {
        result[key] = Object.fromEntries(this.performanceData.custom);
      } else {
        result[key] = limit ? data.slice(-limit) : data;
      }
    }
    
    return result;
  }
  
  /**
   * Obtener análisis de rendimiento
   */
  getPerformanceAnalysis() {
    return {
      trends: Object.fromEntries(this.performanceAnalysis.trends),
      anomalies: this.performanceAnalysis.anomalies,
      bottlenecks: this.performanceAnalysis.bottlenecks,
      predictions: Object.fromEntries(this.performanceAnalysis.predictions),
      recommendations: this.performanceAnalysis.recommendations,
      lastAnalysis: this.performanceAnalysis.lastAnalysis
    };
  }
  
  /**
   * Obtener estadísticas de rendimiento
   */
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      isInitialized: this.isInitialized,
      isAnalyzing: this.isAnalyzing,
      startTime: this.startTime,
      customMetrics: this.customMetrics.size,
      config: this.config
    };
  }
  
  /**
   * Exportar datos de rendimiento
   */
  exportPerformanceData(format = 'json', options = {}) {
    const data = {
      data: this.getPerformanceData(options.metric, options.limit),
      analysis: this.getPerformanceAnalysis(),
      stats: this.getPerformanceStats()
    };
    
    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'csv':
      return this.convertPerformanceToCSV(data, options.metric);
    default:
      throw new Error(`Formato de exportación no soportado: ${format}`);
    }
  }
  
  /**
   * Convertir datos de rendimiento a CSV
   */
  convertPerformanceToCSV(data, metric = null) {
    if (metric && data.data[metric]) {
      const lines = [];
      lines.push('timestamp,value');
      
      for (const sample of data.data[metric]) {
        const value = metric === 'cpu' ? sample.data.usage :
          metric === 'memory' ? sample.data.system.usage :
            JSON.stringify(sample.data);
        lines.push(`${sample.timestamp},${value}`);
      }
      
      return lines.join('\n');
    }
    
    // CSV general con todas las métricas
    const lines = [];
    lines.push('timestamp,metric,value');
    
    for (const [metricName, samples] of Object.entries(data.data)) {
      if (metricName === 'custom') continue;
      
      for (const sample of samples) {
        const value = metricName === 'cpu' ? sample.data.usage :
          metricName === 'memory' ? sample.data.system.usage :
            JSON.stringify(sample.data);
        lines.push(`${sample.timestamp},${metricName},${value}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Destruir el analizador
   */
  async destroy() {
    logger.info('Destruyendo PerformanceAnalyzer...');
    
    try {
      // Detener si está analizando
      if (this.isAnalyzing) {
        await this.stop();
      }
      
      // Limpiar datos
      for (const key of Object.keys(this.performanceData)) {
        if (key === 'custom') {
          this.performanceData.custom.clear();
        } else {
          this.performanceData[key] = [];
        }
      }
      
      this.performanceAnalysis.trends.clear();
      this.performanceAnalysis.predictions.clear();
      this.performanceAnalysis.anomalies = [];
      this.performanceAnalysis.bottlenecks = [];
      this.performanceAnalysis.recommendations = [];
      
      this.customMetrics.clear();
      this.alertCache.clear();
      
      this.isInitialized = false;
      
      // Remover listeners
      this.removeAllListeners();
      
      logger.info('PerformanceAnalyzer destruido');
      
    } catch (error) {
      logger.error('Error destruyendo PerformanceAnalyzer:', error);
      throw error;
    }
  }
}

export default PerformanceAnalyzer;
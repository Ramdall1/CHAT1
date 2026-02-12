/**
 * Universal Logger - Sistema universal de logging y monitoreo
 * Registra logs, mide tiempo de ejecución y detecta errores silenciosos
 */

import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';

class UniversalLogger extends EventEmitter {
  constructor() {
    super();
    this.baseDir = process.cwd();
    this.logsDir = path.join(this.baseDir, 'logs');
    this.configDir = path.join(this.baseDir, 'config');
        
    this.config = {
      logLevel: 'info',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      rotateDaily: true,
      enableConsole: true,
      enableFile: true,
      enableMetrics: true,
      enablePerformance: true,
      enableErrorDetection: true,
      silentErrorThreshold: 5, // errores por minuto
      performanceThreshold: 1000, // ms
      memoryThreshold: 100 * 1024 * 1024 // 100MB
    };

    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    this.logFiles = {
      error: 'error.log',
      warn: 'warn.log',
      info: 'info.log',
      debug: 'debug.log',
      performance: 'performance.log',
      metrics: 'metrics.log',
      system: 'system.log'
    };

    this.metrics = {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      performanceIssues: 0,
      memoryUsage: [],
      cpuUsage: [],
      silentErrors: [],
      activeTimers: new Map(),
      sessionStart: Date.now()
    };

    this.timers = new Map();
    this.errorPatterns = new Map();
    this.performanceData = new Map();
        
    this.isInitialized = false;
    this.rotationTimer = null;
    this.metricsTimer = null;
    this.errorDetectionTimer = null;
  }

  /**
     * Inicializar el logger universal
     */
  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.ensureDirectories();
      await this.loadConfig();
      await this.setupLogRotation();
      await this.startMetricsCollection();
      await this.startErrorDetection();
            
      this.isInitialized = true;
      this.log('info', 'UniversalLogger inicializado correctamente', { module: 'UniversalLogger' });
            
      return { success: true, message: 'UniversalLogger inicializado' };
            
    } catch (error) {
      // Fallback to console.error since logger might not be initialized
      logger.error('Error inicializando UniversalLogger:', error);
      throw error;
    }
  }

  /**
     * Asegurar directorios necesarios
     */
  async ensureDirectories() {
    const directories = [
      this.logsDir,
      path.join(this.logsDir, 'archived'),
      path.join(this.logsDir, 'metrics'),
      path.join(this.logsDir, 'performance'),
      path.join(this.logsDir, 'errors')
    ];

    for (const dir of directories) {
      await fs.ensureDir(dir);
    }
  }

  /**
     * Cargar configuración
     */
  async loadConfig() {
    try {
      const configPath = path.join(this.configDir, 'logger-config.json');
      if (await fs.pathExists(configPath)) {
        const savedConfig = await fs.readJson(configPath);
        this.config = { ...this.config, ...savedConfig };
      } else {
        await this.saveConfig();
      }
    } catch (error) {
      logger.warn('Error cargando configuración del logger, usando valores por defecto');
    }
  }

  /**
     * Guardar configuración
     */
  async saveConfig() {
    try {
      const configPath = path.join(this.configDir, 'logger-config.json');
      await fs.writeJson(configPath, this.config, { spaces: 2 });
    } catch (error) {
      // Fallback to console.error for configuration save errors
      logger.error('Error guardando configuración del logger:', error);
    }
  }

  /**
     * Método principal de logging
     */
  async log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.createLogEntry(level, message, metadata);
        
    try {
      // Incrementar métricas
      this.metrics.totalLogs++;
      if (level === 'error') this.metrics.errorCount++;
      if (level === 'warn') this.metrics.warnCount++;

      // Log a consola si está habilitado
      if (this.config.enableConsole) {
        this.logToConsole(logEntry);
      }

      // Log a archivo si está habilitado
      if (this.config.enableFile) {
        await this.logToFile(logEntry);
      }

      // Detectar errores silenciosos
      if (this.config.enableErrorDetection && level === 'error') {
        this.detectSilentError(logEntry);
      }

      // Emitir evento
      this.emit('log', logEntry);

    } catch (error) {
      // Fallback to console.error for logging errors to prevent infinite loops
      logger.error('Error en logging:', error);
    }
  }

  /**
     * Crear entrada de log
     */
  createLogEntry(level, message, metadata) {
    const timestamp = new Date().toISOString();
    const stack = this.getCallStack();
        
    return {
      timestamp,
      level: level.toUpperCase(),
      message,
      metadata: {
        ...metadata,
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        stack: stack.slice(0, 3) // Primeras 3 líneas del stack
      },
      id: this.generateId()
    };
  }

  /**
     * Verificar si se debe loggear este nivel
     */
  shouldLog(level) {
    const currentLevel = this.logLevels[this.config.logLevel] || 2;
    const messageLevel = this.logLevels[level] || 2;
    return messageLevel <= currentLevel;
  }

  /**
     * Log a consola
     */
  logToConsole(logEntry) {
    const { timestamp, level, message, metadata } = logEntry;
    const coloredLevel = this.colorizeLevel(level);
    const metaStr = Object.keys(metadata).length > 0 ? 
      ` ${JSON.stringify(metadata, null, 0)}` : '';
        
    logger.info(`${timestamp} ${coloredLevel} ${message}${metaStr}`);
  }

  /**
     * Colorizar nivel de log para consola
     */
  colorizeLevel(level) {
    const colors = {
      ERROR: '\x1b[31m', // Rojo
      WARN: '\x1b[33m',  // Amarillo
      INFO: '\x1b[36m',  // Cian
      DEBUG: '\x1b[35m', // Magenta
      TRACE: '\x1b[37m'  // Blanco
    };
        
    const reset = '\x1b[0m';
    const color = colors[level] || colors.INFO;
        
    return `${color}${level}${reset}`;
  }

  /**
     * Log a archivo
     */
  async logToFile(logEntry) {
    try {
      const { level } = logEntry;
      const fileName = this.getLogFileName(level.toLowerCase());
      const filePath = path.join(this.logsDir, fileName);
            
      const logLine = JSON.stringify(logEntry) + '\n';
            
      // Verificar tamaño del archivo antes de escribir
      await this.checkFileRotation(filePath);
            
      await fs.appendFile(filePath, logLine);
            
    } catch (error) {
      // Fallback to console.error for file writing errors
      logger.error('Error escribiendo a archivo de log:', error);
    }
  }

  /**
     * Obtener nombre de archivo de log
     */
  getLogFileName(level) {
    const baseFileName = this.logFiles[level] || this.logFiles.info;
        
    if (this.config.rotateDaily) {
      const date = new Date().toISOString().split('T')[0];
      const name = path.basename(baseFileName, '.log');
      return `${name}-${date}.log`;
    }
        
    return baseFileName;
  }

  /**
     * Verificar rotación de archivos
     */
  async checkFileRotation(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
                
        if (stats.size > this.config.maxFileSize) {
          await this.rotateFile(filePath);
        }
      }
    } catch (error) {
      // Fallback to console.error for file rotation check errors
      logger.error('Error verificando rotación:', error);
    }
  }

  /**
     * Rotar archivo de log
     */
  async rotateFile(filePath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dir = path.dirname(filePath);
      const name = path.basename(filePath, '.log');
      const archivedDir = path.join(this.logsDir, 'archived');
      const archivedPath = path.join(archivedDir, `${name}-${timestamp}.log`);
            
      await fs.move(filePath, archivedPath);
            
      // Limpiar archivos antiguos
      await this.cleanOldFiles(archivedDir);
            
      this.log('info', `Archivo rotado: ${path.basename(filePath)}`, { 
        module: 'UniversalLogger',
        archivedTo: archivedPath 
      });
            
    } catch (error) {
      // Fallback to console.error for file rotation errors
      logger.error('Error rotando archivo:', error);
    }
  }

  /**
     * Limpiar archivos antiguos
     */
  async cleanOldFiles(directory) {
    try {
      const files = await fs.readdir(directory);
      const logFiles = files.filter(f => f.endsWith('.log'));
            
      if (logFiles.length > this.config.maxFiles) {
        // Ordenar por fecha de modificación
        const fileStats = await Promise.all(
          logFiles.map(async(file) => {
            const filePath = path.join(directory, file);
            const stats = await fs.stat(filePath);
            return { file, mtime: stats.mtime };
          })
        );
                
        fileStats.sort((a, b) => a.mtime - b.mtime);
                
        // Eliminar archivos más antiguos
        const filesToDelete = fileStats.slice(0, fileStats.length - this.config.maxFiles);
                
        for (const { file } of filesToDelete) {
          await fs.remove(path.join(directory, file));
        }
      }
    } catch (error) {
      // Fallback to console.error for file cleanup errors
      logger.error('Error limpiando archivos antiguos:', error);
    }
  }

  /**
     * Configurar rotación automática
     */
  async setupLogRotation() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    // Verificar rotación cada hora
    this.rotationTimer = setInterval(async() => {
      await this.performRotationCheck();
    }, 60 * 60 * 1000);
  }

  /**
     * Realizar verificación de rotación
     */
  async performRotationCheck() {
    try {
      const files = await fs.readdir(this.logsDir);
      const logFiles = files.filter(f => f.endsWith('.log') && !f.includes('-'));
            
      for (const file of logFiles) {
        const filePath = path.join(this.logsDir, file);
        await this.checkFileRotation(filePath);
      }
    } catch (error) {
      // Fallback to console.error for rotation check errors
      logger.error('Error en verificación de rotación:', error);
    }
  }

  /**
     * Iniciar timer de medición de rendimiento
     */
  startTimer(name, metadata = {}) {
    const timerId = this.generateId();
    const timer = {
      id: timerId,
      name,
      startTime: Date.now(),
      startHrTime: process.hrtime(),
      metadata
    };
        
    this.timers.set(timerId, timer);
    this.metrics.activeTimers.set(timerId, timer);
        
    if (this.config.enablePerformance) {
      this.log('debug', `Timer iniciado: ${name}`, { 
        module: 'Performance',
        timerId,
        ...metadata 
      });
    }
        
    return timerId;
  }

  /**
     * Detener timer y registrar tiempo
     */
  stopTimer(timerId, additionalMetadata = {}) {
    const timer = this.timers.get(timerId);
    if (!timer) {
      this.log('warn', `Timer no encontrado: ${timerId}`, { module: 'Performance' });
      return null;
    }

    const endTime = Date.now();
    const endHrTime = process.hrtime(timer.startHrTime);
    const duration = endTime - timer.startTime;
    const preciseTime = endHrTime[0] * 1000 + endHrTime[1] / 1000000;

    const result = {
      id: timerId,
      name: timer.name,
      duration,
      preciseTime,
      startTime: timer.startTime,
      endTime,
      metadata: { ...timer.metadata, ...additionalMetadata }
    };

    // Remover timer
    this.timers.delete(timerId);
    this.metrics.activeTimers.delete(timerId);

    // Registrar performance
    if (this.config.enablePerformance) {
      this.recordPerformance(result);
    }

    // Verificar si es lento
    if (duration > this.config.performanceThreshold) {
      this.metrics.performanceIssues++;
      this.log('warn', `Operación lenta detectada: ${timer.name}`, {
        module: 'Performance',
        duration,
        threshold: this.config.performanceThreshold,
        ...result.metadata
      });
    }

    return result;
  }

  /**
     * Registrar datos de rendimiento
     */
  async recordPerformance(performanceData) {
    try {
      const fileName = this.getLogFileName('performance');
      const filePath = path.join(this.logsDir, 'performance', fileName);
            
      const entry = {
        timestamp: new Date().toISOString(),
        ...performanceData
      };
            
      await fs.appendFile(filePath, JSON.stringify(entry) + '\n');
            
      // Mantener en memoria para análisis
      if (!this.performanceData.has(performanceData.name)) {
        this.performanceData.set(performanceData.name, []);
      }
            
      const history = this.performanceData.get(performanceData.name);
      history.push(performanceData);
            
      // Mantener solo los últimos 100 registros
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
            
    } catch (error) {
      // Fallback to console.error for performance recording errors
      logger.error('Error registrando performance:', error);
    }
  }

  /**
     * Iniciar recolección de métricas del sistema
     */
  startMetricsCollection() {
    if (!this.config.enableMetrics) return;

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    // Recolectar métricas cada 30 segundos
    this.metricsTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }

  /**
     * Recolectar métricas del sistema
     */
  async collectSystemMetrics() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
            
      const metrics = {
        timestamp: new Date().toISOString(),
        memory: memUsage,
        cpu: cpuUsage,
        uptime: process.uptime(),
        activeTimers: this.metrics.activeTimers.size,
        totalLogs: this.metrics.totalLogs,
        errorCount: this.metrics.errorCount
      };

      // Agregar a historial
      this.metrics.memoryUsage.push({
        timestamp: metrics.timestamp,
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      });

      this.metrics.cpuUsage.push({
        timestamp: metrics.timestamp,
        user: cpuUsage.user,
        system: cpuUsage.system
      });

      // Mantener solo las últimas 100 métricas
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
      }
      if (this.metrics.cpuUsage.length > 100) {
        this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-100);
      }

      // Verificar umbrales
      if (memUsage.rss > this.config.memoryThreshold) {
        this.log('warn', 'Uso de memoria alto detectado', {
          module: 'Metrics',
          memoryUsage: memUsage,
          threshold: this.config.memoryThreshold
        });
      }

      // Guardar métricas
      await this.saveMetrics(metrics);
            
      this.emit('metrics', metrics);

    } catch (error) {
      // Fallback to console.error for metrics collection errors
      logger.error('Error recolectando métricas:', error);
    }
  }

  /**
     * Guardar métricas a archivo
     */
  async saveMetrics(metrics) {
    try {
      const fileName = this.getLogFileName('metrics');
      const filePath = path.join(this.logsDir, 'metrics', fileName);
            
      await fs.appendFile(filePath, JSON.stringify(metrics) + '\n');
            
    } catch (error) {
      // Fallback to console.error for metrics saving errors
      logger.error('Error guardando métricas:', error);
    }
  }

  /**
     * Iniciar detección de errores silenciosos
     */
  startErrorDetection() {
    if (!this.config.enableErrorDetection) return;

    if (this.errorDetectionTimer) {
      clearInterval(this.errorDetectionTimer);
    }

    // Verificar errores cada minuto
    this.errorDetectionTimer = setInterval(() => {
      this.detectSilentErrors();
    }, 60000);
  }

  /**
     * Detectar error silencioso
     */
  detectSilentError(logEntry) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
        
    // Agregar error a la lista
    this.metrics.silentErrors.push({
      timestamp: now,
      error: logEntry
    });

    // Limpiar errores antiguos
    this.metrics.silentErrors = this.metrics.silentErrors.filter(
      e => e.timestamp > oneMinuteAgo
    );
  }

  /**
     * Detectar errores silenciosos
     */
  detectSilentErrors() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
        
    // Contar errores en el último minuto
    const recentErrors = this.metrics.silentErrors.filter(
      e => e.timestamp > oneMinuteAgo
    );

    if (recentErrors.length >= this.config.silentErrorThreshold) {
      this.log('error', 'Múltiples errores silenciosos detectados', {
        module: 'ErrorDetection',
        errorCount: recentErrors.length,
        threshold: this.config.silentErrorThreshold,
        timeWindow: '1 minuto'
      });

      this.emit('silent-errors', {
        count: recentErrors.length,
        errors: recentErrors,
        threshold: this.config.silentErrorThreshold
      });
    }
  }

  /**
     * Obtener estadísticas de rendimiento
     */
  getPerformanceStats(operationName = null) {
    if (operationName) {
      const data = this.performanceData.get(operationName) || [];
      if (data.length === 0) return null;

      const durations = data.map(d => d.duration);
      return {
        name: operationName,
        count: data.length,
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        recent: data.slice(-10)
      };
    }

    const stats = {};
    for (const [name, data] of this.performanceData) {
      stats[name] = this.getPerformanceStats(name);
    }
    return stats;
  }

  /**
     * Obtener métricas del sistema
     */
  getSystemMetrics() {
    return {
      session: {
        startTime: this.metrics.sessionStart,
        uptime: Date.now() - this.metrics.sessionStart,
        totalLogs: this.metrics.totalLogs,
        errorCount: this.metrics.errorCount,
        warnCount: this.metrics.warnCount,
        performanceIssues: this.metrics.performanceIssues
      },
      memory: this.metrics.memoryUsage.slice(-10),
      cpu: this.metrics.cpuUsage.slice(-10),
      activeTimers: this.metrics.activeTimers.size,
      silentErrors: this.metrics.silentErrors.length
    };
  }

  /**
     * Obtener stack trace
     */
  getCallStack() {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2) : [];
  }

  /**
     * Generar ID único
     */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
     * Métodos de conveniencia para logging
     */
  error(message, metadata = {}) {
    return this.log('error', message, metadata);
  }

  warn(message, metadata = {}) {
    return this.log('warn', message, metadata);
  }

  info(message, metadata = {}) {
    return this.log('info', message, metadata);
  }

  debug(message, metadata = {}) {
    return this.log('debug', message, metadata);
  }

  trace(message, metadata = {}) {
    return this.log('trace', message, metadata);
  }

  /**
     * Cerrar logger
     */
  async shutdown() {
    this.log('info', 'Cerrando UniversalLogger...', { module: 'UniversalLogger' });
        
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    if (this.errorDetectionTimer) {
      clearInterval(this.errorDetectionTimer);
    }

    // Finalizar timers activos
    for (const [timerId, timer] of this.metrics.activeTimers) {
      this.stopTimer(timerId, { reason: 'shutdown' });
    }

    this.isInitialized = false;
    this.emit('shutdown');
  }
}

// Crear instancia global
const universalLogger = new UniversalLogger();

export default universalLogger;
export { UniversalLogger };
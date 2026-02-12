/**
 * Sistema de Logging Centralizado
 * Reemplaza logger.info con un sistema más robusto y configurable
 */

import { promises as fs } from 'fs';
import path from 'path';

class Logger {
  constructor(options = {}) {
    this.config = {
      level: options.level || 'info',
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile || false,
      enableRemote: options.enableRemote || false,
      maxLogSize: options.maxLogSize || 1000,
      component: options.component || 'System',
      ...options
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    this.logs = [];
    this.listeners = [];
        
    // Configurar colores para consola
    this.colors = {
      error: '\x1b[31m',   // Rojo
      warn: '\x1b[33m',    // Amarillo
      info: '\x1b[36m',    // Cian
      debug: '\x1b[35m',   // Magenta
      trace: '\x1b[37m',   // Blanco
      reset: '\x1b[0m'
    };

    // Configurar iconos
    this.icons = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍',
      trace: '📝'
    };

    this.initializeLogger();
  }

  initializeLogger() {
    // Interceptar errores globales si estamos en el navegador
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.error('Global Error:', event.error);
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.error('Unhandled Promise Rejection:', event.reason);
      });
    }

    // Configurar rotación de logs
    setInterval(() => {
      this.rotateLogs();
    }, 60000); // Cada minuto
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.config.level];
  }

  formatMessage(level, component, message, data = null) {
    const timestamp = new Date().toISOString();
    const formattedMessage = {
      timestamp,
      level: level.toUpperCase(),
      component: component || this.config.component,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      data: data ? (typeof data === 'object' ? JSON.stringify(data) : data) : null,
      id: this.generateLogId()
    };

    return formattedMessage;
  }

  generateLogId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  log(level, component, message, data = null) {
    if (!this.shouldLog(level)) return;

    const formattedLog = this.formatMessage(level, component, message, data);
        
    // Almacenar en memoria
    this.logs.push(formattedLog);
        
    // Notificar a listeners
    this.notifyListeners(formattedLog);

    // Log a consola si está habilitado
    if (this.config.enableConsole) {
      this.logToConsole(formattedLog);
    }

    // Log a archivo si está habilitado
    if (this.config.enableFile) {
      this.logToFile(formattedLog);
    }

    // Log remoto si está habilitado
    if (this.config.enableRemote) {
      this.logToRemote(formattedLog);
    }

    return formattedLog.id;
  }

  logToConsole(logEntry) {
    const { level, component, message, data, timestamp } = logEntry;
    const color = this.colors[level.toLowerCase()] || this.colors.info;
    const icon = this.icons[level.toLowerCase()] || this.icons.info;
        
    const timeStr = new Date(timestamp).toLocaleTimeString();
    const componentStr = component ? `[${component}]` : '';
        
    if (typeof console !== 'undefined') {
      const consoleMethod = console[level.toLowerCase()] || logger.info;
            
      if (data) {
        consoleMethod(
          `${color}${icon} ${timeStr} ${componentStr} ${message}${this.colors.reset}`,
          data
        );
      } else {
        consoleMethod(
          `${color}${icon} ${timeStr} ${componentStr} ${message}${this.colors.reset}`
        );
      }
    }
  }

  async logToFile(logEntry) {
    // Implementación para Node.js
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
                
        const logDir = path.join(process.cwd(), 'logs');
        const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
                
        // Crear directorio si no existe
        await fs.mkdir(logDir, { recursive: true });
                
        // Escribir log
        const logLine = `${logEntry.timestamp} [${logEntry.level}] [${logEntry.component}] ${logEntry.message}${logEntry.data ? ` | Data: ${logEntry.data}` : ''}\n`;
        await fs.appendFile(logFile, logLine);
      } catch (error) {
        logger.error('Error writing to log file:', error);
      }
    }
  }

  async logToRemote(logEntry) {
    // Enviar logs a servidor remoto
    try {
      if (typeof fetch !== 'undefined') {
        await fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(logEntry)
        });
      }
    } catch (error) {
      // Fallar silenciosamente para evitar loops
    }
  }

  rotateLogs() {
    if (this.logs.length > this.config.maxLogSize) {
      const excess = this.logs.length - this.config.maxLogSize;
      this.logs.splice(0, excess);
    }
  }

  // Métodos de conveniencia
  error(message, data = null, component = null) {
    return this.log('error', component, message, data);
  }

  warn(message, data = null, component = null) {
    return this.log('warn', component, message, data);
  }

  info(message, data = null, component = null) {
    return this.log('info', component, message, data);
  }

  debug(message, data = null, component = null) {
    return this.log('debug', component, message, data);
  }

  trace(message, data = null, component = null) {
    return this.log('trace', component, message, data);
  }

  // Métodos de gestión
  getLogs(filter = {}) {
    let filteredLogs = [...this.logs];

    if (filter.level) {
      filteredLogs = filteredLogs.filter(log => 
        log.level.toLowerCase() === filter.level.toLowerCase()
      );
    }

    if (filter.component) {
      filteredLogs = filteredLogs.filter(log => 
        log.component.includes(filter.component)
      );
    }

    if (filter.since) {
      const since = new Date(filter.since);
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= since
      );
    }

    if (filter.limit) {
      filteredLogs = filteredLogs.slice(-filter.limit);
    }

    return filteredLogs;
  }

  clearLogs() {
    this.logs = [];
    this.info('Logs cleared', null, 'Logger');
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  notifyListeners(logEntry) {
    this.listeners.forEach(callback => {
      try {
        callback(logEntry);
      } catch (error) {
        // Evitar loops de error
      }
    });
  }

  // Métodos de configuración
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.config.level = level;
      this.info(`Log level changed to: ${level}`, null, 'Logger');
    }
  }

  setComponent(component) {
    this.config.component = component;
  }

  // Método para crear logger específico de componente
  createComponentLogger(component, options = {}) {
    return new Logger({
      ...this.config,
      ...options,
      component
    });
  }

  // Estadísticas
  getStatistics() {
    const stats = {
      totalLogs: this.logs.length,
      byLevel: {},
      byComponent: {},
      memoryUsage: this.logs.length * 200, // Estimación aproximada
      oldestLog: this.logs.length > 0 ? this.logs[0].timestamp : null,
      newestLog: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null
    };

    // Contar por nivel
    this.logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byComponent[log.component] = (stats.byComponent[log.component] || 0) + 1;
    });

    return stats;
  }

  // Exportar logs
  exportLogs(format = 'json') {
    switch (format) {
    case 'json':
      return JSON.stringify(this.logs, null, 2);
    case 'csv':
      const headers = 'timestamp,level,component,message,data\n';
      const rows = this.logs.map(log => 
        `"${log.timestamp}","${log.level}","${log.component}","${log.message}","${log.data || ''}"`
      ).join('\n');
      return headers + rows;
    case 'text':
      return this.logs.map(log => 
        `${log.timestamp} [${log.level}] [${log.component}] ${log.message}${log.data ? ` | ${log.data}` : ''}`
      ).join('\n');
    default:
      return this.logs;
    }
  }
}

// Crear instancia global
const globalLogger = new Logger({
  level: 'info',
  component: 'Global',
  enableConsole: true,
  enableFile: true,
  enableRemote: false
});

// Exportaciones ES modules
export { Logger, globalLogger };
export default globalLogger;

// Exportar para uso en navegador
if (typeof window !== 'undefined') {
  window.Logger = Logger;
  window.logger = globalLogger;
    
  // Reemplazar logger.info global (opcional)
  if (window.AppConfig && window.AppConfig.replaceConsole) {
    const originalConsole = { ...console };
        
    logger.info = (...args) => globalLogger.info(args.join(' '));
    console.error = (...args) => globalLogger.error(args.join(' '));
    console.warn = (...args) => globalLogger.warn(args.join(' '));
    console.info = (...args) => globalLogger.info(args.join(' '));
    console.debug = (...args) => globalLogger.debug(args.join(' '));
        
    // Mantener referencia al console original
    window.originalConsole = originalConsole;
  }
}
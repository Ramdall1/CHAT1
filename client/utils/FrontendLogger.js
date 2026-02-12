/**
 * Frontend Logger - Sistema de logging optimizado para navegadores
 * Versión ligera del sistema de logging para uso en el frontend
 */

class FrontendLogger {
  constructor(options = {}) {
    this.config = {
      level: options.level || 'info',
      enableConsole: options.enableConsole !== false,
      enableRemote: options.enableRemote || false,
      enableStorage: options.enableStorage || false,
      maxLogs: options.maxLogs || 500,
      component: options.component || 'Frontend',
      remoteEndpoint: options.remoteEndpoint || '/api/logs',
      ...options,
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4,
    };

    this.logs = [];
    this.listeners = new Set();

    // Configurar estilos para consola del navegador
    this.styles = {
      error: 'color: #ff4757; font-weight: bold;',
      warn: 'color: #ffa502; font-weight: bold;',
      info: 'color: #3742fa; font-weight: bold;',
      debug: 'color: #7bed9f; font-weight: bold;',
      trace: 'color: #a4b0be; font-weight: normal;',
    };

    this.icons = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍',
      trace: '📝',
    };

    this.initializeLogger();
  }

  initializeLogger() {
    // Interceptar errores globales
    window.addEventListener('error', event => {
      this.error('Global Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', event => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason,
        stack: event.reason?.stack,
      });
    });

    // Cargar logs desde localStorage si está habilitado
    if (this.config.enableStorage) {
      this.loadFromStorage();
    }

    // Configurar limpieza automática
    setInterval(() => {
      this.cleanup();
    }, 30000); // Cada 30 segundos
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.config.level];
  }

  formatMessage(level, component, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      component: component || this.config.component,
      message: this.formatMessageContent(message),
      data: data ? this.formatData(data) : null,
      id: this.generateLogId(),
      url: window.location.href,
      userAgent: navigator.userAgent.substring(0, 100),
    };

    return logEntry;
  }

  formatMessageContent(message) {
    if (typeof message === 'string') return message;
    if (typeof message === 'object') {
      try {
        return JSON.stringify(message, null, 2);
      } catch (e) {
        return String(message);
      }
    }
    return String(message);
  }

  formatData(data) {
    if (data === null || data === undefined) return null;

    try {
      // Limitar el tamaño de los datos para evitar problemas de memoria
      const stringified = JSON.stringify(data);
      if (stringified.length > 1000) {
        return stringified.substring(0, 1000) + '... [truncated]';
      }
      return data;
    } catch (e) {
      return String(data);
    }
  }

  generateLogId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  log(level, component, message, data = null) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.formatMessage(level, component, message, data);

    // Almacenar en memoria
    this.logs.push(logEntry);

    // Notificar a listeners
    this.notifyListeners(logEntry);

    // Log a consola si está habilitado
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Guardar en localStorage si está habilitado
    if (this.config.enableStorage) {
      this.saveToStorage();
    }

    // Enviar a servidor si está habilitado
    if (this.config.enableRemote) {
      this.logToRemote(logEntry);
    }

    return logEntry.id;
  }

  logToConsole(logEntry) {
    const { level, component, message, data, timestamp } = logEntry;
    const style = this.styles[level.toLowerCase()] || this.styles.info;
    const icon = this.icons[level.toLowerCase()] || this.icons.info;

    const timeStr = new Date(timestamp).toLocaleTimeString();
    const componentStr = component ? `[${component}]` : '';

    const consoleMethod = console[level.toLowerCase()] || console.log;

    if (data) {
      consoleMethod(
        `%c${icon} ${timeStr} ${componentStr} ${message}`,
        style,
        data
      );
    } else {
      consoleMethod(`%c${icon} ${timeStr} ${componentStr} ${message}`, style);
    }
  }

  async logToRemote(logEntry) {
    try {
      // Enviar de forma asíncrona sin bloquear
      setTimeout(async () => {
        try {
          await fetch(this.config.remoteEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(logEntry),
          });
        } catch (error) {
          // Fallar silenciosamente para evitar loops
        }
      }, 0);
    } catch (error) {
      // Fallar silenciosamente
    }
  }

  saveToStorage() {
    try {
      const logsToSave = this.logs.slice(-100); // Solo guardar los últimos 100
      localStorage.setItem('frontendLogs', JSON.stringify(logsToSave));
    } catch (error) {
      // Storage lleno o no disponible
    }
  }

  loadFromStorage() {
    try {
      const savedLogs = localStorage.getItem('frontendLogs');
      if (savedLogs) {
        this.logs = JSON.parse(savedLogs);
      }
    } catch (error) {
      // Error cargando logs, continuar sin ellos
    }
  }

  cleanup() {
    // Limpiar logs antiguos
    if (this.logs.length > this.config.maxLogs) {
      const excess = this.logs.length - this.config.maxLogs;
      this.logs.splice(0, excess);
    }

    // Actualizar storage
    if (this.config.enableStorage) {
      this.saveToStorage();
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
      filteredLogs = filteredLogs.filter(
        log => log.level.toLowerCase() === filter.level.toLowerCase()
      );
    }

    if (filter.component) {
      filteredLogs = filteredLogs.filter(log =>
        log.component.toLowerCase().includes(filter.component.toLowerCase())
      );
    }

    if (filter.since) {
      const since = new Date(filter.since);
      filteredLogs = filteredLogs.filter(
        log => new Date(log.timestamp) >= since
      );
    }

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filteredLogs = filteredLogs.filter(
        log =>
          log.message.toLowerCase().includes(searchTerm) ||
          (log.data &&
            JSON.stringify(log.data).toLowerCase().includes(searchTerm))
      );
    }

    if (filter.limit) {
      filteredLogs = filteredLogs.slice(-filter.limit);
    }

    return filteredLogs;
  }

  clearLogs() {
    this.logs = [];
    if (this.config.enableStorage) {
      localStorage.removeItem('frontendLogs');
    }
    this.info('Logs cleared', null, 'FrontendLogger');
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
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

  // Configuración
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.config.level = level;
      this.info(`Log level changed to: ${level}`, null, 'FrontendLogger');
    }
  }

  setComponent(component) {
    this.config.component = component;
  }

  // Crear logger específico de componente
  createComponentLogger(component, options = {}) {
    return new FrontendLogger({
      ...this.config,
      ...options,
      component,
    });
  }

  // Estadísticas
  getStatistics() {
    const stats = {
      totalLogs: this.logs.length,
      byLevel: {},
      byComponent: {},
      memoryUsage: JSON.stringify(this.logs).length,
      oldestLog: this.logs.length > 0 ? this.logs[0].timestamp : null,
      newestLog:
        this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null,
      sessionStart: performance.timing?.navigationStart
        ? new Date(performance.timing.navigationStart).toISOString()
        : null,
    };

    this.logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byComponent[log.component] =
        (stats.byComponent[log.component] || 0) + 1;
    });

    return stats;
  }

  // Exportar logs para debugging
  exportLogs(format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.logs, null, 2);
      case 'csv':
        const headers = 'timestamp,level,component,message,url\n';
        const rows = this.logs
          .map(
            log =>
              `"${log.timestamp}","${log.level}","${log.component}","${log.message.replace(/"/g, '""')}","${log.url}"`
          )
          .join('\n');
        return headers + rows;
      case 'text':
        return this.logs
          .map(
            log =>
              `${log.timestamp} [${log.level}] [${log.component}] ${log.message}`
          )
          .join('\n');
      default:
        return this.logs;
    }
  }

  // Descargar logs
  downloadLogs(filename = 'frontend-logs.json', format = 'json') {
    const data = this.exportLogs(format);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.info('Logs downloaded', { filename, format }, 'FrontendLogger');
  }

  // Método para performance monitoring
  time(label) {
    const startTime = performance.now();
    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.debug(`Timer [${label}]`, {
          duration: `${duration.toFixed(2)}ms`,
        });
        return duration;
      },
    };
  }

  // Método para tracking de eventos de usuario
  trackEvent(event, data = {}) {
    this.info(
      `Event: ${event}`,
      {
        ...data,
        timestamp: Date.now(),
        page: window.location.pathname,
      },
      'EventTracker'
    );
  }
}

// Crear instancia global para el frontend
const frontendLogger = new FrontendLogger({
  level: 'info',
  component: 'Frontend',
  enableConsole: true,
  enableStorage: true,
  enableRemote: false,
});

// Exportar para uso global
window.FrontendLogger = FrontendLogger;
window.logger = frontendLogger;

// Función de conveniencia para migración gradual
window.createLogger = (component, options = {}) => {
  return frontendLogger.createComponentLogger(component, options);
};

// Funciones de conveniencia globales
window.logError = (message, data, component) =>
  frontendLogger.error(message, data, component);
window.logWarn = (message, data, component) =>
  frontendLogger.warn(message, data, component);
window.logInfo = (message, data, component) =>
  frontendLogger.info(message, data, component);
window.logDebug = (message, data, component) =>
  frontendLogger.debug(message, data, component);

// Configuración para reemplazar console (opcional)
if (window.AppConfig && window.AppConfig.replaceConsole) {
  const originalConsole = { ...console };

  console.log = (...args) => frontendLogger.info(args.join(' '));
  console.error = (...args) => frontendLogger.error(args.join(' '));
  console.warn = (...args) => frontendLogger.warn(args.join(' '));
  console.info = (...args) => frontendLogger.info(args.join(' '));
  console.debug = (...args) => frontendLogger.debug(args.join(' '));

  window.originalConsole = originalConsole;
  frontendLogger.info(
    'Console methods replaced with FrontendLogger',
    null,
    'FrontendLogger'
  );
}

import { createLogger as createWinstonLogger } from './logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Logger evolutivo que extiende el sistema Winston existente
 * con capacidades específicas para el sistema de eventos
 */
class EvolutiveLogger {
  constructor(component, options = {}) {
    this.component = component;
    this.winstonLogger = createWinstonLogger(component);
    this.enableEventTracking = options.enableEventTracking !== false;
    this.eventLogDir = options.eventLogDir || path.join(process.cwd(), 'storage', 'event-logs');
        
    // Emojis para mejor visualización en consola
    this.emojis = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍',
      trace: '📝'
    };
        
    this.ensureEventLogDirectory();
  }

  /**
     * Asegurar que el directorio de logs de eventos existe
     */
  async ensureEventLogDirectory() {
    if (this.enableEventTracking) {
      try {
        await fs.mkdir(this.eventLogDir, { recursive: true });
      } catch (error) {
        this.winstonLogger.error('Error creando directorio de logs de eventos:', error);
      }
    }
  }

  /**
     * Log con emoji y tracking de eventos
     */
  info(message, data = null) {
    const emoji = this.emojis.info;
    const enhancedMessage = `${emoji} ${message}`;
        
    if (data) {
      this.winstonLogger.info(enhancedMessage, data);
    } else {
      this.winstonLogger.info(enhancedMessage);
    }
        
    this.trackEvent('info', message, data);
  }

  /**
     * Log de error con emoji
     */
  error(message, error = null, data = null) {
    const emoji = this.emojis.error;
    const enhancedMessage = `${emoji} ${message}`;
        
    if (error) {
      this.winstonLogger.error(enhancedMessage, error, data || {});
    } else {
      this.winstonLogger.error(enhancedMessage, data || {});
    }
        
    this.trackEvent('error', message, { error, data });
  }

  /**
     * Log de warning con emoji
     */
  warn(message, data = null) {
    const emoji = this.emojis.warn;
    const enhancedMessage = `${emoji} ${message}`;
        
    if (data) {
      this.winstonLogger.warn(enhancedMessage, data);
    } else {
      this.winstonLogger.warn(enhancedMessage);
    }
        
    this.trackEvent('warn', message, data);
  }

  /**
     * Log de debug con emoji
     */
  debug(message, data = null) {
    const emoji = this.emojis.debug;
    const enhancedMessage = `${emoji} ${message}`;
        
    if (data) {
      this.winstonLogger.debug(enhancedMessage, data);
    } else {
      this.winstonLogger.debug(enhancedMessage);
    }
        
    this.trackEvent('debug', message, data);
  }

  /**
     * Tracking específico de eventos para análisis posterior
     */
  async trackEvent(level, message, data) {
    if (!this.enableEventTracking) return;
        
    try {
      const eventLog = {
        timestamp: new Date().toISOString(),
        component: this.component,
        level,
        message,
        data: data || null
      };
            
      const logFile = path.join(this.eventLogDir, `${this.component.toLowerCase()}-events.json`);
            
      // Leer logs existentes
      let existingLogs = [];
      try {
        const data = await fs.readFile(logFile, 'utf8');
        existingLogs = JSON.parse(data);
      } catch (error) {
        // Archivo no existe
      }
            
      // Agregar nuevo log
      existingLogs.push(eventLog);
            
      // Mantener solo los últimos 500 eventos por componente
      if (existingLogs.length > 500) {
        existingLogs = existingLogs.slice(-500);
      }
            
      // Escribir de vuelta
      await fs.writeFile(logFile, JSON.stringify(existingLogs, null, 2));
    } catch (error) {
      this.winstonLogger.error('Error tracking event:', error);
    }
  }

  /**
     * Obtener estadísticas de eventos del componente
     */
  async getEventStats() {
    if (!this.enableEventTracking) return null;
        
    try {
      const logFile = path.join(this.eventLogDir, `${this.component.toLowerCase()}-events.json`);
      const data = await fs.readFile(logFile, 'utf8');
      const events = JSON.parse(data);
            
      const stats = {
        totalEvents: events.length,
        byLevel: {},
        recentActivity: events.slice(-10),
        timeRange: {
          first: events[0]?.timestamp,
          last: events[events.length - 1]?.timestamp
        }
      };
            
      // Contar por nivel
      events.forEach(event => {
        stats.byLevel[event.level] = (stats.byLevel[event.level] || 0) + 1;
      });
            
      return stats;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Factory function para crear loggers evolutivos
 */
export function createLogger(component, options = {}) {
  return new EvolutiveLogger(component, options);
}

export default EvolutiveLogger;
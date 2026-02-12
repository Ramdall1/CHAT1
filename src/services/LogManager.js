/**
 * Gestor de Logs Organizado por Carpetas
 * Organiza logs por tipo: errors, info, debug, warnings
 */

import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './core/core/logger.js';

const baseLogger = createLogger('LOG_MANAGER');

class LogManager {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'data', 'logs');
    this.logTypes = {
      errors: 'errors',
      info: 'info',
      debug: 'debug',
      warnings: 'warnings',
      api: 'api',
      database: 'database',
      security: 'security',
      performance: 'performance'
    };
    
    this.initialized = false;
  }

  /**
   * Inicializar directorios de logs
   */
  async initialize() {
    try {
      // Crear directorio base
      await fs.mkdir(this.logsDir, { recursive: true });

      // Crear subdirectorios por tipo
      for (const type of Object.values(this.logTypes)) {
        const typeDir = path.join(this.logsDir, type);
        await fs.mkdir(typeDir, { recursive: true });
      }

      this.initialized = true;
      baseLogger.info('✅ LogManager inicializado correctamente');
    } catch (error) {
      baseLogger.error('❌ Error inicializando LogManager:', error);
    }
  }

  /**
   * Guardar log en archivo
   */
  async log(type, message, data = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const timestamp = new Date().toISOString();
      const date = new Date().toISOString().split('T')[0];
      
      // Validar tipo
      if (!this.logTypes[type]) {
        type = 'info';
      }

      const typeDir = path.join(this.logsDir, this.logTypes[type]);
      const fileName = `${date}.log`;
      const filePath = path.join(typeDir, fileName);

      // Crear contenido del log
      const logEntry = {
        timestamp,
        type,
        message,
        data: data || null
      };

      const logLine = JSON.stringify(logEntry) + '\n';

      // Agregar al archivo
      await fs.appendFile(filePath, logLine, 'utf-8');

      // También mostrar en consola según el tipo
      this.logToConsole(type, message, data);
    } catch (error) {
      baseLogger.error('❌ Error guardando log:', error);
    }
  }

  /**
   * Mostrar log en consola
   */
  logToConsole(type, message, data) {
    const timestamp = new Date().toLocaleTimeString();
    
    switch (type) {
      case 'errors':
        logger.error(`❌ [${timestamp}] ${message}`, data || '');
        break;
      case 'warnings':
        logger.warn(`⚠️  [${timestamp}] ${message}`, data || '');
        break;
      case 'info':
        logger.debug(`ℹ️  [${timestamp}] ${message}`, data || '');
        break;
      case 'debug':
        if (process.env.DEBUG_MODE === 'true') {
          logger.debug(`🔍 [${timestamp}] ${message}`, data || '');
        }
        break;
      case 'api':
        logger.debug(`📡 [${timestamp}] ${message}`, data || '');
        break;
      case 'database':
        logger.debug(`💾 [${timestamp}] ${message}`, data || '');
        break;
      case 'security':
        logger.warn(`🔐 [${timestamp}] ${message}`, data || '');
        break;
      case 'performance':
        logger.debug(`⚡ [${timestamp}] ${message}`, data || '');
        break;
    }
  }

  /**
   * Obtener logs de un tipo
   */
  async getLogs(type, date = null) {
    try {
      if (!this.logTypes[type]) {
        return { error: 'Tipo de log inválido' };
      }

      const typeDir = path.join(this.logsDir, this.logTypes[type]);
      
      if (!date) {
        date = new Date().toISOString().split('T')[0];
      }

      const filePath = path.join(typeDir, `${date}.log`);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const logs = content
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return { raw: line };
            }
          });

        return { success: true, logs, count: logs.length };
      } catch (error) {
        return { success: false, error: 'Archivo de log no encontrado' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Limpiar logs antiguos
   */
  async cleanOldLogs(daysToKeep = 30) {
    try {
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      for (const type of Object.values(this.logTypes)) {
        const typeDir = path.join(this.logsDir, type);
        const files = await fs.readdir(typeDir);

        for (const file of files) {
          const filePath = path.join(typeDir, file);
          const stats = await fs.stat(filePath);

          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            baseLogger.info(`🗑️  Log antiguo eliminado: ${file}`);
          }
        }
      }
    } catch (error) {
      baseLogger.error('❌ Error limpiando logs antiguos:', error);
    }
  }

  /**
   * Obtener estadísticas de logs
   */
  async getStats() {
    try {
      const stats = {};

      for (const [key, type] of Object.entries(this.logTypes)) {
        const typeDir = path.join(this.logsDir, type);
        const files = await fs.readdir(typeDir);
        stats[key] = files.length;
      }

      return { success: true, stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Crear instancia global
const logManager = new LogManager();
await logManager.initialize();

export default logManager;

/**
 * @fileoverview Core Logger Service
 * Sistema de logging centralizado para el chatbot empresarial
 * 
 * @author ChatBot Enterprise Team
 * @version 6.0.0
 * @since 1.0.0
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs/promises';

/**
 * Configuración del logger
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'grey',
  debug: 'white',
  silly: 'rainbow'
};

/**
 * Clase Logger centralizada
 */
class Logger {
  constructor(options = {}) {
    this.options = {
      level: process.env.LOG_LEVEL || 'info',
      logDir: process.env.LOG_DIR || 'logs',
      maxFiles: 5,
      maxSize: '20m',
      enableConsole: process.env.NODE_ENV !== 'production',
      enableFile: true,
      enableRotation: true,
      ...options
    };

    this.logger = null;
    this.initialized = false;
    this.init();
  }

  /**
   * Inicializa el logger
   */
  async init() {
    try {
      // Crear directorio de logs si no existe
      await this.ensureLogDirectory();

      // Configurar formatos
      const formats = this.createFormats();

      // Configurar transportes
      const transports = this.createTransports(formats);

      // Crear logger de Winston
      this.logger = winston.createLogger({
        level: this.options.level,
        levels: LOG_LEVELS,
        format: formats.combined,
        transports,
        exitOnError: false
      });

      // Configurar colores
      winston.addColors(LOG_COLORS);

      this.initialized = true;
      this.info('Logger initialized successfully', {
        level: this.options.level,
        logDir: this.options.logDir
      });

    } catch (error) {
      logger.error('Failed to initialize logger:', error);
      throw error;
    }
  }

  /**
   * Asegura que el directorio de logs existe
   */
  async ensureLogDirectory() {
    try {
      await fs.access(this.options.logDir);
    } catch {
      await fs.mkdir(this.options.logDir, { recursive: true });
    }
  }

  /**
   * Crea los formatos de logging
   */
  createFormats() {
    const timestamp = winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    });

    const errors = winston.format.errors({ stack: true });

    const json = winston.format.json();

    const printf = winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
    });

    const colorize = winston.format.colorize({ all: true });

    return {
      combined: winston.format.combine(
        timestamp,
        errors,
        json
      ),
      console: winston.format.combine(
        timestamp,
        colorize,
        printf
      ),
      file: winston.format.combine(
        timestamp,
        errors,
        json
      )
    };
  }

  /**
   * Crea los transportes de logging
   */
  createTransports(formats) {
    const transports = [];

    // Transporte de consola
    if (this.options.enableConsole) {
      transports.push(new winston.transports.Console({
        format: formats.console,
        handleExceptions: true,
        handleRejections: true
      }));
    }

    // Transportes de archivo
    if (this.options.enableFile) {
      // Archivo de errores
      transports.push(new winston.transports.File({
        filename: path.join(this.options.logDir, 'error.log'),
        level: 'error',
        format: formats.file,
        maxsize: this.options.maxSize,
        maxFiles: this.options.maxFiles,
        tailable: this.options.enableRotation
      }));

      // Archivo combinado
      transports.push(new winston.transports.File({
        filename: path.join(this.options.logDir, 'combined.log'),
        format: formats.file,
        maxsize: this.options.maxSize,
        maxFiles: this.options.maxFiles,
        tailable: this.options.enableRotation
      }));

      // Archivo de aplicación
      transports.push(new winston.transports.File({
        filename: path.join(this.options.logDir, 'app.log'),
        level: 'info',
        format: formats.file,
        maxsize: this.options.maxSize,
        maxFiles: this.options.maxFiles,
        tailable: this.options.enableRotation
      }));
    }

    return transports;
  }

  /**
   * Métodos de logging
   */
  error(message, meta = {}) {
    if (this.logger) {
      this.logger.error(message, this.formatMeta(meta));
    } else {
      logger.error(`[ERROR] ${message}`, meta);
    }
  }

  warn(message, meta = {}) {
    if (this.logger) {
      this.logger.warn(message, this.formatMeta(meta));
    } else {
      logger.warn(`[WARN] ${message}`, meta);
    }
  }

  info(message, meta = {}) {
    if (this.logger) {
      this.logger.info(message, this.formatMeta(meta));
    } else {
      console.info(`[INFO] ${message}`, meta);
    }
  }

  http(message, meta = {}) {
    if (this.logger) {
      this.logger.http(message, this.formatMeta(meta));
    } else {
      logger.info(`[HTTP] ${message}`, meta);
    }
  }

  verbose(message, meta = {}) {
    if (this.logger) {
      this.logger.verbose(message, this.formatMeta(meta));
    } else {
      logger.info(`[VERBOSE] ${message}`, meta);
    }
  }

  debug(message, meta = {}) {
    if (this.logger) {
      this.logger.debug(message, this.formatMeta(meta));
    } else {
      logger.info(`[DEBUG] ${message}`, meta);
    }
  }

  silly(message, meta = {}) {
    if (this.logger) {
      this.logger.silly(message, this.formatMeta(meta));
    } else {
      logger.info(`[SILLY] ${message}`, meta);
    }
  }

  /**
   * Formatea los metadatos
   */
  formatMeta(meta) {
    if (meta instanceof Error) {
      return {
        error: meta.message,
        stack: meta.stack,
        name: meta.name
      };
    }
    return meta;
  }

  /**
   * Crea un logger hijo con contexto específico
   */
  child(context = {}) {
    return {
      error: (message, meta = {}) => this.error(message, { ...context, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
      info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
      http: (message, meta = {}) => this.http(message, { ...context, ...meta }),
      verbose: (message, meta = {}) => this.verbose(message, { ...context, ...meta }),
      debug: (message, meta = {}) => this.debug(message, { ...context, ...meta }),
      silly: (message, meta = {}) => this.silly(message, { ...context, ...meta })
    };
  }

  /**
   * Obtiene estadísticas del logger
   */
  getStats() {
    return {
      level: this.options.level,
      initialized: this.initialized,
      logDir: this.options.logDir,
      enableConsole: this.options.enableConsole,
      enableFile: this.options.enableFile
    };
  }

  /**
   * Cambia el nivel de logging dinámicamente
   */
  setLevel(level) {
    if (this.logger && LOG_LEVELS.hasOwnProperty(level)) {
      this.logger.level = level;
      this.options.level = level;
      this.info(`Log level changed to: ${level}`);
    }
  }

  /**
   * Limpia logs antiguos
   */
  async cleanupOldLogs(daysToKeep = 30) {
    try {
      const files = await fs.readdir(this.options.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        const filePath = path.join(this.options.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          this.info(`Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      this.error('Failed to cleanup old logs', error);
    }
  }

  /**
   * Cierra el logger
   */
  async close() {
    if (this.logger) {
      this.logger.end();
      this.initialized = false;
    }
  }
}

// Instancia singleton
const logger = new Logger();

// Exportar tanto la clase como la instancia
export { Logger, logger };
export default logger;
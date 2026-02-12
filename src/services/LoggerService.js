/**
 * Servicio de Logger Mejorado
 * Diseño profesional de logs en terminal y consola
 * Sin logs innecesarios
 */

import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

class LoggerService {
  constructor(moduleName = 'APP') {
    this.moduleName = moduleName;
    this.logsDir = path.join(process.cwd(), 'data', 'logs');
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    
    // Niveles de log
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
  }

  /**
   * Obtener nivel de log actual
   */
  getCurrentLogLevel() {
    return this.levels[this.logLevel] || this.levels.info;
  }

  /**
   * Formatear timestamp
   */
  getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('es-CO', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Formatear módulo
   */
  formatModule() {
    return chalk.cyan(`[${this.moduleName}]`);
  }

  /**
   * Formatear timestamp
   */
  formatTime() {
    return chalk.gray(this.getTimestamp());
  }

  /**
   * Error - Nivel 0
   */
  error(message, data = null) {
    if (this.levels.error > this.getCurrentLogLevel()) return;

    const output = `${this.formatTime()} ${this.formatModule()} ${chalk.red('❌ ERROR')} ${message}`;
    logger.error(output);
    
    if (data) {
      logger.error(chalk.red(JSON.stringify(data, null, 2)));
    }

    this.writeToFile('error', message, data);
  }

  /**
   * Warn - Nivel 1
   */
  warn(message, data = null) {
    if (this.levels.warn > this.getCurrentLogLevel()) return;

    const output = `${this.formatTime()} ${this.formatModule()} ${chalk.yellow('⚠️  WARN')} ${message}`;
    logger.warn(output);
    
    if (data) {
      logger.warn(chalk.yellow(JSON.stringify(data, null, 2)));
    }

    this.writeToFile('warning', message, data);
  }

  /**
   * Info - Nivel 2
   */
  info(message, data = null) {
    if (this.levels.info > this.getCurrentLogLevel()) return;

    const output = `${this.formatTime()} ${this.formatModule()} ${chalk.blue('ℹ️  INFO')} ${message}`;
    logger.debug(output);
    
    if (data && this.isDevelopment) {
      logger.debug(chalk.blue(JSON.stringify(data, null, 2)));
    }

    this.writeToFile('info', message, data);
  }

  /**
   * Success - Info con color verde
   */
  success(message, data = null) {
    if (this.levels.info > this.getCurrentLogLevel()) return;

    const output = `${this.formatTime()} ${this.formatModule()} ${chalk.green('✅ SUCCESS')} ${message}`;
    logger.debug(output);
    
    if (data && this.isDevelopment) {
      logger.debug(chalk.green(JSON.stringify(data, null, 2)));
    }

    this.writeToFile('info', message, data);
  }

  /**
   * Debug - Nivel 3 (Solo en desarrollo)
   */
  debug(message, data = null) {
    if (!this.isDevelopment || this.levels.debug > this.getCurrentLogLevel()) return;

    const output = `${this.formatTime()} ${this.formatModule()} ${chalk.magenta('🔍 DEBUG')} ${message}`;
    logger.debug(output);
    
    if (data) {
      logger.debug(chalk.magenta(JSON.stringify(data, null, 2)));
    }

    this.writeToFile('debug', message, data);
  }

  /**
   * Trace - Nivel 4 (Solo en desarrollo)
   */
  trace(message, data = null) {
    if (!this.isDevelopment || this.levels.trace > this.getCurrentLogLevel()) return;

    const output = `${this.formatTime()} ${this.formatModule()} ${chalk.gray('📍 TRACE')} ${message}`;
    logger.debug(output);
    
    if (data) {
      logger.debug(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  /**
   * API Request - Para logs de API
   */
  api(method, path, status, duration = null) {
    const statusColor = status >= 400 ? chalk.red : status >= 300 ? chalk.yellow : chalk.green;
    const methodColor = {
      'GET': chalk.blue,
      'POST': chalk.green,
      'PUT': chalk.yellow,
      'DELETE': chalk.red,
      'PATCH': chalk.magenta
    }[method] || chalk.white;

    const durationStr = duration ? ` ${chalk.gray(`${duration}ms`)}` : '';
    const output = `${this.formatTime()} ${this.formatModule()} ${methodColor(method)} ${path} ${statusColor(status)}${durationStr}`;
    
    logger.debug(output);
    this.writeToFile('api', `${method} ${path} ${status}`, { duration });
  }

  /**
   * Database Query - Para logs de BD
   */
  database(query, duration = null) {
    const durationStr = duration ? ` ${chalk.gray(`${duration}ms`)}` : '';
    const output = `${this.formatTime()} ${this.formatModule()} ${chalk.cyan('💾 DB')} ${query}${durationStr}`;
    
    if (this.isDevelopment) {
      logger.debug(output);
    }
    
    this.writeToFile('database', query, { duration });
  }

  /**
   * Security Event - Para eventos de seguridad
   */
  security(message, data = null) {
    const output = `${this.formatTime()} ${this.formatModule()} ${chalk.red.bold('🔐 SECURITY')} ${message}`;
    logger.warn(output);
    
    if (data) {
      logger.warn(chalk.red(JSON.stringify(data, null, 2)));
    }

    this.writeToFile('security', message, data);
  }

  /**
   * Performance - Para métricas de rendimiento
   */
  performance(label, duration) {
    const color = duration > 1000 ? chalk.red : duration > 500 ? chalk.yellow : chalk.green;
    const output = `${this.formatTime()} ${this.formatModule()} ${chalk.cyan('⚡ PERF')} ${label} ${color(`${duration}ms`)}`;
    
    if (this.isDevelopment) {
      logger.debug(output);
    }
    
    this.writeToFile('performance', `${label}: ${duration}ms`, null);
  }

  /**
   * Escribir en archivo
   */
  async writeToFile(type, message, data) {
    try {
      const typeDir = path.join(this.logsDir, type);
      await fs.mkdir(typeDir, { recursive: true });

      const date = new Date().toISOString().split('T')[0];
      const filePath = path.join(typeDir, `${date}.log`);

      const logEntry = {
        timestamp: new Date().toISOString(),
        module: this.moduleName,
        message,
        data: data || null
      };

      await fs.appendFile(filePath, JSON.stringify(logEntry) + '\n', 'utf-8');
    } catch (error) {
      // Silenciar errores de escritura de logs
      if (this.isDevelopment) {
        logger.error('Error escribiendo log:', error.message);
      }
    }
  }

  /**
   * Separador visual
   */
  separator(char = '=', length = 60) {
    logger.debug(chalk.gray(char.repeat(length)));
  }

  /**
   * Título
   */
  title(text) {
    this.separator();
    logger.debug(chalk.bold.cyan(`  ${text}`));
    this.separator();
  }

  /**
   * Tabla de datos
   */
  table(data) {
    console.table(data);
  }
}

export default LoggerService;

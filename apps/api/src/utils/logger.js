import fs from 'fs-extra';
import path from 'path';

class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'INFO';
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;

    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
    };

    this.colors = {
      ERROR: '\x1b[31m', // Rojo
      WARN: '\x1b[33m', // Amarillo
      INFO: '\x1b[36m', // Cian
      DEBUG: '\x1b[37m', // Blanco
      RESET: '\x1b[0m',
    };

    this.emojis = {
      ERROR: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      DEBUG: '🔍',
    };

    this.init();
  }

  async init() {
    await fs.ensureDir(this.logDir);
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const emoji = this.emojis[level];

    const logEntry = {
      timestamp,
      level,
      message,
      ...meta,
    };

    // Formato para consola
    const consoleMessage = `${emoji} [${timestamp}] ${level}: ${message}`;

    return { logEntry, consoleMessage };
  }

  async writeToFile(level, logEntry) {
    try {
      const filename = `${level.toLowerCase()}.log`;
      const filepath = path.join(this.logDir, filename);

      // Verificar tamaño del archivo
      if (await fs.pathExists(filepath)) {
        const stats = await fs.stat(filepath);
        if (stats.size > this.maxFileSize) {
          await this.rotateLogFile(filepath);
        }
      }

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(filepath, logLine);
    } catch (error) {
      console.error('Error escribiendo log:', error);
    }
  }

  async rotateLogFile(filepath) {
    try {
      const dir = path.dirname(filepath);
      const basename = path.basename(filepath, '.log');

      // Rotar archivos existentes
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldFile = path.join(dir, `${basename}.${i}.log`);
        const newFile = path.join(dir, `${basename}.${i + 1}.log`);

        if (await fs.pathExists(oldFile)) {
          if (i === this.maxFiles - 1) {
            await fs.remove(oldFile);
          } else {
            await fs.move(oldFile, newFile);
          }
        }
      }

      // Mover archivo actual
      const rotatedFile = path.join(dir, `${basename}.1.log`);
      await fs.move(filepath, rotatedFile);
    } catch (error) {
      console.error('Error rotando archivo de log:', error);
    }
  }

  async log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const { logEntry, consoleMessage } = this.formatMessage(
      level,
      message,
      meta
    );

    // Log a consola con colores
    const color = this.colors[level];
    console.log(`${color}${consoleMessage}${this.colors.RESET}`);

    // Log a archivo
    await this.writeToFile(level, logEntry);
  }

  error(message, meta = {}) {
    return this.log('ERROR', message, meta);
  }

  warn(message, meta = {}) {
    return this.log('WARN', message, meta);
  }

  info(message, meta = {}) {
    return this.log('INFO', message, meta);
  }

  debug(message, meta = {}) {
    return this.log('DEBUG', message, meta);
  }

  // Métodos específicos para el chatbot
  messageReceived(phone, message, messageType = 'text') {
    return this.info('Mensaje recibido', {
      phone,
      message: message.substring(0, 100), // Truncar mensaje largo
      messageType,
      category: 'MESSAGE_RECEIVED',
    });
  }

  messageSent(phone, message, messageId) {
    return this.info('Mensaje enviado', {
      phone,
      message: message.substring(0, 100),
      messageId,
      category: 'MESSAGE_SENT',
    });
  }

  aiResponse(phone, prompt, response, processingTime) {
    return this.info('Respuesta IA generada', {
      phone,
      prompt: prompt.substring(0, 100),
      response: response.substring(0, 100),
      processingTime,
      category: 'AI_RESPONSE',
    });
  }

  webhookReceived(source, payload) {
    return this.debug('Webhook recibido', {
      source,
      payload: JSON.stringify(payload).substring(0, 200),
      category: 'WEBHOOK',
    });
  }

  templateError(templateName, error) {
    return this.error('Error de plantilla', {
      templateName,
      error: error.message,
      category: 'TEMPLATE_ERROR',
    });
  }

  performanceMetric(operation, duration, success = true) {
    return this.info('Métrica de performance', {
      operation,
      duration,
      success,
      category: 'PERFORMANCE',
    });
  }

  healthCheck(service, status, details = {}) {
    const level = status === 'healthy' ? 'INFO' : 'WARN';
    return this.log(level, `Health check: ${service}`, {
      service,
      status,
      details,
      category: 'HEALTH_CHECK',
    });
  }
}

// Instancia singleton
const logger = new Logger();

export default logger;

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class SecureLogger {
  constructor(config = {}) {
    this.config = {
      logLevel: config.logLevel || 'info',
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles || 5,
      logDirectory: config.logDirectory || './logs',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile !== false,
      enableEncryption: config.enableEncryption || false,
      encryptionKey: config.encryptionKey || null,
      sensitiveFields: config.sensitiveFields || [
        'password', 'token', 'secret', 'key', 'authorization',
        'cookie', 'session', 'jwt', 'refresh_token', 'access_token',
        'api_key', 'private_key', 'hash', 'salt'
      ],
      ...config
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    this.currentLogFile = null;
    this.currentFileSize = 0;
        
    this.initializeLogger();
  }

  async initializeLogger() {
    try {
      if (this.config.enableFile) {
        await fs.mkdir(this.config.logDirectory, { recursive: true });
        await this.rotateLogFile();
      }
    } catch (error) {
      logger.error('Failed to initialize secure logger:', error.message);
    }
  }

  sanitizeData(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();
            
      // Check if field is sensitive
      const isSensitive = this.config.sensitiveFields.some(field => 
        keyLower.includes(field.toLowerCase())
      );

      if (isSensitive) {
        if (typeof value === 'string') {
          // Show only first 2 and last 2 characters for strings
          sanitized[key] = value.length > 4 
            ? `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
            : '***';
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  formatLogEntry(level, component, message, data = {}) {
    const timestamp = new Date().toISOString();
    const sanitizedData = this.sanitizeData(data);
        
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      component,
      message,
      data: sanitizedData,
      pid: process.pid,
      requestId: data.requestId || this.generateRequestId()
    };

    return logEntry;
  }

  generateRequestId() {
    return crypto.randomBytes(8).toString('hex');
  }

  async encryptLogEntry(logEntry) {
    if (!this.config.enableEncryption || !this.config.encryptionKey) {
      return JSON.stringify(logEntry);
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', this.config.encryptionKey);
            
      let encrypted = cipher.update(JSON.stringify(logEntry), 'utf8', 'hex');
      encrypted += cipher.final('hex');
            
      const authTag = cipher.getAuthTag();
            
      return JSON.stringify({
        encrypted: true,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted
      });
    } catch (error) {
      logger.error('Failed to encrypt log entry:', error.message);
      return JSON.stringify(logEntry);
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.config.logLevel];
  }

  async writeToFile(logEntry) {
    if (!this.config.enableFile || !this.currentLogFile) {
      return;
    }

    try {
      const logLine = await this.encryptLogEntry(logEntry) + '\n';
            
      await fs.appendFile(this.currentLogFile, logLine);
      this.currentFileSize += Buffer.byteLength(logLine);

      // Check if rotation is needed
      if (this.currentFileSize >= this.config.maxFileSize) {
        await this.rotateLogFile();
      }
    } catch (error) {
      logger.error('Failed to write to log file:', error.message);
    }
  }

  async rotateLogFile() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `security-${timestamp}.log`;
      this.currentLogFile = path.join(this.config.logDirectory, filename);
      this.currentFileSize = 0;

      // Clean up old log files
      await this.cleanupOldLogs();
    } catch (error) {
      logger.error('Failed to rotate log file:', error.message);
    }
  }

  async cleanupOldLogs() {
    try {
      // Check if log directory exists
      try {
        await fs.access(this.config.logDirectory);
      } catch (error) {
        // Directory doesn't exist, nothing to clean up
        return;
      }

      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('security-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
          stat: null
        }));

      // Get file stats
      for (const file of logFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch (error) {
          // File might have been deleted, skip it
          continue;
        }
      }

      // Sort by creation time and remove old files
      const validFiles = logFiles
        .filter(file => file.stat)
        .sort((a, b) => b.stat.birthtime - a.stat.birthtime);

      if (validFiles.length > this.config.maxFiles) {
        const filesToDelete = validFiles.slice(this.config.maxFiles);
                
        for (const file of filesToDelete) {
          try {
            // Check if file still exists before trying to delete
            await fs.access(file.path);
            await fs.unlink(file.path);
          } catch (error) {
            // Only log error if it's not a "file not found" error
            if (error.code !== 'ENOENT') {
              logger.error(`Failed to delete old log file ${file.name}:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      // Only log error if it's not a "directory not found" error
      if (error.code !== 'ENOENT') {
        logger.error('Failed to cleanup old logs:', error.message);
      }
    }
  }

  async log(level, component, message, data = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.formatLogEntry(level, component, message, data);

    // Console output
    if (this.config.enableConsole) {
      const consoleMessage = `[${logEntry.timestamp}] ${logEntry.level} ${logEntry.component}: ${logEntry.message}`;
            
      switch (level) {
      case 'error':
        logger.error(consoleMessage, logEntry.data);
        break;
      case 'warn':
        logger.warn(consoleMessage, logEntry.data);
        break;
      case 'debug':
        console.debug(consoleMessage, logEntry.data);
        break;
      default:
        logger.info(consoleMessage, logEntry.data);
      }
    }

    // File output
    if (this.config.enableFile) {
      await this.writeToFile(logEntry);
    }
  }

  async error(component, message, data = {}) {
    await this.log('error', component, message, data);
  }

  async warn(component, message, data = {}) {
    await this.log('warn', component, message, data);
  }

  async info(component, message, data = {}) {
    await this.log('info', component, message, data);
  }

  async debug(component, message, data = {}) {
    await this.log('debug', component, message, data);
  }

  // Security-specific logging methods
  async logSecurityEvent(eventType, details = {}) {
    await this.log('warn', 'SECURITY', `Security event: ${eventType}`, {
      eventType,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  async logAuthenticationEvent(eventType, details = {}) {
    await this.log('info', 'AUTH', `Authentication event: ${eventType}`, {
      eventType,
      ...details
    });
  }

  async logRateLimitEvent(details = {}) {
    await this.log('warn', 'RATE_LIMIT', 'Rate limit exceeded', details);
  }

  async logBruteForceAttempt(details = {}) {
    await this.log('error', 'BRUTE_FORCE', 'Brute force attempt detected', details);
  }

  // Audit logging
  async logAuditEvent(action, user, resource, details = {}) {
    await this.log('info', 'AUDIT', `${action} on ${resource}`, {
      action,
      user: typeof user === 'object' ? user.id || user.username : user,
      resource,
      ...details
    });
  }

  async close() {
    // Flush any pending writes
    if (this.config.enableFile && this.currentLogFile) {
      try {
        // Force sync to ensure all data is written
        const fd = await fs.open(this.currentLogFile, 'a');
        await fd.sync();
        await fd.close();
      } catch (error) {
        logger.error('Failed to close log file:', error.message);
      }
    }
  }
}

export default SecureLogger;
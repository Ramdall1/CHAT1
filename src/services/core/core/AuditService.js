import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';
import EventBus from '../EventBus.js';
import { EventTypes } from './EventTypes.js';
import BaseService from './BaseService.js';

class AuditService extends BaseService {
  constructor() {
    super('AuditService');
    this.eventBus = new EventBus();
    this.auditLogPath = path.join(process.cwd(), 'logs', 'audit.log');
    this.setupEventListeners();
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.auditLogPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  setupEventListeners() {
    // Eventos de usuario
    this.eventBus.on(EventTypes.USER.LOGIN_SUCCESS, this.auditUserEvent.bind(this));
    this.eventBus.on(EventTypes.USER.LOGIN_FAILED, this.auditUserEvent.bind(this));
    this.eventBus.on(EventTypes.USER.LOGOUT, this.auditUserEvent.bind(this));
    this.eventBus.on(EventTypes.USER.REGISTER_SUCCESS, this.auditUserEvent.bind(this));
    this.eventBus.on(EventTypes.USER.PASSWORD_CHANGED, this.auditUserEvent.bind(this));
    this.eventBus.on(EventTypes.USER.PROFILE_UPDATED, this.auditUserEvent.bind(this));
    this.eventBus.on(EventTypes.USER.ACCOUNT_LOCKED, this.auditUserEvent.bind(this));
    this.eventBus.on(EventTypes.USER.ACCOUNT_UNLOCKED, this.auditUserEvent.bind(this));

    // Eventos del sistema
    this.eventBus.on(EventTypes.SYSTEM.STARTUP, this.auditSystemEvent.bind(this));
    this.eventBus.on(EventTypes.SYSTEM.SHUTDOWN, this.auditSystemEvent.bind(this));
    this.eventBus.on(EventTypes.SYSTEM.ERROR, this.auditSystemEvent.bind(this));
    this.eventBus.on(EventTypes.SYSTEM.DATABASE_CONNECTED, this.auditSystemEvent.bind(this));
    this.eventBus.on(EventTypes.SYSTEM.DATABASE_ERROR, this.auditSystemEvent.bind(this));
    this.eventBus.on(EventTypes.SYSTEM.SERVICE_STARTED, this.auditSystemEvent.bind(this));
    this.eventBus.on(EventTypes.SYSTEM.SERVICE_ERROR, this.auditSystemEvent.bind(this));
    this.eventBus.on(EventTypes.SYSTEM.SECURITY_THREAT, this.auditSystemEvent.bind(this));
    this.eventBus.on(EventTypes.SYSTEM.READY, this.auditSystemEvent.bind(this));

    // Eventos de IA
    this.eventBus.on(EventTypes.AI.MESSAGE_RECEIVED, this.auditAIEvent.bind(this));
    this.eventBus.on(EventTypes.AI.MESSAGE_PROCESSED, this.auditAIEvent.bind(this));
    this.eventBus.on(EventTypes.AI.RESPONSE_GENERATED, this.auditAIEvent.bind(this));
    this.eventBus.on(EventTypes.AI.ERROR, this.auditAIEvent.bind(this));
    this.eventBus.on(EventTypes.AI.LEARNING_UPDATE, this.auditAIEvent.bind(this));

    this.logger.info('Audit event listeners configurados');
  }

  auditUserEvent(eventData) {
    const auditEntry = {
      category: 'USER',
      eventType: this.getEventTypeFromData(eventData),
      timestamp: eventData.timestamp || new Date().toISOString(),
      userId: eventData.userId,
      email: eventData.email,
      ip: eventData.ip,
      userAgent: eventData.userAgent,
      details: this.sanitizeEventData(eventData),
      severity: this.getEventSeverity(eventData)
    };

    this.writeAuditLog(auditEntry);
  }

  auditSystemEvent(eventData) {
    const auditEntry = {
      category: 'SYSTEM',
      eventType: this.getEventTypeFromData(eventData),
      timestamp: eventData.timestamp || new Date().toISOString(),
      component: eventData.component || 'unknown',
      details: this.sanitizeEventData(eventData),
      severity: this.getEventSeverity(eventData)
    };

    this.writeAuditLog(auditEntry);
  }

  auditAIEvent(eventData) {
    const auditEntry = {
      category: 'AI',
      eventType: this.getEventTypeFromData(eventData),
      timestamp: eventData.timestamp || new Date().toISOString(),
      userId: eventData.userId,
      messageId: eventData.messageId,
      aiModel: eventData.aiModel,
      details: this.sanitizeEventData(eventData),
      severity: this.getEventSeverity(eventData)
    };

    this.writeAuditLog(auditEntry);
  }

  getEventTypeFromData(eventData) {
    // Extraer el tipo de evento basado en los datos
    if (eventData.reason === 'user_not_found' || eventData.reason === 'invalid_password') {
      return 'LOGIN_FAILED';
    }
    if (eventData.sessionId) {
      return 'LOGIN_SUCCESS';
    }
    if (eventData.sessionType) {
      return 'LOGOUT';
    }
    if (eventData.createdBy) {
      return 'REGISTER_SUCCESS';
    }
    return 'UNKNOWN';
  }

  getEventSeverity(eventData) {
    if (eventData.reason === 'invalid_password' || eventData.error) {
      return 'HIGH';
    }
    if (eventData.sessionId || eventData.userId) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  sanitizeEventData(eventData) {
    const sanitized = { ...eventData };
        
    // Remover información sensible
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.accessToken;
    delete sanitized.refreshToken;
    delete sanitized.sessionId;
        
    return sanitized;
  }

  writeAuditLog(auditEntry) {
    try {
      const logLine = JSON.stringify(auditEntry) + '\n';
      fs.appendFileSync(this.auditLogPath, logLine);
            
      this.logger.info('Evento auditado', {
        category: auditEntry.category,
        eventType: auditEntry.eventType,
        severity: auditEntry.severity
      });
    } catch (error) {
      this.logger.error('Error escribiendo log de auditoría:', error);
    }
  }

  // Método para consultar logs de auditoría
  async getAuditLogs(filters = {}) {
    try {
      const logContent = fs.readFileSync(this.auditLogPath, 'utf8');
      const logs = logContent.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      let filteredLogs = logs;

      if (filters.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filters.category);
      }

      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
      }

      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= new Date(filters.startDate)
        );
      }

      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) <= new Date(filters.endDate)
        );
      }

      if (filters.severity) {
        filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
      }

      return filteredLogs.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      this.logger.error('Error leyendo logs de auditoría:', error);
      return [];
    }
  }

  // Método para obtener estadísticas de auditoría
  async getAuditStats(timeframe = '24h') {
    try {
      const logs = await this.getAuditLogs();
      const now = new Date();
      let startTime;

      switch (timeframe) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const recentLogs = logs.filter(log => 
        new Date(log.timestamp) >= startTime
      );

      const stats = {
        total: recentLogs.length,
        byCategory: {},
        bySeverity: {},
        byEventType: {},
        timeframe
      };

      recentLogs.forEach(log => {
        // Por categoría
        stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
                
        // Por severidad
        stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
                
        // Por tipo de evento
        stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;
      });

      return stats;
    } catch (error) {
      this.logger.error('Error calculando estadísticas de auditoría:', error);
      return null;
    }
  }
}

export default AuditService;
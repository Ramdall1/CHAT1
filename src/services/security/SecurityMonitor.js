/**
 * SecurityMonitor - Sistema de monitoreo de seguridad en tiempo real
 * Consolida logs de seguridad y proporciona alertas automáticas
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';

class SecurityMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      alertThresholds: {
        failedLogins: 5,           // Alertar después de 5 intentos fallidos
        suspiciousIPs: 3,          // Alertar después de 3 IPs sospechosas
        rateLimitViolations: 10,   // Alertar después de 10 violaciones
        bruteForceAttempts: 3,     // Alertar después de 3 intentos de fuerza bruta
        anomalousActivity: 2       // Alertar después de 2 actividades anómalas
      },
      monitoringInterval: 30000,   // Revisar cada 30 segundos
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 horas
      enableRealTimeAlerts: true,
      logDirectory: './logs/security',
      ...config
    };

    // Contadores de eventos de seguridad
    this.securityCounters = {
      failedLogins: new Map(),
      suspiciousIPs: new Set(),
      rateLimitViolations: new Map(),
      bruteForceAttempts: new Map(),
      anomalousActivity: new Map()
    };

    // Historial de eventos
    this.eventHistory = [];
    
    // Estado del monitoreo
    this.isMonitoring = false;
    this.monitoringInterval = null;

    // Inicializar directorio de logs
    this.initializeLogDirectory();
  }

  /**
   * Inicializa el directorio de logs de seguridad
   */
  async initializeLogDirectory() {
    try {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      logger.error('Error creando directorio de logs:', error.message);
    }
  }

  /**
   * Inicia el monitoreo de seguridad
   */
  startMonitoring() {
    if (this.isMonitoring) {
      logger.debug('🔍 SecurityMonitor: Ya está en funcionamiento');
      return;
    }

    this.isMonitoring = true;
    logger.debug('🔍 SecurityMonitor: Iniciando monitoreo en tiempo real...');

    // Configurar intervalo de monitoreo
    this.monitoringInterval = setInterval(() => {
      this.performSecurityCheck();
    }, this.config.monitoringInterval);

    // Limpiar eventos antiguos
    this.cleanupOldEvents();

    this.emit('monitoringStarted');
  }

  /**
   * Detiene el monitoreo de seguridad
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.debug('🔍 SecurityMonitor: Monitoreo detenido');
    this.emit('monitoringStopped');
  }

  /**
   * Registra un evento de seguridad
   */
  recordSecurityEvent(eventType, details = {}) {
    const event = {
      id: this.generateEventId(),
      type: eventType,
      timestamp: new Date(),
      details: {
        ip: details.ip || 'unknown',
        userId: details.userId || null,
        userAgent: details.userAgent || 'unknown',
        endpoint: details.endpoint || 'unknown',
        severity: details.severity || 'medium',
        ...details
      }
    };

    // Agregar al historial
    this.eventHistory.push(event);

    // Actualizar contadores
    this.updateCounters(event);

    // Verificar si se debe generar alerta
    this.checkForAlerts(event);

    // Log del evento
    this.logEvent(event);

    // Emitir evento para listeners externos
    this.emit('securityEvent', event);

    return event;
  }

  /**
   * Actualiza contadores de seguridad
   */
  updateCounters(event) {
    const { type, details } = event;
    const { ip, userId } = details;

    switch (type) {
      case 'failed_login':
        const failedCount = this.securityCounters.failedLogins.get(ip) || 0;
        this.securityCounters.failedLogins.set(ip, failedCount + 1);
        break;

      case 'suspicious_activity':
        this.securityCounters.suspiciousIPs.add(ip);
        break;

      case 'rate_limit_exceeded':
        const rateCount = this.securityCounters.rateLimitViolations.get(ip) || 0;
        this.securityCounters.rateLimitViolations.set(ip, rateCount + 1);
        break;

      case 'brute_force_attempt':
        const bruteCount = this.securityCounters.bruteForceAttempts.get(ip) || 0;
        this.securityCounters.bruteForceAttempts.set(ip, bruteCount + 1);
        break;

      case 'anomalous_behavior':
        const anomalyCount = this.securityCounters.anomalousActivity.get(userId || ip) || 0;
        this.securityCounters.anomalousActivity.set(userId || ip, anomalyCount + 1);
        break;
    }
  }

  /**
   * Verifica si se deben generar alertas
   */
  checkForAlerts(event) {
    if (!this.config.enableRealTimeAlerts) {
      return;
    }

    const { type, details } = event;
    const { ip, userId } = details;

    // Verificar umbrales de alerta
    const alerts = [];

    // Intentos de login fallidos
    const failedLogins = this.securityCounters.failedLogins.get(ip) || 0;
    if (failedLogins >= this.config.alertThresholds.failedLogins) {
      alerts.push({
        type: 'FAILED_LOGIN_THRESHOLD',
        severity: 'high',
        message: `IP ${ip} ha excedido el umbral de intentos de login fallidos (${failedLogins})`,
        ip,
        count: failedLogins
      });
    }

    // IPs sospechosas
    if (this.securityCounters.suspiciousIPs.size >= this.config.alertThresholds.suspiciousIPs) {
      alerts.push({
        type: 'SUSPICIOUS_IP_THRESHOLD',
        severity: 'medium',
        message: `Se han detectado ${this.securityCounters.suspiciousIPs.size} IPs sospechosas`,
        count: this.securityCounters.suspiciousIPs.size
      });
    }

    // Violaciones de rate limiting
    const rateLimitViolations = this.securityCounters.rateLimitViolations.get(ip) || 0;
    if (rateLimitViolations >= this.config.alertThresholds.rateLimitViolations) {
      alerts.push({
        type: 'RATE_LIMIT_THRESHOLD',
        severity: 'medium',
        message: `IP ${ip} ha excedido el umbral de violaciones de rate limit (${rateLimitViolations})`,
        ip,
        count: rateLimitViolations
      });
    }

    // Intentos de fuerza bruta
    const bruteForceAttempts = this.securityCounters.bruteForceAttempts.get(ip) || 0;
    if (bruteForceAttempts >= this.config.alertThresholds.bruteForceAttempts) {
      alerts.push({
        type: 'BRUTE_FORCE_THRESHOLD',
        severity: 'critical',
        message: `IP ${ip} está realizando ataques de fuerza bruta (${bruteForceAttempts} intentos)`,
        ip,
        count: bruteForceAttempts
      });
    }

    // Actividad anómala
    const anomalousActivity = this.securityCounters.anomalousActivity.get(userId || ip) || 0;
    if (anomalousActivity >= this.config.alertThresholds.anomalousActivity) {
      alerts.push({
        type: 'ANOMALOUS_ACTIVITY_THRESHOLD',
        severity: 'high',
        message: `Actividad anómala detectada para ${userId || ip} (${anomalousActivity} eventos)`,
        userId,
        ip,
        count: anomalousActivity
      });
    }

    // Emitir alertas
    alerts.forEach(alert => {
      this.emitAlert(alert);
    });
  }

  /**
   * Emite una alerta de seguridad
   */
  emitAlert(alert) {
    const alertEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...alert
    };

    logger.debug(`🚨 ALERTA DE SEGURIDAD [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    this.emit('securityAlert', alertEvent);
    this.logAlert(alertEvent);
  }

  /**
   * Realiza verificación periódica de seguridad
   */
  performSecurityCheck() {
    const now = new Date();
    const stats = this.getSecurityStats();

    // Log de estadísticas periódicas
    logger.debug(`🔍 SecurityMonitor Check [${now.toISOString()}]:`, {
      totalEvents: this.eventHistory.length,
      failedLogins: stats.failedLogins,
      suspiciousIPs: stats.suspiciousIPs,
      rateLimitViolations: stats.rateLimitViolations
    });

    this.emit('securityCheck', stats);
  }

  /**
   * Obtiene estadísticas de seguridad
   */
  getSecurityStats() {
    return {
      totalEvents: this.eventHistory.length,
      failedLogins: Array.from(this.securityCounters.failedLogins.values()).reduce((a, b) => a + b, 0),
      suspiciousIPs: this.securityCounters.suspiciousIPs.size,
      rateLimitViolations: Array.from(this.securityCounters.rateLimitViolations.values()).reduce((a, b) => a + b, 0),
      bruteForceAttempts: Array.from(this.securityCounters.bruteForceAttempts.values()).reduce((a, b) => a + b, 0),
      anomalousActivity: Array.from(this.securityCounters.anomalousActivity.values()).reduce((a, b) => a + b, 0),
      lastCheck: new Date()
    };
  }

  /**
   * Obtiene eventos recientes
   */
  getRecentEvents(limit = 50) {
    return this.eventHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Limpia eventos antiguos
   */
  cleanupOldEvents() {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod);
    
    this.eventHistory = this.eventHistory.filter(event => 
      event.timestamp > cutoffTime
    );

    // Limpiar contadores antiguos
    this.cleanupCounters(cutoffTime);
  }

  /**
   * Limpia contadores antiguos
   */
  cleanupCounters(cutoffTime) {
    // Esta implementación es básica, en un entorno real
    // necesitarías timestamps en los contadores
    if (this.eventHistory.length === 0) {
      this.securityCounters.failedLogins.clear();
      this.securityCounters.suspiciousIPs.clear();
      this.securityCounters.rateLimitViolations.clear();
      this.securityCounters.bruteForceAttempts.clear();
      this.securityCounters.anomalousActivity.clear();
    }
  }

  /**
   * Registra evento en archivo
   */
  async logEvent(event) {
    try {
      const logFile = path.join(this.config.logDirectory, `security-${new Date().toISOString().split('T')[0]}.log`);
      const logEntry = `${event.timestamp.toISOString()} [${event.type.toUpperCase()}] ${JSON.stringify(event.details)}\n`;
      
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      logger.error('Error escribiendo log de seguridad:', error.message);
    }
  }

  /**
   * Registra alerta en archivo
   */
  async logAlert(alert) {
    try {
      const alertFile = path.join(this.config.logDirectory, `alerts-${new Date().toISOString().split('T')[0]}.log`);
      const alertEntry = `${alert.timestamp.toISOString()} [${alert.severity.toUpperCase()}] ${alert.message}\n`;
      
      await fs.appendFile(alertFile, alertEntry);
    } catch (error) {
      logger.error('Error escribiendo log de alerta:', error.message);
    }
  }

  /**
   * Genera ID único para eventos
   */
  generateEventId() {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtiene reporte de seguridad
   */
  getSecurityReport() {
    const stats = this.getSecurityStats();
    const recentEvents = this.getRecentEvents(20);
    
    return {
      timestamp: new Date(),
      monitoring: {
        isActive: this.isMonitoring,
        interval: this.config.monitoringInterval,
        retentionPeriod: this.config.retentionPeriod
      },
      statistics: stats,
      recentEvents,
      thresholds: this.config.alertThresholds,
      counters: {
        failedLogins: Object.fromEntries(this.securityCounters.failedLogins),
        suspiciousIPs: Array.from(this.securityCounters.suspiciousIPs),
        rateLimitViolations: Object.fromEntries(this.securityCounters.rateLimitViolations),
        bruteForceAttempts: Object.fromEntries(this.securityCounters.bruteForceAttempts),
        anomalousActivity: Object.fromEntries(this.securityCounters.anomalousActivity)
      }
    };
  }

  /**
   * Cierra el monitor de seguridad
   */
  async close() {
    this.stopMonitoring();
    this.removeAllListeners();
    logger.debug('🔍 SecurityMonitor: Cerrado correctamente');
  }
}

export default SecurityMonitor;
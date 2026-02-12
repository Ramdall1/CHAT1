/**
 * AlertManager - Gestor de Alertas del Sistema
 * 
 * Gestiona alertas del sistema, notificaciones, escalamiento
 * y políticas de alertas para el dashboard de monitoreo
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../../services/core/core/logger.js';
import { EventEmitter } from 'events';

const logger = createLogger('ALERT_MANAGER');

export class AlertManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuración
    this.config = {
      // Configuración general
      enabled: options.enabled !== false,
      maxAlerts: options.maxAlerts || 1000,
      retentionPeriod: options.retentionPeriod || 86400000, // 24 horas
      
      // Configuración de severidad
      severityLevels: options.severityLevels || [
        'info',
        'warning',
        'error',
        'critical'
      ],
      
      // Configuración de cooldown
      cooldown: {
        enabled: options.cooldown?.enabled !== false,
        defaultPeriod: options.cooldown?.defaultPeriod || 300000, // 5 minutos
        periods: {
          info: options.cooldown?.periods?.info || 60000, // 1 minuto
          warning: options.cooldown?.periods?.warning || 300000, // 5 minutos
          error: options.cooldown?.periods?.error || 600000, // 10 minutos
          critical: options.cooldown?.periods?.critical || 900000, // 15 minutos
          ...options.cooldown?.periods
        }
      },
      
      // Configuración de agrupación
      grouping: {
        enabled: options.grouping?.enabled !== false,
        window: options.grouping?.window || 60000, // 1 minuto
        maxGroupSize: options.grouping?.maxGroupSize || 10,
        groupBy: options.grouping?.groupBy || ['type', 'source']
      },
      
      // Configuración de escalamiento
      escalation: {
        enabled: options.escalation?.enabled !== false,
        levels: options.escalation?.levels || [
          {
            level: 1,
            delay: 300000, // 5 minutos
            conditions: ['critical'],
            actions: ['notify']
          },
          {
            level: 2,
            delay: 900000, // 15 minutos
            conditions: ['critical', 'unresolved'],
            actions: ['notify', 'escalate']
          }
        ]
      },
      
      // Configuración de notificaciones
      notifications: {
        enabled: options.notifications?.enabled !== false,
        channels: options.notifications?.channels || ['console'],
        templates: options.notifications?.templates || {},
        throttle: options.notifications?.throttle || 60000 // 1 minuto
      },
      
      // Configuración de filtros
      filters: {
        enabled: options.filters?.enabled !== false,
        rules: options.filters?.rules || [],
        blacklist: options.filters?.blacklist || [],
        whitelist: options.filters?.whitelist || []
      },
      
      // Configuración de métricas
      metrics: {
        enabled: options.metrics?.enabled !== false,
        trackResolution: options.metrics?.trackResolution !== false,
        trackEscalation: options.metrics?.trackEscalation !== false
      },
      
      ...options
    };
    
    // Estado del gestor
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = null;
    
    // Almacenamiento de alertas
    this.alerts = new Map(); // ID -> Alert
    this.alertHistory = [];
    this.alertGroups = new Map(); // GroupKey -> Group
    
    // Índices para búsqueda rápida
    this.alertsByType = new Map();
    this.alertsBySource = new Map();
    this.alertsBySeverity = new Map();
    this.alertsByStatus = new Map();
    
    // Cache de cooldown
    this.cooldownCache = new Map();
    
    // Escalamiento
    this.escalationTimers = new Map();
    this.escalationHistory = [];
    
    // Estadísticas
    this.alertStats = {
      totalAlerts: 0,
      activeAlerts: 0,
      resolvedAlerts: 0,
      escalatedAlerts: 0,
      suppressedAlerts: 0,
      groupedAlerts: 0,
      notificationsSent: 0,
      averageResolutionTime: 0,
      alertsByType: new Map(),
      alertsBySeverity: new Map(),
      alertsBySource: new Map()
    };
    
    // Canales de notificación
    this.notificationChannels = new Map();
    
    // Timers
    this.cleanupTimer = null;
    this.metricsTimer = null;
    
    logger.info('AlertManager inicializado', {
      enabled: this.config.enabled,
      maxAlerts: this.config.maxAlerts,
      severityLevels: this.config.severityLevels
    });
  }
  
  /**
   * Inicializar el gestor de alertas
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('AlertManager ya está inicializado');
      return;
    }
    
    try {
      logger.info('Inicializando AlertManager...');
      
      // Configurar canales de notificación por defecto
      this.setupDefaultNotificationChannels();
      
      // Configurar timers
      this.setupTimers();
      
      // Configurar índices
      this.setupIndices();
      
      this.isInitialized = true;
      this.startTime = new Date().toISOString();
      
      logger.info('AlertManager inicializado correctamente');
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Error inicializando AlertManager:', error);
      throw error;
    }
  }
  
  /**
   * Configurar canales de notificación por defecto
   */
  setupDefaultNotificationChannels() {
    // Canal de consola
    this.registerNotificationChannel('console', {
      name: 'Console',
      send: async(alert, template) => {
        const message = this.formatAlertMessage(alert, template);
        logger.info(`[ALERT] ${message}`);
        return { success: true, channel: 'console' };
      }
    });
    
    // Canal de log
    this.registerNotificationChannel('log', {
      name: 'Log File',
      send: async(alert, template) => {
        const message = this.formatAlertMessage(alert, template);
        logger.warn(`ALERT: ${message}`, { alert });
        return { success: true, channel: 'log' };
      }
    });
  }
  
  /**
   * Configurar timers
   */
  setupTimers() {
    // Timer de limpieza
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldAlerts();
    }, 600000); // 10 minutos
    
    // Timer de métricas
    if (this.config.metrics.enabled) {
      this.metricsTimer = setInterval(() => {
        this.updateMetrics();
      }, 60000); // 1 minuto
    }
  }
  
  /**
   * Configurar índices
   */
  setupIndices() {
    for (const severity of this.config.severityLevels) {
      this.alertsBySeverity.set(severity, new Set());
    }
    
    this.alertsByStatus.set('active', new Set());
    this.alertsByStatus.set('resolved', new Set());
    this.alertsByStatus.set('suppressed', new Set());
  }
  
  /**
   * Iniciar el gestor
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isRunning) {
      logger.warn('AlertManager ya está ejecutándose');
      return;
    }
    
    try {
      logger.info('Iniciando AlertManager...');
      
      this.isRunning = true;
      
      logger.info('AlertManager iniciado');
      this.emit('started');
      
    } catch (error) {
      logger.error('Error iniciando AlertManager:', error);
      throw error;
    }
  }
  
  /**
   * Detener el gestor
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('AlertManager no está ejecutándose');
      return;
    }
    
    try {
      logger.info('Deteniendo AlertManager...');
      
      // Detener timers
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
        this.metricsTimer = null;
      }
      
      // Cancelar escalamientos pendientes
      for (const timer of this.escalationTimers.values()) {
        clearTimeout(timer);
      }
      this.escalationTimers.clear();
      
      this.isRunning = false;
      
      logger.info('AlertManager detenido');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Error deteniendo AlertManager:', error);
      throw error;
    }
  }
  
  /**
   * Crear alerta
   */
  async createAlert(alertData) {
    if (!this.config.enabled) {
      logger.debug('AlertManager deshabilitado, ignorando alerta');
      return null;
    }
    
    try {
      // Validar datos de la alerta
      const validatedData = this.validateAlertData(alertData);
      
      // Aplicar filtros
      if (!this.passesFilters(validatedData)) {
        logger.debug('Alerta filtrada', { alert: validatedData });
        this.alertStats.suppressedAlerts++;
        return null;
      }
      
      // Verificar cooldown
      if (this.isInCooldown(validatedData)) {
        logger.debug('Alerta en cooldown', { alert: validatedData });
        this.alertStats.suppressedAlerts++;
        return null;
      }
      
      // Crear objeto de alerta
      const alert = this.buildAlert(validatedData);
      
      // Verificar agrupación
      const group = this.findOrCreateGroup(alert);
      if (group && group.alerts.length >= this.config.grouping.maxGroupSize) {
        logger.debug('Grupo de alertas lleno, ignorando alerta', { alert });
        this.alertStats.suppressedAlerts++;
        return null;
      }
      
      // Almacenar alerta
      this.storeAlert(alert);
      
      // Agregar a grupo si corresponde
      if (group) {
        this.addToGroup(alert, group);
      }
      
      // Actualizar índices
      this.updateIndices(alert);
      
      // Actualizar estadísticas
      this.updateAlertStats(alert);
      
      // Configurar escalamiento
      if (this.config.escalation.enabled) {
        this.setupEscalation(alert);
      }
      
      // Enviar notificaciones
      if (this.config.notifications.enabled) {
        await this.sendNotifications(alert);
      }
      
      // Emitir evento
      this.emit('alert:created', alert);
      
      logger.info('Alerta creada', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        source: alert.source
      });
      
      return alert;
      
    } catch (error) {
      logger.error('Error creando alerta:', error);
      throw error;
    }
  }
  
  /**
   * Validar datos de alerta
   */
  validateAlertData(alertData) {
    const required = ['type', 'message', 'severity'];
    
    for (const field of required) {
      if (!alertData[field]) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }
    
    if (!this.config.severityLevels.includes(alertData.severity)) {
      throw new Error(`Severidad inválida: ${alertData.severity}`);
    }
    
    return {
      type: alertData.type,
      message: alertData.message,
      severity: alertData.severity,
      source: alertData.source || 'unknown',
      metadata: alertData.metadata || {},
      tags: alertData.tags || [],
      timestamp: alertData.timestamp || new Date().toISOString(),
      ...alertData
    };
  }
  
  /**
   * Verificar si pasa los filtros
   */
  passesFilters(alertData) {
    if (!this.config.filters.enabled) {
      return true;
    }
    
    // Verificar blacklist
    for (const rule of this.config.filters.blacklist) {
      if (this.matchesRule(alertData, rule)) {
        return false;
      }
    }
    
    // Verificar whitelist (si existe)
    if (this.config.filters.whitelist.length > 0) {
      let passes = false;
      for (const rule of this.config.filters.whitelist) {
        if (this.matchesRule(alertData, rule)) {
          passes = true;
          break;
        }
      }
      if (!passes) {
        return false;
      }
    }
    
    // Verificar reglas personalizadas
    for (const rule of this.config.filters.rules) {
      if (rule.condition && !rule.condition(alertData)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Verificar si coincide con regla
   */
  matchesRule(alertData, rule) {
    if (typeof rule === 'string') {
      return alertData.type === rule || alertData.source === rule;
    }
    
    if (typeof rule === 'object') {
      for (const [key, value] of Object.entries(rule)) {
        if (alertData[key] !== value) {
          return false;
        }
      }
      return true;
    }
    
    if (typeof rule === 'function') {
      return rule(alertData);
    }
    
    return false;
  }
  
  /**
   * Verificar cooldown
   */
  isInCooldown(alertData) {
    if (!this.config.cooldown.enabled) {
      return false;
    }
    
    const cooldownKey = this.generateCooldownKey(alertData);
    const lastAlert = this.cooldownCache.get(cooldownKey);
    
    if (!lastAlert) {
      return false;
    }
    
    const cooldownPeriod = this.config.cooldown.periods[alertData.severity] || 
                          this.config.cooldown.defaultPeriod;
    
    return Date.now() - lastAlert < cooldownPeriod;
  }
  
  /**
   * Generar clave de cooldown
   */
  generateCooldownKey(alertData) {
    return `${alertData.type}_${alertData.source}_${alertData.severity}`;
  }
  
  /**
   * Construir objeto de alerta
   */
  buildAlert(alertData) {
    return {
      id: this.generateAlertId(),
      type: alertData.type,
      message: alertData.message,
      severity: alertData.severity,
      source: alertData.source,
      metadata: alertData.metadata,
      tags: alertData.tags,
      timestamp: alertData.timestamp,
      status: 'active',
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
      escalated: false,
      escalationLevel: 0,
      escalationHistory: [],
      notificationsSent: [],
      groupId: null,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
  }
  
  /**
   * Generar ID de alerta
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Encontrar o crear grupo
   */
  findOrCreateGroup(alert) {
    if (!this.config.grouping.enabled) {
      return null;
    }
    
    const groupKey = this.generateGroupKey(alert);
    let group = this.alertGroups.get(groupKey);
    
    if (!group) {
      group = {
        id: this.generateGroupId(),
        key: groupKey,
        type: alert.type,
        source: alert.source,
        severity: alert.severity,
        alerts: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        windowStart: Date.now(),
        windowEnd: Date.now() + this.config.grouping.window
      };
      
      this.alertGroups.set(groupKey, group);
    }
    
    // Verificar si el grupo está dentro de la ventana
    if (Date.now() > group.windowEnd) {
      // Crear nuevo grupo
      group = {
        id: this.generateGroupId(),
        key: groupKey,
        type: alert.type,
        source: alert.source,
        severity: alert.severity,
        alerts: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        windowStart: Date.now(),
        windowEnd: Date.now() + this.config.grouping.window
      };
      
      this.alertGroups.set(groupKey, group);
    }
    
    return group;
  }
  
  /**
   * Generar clave de grupo
   */
  generateGroupKey(alert) {
    const keyParts = [];
    
    for (const field of this.config.grouping.groupBy) {
      keyParts.push(alert[field] || 'unknown');
    }
    
    return keyParts.join('_');
  }
  
  /**
   * Generar ID de grupo
   */
  generateGroupId() {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Almacenar alerta
   */
  storeAlert(alert) {
    this.alerts.set(alert.id, alert);
    
    // Agregar al historial
    this.alertHistory.unshift({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      source: alert.source,
      timestamp: alert.timestamp,
      action: 'created'
    });
    
    // Limitar tamaño del historial
    if (this.alertHistory.length > this.config.maxAlerts) {
      this.alertHistory = this.alertHistory.slice(0, this.config.maxAlerts);
    }
    
    // Actualizar cache de cooldown
    const cooldownKey = this.generateCooldownKey(alert);
    this.cooldownCache.set(cooldownKey, Date.now());
  }
  
  /**
   * Agregar a grupo
   */
  addToGroup(alert, group) {
    alert.groupId = group.id;
    group.alerts.push(alert.id);
    group.updated = new Date().toISOString();
    
    // Actualizar severidad del grupo (tomar la más alta)
    const severityIndex = this.config.severityLevels.indexOf(alert.severity);
    const groupSeverityIndex = this.config.severityLevels.indexOf(group.severity);
    
    if (severityIndex > groupSeverityIndex) {
      group.severity = alert.severity;
    }
    
    this.alertStats.groupedAlerts++;
  }
  
  /**
   * Actualizar índices
   */
  updateIndices(alert) {
    // Índice por tipo
    if (!this.alertsByType.has(alert.type)) {
      this.alertsByType.set(alert.type, new Set());
    }
    this.alertsByType.get(alert.type).add(alert.id);
    
    // Índice por fuente
    if (!this.alertsBySource.has(alert.source)) {
      this.alertsBySource.set(alert.source, new Set());
    }
    this.alertsBySource.get(alert.source).add(alert.id);
    
    // Índice por severidad
    this.alertsBySeverity.get(alert.severity).add(alert.id);
    
    // Índice por estado
    this.alertsByStatus.get(alert.status).add(alert.id);
  }
  
  /**
   * Actualizar estadísticas de alerta
   */
  updateAlertStats(alert) {
    this.alertStats.totalAlerts++;
    this.alertStats.activeAlerts++;
    
    // Estadísticas por tipo
    if (!this.alertStats.alertsByType.has(alert.type)) {
      this.alertStats.alertsByType.set(alert.type, 0);
    }
    this.alertStats.alertsByType.set(alert.type, 
      this.alertStats.alertsByType.get(alert.type) + 1);
    
    // Estadísticas por severidad
    if (!this.alertStats.alertsBySeverity.has(alert.severity)) {
      this.alertStats.alertsBySeverity.set(alert.severity, 0);
    }
    this.alertStats.alertsBySeverity.set(alert.severity, 
      this.alertStats.alertsBySeverity.get(alert.severity) + 1);
    
    // Estadísticas por fuente
    if (!this.alertStats.alertsBySource.has(alert.source)) {
      this.alertStats.alertsBySource.set(alert.source, 0);
    }
    this.alertStats.alertsBySource.set(alert.source, 
      this.alertStats.alertsBySource.get(alert.source) + 1);
  }
  
  /**
   * Configurar escalamiento
   */
  setupEscalation(alert) {
    for (const level of this.config.escalation.levels) {
      if (this.shouldEscalate(alert, level)) {
        const timer = setTimeout(() => {
          this.escalateAlert(alert, level);
        }, level.delay);
        
        this.escalationTimers.set(`${alert.id}_${level.level}`, timer);
      }
    }
  }
  
  /**
   * Verificar si debe escalar
   */
  shouldEscalate(alert, level) {
    return level.conditions.includes(alert.severity);
  }
  
  /**
   * Escalar alerta
   */
  async escalateAlert(alert, level) {
    try {
      const currentAlert = this.alerts.get(alert.id);
      
      if (!currentAlert || currentAlert.resolved) {
        return; // Alerta ya resuelta
      }
      
      currentAlert.escalated = true;
      currentAlert.escalationLevel = level.level;
      currentAlert.escalationHistory.push({
        level: level.level,
        timestamp: new Date().toISOString(),
        actions: level.actions
      });
      currentAlert.updated = new Date().toISOString();
      
      // Ejecutar acciones de escalamiento
      for (const action of level.actions) {
        await this.executeEscalationAction(currentAlert, action, level);
      }
      
      this.alertStats.escalatedAlerts++;
      
      // Agregar al historial de escalamiento
      this.escalationHistory.push({
        alertId: alert.id,
        level: level.level,
        timestamp: new Date().toISOString(),
        actions: level.actions
      });
      
      this.emit('alert:escalated', {
        alert: currentAlert,
        level: level.level,
        actions: level.actions
      });
      
      logger.warn('Alerta escalada', {
        id: alert.id,
        level: level.level,
        actions: level.actions
      });
      
    } catch (error) {
      logger.error('Error escalando alerta:', error);
    }
  }
  
  /**
   * Ejecutar acción de escalamiento
   */
  async executeEscalationAction(alert, action, level) {
    switch (action) {
    case 'notify':
      await this.sendNotifications(alert, true);
      break;
    case 'escalate':
      // Lógica adicional de escalamiento
      break;
    default:
      logger.warn(`Acción de escalamiento desconocida: ${action}`);
    }
  }
  
  /**
   * Enviar notificaciones
   */
  async sendNotifications(alert, isEscalation = false) {
    try {
      const channels = this.config.notifications.channels;
      const template = this.getNotificationTemplate(alert, isEscalation);
      
      for (const channelName of channels) {
        const channel = this.notificationChannels.get(channelName);
        
        if (!channel) {
          logger.warn(`Canal de notificación no encontrado: ${channelName}`);
          continue;
        }
        
        try {
          const result = await channel.send(alert, template);
          
          alert.notificationsSent.push({
            channel: channelName,
            timestamp: new Date().toISOString(),
            success: result.success,
            escalation: isEscalation
          });
          
          this.alertStats.notificationsSent++;
          
        } catch (error) {
          logger.error(`Error enviando notificación por ${channelName}:`, error);
          
          alert.notificationsSent.push({
            channel: channelName,
            timestamp: new Date().toISOString(),
            success: false,
            error: error.message,
            escalation: isEscalation
          });
        }
      }
      
    } catch (error) {
      logger.error('Error enviando notificaciones:', error);
    }
  }
  
  /**
   * Obtener plantilla de notificación
   */
  getNotificationTemplate(alert, isEscalation = false) {
    const templateKey = isEscalation ? 'escalation' : alert.severity;
    return this.config.notifications.templates[templateKey] || 
           this.getDefaultTemplate(alert, isEscalation);
  }
  
  /**
   * Obtener plantilla por defecto
   */
  getDefaultTemplate(alert, isEscalation = false) {
    const prefix = isEscalation ? '[ESCALATED]' : '[ALERT]';
    return `${prefix} ${alert.severity.toUpperCase()}: ${alert.message} (Source: ${alert.source})`;
  }
  
  /**
   * Formatear mensaje de alerta
   */
  formatAlertMessage(alert, template) {
    if (typeof template === 'function') {
      return template(alert);
    }
    
    if (typeof template === 'string') {
      return template
        .replace('{id}', alert.id)
        .replace('{type}', alert.type)
        .replace('{message}', alert.message)
        .replace('{severity}', alert.severity)
        .replace('{source}', alert.source)
        .replace('{timestamp}', alert.timestamp);
    }
    
    return template;
  }
  
  /**
   * Reconocer alerta
   */
  async acknowledgeAlert(alertId, acknowledgedBy = 'system') {
    try {
      const alert = this.alerts.get(alertId);
      
      if (!alert) {
        throw new Error(`Alerta no encontrada: ${alertId}`);
      }
      
      if (alert.acknowledged) {
        logger.warn(`Alerta ya reconocida: ${alertId}`);
        return alert;
      }
      
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();
      alert.updated = new Date().toISOString();
      
      // Cancelar escalamientos pendientes
      this.cancelEscalation(alertId);
      
      // Agregar al historial
      this.alertHistory.unshift({
        id: alertId,
        type: alert.type,
        severity: alert.severity,
        source: alert.source,
        timestamp: new Date().toISOString(),
        action: 'acknowledged',
        by: acknowledgedBy
      });
      
      this.emit('alert:acknowledged', alert);
      
      logger.info('Alerta reconocida', {
        id: alertId,
        by: acknowledgedBy
      });
      
      return alert;
      
    } catch (error) {
      logger.error('Error reconociendo alerta:', error);
      throw error;
    }
  }
  
  /**
   * Resolver alerta
   */
  async resolveAlert(alertId, resolvedBy = 'system', resolution = null) {
    try {
      const alert = this.alerts.get(alertId);
      
      if (!alert) {
        throw new Error(`Alerta no encontrada: ${alertId}`);
      }
      
      if (alert.resolved) {
        logger.warn(`Alerta ya resuelta: ${alertId}`);
        return alert;
      }
      
      const resolutionTime = Date.now() - new Date(alert.created).getTime();
      
      alert.resolved = true;
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date().toISOString();
      alert.status = 'resolved';
      alert.resolution = resolution;
      alert.resolutionTime = resolutionTime;
      alert.updated = new Date().toISOString();
      
      // Actualizar índices
      this.alertsByStatus.get('active').delete(alertId);
      this.alertsByStatus.get('resolved').add(alertId);
      
      // Actualizar estadísticas
      this.alertStats.activeAlerts--;
      this.alertStats.resolvedAlerts++;
      
      // Actualizar tiempo promedio de resolución
      this.updateAverageResolutionTime(resolutionTime);
      
      // Cancelar escalamientos pendientes
      this.cancelEscalation(alertId);
      
      // Agregar al historial
      this.alertHistory.unshift({
        id: alertId,
        type: alert.type,
        severity: alert.severity,
        source: alert.source,
        timestamp: new Date().toISOString(),
        action: 'resolved',
        by: resolvedBy,
        resolutionTime
      });
      
      this.emit('alert:resolved', alert);
      
      logger.info('Alerta resuelta', {
        id: alertId,
        by: resolvedBy,
        resolutionTime
      });
      
      return alert;
      
    } catch (error) {
      logger.error('Error resolviendo alerta:', error);
      throw error;
    }
  }
  
  /**
   * Cancelar escalamiento
   */
  cancelEscalation(alertId) {
    for (const [timerKey, timer] of this.escalationTimers) {
      if (timerKey.startsWith(alertId)) {
        clearTimeout(timer);
        this.escalationTimers.delete(timerKey);
      }
    }
  }
  
  /**
   * Actualizar tiempo promedio de resolución
   */
  updateAverageResolutionTime(resolutionTime) {
    const totalResolved = this.alertStats.resolvedAlerts;
    const currentAverage = this.alertStats.averageResolutionTime;
    
    this.alertStats.averageResolutionTime = 
      (currentAverage * (totalResolved - 1) + resolutionTime) / totalResolved;
  }
  
  /**
   * Registrar canal de notificación
   */
  registerNotificationChannel(name, channel) {
    this.notificationChannels.set(name, {
      name: channel.name || name,
      send: channel.send,
      config: channel.config || {},
      registered: new Date().toISOString()
    });
    
    logger.info(`Canal de notificación registrado: ${name}`);
  }
  
  /**
   * Desregistrar canal de notificación
   */
  unregisterNotificationChannel(name) {
    const removed = this.notificationChannels.delete(name);
    if (removed) {
      logger.info(`Canal de notificación desregistrado: ${name}`);
    }
    return removed;
  }
  
  /**
   * Obtener alertas
   */
  getAlerts(filters = {}) {
    let alerts = Array.from(this.alerts.values());
    
    // Aplicar filtros
    if (filters.type) {
      alerts = alerts.filter(a => a.type === filters.type);
    }
    
    if (filters.severity) {
      alerts = alerts.filter(a => a.severity === filters.severity);
    }
    
    if (filters.source) {
      alerts = alerts.filter(a => a.source === filters.source);
    }
    
    if (filters.status) {
      alerts = alerts.filter(a => a.status === filters.status);
    }
    
    if (filters.acknowledged !== undefined) {
      alerts = alerts.filter(a => a.acknowledged === filters.acknowledged);
    }
    
    if (filters.resolved !== undefined) {
      alerts = alerts.filter(a => a.resolved === filters.resolved);
    }
    
    if (filters.since) {
      const since = new Date(filters.since).getTime();
      alerts = alerts.filter(a => new Date(a.timestamp).getTime() >= since);
    }
    
    if (filters.until) {
      const until = new Date(filters.until).getTime();
      alerts = alerts.filter(a => new Date(a.timestamp).getTime() <= until);
    }
    
    // Ordenar
    const sortBy = filters.sortBy || 'timestamp';
    const sortOrder = filters.sortOrder || 'desc';
    
    alerts.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'timestamp' || sortBy === 'created' || sortBy === 'updated') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (sortOrder === 'desc') {
        return bVal - aVal;
      } else {
        return aVal - bVal;
      }
    });
    
    // Limitar resultados
    if (filters.limit) {
      alerts = alerts.slice(0, filters.limit);
    }
    
    return alerts;
  }
  
  /**
   * Obtener alerta por ID
   */
  getAlert(alertId) {
    return this.alerts.get(alertId);
  }
  
  /**
   * Obtener grupos de alertas
   */
  getAlertGroups() {
    return Array.from(this.alertGroups.values());
  }
  
  /**
   * Obtener estadísticas
   */
  getAlertStats() {
    return {
      ...this.alertStats,
      alertsByType: Object.fromEntries(this.alertStats.alertsByType),
      alertsBySeverity: Object.fromEntries(this.alertStats.alertsBySeverity),
      alertsBySource: Object.fromEntries(this.alertStats.alertsBySource),
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      startTime: this.startTime,
      totalGroups: this.alertGroups.size,
      notificationChannels: this.notificationChannels.size,
      config: this.config
    };
  }
  
  /**
   * Obtener historial
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(0, limit);
  }
  
  /**
   * Obtener historial de escalamiento
   */
  getEscalationHistory(limit = 100) {
    return this.escalationHistory.slice(0, limit);
  }
  
  /**
   * Actualizar métricas
   */
  updateMetrics() {
    // Limpiar alertas resueltas antiguas de las estadísticas activas
    const activeAlerts = this.getAlerts({ status: 'active' });
    this.alertStats.activeAlerts = activeAlerts.length;
    
    // Emitir métricas
    this.emit('metrics:updated', this.getAlertStats());
  }
  
  /**
   * Limpiar alertas antiguas
   */
  cleanupOldAlerts() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    const alertsToRemove = [];
    
    for (const [alertId, alert] of this.alerts) {
      if (alert.resolved && new Date(alert.resolvedAt).getTime() < cutoffTime) {
        alertsToRemove.push(alertId);
      }
    }
    
    // Remover alertas antiguas
    for (const alertId of alertsToRemove) {
      const alert = this.alerts.get(alertId);
      
      // Remover de índices
      this.alertsByType.get(alert.type)?.delete(alertId);
      this.alertsBySource.get(alert.source)?.delete(alertId);
      this.alertsBySeverity.get(alert.severity)?.delete(alertId);
      this.alertsByStatus.get(alert.status)?.delete(alertId);
      
      // Remover alerta
      this.alerts.delete(alertId);
    }
    
    // Limpiar grupos vacíos
    for (const [groupKey, group] of this.alertGroups) {
      const activeAlertsInGroup = group.alerts.filter(alertId => this.alerts.has(alertId));
      
      if (activeAlertsInGroup.length === 0) {
        this.alertGroups.delete(groupKey);
      } else {
        group.alerts = activeAlertsInGroup;
      }
    }
    
    // Limpiar cache de cooldown
    const now = Date.now();
    for (const [key, timestamp] of this.cooldownCache) {
      if (now - timestamp > this.config.cooldown.defaultPeriod * 2) {
        this.cooldownCache.delete(key);
      }
    }
    
    if (alertsToRemove.length > 0) {
      logger.debug(`Limpiadas ${alertsToRemove.length} alertas antiguas`);
    }
  }
  
  /**
   * Exportar alertas
   */
  exportAlerts(format = 'json', filters = {}) {
    const alerts = this.getAlerts(filters);
    
    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(alerts, null, 2);
    case 'csv':
      return this.convertAlertsToCSV(alerts);
    default:
      throw new Error(`Formato de exportación no soportado: ${format}`);
    }
  }
  
  /**
   * Convertir alertas a CSV
   */
  convertAlertsToCSV(alerts) {
    const lines = [];
    lines.push('id,type,severity,source,message,status,acknowledged,resolved,timestamp,created');
    
    for (const alert of alerts) {
      lines.push([
        alert.id,
        alert.type,
        alert.severity,
        alert.source,
        `"${alert.message.replace(/"/g, '""')}"`,
        alert.status,
        alert.acknowledged,
        alert.resolved,
        alert.timestamp,
        alert.created
      ].join(','));
    }
    
    return lines.join('\n');
  }
  
  /**
   * Destruir el gestor
   */
  async destroy() {
    logger.info('Destruyendo AlertManager...');
    
    try {
      // Detener si está ejecutándose
      if (this.isRunning) {
        await this.stop();
      }
      
      // Limpiar datos
      this.alerts.clear();
      this.alertHistory = [];
      this.alertGroups.clear();
      this.cooldownCache.clear();
      this.escalationTimers.clear();
      this.escalationHistory = [];
      this.notificationChannels.clear();
      
      // Limpiar índices
      this.alertsByType.clear();
      this.alertsBySource.clear();
      this.alertsBySeverity.clear();
      this.alertsByStatus.clear();
      
      this.isInitialized = false;
      
      // Remover listeners
      this.removeAllListeners();
      
      logger.info('AlertManager destruido');
      
    } catch (error) {
      logger.error('Error destruyendo AlertManager:', error);
      throw error;
    }
  }
}

export default AlertManager;
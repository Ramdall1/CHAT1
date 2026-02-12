/**
 * Dashboard Principal - Sistema de Visualización y Monitoreo
 * 
 * Dashboard en tiempo real para monitorear el estado del sistema event-driven,
 * métricas de rendimiento, eventos, agentes y adaptadores de comunicación
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../../services/core/core/logger.js';
import { EventEmitter } from 'events';
import { MetricsCollector } from './MetricsCollector.js';
import { EventMonitor } from './EventMonitor.js';
import { SystemHealthMonitor } from './SystemHealthMonitor.js';
import { PerformanceAnalyzer } from './PerformanceAnalyzer.js';
import { AlertManager } from './AlertManager.js';

const logger = createLogger('DASHBOARD');

export class Dashboard extends EventEmitter {
  constructor(eventBus, options = {}) {
    super();
    
    this.eventBus = eventBus;
    this.isInitialized = false;
    this.isStarted = false;
    
    // Configuración del dashboard
    this.config = {
      // Configuración de actualización
      updateInterval: options.updateInterval || 5000, // 5 segundos
      metricsRetention: options.metricsRetention || 3600000, // 1 hora
      
      // Configuración de visualización
      maxDataPoints: options.maxDataPoints || 100,
      refreshRate: options.refreshRate || 1000, // 1 segundo
      
      // Configuración de widgets
      enabledWidgets: options.enabledWidgets || [
        'system-overview',
        'event-stream',
        'metrics-charts',
        'agent-status',
        'adapter-status',
        'performance-stats',
        'alerts',
        'logs'
      ],
      
      // Configuración de alertas
      enableAlerts: options.enableAlerts !== false,
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        errorRate: 5,
        responseTime: 2000,
        eventQueueSize: 1000
      },
      
      // Configuración de exportación
      enableExport: options.enableExport !== false,
      exportFormats: ['json', 'csv', 'pdf'],
      
      ...options
    };
    
    // Componentes del dashboard
    this.components = {
      metricsCollector: null,
      eventMonitor: null,
      healthMonitor: null,
      performanceAnalyzer: null,
      alertManager: null
    };
    
    // Estado del dashboard
    this.state = {
      startTime: null,
      lastUpdate: null,
      totalEvents: 0,
      totalErrors: 0,
      activeConnections: 0,
      systemStatus: 'unknown'
    };
    
    // Datos en tiempo real
    this.realTimeData = {
      events: [],
      metrics: new Map(),
      alerts: [],
      logs: [],
      performance: {
        cpu: [],
        memory: [],
        network: [],
        disk: []
      },
      agents: new Map(),
      adapters: new Map()
    };
    
    // Widgets activos
    this.widgets = new Map();
    
    // Timers
    this.updateTimer = null;
    this.cleanupTimer = null;
    
    // Callbacks de actualización
    this.updateCallbacks = new Set();
    
    logger.info('Dashboard inicializado', {
      updateInterval: this.config.updateInterval,
      enabledWidgets: this.config.enabledWidgets
    });
  }
  
  /**
   * Inicializar el dashboard
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Dashboard ya está inicializado');
      return;
    }
    
    try {
      logger.info('Inicializando Dashboard...');
      
      // Inicializar componentes
      await this.initializeComponents();
      
      // Configurar integración con EventBus
      this.setupEventBusIntegration();
      
      // Inicializar widgets
      this.initializeWidgets();
      
      // Configurar timers
      this.setupTimers();
      
      this.isInitialized = true;
      this.state.startTime = new Date().toISOString();
      
      logger.info('Dashboard inicializado correctamente');
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Error inicializando Dashboard:', error);
      throw error;
    }
  }
  
  /**
   * Inicializar componentes del dashboard
   */
  async initializeComponents() {
    // Inicializar MetricsCollector
    this.components.metricsCollector = new MetricsCollector({
      retentionPeriod: this.config.metricsRetention,
      maxDataPoints: this.config.maxDataPoints
    });
    
    // Inicializar EventMonitor
    this.components.eventMonitor = new EventMonitor(this.eventBus, {
      maxEvents: this.config.maxDataPoints,
      enableFiltering: true
    });
    
    // Inicializar SystemHealthMonitor
    this.components.healthMonitor = new SystemHealthMonitor({
      checkInterval: 30000, // 30 segundos
      thresholds: this.config.alertThresholds
    });
    
    // Inicializar PerformanceAnalyzer
    this.components.performanceAnalyzer = new PerformanceAnalyzer({
      analysisInterval: 60000, // 1 minuto
      retentionPeriod: this.config.metricsRetention
    });
    
    // Inicializar AlertManager
    if (this.config.enableAlerts) {
      this.components.alertManager = new AlertManager({
        thresholds: this.config.alertThresholds,
        enableNotifications: true
      });
    }
    
    // Configurar eventos de componentes
    this.setupComponentEvents();
    
    // Inicializar componentes
    for (const [name, component] of Object.entries(this.components)) {
      if (component && typeof component.initialize === 'function') {
        await component.initialize();
        logger.info(`Componente ${name} inicializado`);
      }
    }
  }
  
  /**
   * Configurar eventos de componentes
   */
  setupComponentEvents() {
    // Eventos del MetricsCollector
    if (this.components.metricsCollector) {
      this.components.metricsCollector.on('metrics:updated', (metrics) => {
        this.handleMetricsUpdate(metrics);
      });
    }
    
    // Eventos del EventMonitor
    if (this.components.eventMonitor) {
      this.components.eventMonitor.on('event:received', (event) => {
        this.handleEventReceived(event);
      });
      
      this.components.eventMonitor.on('event:pattern', (pattern) => {
        this.handleEventPattern(pattern);
      });
    }
    
    // Eventos del SystemHealthMonitor
    if (this.components.healthMonitor) {
      this.components.healthMonitor.on('health:status', (status) => {
        this.handleHealthStatus(status);
      });
      
      this.components.healthMonitor.on('health:alert', (alert) => {
        this.handleHealthAlert(alert);
      });
    }
    
    // Eventos del PerformanceAnalyzer
    if (this.components.performanceAnalyzer) {
      this.components.performanceAnalyzer.on('performance:analysis', (analysis) => {
        this.handlePerformanceAnalysis(analysis);
      });
      
      this.components.performanceAnalyzer.on('performance:anomaly', (anomaly) => {
        this.handlePerformanceAnomaly(anomaly);
      });
    }
    
    // Eventos del AlertManager
    if (this.components.alertManager) {
      this.components.alertManager.on('alert:triggered', (alert) => {
        this.handleAlertTriggered(alert);
      });
      
      this.components.alertManager.on('alert:resolved', (alert) => {
        this.handleAlertResolved(alert);
      });
    }
  }
  
  /**
   * Configurar integración con EventBus
   */
  setupEventBusIntegration() {
    if (!this.eventBus) return;
    
    // Escuchar todos los eventos para estadísticas
    this.eventBus.on('*', (eventType, eventData) => {
      this.state.totalEvents++;
      
      // Actualizar datos en tiempo real
      this.updateRealTimeData('event', {
        eventType,
        timestamp: new Date().toISOString(),
        ...eventData
      });
    });
    
    // Escuchar eventos específicos del sistema
    this.eventBus.on('system:error', (error) => {
      this.state.totalErrors++;
      this.handleSystemError(error);
    });
    
    this.eventBus.on('agent:*', (eventType, data) => {
      this.handleAgentEvent(eventType, data);
    });
    
    this.eventBus.on('adapter:*', (eventType, data) => {
      this.handleAdapterEvent(eventType, data);
    });
  }
  
  /**
   * Inicializar widgets
   */
  initializeWidgets() {
    for (const widgetType of this.config.enabledWidgets) {
      try {
        const widget = this.createWidget(widgetType);
        this.widgets.set(widgetType, widget);
        logger.info(`Widget ${widgetType} inicializado`);
      } catch (error) {
        logger.error(`Error inicializando widget ${widgetType}:`, error);
      }
    }
  }
  
  /**
   * Crear widget específico
   */
  createWidget(type) {
    const baseWidget = {
      type,
      id: `widget_${type}_${Date.now()}`,
      title: this.getWidgetTitle(type),
      data: null,
      lastUpdate: null,
      isVisible: true,
      config: {}
    };
    
    switch (type) {
    case 'system-overview':
      return {
        ...baseWidget,
        getData: () => this.getSystemOverviewData(),
        config: {
          refreshInterval: 5000,
          showUptime: true,
          showConnections: true
        }
      };
        
    case 'event-stream':
      return {
        ...baseWidget,
        getData: () => this.getEventStreamData(),
        config: {
          maxEvents: 50,
          enableFiltering: true,
          autoScroll: true
        }
      };
        
    case 'metrics-charts':
      return {
        ...baseWidget,
        getData: () => this.getMetricsChartsData(),
        config: {
          chartTypes: ['line', 'bar', 'pie'],
          timeRange: '1h',
          autoRefresh: true
        }
      };
        
    case 'agent-status':
      return {
        ...baseWidget,
        getData: () => this.getAgentStatusData(),
        config: {
          showInactive: false,
          groupByType: true
        }
      };
        
    case 'adapter-status':
      return {
        ...baseWidget,
        getData: () => this.getAdapterStatusData(),
        config: {
          showMetrics: true,
          showConnections: true
        }
      };
        
    case 'performance-stats':
      return {
        ...baseWidget,
        getData: () => this.getPerformanceStatsData(),
        config: {
          showCPU: true,
          showMemory: true,
          showNetwork: true
        }
      };
        
    case 'alerts':
      return {
        ...baseWidget,
        getData: () => this.getAlertsData(),
        config: {
          maxAlerts: 20,
          showResolved: false,
          autoAcknowledge: false
        }
      };
        
    case 'logs':
      return {
        ...baseWidget,
        getData: () => this.getLogsData(),
        config: {
          maxLogs: 100,
          logLevels: ['error', 'warn', 'info'],
          enableSearch: true
        }
      };
        
    default:
      throw new Error(`Tipo de widget desconocido: ${type}`);
    }
  }
  
  /**
   * Obtener título del widget
   */
  getWidgetTitle(type) {
    const titles = {
      'system-overview': 'Resumen del Sistema',
      'event-stream': 'Flujo de Eventos',
      'metrics-charts': 'Gráficos de Métricas',
      'agent-status': 'Estado de Agentes',
      'adapter-status': 'Estado de Adaptadores',
      'performance-stats': 'Estadísticas de Rendimiento',
      'alerts': 'Alertas',
      'logs': 'Registros'
    };
    
    return titles[type] || type;
  }
  
  /**
   * Configurar timers
   */
  setupTimers() {
    // Timer de actualización principal
    this.updateTimer = setInterval(() => {
      this.updateDashboard();
    }, this.config.updateInterval);
    
    // Timer de limpieza de datos antiguos
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, 300000); // 5 minutos
  }
  
  /**
   * Iniciar el dashboard
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isStarted) {
      logger.warn('Dashboard ya está iniciado');
      return;
    }
    
    try {
      logger.info('Iniciando Dashboard...');
      
      // Iniciar componentes
      for (const [name, component] of Object.entries(this.components)) {
        if (component && typeof component.start === 'function') {
          await component.start();
          logger.info(`Componente ${name} iniciado`);
        }
      }
      
      // Realizar primera actualización
      await this.updateDashboard();
      
      this.isStarted = true;
      this.state.systemStatus = 'running';
      
      logger.info('Dashboard iniciado correctamente');
      this.emit('started');
      
    } catch (error) {
      logger.error('Error iniciando Dashboard:', error);
      throw error;
    }
  }
  
  /**
   * Detener el dashboard
   */
  async stop() {
    if (!this.isStarted) {
      logger.warn('Dashboard no está iniciado');
      return;
    }
    
    try {
      logger.info('Deteniendo Dashboard...');
      
      // Detener timers
      if (this.updateTimer) {
        clearInterval(this.updateTimer);
        this.updateTimer = null;
      }
      
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      
      // Detener componentes
      for (const [name, component] of Object.entries(this.components)) {
        if (component && typeof component.stop === 'function') {
          await component.stop();
          logger.info(`Componente ${name} detenido`);
        }
      }
      
      this.isStarted = false;
      this.state.systemStatus = 'stopped';
      
      logger.info('Dashboard detenido');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Error deteniendo Dashboard:', error);
      throw error;
    }
  }
  
  /**
   * Actualizar dashboard
   */
  async updateDashboard() {
    try {
      this.state.lastUpdate = new Date().toISOString();
      
      // Actualizar widgets
      for (const [type, widget] of this.widgets) {
        try {
          widget.data = await widget.getData();
          widget.lastUpdate = this.state.lastUpdate;
        } catch (error) {
          logger.error(`Error actualizando widget ${type}:`, error);
        }
      }
      
      // Notificar callbacks de actualización
      for (const callback of this.updateCallbacks) {
        try {
          callback(this.getDashboardData());
        } catch (error) {
          logger.error('Error en callback de actualización:', error);
        }
      }
      
      this.emit('updated', this.getDashboardData());
      
    } catch (error) {
      logger.error('Error actualizando dashboard:', error);
    }
  }
  
  /**
   * Actualizar datos en tiempo real
   */
  updateRealTimeData(type, data) {
    const timestamp = new Date().toISOString();
    
    switch (type) {
    case 'event':
      this.realTimeData.events.unshift({
        ...data,
        timestamp
      });
        
      // Mantener solo los últimos eventos
      if (this.realTimeData.events.length > this.config.maxDataPoints) {
        this.realTimeData.events = this.realTimeData.events.slice(0, this.config.maxDataPoints);
      }
      break;
        
    case 'metric':
      const metricKey = data.name || 'unknown';
      if (!this.realTimeData.metrics.has(metricKey)) {
        this.realTimeData.metrics.set(metricKey, []);
      }
        
      const metricData = this.realTimeData.metrics.get(metricKey);
      metricData.unshift({
        value: data.value,
        timestamp
      });
        
      // Mantener solo los últimos puntos de datos
      if (metricData.length > this.config.maxDataPoints) {
        this.realTimeData.metrics.set(metricKey, metricData.slice(0, this.config.maxDataPoints));
      }
      break;
        
    case 'alert':
      this.realTimeData.alerts.unshift({
        ...data,
        timestamp
      });
        
      // Mantener solo las últimas alertas
      if (this.realTimeData.alerts.length > 100) {
        this.realTimeData.alerts = this.realTimeData.alerts.slice(0, 100);
      }
      break;
        
    case 'log':
      this.realTimeData.logs.unshift({
        ...data,
        timestamp
      });
        
      // Mantener solo los últimos logs
      if (this.realTimeData.logs.length > 500) {
        this.realTimeData.logs = this.realTimeData.logs.slice(0, 500);
      }
      break;
    }
    
    // Emitir evento de actualización en tiempo real
    this.emit('realtime:update', { type, data, timestamp });
  }
  
  /**
   * Manejar actualización de métricas
   */
  handleMetricsUpdate(metrics) {
    for (const [name, value] of Object.entries(metrics)) {
      this.updateRealTimeData('metric', { name, value });
    }
  }
  
  /**
   * Manejar evento recibido
   */
  handleEventReceived(event) {
    this.updateRealTimeData('event', event);
  }
  
  /**
   * Manejar patrón de evento
   */
  handleEventPattern(pattern) {
    logger.info('Patrón de evento detectado:', pattern);
    this.emit('pattern:detected', pattern);
  }
  
  /**
   * Manejar estado de salud
   */
  handleHealthStatus(status) {
    this.state.systemStatus = status.overall;
    this.emit('health:status', status);
  }
  
  /**
   * Manejar alerta de salud
   */
  handleHealthAlert(alert) {
    this.updateRealTimeData('alert', {
      type: 'health',
      severity: alert.severity,
      message: alert.message,
      source: 'health-monitor'
    });
  }
  
  /**
   * Manejar análisis de rendimiento
   */
  handlePerformanceAnalysis(analysis) {
    // Actualizar datos de rendimiento
    for (const [metric, values] of Object.entries(analysis)) {
      if (this.realTimeData.performance[metric]) {
        this.realTimeData.performance[metric] = values.slice(-this.config.maxDataPoints);
      }
    }
    
    this.emit('performance:analysis', analysis);
  }
  
  /**
   * Manejar anomalía de rendimiento
   */
  handlePerformanceAnomaly(anomaly) {
    this.updateRealTimeData('alert', {
      type: 'performance',
      severity: 'warning',
      message: `Anomalía detectada en ${anomaly.metric}: ${anomaly.description}`,
      source: 'performance-analyzer'
    });
  }
  
  /**
   * Manejar alerta activada
   */
  handleAlertTriggered(alert) {
    this.updateRealTimeData('alert', alert);
    this.emit('alert:triggered', alert);
  }
  
  /**
   * Manejar alerta resuelta
   */
  handleAlertResolved(alert) {
    this.emit('alert:resolved', alert);
  }
  
  /**
   * Manejar error del sistema
   */
  handleSystemError(error) {
    this.updateRealTimeData('alert', {
      type: 'error',
      severity: 'error',
      message: error.message || 'Error del sistema',
      source: 'system'
    });
    
    this.updateRealTimeData('log', {
      level: 'error',
      message: error.message,
      stack: error.stack,
      source: 'system'
    });
  }
  
  /**
   * Manejar evento de agente
   */
  handleAgentEvent(eventType, data) {
    const agentId = data.agentId || data.id || 'unknown';
    
    if (!this.realTimeData.agents.has(agentId)) {
      this.realTimeData.agents.set(agentId, {
        id: agentId,
        type: data.type || 'unknown',
        status: 'unknown',
        lastSeen: null,
        events: 0,
        errors: 0
      });
    }
    
    const agent = this.realTimeData.agents.get(agentId);
    agent.lastSeen = new Date().toISOString();
    agent.events++;
    
    if (eventType.includes('error')) {
      agent.errors++;
    }
    
    if (eventType.includes('started')) {
      agent.status = 'running';
    } else if (eventType.includes('stopped')) {
      agent.status = 'stopped';
    }
  }
  
  /**
   * Manejar evento de adaptador
   */
  handleAdapterEvent(eventType, data) {
    const adapterId = data.adapterId || data.name || 'unknown';
    
    if (!this.realTimeData.adapters.has(adapterId)) {
      this.realTimeData.adapters.set(adapterId, {
        id: adapterId,
        type: data.type || 'unknown',
        status: 'unknown',
        lastSeen: null,
        connections: 0,
        messages: 0,
        errors: 0
      });
    }
    
    const adapter = this.realTimeData.adapters.get(adapterId);
    adapter.lastSeen = new Date().toISOString();
    
    if (eventType.includes('connected')) {
      adapter.status = 'connected';
      adapter.connections++;
    } else if (eventType.includes('disconnected')) {
      adapter.status = 'disconnected';
    } else if (eventType.includes('message')) {
      adapter.messages++;
    } else if (eventType.includes('error')) {
      adapter.errors++;
    }
  }
  
  /**
   * Obtener datos del resumen del sistema
   */
  getSystemOverviewData() {
    const uptime = this.state.startTime ? 
      Date.now() - new Date(this.state.startTime).getTime() : 0;
    
    return {
      status: this.state.systemStatus,
      uptime: uptime,
      totalEvents: this.state.totalEvents,
      totalErrors: this.state.totalErrors,
      activeConnections: this.state.activeConnections,
      agentsCount: this.realTimeData.agents.size,
      adaptersCount: this.realTimeData.adapters.size,
      lastUpdate: this.state.lastUpdate
    };
  }
  
  /**
   * Obtener datos del flujo de eventos
   */
  getEventStreamData() {
    return {
      events: this.realTimeData.events.slice(0, 50),
      totalEvents: this.state.totalEvents,
      eventsPerSecond: this.calculateEventsPerSecond()
    };
  }
  
  /**
   * Obtener datos de gráficos de métricas
   */
  getMetricsChartsData() {
    const charts = {};
    
    for (const [metricName, dataPoints] of this.realTimeData.metrics) {
      charts[metricName] = {
        name: metricName,
        data: dataPoints.map(point => ({
          x: point.timestamp,
          y: point.value
        })),
        type: 'line'
      };
    }
    
    return charts;
  }
  
  /**
   * Obtener datos del estado de agentes
   */
  getAgentStatusData() {
    return {
      agents: Array.from(this.realTimeData.agents.values()),
      summary: {
        total: this.realTimeData.agents.size,
        running: Array.from(this.realTimeData.agents.values()).filter(a => a.status === 'running').length,
        stopped: Array.from(this.realTimeData.agents.values()).filter(a => a.status === 'stopped').length
      }
    };
  }
  
  /**
   * Obtener datos del estado de adaptadores
   */
  getAdapterStatusData() {
    return {
      adapters: Array.from(this.realTimeData.adapters.values()),
      summary: {
        total: this.realTimeData.adapters.size,
        connected: Array.from(this.realTimeData.adapters.values()).filter(a => a.status === 'connected').length,
        disconnected: Array.from(this.realTimeData.adapters.values()).filter(a => a.status === 'disconnected').length
      }
    };
  }
  
  /**
   * Obtener datos de estadísticas de rendimiento
   */
  getPerformanceStatsData() {
    return {
      cpu: this.realTimeData.performance.cpu.slice(-20),
      memory: this.realTimeData.performance.memory.slice(-20),
      network: this.realTimeData.performance.network.slice(-20),
      disk: this.realTimeData.performance.disk.slice(-20)
    };
  }
  
  /**
   * Obtener datos de alertas
   */
  getAlertsData() {
    return {
      alerts: this.realTimeData.alerts.slice(0, 20),
      summary: {
        total: this.realTimeData.alerts.length,
        critical: this.realTimeData.alerts.filter(a => a.severity === 'critical').length,
        warning: this.realTimeData.alerts.filter(a => a.severity === 'warning').length,
        info: this.realTimeData.alerts.filter(a => a.severity === 'info').length
      }
    };
  }
  
  /**
   * Obtener datos de logs
   */
  getLogsData() {
    return {
      logs: this.realTimeData.logs.slice(0, 100),
      summary: {
        total: this.realTimeData.logs.length,
        errors: this.realTimeData.logs.filter(l => l.level === 'error').length,
        warnings: this.realTimeData.logs.filter(l => l.level === 'warn').length,
        info: this.realTimeData.logs.filter(l => l.level === 'info').length
      }
    };
  }
  
  /**
   * Calcular eventos por segundo
   */
  calculateEventsPerSecond() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    const recentEvents = this.realTimeData.events.filter(event => 
      new Date(event.timestamp).getTime() > oneSecondAgo
    );
    
    return recentEvents.length;
  }
  
  /**
   * Limpiar datos antiguos
   */
  cleanupOldData() {
    const cutoffTime = Date.now() - this.config.metricsRetention;
    
    // Limpiar eventos antiguos
    this.realTimeData.events = this.realTimeData.events.filter(event =>
      new Date(event.timestamp).getTime() > cutoffTime
    );
    
    // Limpiar métricas antiguas
    for (const [metricName, dataPoints] of this.realTimeData.metrics) {
      const filteredData = dataPoints.filter(point =>
        new Date(point.timestamp).getTime() > cutoffTime
      );
      this.realTimeData.metrics.set(metricName, filteredData);
    }
    
    // Limpiar alertas antiguas
    this.realTimeData.alerts = this.realTimeData.alerts.filter(alert =>
      new Date(alert.timestamp).getTime() > cutoffTime
    );
    
    // Limpiar logs antiguos
    this.realTimeData.logs = this.realTimeData.logs.filter(log =>
      new Date(log.timestamp).getTime() > cutoffTime
    );
    
    logger.debug('Datos antiguos limpiados');
  }
  
  /**
   * Registrar callback de actualización
   */
  onUpdate(callback) {
    this.updateCallbacks.add(callback);
  }
  
  /**
   * Desregistrar callback de actualización
   */
  offUpdate(callback) {
    this.updateCallbacks.delete(callback);
  }
  
  /**
   * Obtener datos completos del dashboard
   */
  getDashboardData() {
    const widgets = {};
    
    for (const [type, widget] of this.widgets) {
      widgets[type] = {
        id: widget.id,
        title: widget.title,
        type: widget.type,
        data: widget.data,
        lastUpdate: widget.lastUpdate,
        isVisible: widget.isVisible,
        config: widget.config
      };
    }
    
    return {
      state: this.state,
      widgets,
      realTimeData: {
        events: this.realTimeData.events.slice(0, 10),
        alerts: this.realTimeData.alerts.slice(0, 10),
        agents: Array.from(this.realTimeData.agents.values()),
        adapters: Array.from(this.realTimeData.adapters.values())
      },
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Exportar datos del dashboard
   */
  async exportData(format = 'json', options = {}) {
    const data = this.getDashboardData();
    
    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'csv':
      return this.convertToCSV(data);
    case 'pdf':
      return this.generatePDF(data);
    default:
      throw new Error(`Formato de exportación no soportado: ${format}`);
    }
  }
  
  /**
   * Convertir datos a CSV
   */
  convertToCSV(data) {
    // Implementación básica de conversión a CSV
    const lines = [];
    
    // Header
    lines.push('timestamp,type,value,source');
    
    // Events
    for (const event of data.realTimeData.events) {
      lines.push(`${event.timestamp},event,${event.eventType},${event.source || 'unknown'}`);
    }
    
    // Alerts
    for (const alert of data.realTimeData.alerts) {
      lines.push(`${alert.timestamp},alert,${alert.severity},${alert.source}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Generar PDF
   */
  async generatePDF(data) {
    // Placeholder para generación de PDF
    // En producción usar librerías como puppeteer o jsPDF
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Obtener estado del dashboard
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isStarted: this.isStarted,
      ...this.state
    };
  }
  
  /**
   * Destruir el dashboard
   */
  async destroy() {
    logger.info('Destruyendo Dashboard...');
    
    try {
      // Detener si está iniciado
      if (this.isStarted) {
        await this.stop();
      }
      
      // Destruir componentes
      for (const [name, component] of Object.entries(this.components)) {
        if (component && typeof component.destroy === 'function') {
          await component.destroy();
        }
      }
      
      // Limpiar estado
      this.widgets.clear();
      this.updateCallbacks.clear();
      this.realTimeData.events = [];
      this.realTimeData.alerts = [];
      this.realTimeData.logs = [];
      this.realTimeData.metrics.clear();
      this.realTimeData.agents.clear();
      this.realTimeData.adapters.clear();
      
      this.isInitialized = false;
      
      // Remover listeners
      this.removeAllListeners();
      
      logger.info('Dashboard destruido');
      
    } catch (error) {
      logger.error('Error destruyendo Dashboard:', error);
      throw error;
    }
  }
}

export default Dashboard;
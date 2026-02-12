/**
 * Dashboard Module - Índice Principal
 * 
 * Centraliza todas las exportaciones del sistema de dashboard
 * y visualización en tiempo real
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

// Componentes principales del dashboard
export { Dashboard } from './Dashboard.js';
export { MetricsCollector } from './MetricsCollector.js';
export { EventMonitor } from './EventMonitor.js';
export { SystemHealthMonitor } from './SystemHealthMonitor.js';
export { PerformanceAnalyzer } from './PerformanceAnalyzer.js';
export { AlertManager } from './AlertManager.js';

// Funciones de fábrica para crear instancias del dashboard
export const createDashboard = (options = {}) => {
  return new Dashboard(options);
};

export const createMetricsCollector = (options = {}) => {
  return new MetricsCollector(options);
};

export const createEventMonitor = (options = {}) => {
  return new EventMonitor(options);
};

export const createSystemHealthMonitor = (options = {}) => {
  return new SystemHealthMonitor(options);
};

export const createPerformanceAnalyzer = (options = {}) => {
  return new PerformanceAnalyzer(options);
};

export const createAlertManager = (options = {}) => {
  return new AlertManager(options);
};

// Configuración por defecto del dashboard
export const defaultDashboardConfig = {
  // Configuración general
  enabled: true,
  autoStart: true,
  updateInterval: 1000, // 1 segundo
  
  // Configuración de componentes
  components: {
    metricsCollector: {
      enabled: true,
      interval: 5000, // 5 segundos
      retention: 3600000 // 1 hora
    },
    eventMonitor: {
      enabled: true,
      maxEvents: 1000,
      retention: 86400000 // 24 horas
    },
    systemHealthMonitor: {
      enabled: true,
      interval: 10000, // 10 segundos
      thresholds: {
        cpu: 80,
        memory: 85,
        disk: 90
      }
    },
    performanceAnalyzer: {
      enabled: true,
      interval: 30000, // 30 segundos
      analysisWindow: 300000 // 5 minutos
    },
    alertManager: {
      enabled: true,
      maxAlerts: 1000,
      retentionPeriod: 86400000 // 24 horas
    }
  },
  
  // Configuración de widgets
  widgets: {
    systemSummary: { enabled: true, position: { x: 0, y: 0, w: 6, h: 4 } },
    eventFlow: { enabled: true, position: { x: 6, y: 0, w: 6, h: 4 } },
    metricsChart: { enabled: true, position: { x: 0, y: 4, w: 8, h: 6 } },
    agentStatus: { enabled: true, position: { x: 8, y: 4, w: 4, h: 3 } },
    adapterStatus: { enabled: true, position: { x: 8, y: 7, w: 4, h: 3 } },
    performanceStats: { enabled: true, position: { x: 0, y: 10, w: 6, h: 4 } },
    alerts: { enabled: true, position: { x: 6, y: 10, w: 6, h: 4 } },
    logs: { enabled: true, position: { x: 0, y: 14, w: 12, h: 4 } }
  },
  
  // Configuración de exportación
  export: {
    enabled: true,
    formats: ['json', 'csv', 'pdf'],
    autoExport: false,
    exportInterval: 3600000 // 1 hora
  }
};

// Utilidades del dashboard
export const DashboardUtils = {
  /**
   * Crear configuración completa del dashboard
   */
  createConfig: (customConfig = {}) => {
    return {
      ...defaultDashboardConfig,
      ...customConfig,
      components: {
        ...defaultDashboardConfig.components,
        ...customConfig.components
      },
      widgets: {
        ...defaultDashboardConfig.widgets,
        ...customConfig.widgets
      },
      export: {
        ...defaultDashboardConfig.export,
        ...customConfig.export
      }
    };
  },
  
  /**
   * Validar configuración del dashboard
   */
  validateConfig: (config) => {
    const errors = [];
    
    if (!config || typeof config !== 'object') {
      errors.push('La configuración debe ser un objeto');
      return errors;
    }
    
    // Validar intervalos
    if (config.updateInterval && config.updateInterval < 100) {
      errors.push('El intervalo de actualización debe ser al menos 100ms');
    }
    
    // Validar componentes
    if (config.components) {
      for (const [name, componentConfig] of Object.entries(config.components)) {
        if (componentConfig.interval && componentConfig.interval < 1000) {
          errors.push(`El intervalo del componente ${name} debe ser al menos 1000ms`);
        }
      }
    }
    
    return errors;
  },
  
  /**
   * Crear dashboard completo con todos los componentes
   */
  createFullDashboard: async(config = {}) => {
    const fullConfig = DashboardUtils.createConfig(config);
    
    // Validar configuración
    const errors = DashboardUtils.validateConfig(fullConfig);
    if (errors.length > 0) {
      throw new Error(`Errores de configuración: ${errors.join(', ')}`);
    }
    
    // Crear dashboard principal
    const dashboard = new Dashboard(fullConfig);
    
    // Inicializar si está configurado para auto-inicio
    if (fullConfig.autoStart) {
      await dashboard.initialize();
      await dashboard.start();
    }
    
    return dashboard;
  },
  
  /**
   * Obtener métricas de rendimiento del dashboard
   */
  getDashboardMetrics: (dashboard) => {
    if (!dashboard || !dashboard.isInitialized) {
      return null;
    }
    
    return {
      uptime: Date.now() - new Date(dashboard.startTime).getTime(),
      isRunning: dashboard.isRunning,
      componentsStatus: {
        metricsCollector: dashboard.metricsCollector?.isRunning || false,
        eventMonitor: dashboard.eventMonitor?.isRunning || false,
        systemHealthMonitor: dashboard.systemHealthMonitor?.isRunning || false,
        performanceAnalyzer: dashboard.performanceAnalyzer?.isRunning || false,
        alertManager: dashboard.alertManager?.isRunning || false
      },
      widgetsCount: Object.keys(dashboard.widgets || {}).length,
      lastUpdate: dashboard.lastUpdate,
      updateCount: dashboard.updateCount || 0
    };
  },
  
  /**
   * Formatear datos para visualización
   */
  formatDataForVisualization: (data, type = 'chart') => {
    if (!data || !Array.isArray(data)) {
      return [];
    }
    
    switch (type) {
    case 'chart':
      return data.map(item => ({
        x: item.timestamp || item.time || new Date().toISOString(),
        y: item.value || item.count || 0,
        label: item.label || item.name || 'Unknown'
      }));
      
    case 'table':
      return data.map(item => ({
        ...item,
        timestamp: new Date(item.timestamp || Date.now()).toLocaleString()
      }));
      
    case 'gauge':
      return {
        value: data[data.length - 1]?.value || 0,
        min: Math.min(...data.map(d => d.value || 0)),
        max: Math.max(...data.map(d => d.value || 0)),
        average: data.reduce((sum, d) => sum + (d.value || 0), 0) / data.length
      };
      
    default:
      return data;
    }
  },
  
  /**
   * Generar colores para gráficos
   */
  generateColors: (count) => {
    const colors = [
      '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
      '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
    ];
    
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    
    return result;
  },
  
  /**
   * Calcular estadísticas de un conjunto de datos
   */
  calculateStats: (data, valueField = 'value') => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0,
        median: 0,
        stdDev: 0
      };
    }
    
    const values = data.map(d => d[valueField] || 0).filter(v => typeof v === 'number');
    
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0,
        median: 0,
        stdDev: 0
      };
    }
    
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Calcular mediana
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    // Calcular desviación estándar
    const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      count: values.length,
      sum,
      average,
      min,
      max,
      median,
      stdDev
    };
  }
};

// Constantes del dashboard
export const DASHBOARD_EVENTS = {
  INITIALIZED: 'dashboard:initialized',
  STARTED: 'dashboard:started',
  STOPPED: 'dashboard:stopped',
  UPDATED: 'dashboard:updated',
  ERROR: 'dashboard:error',
  WIDGET_ADDED: 'dashboard:widget:added',
  WIDGET_REMOVED: 'dashboard:widget:removed',
  WIDGET_UPDATED: 'dashboard:widget:updated',
  DATA_EXPORTED: 'dashboard:data:exported',
  ALERT_CREATED: 'dashboard:alert:created',
  ALERT_RESOLVED: 'dashboard:alert:resolved'
};

export const WIDGET_TYPES = {
  CHART: 'chart',
  TABLE: 'table',
  GAUGE: 'gauge',
  COUNTER: 'counter',
  STATUS: 'status',
  LOG: 'log',
  ALERT: 'alert',
  CUSTOM: 'custom'
};

export const CHART_TYPES = {
  LINE: 'line',
  BAR: 'bar',
  PIE: 'pie',
  AREA: 'area',
  SCATTER: 'scatter',
  HISTOGRAM: 'histogram'
};

export const ALERT_SEVERITIES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// Exportación por defecto
export default {
  Dashboard,
  MetricsCollector,
  EventMonitor,
  SystemHealthMonitor,
  PerformanceAnalyzer,
  AlertManager,
  createDashboard,
  createMetricsCollector,
  createEventMonitor,
  createSystemHealthMonitor,
  createPerformanceAnalyzer,
  createAlertManager,
  defaultDashboardConfig,
  DashboardUtils,
  DASHBOARD_EVENTS,
  WIDGET_TYPES,
  CHART_TYPES,
  ALERT_SEVERITIES
};
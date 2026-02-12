import EventTypes from './EventTypes.js';
import fs from 'fs/promises';
import path from 'path';
import { SanitizationUtils } from './sanitization.js';
import { createLogger } from './logger.js';

/**
 * Monitor visual y sistema de trazabilidad en tiempo real
 * Proporciona observabilidad completa del flujo de eventos
 */
class Monitor {
  constructor(eventBus, eventStore) {
    this.eventBus = eventBus;
    this.eventStore = eventStore;
    this.logger = createLogger('MONITOR');
        
    this.isActive = false;
    this.eventTrace = [];
    this.liveConnections = new Set();
    this.eventStats = new Map();
    this.moduleStats = new Map();
    this.performanceMetrics = new Map();
        
    this.config = {
      maxTraceSize: 10000,
      statsInterval: 5000, // 5 segundos
      performanceWindow: 60000, // 1 minuto
      logLevel: 'info',
      enableWebSocket: true,
      enableConsoleOutput: true,
      enableFileLogging: true,
      logDirectory: './logs'
    };
        
    this.realTimeStats = {
      eventsPerMinute: 0,
      errorsPerMinute: 0,
      activeModules: new Set(),
      averageProcessingTime: 0,
      peakMemoryUsage: 0,
      systemHealth: 'healthy'
    };
        
    this.setupEventListeners();
    this.initializeLogging();
  }

  /**
     * Inicia el sistema de monitoreo
     */
  async start() {
    if (this.isActive) return;
        
    this.isActive = true;
    logger.info('📊 Monitor: Sistema de monitoreo visual iniciado');
        
    // Crear directorio de logs si no existe
    await this.ensureLogDirectory();
        
    // Iniciar recolección de estadísticas
    this.startStatsCollection();
        
    // Iniciar servidor WebSocket si está habilitado
    if (this.config.enableWebSocket) {
      await this.startWebSocketServer();
    }
        
    this.eventBus.emit(EventTypes.SYSTEM.MONITOR_STARTED, {
      timestamp: new Date().toISOString(),
      config: this.config
    });
        
    // Mostrar banner de inicio
    this.displayStartupBanner();
  }

  /**
     * Detiene el sistema de monitoreo
     */
  async stop() {
    if (!this.isActive) return;
        
    this.isActive = false;
        
    // Detener recolección de estadísticas
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
        
    // Cerrar conexiones WebSocket
    this.liveConnections.clear();
        
    // Guardar estadísticas finales
    await this.saveSessionStats();
        
    logger.info('📊 Monitor: Sistema de monitoreo detenido');
        
    this.eventBus.emit(EventTypes.SYSTEM.MONITOR_STOPPED, {
      timestamp: new Date().toISOString(),
      finalStats: this.realTimeStats
    });
  }

  /**
     * Configura los listeners para todos los eventos
     */
  setupEventListeners() {
    // Interceptar TODOS los eventos emitidos
    const originalEmit = this.eventBus.emit.bind(this.eventBus);
        
    this.eventBus.emit = (eventType, data, ...args) => {
      // Capturar el evento para monitoreo
      this.captureEvent(eventType, data);
            
      // Emitir el evento normalmente
      return originalEmit(eventType, data, ...args);
    };
        
    // Escuchar eventos específicos del sistema
    this.eventBus.on(EventTypes.SYSTEM.ERROR, (data) => {
      this.handleSystemError(data);
    });
        
    this.eventBus.on(EventTypes.SYSTEM.PERFORMANCE_ALERT, (data) => {
      this.handlePerformanceAlert(data);
    });
        
    this.eventBus.on(EventTypes.SYSTEM.HEALTH_CHECK_COMPLETED, (data) => {
      this.updateSystemHealth(data);
    });
  }

  /**
     * Captura un evento para monitoreo
     */
  captureEvent(eventType, data) {
    if (!this.isActive || !eventType || typeof eventType !== 'string') return;
        
    const timestamp = new Date().toISOString();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
    const eventTrace = {
      id: eventId,
      type: eventType,
      timestamp,
      data: this.sanitizeEventData(data),
      source: this.detectEventSource(eventType),
      targets: this.detectEventTargets(eventType),
      status: '✅',
      processingTime: null,
      memoryUsage: process.memoryUsage().heapUsed
    };
        
    // Agregar a la traza
    this.eventTrace.push(eventTrace);
        
    // Mantener tamaño de traza bajo control
    if (this.eventTrace.length > this.config.maxTraceSize) {
      this.eventTrace.shift();
    }
        
    // Actualizar estadísticas
    this.updateEventStats(eventType, eventTrace);
        
    // Mostrar en consola si está habilitado
    if (this.config.enableConsoleOutput) {
      this.displayEventInConsole(eventTrace);
    }
        
    // Enviar a conexiones WebSocket en vivo
    this.broadcastToLiveConnections(eventTrace);
        
    // Registrar en archivo si está habilitado
    if (this.config.enableFileLogging) {
      this.logEventToFile(eventTrace);
    }
  }

  /**
     * Sanitiza los datos del evento para logging
     */
  sanitizeEventData(data) {
    if (!data) return null;
        
    try {
      // Crear una copia profunda y sanitizar datos sensibles
      const sanitized = JSON.parse(JSON.stringify(data));
            
      // Remover campos sensibles
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
            
      // Usar función consolidada de sanitización con redacción de campos sensibles
      const sanitizeWithRedaction = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
                
        // Primero aplicar sanitización general
        const sanitized = SanitizationUtils.sanitizeObject(obj);
                
        // Luego aplicar redacción de campos sensibles
        for (const key in sanitized) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            sanitized[key] = '[REDACTED]';
          } else if (typeof sanitized[key] === 'object') {
            sanitized[key] = sanitizeWithRedaction(sanitized[key]);
          }
        }
                
        return sanitized;
      };
            
      return sanitizeWithRedaction(sanitized);
    } catch (error) {
      return { error: 'Failed to sanitize event data' };
    }
  }

  /**
     * Detecta la fuente del evento
     */
  detectEventSource(eventType) {
    if (!eventType || typeof eventType !== 'string') {
      return 'UNKNOWN';
    }
        
    const sourceMap = {
      'user.': 'USER',
      'ai.': 'AI',
      'system.': 'SYSTEM',
      'flow.': 'FLOW_MANAGER',
      'store.': 'EVENT_STORE',
      'recovery.': 'RECOVERY_MANAGER',
      'monitor.': 'MONITOR'
    };
        
    for (const [prefix, source] of Object.entries(sourceMap)) {
      if (eventType.startsWith(prefix)) {
        return source;
      }
    }
        
    return 'UNKNOWN';
  }

  /**
     * Detecta los objetivos del evento
     */
  detectEventTargets(eventType) {
    // Aquí se podría implementar lógica más sofisticada
    // basada en el mapa de eventos registrados
    const listeners = this.eventBus.listeners(eventType);
    return listeners.length > 0 ? [`${listeners.length} listeners`] : ['No listeners'];
  }

  /**
     * Actualiza estadísticas del evento
     */
  updateEventStats(eventType, eventTrace) {
    // Estadísticas por tipo de evento
    if (!this.eventStats.has(eventType)) {
      this.eventStats.set(eventType, {
        count: 0,
        lastSeen: null,
        averageSize: 0,
        errors: 0
      });
    }
        
    const stats = this.eventStats.get(eventType);
    stats.count++;
    stats.lastSeen = eventTrace.timestamp;
        
    // Actualizar estadísticas del módulo fuente
    const source = eventTrace.source;
    if (!this.moduleStats.has(source)) {
      this.moduleStats.set(source, {
        eventsEmitted: 0,
        lastActivity: null,
        status: 'active'
      });
    }
        
    const moduleStats = this.moduleStats.get(source);
    moduleStats.eventsEmitted++;
    moduleStats.lastActivity = eventTrace.timestamp;
        
    // Actualizar estadísticas en tiempo real
    this.realTimeStats.activeModules.add(source);
  }

  /**
     * Muestra el evento en consola con formato visual
     */
  displayEventInConsole(eventTrace) {
    const timestamp = new Date(eventTrace.timestamp).toLocaleTimeString();
    const source = eventTrace.source.padEnd(15);
    const type = eventTrace.type.padEnd(30);
    const targets = eventTrace.targets.join(', ');
        
    // Usar colores para diferentes tipos de eventos
    let color = '\x1b[37m'; // Blanco por defecto
        
    if (eventTrace.type.includes('error')) {
      color = '\x1b[31m'; // Rojo
    } else if (eventTrace.type.includes('warning')) {
      color = '\x1b[33m'; // Amarillo
    } else if (eventTrace.type.includes('success')) {
      color = '\x1b[32m'; // Verde
    } else if (eventTrace.type.includes('ai.')) {
      color = '\x1b[36m'; // Cian
    } else if (eventTrace.type.includes('system.')) {
      color = '\x1b[35m'; // Magenta
    }
        
    const reset = '\x1b[0m';
        
    logger.info(`${color}[${timestamp}] [${type}] [${source}] → [${targets}] ${eventTrace.status}${reset}`);
        
    // Mostrar datos del evento si el nivel de log es debug
    if (this.config.logLevel === 'debug' && eventTrace.data) {
      logger.info(`${color}  Data: ${JSON.stringify(eventTrace.data, null, 2)}${reset}`);
    }
  }

  /**
     * Transmite el evento a conexiones WebSocket en vivo
     */
  broadcastToLiveConnections(eventTrace) {
    if (this.liveConnections.size === 0) return;
        
    const message = JSON.stringify({
      type: 'event_trace',
      data: eventTrace
    });
        
    this.liveConnections.forEach(connection => {
      try {
        if (connection.readyState === 1) { // WebSocket.OPEN
          connection.send(message);
        }
      } catch (error) {
        this.logger.error('Error enviando a conexión WebSocket:', error.message);
        this.liveConnections.delete(connection);
      }
    });
  }

  /**
     * Registra el evento en archivo
     */
  async logEventToFile(eventTrace) {
    try {
      const logFile = path.join(this.config.logDirectory, `events_${new Date().toISOString().split('T')[0]}.log`);
      const logEntry = `${eventTrace.timestamp} | ${eventTrace.type} | ${eventTrace.source} | ${JSON.stringify(eventTrace.data)}\n`;
            
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      this.logger.error('Error escribiendo log de evento:', error.message);
    }
  }

  /**
     * Inicia la recolección de estadísticas periódicas
     */
  startStatsCollection() {
    this.statsInterval = setInterval(() => {
      this.collectRealTimeStats();
      this.displayDashboard();
    }, this.config.statsInterval);
  }

  /**
     * Recolecta estadísticas en tiempo real
     */
  collectRealTimeStats() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
        
    // Eventos por minuto
    const recentEvents = this.eventTrace.filter(
      event => new Date(event.timestamp).getTime() > oneMinuteAgo
    );
        
    this.realTimeStats.eventsPerMinute = recentEvents.length;
        
    // Errores por minuto
    const recentErrors = recentEvents.filter(
      event => event.type.includes('error') || event.status === '❌'
    );
        
    this.realTimeStats.errorsPerMinute = recentErrors.length;
        
    // Tiempo promedio de procesamiento
    const eventsWithTiming = recentEvents.filter(event => event.processingTime);
    if (eventsWithTiming.length > 0) {
      const avgTime = eventsWithTiming.reduce((sum, event) => sum + event.processingTime, 0) / eventsWithTiming.length;
      this.realTimeStats.averageProcessingTime = Math.round(avgTime);
    }
        
    // Uso de memoria pico
    const memoryUsages = recentEvents.map(event => event.memoryUsage).filter(Boolean);
    if (memoryUsages.length > 0) {
      this.realTimeStats.peakMemoryUsage = Math.max(...memoryUsages);
    }
        
    // Determinar salud del sistema
    if (this.realTimeStats.errorsPerMinute > 10) {
      this.realTimeStats.systemHealth = 'critical';
    } else if (this.realTimeStats.errorsPerMinute > 5 || this.realTimeStats.eventsPerMinute > 1000) {
      this.realTimeStats.systemHealth = 'warning';
    } else {
      this.realTimeStats.systemHealth = 'healthy';
    }
  }

  /**
     * Muestra el dashboard en consola
     */
  displayDashboard() {
    if (!this.config.enableConsoleOutput) return;
        
    console.clear();
        
    // Header del dashboard
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 MONITOR DE EVENTOS EN TIEMPO REAL');
    logger.info('='.repeat(80));
        
    // Estadísticas generales
    const healthColor = this.realTimeStats.systemHealth === 'healthy' ? '\x1b[32m' : 
      this.realTimeStats.systemHealth === 'warning' ? '\x1b[33m' : '\x1b[31m';
        
    logger.info(`\n🔍 ESTADO DEL SISTEMA: ${healthColor}${this.realTimeStats.systemHealth.toUpperCase()}\x1b[0m`);
    logger.info(`📈 Eventos/min: ${this.realTimeStats.eventsPerMinute}`);
    logger.info(`❌ Errores/min: ${this.realTimeStats.errorsPerMinute}`);
    logger.info(`⏱️  Tiempo promedio: ${this.realTimeStats.averageProcessingTime}ms`);
    logger.info(`💾 Memoria pico: ${(this.realTimeStats.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    logger.info(`🔧 Módulos activos: ${this.realTimeStats.activeModules.size}`);
        
    // Top eventos por tipo
    logger.info('\n📊 TOP EVENTOS (últimos 5 minutos):');
    logger.info('-'.repeat(50));
        
    const sortedEvents = Array.from(this.eventStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
        
    sortedEvents.forEach(([eventType, stats]) => {
      logger.info(`  ${eventType.padEnd(30)} | ${stats.count.toString().padStart(5)} eventos`);
    });
        
    // Módulos activos
    logger.info('\n🔧 MÓDULOS ACTIVOS:');
    logger.info('-'.repeat(50));
        
    Array.from(this.moduleStats.entries()).forEach(([module, stats]) => {
      const status = stats.status === 'active' ? '🟢' : '🔴';
      logger.info(`  ${status} ${module.padEnd(20)} | ${stats.eventsEmitted} eventos`);
    });
        
    // Eventos recientes
    logger.info('\n📝 EVENTOS RECIENTES:');
    logger.info('-'.repeat(80));
        
    const recentEvents = this.eventTrace.slice(-10);
    recentEvents.forEach(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const type = event.type.substring(0, 25).padEnd(25);
      const source = event.source.substring(0, 12).padEnd(12);
      logger.info(`  [${time}] ${type} | ${source} | ${event.status}`);
    });
        
    logger.info('\n' + '='.repeat(80));
    logger.info(`📊 Total eventos capturados: ${this.eventTrace.length} | Última actualización: ${new Date().toLocaleTimeString()}`);
    logger.info('='.repeat(80));
  }

  /**
     * Maneja errores del sistema
     */
  handleSystemError(errorData) {
    this.logger.error('\n🚨 ERROR DEL SISTEMA DETECTADO:');
    this.logger.error('  Tipo:', errorData.type || 'Desconocido');
    this.logger.error('  Mensaje:', errorData.message || 'Sin mensaje');
    this.logger.error('  Timestamp:', new Date().toISOString());
        
    // Actualizar estadísticas de error
    this.realTimeStats.errorsPerMinute++;
  }

  /**
     * Maneja alertas de rendimiento
     */
  handlePerformanceAlert(alertData) {
    logger.warn('\n⚠️ ALERTA DE RENDIMIENTO:');
    logger.warn('  Métrica:', alertData.metric || 'Desconocida');
    logger.warn('  Valor:', alertData.value || 'Sin valor');
    logger.warn('  Umbral:', alertData.threshold || 'Sin umbral');
  }

  /**
     * Actualiza la salud del sistema
     */
  updateSystemHealth(healthData) {
    this.realTimeStats.systemHealth = healthData.overall || 'unknown';
  }

  /**
     * Inicia el servidor WebSocket para conexiones en vivo
     */
  async startWebSocketServer() {
    try {
      // Aquí se implementaría un servidor WebSocket real
      // Por ahora, simularemos la funcionalidad
      logger.info('🌐 Monitor: Servidor WebSocket simulado iniciado en puerto 8080');
            
      this.eventBus.emit(EventTypes.SYSTEM.WEBSOCKET_SERVER_STARTED, {
        port: 8080,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('❌ Error iniciando servidor WebSocket:', error.message);
    }
  }

  /**
     * Asegura que el directorio de logs existe
     */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Error creando directorio de logs:', error.message);
    }
  }

  /**
     * Inicializa el sistema de logging
     */
  initializeLogging() {
    // Configurar rotación de logs, etc.
    logger.info('📝 Monitor: Sistema de logging inicializado');
  }

  /**
     * Muestra el banner de inicio
     */
  displayStartupBanner() {
    logger.info('\n' + '🚀'.repeat(20));
    logger.info('📊 SISTEMA DE MONITOREO VISUAL INICIADO');
    logger.info('🔍 Observando flujo de eventos en tiempo real...');
    logger.info('📈 Dashboard actualizado cada 5 segundos');
    logger.info('📝 Logs guardados en:', this.config.logDirectory);
    logger.info('🚀'.repeat(20) + '\n');
  }

  /**
     * Guarda estadísticas de la sesión
     */
  async saveSessionStats() {
    try {
      const sessionStats = {
        startTime: this.startTime,
        endTime: new Date().toISOString(),
        totalEvents: this.eventTrace.length,
        eventStats: Object.fromEntries(this.eventStats),
        moduleStats: Object.fromEntries(this.moduleStats),
        realTimeStats: this.realTimeStats
      };
            
      const statsFile = path.join(this.config.logDirectory, `session_stats_${Date.now()}.json`);
      await fs.writeFile(statsFile, JSON.stringify(sessionStats, null, 2));
            
      logger.info('💾 Estadísticas de sesión guardadas en:', statsFile);
    } catch (error) {
      this.logger.error('Error guardando estadísticas de sesión:', error.message);
    }
  }

  /**
     * Obtiene estadísticas actuales
     */
  getStats() {
    return {
      isActive: this.isActive,
      totalEvents: this.eventTrace.length,
      realTimeStats: this.realTimeStats,
      eventTypes: this.eventStats.size,
      activeModules: this.realTimeStats.activeModules.size,
      liveConnections: this.liveConnections.size
    };
  }

  /**
     * Obtiene la traza de eventos recientes
     */
  getRecentEvents(limit = 100) {
    return this.eventTrace.slice(-limit);
  }

  /**
     * Busca eventos por criterios
     */
  searchEvents(criteria) {
    return this.eventTrace.filter(event => {
      if (criteria.type && !event.type.includes(criteria.type)) return false;
      if (criteria.source && event.source !== criteria.source) return false;
      if (criteria.status && event.status !== criteria.status) return false;
      if (criteria.since && new Date(event.timestamp) < new Date(criteria.since)) return false;
      if (criteria.until && new Date(event.timestamp) > new Date(criteria.until)) return false;
            
      return true;
    });
  }

  /**
     * Genera reporte de eventos
     */
  generateReport(timeRange = '1h') {
    const now = Date.now();
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
        
    const rangeMs = ranges[timeRange] || ranges['1h'];
    const since = new Date(now - rangeMs);
        
    const eventsInRange = this.eventTrace.filter(
      event => new Date(event.timestamp) >= since
    );
        
    return {
      timeRange,
      totalEvents: eventsInRange.length,
      eventsByType: this.groupEventsByType(eventsInRange),
      eventsBySource: this.groupEventsBySource(eventsInRange),
      errorRate: this.calculateErrorRate(eventsInRange),
      averageProcessingTime: this.calculateAverageProcessingTime(eventsInRange)
    };
  }

  /**
     * Agrupa eventos por tipo
     */
  groupEventsByType(events) {
    const groups = {};
    events.forEach(event => {
      groups[event.type] = (groups[event.type] || 0) + 1;
    });
    return groups;
  }

  /**
     * Agrupa eventos por fuente
     */
  groupEventsBySource(events) {
    const groups = {};
    events.forEach(event => {
      groups[event.source] = (groups[event.source] || 0) + 1;
    });
    return groups;
  }

  /**
     * Calcula la tasa de error
     */
  calculateErrorRate(events) {
    if (events.length === 0) return 0;
        
    const errors = events.filter(event => 
      event.type.includes('error') || event.status === '❌'
    ).length;
        
    return (errors / events.length) * 100;
  }

  /**
     * Calcula el tiempo promedio de procesamiento
     */
  calculateAverageProcessingTime(events) {
    const eventsWithTiming = events.filter(event => event.processingTime);
        
    if (eventsWithTiming.length === 0) return 0;
        
    const total = eventsWithTiming.reduce((sum, event) => sum + event.processingTime, 0);
    return total / eventsWithTiming.length;
  }
}

export default Monitor;
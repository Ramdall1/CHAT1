/**
 * BaseAdapter - Clase Base para Adaptadores de Comunicación
 * 
 * Define la interfaz común para todos los adaptadores de comunicación
 * del sistema event-driven (WebSocket, Pub/Sub, MQTT, etc.)
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../services/core/core/logger.js';
import { EventEmitter } from 'events';

const logger = createLogger('BASE_ADAPTER');

export class BaseAdapter extends EventEmitter {
  constructor(name, options = {}) {
    super();
    
    this.name = name;
    this.type = options.type || 'unknown';
    this.isConnected = false;
    this.isReconnecting = false;
    this.connectionAttempts = 0;
    this.lastError = null;
    
    // Configuración común
    this.config = {
      // Configuración de conexión
      autoReconnect: options.autoReconnect !== false,
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      connectionTimeout: options.connectionTimeout || 30000,
      
      // Configuración de heartbeat
      enableHeartbeat: options.enableHeartbeat !== false,
      heartbeatInterval: options.heartbeatInterval || 30000,
      heartbeatTimeout: options.heartbeatTimeout || 10000,
      
      // Configuración de buffering
      enableBuffering: options.enableBuffering !== false,
      bufferSize: options.bufferSize || 1000,
      bufferTimeout: options.bufferTimeout || 5000,
      
      // Configuración de compresión
      enableCompression: options.enableCompression || false,
      compressionLevel: options.compressionLevel || 6,
      
      // Configuración de serialización
      serializer: options.serializer || 'json', // json, msgpack, protobuf
      
      // Configuración de filtros
      enableFiltering: options.enableFiltering !== false,
      eventFilters: options.eventFilters || [],
      
      // Configuración de métricas
      enableMetrics: options.enableMetrics !== false,
      metricsInterval: options.metricsInterval || 60000,
      
      ...options
    };
    
    // Estado del adaptador
    this.state = {
      startTime: null,
      lastConnectTime: null,
      lastDisconnectTime: null,
      totalConnections: 0,
      totalDisconnections: 0,
      totalReconnections: 0
    };
    
    // Buffer de eventos
    this.eventBuffer = [];
    this.bufferTimer = null;
    
    // Timers
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.metricsTimer = null;
    
    // Métricas
    this.metrics = {
      // Métricas de conexión
      connectionUptime: 0,
      connectionDowntime: 0,
      averageConnectionTime: 0,
      
      // Métricas de eventos
      eventsSent: 0,
      eventsReceived: 0,
      eventsBuffered: 0,
      eventsDropped: 0,
      eventsFiltered: 0,
      
      // Métricas de rendimiento
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      throughputPerSecond: 0,
      
      // Métricas de errores
      connectionErrors: 0,
      transmissionErrors: 0,
      serializationErrors: 0,
      
      // Métricas de heartbeat
      heartbeatsSent: 0,
      heartbeatsReceived: 0,
      missedHeartbeats: 0
    };
    
    // Callbacks
    this.callbacks = {
      onConnect: [],
      onDisconnect: [],
      onError: [],
      onEvent: [],
      onHeartbeat: []
    };
    
    // Inicializar
    this.initialize();
  }
  
  /**
   * Inicializar el adaptador
   */
  initialize() {
    this.state.startTime = new Date().toISOString();
    
    // Configurar timers
    if (this.config.enableMetrics) {
      this.startMetricsTimer();
    }
    
    logger.info(`Adaptador ${this.name} inicializado`, {
      type: this.type,
      config: this.config
    });
  }
  
  /**
   * Conectar (debe ser implementado por subclases)
   */
  async connect() {
    throw new Error('El método connect() debe ser implementado por la subclase');
  }
  
  /**
   * Desconectar (debe ser implementado por subclases)
   */
  async disconnect() {
    throw new Error('El método disconnect() debe ser implementado por la subclase');
  }
  
  /**
   * Enviar evento (debe ser implementado por subclases)
   */
  async send(event) {
    throw new Error('El método send() debe ser implementado por la subclase');
  }
  
  /**
   * Suscribirse a eventos (debe ser implementado por subclases)
   */
  async subscribe(pattern) {
    throw new Error('El método subscribe() debe ser implementado por la subclase');
  }
  
  /**
   * Desuscribirse de eventos (debe ser implementado por subclases)
   */
  async unsubscribe(pattern) {
    throw new Error('El método unsubscribe() debe ser implementado por la subclase');
  }
  
  /**
   * Manejar conexión exitosa
   */
  handleConnect() {
    this.isConnected = true;
    this.isReconnecting = false;
    this.connectionAttempts = 0;
    this.lastError = null;
    
    this.state.lastConnectTime = new Date().toISOString();
    this.state.totalConnections++;
    
    // Iniciar heartbeat
    if (this.config.enableHeartbeat) {
      this.startHeartbeat();
    }
    
    // Procesar buffer de eventos
    if (this.config.enableBuffering && this.eventBuffer.length > 0) {
      this.flushBuffer();
    }
    
    this.executeCallbacks('onConnect');
    this.emit('connect');
    
    logger.info(`Adaptador ${this.name} conectado`);
  }
  
  /**
   * Manejar desconexión
   */
  handleDisconnect(reason = 'unknown') {
    const wasConnected = this.isConnected;
    
    this.isConnected = false;
    this.state.lastDisconnectTime = new Date().toISOString();
    
    if (wasConnected) {
      this.state.totalDisconnections++;
    }
    
    // Detener heartbeat
    this.stopHeartbeat();
    
    this.executeCallbacks('onDisconnect', { reason });
    this.emit('disconnect', reason);
    
    logger.warn(`Adaptador ${this.name} desconectado: ${reason}`);
    
    // Intentar reconexión automática
    if (this.config.autoReconnect && !this.isReconnecting) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * Manejar error
   */
  handleError(error, context = {}) {
    this.lastError = {
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    };
    
    // Actualizar métricas de error
    if (context.type === 'connection') {
      this.metrics.connectionErrors++;
    } else if (context.type === 'transmission') {
      this.metrics.transmissionErrors++;
    } else if (context.type === 'serialization') {
      this.metrics.serializationErrors++;
    }
    
    this.executeCallbacks('onError', { error, context });
    this.emit('error', error, context);
    
    logger.error(`Error en adaptador ${this.name}:`, error, context);
  }
  
  /**
   * Manejar evento recibido
   */
  handleEvent(event) {
    try {
      // Aplicar filtros
      if (this.config.enableFiltering && !this.passesFilters(event)) {
        this.metrics.eventsFiltered++;
        return;
      }
      
      // Deserializar evento
      const deserializedEvent = this.deserialize(event);
      
      // Actualizar métricas
      this.metrics.eventsReceived++;
      this.updateLatencyMetrics(deserializedEvent);
      
      this.executeCallbacks('onEvent', deserializedEvent);
      this.emit('event', deserializedEvent);
      
    } catch (error) {
      this.handleError(error, { type: 'serialization', event });
    }
  }
  
  /**
   * Programar reconexión
   */
  scheduleReconnect() {
    if (this.connectionAttempts >= this.config.maxReconnectAttempts) {
      logger.error(`Máximo número de intentos de reconexión alcanzado para ${this.name}`);
      return;
    }
    
    this.isReconnecting = true;
    this.connectionAttempts++;
    
    const delay = this.config.reconnectInterval * Math.pow(2, this.connectionAttempts - 1); // Backoff exponencial
    
    logger.info(`Programando reconexión ${this.connectionAttempts}/${this.config.maxReconnectAttempts} en ${delay}ms`);
    
    this.reconnectTimer = setTimeout(async() => {
      try {
        this.state.totalReconnections++;
        await this.connect();
      } catch (error) {
        this.handleError(error, { type: 'reconnection' });
        this.scheduleReconnect();
      }
    }, delay);
  }
  
  /**
   * Cancelar reconexión
   */
  cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
  }
  
  /**
   * Iniciar heartbeat
   */
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(async() => {
      try {
        await this.sendHeartbeat();
        this.metrics.heartbeatsSent++;
      } catch (error) {
        this.metrics.missedHeartbeats++;
        this.handleError(error, { type: 'heartbeat' });
      }
    }, this.config.heartbeatInterval);
  }
  
  /**
   * Detener heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * Enviar heartbeat (debe ser implementado por subclases)
   */
  async sendHeartbeat() {
    // Implementación por defecto - puede ser sobrescrita
    logger.debug(`Heartbeat enviado desde ${this.name}`);
  }
  
  /**
   * Manejar heartbeat recibido
   */
  handleHeartbeat() {
    this.metrics.heartbeatsReceived++;
    this.executeCallbacks('onHeartbeat');
    logger.debug(`Heartbeat recibido en ${this.name}`);
  }
  
  /**
   * Añadir evento al buffer
   */
  bufferEvent(event) {
    if (!this.config.enableBuffering) {
      this.metrics.eventsDropped++;
      return false;
    }
    
    if (this.eventBuffer.length >= this.config.bufferSize) {
      // Remover evento más antiguo
      this.eventBuffer.shift();
      this.metrics.eventsDropped++;
    }
    
    this.eventBuffer.push({
      event,
      timestamp: Date.now()
    });
    
    this.metrics.eventsBuffered++;
    
    // Programar flush del buffer
    this.scheduleBufferFlush();
    
    return true;
  }
  
  /**
   * Programar flush del buffer
   */
  scheduleBufferFlush() {
    if (this.bufferTimer) return;
    
    this.bufferTimer = setTimeout(() => {
      this.flushBuffer();
    }, this.config.bufferTimeout);
  }
  
  /**
   * Vaciar buffer de eventos
   */
  async flushBuffer() {
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
    
    if (this.eventBuffer.length === 0 || !this.isConnected) {
      return;
    }
    
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    
    logger.info(`Vaciando buffer de ${events.length} eventos`);
    
    for (const { event } of events) {
      try {
        await this.send(event);
      } catch (error) {
        this.handleError(error, { type: 'buffer_flush', event });
        // Re-añadir al buffer si falla
        this.bufferEvent(event);
      }
    }
  }
  
  /**
   * Verificar si un evento pasa los filtros
   */
  passesFilters(event) {
    if (!this.config.eventFilters || this.config.eventFilters.length === 0) {
      return true;
    }
    
    return this.config.eventFilters.some(filter => {
      if (typeof filter === 'string') {
        return event.eventType && event.eventType.includes(filter);
      }
      
      if (typeof filter === 'function') {
        return filter(event);
      }
      
      if (typeof filter === 'object') {
        return this.matchesFilter(event, filter);
      }
      
      return false;
    });
  }
  
  /**
   * Verificar si un evento coincide con un filtro objeto
   */
  matchesFilter(event, filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (event[key] !== value) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Serializar evento
   */
  serialize(event) {
    try {
      switch (this.config.serializer) {
      case 'json':
        return JSON.stringify(event);
      case 'msgpack':
        // Implementar MessagePack si está disponible
        return JSON.stringify(event);
      case 'protobuf':
        // Implementar Protocol Buffers si está disponible
        return JSON.stringify(event);
      default:
        return JSON.stringify(event);
      }
    } catch (error) {
      this.handleError(error, { type: 'serialization', event });
      throw error;
    }
  }
  
  /**
   * Deserializar evento
   */
  deserialize(data) {
    try {
      switch (this.config.serializer) {
      case 'json':
        return typeof data === 'string' ? JSON.parse(data) : data;
      case 'msgpack':
        // Implementar MessagePack si está disponible
        return typeof data === 'string' ? JSON.parse(data) : data;
      case 'protobuf':
        // Implementar Protocol Buffers si está disponible
        return typeof data === 'string' ? JSON.parse(data) : data;
      default:
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
    } catch (error) {
      this.handleError(error, { type: 'serialization', data });
      throw error;
    }
  }
  
  /**
   * Actualizar métricas de latencia
   */
  updateLatencyMetrics(event) {
    if (event.timestamp) {
      const latency = Date.now() - new Date(event.timestamp).getTime();
      
      this.metrics.minLatency = Math.min(this.metrics.minLatency, latency);
      this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
      
      // Calcular promedio móvil
      const alpha = 0.1; // Factor de suavizado
      this.metrics.averageLatency = this.metrics.averageLatency * (1 - alpha) + latency * alpha;
    }
  }
  
  /**
   * Iniciar timer de métricas
   */
  startMetricsTimer() {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
      this.emit('metrics', this.getMetrics());
    }, this.config.metricsInterval);
  }
  
  /**
   * Detener timer de métricas
   */
  stopMetricsTimer() {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }
  
  /**
   * Actualizar métricas calculadas
   */
  updateMetrics() {
    const now = Date.now();
    const startTime = new Date(this.state.startTime).getTime();
    const uptime = now - startTime;
    
    // Calcular uptime de conexión
    if (this.isConnected && this.state.lastConnectTime) {
      const connectTime = new Date(this.state.lastConnectTime).getTime();
      this.metrics.connectionUptime = now - connectTime;
    }
    
    // Calcular throughput
    const timeWindow = this.config.metricsInterval / 1000; // en segundos
    this.metrics.throughputPerSecond = (this.metrics.eventsSent + this.metrics.eventsReceived) / timeWindow;
    
    // Resetear contadores de ventana de tiempo
    this.metrics.eventsSent = 0;
    this.metrics.eventsReceived = 0;
  }
  
  /**
   * Registrar callback
   */
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
    
    // También registrar en EventEmitter
    super.on(event, callback);
  }
  
  /**
   * Desregistrar callback
   */
  off(event, callback) {
    if (this.callbacks[event]) {
      const index = this.callbacks[event].indexOf(callback);
      if (index > -1) {
        this.callbacks[event].splice(index, 1);
      }
    }
    
    // También desregistrar en EventEmitter
    super.off(event, callback);
  }
  
  /**
   * Ejecutar callbacks
   */
  async executeCallbacks(event, data) {
    if (this.callbacks[event]) {
      for (const callback of this.callbacks[event]) {
        try {
          await callback(data);
        } catch (error) {
          logger.error(`Error ejecutando callback ${event}:`, error);
        }
      }
    }
  }
  
  /**
   * Obtener estado del adaptador
   */
  getState() {
    return {
      name: this.name,
      type: this.type,
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      connectionAttempts: this.connectionAttempts,
      lastError: this.lastError,
      state: this.state,
      bufferSize: this.eventBuffer.length
    };
  }
  
  /**
   * Obtener métricas del adaptador
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      adapter: this.name,
      type: this.type
    };
  }
  
  /**
   * Obtener información del adaptador
   */
  getInfo() {
    return {
      name: this.name,
      type: this.type,
      config: this.config,
      state: this.getState(),
      metrics: this.getMetrics()
    };
  }
  
  /**
   * Destruir el adaptador
   */
  async destroy() {
    logger.info(`Destruyendo adaptador ${this.name}`);
    
    // Detener timers
    this.stopHeartbeat();
    this.stopMetricsTimer();
    this.cancelReconnect();
    
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
    }
    
    // Desconectar si está conectado
    if (this.isConnected) {
      await this.disconnect();
    }
    
    // Limpiar buffer
    this.eventBuffer = [];
    
    // Limpiar callbacks
    this.callbacks = {
      onConnect: [],
      onDisconnect: [],
      onError: [],
      onEvent: [],
      onHeartbeat: []
    };
    
    // Remover todos los listeners
    this.removeAllListeners();
    
    logger.info(`Adaptador ${this.name} destruido`);
  }
}

export default BaseAdapter;
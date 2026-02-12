/**
 * AdapterManager - Gestor de Adaptadores de Comunicación
 * 
 * Coordina y gestiona todos los adaptadores de comunicación del sistema
 * event-driven (WebSocket, Pub/Sub, MQTT, etc.)
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../services/core/core/logger.js';
import { EventEmitter } from 'events';
import { WebSocketAdapter } from './WebSocketAdapter.js';
import { PubSubAdapter } from './PubSubAdapter.js';
import { MQTTAdapter } from './MQTTAdapter.js';

const logger = createLogger('ADAPTER_MANAGER');

export class AdapterManager extends EventEmitter {
  constructor(eventBus, options = {}) {
    super();
    
    this.eventBus = eventBus;
    this.isInitialized = false;
    this.isStarted = false;
    
    // Configuración del gestor
    this.config = {
      // Configuración de adaptadores
      enabledAdapters: options.enabledAdapters || ['websocket', 'pubsub', 'mqtt'],
      autoStart: options.autoStart !== false,
      autoReconnect: options.autoReconnect !== false,
      
      // Configuración de failover
      enableFailover: options.enableFailover !== false,
      failoverTimeout: options.failoverTimeout || 30000,
      primaryAdapter: options.primaryAdapter || 'websocket',
      
      // Configuración de load balancing
      enableLoadBalancing: options.enableLoadBalancing || false,
      loadBalancingStrategy: options.loadBalancingStrategy || 'round-robin', // round-robin, least-connections, weighted
      
      // Configuración de broadcasting
      enableBroadcasting: options.enableBroadcasting !== false,
      broadcastFilters: options.broadcastFilters || [],
      
      // Configuración de métricas
      enableMetrics: options.enableMetrics !== false,
      metricsInterval: options.metricsInterval || 60000,
      
      // Configuración específica de adaptadores
      adapters: {
        websocket: options.websocket || {},
        pubsub: options.pubsub || {},
        mqtt: options.mqtt || {}
      },
      
      ...options
    };
    
    // Adaptadores registrados
    this.adapters = new Map(); // name -> adapter instance
    this.adapterConfigs = new Map(); // name -> config
    this.adapterStates = new Map(); // name -> state info
    
    // Estado del gestor
    this.state = {
      primaryAdapter: null,
      activeAdapters: new Set(),
      failedAdapters: new Set(),
      lastFailover: null,
      totalMessages: 0,
      totalErrors: 0
    };
    
    // Load balancing
    this.loadBalancer = {
      currentIndex: 0,
      weights: new Map(),
      connections: new Map()
    };
    
    // Métricas agregadas
    this.metrics = {
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      totalConnections: 0,
      totalDisconnections: 0,
      totalErrors: 0,
      averageLatency: 0,
      throughput: 0,
      uptime: 0,
      adaptersOnline: 0,
      adaptersOffline: 0
    };
    
    // Timers
    this.metricsTimer = null;
    this.healthCheckTimer = null;
    
    // Callbacks
    this.messageHandlers = new Set();
    this.errorHandlers = new Set();
    
    logger.info('AdapterManager inicializado', {
      enabledAdapters: this.config.enabledAdapters,
      config: this.config
    });
  }
  
  /**
   * Inicializar el gestor de adaptadores
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('AdapterManager ya está inicializado');
      return;
    }
    
    try {
      logger.info('Inicializando AdapterManager...');
      
      // Registrar adaptadores habilitados
      await this.registerEnabledAdapters();
      
      // Configurar event bus
      this.setupEventBusIntegration();
      
      // Iniciar timers
      if (this.config.enableMetrics) {
        this.startMetricsTimer();
      }
      
      this.startHealthCheckTimer();
      
      this.isInitialized = true;
      
      // Auto-start si está habilitado
      if (this.config.autoStart) {
        await this.start();
      }
      
      logger.info('AdapterManager inicializado correctamente');
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Error inicializando AdapterManager:', error);
      throw error;
    }
  }
  
  /**
   * Registrar adaptadores habilitados
   */
  async registerEnabledAdapters() {
    for (const adapterName of this.config.enabledAdapters) {
      try {
        await this.registerAdapter(adapterName);
      } catch (error) {
        logger.error(`Error registrando adaptador ${adapterName}:`, error);
        // Continuar con otros adaptadores
      }
    }
  }
  
  /**
   * Registrar adaptador específico
   */
  async registerAdapter(name, customConfig = null) {
    try {
      const config = customConfig || this.config.adapters[name] || {};
      
      let adapter;
      
      switch (name.toLowerCase()) {
      case 'websocket':
        adapter = new WebSocketAdapter(config);
        break;
      case 'pubsub':
        adapter = new PubSubAdapter(config);
        break;
      case 'mqtt':
        adapter = new MQTTAdapter(config);
        break;
      default:
        throw new Error(`Adaptador desconocido: ${name}`);
      }
      
      // Configurar eventos del adaptador
      this.setupAdapterEvents(adapter, name);
      
      // Registrar adaptador
      this.adapters.set(name, adapter);
      this.adapterConfigs.set(name, config);
      this.adapterStates.set(name, {
        name: name,
        status: 'registered',
        registeredAt: new Date().toISOString(),
        lastError: null,
        messageCount: 0,
        errorCount: 0
      });
      
      logger.info(`Adaptador ${name} registrado correctamente`);
      this.emit('adapter:registered', { name, adapter });
      
      return adapter;
      
    } catch (error) {
      logger.error(`Error registrando adaptador ${name}:`, error);
      throw error;
    }
  }
  
  /**
   * Configurar eventos del adaptador
   */
  setupAdapterEvents(adapter, name) {
    adapter.on('connect', () => {
      this.handleAdapterConnect(name);
    });
    
    adapter.on('disconnect', (reason) => {
      this.handleAdapterDisconnect(name, reason);
    });
    
    adapter.on('error', (error, context) => {
      this.handleAdapterError(name, error, context);
    });
    
    adapter.on('event', (event) => {
      this.handleAdapterEvent(name, event);
    });
    
    adapter.on('metrics', (metrics) => {
      this.handleAdapterMetrics(name, metrics);
    });
  }
  
  /**
   * Configurar integración con EventBus
   */
  setupEventBusIntegration() {
    if (!this.eventBus) return;
    
    // Escuchar eventos del EventBus para reenviar a adaptadores
    this.eventBus.on('*', (eventType, eventData) => {
      this.broadcastEvent({
        eventType,
        ...eventData
      });
    });
    
    // Registrar manejador de mensajes
    this.onMessage((event) => {
      // Reenviar eventos recibidos al EventBus
      if (this.eventBus && event.eventType) {
        this.eventBus.emit(event.eventType, event);
      }
    });
  }
  
  /**
   * Iniciar todos los adaptadores
   */
  async start() {
    if (this.isStarted) {
      logger.warn('AdapterManager ya está iniciado');
      return;
    }
    
    try {
      logger.info('Iniciando adaptadores...');
      
      const startPromises = [];
      
      for (const [name, adapter] of this.adapters) {
        startPromises.push(
          this.startAdapter(name).catch(error => {
            logger.error(`Error iniciando adaptador ${name}:`, error);
            return { name, error };
          })
        );
      }
      
      const results = await Promise.allSettled(startPromises);
      
      // Verificar resultados
      const successful = results.filter(r => r.status === 'fulfilled' && !r.value?.error);
      const failed = results.filter(r => r.status === 'rejected' || r.value?.error);
      
      logger.info(`Adaptadores iniciados: ${successful.length}/${results.length}`);
      
      if (failed.length > 0) {
        logger.warn(`Adaptadores fallidos: ${failed.length}`);
      }
      
      // Establecer adaptador primario
      this.establishPrimaryAdapter();
      
      this.isStarted = true;
      this.emit('started', { successful: successful.length, failed: failed.length });
      
    } catch (error) {
      logger.error('Error iniciando AdapterManager:', error);
      throw error;
    }
  }
  
  /**
   * Iniciar adaptador específico
   */
  async startAdapter(name) {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adaptador ${name} no encontrado`);
    }
    
    try {
      await adapter.connect();
      
      const state = this.adapterStates.get(name);
      state.status = 'connected';
      state.connectedAt = new Date().toISOString();
      
      this.state.activeAdapters.add(name);
      this.state.failedAdapters.delete(name);
      
      logger.info(`Adaptador ${name} iniciado correctamente`);
      
    } catch (error) {
      const state = this.adapterStates.get(name);
      state.status = 'failed';
      state.lastError = error.message;
      state.errorCount++;
      
      this.state.failedAdapters.add(name);
      this.state.activeAdapters.delete(name);
      
      throw error;
    }
  }
  
  /**
   * Detener todos los adaptadores
   */
  async stop() {
    if (!this.isStarted) {
      logger.warn('AdapterManager no está iniciado');
      return;
    }
    
    try {
      logger.info('Deteniendo adaptadores...');
      
      // Detener timers
      this.stopMetricsTimer();
      this.stopHealthCheckTimer();
      
      const stopPromises = [];
      
      for (const [name, adapter] of this.adapters) {
        stopPromises.push(
          this.stopAdapter(name).catch(error => {
            logger.error(`Error deteniendo adaptador ${name}:`, error);
            return { name, error };
          })
        );
      }
      
      await Promise.allSettled(stopPromises);
      
      this.state.activeAdapters.clear();
      this.state.primaryAdapter = null;
      
      this.isStarted = false;
      this.emit('stopped');
      
      logger.info('AdapterManager detenido');
      
    } catch (error) {
      logger.error('Error deteniendo AdapterManager:', error);
      throw error;
    }
  }
  
  /**
   * Detener adaptador específico
   */
  async stopAdapter(name) {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adaptador ${name} no encontrado`);
    }
    
    try {
      await adapter.disconnect();
      
      const state = this.adapterStates.get(name);
      state.status = 'disconnected';
      state.disconnectedAt = new Date().toISOString();
      
      this.state.activeAdapters.delete(name);
      
      logger.info(`Adaptador ${name} detenido correctamente`);
      
    } catch (error) {
      logger.error(`Error deteniendo adaptador ${name}:`, error);
      throw error;
    }
  }
  
  /**
   * Enviar evento a través de adaptadores
   */
  async send(event, options = {}) {
    if (!this.isStarted || this.state.activeAdapters.size === 0) {
      throw new Error('No hay adaptadores activos disponibles');
    }
    
    try {
      const targetAdapters = this.selectAdapters(options);
      const sendPromises = [];
      
      for (const adapterName of targetAdapters) {
        const adapter = this.adapters.get(adapterName);
        if (adapter && adapter.isConnected) {
          sendPromises.push(
            adapter.send(event, options).catch(error => {
              logger.error(`Error enviando a adaptador ${adapterName}:`, error);
              return { adapterName, error };
            })
          );
        }
      }
      
      const results = await Promise.allSettled(sendPromises);
      
      // Actualizar métricas
      this.metrics.totalMessagesSent++;
      this.state.totalMessages++;
      
      // Verificar errores
      const errors = results.filter(r => r.status === 'rejected' || r.value?.error);
      if (errors.length > 0) {
        logger.warn(`Errores enviando mensaje: ${errors.length}/${results.length}`);
      }
      
      return {
        sent: results.length - errors.length,
        errors: errors.length,
        total: results.length
      };
      
    } catch (error) {
      this.metrics.totalErrors++;
      this.state.totalErrors++;
      throw error;
    }
  }
  
  /**
   * Broadcast evento a todos los adaptadores activos
   */
  async broadcastEvent(event, options = {}) {
    if (!this.config.enableBroadcasting) {
      return this.send(event, options);
    }
    
    // Aplicar filtros de broadcast
    if (!this.passesBroadcastFilters(event)) {
      return { sent: 0, errors: 0, total: 0 };
    }
    
    const broadcastOptions = {
      ...options,
      broadcast: true
    };
    
    return this.send(event, broadcastOptions);
  }
  
  /**
   * Seleccionar adaptadores para envío
   */
  selectAdapters(options = {}) {
    if (options.adapters) {
      // Adaptadores específicos solicitados
      return options.adapters.filter(name => this.state.activeAdapters.has(name));
    }
    
    if (options.broadcast) {
      // Broadcast a todos los adaptadores activos
      return Array.from(this.state.activeAdapters);
    }
    
    if (this.config.enableLoadBalancing) {
      // Usar load balancing
      return [this.selectAdapterByLoadBalancing()];
    }
    
    // Usar adaptador primario
    if (this.state.primaryAdapter && this.state.activeAdapters.has(this.state.primaryAdapter)) {
      return [this.state.primaryAdapter];
    }
    
    // Usar cualquier adaptador activo
    const activeAdapters = Array.from(this.state.activeAdapters);
    return activeAdapters.length > 0 ? [activeAdapters[0]] : [];
  }
  
  /**
   * Seleccionar adaptador por load balancing
   */
  selectAdapterByLoadBalancing() {
    const activeAdapters = Array.from(this.state.activeAdapters);
    
    if (activeAdapters.length === 0) {
      return null;
    }
    
    switch (this.config.loadBalancingStrategy) {
    case 'round-robin':
      return this.selectRoundRobin(activeAdapters);
    case 'least-connections':
      return this.selectLeastConnections(activeAdapters);
    case 'weighted':
      return this.selectWeighted(activeAdapters);
    default:
      return activeAdapters[0];
    }
  }
  
  /**
   * Selección round-robin
   */
  selectRoundRobin(adapters) {
    const adapter = adapters[this.loadBalancer.currentIndex % adapters.length];
    this.loadBalancer.currentIndex++;
    return adapter;
  }
  
  /**
   * Selección por menor número de conexiones
   */
  selectLeastConnections(adapters) {
    let minConnections = Infinity;
    let selectedAdapter = adapters[0];
    
    for (const adapterName of adapters) {
      const connections = this.loadBalancer.connections.get(adapterName) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedAdapter = adapterName;
      }
    }
    
    return selectedAdapter;
  }
  
  /**
   * Selección ponderada
   */
  selectWeighted(adapters) {
    // Implementación básica - en producción usar algoritmo más sofisticado
    const weights = adapters.map(name => this.loadBalancer.weights.get(name) || 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < adapters.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return adapters[i];
      }
    }
    
    return adapters[0];
  }
  
  /**
   * Verificar filtros de broadcast
   */
  passesBroadcastFilters(event) {
    if (!this.config.broadcastFilters || this.config.broadcastFilters.length === 0) {
      return true;
    }
    
    return this.config.broadcastFilters.some(filter => {
      if (typeof filter === 'function') {
        return filter(event);
      }
      
      if (typeof filter === 'object') {
        return this.matchesFilter(event, filter);
      }
      
      return true;
    });
  }
  
  /**
   * Verificar coincidencia con filtro
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
   * Suscribirse a patrón en todos los adaptadores
   */
  async subscribe(pattern, options = {}) {
    const targetAdapters = options.adapters || Array.from(this.state.activeAdapters);
    const subscribePromises = [];
    
    for (const adapterName of targetAdapters) {
      const adapter = this.adapters.get(adapterName);
      if (adapter && adapter.isConnected) {
        subscribePromises.push(
          adapter.subscribe(pattern).catch(error => {
            logger.error(`Error suscribiendo en adaptador ${adapterName}:`, error);
            return { adapterName, error };
          })
        );
      }
    }
    
    const results = await Promise.allSettled(subscribePromises);
    
    const errors = results.filter(r => r.status === 'rejected' || r.value?.error);
    
    logger.info(`Suscripción a '${pattern}': ${results.length - errors.length}/${results.length} adaptadores`);
    
    return {
      subscribed: results.length - errors.length,
      errors: errors.length,
      total: results.length
    };
  }
  
  /**
   * Desuscribirse de patrón en todos los adaptadores
   */
  async unsubscribe(pattern, options = {}) {
    const targetAdapters = options.adapters || Array.from(this.state.activeAdapters);
    const unsubscribePromises = [];
    
    for (const adapterName of targetAdapters) {
      const adapter = this.adapters.get(adapterName);
      if (adapter && adapter.isConnected) {
        unsubscribePromises.push(
          adapter.unsubscribe(pattern).catch(error => {
            logger.error(`Error desuscribiendo en adaptador ${adapterName}:`, error);
            return { adapterName, error };
          })
        );
      }
    }
    
    const results = await Promise.allSettled(unsubscribePromises);
    
    const errors = results.filter(r => r.status === 'rejected' || r.value?.error);
    
    logger.info(`Desuscripción de '${pattern}': ${results.length - errors.length}/${results.length} adaptadores`);
    
    return {
      unsubscribed: results.length - errors.length,
      errors: errors.length,
      total: results.length
    };
  }
  
  /**
   * Manejar conexión de adaptador
   */
  handleAdapterConnect(name) {
    logger.info(`Adaptador ${name} conectado`);
    
    this.state.activeAdapters.add(name);
    this.state.failedAdapters.delete(name);
    
    // Establecer como primario si es el configurado
    if (name === this.config.primaryAdapter) {
      this.state.primaryAdapter = name;
    }
    
    this.emit('adapter:connected', { name });
  }
  
  /**
   * Manejar desconexión de adaptador
   */
  handleAdapterDisconnect(name, reason) {
    logger.warn(`Adaptador ${name} desconectado: ${reason}`);
    
    this.state.activeAdapters.delete(name);
    
    // Manejar failover si era el adaptador primario
    if (name === this.state.primaryAdapter) {
      this.handleFailover(name, reason);
    }
    
    // Intentar reconexión automática
    if (this.config.autoReconnect) {
      this.scheduleReconnect(name);
    }
    
    this.emit('adapter:disconnected', { name, reason });
  }
  
  /**
   * Manejar error de adaptador
   */
  handleAdapterError(name, error, context) {
    logger.error(`Error en adaptador ${name}:`, error, context);
    
    const state = this.adapterStates.get(name);
    if (state) {
      state.lastError = error.message;
      state.errorCount++;
    }
    
    this.metrics.totalErrors++;
    this.state.totalErrors++;
    
    this.emit('adapter:error', { name, error, context });
  }
  
  /**
   * Manejar evento de adaptador
   */
  handleAdapterEvent(name, event) {
    const state = this.adapterStates.get(name);
    if (state) {
      state.messageCount++;
    }
    
    this.metrics.totalMessagesReceived++;
    
    // Ejecutar handlers de mensaje
    for (const handler of this.messageHandlers) {
      try {
        handler(event, name);
      } catch (error) {
        logger.error('Error en handler de mensaje:', error);
      }
    }
    
    this.emit('message', event, name);
  }
  
  /**
   * Manejar métricas de adaptador
   */
  handleAdapterMetrics(name, metrics) {
    this.emit('adapter:metrics', { name, metrics });
  }
  
  /**
   * Manejar failover
   */
  handleFailover(failedAdapter, reason) {
    if (!this.config.enableFailover) {
      return;
    }
    
    logger.warn(`Iniciando failover desde ${failedAdapter}: ${reason}`);
    
    // Buscar adaptador de respaldo
    const backupAdapters = Array.from(this.state.activeAdapters).filter(name => name !== failedAdapter);
    
    if (backupAdapters.length > 0) {
      const newPrimary = backupAdapters[0];
      this.state.primaryAdapter = newPrimary;
      this.state.lastFailover = {
        from: failedAdapter,
        to: newPrimary,
        reason: reason,
        timestamp: new Date().toISOString()
      };
      
      logger.info(`Failover completado: ${failedAdapter} -> ${newPrimary}`);
      this.emit('failover', this.state.lastFailover);
    } else {
      logger.error('No hay adaptadores de respaldo disponibles para failover');
      this.state.primaryAdapter = null;
    }
  }
  
  /**
   * Programar reconexión
   */
  scheduleReconnect(name) {
    const adapter = this.adapters.get(name);
    if (!adapter) return;
    
    setTimeout(async() => {
      try {
        logger.info(`Intentando reconectar adaptador ${name}...`);
        await this.startAdapter(name);
      } catch (error) {
        logger.error(`Error en reconexión de ${name}:`, error);
        // Programar otro intento
        this.scheduleReconnect(name);
      }
    }, 5000); // 5 segundos
  }
  
  /**
   * Establecer adaptador primario
   */
  establishPrimaryAdapter() {
    if (this.state.primaryAdapter && this.state.activeAdapters.has(this.state.primaryAdapter)) {
      return; // Ya está establecido
    }
    
    // Buscar adaptador primario configurado
    if (this.config.primaryAdapter && this.state.activeAdapters.has(this.config.primaryAdapter)) {
      this.state.primaryAdapter = this.config.primaryAdapter;
      return;
    }
    
    // Usar primer adaptador activo
    const activeAdapters = Array.from(this.state.activeAdapters);
    if (activeAdapters.length > 0) {
      this.state.primaryAdapter = activeAdapters[0];
    }
  }
  
  /**
   * Registrar handler de mensaje
   */
  onMessage(handler) {
    this.messageHandlers.add(handler);
  }
  
  /**
   * Desregistrar handler de mensaje
   */
  offMessage(handler) {
    this.messageHandlers.delete(handler);
  }
  
  /**
   * Registrar handler de error
   */
  onError(handler) {
    this.errorHandlers.add(handler);
  }
  
  /**
   * Desregistrar handler de error
   */
  offError(handler) {
    this.errorHandlers.delete(handler);
  }
  
  /**
   * Iniciar timer de métricas
   */
  startMetricsTimer() {
    this.metricsTimer = setInterval(() => {
      this.updateAggregatedMetrics();
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
   * Iniciar timer de health check
   */
  startHealthCheckTimer() {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Cada 30 segundos
  }
  
  /**
   * Detener timer de health check
   */
  stopHealthCheckTimer() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
  
  /**
   * Realizar health check
   */
  performHealthCheck() {
    for (const [name, adapter] of this.adapters) {
      const isHealthy = adapter.isConnected && !adapter.lastError;
      const state = this.adapterStates.get(name);
      
      if (state) {
        state.isHealthy = isHealthy;
        state.lastHealthCheck = new Date().toISOString();
      }
    }
    
    this.emit('health:check', this.getHealthStatus());
  }
  
  /**
   * Actualizar métricas agregadas
   */
  updateAggregatedMetrics() {
    let totalLatency = 0;
    let latencyCount = 0;
    
    this.metrics.adaptersOnline = this.state.activeAdapters.size;
    this.metrics.adaptersOffline = this.adapters.size - this.state.activeAdapters.size;
    
    for (const [name, adapter] of this.adapters) {
      const adapterMetrics = adapter.getMetrics();
      
      if (adapterMetrics.averageLatency > 0) {
        totalLatency += adapterMetrics.averageLatency;
        latencyCount++;
      }
    }
    
    if (latencyCount > 0) {
      this.metrics.averageLatency = totalLatency / latencyCount;
    }
    
    // Calcular throughput
    const timeWindow = this.config.metricsInterval / 1000; // en segundos
    this.metrics.throughput = (this.metrics.totalMessagesSent + this.metrics.totalMessagesReceived) / timeWindow;
    
    // Resetear contadores de ventana
    this.metrics.totalMessagesSent = 0;
    this.metrics.totalMessagesReceived = 0;
  }
  
  /**
   * Obtener estado de salud
   */
  getHealthStatus() {
    const health = {
      status: this.state.activeAdapters.size > 0 ? 'healthy' : 'unhealthy',
      adapters: {},
      summary: {
        total: this.adapters.size,
        online: this.state.activeAdapters.size,
        offline: this.adapters.size - this.state.activeAdapters.size,
        failed: this.state.failedAdapters.size
      }
    };
    
    for (const [name, state] of this.adapterStates) {
      health.adapters[name] = {
        status: state.status,
        isHealthy: state.isHealthy,
        lastError: state.lastError,
        errorCount: state.errorCount,
        messageCount: state.messageCount
      };
    }
    
    return health;
  }
  
  /**
   * Obtener métricas del gestor
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      adapters: Object.fromEntries(
        Array.from(this.adapters.entries()).map(([name, adapter]) => [
          name,
          adapter.getMetrics()
        ])
      )
    };
  }
  
  /**
   * Obtener estado del gestor
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isStarted: this.isStarted,
      primaryAdapter: this.state.primaryAdapter,
      activeAdapters: Array.from(this.state.activeAdapters),
      failedAdapters: Array.from(this.state.failedAdapters),
      lastFailover: this.state.lastFailover,
      totalMessages: this.state.totalMessages,
      totalErrors: this.state.totalErrors,
      adapters: Object.fromEntries(this.adapterStates)
    };
  }
  
  /**
   * Obtener información completa
   */
  getInfo() {
    return {
      config: this.config,
      state: this.getState(),
      metrics: this.getMetrics(),
      health: this.getHealthStatus()
    };
  }
  
  /**
   * Destruir el gestor
   */
  async destroy() {
    logger.info('Destruyendo AdapterManager...');
    
    try {
      // Detener si está iniciado
      if (this.isStarted) {
        await this.stop();
      }
      
      // Destruir todos los adaptadores
      for (const [name, adapter] of this.adapters) {
        try {
          await adapter.destroy();
        } catch (error) {
          logger.error(`Error destruyendo adaptador ${name}:`, error);
        }
      }
      
      // Limpiar estado
      this.adapters.clear();
      this.adapterConfigs.clear();
      this.adapterStates.clear();
      this.messageHandlers.clear();
      this.errorHandlers.clear();
      
      this.isInitialized = false;
      
      // Remover listeners
      this.removeAllListeners();
      
      logger.info('AdapterManager destruido');
      
    } catch (error) {
      logger.error('Error destruyendo AdapterManager:', error);
      throw error;
    }
  }
}

export default AdapterManager;
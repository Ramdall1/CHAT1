/**
 * CommunicatorAgent - Agente Evolutivo de Comunicación Inter-Agentes
 * Transformación evolutiva del ModuleCommunicator en un agente event-driven
 * que gestiona la comunicación inteligente, descubrimiento dinámico y orquestación de agentes
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class CommunicatorAgent {
  constructor(eventHub, logger) {
    this.id = uuidv4();
    this.name = 'CommunicatorAgent';
    this.version = '2.0.0';
    this.eventHub = eventHub;
    this.logger = logger;
        
    // Configuración evolutiva
    this.config = {
      isActive: true,
      autoDiscovery: true,
      intelligentRouting: true,
      adaptiveLoadBalancing: true,
      predictiveScaling: true,
      autoRecovery: true,
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      communicationTimeout: 10000,
      maxEventHistory: 10000,
      learningEnabled: true,
      optimizationInterval: 300000, // 5 minutos
      anomalyDetection: true,
      performanceMonitoring: true
    };
        
    // Estado del agente
    this.agentState = {
      isInitialized: false,
      isActive: false,
      lastHealthCheck: null,
      totalCommunications: 0,
      successfulCommunications: 0,
      failedCommunications: 0,
      averageResponseTime: 0,
      peakLoad: 0,
      currentLoad: 0
    };
        
    // Registro de agentes
    this.agents = new Map();
    this.agentStatus = new Map();
    this.agentDependencies = new Map();
    this.agentCapabilities = new Map();
    this.agentMetrics = new Map();
        
    // Sistema de comunicación inteligente
    this.communicationHistory = [];
    this.routingTable = new Map();
    this.loadBalancer = new Map();
    this.circuitBreakers = new Map();
        
    // Métricas evolutivas
    this.evolutiveMetrics = {
      communicationPatterns: new Map(),
      performanceBaselines: new Map(),
      anomalies: [],
      optimizations: [],
      predictions: new Map(),
      learningData: {
        routingOptimizations: new Map(),
        loadPatterns: new Map(),
        failurePatterns: new Map(),
        recoveryStrategies: new Map()
      }
    };
        
    // Timers y procesos
    this.timers = {
      healthCheck: null,
      optimization: null,
      cleanup: null,
      monitoring: null
    };
        
    // Sistema de mutex para operaciones críticas
    this.mutex = {
      agentRegistration: false,
      communication: false,
      optimization: false
    };
        
    this.setupEventListeners();
  }
    
  /**
     * Configurar listeners de eventos
     */
  setupEventListeners() {
    // Eventos de sistema
    this.eventHub.on('system.startup', this.handleSystemStartup.bind(this));
    this.eventHub.on('system.shutdown', this.handleSystemShutdown.bind(this));
        
    // Eventos de agentes
    this.eventHub.on('agent.register', this.handleAgentRegistration.bind(this));
    this.eventHub.on('agent.unregister', this.handleAgentUnregistration.bind(this));
    this.eventHub.on('agent.status_change', this.handleAgentStatusChange.bind(this));
    this.eventHub.on('agent.capability_update', this.handleCapabilityUpdate.bind(this));
        
    // Eventos de comunicación
    this.eventHub.on('communication.request', this.handleCommunicationRequest.bind(this));
    this.eventHub.on('communication.broadcast', this.handleBroadcastRequest.bind(this));
    this.eventHub.on('communication.multicast', this.handleMulticastRequest.bind(this));
    this.eventHub.on('communication.response', this.handleCommunicationResponse.bind(this));
        
    // Eventos de descubrimiento
    this.eventHub.on('discovery.scan', this.handleDiscoveryScan.bind(this));
    this.eventHub.on('discovery.agent_found', this.handleAgentFound.bind(this));
        
    // Eventos de monitoreo
    this.eventHub.on('monitoring.health_check', this.handleHealthCheckRequest.bind(this));
    this.eventHub.on('monitoring.metrics_request', this.handleMetricsRequest.bind(this));
    this.eventHub.on('monitoring.performance_alert', this.handlePerformanceAlert.bind(this));
        
    // Eventos de optimización
    this.eventHub.on('optimization.route_request', this.handleRouteOptimization.bind(this));
    this.eventHub.on('optimization.load_balance', this.handleLoadBalancing.bind(this));
    this.eventHub.on('optimization.circuit_breaker', this.handleCircuitBreaker.bind(this));
        
    // Eventos de recuperación
    this.eventHub.on('recovery.agent_failure', this.handleAgentFailure.bind(this));
    this.eventHub.on('recovery.communication_failure', this.handleCommunicationFailure.bind(this));
    this.eventHub.on('recovery.system_recovery', this.handleSystemRecovery.bind(this));
  }
    
  /**
     * Inicializar el agente
     */
  async initialize() {
    if (this.agentState.isInitialized) return;
        
    try {
      this.logger.info('🚀 Inicializando CommunicatorAgent');
            
      // Cargar estado persistente
      await this.loadAgentState();
            
      // Inicializar componentes
      await this.initializeRoutingTable();
      await this.initializeLoadBalancer();
      await this.initializeCircuitBreakers();
            
      // Descubrir agentes existentes
      if (this.config.autoDiscovery) {
        await this.performAgentDiscovery();
      }
            
      // Iniciar procesos de monitoreo
      this.startHealthCheck();
      this.startOptimization();
      this.startPerformanceMonitoring();
            
      this.agentState.isInitialized = true;
      this.agentState.isActive = true;
            
      this.logger.info('✅ CommunicatorAgent inicializado correctamente');
            
      // Notificar inicialización
      this.eventHub.emit('communicator.initialized', {
        agentId: this.id,
        capabilities: this.getCapabilities(),
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      this.logger.error('❌ Error inicializando CommunicatorAgent', { error: error.message });
      throw error;
    }
  }
    
  /**
     * Activar/desactivar el agente
     */
  async setActive(isActive) {
    this.config.isActive = isActive;
    this.agentState.isActive = isActive;
        
    if (isActive) {
      this.startTimers();
      this.logger.info('▶️ CommunicatorAgent activado');
    } else {
      this.stopTimers();
      this.logger.info('⏸️ CommunicatorAgent desactivado');
    }
        
    await this.saveAgentState();
  }
    
  /**
     * Inicializar tabla de enrutamiento
     */
  async initializeRoutingTable() {
    this.routingTable.clear();
        
    // Cargar rutas persistentes si existen
    try {
      const routesFile = path.join(process.cwd(), 'storage', 'routing-table.json');
      const exists = await fs.access(routesFile).then(() => true).catch(() => false);
            
      if (exists) {
        const routesData = await fs.readFile(routesFile, 'utf8');
        const savedRoutes = JSON.parse(routesData);
                
        for (const [key, value] of Object.entries(savedRoutes)) {
          this.routingTable.set(key, value);
        }
                
        this.logger.info('📋 Tabla de enrutamiento cargada');
      }
    } catch (error) {
      this.logger.warn('⚠️ Error cargando tabla de enrutamiento', { error: error.message });
    }
  }
    
  /**
     * Inicializar balanceador de carga
     */
  async initializeLoadBalancer() {
    this.loadBalancer.clear();
        
    // Configurar estrategias de balanceo
    const strategies = ['round_robin', 'least_connections', 'weighted', 'adaptive'];
        
    for (const strategy of strategies) {
      this.loadBalancer.set(strategy, {
        currentIndex: 0,
        connections: new Map(),
        weights: new Map(),
        performance: new Map()
      });
    }
        
    this.logger.info('⚖️ Balanceador de carga inicializado');
  }
    
  /**
     * Inicializar circuit breakers
     */
  async initializeCircuitBreakers() {
    this.circuitBreakers.clear();
        
    // Configuración por defecto para circuit breakers
    const defaultConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenMaxCalls: 3,
      state: 'closed', // closed, open, half-open
      failures: 0,
      lastFailureTime: null,
      successCount: 0
    };
        
    // Crear circuit breakers para cada agente conocido
    for (const agentId of this.agents.keys()) {
      this.circuitBreakers.set(agentId, { ...defaultConfig });
    }
        
    this.logger.info('🔌 Circuit breakers inicializados');
  }
    
  /**
     * Realizar descubrimiento de agentes
     */
  async performAgentDiscovery() {
    this.logger.info('🔍 Iniciando descubrimiento de agentes');
        
    // Emitir evento de descubrimiento
    this.eventHub.emit('discovery.scan_request', {
      requestId: uuidv4(),
      requestedBy: this.id,
      timestamp: new Date().toISOString()
    });
        
    // Escanear directorio de agentes
    try {
      const agentsDir = path.join(process.cwd(), 'src', 'agents');
      const agentFiles = await fs.readdir(agentsDir);
            
      for (const file of agentFiles) {
        if (file.endsWith('.js') && file !== 'CommunicatorAgent.js') {
          const agentName = path.basename(file, '.js');
                    
          this.eventHub.emit('discovery.agent_discovered', {
            agentName,
            filePath: path.join(agentsDir, file),
            discoveredBy: this.id,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      this.logger.warn('⚠️ Error en descubrimiento de agentes', { error: error.message });
    }
  }
    
  /**
     * Manejar startup del sistema
     */
  async handleSystemStartup(data) {
    this.logger.info('🌟 Sistema iniciando - activando CommunicatorAgent');
        
    if (!this.agentState.isInitialized) {
      await this.initialize();
    }
        
    await this.setActive(true);
  }
    
  /**
     * Manejar registro de agente
     */
  async handleAgentRegistration(data) {
    if (this.mutex.agentRegistration) return;
    this.mutex.agentRegistration = true;
        
    try {
      const { agentId, agentInfo, capabilities } = data;
            
      // Registrar agente
      this.agents.set(agentId, {
        ...agentInfo,
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        communicationCount: 0,
        averageResponseTime: 0,
        reliability: 1.0
      });
            
      // Registrar capacidades
      if (capabilities) {
        this.agentCapabilities.set(agentId, capabilities);
      }
            
      // Inicializar métricas
      this.agentMetrics.set(agentId, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: null,
        healthScore: 1.0
      });
            
      // Actualizar estado
      this.agentStatus.set(agentId, 'active');
            
      // Crear circuit breaker
      this.circuitBreakers.set(agentId, {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenMaxCalls: 3,
        state: 'closed',
        failures: 0,
        lastFailureTime: null,
        successCount: 0
      });
            
      // Actualizar tabla de enrutamiento
      await this.updateRoutingTable(agentId, agentInfo);
            
      this.logger.info(`📝 Agente registrado: ${agentInfo.name || agentId}`);
            
      // Notificar registro exitoso
      this.eventHub.emit('communicator.agent_registered', {
        agentId,
        agentInfo,
        registeredBy: this.id,
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      this.logger.error('❌ Error registrando agente', { error: error.message, data });
    } finally {
      this.mutex.agentRegistration = false;
    }
  }
    
  /**
     * Manejar desregistro de agente
     */
  async handleAgentUnregistration(data) {
    const { agentId } = data;
        
    if (this.agents.has(agentId)) {
      // Limpiar registros
      this.agents.delete(agentId);
      this.agentStatus.delete(agentId);
      this.agentCapabilities.delete(agentId);
      this.agentMetrics.delete(agentId);
      this.circuitBreakers.delete(agentId);
            
      // Actualizar tabla de enrutamiento
      this.routingTable.delete(agentId);
            
      this.logger.info(`📤 Agente desregistrado: ${agentId}`);
            
      // Notificar desregistro
      this.eventHub.emit('communicator.agent_unregistered', {
        agentId,
        unregisteredBy: this.id,
        timestamp: new Date().toISOString()
      });
    }
  }
    
  /**
     * Manejar cambio de estado de agente
     */
  async handleAgentStatusChange(data) {
    const { agentId, status, metadata } = data;
        
    if (this.agents.has(agentId)) {
      this.agentStatus.set(agentId, status);
            
      // Actualizar última actividad
      const agentInfo = this.agents.get(agentId);
      agentInfo.lastSeen = new Date().toISOString();
            
      // Actualizar circuit breaker según el estado
      const circuitBreaker = this.circuitBreakers.get(agentId);
      if (circuitBreaker) {
        if (status === 'healthy' || status === 'active') {
          circuitBreaker.failures = 0;
          circuitBreaker.state = 'closed';
        } else if (status === 'error' || status === 'failed') {
          circuitBreaker.failures++;
          if (circuitBreaker.failures >= circuitBreaker.failureThreshold) {
            circuitBreaker.state = 'open';
            circuitBreaker.lastFailureTime = Date.now();
          }
        }
      }
            
      this.logger.debug(`📊 Estado de agente actualizado: ${agentId} -> ${status}`);
    }
  }
    
  /**
     * Manejar actualización de capacidades
     */
  async handleCapabilityUpdate(data) {
    const { agentId, capabilities } = data;
        
    if (this.agents.has(agentId)) {
      this.agentCapabilities.set(agentId, capabilities);
            
      // Actualizar tabla de enrutamiento basada en nuevas capacidades
      await this.updateRoutingTable(agentId, this.agents.get(agentId));
            
      this.logger.debug(`🔧 Capacidades actualizadas para: ${agentId}`);
    }
  }
    
  /**
     * Manejar solicitud de comunicación
     */
  async handleCommunicationRequest(data) {
    if (this.mutex.communication) {
      // Encolar solicitud si hay mutex activo
      setTimeout(() => this.handleCommunicationRequest(data), 10);
      return;
    }
        
    this.mutex.communication = true;
        
    try {
      const { requestId, sourceAgentId, targetAgentId, message, priority = 'normal', timeout = this.config.communicationTimeout } = data;
            
      const startTime = Date.now();
            
      // Verificar circuit breaker
      if (!this.isCircuitBreakerClosed(targetAgentId)) {
        throw new Error(`Circuit breaker abierto para agente: ${targetAgentId}`);
      }
            
      // Encontrar mejor ruta
      const route = await this.findOptimalRoute(sourceAgentId, targetAgentId, message);
            
      if (!route) {
        throw new Error(`No se encontró ruta para: ${targetAgentId}`);
      }
            
      // Enviar mensaje
      const response = await this.sendMessage(route, message, timeout);
            
      // Registrar comunicación exitosa
      const responseTime = Date.now() - startTime;
      await this.recordCommunication(sourceAgentId, targetAgentId, responseTime, true);
            
      // Responder con éxito
      this.eventHub.emit('communication.response', {
        requestId,
        success: true,
        response,
        responseTime,
        route: route.path,
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.recordCommunication(data.sourceAgentId, data.targetAgentId, responseTime, false);
            
      this.logger.error('❌ Error en comunicación', { error: error.message, data });
            
      // Responder con error
      this.eventHub.emit('communication.response', {
        requestId: data.requestId,
        success: false,
        error: error.message,
        responseTime,
        timestamp: new Date().toISOString()
      });
    } finally {
      this.mutex.communication = false;
    }
  }
    
  /**
     * Manejar solicitud de broadcast
     */
  async handleBroadcastRequest(data) {
    const { requestId, sourceAgentId, message, excludeAgents = [], priority = 'normal' } = data;
        
    const results = [];
    const targetAgents = Array.from(this.agents.keys())
      .filter(agentId => agentId !== sourceAgentId && !excludeAgents.includes(agentId));
        
    // Enviar a todos los agentes en paralelo
    const promises = targetAgents.map(async(targetAgentId) => {
      try {
        const route = await this.findOptimalRoute(sourceAgentId, targetAgentId, message);
        if (route && this.isCircuitBreakerClosed(targetAgentId)) {
          const response = await this.sendMessage(route, message);
          results.push({ agentId: targetAgentId, success: true, response });
        } else {
          results.push({ agentId: targetAgentId, success: false, error: 'No disponible' });
        }
      } catch (error) {
        results.push({ agentId: targetAgentId, success: false, error: error.message });
      }
    });
        
    await Promise.allSettled(promises);
        
    // Responder con resultados
    this.eventHub.emit('communication.broadcast_response', {
      requestId,
      results,
      totalTargets: targetAgents.length,
      successfulDeliveries: results.filter(r => r.success).length,
      timestamp: new Date().toISOString()
    });
  }
    
  /**
     * Encontrar ruta óptima
     */
  async findOptimalRoute(sourceAgentId, targetAgentId, message) {
    // Verificar si el agente objetivo existe y está activo
    if (!this.agents.has(targetAgentId)) {
      return null;
    }
        
    const targetStatus = this.agentStatus.get(targetAgentId);
    if (targetStatus !== 'active' && targetStatus !== 'healthy') {
      return null;
    }
        
    // Obtener métricas del agente objetivo
    const metrics = this.agentMetrics.get(targetAgentId);
    const agentInfo = this.agents.get(targetAgentId);
        
    // Calcular score de la ruta
    const routeScore = this.calculateRouteScore(targetAgentId, metrics, agentInfo);
        
    return {
      targetAgentId,
      path: [sourceAgentId, targetAgentId],
      score: routeScore,
      estimatedLatency: metrics?.averageResponseTime || 100,
      reliability: agentInfo?.reliability || 1.0
    };
  }
    
  /**
     * Calcular score de ruta
     */
  calculateRouteScore(agentId, metrics, agentInfo) {
    let score = 100;
        
    // Penalizar por tiempo de respuesta alto
    if (metrics?.averageResponseTime > 1000) {
      score -= 20;
    }
        
    // Penalizar por baja confiabilidad
    if (agentInfo?.reliability < 0.8) {
      score -= 30;
    }
        
    // Penalizar por alta carga
    const currentLoad = this.getCurrentLoad(agentId);
    if (currentLoad > 0.8) {
      score -= 25;
    }
        
    // Bonificar por buen historial
    if (metrics?.successfulRequests > 100 && metrics.successfulRequests / metrics.totalRequests > 0.95) {
      score += 10;
    }
        
    return Math.max(0, score);
  }
    
  /**
     * Enviar mensaje
     */
  async sendMessage(route, message, timeout = this.config.communicationTimeout) {
    const { targetAgentId } = route;
        
    return new Promise((resolve, reject) => {
      const messageId = uuidv4();
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout en comunicación'));
      }, timeout);
            
      // Listener para respuesta
      const responseHandler = (responseData) => {
        if (responseData.messageId === messageId) {
          clearTimeout(timeoutId);
          this.eventHub.off('agent.message_response', responseHandler);
          resolve(responseData.response);
        }
      };
            
      this.eventHub.on('agent.message_response', responseHandler);
            
      // Enviar mensaje
      this.eventHub.emit('agent.message', {
        messageId,
        targetAgentId,
        message,
        route: route.path,
        timestamp: new Date().toISOString()
      });
    });
  }
    
  /**
     * Verificar si circuit breaker está cerrado
     */
  isCircuitBreakerClosed(agentId) {
    const circuitBreaker = this.circuitBreakers.get(agentId);
    if (!circuitBreaker) return true;
        
    const now = Date.now();
        
    switch (circuitBreaker.state) {
    case 'closed':
      return true;
                
    case 'open':
      // Verificar si es tiempo de intentar half-open
      if (now - circuitBreaker.lastFailureTime > circuitBreaker.recoveryTimeout) {
        circuitBreaker.state = 'half-open';
        circuitBreaker.successCount = 0;
        return true;
      }
      return false;
                
    case 'half-open':
      return circuitBreaker.successCount < circuitBreaker.halfOpenMaxCalls;
                
    default:
      return false;
    }
  }
    
  /**
     * Registrar comunicación
     */
  async recordCommunication(sourceAgentId, targetAgentId, responseTime, success) {
    // Actualizar métricas del agente objetivo
    const metrics = this.agentMetrics.get(targetAgentId);
    if (metrics) {
      metrics.totalRequests++;
      if (success) {
        metrics.successfulRequests++;
      } else {
        metrics.failedRequests++;
      }
            
      // Actualizar tiempo de respuesta promedio
      metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;
      metrics.lastRequestTime = Date.now();
            
      // Calcular health score
      metrics.healthScore = metrics.successfulRequests / metrics.totalRequests;
    }
        
    // Actualizar circuit breaker
    const circuitBreaker = this.circuitBreakers.get(targetAgentId);
    if (circuitBreaker) {
      if (success) {
        circuitBreaker.failures = 0;
        if (circuitBreaker.state === 'half-open') {
          circuitBreaker.successCount++;
          if (circuitBreaker.successCount >= circuitBreaker.halfOpenMaxCalls) {
            circuitBreaker.state = 'closed';
          }
        }
      } else {
        circuitBreaker.failures++;
        if (circuitBreaker.failures >= circuitBreaker.failureThreshold) {
          circuitBreaker.state = 'open';
          circuitBreaker.lastFailureTime = Date.now();
        }
      }
    }
        
    // Actualizar confiabilidad del agente
    const agentInfo = this.agents.get(targetAgentId);
    if (agentInfo) {
      agentInfo.communicationCount++;
      agentInfo.averageResponseTime = (agentInfo.averageResponseTime + responseTime) / 2;
            
      // Calcular confiabilidad basada en éxito reciente
      const recentSuccess = success ? 1 : 0;
      agentInfo.reliability = (agentInfo.reliability * 0.9) + (recentSuccess * 0.1);
    }
        
    // Agregar al historial
    this.communicationHistory.push({
      id: uuidv4(),
      sourceAgentId,
      targetAgentId,
      responseTime,
      success,
      timestamp: new Date().toISOString()
    });
        
    // Mantener historial limitado
    if (this.communicationHistory.length > this.config.maxEventHistory) {
      this.communicationHistory = this.communicationHistory.slice(-this.config.maxEventHistory);
    }
        
    // Actualizar métricas globales
    this.agentState.totalCommunications++;
    if (success) {
      this.agentState.successfulCommunications++;
    } else {
      this.agentState.failedCommunications++;
    }
        
    this.agentState.averageResponseTime = (this.agentState.averageResponseTime + responseTime) / 2;
  }
    
  /**
     * Obtener carga actual de un agente
     */
  getCurrentLoad(agentId) {
    const metrics = this.agentMetrics.get(agentId);
    if (!metrics) return 0;
        
    const now = Date.now();
    const recentRequests = this.communicationHistory
      .filter(comm => 
        comm.targetAgentId === agentId && 
                now - new Date(comm.timestamp).getTime() < 60000 // Último minuto
      ).length;
        
    // Normalizar carga (asumiendo máximo 100 requests por minuto como carga completa)
    return Math.min(recentRequests / 100, 1.0);
  }
    
  /**
     * Actualizar tabla de enrutamiento
     */
  async updateRoutingTable(agentId, agentInfo) {
    const capabilities = this.agentCapabilities.get(agentId) || [];
        
    // Crear entradas de enrutamiento basadas en capacidades
    for (const capability of capabilities) {
      if (!this.routingTable.has(capability)) {
        this.routingTable.set(capability, []);
      }
            
      const routes = this.routingTable.get(capability);
      if (!routes.find(r => r.agentId === agentId)) {
        routes.push({
          agentId,
          priority: agentInfo.priority || 1,
          weight: agentInfo.weight || 1,
          addedAt: new Date().toISOString()
        });
                
        // Ordenar por prioridad
        routes.sort((a, b) => b.priority - a.priority);
      }
    }
        
    // Guardar tabla de enrutamiento
    await this.saveRoutingTable();
  }
    
  /**
     * Iniciar health check
     */
  startHealthCheck() {
    if (this.timers.healthCheck) {
      clearInterval(this.timers.healthCheck);
    }
        
    this.timers.healthCheck = setInterval(async() => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
        
    this.logger.info('💓 Health check iniciado');
  }
    
  /**
     * Realizar health check
     */
  async performHealthCheck() {
    const results = {};
    const now = Date.now();
        
    for (const [agentId, agentInfo] of this.agents) {
      try {
        // Verificar última actividad
        const lastSeen = new Date(agentInfo.lastSeen).getTime();
        const timeSinceLastSeen = now - lastSeen;
                
        if (timeSinceLastSeen > this.config.healthCheckInterval * 2) {
          results[agentId] = 'inactive';
          this.agentStatus.set(agentId, 'inactive');
        } else {
          // Enviar ping de health check
          try {
            const pingStart = Date.now();
            await this.sendMessage(
              { targetAgentId: agentId, path: [this.id, agentId] },
              { type: 'health_check', timestamp: new Date().toISOString() },
              5000
            );
                        
            const pingTime = Date.now() - pingStart;
            results[agentId] = 'healthy';
            this.agentStatus.set(agentId, 'healthy');
                        
            // Actualizar métricas de ping
            const metrics = this.agentMetrics.get(agentId);
            if (metrics) {
              metrics.lastPingTime = pingTime;
            }
                        
          } catch (error) {
            results[agentId] = 'unhealthy';
            this.agentStatus.set(agentId, 'unhealthy');
          }
        }
                
      } catch (error) {
        results[agentId] = 'error';
        this.agentStatus.set(agentId, 'error');
        this.logger.error(`❌ Error en health check de ${agentId}`, { error: error.message });
      }
    }
        
    this.agentState.lastHealthCheck = new Date().toISOString();
        
    // Emitir resultados
    this.eventHub.emit('communicator.health_check_completed', {
      results,
      totalAgents: this.agents.size,
      healthyAgents: Object.values(results).filter(status => status === 'healthy').length,
      timestamp: new Date().toISOString()
    });
  }
    
  /**
     * Iniciar optimización
     */
  startOptimization() {
    if (this.timers.optimization) {
      clearInterval(this.timers.optimization);
    }
        
    this.timers.optimization = setInterval(async() => {
      await this.performOptimization();
    }, this.config.optimizationInterval);
        
    this.logger.info('🔧 Optimización iniciada');
  }
    
  /**
     * Realizar optimización
     */
  async performOptimization() {
    if (this.mutex.optimization) return;
    this.mutex.optimization = true;
        
    try {
      // Optimizar rutas
      await this.optimizeRoutes();
            
      // Optimizar balanceador de carga
      await this.optimizeLoadBalancer();
            
      // Detectar anomalías
      await this.detectAnomalies();
            
      // Aprender patrones
      await this.learnCommunicationPatterns();
            
      this.logger.debug('🔧 Optimización completada');
            
    } catch (error) {
      this.logger.error('❌ Error en optimización', { error: error.message });
    } finally {
      this.mutex.optimization = false;
    }
  }
    
  /**
     * Optimizar rutas
     */
  async optimizeRoutes() {
    for (const [capability, routes] of this.routingTable) {
      // Reordenar rutas basado en rendimiento actual
      routes.sort((a, b) => {
        const metricsA = this.agentMetrics.get(a.agentId);
        const metricsB = this.agentMetrics.get(b.agentId);
                
        const scoreA = this.calculateRouteScore(a.agentId, metricsA, this.agents.get(a.agentId));
        const scoreB = this.calculateRouteScore(b.agentId, metricsB, this.agents.get(b.agentId));
                
        return scoreB - scoreA;
      });
    }
        
    await this.saveRoutingTable();
  }
    
  /**
     * Optimizar balanceador de carga
     */
  async optimizeLoadBalancer() {
    // Actualizar pesos basado en rendimiento
    for (const [agentId, metrics] of this.agentMetrics) {
      const load = this.getCurrentLoad(agentId);
      const healthScore = metrics.healthScore;
      const responseTime = metrics.averageResponseTime;
            
      // Calcular peso óptimo
      let weight = 1.0;
            
      if (healthScore > 0.95 && responseTime < 500) {
        weight = 1.5; // Aumentar peso para agentes eficientes
      } else if (healthScore < 0.8 || responseTime > 2000) {
        weight = 0.5; // Reducir peso para agentes problemáticos
      }
            
      if (load > 0.8) {
        weight *= 0.7; // Reducir peso por alta carga
      }
            
      // Actualizar en todas las estrategias de balanceo
      for (const [strategy, config] of this.loadBalancer) {
        config.weights.set(agentId, weight);
      }
    }
  }
    
  /**
     * Detectar anomalías
     */
  async detectAnomalies() {
    const now = Date.now();
    const recentCommunications = this.communicationHistory
      .filter(comm => now - new Date(comm.timestamp).getTime() < 300000); // Últimos 5 minutos
        
    // Detectar picos de latencia
    const avgResponseTime = recentCommunications.reduce((sum, comm) => sum + comm.responseTime, 0) / recentCommunications.length;
    const highLatencyComms = recentCommunications.filter(comm => comm.responseTime > avgResponseTime * 2);
        
    if (highLatencyComms.length > recentCommunications.length * 0.1) {
      this.evolutiveMetrics.anomalies.push({
        type: 'high_latency_spike',
        severity: 'medium',
        affectedCommunications: highLatencyComms.length,
        averageLatency: avgResponseTime,
        detectedAt: new Date().toISOString()
      });
    }
        
    // Detectar alta tasa de fallos
    const failedComms = recentCommunications.filter(comm => !comm.success);
    const failureRate = failedComms.length / recentCommunications.length;
        
    if (failureRate > 0.05) { // Más del 5% de fallos
      this.evolutiveMetrics.anomalies.push({
        type: 'high_failure_rate',
        severity: 'high',
        failureRate,
        failedCommunications: failedComms.length,
        detectedAt: new Date().toISOString()
      });
    }
        
    // Limpiar anomalías antiguas
    this.evolutiveMetrics.anomalies = this.evolutiveMetrics.anomalies
      .filter(anomaly => now - new Date(anomaly.detectedAt).getTime() < 3600000); // Últimas 1 hora
  }
    
  /**
     * Aprender patrones de comunicación
     */
  async learnCommunicationPatterns() {
    const now = Date.now();
    const recentComms = this.communicationHistory
      .filter(comm => now - new Date(comm.timestamp).getTime() < 3600000); // Última hora
        
    // Analizar patrones de comunicación por agente
    const agentPatterns = new Map();
        
    for (const comm of recentComms) {
      const key = `${comm.sourceAgentId}->${comm.targetAgentId}`;
            
      if (!agentPatterns.has(key)) {
        agentPatterns.set(key, {
          count: 0,
          totalResponseTime: 0,
          successCount: 0,
          failureCount: 0,
          pattern: []
        });
      }
            
      const pattern = agentPatterns.get(key);
      pattern.count++;
      pattern.totalResponseTime += comm.responseTime;
            
      if (comm.success) {
        pattern.successCount++;
      } else {
        pattern.failureCount++;
      }
            
      pattern.pattern.push({
        timestamp: comm.timestamp,
        responseTime: comm.responseTime,
        success: comm.success
      });
    }
        
    // Guardar patrones aprendidos
    for (const [key, pattern] of agentPatterns) {
      this.evolutiveMetrics.learningData.routingOptimizations.set(key, {
        averageResponseTime: pattern.totalResponseTime / pattern.count,
        successRate: pattern.successCount / pattern.count,
        frequency: pattern.count,
        lastUpdated: new Date().toISOString()
      });
    }
  }
    
  /**
     * Iniciar monitoreo de rendimiento
     */
  startPerformanceMonitoring() {
    if (this.timers.monitoring) {
      clearInterval(this.timers.monitoring);
    }
        
    this.timers.monitoring = setInterval(async() => {
      await this.monitorPerformance();
    }, 60000); // Cada minuto
        
    this.logger.info('📊 Monitoreo de rendimiento iniciado');
  }
    
  /**
     * Monitorear rendimiento
     */
  async monitorPerformance() {
    const now = Date.now();
    const recentComms = this.communicationHistory
      .filter(comm => now - new Date(comm.timestamp).getTime() < 60000); // Último minuto
        
    // Calcular métricas actuales
    const currentLoad = recentComms.length;
    const avgResponseTime = recentComms.length > 0 
      ? recentComms.reduce((sum, comm) => sum + comm.responseTime, 0) / recentComms.length 
      : 0;
    const successRate = recentComms.length > 0 
      ? recentComms.filter(comm => comm.success).length / recentComms.length 
      : 1;
        
    // Actualizar métricas del agente
    this.agentState.currentLoad = currentLoad;
    this.agentState.averageResponseTime = avgResponseTime;
        
    // Detectar pico de carga
    if (currentLoad > this.agentState.peakLoad) {
      this.agentState.peakLoad = currentLoad;
    }
        
    // Emitir alerta si hay problemas de rendimiento
    if (avgResponseTime > 2000 || successRate < 0.9) {
      this.eventHub.emit('communicator.performance_alert', {
        type: 'performance_degradation',
        metrics: {
          currentLoad,
          avgResponseTime,
          successRate
        },
        timestamp: new Date().toISOString()
      });
    }
  }
    
  /**
     * Manejar solicitud de health check
     */
  async handleHealthCheckRequest(data) {
    const healthStatus = {
      agentId: this.id,
      name: this.name,
      isActive: this.agentState.isActive,
      isInitialized: this.agentState.isInitialized,
      registeredAgents: this.agents.size,
      activeAgents: Array.from(this.agentStatus.values()).filter(status => status === 'active' || status === 'healthy').length,
      totalCommunications: this.agentState.totalCommunications,
      successRate: this.agentState.totalCommunications > 0 
        ? this.agentState.successfulCommunications / this.agentState.totalCommunications 
        : 1,
      averageResponseTime: this.agentState.averageResponseTime,
      currentLoad: this.agentState.currentLoad,
      lastHealthCheck: this.agentState.lastHealthCheck,
      timestamp: new Date().toISOString()
    };
        
    this.eventHub.emit('communicator.health_status', {
      requestId: data.requestId,
      healthStatus,
      respondedBy: this.id
    });
  }
    
  /**
     * Manejar solicitud de métricas
     */
  async handleMetricsRequest(data) {
    const metrics = {
      agentMetrics: Object.fromEntries(this.agentMetrics),
      communicationHistory: this.communicationHistory.slice(-100), // Últimas 100
      routingTable: Object.fromEntries(this.routingTable),
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      evolutiveMetrics: this.evolutiveMetrics,
      globalStats: {
        totalAgents: this.agents.size,
        activeAgents: Array.from(this.agentStatus.values()).filter(status => status === 'active' || status === 'healthy').length,
        totalCommunications: this.agentState.totalCommunications,
        successfulCommunications: this.agentState.successfulCommunications,
        failedCommunications: this.agentState.failedCommunications,
        averageResponseTime: this.agentState.averageResponseTime,
        currentLoad: this.agentState.currentLoad,
        peakLoad: this.agentState.peakLoad
      }
    };
        
    this.eventHub.emit('communicator.metrics_response', {
      requestId: data.requestId,
      metrics,
      timestamp: new Date().toISOString()
    });
  }
    
  /**
     * Manejar alerta de rendimiento
     */
  async handlePerformanceAlert(data) {
    this.logger.warn('⚠️ Alerta de rendimiento recibida', data);
        
    // Implementar acciones correctivas automáticas
    if (data.type === 'high_latency') {
      await this.optimizeRoutes();
    } else if (data.type === 'high_failure_rate') {
      await this.performHealthCheck();
    }
  }
    
  /**
     * Manejar fallo de agente
     */
  async handleAgentFailure(data) {
    const { agentId, error } = data;
        
    this.logger.error(`💥 Fallo de agente detectado: ${agentId}`, { error });
        
    // Marcar agente como fallido
    this.agentStatus.set(agentId, 'failed');
        
    // Abrir circuit breaker
    const circuitBreaker = this.circuitBreakers.get(agentId);
    if (circuitBreaker) {
      circuitBreaker.state = 'open';
      circuitBreaker.failures = circuitBreaker.failureThreshold;
      circuitBreaker.lastFailureTime = Date.now();
    }
        
    // Redirigir tráfico a otros agentes
    await this.redistributeTraffic(agentId);
        
    // Intentar recuperación automática si está habilitada
    if (this.config.autoRecovery) {
      setTimeout(async() => {
        await this.attemptAgentRecovery(agentId);
      }, 30000); // Esperar 30 segundos antes de intentar recuperación
    }
  }
    
  /**
     * Redistribuir tráfico
     */
  async redistributeTraffic(failedAgentId) {
    // Encontrar agentes alternativos con capacidades similares
    const failedCapabilities = this.agentCapabilities.get(failedAgentId) || [];
        
    for (const capability of failedCapabilities) {
      const routes = this.routingTable.get(capability);
      if (routes) {
        // Remover agente fallido de las rutas
        const updatedRoutes = routes.filter(route => route.agentId !== failedAgentId);
        this.routingTable.set(capability, updatedRoutes);
      }
    }
        
    await this.saveRoutingTable();
        
    this.logger.info(`🔄 Tráfico redistribuido para agente fallido: ${failedAgentId}`);
  }
    
  /**
     * Intentar recuperación de agente
     */
  async attemptAgentRecovery(agentId) {
    this.logger.info(`🔄 Intentando recuperación de agente: ${agentId}`);
        
    try {
      // Enviar señal de recuperación
      this.eventHub.emit('agent.recovery_attempt', {
        agentId,
        attemptedBy: this.id,
        timestamp: new Date().toISOString()
      });
            
      // Esperar respuesta
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout en recuperación'));
        }, 10000);
                
        const recoveryHandler = (data) => {
          if (data.agentId === agentId) {
            clearTimeout(timeout);
            this.eventHub.off('agent.recovery_response', recoveryHandler);
            resolve(data);
          }
        };
                
        this.eventHub.on('agent.recovery_response', recoveryHandler);
      });
            
      // Si llegamos aquí, la recuperación fue exitosa
      this.agentStatus.set(agentId, 'recovering');
            
      // Resetear circuit breaker
      const circuitBreaker = this.circuitBreakers.get(agentId);
      if (circuitBreaker) {
        circuitBreaker.state = 'half-open';
        circuitBreaker.failures = 0;
        circuitBreaker.successCount = 0;
      }
            
      this.logger.info(`✅ Recuperación exitosa de agente: ${agentId}`);
            
    } catch (error) {
      this.logger.error(`❌ Fallo en recuperación de agente: ${agentId}`, { error: error.message });
    }
  }
    
  /**
     * Manejar apagado del sistema
     */
  async handleSystemShutdown(data) {
    this.logger.info('🔄 Sistema apagándose - finalizando CommunicatorAgent');
        
    // Detener timers
    this.stopTimers();
        
    // Guardar estado final
    await this.saveAgentState();
    await this.saveRoutingTable();
        
    // Notificar a todos los agentes
    this.eventHub.emit('communicator.shutdown_notification', {
      message: 'CommunicatorAgent finalizando',
      timestamp: new Date().toISOString()
    });
        
    this.agentState.isActive = false;
    this.logger.info('✅ CommunicatorAgent finalizado correctamente');
  }
    
  /**
     * Detener timers
     */
  stopTimers() {
    Object.values(this.timers).forEach(timer => {
      if (timer) {
        clearInterval(timer);
      }
    });
        
    this.timers = {
      healthCheck: null,
      optimization: null,
      cleanup: null,
      monitoring: null
    };
  }
    
  /**
     * Guardar estado del agente
     */
  async saveAgentState() {
    try {
      const stateFile = path.join(process.cwd(), 'storage', 'communicator-agent-state.json');
      await fs.mkdir(path.dirname(stateFile), { recursive: true });
            
      const stateData = {
        agentState: this.agentState,
        config: this.config,
        agents: Object.fromEntries(this.agents),
        agentStatus: Object.fromEntries(this.agentStatus),
        agentCapabilities: Object.fromEntries(this.agentCapabilities),
        agentMetrics: Object.fromEntries(this.agentMetrics),
        evolutiveMetrics: this.evolutiveMetrics
      };
            
      await fs.writeFile(stateFile, JSON.stringify(stateData, null, 2));
    } catch (error) {
      this.logger.warn('⚠️ Error guardando estado del agente', { error: error.message });
    }
  }
    
  /**
     * Cargar estado del agente
     */
  async loadAgentState() {
    try {
      const stateFile = path.join(process.cwd(), 'storage', 'communicator-agent-state.json');
      const exists = await fs.access(stateFile).then(() => true).catch(() => false);
            
      if (exists) {
        const stateData = JSON.parse(await fs.readFile(stateFile, 'utf8'));
                
        // Restaurar estado
        this.agentState = { ...this.agentState, ...stateData.agentState };
        this.config = { ...this.config, ...stateData.config };
                
        // Restaurar mapas
        if (stateData.agents) {
          for (const [key, value] of Object.entries(stateData.agents)) {
            this.agents.set(key, value);
          }
        }
                
        if (stateData.agentStatus) {
          for (const [key, value] of Object.entries(stateData.agentStatus)) {
            this.agentStatus.set(key, value);
          }
        }
                
        if (stateData.agentCapabilities) {
          for (const [key, value] of Object.entries(stateData.agentCapabilities)) {
            this.agentCapabilities.set(key, value);
          }
        }
                
        if (stateData.agentMetrics) {
          for (const [key, value] of Object.entries(stateData.agentMetrics)) {
            this.agentMetrics.set(key, value);
          }
        }
                
        if (stateData.evolutiveMetrics) {
          this.evolutiveMetrics = { ...this.evolutiveMetrics, ...stateData.evolutiveMetrics };
        }
                
        this.logger.info('📋 Estado del agente cargado');
      }
    } catch (error) {
      this.logger.warn('⚠️ Error cargando estado del agente', { error: error.message });
    }
  }
    
  /**
     * Guardar tabla de enrutamiento
     */
  async saveRoutingTable() {
    try {
      const routesFile = path.join(process.cwd(), 'storage', 'routing-table.json');
      await fs.mkdir(path.dirname(routesFile), { recursive: true });
      await fs.writeFile(routesFile, JSON.stringify(Object.fromEntries(this.routingTable), null, 2));
    } catch (error) {
      this.logger.warn('⚠️ Error guardando tabla de enrutamiento', { error: error.message });
    }
  }
    
  /**
     * Obtener capacidades del agente
     */
  getCapabilities() {
    return [
      'agent_discovery',
      'intelligent_routing',
      'load_balancing',
      'circuit_breaking',
      'health_monitoring',
      'performance_optimization',
      'anomaly_detection',
      'auto_recovery',
      'communication_orchestration',
      'adaptive_learning',
      'predictive_scaling',
      'traffic_management'
    ];
  }
    
  /**
     * Obtener información del agente
     */
  getAgentInfo() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      isActive: this.config.isActive,
      isInitialized: this.agentState.isInitialized,
      capabilities: this.getCapabilities(),
      registeredAgents: this.agents.size,
      activeAgents: Array.from(this.agentStatus.values()).filter(status => status === 'active' || status === 'healthy').length,
      totalCommunications: this.agentState.totalCommunications,
      successRate: this.agentState.totalCommunications > 0 
        ? this.agentState.successfulCommunications / this.agentState.totalCommunications 
        : 1,
      averageResponseTime: this.agentState.averageResponseTime,
      currentLoad: this.agentState.currentLoad
    };
  }
    
  /**
     * Limpiar datos antiguos
     */
  async cleanup() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 horas
        
    // Limpiar historial de comunicaciones
    this.communicationHistory = this.communicationHistory
      .filter(comm => new Date(comm.timestamp).getTime() > cutoff);
        
    // Limpiar anomalías antiguas
    this.evolutiveMetrics.anomalies = this.evolutiveMetrics.anomalies
      .filter(anomaly => new Date(anomaly.detectedAt).getTime() > cutoff);
        
    // Limpiar agentes inactivos
    for (const [agentId, agentInfo] of this.agents) {
      const lastSeen = new Date(agentInfo.lastSeen).getTime();
      if (Date.now() - lastSeen > (7 * 24 * 60 * 60 * 1000)) { // 7 días
        this.agents.delete(agentId);
        this.agentStatus.delete(agentId);
        this.agentCapabilities.delete(agentId);
        this.agentMetrics.delete(agentId);
        this.circuitBreakers.delete(agentId);
      }
    }
        
    await this.saveAgentState();
    this.logger.info('🧹 Limpieza de datos antiguos completada');
  }
    
  /**
     * Destructor del agente
     */
  async destroy() {
    this.logger.info('🔄 Destruyendo CommunicatorAgent');
        
    // Detener timers
    this.stopTimers();
        
    // Guardar estado final
    await this.saveAgentState();
    await this.saveRoutingTable();
        
    // Limpiar listeners
    this.eventHub.removeAllListeners();
        
    this.logger.info('✅ CommunicatorAgent destruido correctamente');
  }
}

export default CommunicatorAgent;
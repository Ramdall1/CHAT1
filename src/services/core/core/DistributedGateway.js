import EventEmitter from 'events';
import WebSocket from 'ws';
import crypto from 'crypto';
import os from 'os';
import { createLogger } from './logger.js';

/**
 * Gateway distribuido para sincronización de eventos entre entornos
 * Permite comunicación entre servidores locales, cloud y otros sistemas
 */
class DistributedGateway extends EventEmitter {
  constructor(eventBus, config = {}) {
    super();
        
    this.eventBus = eventBus;
    this.logger = createLogger('DISTRIBUTED_GATEWAY');
    this.config = {
      nodeId: config.nodeId || this.generateNodeId(),
      port: config.port || 8080,
      enableServer: config.enableServer !== false,
      enableClient: config.enableClient !== false,
      heartbeatInterval: config.heartbeatInterval || 30000,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      compression: config.compression !== false,
      encryption: config.encryption || false,
      authentication: config.authentication || false,
      eventFilters: config.eventFilters || [],
      syncPatterns: config.syncPatterns || ['*'], // Patrones de eventos a sincronizar
      ...config
    };
        
    // Estado del gateway
    this.isActive = false;
    this.server = null;
    this.clients = new Map(); // Conexiones salientes
    this.connections = new Map(); // Conexiones entrantes
    this.nodes = new Map(); // Nodos conocidos
    this.messageQueue = [];
    this.syncStats = {
      messagesSent: 0,
      messagesReceived: 0,
      connectionsEstablished: 0,
      connectionsFailed: 0,
      syncErrors: 0,
      lastSyncTime: null,
      uptime: null
    };
        
    // Configuración de nodos remotos
    this.remoteNodes = new Map();
    if (config.remoteNodes) {
      config.remoteNodes.forEach(node => {
        this.addRemoteNode(node);
      });
    }
        
    this.heartbeatTimer = null;
    this.reconnectTimers = new Map();
        
    this.initializeEventHandlers();
  }

  /**
     * Inicia el gateway distribuido
     */
  async start() {
    if (this.isActive) {
      logger.info('🌐 DistributedGateway: Ya está activo');
      return;
    }
        
    logger.info(`🌐 DistributedGateway: Iniciando nodo ${this.config.nodeId}...`);
        
    try {
      // Iniciar servidor si está habilitado
      if (this.config.enableServer) {
        await this.startServer();
      }
            
      // Conectar a nodos remotos si está habilitado
      if (this.config.enableClient) {
        await this.connectToRemoteNodes();
      }
            
      // Iniciar heartbeat
      this.startHeartbeat();
            
      // Registrar listeners del EventBus
      this.registerEventBusListeners();
            
      this.isActive = true;
      this.syncStats.uptime = Date.now();
            
      logger.info('🌐 DistributedGateway: Iniciado exitosamente');
            
      this.emit('gateway.started', {
        nodeId: this.config.nodeId,
        serverEnabled: this.config.enableServer,
        clientEnabled: this.config.enableClient,
        timestamp: new Date().toISOString()
      });
            
    } catch (error) {
      this.logger.error('🌐 DistributedGateway: Error al iniciar:', error);
      throw error;
    }
  }

  /**
     * Detiene el gateway distribuido
     */
  async stop() {
    if (!this.isActive) return;
        
    logger.info('🌐 DistributedGateway: Deteniendo...');
        
    this.isActive = false;
        
    // Detener heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
        
    // Cerrar conexiones de clientes
    for (const [nodeId, client] of this.clients) {
      await this.disconnectFromNode(nodeId);
    }
        
    // Cerrar conexiones entrantes
    for (const [connectionId, connection] of this.connections) {
      connection.close();
    }
        
    // Cerrar servidor
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
        
    // Limpiar timers de reconexión
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
        
    logger.info('🌐 DistributedGateway: Detenido');
        
    this.emit('gateway.stopped', {
      nodeId: this.config.nodeId,
      stats: this.syncStats,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Inicia el servidor WebSocket
     */
  async startServer() {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocket.Server({
          port: this.config.port,
          perMessageDeflate: this.config.compression
        });
                
        this.server.on('connection', (ws, request) => {
          this.handleIncomingConnection(ws, request);
        });
                
        this.server.on('listening', () => {
          logger.info(`🌐 DistributedGateway: Servidor iniciado en puerto ${this.config.port}`);
          resolve();
        });
                
        this.server.on('error', (error) => {
          this.logger.error('🌐 DistributedGateway: Error del servidor:', error);
          reject(error);
        });
                
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
     * Maneja conexiones entrantes
     */
  handleIncomingConnection(ws, request) {
    const connectionId = this.generateConnectionId();
    const clientIP = request.socket.remoteAddress;
        
    logger.info(`🌐 DistributedGateway: Nueva conexión entrante ${connectionId} desde ${clientIP}`);
        
    const connection = {
      id: connectionId,
      ws,
      nodeId: null, // Se establecerá durante el handshake
      ip: clientIP,
      connectedAt: new Date().toISOString(),
      lastHeartbeat: Date.now(),
      authenticated: !this.config.authentication
    };
        
    this.connections.set(connectionId, connection);
    this.syncStats.connectionsEstablished++;
        
    // Configurar listeners
    ws.on('message', (data) => {
      this.handleIncomingMessage(connectionId, data);
    });
        
    ws.on('close', () => {
      this.handleConnectionClose(connectionId);
    });
        
    ws.on('error', (error) => {
      this.logger.error(`🌐 DistributedGateway: Error en conexión ${connectionId}:`, error);
      this.handleConnectionError(connectionId, error);
    });
        
    // Enviar mensaje de bienvenida
    this.sendToConnection(connectionId, {
      type: 'handshake_request',
      nodeId: this.config.nodeId,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Conecta a nodos remotos
     */
  async connectToRemoteNodes() {
    const connectionPromises = [];
        
    for (const [nodeId, nodeConfig] of this.remoteNodes) {
      connectionPromises.push(this.connectToNode(nodeId, nodeConfig));
    }
        
    await Promise.allSettled(connectionPromises);
  }

  /**
     * Conecta a un nodo específico
     */
  async connectToNode(nodeId, nodeConfig) {
    if (this.clients.has(nodeId)) {
      logger.info(`🌐 DistributedGateway: Ya conectado al nodo ${nodeId}`);
      return;
    }
        
    logger.info(`🌐 DistributedGateway: Conectando al nodo ${nodeId} en ${nodeConfig.url}...`);
        
    try {
      const ws = new WebSocket(nodeConfig.url, {
        perMessageDeflate: this.config.compression
      });
            
      const client = {
        nodeId,
        ws,
        config: nodeConfig,
        connectedAt: null,
        lastHeartbeat: Date.now(),
        reconnectAttempts: 0,
        authenticated: false
      };
            
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout conectando a ${nodeId}`));
        }, 10000);
                
        ws.on('open', () => {
          clearTimeout(timeout);
          client.connectedAt = new Date().toISOString();
          this.clients.set(nodeId, client);
          this.syncStats.connectionsEstablished++;
                    
          logger.info(`🌐 DistributedGateway: Conectado al nodo ${nodeId}`);
                    
          // Enviar handshake
          this.sendToNode(nodeId, {
            type: 'handshake_request',
            nodeId: this.config.nodeId,
            timestamp: new Date().toISOString()
          });
                    
          resolve();
        });
                
        ws.on('message', (data) => {
          this.handleNodeMessage(nodeId, data);
        });
                
        ws.on('close', () => {
          this.handleNodeDisconnection(nodeId);
        });
                
        ws.on('error', (error) => {
          clearTimeout(timeout);
          this.logger.error(`🌐 DistributedGateway: Error conectando a ${nodeId}:`, error);
          this.syncStats.connectionsFailed++;
          this.scheduleReconnection(nodeId);
          reject(error);
        });
      });
            
    } catch (error) {
      this.logger.error(`🌐 DistributedGateway: Error conectando a ${nodeId}:`, error);
      this.syncStats.connectionsFailed++;
      this.scheduleReconnection(nodeId);
      throw error;
    }
  }

  /**
     * Maneja mensajes de nodos remotos
     */
  handleNodeMessage(nodeId, data) {
    try {
      const message = JSON.parse(data.toString());
            
      // Actualizar heartbeat
      const client = this.clients.get(nodeId);
      if (client) {
        client.lastHeartbeat = Date.now();
      }
            
      this.processIncomingMessage(nodeId, message);
            
    } catch (error) {
      this.logger.error(`🌐 DistributedGateway: Error procesando mensaje de ${nodeId}:`, error);
      this.syncStats.syncErrors++;
    }
  }

  /**
     * Maneja mensajes de conexiones entrantes
     */
  handleIncomingMessage(connectionId, data) {
    try {
      const message = JSON.parse(data.toString());
      const connection = this.connections.get(connectionId);
            
      if (connection) {
        connection.lastHeartbeat = Date.now();
        this.processIncomingMessage(connection.nodeId || connectionId, message);
      }
            
    } catch (error) {
      this.logger.error(`🌐 DistributedGateway: Error procesando mensaje de conexión ${connectionId}:`, error);
      this.syncStats.syncErrors++;
    }
  }

  /**
     * Procesa mensajes entrantes
     */
  processIncomingMessage(senderId, message) {
    this.syncStats.messagesReceived++;
        
    switch (message.type) {
    case 'handshake_request':
      this.handleHandshakeRequest(senderId, message);
      break;
                
    case 'handshake_response':
      this.handleHandshakeResponse(senderId, message);
      break;
                
    case 'event_sync':
      this.handleEventSync(senderId, message);
      break;
                
    case 'heartbeat':
      this.handleHeartbeat(senderId, message);
      break;
                
    case 'node_discovery':
      this.handleNodeDiscovery(senderId, message);
      break;
                
    case 'sync_request':
      this.handleSyncRequest(senderId, message);
      break;
                
    default:
      logger.info(`🌐 DistributedGateway: Mensaje desconocido de ${senderId}:`, message.type);
    }
  }

  /**
     * Maneja sincronización de eventos
     */
  handleEventSync(senderId, message) {
    const { eventType, eventData, originalNodeId, timestamp, messageId } = message;
        
    // Evitar loops de sincronización
    if (originalNodeId === this.config.nodeId) {
      return;
    }
        
    // Verificar si el evento debe ser sincronizado
    if (!this.shouldSyncEvent(eventType)) {
      return;
    }
        
    logger.info(`🌐 DistributedGateway: Evento sincronizado de ${senderId}: ${eventType}`);
        
    // Emitir evento en el EventBus local con metadatos de sincronización
    this.eventBus.emit(eventType, {
      ...eventData,
      _sync: {
        fromNode: senderId,
        originalNode: originalNodeId,
        syncTimestamp: new Date().toISOString(),
        messageId
      }
    });
        
    this.emit('event.synced', {
      eventType,
      fromNode: senderId,
      originalNode: originalNodeId,
      timestamp
    });
  }

  /**
     * Sincroniza evento a nodos remotos
     */
  syncEventToNodes(eventType, eventData) {
    // Verificar si el evento debe ser sincronizado
    if (!this.shouldSyncEvent(eventType)) {
      return;
    }
        
    // Evitar sincronizar eventos que ya vienen de sincronización
    if (eventData._sync) {
      return;
    }
        
    const message = {
      type: 'event_sync',
      eventType,
      eventData,
      originalNodeId: this.config.nodeId,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId()
    };
        
    // Enviar a todos los nodos conectados
    this.broadcastToNodes(message);
        
    this.syncStats.messagesSent++;
    this.syncStats.lastSyncTime = new Date().toISOString();
        
    logger.info(`🌐 DistributedGateway: Evento ${eventType} sincronizado a ${this.clients.size} nodos`);
  }

  /**
     * Verifica si un evento debe ser sincronizado
     */
  shouldSyncEvent(eventType) {
    // Aplicar filtros de exclusión
    if (this.config.eventFilters.some(filter => eventType.match(filter))) {
      return false;
    }
        
    // Verificar patrones de sincronización
    return this.config.syncPatterns.some(pattern => {
      if (pattern === '*') return true;
      return eventType.match(new RegExp(pattern.replace('*', '.*')));
    });
  }

  /**
     * Envía mensaje a un nodo específico
     */
  sendToNode(nodeId, message) {
    const client = this.clients.get(nodeId);
        
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      logger.warn(`🌐 DistributedGateway: No se puede enviar a nodo ${nodeId} - no conectado`);
      return false;
    }
        
    try {
      const data = JSON.stringify(message);
      client.ws.send(data);
      return true;
    } catch (error) {
      this.logger.error(`🌐 DistributedGateway: Error enviando a nodo ${nodeId}:`, error);
      return false;
    }
  }

  /**
     * Envía mensaje a una conexión específica
     */
  sendToConnection(connectionId, message) {
    const connection = this.connections.get(connectionId);
        
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
        
    try {
      const data = JSON.stringify(message);
      connection.ws.send(data);
      return true;
    } catch (error) {
      this.logger.error(`🌐 DistributedGateway: Error enviando a conexión ${connectionId}:`, error);
      return false;
    }
  }

  /**
     * Difunde mensaje a todos los nodos
     */
  broadcastToNodes(message) {
    let sentCount = 0;
        
    // Enviar a clientes (conexiones salientes)
    for (const [nodeId, client] of this.clients) {
      if (this.sendToNode(nodeId, message)) {
        sentCount++;
      }
    }
        
    // Enviar a conexiones entrantes
    for (const [connectionId, connection] of this.connections) {
      if (connection.authenticated && this.sendToConnection(connectionId, message)) {
        sentCount++;
      }
    }
        
    return sentCount;
  }

  /**
     * Añade nodo remoto
     */
  addRemoteNode(nodeConfig) {
    const { nodeId, url, priority = 'normal', autoConnect = true } = nodeConfig;
        
    this.remoteNodes.set(nodeId, {
      ...nodeConfig,
      priority,
      autoConnect,
      addedAt: new Date().toISOString()
    });
        
    logger.info(`🌐 DistributedGateway: Nodo remoto añadido: ${nodeId} (${url})`);
        
    // Conectar automáticamente si está habilitado y el gateway está activo
    if (autoConnect && this.isActive && this.config.enableClient) {
      this.connectToNode(nodeId, nodeConfig).catch(error => {
        this.logger.error(`🌐 DistributedGateway: Error conectando automáticamente a ${nodeId}:`, error);
      });
    }
  }

  /**
     * Programa reconexión a un nodo
     */
  scheduleReconnection(nodeId) {
    const client = this.clients.get(nodeId);
    const nodeConfig = this.remoteNodes.get(nodeId);
        
    if (!nodeConfig || !nodeConfig.autoConnect) return;
        
    if (client) {
      client.reconnectAttempts++;
            
      if (client.reconnectAttempts >= this.config.maxReconnectAttempts) {
        logger.info(`🌐 DistributedGateway: Máximo de intentos de reconexión alcanzado para ${nodeId}`);
        return;
      }
    }
        
    const delay = this.config.reconnectInterval * Math.pow(2, client ? client.reconnectAttempts : 0);
        
    logger.info(`🌐 DistributedGateway: Programando reconexión a ${nodeId} en ${delay}ms`);
        
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(nodeId);
      this.connectToNode(nodeId, nodeConfig).catch(error => {
        this.logger.error(`🌐 DistributedGateway: Error en reconexión a ${nodeId}:`, error);
      });
    }, delay);
        
    this.reconnectTimers.set(nodeId, timer);
  }

  /**
     * Inicia heartbeat
     */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
      this.checkConnectionHealth();
    }, this.config.heartbeatInterval);
  }

  /**
     * Envía heartbeat a todos los nodos
     */
  sendHeartbeat() {
    const heartbeatMessage = {
      type: 'heartbeat',
      nodeId: this.config.nodeId,
      timestamp: new Date().toISOString(),
      stats: this.getBasicStats()
    };
        
    this.broadcastToNodes(heartbeatMessage);
  }

  /**
     * Verifica salud de conexiones
     */
  checkConnectionHealth() {
    const now = Date.now();
    const timeout = this.config.heartbeatInterval * 3; // 3 intervalos de gracia
        
    // Verificar clientes
    for (const [nodeId, client] of this.clients) {
      if (now - client.lastHeartbeat > timeout) {
        logger.warn(`🌐 DistributedGateway: Nodo ${nodeId} no responde - desconectando`);
        this.disconnectFromNode(nodeId);
      }
    }
        
    // Verificar conexiones entrantes
    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastHeartbeat > timeout) {
        logger.warn(`🌐 DistributedGateway: Conexión ${connectionId} no responde - cerrando`);
        connection.ws.close();
      }
    }
  }

  /**
     * Registra listeners del EventBus
     */
  registerEventBusListeners() {
    // Escuchar todos los eventos para sincronización
    this.eventBus.onAny((eventType, eventData) => {
      this.syncEventToNodes(eventType, eventData);
    });
        
    logger.info('🌐 DistributedGateway: Listeners del EventBus registrados');
  }

  /**
     * Inicializa manejadores de eventos
     */
  initializeEventHandlers() {
    this.on('gateway.started', () => {
      logger.info('🌐 DistributedGateway: Gateway iniciado exitosamente');
    });
        
    this.on('gateway.stopped', () => {
      logger.info('🌐 DistributedGateway: Gateway detenido');
    });
        
    this.on('node.connected', (nodeId) => {
      logger.info(`🌐 DistributedGateway: Nodo ${nodeId} conectado`);
    });
        
    this.on('node.disconnected', (nodeId) => {
      logger.info(`🌐 DistributedGateway: Nodo ${nodeId} desconectado`);
    });
  }

  /**
     * Genera ID de nodo único
     */
  generateNodeId() {
    const hostname = os.hostname();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `node_${hostname}_${timestamp}_${random}`;
  }

  /**
     * Genera ID de conexión único
     */
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
     * Genera ID de mensaje único
     */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
     * Obtiene estadísticas básicas
     */
  getBasicStats() {
    return {
      connectedNodes: this.clients.size,
      incomingConnections: this.connections.size,
      messagesSent: this.syncStats.messagesSent,
      messagesReceived: this.syncStats.messagesReceived,
      uptime: this.syncStats.uptime ? Date.now() - this.syncStats.uptime : 0
    };
  }

  /**
     * Obtiene estadísticas completas
     */
  getStats() {
    return {
      ...this.syncStats,
      nodeId: this.config.nodeId,
      isActive: this.isActive,
      connectedNodes: Array.from(this.clients.keys()),
      incomingConnections: this.connections.size,
      remoteNodes: Array.from(this.remoteNodes.keys()),
      config: {
        port: this.config.port,
        enableServer: this.config.enableServer,
        enableClient: this.config.enableClient,
        syncPatterns: this.config.syncPatterns
      }
    };
  }

  /**
     * Maneja desconexión de nodo
     */
  handleNodeDisconnection(nodeId) {
    logger.info(`🌐 DistributedGateway: Nodo ${nodeId} desconectado`);
        
    this.clients.delete(nodeId);
    this.emit('node.disconnected', nodeId);
        
    // Programar reconexión si es necesario
    this.scheduleReconnection(nodeId);
  }

  /**
     * Desconecta de un nodo
     */
  async disconnectFromNode(nodeId) {
    const client = this.clients.get(nodeId);
        
    if (client) {
      client.ws.close();
      this.clients.delete(nodeId);
    }
        
    // Cancelar timer de reconexión si existe
    const timer = this.reconnectTimers.get(nodeId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(nodeId);
    }
  }

  /**
     * Maneja cierre de conexión entrante
     */
  handleConnectionClose(connectionId) {
    const connection = this.connections.get(connectionId);
        
    if (connection) {
      logger.info(`🌐 DistributedGateway: Conexión ${connectionId} cerrada`);
      this.connections.delete(connectionId);
    }
  }

  /**
     * Maneja handshake request
     */
  handleHandshakeRequest(senderId, message) {
    logger.info(`🌐 DistributedGateway: Handshake request de ${message.nodeId}`);
        
    // Actualizar información del nodo
    const connection = this.connections.get(senderId);
    if (connection) {
      connection.nodeId = message.nodeId;
      connection.authenticated = true;
    }
        
    // Responder con handshake
    const response = {
      type: 'handshake_response',
      nodeId: this.config.nodeId,
      timestamp: new Date().toISOString(),
      accepted: true
    };
        
    if (connection) {
      this.sendToConnection(senderId, response);
    } else {
      this.sendToNode(senderId, response);
    }
  }

  /**
     * Maneja handshake response
     */
  handleHandshakeResponse(senderId, message) {
    logger.info(`🌐 DistributedGateway: Handshake response de ${message.nodeId}`);
        
    const client = this.clients.get(senderId);
    if (client && message.accepted) {
      client.authenticated = true;
      client.reconnectAttempts = 0; // Reset contador de reconexión
      this.emit('node.connected', senderId);
    }
  }

  /**
     * Maneja heartbeat
     */
  handleHeartbeat(senderId, message) {
    // El heartbeat ya se maneja actualizando lastHeartbeat en handleNodeMessage
    // Aquí podríamos agregar lógica adicional si es necesario
  }
}

export default DistributedGateway;
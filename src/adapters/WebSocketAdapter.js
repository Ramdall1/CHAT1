/**
 * WebSocketAdapter - Adaptador WebSocket para Comunicación en Tiempo Real
 * 
 * Implementa comunicación bidireccional en tiempo real usando WebSockets
 * para el sistema event-driven
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { BaseAdapter } from './BaseAdapter.js';
import { createLogger } from '../services/core/core/logger.js';
import WebSocket from 'ws';

const logger = createLogger('WEBSOCKET_ADAPTER');

export class WebSocketAdapter extends BaseAdapter {
  constructor(options = {}) {
    super('WebSocket', { type: 'websocket', ...options });
    
    // Configuración específica de WebSocket
    this.wsConfig = {
      url: options.url || 'ws://localhost:8080',
      protocols: options.protocols || [],
      
      // Configuración del servidor (si actúa como servidor)
      isServer: options.isServer || false,
      port: options.port || 8080,
      host: options.host || 'localhost',
      
      // Configuración de conexión
      handshakeTimeout: options.handshakeTimeout || 30000,
      perMessageDeflate: options.perMessageDeflate !== false,
      maxPayload: options.maxPayload || 100 * 1024 * 1024, // 100MB
      
      // Configuración de ping/pong
      pingInterval: options.pingInterval || 30000,
      pongTimeout: options.pongTimeout || 5000,
      
      // Configuración de autenticación
      enableAuth: options.enableAuth || false,
      authToken: options.authToken || null,
      authHeader: options.authHeader || 'Authorization',
      
      // Configuración de canales
      enableChannels: options.enableChannels !== false,
      defaultChannel: options.defaultChannel || 'default',
      
      ...options.wsConfig
    };
    
    // Estado del WebSocket
    this.ws = null;
    this.server = null;
    this.clients = new Map(); // Para modo servidor
    this.channels = new Map(); // Gestión de canales
    this.subscriptions = new Set(); // Suscripciones activas
    
    // Timers específicos de WebSocket
    this.pingTimer = null;
    this.pongTimer = null;
    
    // Métricas específicas de WebSocket
    this.wsMetrics = {
      messagesPerSecond: 0,
      bytesPerSecond: 0,
      totalBytes: 0,
      totalMessages: 0,
      pingLatency: 0,
      clientCount: 0,
      channelCount: 0
    };
    
    logger.info('WebSocketAdapter inicializado', {
      config: this.wsConfig,
      isServer: this.wsConfig.isServer
    });
  }
  
  /**
   * Conectar WebSocket
   */
  async connect() {
    try {
      if (this.wsConfig.isServer) {
        await this.startServer();
      } else {
        await this.connectClient();
      }
    } catch (error) {
      this.handleError(error, { type: 'connection' });
      throw error;
    }
  }
  
  /**
   * Iniciar servidor WebSocket
   */
  async startServer() {
    return new Promise((resolve, reject) => {
      try {
        const serverOptions = {
          port: this.wsConfig.port,
          host: this.wsConfig.host,
          perMessageDeflate: this.wsConfig.perMessageDeflate,
          maxPayload: this.wsConfig.maxPayload,
          handshakeTimeout: this.wsConfig.handshakeTimeout
        };
        
        this.server = new WebSocket.Server(serverOptions);
        
        this.server.on('connection', (ws, request) => {
          this.handleClientConnection(ws, request);
        });
        
        this.server.on('listening', () => {
          logger.info(`Servidor WebSocket iniciado en ${this.wsConfig.host}:${this.wsConfig.port}`);
          this.handleConnect();
          resolve();
        });
        
        this.server.on('error', (error) => {
          logger.error('Error en servidor WebSocket:', error);
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Conectar como cliente WebSocket
   */
  async connectClient() {
    return new Promise((resolve, reject) => {
      try {
        const wsOptions = {
          protocols: this.wsConfig.protocols,
          handshakeTimeout: this.wsConfig.handshakeTimeout,
          perMessageDeflate: this.wsConfig.perMessageDeflate,
          maxPayload: this.wsConfig.maxPayload
        };
        
        // Añadir autenticación si está habilitada
        if (this.wsConfig.enableAuth && this.wsConfig.authToken) {
          wsOptions.headers = {
            [this.wsConfig.authHeader]: this.wsConfig.authToken
          };
        }
        
        this.ws = new WebSocket(this.wsConfig.url, wsOptions);
        
        this.ws.on('open', () => {
          logger.info(`Cliente WebSocket conectado a ${this.wsConfig.url}`);
          this.setupClientHandlers();
          this.handleConnect();
          resolve();
        });
        
        this.ws.on('error', (error) => {
          logger.error('Error en cliente WebSocket:', error);
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Manejar conexión de cliente (modo servidor)
   */
  handleClientConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      connectedAt: new Date().toISOString(),
      channels: new Set([this.wsConfig.defaultChannel]),
      lastActivity: Date.now()
    };
    
    this.clients.set(clientId, clientInfo);
    this.wsMetrics.clientCount = this.clients.size;
    
    // Configurar handlers del cliente
    this.setupClientHandlers(ws, clientId);
    
    // Añadir cliente al canal por defecto
    this.addClientToChannel(clientId, this.wsConfig.defaultChannel);
    
    logger.info(`Cliente ${clientId} conectado desde ${clientInfo.ip}`);
    
    // Enviar mensaje de bienvenida
    this.sendToClient(clientId, {
      type: 'welcome',
      clientId: clientId,
      timestamp: new Date().toISOString()
    });
    
    this.emit('client:connected', clientInfo);
  }
  
  /**
   * Configurar handlers del cliente
   */
  setupClientHandlers(ws = this.ws, clientId = null) {
    ws.on('message', (data) => {
      this.handleMessage(data, clientId);
    });
    
    ws.on('close', (code, reason) => {
      this.handleClose(code, reason, clientId);
    });
    
    ws.on('error', (error) => {
      this.handleError(error, { type: 'websocket', clientId });
    });
    
    ws.on('ping', (data) => {
      this.handlePing(data, clientId);
    });
    
    ws.on('pong', (data) => {
      this.handlePong(data, clientId);
    });
    
    // Iniciar ping/pong si está habilitado
    if (this.config.enableHeartbeat) {
      this.startPingPong(ws, clientId);
    }
  }
  
  /**
   * Manejar mensaje recibido
   */
  handleMessage(data, clientId = null) {
    try {
      this.wsMetrics.totalMessages++;
      this.wsMetrics.totalBytes += data.length;
      
      // Actualizar actividad del cliente
      if (clientId && this.clients.has(clientId)) {
        this.clients.get(clientId).lastActivity = Date.now();
      }
      
      // Deserializar mensaje
      const message = this.deserialize(data);
      
      // Procesar mensaje según tipo
      switch (message.type) {
      case 'event':
        this.handleEvent(message.payload);
        break;
          
      case 'subscribe':
        this.handleSubscribe(message.pattern, clientId);
        break;
          
      case 'unsubscribe':
        this.handleUnsubscribe(message.pattern, clientId);
        break;
          
      case 'join_channel':
        this.handleJoinChannel(message.channel, clientId);
        break;
          
      case 'leave_channel':
        this.handleLeaveChannel(message.channel, clientId);
        break;
          
      case 'ping':
        this.handlePingMessage(message, clientId);
        break;
          
      case 'pong':
        this.handlePongMessage(message, clientId);
        break;
          
      default:
        this.handleEvent(message);
      }
      
    } catch (error) {
      this.handleError(error, { type: 'message_processing', clientId, data });
    }
  }
  
  /**
   * Manejar cierre de conexión
   */
  handleClose(code, reason, clientId = null) {
    if (clientId && this.clients.has(clientId)) {
      const client = this.clients.get(clientId);
      
      // Remover cliente de todos los canales
      for (const channel of client.channels) {
        this.removeClientFromChannel(clientId, channel);
      }
      
      this.clients.delete(clientId);
      this.wsMetrics.clientCount = this.clients.size;
      
      logger.info(`Cliente ${clientId} desconectado: ${code} - ${reason}`);
      this.emit('client:disconnected', { clientId, code, reason });
    } else {
      // Cliente principal desconectado
      this.handleDisconnect(`${code} - ${reason}`);
    }
  }
  
  /**
   * Manejar ping
   */
  handlePing(data, clientId = null) {
    const timestamp = Date.now();
    
    if (clientId) {
      // Responder pong al cliente específico
      const client = this.clients.get(clientId);
      if (client) {
        client.ws.pong(data);
      }
    } else {
      // Responder pong al servidor
      if (this.ws) {
        this.ws.pong(data);
      }
    }
    
    logger.debug(`Ping recibido${clientId ? ` de cliente ${clientId}` : ''}`);
  }
  
  /**
   * Manejar pong
   */
  handlePong(data, clientId = null) {
    const timestamp = Date.now();
    
    try {
      const pingData = JSON.parse(data.toString());
      const latency = timestamp - pingData.timestamp;
      
      this.wsMetrics.pingLatency = latency;
      this.handleHeartbeat();
      
      logger.debug(`Pong recibido${clientId ? ` de cliente ${clientId}` : ''}, latencia: ${latency}ms`);
      
    } catch (error) {
      // Pong sin datos de timestamp
      this.handleHeartbeat();
    }
  }
  
  /**
   * Iniciar ping/pong
   */
  startPingPong(ws, clientId = null) {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const pingData = JSON.stringify({
          timestamp: Date.now(),
          clientId: clientId
        });
        
        ws.ping(pingData);
      } else {
        clearInterval(interval);
      }
    }, this.wsConfig.pingInterval);
    
    return interval;
  }
  
  /**
   * Manejar suscripción
   */
  async handleSubscribe(pattern, clientId = null) {
    this.subscriptions.add(pattern);
    
    if (clientId) {
      // Suscripción específica del cliente
      const client = this.clients.get(clientId);
      if (client) {
        if (!client.subscriptions) {
          client.subscriptions = new Set();
        }
        client.subscriptions.add(pattern);
      }
    }
    
    logger.info(`Suscripción añadida: ${pattern}${clientId ? ` para cliente ${clientId}` : ''}`);
    this.emit('subscribed', { pattern, clientId });
  }
  
  /**
   * Manejar desuscripción
   */
  async handleUnsubscribe(pattern, clientId = null) {
    if (clientId) {
      // Desuscripción específica del cliente
      const client = this.clients.get(clientId);
      if (client && client.subscriptions) {
        client.subscriptions.delete(pattern);
      }
    } else {
      this.subscriptions.delete(pattern);
    }
    
    logger.info(`Suscripción removida: ${pattern}${clientId ? ` para cliente ${clientId}` : ''}`);
    this.emit('unsubscribed', { pattern, clientId });
  }
  
  /**
   * Manejar unión a canal
   */
  handleJoinChannel(channel, clientId) {
    if (!clientId || !this.clients.has(clientId)) return;
    
    this.addClientToChannel(clientId, channel);
    
    this.sendToClient(clientId, {
      type: 'channel_joined',
      channel: channel,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Cliente ${clientId} se unió al canal ${channel}`);
  }
  
  /**
   * Manejar salida de canal
   */
  handleLeaveChannel(channel, clientId) {
    if (!clientId || !this.clients.has(clientId)) return;
    
    this.removeClientFromChannel(clientId, channel);
    
    this.sendToClient(clientId, {
      type: 'channel_left',
      channel: channel,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Cliente ${clientId} salió del canal ${channel}`);
  }
  
  /**
   * Añadir cliente a canal
   */
  addClientToChannel(clientId, channel) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    
    this.channels.get(channel).add(clientId);
    
    const client = this.clients.get(clientId);
    if (client) {
      client.channels.add(channel);
    }
    
    this.wsMetrics.channelCount = this.channels.size;
  }
  
  /**
   * Remover cliente de canal
   */
  removeClientFromChannel(clientId, channel) {
    if (this.channels.has(channel)) {
      this.channels.get(channel).delete(clientId);
      
      // Remover canal si está vacío
      if (this.channels.get(channel).size === 0) {
        this.channels.delete(channel);
      }
    }
    
    const client = this.clients.get(clientId);
    if (client) {
      client.channels.delete(channel);
    }
    
    this.wsMetrics.channelCount = this.channels.size;
  }
  
  /**
   * Enviar evento
   */
  async send(event, options = {}) {
    if (!this.isConnected) {
      if (this.config.enableBuffering) {
        return this.bufferEvent(event);
      } else {
        throw new Error('WebSocket no está conectado');
      }
    }
    
    try {
      const message = {
        type: 'event',
        payload: event,
        timestamp: new Date().toISOString(),
        ...options
      };
      
      const serializedMessage = this.serialize(message);
      
      if (this.wsConfig.isServer) {
        // Enviar a clientes según opciones
        await this.broadcastToClients(serializedMessage, options);
      } else {
        // Enviar al servidor
        await this.sendToServer(serializedMessage);
      }
      
      this.metrics.eventsSent++;
      
    } catch (error) {
      this.handleError(error, { type: 'transmission', event });
      throw error;
    }
  }
  
  /**
   * Enviar al servidor (modo cliente)
   */
  async sendToServer(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      throw new Error('Conexión WebSocket no disponible');
    }
  }
  
  /**
   * Enviar a cliente específico
   */
  async sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      const serializedData = typeof data === 'string' ? data : this.serialize(data);
      client.ws.send(serializedData);
      return true;
    }
    return false;
  }
  
  /**
   * Broadcast a clientes
   */
  async broadcastToClients(data, options = {}) {
    const {
      channel = null,
      clientIds = null,
      excludeClientIds = null,
      subscription = null
    } = options;
    
    let targetClients = [];
    
    if (clientIds) {
      // Enviar a clientes específicos
      targetClients = clientIds.filter(id => this.clients.has(id));
    } else if (channel) {
      // Enviar a clientes del canal
      const channelClients = this.channels.get(channel);
      if (channelClients) {
        targetClients = Array.from(channelClients);
      }
    } else {
      // Enviar a todos los clientes
      targetClients = Array.from(this.clients.keys());
    }
    
    // Filtrar clientes excluidos
    if (excludeClientIds) {
      targetClients = targetClients.filter(id => !excludeClientIds.includes(id));
    }
    
    // Filtrar por suscripción
    if (subscription) {
      targetClients = targetClients.filter(clientId => {
        const client = this.clients.get(clientId);
        return client && client.subscriptions && client.subscriptions.has(subscription);
      });
    }
    
    // Enviar a clientes objetivo
    const promises = targetClients.map(clientId => this.sendToClient(clientId, data));
    await Promise.allSettled(promises);
    
    return targetClients.length;
  }
  
  /**
   * Suscribirse a patrón
   */
  async subscribe(pattern) {
    await this.handleSubscribe(pattern);
    
    // Si es cliente, enviar suscripción al servidor
    if (!this.wsConfig.isServer && this.ws) {
      const message = {
        type: 'subscribe',
        pattern: pattern,
        timestamp: new Date().toISOString()
      };
      
      await this.sendToServer(this.serialize(message));
    }
  }
  
  /**
   * Desuscribirse de patrón
   */
  async unsubscribe(pattern) {
    await this.handleUnsubscribe(pattern);
    
    // Si es cliente, enviar desuscripción al servidor
    if (!this.wsConfig.isServer && this.ws) {
      const message = {
        type: 'unsubscribe',
        pattern: pattern,
        timestamp: new Date().toISOString()
      };
      
      await this.sendToServer(this.serialize(message));
    }
  }
  
  /**
   * Desconectar
   */
  async disconnect() {
    logger.info('Desconectando WebSocket...');
    
    // Detener ping/pong
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.wsConfig.isServer && this.server) {
      // Cerrar servidor
      return new Promise((resolve) => {
        // Cerrar todas las conexiones de clientes
        for (const [clientId, client] of this.clients) {
          client.ws.close(1000, 'Server shutdown');
        }
        
        this.server.close(() => {
          logger.info('Servidor WebSocket cerrado');
          this.handleDisconnect('server_shutdown');
          resolve();
        });
      });
    } else if (this.ws) {
      // Cerrar cliente
      return new Promise((resolve) => {
        this.ws.close(1000, 'Client disconnect');
        this.ws.on('close', () => {
          logger.info('Cliente WebSocket desconectado');
          resolve();
        });
      });
    }
  }
  
  /**
   * Enviar heartbeat
   */
  async sendHeartbeat() {
    if (this.wsConfig.isServer) {
      // Enviar ping a todos los clientes
      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          const pingData = JSON.stringify({
            timestamp: Date.now(),
            type: 'heartbeat'
          });
          client.ws.ping(pingData);
        }
      }
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Enviar ping al servidor
      const pingData = JSON.stringify({
        timestamp: Date.now(),
        type: 'heartbeat'
      });
      this.ws.ping(pingData);
    }
  }
  
  /**
   * Generar ID de cliente
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Obtener información de clientes
   */
  getClients() {
    const clients = {};
    for (const [clientId, client] of this.clients) {
      clients[clientId] = {
        id: client.id,
        ip: client.ip,
        userAgent: client.userAgent,
        connectedAt: client.connectedAt,
        channels: Array.from(client.channels),
        subscriptions: client.subscriptions ? Array.from(client.subscriptions) : [],
        lastActivity: client.lastActivity,
        isConnected: client.ws.readyState === WebSocket.OPEN
      };
    }
    return clients;
  }
  
  /**
   * Obtener información de canales
   */
  getChannels() {
    const channels = {};
    for (const [channel, clients] of this.channels) {
      channels[channel] = {
        name: channel,
        clientCount: clients.size,
        clients: Array.from(clients)
      };
    }
    return channels;
  }
  
  /**
   * Obtener métricas específicas de WebSocket
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();
    
    return {
      ...baseMetrics,
      websocket: {
        ...this.wsMetrics,
        subscriptions: this.subscriptions.size,
        isServer: this.wsConfig.isServer,
        url: this.wsConfig.url,
        port: this.wsConfig.port
      }
    };
  }
  
  /**
   * Obtener estado específico de WebSocket
   */
  getState() {
    const baseState = super.getState();
    
    return {
      ...baseState,
      websocket: {
        isServer: this.wsConfig.isServer,
        url: this.wsConfig.url,
        port: this.wsConfig.port,
        clientCount: this.clients.size,
        channelCount: this.channels.size,
        subscriptionCount: this.subscriptions.size,
        readyState: this.ws ? this.ws.readyState : null
      }
    };
  }
}

export default WebSocketAdapter;
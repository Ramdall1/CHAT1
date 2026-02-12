/**
 * MQTTAdapter - Adaptador MQTT para Comunicación IoT
 * 
 * Implementa comunicación MQTT para dispositivos IoT y sistemas distribuidos
 * con soporte para QoS, retención de mensajes y last will
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { BaseAdapter } from './BaseAdapter.js';
import { createLogger } from '../services/core/core/logger.js';
import mqtt from 'mqtt';

const logger = createLogger('MQTT_ADAPTER');

export class MQTTAdapter extends BaseAdapter {
  constructor(options = {}) {
    super('MQTT', { type: 'mqtt', ...options });
    
    // Configuración específica de MQTT
    this.mqttConfig = {
      // Configuración de conexión
      host: options.host || 'localhost',
      port: options.port || 1883,
      protocol: options.protocol || 'mqtt', // mqtt, mqtts, ws, wss
      
      // Configuración de cliente
      clientId: options.clientId || this.generateClientId(),
      clean: options.clean !== false,
      keepalive: options.keepalive || 60,
      connectTimeout: options.connectTimeout || 30000,
      
      // Configuración de autenticación
      username: options.username || null,
      password: options.password || null,
      
      // Configuración SSL/TLS
      ca: options.ca || null,
      cert: options.cert || null,
      key: options.key || null,
      rejectUnauthorized: options.rejectUnauthorized !== false,
      
      // Configuración de Will (Last Will and Testament)
      will: {
        topic: options.will?.topic || `${this.name}/status`,
        payload: options.will?.payload || 'offline',
        qos: options.will?.qos || 1,
        retain: options.will?.retain !== false
      },
      
      // Configuración de tópicos
      topicPrefix: options.topicPrefix || 'chatbot/',
      topicSeparator: options.topicSeparator || '/',
      enableWildcards: options.enableWildcards !== false,
      
      // Configuración de QoS
      defaultQoS: options.defaultQoS || 1, // 0: At most once, 1: At least once, 2: Exactly once
      publishQoS: options.publishQoS || 1,
      subscribeQoS: options.subscribeQoS || 1,
      
      // Configuración de retención
      enableRetain: options.enableRetain || false,
      retainedMessagesTTL: options.retainedMessagesTTL || 24 * 60 * 60 * 1000, // 24 horas
      
      // Configuración de mensajes
      maxMessageSize: options.maxMessageSize || 256 * 1024, // 256KB
      enableCompression: options.enableCompression || false,
      
      ...options.mqttConfig
    };
    
    // Cliente MQTT
    this.client = null;
    
    // Gestión de tópicos y suscripciones
    this.subscriptions = new Map(); // topic -> { qos, callback, subscribedAt }
    this.retainedMessages = new Map(); // topic -> { message, timestamp }
    this.pendingMessages = new Map(); // messageId -> { message, timestamp, retries }
    
    // Métricas específicas de MQTT
    this.mqttMetrics = {
      messagesPublished: 0,
      messagesReceived: 0,
      messagesRetained: 0,
      subscriptionsActive: 0,
      qos0Messages: 0,
      qos1Messages: 0,
      qos2Messages: 0,
      duplicateMessages: 0,
      retransmissions: 0,
      averageLatency: 0,
      connectionUptime: 0
    };
    
    // Timers específicos de MQTT
    this.retainCleanupTimer = null;
    this.metricsUpdateTimer = null;
    
    logger.info('MQTTAdapter inicializado', {
      clientId: this.mqttConfig.clientId,
      host: this.mqttConfig.host,
      port: this.mqttConfig.port,
      protocol: this.mqttConfig.protocol
    });
  }
  
  /**
   * Conectar cliente MQTT
   */
  async connect() {
    try {
      const connectionOptions = this.buildConnectionOptions();
      
      this.client = mqtt.connect(this.buildConnectionUrl(), connectionOptions);
      
      this.setupEventHandlers();
      
      // Esperar conexión
      await this.waitForConnection();
      
      // Configurar timers
      this.startRetainCleanupTimer();
      this.startMetricsUpdateTimer();
      
      this.handleConnect();
      
    } catch (error) {
      this.handleError(error, { type: 'connection' });
      throw error;
    }
  }
  
  /**
   * Construir URL de conexión
   */
  buildConnectionUrl() {
    const { protocol, host, port } = this.mqttConfig;
    return `${protocol}://${host}:${port}`;
  }
  
  /**
   * Construir opciones de conexión
   */
  buildConnectionOptions() {
    const options = {
      clientId: this.mqttConfig.clientId,
      clean: this.mqttConfig.clean,
      keepalive: this.mqttConfig.keepalive,
      connectTimeout: this.mqttConfig.connectTimeout
    };
    
    // Autenticación
    if (this.mqttConfig.username) {
      options.username = this.mqttConfig.username;
    }
    if (this.mqttConfig.password) {
      options.password = this.mqttConfig.password;
    }
    
    // SSL/TLS
    if (this.mqttConfig.ca) {
      options.ca = this.mqttConfig.ca;
    }
    if (this.mqttConfig.cert) {
      options.cert = this.mqttConfig.cert;
    }
    if (this.mqttConfig.key) {
      options.key = this.mqttConfig.key;
    }
    options.rejectUnauthorized = this.mqttConfig.rejectUnauthorized;
    
    // Will message
    if (this.mqttConfig.will) {
      options.will = {
        topic: this.formatTopic(this.mqttConfig.will.topic),
        payload: this.mqttConfig.will.payload,
        qos: this.mqttConfig.will.qos,
        retain: this.mqttConfig.will.retain
      };
    }
    
    return options;
  }
  
  /**
   * Configurar manejadores de eventos
   */
  setupEventHandlers() {
    this.client.on('connect', (connack) => {
      logger.info(`Cliente MQTT conectado: ${this.mqttConfig.clientId}`, connack);
      this.publishStatusMessage('online');
    });
    
    this.client.on('message', (topic, payload, packet) => {
      this.handleMessage(topic, payload, packet);
    });
    
    this.client.on('error', (error) => {
      this.handleError(error, { type: 'mqtt_client' });
    });
    
    this.client.on('close', () => {
      logger.warn('Conexión MQTT cerrada');
      this.handleDisconnect('connection_closed');
    });
    
    this.client.on('offline', () => {
      logger.warn('Cliente MQTT offline');
      this.handleDisconnect('client_offline');
    });
    
    this.client.on('reconnect', () => {
      logger.info('Reintentando conexión MQTT...');
    });
    
    this.client.on('packetsend', (packet) => {
      this.handlePacketSend(packet);
    });
    
    this.client.on('packetreceive', (packet) => {
      this.handlePacketReceive(packet);
    });
  }
  
  /**
   * Esperar conexión
   */
  waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout de conexión MQTT'));
      }, this.mqttConfig.connectTimeout);
      
      this.client.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.client.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  /**
   * Manejar mensaje recibido
   */
  handleMessage(topic, payload, packet) {
    try {
      this.mqttMetrics.messagesReceived++;
      
      // Actualizar métricas de QoS
      switch (packet.qos) {
      case 0:
        this.mqttMetrics.qos0Messages++;
        break;
      case 1:
        this.mqttMetrics.qos1Messages++;
        break;
      case 2:
        this.mqttMetrics.qos2Messages++;
        break;
      }
      
      // Verificar duplicados
      if (packet.dup) {
        this.mqttMetrics.duplicateMessages++;
        logger.debug(`Mensaje duplicado recibido: ${topic}`);
      }
      
      // Procesar mensaje retenido
      if (packet.retain) {
        this.handleRetainedMessage(topic, payload, packet);
      }
      
      // Deserializar payload
      const message = this.deserializePayload(payload);
      
      // Añadir metadatos MQTT
      message._mqtt = {
        topic: topic,
        qos: packet.qos,
        retain: packet.retain,
        dup: packet.dup,
        messageId: packet.messageId
      };
      
      // Procesar evento
      this.handleEvent(message);
      
      logger.debug(`Mensaje MQTT recibido: ${topic} (QoS: ${packet.qos})`);
      
    } catch (error) {
      this.handleError(error, { type: 'message_processing', topic, packet });
    }
  }
  
  /**
   * Manejar mensaje retenido
   */
  handleRetainedMessage(topic, payload, packet) {
    this.retainedMessages.set(topic, {
      payload: payload,
      packet: packet,
      timestamp: Date.now()
    });
    
    this.mqttMetrics.messagesRetained++;
    
    logger.debug(`Mensaje retenido almacenado: ${topic}`);
  }
  
  /**
   * Manejar envío de paquete
   */
  handlePacketSend(packet) {
    if (packet.cmd === 'publish') {
      // Rastrear mensajes pendientes para QoS > 0
      if (packet.qos > 0 && packet.messageId) {
        this.pendingMessages.set(packet.messageId, {
          packet: packet,
          timestamp: Date.now(),
          retries: 0
        });
      }
    }
  }
  
  /**
   * Manejar recepción de paquete
   */
  handlePacketReceive(packet) {
    if (packet.cmd === 'puback' || packet.cmd === 'pubcomp') {
      // Remover mensaje de pendientes
      if (packet.messageId && this.pendingMessages.has(packet.messageId)) {
        const pendingMessage = this.pendingMessages.get(packet.messageId);
        const latency = Date.now() - pendingMessage.timestamp;
        
        // Actualizar métricas de latencia
        this.updateLatencyMetrics(latency);
        
        this.pendingMessages.delete(packet.messageId);
        
        logger.debug(`Confirmación recibida para mensaje ${packet.messageId} (latencia: ${latency}ms)`);
      }
    }
  }
  
  /**
   * Enviar evento
   */
  async send(event, options = {}) {
    if (!this.isConnected) {
      if (this.config.enableBuffering) {
        return this.bufferEvent(event);
      } else {
        throw new Error('Cliente MQTT no está conectado');
      }
    }
    
    try {
      const topic = options.topic || 'events';
      const formattedTopic = this.formatTopic(topic);
      const payload = this.serializePayload(event);
      
      const publishOptions = {
        qos: options.qos || this.mqttConfig.publishQoS,
        retain: options.retain || this.mqttConfig.enableRetain,
        dup: options.dup || false
      };
      
      // Verificar tamaño del mensaje
      if (payload.length > this.mqttConfig.maxMessageSize) {
        throw new Error(`Mensaje excede el tamaño máximo: ${payload.length} > ${this.mqttConfig.maxMessageSize}`);
      }
      
      await this.publishMessage(formattedTopic, payload, publishOptions);
      
      this.metrics.eventsSent++;
      this.mqttMetrics.messagesPublished++;
      
      logger.debug(`Evento MQTT enviado: ${formattedTopic} (QoS: ${publishOptions.qos})`);
      
    } catch (error) {
      this.handleError(error, { type: 'transmission', event, options });
      throw error;
    }
  }
  
  /**
   * Publicar mensaje
   */
  publishMessage(topic, payload, options) {
    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, options, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Suscribirse a tópico
   */
  async subscribe(pattern) {
    if (!this.isConnected) {
      throw new Error('Cliente MQTT no está conectado');
    }
    
    try {
      const topic = this.formatTopic(pattern);
      const qos = this.mqttConfig.subscribeQoS;
      
      await this.subscribeToTopic(topic, qos);
      
      this.subscriptions.set(pattern, {
        topic: topic,
        qos: qos,
        subscribedAt: Date.now(),
        messageCount: 0
      });
      
      this.mqttMetrics.subscriptionsActive = this.subscriptions.size;
      
      logger.info(`Suscrito a tópico MQTT: ${topic} (QoS: ${qos})`);
      
    } catch (error) {
      this.handleError(error, { type: 'subscription', pattern });
      throw error;
    }
  }
  
  /**
   * Suscribirse a tópico específico
   */
  subscribeToTopic(topic, qos) {
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, { qos }, (error, granted) => {
        if (error) {
          reject(error);
        } else {
          logger.debug('Suscripción confirmada:', granted);
          resolve(granted);
        }
      });
    });
  }
  
  /**
   * Desuscribirse de tópico
   */
  async unsubscribe(pattern) {
    if (!this.isConnected) {
      throw new Error('Cliente MQTT no está conectado');
    }
    
    try {
      const subscription = this.subscriptions.get(pattern);
      if (!subscription) {
        logger.warn(`No se encontró suscripción para: ${pattern}`);
        return;
      }
      
      await this.unsubscribeFromTopic(subscription.topic);
      
      this.subscriptions.delete(pattern);
      this.mqttMetrics.subscriptionsActive = this.subscriptions.size;
      
      logger.info(`Desuscrito de tópico MQTT: ${subscription.topic}`);
      
    } catch (error) {
      this.handleError(error, { type: 'unsubscription', pattern });
      throw error;
    }
  }
  
  /**
   * Desuscribirse de tópico específico
   */
  unsubscribeFromTopic(topic) {
    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Desconectar cliente MQTT
   */
  async disconnect() {
    logger.info('Desconectando cliente MQTT...');
    
    try {
      // Detener timers
      this.stopRetainCleanupTimer();
      this.stopMetricsUpdateTimer();
      
      // Publicar mensaje de estado offline
      if (this.isConnected) {
        await this.publishStatusMessage('offline');
      }
      
      // Cerrar conexión
      if (this.client) {
        await this.closeConnection();
      }
      
      this.handleDisconnect('manual_disconnect');
      
    } catch (error) {
      this.handleError(error, { type: 'disconnection' });
    }
  }
  
  /**
   * Cerrar conexión
   */
  closeConnection() {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, {}, () => {
          logger.info('Cliente MQTT desconectado');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  
  /**
   * Publicar mensaje de estado
   */
  async publishStatusMessage(status) {
    try {
      const statusTopic = this.formatTopic(this.mqttConfig.will.topic);
      const statusPayload = JSON.stringify({
        status: status,
        timestamp: new Date().toISOString(),
        clientId: this.mqttConfig.clientId
      });
      
      await this.publishMessage(statusTopic, statusPayload, {
        qos: this.mqttConfig.will.qos,
        retain: this.mqttConfig.will.retain
      });
      
      logger.debug(`Estado publicado: ${status}`);
      
    } catch (error) {
      logger.error('Error publicando estado:', error);
    }
  }
  
  /**
   * Formatear tópico
   */
  formatTopic(topic) {
    const prefix = this.mqttConfig.topicPrefix;
    const separator = this.mqttConfig.topicSeparator;
    
    // Reemplazar puntos con separador MQTT
    const formattedTopic = topic.replace(/\./g, separator);
    
    // Añadir prefijo si no está presente
    if (prefix && !formattedTopic.startsWith(prefix)) {
      return prefix + formattedTopic;
    }
    
    return formattedTopic;
  }
  
  /**
   * Serializar payload
   */
  serializePayload(event) {
    try {
      const message = {
        timestamp: new Date().toISOString(),
        source: this.name,
        event: event
      };
      
      let serialized = JSON.stringify(message);
      
      // Aplicar compresión si está habilitada
      if (this.mqttConfig.enableCompression) {
        serialized = this.compressPayload(serialized);
      }
      
      return serialized;
      
    } catch (error) {
      this.handleError(error, { type: 'serialization', event });
      throw error;
    }
  }
  
  /**
   * Deserializar payload
   */
  deserializePayload(payload) {
    try {
      let data = payload.toString();
      
      // Descomprimir si es necesario
      if (this.mqttConfig.enableCompression) {
        data = this.decompressPayload(data);
      }
      
      return JSON.parse(data);
      
    } catch (error) {
      this.handleError(error, { type: 'deserialization', payload });
      throw error;
    }
  }
  
  /**
   * Comprimir payload (implementación simple)
   */
  compressPayload(data) {
    // Implementación básica - en producción usar zlib o similar
    return data;
  }
  
  /**
   * Descomprimir payload (implementación simple)
   */
  decompressPayload(data) {
    // Implementación básica - en producción usar zlib o similar
    return data;
  }
  
  /**
   * Generar ID de cliente
   */
  generateClientId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `chatbot_${timestamp}_${random}`;
  }
  
  /**
   * Actualizar métricas de latencia
   */
  updateLatencyMetrics(latency) {
    // Calcular promedio móvil
    const alpha = 0.1;
    this.mqttMetrics.averageLatency = this.mqttMetrics.averageLatency * (1 - alpha) + latency * alpha;
  }
  
  /**
   * Iniciar timer de limpieza de mensajes retenidos
   */
  startRetainCleanupTimer() {
    this.retainCleanupTimer = setInterval(() => {
      this.cleanupRetainedMessages();
    }, 60000); // Cada minuto
  }
  
  /**
   * Detener timer de limpieza
   */
  stopRetainCleanupTimer() {
    if (this.retainCleanupTimer) {
      clearInterval(this.retainCleanupTimer);
      this.retainCleanupTimer = null;
    }
  }
  
  /**
   * Limpiar mensajes retenidos expirados
   */
  cleanupRetainedMessages() {
    const now = Date.now();
    const ttl = this.mqttConfig.retainedMessagesTTL;
    
    for (const [topic, message] of this.retainedMessages) {
      if (now - message.timestamp > ttl) {
        this.retainedMessages.delete(topic);
        logger.debug(`Mensaje retenido expirado eliminado: ${topic}`);
      }
    }
  }
  
  /**
   * Iniciar timer de actualización de métricas
   */
  startMetricsUpdateTimer() {
    this.metricsUpdateTimer = setInterval(() => {
      this.updateConnectionUptime();
    }, 1000); // Cada segundo
  }
  
  /**
   * Detener timer de métricas
   */
  stopMetricsUpdateTimer() {
    if (this.metricsUpdateTimer) {
      clearInterval(this.metricsUpdateTimer);
      this.metricsUpdateTimer = null;
    }
  }
  
  /**
   * Actualizar tiempo de conexión
   */
  updateConnectionUptime() {
    if (this.isConnected && this.state.lastConnectTime) {
      const connectTime = new Date(this.state.lastConnectTime).getTime();
      this.mqttMetrics.connectionUptime = Date.now() - connectTime;
    }
  }
  
  /**
   * Obtener mensajes retenidos
   */
  getRetainedMessages() {
    const messages = {};
    for (const [topic, message] of this.retainedMessages) {
      messages[topic] = {
        payload: message.payload.toString(),
        timestamp: message.timestamp,
        qos: message.packet.qos
      };
    }
    return messages;
  }
  
  /**
   * Obtener mensajes pendientes
   */
  getPendingMessages() {
    const messages = {};
    for (const [messageId, message] of this.pendingMessages) {
      messages[messageId] = {
        topic: message.packet.topic,
        qos: message.packet.qos,
        timestamp: message.timestamp,
        retries: message.retries
      };
    }
    return messages;
  }
  
  /**
   * Obtener métricas específicas de MQTT
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();
    
    return {
      ...baseMetrics,
      mqtt: {
        ...this.mqttMetrics,
        clientId: this.mqttConfig.clientId,
        protocol: this.mqttConfig.protocol,
        host: this.mqttConfig.host,
        port: this.mqttConfig.port,
        retainedMessagesCount: this.retainedMessages.size,
        pendingMessagesCount: this.pendingMessages.size
      }
    };
  }
  
  /**
   * Obtener estado específico de MQTT
   */
  getState() {
    const baseState = super.getState();
    
    return {
      ...baseState,
      mqtt: {
        clientId: this.mqttConfig.clientId,
        protocol: this.mqttConfig.protocol,
        host: this.mqttConfig.host,
        port: this.mqttConfig.port,
        subscriptions: Array.from(this.subscriptions.keys()),
        retainedMessages: this.retainedMessages.size,
        pendingMessages: this.pendingMessages.size,
        connected: this.client ? this.client.connected : false
      }
    };
  }
  
  /**
   * Obtener información de suscripciones
   */
  getSubscriptions() {
    const subscriptions = {};
    for (const [pattern, subscription] of this.subscriptions) {
      subscriptions[pattern] = {
        topic: subscription.topic,
        qos: subscription.qos,
        subscribedAt: subscription.subscribedAt,
        messageCount: subscription.messageCount
      };
    }
    return subscriptions;
  }
}

export default MQTTAdapter;
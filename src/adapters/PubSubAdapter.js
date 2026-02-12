/**
 * PubSubAdapter - Adaptador Pub/Sub para Comunicación Distribuida
 * 
 * Implementa patrón Publisher/Subscriber para comunicación distribuida
 * usando Redis, Google Cloud Pub/Sub, o implementación local
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { BaseAdapter } from './BaseAdapter.js';
import { createLogger } from '../services/core/core/logger.js';
import { EventEmitter } from 'events';

const logger = createLogger('PUBSUB_ADAPTER');

export class PubSubAdapter extends BaseAdapter {
  constructor(options = {}) {
    super('PubSub', { type: 'pubsub', ...options });
    
    // Configuración específica de Pub/Sub
    this.pubsubConfig = {
      provider: options.provider || 'local', // local, redis, gcp, aws
      
      // Configuración de Redis
      redis: {
        host: options.redis?.host || 'localhost',
        port: options.redis?.port || 6379,
        password: options.redis?.password || null,
        db: options.redis?.db || 0,
        keyPrefix: options.redis?.keyPrefix || 'chatbot:events:',
        retryDelayOnFailover: options.redis?.retryDelayOnFailover || 100,
        maxRetriesPerRequest: options.redis?.maxRetriesPerRequest || 3
      },
      
      // Configuración de Google Cloud Pub/Sub
      gcp: {
        projectId: options.gcp?.projectId || null,
        keyFilename: options.gcp?.keyFilename || null,
        topicPrefix: options.gcp?.topicPrefix || 'chatbot-events-',
        subscriptionPrefix: options.gcp?.subscriptionPrefix || 'chatbot-sub-'
      },
      
      // Configuración de AWS SNS/SQS
      aws: {
        region: options.aws?.region || 'us-east-1',
        accessKeyId: options.aws?.accessKeyId || null,
        secretAccessKey: options.aws?.secretAccessKey || null,
        topicPrefix: options.aws?.topicPrefix || 'chatbot-events-',
        queuePrefix: options.aws?.queuePrefix || 'chatbot-queue-'
      },
      
      // Configuración de tópicos
      defaultTopic: options.defaultTopic || 'events',
      topicSeparator: options.topicSeparator || ':',
      enableWildcards: options.enableWildcards !== false,
      
      // Configuración de mensajes
      messageFormat: options.messageFormat || 'json', // json, avro, protobuf
      enableCompression: options.enableCompression || false,
      maxMessageSize: options.maxMessageSize || 1024 * 1024, // 1MB
      
      // Configuración de delivery
      deliveryMode: options.deliveryMode || 'at-least-once', // at-most-once, at-least-once, exactly-once
      enableDeduplication: options.enableDeduplication || false,
      messageRetention: options.messageRetention || 7 * 24 * 60 * 60 * 1000, // 7 días
      
      ...options.pubsubConfig
    };
    
    // Cliente del proveedor
    this.client = null;
    this.publisher = null;
    this.subscriber = null;
    
    // Gestión de tópicos y suscripciones
    this.topics = new Map(); // topic -> metadata
    this.subscriptions = new Map(); // subscription -> metadata
    this.patterns = new Map(); // pattern -> compiled regex
    
    // Cola de mensajes local (para provider local)
    this.messageQueue = new Map(); // topic -> messages[]
    this.localSubscribers = new Map(); // topic -> Set<callback>
    
    // Métricas específicas de Pub/Sub
    this.pubsubMetrics = {
      messagesPublished: 0,
      messagesConsumed: 0,
      topicsCreated: 0,
      subscriptionsCreated: 0,
      duplicatesDetected: 0,
      deliveryFailures: 0,
      averageMessageSize: 0,
      totalMessageSize: 0
    };
    
    logger.info('PubSubAdapter inicializado', {
      provider: this.pubsubConfig.provider,
      config: this.pubsubConfig
    });
  }
  
  /**
   * Conectar al proveedor Pub/Sub
   */
  async connect() {
    try {
      switch (this.pubsubConfig.provider) {
      case 'redis':
        await this.connectRedis();
        break;
      case 'gcp':
        await this.connectGCP();
        break;
      case 'aws':
        await this.connectAWS();
        break;
      case 'local':
      default:
        await this.connectLocal();
        break;
      }
      
      this.handleConnect();
      
    } catch (error) {
      this.handleError(error, { type: 'connection', provider: this.pubsubConfig.provider });
      throw error;
    }
  }
  
  /**
   * Conectar a Redis
   */
  async connectRedis() {
    try {
      // Importar Redis dinámicamente
      const Redis = await import('ioredis').then(m => m.default);
      
      const redisConfig = {
        host: this.pubsubConfig.redis.host,
        port: this.pubsubConfig.redis.port,
        password: this.pubsubConfig.redis.password,
        db: this.pubsubConfig.redis.db,
        keyPrefix: this.pubsubConfig.redis.keyPrefix,
        retryDelayOnFailover: this.pubsubConfig.redis.retryDelayOnFailover,
        maxRetriesPerRequest: this.pubsubConfig.redis.maxRetriesPerRequest,
        lazyConnect: true
      };
      
      // Crear cliente publisher
      this.publisher = new Redis(redisConfig);
      
      // Crear cliente subscriber
      this.subscriber = new Redis(redisConfig);
      
      // Configurar eventos
      this.setupRedisEvents();
      
      // Conectar
      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect()
      ]);
      
      logger.info('Conectado a Redis Pub/Sub');
      
    } catch (error) {
      logger.error('Error conectando a Redis:', error);
      throw error;
    }
  }
  
  /**
   * Conectar a Google Cloud Pub/Sub
   */
  async connectGCP() {
    try {
      // Importar Google Cloud Pub/Sub dinámicamente
      const { PubSub } = await import('@google-cloud/pubsub');
      
      const gcpConfig = {
        projectId: this.pubsubConfig.gcp.projectId
      };
      
      if (this.pubsubConfig.gcp.keyFilename) {
        gcpConfig.keyFilename = this.pubsubConfig.gcp.keyFilename;
      }
      
      this.client = new PubSub(gcpConfig);
      
      logger.info('Conectado a Google Cloud Pub/Sub');
      
    } catch (error) {
      logger.error('Error conectando a Google Cloud Pub/Sub:', error);
      throw error;
    }
  }
  
  /**
   * Conectar a AWS SNS/SQS
   */
  async connectAWS() {
    try {
      // Importar AWS SDK dinámicamente
      const AWS = await import('aws-sdk');
      
      AWS.config.update({
        region: this.pubsubConfig.aws.region,
        accessKeyId: this.pubsubConfig.aws.accessKeyId,
        secretAccessKey: this.pubsubConfig.aws.secretAccessKey
      });
      
      this.publisher = new AWS.SNS();
      this.subscriber = new AWS.SQS();
      
      logger.info('Conectado a AWS SNS/SQS');
      
    } catch (error) {
      logger.error('Error conectando a AWS:', error);
      throw error;
    }
  }
  
  /**
   * Conectar modo local
   */
  async connectLocal() {
    // Implementación local usando EventEmitter
    this.client = new EventEmitter();
    this.client.setMaxListeners(0); // Sin límite de listeners
    
    logger.info('Conectado a Pub/Sub local');
  }
  
  /**
   * Configurar eventos de Redis
   */
  setupRedisEvents() {
    if (!this.subscriber) return;
    
    this.subscriber.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message);
    });
    
    this.subscriber.on('pmessage', (pattern, channel, message) => {
      this.handleRedisPatternMessage(pattern, channel, message);
    });
    
    this.subscriber.on('error', (error) => {
      this.handleError(error, { type: 'redis_subscriber' });
    });
    
    this.publisher.on('error', (error) => {
      this.handleError(error, { type: 'redis_publisher' });
    });
  }
  
  /**
   * Manejar mensaje de Redis
   */
  handleRedisMessage(channel, message) {
    try {
      const event = this.deserialize(message);
      this.handleEvent(event);
      this.pubsubMetrics.messagesConsumed++;
      
    } catch (error) {
      this.handleError(error, { type: 'message_processing', channel, message });
    }
  }
  
  /**
   * Manejar mensaje de patrón de Redis
   */
  handleRedisPatternMessage(pattern, channel, message) {
    try {
      const event = this.deserialize(message);
      event._pattern = pattern;
      event._channel = channel;
      this.handleEvent(event);
      this.pubsubMetrics.messagesConsumed++;
      
    } catch (error) {
      this.handleError(error, { type: 'pattern_message_processing', pattern, channel, message });
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
        throw new Error('PubSub no está conectado');
      }
    }
    
    try {
      const topic = options.topic || this.pubsubConfig.defaultTopic;
      const message = this.prepareMessage(event, options);
      
      switch (this.pubsubConfig.provider) {
      case 'redis':
        await this.publishRedis(topic, message);
        break;
      case 'gcp':
        await this.publishGCP(topic, message);
        break;
      case 'aws':
        await this.publishAWS(topic, message);
        break;
      case 'local':
      default:
        await this.publishLocal(topic, message);
        break;
      }
      
      this.metrics.eventsSent++;
      this.pubsubMetrics.messagesPublished++;
      this.updateMessageSizeMetrics(message);
      
    } catch (error) {
      this.handleError(error, { type: 'transmission', event, options });
      throw error;
    }
  }
  
  /**
   * Preparar mensaje para envío
   */
  prepareMessage(event, options = {}) {
    const message = {
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      event: event,
      metadata: {
        source: this.name,
        version: '2.0.0',
        ...options.metadata
      }
    };
    
    // Añadir deduplicación si está habilitada
    if (this.pubsubConfig.enableDeduplication) {
      message.deduplicationId = this.generateDeduplicationId(event);
    }
    
    return message;
  }
  
  /**
   * Publicar en Redis
   */
  async publishRedis(topic, message) {
    const serializedMessage = this.serialize(message);
    const channel = this.formatTopic(topic);
    
    await this.publisher.publish(channel, serializedMessage);
    
    logger.debug(`Mensaje publicado en Redis: ${channel}`);
  }
  
  /**
   * Publicar en Google Cloud Pub/Sub
   */
  async publishGCP(topic, message) {
    const topicName = this.pubsubConfig.gcp.topicPrefix + topic;
    const gcpTopic = this.client.topic(topicName);
    
    // Crear tópico si no existe
    const [exists] = await gcpTopic.exists();
    if (!exists) {
      await gcpTopic.create();
      this.pubsubMetrics.topicsCreated++;
    }
    
    const serializedMessage = this.serialize(message);
    const dataBuffer = Buffer.from(serializedMessage);
    
    await gcpTopic.publishMessage({
      data: dataBuffer,
      attributes: {
        source: this.name,
        timestamp: message.timestamp
      }
    });
    
    logger.debug(`Mensaje publicado en GCP Pub/Sub: ${topicName}`);
  }
  
  /**
   * Publicar en AWS SNS
   */
  async publishAWS(topic, message) {
    const topicArn = await this.getOrCreateAWSTopic(topic);
    const serializedMessage = this.serialize(message);
    
    const params = {
      TopicArn: topicArn,
      Message: serializedMessage,
      MessageAttributes: {
        source: {
          DataType: 'String',
          StringValue: this.name
        },
        timestamp: {
          DataType: 'String',
          StringValue: message.timestamp
        }
      }
    };
    
    await this.publisher.publish(params).promise();
    
    logger.debug(`Mensaje publicado en AWS SNS: ${topic}`);
  }
  
  /**
   * Publicar localmente
   */
  async publishLocal(topic, message) {
    // Añadir a cola local
    if (!this.messageQueue.has(topic)) {
      this.messageQueue.set(topic, []);
    }
    
    this.messageQueue.get(topic).push(message);
    
    // Emitir evento
    this.client.emit(topic, message);
    
    // Procesar suscriptores locales
    if (this.localSubscribers.has(topic)) {
      const subscribers = this.localSubscribers.get(topic);
      for (const callback of subscribers) {
        try {
          await callback(message.event);
        } catch (error) {
          this.handleError(error, { type: 'local_subscriber', topic });
        }
      }
    }
    
    logger.debug(`Mensaje publicado localmente: ${topic}`);
  }
  
  /**
   * Suscribirse a tópico
   */
  async subscribe(pattern) {
    try {
      switch (this.pubsubConfig.provider) {
      case 'redis':
        await this.subscribeRedis(pattern);
        break;
      case 'gcp':
        await this.subscribeGCP(pattern);
        break;
      case 'aws':
        await this.subscribeAWS(pattern);
        break;
      case 'local':
      default:
        await this.subscribeLocal(pattern);
        break;
      }
      
      this.subscriptions.set(pattern, {
        pattern: pattern,
        subscribedAt: new Date().toISOString(),
        messageCount: 0
      });
      
      logger.info(`Suscrito a patrón: ${pattern}`);
      
    } catch (error) {
      this.handleError(error, { type: 'subscription', pattern });
      throw error;
    }
  }
  
  /**
   * Suscribirse en Redis
   */
  async subscribeRedis(pattern) {
    const channel = this.formatTopic(pattern);
    
    if (this.pubsubConfig.enableWildcards && this.isWildcardPattern(pattern)) {
      await this.subscriber.psubscribe(channel);
    } else {
      await this.subscriber.subscribe(channel);
    }
  }
  
  /**
   * Suscribirse en Google Cloud Pub/Sub
   */
  async subscribeGCP(pattern) {
    const topicName = this.pubsubConfig.gcp.topicPrefix + pattern;
    const subscriptionName = this.pubsubConfig.gcp.subscriptionPrefix + pattern + '-' + this.name;
    
    const topic = this.client.topic(topicName);
    const subscription = topic.subscription(subscriptionName);
    
    // Crear suscripción si no existe
    const [exists] = await subscription.exists();
    if (!exists) {
      await subscription.create();
      this.pubsubMetrics.subscriptionsCreated++;
    }
    
    // Configurar handler de mensajes
    subscription.on('message', (message) => {
      try {
        const event = this.deserialize(message.data.toString());
        this.handleEvent(event);
        message.ack();
        this.pubsubMetrics.messagesConsumed++;
      } catch (error) {
        this.handleError(error, { type: 'gcp_message_processing' });
        message.nack();
      }
    });
    
    subscription.on('error', (error) => {
      this.handleError(error, { type: 'gcp_subscription' });
    });
  }
  
  /**
   * Suscribirse en AWS SQS
   */
  async subscribeAWS(pattern) {
    const queueUrl = await this.getOrCreateAWSQueue(pattern);
    
    // Configurar polling de mensajes
    const pollMessages = async() => {
      try {
        const params = {
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20
        };
        
        const result = await this.subscriber.receiveMessage(params).promise();
        
        if (result.Messages) {
          for (const message of result.Messages) {
            try {
              const event = this.deserialize(message.Body);
              this.handleEvent(event);
              
              // Eliminar mensaje procesado
              await this.subscriber.deleteMessage({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle
              }).promise();
              
              this.pubsubMetrics.messagesConsumed++;
              
            } catch (error) {
              this.handleError(error, { type: 'aws_message_processing' });
            }
          }
        }
        
        // Continuar polling si está conectado
        if (this.isConnected) {
          setImmediate(pollMessages);
        }
        
      } catch (error) {
        this.handleError(error, { type: 'aws_polling' });
        
        // Reintentar después de un delay
        if (this.isConnected) {
          setTimeout(pollMessages, 5000);
        }
      }
    };
    
    // Iniciar polling
    pollMessages();
  }
  
  /**
   * Suscribirse localmente
   */
  async subscribeLocal(pattern) {
    if (!this.localSubscribers.has(pattern)) {
      this.localSubscribers.set(pattern, new Set());
    }
    
    const callback = (message) => {
      this.handleEvent(message.event);
      this.pubsubMetrics.messagesConsumed++;
    };
    
    this.localSubscribers.get(pattern).add(callback);
    this.client.on(pattern, callback);
  }
  
  /**
   * Desuscribirse de tópico
   */
  async unsubscribe(pattern) {
    try {
      switch (this.pubsubConfig.provider) {
      case 'redis':
        await this.unsubscribeRedis(pattern);
        break;
      case 'gcp':
        await this.unsubscribeGCP(pattern);
        break;
      case 'aws':
        await this.unsubscribeAWS(pattern);
        break;
      case 'local':
      default:
        await this.unsubscribeLocal(pattern);
        break;
      }
      
      this.subscriptions.delete(pattern);
      
      logger.info(`Desuscrito de patrón: ${pattern}`);
      
    } catch (error) {
      this.handleError(error, { type: 'unsubscription', pattern });
      throw error;
    }
  }
  
  /**
   * Desuscribirse en Redis
   */
  async unsubscribeRedis(pattern) {
    const channel = this.formatTopic(pattern);
    
    if (this.pubsubConfig.enableWildcards && this.isWildcardPattern(pattern)) {
      await this.subscriber.punsubscribe(channel);
    } else {
      await this.subscriber.unsubscribe(channel);
    }
  }
  
  /**
   * Desuscribirse en Google Cloud Pub/Sub
   */
  async unsubscribeGCP(pattern) {
    const subscriptionName = this.pubsubConfig.gcp.subscriptionPrefix + pattern + '-' + this.name;
    const subscription = this.client.subscription(subscriptionName);
    
    await subscription.close();
  }
  
  /**
   * Desuscribirse en AWS
   */
  async unsubscribeAWS(pattern) {
    // AWS SQS no requiere desuscripción explícita
    // El polling se detiene cuando se desconecta
  }
  
  /**
   * Desuscribirse localmente
   */
  async unsubscribeLocal(pattern) {
    if (this.localSubscribers.has(pattern)) {
      const subscribers = this.localSubscribers.get(pattern);
      for (const callback of subscribers) {
        this.client.off(pattern, callback);
      }
      this.localSubscribers.delete(pattern);
    }
  }
  
  /**
   * Desconectar
   */
  async disconnect() {
    logger.info('Desconectando PubSub...');
    
    try {
      switch (this.pubsubConfig.provider) {
      case 'redis':
        await this.disconnectRedis();
        break;
      case 'gcp':
        await this.disconnectGCP();
        break;
      case 'aws':
        await this.disconnectAWS();
        break;
      case 'local':
      default:
        await this.disconnectLocal();
        break;
      }
      
      this.handleDisconnect('manual_disconnect');
      
    } catch (error) {
      this.handleError(error, { type: 'disconnection' });
    }
  }
  
  /**
   * Desconectar Redis
   */
  async disconnectRedis() {
    if (this.publisher) {
      await this.publisher.disconnect();
    }
    if (this.subscriber) {
      await this.subscriber.disconnect();
    }
  }
  
  /**
   * Desconectar Google Cloud Pub/Sub
   */
  async disconnectGCP() {
    if (this.client) {
      await this.client.close();
    }
  }
  
  /**
   * Desconectar AWS
   */
  async disconnectAWS() {
    // AWS SDK no requiere desconexión explícita
  }
  
  /**
   * Desconectar local
   */
  async disconnectLocal() {
    if (this.client) {
      this.client.removeAllListeners();
    }
    this.localSubscribers.clear();
    this.messageQueue.clear();
  }
  
  /**
   * Formatear tópico
   */
  formatTopic(topic) {
    return topic.replace(/\./g, this.pubsubConfig.topicSeparator);
  }
  
  /**
   * Verificar si es patrón wildcard
   */
  isWildcardPattern(pattern) {
    return pattern.includes('*') || pattern.includes('?') || pattern.includes('[');
  }
  
  /**
   * Generar ID de mensaje
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generar ID de deduplicación
   */
  generateDeduplicationId(event) {
    // Crear hash basado en contenido del evento
    const content = JSON.stringify(event);
    return `dedup_${this.simpleHash(content)}`;
  }
  
  /**
   * Hash simple para deduplicación
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Obtener o crear tópico AWS
   */
  async getOrCreateAWSTopic(topic) {
    const topicName = this.pubsubConfig.aws.topicPrefix + topic;
    
    try {
      const result = await this.publisher.createTopic({ Name: topicName }).promise();
      return result.TopicArn;
    } catch (error) {
      if (error.code === 'TopicAlreadyExists') {
        const result = await this.publisher.listTopics().promise();
        const existingTopic = result.Topics.find(t => t.TopicArn.endsWith(topicName));
        return existingTopic ? existingTopic.TopicArn : null;
      }
      throw error;
    }
  }
  
  /**
   * Obtener o crear cola AWS
   */
  async getOrCreateAWSQueue(pattern) {
    const queueName = this.pubsubConfig.aws.queuePrefix + pattern;
    
    try {
      const result = await this.subscriber.createQueue({ QueueName: queueName }).promise();
      return result.QueueUrl;
    } catch (error) {
      if (error.code === 'QueueAlreadyExists') {
        const result = await this.subscriber.getQueueUrl({ QueueName: queueName }).promise();
        return result.QueueUrl;
      }
      throw error;
    }
  }
  
  /**
   * Actualizar métricas de tamaño de mensaje
   */
  updateMessageSizeMetrics(message) {
    const messageSize = JSON.stringify(message).length;
    this.pubsubMetrics.totalMessageSize += messageSize;
    
    const totalMessages = this.pubsubMetrics.messagesPublished + this.pubsubMetrics.messagesConsumed;
    if (totalMessages > 0) {
      this.pubsubMetrics.averageMessageSize = this.pubsubMetrics.totalMessageSize / totalMessages;
    }
  }
  
  /**
   * Obtener métricas específicas de Pub/Sub
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();
    
    return {
      ...baseMetrics,
      pubsub: {
        ...this.pubsubMetrics,
        provider: this.pubsubConfig.provider,
        topicCount: this.topics.size,
        subscriptionCount: this.subscriptions.size,
        queueSize: Array.from(this.messageQueue.values()).reduce((total, queue) => total + queue.length, 0)
      }
    };
  }
  
  /**
   * Obtener estado específico de Pub/Sub
   */
  getState() {
    const baseState = super.getState();
    
    return {
      ...baseState,
      pubsub: {
        provider: this.pubsubConfig.provider,
        topics: Array.from(this.topics.keys()),
        subscriptions: Array.from(this.subscriptions.keys()),
        localSubscribers: Array.from(this.localSubscribers.keys()),
        messageQueueSize: this.messageQueue.size
      }
    };
  }
  
  /**
   * Obtener información de tópicos
   */
  getTopics() {
    return Object.fromEntries(this.topics);
  }
  
  /**
   * Obtener información de suscripciones
   */
  getSubscriptions() {
    return Object.fromEntries(this.subscriptions);
  }
}

export default PubSubAdapter;
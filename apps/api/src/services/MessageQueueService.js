import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

class MessageQueueService extends EventEmitter {
  constructor() {
    super();
    this.queues = new Map(); // queueName -> { messages: [], processing: false, config: {} }
    this.rateLimits = new Map(); // identifier -> { count: 0, resetTime: timestamp }
    this.workers = new Map(); // queueName -> worker function
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10,
      processingInterval: 100,
      persistenceEnabled: true,
      persistencePath: path.join(process.cwd(), 'data', 'message-queues.json'),
    };
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      totalRetries: 0,
      queuesCreated: 0,
      rateLimitHits: 0,
    };

    this.initialize();
  }

  async initialize() {
    try {
      await this.loadPersistedQueues();
      this.startProcessing();
      logger.info('MessageQueueService initialized successfully');
    } catch (error) {
      logger.error('Error initializing MessageQueueService:', error);
    }
  }

  // Queue Management
  createQueue(name, config = {}) {
    if (this.queues.has(name)) {
      logger.warn(`Queue ${name} already exists`);
      return false;
    }

    const queueConfig = {
      priority: config.priority || 'normal', // high, normal, low
      maxSize: config.maxSize || 1000,
      processingDelay: config.processingDelay || 0,
      retryPolicy: config.retryPolicy || 'exponential',
      deadLetterQueue: config.deadLetterQueue || null,
      rateLimitConfig: config.rateLimitConfig || null,
    };

    this.queues.set(name, {
      messages: [],
      processing: false,
      config: queueConfig,
      stats: {
        processed: 0,
        failed: 0,
        pending: 0,
      },
    });

    this.stats.queuesCreated++;
    logger.info(`Queue ${name} created with config:`, queueConfig);
    this.emit('queueCreated', { name, config: queueConfig });
    return true;
  }

  deleteQueue(name) {
    if (!this.queues.has(name)) {
      return false;
    }

    const queue = this.queues.get(name);
    if (queue.processing) {
      logger.warn(`Cannot delete queue ${name} while processing`);
      return false;
    }

    this.queues.delete(name);
    this.workers.delete(name);
    logger.info(`Queue ${name} deleted`);
    this.emit('queueDeleted', { name });
    return true;
  }

  // Message Operations
  async addMessage(queueName, message, options = {}) {
    if (!this.queues.has(queueName)) {
      this.createQueue(queueName);
    }

    const queue = this.queues.get(queueName);

    // Check queue size limit
    if (queue.messages.length >= queue.config.maxSize) {
      logger.warn(
        `Queue ${queueName} is full (${queue.config.maxSize} messages)`
      );
      return false;
    }

    // Check rate limiting
    if (
      options.rateLimitKey &&
      !this.checkRateLimit(options.rateLimitKey, queue.config.rateLimitConfig)
    ) {
      this.stats.rateLimitHits++;
      logger.warn(`Rate limit exceeded for ${options.rateLimitKey}`);
      return false;
    }

    const messageObj = {
      id: this.generateId(),
      data: message,
      priority: options.priority || queue.config.priority,
      attempts: 0,
      maxRetries: options.maxRetries || this.config.maxRetries,
      createdAt: Date.now(),
      scheduledAt: options.scheduledAt || Date.now(),
      metadata: options.metadata || {},
    };

    // Insert message based on priority
    this.insertMessageByPriority(queue.messages, messageObj);
    queue.stats.pending++;

    logger.debug(`Message added to queue ${queueName}:`, messageObj.id);
    this.emit('messageAdded', { queueName, message: messageObj });

    if (this.config.persistenceEnabled) {
      await this.persistQueues();
    }

    return messageObj.id;
  }

  insertMessageByPriority(messages, message) {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    const messagePriority = priorityOrder[message.priority] || 2;

    let insertIndex = messages.length;
    for (let i = 0; i < messages.length; i++) {
      const currentPriority = priorityOrder[messages[i].priority] || 2;
      if (messagePriority > currentPriority) {
        insertIndex = i;
        break;
      }
    }

    messages.splice(insertIndex, 0, message);
  }

  // Rate Limiting - DESACTIVADO
  checkRateLimit(identifier, rateLimitConfig) {
    return true; // Siempre permitir todas las peticiones
  }

  // Worker Management
  registerWorker(queueName, workerFunction) {
    if (typeof workerFunction !== 'function') {
      throw new Error('Worker must be a function');
    }

    this.workers.set(queueName, workerFunction);
    logger.info(`Worker registered for queue ${queueName}`);
    this.emit('workerRegistered', { queueName });
  }

  unregisterWorker(queueName) {
    this.workers.delete(queueName);
    logger.info(`Worker unregistered for queue ${queueName}`);
    this.emit('workerUnregistered', { queueName });
  }

  // Processing
  startProcessing() {
    setInterval(() => {
      this.processQueues();
    }, this.config.processingInterval);
    logger.info('Queue processing started');
  }

  async processQueues() {
    for (const [queueName, queue] of this.queues) {
      if (
        !queue.processing &&
        queue.messages.length > 0 &&
        this.workers.has(queueName)
      ) {
        await this.processQueue(queueName);
      }
    }
  }

  async processQueue(queueName) {
    const queue = this.queues.get(queueName);
    const worker = this.workers.get(queueName);

    if (!queue || !worker || queue.processing) {
      return;
    }

    queue.processing = true;
    const batch = queue.messages.splice(0, this.config.batchSize);

    try {
      for (const message of batch) {
        await this.processMessage(queueName, message, worker);
      }
    } catch (error) {
      logger.error(`Error processing queue ${queueName}:`, error);
    } finally {
      queue.processing = false;
    }

    if (this.config.persistenceEnabled) {
      await this.persistQueues();
    }
  }

  async processMessage(queueName, message, worker) {
    const queue = this.queues.get(queueName);

    try {
      // Check if message is scheduled for future
      if (message.scheduledAt > Date.now()) {
        this.insertMessageByPriority(queue.messages, message);
        return;
      }

      message.attempts++;
      const result = await worker(message.data, message.metadata);

      // Message processed successfully
      queue.stats.processed++;
      queue.stats.pending--;
      this.stats.totalProcessed++;

      logger.debug(
        `Message ${message.id} processed successfully in queue ${queueName}`
      );
      this.emit('messageProcessed', { queueName, message, result });
    } catch (error) {
      logger.error(
        `Error processing message ${message.id} in queue ${queueName}:`,
        error
      );

      if (message.attempts < message.maxRetries) {
        // Retry message
        const retryDelay = this.calculateRetryDelay(
          message.attempts,
          queue.config.retryPolicy
        );
        message.scheduledAt = Date.now() + retryDelay;
        this.insertMessageByPriority(queue.messages, message);

        this.stats.totalRetries++;
        logger.info(
          `Message ${message.id} scheduled for retry ${message.attempts}/${message.maxRetries} in ${retryDelay}ms`
        );
        this.emit('messageRetry', { queueName, message, error });
      } else {
        // Move to dead letter queue or discard
        queue.stats.failed++;
        queue.stats.pending--;
        this.stats.totalFailed++;

        if (queue.config.deadLetterQueue) {
          await this.addMessage(queue.config.deadLetterQueue, message.data, {
            metadata: {
              ...message.metadata,
              originalQueue: queueName,
              error: error.message,
            },
          });
        }

        logger.error(
          `Message ${message.id} failed permanently in queue ${queueName}`
        );
        this.emit('messageFailed', { queueName, message, error });
      }
    }
  }

  calculateRetryDelay(attempt, retryPolicy) {
    switch (retryPolicy) {
      case 'exponential':
        return this.config.retryDelay * Math.pow(2, attempt - 1);
      case 'linear':
        return this.config.retryDelay * attempt;
      case 'fixed':
      default:
        return this.config.retryDelay;
    }
  }

  // Queue Information
  getQueueInfo(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    return {
      name: queueName,
      messageCount: queue.messages.length,
      processing: queue.processing,
      config: queue.config,
      stats: queue.stats,
      hasWorker: this.workers.has(queueName),
    };
  }

  getAllQueues() {
    const queues = [];
    for (const [name] of this.queues) {
      queues.push(this.getQueueInfo(name));
    }
    return queues;
  }

  getStats() {
    return {
      ...this.stats,
      activeQueues: this.queues.size,
      totalMessages: Array.from(this.queues.values()).reduce(
        (sum, queue) => sum + queue.messages.length,
        0
      ),
      rateLimitEntries: this.rateLimits.size,
    };
  }

  // Persistence
  async persistQueues() {
    try {
      const data = {
        queues: {},
        stats: this.stats,
        timestamp: Date.now(),
      };

      for (const [name, queue] of this.queues) {
        data.queues[name] = {
          messages: queue.messages,
          config: queue.config,
          stats: queue.stats,
        };
      }

      await fs.ensureDir(path.dirname(this.config.persistencePath));
      await fs.writeJson(this.config.persistencePath, data, { spaces: 2 });
    } catch (error) {
      logger.error('Error persisting queues:', error);
    }
  }

  async loadPersistedQueues() {
    try {
      if (await fs.pathExists(this.config.persistencePath)) {
        const data = await fs.readJson(this.config.persistencePath);

        if (data.queues) {
          for (const [name, queueData] of Object.entries(data.queues)) {
            this.queues.set(name, {
              messages: queueData.messages || [],
              processing: false,
              config: queueData.config || {},
              stats: queueData.stats || { processed: 0, failed: 0, pending: 0 },
            });
          }
        }

        if (data.stats) {
          this.stats = { ...this.stats, ...data.stats };
        }

        logger.info(`Loaded ${this.queues.size} persisted queues`);
      }
    } catch (error) {
      logger.error('Error loading persisted queues:', error);
    }
  }

  // Utility Methods
  generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Queue Operations
  pauseQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.config.paused = true;
      logger.info(`Queue ${queueName} paused`);
      this.emit('queuePaused', { queueName });
      return true;
    }
    return false;
  }

  resumeQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.config.paused = false;
      logger.info(`Queue ${queueName} resumed`);
      this.emit('queueResumed', { queueName });
      return true;
    }
    return false;
  }

  clearQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (queue && !queue.processing) {
      const clearedCount = queue.messages.length;
      queue.messages = [];
      queue.stats.pending = 0;
      logger.info(`Cleared ${clearedCount} messages from queue ${queueName}`);
      this.emit('queueCleared', { queueName, clearedCount });
      return clearedCount;
    }
    return 0;
  }

  // Rate Limit Management
  clearRateLimits() {
    this.rateLimits.clear();
    logger.info('All rate limits cleared');
  }

  getRateLimitInfo(identifier) {
    return this.rateLimits.get(identifier) || null;
  }
}

export default MessageQueueService;

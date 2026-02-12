import express from 'express';
import MessageQueueService from '../services/MessageQueueService.js';
import logger from '../utils/logger.js';

const router = express.Router();
const messageQueueService = new MessageQueueService();

// Middleware para validar parámetros
const validateQueueName = (req, res, next) => {
  const { queueName } = req.params;
  if (!queueName || typeof queueName !== 'string') {
    return res
      .status(400)
      .json({ error: 'Queue name is required and must be a string' });
  }
  next();
};

const validateMessage = (req, res, next) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  next();
};

// Queue Management Routes

// GET /api/message-queue/queues - Listar todas las colas
router.get('/queues', (req, res) => {
  try {
    const queues = messageQueueService.getAllQueues();
    res.json({
      success: true,
      queues,
      total: queues.length,
    });
  } catch (error) {
    logger.error('Error getting queues:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/message-queue/queues/:queueName - Obtener información de una cola específica
router.get('/queues/:queueName', validateQueueName, (req, res) => {
  try {
    const { queueName } = req.params;
    const queueInfo = messageQueueService.getQueueInfo(queueName);

    if (!queueInfo) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    res.json({
      success: true,
      queue: queueInfo,
    });
  } catch (error) {
    logger.error('Error getting queue info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/message-queue/queues - Crear una nueva cola
router.post('/queues', (req, res) => {
  try {
    const { name, config = {} } = req.body;

    if (!name || typeof name !== 'string') {
      return res
        .status(400)
        .json({ error: 'Queue name is required and must be a string' });
    }

    const created = messageQueueService.createQueue(name, config);

    if (!created) {
      return res.status(409).json({ error: 'Queue already exists' });
    }

    res.status(201).json({
      success: true,
      message: 'Queue created successfully',
      queue: messageQueueService.getQueueInfo(name),
    });
  } catch (error) {
    logger.error('Error creating queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/message-queue/queues/:queueName - Eliminar una cola
router.delete('/queues/:queueName', validateQueueName, (req, res) => {
  try {
    const { queueName } = req.params;
    const deleted = messageQueueService.deleteQueue(queueName);

    if (!deleted) {
      return res
        .status(404)
        .json({
          error: 'Queue not found or cannot be deleted while processing',
        });
    }

    res.json({
      success: true,
      message: 'Queue deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Message Operations Routes

// POST /api/message-queue/queues/:queueName/messages - Agregar mensaje a la cola
router.post(
  '/queues/:queueName/messages',
  validateQueueName,
  validateMessage,
  async (req, res) => {
    try {
      const { queueName } = req.params;
      const { message, options = {} } = req.body;

      const messageId = await messageQueueService.addMessage(
        queueName,
        message,
        options
      );

      if (!messageId) {
        return res
          .status(400)
          .json({
            error: 'Failed to add message (queue full or rate limited)',
          });
      }

      res.status(201).json({
        success: true,
        messageId,
        message: 'Message added to queue successfully',
      });
    } catch (error) {
      logger.error('Error adding message to queue:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Queue Control Routes

// POST /api/message-queue/queues/:queueName/pause - Pausar una cola
router.post('/queues/:queueName/pause', validateQueueName, (req, res) => {
  try {
    const { queueName } = req.params;
    const paused = messageQueueService.pauseQueue(queueName);

    if (!paused) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    res.json({
      success: true,
      message: 'Queue paused successfully',
    });
  } catch (error) {
    logger.error('Error pausing queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/message-queue/queues/:queueName/resume - Reanudar una cola
router.post('/queues/:queueName/resume', validateQueueName, (req, res) => {
  try {
    const { queueName } = req.params;
    const resumed = messageQueueService.resumeQueue(queueName);

    if (!resumed) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    res.json({
      success: true,
      message: 'Queue resumed successfully',
    });
  } catch (error) {
    logger.error('Error resuming queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/message-queue/queues/:queueName/clear - Limpiar una cola
router.post('/queues/:queueName/clear', validateQueueName, (req, res) => {
  try {
    const { queueName } = req.params;
    const clearedCount = messageQueueService.clearQueue(queueName);

    res.json({
      success: true,
      message: 'Queue cleared successfully',
      clearedMessages: clearedCount,
    });
  } catch (error) {
    logger.error('Error clearing queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Worker Management Routes

// POST /api/message-queue/queues/:queueName/worker - Registrar worker para una cola
router.post('/queues/:queueName/worker', validateQueueName, (req, res) => {
  try {
    const { queueName } = req.params;
    const { workerType = 'default' } = req.body;

    // Registrar workers predefinidos
    let workerFunction;
    switch (workerType) {
      case 'whatsapp':
        workerFunction = async (message, metadata) => {
          // Simular envío de WhatsApp
          logger.info('Sending WhatsApp message:', message);
          await new Promise(resolve => setTimeout(resolve, 100));
          return { sent: true, timestamp: Date.now() };
        };
        break;
      case 'email':
        workerFunction = async (message, metadata) => {
          // Simular envío de email
          logger.info('Sending email:', message);
          await new Promise(resolve => setTimeout(resolve, 200));
          return { sent: true, timestamp: Date.now() };
        };
        break;
      case 'notification':
        workerFunction = async (message, metadata) => {
          // Simular notificación push
          logger.info('Sending notification:', message);
          await new Promise(resolve => setTimeout(resolve, 50));
          return { sent: true, timestamp: Date.now() };
        };
        break;
      case 'webhook':
        workerFunction = async (message, metadata) => {
          // Simular webhook
          logger.info('Sending webhook:', message);
          await new Promise(resolve => setTimeout(resolve, 300));
          return { sent: true, timestamp: Date.now() };
        };
        break;
      default:
        workerFunction = async (message, metadata) => {
          // Worker por defecto
          logger.info('Processing message:', message);
          await new Promise(resolve => setTimeout(resolve, 100));
          return { processed: true, timestamp: Date.now() };
        };
    }

    messageQueueService.registerWorker(queueName, workerFunction);

    res.json({
      success: true,
      message: `Worker ${workerType} registered for queue ${queueName}`,
    });
  } catch (error) {
    logger.error('Error registering worker:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/message-queue/queues/:queueName/worker - Desregistrar worker
router.delete('/queues/:queueName/worker', validateQueueName, (req, res) => {
  try {
    const { queueName } = req.params;
    messageQueueService.unregisterWorker(queueName);

    res.json({
      success: true,
      message: `Worker unregistered for queue ${queueName}`,
    });
  } catch (error) {
    logger.error('Error unregistering worker:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Statistics and Monitoring Routes

// GET /api/message-queue/stats - Obtener estadísticas generales
router.get('/stats', (req, res) => {
  try {
    const stats = messageQueueService.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rate Limiting Routes

// GET /api/message-queue/rate-limits/:identifier - Obtener información de rate limit
router.get('/rate-limits/:identifier', (req, res) => {
  try {
    const { identifier } = req.params;
    const rateLimitInfo = messageQueueService.getRateLimitInfo(identifier);

    res.json({
      success: true,
      rateLimitInfo,
      isLimited:
        rateLimitInfo && rateLimitInfo.count >= rateLimitInfo.maxRequests,
    });
  } catch (error) {
    logger.error('Error getting rate limit info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/message-queue/rate-limits - Limpiar todos los rate limits
router.delete('/rate-limits', (req, res) => {
  try {
    messageQueueService.clearRateLimits();
    res.json({
      success: true,
      message: 'All rate limits cleared',
    });
  } catch (error) {
    logger.error('Error clearing rate limits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk Operations Routes

// POST /api/message-queue/bulk/messages - Agregar múltiples mensajes
router.post('/bulk/messages', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be an array' });
    }

    const results = [];
    for (const messageData of messages) {
      const { queueName, message, options = {} } = messageData;

      if (!queueName || !message) {
        results.push({ error: 'Queue name and message are required' });
        continue;
      }

      try {
        const messageId = await messageQueueService.addMessage(
          queueName,
          message,
          options
        );
        results.push({ messageId, success: !!messageId });
      } catch (error) {
        results.push({ error: error.message });
      }
    }

    res.json({
      success: true,
      results,
      total: messages.length,
      successful: results.filter(r => r.success).length,
    });
  } catch (error) {
    logger.error('Error processing bulk messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health Check Route
router.get('/health', (req, res) => {
  try {
    const stats = messageQueueService.getStats();
    const health = {
      status: 'healthy',
      timestamp: Date.now(),
      queues: stats.activeQueues,
      totalMessages: stats.totalMessages,
      uptime: process.uptime(),
    };

    res.json({
      success: true,
      health,
    });
  } catch (error) {
    logger.error('Error getting health status:', error);
    res.status(500).json({
      success: false,
      health: { status: 'unhealthy', error: error.message },
    });
  }
});

// Event streaming para monitoreo en tiempo real
router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Enviar estadísticas cada 5 segundos
  const statsInterval = setInterval(() => {
    try {
      const stats = messageQueueService.getStats();
      sendEvent('stats', stats);
    } catch (error) {
      sendEvent('error', { message: error.message });
    }
  }, 5000);

  // Escuchar eventos del servicio
  const eventHandlers = {
    messageAdded: data => sendEvent('messageAdded', data),
    messageProcessed: data => sendEvent('messageProcessed', data),
    messageFailed: data => sendEvent('messageFailed', data),
    queueCreated: data => sendEvent('queueCreated', data),
    queueDeleted: data => sendEvent('queueDeleted', data),
  };

  Object.entries(eventHandlers).forEach(([event, handler]) => {
    messageQueueService.on(event, handler);
  });

  req.on('close', () => {
    clearInterval(statsInterval);
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      messageQueueService.removeListener(event, handler);
    });
  });
});

export default router;

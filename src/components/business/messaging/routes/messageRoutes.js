/**
 * Rutas de Mensajes
 * 
 * Define todas las rutas HTTP para la gestión de mensajes,
 * incluyendo middleware de validación y autenticación.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import express from 'express';
import { getMessageController } from '../controllers/MessageController.js';
import { 
  authMiddleware, 
  validateData, 
  errorHandler, 
  rateLimitMiddleware,
  cacheMiddleware,
  validateParams
} from '../../../../services/core/core/middleware.js';

const router = express.Router();
const messageController = getMessageController();

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// Esquemas de validación
const messageValidationSchemas = {
  textMessage: {
    to: { type: 'string', required: true, pattern: /^\+?[1-9]\d{1,14}$/ },
    text: { type: 'string', required: true, minLength: 1, maxLength: 4096 },
    campaignId: { type: 'string', required: false },
    conversationId: { type: 'string', required: false }
  },
  
  templateMessage: {
    to: { type: 'string', required: true, pattern: /^\+?[1-9]\d{1,14}$/ },
    templateId: { type: 'string', required: true, minLength: 1 },
    templateData: { type: 'object', required: false },
    campaignId: { type: 'string', required: false },
    conversationId: { type: 'string', required: false }
  },
  
  mediaMessage: {
    to: { type: 'string', required: true, pattern: /^\+?[1-9]\d{1,14}$/ },
    type: { type: 'string', required: true, enum: ['image', 'video', 'audio', 'document'] },
    mediaUrl: { type: 'string', required: true, pattern: /^https?:\/\/.+/ },
    caption: { type: 'string', required: false, maxLength: 1024 },
    campaignId: { type: 'string', required: false },
    conversationId: { type: 'string', required: false }
  },
  
  scheduleMessage: {
    messageData: { type: 'object', required: true },
    scheduledDate: { type: 'string', required: true }
  },
  
  updateStatus: {
    status: { 
      type: 'string', 
      required: true, 
      enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'scheduled'] 
    },
    whatsappMessageId: { type: 'string', required: false },
    errorCode: { type: 'string', required: false },
    errorMessage: { type: 'string', required: false }
  },
  
  bulkMessages: {
    contacts: { type: 'array', required: true, minItems: 1, maxItems: 1000 },
    messageType: { type: 'string', required: true, enum: ['text', 'template', 'media'] },
    messageData: { type: 'object', required: true },
    campaignId: { type: 'string', required: false }
  }
};

// Rate limiting específico para mensajería
const messagingRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requests por minuto
  message: 'Demasiadas solicitudes de mensajes, intenta de nuevo en un minuto'
});

const bulkMessagingRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requests de mensajes masivos por minuto
  message: 'Demasiadas solicitudes de mensajes masivos, intenta de nuevo en un minuto'
});

/**
 * @route GET /api/messages
 * @desc Obtener todos los mensajes con filtros y paginación
 * @access Private
 */
router.get('/', 
  cacheMiddleware(300), // Cache por 5 minutos
  async(req, res) => {
    await messageController.getAllMessages(req, res);
  }
);

/**
 * @route GET /api/messages/stats
 * @desc Obtener estadísticas de mensajes
 * @access Private
 */
router.get('/stats',
  cacheMiddleware(600), // Cache por 10 minutos
  async(req, res) => {
    await messageController.getMessageStats(req, res);
  }
);

/**
 * @route GET /api/messages/search
 * @desc Buscar mensajes
 * @access Private
 */
router.get('/search',
  async(req, res) => {
    await messageController.searchMessages(req, res);
  }
);

/**
 * @route GET /api/messages/conversation/:phone
 * @desc Obtener conversación con un contacto
 * @access Private
 */
router.get('/conversation/:phone',
  validateParams({
    phone: { type: 'string', required: true, pattern: /^\+?[1-9]\d{1,14}$/ }
  }),
  cacheMiddleware(60), // Cache por 1 minuto
  async(req, res) => {
    await messageController.getConversation(req, res);
  }
);

/**
 * @route GET /api/messages/:id
 * @desc Obtener mensaje por ID
 * @access Private
 */
router.get('/:id',
  validateParams({
    id: { type: 'string', required: true, minLength: 1 }
  }),
  cacheMiddleware(300), // Cache por 5 minutos
  async(req, res) => {
    await messageController.getMessageById(req, res);
  }
);

/**
 * @route POST /api/messages/text
 * @desc Enviar mensaje de texto
 * @access Private
 */
router.post('/text',
  messagingRateLimit,
  validateData(messageValidationSchemas.textMessage),
  async(req, res) => {
    await messageController.sendTextMessage(req, res);
  }
);

/**
 * @route POST /api/messages/template
 * @desc Enviar mensaje de template
 * @access Private
 */
router.post('/template',
  messagingRateLimit,
  validateData(messageValidationSchemas.templateMessage),
  async(req, res) => {
    await messageController.sendTemplateMessage(req, res);
  }
);

/**
 * @route POST /api/messages/media
 * @desc Enviar mensaje multimedia
 * @access Private
 */
router.post('/media',
  messagingRateLimit,
  validateData(messageValidationSchemas.mediaMessage),
  async(req, res) => {
    await messageController.sendMediaMessage(req, res);
  }
);

/**
 * @route POST /api/messages/schedule
 * @desc Programar mensaje
 * @access Private
 */
router.post('/schedule',
  messagingRateLimit,
  validateData(messageValidationSchemas.scheduleMessage),
  async(req, res) => {
    await messageController.scheduleMessage(req, res);
  }
);

/**
 * @route POST /api/messages/process-scheduled
 * @desc Procesar mensajes programados
 * @access Private
 */
router.post('/process-scheduled',
  rateLimitMiddleware({
    windowMs: 60 * 1000,
    max: 5, // máximo 5 requests por minuto
    message: 'Demasiadas solicitudes de procesamiento, intenta de nuevo en un minuto'
  }),
  async(req, res) => {
    await messageController.processScheduledMessages(req, res);
  }
);

/**
 * @route POST /api/messages/receive
 * @desc Recibir mensaje entrante (webhook)
 * @access Private
 */
router.post('/receive',
  rateLimitMiddleware({
    windowMs: 60 * 1000,
    max: 1000, // máximo 1000 webhooks por minuto
    message: 'Demasiados webhooks, intenta de nuevo en un minuto'
  }),
  async(req, res) => {
    await messageController.receiveMessage(req, res);
  }
);

/**
 * @route POST /api/messages/bulk
 * @desc Enviar mensajes masivos
 * @access Private
 */
router.post('/bulk',
  bulkMessagingRateLimit,
  validateData(messageValidationSchemas.bulkMessages),
  async(req, res) => {
    await messageController.sendBulkMessages(req, res);
  }
);

/**
 * @route PUT /api/messages/:id/status
 * @desc Actualizar estado de mensaje
 * @access Private
 */
router.put('/:id/status',
  validateParams({
    id: { type: 'string', required: true, minLength: 1 }
  }),
  validateData(messageValidationSchemas.updateStatus),
  async(req, res) => {
    await messageController.updateMessageStatus(req, res);
  }
);

// Middleware de manejo de errores
router.use(errorHandler);

export default router;
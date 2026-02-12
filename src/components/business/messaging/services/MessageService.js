/**
 * Servicio de Mensajes
 * 
 * Maneja toda la lógica de negocio relacionada con mensajes,
 * incluyendo envío, recepción, programación y gestión de estados.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../../../../services/core/core/logger.js';
import { Message } from '../models/Message.js';
import { getContactService } from '../../contacts/services/ContactService.js';
import { getDatabase, generateId } from '../../../../services/core/core/database.js';
import { Op } from '../../../../adapters/SequelizeAdapter.js';
import config from '../../../../config/environments/index.js';

const logger = createLogger('MESSAGE_SERVICE');

/**
 * Clase personalizada para errores del servicio de mensajes
 */
class MessageServiceError extends Error {
  constructor(message, code = 'MESSAGE_SERVICE_ERROR', statusCode = null, details = null) {
    super(message);
    this.name = 'MessageServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Servicio para gestión de mensajes
 */
export class MessageService {
  constructor() {
    this.db = getDatabase();
    this.contactService = getContactService();
    this.whatsappConfig = config.DIALOG360;
    this.io = null; // Socket.IO instance
    this.connectedClients = new Map(); // Clientes conectados
    this.typingUsers = new Map(); // Usuarios escribiendo
  }

  /**
   * Configurar instancia de Socket.IO
   * @param {object} io - Instancia de Socket.IO
   */
  setSocketIO(io) {
    this.io = io;
    this.setupSocketEvents();
    logger.info('Socket.IO configurado en MessageService');
  }

  /**
   * Configurar eventos de Socket.IO
   */
  setupSocketEvents() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info(`Cliente conectado: ${socket.id}`);
      this.connectedClients.set(socket.id, {
        socketId: socket.id,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      // Unirse a conversaciones
      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        logger.info(`Cliente ${socket.id} se unió a conversación: ${conversationId}`);
      });

      // Salir de conversaciones
      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        logger.info(`Cliente ${socket.id} salió de conversación: ${conversationId}`);
      });

      // Manejar estado de escritura
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Marcar mensajes como leídos
      socket.on('mark_messages_read', async (data) => {
        await this.markMessagesAsRead(data.conversationId, data.messageIds);
      });

      // Desconexión
      socket.on('disconnect', () => {
        logger.info(`Cliente desconectado: ${socket.id}`);
        this.connectedClients.delete(socket.id);
        this.cleanupTypingStatus(socket.id);
      });
    });
  }

  /**
   * Manejar inicio de escritura
   */
  handleTypingStart(socket, data) {
    const { conversationId, userId } = data;
    this.typingUsers.set(`${conversationId}_${userId}`, {
      socketId: socket.id,
      conversationId,
      userId,
      startedAt: new Date()
    });

    // Notificar a otros usuarios en la conversación
    socket.to(`conversation_${conversationId}`).emit('user_typing_start', {
      conversationId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Manejar fin de escritura
   */
  handleTypingStop(socket, data) {
    const { conversationId, userId } = data;
    this.typingUsers.delete(`${conversationId}_${userId}`);

    // Notificar a otros usuarios en la conversación
    socket.to(`conversation_${conversationId}`).emit('user_typing_stop', {
      conversationId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Limpiar estado de escritura al desconectar
   */
  cleanupTypingStatus(socketId) {
    for (const [key, typing] of this.typingUsers.entries()) {
      if (typing.socketId === socketId) {
        this.typingUsers.delete(key);
        // Notificar fin de escritura
        this.io.to(`conversation_${typing.conversationId}`).emit('user_typing_stop', {
          conversationId: typing.conversationId,
          userId: typing.userId,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Emitir evento de nuevo mensaje
   */
  emitNewMessage(messageData, conversationId) {
    if (!this.io) return;

    // Emitir a todos los clientes
    this.io.emit('new_message', {
      ...messageData,
      timestamp: new Date().toISOString()
    });

    // Emitir específicamente a la conversación
    this.io.to(`conversation_${conversationId}`).emit('conversation_message', {
      ...messageData,
      timestamp: new Date().toISOString()
    });

    // Emitir notificación
    this.io.emit('message_notification', {
      type: 'new_message',
      conversationId,
      messageId: messageData.id,
      from: messageData.from,
      preview: this.getMessagePreview(messageData),
      timestamp: new Date().toISOString()
    });

    logger.info(`📡 Evento de nuevo mensaje emitido para conversación ${conversationId}`);
  }

  /**
   * Obtener preview del mensaje
   */
  getMessagePreview(messageData) {
    if (messageData.type === 'text') {
      return messageData.text?.substring(0, 50) + (messageData.text?.length > 50 ? '...' : '');
    } else if (messageData.type === 'image') {
      return '📷 Imagen';
    } else if (messageData.type === 'audio') {
      return '🎵 Audio';
    } else if (messageData.type === 'video') {
      return '🎥 Video';
    } else if (messageData.type === 'document') {
      return '📄 Documento';
    }
    return 'Mensaje';
  }

  /**
   * Marcar mensajes como leídos
   */
  async markMessagesAsRead(conversationId, messageIds = []) {
    try {
      const whereClause = messageIds.length > 0 
        ? { id: { [Op.in]: messageIds } }
        : { 
            direction: 'incoming',
            status: { [Op.ne]: 'read' },
            // Agregar filtro por conversación si es necesario
          };

      await Message.update(
        { 
          status: 'read',
          readAt: new Date()
        },
        { where: whereClause }
      );

      // Emitir evento de mensajes leídos
      if (this.io) {
        this.io.to(`conversation_${conversationId}`).emit('messages_read', {
          conversationId,
          messageIds: messageIds.length > 0 ? messageIds : 'all',
          timestamp: new Date().toISOString()
        });
      }

      logger.info(`Mensajes marcados como leídos en conversación ${conversationId}`);
    } catch (error) {
      logger.error('Error marcando mensajes como leídos:', error);
      throw new MessageServiceError('Error marcando mensajes como leídos', 'MARK_READ_ERROR');
    }
  }

  /**
   * Obtener estadísticas de mensajes no leídos
   */
  async getUnreadStats() {
    try {
      const unreadCount = await Message.count({
        where: {
          direction: 'incoming',
          status: { [Op.ne]: 'read' }
        }
      });

      const unreadByConversation = await Message.findAll({
        attributes: [
          'from',
          [this.db.fn('COUNT', this.db.col('id')), 'unreadCount']
        ],
        where: {
          direction: 'incoming',
          status: { [Op.ne]: 'read' }
        },
        group: ['from']
      });

      return {
        totalUnread: unreadCount,
        byConversation: unreadByConversation.map(item => ({
          conversationId: item.from,
          unreadCount: parseInt(item.dataValues.unreadCount)
        }))
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas de no leídos:', error);
      throw new MessageServiceError('Error obteniendo estadísticas', 'UNREAD_STATS_ERROR');
    }
  }

  /**
   * Obtener clientes conectados
   */
  getConnectedClients() {
    return Array.from(this.connectedClients.values());
  }

  /**
   * Obtener usuarios escribiendo en una conversación
   */
  getTypingUsers(conversationId) {
    const typing = [];
    for (const [key, data] of this.typingUsers.entries()) {
      if (data.conversationId === conversationId) {
        typing.push({
          userId: data.userId,
          startedAt: data.startedAt
        });
      }
    }
    return typing;
  }

  /**
   * Obtener todos los mensajes con filtros y paginación
   * @param {object} options - Opciones de filtrado y paginación
   * @returns {Promise<object>} Lista de mensajes con metadata
   */
  async getAllMessages(options = {}) {
    try {
      if (!this.db) {
        throw new MessageServiceError('Base de datos no inicializada', 'DB_NOT_INITIALIZED');
      }

      const {
        page = 1,
        limit = 50,
        direction = '',
        status = '',
        type = '',
        contactPhone = '',
        campaignId = '',
        dateFrom = '',
        dateTo = '',
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;
      
      // Validar parámetros de paginación
      if (page < 1 || limit < 1 || limit > 1000) {
        throw new MessageServiceError(
          'Parámetros de paginación inválidos. Page debe ser >= 1, limit entre 1 y 1000',
          'INVALID_PAGINATION'
        );
      }
      
      // Construir filtros para Sequelize
      const where = {};
      
      if (direction) {
        where.direction = direction;
      }
      
      if (status) {
        where.status = status;
      }
      
      if (type) {
        where.type = type;
      }
      
      if (campaignId) {
        where.campaignId = campaignId;
      }
      
      if (contactPhone) {
        where[Op.or] = [
          { from: contactPhone },
          { to: contactPhone }
        ];
      }
      
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          if (isNaN(fromDate.getTime())) {
            throw new MessageServiceError('Fecha de inicio inválida', 'INVALID_DATE_FROM');
          }
          where.createdAt[Op.gte] = fromDate;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          if (isNaN(toDate.getTime())) {
            throw new MessageServiceError('Fecha de fin inválida', 'INVALID_DATE_TO');
          }
          where.createdAt[Op.lte] = toDate;
        }
      }
      
      if (search) {
        where[Op.or] = [
          { content: { [Op.like]: `%${search}%` } },
          { from: { [Op.like]: `%${search}%` } },
          { to: { [Op.like]: `%${search}%` } }
        ];
      }
      
      // Usar findAndCountAll de Sequelize
      const result = await this.db.models.Message.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [[sortBy, sortOrder.toUpperCase()]]
      });
      
      // Convertir a instancias de Message
      const messageInstances = result.rows.map(data => {
        try {
          return Message.fromJSON(data.toJSON());
        } catch (error) {
          logger.warn('Error convirtiendo mensaje a instancia:', { messageId: data.id, error: error.message });
          return null;
        }
      }).filter(Boolean);
      
      // Calcular paginación
      const totalPages = Math.ceil(result.count / limit);
      
      logger.info('Mensajes obtenidos exitosamente', {
        total: result.count,
        page,
        limit,
        totalPages,
        filters: { direction, status, type, contactPhone, campaignId }
      });
      
      return {
        messages: messageInstances.map(message => message.toJSON()),
        pagination: {
          currentPage: page,
          totalPages,
          totalMessages: result.count,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      logger.error('Error obteniendo mensajes:', {
        error: error.message,
        code: error.code || 'GET_MESSAGES_ERROR',
        options
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error obteniendo mensajes: ${error.message}`,
        'GET_MESSAGES_ERROR'
      );
    }
  }
  
  /**
   * Obtener mensaje por ID
   * @param {string} id - ID del mensaje
   * @returns {Promise<Message|null>} Mensaje encontrado
   */
  async getMessageById(id) {
    try {
      if (!id) {
        throw new Error('ID de mensaje requerido');
      }

      // Buscar el mensaje usando Sequelize
      const message = await this.db.models.Message.findByPk(id);

      if (!message) {
        logger.warn('Mensaje no encontrado', { messageId: id });
        return null;
      }

      // Convertir a instancia de Message
      const messageInstance = new Message(message.toJSON());

      logger.info('Mensaje obtenido exitosamente', { messageId: id });
      return messageInstance;

    } catch (error) {
      logger.error('Error obteniendo mensaje por ID:', error);
      throw new Error(`Error obteniendo mensaje: ${error.message}`);
    }
  }
  
  /**
   * Crear y enviar mensaje de texto
   * @param {string} to - Número de destino
   * @param {string} text - Texto del mensaje
   * @param {object} options - Opciones adicionales
   * @returns {Promise<Message>} Mensaje creado
   */
  async sendTextMessage(to, text, options = {}) {
    try {
      // Validaciones
      if (!to || typeof to !== 'string') {
        throw new MessageServiceError(
          'Número de destino requerido y debe ser una cadena',
          'INVALID_RECIPIENT'
        );
      }
      
      if (!text || typeof text !== 'string') {
        throw new MessageServiceError(
          'Texto del mensaje requerido y debe ser una cadena',
          'INVALID_MESSAGE_TEXT'
        );
      }
      
      if (text.length > 4096) {
        throw new MessageServiceError(
          'El texto del mensaje excede el límite de 4096 caracteres',
          'MESSAGE_TOO_LONG'
        );
      }
      
      const message = Message.createTextMessage(to, text, {
        id: generateId('msg_', 16),
        from: 'bot',
        ...options
      });
      
      // Guardar mensaje en base de datos usando Sequelize
      const savedMessage = await this.db.models.Message.create(message.toJSON());
      const messageInstance = Message.fromJSON(savedMessage.toJSON());
      
      // Intentar enviar el mensaje
      await this.sendMessage(messageInstance);
      
      // Actualizar última interacción del contacto
      await this.updateContactLastInteraction(to);
      
      // Emitir evento de Socket.IO si está configurado
      if (this.io) {
        const messageData = {
          id: messageInstance.id,
          from: 'bot',
          to,
          type: 'text',
          text,
          timestamp: new Date().toISOString(),
          status: messageInstance.status
        };
        
        // Emitir a todos los clientes conectados
        this.io.emit('new_message', messageData);
        
        // Emitir específicamente a la sala de la conversación
        this.io.to(`conversation_${to}`).emit('conversation_message', messageData);
        
        logger.info(`📡 Socket.IO event emitted for outgoing message to ${to}`);
      }
      
      logger.info('Mensaje de texto enviado exitosamente', {
        messageId: messageInstance.id,
        to,
        textLength: text.length
      });
      
      return messageInstance;
    } catch (error) {
      logger.error('Error enviando mensaje de texto:', {
        to,
        textLength: text?.length,
        error: error.message,
        code: error.code || 'SEND_TEXT_MESSAGE_ERROR'
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error enviando mensaje de texto a ${to}: ${error.message}`,
        'SEND_TEXT_MESSAGE_ERROR'
      );
    }
  }
  
  /**
   * Crear y enviar mensaje de template
   * @param {string} to - Número de destino
   * @param {string} templateId - ID del template
   * @param {object} templateData - Datos del template
   * @param {object} options - Opciones adicionales
   * @returns {Promise<Message>} Mensaje creado
   */
  async sendTemplateMessage(to, templateId, templateData = {}, options = {}) {
    try {
      if (!to || typeof to !== 'string') {
        throw new MessageServiceError(
          'Número de destino requerido y debe ser una cadena',
          'INVALID_RECIPIENT'
        );
      }
      
      if (!templateId || typeof templateId !== 'string') {
        throw new MessageServiceError(
          'ID de template requerido y debe ser una cadena',
          'INVALID_TEMPLATE_ID'
        );
      }
      
      const message = Message.createTemplateMessage(to, templateId, templateData, {
        id: generateId('msg_', 16),
        from: 'bot',
        ...options
      });
      
      // Guardar mensaje en base de datos usando Sequelize
      const savedMessage = await this.db.models.Message.create(message.toJSON());
      const messageInstance = Message.fromJSON(savedMessage.toJSON());
      
      // Intentar enviar el mensaje
      await this.sendMessage(messageInstance);
      
      // Actualizar última interacción del contacto
      await this.updateContactLastInteraction(to);
      
      // Emitir evento de Socket.IO si está configurado
      if (this.io) {
        const messageData = {
          id: messageInstance.id,
          from: 'bot',
          to,
          type: 'template',
          templateId,
          templateData,
          timestamp: new Date().toISOString(),
          status: messageInstance.status
        };
        
        // Emitir a todos los clientes conectados
        this.io.emit('new_message', messageData);
        
        // Emitir específicamente a la sala de la conversación
        this.io.to(`conversation_${to}`).emit('conversation_message', messageData);
        
        logger.info(`📡 Socket.IO event emitted for outgoing template message to ${to}`);
      }
      
      logger.info('Mensaje de template enviado exitosamente', {
        messageId: messageInstance.id,
        to,
        templateId
      });
      
      return messageInstance;
    } catch (error) {
      logger.error('Error enviando mensaje de template:', {
        to,
        templateId,
        error: error.message,
        code: error.code || 'SEND_TEMPLATE_MESSAGE_ERROR'
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error enviando mensaje de template a ${to}: ${error.message}`,
        'SEND_TEMPLATE_MESSAGE_ERROR'
      );
    }
  }
  
  /**
   * Crear y enviar mensaje multimedia
   * @param {string} to - Número de destino
   * @param {string} type - Tipo de media
   * @param {string} mediaUrl - URL del archivo
   * @param {object} options - Opciones adicionales
   * @returns {Promise<Message>} Mensaje creado
   */
  async sendMediaMessage(to, type, mediaUrl, options = {}) {
    try {
      if (!to || typeof to !== 'string') {
        throw new MessageServiceError(
          'Número de destino requerido y debe ser una cadena',
          'INVALID_RECIPIENT'
        );
      }
      
      if (!type || typeof type !== 'string') {
        throw new MessageServiceError(
          'Tipo de media requerido y debe ser una cadena',
          'INVALID_MEDIA_TYPE'
        );
      }
      
      if (!mediaUrl || typeof mediaUrl !== 'string') {
        throw new MessageServiceError(
          'URL de media requerida y debe ser una cadena',
          'INVALID_MEDIA_URL'
        );
      }
      
      const message = Message.createMediaMessage(to, type, mediaUrl, {
        id: generateId('msg_', 16),
        from: 'bot',
        ...options
      });
      
      // Guardar mensaje en base de datos usando Sequelize
      const savedMessage = await this.db.models.Message.create(message.toJSON());
      const messageInstance = Message.fromJSON(savedMessage.toJSON());
      
      // Intentar enviar el mensaje
      await this.sendMessage(messageInstance);
      
      // Actualizar última interacción del contacto
      await this.updateContactLastInteraction(to);
      
      // Emitir evento de Socket.IO si está configurado
      if (this.io) {
        const messageData = {
          id: messageInstance.id,
          from: 'bot',
          to,
          type: 'media',
          mediaType: type,
          mediaUrl,
          timestamp: new Date().toISOString(),
          status: messageInstance.status
        };
        
        // Emitir a todos los clientes conectados
        this.io.emit('new_message', messageData);
        
        // Emitir específicamente a la sala de la conversación
        this.io.to(`conversation_${to}`).emit('conversation_message', messageData);
        
        logger.info(`📡 Socket.IO event emitted for outgoing media message to ${to}`);
      }
      
      logger.info('Mensaje multimedia enviado exitosamente', {
        messageId: messageInstance.id,
        to,
        type,
        mediaUrl
      });
      
      return messageInstance;
    } catch (error) {
      logger.error('Error enviando mensaje multimedia:', {
        to,
        type,
        mediaUrl,
        error: error.message,
        code: error.code || 'SEND_MEDIA_MESSAGE_ERROR'
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error enviando mensaje multimedia a ${to}: ${error.message}`,
        'SEND_MEDIA_MESSAGE_ERROR'
      );
    }
  }
  
  /**
   * Programar mensaje para envío futuro
   * @param {object} messageData - Datos del mensaje
   * @param {Date|string} scheduledDate - Fecha programada
   * @returns {Promise<Message>} Mensaje programado
   */
  async scheduleMessage(messageData, scheduledDate) {
    try {
      if (!messageData || typeof messageData !== 'object') {
        throw new MessageServiceError(
          'Datos del mensaje requeridos',
          'INVALID_MESSAGE_DATA'
        );
      }
      
      if (!scheduledDate) {
        throw new MessageServiceError(
          'Fecha programada requerida',
          'INVALID_SCHEDULED_DATE'
        );
      }
      
      const scheduleDate = new Date(scheduledDate);
      if (isNaN(scheduleDate.getTime())) {
        throw new MessageServiceError(
          'Fecha programada inválida',
          'INVALID_SCHEDULED_DATE'
        );
      }
      
      if (scheduleDate <= new Date()) {
        throw new MessageServiceError(
          'La fecha programada debe ser en el futuro',
          'PAST_SCHEDULED_DATE'
        );
      }
      
      const message = new Message({
        id: generateId('msg_', 16),
        from: 'bot',
        ...messageData
      });
      message.schedule(scheduledDate);
      
      // Guardar mensaje programado usando Sequelize
      const savedMessage = await this.db.models.Message.create(message.toJSON());
      
      logger.info('Mensaje programado exitosamente', {
        messageId: message.id,
        scheduledDate: scheduledDate
      });
      
      return Message.fromJSON(savedMessage.toJSON());
    } catch (error) {
      logger.error('Error programando mensaje:', {
        scheduledDate,
        error: error.message,
        code: error.code || 'SCHEDULE_MESSAGE_ERROR'
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error programando mensaje: ${error.message}`,
        'SCHEDULE_MESSAGE_ERROR'
      );
    }
  }
  
  /**
   * Procesar mensajes programados que deben enviarse
   * @returns {Promise<object>} Resultado del procesamiento
   */
  async processScheduledMessages() {
    try {
      const scheduledMessages = await this.db.models.Message.findAll({
        where: { status: 'scheduled' }
      });
      
      const results = {
        processed: 0,
        sent: 0,
        failed: 0,
        errors: []
      };
      
      for (const messageData of scheduledMessages) {
        try {
          const message = Message.fromJSON(messageData.toJSON());
          
          if (message.shouldBeSentNow()) {
            results.processed++;
            
            try {
              await this.sendMessage(message);
              results.sent++;
            } catch (error) {
              results.failed++;
              results.errors.push({
                messageId: message.id,
                error: error.message
              });
            }
          }
        } catch (error) {
          logger.warn('Error procesando mensaje programado:', {
            messageId: messageData.id,
            error: error.message
          });
        }
      }
      
      logger.info('Procesamiento de mensajes programados completado', {
        processed: results.processed,
        sent: results.sent,
        failed: results.failed
      });
      
      return results;
    } catch (error) {
      logger.error('Error procesando mensajes programados:', {
        error: error.message,
        code: error.code || 'PROCESS_SCHEDULED_ERROR'
      });
      
      throw new MessageServiceError(
        `Error procesando mensajes programados: ${error.message}`,
        'PROCESS_SCHEDULED_ERROR'
      );
    }
  }
  
  /**
   * Recibir y procesar mensaje entrante
   * @param {object} messageData - Datos del mensaje
   * @returns {Promise<Message>} Mensaje procesado
   */
  async receiveMessage(messageData) {
    try {
      if (!messageData || typeof messageData !== 'object') {
        throw new MessageServiceError(
          'Datos del mensaje requeridos',
          'INVALID_MESSAGE_DATA'
        );
      }
      
      const message = Message.createIncomingMessage(messageData);
      
      // FIX 2: Serializar metadata correctamente antes de guardar
      const messageForDB = message.toJSON();
      
      // Asegurar que metadata sea un string JSON válido para SQLite
      if (messageForDB.metadata && typeof messageForDB.metadata === 'object') {
        messageForDB.metadata = JSON.stringify(messageForDB.metadata);
        
        logger.info('🔍 [MessageService] Serializando metadata para BD:', {
          type: messageData.type,
          metadata_length: messageForDB.metadata.length,
          metadata_preview: messageForDB.metadata.substring(0, 100)
        });
      }
      
      // Guardar mensaje en base de datos usando Sequelize
      const savedMessage = await this.db.models.Message.create(messageForDB);
      
      // Parsear metadata de vuelta a objeto para la instancia
      if (savedMessage.metadata && typeof savedMessage.metadata === 'string') {
        try {
          savedMessage.metadata = JSON.parse(savedMessage.metadata);
        } catch (e) {
          logger.warn('Error parseando metadata guardado:', e);
        }
      }
      
      const messageInstance = Message.fromJSON(savedMessage.toJSON());
      
      // Actualizar última interacción del contacto
      await this.updateContactLastInteraction(messageData.from);
      
      // Socket.IO event ya se emite en UnifiedWebhookService - no duplicar aquí
      // (Eliminado para evitar emisiones duplicadas)
      
      logger.info('Mensaje entrante procesado exitosamente', {
        messageId: messageInstance.id,
        from: messageData.from,
        type: messageData.type
      });
      
      return messageInstance;
    } catch (error) {
      logger.error('Error procesando mensaje entrante:', {
        messageData,
        error: error.message,
        code: error.code || 'RECEIVE_MESSAGE_ERROR'
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error procesando mensaje entrante: ${error.message}`,
        'RECEIVE_MESSAGE_ERROR'
      );
    }
  }
  
  /**
   * Actualizar estado de mensaje
   * @param {string} messageId - ID del mensaje
   * @param {string} status - Nuevo estado
   * @param {object} additionalData - Datos adicionales
   * @returns {Promise<Message>} Mensaje actualizado
   */
  async updateMessageStatus(messageId, status, additionalData = {}) {
    try {
      if (!messageId || typeof messageId !== 'string') {
        throw new MessageServiceError(
          'ID de mensaje requerido y debe ser una cadena',
          'INVALID_MESSAGE_ID'
        );
      }
      
      if (!status || typeof status !== 'string') {
        throw new MessageServiceError(
          'Estado requerido y debe ser una cadena',
          'INVALID_STATUS'
        );
      }
      
      const message = await this.getMessageById(messageId);
      if (!message) {
        throw new MessageServiceError(
          `Mensaje con ID ${messageId} no encontrado`,
          'MESSAGE_NOT_FOUND'
        );
      }
      
      // Actualizar estado según el tipo
      switch (status) {
      case 'sent':
        message.markAsSent(additionalData.whatsappMessageId);
        break;
      case 'delivered':
        message.markAsDelivered();
        break;
      case 'read':
        message.markAsRead();
        break;
      case 'failed':
        message.markAsFailed(additionalData.errorCode, additionalData.errorMessage);
        break;
      default:
        message.status = status;
        message.updatedAt = new Date().toISOString();
      }
      
      // Guardar cambios usando Sequelize
      await this.db.models.Message.update(message.toJSON(), {
        where: { id: messageId }
      });
      
      // Obtener el mensaje actualizado
      const updatedMessage = await this.db.models.Message.findByPk(messageId);
      
      logger.info('Estado de mensaje actualizado exitosamente', {
        messageId,
        status,
        previousStatus: message.status
      });
      
      return Message.fromJSON(updatedMessage.toJSON());
    } catch (error) {
      logger.error('Error actualizando estado de mensaje:', {
        messageId,
        status,
        error: error.message,
        code: error.code || 'UPDATE_MESSAGE_STATUS_ERROR'
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error actualizando estado de mensaje ${messageId}: ${error.message}`,
        'UPDATE_MESSAGE_STATUS_ERROR'
      );
    }
  }
  
  /**
   * Obtener conversación con un contacto
   * @param {string} contactPhone - Número del contacto
   * @param {object} options - Opciones de paginación
   * @returns {Promise<object>} Conversación
   */
  async getConversation(contactPhone, options = {}) {
    try {
      if (!contactPhone || typeof contactPhone !== 'string') {
        throw new MessageServiceError(
          'Número de contacto requerido y debe ser una cadena',
          'INVALID_CONTACT_PHONE'
        );
      }
      
      const { page = 1, limit = 50 } = options;
      
      if (page < 1 || limit < 1 || limit > 1000) {
        throw new MessageServiceError(
          'Parámetros de paginación inválidos',
          'INVALID_PAGINATION'
        );
      }
      
      const { count, rows: messages } = await this.db.models.Message.findAndCountAll({
        where: {
          [Op.or]: [
            { from: contactPhone },
            { to: contactPhone }
          ]
        },
        order: [['createdAt', 'DESC']],
        limit: limit,
        offset: (page - 1) * limit
      });
      
      const total = count;
      const paginatedMessages = messages.map(msg => msg.toJSON());
      
      logger.info('Conversación obtenida exitosamente', {
        contactPhone,
        totalMessages: total,
        page,
        limit
      });
      
      return {
        contactPhone,
        messages: paginatedMessages.map(message => Message.fromJSON(message).toJSON()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: endIndex < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Error obteniendo conversación:', {
        contactPhone,
        error: error.message,
        code: error.code || 'GET_CONVERSATION_ERROR'
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error obteniendo conversación con ${contactPhone}: ${error.message}`,
        'GET_CONVERSATION_ERROR'
      );
    }
  }
  
  /**
   * Obtener estadísticas de mensajes
   * @param {object} filters - Filtros para las estadísticas
   * @returns {Promise<object>} Estadísticas
   */
  async getMessageStats(filters = {}) {
    try {
      // Construir filtros de fecha para Sequelize
      const whereClause = {};
      
      if (filters.dateFrom || filters.dateTo) {
        whereClause.createdAt = {};
        
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          if (isNaN(fromDate.getTime())) {
            throw new MessageServiceError('Fecha de inicio inválida', 'INVALID_DATE_FROM');
          }
          whereClause.createdAt[Op.gte] = fromDate;
        }
        
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          if (isNaN(toDate.getTime())) {
            throw new MessageServiceError('Fecha de fin inválida', 'INVALID_DATE_TO');
          }
          whereClause.createdAt[Op.lte] = toDate;
        }
      }
      
      const messages = await this.db.models.Message.findAll({
        where: whereClause,
        raw: true
      });
      
      const stats = {
        total: messages.length,
        inbound: 0,
        outbound: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        scheduled: 0,
        byType: {},
        byCampaign: {},
        deliveryRate: 0,
        readRate: 0,
        failureRate: 0
      };
      
      messages.forEach(message => {
        // Contar por dirección
        stats[message.direction]++;
        
        // Contar por estado
        stats[message.status]++;
        
        // Contar por tipo
        stats.byType[message.type] = (stats.byType[message.type] || 0) + 1;
        
        // Contar por campaña
        if (message.campaignId) {
          stats.byCampaign[message.campaignId] = (stats.byCampaign[message.campaignId] || 0) + 1;
        }
      });
      
      // Calcular tasas
      const outboundMessages = stats.outbound;
      if (outboundMessages > 0) {
        stats.deliveryRate = ((stats.delivered + stats.read) / outboundMessages * 100).toFixed(2);
        stats.readRate = (stats.read / outboundMessages * 100).toFixed(2);
        stats.failureRate = (stats.failed / outboundMessages * 100).toFixed(2);
      }
      
      logger.info('Estadísticas de mensajes obtenidas exitosamente', {
        total: stats.total,
        filters
      });
      
      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de mensajes:', {
        filters,
        error: error.message,
        code: error.code || 'GET_MESSAGE_STATS_ERROR'
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error obteniendo estadísticas de mensajes: ${error.message}`,
        'GET_MESSAGE_STATS_ERROR'
      );
    }
  }
  
  /**
   * Enviar mensaje a través de la API de WhatsApp
   * @private
   * @param {Message} message - Mensaje a enviar
   * @returns {Promise<void>}
   */
  async sendMessage(message) {
    try {
      if (!message || !(message instanceof Message)) {
        throw new MessageServiceError(
          'Instancia de mensaje válida requerida',
          'INVALID_MESSAGE_INSTANCE'
        );
      }
      
      // Simular envío (aquí iría la integración real con WhatsApp API)
      logger.debug('Enviando mensaje', {
        messageId: message.id,
        to: message.to,
        type: message.type
      });
      
      // Simular delay de envío
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Marcar como enviado
      message.markAsSent(`wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      // Actualizar en base de datos usando Sequelize
      await this.db.models.Message.update(message.toJSON(), {
        where: { id: message.id }
      });
      
      // Simular entrega después de un tiempo
      setTimeout(async() => {
        try {
          message.markAsDelivered();
          await this.db.models.Message.update(message.toJSON(), {
            where: { id: message.id }
          });
        } catch (error) {
          logger.error('Error simulando entrega:', {
            messageId: message.id,
            error: error.message
          });
        }
      }, 2000);
      
    } catch (error) {
      // Marcar como fallido
      message.markAsFailed('SEND_ERROR', error.message);
      await this.db.models.Message.update(message.toJSON(), {
        where: { id: message.id }
      });
      
      if (error instanceof MessageServiceError) {
        throw error;
      }
      
      throw new MessageServiceError(
        `Error enviando mensaje: ${error.message}`,
        'SEND_MESSAGE_ERROR'
      );
    }
  }
  
  /**
   * Actualizar última interacción del contacto
   * @private
   * @param {string} phone - Número del contacto
   */
  async updateContactLastInteraction(phone) {
    try {
      if (!phone || typeof phone !== 'string') {
        logger.warn('Número de teléfono inválido para actualizar interacción', { phone });
        return;
      }
      
      const contact = await this.contactService.getContactByPhone(phone);
      if (contact) {
        contact.updateLastInteraction();
        await this.contactService.updateContact(contact.id, contact.toJSON());
      }
    } catch (error) {
      logger.warn('Error actualizando última interacción:', {
        phone,
        error: error.message
      });
    }
  }
}

// Instancia singleton del servicio
let serviceInstance = null;

/**
 * Obtener instancia del servicio de mensajes
 * @returns {MessageService} Instancia del servicio
 */
export function getMessageService() {
  if (!serviceInstance) {
    serviceInstance = new MessageService();
  }
  return serviceInstance;
}

export default MessageService;
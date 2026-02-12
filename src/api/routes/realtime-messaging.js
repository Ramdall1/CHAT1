/**
 * API de Mensajería en Tiempo Real
 * 
 * Proporciona endpoints para gestión de mensajes con notificaciones
 * en tiempo real, estado de lectura y funcionalidades avanzadas.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import express from 'express';
import { getMessageService } from '../../components/business/messaging/services/MessageService.js';
import { getContactService } from '../../components/business/contacts/services/ContactService.js';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('REALTIME_MESSAGING_API');

/**
 * GET /api/realtime-messaging/conversations
 * Obtener todas las conversaciones con información de mensajes no leídos
 */
router.get('/conversations', async (req, res) => {
  try {
    const messageService = getMessageService();
    const contactService = getContactService();
    
    // Obtener estadísticas de mensajes no leídos
    const unreadStats = await messageService.getUnreadStats();
    
    // Obtener todos los contactos
    const contacts = await contactService.getAllContacts();
    
    // Crear lista de conversaciones con información de no leídos
    const conversations = contacts.map(contact => {
      const unreadInfo = unreadStats.byConversation.find(
        item => item.conversationId === contact.phone_number
      );
      
      return {
        id: contact.phone_number,
        name: contact.name || contact.phone_number,
        phone: contact.phone_number,
        lastMessage: null, // Se puede agregar después
        unreadCount: unreadInfo ? unreadInfo.unreadCount : 0,
        isOnline: false, // Se puede implementar después
        avatar: contact.avatar || null,
        lastActivity: contact.updated_at
      };
    });
    
    res.json({
      success: true,
      data: {
        conversations,
        totalUnread: unreadStats.totalUnread
      }
    });
  } catch (error) {
    logger.error('Error obteniendo conversaciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/realtime-messaging/conversations/:conversationId/messages
 * Obtener mensajes de una conversación específica
 */
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const messageService = getMessageService();
    
    const messages = await messageService.getConversation(conversationId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    logger.error('Error obteniendo mensajes de conversación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/realtime-messaging/conversations/:conversationId/messages
 * Enviar un nuevo mensaje
 */
router.post('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text, type = 'text', mediaUrl } = req.body;
    
    if (!text && !mediaUrl) {
      return res.status(400).json({
        success: false,
        error: 'Texto o URL de media requerido'
      });
    }
    
    const messageService = getMessageService();
    let message;
    
    if (type === 'text') {
      message = await messageService.sendTextMessage(conversationId, text);
    } else if (type === 'media' && mediaUrl) {
      message = await messageService.sendMediaMessage(conversationId, type, mediaUrl);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Tipo de mensaje no válido'
      });
    }
    
    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    logger.error('Error enviando mensaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * PUT /api/realtime-messaging/conversations/:conversationId/read
 * Marcar mensajes como leídos
 */
router.put('/conversations/:conversationId/read', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { messageIds } = req.body;
    
    const messageService = getMessageService();
    await messageService.markMessagesAsRead(conversationId, messageIds);
    
    res.json({
      success: true,
      message: 'Mensajes marcados como leídos'
    });
  } catch (error) {
    logger.error('Error marcando mensajes como leídos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/realtime-messaging/unread-stats
 * Obtener estadísticas de mensajes no leídos
 */
router.get('/unread-stats', async (req, res) => {
  try {
    const messageService = getMessageService();
    const stats = await messageService.getUnreadStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas de no leídos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/realtime-messaging/connected-clients
 * Obtener clientes conectados
 */
router.get('/connected-clients', async (req, res) => {
  try {
    const messageService = getMessageService();
    const clients = messageService.getConnectedClients();
    
    res.json({
      success: true,
      data: {
        count: clients.length,
        clients
      }
    });
  } catch (error) {
    logger.error('Error obteniendo clientes conectados:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/realtime-messaging/conversations/:conversationId/typing
 * Obtener usuarios escribiendo en una conversación
 */
router.get('/conversations/:conversationId/typing', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messageService = getMessageService();
    const typingUsers = messageService.getTypingUsers(conversationId);
    
    res.json({
      success: true,
      data: typingUsers
    });
  } catch (error) {
    logger.error('Error obteniendo usuarios escribiendo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/realtime-messaging/demo/send-test-message
 * Enviar mensaje de prueba para demostración
 */
router.post('/demo/send-test-message', async (req, res) => {
  try {
    const { to = '+1234567890', text = 'Mensaje de prueba', type = 'text' } = req.body;
    
    const messageService = getMessageService();
    
    // Simular mensaje entrante
    const messageData = {
      from: to,
      text,
      type,
      timestamp: new Date().toISOString()
    };
    
    const message = await messageService.receiveMessage(messageData);
    
    res.json({
      success: true,
      data: message,
      message: 'Mensaje de prueba enviado'
    });
  } catch (error) {
    logger.error('Error enviando mensaje de prueba:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * DELETE /api/realtime-messaging/demo/cleanup
 * Limpiar datos de demostración
 */
router.delete('/demo/cleanup', async (req, res) => {
  try {
    const messageService = getMessageService();
    const contactService = getContactService();
    
    // Eliminar mensajes de prueba (aquellos con números de teléfono de prueba)
    const testPhoneNumbers = ['+1234567890', '+0987654321', '+1111111111'];
    
    for (const phone of testPhoneNumbers) {
      try {
        // Eliminar mensajes
        await messageService.db.models.Message.destroy({
          where: {
            [messageService.db.Op.or]: [
              { from: phone },
              { to: phone }
            ]
          }
        });
        
        // Eliminar contacto si existe
        await contactService.deleteContact(phone);
      } catch (error) {
        logger.warn(`Error limpiando datos para ${phone}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Datos de demostración limpiados exitosamente'
    });
  } catch (error) {
    logger.error('Error limpiando datos de demostración:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;
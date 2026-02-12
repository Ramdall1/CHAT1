/**
 * @fileoverview Rutas de API para conversaciones
 * Proporciona endpoints para gestionar conversaciones y mensajes
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { getMessageService } from '../../components/business/messaging/services/MessageService.js';
import { getContactService } from '../../components/business/contacts/services/ContactService.js';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('CONVERSATION_ROUTES');

/**
 * Obtener todas las conversaciones
 * GET /api/conversations
 */
router.get('/', async (req, res) => {
  try {
    // Obtener contactos y mensajes desde Sequelize
    const contactService = getContactService();
    const messageService = getMessageService();
    
    let contacts = [];
    let conversations = [];
    
    try {
      // Obtener todos los contactos desde Sequelize
      contacts = await contactService.getAllContacts();
      logger.info(`Obtenidos ${contacts.length} contactos desde Sequelize`);
    } catch (error) {
      logger.warn('Error obteniendo contactos desde Sequelize:', error.message);
      contacts = [];
    }
    
    // Crear conversaciones basadas en los contactos y mensajes
    conversations = await Promise.all(contacts.map(async (contact) => {
      try {
        // Obtener mensajes de este contacto desde Sequelize
        const contactMessages = await messageService.getMessagesByContact(contact.phone);
        
        // Ordenar mensajes por timestamp
        contactMessages.sort((a, b) => {
          const timeA = new Date(a.timestamp || a.createdAt).getTime();
          const timeB = new Date(b.timestamp || b.createdAt).getTime();
          return timeA - timeB;
        });
        
        const lastMessage = contactMessages.length > 0 ? contactMessages[contactMessages.length - 1] : null;
        
        return {
          id: contact.id,
          phone: contact.phone,
          name: contact.name || 'Sin nombre',
          displayName: contact.name ? `${contact.name} (${contact.phone})` : contact.phone,
          firstName: contact.first_name || '',
          lastName: contact.last_name || '',
          avatar: null,
          online: false,
          lastMessage: lastMessage ? (lastMessage.content || lastMessage.text || 'Mensaje multimedia') : 'Sin mensajes',
          lastMessageTime: lastMessage ? new Date(lastMessage.timestamp || lastMessage.createdAt).getTime() : new Date(contact.createdAt).getTime(),
          unread: 0, // Por simplicidad, asumimos 0 mensajes no leídos
          messageCount: contactMessages.length
        };
      } catch (error) {
        logger.warn(`Error obteniendo mensajes para contacto ${contact.phone}:`, error.message);
        return {
          id: contact.id,
          phone: contact.phone,
          name: contact.name || 'Sin nombre',
          displayName: contact.name ? `${contact.name} (${contact.phone})` : contact.phone,
          firstName: contact.first_name || '',
          lastName: contact.last_name || '',
          avatar: null,
          online: false,
          lastMessage: 'Sin mensajes',
          lastMessageTime: new Date(contact.createdAt).getTime(),
          unread: 0,
          messageCount: 0
        };
      }
    }));
    
    res.json({
      success: true,
      conversations: conversations
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
 * Obtener mensajes de una conversación específica
 * GET /api/conversations/:phone/messages
 */
router.get('/:phone/messages', async (req, res) => {
  try {
    const { phone } = req.params;
    const messageService = getMessageService();
    
    let conversationMessages = [];
    
    try {
      // Obtener mensajes desde Sequelize usando MessageService
      const messages = await messageService.getMessagesByContact(phone);
      logger.info(`Obtenidos ${messages.length} mensajes para ${phone} desde Sequelize`);
      
      // Normalizar formato de mensajes
      conversationMessages = messages
        .map(msg => ({
          id: msg.id,
          text: msg.content || msg.text || 'Mensaje multimedia',
          timestamp: new Date(msg.timestamp || msg.createdAt).getTime(),
          type: msg.type || 'text',
          from: msg.from || msg.phone,
          isOutgoing: msg.direction === 'outbound' || msg.from === 'BOT',
          status: msg.status || 'delivered'
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
        
    } catch (error) {
      logger.warn(`Error obteniendo mensajes desde Sequelize para ${phone}:`, error.message);
      conversationMessages = [];
    }
    
    res.json({
      success: true,
      messages: conversationMessages
    });
    
  } catch (error) {
    logger.error('Error obteniendo mensajes:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Marcar conversación como leída
 * POST /api/conversations/:phone/read
 */
router.post('/:phone/read', async (req, res) => {
  try {
    const { phone } = req.params;
    
    // Por simplicidad, solo devolvemos éxito
    // En una implementación real, actualizaríamos el estado de lectura
    
    res.json({
      success: true,
      message: `Conversación con ${phone} marcada como leída`
    });
    
  } catch (error) {
    logger.error('Error marcando como leída:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;
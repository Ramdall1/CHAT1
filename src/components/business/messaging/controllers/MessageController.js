/**
 * Message Controller
 * 
 * Orquesta las solicitudes HTTP para la mensajería.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { getMessageService } from '../services/MessageService.js';
import { createLogger } from '../../../../services/core/core/logger.js';

const logger = createLogger('MESSAGE_CONTROLLER');

class MessageController {
  constructor() {
    this.messageService = getMessageService();
  }

  async getAllMessages(req, res, next) {
    try {
      const result = await this.messageService.getAllMessages(req.query);
      res.json(result);
    } catch (error) {
      logger.error('Error en getAllMessages:', error);
      next(error);
    }
  }

  async getMessageById(req, res, next) {
    try {
      const message = await this.messageService.getMessageById(req.params.id);
      if (!message) {
        return res.status(404).json({ error: 'Mensaje no encontrado' });
      }
      res.json(message);
    } catch (error) {
      logger.error('Error en getMessageById:', error);
      next(error);
    }
  }

  async sendTextMessage(req, res, next) {
    try {
      const { to, text, ...options } = req.body;
      const message = await this.messageService.sendTextMessage(to, text, options);
      res.status(202).json({ message: 'Mensaje de texto aceptado para envío', data: message });
    } catch (error) {
      logger.error('Error en sendTextMessage:', error);
      next(error);
    }
  }

  async sendTemplateMessage(req, res, next) {
    try {
      const { to, templateId, templateData, ...options } = req.body;
      const message = await this.messageService.sendTemplateMessage(to, templateId, templateData, options);
      res.status(202).json({ message: 'Mensaje de plantilla aceptado para envío', data: message });
    } catch (error) {
      logger.error('Error en sendTemplateMessage:', error);
      next(error);
    }
  }

  async sendMediaMessage(req, res, next) {
    try {
      const { to, type, mediaUrl, ...options } = req.body;
      const message = await this.messageService.sendMediaMessage(to, type, mediaUrl, options);
      res.status(202).json({ message: 'Mensaje multimedia aceptado para envío', data: message });
    } catch (error) {
      logger.error('Error en sendMediaMessage:', error);
      next(error);
    }
  }

  async receiveMessage(req, res, next) {
    try {
      const message = await this.messageService.receiveMessage(req.body);
      res.status(200).json({ message: 'Mensaje recibido exitosamente', data: message });
    } catch (error) {
      logger.error('Error en receiveMessage:', error);
      next(error);
    }
  }
  
  // ... otros métodos del controlador ...
}

let controllerInstance = null;

export function getMessageController() {
  if (!controllerInstance) {
    controllerInstance = new MessageController();
  }
  return controllerInstance;
}

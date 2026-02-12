/**
 * Contact Controller
 * 
 * Extrae la lógica de las rutas y la delega al servicio de contactos.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { getContactService } from '../services/ContactService.js';
import { createLogger } from '../../../../services/core/core/logger.js';

const logger = createLogger('CONTACT_CONTROLLER');
const contactService = getContactService();

export const contactController = {
  async getAllContacts(req, res, next) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const result = await contactService.getAllContacts({ page, limit, search, sortBy, sortOrder });
      res.json(result);
    } catch (error) {
      logger.error('Error en getAllContacts:', error);
      next(error);
    }
  },

  async getContact(req, res, next) {
    try {
      const contact = await contactService.getContactByPhone(req.params.phone);
      if (!contact) {
        return res.status(404).json({ error: 'Contacto no encontrado' });
      }
      res.json(contact);
    } catch (error) {
      logger.error('Error en getContact:', error);
      next(error);
    }
  },

  async createContact(req, res, next) {
    try {
      const contactData = req.body;
      if (!contactData.phone) {
        return res.status(400).json({ success: false, error: 'El teléfono es requerido' });
      }
      const newContact = await contactService.createContact(contactData);
      res.status(201).json({ success: true, message: 'Contacto creado exitosamente', data: newContact });
    } catch (error) {
      logger.error('Error en createContact:', error);
      // Si el error es por duplicado, enviar 409
      if (error.message.includes('ya existe')) {
        return res.status(409).json({ success: false, error: error.message });
      }
      next(error);
    }
  },

  async updateContact(req, res, next) {
    try {
      const contact = await contactService.getContactByPhone(req.params.phone);
      if (!contact) {
        return res.status(404).json({ success: false, error: 'Contacto no encontrado' });
      }
      const updatedContact = await contactService.updateContact(contact.id, req.body);
      res.json({ success: true, message: 'Contacto actualizado exitosamente', data: updatedContact });
    } catch (error) {
      logger.error('Error en updateContact:', error);
      next(error);
    }
  },

  async deleteContact(req, res, next) {
    try {
      const contact = await contactService.getContactByPhone(req.params.phone);
      if (!contact) {
        return res.status(404).json({ success: false, error: 'Contacto no encontrado' });
      }
      await contactService.deleteContact(contact.id);
      res.json({ success: true, message: 'Contacto eliminado exitosamente' });
    } catch (error) {
      logger.error('Error en deleteContact:', error);
      next(error);
    }
  },

  // --- Métodos para Etiquetas (Tags) ---
  async getAllTags(req, res, next) {
    try {
      const tags = await contactService.getAllTags();
      res.json(tags);
    } catch (error) {
      logger.error('Error en getAllTags:', error);
      next(error);
    }
  },

  async createTag(req, res, next) {
    try {
      const newTag = await contactService.createTag(req.body);
      res.status(201).json(newTag);
    } catch (error) {
      logger.error('Error en createTag:', error);
      next(error);
    }
  },

  async addTagToContact(req, res, next) {
    try {
      const { phone, tagId } = req.params;
      const contact = await contactService.getContactByPhone(phone);
      if (!contact) {
        return res.status(404).json({ error: 'Contacto no encontrado' });
      }
      await contactService.addTagToContact(contact.id, tagId);
      res.json({ message: 'Etiqueta agregada exitosamente' });
    } catch (error) {
      logger.error('Error en addTagToContact:', error);
      next(error);
    }
  },

  async removeTagFromContact(req, res, next) {
    try {
      const { phone, tagId } = req.params;
      const contact = await contactService.getContactByPhone(phone);
      if (!contact) {
        return res.status(404).json({ error: 'Contacto no encontrado' });
      }
      await contactService.removeTagFromContact(contact.id, tagId);
      res.json({ message: 'Etiqueta removida exitosamente' });
    } catch (error) {
      logger.error('Error en removeTagFromContact:', error);
      next(error);
    }
  },

  // --- Métodos para Importar/Exportar ---
  async importContacts(req, res, next) {
    try {
      // La lógica de parsing de CSV se moverá al servicio o a un helper
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo' });
      }
      // Aquí iría la lógica para leer el req.file y pasarlo al servicio
      // const contactsData = await parseCsv(req.file.path);
      // const result = await contactService.importContacts(contactsData);
      res.json({ message: 'Importación iniciada...', ...result });
    } catch (error) {
      logger.error('Error en importContacts:', error);
      next(error);
    }
  },

  async exportContacts(req, res, next) {
    try {
      // La lógica de creación de CSV se moverá al servicio o a un helper
      // const csvData = await contactService.exportContacts();
      // res.header('Content-Type', 'text/csv');
      // res.attachment('contacts.csv');
      // return res.send(csvData);
      res.json({ message: 'Exportación en desarrollo' });
    } catch (error) {
      logger.error('Error en exportContacts:', error);
      next(error);
    }
  }
};
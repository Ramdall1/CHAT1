/**
 * CONTACTS MANAGER - Gestión completa de contactos
 * 
 * @author Sistema Chat Bot v5.0.0
 * @version 3.0.0 (Refactored for Sequelize ORM)
 */

import { Contact } from '../services/core/core/database.js';
import { Op } from '../adapters/SequelizeAdapter.js';

class ContactsManager {
  constructor(moduleCommunicator) {
    this.communicator = moduleCommunicator;
    this.logger = this.communicator.logger;
    this.isLoaded = false;
        
    // Configuración
    this.config = {
      maxContacts: parseInt(process.env.MAX_CONTACTS) || 10000,
      validatePhones: process.env.VALIDATE_PHONES !== 'false'
    };
  }

  /**
     * Inicializa el gestor de contactos
     */
  async initialize() {
    this.isLoaded = true;
    this.logger.info('ContactsManager inicializado correctamente');
    return { success: true, message: 'ContactsManager inicializado' };
  }

  /**
     * Normaliza un número telefónico
     */
  normalizePhone(phone) {
    if (!phone) return null;
        
    let normalized = phone.toString().replace(/[^\d+]/g, '');
        
    if (!normalized.startsWith('+')) {
      const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '+57';
      normalized = defaultCountryCode + normalized;
    }
        
    return normalized;
  }

  /**
     * Valida un número telefónico
     */
  validatePhone(phone) {
    if (!this.config.validatePhones) return true;
        
    const normalized = this.normalizePhone(phone);
    if (!normalized) return false;
        
    const digits = normalized.slice(1);
    return /^\d{10,15}$/.test(digits);
  }

  /**
     * Crea o actualiza un contacto
     */
  async createContact(contactData) {
    if (!this.isLoaded) {
      throw new Error('ContactsManager no está inicializado');
    }

    const { phone, name, email, tags = [], metadata = {} } = contactData;
        
    if (!phone) {
      throw new Error('Número telefónico es requerido');
    }
        
    const normalizedPhone = this.normalizePhone(phone);
    if (!this.validatePhone(normalizedPhone)) {
      throw new Error('Número telefónico inválido');
    }

    const [contact, created] = await Contact.findOrCreate({
      where: { phone: normalizedPhone },
      defaults: {
        name: name || 'Sin nombre',
        email,
        tags,
        metadata
      }
    });

    if (!created) {
      // Update existing contact
      contact.name = name || contact.name;
      contact.email = email || contact.email;
      contact.tags = [...new Set([...contact.tags, ...tags])];
      contact.metadata = { ...contact.metadata, ...metadata };
      await contact.save();
    }

    this.logger.info(`Contacto ${created ? 'creado' : 'actualizado'}: ${normalizedPhone}`);
        
    if (created) {
      this.communicator.emit('contacts:created', { contact: contact.toJSON() });
    } else {
      this.communicator.emit('contacts:updated', { contact: contact.toJSON() });
    }
        
    return {
      success: true,
      contact: contact.toJSON(),
      isNew: created,
      message: `Contacto ${created ? 'creado' : 'actualizado'} exitosamente`
    };
  }

  /**
     * Obtiene un contacto por teléfono
     */
  async getContact(phone) {
    const normalizedPhone = this.normalizePhone(phone);
    const contact = await Contact.findByPk(normalizedPhone);
        
    if (!contact) {
      return { success: false, message: 'Contacto no encontrado' };
    }
        
    return { success: true, contact: contact.toJSON() };
  }

  /**
     * Lista contactos con filtros
     */
  async listContacts(filters = {}) {
    const {
      tags = [],
      status = null,
      search = '',
      limit = 100,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = filters;
        
    const where = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    if (tags.length > 0) {
      where.tags = { [Op.contains]: tags };
    }

    const { count, rows } = await Contact.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]]
    });

    return {
      success: true,
      contacts: rows.map(c => c.toJSON()),
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    };
  }

  /**
     * Actualiza la última interacción de un contacto
     */
  async updateLastInteraction(phone, interactionData = {}) {
    const normalizedPhone = this.normalizePhone(phone);
    const contact = await Contact.findByPk(normalizedPhone);
        
    if (!contact) {
      return await this.createContact({ 
        phone: normalizedPhone,
        metadata: { autoCreated: true, ...interactionData }
      });
    }
        
    contact.lastInteraction = new Date();
    contact.interactionCount = (contact.interactionCount || 0) + 1;
        
    if (interactionData) {
      contact.metadata = { ...contact.metadata, ...interactionData };
    }
        
    await contact.save();
        
    this.logger.info(`Interacción actualizada para: ${normalizedPhone}`);
    this.communicator.emit('contacts:interaction', { contact: contact.toJSON() });
    return { success: true, contact: contact.toJSON() };
  }

  /**
     * Elimina un contacto
     */
  async deleteContact(phone) {
    const normalizedPhone = this.normalizePhone(phone);
    const result = await Contact.destroy({ where: { phone: normalizedPhone } });
        
    if (result === 0) {
      return { success: false, message: 'Contacto no encontrado' };
    }
        
    this.logger.info(`Contacto eliminado: ${normalizedPhone}`);
    this.communicator.emit('contacts:deleted', { phone: normalizedPhone });
    return { success: true, message: 'Contacto eliminado exitosamente' };
  }

  /**
     * Obtiene estadísticas de contactos
     */
  async getStats() {
    const total = await Contact.count();
    const active = await Contact.count({ where: { status: 'active' } });
    const withInteractions = await Contact.count({ where: { interactionCount: { [Op.gt]: 0 } } });
        
    return {
      success: true,
      stats: {
        total,
        active,
        inactive: total - active,
        withInteractions
      }
    };
  }

  /**
     * Cierre limpio del gestor
     */
  async shutdown() {
    this.logger.info('ContactsManager cerrado correctamente');
  }
}

export default ContactsManager;
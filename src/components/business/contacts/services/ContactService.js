/**
 * Servicio de Contactos Unificado
 * 
 * Maneja toda la lógica de negocio para contactos, etiquetas, campos personalizados y segmentos.
 * Combina la funcionalidad de `localContactManager` y la estructura de `ContactService`.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { getDatabase } from '../../../../services/core/core/database.js';
import { createLogger } from '../../../../services/core/core/logger.js';
import { Contact } from '../../../../adapters/SequelizeAdapter.js';

const logger = createLogger('CONTACT_SERVICE');

/**
 * Clase personalizada para errores del servicio de contactos
 */
class ContactServiceError extends Error {
  constructor(message, code = 'CONTACT_SERVICE_ERROR', statusCode = null, details = null) {
    super(message);
    this.name = 'ContactServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ContactService {
  constructor() {
    this.db = getDatabase();
    this.files = this.db.files;
  }

  // ===== GESTIÓN DE CONTACTOS =====

  async getAllContacts(options = {}) {
    try {
      const { page = 1, limit = 50, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = options;
      
      // Validar parámetros de paginación
      if (page < 1 || limit < 1 || limit > 1000) {
        throw new ContactServiceError(
          'Parámetros de paginación inválidos. Page debe ser >= 1, limit entre 1 y 1000',
          'INVALID_PAGINATION'
        );
      }
      
      const contactsData = await this.db.read(this.files.CONTACTS) || [];
      let contacts = contactsData.map(data => {
        try {
          return Contact.fromJSON(data);
        } catch (error) {
          logger.warn('Error convirtiendo contacto a instancia:', { contactId: data.id, error: error.message });
          return null;
        }
      }).filter(Boolean);

      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        contacts = contacts.filter(c => 
          c.name.toLowerCase().includes(searchLower) || 
          c.phone.includes(search) || 
          c.email.toLowerCase().includes(searchLower)
        );
      }

      contacts.sort((a, b) => {
        const valA = a[sortBy] || 0;
        const valB = b[sortBy] || 0;
        if (sortOrder === 'asc') {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });

      const total = contacts.length;
      const paginated = contacts.slice((page - 1) * limit, page * limit);

      logger.info('Contactos obtenidos exitosamente', {
        total,
        page,
        limit,
        search: search ? 'aplicado' : 'sin filtro'
      });

      return { 
        contacts: paginated.map(c => c.toJSON()),
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      };
    } catch (error) {
      logger.error('Error obteniendo contactos:', {
        error: error.message,
        code: error.code || 'GET_CONTACTS_ERROR',
        options
      });
      
      if (error instanceof ContactServiceError) {
        throw error;
      }
      
      throw new ContactServiceError(
        `Error obteniendo contactos: ${error.message}`,
        'GET_CONTACTS_ERROR'
      );
    }
  }

  async getContactById(id) {
    try {
      if (!id || typeof id !== 'string') {
        throw new ContactServiceError(
          'ID de contacto requerido y debe ser una cadena',
          'INVALID_CONTACT_ID'
        );
      }
      
      const contact = await this.db.findOne(this.files.CONTACTS, item => item.id === id);
      
      if (!contact) {
        logger.info('Contacto no encontrado', { contactId: id });
        return null;
      }
      
      const contactInstance = Contact.fromJSON(contact);
      logger.info('Contacto obtenido exitosamente', { contactId: id });
      
      return contactInstance;
    } catch (error) {
      logger.error('Error obteniendo contacto:', {
        contactId: id,
        error: error.message,
        code: error.code || 'GET_CONTACT_ERROR'
      });
      
      if (error instanceof ContactServiceError) {
        throw error;
      }
      
      throw new ContactServiceError(
        `Error obteniendo contacto ${id}: ${error.message}`,
        'GET_CONTACT_ERROR'
      );
    }
  }

  async getContactByPhone(phone) {
    try {
      if (!phone || typeof phone !== 'string') {
        throw new ContactServiceError(
          'Número de teléfono requerido y debe ser una cadena',
          'INVALID_PHONE_NUMBER'
        );
      }
      
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      
      if (cleanPhone.length < 8) {
        throw new ContactServiceError(
          'Número de teléfono debe tener al menos 8 dígitos',
          'INVALID_PHONE_FORMAT'
        );
      }
      
      const contact = await this.db.models.Contact.findOne({
        where: {
          phone: cleanPhone
        }
      });
      
      if (!contact) {
        logger.info('Contacto no encontrado por teléfono', { phone: cleanPhone });
        return null;
      }
      
      const contactInstance = Contact.fromJSON(contact.toJSON());
      logger.info('Contacto obtenido por teléfono exitosamente', { phone: cleanPhone, contactId: contact.phone });
      
      return contactInstance;
    } catch (error) {
      logger.error('Error obteniendo contacto por teléfono:', {
        phone,
        error: error.message,
        code: error.code || 'GET_CONTACT_BY_PHONE_ERROR'
      });
      
      if (error instanceof ContactServiceError) {
        throw error;
      }
      
      throw new ContactServiceError(
        `Error obteniendo contacto por teléfono ${phone}: ${error.message}`,
        'GET_CONTACT_BY_PHONE_ERROR'
      );
    }
  }

  async createContact(contactData) {
    try {
      if (!contactData || typeof contactData !== 'object') {
        throw new ContactServiceError(
          'Datos del contacto requeridos',
          'INVALID_CONTACT_DATA'
        );
      }
      
      if (!contactData.phone || typeof contactData.phone !== 'string') {
        throw new ContactServiceError(
          'Número de teléfono requerido',
          'MISSING_PHONE_NUMBER'
        );
      }
      
      const existing = await this.getContactByPhone(contactData.phone);
      if (existing) {
        throw new ContactServiceError(
          `El contacto con el teléfono ${contactData.phone} ya existe`,
          'DUPLICATE_PHONE_NUMBER',
          409,
          { existingContactId: existing.id }
        );
      }
      
      const newContact = new Contact(contactData);
      const saved = await this.db.append(this.files.CONTACTS, newContact.toJSON());
      
      logger.info('Contacto creado exitosamente', {
        contactId: saved.id,
        phone: contactData.phone,
        name: contactData.name
      });
      
      return Contact.fromJSON(saved);
    } catch (error) {
      logger.error('Error creando contacto:', {
        phone: contactData?.phone,
        error: error.message,
        code: error.code || 'CREATE_CONTACT_ERROR'
      });
      
      if (error instanceof ContactServiceError) {
        throw error;
      }
      
      throw new ContactServiceError(
        `Error creando contacto: ${error.message}`,
        'CREATE_CONTACT_ERROR'
      );
    }
  }

  async updateContact(id, updates) {
    try {
      if (!id || typeof id !== 'string') {
        throw new ContactServiceError(
          'ID de contacto requerido y debe ser una cadena',
          'INVALID_CONTACT_ID'
        );
      }
      
      if (!updates || typeof updates !== 'object') {
        throw new ContactServiceError(
          'Datos de actualización requeridos',
          'INVALID_UPDATE_DATA'
        );
      }
      
      const current = await this.getContactById(id);
      if (!current) {
        throw new ContactServiceError(
          `Contacto con ID ${id} no encontrado`,
          'CONTACT_NOT_FOUND',
          404
        );
      }
      
      if (updates.phone && updates.phone !== current.phone) {
        const existing = await this.getContactByPhone(updates.phone);
        if (existing && existing.id !== id) {
          throw new ContactServiceError(
            `El teléfono ${updates.phone} ya está en uso por otro contacto`,
            'DUPLICATE_PHONE_NUMBER',
            409,
            { existingContactId: existing.id }
          );
        }
      }
      
      const updatedContact = new Contact({ ...current.toJSON(), ...updates });
      const saved = await this.db.update(this.files.CONTACTS, id, updatedContact.toJSON());
      
      logger.info('Contacto actualizado exitosamente', {
        contactId: id,
        updatedFields: Object.keys(updates)
      });
      
      return Contact.fromJSON(saved);
    } catch (error) {
      logger.error('Error actualizando contacto:', {
        contactId: id,
        error: error.message,
        code: error.code || 'UPDATE_CONTACT_ERROR'
      });
      
      if (error instanceof ContactServiceError) {
        throw error;
      }
      
      throw new ContactServiceError(
        `Error actualizando contacto ${id}: ${error.message}`,
        'UPDATE_CONTACT_ERROR'
      );
    }
  }

  async deleteContact(id) {
    try {
      if (!id || typeof id !== 'string') {
        throw new ContactServiceError(
          'ID de contacto requerido y debe ser una cadena',
          'INVALID_CONTACT_ID'
        );
      }
      
      const contact = await this.getContactById(id);
      if (!contact) {
        throw new ContactServiceError(
          `Contacto con ID ${id} no encontrado`,
          'CONTACT_NOT_FOUND',
          404
        );
      }
      
      const deleted = await this.db.delete(this.files.CONTACTS, id);
      
      if (!deleted) {
        throw new ContactServiceError(
          `No se pudo eliminar el contacto ${id}`,
          'DELETE_FAILED'
        );
      }
      
      logger.info('Contacto eliminado exitosamente', {
        contactId: id,
        phone: contact.phone
      });
      
      return true;
    } catch (error) {
      logger.error('Error eliminando contacto:', {
        contactId: id,
        error: error.message,
        code: error.code || 'DELETE_CONTACT_ERROR'
      });
      
      if (error instanceof ContactServiceError) {
        throw error;
      }
      
      throw new ContactServiceError(
        `Error eliminando contacto ${id}: ${error.message}`,
        'DELETE_CONTACT_ERROR'
      );
    }
  }

  // ===== GESTIÓN DE ETIQUETAS (TAGS) =====

  async getAllTags() {
    return await this.db.read(this.files.TAGS) || [];
  }

  async createTag(tagData) {
    const newTag = { id: `tag_${Date.now()}`, ...tagData };
    await this.db.append(this.files.TAGS, newTag);
    return newTag;
  }

  async addTagToContact(contactId, tag) {
    const contact = await this.getContactById(contactId);
    if (!contact) throw new Error('Contacto no encontrado');
    contact.addTag(tag);
    return this.updateContact(contactId, { tags: contact.tags });
  }

  async removeTagFromContact(contactId, tag) {
    const contact = await this.getContactById(contactId);
    if (!contact) throw new Error('Contacto no encontrado');
    contact.removeTag(tag);
    return this.updateContact(contactId, { tags: contact.tags });
  }

  // ===== GESTIÓN DE CAMPOS PERSONALIZADOS =====

  async getAllCustomFields() {
    return await this.db.read(this.files.CUSTOM_FIELDS) || [];
  }

  async createCustomField(fieldData) {
    const newField = { id: `field_${Date.now()}`, ...fieldData };
    await this.db.append(this.files.CUSTOM_FIELDS, newField);
    return newField;
  }

  async setCustomFieldValue(contactId, fieldName, value) {
    const contact = await this.getContactById(contactId);
    if (!contact) throw new Error('Contacto no encontrado');
    contact.customFields[fieldName] = value;
    return this.updateContact(contactId, { customFields: contact.customFields });
  }

  // ===== GESTIÓN DE SEGMENTOS =====

  async getAllSegments() {
    return await this.db.read(this.files.SEGMENTS) || [];
  }

  async createSegment(segmentData) {
    const newSegment = { id: `seg_${Date.now()}`, ...segmentData };
    await this.db.append(this.files.SEGMENTS, newSegment);
    return newSegment;
  }

  async getSegmentContacts(segmentId) {
    const segment = await this.db.findOne(this.files.SEGMENTS, s => s.id === segmentId);
    if (!segment) return [];
    const allContacts = await this.getAllContacts();
    return allContacts.contacts.filter(contact => this.matchesCriteria(contact, segment.criteria));
  }

  matchesCriteria(contact, criteria) {
    if (criteria.tags && criteria.tags.length > 0) {
      if (!criteria.tags.some(tag => contact.tags.includes(tag))) return false;
    }
    if (criteria.customFields) {
      for (const [field, value] of Object.entries(criteria.customFields)) {
        if (contact.customFields?.[field] !== value) return false;
      }
    }
    return true;
  }

  // ===== IMPORTACIÓN Y ESTADÍSTICAS =====

  async importContacts(contactsData) {
    const results = { imported: 0, updated: 0, errors: [] };
    for (const data of contactsData) {
      try {
        const existing = await this.getContactByPhone(data.phone);
        if (existing) {
          await this.updateContact(existing.id, data);
          results.updated++;
        } else {
          await this.createContact(data);
          results.imported++;
        }
      } catch (error) {
        results.errors.push({ phone: data.phone, error: error.message });
      }
    }
    logger.info(`Importación completada: ${results.imported} nuevos, ${results.updated} actualizados.`);
    return results;
  }

  async getContactStats() {
    const contacts = (await this.getAllContacts()).contacts || [];
    const stats = { total: contacts.length, byStatus: {}, withTags: 0 };
    contacts.forEach(c => {
      stats.byStatus[c.status] = (stats.byStatus[c.status] || 0) + 1;
      if (c.tags && c.tags.length > 0) stats.withTags++;
    });
    return stats;
  }
}

// Instancia singleton del servicio
let serviceInstance = null;

export function getContactService() {
  if (!serviceInstance) {
    serviceInstance = new ContactService();
  }
  return serviceInstance;
}
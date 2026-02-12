/**
 * @fileoverview Servicio de Gestión de Contactos
 * 
 * Servicio completo para la gestión de contactos con soporte para operaciones CRUD,
 * integración con 360 Dialog, normalización de datos y funciones avanzadas de búsqueda.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import { Contact, Conversation, Message } from '../adapters/SequelizeAdapter.js';
import { createLogger } from './core/core/logger.js';
import { Op } from '../adapters/SequelizeAdapter.js';

const logger = createLogger('CONTACT_SERVICE');

/**
 * Servicio de Contactos
 */
class ContactService {
  
  /**
   * Crear nuevo contacto
   */
  static async createContact(contactData) {
    try {
      logger.info(`📝 Creando contacto: ${contactData.phone}`);
      
      // Normalizar número de teléfono
      const normalizedPhone = Contact.normalizePhone(contactData.phone);
      
      // Verificar si ya existe
      const existingContact = await Contact.findByPhone(normalizedPhone);
      if (existingContact) {
        logger.warn(`⚠️ Contacto ya existe: ${normalizedPhone}`);
        return existingContact;
      }
      
      // Preparar datos del contacto
      const contactPayload = {
        ...contactData,
        phone: normalizedPhone,
        status: contactData.status || 'active',
        source: contactData.source || 'manual',
        customFields: contactData.customFields || {},
        tags: contactData.tags || [],
        segments: contactData.segments || [],
        metadata: {
          ...contactData.metadata,
          createdAt: new Date().toISOString(),
          createdBy: contactData.createdBy || 'system'
        }
      };
      
      // Crear contacto
      const contact = await Contact.create(contactPayload);
      
      logger.info(`✅ Contacto creado exitosamente: ${contact.uuid}`);
      return contact;
      
    } catch (error) {
      logger.error('❌ Error al crear contacto:', error);
      throw new Error(`Error al crear contacto: ${error.message}`);
    }
  }

  /**
   * Obtener contacto por ID
   */
  static async getContactById(contactId, options = {}) {
    try {
      const include = [];
      
      // Incluir conversaciones si se solicita
      if (options.includeConversations) {
        include.push({
          model: Conversation,
          as: 'conversations',
          limit: options.conversationLimit || 5,
          order: [['created_at', 'DESC']],
          include: options.includeMessages ? [{
            model: Message,
            as: 'messages',
            limit: 3,
            order: [['created_at', 'DESC']]
          }] : []
        });
      }
      
      // Incluir mensajes directos si se solicita
      if (options.includeMessages && !options.includeConversations) {
        include.push({
          model: Message,
          as: 'messages',
          limit: options.messageLimit || 10,
          order: [['created_at', 'DESC']]
        });
      }
      
      const contact = await Contact.findByPk(contactId, {
        include
      });
      
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al obtener contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener contacto por teléfono
   */
  static async getContactByPhone(phone, options = {}) {
    try {
      const normalizedPhone = Contact.normalizePhone(phone);
      
      const include = [];
      
      if (options.includeConversations) {
        include.push({
          model: Conversation,
          as: 'conversations',
          limit: options.conversationLimit || 5,
          order: [['created_at', 'DESC']]
        });
      }
      
      const contact = await Contact.findByPhone(normalizedPhone, { include });
      
      if (!contact) {
        logger.warn(`⚠️ Contacto no encontrado: ${normalizedPhone}`);
        return null;
      }
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al obtener contacto por teléfono ${phone}:`, error);
      throw error;
    }
  }

  /**
   * Obtener contacto por UUID
   */
  static async getContactByUuid(uuid, options = {}) {
    try {
      const include = [];
      
      if (options.includeConversations) {
        include.push({
          model: Conversation,
          as: 'conversations',
          limit: options.conversationLimit || 5,
          order: [['created_at', 'DESC']]
        });
      }
      
      const contact = await Contact.findOne({
        where: { uuid },
        include
      });
      
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${uuid}`);
      }
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al obtener contacto por UUID ${uuid}:`, error);
      throw error;
    }
  }

  /**
   * Actualizar contacto
   */
  static async updateContact(contactId, updateData) {
    try {
      logger.info(`📝 Actualizando contacto: ${contactId}`);
      
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      // Normalizar teléfono si se está actualizando
      if (updateData.phone) {
        updateData.phone = Contact.normalizePhone(updateData.phone);
        
        // Verificar que no exista otro contacto con el mismo teléfono
        const existingContact = await Contact.findByPhone(updateData.phone);
        if (existingContact && existingContact.id !== contact.id) {
          throw new Error(`Ya existe un contacto con el teléfono: ${updateData.phone}`);
        }
      }
      
      // Actualizar metadatos
      if (updateData.metadata) {
        updateData.metadata = {
          ...contact.metadata,
          ...updateData.metadata,
          updatedAt: new Date().toISOString()
        };
      }
      
      // Actualizar campos personalizados
      if (updateData.customFields) {
        updateData.customFields = {
          ...contact.customFields,
          ...updateData.customFields
        };
      }
      
      // Actualizar contacto
      await contact.update(updateData);
      
      logger.info(`✅ Contacto actualizado exitosamente: ${contact.uuid}`);
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al actualizar contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar contacto (soft delete)
   */
  static async deleteContact(contactId, options = {}) {
    try {
      logger.info(`🗑️ Eliminando contacto: ${contactId}`);
      
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      if (options.hard) {
        // Eliminación física
        await contact.destroy();
        logger.info(`✅ Contacto eliminado físicamente: ${contact.uuid}`);
      } else {
        // Eliminación lógica
        await contact.update({
          status: 'deleted',
          deletedAt: new Date(),
          metadata: {
            ...contact.metadata,
            deletedAt: new Date().toISOString(),
            deletedBy: options.deletedBy || 'system'
          }
        });
        logger.info(`✅ Contacto marcado como eliminado: ${contact.uuid}`);
      }
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Error al eliminar contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Buscar contactos con filtros
   */
  static async searchContacts(filters = {}, options = {}) {
    try {
      const where = {};
      const include = [];
      
      // Filtro por estado
      if (filters.status) {
        where.status = Array.isArray(filters.status) ? filters.status : [filters.status];
      } else {
        // Por defecto, excluir eliminados
        where.status = { [Op.ne]: 'deleted' };
      }
      
      // Filtro por fuente
      if (filters.source) {
        where.source = filters.source;
      }
      
      // Filtro por canal
      if (filters.channel) {
        where.channel = filters.channel;
      }
      
      // Filtro por etiquetas
      if (filters.tags && filters.tags.length > 0) {
        where.tags = {
          [Op.overlap]: filters.tags
        };
      }
      
      // Filtro por segmentos
      if (filters.segments && filters.segments.length > 0) {
        where.segments = {
          [Op.overlap]: filters.segments
        };
      }
      
      // Filtro por fechas
      if (filters.dateFrom) {
        where.created_at = { [Op.gte]: filters.dateFrom };
      }
      
      if (filters.dateTo) {
        where.created_at = {
          ...where.created_at,
          [Op.lte]: filters.dateTo
        };
      }
      
      // Búsqueda por texto
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${filters.search}%` } },
          { phone: { [Op.iLike]: `%${filters.search}%` } },
          { email: { [Op.iLike]: `%${filters.search}%` } }
        ];
      }
      
      // Filtro por teléfono específico
      if (filters.phone) {
        where.phone = Contact.normalizePhone(filters.phone);
      }
      
      // Filtro por email
      if (filters.email) {
        where.email = { [Op.iLike]: `%${filters.email}%` };
      }
      
      // Incluir conversaciones si se solicita
      if (options.includeConversations) {
        include.push({
          model: Conversation,
          as: 'conversations',
          limit: 3,
          order: [['created_at', 'DESC']]
        });
      }
      
      // Incluir estadísticas si se solicita
      if (options.includeStats) {
        include.push({
          model: Message,
          as: 'messages',
          attributes: [],
          required: false
        });
      }
      
      const contacts = await Contact.findAll({
        where,
        include,
        order: options.order || [['created_at', 'DESC']],
        limit: options.limit || 50,
        offset: options.offset || 0,
        distinct: true
      });
      
      return contacts;
      
    } catch (error) {
      logger.error('❌ Error al buscar contactos:', error);
      throw error;
    }
  }

  /**
   * Obtener contactos activos
   */
  static async getActiveContacts(options = {}) {
    try {
      return await this.searchContacts(
        { status: 'active' },
        options
      );
    } catch (error) {
      logger.error('❌ Error al obtener contactos activos:', error);
      throw error;
    }
  }

  /**
   * Obtener contactos por segmento
   */
  static async getContactsBySegment(segment, options = {}) {
    try {
      return await this.searchContacts(
        { segments: [segment] },
        options
      );
    } catch (error) {
      logger.error(`❌ Error al obtener contactos del segmento ${segment}:`, error);
      throw error;
    }
  }

  /**
   * Obtener contactos por etiqueta
   */
  static async getContactsByTag(tag, options = {}) {
    try {
      return await this.searchContacts(
        { tags: [tag] },
        options
      );
    } catch (error) {
      logger.error(`❌ Error al obtener contactos con etiqueta ${tag}:`, error);
      throw error;
    }
  }

  /**
   * Crear o actualizar contacto
   */
  static async createOrUpdateContact(contactData) {
    try {
      const normalizedPhone = Contact.normalizePhone(contactData.phone);
      
      // Buscar contacto existente
      let contact = await Contact.findByPhone(normalizedPhone);
      
      if (contact) {
        // Actualizar contacto existente
        logger.info(`📝 Actualizando contacto existente: ${normalizedPhone}`);
        
        const updateData = {
          ...contactData,
          phone: normalizedPhone,
          lastContactAt: new Date(),
          metadata: {
            ...contact.metadata,
            ...contactData.metadata,
            updatedAt: new Date().toISOString()
          }
        };
        
        // Fusionar campos personalizados
        if (contactData.customFields) {
          updateData.customFields = {
            ...contact.customFields,
            ...contactData.customFields
          };
        }
        
        // Fusionar etiquetas
        if (contactData.tags) {
          const existingTags = contact.tags || [];
          const newTags = contactData.tags || [];
          updateData.tags = [...new Set([...existingTags, ...newTags])];
        }
        
        // Fusionar segmentos
        if (contactData.segments) {
          const existingSegments = contact.segments || [];
          const newSegments = contactData.segments || [];
          updateData.segments = [...new Set([...existingSegments, ...newSegments])];
        }
        
        await contact.update(updateData);
        
      } else {
        // Crear nuevo contacto
        logger.info(`📝 Creando nuevo contacto: ${normalizedPhone}`);
        contact = await this.createContact(contactData);
      }
      
      return contact;
      
    } catch (error) {
      logger.error('❌ Error al crear o actualizar contacto:', error);
      throw error;
    }
  }

  /**
   * Agregar etiqueta a contacto
   */
  static async addTagToContact(contactId, tag) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      await contact.addTag(tag);
      logger.info(`🏷️ Etiqueta agregada: ${tag} -> ${contact.phone}`);
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al agregar etiqueta ${tag} al contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Remover etiqueta de contacto
   */
  static async removeTagFromContact(contactId, tag) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      await contact.removeTag(tag);
      logger.info(`🏷️ Etiqueta removida: ${tag} <- ${contact.phone}`);
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al remover etiqueta ${tag} del contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Agregar segmento a contacto
   */
  static async addSegmentToContact(contactId, segment) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      await contact.addSegment(segment);
      logger.info(`📊 Segmento agregado: ${segment} -> ${contact.phone}`);
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al agregar segmento ${segment} al contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Remover segmento de contacto
   */
  static async removeSegmentFromContact(contactId, segment) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      await contact.removeSegment(segment);
      logger.info(`📊 Segmento removido: ${segment} <- ${contact.phone}`);
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al remover segmento ${segment} del contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Actualizar campo personalizado
   */
  static async updateCustomField(contactId, fieldName, fieldValue) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      await contact.setCustomField(fieldName, fieldValue);
      logger.info(`🔧 Campo personalizado actualizado: ${fieldName} -> ${contact.phone}`);
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al actualizar campo ${fieldName} del contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Bloquear contacto
   */
  static async blockContact(contactId, reason = null) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      await contact.block(reason);
      logger.info(`🚫 Contacto bloqueado: ${contact.phone}`);
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al bloquear contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Desbloquear contacto
   */
  static async unblockContact(contactId) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      await contact.unblock();
      logger.info(`✅ Contacto desbloqueado: ${contact.phone}`);
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al desbloquear contacto ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Marcar contacto como VIP
   */
  static async markAsVip(contactId) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        throw new Error(`Contacto no encontrado: ${contactId}`);
      }
      
      await contact.markAsVip();
      logger.info(`⭐ Contacto marcado como VIP: ${contact.phone}`);
      
      return contact;
      
    } catch (error) {
      logger.error(`❌ Error al marcar contacto ${contactId} como VIP:`, error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de contactos
   */
  static async getContactStats(filters = {}) {
    try {
      const where = {};
      
      // Aplicar filtros de fecha
      if (filters.dateFrom) {
        where.created_at = { [Op.gte]: filters.dateFrom };
      }
      
      if (filters.dateTo) {
        where.created_at = {
          ...where.created_at,
          [Op.lte]: filters.dateTo
        };
      }
      
      // Obtener estadísticas generales
      const totalContacts = await Contact.count({ where });
      
      const statusStats = await Contact.findAll({
        where,
        attributes: [
          'status',
          [Contact.sequelize.fn('COUNT', Contact.sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });
      
      const sourceStats = await Contact.findAll({
        where,
        attributes: [
          'source',
          [Contact.sequelize.fn('COUNT', Contact.sequelize.col('id')), 'count']
        ],
        group: ['source'],
        raw: true
      });
      
      const channelStats = await Contact.findAll({
        where,
        attributes: [
          'channel',
          [Contact.sequelize.fn('COUNT', Contact.sequelize.col('id')), 'count']
        ],
        group: ['channel'],
        raw: true
      });
      
      return {
        total: totalContacts,
        byStatus: statusStats,
        bySource: sourceStats,
        byChannel: channelStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('❌ Error al obtener estadísticas de contactos:', error);
      throw error;
    }
  }

  /**
   * Importar contactos desde CSV
   */
  static async importContactsFromCsv(csvData, options = {}) {
    try {
      logger.info('📥 Iniciando importación de contactos desde CSV');
      
      const results = {
        total: 0,
        created: 0,
        updated: 0,
        errors: []
      };
      
      for (const row of csvData) {
        try {
          results.total++;
          
          // Validar datos requeridos
          if (!row.phone) {
            results.errors.push({
              row: results.total,
              error: 'Teléfono requerido'
            });
            continue;
          }
          
          // Preparar datos del contacto
          const contactData = {
            phone: row.phone,
            name: row.name || null,
            email: row.email || null,
            source: options.source || 'csv_import',
            channel: options.channel || 'whatsapp',
            tags: row.tags ? row.tags.split(',').map(t => t.trim()) : [],
            segments: row.segments ? row.segments.split(',').map(s => s.trim()) : [],
            customFields: {},
            metadata: {
              importedAt: new Date().toISOString(),
              importedBy: options.importedBy || 'system'
            }
          };
          
          // Agregar campos personalizados
          Object.keys(row).forEach(key => {
            if (!['phone', 'name', 'email', 'tags', 'segments'].includes(key)) {
              contactData.customFields[key] = row[key];
            }
          });
          
          // Crear o actualizar contacto
          const contact = await this.createOrUpdateContact(contactData);
          
          if (contact.isNewRecord) {
            results.created++;
          } else {
            results.updated++;
          }
          
        } catch (error) {
          results.errors.push({
            row: results.total,
            error: error.message
          });
        }
      }
      
      logger.info(`✅ Importación completada: ${results.created} creados, ${results.updated} actualizados, ${results.errors.length} errores`);
      return results;
      
    } catch (error) {
      logger.error('❌ Error en importación de contactos:', error);
      throw error;
    }
  }

  /**
   * Exportar contactos a CSV
   */
  static async exportContactsToCsv(filters = {}, options = {}) {
    try {
      logger.info('📤 Iniciando exportación de contactos a CSV');
      
      const contacts = await this.searchContacts(filters, {
        limit: options.limit || 10000,
        includeStats: true
      });
      
      const csvData = contacts.map(contact => ({
        id: contact.id,
        uuid: contact.uuid,
        phone: contact.phone,
        name: contact.name,
        email: contact.email,
        status: contact.status,
        source: contact.source,
        channel: contact.channel,
        tags: contact.tags ? contact.tags.join(', ') : '',
        segments: contact.segments ? contact.segments.join(', ') : '',
        createdAt: contact.created_at,
        lastContactAt: contact.lastContactAt,
        messageCount: contact.messageCount,
        conversationCount: contact.conversationCount,
        ...contact.customFields
      }));
      
      logger.info(`✅ Exportación completada: ${csvData.length} contactos`);
      return csvData;
      
    } catch (error) {
      logger.error('❌ Error en exportación de contactos:', error);
      throw error;
    }
  }

  /**
   * Limpiar contactos duplicados
   */
  static async cleanupDuplicates(options = {}) {
    try {
      logger.info('🧹 Iniciando limpieza de contactos duplicados');
      
      // Buscar duplicados por teléfono
      const duplicates = await Contact.findAll({
        attributes: [
          'phone',
          [Contact.sequelize.fn('COUNT', Contact.sequelize.col('id')), 'count'],
          [Contact.sequelize.fn('MIN', Contact.sequelize.col('id')), 'keepId']
        ],
        group: ['phone'],
        having: Contact.sequelize.literal('COUNT(id) > 1'),
        raw: true
      });
      
      let mergedCount = 0;
      
      for (const duplicate of duplicates) {
        try {
          // Obtener todos los contactos con este teléfono
          const contacts = await Contact.findAll({
            where: { phone: duplicate.phone },
            order: [['created_at', 'ASC']]
          });
          
          if (contacts.length <= 1) continue;
          
          // Mantener el primer contacto (más antiguo)
          const keepContact = contacts[0];
          const duplicateContacts = contacts.slice(1);
          
          // Fusionar datos de los duplicados
          for (const dupContact of duplicateContacts) {
            // Fusionar etiquetas
            const allTags = [...new Set([
              ...(keepContact.tags || []),
              ...(dupContact.tags || [])
            ])];
            
            // Fusionar segmentos
            const allSegments = [...new Set([
              ...(keepContact.segments || []),
              ...(dupContact.segments || [])
            ])];
            
            // Fusionar campos personalizados
            const allCustomFields = {
              ...keepContact.customFields,
              ...dupContact.customFields
            };
            
            // Actualizar contacto principal
            await keepContact.update({
              name: keepContact.name || dupContact.name,
              email: keepContact.email || dupContact.email,
              tags: allTags,
              segments: allSegments,
              customFields: allCustomFields,
              metadata: {
                ...keepContact.metadata,
                mergedFrom: [
                  ...(keepContact.metadata?.mergedFrom || []),
                  dupContact.id
                ],
                lastMergeAt: new Date().toISOString()
              }
            });
            
            // Actualizar referencias en conversaciones y mensajes
            await Conversation.update(
              { contactId: keepContact.id },
              { where: { contactId: dupContact.id } }
            );
            
            await Message.update(
              { contactId: keepContact.id },
              { where: { contactId: dupContact.id } }
            );
            
            // Eliminar contacto duplicado
            if (options.hardDelete) {
              await dupContact.destroy();
            } else {
              await dupContact.update({ status: 'merged' });
            }
            
            mergedCount++;
          }
          
        } catch (error) {
          logger.error(`❌ Error al procesar duplicado ${duplicate.phone}:`, error);
        }
      }
      
      logger.info(`✅ Limpieza completada: ${mergedCount} contactos fusionados`);
      return { mergedCount, duplicatesFound: duplicates.length };
      
    } catch (error) {
      logger.error('❌ Error en limpieza de duplicados:', error);
      throw error;
    }
  }
}

export default ContactService;
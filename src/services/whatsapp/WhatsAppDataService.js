/**
 * @fileoverview Servicio de datos para WhatsApp Business Account
 * Maneja el almacenamiento de contactos, conversaciones y mensajes
 * usando el esquema de base de datos existente
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import { Sequelize, DataTypes } from '../../adapters/SequelizeAdapter.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createLogger } from '../core/core/logger.js';

const logger = createLogger('WHATSAPP_DATA_SERVICE');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de la base de datos SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(process.cwd(), 'data', 'chatbot_dev.db'),
  logging: false
});

// Definir modelos usando el esquema existente
const Contact = sequelize.define('Contact', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING
  },
  email: {
    type: DataTypes.STRING
  },
  profile_picture_url: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active'
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  custom_fields: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  last_interaction: {
    type: DataTypes.DATE
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'contacts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contact_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Contact,
      key: 'id'
    }
  },
  channel: {
    type: DataTypes.STRING,
    defaultValue: 'whatsapp'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active'
  },
  priority: {
    type: DataTypes.STRING,
    defaultValue: 'medium'
  },
  assigned_to: {
    type: DataTypes.INTEGER
  },
  subject: {
    type: DataTypes.STRING
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  last_message_at: {
    type: DataTypes.DATE
  },
  message_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  closed_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'conversations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  conversation_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Conversation,
      key: 'id'
    }
  },
  contact_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Contact,
      key: 'id'
    }
  },
  external_id: {
    type: DataTypes.STRING,
    unique: true
  },
  direction: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'text'
  },
  content: {
    type: DataTypes.TEXT
  },
  media_url: {
    type: DataTypes.TEXT
  },
  media_type: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending'
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  error_message: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'messages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Nota: Las asociaciones se manejan manualmente en el adaptador personalizado

/**
 * Servicio de datos para WhatsApp Business Account
 */
class WhatsAppDataService {
  constructor() {
    this.sequelize = sequelize;
    this.Contact = Contact;
    this.Conversation = Conversation;
    this.Message = Message;
    this.logger = logger;
  }

  /**
   * Inicializa la conexión a la base de datos
   */
  async initialize() {
    try {
      await this.sequelize.authenticate();
      this.logger.info('✅ Conexión a base de datos establecida');
      return true;
    } catch (error) {
      this.logger.error('❌ Error conectando a la base de datos:', error);
      throw error;
    }
  }

  /**
   * Crea o actualiza un contacto basado en los datos del webhook
   * @param {Object} contactData - Datos del contacto del webhook
   * @param {string} contactData.wa_id - WhatsApp ID del contacto
   * @param {Object} contactData.profile - Perfil del contacto
   * @param {string} contactData.profile.name - Nombre del contacto
   * @returns {Object} Contacto creado o actualizado
   */
  async upsertContact(contactData) {
    try {
      const { wa_id, profile } = contactData;
      
      // Formatear número de teléfono
      const phone = wa_id.startsWith('+') ? wa_id : `+${wa_id}`;
      
      const [contact, created] = await this.Contact.findOrCreate({
        where: { phone },
        defaults: {
          phone,
          name: profile?.name || null,
          status: 'active',
          last_interaction: new Date(),
          custom_fields: {
            whatsapp_id: wa_id,
            profile_data: profile || {}
          }
        }
      });

      // Si el contacto ya existe, actualizar datos
      if (!created) {
        await contact.update({
          name: profile?.name || contact.name,
          last_interaction: new Date(),
          custom_fields: {
            ...contact.custom_fields,
            whatsapp_id: wa_id,
            profile_data: profile || {}
          }
        });
      }

      this.logger.info(`${created ? 'Creado' : 'Actualizado'} contacto: ${phone}`);
      return contact.toJSON();
    } catch (error) {
      this.logger.error('Error al crear/actualizar contacto:', error);
      throw error;
    }
  }

  /**
   * Crea o obtiene una conversación activa para un contacto
   * @param {number} contactId - ID del contacto
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Object} Conversación activa
   */
  async getOrCreateConversation(contactId, metadata = {}) {
    try {
      // Buscar conversación activa existente
      let conversation = await this.Conversation.findOne({
        where: {
          contact_id: contactId,
          status: ['active', 'pending']
        },
        order: [['updated_at', 'DESC']]
      });

      // Si no existe, crear nueva conversación
      if (!conversation) {
        conversation = await this.Conversation.create({
          contact_id: contactId,
          channel: 'whatsapp',
          status: 'active',
          priority: 'medium',
          metadata: {
            ...metadata,
            created_from: 'whatsapp_webhook'
          },
          last_message_at: new Date()
        });

        this.logger.info(`Nueva conversación creada para contacto ${contactId}`);
      } else {
        // Actualizar última actividad
        await conversation.update({
          last_message_at: new Date(),
          metadata: {
            ...conversation.metadata,
            ...metadata
          }
        });
      }

      return conversation.toJSON();
    } catch (error) {
      this.logger.error('Error al obtener/crear conversación:', error);
      throw error;
    }
  }

  /**
   * Crea un mensaje en la base de datos
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} Mensaje creado
   */
  async createMessage(messageData) {
    try {
      const {
        conversation_id,
        contact_id,
        external_id,
        direction,
        type,
        content,
        media_url,
        media_type,
        timestamp,
        metadata
      } = messageData;

      const message = await this.Message.create({
        conversation_id,
        contact_id,
        external_id,
        direction,
        type: type || 'text',
        content: content || '',
        media_url: media_url || null,
        media_type: media_type || null,
        status: direction === 'inbound' ? 'delivered' : 'pending',
        timestamp: timestamp || new Date(),
        metadata: metadata || {}
      });

      // Actualizar contador de mensajes en la conversación
      await this.Conversation.increment('message_count', {
        where: { id: conversation_id }
      });

      // Actualizar última actividad de la conversación
      await this.Conversation.update(
        { last_message_at: timestamp || new Date() },
        { where: { id: conversation_id } }
      );

      this.logger.info(`Mensaje creado: ${external_id} (${type})`);
      return message.toJSON();
    } catch (error) {
      this.logger.error('Error al crear mensaje:', error);
      throw error;
    }
  }

  /**
   * Procesa un mensaje completo del webhook de WhatsApp
   * @param {Object} webhookData - Datos del webhook
   * @returns {Object} Resultado del procesamiento
   */
  async processWhatsAppMessage(webhookData) {
    const transaction = await this.sequelize.transaction();
    
    try {
      const { contacts, messages, metadata } = webhookData;
      const results = {
        contacts: [],
        conversations: [],
        messages: [],
        errors: []
      };

      // Procesar cada contacto
      for (const contactData of contacts || []) {
        try {
          const contact = await this.upsertContact(contactData);
          results.contacts.push(contact);
        } catch (error) {
          this.logger.error('Error procesando contacto:', error);
          results.errors.push({
            type: 'contact',
            data: contactData,
            error: error.message
          });
        }
      }

      // Procesar cada mensaje
      for (const messageData of messages || []) {
        try {
          // Encontrar el contacto correspondiente
          const contact = results.contacts.find(c => 
            c.phone === `+${messageData.from}` || 
            c.custom_fields?.whatsapp_id === messageData.from
          );

          if (!contact) {
            throw new Error(`Contacto no encontrado para el número: ${messageData.from}`);
          }

          // Obtener o crear conversación
          const conversation = await this.getOrCreateConversation(
            contact.id,
            {
              phone_number_id: metadata?.phone_number_id,
              display_phone_number: metadata?.display_phone_number
            }
          );
          results.conversations.push(conversation);

          // Crear mensaje
          const message = await this.createMessage({
            conversation_id: conversation.id,
            contact_id: contact.id,
            external_id: messageData.id,
            direction: 'inbound',
            type: messageData.type,
            content: this.extractMessageContent(messageData),
            media_url: this.extractMediaUrl(messageData),
            media_type: this.extractMediaType(messageData),
            timestamp: new Date(parseInt(messageData.timestamp) * 1000),
            metadata: {
              whatsapp_message_id: messageData.id,
              original_data: messageData
            }
          });
          results.messages.push(message);

        } catch (error) {
          this.logger.error('Error procesando mensaje:', error);
          results.errors.push({
            type: 'message',
            data: messageData,
            error: error.message
          });
        }
      }

      await transaction.commit();
      
      this.logger.info(`Procesamiento completado: ${results.contacts.length} contactos, ${results.messages.length} mensajes`);
      return results;

    } catch (error) {
      await transaction.rollback();
      this.logger.error('Error en procesamiento de webhook:', error);
      throw error;
    }
  }

  /**
   * Extrae el contenido del mensaje según su tipo
   * @param {Object} messageData - Datos del mensaje
   * @returns {string} Contenido extraído
   */
  extractMessageContent(messageData) {
    const { type } = messageData;
    
    switch (type) {
      case 'text':
        return messageData.text?.body || '';
      case 'image':
        return messageData.image?.caption || 'Imagen enviada';
      case 'audio':
        return 'Audio enviado';
      case 'video':
        return messageData.video?.caption || 'Video enviado';
      case 'document':
        return messageData.document?.filename || 'Documento enviado';
      case 'location':
        return `Ubicación: ${messageData.location?.latitude}, ${messageData.location?.longitude}`;
      case 'contact':
        return `Contacto compartido: ${messageData.contact?.name || 'Sin nombre'}`;
      case 'interactive':
        return this.extractInteractiveContent(messageData.interactive);
      default:
        return `Mensaje de tipo: ${type}`;
    }
  }

  /**
   * Extrae contenido de mensajes interactivos
   * @param {Object} interactive - Datos del mensaje interactivo
   * @returns {string} Contenido extraído
   */
  extractInteractiveContent(interactive) {
    if (interactive?.button_reply) {
      return `Botón seleccionado: ${interactive.button_reply.title}`;
    }
    if (interactive?.list_reply) {
      return `Opción seleccionada: ${interactive.list_reply.title}`;
    }
    return 'Mensaje interactivo';
  }

  /**
   * Extrae la URL del media si existe
   * @param {Object} messageData - Datos del mensaje
   * @returns {string|null} URL del media
   */
  extractMediaUrl(messageData) {
    const { type } = messageData;
    
    switch (type) {
      case 'image':
        return messageData.image?.id || null;
      case 'audio':
        return messageData.audio?.id || null;
      case 'video':
        return messageData.video?.id || null;
      case 'document':
        return messageData.document?.id || null;
      default:
        return null;
    }
  }

  /**
   * Extrae el tipo de media
   * @param {Object} messageData - Datos del mensaje
   * @returns {string|null} Tipo de media
   */
  extractMediaType(messageData) {
    const { type } = messageData;
    
    switch (type) {
      case 'image':
        return messageData.image?.mime_type || 'image/jpeg';
      case 'audio':
        return messageData.audio?.mime_type || 'audio/ogg';
      case 'video':
        return messageData.video?.mime_type || 'video/mp4';
      case 'document':
        return messageData.document?.mime_type || 'application/octet-stream';
      default:
        return null;
    }
  }

  /**
   * Obtiene estadísticas de mensajes
   * @param {Object} filters - Filtros opcionales
   * @returns {Object} Estadísticas
   */
  async getMessageStats(filters = {}) {
    try {
      const whereClause = {};
      
      if (filters.startDate) {
        whereClause.timestamp = {
          [Sequelize.Op.gte]: filters.startDate
        };
      }
      
      if (filters.endDate) {
        whereClause.timestamp = {
          ...whereClause.timestamp,
          [Sequelize.Op.lte]: filters.endDate
        };
      }

      const stats = await this.Message.findAll({
        attributes: [
          'direction',
          'type',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        where: whereClause,
        group: ['direction', 'type'],
        raw: true
      });

      return stats;
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Cierra la conexión a la base de datos
   */
  async close() {
    try {
      await this.sequelize.close();
      this.logger.info('Conexión a base de datos cerrada');
    } catch (error) {
      this.logger.error('Error cerrando conexión:', error);
    }
  }
}

export default WhatsAppDataService;
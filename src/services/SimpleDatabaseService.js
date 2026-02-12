/**
 * @fileoverview Servicio de Base de Datos Simplificado
 * 
 * Versión simplificada del DatabaseService que evita dependencias circulares
 * y proporciona funcionalidad básica de base de datos.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import { Sequelize, DataTypes } from 'sequelize';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SimpleDatabaseService {
  constructor() {
    this.sequelize = null;
    this.models = {};
    this.isInitialized = false;
  }

  /**
   * Inicializar la conexión a la base de datos
   */
  async initialize() {
    if (this.isInitialized) {
      return this.sequelize;
    }

    try {
      // Configuración de la base de datos
      const dbConfig = {
        dialect: 'sqlite',
        storage: join(__dirname, '../../data/chatbot_dev.db'),
        logging: false, // Desactivar logging para evitar spam
        define: {
          timestamps: true,
          underscored: true
        }
      };

      // Crear instancia de Sequelize
      this.sequelize = new Sequelize(dbConfig);

      // Probar conexión
      await this.sequelize.authenticate();
      console.log('✅ SimpleDatabaseService: Conexión establecida');

      // Definir modelos básicos
      this.defineModels();

      // Sincronizar modelos
      await this.sequelize.sync({ alter: false });
      console.log('✅ SimpleDatabaseService: Modelos sincronizados');

      this.isInitialized = true;
      return this.sequelize;

    } catch (error) {
      console.error('❌ SimpleDatabaseService: Error de inicialización:', error.message);
      throw error;
    }
  }

  /**
   * Definir modelos básicos
   */
  defineModels() {
    // Modelo Contact
    this.models.Contact = this.sequelize.define('Contact', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true
      },
      name: {
        type: DataTypes.STRING(255)
      },
      email: {
        type: DataTypes.STRING(255)
      },
      status: {
        type: DataTypes.ENUM('active', 'blocked', 'archived'),
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
    });

    // Modelo Message
    this.models.Message = this.sequelize.define('Message', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      contact_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: this.models.Contact,
          key: 'id'
        }
      },
      message_id: {
        type: DataTypes.STRING(255),
        unique: true
      },
      type: {
        type: DataTypes.ENUM('text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'template'),
        defaultValue: 'text'
      },
      direction: {
        type: DataTypes.ENUM('inbound', 'outbound'),
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT
      },
      media_url: {
        type: DataTypes.TEXT
      },
      status: {
        type: DataTypes.ENUM('sent', 'delivered', 'read', 'failed'),
        defaultValue: 'sent'
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false
      },
      metadata: {
        type: DataTypes.JSON,
        defaultValue: {}
      },
      is_automated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    });

    // Modelo Conversation
    this.models.Conversation = this.sequelize.define('Conversation', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      contact_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: this.models.Contact,
          key: 'id'
        }
      },
      channel: {
        type: DataTypes.ENUM('whatsapp', 'facebook', 'telegram', 'instagram', 'web', 'email', 'sms'),
        defaultValue: 'whatsapp'
      },
      status: {
        type: DataTypes.ENUM('active', 'pending', 'resolved', 'closed', 'archived'),
        defaultValue: 'active'
      },
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium'
      },
      subject: {
        type: DataTypes.STRING(255)
      },
      last_message_at: {
        type: DataTypes.DATE
      },
      message_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      tags: {
        type: DataTypes.JSON,
        defaultValue: []
      },
      metadata: {
        type: DataTypes.JSON,
        defaultValue: {}
      }
    });

    // Definir asociaciones
    this.models.Contact.hasMany(this.models.Conversation, { foreignKey: 'contact_id' });
    this.models.Conversation.belongsTo(this.models.Contact, { foreignKey: 'contact_id' });

    this.models.Conversation.hasMany(this.models.Message, { foreignKey: 'conversation_id' });
    this.models.Message.belongsTo(this.models.Conversation, { foreignKey: 'conversation_id' });

    this.models.Contact.hasMany(this.models.Message, { foreignKey: 'contact_id' });
    this.models.Message.belongsTo(this.models.Contact, { foreignKey: 'contact_id' });
  }

  /**
   * Verificar salud de la base de datos
   */
  async healthCheck() {
    try {
      if (!this.sequelize) {
        return { status: 'error', message: 'No hay conexión a la base de datos' };
      }

      await this.sequelize.authenticate();
      
      // Contar registros en tablas principales
      const contactCount = await this.models.Contact.count();
      const messageCount = await this.models.Message.count();
      const conversationCount = await this.models.Conversation.count();

      return {
        status: 'healthy',
        message: 'Base de datos funcionando correctamente',
        stats: {
          contacts: contactCount,
          messages: messageCount,
          conversations: conversationCount
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Obtener estadísticas de la base de datos
   */
  async getStats() {
    try {
      if (!this.sequelize) {
        return { error: 'No hay conexión a la base de datos' };
      }

      const [tables] = await this.sequelize.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
      
      const stats = {
        tables: tables.map(t => t.name),
        tableCount: tables.length,
        models: Object.keys(this.models),
        modelCount: Object.keys(this.models).length
      };

      // Agregar conteos si los modelos están disponibles
      if (this.models.Contact) {
        stats.contacts = await this.models.Contact.count();
      }
      if (this.models.Message) {
        stats.messages = await this.models.Message.count();
      }
      if (this.models.Conversation) {
        stats.conversations = await this.models.Conversation.count();
      }

      return stats;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Ejecutar en transacción
   */
  async transaction(callback) {
    if (!this.sequelize) {
      throw new Error('Base de datos no inicializada');
    }
    return await this.sequelize.transaction(callback);
  }

  /**
   * Cerrar conexión
   */
  async close() {
    if (this.sequelize) {
      await this.sequelize.close();
      this.sequelize = null;
      this.isInitialized = false;
      console.log('🔒 SimpleDatabaseService: Conexión cerrada');
    }
  }

  /**
   * Obtener modelo por nombre
   */
  getModel(modelName) {
    return this.models[modelName];
  }

  /**
   * Obtener instancia de Sequelize
   */
  getSequelize() {
    return this.sequelize;
  }
}

// Instancia singleton
let instance = null;

export function getSimpleDatabaseService() {
  if (!instance) {
    instance = new SimpleDatabaseService();
  }
  return instance;
}

export { SimpleDatabaseService };
export default SimpleDatabaseService;
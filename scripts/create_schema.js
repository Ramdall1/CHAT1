/**
 * Script para crear el esquema de base de datos SQLite
 * Adaptado desde el esquema PostgreSQL
 */

import { config } from 'dotenv';
import { Sequelize, DataTypes } from 'sequelize';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de la base de datos
const dbConfig = {
  dialect: 'sqlite',
  storage: join(__dirname, '..', 'data', 'database.sqlite'),
  logging: console.log,
  define: {
    timestamps: true,
    underscored: true
  }
};

async function createSchema() {
  let sequelize = null;
  
  try {
    console.log('🔄 Iniciando creación del esquema de base de datos...');
    
    // Crear instancia de Sequelize
    sequelize = new Sequelize(dbConfig);
    
    // Probar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');
    
    // Definir modelos
    
    // Tabla de usuarios
    const User = sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      full_name: {
        type: DataTypes.STRING(255)
      },
      role: {
        type: DataTypes.ENUM('admin', 'manager', 'operator', 'user'),
        defaultValue: 'user'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      last_login: {
        type: DataTypes.DATE
      },
      phone: {
        type: DataTypes.STRING(20)
      },
      avatar_url: {
        type: DataTypes.TEXT
      },
      preferences: {
        type: DataTypes.JSON,
        defaultValue: {}
      }
    });

    // Tabla de contactos
    const Contact = sequelize.define('Contact', {
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
      profile_picture_url: {
        type: DataTypes.TEXT
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

    // Tabla de conversaciones
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
      assigned_to: {
        type: DataTypes.INTEGER,
        references: {
          model: User,
          key: 'id'
        }
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

    // Tabla de mensajes
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
      media_type: {
        type: DataTypes.STRING(50)
      },
      media_size: {
        type: DataTypes.INTEGER
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

    // Tabla de plantillas de mensaje
    const MessageTemplate = sequelize.define('MessageTemplate', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      category: {
        type: DataTypes.ENUM('marketing', 'utility', 'authentication', 'support', 'notification'),
        defaultValue: 'utility'
      },
      language: {
        type: DataTypes.STRING(10),
        defaultValue: 'es'
      },
      status: {
        type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected', 'archived'),
        defaultValue: 'draft'
      },
      header_type: {
        type: DataTypes.ENUM('text', 'image', 'video', 'document'),
        allowNull: true
      },
      header_content: {
        type: DataTypes.TEXT
      },
      body_text: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      footer_text: {
        type: DataTypes.TEXT
      },
      buttons: {
        type: DataTypes.JSON,
        defaultValue: []
      },
      variables: {
        type: DataTypes.JSON,
        defaultValue: []
      },
      whatsapp_template_id: {
        type: DataTypes.STRING(255)
      },
      usage_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      }
    });

    // Tabla de configuración del sistema
    const SystemSetting = sequelize.define('SystemSetting', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      key: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      value: {
        type: DataTypes.TEXT
      },
      type: {
        type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
        defaultValue: 'string'
      },
      description: {
        type: DataTypes.TEXT
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      category: {
        type: DataTypes.STRING(100),
        defaultValue: 'general'
      }
    });

    // Tabla de etiquetas
    const Tag = sequelize.define('Tag', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      color: {
        type: DataTypes.STRING(7),
        defaultValue: '#007bff'
      },
      description: {
        type: DataTypes.TEXT
      },
      usage_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      }
    });

    // Definir asociaciones
    Contact.hasMany(Conversation, { foreignKey: 'contact_id' });
    Conversation.belongsTo(Contact, { foreignKey: 'contact_id' });

    User.hasMany(Conversation, { foreignKey: 'assigned_to' });
    Conversation.belongsTo(User, { foreignKey: 'assigned_to' });

    Conversation.hasMany(Message, { foreignKey: 'conversation_id' });
    Message.belongsTo(Conversation, { foreignKey: 'conversation_id' });

    Contact.hasMany(Message, { foreignKey: 'contact_id' });
    Message.belongsTo(Contact, { foreignKey: 'contact_id' });

    // Sincronizar modelos (crear tablas)
    await sequelize.sync({ force: true }); // force: true recrea las tablas
    console.log('✅ Esquema de base de datos creado correctamente');

    // Insertar datos iniciales
    console.log('🔄 Insertando datos iniciales...');

    // Usuario administrador por defecto
    await User.create({
      username: 'admin',
      email: 'admin@chatbot.com',
      password_hash: '$2b$10$example.hash.here', // Cambiar por un hash real
      full_name: 'Administrador del Sistema',
      role: 'admin',
      is_active: true
    });

    // Configuraciones del sistema
    const defaultSettings = [
      { key: 'app_name', value: 'ChatBot Enterprise', type: 'string', description: 'Nombre de la aplicación', is_public: true, category: 'general' },
      { key: 'app_version', value: '5.1.0', type: 'string', description: 'Versión de la aplicación', is_public: true, category: 'general' },
      { key: 'max_contacts', value: '10000', type: 'number', description: 'Máximo número de contactos', is_public: false, category: 'limits' },
      { key: 'auto_reply_enabled', value: 'true', type: 'boolean', description: 'Respuesta automática habilitada', is_public: false, category: 'automation' },
      { key: 'webhook_url', value: process.env.WEBHOOK_URL || '', type: 'string', description: 'URL del webhook', is_public: false, category: 'integration' }
    ];

    for (const setting of defaultSettings) {
      await SystemSetting.create(setting);
    }

    // Etiquetas por defecto
    const defaultTags = [
      { name: 'Cliente VIP', color: '#ffd700', description: 'Cliente de alta prioridad' },
      { name: 'Soporte Técnico', color: '#ff6b6b', description: 'Consultas de soporte técnico' },
      { name: 'Ventas', color: '#4ecdc4', description: 'Consultas de ventas' },
      { name: 'Facturación', color: '#45b7d1', description: 'Consultas de facturación' },
      { name: 'Nuevo Cliente', color: '#96ceb4', description: 'Cliente nuevo' }
    ];

    for (const tag of defaultTags) {
      await Tag.create(tag);
    }

    console.log('✅ Datos iniciales insertados correctamente');

    // Verificar tablas creadas
    const [results] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    console.log('📊 Tablas creadas:', results.map(r => r.name));

    return true;
    
  } catch (error) {
    console.error('❌ Error creando el esquema:', error.message);
    console.error('🔍 Stack trace:', error.stack);
    return false;
    
  } finally {
    if (sequelize) {
      try {
        await sequelize.close();
        console.log('🔒 Conexión cerrada correctamente');
      } catch (closeError) {
        console.error('⚠️ Error al cerrar la conexión:', closeError.message);
      }
    }
  }
}

// Ejecutar la creación del esquema
createSchema()
  .then(success => {
    if (success) {
      console.log('🎉 Esquema de base de datos creado exitosamente');
      process.exit(0);
    } else {
      console.log('💥 Error creando el esquema de base de datos');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Error inesperado:', error);
    process.exit(1);
  });
/**
 * @fileoverview Modelo User para Sequelize
 * 
 * Define el modelo de usuarios del sistema, incluyendo administradores
 * y usuarios regulares con sus respectivos roles y permisos.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import { Model } from '../adapters/SequelizeAdapter.js';
import { createLogger } from '../services/core/core/logger.js';

const logger = createLogger('USER_MODEL');

/**
 * Modelo User
 * Representa los usuarios del sistema con roles y permisos
 */
class User extends Model {
  static tableName = 'users';

  /**
   * Inicializa el modelo User
   * @param {Object} sequelize - Instancia de Sequelize
   * @param {Object} DataTypes - Tipos de datos de Sequelize
   * @returns {Object} Modelo inicializado
   */
  static init(sequelize, DataTypes) {
    return super.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        unique: true,
        allowNull: false
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          len: [3, 50],
          isAlphanumeric: true
        }
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      role: {
        type: DataTypes.ENUM('admin', 'user', 'agent', 'supervisor'),
        allowNull: false,
        defaultValue: 'user'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending'),
        allowNull: false,
        defaultValue: 'pending'
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
          is: /^[\+]?[1-9][\d]{0,15}$/
        }
      },
      avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      timezone: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'UTC'
      },
      language: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: 'es'
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      last_activity_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      email_verified_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      phone_verified_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      two_factor_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      two_factor_secret: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      preferences: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          unique: true,
          fields: ['email']
        },
        {
          unique: true,
          fields: ['username']
        },
        {
          unique: true,
          fields: ['uuid']
        },
        {
          fields: ['role']
        },
        {
          fields: ['status']
        },
        {
          fields: ['last_activity_at']
        }
      ]
    });
  }

  /**
   * Define las asociaciones del modelo
   * @param {Object} models - Todos los modelos disponibles
   */
  static associate(models) {
    // Un usuario puede tener muchos contactos
    User.hasMany(models.Contact, {
      foreignKey: 'user_id',
      as: 'contacts'
    });

    // Un usuario puede tener muchas conversaciones
    User.hasMany(models.Conversation, {
      foreignKey: 'user_id',
      as: 'conversations'
    });

    // Un usuario puede tener muchos mensajes
    User.hasMany(models.Message, {
      foreignKey: 'user_id',
      as: 'messages'
    });

    // Un usuario puede tener muchas plantillas de mensaje
    User.hasMany(models.MessageTemplate, {
      foreignKey: 'user_id',
      as: 'messageTemplates'
    });

    // Un usuario puede tener muchos flujos
    User.hasMany(models.Flow, {
      foreignKey: 'user_id',
      as: 'flows'
    });
  }

  /**
   * Métodos de instancia
   */

  /**
   * Obtiene el nombre completo del usuario
   * @returns {string} Nombre completo
   */
  getFullName() {
    if (this.first_name && this.last_name) {
      return `${this.first_name} ${this.last_name}`;
    }
    return this.username;
  }

  /**
   * Verifica si el usuario es administrador
   * @returns {boolean} True si es admin
   */
  isAdmin() {
    return this.role === 'admin';
  }

  /**
   * Verifica si el usuario está activo
   * @returns {boolean} True si está activo
   */
  isActive() {
    return this.status === 'active';
  }

  /**
   * Actualiza la última actividad del usuario
   */
  async updateLastActivity() {
    this.last_activity_at = new Date();
    await this.save();
  }

  /**
   * Serializa el usuario para respuestas API (sin datos sensibles)
   * @returns {Object} Usuario serializado
   */
  toJSON() {
    const values = Object.assign({}, this.get());
    
    // Eliminar campos sensibles
    delete values.password_hash;
    delete values.two_factor_secret;
    
    return values;
  }
}

export default User;
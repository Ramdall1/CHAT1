/**
 * @fileoverview Modelo Template para Sequelize
 * 
 * Define el modelo de plantillas de mensajes para WhatsApp Business API
 * y otros canales de comunicación.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import { Model } from '../adapters/SequelizeAdapter.js';
import { createLogger } from '../services/core/core/logger.js';

const logger = createLogger('TEMPLATE_MODEL');

/**
 * Modelo Template
 * Representa plantillas de mensajes para diferentes canales
 */
class Template extends Model {
  static tableName = 'templates';

  /**
   * Inicializa el modelo Template
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
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          len: [1, 255],
          notEmpty: true
        }
      },
      display_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Nombre para mostrar en la interfaz'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      category: {
        type: DataTypes.ENUM('marketing', 'utility', 'authentication', 'notification', 'promotional'),
        allowNull: false,
        defaultValue: 'utility'
      },
      language: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'es',
        validate: {
          isIn: [['es', 'en', 'pt', 'fr', 'de', 'it']]
        }
      },
      channel: {
        type: DataTypes.ENUM('whatsapp', 'sms', 'email', 'telegram', 'messenger'),
        allowNull: false,
        defaultValue: 'whatsapp'
      },
      type: {
        type: DataTypes.ENUM('text', 'media', 'interactive', 'location', 'contact'),
        allowNull: false,
        defaultValue: 'text'
      },
      status: {
        type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected', 'active', 'inactive'),
        allowNull: false,
        defaultValue: 'draft'
      },
      // Contenido de la plantilla
      header: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Configuración del header (texto, imagen, video, documento)'
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true
        },
        comment: 'Texto principal de la plantilla'
      },
      footer: {
        type: DataTypes.STRING(60),
        allowNull: true,
        validate: {
          len: [0, 60]
        },
        comment: 'Texto del footer (máximo 60 caracteres)'
      },
      buttons: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Botones interactivos de la plantilla'
      },
      // Variables y parámetros
      variables: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Variables dinámicas en la plantilla'
      },
      parameters: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'Parámetros de configuración'
      },
      // Metadatos de WhatsApp Business API
      whatsapp_template_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        comment: 'ID de la plantilla en WhatsApp Business API'
      },
      whatsapp_status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'DISABLED'),
        allowNull: true,
        comment: 'Estado en WhatsApp Business API'
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Razón de rechazo si aplica'
      },
      // Estadísticas de uso
      usage_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      success_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0,
          max: 100
        }
      },
      last_used_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      // Configuración de envío
      send_config: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'Configuración específica de envío'
      },
      tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Tags para categorización'
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      modelName: 'Template',
      tableName: 'templates',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          unique: true,
          fields: ['name', 'user_id']
        },
        {
          unique: true,
          fields: ['uuid']
        },
        {
          unique: true,
          fields: ['whatsapp_template_id'],
          where: {
            whatsapp_template_id: { [sequelize.Op.ne]: null }
          }
        },
        {
          fields: ['status']
        },
        {
          fields: ['category']
        },
        {
          fields: ['channel']
        },
        {
          fields: ['type']
        },
        {
          fields: ['language']
        },
        {
          fields: ['user_id']
        },
        {
          fields: ['whatsapp_status']
        },
        {
          fields: ['last_used_at']
        }
      ],
      hooks: {
        beforeUpdate: (template, options) => {
          template.updated_at = new Date();
        }
      }
    });
  }

  /**
   * Define las asociaciones del modelo
   * @param {Object} models - Todos los modelos disponibles
   */
  static associate(models) {
    // Relación con User
    Template.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'creator'
    });

    // Relación con Campaign
    Template.hasMany(models.Campaign, {
      foreignKey: 'template_id',
      as: 'campaigns'
    });

    // Relación con Message
    Template.hasMany(models.Message, {
      foreignKey: 'template_id',
      as: 'messages'
    });
  }

  /**
   * Valida el contenido de la plantilla
   * @returns {Object} Resultado de validación
   */
  validateContent() {
    const errors = [];

    // Validar body
    if (!this.body || this.body.trim().length === 0) {
      errors.push('El cuerpo de la plantilla es requerido');
    }

    // Validar variables en el body
    const bodyVariables = this.extractVariables(this.body);
    const definedVariables = this.variables || [];
    
    bodyVariables.forEach(variable => {
      if (!definedVariables.find(v => v.name === variable)) {
        errors.push(`Variable '${variable}' no está definida`);
      }
    });

    // Validar header si existe
    if (this.header) {
      if (this.header.type === 'text' && !this.header.text) {
        errors.push('El texto del header es requerido');
      }
      if (this.header.type === 'media' && !this.header.url) {
        errors.push('La URL del media en header es requerida');
      }
    }

    // Validar botones
    if (this.buttons && this.buttons.length > 0) {
      if (this.buttons.length > 3) {
        errors.push('Máximo 3 botones permitidos');
      }
      
      this.buttons.forEach((button, index) => {
        if (!button.text || button.text.trim().length === 0) {
          errors.push(`Texto del botón ${index + 1} es requerido`);
        }
        if (button.text && button.text.length > 20) {
          errors.push(`Texto del botón ${index + 1} excede 20 caracteres`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extrae variables del texto
   * @param {string} text - Texto a analizar
   * @returns {Array} Lista de variables encontradas
   */
  extractVariables(text) {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Renderiza la plantilla con valores específicos
   * @param {Object} values - Valores para las variables
   * @returns {Object} Plantilla renderizada
   */
  render(values = {}) {
    let renderedBody = this.body;
    let renderedHeader = this.header;

    // Reemplazar variables en el body
    Object.keys(values).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      renderedBody = renderedBody.replace(regex, values[key] || '');
    });

    // Reemplazar variables en el header si es texto
    if (renderedHeader && renderedHeader.type === 'text') {
      Object.keys(values).forEach(key => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        renderedHeader.text = renderedHeader.text.replace(regex, values[key] || '');
      });
    }

    return {
      header: renderedHeader,
      body: renderedBody,
      footer: this.footer,
      buttons: this.buttons
    };
  }

  /**
   * Incrementa el contador de uso
   * @param {boolean} success - Si el envío fue exitoso
   */
  async incrementUsage(success = true) {
    const newUsageCount = this.usage_count + 1;
    let newSuccessRate = this.success_rate;

    if (success) {
      newSuccessRate = ((this.success_rate * this.usage_count) + 100) / newUsageCount;
    } else {
      newSuccessRate = (this.success_rate * this.usage_count) / newUsageCount;
    }

    await this.update({
      usage_count: newUsageCount,
      success_rate: Math.round(newSuccessRate * 100) / 100,
      last_used_at: new Date()
    });
  }

  /**
   * Clona la plantilla
   * @param {string} newName - Nuevo nombre
   * @returns {Promise<Template>}
   */
  async clone(newName) {
    const clonedData = {
      name: newName,
      display_name: `${this.display_name} (Copia)`,
      description: this.description,
      category: this.category,
      language: this.language,
      channel: this.channel,
      type: this.type,
      header: this.header,
      body: this.body,
      footer: this.footer,
      buttons: this.buttons,
      variables: this.variables,
      parameters: this.parameters,
      tags: this.tags,
      user_id: this.user_id
    };

    return await Template.create(clonedData);
  }

  /**
   * Obtiene estadísticas de la plantilla
   * @returns {Object}
   */
  getStats() {
    return {
      id: this.id,
      name: this.name,
      usage_count: this.usage_count,
      success_rate: this.success_rate,
      last_used_at: this.last_used_at,
      status: this.status,
      whatsapp_status: this.whatsapp_status
    };
  }

  /**
   * Busca plantillas con filtros
   * @param {Object} filters - Filtros de búsqueda
   * @returns {Promise<Array>}
   */
  static async findWithFilters(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.language) {
      where.language = filters.language;
    }

    if (filters.user_id) {
      where.user_id = filters.user_id;
    }

    if (filters.name) {
      const { Op } = require('../adapters/SequelizeAdapter.js');
      where.name = { [Op.iLike]: `%${filters.name}%` };
    }

    return await Template.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: filters.limit || 50,
      offset: filters.offset || 0
    });
  }

  /**
   * Obtiene plantillas más utilizadas
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>}
   */
  static async getMostUsed(limit = 10) {
    return await Template.findAll({
      where: {
        status: 'active'
      },
      order: [['usage_count', 'DESC']],
      limit
    });
  }
}

export default Template;
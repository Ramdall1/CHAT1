/**
 * @fileoverview Modelo AudienceSegment para Sequelize
 * 
 * Define el modelo de segmentos de audiencia para la segmentación
 * de contactos basada en criterios específicos.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import { Model } from '../adapters/SequelizeAdapter.js';
import { createLogger } from '../services/core/core/logger.js';

const logger = createLogger('AUDIENCE_SEGMENT_MODEL');

/**
 * Modelo AudienceSegment
 * Representa segmentos de audiencia para campañas dirigidas
 */
class AudienceSegment extends Model {
  static tableName = 'audience_segments';

  /**
   * Inicializa el modelo AudienceSegment
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
        unique: true,
        validate: {
          len: [1, 255],
          notEmpty: true
        }
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      criteria: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
        comment: 'Criterios de segmentación en formato JSON'
      },
      filters: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Filtros adicionales para la segmentación'
      },
      tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Tags asociados al segmento'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'draft', 'archived'),
        allowNull: false,
        defaultValue: 'draft'
      },
      type: {
        type: DataTypes.ENUM('static', 'dynamic', 'behavioral', 'demographic'),
        allowNull: false,
        defaultValue: 'static',
        comment: 'Tipo de segmentación'
      },
      contact_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      last_calculated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Última vez que se calculó el segmento'
      },
      auto_update: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el segmento se actualiza automáticamente'
      },
      update_frequency: {
        type: DataTypes.ENUM('hourly', 'daily', 'weekly', 'monthly', 'manual'),
        allowNull: false,
        defaultValue: 'manual'
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
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'Metadatos adicionales del segmento'
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
      modelName: 'AudienceSegment',
      tableName: 'audience_segments',
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
          fields: ['status']
        },
        {
          fields: ['type']
        },
        {
          fields: ['user_id']
        },
        {
          fields: ['auto_update']
        },
        {
          fields: ['last_calculated_at']
        }
      ],
      hooks: {
        beforeUpdate: (segment, options) => {
          segment.updated_at = new Date();
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
    AudienceSegment.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'creator'
    });

    // Relación muchos a muchos con Contact
    AudienceSegment.belongsToMany(models.Contact, {
      through: 'segment_contacts',
      foreignKey: 'segment_id',
      otherKey: 'contact_id',
      as: 'contacts'
    });

    // Relación con Campaign
    AudienceSegment.hasMany(models.Campaign, {
      foreignKey: 'audience_segment_id',
      as: 'campaigns'
    });
  }

  /**
   * Calcula los contactos que pertenecen a este segmento
   * @returns {Promise<Array>} Lista de contactos
   */
  async calculateContacts() {
    try {
      const { Contact } = require('../adapters/SequelizeAdapter.js');
      
      // Aplicar criterios de segmentación
      const contacts = await Contact.findAll({
        where: this.buildWhereClause()
      });

      // Actualizar contador
      await this.update({
        contact_count: contacts.length,
        last_calculated_at: new Date()
      });

      return contacts;
    } catch (error) {
      logger.error('Error calculando contactos del segmento:', error);
      throw error;
    }
  }

  /**
   * Construye la cláusula WHERE basada en los criterios
   * @returns {Object} Cláusula WHERE para Sequelize
   */
  buildWhereClause() {
    const { Op } = require('../adapters/SequelizeAdapter.js');
    const where = {};

    if (this.criteria) {
      // Aplicar criterios demográficos
      if (this.criteria.age) {
        if (this.criteria.age.min) {
          where.age = { [Op.gte]: this.criteria.age.min };
        }
        if (this.criteria.age.max) {
          where.age = { ...where.age, [Op.lte]: this.criteria.age.max };
        }
      }

      // Aplicar criterios de tags
      if (this.criteria.tags && this.criteria.tags.length > 0) {
        where.tags = { [Op.overlap]: this.criteria.tags };
      }

      // Aplicar criterios de ubicación
      if (this.criteria.location) {
        where.location = { [Op.iLike]: `%${this.criteria.location}%` };
      }

      // Aplicar criterios de actividad
      if (this.criteria.lastInteraction) {
        const date = new Date();
        date.setDays(date.getDate() - this.criteria.lastInteraction.days);
        where.lastInteraction = { [Op.gte]: date };
      }
    }

    return where;
  }

  /**
   * Actualiza automáticamente el segmento si está configurado
   */
  async autoUpdate() {
    if (this.auto_update && this.shouldUpdate()) {
      await this.calculateContacts();
      logger.info(`Segmento ${this.name} actualizado automáticamente`);
    }
  }

  /**
   * Determina si el segmento debe actualizarse
   * @returns {boolean}
   */
  shouldUpdate() {
    if (!this.last_calculated_at) return true;

    const now = new Date();
    const lastUpdate = new Date(this.last_calculated_at);
    const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

    switch (this.update_frequency) {
      case 'hourly':
        return diffHours >= 1;
      case 'daily':
        return diffHours >= 24;
      case 'weekly':
        return diffHours >= 168;
      case 'monthly':
        return diffHours >= 720;
      default:
        return false;
    }
  }

  /**
   * Activa el segmento
   */
  async activate() {
    await this.update({ status: 'active' });
    await this.calculateContacts();
  }

  /**
   * Desactiva el segmento
   */
  async deactivate() {
    await this.update({ status: 'inactive' });
  }

  /**
   * Archiva el segmento
   */
  async archive() {
    await this.update({ status: 'archived' });
  }

  /**
   * Clona el segmento
   * @param {string} newName - Nuevo nombre para el segmento clonado
   * @returns {Promise<AudienceSegment>}
   */
  async clone(newName) {
    const clonedData = {
      name: newName,
      description: this.description,
      criteria: this.criteria,
      filters: this.filters,
      tags: this.tags,
      type: this.type,
      user_id: this.user_id,
      metadata: this.metadata
    };

    return await AudienceSegment.create(clonedData);
  }

  /**
   * Obtiene estadísticas del segmento
   * @returns {Object}
   */
  getStats() {
    return {
      id: this.id,
      name: this.name,
      contact_count: this.contact_count,
      status: this.status,
      type: this.type,
      last_calculated_at: this.last_calculated_at,
      auto_update: this.auto_update,
      update_frequency: this.update_frequency
    };
  }

  /**
   * Valida los criterios del segmento
   * @param {Object} criteria - Criterios a validar
   * @returns {boolean}
   */
  static validateCriteria(criteria) {
    if (!criteria || typeof criteria !== 'object') {
      return false;
    }

    // Validar estructura de criterios
    const validKeys = ['age', 'tags', 'location', 'lastInteraction', 'customFields'];
    const keys = Object.keys(criteria);
    
    return keys.every(key => validKeys.includes(key));
  }

  /**
   * Busca segmentos con filtros
   * @param {Object} filters - Filtros de búsqueda
   * @returns {Promise<Array>}
   */
  static async findWithFilters(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.user_id) {
      where.user_id = filters.user_id;
    }

    if (filters.name) {
      const { Op } = require('../adapters/SequelizeAdapter.js');
      where.name = { [Op.iLike]: `%${filters.name}%` };
    }

    return await AudienceSegment.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: filters.limit || 50,
      offset: filters.offset || 0
    });
  }
}

export default AudienceSegment;
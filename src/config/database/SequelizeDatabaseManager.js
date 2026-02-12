/**
 * @fileoverview Gestor de Base de Datos con Sequelize
 * 
 * Maneja la conexión y operaciones con la base de datos usando Sequelize ORM
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import { Sequelize } from 'sequelize';
import { createLogger } from '../../services/core/core/logger.js';

const logger = createLogger('SEQUELIZE_DB_MANAGER');

class SequelizeDatabaseManager {
  constructor(config = {}) {
    this.config = {
      database: config.database || process.env.DB_NAME || 'chatbot',
      username: config.username || process.env.DB_USER || 'root',
      password: config.password || process.env.DB_PASSWORD || '',
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 3306,
      dialect: config.dialect || process.env.DB_DIALECT || 'mysql',
      logging: config.logging || false,
      ...config
    };

    this.sequelize = null;
    this.isConnected = false;
  }

  /**
   * Conectar a la base de datos
   */
  async connect() {
    try {
      logger.info('🔌 Conectando a la base de datos...');

      this.sequelize = new Sequelize(
        this.config.database,
        this.config.username,
        this.config.password,
        {
          host: this.config.host,
          port: this.config.port,
          dialect: this.config.dialect,
          logging: this.config.logging ? (msg) => logger.debug(msg) : false,
          pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
          }
        }
      );

      await this.sequelize.authenticate();
      this.isConnected = true;
      logger.info('✅ Conexión a base de datos establecida');

      return true;
    } catch (error) {
      logger.error('❌ Error conectando a base de datos:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Desconectar de la base de datos
   */
  async disconnect() {
    try {
      if (this.sequelize) {
        await this.sequelize.close();
        this.isConnected = false;
        logger.info('✅ Desconectado de la base de datos');
      }
    } catch (error) {
      logger.error('❌ Error desconectando:', error.message);
    }
  }

  /**
   * Obtener instancia de Sequelize
   */
  getInstance() {
    return this.sequelize;
  }

  /**
   * Verificar conexión
   */
  isConnected() {
    return this.isConnected;
  }

  /**
   * Sincronizar modelos
   */
  async sync(options = {}) {
    try {
      if (!this.sequelize) {
        throw new Error('No hay conexión a la base de datos');
      }

      await this.sequelize.sync(options);
      logger.info('✅ Modelos sincronizados con la base de datos');
      return true;
    } catch (error) {
      logger.error('❌ Error sincronizando modelos:', error.message);
      return false;
    }
  }
}

export default SequelizeDatabaseManager;

/**
 * @fileoverview Índice de Modelos de Base de Datos
 * 
 * Archivo central para la inicialización y exportación de todos los modelos
 * de la base de datos del sistema de chatbot con soporte para 360 Dialog.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import { createLogger } from '../services/core/core/logger.js';

// Importar la configuración de Sequelize desde el adaptador
const { sequelize } = await import('../adapters/SequelizeAdapter.js');

const logger = createLogger('DATABASE_MODELS');

/**
 * Configuración de la base de datos
 */
const getDatabaseConfig = () => {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'chatbot_360dialog',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    dialect: process.env.DB_DIALECT || 'postgres',
    
    // Configuraciones de pool de conexiones
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000
    },
    
    // Configuraciones de logging
    logging: process.env.NODE_ENV === 'development' ? 
      (sql) => logger.debug(`🗄️ SQL: ${sql}`) : false,
    
    // Configuraciones adicionales
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    },
    
    // Configuraciones de timezone
    timezone: process.env.DB_TIMEZONE || '+00:00',
    
    // Configuraciones de retry
    retry: {
      max: 3,
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ]
    }
  };
  
  // Configuraciones específicas para PostgreSQL
  if (config.dialect === 'postgres') {
    config.dialectOptions = {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false,
      
      // Configuraciones de conexión
      connectTimeout: 60000,
      socketTimeout: 60000,
      
      // Configuraciones de aplicación
      application_name: 'ChatBot_360Dialog'
    };
  }
  
  // Configuraciones específicas para SQLite (desarrollo)
  if (config.dialect === 'sqlite') {
    config.storage = process.env.DB_STORAGE || './database/chatbot.sqlite';
    config.dialectOptions = {
      busyTimeout: 30000
    };
  }
  
  return config;
};

/**
 * Inicializar conexión a la base de datos
 */
const initializeDatabase = async () => {
  try {
    // La inicialización se hace a través de DatabaseService
    logger.info('✅ Módulo de modelos cargado correctamente');
    return { sequelize };
  } catch (error) {
    logger.error('❌ Error al inicializar modelos:', error);
    throw error;
  }
};



/**
 * Cerrar conexión a la base de datos
 */
const closeDatabase = async () => {
  try {
    await sequelize.close();
    logger.info('🔌 Conexión a base de datos cerrada');
  } catch (error) {
    logger.error('❌ Error cerrando conexión a base de datos:', error);
    throw error;
  }
};

/**
 * Verificar estado de la base de datos
 */
const checkDatabaseHealth = async () => {
  try {
    await sequelize.authenticate();
    return {
      status: 'healthy',
      message: 'Base de datos funcionando correctamente',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('❌ Error verificando salud de base de datos:', error);
    return {
      status: 'unhealthy',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Obtener estadísticas de la base de datos
 */
const getDatabaseStats = async () => {
  try {
    // Estadísticas básicas para SQLite
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('❌ Error obteniendo estadísticas:', error);
    throw error;
  }
};

/**
 * Ejecutar migraciones pendientes
 */
const runMigrations = async () => {
  try {
    // SQLiteManager ya maneja la creación de tablas automáticamente
    logger.info('🔄 Migraciones no necesarias - SQLiteManager maneja la estructura automáticamente');
  } catch (error) {
    logger.error('❌ Error ejecutando migraciones:', error);
    throw error;
  }
};

/**
 * Crear backup de la base de datos
 */
const createBackup = async (filename) => {
  try {
    logger.info(`💾 Backup no implementado para este módulo: ${filename}`);
    return null;
  } catch (error) {
    logger.error('❌ Error creando backup:', error);
    throw error;
  }
};

/**
 * Restaurar backup de la base de datos
 */
const restoreBackup = async (backupPath) => {
  try {
    logger.info(`🔄 Restore no implementado para este módulo: ${backupPath}`);
  } catch (error) {
    logger.error('❌ Error restaurando backup:', error);
    throw error;
  }
};

/**
 * Limpiar datos antiguos
 */
const cleanupOldData = async (daysOld = 30) => {
  try {
    logger.info(`🧹 Limpieza no implementada para este módulo (${daysOld} días)`);
    return {
      deletedMessages: 0,
      cutoffDate: new Date().toISOString()
    };
  } catch (error) {
    logger.error('❌ Error en limpieza de datos:', error);
    throw error;
  }
};

// Exportaciones nombradas
export {
  // Instancia de Sequelize
  sequelize,
  // Funciones de base de datos
  initializeDatabase,
  closeDatabase,
  checkDatabaseHealth,
  getDatabaseStats,
  runMigrations,
  createBackup,
  restoreBackup,
  cleanupOldData,
  getDatabaseConfig
};

// Exportación por defecto
export default {
  sequelize,
  initializeDatabase,
  closeDatabase,
  checkDatabaseHealth,
  getDatabaseStats,
  runMigrations,
  createBackup,
  restoreBackup,
  cleanupOldData,
  getDatabaseConfig
};
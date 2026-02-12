/**
 * @fileoverview Servicio Unificado de Base de Datos
 * 
 * Servicio centralizado que proporciona una interfaz unificada para todas las
 * operaciones de base de datos usando SQLite3 como backend.
 * 
 * @author ChatBot Enterprise Team
 * @version 3.0.0
 * @since 2025-01-21
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { createLogger } from './core/core/logger.js';

class DatabaseService {
  constructor() {
    this.logger = createLogger('DATABASE_SERVICE');
    this.db = null;
    this.isInitialized = false;
    this.dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
  }

  /**
   * Inicializar el servicio de base de datos
   */
  async initialize() {
    if (this.isInitialized) {
      return this;
    }

    try {
      this.db = new sqlite3.Database(this.dbPath);
      this.isInitialized = true;
      
      this.logger.info('✅ DatabaseService inicializado correctamente');
      return this;
    } catch (error) {
      this.logger.error('❌ Error inicializando DatabaseService:', error);
      throw error;
    }
  }

  /**
   * Obtener instancia de la base de datos
   */
  getManager() {
    if (!this.isInitialized || !this.db) {
      throw new Error('DatabaseService no está inicializado. Llama a initialize() primero.');
    }
    return this;
  }

  /**
   * Ejecutar consulta SQL (run)
   */
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Obtener un registro (get)
   */
  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Obtener múltiples registros (all)
   */
  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Ejecutar transacción
   */
  async transaction(callback) {
    try {
      await this.run('BEGIN TRANSACTION');
      const result = await callback(this);
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Buscar por ID
   */
  async findById(table, id) {
    return await this.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  }

  /**
   * Buscar por campo
   */
  async findByField(table, field, value) {
    return await this.get(`SELECT * FROM ${table} WHERE ${field} = ?`, [value]);
  }

  /**
   * Buscar todos
   */
  async findAll(table, conditions = {}, options = {}) {
    let sql = `SELECT * FROM ${table}`;
    const params = [];

    if (Object.keys(conditions).length > 0) {
      const where = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
      sql += ` WHERE ${where}`;
      params.push(...Object.values(conditions));
    }

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
      if (options.orderDirection) {
        sql += ` ${options.orderDirection.toUpperCase()}`;
      }
    }

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
    }

    return await this.all(sql, params);
  }

  /**
   * Insertar registro
   */
  async insert(table, data) {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    return await this.run(
      `INSERT INTO ${table} (${fields}) VALUES (${placeholders})`,
      values
    );
  }

  /**
   * Actualizar registro
   */
  async update(table, id, data, primaryKey = 'id') {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    return await this.run(
      `UPDATE ${table} SET ${fields} WHERE ${primaryKey} = ?`,
      values
    );
  }

  /**
   * Eliminar registro
   */
  async delete(table, id, primaryKey = 'id') {
    return await this.run(
      `DELETE FROM ${table} WHERE ${primaryKey} = ?`,
      [id]
    );
  }

  /**
   * Contar registros
   */
  async count(table, conditions = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const params = [];

    if (Object.keys(conditions).length > 0) {
      const where = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
      sql += ` WHERE ${where}`;
      params.push(...Object.values(conditions));
    }

    const result = await this.get(sql, params);
    return result?.count || 0;
  }

  /**
   * Verificar si existe un registro
   */
  async exists(table, conditions = {}) {
    const count = await this.count(table, conditions);
    return count > 0;
  }

  /**
   * Obtener estadísticas de la base de datos
   */
  async getStats() {
    const tables = [
      'users', 'contacts', 'conversations', 'messages',
      'templates', 'campaigns', 'audience_segments', 'sessions'
    ];

    const stats = {};
    for (const table of tables) {
      try {
        stats[table] = await this.count(table);
      } catch (error) {
        stats[table] = 0;
      }
    }

    return stats;
  }

  /**
   * Optimizar base de datos
   */
  async optimize() {
    try {
      await this.run('VACUUM');
      await this.run('ANALYZE');
      this.logger.info('✅ Base de datos optimizada');
      return { success: true, message: 'Base de datos optimizada correctamente' };
    } catch (error) {
      this.logger.error('Error optimizando base de datos:', error);
      throw error;
    }
  }

  /**
   * Crear backup de la base de datos
   */
  async createBackup(filename) {
    const fs = await import('fs/promises');
    try {
      const backupPath = path.join(process.cwd(), 'data', 'backups', filename);
      const backupDir = path.dirname(backupPath);
      
      await fs.mkdir(backupDir, { recursive: true });
      await fs.copyFile(this.dbPath, backupPath);
      
      this.logger.info(`✅ Backup creado: ${backupPath}`);
      return { success: true, path: backupPath };
    } catch (error) {
      this.logger.error('Error creando backup:', error);
      throw error;
    }
  }

  /**
   * Restaurar backup de la base de datos
   */
  async restoreBackup(backupPath) {
    const fs = await import('fs/promises');
    try {
      await fs.copyFile(backupPath, this.dbPath);
      this.logger.info(`✅ Backup restaurado desde: ${backupPath}`);
      return { success: true, message: 'Backup restaurado correctamente' };
    } catch (error) {
      this.logger.error('Error restaurando backup:', error);
      throw error;
    }
  }

  /**
   * Verificar salud de la base de datos
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { status: 'error', message: 'DatabaseService no inicializado' };
      }

      const result = await this.get('SELECT 1');
      return {
        status: 'healthy',
        message: 'Base de datos funcionando correctamente',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error en health check:', error);
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Cerrar conexión
   */
  async close() {
    try {
      if (this.db) {
        return new Promise((resolve, reject) => {
          this.db.close((err) => {
            if (err) reject(err);
            else {
              this.db = null;
              this.isInitialized = false;
              this.logger.info('✅ DatabaseService cerrado correctamente');
              resolve();
            }
          });
        });
      }
    } catch (error) {
      this.logger.error('Error cerrando DatabaseService:', error);
      throw error;
    }
  }
}

// Instancia singleton
let databaseService = null;

/**
 * Obtener instancia del servicio de base de datos
 */
export function getDatabaseService() {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
}

/**
 * Inicializar servicio de base de datos
 */
export async function initializeDatabase() {
  const service = getDatabaseService();
  return await service.initialize();
}

export { DatabaseService };
export default DatabaseService;
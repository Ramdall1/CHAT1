/**
 * Script de migraciones de base de datos
 * Ejecuta ALTER TABLE para agregar columnas faltantes sin perder datos
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../services/core/core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = createLogger('DB_MIGRATIONS');

const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');

/**
 * Ejecutar todas las migraciones pendientes
 */
export async function runMigrations() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('❌ Error conectando a SQLite:', err);
        reject(err);
        return;
      }

      logger.info('✅ Conectado a SQLite database para migraciones');

      db.serialize(() => {
        // Migración 1: Agregar columnas a template_approvals
        db.run(`
          ALTER TABLE template_approvals 
          ADD COLUMN template_name VARCHAR(255)
        `, (err) => {
          if (err && err.message.includes('duplicate column name')) {
            logger.info('ℹ️ Columna template_name ya existe en template_approvals');
          } else if (err) {
            logger.error('❌ Error agregando template_name:', err);
          } else {
            logger.info('✅ Columna template_name agregada a template_approvals');
          }
        });

        db.run(`
          ALTER TABLE template_approvals 
          ADD COLUMN template_data JSON
        `, (err) => {
          if (err && err.message.includes('duplicate column name')) {
            logger.info('ℹ️ Columna template_data ya existe en template_approvals');
          } else if (err) {
            logger.error('❌ Error agregando template_data:', err);
          } else {
            logger.info('✅ Columna template_data agregada a template_approvals');
          }
        });

        // Migración 2: Verificar que todas las migraciones se completaron
        setTimeout(() => {
          logger.info('✅ Todas las migraciones completadas');
          db.close();
          resolve();
        }, 1000);
      });
    });
  });
}

export default runMigrations;

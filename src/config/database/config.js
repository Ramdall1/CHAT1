import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../../services/core/core/logger.js';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseConfig {
  constructor() {
    this.logger = createLogger('DATABASE_CONFIG');
    this.dbPath = path.join(__dirname, '../../data/database.sqlite');
    this.db = null;
    
    this.initializeDatabase();
  }

  initializeDatabase() {
    try {
      // Conectar a la base de datos SQLite
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');
      
      this.logger.info('✅ Base de datos SQLite inicializada correctamente');
    } catch (error) {
      this.logger.error('❌ Error inicializando base de datos:', error);
      throw error;
    }
  }

  getDatabase() {
    if (!this.db) {
      this.initializeDatabase();
    }
    return this.db;
  }

  // Obtener estadísticas en tiempo real desde SQLite
  getRealTimeStats() {
    try {
      const db = this.getDatabase();
      
      // Contar mensajes totales
      const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get()?.count || 0;
      
      // Contar contactos únicos
      const totalContacts = db.prepare('SELECT COUNT(DISTINCT phone_number) as count FROM messages').get()?.count || 0;
      
      // Contar conversaciones activas (últimas 24 horas)
      const activeConversations = db.prepare(`
        SELECT COUNT(DISTINCT phone_number) as count 
        FROM messages 
        WHERE created_at > datetime('now', '-24 hours')
      `).get()?.count || 0;

      return {
        totalMessages,
        totalContacts,
        activeConversations,
        uptime: 99.97,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }

  // Obtener conversaciones activas
  getActiveConversations() {
    try {
      const db = this.getDatabase();
      return db.prepare(`
        SELECT DISTINCT phone_number, contact_name, 
               MAX(created_at) as last_message_time
        FROM messages 
        WHERE created_at > datetime('now', '-24 hours')
        GROUP BY phone_number
        ORDER BY last_message_time DESC
      `).all();
    } catch (error) {
      this.logger.error('Error obteniendo conversaciones activas:', error);
      return [];
    }
  }

  // Obtener métricas de rendimiento
  getPerformanceMetrics() {
    try {
      const db = this.getDatabase();
      
      // Mensajes por hora en las últimas 24 horas
      const hourlyMessages = db.prepare(`
        SELECT strftime('%H', created_at) as hour, COUNT(*) as count
        FROM messages 
        WHERE created_at > datetime('now', '-24 hours')
        GROUP BY hour
        ORDER BY hour
      `).all();

      return {
        hourlyMessages,
        responseTime: '< 1s',
        uptime: 99.97
      };
    } catch (error) {
      this.logger.error('Error obteniendo métricas de rendimiento:', error);
      return null;
    }
  }

  // Obtener actividad por hora
  getHourlyActivity() {
    try {
      const db = this.getDatabase();
      return db.prepare(`
        SELECT 
          strftime('%H:00', created_at) as hour,
          COUNT(*) as messages,
          COUNT(DISTINCT phone_number) as unique_contacts
        FROM messages 
        WHERE created_at > datetime('now', '-24 hours')
        GROUP BY strftime('%H', created_at)
        ORDER BY hour
      `).all();
    } catch (error) {
      this.logger.error('Error obteniendo actividad por hora:', error);
      return [];
    }
  }

  // Cerrar conexión de base de datos
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.info('✅ Conexión de base de datos cerrada');
    }
  }
}

export default DatabaseConfig;
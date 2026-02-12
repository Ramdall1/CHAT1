/**
 * Database Optimization Service
 * Servicio avanzado para optimización de consultas y rendimiento de base de datos
 * Recomendación #17: Optimización de consultas de base de datos
 */

import logger from './logger.js';
import DatabaseManager from '../../../config/database/DatabaseManager.js';
import { query, QueryHelpers } from '../../../shared/utils/helpers/queryBuilder.js';

class DatabaseOptimizationService {
  constructor() {
    this.queryStats = new Map();
    this.slowQueries = [];
    this.indexRecommendations = [];
    this.performanceMetrics = {
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      cacheHitRatio: 0,
      indexUsage: new Map()
    };
        
    this.config = {
      slowQueryThreshold: 1000, // 1 segundo
      maxSlowQueries: 100,
      analysisInterval: 300000, // 5 minutos
      autoOptimize: process.env.DB_AUTO_OPTIMIZE === 'true',
      enableQueryProfiling: process.env.DB_QUERY_PROFILING !== 'false'
    };

    // Obtener la instancia singleton de DatabaseManager
    this.dbManager = DatabaseManager.getInstance();
    this.startPerformanceMonitoring();
  }

  /**
     * Inicializar optimizaciones avanzadas
     */
  async initialize() {
    try {
      await this.createAdvancedIndexes();
      await this.optimizeDatabaseSettings();
      await this.analyzeTableStatistics();
            
      if (this.config.autoOptimize) {
        await this.runAutoOptimization();
      }
            
      logger.info('Database optimization service initialized');
    } catch (error) {
      logger.error('Error initializing database optimization:', error);
    }
  }

  /**
     * Crear índices avanzados y compuestos
     */
  async createAdvancedIndexes() {
    const advancedIndexes = [
      // Índices compuestos para consultas complejas
      'CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp ON messages(conversation_id, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_messages_contact_direction ON messages(contact_id, direction, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_messages_status_timestamp ON messages(status, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_contact_status ON conversations(contact_id, status, last_message_at)',
            
      // Índices para búsquedas de texto
      'CREATE INDEX IF NOT EXISTS idx_contacts_name_phone ON contacts(name, phone_number)',
      'CREATE INDEX IF NOT EXISTS idx_templates_name_category ON templates(name, category, status)',
            
      // Índices para analytics y reportes
      'CREATE INDEX IF NOT EXISTS idx_analytics_type_timestamp ON analytics_events(event_type, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_entity_timestamp ON analytics_events(entity_type, entity_id, timestamp)',
            
      // Índices para campañas
      'CREATE INDEX IF NOT EXISTS idx_campaigns_status_scheduled ON campaigns(status, scheduled_at)',
      'CREATE INDEX IF NOT EXISTS idx_campaigns_template_status ON campaigns(template_id, status)',
            
      // Índices para sesiones y seguridad
      'CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(is_active, role)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_expires_user ON sessions(expires_at, user_id)',
            
      // Índices para logs y auditoría
      'CREATE INDEX IF NOT EXISTS idx_system_logs_level_timestamp ON system_logs(level, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_system_logs_source_timestamp ON system_logs(source, timestamp)',
            
      // Índices parciales para datos activos
      'CREATE INDEX IF NOT EXISTS idx_active_conversations ON conversations(contact_id, last_message_at) WHERE status = "active"',
      'CREATE INDEX IF NOT EXISTS idx_active_templates ON templates(category, name) WHERE status = "active"',
      'CREATE INDEX IF NOT EXISTS idx_recent_messages ON messages(conversation_id, timestamp) WHERE timestamp > datetime("now", "-30 days")'
    ];

    for (const indexSQL of advancedIndexes) {
      try {
        await this.dbManager.runQuery(indexSQL);
        logger.debug(`Índice creado: ${indexSQL.split(' ')[5]}`);
      } catch (error) {
        logger.error(`Error creando índice: ${error.message}`);
      }
    }
  }

  /**
     * Optimizar configuraciones de SQLite
     */
  async optimizeDatabaseSettings() {
    const optimizations = [
      // Configuraciones de rendimiento
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
      'PRAGMA cache_size = 10000',
      'PRAGMA temp_store = MEMORY',
      'PRAGMA mmap_size = 268435456', // 256MB
      'PRAGMA optimize',
            
      // Configuraciones de integridad
      'PRAGMA foreign_keys = ON',
      'PRAGMA recursive_triggers = ON',
            
      // Configuraciones de análisis
      'PRAGMA analysis_limit = 1000',
      'PRAGMA automatic_index = OFF' // Controlamos los índices manualmente
    ];

    for (const pragma of optimizations) {
      try {
        await this.dbManager.runQuery(pragma);
        logger.debug(`Optimización aplicada: ${pragma}`);
      } catch (error) {
        logger.error(`Error aplicando optimización: ${error.message}`);
      }
    }
  }

  /**
     * Analizar estadísticas de tablas
     */
  async analyzeTableStatistics() {
    try {
      // Actualizar estadísticas de SQLite
      await this.dbManager.runQuery('ANALYZE');
            
      // Obtener información de tablas
      const tables = await this.dbManager.getAllQuery(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `);

      for (const table of tables) {
        await this.analyzeTable(table.name);
      }
            
      logger.info('Table statistics analyzed');
    } catch (error) {
      logger.error('Error analyzing table statistics:', error);
    }
  }

  /**
     * Analizar tabla específica
     */
  async analyzeTable(tableName) {
    try {
      // Obtener estadísticas de la tabla
      const stats = await this.dbManager.getQuery(`
                SELECT COUNT(*) as row_count FROM ${tableName}
            `);

      // Obtener información de índices
      const indexes = await this.dbManager.getAllQuery(`
                PRAGMA index_list(${tableName})
            `);

      this.performanceMetrics.tableStats = this.performanceMetrics.tableStats || {};
      this.performanceMetrics.tableStats[tableName] = {
        rowCount: stats.row_count,
        indexCount: indexes.length,
        lastAnalyzed: new Date()
      };

    } catch (error) {
      logger.error(`Error analyzing table ${tableName}:`, error);
    }
  }

  /**
     * Ejecutar consulta con profiling
     */
  async executeWithProfiling(sql, params = []) {
    const startTime = Date.now();
    const queryId = this.generateQueryId(sql);

    try {
      // Ejecutar la consulta
      const result = await this.dbManager.getAllQuery(sql, params);
      const executionTime = Date.now() - startTime;

      // Registrar estadísticas
      this.recordQueryStats(queryId, sql, executionTime, true);

      // Verificar si es una consulta lenta
      if (executionTime > this.config.slowQueryThreshold) {
        this.recordSlowQuery(sql, params, executionTime);
      }

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordQueryStats(queryId, sql, executionTime, false);
      throw error;
    }
  }

  /**
     * Registrar estadísticas de consulta
     */
  recordQueryStats(queryId, sql, executionTime, success) {
    if (!this.config.enableQueryProfiling) return;

    const stats = this.queryStats.get(queryId) || {
      sql: sql,
      count: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errors: 0,
      lastExecuted: null
    };

    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    stats.minTime = Math.min(stats.minTime, executionTime);
    stats.maxTime = Math.max(stats.maxTime, executionTime);
    stats.lastExecuted = new Date();

    if (!success) {
      stats.errors++;
    }

    this.queryStats.set(queryId, stats);
    this.performanceMetrics.totalQueries++;
  }

  /**
     * Registrar consulta lenta
     */
  recordSlowQuery(sql, params, executionTime) {
    const slowQuery = {
      sql,
      params,
      executionTime,
      timestamp: new Date(),
      stackTrace: new Error().stack
    };

    this.slowQueries.push(slowQuery);
    this.performanceMetrics.slowQueries++;

    // Mantener solo las últimas consultas lentas
    if (this.slowQueries.length > this.config.maxSlowQueries) {
      this.slowQueries.shift();
    }

    logger.warn(`Slow query detected (${executionTime}ms): ${sql}`);
  }

  /**
     * Generar ID único para consulta
     */
  generateQueryId(sql) {
    // Normalizar la consulta removiendo valores específicos
    const normalized = sql
      .replace(/\d+/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
        
    return Buffer.from(normalized).toString('base64');
  }

  /**
     * Analizar y recomendar índices
     */
  async analyzeIndexRecommendations() {
    const recommendations = [];

    // Analizar consultas lentas para recomendar índices
    for (const slowQuery of this.slowQueries) {
      const recommendation = this.analyzeQueryForIndex(slowQuery.sql);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Analizar patrones de consultas frecuentes
    for (const [queryId, stats] of this.queryStats) {
      if (stats.count > 100 && stats.avgTime > 100) { // Consultas frecuentes y lentas
        const recommendation = this.analyzeQueryForIndex(stats.sql);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }
    }

    this.indexRecommendations = recommendations;
    return recommendations;
  }

  /**
     * Analizar consulta para recomendar índice
     */
  analyzeQueryForIndex(sql) {
    const sqlLower = sql.toLowerCase();
        
    // Detectar patrones comunes que se benefician de índices
    const patterns = [
      {
        pattern: /where\s+(\w+)\s*=/,
        type: 'single_column',
        extract: (match) => match[1]
      },
      {
        pattern: /where\s+(\w+)\s*=.*and\s+(\w+)\s*=/,
        type: 'composite',
        extract: (match) => [match[1], match[2]]
      },
      {
        pattern: /order\s+by\s+(\w+)/,
        type: 'order_by',
        extract: (match) => match[1]
      }
    ];

    for (const pattern of patterns) {
      const match = sqlLower.match(pattern.pattern);
      if (match) {
        return {
          type: pattern.type,
          columns: Array.isArray(pattern.extract(match)) 
            ? pattern.extract(match) 
            : [pattern.extract(match)],
          sql: sql,
          confidence: this.calculateIndexConfidence(sql, pattern.type)
        };
      }
    }

    return null;
  }

  /**
     * Calcular confianza de recomendación de índice
     */
  calculateIndexConfidence(sql, type) {
    let confidence = 0.5;

    // Aumentar confianza basada en patrones
    if (sql.includes('JOIN')) confidence += 0.2;
    if (sql.includes('ORDER BY')) confidence += 0.1;
    if (sql.includes('GROUP BY')) confidence += 0.1;
    if (type === 'composite') confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
     * Ejecutar optimización automática
     */
  async runAutoOptimization() {
    try {
      logger.info('Running automatic database optimization...');

      // Analizar y crear índices recomendados
      const recommendations = await this.analyzeIndexRecommendations();
            
      for (const rec of recommendations) {
        if (rec.confidence > 0.7) {
          await this.createRecommendedIndex(rec);
        }
      }

      // Limpiar estadísticas obsoletas
      await this.cleanupStatistics();

      // Optimizar base de datos
      await this.dbManager.runQuery('PRAGMA optimize');

      logger.info('Automatic optimization completed');

    } catch (error) {
      logger.error('Error in automatic optimization:', error);
    }
  }

  /**
     * Crear índice recomendado
     */
  async createRecommendedIndex(recommendation) {
    try {
      const indexName = `idx_auto_${recommendation.columns.join('_')}`;
      const columns = recommendation.columns.join(', ');
            
      // Extraer nombre de tabla del SQL
      const tableMatch = recommendation.sql.match(/from\s+(\w+)/i);
      if (!tableMatch) return;
            
      const tableName = tableMatch[1];
      const indexSQL = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columns})`;
            
      await this.dbManager.runQuery(indexSQL);
      logger.info(`Auto-created index: ${indexName}`);

    } catch (error) {
      logger.error('Error creating recommended index:', error);
    }
  }

  /**
     * Limpiar estadísticas obsoletas
     */
  async cleanupStatistics() {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 días

    // Limpiar consultas lentas antiguas
    this.slowQueries = this.slowQueries.filter(
      query => query.timestamp > cutoffDate
    );

    // Limpiar estadísticas de consultas no utilizadas recientemente
    for (const [queryId, stats] of this.queryStats) {
      if (stats.lastExecuted < cutoffDate) {
        this.queryStats.delete(queryId);
      }
    }
  }

  /**
     * Iniciar monitoreo de rendimiento
     */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.config.analysisInterval);
  }

  /**
     * Actualizar métricas de rendimiento
     */
  updatePerformanceMetrics() {
    const totalQueries = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);
        
    const totalTime = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.totalTime, 0);

    this.performanceMetrics.averageQueryTime = totalQueries > 0 
      ? totalTime / totalQueries 
      : 0;

    // Log métricas periódicamente
    if (totalQueries > 0) {
      logger.info('Database performance metrics:', {
        totalQueries,
        slowQueries: this.slowQueries.length,
        averageQueryTime: this.performanceMetrics.averageQueryTime,
        uniqueQueries: this.queryStats.size
      });
    }
  }

  /**
     * Obtener estadísticas de rendimiento
     */
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      queryStats: Array.from(this.queryStats.entries()).map(([id, stats]) => ({
        id,
        ...stats
      })),
      slowQueries: this.slowQueries,
      indexRecommendations: this.indexRecommendations
    };
  }

  /**
     * Obtener consultas más lentas
     */
  getSlowestQueries(limit = 10) {
    return Array.from(this.queryStats.values())
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }

  /**
     * Obtener consultas más frecuentes
     */
  getMostFrequentQueries(limit = 10) {
    return Array.from(this.queryStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
     * Generar reporte de optimización
     */
  generateOptimizationReport() {
    return {
      summary: {
        totalQueries: this.performanceMetrics.totalQueries,
        slowQueries: this.performanceMetrics.slowQueries,
        averageQueryTime: this.performanceMetrics.averageQueryTime,
        uniqueQueries: this.queryStats.size
      },
      slowestQueries: this.getSlowestQueries(5),
      mostFrequentQueries: this.getMostFrequentQueries(5),
      indexRecommendations: this.indexRecommendations,
      tableStats: this.performanceMetrics.tableStats || {}
    };
  }
}

export default new DatabaseOptimizationService();
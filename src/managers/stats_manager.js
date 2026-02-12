/**
 * STATS MANAGER - Sistema de métricas y estadísticas
 * 
 * Funcionalidades:
 * - Métricas de interacción y conversación en tiempo real
 * - Estados de conversación y detección de intenciones
 * - Cálculo de efectividad y tasas de conversión
 * - Reportes agregados por período
 * - Persistencia atómica en JSON
 * - Análisis de patrones de uso
 * - Métricas de rendimiento del sistema
 * 
 * @author Sistema Chat Bot v5.0.0
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../services/core/core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StatsManager {
  constructor() {
    this.logger = createLogger('STATS_MANAGER');
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    this.isInitialized = false;
        
    // Sistema de mutex para operaciones críticas
    this.operationMutex = false;
    this.operationQueue = [];
        
    // Configuración
    this.config = {
      // Persistencia
      autoSave: process.env.STATS_AUTO_SAVE !== 'false',
      saveInterval: parseInt(process.env.STATS_SAVE_INTERVAL) || 300, // segundos
            
      // Retención de datos
      retentionDays: parseInt(process.env.STATS_RETENTION_DAYS) || 90,
      aggregationLevels: ['hourly', 'daily', 'weekly', 'monthly'],
            
      // Métricas
      trackDetailedMetrics: process.env.TRACK_DETAILED_METRICS !== 'false',
      trackPerformance: process.env.TRACK_PERFORMANCE !== 'false',
      trackUserBehavior: process.env.TRACK_USER_BEHAVIOR !== 'false',
            
      // Alertas
      enableAlerts: process.env.STATS_ALERTS !== 'false',
      errorThreshold: parseInt(process.env.ERROR_THRESHOLD) || 10,
      responseTimeThreshold: parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 5000
    };
        
    // Estado en memoria
    this.stats = {
      // Métricas básicas
      totalMessages: 0,
      totalContacts: 0,
      totalConversations: 0,
      totalErrors: 0,
            
      // Métricas de tiempo
      systemStartTime: new Date().toISOString(),
      lastActivity: null,
      uptime: 0,
            
      // Métricas de interacción
      interactions: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        totalResponseTime: 0
      },
            
      // Estados de conversación
      conversationStates: {
        active: 0,
        completed: 0,
        abandoned: 0,
        escalated: 0
      },
            
      // Intenciones detectadas
      intentions: {},
            
      // Métricas por período
      periods: {
        current: {
          hour: this.getCurrentHour(),
          day: this.getCurrentDay(),
          week: this.getCurrentWeek(),
          month: this.getCurrentMonth()
        },
        hourly: {},
        daily: {},
        weekly: {},
        monthly: {}
      },
            
      // Métricas de rendimiento
      performance: {
        memoryUsage: {},
        cpuUsage: 0,
        responseTimeDistribution: {
          fast: 0,    // < 1s
          normal: 0,  // 1-3s
          slow: 0,    // 3-5s
          verySlow: 0 // > 5s
        }
      },
            
      // Análisis de usuarios
      userBehavior: {
        newUsers: 0,
        returningUsers: 0,
        averageSessionLength: 0,
        mostActiveHours: {},
        commonPatterns: {}
      },
            
      // Métricas de efectividad
      effectiveness: {
        resolutionRate: 0,
        satisfactionScore: 0,
        escalationRate: 0,
        averageResolutionTime: 0
      }
    };
        
    // Timers y intervalos
    this.saveTimer = null;
    this.cleanupTimer = null;
    this.performanceTimer = null;
        
    // Cache para optimización
    this.cache = {
      lastSave: null,
      isDirty: false,
      aggregatedData: {}
    };
  }

  /**
     * Inicializa el gestor de estadísticas
     */
  async initialize() {
    try {
      await this.ensureDataDirectory();
      await this.loadStats();
            
      if (this.config.autoSave) {
        this.startAutoSave();
      }
            
      if (this.config.trackPerformance) {
        this.startPerformanceMonitoring();
      }
            
      this.startCleanupScheduler();
            
      this.isInitialized = true;
      this.log('StatsManager inicializado correctamente');
      return { success: true, message: 'StatsManager inicializado' };
    } catch (error) {
      this.logError('Error inicializando StatsManager', error);
      throw error;
    }
  }

  /**
     * Ejecuta una operación con mutex para evitar condiciones de carrera
     */
  async executeWithMutex(operation) {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  /**
     * Procesa la cola de operaciones secuencialmente
     */
  async processQueue() {
    if (this.operationMutex || this.operationQueue.length === 0) {
      return;
    }

    this.operationMutex = true;
    const { operation, resolve, reject } = this.operationQueue.shift();

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.operationMutex = false;
      // Procesar siguiente operación en la cola
      if (this.operationQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
     * Asegura que el directorio de datos existe
     */
  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
      this.log(`Directorio de datos creado: ${this.dataDir}`);
    }
  }

  /**
     * Carga las estadísticas desde el archivo
     */
  async loadStats() {
    try {
      await fs.access(this.statsFile);
      const data = await fs.readFile(this.statsFile, 'utf8');
      const savedStats = JSON.parse(data);
            
      // Fusionar con estadísticas por defecto
      this.stats = this.mergeStats(this.stats, savedStats);
            
      // Actualizar tiempo de inicio si es necesario
      if (!this.stats.systemStartTime) {
        this.stats.systemStartTime = new Date().toISOString();
      }
            
      this.log('Estadísticas cargadas correctamente');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logError('Error cargando estadísticas', error);
      }
      // Si el archivo no existe, usar estadísticas por defecto
      this.log('Iniciando con estadísticas por defecto');
    }
  }

  /**
     * Fusiona estadísticas guardadas con la estructura por defecto
     */
  mergeStats(defaultStats, savedStats) {
    const merged = { ...defaultStats };
        
    for (const [key, value] of Object.entries(savedStats)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = this.mergeStats(merged[key] || {}, value);
      } else {
        merged[key] = value;
      }
    }
        
    return merged;
  }

  /**
     * Guarda las estadísticas al archivo
     */
  async saveStats() {
    return this.executeWithMutex(async() => {
      try {
        // Verificar si hay cambios que guardar
        if (!this.cache.isDirty) {
          return { success: true, message: 'No hay cambios que guardar' };
        }

        // Actualizar uptime antes de guardar
        this.updateUptime();
                
        // Crear archivo temporal para escritura atómica
        const tempFile = `${this.statsFile}.tmp`;
        const data = JSON.stringify(this.stats, null, 2);
                
        // Escribir a archivo temporal
        await fs.writeFile(tempFile, data, 'utf8');
                
        // Verificar tamaño del archivo
        const stats = await fs.stat(tempFile);
        if (stats.size === 0) {
          await fs.unlink(tempFile);
          throw new Error('Archivo de estadísticas vacío generado');
        }
                
        // Renombrar atómicamente
        await fs.rename(tempFile, this.statsFile);
                
        this.cache.lastSave = new Date();
        this.cache.isDirty = false;
                
        this.log(`Estadísticas guardadas correctamente (${stats.size} bytes)`);
        return { success: true, size: stats.size, timestamp: this.cache.lastSave };
      } catch (error) {
        // Limpiar archivo temporal en caso de error
        try {
          const tempFile = `${this.statsFile}.tmp`;
          await fs.unlink(tempFile);
        } catch (cleanupError) {
          // Ignorar errores de limpieza
        }
                
        this.logError('Error guardando estadísticas', error);
        throw error;
      }
    });
  }

  /**
     * Inicia el guardado automático
     */
  startAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
        
    this.saveTimer = setInterval(async() => {
      if (this.cache.isDirty) {
        try {
          await this.saveStats();
        } catch (error) {
          this.logError('Error en guardado automático', error);
        }
      }
    }, this.config.saveInterval * 1000);
        
    this.log(`Guardado automático iniciado: cada ${this.config.saveInterval} segundos`);
  }

  /**
     * Inicia el monitoreo de rendimiento
     */
  startPerformanceMonitoring() {
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
    }
        
    this.performanceTimer = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 60000); // Cada minuto
        
    this.log('Monitoreo de rendimiento iniciado');
  }

  /**
     * Inicia el programador de limpieza
     */
  startCleanupScheduler() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    // Limpiar datos antiguos cada 24 horas
    this.cleanupTimer = setInterval(async() => {
      try {
        await this.cleanupOldData();
      } catch (error) {
        this.logError('Error en limpieza automática', error);
      }
    }, 24 * 60 * 60 * 1000);
        
    this.log('Programador de limpieza iniciado');
  }

  /**
     * Registra un mensaje procesado
     */
  async recordMessage(messageData) {
    return this.executeWithMutex(async() => {
      try {
        // Validación de entrada
        if (!messageData || typeof messageData !== 'object') {
          throw new Error('messageData debe ser un objeto válido');
        }

        const {
          phoneNumber,
          message,
          responseTime = 0,
          intention = 'unknown',
          success = true,
          error = null,
          messageId = null,
          timestamp = new Date().toISOString()
        } = messageData;

        // Validaciones específicas
        if (!phoneNumber || typeof phoneNumber !== 'string') {
          throw new Error('phoneNumber es requerido y debe ser string');
        }

        if (typeof responseTime !== 'number' || responseTime < 0) {
          throw new Error('responseTime debe ser un número positivo');
        }

        const startTime = Date.now();

        // Métricas básicas
        this.stats.totalMessages++;
        this.stats.lastActivity = timestamp;
                
        // Métricas de interacción
        this.stats.interactions.total++;
        if (success) {
          this.stats.interactions.successful++;
        } else {
          this.stats.interactions.failed++;
          this.stats.totalErrors++;
        }
                
        // Tiempo de respuesta
        this.stats.interactions.totalResponseTime += responseTime;
        this.stats.interactions.averageResponseTime = 
                    this.stats.interactions.totalResponseTime / this.stats.interactions.total;
                
        // Distribución de tiempo de respuesta
        this.updateResponseTimeDistribution(responseTime);
                
        // Intenciones
        if (intention && intention !== 'unknown' && typeof intention === 'string') {
          this.stats.intentions[intention] = (this.stats.intentions[intention] || 0) + 1;
        }
                
        // Métricas por período
        this.updatePeriodMetrics('messages', 1);
        if (success) {
          this.updatePeriodMetrics('successful_messages', 1);
        } else {
          this.updatePeriodMetrics('failed_messages', 1);
        }
                
        // Comportamiento de usuario
        if (message && typeof message === 'string') {
          await this.updateUserBehavior(phoneNumber, message);
        }
                
        // Verificar umbrales de error
        await this.checkErrorThresholds();
                
        this.markDirty();
                
        const processingTime = Date.now() - startTime;
                
        return { 
          success: true, 
          messageId,
          processingTime,
          timestamp 
        };
      } catch (error) {
        this.logError('Error registrando mensaje', error);
        throw error;
      }
    });
  }

  /**
     * Registra un nuevo contacto
     */
  async recordContact(contactData) {
    try {
      const { phoneNumber, isNew = true } = contactData;
            
      this.stats.totalContacts++;
            
      if (isNew) {
        this.stats.userBehavior.newUsers++;
        this.updatePeriodMetrics('newContacts', 1);
      } else {
        this.stats.userBehavior.returningUsers++;
        this.updatePeriodMetrics('returningContacts', 1);
      }
            
      this.stats.lastActivity = new Date().toISOString();
      this.markDirty();
            
      return { success: true };
    } catch (error) {
      this.logError('Error registrando contacto', error);
      throw error;
    }
  }

  /**
     * Registra el estado de una conversación
     */
  async recordConversationState(stateData) {
    try {
      const {
        phoneNumber,
        previousState = null,
        newState,
        duration = 0,
        resolution = null
      } = stateData;
            
      // Actualizar contadores de estado
      if (previousState && this.stats.conversationStates[previousState] > 0) {
        this.stats.conversationStates[previousState]--;
      }
            
      if (this.stats.conversationStates[newState] !== undefined) {
        this.stats.conversationStates[newState]++;
      }
            
      // Métricas de efectividad
      if (newState === 'completed' && resolution) {
        this.updateEffectivenessMetrics(duration, resolution);
      }
            
      // Métricas por período
      this.updatePeriodMetrics('conversationStateChanges', 1);
            
      this.stats.lastActivity = new Date().toISOString();
      this.markDirty();
            
      return { success: true };
    } catch (error) {
      this.logError('Error registrando estado de conversación', error);
      throw error;
    }
  }

  /**
     * Registra un error del sistema
     */
  async recordError(errorData) {
    try {
      const {
        type = 'unknown',
        severity = 'medium',
        module = 'unknown',
        message = '',
        stack = null
      } = errorData;
            
      this.stats.totalErrors++;
      this.stats.interactions.failed++;
            
      // Métricas por período
      this.updatePeriodMetrics('errors', 1);
            
      // Alertas si está habilitado
      if (this.config.enableAlerts) {
        await this.checkErrorThresholds();
      }
            
      this.stats.lastActivity = new Date().toISOString();
      this.markDirty();
            
      return { success: true };
    } catch (error) {
      this.logError('Error registrando error', error);
      throw error;
    }
  }

  /**
     * Actualiza la distribución de tiempo de respuesta
     */
  updateResponseTimeDistribution(responseTime) {
    const timeMs = responseTime;
        
    if (timeMs < 1000) {
      this.stats.performance.responseTimeDistribution.fast++;
    } else if (timeMs < 3000) {
      this.stats.performance.responseTimeDistribution.normal++;
    } else if (timeMs < 5000) {
      this.stats.performance.responseTimeDistribution.slow++;
    } else {
      this.stats.performance.responseTimeDistribution.verySlow++;
    }
  }

  /**
     * Actualiza métricas por período
     */
  updatePeriodMetrics(metric, value) {
    const now = new Date();
    const currentHour = this.getCurrentHour();
    const currentDay = this.getCurrentDay();
    const currentWeek = this.getCurrentWeek();
    const currentMonth = this.getCurrentMonth();
        
    // Verificar si cambió el período
    if (currentHour !== this.stats.periods.current.hour) {
      this.rotatePeriod('hourly', this.stats.periods.current.hour);
      this.stats.periods.current.hour = currentHour;
    }
        
    if (currentDay !== this.stats.periods.current.day) {
      this.rotatePeriod('daily', this.stats.periods.current.day);
      this.stats.periods.current.day = currentDay;
    }
        
    if (currentWeek !== this.stats.periods.current.week) {
      this.rotatePeriod('weekly', this.stats.periods.current.week);
      this.stats.periods.current.week = currentWeek;
    }
        
    if (currentMonth !== this.stats.periods.current.month) {
      this.rotatePeriod('monthly', this.stats.periods.current.month);
      this.stats.periods.current.month = currentMonth;
    }
        
    // Actualizar métricas actuales
    this.updatePeriodMetric('hourly', currentHour, metric, value);
    this.updatePeriodMetric('daily', currentDay, metric, value);
    this.updatePeriodMetric('weekly', currentWeek, metric, value);
    this.updatePeriodMetric('monthly', currentMonth, metric, value);
  }

  /**
     * Actualiza una métrica específica de un período
     */
  updatePeriodMetric(level, period, metric, value) {
    if (!this.stats.periods[level][period]) {
      this.stats.periods[level][period] = {};
    }
        
    this.stats.periods[level][period][metric] = 
            (this.stats.periods[level][period][metric] || 0) + value;
  }

  /**
     * Rota un período (guarda el período anterior)
     */
  rotatePeriod(level, period) {
    // Aquí se podría implementar lógica adicional para archivar períodos
    // Por ahora, simplemente mantenemos los datos en memoria
  }

  /**
     * Actualiza el comportamiento del usuario
     */
  async updateUserBehavior(phoneNumber, message) {
    try {
      const hour = new Date().getHours();
            
      // Horas más activas
      this.stats.userBehavior.mostActiveHours[hour] = 
                (this.stats.userBehavior.mostActiveHours[hour] || 0) + 1;
            
      // Patrones comunes (palabras clave)
      if (message && typeof message === 'string') {
        const words = message.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length > 3) { // Solo palabras significativas
            this.stats.userBehavior.commonPatterns[word] = 
                            (this.stats.userBehavior.commonPatterns[word] || 0) + 1;
          }
        }
      }
    } catch (error) {
      this.logError('Error actualizando comportamiento de usuario', error);
    }
  }

  /**
     * Actualiza métricas de efectividad
     */
  updateEffectivenessMetrics(duration, resolution) {
    // Tasa de resolución
    const totalCompleted = this.stats.conversationStates.completed;
    const totalConversations = Object.values(this.stats.conversationStates)
      .reduce((sum, count) => sum + count, 0);
        
    if (totalConversations > 0) {
      this.stats.effectiveness.resolutionRate = 
                (totalCompleted / totalConversations) * 100;
    }
        
    // Tiempo promedio de resolución
    if (duration > 0) {
      const currentAvg = this.stats.effectiveness.averageResolutionTime;
      this.stats.effectiveness.averageResolutionTime = 
                (currentAvg + duration) / 2;
    }
        
    // Tasa de escalación
    const escalated = this.stats.conversationStates.escalated;
    if (totalConversations > 0) {
      this.stats.effectiveness.escalationRate = 
                (escalated / totalConversations) * 100;
    }
  }

  /**
     * Actualiza métricas de rendimiento del sistema
     */
  updatePerformanceMetrics() {
    try {
      // Uso de memoria
      const memUsage = process.memoryUsage();
      this.stats.performance.memoryUsage = {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        timestamp: new Date().toISOString()
      };
            
      // Uptime
      this.updateUptime();
            
      this.markDirty();
    } catch (error) {
      this.logError('Error actualizando métricas de rendimiento', error);
    }
  }

  /**
     * Actualiza el tiempo de actividad
     */
  updateUptime() {
    const startTime = new Date(this.stats.systemStartTime);
    const now = new Date();
    this.stats.uptime = Math.floor((now - startTime) / 1000); // segundos
  }

  /**
     * Verifica umbrales de error para alertas
     */
  async checkErrorThresholds() {
    const currentHour = this.getCurrentHour();
    const hourlyErrors = this.stats.periods.hourly[currentHour]?.errors || 0;
        
    if (hourlyErrors >= this.config.errorThreshold) {
      this.log(`ALERTA: Umbral de errores excedido: ${hourlyErrors} errores en la última hora`);
      // Aquí se podría implementar notificaciones adicionales
    }
  }

  /**
     * Obtiene estadísticas actuales
     */
  async getStats(options = {}) {
    try {
      const {
        includePeriods = true,
        includePerformance = true,
        includeUserBehavior = true,
        period = null
      } = options;
            
      this.updateUptime();
            
      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        basic: {
          totalMessages: this.stats.totalMessages,
          totalContacts: this.stats.totalContacts,
          totalConversations: this.stats.totalConversations,
          totalErrors: this.stats.totalErrors,
          uptime: this.stats.uptime,
          lastActivity: this.stats.lastActivity
        },
        interactions: { ...this.stats.interactions },
        conversationStates: { ...this.stats.conversationStates },
        intentions: { ...this.stats.intentions },
        effectiveness: { ...this.stats.effectiveness }
      };
            
      if (includePeriods) {
        if (period) {
          result.periods = this.stats.periods[period] || {};
        } else {
          result.periods = { ...this.stats.periods };
        }
      }
            
      if (includePerformance) {
        result.performance = { ...this.stats.performance };
      }
            
      if (includeUserBehavior) {
        result.userBehavior = { ...this.stats.userBehavior };
      }
            
      return result;
    } catch (error) {
      this.logError('Error obteniendo estadísticas', error);
      throw error;
    }
  }

  /**
     * Obtiene reporte agregado por período
     */
  async getAggregatedReport(period = 'daily', limit = 30) {
    try {
      const periodData = this.stats.periods[period] || {};
      const periods = Object.keys(periodData)
        .sort()
        .slice(-limit);
            
      const report = {
        success: true,
        period,
        limit,
        data: periods.map(p => ({
          period: p,
          ...periodData[p]
        }))
      };
            
      return report;
    } catch (error) {
      this.logError('Error generando reporte agregado', error);
      throw error;
    }
  }

  /**
     * Reinicia estadísticas específicas
     */
  async resetStats(categories = []) {
    try {
      if (categories.length === 0) {
        // Reiniciar todo excepto configuración y períodos históricos
        const preserved = {
          systemStartTime: this.stats.systemStartTime,
          periods: this.stats.periods
        };
                
        this.stats = this.constructor.prototype.constructor.call(this).stats;
        this.stats.systemStartTime = preserved.systemStartTime;
        this.stats.periods = preserved.periods;
      } else {
        // Reiniciar categorías específicas
        for (const category of categories) {
          if (this.stats[category]) {
            if (typeof this.stats[category] === 'object') {
              for (const key in this.stats[category]) {
                if (typeof this.stats[category][key] === 'number') {
                  this.stats[category][key] = 0;
                }
              }
            } else if (typeof this.stats[category] === 'number') {
              this.stats[category] = 0;
            }
          }
        }
      }
            
      this.markDirty();
      await this.saveStats();
            
      this.log(`Estadísticas reiniciadas: ${categories.length ? categories.join(', ') : 'todas'}`);
      return { success: true, reset: categories.length ? categories : 'all' };
    } catch (error) {
      this.logError('Error reiniciando estadísticas', error);
      throw error;
    }
  }

  /**
     * Limpia datos antiguos según política de retención
     */
  async cleanupOldData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
            
      let removedCount = 0;
            
      // Limpiar períodos antiguos
      for (const level of this.config.aggregationLevels) {
        const periodData = this.stats.periods[level];
                
        for (const period in periodData) {
          const periodDate = this.parsePeriodDate(period, level);
                    
          if (periodDate && periodDate < cutoffDate) {
            delete periodData[period];
            removedCount++;
          }
        }
      }
            
      // Limpiar patrones de comportamiento poco frecuentes
      const minFrequency = 5;
      for (const pattern in this.stats.userBehavior.commonPatterns) {
        if (this.stats.userBehavior.commonPatterns[pattern] < minFrequency) {
          delete this.stats.userBehavior.commonPatterns[pattern];
          removedCount++;
        }
      }
            
      if (removedCount > 0) {
        this.markDirty();
        this.log(`Limpieza completada: ${removedCount} elementos antiguos eliminados`);
      }
            
      return { success: true, removed: removedCount };
    } catch (error) {
      this.logError('Error en limpieza de datos', error);
      throw error;
    }
  }

  /**
     * Parsea una fecha de período
     */
  parsePeriodDate(period, level) {
    try {
      switch (level) {
      case 'hourly':
        // Formato: YYYY-MM-DD-HH
        const [year, month, day, hour] = period.split('-').map(Number);
        return new Date(year, month - 1, day, hour);
                
      case 'daily':
        // Formato: YYYY-MM-DD
        const [y, m, d] = period.split('-').map(Number);
        return new Date(y, m - 1, d);
                
      case 'weekly':
        // Formato: YYYY-WW
        const [yr, week] = period.split('-W');
        return new Date(parseInt(yr), 0, 1 + (parseInt(week) - 1) * 7);
                
      case 'monthly':
        // Formato: YYYY-MM
        const [ye, mo] = period.split('-').map(Number);
        return new Date(ye, mo - 1, 1);
                
      default:
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
     * Obtiene el período actual por hora
     */
  getCurrentHour() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
  }

  /**
     * Obtiene el período actual por día
     */
  getCurrentDay() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
     * Obtiene el período actual por semana
     */
  getCurrentWeek() {
    const now = new Date();
    const year = now.getFullYear();
    const week = this.getWeekNumber(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  /**
     * Obtiene el período actual por mes
     */
  getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
     * Calcula el número de semana del año
     */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
     * Marca las estadísticas como modificadas
     */
  markDirty() {
    this.cache.isDirty = true;
  }

  /**
     * Logging unificado
     */
  log(message) {
    const timestamp = new Date().toISOString();
    logger.info(`[${timestamp}] [StatsManager] ${message}`);
  }

  /**
     * Logging de errores
     */
  logError(message, error) {
    const timestamp = new Date().toISOString();
    this.logger.error(`[${timestamp}] [StatsManager] ERROR: ${message}`, error);
  }

  /**
     * Cierre limpio del gestor
     */
  async shutdown() {
    try {
      // Detener timers
      if (this.saveTimer) {
        clearInterval(this.saveTimer);
        this.saveTimer = null;
      }
            
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
            
      if (this.performanceTimer) {
        clearInterval(this.performanceTimer);
        this.performanceTimer = null;
      }
            
      // Guardar estadísticas finales
      if (this.cache.isDirty) {
        await this.saveStats();
      }
            
      this.log('StatsManager cerrado correctamente');
    } catch (error) {
      this.logError('Error cerrando StatsManager', error);
    }
  }
}

// Instancia singleton
const statsManager = new StatsManager();

// Funciones exportadas
export const initialize = () => statsManager.initialize();
export const recordMessage = (messageData) => statsManager.recordMessage(messageData);
export const recordContact = (contactData) => statsManager.recordContact(contactData);
export const recordConversationState = (stateData) => statsManager.recordConversationState(stateData);
export const recordError = (errorData) => statsManager.recordError(errorData);
export const getStats = (options) => statsManager.getStats(options);
export const getAggregatedReport = (period, limit) => statsManager.getAggregatedReport(period, limit);
export const resetStats = (categories) => statsManager.resetStats(categories);
export const cleanupOldData = () => statsManager.cleanupOldData();
export const shutdown = () => statsManager.shutdown();

export default statsManager;
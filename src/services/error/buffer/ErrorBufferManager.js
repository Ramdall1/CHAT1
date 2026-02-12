/**
 * ErrorBufferManager - Gestor inteligente de buffers y logs de errores
 * 
 * Funcionalidades:
 * - Gestión de múltiples buffers (circular, temporal, prioridad)
 * - Rotación automática de logs
 * - Compresión y archivado inteligente
 * - Búsqueda y filtrado eficiente
 * - Persistencia configurable
 */
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { createGzip } from 'zlib';

class ErrorBufferManager {
  constructor(config = {}) {
    this.config = {
      bufferSize: 10000,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      logDirectory: './logs/errors',
      logRotation: {
        enabled: true,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        compress: true
      },
      persistence: {
        enabled: true,
        interval: 300000, // 5 minutos
        batchSize: 1000
      },
      retention: {
        bufferHours: 24,
        logDays: 30,
        archiveDays: 365
      },
      ...config
    };

    // Buffers principales
    this.buffers = {
      // Buffer circular principal
      main: {
        data: [],
        maxSize: this.config.bufferSize,
        writeIndex: 0,
        readIndex: 0,
        isFull: false
      },
      
      // Buffer de errores recientes (últimas 24h)
      recent: {
        data: [],
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      },
      
      // Buffer de alta prioridad (críticos/errores)
      priority: {
        data: [],
        maxSize: 1000
      },
      
      // Buffer temporal para agregación
      temporal: {
        data: [],
        flushInterval: 60000 // 1 minuto
      }
    };

    // Índices para búsqueda rápida
    this.indexes = {
      byModule: new Map(),
      bySeverity: new Map(),
      byTimestamp: new Map(),
      byCategory: new Map()
    };

    // Estadísticas del buffer
    this.stats = {
      totalErrors: 0,
      bufferHits: 0,
      bufferMisses: 0,
      memoryUsage: 0,
      lastFlush: null,
      lastRotation: null
    };

    // Configuración de archivos de log
    this.logFiles = {
      current: null,
      currentSize: 0,
      rotationCounter: 0
    };

    // Streams de escritura
    this.writeStreams = {
      main: null,
      error: null,
      debug: null
    };

    // Temporizadores
    this.timers = {
      persistence: null,
      cleanup: null,
      flush: null
    };

    // Estado del manager
    this.isActive = false;
    this.isInitialized = false;
  }

  /**
   * Inicializar buffer manager
   */
  async initialize() {
    logger.debug('🗂️ Inicializando gestor de buffers de errores...');
    
    try {
      // Crear directorios necesarios
      await this.createDirectories();
      
      // Inicializar archivos de log
      await this.initializeLogFiles();
      
      // Cargar datos persistidos
      await this.loadPersistedData();
      
      // Inicializar temporizadores
      this.startTimers();
      
      // Inicializar índices
      this.rebuildIndexes();
      
      this.isActive = true;
      this.isInitialized = true;
      
      logger.debug('✅ Gestor de buffers inicializado correctamente');
      
    } catch (error) {
      logger.error('❌ Error inicializando gestor de buffers:', error);
      throw error;
    }
  }

  /**
   * Crear directorios necesarios
   */
  async createDirectories() {
    const directories = [
      this.config.logDirectory,
      path.join(this.config.logDirectory, 'archive'),
      path.join(this.config.logDirectory, 'temp')
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }
  }

  /**
   * Inicializar archivos de log
   */
  async initializeLogFiles() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `errors-${timestamp}.log`;
    const logFilePath = path.join(this.config.logDirectory, logFileName);

    this.logFiles.current = logFilePath;
    this.logFiles.currentSize = 0;

    // Crear streams de escritura
    this.writeStreams.main = createWriteStream(logFilePath, { flags: 'a' });
    
    // Stream para errores críticos
    const errorLogPath = path.join(this.config.logDirectory, `critical-${timestamp}.log`);
    this.writeStreams.error = createWriteStream(errorLogPath, { flags: 'a' });
    
    logger.debug(`📝 Archivos de log inicializados: ${logFileName}`);
  }

  /**
   * Cargar datos persistidos
   */
  async loadPersistedData() {
    if (!this.config.persistence.enabled) return;

    try {
      const persistenceFile = path.join(this.config.logDirectory, 'buffer-state.json');
      
      try {
        const data = await fs.readFile(persistenceFile, 'utf8');
        const persistedState = JSON.parse(data);
        
        // Restaurar buffers
        if (persistedState.buffers) {
          this.buffers.main.data = persistedState.buffers.main || [];
          this.buffers.recent.data = persistedState.buffers.recent || [];
          this.buffers.priority.data = persistedState.buffers.priority || [];
        }
        
        // Restaurar estadísticas
        if (persistedState.stats) {
          this.stats = { ...this.stats, ...persistedState.stats };
        }
        
        logger.debug(`📂 Datos persistidos cargados: ${this.buffers.main.data.length} errores`);
        
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn('⚠️ Error cargando datos persistidos:', error.message);
        }
      }
      
    } catch (error) {
      logger.warn('⚠️ Error en carga de persistencia:', error);
    }
  }

  /**
   * Inicializar temporizadores
   */
  startTimers() {
    // Timer para persistencia
    if (this.config.persistence.enabled) {
      this.timers.persistence = setInterval(() => {
        this.persistData();
      }, this.config.persistence.interval);
    }

    // Timer para limpieza
    this.timers.cleanup = setInterval(() => {
      this.cleanup();
    }, 3600000); // cada hora

    // Timer para flush del buffer temporal
    this.timers.flush = setInterval(() => {
      this.flushTemporalBuffer();
    }, this.buffers.temporal.flushInterval);
  }

  /**
   * Agregar error al buffer
   */
  addError(errorData) {
    if (!this.isActive) return false;

    try {
      const timestamp = Date.now();
      const enrichedError = {
        ...errorData,
        id: this.generateErrorId(),
        timestamp,
        bufferTimestamp: timestamp,
        memoryUsage: process.memoryUsage().heapUsed
      };

      // Agregar a buffer principal
      this.addToMainBuffer(enrichedError);
      
      // Agregar a buffer reciente
      this.addToRecentBuffer(enrichedError);
      
      // Agregar a buffer de prioridad si es crítico
      if (this.isCriticalError(enrichedError)) {
        this.addToPriorityBuffer(enrichedError);
      }
      
      // Agregar a buffer temporal
      this.addToTemporalBuffer(enrichedError);
      
      // Actualizar índices
      this.updateIndexes(enrichedError);
      
      // Escribir a log
      this.writeToLog(enrichedError);
      
      // Actualizar estadísticas
      this.updateStats(enrichedError);
      
      // Verificar rotación de logs
      this.checkLogRotation();
      
      return true;
      
    } catch (error) {
      logger.error('Error agregando al buffer:', error);
      return false;
    }
  }

  /**
   * Agregar a buffer principal (circular)
   */
  addToMainBuffer(errorData) {
    const buffer = this.buffers.main;
    
    // Agregar al buffer circular
    buffer.data[buffer.writeIndex] = errorData;
    buffer.writeIndex = (buffer.writeIndex + 1) % buffer.maxSize;
    
    // Verificar si el buffer está lleno
    if (buffer.writeIndex === buffer.readIndex) {
      buffer.isFull = true;
      buffer.readIndex = (buffer.readIndex + 1) % buffer.maxSize;
    }
  }

  /**
   * Agregar a buffer reciente
   */
  addToRecentBuffer(errorData) {
    const buffer = this.buffers.recent;
    
    // Agregar error
    buffer.data.push(errorData);
    
    // Limpiar errores antiguos
    const cutoff = Date.now() - buffer.maxAge;
    buffer.data = buffer.data.filter(error => error.timestamp > cutoff);
  }

  /**
   * Agregar a buffer de prioridad
   */
  addToPriorityBuffer(errorData) {
    const buffer = this.buffers.priority;
    
    // Agregar error
    buffer.data.push(errorData);
    
    // Mantener tamaño máximo
    if (buffer.data.length > buffer.maxSize) {
      buffer.data = buffer.data.slice(-buffer.maxSize);
    }
    
    // Ordenar por severidad y timestamp
    buffer.data.sort((a, b) => {
      const severityOrder = { critical: 4, error: 3, warning: 2, info: 1, debug: 0 };
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp - a.timestamp;
    });
  }

  /**
   * Agregar a buffer temporal
   */
  addToTemporalBuffer(errorData) {
    this.buffers.temporal.data.push(errorData);
  }

  /**
   * Verificar si es error crítico
   */
  isCriticalError(errorData) {
    return errorData.severity === 'critical' || errorData.severity === 'error';
  }

  /**
   * Actualizar índices
   */
  updateIndexes(errorData) {
    // Índice por módulo
    const module = errorData.module || 'unknown';
    if (!this.indexes.byModule.has(module)) {
      this.indexes.byModule.set(module, []);
    }
    this.indexes.byModule.get(module).push(errorData.id);

    // Índice por severidad
    const severity = errorData.severity || 'unknown';
    if (!this.indexes.bySeverity.has(severity)) {
      this.indexes.bySeverity.set(severity, []);
    }
    this.indexes.bySeverity.get(severity).push(errorData.id);

    // Índice por timestamp (agrupado por hora)
    const hourKey = Math.floor(errorData.timestamp / 3600000) * 3600000;
    if (!this.indexes.byTimestamp.has(hourKey)) {
      this.indexes.byTimestamp.set(hourKey, []);
    }
    this.indexes.byTimestamp.get(hourKey).push(errorData.id);

    // Índice por categoría
    const category = errorData.metadata?.category || 'unknown';
    if (!this.indexes.byCategory.has(category)) {
      this.indexes.byCategory.set(category, []);
    }
    this.indexes.byCategory.get(category).push(errorData.id);
  }

  /**
   * Escribir a log
   */
  writeToLog(errorData) {
    try {
      const logEntry = this.formatLogEntry(errorData);
      
      // Escribir a log principal
      if (this.writeStreams.main) {
        this.writeStreams.main.write(logEntry + '\n');
        this.logFiles.currentSize += Buffer.byteLength(logEntry + '\n');
      }
      
      // Escribir a log de errores críticos
      if (this.isCriticalError(errorData) && this.writeStreams.error) {
        this.writeStreams.error.write(logEntry + '\n');
      }
      
    } catch (error) {
      logger.error('Error escribiendo a log:', error);
    }
  }

  /**
   * Formatear entrada de log
   */
  formatLogEntry(errorData) {
    const timestamp = new Date(errorData.timestamp).toISOString();
    const level = (errorData.severity || 'unknown').toUpperCase();
    const module = errorData.module || 'unknown';
    const message = errorData.message || 'No message';
    
    // Formato estructurado JSON para facilitar parsing
    const logObject = {
      timestamp,
      level,
      module,
      message,
      stack: errorData.stack,
      metadata: errorData.metadata,
      id: errorData.id
    };
    
    return JSON.stringify(logObject);
  }

  /**
   * Verificar rotación de logs
   */
  async checkLogRotation() {
    if (!this.config.logRotation.enabled) return;
    
    if (this.logFiles.currentSize >= this.config.logRotation.maxFileSize) {
      await this.rotateLog();
    }
  }

  /**
   * Rotar log
   */
  async rotateLog() {
    try {
      logger.debug('🔄 Iniciando rotación de logs...');
      
      // Cerrar streams actuales
      if (this.writeStreams.main) {
        this.writeStreams.main.end();
      }
      if (this.writeStreams.error) {
        this.writeStreams.error.end();
      }
      
      // Mover archivo actual a archivo
      const currentFile = this.logFiles.current;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivedFile = path.join(
        this.config.logDirectory, 
        'archive', 
        `errors-${timestamp}-${this.logFiles.rotationCounter}.log`
      );
      
      await fs.rename(currentFile, archivedFile);
      
      // Comprimir si está habilitado
      if (this.config.logRotation.compress) {
        await this.compressLogFile(archivedFile);
      }
      
      // Crear nuevos archivos de log
      await this.initializeLogFiles();
      
      // Limpiar archivos antiguos
      await this.cleanupOldLogFiles();
      
      this.logFiles.rotationCounter++;
      this.stats.lastRotation = Date.now();
      
      logger.debug('✅ Rotación de logs completada');
      
    } catch (error) {
      logger.error('❌ Error en rotación de logs:', error);
    }
  }

  /**
   * Comprimir archivo de log
   */
  async compressLogFile(filePath) {
    return new Promise((resolve, reject) => {
      const gzip = createGzip();
      const source = fs.createReadStream(filePath);
      const destination = createWriteStream(filePath + '.gz');
      
      source.pipe(gzip).pipe(destination);
      
      destination.on('close', async () => {
        try {
          await fs.unlink(filePath); // Eliminar archivo original
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      
      destination.on('error', reject);
    });
  }

  /**
   * Limpiar archivos de log antiguos
   */
  async cleanupOldLogFiles() {
    try {
      const archiveDir = path.join(this.config.logDirectory, 'archive');
      const files = await fs.readdir(archiveDir);
      
      // Filtrar archivos de log
      const logFiles = files.filter(file => file.startsWith('errors-'));
      
      // Ordenar por fecha de modificación
      const fileStats = await Promise.all(
        logFiles.map(async file => {
          const filePath = path.join(archiveDir, file);
          const stats = await fs.stat(filePath);
          return { file, path: filePath, mtime: stats.mtime };
        })
      );
      
      fileStats.sort((a, b) => b.mtime - a.mtime);
      
      // Eliminar archivos excedentes
      if (fileStats.length > this.config.logRotation.maxFiles) {
        const filesToDelete = fileStats.slice(this.config.logRotation.maxFiles);
        
        for (const fileInfo of filesToDelete) {
          await fs.unlink(fileInfo.path);
          logger.debug(`🗑️ Archivo de log eliminado: ${fileInfo.file}`);
        }
      }
      
    } catch (error) {
      logger.error('Error limpiando archivos de log:', error);
    }
  }

  /**
   * Flush buffer temporal
   */
  flushTemporalBuffer() {
    const buffer = this.buffers.temporal;
    
    if (buffer.data.length === 0) return;
    
    // Procesar errores en lotes
    const batchSize = this.config.persistence.batchSize;
    const batches = [];
    
    for (let i = 0; i < buffer.data.length; i += batchSize) {
      batches.push(buffer.data.slice(i, i + batchSize));
    }
    
    // Procesar cada lote
    batches.forEach(batch => {
      this.processBatch(batch);
    });
    
    // Limpiar buffer temporal
    buffer.data = [];
    this.stats.lastFlush = Date.now();
  }

  /**
   * Procesar lote de errores
   */
  processBatch(batch) {
    // En implementación real, aquí se podrían enviar a sistemas externos
    // como bases de datos, sistemas de monitoreo, etc.
    logger.debug(`📦 Procesando lote de ${batch.length} errores`);
  }

  /**
   * Buscar errores
   */
  search(criteria = {}) {
    const results = [];
    
    try {
      // Determinar qué buffer usar
      let searchBuffer = this.buffers.main.data;
      
      if (criteria.priority) {
        searchBuffer = this.buffers.priority.data;
      } else if (criteria.recent) {
        searchBuffer = this.buffers.recent.data;
      }
      
      // Aplicar filtros
      for (const error of searchBuffer) {
        if (this.matchesCriteria(error, criteria)) {
          results.push(error);
        }
      }
      
      // Ordenar resultados
      if (criteria.sortBy) {
        results.sort((a, b) => {
          const field = criteria.sortBy;
          const order = criteria.sortOrder === 'asc' ? 1 : -1;
          
          if (a[field] < b[field]) return -1 * order;
          if (a[field] > b[field]) return 1 * order;
          return 0;
        });
      }
      
      // Limitar resultados
      const limit = criteria.limit || 100;
      const offset = criteria.offset || 0;
      
      this.stats.bufferHits++;
      return results.slice(offset, offset + limit);
      
    } catch (error) {
      logger.error('Error en búsqueda:', error);
      this.stats.bufferMisses++;
      return [];
    }
  }

  /**
   * Verificar si error coincide con criterios
   */
  matchesCriteria(error, criteria) {
    // Filtro por módulo
    if (criteria.module && error.module !== criteria.module) {
      return false;
    }
    
    // Filtro por severidad
    if (criteria.severity && error.severity !== criteria.severity) {
      return false;
    }
    
    // Filtro por rango de tiempo
    if (criteria.startTime && error.timestamp < criteria.startTime) {
      return false;
    }
    
    if (criteria.endTime && error.timestamp > criteria.endTime) {
      return false;
    }
    
    // Filtro por mensaje (búsqueda de texto)
    if (criteria.message && !error.message.toLowerCase().includes(criteria.message.toLowerCase())) {
      return false;
    }
    
    // Filtro por categoría
    if (criteria.category && error.metadata?.category !== criteria.category) {
      return false;
    }
    
    return true;
  }

  /**
   * Obtener errores recientes
   */
  getRecentErrors(limit = 50) {
    return this.buffers.recent.data
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Obtener errores críticos
   */
  getCriticalErrors(limit = 20) {
    return this.buffers.priority.data.slice(0, limit);
  }

  /**
   * Actualizar estadísticas
   */
  updateStats(errorData) {
    this.stats.totalErrors++;
    this.stats.memoryUsage = process.memoryUsage().heapUsed;
  }

  /**
   * Persistir datos
   */
  async persistData() {
    if (!this.config.persistence.enabled) return;

    try {
      const persistenceData = {
        timestamp: Date.now(),
        buffers: {
          main: this.buffers.main.data.slice(-1000), // Últimos 1000 errores
          recent: this.buffers.recent.data,
          priority: this.buffers.priority.data
        },
        stats: this.stats
      };

      const persistenceFile = path.join(this.config.logDirectory, 'buffer-state.json');
      await fs.writeFile(persistenceFile, JSON.stringify(persistenceData, null, 2));
      
      logger.debug('💾 Datos del buffer persistidos');
      
    } catch (error) {
      logger.error('Error persistiendo datos:', error);
    }
  }

  /**
   * Reconstruir índices
   */
  rebuildIndexes() {
    // Limpiar índices existentes
    this.indexes.byModule.clear();
    this.indexes.bySeverity.clear();
    this.indexes.byTimestamp.clear();
    this.indexes.byCategory.clear();

    // Reconstruir desde buffer principal
    for (const error of this.buffers.main.data) {
      if (error) {
        this.updateIndexes(error);
      }
    }

    logger.debug('🔍 Índices reconstruidos');
  }

  /**
   * Limpiar datos antiguos
   */
  cleanup() {
    const now = Date.now();
    
    // Limpiar buffer reciente
    const recentCutoff = now - this.buffers.recent.maxAge;
    this.buffers.recent.data = this.buffers.recent.data.filter(error => 
      error.timestamp > recentCutoff
    );

    // Limpiar índices antiguos
    for (const [hourKey, errors] of this.indexes.byTimestamp) {
      if (now - hourKey > this.config.retention.bufferHours * 3600000) {
        this.indexes.byTimestamp.delete(hourKey);
      }
    }

    logger.debug('🧹 Limpieza de buffers completada');
  }

  /**
   * Generar ID único para error
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtener estadísticas del buffer
   */
  getStats() {
    return {
      ...this.stats,
      buffers: {
        main: {
          size: this.buffers.main.data.filter(e => e).length,
          maxSize: this.buffers.main.maxSize,
          isFull: this.buffers.main.isFull
        },
        recent: {
          size: this.buffers.recent.data.length,
          maxAge: this.buffers.recent.maxAge
        },
        priority: {
          size: this.buffers.priority.data.length,
          maxSize: this.buffers.priority.maxSize
        },
        temporal: {
          size: this.buffers.temporal.data.length
        }
      },
      indexes: {
        modules: this.indexes.byModule.size,
        severities: this.indexes.bySeverity.size,
        timeSlots: this.indexes.byTimestamp.size,
        categories: this.indexes.byCategory.size
      },
      logFiles: {
        current: this.logFiles.current,
        currentSize: this.logFiles.currentSize,
        rotationCounter: this.logFiles.rotationCounter
      }
    };
  }

  /**
   * Detener buffer manager
   */
  async stop() {
    logger.debug('🛑 Deteniendo gestor de buffers...');
    
    // Limpiar temporizadores
    if (this.timers.persistence) {
      clearInterval(this.timers.persistence);
    }
    if (this.timers.cleanup) {
      clearInterval(this.timers.cleanup);
    }
    if (this.timers.flush) {
      clearInterval(this.timers.flush);
    }

    // Flush final del buffer temporal
    this.flushTemporalBuffer();

    // Persistir datos finales
    await this.persistData();

    // Cerrar streams
    if (this.writeStreams.main) {
      this.writeStreams.main.end();
    }
    if (this.writeStreams.error) {
      this.writeStreams.error.end();
    }

    this.isActive = false;
    logger.debug('✅ Gestor de buffers detenido');
  }
}

export default ErrorBufferManager;
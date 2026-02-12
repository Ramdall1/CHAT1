/**
 * Sistema de Persistencia y Auditoría de Eventos
 * 
 * Registra, almacena y gestiona todos los eventos del sistema event-driven
 * para auditoría, análisis y reproducción.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './logger.js';
import { getDatabase } from './database.js';

const logger = createLogger('EVENT_LOGGER');

export class EventLogger {
  constructor(options = {}) {
    this.options = {
      // Configuración de archivos
      logDirectory: options.logDirectory || './storage/events',
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
      maxFiles: options.maxFiles || 100,
      rotationInterval: options.rotationInterval || 24 * 60 * 60 * 1000, // 24 horas
      
      // Configuración de buffer
      bufferSize: options.bufferSize || 1000,
      flushInterval: options.flushInterval || 5000, // 5 segundos
      
      // Configuración de compresión
      enableCompression: options.enableCompression !== false,
      compressionLevel: options.compressionLevel || 6,
      
      // Configuración de filtros
      enableFiltering: options.enableFiltering !== false,
      excludeEvents: options.excludeEvents || [],
      includeEvents: options.includeEvents || [],
      
      // Configuración de índices
      enableIndexing: options.enableIndexing !== false,
      indexFields: options.indexFields || ['eventType', 'agentId', 'timestamp'],
      
      ...options
    };
    
    // Estado del logger
    this.isActive = false;
    this.currentFile = null;
    this.currentFileSize = 0;
    this.eventBuffer = [];
    this.flushTimer = null;
    this.rotationTimer = null;
    
    // Estadísticas
    this.stats = {
      eventsLogged: 0,
      eventsFiltered: 0,
      filesCreated: 0,
      totalSize: 0,
      errors: 0,
      lastFlush: null,
      lastRotation: null
    };
    
    // Índices para búsqueda rápida
    this.indices = {
      byEventType: new Map(),
      byAgentId: new Map(),
      byTimestamp: new Map(),
      byCorrelationId: new Map()
    };
    
    // Cache de archivos recientes
    this.fileCache = new Map();
    this.maxCacheSize = 10;
    
    this.db = getDatabase();
  }
  
  /**
   * Inicializar el logger de eventos
   */
  async initialize() {
    try {
      logger.info('Inicializando EventLogger...');
      
      // Crear directorio de logs si no existe
      await this.ensureLogDirectory();
      
      // Cargar estadísticas existentes
      await this.loadStats();
      
      // Cargar índices existentes
      await this.loadIndices();
      
      // Configurar archivo actual
      await this.setupCurrentFile();
      
      // Iniciar timers
      this.startFlushTimer();
      this.startRotationTimer();
      
      this.isActive = true;
      
      logger.info(`EventLogger inicializado - Directorio: ${this.options.logDirectory}`);
      return true;
    } catch (error) {
      logger.error('Error inicializando EventLogger:', error);
      throw error;
    }
  }
  
  /**
   * Registrar un evento
   */
  async logEvent(eventData) {
    if (!this.isActive) {
      logger.warn('EventLogger no está activo');
      return false;
    }
    
    try {
      // Validar y enriquecer evento
      const enrichedEvent = this.enrichEvent(eventData);
      
      // Aplicar filtros
      if (!this.shouldLogEvent(enrichedEvent)) {
        this.stats.eventsFiltered++;
        return false;
      }
      
      // Añadir al buffer
      this.eventBuffer.push(enrichedEvent);
      this.stats.eventsLogged++;
      
      // Actualizar índices
      this.updateIndices(enrichedEvent);
      
      // Flush si el buffer está lleno
      if (this.eventBuffer.length >= this.options.bufferSize) {
        await this.flushBuffer();
      }
      
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Error registrando evento:', error);
      return false;
    }
  }
  
  /**
   * Registrar múltiples eventos
   */
  async logEvents(events) {
    const results = [];
    
    for (const event of events) {
      const result = await this.logEvent(event);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Buscar eventos
   */
  async searchEvents(criteria = {}) {
    try {
      const {
        eventType,
        agentId,
        correlationId,
        startTime,
        endTime,
        limit = 100,
        offset = 0,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = criteria;
      
      let events = [];
      
      // Usar índices para búsqueda rápida
      if (eventType && this.indices.byEventType.has(eventType)) {
        events = this.indices.byEventType.get(eventType);
      } else if (agentId && this.indices.byAgentId.has(agentId)) {
        events = this.indices.byAgentId.get(agentId);
      } else if (correlationId && this.indices.byCorrelationId.has(correlationId)) {
        events = this.indices.byCorrelationId.get(correlationId);
      } else {
        // Búsqueda completa en archivos
        events = await this.searchInFiles(criteria);
      }
      
      // Aplicar filtros adicionales
      events = this.filterEvents(events, criteria);
      
      // Ordenar
      events = this.sortEvents(events, sortBy, sortOrder);
      
      // Paginación
      const total = events.length;
      events = events.slice(offset, offset + limit);
      
      return {
        events,
        total,
        limit,
        offset,
        hasMore: (offset + limit) < total
      };
    } catch (error) {
      logger.error('Error buscando eventos:', error);
      throw error;
    }
  }
  
  /**
   * Obtener eventos por rango de tiempo
   */
  async getEventsByTimeRange(startTime, endTime, options = {}) {
    return this.searchEvents({
      startTime,
      endTime,
      ...options
    });
  }
  
  /**
   * Obtener eventos por tipo
   */
  async getEventsByType(eventType, options = {}) {
    return this.searchEvents({
      eventType,
      ...options
    });
  }
  
  /**
   * Obtener eventos por agente
   */
  async getEventsByAgent(agentId, options = {}) {
    return this.searchEvents({
      agentId,
      ...options
    });
  }
  
  /**
   * Obtener flujo de eventos por correlación
   */
  async getEventFlow(correlationId) {
    try {
      const events = await this.searchEvents({
        correlationId,
        sortBy: 'timestamp',
        sortOrder: 'asc',
        limit: 1000
      });
      
      // Construir flujo de eventos
      const flow = {
        correlationId,
        startTime: events.events[0]?.timestamp,
        endTime: events.events[events.events.length - 1]?.timestamp,
        duration: null,
        eventCount: events.total,
        agents: new Set(),
        eventTypes: new Set(),
        events: events.events
      };
      
      // Calcular duración y extraer metadatos
      if (flow.startTime && flow.endTime) {
        flow.duration = new Date(flow.endTime) - new Date(flow.startTime);
      }
      
      events.events.forEach(event => {
        if (event.agentId) flow.agents.add(event.agentId);
        if (event.eventType) flow.eventTypes.add(event.eventType);
      });
      
      flow.agents = Array.from(flow.agents);
      flow.eventTypes = Array.from(flow.eventTypes);
      
      return flow;
    } catch (error) {
      logger.error('Error obteniendo flujo de eventos:', error);
      throw error;
    }
  }
  
  /**
   * Obtener estadísticas de eventos
   */
  async getEventStats(timeRange = '24h') {
    try {
      const now = new Date();
      let startTime;
      
      switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
      
      const events = await this.getEventsByTimeRange(startTime.toISOString(), now.toISOString(), {
        limit: 10000
      });
      
      const stats = {
        timeRange,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
        totalEvents: events.total,
        eventsByType: {},
        eventsByAgent: {},
        eventsByHour: {},
        topEventTypes: [],
        topAgents: [],
        errorRate: 0,
        avgEventsPerHour: 0
      };
      
      // Analizar eventos
      let errorCount = 0;
      
      events.events.forEach(event => {
        // Por tipo
        stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;
        
        // Por agente
        if (event.agentId) {
          stats.eventsByAgent[event.agentId] = (stats.eventsByAgent[event.agentId] || 0) + 1;
        }
        
        // Por hora
        const hour = new Date(event.timestamp).getHours();
        stats.eventsByHour[hour] = (stats.eventsByHour[hour] || 0) + 1;
        
        // Contar errores
        if (event.level === 'error' || event.eventType.includes('error')) {
          errorCount++;
        }
      });
      
      // Calcular métricas derivadas
      stats.errorRate = events.total > 0 ? errorCount / events.total : 0;
      
      const hours = (now - startTime) / (1000 * 60 * 60);
      stats.avgEventsPerHour = events.total / hours;
      
      // Top eventos y agentes
      stats.topEventTypes = Object.entries(stats.eventsByType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }));
      
      stats.topAgents = Object.entries(stats.eventsByAgent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([agent, count]) => ({ agent, count }));
      
      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
  
  /**
   * Exportar eventos
   */
  async exportEvents(criteria = {}, format = 'json') {
    try {
      const events = await this.searchEvents({
        ...criteria,
        limit: 10000
      });
      
      switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(events, null, 2);
      case 'csv':
        return this.eventsToCSV(events.events);
      case 'ndjson':
        return events.events.map(e => JSON.stringify(e)).join('\n');
      default:
        throw new Error(`Formato no soportado: ${format}`);
      }
    } catch (error) {
      logger.error('Error exportando eventos:', error);
      throw error;
    }
  }
  
  /**
   * Limpiar eventos antiguos
   */
  async cleanupOldEvents(maxAge = '30d') {
    try {
      const now = new Date();
      let cutoffTime;
      
      switch (maxAge) {
      case '7d':
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      logger.info(`Limpiando eventos anteriores a ${cutoffTime.toISOString()}`);
      
      const files = await this.getLogFiles();
      let deletedFiles = 0;
      let deletedSize = 0;
      
      for (const file of files) {
        const filePath = path.join(this.options.logDirectory, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffTime) {
          await fs.unlink(filePath);
          deletedFiles++;
          deletedSize += stats.size;
          
          // Limpiar índices relacionados
          this.cleanupIndicesForFile(file);
        }
      }
      
      // Actualizar estadísticas
      this.stats.filesCreated -= deletedFiles;
      this.stats.totalSize -= deletedSize;
      
      logger.info(`Limpieza completada: ${deletedFiles} archivos eliminados, ${this.formatSize(deletedSize)} liberados`);
      
      return {
        deletedFiles,
        deletedSize,
        cutoffTime: cutoffTime.toISOString()
      };
    } catch (error) {
      logger.error('Error limpiando eventos antiguos:', error);
      throw error;
    }
  }
  
  /**
   * Enriquecer evento con metadatos
   */
  enrichEvent(eventData) {
    const now = new Date();
    
    return {
      id: this.generateEventId(),
      timestamp: eventData.timestamp || now.toISOString(),
      eventType: eventData.eventType || 'unknown',
      agentId: eventData.agentId || null,
      correlationId: eventData.correlationId || null,
      level: eventData.level || 'info',
      message: eventData.message || '',
      data: eventData.data || {},
      metadata: {
        source: eventData.source || 'system',
        version: eventData.version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        hostname: process.env.HOSTNAME || 'localhost',
        pid: process.pid,
        ...eventData.metadata
      },
      ...eventData
    };
  }
  
  /**
   * Verificar si se debe registrar el evento
   */
  shouldLogEvent(event) {
    // Verificar lista de exclusión
    if (this.options.excludeEvents.length > 0) {
      if (this.options.excludeEvents.includes(event.eventType)) {
        return false;
      }
    }
    
    // Verificar lista de inclusión
    if (this.options.includeEvents.length > 0) {
      if (!this.options.includeEvents.includes(event.eventType)) {
        return false;
      }
    }
    
    // Verificar nivel de log
    if (this.options.minLevel) {
      const levels = { debug: 0, info: 1, warn: 2, error: 3 };
      const eventLevel = levels[event.level] || 1;
      const minLevel = levels[this.options.minLevel] || 1;
      
      if (eventLevel < minLevel) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Actualizar índices
   */
  updateIndices(event) {
    try {
      // Índice por tipo de evento
      if (event.eventType) {
        if (!this.indices.byEventType.has(event.eventType)) {
          this.indices.byEventType.set(event.eventType, []);
        }
        this.indices.byEventType.get(event.eventType).push(event);
      }
      
      // Índice por agente
      if (event.agentId) {
        if (!this.indices.byAgentId.has(event.agentId)) {
          this.indices.byAgentId.set(event.agentId, []);
        }
        this.indices.byAgentId.get(event.agentId).push(event);
      }
      
      // Índice por correlación
      if (event.correlationId) {
        if (!this.indices.byCorrelationId.has(event.correlationId)) {
          this.indices.byCorrelationId.set(event.correlationId, []);
        }
        this.indices.byCorrelationId.get(event.correlationId).push(event);
      }
      
      // Índice por timestamp (por hora)
      const hour = new Date(event.timestamp).toISOString().substring(0, 13);
      if (!this.indices.byTimestamp.has(hour)) {
        this.indices.byTimestamp.set(hour, []);
      }
      this.indices.byTimestamp.get(hour).push(event);
      
      // Mantener tamaño de índices bajo control
      this.trimIndices();
    } catch (error) {
      logger.error('Error actualizando índices:', error);
    }
  }
  
  /**
   * Recortar índices para mantener memoria bajo control
   */
  trimIndices() {
    const maxIndexSize = 1000;
    
    for (const [key, events] of this.indices.byEventType) {
      if (events.length > maxIndexSize) {
        this.indices.byEventType.set(key, events.slice(-maxIndexSize));
      }
    }
    
    for (const [key, events] of this.indices.byAgentId) {
      if (events.length > maxIndexSize) {
        this.indices.byAgentId.set(key, events.slice(-maxIndexSize));
      }
    }
    
    // Limpiar índices de timestamp antiguos (más de 24 horas)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().substring(0, 13);
    for (const [hour, events] of this.indices.byTimestamp) {
      if (hour < oneDayAgo) {
        this.indices.byTimestamp.delete(hour);
      }
    }
  }
  
  /**
   * Flush del buffer al archivo
   */
  async flushBuffer() {
    if (this.eventBuffer.length === 0) return;
    
    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];
      
      // Escribir eventos al archivo
      await this.writeEventsToFile(events);
      
      this.stats.lastFlush = new Date().toISOString();
      
      logger.debug(`Buffer flushed: ${events.length} eventos escritos`);
    } catch (error) {
      this.stats.errors++;
      logger.error('Error en flush del buffer:', error);
      
      // Restaurar eventos al buffer en caso de error
      this.eventBuffer.unshift(...events);
    }
  }
  
  /**
   * Escribir eventos al archivo
   */
  async writeEventsToFile(events) {
    try {
      // Verificar si necesitamos rotar el archivo
      await this.checkFileRotation();
      
      // Preparar datos para escribir
      const data = events.map(event => JSON.stringify(event)).join('\n') + '\n';
      
      // Escribir al archivo
      await fs.appendFile(this.currentFile, data, 'utf8');
      
      // Actualizar estadísticas
      this.currentFileSize += Buffer.byteLength(data, 'utf8');
      this.stats.totalSize += Buffer.byteLength(data, 'utf8');
    } catch (error) {
      logger.error('Error escribiendo eventos al archivo:', error);
      throw error;
    }
  }
  
  /**
   * Verificar y realizar rotación de archivos
   */
  async checkFileRotation() {
    try {
      const shouldRotate = 
        !this.currentFile ||
        this.currentFileSize >= this.options.maxFileSize ||
        this.shouldRotateByTime();
      
      if (shouldRotate) {
        await this.rotateFile();
      }
    } catch (error) {
      logger.error('Error verificando rotación de archivo:', error);
    }
  }
  
  /**
   * Rotar archivo de log
   */
  async rotateFile() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `events-${timestamp}.log`;
      const filepath = path.join(this.options.logDirectory, filename);
      
      this.currentFile = filepath;
      this.currentFileSize = 0;
      this.stats.filesCreated++;
      this.stats.lastRotation = new Date().toISOString();
      
      logger.debug(`Archivo rotado: ${filename}`);
      
      // Limpiar archivos antiguos si excedemos el límite
      await this.cleanupOldFiles();
    } catch (error) {
      logger.error('Error rotando archivo:', error);
      throw error;
    }
  }
  
  /**
   * Verificar si debe rotar por tiempo
   */
  shouldRotateByTime() {
    if (!this.stats.lastRotation) return true;
    
    const lastRotation = new Date(this.stats.lastRotation);
    const now = new Date();
    
    return (now - lastRotation) >= this.options.rotationInterval;
  }
  
  /**
   * Limpiar archivos antiguos
   */
  async cleanupOldFiles() {
    try {
      const files = await this.getLogFiles();
      
      if (files.length <= this.options.maxFiles) return;
      
      // Ordenar por fecha de modificación
      const filesWithStats = await Promise.all(
        files.map(async file => {
          const filepath = path.join(this.options.logDirectory, file);
          const stats = await fs.stat(filepath);
          return { file, mtime: stats.mtime, size: stats.size };
        })
      );
      
      filesWithStats.sort((a, b) => a.mtime - b.mtime);
      
      // Eliminar archivos más antiguos
      const filesToDelete = filesWithStats.slice(0, filesWithStats.length - this.options.maxFiles);
      
      for (const { file, size } of filesToDelete) {
        const filepath = path.join(this.options.logDirectory, file);
        await fs.unlink(filepath);
        this.stats.totalSize -= size;
        
        logger.debug(`Archivo eliminado: ${file}`);
      }
    } catch (error) {
      logger.error('Error limpiando archivos antiguos:', error);
    }
  }
  
  /**
   * Obtener lista de archivos de log
   */
  async getLogFiles() {
    try {
      const files = await fs.readdir(this.options.logDirectory);
      return files.filter(file => file.endsWith('.log'));
    } catch (error) {
      logger.error('Error obteniendo archivos de log:', error);
      return [];
    }
  }
  
  /**
   * Buscar en archivos
   */
  async searchInFiles(criteria) {
    try {
      const files = await this.getLogFiles();
      const events = [];
      
      for (const file of files) {
        const fileEvents = await this.searchInFile(file, criteria);
        events.push(...fileEvents);
      }
      
      return events;
    } catch (error) {
      logger.error('Error buscando en archivos:', error);
      return [];
    }
  }
  
  /**
   * Buscar en un archivo específico
   */
  async searchInFile(filename, criteria) {
    try {
      const filepath = path.join(this.options.logDirectory, filename);
      
      // Verificar cache
      if (this.fileCache.has(filename)) {
        const cached = this.fileCache.get(filename);
        return this.filterEvents(cached.events, criteria);
      }
      
      // Leer archivo
      const content = await fs.readFile(filepath, 'utf8');
      const lines = content.trim().split('\n');
      const events = [];
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            events.push(event);
          } catch (parseError) {
            // Ignorar líneas malformadas
          }
        }
      }
      
      // Añadir al cache
      this.addToFileCache(filename, events);
      
      return this.filterEvents(events, criteria);
    } catch (error) {
      logger.error(`Error buscando en archivo ${filename}:`, error);
      return [];
    }
  }
  
  /**
   * Filtrar eventos según criterios
   */
  filterEvents(events, criteria) {
    return events.filter(event => {
      // Filtro por tipo de evento
      if (criteria.eventType && event.eventType !== criteria.eventType) {
        return false;
      }
      
      // Filtro por agente
      if (criteria.agentId && event.agentId !== criteria.agentId) {
        return false;
      }
      
      // Filtro por correlación
      if (criteria.correlationId && event.correlationId !== criteria.correlationId) {
        return false;
      }
      
      // Filtro por rango de tiempo
      if (criteria.startTime || criteria.endTime) {
        const eventTime = new Date(event.timestamp);
        
        if (criteria.startTime && eventTime < new Date(criteria.startTime)) {
          return false;
        }
        
        if (criteria.endTime && eventTime > new Date(criteria.endTime)) {
          return false;
        }
      }
      
      // Filtro por nivel
      if (criteria.level && event.level !== criteria.level) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Ordenar eventos
   */
  sortEvents(events, sortBy, sortOrder) {
    return events.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      // Manejar fechas
      if (sortBy === 'timestamp') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }
  
  /**
   * Convertir eventos a CSV
   */
  eventsToCSV(events) {
    if (events.length === 0) return '';
    
    // Obtener todas las columnas
    const columns = new Set();
    events.forEach(event => {
      Object.keys(event).forEach(key => columns.add(key));
    });
    
    const columnArray = Array.from(columns);
    
    // Crear CSV
    const csvLines = [];
    csvLines.push(columnArray.join(','));
    
    events.forEach(event => {
      const row = columnArray.map(col => {
        const value = event[col];
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value || '').replace(/"/g, '""')}"`;
      });
      csvLines.push(row.join(','));
    });
    
    return csvLines.join('\n');
  }
  
  /**
   * Añadir al cache de archivos
   */
  addToFileCache(filename, events) {
    // Mantener tamaño del cache
    if (this.fileCache.size >= this.maxCacheSize) {
      const firstKey = this.fileCache.keys().next().value;
      this.fileCache.delete(firstKey);
    }
    
    this.fileCache.set(filename, {
      events,
      timestamp: Date.now()
    });
  }
  
  /**
   * Limpiar índices para un archivo
   */
  cleanupIndicesForFile(filename) {
    // Esta función se llamaría cuando se elimina un archivo
    // Para mantener los índices sincronizados
    // Implementación simplificada - en producción sería más compleja
  }
  
  /**
   * Generar ID único para evento
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Formatear tamaño de archivo
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
  
  /**
   * Asegurar que existe el directorio de logs
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.options.logDirectory, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * Configurar archivo actual
   */
  async setupCurrentFile() {
    try {
      const files = await this.getLogFiles();
      
      if (files.length > 0) {
        // Usar el archivo más reciente
        const latestFile = files.sort().pop();
        this.currentFile = path.join(this.options.logDirectory, latestFile);
        
        const stats = await fs.stat(this.currentFile);
        this.currentFileSize = stats.size;
      } else {
        // Crear nuevo archivo
        await this.rotateFile();
      }
    } catch (error) {
      logger.error('Error configurando archivo actual:', error);
      await this.rotateFile();
    }
  }
  
  /**
   * Cargar estadísticas
   */
  async loadStats() {
    try {
      const statsFile = path.join(this.options.logDirectory, 'stats.json');
      const content = await fs.readFile(statsFile, 'utf8');
      const savedStats = JSON.parse(content);
      
      this.stats = { ...this.stats, ...savedStats };
    } catch (error) {
      // Archivo no existe o error de lectura - usar estadísticas por defecto
    }
  }
  
  /**
   * Guardar estadísticas
   */
  async saveStats() {
    try {
      const statsFile = path.join(this.options.logDirectory, 'stats.json');
      await fs.writeFile(statsFile, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      logger.error('Error guardando estadísticas:', error);
    }
  }
  
  /**
   * Cargar índices
   */
  async loadIndices() {
    try {
      const indicesFile = path.join(this.options.logDirectory, 'indices.json');
      const content = await fs.readFile(indicesFile, 'utf8');
      const savedIndices = JSON.parse(content);
      
      // Reconstruir Maps
      if (savedIndices.byEventType) {
        this.indices.byEventType = new Map(savedIndices.byEventType);
      }
      if (savedIndices.byAgentId) {
        this.indices.byAgentId = new Map(savedIndices.byAgentId);
      }
      if (savedIndices.byTimestamp) {
        this.indices.byTimestamp = new Map(savedIndices.byTimestamp);
      }
      if (savedIndices.byCorrelationId) {
        this.indices.byCorrelationId = new Map(savedIndices.byCorrelationId);
      }
    } catch (error) {
      // Archivo no existe o error de lectura - usar índices vacíos
    }
  }
  
  /**
   * Guardar índices
   */
  async saveIndices() {
    try {
      const indicesFile = path.join(this.options.logDirectory, 'indices.json');
      const indicesToSave = {
        byEventType: Array.from(this.indices.byEventType.entries()),
        byAgentId: Array.from(this.indices.byAgentId.entries()),
        byTimestamp: Array.from(this.indices.byTimestamp.entries()),
        byCorrelationId: Array.from(this.indices.byCorrelationId.entries())
      };
      
      await fs.writeFile(indicesFile, JSON.stringify(indicesToSave, null, 2));
    } catch (error) {
      logger.error('Error guardando índices:', error);
    }
  }
  
  /**
   * Iniciar timer de flush
   */
  startFlushTimer() {
    this.flushTimer = setInterval(async() => {
      await this.flushBuffer();
    }, this.options.flushInterval);
  }
  
  /**
   * Iniciar timer de rotación
   */
  startRotationTimer() {
    this.rotationTimer = setInterval(async() => {
      await this.checkFileRotation();
    }, this.options.rotationInterval);
  }
  
  /**
   * Detener timers
   */
  stopTimers() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }
  
  /**
   * Obtener estadísticas del logger
   */
  getLoggerStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      bufferSize: this.eventBuffer.length,
      currentFileSize: this.currentFileSize,
      indicesSize: {
        byEventType: this.indices.byEventType.size,
        byAgentId: this.indices.byAgentId.size,
        byTimestamp: this.indices.byTimestamp.size,
        byCorrelationId: this.indices.byCorrelationId.size
      },
      cacheSize: this.fileCache.size
    };
  }
  
  /**
   * Cerrar el logger
   */
  async close() {
    try {
      this.isActive = false;
      
      // Detener timers
      this.stopTimers();
      
      // Flush final del buffer
      await this.flushBuffer();
      
      // Guardar estadísticas e índices
      await this.saveStats();
      await this.saveIndices();
      
      logger.info('EventLogger cerrado correctamente');
    } catch (error) {
      logger.error('Error cerrando EventLogger:', error);
    }
  }
}

// Instancia singleton
let loggerInstance = null;

/**
 * Obtener instancia del logger de eventos
 */
export function getEventLogger(options = {}) {
  if (!loggerInstance) {
    loggerInstance = new EventLogger(options);
  }
  return loggerInstance;
}

export default EventLogger;
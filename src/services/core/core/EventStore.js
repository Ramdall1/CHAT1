import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from './logger.js';

/**
 * Sistema de memoria persistente para eventos
 * Almacena todos los eventos con su payload y estado para auditoría y replay
 */
class EventStore {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    this.logger = createLogger('EVENT_STORE');
    this.storeFilePath = options.storeFilePath || path.join(process.cwd(), 'data', 'event_store.json');
    this.maxEventsInMemory = options.maxEventsInMemory || 10000;
    this.maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB
    this.compressionEnabled = options.compressionEnabled || true;
        
    this.events = new Map(); // Eventos en memoria
    this.eventIndex = new Map(); // Índice por tipo de evento
    this.isActive = false;
    this.saveInterval = null;
    this.saveIntervalMs = options.saveIntervalMs || 30000; // 30 segundos
        
    this.stats = {
      totalEvents: 0,
      eventsInMemory: 0,
      eventsPersisted: 0,
      lastSave: null,
      storageSize: 0
    };
  }

  /**
     * Inicia el almacén de eventos
     */
  async start() {
    if (this.isActive) return;
        
    this.isActive = true;
    logger.info('💾 EventStore: Sistema de memoria persistente iniciado');
        
    // Cargar eventos existentes
    await this.loadEvents();
        
    // Configurar listeners para todos los eventos
    this.setupEventListeners();
        
    // Iniciar guardado automático
    this.saveInterval = setInterval(() => {
      this.saveEvents();
    }, this.saveIntervalMs);
        
    // Emitir evento de inicio
    this.eventBus.emit('system.event_store.started', {
      timestamp: new Date().toISOString(),
      stats: this.getStats()
    });
  }

  /**
     * Detiene el almacén de eventos
     */
  async stop() {
    if (!this.isActive) return;
        
    this.isActive = false;
        
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
        
    // Guardar eventos finales
    await this.saveEvents();
        
    logger.info('💾 EventStore: Sistema de memoria persistente detenido');
        
    this.eventBus.emit('system.event_store.stopped', {
      timestamp: new Date().toISOString(),
      finalStats: this.getStats()
    });
  }

  /**
     * Configura listeners para capturar todos los eventos
     */
  setupEventListeners() {
    // Interceptar el método emit original del EventBus
    const originalEmit = this.eventBus.emit.bind(this.eventBus);
        
    this.eventBus.emit = (eventType, data, options = {}) => {
      // Almacenar el evento antes de emitirlo
      if (this.isActive && eventType && typeof eventType === 'string' && !eventType.startsWith('system.event_store.')) {
        this.storeEvent(eventType, data, options);
      }
            
      // Emitir el evento normalmente
      return originalEmit(eventType, data, options);
    };
  }

  /**
     * Almacena un evento en memoria
     */
  storeEvent(eventType, data, options = {}) {
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();
        
    const eventRecord = {
      id: eventId,
      type: eventType,
      timestamp,
      data: this.sanitizeData(data),
      options,
      status: 'pending',
      processingTime: null,
      retryCount: 0,
      error: null,
      metadata: {
        source: options.source || 'unknown',
        priority: options.priority || 'medium',
        correlationId: options.correlationId || null,
        sessionId: options.sessionId || null
      }
    };

    // Almacenar en memoria
    this.events.set(eventId, eventRecord);
        
    // Actualizar índice por tipo
    if (!this.eventIndex.has(eventType)) {
      this.eventIndex.set(eventType, new Set());
    }
    this.eventIndex.get(eventType).add(eventId);
        
    // Actualizar estadísticas
    this.stats.totalEvents++;
    this.stats.eventsInMemory = this.events.size;
        
    // Verificar límites de memoria
    this.checkMemoryLimits();
        
    return eventId;
  }

  /**
     * Actualiza el estado de un evento
     */
  updateEventStatus(eventId, status, additionalData = {}) {
    const event = this.events.get(eventId);
    if (!event) return false;
        
    event.status = status;
    event.lastUpdated = new Date().toISOString();
        
    // Agregar datos adicionales
    Object.assign(event, additionalData);
        
    return true;
  }

  /**
     * Marca un evento como procesado
     */
  markEventProcessed(eventId, processingTime, result = null) {
    return this.updateEventStatus(eventId, 'processed', {
      processingTime,
      result,
      completedAt: new Date().toISOString()
    });
  }

  /**
     * Marca un evento como fallido
     */
  markEventFailed(eventId, error, retryCount = 0) {
    return this.updateEventStatus(eventId, 'failed', {
      error: error.message || error,
      retryCount,
      failedAt: new Date().toISOString()
    });
  }

  /**
     * Sanitiza los datos del evento para almacenamiento
     */
  sanitizeData(data) {
    if (!data) return null;
        
    try {
      // Crear una copia profunda y remover funciones/objetos circulares
      return JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Error) return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
        return value;
      }));
    } catch (error) {
      return { error: 'Failed to sanitize data', original: String(data) };
    }
  }

  /**
     * Verifica los límites de memoria y archiva eventos antiguos
     */
  async checkMemoryLimits() {
    if (this.events.size <= this.maxEventsInMemory) return;
        
    logger.info('💾 EventStore: Límite de memoria alcanzado, archivando eventos antiguos...');
        
    // Obtener eventos más antiguos
    const eventsArray = Array.from(this.events.entries())
      .sort((a, b) => new Date(a[1].timestamp) - new Date(b[1].timestamp));
        
    const eventsToArchive = eventsArray.slice(0, Math.floor(this.maxEventsInMemory * 0.3));
        
    // Archivar eventos
    await this.archiveEvents(eventsToArchive);
        
    // Remover de memoria
    eventsToArchive.forEach(([eventId, event]) => {
      this.events.delete(eventId);
      this.eventIndex.get(event.type)?.delete(eventId);
    });
        
    this.stats.eventsInMemory = this.events.size;
        
    logger.info(`💾 EventStore: ${eventsToArchive.length} eventos archivados`);
  }

  /**
     * Archiva eventos en archivos separados por fecha
     */
  async archiveEvents(eventsToArchive) {
    const archivesByDate = new Map();
        
    // Agrupar eventos por fecha
    eventsToArchive.forEach(([eventId, event]) => {
      const date = event.timestamp.split('T')[0];
      if (!archivesByDate.has(date)) {
        archivesByDate.set(date, []);
      }
      archivesByDate.get(date).push(event);
    });
        
    // Guardar cada grupo en su archivo correspondiente
    for (const [date, events] of archivesByDate) {
      const archiveDir = path.join(path.dirname(this.storeFilePath), 'archives');
      await fs.mkdir(archiveDir, { recursive: true });
            
      const archiveFile = path.join(archiveDir, `events_${date}.json`);
            
      try {
        // Cargar archivo existente si existe
        let existingEvents = [];
        try {
          const existingData = await fs.readFile(archiveFile, 'utf8');
          existingEvents = JSON.parse(existingData);
        } catch (error) {
          // Archivo no existe, continuar con array vacío
        }
                
        // Agregar nuevos eventos
        existingEvents.push(...events);
                
        // Guardar archivo actualizado
        await fs.writeFile(archiveFile, JSON.stringify(existingEvents, null, 2));
                
      } catch (error) {
        this.logger.error(`❌ EventStore: Error archivando eventos para ${date}:`, error.message);
      }
    }
  }

  /**
     * Carga eventos desde el archivo de almacenamiento
     */
  async loadEvents() {
    try {
      const data = await fs.readFile(this.storeFilePath, 'utf8');
      const storedData = JSON.parse(data);
            
      if (storedData.events) {
        // Cargar eventos en memoria
        Object.entries(storedData.events).forEach(([eventId, event]) => {
          this.events.set(eventId, event);
                    
          // Reconstruir índice
          if (!this.eventIndex.has(event.type)) {
            this.eventIndex.set(event.type, new Set());
          }
          this.eventIndex.get(event.type).add(eventId);
        });
                
        this.stats.eventsInMemory = this.events.size;
        logger.info(`💾 EventStore: ${this.events.size} eventos cargados desde almacenamiento`);
      }
            
      if (storedData.stats) {
        Object.assign(this.stats, storedData.stats);
      }
            
    } catch (error) {
      logger.info('💾 EventStore: No se encontró almacenamiento previo, iniciando desde cero');
    }
  }

  /**
     * Guarda eventos en el archivo de almacenamiento
     */
  async saveEvents() {
    if (!this.isActive) return;
        
    try {
      // Asegurar que el directorio existe
      const storeDir = path.dirname(this.storeFilePath);
      await fs.mkdir(storeDir, { recursive: true });
            
      const storeData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        stats: this.stats,
        events: Object.fromEntries(this.events)
      };
            
      // Verificar tamaño del archivo
      const dataString = JSON.stringify(storeData, null, 2);
      if (dataString.length > this.maxFileSize) {
        logger.warn('⚠️ EventStore: Archivo de almacenamiento excede el tamaño máximo, archivando eventos antiguos...');
        await this.checkMemoryLimits();
        return this.saveEvents(); // Reintentar después del archivado
      }
            
      await fs.writeFile(this.storeFilePath, dataString);
            
      this.stats.lastSave = new Date().toISOString();
      this.stats.eventsPersisted = this.events.size;
      this.stats.storageSize = dataString.length;
            
      logger.info(`💾 EventStore: ${this.events.size} eventos guardados (${Math.round(dataString.length / 1024)}KB)`);
            
    } catch (error) {
      this.logger.error('❌ EventStore: Error guardando eventos:', error.message);
    }
  }

  /**
     * Busca eventos por criterios
     */
  findEvents(criteria = {}) {
    const results = [];
        
    for (const [eventId, event] of this.events) {
      let matches = true;
            
      // Filtrar por tipo
      if (criteria.type && event.type !== criteria.type) {
        matches = false;
      }
            
      // Filtrar por estado
      if (criteria.status && event.status !== criteria.status) {
        matches = false;
      }
            
      // Filtrar por rango de fechas
      if (criteria.fromDate && new Date(event.timestamp) < new Date(criteria.fromDate)) {
        matches = false;
      }
            
      if (criteria.toDate && new Date(event.timestamp) > new Date(criteria.toDate)) {
        matches = false;
      }
            
      // Filtrar por correlationId
      if (criteria.correlationId && event.metadata.correlationId !== criteria.correlationId) {
        matches = false;
      }
            
      if (matches) {
        results.push(event);
      }
    }
        
    // Ordenar por timestamp
    return results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
     * Obtiene eventos por tipo
     */
  getEventsByType(eventType, limit = 100) {
    const eventIds = this.eventIndex.get(eventType);
    if (!eventIds) return [];
        
    const events = Array.from(eventIds)
      .map(id => this.events.get(id))
      .filter(event => event)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
        
    return events;
  }

  /**
     * Obtiene un evento por ID
     */
  getEvent(eventId) {
    return this.events.get(eventId);
  }

  /**
     * Obtiene estadísticas del almacén
     */
  getStats() {
    return {
      ...this.stats,
      eventTypes: this.eventIndex.size,
      memoryUsage: process.memoryUsage(),
      isActive: this.isActive
    };
  }

  /**
     * Obtiene resumen de eventos por estado
     */
  getEventStatusSummary() {
    const summary = {
      pending: 0,
      processed: 0,
      failed: 0,
      other: 0
    };
        
    for (const event of this.events.values()) {
      if (summary.hasOwnProperty(event.status)) {
        summary[event.status]++;
      } else {
        summary.other++;
      }
    }
        
    return summary;
  }

  /**
     * Limpia eventos antiguos basándose en criterios
     */
  async cleanupOldEvents(criteria = {}) {
    const maxAge = criteria.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 días por defecto
    const cutoffDate = new Date(Date.now() - maxAge);
        
    let cleanedCount = 0;
        
    for (const [eventId, event] of this.events) {
      if (new Date(event.timestamp) < cutoffDate) {
        // Archivar antes de eliminar si es necesario
        if (criteria.archive) {
          await this.archiveEvents([[eventId, event]]);
        }
                
        this.events.delete(eventId);
        this.eventIndex.get(event.type)?.delete(eventId);
        cleanedCount++;
      }
    }
        
    this.stats.eventsInMemory = this.events.size;
        
    logger.info(`🧹 EventStore: ${cleanedCount} eventos antiguos limpiados`);
        
    return cleanedCount;
  }
}

export default EventStore;
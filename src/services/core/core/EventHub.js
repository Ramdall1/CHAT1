import { EventEmitter } from 'events';
import { createLogger } from './evolutive-logger.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * EventHub - Núcleo evolutivo de eventos
 * Canal principal de comunicación para arquitectura event-driven
 * Capaz de aprender, adaptarse y auto-optimizarse
 */
class EventHub extends EventEmitter {
  constructor() {
    super();
    this.logger = createLogger('EVENT_HUB');
        
    // Estado del sistema
    this.agents = new Map(); // Agentes registrados
    this.eventHistory = []; // Historial de eventos
    this.eventPatterns = new Map(); // Patrones aprendidos
    this.eventMetrics = new Map(); // Métricas por tipo de evento
    this.adaptiveRules = new Map(); // Reglas adaptativas
        
    // Configuración
    this.maxHistorySize = 10000;
    this.learningEnabled = true;
    this.autoOptimization = true;
    this.persistenceEnabled = true;
        
    // Rutas de almacenamiento
    this.storageDir = path.join(process.cwd(), 'storage');
    this.eventsLogPath = path.join(this.storageDir, 'events_log.json');
    this.patternsPath = path.join(this.storageDir, 'learned_patterns.json');
    this.metricsPath = path.join(this.storageDir, 'event_metrics.json');
        
    // Adaptadores de comunicación
    this.adapters = new Map();
        
    // Configurar límites
    this.setMaxListeners(1000);
        
    // Inicializar sistema
    this.initialize();
        
    this.logger.info('🧠 EventHub evolutivo inicializado');
  }

  /**
     * Inicialización del sistema
     */
  async initialize() {
    try {
      await this.ensureStorageDirectory();
      await this.loadPersistedData();
      this.setupInternalListeners();
      this.startLearningEngine();
      this.startOptimizationEngine();
    } catch (error) {
      this.logger.error('Error inicializando EventHub:', error);
    }
  }

  /**
     * Registrar un agente en el sistema
     */
  registerAgent(agentName, agentInstance, capabilities = []) {
    const agentInfo = {
      name: agentName,
      instance: agentInstance,
      capabilities,
      registeredAt: new Date().toISOString(),
      eventCount: 0,
      lastActivity: null,
      status: 'active'
    };
        
    this.agents.set(agentName, agentInfo);
        
    // Emitir evento de registro
    this.emitEvolutive('system.agent_registered', {
      agentName,
      capabilities,
      timestamp: new Date().toISOString()
    }, { source: 'EventHub', priority: 'medium' });
        
    this.logger.info(`🤖 Agente registrado: ${agentName} con capacidades: ${capabilities.join(', ')}`);
        
    return agentInfo;
  }

  /**
     * Emisión evolutiva de eventos con aprendizaje
     */
  emitEvolutive(eventType, payload = {}, metadata = {}) {
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();
        
    // Crear evento enriquecido
    const enrichedEvent = {
      id: eventId,
      type: eventType,
      payload,
      metadata: {
        ...metadata,
        timestamp,
        source: metadata.source || 'unknown',
        priority: metadata.priority || 'medium',
        correlationId: metadata.correlationId || uuidv4(),
        sequence: this.eventHistory.length + 1
      }
    };

    // Registrar en historial
    this.recordEvent(enrichedEvent);
        
    // Actualizar métricas
    this.updateMetrics(eventType, enrichedEvent);
        
    // Aplicar reglas adaptativas
    this.applyAdaptiveRules(enrichedEvent);
        
    // Emitir evento
    this.emit(eventType, enrichedEvent);
    this.emit('*', enrichedEvent); // Wildcard para observers
        
    // Persistir si está habilitado
    if (this.persistenceEnabled) {
      this.persistEvent(enrichedEvent);
    }
        
    // Aprender patrones
    if (this.learningEnabled) {
      this.learnFromEvent(enrichedEvent);
    }
        
    this.logger.debug(`📡 Evento emitido: ${eventType}`, { eventId, source: metadata.source });
        
    return eventId;
  }

  /**
     * Suscripción evolutiva con capacidades de aprendizaje
     */
  onEvolutive(eventPattern, handler, options = {}) {
    const listenerId = uuidv4();
    const agentName = options.agentName || 'unknown';
        
    // Wrapper del handler para agregar capacidades evolutivas
    const evolutiveHandler = (event) => {
      try {
        // Registrar actividad del agente
        if (this.agents.has(agentName)) {
          const agent = this.agents.get(agentName);
          agent.eventCount++;
          agent.lastActivity = new Date().toISOString();
        }
                
        // Ejecutar handler original
        const result = handler(event);
                
        // Si es una promesa, manejar errores
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            this.emitEvolutive('system.handler_error', {
              eventType: event.type,
              eventId: event.id,
              agentName,
              error: error.message,
              stack: error.stack
            }, { source: 'EventHub', priority: 'high' });
          });
        }
                
        return result;
      } catch (error) {
        this.emitEvolutive('system.handler_error', {
          eventType: event.type,
          eventId: event.id,
          agentName,
          error: error.message,
          stack: error.stack
        }, { source: 'EventHub', priority: 'high' });
      }
    };
        
    // Registrar listener
    this.on(eventPattern, evolutiveHandler);
        
    // Registrar información del listener
    const listenerInfo = {
      id: listenerId,
      pattern: eventPattern,
      agentName,
      registeredAt: new Date().toISOString(),
      options
    };
        
    this.logger.debug(`👂 Listener registrado: ${eventPattern} por ${agentName}`);
        
    return listenerId;
  }

  /**
     * Registrar evento en historial
     */
  recordEvent(event) {
    this.eventHistory.push(event);
        
    // Mantener tamaño del historial
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
     * Actualizar métricas de eventos
     */
  updateMetrics(eventType, event) {
    if (!this.eventMetrics.has(eventType)) {
      this.eventMetrics.set(eventType, {
        count: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        errors: 0,
        lastOccurrence: null,
        frequency: 0
      });
    }
        
    const metrics = this.eventMetrics.get(eventType);
    metrics.count++;
    metrics.lastOccurrence = event.metadata.timestamp;
        
    // Calcular frecuencia (eventos por minuto)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentEvents = this.eventHistory.filter(e => 
      e.type === eventType && 
            new Date(e.metadata.timestamp).getTime() > oneMinuteAgo
    );
    metrics.frequency = recentEvents.length;
  }

  /**
     * Aplicar reglas adaptativas
     */
  applyAdaptiveRules(event) {
    for (const [ruleName, rule] of this.adaptiveRules) {
      try {
        if (rule.condition(event)) {
          rule.action(event, this);
        }
      } catch (error) {
        this.logger.error(`Error aplicando regla ${ruleName}:`, error);
      }
    }
  }

  /**
     * Aprender patrones de eventos
     */
  learnFromEvent(event) {
    const eventType = event.type;
    const category = eventType.split('.')[0];
        
    // Aprender secuencias de eventos
    if (this.eventHistory.length >= 2) {
      const previousEvent = this.eventHistory[this.eventHistory.length - 2];
      const sequence = `${previousEvent.type} -> ${eventType}`;
            
      if (!this.eventPatterns.has(sequence)) {
        this.eventPatterns.set(sequence, {
          count: 0,
          confidence: 0,
          avgTimeBetween: 0,
          category: `${previousEvent.type.split('.')[0]}_to_${category}`
        });
      }
            
      const pattern = this.eventPatterns.get(sequence);
      pattern.count++;
            
      // Calcular tiempo promedio entre eventos
      const timeDiff = new Date(event.metadata.timestamp).getTime() - 
                           new Date(previousEvent.metadata.timestamp).getTime();
      pattern.avgTimeBetween = (pattern.avgTimeBetween + timeDiff) / 2;
            
      // Calcular confianza basada en frecuencia
      pattern.confidence = Math.min(pattern.count / 100, 1);
    }
  }

  /**
     * Motor de optimización automática
     */
  startOptimizationEngine() {
    if (!this.autoOptimization) return;
        
    setInterval(() => {
      this.optimizeSystem();
    }, 30000); // Cada 30 segundos
  }

  /**
     * Optimizar sistema basado en métricas
     */
  optimizeSystem() {
    // Detectar eventos con alta frecuencia
    for (const [eventType, metrics] of this.eventMetrics) {
      if (metrics.frequency > 50) { // Más de 50 eventos por minuto
        this.emitEvolutive('system.high_frequency_detected', {
          eventType,
          frequency: metrics.frequency,
          suggestion: 'Consider batching or throttling'
        }, { source: 'OptimizationEngine', priority: 'medium' });
      }
    }
        
    // Detectar agentes inactivos
    for (const [agentName, agent] of this.agents) {
      if (agent.lastActivity) {
        const inactiveTime = Date.now() - new Date(agent.lastActivity).getTime();
        if (inactiveTime > 300000) { // 5 minutos
          this.emitEvolutive('system.agent_inactive', {
            agentName,
            inactiveTime,
            suggestion: 'Check agent health'
          }, { source: 'OptimizationEngine', priority: 'low' });
        }
      }
    }
  }

  /**
     * Motor de aprendizaje
     */
  startLearningEngine() {
    if (!this.learningEnabled) return;
        
    setInterval(() => {
      this.analyzePatternsAndSuggest();
    }, 60000); // Cada minuto
  }

  /**
     * Analizar patrones y sugerir optimizaciones
     */
  analyzePatternsAndSuggest() {
    // Encontrar patrones más comunes
    const sortedPatterns = Array.from(this.eventPatterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
        
    for (const [sequence, pattern] of sortedPatterns) {
      if (pattern.confidence > 0.8 && pattern.count > 20) {
        this.emitEvolutive('ai.pattern_discovered', {
          sequence,
          confidence: pattern.confidence,
          count: pattern.count,
          avgTimeBetween: pattern.avgTimeBetween,
          suggestion: 'Consider creating a dedicated workflow'
        }, { source: 'LearningEngine', priority: 'low' });
      }
    }
  }

  /**
     * Configurar listeners internos del sistema
     */
  setupInternalListeners() {
    // Listener para errores del sistema
    this.onEvolutive('system.handler_error', (event) => {
      this.logger.error('Error en handler:', event.payload);
    }, { agentName: 'EventHub' });
        
    // Listener para patrones descubiertos
    this.onEvolutive('ai.pattern_discovered', (event) => {
      this.logger.info('Patrón descubierto:', event.payload.sequence);
    }, { agentName: 'EventHub' });
  }

  /**
     * Persistir evento en almacenamiento
     */
  async persistEvent(event) {
    try {
      const logEntry = {
        ...event,
        persistedAt: new Date().toISOString()
      };
            
      // Leer log existente
      let existingLog = [];
      try {
        const data = await fs.readFile(this.eventsLogPath, 'utf8');
        existingLog = JSON.parse(data);
      } catch (error) {
        // Archivo no existe, crear nuevo
      }
            
      // Agregar nuevo evento
      existingLog.push(logEntry);
            
      // Mantener solo los últimos 1000 eventos en el archivo
      if (existingLog.length > 1000) {
        existingLog = existingLog.slice(-1000);
      }
            
      // Escribir de vuelta
      await fs.writeFile(this.eventsLogPath, JSON.stringify(existingLog, null, 2));
    } catch (error) {
      this.logger.error('Error persistiendo evento:', error);
    }
  }

  /**
     * Cargar datos persistidos
     */
  async loadPersistedData() {
    try {
      // Cargar patrones aprendidos
      try {
        const patternsData = await fs.readFile(this.patternsPath, 'utf8');
        const patterns = JSON.parse(patternsData);
        this.eventPatterns = new Map(Object.entries(patterns));
        this.logger.info(`📚 Cargados ${this.eventPatterns.size} patrones aprendidos`);
      } catch (error) {
        // Archivo no existe
      }
            
      // Cargar métricas
      try {
        const metricsData = await fs.readFile(this.metricsPath, 'utf8');
        const metrics = JSON.parse(metricsData);
        this.eventMetrics = new Map(Object.entries(metrics));
        this.logger.info(`📊 Cargadas métricas de ${this.eventMetrics.size} tipos de eventos`);
      } catch (error) {
        // Archivo no existe
      }
    } catch (error) {
      this.logger.error('Error cargando datos persistidos:', error);
    }
  }

  /**
     * Guardar datos aprendidos
     */
  async saveLearnedData() {
    try {
      // Guardar patrones
      const patternsObj = Object.fromEntries(this.eventPatterns);
      await fs.writeFile(this.patternsPath, JSON.stringify(patternsObj, null, 2));
            
      // Guardar métricas
      const metricsObj = Object.fromEntries(this.eventMetrics);
      await fs.writeFile(this.metricsPath, JSON.stringify(metricsObj, null, 2));
            
      this.logger.info('💾 Datos aprendidos guardados');
    } catch (error) {
      this.logger.error('Error guardando datos aprendidos:', error);
    }
  }

  /**
     * Asegurar directorio de almacenamiento
     */
  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      this.logger.error('Error creando directorio de almacenamiento:', error);
    }
  }

  /**
     * Obtener estadísticas del sistema
     */
  getSystemStats() {
    return {
      agents: Array.from(this.agents.values()),
      eventHistory: this.eventHistory.length,
      learnedPatterns: this.eventPatterns.size,
      eventMetrics: Object.fromEntries(this.eventMetrics),
      adapters: Array.from(this.adapters.keys()),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
     * Agregar regla adaptativa
     */
  addAdaptiveRule(name, condition, action) {
    this.adaptiveRules.set(name, { condition, action });
    this.logger.info(`📋 Regla adaptativa agregada: ${name}`);
  }

  /**
     * Agregar adaptador de comunicación
     */
  addAdapter(name, adapter) {
    this.adapters.set(name, adapter);
    this.logger.info(`🔌 Adaptador agregado: ${name}`);
  }

  /**
     * Parada limpia del sistema
     */
  async shutdown() {
    this.logger.info('🛑 Iniciando parada del EventHub...');
        
    // Guardar datos aprendidos
    await this.saveLearnedData();
        
    // Notificar a agentes
    this.emitEvolutive('system.shutdown_initiated', {
      timestamp: new Date().toISOString()
    }, { source: 'EventHub', priority: 'high' });
        
    // Cerrar adaptadores
    for (const [name, adapter] of this.adapters) {
      if (adapter.close) {
        await adapter.close();
      }
    }
        
    this.logger.info('✅ EventHub detenido correctamente');
  }
}

// Crear instancia singleton
const eventHub = new EventHub();

// Manejar cierre limpio
process.on('SIGINT', async() => {
  await eventHub.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async() => {
  await eventHub.shutdown();
  process.exit(0);
});

export default eventHub;
export { EventHub };
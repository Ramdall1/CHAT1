import EventBus from '../../EventBus.js';
import FlowManager from './FlowManager.js';
import EventStore from './EventStore.js';
import EventReplayer from './EventReplayer.js';
import RecoveryManager from './RecoveryManager.js';
import Monitor from './Monitor.js';
import DistributedGateway from './DistributedGateway.js';
import EventsMapper from './EventsMapper.js';
import { createLogger } from './logger.js';

// Agentes especializados
import SalesAgent from './SalesAgent.js';
import SupportAgent from './SupportAgent.js';
import AnalyticsAgent from './AnalyticsAgent.js';
import LearningAgent from './LearningAgent.js';

/**
 * Sistema de Eventos Inteligente
 * Integra todos los componentes para crear una arquitectura Event-Driven autónoma
 */
class IntelligentEventSystem {
  constructor(config = {}) {
    this.config = {
      // Configuración del EventBus
      eventBus: {
        maxListeners: config.maxListeners || 100,
        enableMetrics: config.enableMetrics !== false,
        enableLogging: config.enableLogging !== false,
        ...config.eventBus
      },
            
      // Configuración del FlowManager
      flowManager: {
        analysisInterval: config.flowAnalysisInterval || 60000,
        optimizationThreshold: config.optimizationThreshold || 0.8,
        enableAutoOptimization: config.enableAutoOptimization !== false,
        ...config.flowManager
      },
            
      // Configuración del EventStore
      eventStore: {
        persistToDisk: config.persistToDisk !== false,
        maxMemoryEvents: config.maxMemoryEvents || 10000,
        archiveThreshold: config.archiveThreshold || 50000,
        ...config.eventStore
      },
            
      // Configuración del Monitor
      monitor: {
        enableWebSocket: config.enableWebSocket !== false,
        enableConsoleOutput: config.enableConsoleOutput !== false,
        enableFileLogging: config.enableFileLogging !== false,
        ...config.monitor
      },
            
      // Configuración del RecoveryManager
      recovery: {
        maxRetries: config.maxRetries || 3,
        enableAutoRecovery: config.enableAutoRecovery !== false,
        healthCheckInterval: config.healthCheckInterval || 30000,
        ...config.recovery
      },
            
      // Configuración del DistributedGateway
      distributed: {
        enableDistributed: config.enableDistributed || false,
        nodes: config.distributedNodes || [],
        port: config.distributedPort || 8080,
        ...config.distributed
      },
            
      // Configuración del EventsMapper
      mapper: {
        enableMapping: config.enableMapping !== false,
        enableVisualMap: config.enableVisualMap !== false,
        updateInterval: config.mapUpdateInterval || 30000,
        ...config.mapper
      },
            
      // Configuración de agentes
      agents: {
        enableSales: config.enableSalesAgent !== false,
        enableSupport: config.enableSupportAgent !== false,
        enableAnalytics: config.enableAnalyticsAgent !== false,
        enableLearning: config.enableLearningAgent !== false,
        ...config.agents
      },
            
      // Configuración general
      autoStart: config.autoStart !== false,
      enableAllFeatures: config.enableAllFeatures !== false,
      environment: config.environment || 'development',
      logLevel: config.logLevel || 'info'
    };
        
    // Componentes del sistema
    this.eventBus = null;
    this.flowManager = null;
    this.eventStore = null;
    this.eventReplayer = null;
    this.recoveryManager = null;
    this.monitor = null;
    this.distributedGateway = null;
    this.eventsMapper = null;
        
    // Logger
    this.logger = createLogger('INTELLIGENT_EVENT_SYSTEM');
        
    // Agentes
    this.agents = new Map();
        
    // Estado del sistema
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = null;
        
    // Estadísticas del sistema
    this.systemStats = {
      totalEvents: 0,
      totalAgents: 0,
      uptime: 0,
      lastHealthCheck: null,
      errors: 0,
      optimizations: 0
    };
        
    if (this.config.autoStart) {
      this.initialize();
    }
  }

  /**
     * Inicializa el sistema completo
     */
  async initialize() {
    try {
      logger.info('🚀 Inicializando Sistema de Eventos Inteligente...');
            
      // 1. Inicializar EventBus (núcleo del sistema)
      await this.initializeEventBus();
            
      // 2. Inicializar componentes core
      await this.initializeCoreComponents();
            
      // 3. Inicializar agentes especializados
      await this.initializeAgents();
            
      // 4. Configurar integraciones
      await this.setupIntegrations();
            
      // 5. Iniciar servicios
      await this.startServices();
            
      this.isInitialized = true;
      this.startTime = new Date();
            
      logger.info('✅ Sistema de Eventos Inteligente inicializado correctamente');
            
      // Emitir evento de inicialización
      this.eventBus.emit('system.initialized', {
        timestamp: this.startTime.toISOString(),
        components: this.getComponentsStatus(),
        config: this.sanitizeConfig()
      });
            
    } catch (error) {
      this.logger.error('❌ Error inicializando Sistema de Eventos Inteligente:', error);
      throw error;
    }
  }

  /**
     * Inicializa el EventBus
     */
  async initializeEventBus() {
    this.eventBus = new EventBus(this.config.eventBus);
        
    // Configurar listeners globales del sistema
    this.eventBus.on('system.*', this.handleSystemEvent.bind(this));
    this.eventBus.on('error.*', this.handleErrorEvent.bind(this));
        
    logger.info('📡 EventBus inicializado');
  }

  /**
     * Inicializa componentes core
     */
  async initializeCoreComponents() {
    // FlowManager - Inteligencia de flujo
    if (this.config.enableAllFeatures || this.config.flowManager.enabled !== false) {
      this.flowManager = new FlowManager(this.eventBus, this.config.flowManager);
      await this.flowManager.start();
      logger.info('🧠 FlowManager inicializado');
    }
        
    // EventStore - Memoria persistente
    if (this.config.enableAllFeatures || this.config.eventStore.enabled !== false) {
      this.eventStore = new EventStore(this.eventBus, this.config.eventStore);
      await this.eventStore.start();
      logger.info('💾 EventStore inicializado');
    }
        
    // EventReplayer - Reproducción de eventos
    if (this.eventStore && (this.config.enableAllFeatures || this.config.eventReplayer?.enabled !== false)) {
      this.eventReplayer = new EventReplayer(this.eventBus, this.eventStore, this.config.eventReplayer);
      logger.info('🔄 EventReplayer inicializado');
    }
        
    // RecoveryManager - Tolerancia a fallos
    if (this.config.enableAllFeatures || this.config.recovery.enabled !== false) {
      this.recoveryManager = new RecoveryManager(this.eventBus, this.eventStore, this.eventReplayer);
      await this.recoveryManager.start();
      logger.info('🛡️ RecoveryManager inicializado');
    }
        
    // Monitor - Observabilidad
    if (this.config.enableAllFeatures || this.config.monitor.enabled !== false) {
      this.monitor = new Monitor(this.eventBus, this.config.monitor);
      await this.monitor.start();
      logger.info('📊 Monitor inicializado');
    }
        
    // EventsMapper - Documentación automática
    if (this.config.enableAllFeatures || this.config.mapper.enabled !== false) {
      this.eventsMapper = new EventsMapper(this.eventBus, this.config.mapper);
      logger.info('🗺️ EventsMapper inicializado');
    }
        
    // DistributedGateway - Integración distribuida
    if (this.config.distributed.enableDistributed) {
      this.distributedGateway = new DistributedGateway(this.eventBus, this.config.distributed);
      await this.distributedGateway.start();
      logger.info('🌐 DistributedGateway inicializado');
    }
  }

  /**
     * Inicializa agentes especializados
     */
  async initializeAgents() {
    // SalesAgent
    if (this.config.agents.enableSales) {
      const salesAgent = new SalesAgent(this.eventBus, this.config.agents.sales);
      await salesAgent.start();
      this.agents.set('sales', salesAgent);
      logger.info('💰 SalesAgent inicializado');
    }
        
    // SupportAgent
    if (this.config.agents.enableSupport) {
      const supportAgent = new SupportAgent(this.eventBus, this.config.agents.support);
      await supportAgent.start();
      this.agents.set('support', supportAgent);
      logger.info('🎧 SupportAgent inicializado');
    }
        
    // AnalyticsAgent
    if (this.config.agents.enableAnalytics) {
      const analyticsAgent = new AnalyticsAgent(this.eventBus, this.config.agents.analytics);
      await analyticsAgent.start();
      this.agents.set('analytics', analyticsAgent);
      logger.info('📈 AnalyticsAgent inicializado');
    }
        
    // LearningAgent
    if (this.config.agents.enableLearning) {
      const learningAgent = new LearningAgent(this.eventBus, this.config.agents.learning);
      await learningAgent.start();
      this.agents.set('learning', learningAgent);
      logger.info('🧠 LearningAgent inicializado');
    }
        
    this.systemStats.totalAgents = this.agents.size;
  }

  /**
     * Configura integraciones entre componentes
     */
  async setupIntegrations() {
    // Registrar módulos en el EventsMapper
    if (this.eventsMapper) {
      // Registrar componentes core
      if (this.flowManager) {
        this.eventsMapper.registerModule('FlowManager', {
          type: 'core',
          description: 'Motor de flujo inteligente',
          emits: ['flow.pattern_detected', 'flow.optimization_suggested', 'flow.bottleneck_detected'],
          listens: ['*']
        });
      }
            
      if (this.eventStore) {
        this.eventsMapper.registerModule('EventStore', {
          type: 'core',
          description: 'Almacenamiento persistente de eventos',
          emits: ['store.event_stored', 'store.archive_created', 'store.cleanup_completed'],
          listens: ['*']
        });
      }
            
      if (this.recoveryManager) {
        this.eventsMapper.registerModule('RecoveryManager', {
          type: 'core',
          description: 'Gestión de recuperación y tolerancia a fallos',
          emits: ['recovery.retry_attempted', 'recovery.failure_detected', 'recovery.system_recovered'],
          listens: ['error.*', 'system.health_check']
        });
      }
            
      if (this.monitor) {
        this.eventsMapper.registerModule('Monitor', {
          type: 'monitoring',
          description: 'Monitoreo y observabilidad del sistema',
          emits: ['monitor.alert', 'monitor.report_generated'],
          listens: ['*']
        });
      }
            
      // Registrar agentes
      this.agents.forEach((agent, name) => {
        this.eventsMapper.registerModule(agent.name, {
          type: 'agent',
          description: `Agente especializado: ${name}`,
          emits: agent.getEmittedEvents?.() || [],
          listens: agent.getListenedEvents?.() || []
        });
      });
    }
        
    // Configurar flujo de datos entre componentes
    this.setupDataFlow();
        
    logger.info('🔗 Integraciones configuradas');
  }

  /**
     * Configura el flujo de datos entre componentes
     */
  setupDataFlow() {
    // FlowManager → RecoveryManager (optimizaciones)
    if (this.flowManager && this.recoveryManager) {
      this.eventBus.on('flow.optimization_suggested', (data) => {
        this.recoveryManager.processOptimizationSuggestion(data);
      });
    }
        
    // EventStore → LearningAgent (datos históricos)
    if (this.eventStore && this.agents.has('learning')) {
      this.eventBus.on('store.event_stored', (data) => {
        this.agents.get('learning').processStoredEvent(data);
      });
    }
        
    // Monitor → AnalyticsAgent (métricas)
    if (this.monitor && this.agents.has('analytics')) {
      this.eventBus.on('monitor.metrics_collected', (data) => {
        this.agents.get('analytics').processMetrics(data);
      });
    }
        
    // RecoveryManager → LearningAgent (patrones de error)
    if (this.recoveryManager && this.agents.has('learning')) {
      this.eventBus.on('recovery.failure_pattern_detected', (data) => {
        this.agents.get('learning').analyzeFailurePattern(data);
      });
    }
  }

  /**
     * Inicia todos los servicios
     */
  async startServices() {
    this.isRunning = true;
        
    // Iniciar verificación de salud periódica
    this.startHealthCheck();
        
    // Iniciar recolección de estadísticas
    this.startStatsCollection();
        
    logger.info('🏃 Servicios iniciados');
  }

  /**
     * Inicia verificación de salud del sistema
     */
  startHealthCheck() {
    setInterval(async() => {
      const healthStatus = await this.performHealthCheck();
            
      this.eventBus.emit('system.health_check', {
        status: healthStatus,
        timestamp: new Date().toISOString(),
        uptime: this.getUptime()
      });
            
      this.systemStats.lastHealthCheck = new Date().toISOString();
            
    }, this.config.recovery.healthCheckInterval || 30000);
  }

  /**
     * Realiza verificación de salud
     */
  async performHealthCheck() {
    const health = {
      overall: 'healthy',
      components: {},
      issues: []
    };
        
    // Verificar EventBus
    health.components.eventBus = this.eventBus ? 'healthy' : 'unhealthy';
        
    // Verificar componentes core
    if (this.flowManager) {
      health.components.flowManager = this.flowManager.isRunning ? 'healthy' : 'unhealthy';
    }
        
    if (this.eventStore) {
      health.components.eventStore = this.eventStore.isRunning ? 'healthy' : 'unhealthy';
    }
        
    if (this.recoveryManager) {
      health.components.recoveryManager = this.recoveryManager.isRunning ? 'healthy' : 'unhealthy';
    }
        
    if (this.monitor) {
      health.components.monitor = this.monitor.isRunning ? 'healthy' : 'unhealthy';
    }
        
    // Verificar agentes
    this.agents.forEach((agent, name) => {
      health.components[name] = agent.isRunning ? 'healthy' : 'unhealthy';
    });
        
    // Determinar salud general
    const unhealthyComponents = Object.values(health.components).filter(status => status === 'unhealthy');
        
    if (unhealthyComponents.length > 0) {
      health.overall = unhealthyComponents.length > Object.keys(health.components).length / 2 ? 'critical' : 'degraded';
      health.issues.push(`${unhealthyComponents.length} componentes no saludables`);
    }
        
    return health;
  }

  /**
     * Inicia recolección de estadísticas
     */
  startStatsCollection() {
    setInterval(() => {
      this.updateSystemStats();
    }, 60000); // Cada minuto
  }

  /**
     * Actualiza estadísticas del sistema
     */
  updateSystemStats() {
    this.systemStats.uptime = this.getUptime();
    this.systemStats.totalEvents = this.eventBus?.getStats()?.totalEvents || 0;
        
    // Recopilar estadísticas de componentes
    const componentStats = {};
        
    if (this.flowManager) {
      componentStats.flowManager = this.flowManager.getStats();
    }
        
    if (this.eventStore) {
      componentStats.eventStore = this.eventStore.getStats();
    }
        
    if (this.monitor) {
      componentStats.monitor = this.monitor.getStats();
    }
        
    // Estadísticas de agentes
    this.agents.forEach((agent, name) => {
      componentStats[name] = agent.getStats();
    });
        
    this.eventBus.emit('system.stats_updated', {
      systemStats: this.systemStats,
      componentStats,
      timestamp: new Date().toISOString()
    });
  }

  /**
     * Maneja eventos del sistema
     */
  handleSystemEvent(eventType, data) {
    logger.info(`🔔 Evento del sistema: ${eventType}`);
        
    // Actualizar estadísticas según el tipo de evento
    if (eventType.includes('optimization')) {
      this.systemStats.optimizations++;
    }
  }

  /**
     * Maneja eventos de error
     */
  handleErrorEvent(eventType, data) {
    this.logger.error(`❌ Error del sistema: ${eventType}`, data);
    this.systemStats.errors++;
  }

  /**
     * Detiene el sistema completo
     */
  async shutdown() {
    try {
      logger.info('🛑 Deteniendo Sistema de Eventos Inteligente...');
            
      this.isRunning = false;
            
      // Detener agentes
      for (const [name, agent] of this.agents) {
        await agent.stop();
        logger.info(`🛑 ${name} detenido`);
      }
            
      // Detener componentes core
      if (this.distributedGateway) {
        await this.distributedGateway.stop();
        logger.info('🛑 DistributedGateway detenido');
      }
            
      if (this.eventsMapper) {
        await this.eventsMapper.stop();
        logger.info('🛑 EventsMapper detenido');
      }
            
      if (this.monitor) {
        await this.monitor.stop();
        logger.info('🛑 Monitor detenido');
      }
            
      if (this.recoveryManager) {
        await this.recoveryManager.stop();
        logger.info('🛑 RecoveryManager detenido');
      }
            
      if (this.flowManager) {
        await this.flowManager.stop();
        logger.info('🛑 FlowManager detenido');
      }
            
      if (this.eventStore) {
        await this.eventStore.stop();
        logger.info('🛑 EventStore detenido');
      }
            
      // Emitir evento final
      this.eventBus.emit('system.shutdown', {
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        finalStats: this.systemStats
      });
            
      logger.info('✅ Sistema de Eventos Inteligente detenido correctamente');
            
    } catch (error) {
      this.logger.error('❌ Error deteniendo sistema:', error);
      throw error;
    }
  }

  /**
     * Obtiene el tiempo de actividad
     */
  getUptime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime.getTime();
  }

  /**
     * Obtiene estado de componentes
     */
  getComponentsStatus() {
    return {
      eventBus: !!this.eventBus,
      flowManager: !!this.flowManager,
      eventStore: !!this.eventStore,
      eventReplayer: !!this.eventReplayer,
      recoveryManager: !!this.recoveryManager,
      monitor: !!this.monitor,
      distributedGateway: !!this.distributedGateway,
      eventsMapper: !!this.eventsMapper,
      agents: Array.from(this.agents.keys())
    };
  }

  /**
     * Sanitiza configuración para logging
     */
  sanitizeConfig() {
    const sanitized = { ...this.config };
        
    // Remover información sensible
    delete sanitized.apiKeys;
    delete sanitized.passwords;
    delete sanitized.tokens;
        
    return sanitized;
  }

  /**
     * Obtiene estadísticas completas del sistema
     */
  getSystemStats() {
    return {
      ...this.systemStats,
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      uptime: this.getUptime(),
      components: this.getComponentsStatus()
    };
  }

  /**
     * Obtiene instancia del EventBus
     */
  getEventBus() {
    return this.eventBus;
  }

  /**
     * Obtiene agente específico
     */
  getAgent(name) {
    return this.agents.get(name);
  }

  /**
     * Obtiene componente específico
     */
  getComponent(name) {
    switch (name) {
    case 'flowManager': return this.flowManager;
    case 'eventStore': return this.eventStore;
    case 'eventReplayer': return this.eventReplayer;
    case 'recoveryManager': return this.recoveryManager;
    case 'monitor': return this.monitor;
    case 'distributedGateway': return this.distributedGateway;
    case 'eventsMapper': return this.eventsMapper;
    default: return null;
    }
  }
}

export default IntelligentEventSystem;
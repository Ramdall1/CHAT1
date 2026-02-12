import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './logger.js';

/**
 * Mapeador dinámico de eventos
 * Auto-documenta las conexiones entre módulos y genera mapas visuales
 */
class EventsMapper {
  constructor(eventBus, config = {}) {
    this.eventBus = eventBus;
    this.logger = createLogger('EVENTS_MAPPER');
    this.config = {
      outputPath: config.outputPath || './docs',
      mapFileName: config.mapFileName || 'events_map.json',
      visualMapFileName: config.visualMapFileName || 'events_visual_map.html',
      updateInterval: config.updateInterval || 30000, // 30 segundos
      enableAutoUpdate: config.enableAutoUpdate !== false,
      enableVisualMap: config.enableVisualMap !== false,
      maxHistoryEntries: config.maxHistoryEntries || 1000,
      ...config
    };
        
    // Mapas de eventos
    this.eventsMap = new Map(); // evento -> [listeners]
    this.emittersMap = new Map(); // módulo -> [eventos emitidos]
    this.listenersMap = new Map(); // módulo -> [eventos escuchados]
    this.eventHistory = []; // Historial de eventos para análisis
    this.moduleConnections = new Map(); // conexiones entre módulos
        
    // Estadísticas
    this.stats = {
      totalEvents: 0,
      totalModules: 0,
      totalConnections: 0,
      lastUpdate: null,
      mapGenerations: 0
    };
        
    // Metadatos de eventos
    this.eventMetadata = new Map();
        
    this.updateTimer = null;
    this.isInitialized = false;
        
    this.initializeMapper();
  }

  /**
     * Inicializa el mapeador de eventos
     */
  async initializeMapper() {
    try {
      // Crear directorio de documentación
      await this.ensureDocsDirectory();
            
      // Interceptar eventos del EventBus
      this.interceptEventBus();
            
      // Cargar mapa existente si existe
      await this.loadExistingMap();
            
      // Iniciar actualización automática
      if (this.config.enableAutoUpdate) {
        this.startAutoUpdate();
      }
            
      this.isInitialized = true;
      logger.info('🗺️ EventsMapper: Inicializado correctamente');
            
    } catch (error) {
      this.logger.error('🗺️ EventsMapper: Error en inicialización:', error);
    }
  }

  /**
     * Intercepta el EventBus para capturar eventos
     */
  interceptEventBus() {
    // Interceptar método emit
    const originalEmit = this.eventBus.emit.bind(this.eventBus);
    this.eventBus.emit = (eventType, eventData, metadata = {}) => {
      this.recordEventEmission(eventType, eventData, metadata);
      return originalEmit(eventType, eventData, metadata);
    };
        
    // Interceptar método on
    const originalOn = this.eventBus.on.bind(this.eventBus);
    this.eventBus.on = (eventType, listener, metadata = {}) => {
      this.recordEventListener(eventType, listener, metadata);
      return originalOn(eventType, listener, metadata);
    };
        
    // Interceptar método once
    const originalOnce = this.eventBus.once.bind(this.eventBus);
    this.eventBus.once = (eventType, listener, metadata = {}) => {
      this.recordEventListener(eventType, listener, metadata, { once: true });
      return originalOnce(eventType, listener, metadata);
    };
        
    logger.info('🗺️ EventsMapper: EventBus interceptado para mapeo automático');
  }

  /**
     * Registra emisión de evento
     */
  recordEventEmission(eventType, eventData, metadata) {
    const emitterModule = this.extractModuleName(metadata);
    const timestamp = new Date().toISOString();
        
    // Actualizar mapa de emisores
    if (!this.emittersMap.has(emitterModule)) {
      this.emittersMap.set(emitterModule, new Set());
    }
    this.emittersMap.get(emitterModule).add(eventType);
        
    // Actualizar historial
    this.eventHistory.push({
      type: 'emit',
      eventType,
      module: emitterModule,
      timestamp,
      dataSize: this.calculateDataSize(eventData),
      metadata: this.sanitizeMetadata(metadata)
    });
        
    // Mantener límite de historial
    this.maintainHistoryLimit();
        
    // Actualizar estadísticas
    this.stats.totalEvents++;
        
    // Actualizar metadatos del evento
    this.updateEventMetadata(eventType, {
      lastEmitted: timestamp,
      emitterModule,
      dataStructure: this.analyzeDataStructure(eventData)
    });
  }

  /**
     * Registra listener de evento
     */
  recordEventListener(eventType, listener, metadata, options = {}) {
    const listenerModule = this.extractModuleName(metadata) || this.extractModuleFromFunction(listener);
    const timestamp = new Date().toISOString();
        
    // Actualizar mapa de listeners
    if (!this.listenersMap.has(listenerModule)) {
      this.listenersMap.set(listenerModule, new Set());
    }
    this.listenersMap.get(listenerModule).add(eventType);
        
    // Actualizar mapa de eventos
    if (!this.eventsMap.has(eventType)) {
      this.eventsMap.set(eventType, new Set());
    }
    this.eventsMap.get(eventType).add(listenerModule);
        
    // Actualizar historial
    this.eventHistory.push({
      type: 'listen',
      eventType,
      module: listenerModule,
      timestamp,
      once: options.once || false,
      metadata: this.sanitizeMetadata(metadata)
    });
        
    // Actualizar metadatos del evento
    this.updateEventMetadata(eventType, {
      lastListenerAdded: timestamp,
      listenerModules: Array.from(this.eventsMap.get(eventType))
    });
        
    // Actualizar conexiones entre módulos
    this.updateModuleConnections(eventType);
  }

  /**
     * Registra módulo manualmente
     */
  registerModule(moduleName, config = {}) {
    const moduleInfo = {
      name: moduleName,
      type: config.type || 'unknown',
      description: config.description || '',
      emits: config.emits || [],
      listens: config.listens || [],
      registeredAt: new Date().toISOString(),
      ...config
    };
        
    // Registrar eventos que emite
    if (moduleInfo.emits.length > 0) {
      if (!this.emittersMap.has(moduleName)) {
        this.emittersMap.set(moduleName, new Set());
      }
      moduleInfo.emits.forEach(eventType => {
        this.emittersMap.get(moduleName).add(eventType);
        this.updateEventMetadata(eventType, {
          registeredEmitter: moduleName,
          description: config.eventDescriptions?.[eventType] || ''
        });
      });
    }
        
    // Registrar eventos que escucha
    if (moduleInfo.listens.length > 0) {
      if (!this.listenersMap.has(moduleName)) {
        this.listenersMap.set(moduleName, new Set());
      }
      moduleInfo.listens.forEach(eventType => {
        this.listenersMap.get(moduleName).add(eventType);
        if (!this.eventsMap.has(eventType)) {
          this.eventsMap.set(eventType, new Set());
        }
        this.eventsMap.get(eventType).add(moduleName);
        this.updateEventMetadata(eventType, {
          registeredListener: moduleName
        });
      });
    }
        
    logger.info(`🗺️ EventsMapper: Módulo ${moduleName} registrado manualmente`);
        
    return moduleInfo;
  }

  /**
     * Actualiza conexiones entre módulos
     */
  updateModuleConnections(eventType) {
    const emitters = Array.from(this.emittersMap.entries())
      .filter(([module, events]) => events.has(eventType))
      .map(([module]) => module);
        
    const listeners = Array.from(this.eventsMap.get(eventType) || []);
        
    // Crear conexiones emisor -> listener
    emitters.forEach(emitter => {
      listeners.forEach(listener => {
        if (emitter !== listener) {
          const connectionKey = `${emitter} -> ${listener}`;
                    
          if (!this.moduleConnections.has(connectionKey)) {
            this.moduleConnections.set(connectionKey, {
              from: emitter,
              to: listener,
              events: new Set(),
              strength: 0,
              firstSeen: new Date().toISOString()
            });
          }
                    
          const connection = this.moduleConnections.get(connectionKey);
          connection.events.add(eventType);
          connection.strength = connection.events.size;
          connection.lastSeen = new Date().toISOString();
        }
      });
    });
        
    this.stats.totalConnections = this.moduleConnections.size;
  }

  /**
     * Genera mapa de eventos
     */
  async generateEventsMap() {
    const eventsMap = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        totalEvents: this.eventsMap.size,
        totalModules: new Set([
          ...this.emittersMap.keys(),
          ...this.listenersMap.keys()
        ]).size,
        totalConnections: this.moduleConnections.size
      },
      events: {},
      modules: {},
      connections: {},
      statistics: this.generateStatistics(),
      eventMetadata: Object.fromEntries(this.eventMetadata)
    };
        
    // Mapear eventos a listeners
    for (const [eventType, listeners] of this.eventsMap) {
      eventsMap.events[eventType] = Array.from(listeners);
    }
        
    // Mapear módulos
    const allModules = new Set([
      ...this.emittersMap.keys(),
      ...this.listenersMap.keys()
    ]);
        
    for (const module of allModules) {
      eventsMap.modules[module] = {
        emits: Array.from(this.emittersMap.get(module) || []),
        listens: Array.from(this.listenersMap.get(module) || []),
        type: this.inferModuleType(module),
        connections: this.getModuleConnections(module)
      };
    }
        
    // Mapear conexiones
    for (const [connectionKey, connection] of this.moduleConnections) {
      eventsMap.connections[connectionKey] = {
        from: connection.from,
        to: connection.to,
        events: Array.from(connection.events),
        strength: connection.strength,
        firstSeen: connection.firstSeen,
        lastSeen: connection.lastSeen
      };
    }
        
    this.stats.totalModules = allModules.size;
    this.stats.lastUpdate = new Date().toISOString();
    this.stats.mapGenerations++;
        
    return eventsMap;
  }

  /**
     * Genera mapa visual HTML
     */
  async generateVisualMap(eventsMap) {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mapa Visual de Eventos - Sistema Event-Driven</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        
        .stats {
            display: flex;
            justify-content: space-around;
            margin-top: 20px;
        }
        
        .stat {
            text-align: center;
        }
        
        .stat-number {
            font-size: 2em;
            font-weight: bold;
        }
        
        .content {
            padding: 30px;
        }
        
        .section {
            margin-bottom: 40px;
        }
        
        .section h2 {
            color: #4facfe;
            border-bottom: 2px solid #4facfe;
            padding-bottom: 10px;
        }
        
        #network-graph {
            width: 100%;
            height: 600px;
            border: 1px solid #ddd;
            border-radius: 10px;
            background: #f8f9fa;
        }
        
        .node {
            cursor: pointer;
        }
        
        .node circle {
            stroke: #fff;
            stroke-width: 2px;
        }
        
        .node text {
            font-size: 12px;
            text-anchor: middle;
            fill: #333;
        }
        
        .link {
            stroke: #999;
            stroke-opacity: 0.6;
            stroke-width: 2px;
        }
        
        .tooltip {
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
        }
        
        .events-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .event-card {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            border-left: 4px solid #4facfe;
        }
        
        .event-name {
            font-weight: bold;
            color: #4facfe;
            margin-bottom: 10px;
        }
        
        .listeners {
            font-size: 0.9em;
            color: #666;
        }
        
        .modules-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .module-card {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            border-top: 4px solid #764ba2;
        }
        
        .module-name {
            font-weight: bold;
            color: #764ba2;
            margin-bottom: 15px;
        }
        
        .module-events {
            font-size: 0.9em;
        }
        
        .emits {
            color: #28a745;
            margin-bottom: 10px;
        }
        
        .listens {
            color: #dc3545;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗺️ Mapa Visual de Eventos</h1>
            <div class="stats">
                <div class="stat">
                    <div class="stat-number">${eventsMap.metadata.totalEvents}</div>
                    <div>Eventos</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${eventsMap.metadata.totalModules}</div>
                    <div>Módulos</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${eventsMap.metadata.totalConnections}</div>
                    <div>Conexiones</div>
                </div>
            </div>
            <div style="margin-top: 20px; font-size: 0.9em;">
                Generado: ${new Date(eventsMap.metadata.generatedAt).toLocaleString()}
            </div>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>🌐 Grafo de Conexiones</h2>
                <div id="network-graph"></div>
            </div>
            
            <div class="section">
                <h2>📡 Eventos del Sistema</h2>
                <div class="events-list">
                    ${Object.entries(eventsMap.events).map(([eventType, listeners]) => `
                        <div class="event-card">
                            <div class="event-name">${eventType}</div>
                            <div class="listeners">
                                <strong>Listeners:</strong> ${listeners.join(', ') || 'Ninguno'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="section">
                <h2>🏗️ Módulos del Sistema</h2>
                <div class="modules-grid">
                    ${Object.entries(eventsMap.modules).map(([moduleName, moduleData]) => `
                        <div class="module-card">
                            <div class="module-name">${moduleName}</div>
                            <div class="module-events">
                                <div class="emits">
                                    <strong>Emite:</strong> ${moduleData.emits.join(', ') || 'Ninguno'}
                                </div>
                                <div class="listens">
                                    <strong>Escucha:</strong> ${moduleData.listens.join(', ') || 'Ninguno'}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>
    
    <div class="tooltip" id="tooltip" style="display: none;"></div>
    
    <script>
        // Datos del mapa de eventos
        const eventsData = ${JSON.stringify(eventsMap, null, 2)};
        
        // Crear grafo de red
        function createNetworkGraph() {
            const svg = d3.select("#network-graph")
                .append("svg")
                .attr("width", "100%")
                .attr("height", "100%");
                
            const width = document.getElementById("network-graph").clientWidth;
            const height = 600;
            
            // Preparar datos para D3
            const nodes = Object.keys(eventsData.modules).map(module => ({
                id: module,
                type: eventsData.modules[module].type || 'unknown',
                emits: eventsData.modules[module].emits.length,
                listens: eventsData.modules[module].listens.length
            }));
            
            const links = Object.values(eventsData.connections).map(conn => ({
                source: conn.from,
                target: conn.to,
                strength: conn.strength,
                events: conn.events
            }));
            
            // Configurar simulación
            const simulation = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(links).id(d => d.id).distance(100))
                .force("charge", d3.forceManyBody().strength(-300))
                .force("center", d3.forceCenter(width / 2, height / 2));
            
            // Crear enlaces
            const link = svg.append("g")
                .selectAll("line")
                .data(links)
                .enter().append("line")
                .attr("class", "link")
                .style("stroke-width", d => Math.sqrt(d.strength) * 2);
            
            // Crear nodos
            const node = svg.append("g")
                .selectAll("g")
                .data(nodes)
                .enter().append("g")
                .attr("class", "node")
                .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended));
            
            node.append("circle")
                .attr("r", d => Math.max(10, (d.emits + d.listens) * 2))
                .style("fill", d => {
                    switch(d.type) {
                        case 'agent': return '#4facfe';
                        case 'service': return '#764ba2';
                        case 'core': return '#28a745';
                        default: return '#6c757d';
                    }
                });
            
            node.append("text")
                .attr("dy", 4)
                .text(d => d.id);
            
            // Tooltip
            const tooltip = d3.select("#tooltip");
            
            node.on("mouseover", function(event, d) {
                tooltip.style("display", "block")
                    .html(\`
                        <strong>\${d.id}</strong><br>
                        Tipo: \${d.type}<br>
                        Emite: \${d.emits} eventos<br>
                        Escucha: \${d.listens} eventos
                    \`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("display", "none");
            });
            
            // Actualizar posiciones
            simulation.on("tick", () => {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);
                
                node
                    .attr("transform", d => \`translate(\${d.x},\${d.y})\`);
            });
            
            function dragstarted(event, d) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }
            
            function dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }
            
            function dragended(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }
        }
        
        // Inicializar grafo
        createNetworkGraph();
        
        // Auto-refresh cada 30 segundos
        setInterval(() => {
            location.reload();
        }, 30000);
    </script>
</body>
</html>`;
        
    return html;
  }

  /**
     * Guarda el mapa de eventos
     */
  async saveEventsMap() {
    try {
      const eventsMap = await this.generateEventsMap();
            
      // Guardar mapa JSON
      const mapPath = path.join(this.config.outputPath, this.config.mapFileName);
      await fs.writeFile(mapPath, JSON.stringify(eventsMap, null, 2));
            
      // Generar mapa visual si está habilitado
      if (this.config.enableVisualMap) {
        const visualHtml = await this.generateVisualMap(eventsMap);
        const visualPath = path.join(this.config.outputPath, this.config.visualMapFileName);
        await fs.writeFile(visualPath, visualHtml);
      }
            
      logger.info(`🗺️ EventsMapper: Mapa de eventos guardado (${this.eventsMap.size} eventos, ${this.stats.totalModules} módulos)`);
            
      return eventsMap;
            
    } catch (error) {
      this.logger.error('🗺️ EventsMapper: Error guardando mapa de eventos:', error);
      throw error;
    }
  }

  /**
     * Carga mapa existente
     */
  async loadExistingMap() {
    try {
      const mapPath = path.join(this.config.outputPath, this.config.mapFileName);
            
      try {
        const data = await fs.readFile(mapPath, 'utf8');
        const existingMap = JSON.parse(data);
                
        // Cargar datos existentes
        if (existingMap.events) {
          Object.entries(existingMap.events).forEach(([eventType, listeners]) => {
            this.eventsMap.set(eventType, new Set(listeners));
          });
        }
                
        if (existingMap.eventMetadata) {
          Object.entries(existingMap.eventMetadata).forEach(([eventType, metadata]) => {
            this.eventMetadata.set(eventType, metadata);
          });
        }
                
        logger.info(`🗺️ EventsMapper: Mapa existente cargado (${this.eventsMap.size} eventos)`);
                
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        logger.info('🗺️ EventsMapper: No se encontró mapa existente, iniciando desde cero');
      }
            
    } catch (error) {
      this.logger.error('🗺️ EventsMapper: Error cargando mapa existente:', error);
    }
  }

  /**
     * Inicia actualización automática
     */
  startAutoUpdate() {
    this.updateTimer = setInterval(async() => {
      await this.saveEventsMap();
    }, this.config.updateInterval);
        
    logger.info(`🗺️ EventsMapper: Actualización automática iniciada (cada ${this.config.updateInterval}ms)`);
  }

  /**
     * Detiene el mapeador
     */
  async stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
        
    // Guardar mapa final
    await this.saveEventsMap();
        
    logger.info('🗺️ EventsMapper: Detenido y mapa final guardado');
  }

  /**
     * Asegura que existe el directorio de documentación
     */
  async ensureDocsDirectory() {
    try {
      await fs.mkdir(this.config.outputPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
     * Extrae nombre del módulo desde metadatos
     */
  extractModuleName(metadata) {
    return metadata?.module || 
               metadata?.source || 
               metadata?.emitter || 
               'unknown';
  }

  /**
     * Extrae módulo desde función
     */
  extractModuleFromFunction(func) {
    if (func.name) {
      return func.name;
    }
        
    // Intentar extraer desde stack trace
    const stack = new Error().stack;
    const match = stack.match(/at\s+(\w+)/);
        
    return match ? match[1] : 'anonymous';
  }

  /**
     * Calcula tamaño de datos
     */
  calculateDataSize(data) {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
     * Sanitiza metadatos
     */
  sanitizeMetadata(metadata) {
    const sanitized = { ...metadata };
        
    // Remover información sensible
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
        
    return sanitized;
  }

  /**
     * Analiza estructura de datos
     */
  analyzeDataStructure(data) {
    if (!data || typeof data !== 'object') {
      return typeof data;
    }
        
    const structure = {};
        
    Object.keys(data).forEach(key => {
      const value = data[key];
      structure[key] = Array.isArray(value) ? 'array' : typeof value;
    });
        
    return structure;
  }

  /**
     * Actualiza metadatos de evento
     */
  updateEventMetadata(eventType, newMetadata) {
    const existing = this.eventMetadata.get(eventType) || {};
    this.eventMetadata.set(eventType, { ...existing, ...newMetadata });
  }

  /**
     * Mantiene límite de historial
     */
  maintainHistoryLimit() {
    if (this.eventHistory.length > this.config.maxHistoryEntries) {
      this.eventHistory = this.eventHistory.slice(-this.config.maxHistoryEntries);
    }
  }

  /**
     * Infiere tipo de módulo
     */
  inferModuleType(moduleName) {
    const name = moduleName.toLowerCase();
        
    if (name.includes('agent')) return 'agent';
    if (name.includes('service')) return 'service';
    if (name.includes('manager')) return 'core';
    if (name.includes('gateway')) return 'gateway';
    if (name.includes('monitor')) return 'monitoring';
        
    return 'unknown';
  }

  /**
     * Obtiene conexiones de módulo
     */
  getModuleConnections(moduleName) {
    const connections = {
      incoming: [],
      outgoing: []
    };
        
    for (const [connectionKey, connection] of this.moduleConnections) {
      if (connection.to === moduleName) {
        connections.incoming.push(connection.from);
      }
      if (connection.from === moduleName) {
        connections.outgoing.push(connection.to);
      }
    }
        
    return connections;
  }

  /**
     * Genera estadísticas
     */
  generateStatistics() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
        
    const recentEvents = this.eventHistory.filter(event => 
      new Date(event.timestamp) > oneHourAgo
    );
        
    return {
      ...this.stats,
      recentActivity: {
        eventsLastHour: recentEvents.length,
        emissionsLastHour: recentEvents.filter(e => e.type === 'emit').length,
        listenersLastHour: recentEvents.filter(e => e.type === 'listen').length
      },
      topEvents: this.getTopEvents(),
      topModules: this.getTopModules()
    };
  }

  /**
     * Obtiene eventos más frecuentes
     */
  getTopEvents() {
    const eventCounts = new Map();
        
    this.eventHistory.forEach(event => {
      if (event.type === 'emit') {
        eventCounts.set(event.eventType, (eventCounts.get(event.eventType) || 0) + 1);
      }
    });
        
    return Array.from(eventCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([eventType, count]) => ({ eventType, count }));
  }

  /**
     * Obtiene módulos más activos
     */
  getTopModules() {
    const moduleCounts = new Map();
        
    this.eventHistory.forEach(event => {
      moduleCounts.set(event.module, (moduleCounts.get(event.module) || 0) + 1);
    });
        
    return Array.from(moduleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([module, count]) => ({ module, count }));
  }

  /**
     * Obtiene estadísticas del mapeador
     */
  getStats() {
    return {
      ...this.stats,
      isInitialized: this.isInitialized,
      eventsTracked: this.eventsMap.size,
      modulesTracked: new Set([
        ...this.emittersMap.keys(),
        ...this.listenersMap.keys()
      ]).size,
      historySize: this.eventHistory.length
    };
  }

  /**
     * Obtiene mapa actual
     */
  getCurrentMap() {
    return this.generateEventsMap();
  }
}

export default EventsMapper;
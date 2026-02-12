import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dashboard web para debugging y monitoreo
 * Proporciona una interfaz web en tiempo real para visualizar métricas y logs
 */
class DebugDashboard {
  constructor(options = {}) {
    this.config = {
      enabled: process.env.DEBUG_DASHBOARD_ENABLED !== 'false',
      port: parseInt(process.env.DEBUG_DASHBOARD_PORT) || 3001,
      host: process.env.DEBUG_DASHBOARD_HOST || 'localhost',
      updateInterval: parseInt(process.env.DEBUG_UPDATE_INTERVAL) || 5000,
      maxLogEntries: parseInt(process.env.DEBUG_MAX_LOG_ENTRIES) || 1000,
      enableAuth: process.env.DEBUG_DASHBOARD_AUTH === 'true',
      authToken: process.env.DEBUG_DASHBOARD_TOKEN || 'debug-token-123',
      ...options
    };

    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.monitors = new Map();
    this.logBuffer = [];
    this.metrics = {
      requests: [],
      errors: [],
      performance: [],
      system: {},
      alerts: []
    };

    this.isRunning = false;
    this.connectedClients = new Set();
        
    this.initialize();
  }

  /**
     * Inicializar el dashboard
     */
  async initialize() {
    if (!this.config.enabled) {
      logger.info('📊 Debug Dashboard deshabilitado');
      return;
    }

    try {
      this.setupRoutes();
      this.setupSocketHandlers();
      this.setupMiddleware();
            
      logger.info('📊 Debug Dashboard inicializado');
    } catch (error) {
      logger.error('❌ Error inicializando Debug Dashboard:', error);
    }
  }

  /**
     * Configurar rutas del dashboard
     */
  setupRoutes() {
    // Middleware de autenticación
    if (this.config.enableAuth) {
      this.app.use((req, res, next) => {
        const token = req.headers.authorization || req.query.token;
        if (token !== this.config.authToken) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
      });
    }

    // Servir archivos estáticos
    this.app.use(express.static(path.join(__dirname, '../public/debug')));
    this.app.use(express.json());

    // Ruta principal del dashboard
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    // API para obtener métricas
    this.app.get('/api/metrics', (req, res) => {
      res.json(this.getMetricsSnapshot());
    });

    // API para obtener logs
    this.app.get('/api/logs', (req, res) => {
      const limit = parseInt(req.query.limit) || 100;
      const level = req.query.level;
            
      let logs = this.logBuffer.slice(-limit);
            
      if (level) {
        logs = logs.filter(log => log.level === level);
      }
            
      res.json(logs);
    });

    // API para obtener estado del sistema
    this.app.get('/api/system', (req, res) => {
      res.json(this.getSystemInfo());
    });

    // API para obtener alertas
    this.app.get('/api/alerts', (req, res) => {
      res.json(this.metrics.alerts);
    });

    // API para limpiar logs
    this.app.post('/api/logs/clear', (req, res) => {
      this.logBuffer = [];
      this.broadcastUpdate('logs.cleared');
      res.json({ success: true });
    });

    // API para configuración
    this.app.get('/api/config', (req, res) => {
      res.json({
        updateInterval: this.config.updateInterval,
        maxLogEntries: this.config.maxLogEntries,
        enableAuth: this.config.enableAuth
      });
    });
  }

  /**
     * Configurar manejadores de Socket.IO
     */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`📊 [DASHBOARD] Cliente conectado: ${socket.id}`);
      this.connectedClients.add(socket.id);

      // Enviar datos iniciales
      socket.emit('initial.data', {
        metrics: this.getMetricsSnapshot(),
        logs: this.logBuffer.slice(-50),
        system: this.getSystemInfo(),
        alerts: this.metrics.alerts
      });

      // Manejar suscripciones
      socket.on('subscribe', (channels) => {
        if (Array.isArray(channels)) {
          channels.forEach(channel => socket.join(channel));
        }
      });

      // Manejar desconexión
      socket.on('disconnect', () => {
        logger.info(`📊 [DASHBOARD] Cliente desconectado: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // Manejar comandos
      socket.on('command', (data) => {
        this.handleCommand(socket, data);
      });
    });
  }

  /**
     * Configurar middleware
     */
  setupMiddleware() {
    // Middleware para capturar requests
    this.app.use((req, res, next) => {
      const startTime = Date.now();
            
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.addRequestMetric({
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          timestamp: Date.now()
        });
      });
            
      next();
    });
  }

  /**
     * Registrar monitor
     */
  registerMonitor(name, monitor) {
    this.monitors.set(name, monitor);
        
    // Configurar listeners para el monitor
    if (monitor.on) {
      monitor.on('debug.point', (data) => {
        this.addLogEntry('debug', `Debug point: ${data.label}`, data);
      });
            
      monitor.on('error.tracked', (data) => {
        this.addErrorMetric(data);
        this.addLogEntry('error', `Error tracked: ${data.message}`, data);
      });
            
      monitor.on('performance.slow', (data) => {
        this.addPerformanceMetric(data);
        this.addLogEntry('warn', `Slow operation: ${data.name}`, data);
      });
            
      monitor.on('health.alert.new', (data) => {
        this.addAlert(data);
        this.addLogEntry('warn', `Health alert: ${data.name}`, data);
      });
    }
        
    logger.info(`📊 [DASHBOARD] Monitor registrado: ${name}`);
  }

  /**
     * Añadir entrada de log
     */
  addLogEntry(level, message, data = {}) {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      source: data.source || 'system'
    };

    this.logBuffer.push(logEntry);
        
    // Mantener buffer limitado
    if (this.logBuffer.length > this.config.maxLogEntries) {
      this.logBuffer.shift();
    }

    // Broadcast a clientes conectados
    this.broadcastUpdate('log.new', logEntry);
  }

  /**
     * Añadir métrica de request
     */
  addRequestMetric(metric) {
    this.metrics.requests.push(metric);
        
    // Mantener solo las últimas 1000 métricas
    if (this.metrics.requests.length > 1000) {
      this.metrics.requests.shift();
    }

    this.broadcastUpdate('metric.request', metric);
  }

  /**
     * Añadir métrica de error
     */
  addErrorMetric(error) {
    const errorMetric = {
      timestamp: Date.now(),
      message: error.message,
      context: error.context,
      stack: error.stack
    };

    this.metrics.errors.push(errorMetric);
        
    if (this.metrics.errors.length > 500) {
      this.metrics.errors.shift();
    }

    this.broadcastUpdate('metric.error', errorMetric);
  }

  /**
     * Añadir métrica de performance
     */
  addPerformanceMetric(performance) {
    this.metrics.performance.push({
      timestamp: Date.now(),
      ...performance
    });
        
    if (this.metrics.performance.length > 500) {
      this.metrics.performance.shift();
    }

    this.broadcastUpdate('metric.performance', performance);
  }

  /**
     * Añadir alerta
     */
  addAlert(alert) {
    const alertData = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      ...alert
    };

    this.metrics.alerts.push(alertData);
    this.broadcastUpdate('alert.new', alertData);
  }

  /**
     * Obtener snapshot de métricas
     */
  getMetricsSnapshot() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    return {
      timestamp: now,
      requests: {
        total: this.metrics.requests.length,
        recent: this.metrics.requests.filter(r => r.timestamp > oneHourAgo).length,
        avgResponseTime: this.calculateAverageResponseTime(),
        statusCodes: this.getStatusCodeDistribution()
      },
      errors: {
        total: this.metrics.errors.length,
        recent: this.metrics.errors.filter(e => e.timestamp > oneHourAgo).length,
        rate: this.calculateErrorRate()
      },
      performance: {
        slowOperations: this.metrics.performance.filter(p => p.duration > 1000).length,
        avgDuration: this.calculateAveragePerformance()
      },
      system: this.metrics.system,
      alerts: {
        active: this.metrics.alerts.filter(a => !a.resolved).length,
        total: this.metrics.alerts.length
      }
    };
  }

  /**
     * Obtener información del sistema
     */
  getSystemInfo() {
    const memoryUsage = process.memoryUsage();
        
    return {
      timestamp: Date.now(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      cpu: process.cpuUsage(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length,
      connectedClients: this.connectedClients.size
    };
  }

  /**
     * Calcular tiempo de respuesta promedio
     */
  calculateAverageResponseTime() {
    if (this.metrics.requests.length === 0) return 0;
        
    const total = this.metrics.requests.reduce((sum, req) => sum + req.duration, 0);
    return Math.round(total / this.metrics.requests.length);
  }

  /**
     * Obtener distribución de códigos de estado
     */
  getStatusCodeDistribution() {
    const distribution = {};
        
    this.metrics.requests.forEach(req => {
      const code = req.statusCode;
      distribution[code] = (distribution[code] || 0) + 1;
    });
        
    return distribution;
  }

  /**
     * Calcular tasa de errores
     */
  calculateErrorRate() {
    if (this.metrics.requests.length === 0) return 0;
        
    const errorRequests = this.metrics.requests.filter(req => req.statusCode >= 400).length;
    return (errorRequests / this.metrics.requests.length) * 100;
  }

  /**
     * Calcular performance promedio
     */
  calculateAveragePerformance() {
    if (this.metrics.performance.length === 0) return 0;
        
    const total = this.metrics.performance.reduce((sum, perf) => sum + perf.duration, 0);
    return Math.round(total / this.metrics.performance.length);
  }

  /**
     * Manejar comandos del cliente
     */
  handleCommand(socket, data) {
    const { command, params } = data;
        
    switch (command) {
    case 'clear.logs':
      this.logBuffer = [];
      this.broadcastUpdate('logs.cleared');
      break;
                
    case 'clear.metrics':
      this.metrics.requests = [];
      this.metrics.errors = [];
      this.metrics.performance = [];
      this.broadcastUpdate('metrics.cleared');
      break;
                
    case 'resolve.alert':
      const alertId = params.alertId;
      const alert = this.metrics.alerts.find(a => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        alert.resolvedAt = Date.now();
        this.broadcastUpdate('alert.resolved', alert);
      }
      break;
                
    case 'get.monitor.data':
      const monitorName = params.monitor;
      const monitor = this.monitors.get(monitorName);
      if (monitor && monitor.getMetricsSummary) {
        socket.emit('monitor.data', {
          monitor: monitorName,
          data: monitor.getMetricsSummary()
        });
      }
      break;
    }
  }

  /**
     * Broadcast de actualizaciones a clientes
     */
  broadcastUpdate(event, data) {
    this.io.emit(event, data);
  }

  /**
     * Generar HTML del dashboard
     */
  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug Dashboard</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #1a1a1a; 
            color: #e0e0e0; 
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { 
            background: #2d2d2d; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .header h1 { color: #4CAF50; margin-bottom: 10px; }
        .status { display: flex; gap: 20px; flex-wrap: wrap; }
        .status-item { 
            background: #333; 
            padding: 15px; 
            border-radius: 6px; 
            min-width: 150px;
            border-left: 4px solid #4CAF50;
        }
        .status-item.warning { border-left-color: #FF9800; }
        .status-item.error { border-left-color: #f44336; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
        .panel { 
            background: #2d2d2d; 
            border-radius: 8px; 
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .panel h3 { 
            color: #4CAF50; 
            margin-bottom: 15px; 
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 5px;
        }
        .log-entry { 
            padding: 8px; 
            margin: 5px 0; 
            border-radius: 4px; 
            font-family: monospace;
            font-size: 12px;
            border-left: 3px solid #666;
        }
        .log-entry.error { background: #4a1a1a; border-left-color: #f44336; }
        .log-entry.warn { background: #4a3a1a; border-left-color: #FF9800; }
        .log-entry.info { background: #1a3a4a; border-left-color: #2196F3; }
        .log-entry.debug { background: #2a1a4a; border-left-color: #9C27B0; }
        .metric { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px 0; 
            border-bottom: 1px solid #444;
        }
        .metric:last-child { border-bottom: none; }
        .metric-value { 
            font-weight: bold; 
            color: #4CAF50; 
        }
        .metric-value.warning { color: #FF9800; }
        .metric-value.error { color: #f44336; }
        .controls { 
            margin-bottom: 15px; 
            display: flex; 
            gap: 10px; 
            flex-wrap: wrap;
        }
        .btn { 
            background: #4CAF50; 
            color: white; 
            border: none; 
            padding: 8px 16px; 
            border-radius: 4px; 
            cursor: pointer;
            font-size: 12px;
        }
        .btn:hover { background: #45a049; }
        .btn.danger { background: #f44336; }
        .btn.danger:hover { background: #da190b; }
        .logs-container { 
            max-height: 400px; 
            overflow-y: auto; 
            background: #1a1a1a;
            border-radius: 4px;
            padding: 10px;
        }
        .timestamp { 
            color: #888; 
            font-size: 10px; 
        }
        .alert { 
            background: #4a1a1a; 
            border: 1px solid #f44336; 
            border-radius: 4px; 
            padding: 10px; 
            margin: 5px 0;
        }
        .alert.warning { 
            background: #4a3a1a; 
            border-color: #FF9800; 
        }
        .chart-placeholder {
            height: 200px;
            background: #1a1a1a;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Debug Dashboard</h1>
            <div class="status" id="status">
                <div class="status-item">
                    <div>Estado del Sistema</div>
                    <div id="system-status">Cargando...</div>
                </div>
                <div class="status-item">
                    <div>Clientes Conectados</div>
                    <div id="connected-clients">0</div>
                </div>
                <div class="status-item">
                    <div>Uptime</div>
                    <div id="uptime">0s</div>
                </div>
                <div class="status-item">
                    <div>Memoria</div>
                    <div id="memory-usage">0%</div>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="panel">
                <h3>📊 Métricas en Tiempo Real</h3>
                <div id="metrics">
                    <div class="metric">
                        <span>Requests Totales</span>
                        <span class="metric-value" id="total-requests">0</span>
                    </div>
                    <div class="metric">
                        <span>Errores Totales</span>
                        <span class="metric-value" id="total-errors">0</span>
                    </div>
                    <div class="metric">
                        <span>Tiempo Respuesta Promedio</span>
                        <span class="metric-value" id="avg-response">0ms</span>
                    </div>
                    <div class="metric">
                        <span>Tasa de Errores</span>
                        <span class="metric-value" id="error-rate">0%</span>
                    </div>
                    <div class="metric">
                        <span>Operaciones Lentas</span>
                        <span class="metric-value" id="slow-ops">0</span>
                    </div>
                </div>
            </div>

            <div class="panel">
                <h3>🚨 Alertas Activas</h3>
                <div id="alerts">
                    <p style="color: #666; font-style: italic;">No hay alertas activas</p>
                </div>
            </div>

            <div class="panel">
                <h3>📈 Gráfico de Performance</h3>
                <div class="chart-placeholder">
                    Gráfico de performance en tiempo real
                </div>
            </div>

            <div class="panel">
                <h3>📋 Logs del Sistema</h3>
                <div class="controls">
                    <button class="btn" onclick="clearLogs()">Limpiar Logs</button>
                    <button class="btn" onclick="toggleAutoScroll()">Auto Scroll</button>
                    <select id="log-level" onchange="filterLogs()">
                        <option value="">Todos los niveles</option>
                        <option value="error">Error</option>
                        <option value="warn">Warning</option>
                        <option value="info">Info</option>
                        <option value="debug">Debug</option>
                    </select>
                </div>
                <div class="logs-container" id="logs">
                    <p style="color: #666; font-style: italic;">Conectando...</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        let autoScroll = true;
        let logs = [];

        // Conectar al servidor
        socket.on('connect', () => {
            logger.info('Conectado al dashboard');
            socket.emit('subscribe', ['logs', 'metrics', 'alerts', 'system']);
        });

        // Recibir datos iniciales
        socket.on('initial.data', (data) => {
            updateMetrics(data.metrics);
            updateSystemInfo(data.system);
            updateAlerts(data.alerts);
            logs = data.logs || [];
            renderLogs();
        });

        // Actualizar métricas
        socket.on('metric.request', updateMetricsFromSocket);
        socket.on('metric.error', updateMetricsFromSocket);
        socket.on('metric.performance', updateMetricsFromSocket);

        // Nuevos logs
        socket.on('log.new', (logEntry) => {
            logs.push(logEntry);
            if (logs.length > 1000) logs.shift();
            renderLogs();
        });

        // Nuevas alertas
        socket.on('alert.new', (alert) => {
            addAlert(alert);
        });

        // Logs limpiados
        socket.on('logs.cleared', () => {
            logs = [];
            renderLogs();
        });

        function updateMetrics(metrics) {
            if (!metrics) return;
            
            document.getElementById('total-requests').textContent = metrics.requests?.total || 0;
            document.getElementById('total-errors').textContent = metrics.errors?.total || 0;
            document.getElementById('avg-response').textContent = (metrics.requests?.avgResponseTime || 0) + 'ms';
            document.getElementById('error-rate').textContent = (metrics.errors?.rate || 0).toFixed(1) + '%';
            document.getElementById('slow-ops').textContent = metrics.performance?.slowOperations || 0;
        }

        function updateSystemInfo(system) {
            if (!system) return;
            
            document.getElementById('connected-clients').textContent = system.connectedClients || 0;
            document.getElementById('uptime').textContent = formatUptime(system.process?.uptime || 0);
            document.getElementById('memory-usage').textContent = (system.memory?.percentage || 0).toFixed(1) + '%';
        }

        function updateAlerts(alerts) {
            const alertsContainer = document.getElementById('alerts');
            if (!alerts || alerts.length === 0) {
                alertsContainer.innerHTML = '<p style="color: #666; font-style: italic;">No hay alertas activas</p>';
                return;
            }

            alertsContainer.innerHTML = alerts.map(alert => 
                \`<div class="alert \${alert.status}">
                    <strong>\${alert.name}</strong>: \${alert.status}
                    <div class="timestamp">\${new Date(alert.timestamp).toLocaleString()}</div>
                </div>\`
            ).join('');
        }

        function renderLogs() {
            const logsContainer = document.getElementById('logs');
            const levelFilter = document.getElementById('log-level')?.value;
            
            let filteredLogs = logs;
            if (levelFilter) {
                filteredLogs = logs.filter(log => log.level === levelFilter);
            }

            logsContainer.innerHTML = filteredLogs.slice(-100).map(log => 
                \`<div class="log-entry \${log.level}">
                    <span class="timestamp">\${new Date(log.timestamp).toLocaleTimeString()}</span>
                    [\${log.level.toUpperCase()}] \${log.message}
                </div>\`
            ).join('');

            if (autoScroll) {
                logsContainer.scrollTop = logsContainer.scrollHeight;
            }
        }

        function addAlert(alert) {
            // Actualizar contador de alertas y mostrar nueva alerta
            updateMetricsFromSocket();
        }

        function updateMetricsFromSocket() {
            // Solicitar métricas actualizadas
            fetch('/api/metrics')
                .then(response => response.json())
                .then(updateMetrics)
                .catch(console.error);
        }

        function clearLogs() {
            fetch('/api/logs/clear', { method: 'POST' })
                .then(response => response.json())
                .then(() => {
                    logs = [];
                    renderLogs();
                })
                .catch(console.error);
        }

        function toggleAutoScroll() {
            autoScroll = !autoScroll;
            const btn = event.target;
            btn.textContent = autoScroll ? 'Auto Scroll' : 'Manual Scroll';
            btn.style.background = autoScroll ? '#4CAF50' : '#666';
        }

        function filterLogs() {
            renderLogs();
        }

        function formatUptime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return \`\${hours}h \${minutes}m \${secs}s\`;
        }

        // Actualizar métricas del sistema cada 5 segundos
        setInterval(() => {
            fetch('/api/system')
                .then(response => response.json())
                .then(updateSystemInfo)
                .catch(console.error);
        }, 5000);
    </script>
</body>
</html>`;
  }

  /**
     * Iniciar el servidor del dashboard
     */
  async start() {
    if (!this.config.enabled || this.isRunning) return;

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, (error) => {
        if (error) {
          logger.error('❌ Error iniciando Debug Dashboard:', error);
          reject(error);
          return;
        }

        this.isRunning = true;
        logger.info(`📊 Debug Dashboard iniciado en http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
     * Detener el servidor del dashboard
     */
  async stop() {
    if (!this.isRunning) return;

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        logger.info('📊 Debug Dashboard detenido');
        resolve();
      });
    });
  }

  /**
     * Obtener URL del dashboard
     */
  getURL() {
    if (!this.isRunning) return null;
    return `http://${this.config.host}:${this.config.port}`;
  }
}

export default DebugDashboard;
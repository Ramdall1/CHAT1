/**
 * Middleware de Métricas
 * Integra el sistema de monitoreo en todas las rutas
 */

class MetricsMiddleware {
  constructor(metricsManager) {
    this.metricsManager = metricsManager;
  }
    
  // Middleware principal para tracking de requests
  trackRequest() {
    return (req, res, next) => {
      const startTime = Date.now();
            
      // Agregar ID único al request
      req.requestId = this.generateRequestId();
            
      // Interceptar el final de la respuesta
      const originalSend = res.send;
      const originalJson = res.json;
            
      res.send = function(data) {
        const responseTime = Date.now() - startTime;
                
        // Registrar métricas
        this.metricsManager.recordRequest(
          req.method,
          this.sanitizeEndpoint(req.route?.path || req.path),
          res.statusCode,
          responseTime,
          req.user?.id
        );
                
        return originalSend.call(this, data);
      }.bind(this);
            
      res.json = function(data) {
        const responseTime = Date.now() - startTime;
                
        // Registrar métricas
        this.metricsManager.recordRequest(
          req.method,
          this.sanitizeEndpoint(req.route?.path || req.path),
          res.statusCode,
          responseTime,
          req.user?.id
        );
                
        return originalJson.call(this, data);
      }.bind(this);
            
      next();
    };
  }
    
  // Middleware para tracking de base de datos
  trackDatabase() {
    return (req, res, next) => {
      if (req.database) {
        const sqliteManager = req.database.getManager();
        // Interceptar métodos de base de datos
        const originalRun = sqliteManager.run;
        const originalGet = sqliteManager.get;
        const originalAll = sqliteManager.all;
                
        sqliteManager.run = async function(query, params) {
          const startTime = Date.now();
          try {
            const result = await originalRun.call(this, query, params);
            this.metricsManager.recordDatabaseQuery(query, Date.now() - startTime, true);
            return result;
          } catch (error) {
            this.metricsManager.recordDatabaseQuery(query, Date.now() - startTime, false);
            throw error;
          }
        }.bind(this);
                
        sqliteManager.get = async function(query, params) {
          const startTime = Date.now();
          try {
            const result = await originalGet.call(this, query, params);
            this.metricsManager.recordDatabaseQuery(query, Date.now() - startTime, true);
            return result;
          } catch (error) {
            this.metricsManager.recordDatabaseQuery(query, Date.now() - startTime, false);
            throw error;
          }
        }.bind(this);
                
        sqliteManager.all = async function(query, params) {
          const startTime = Date.now();
          try {
            const result = await originalAll.call(this, query, params);
            this.metricsManager.recordDatabaseQuery(query, Date.now() - startTime, true);
            return result;
          } catch (error) {
            this.metricsManager.recordDatabaseQuery(query, Date.now() - startTime, false);
            throw error;
          }
        }.bind(this);
      }
            
      next();
    };
  }
    
  // Middleware para tracking de seguridad
  trackSecurity() {
    return (req, res, next) => {
      // Detectar intentos de autenticación
      if (req.path.includes('/auth/') || req.path.includes('/login')) {
        this.metricsManager.recordSecurityEvent('auth_attempt', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });
      }
            
      // Detectar actividad sospechosa
      if (this.isSuspiciousActivity(req)) {
        this.metricsManager.recordSecurityEvent('suspicious_activity', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          reason: this.getSuspiciousReason(req)
        });
      }
            
      next();
    };
  }
    
  // Middleware para métricas de negocio
  trackBusiness() {
    return (req, res, next) => {
      // Interceptar respuestas exitosas para métricas de negocio
      const originalJson = res.json;
            
      res.json = function(data) {
        // Detectar operaciones de negocio basadas en la ruta y respuesta
        this.recordBusinessMetrics(req, res, data);
        return originalJson.call(this, data);
      }.bind(this);
            
      next();
    };
  }
    
  recordBusinessMetrics(req, res, data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Mensajes procesados
      if (req.path.includes('/messages') && req.method === 'POST') {
        this.metricsManager.recordBusinessMetric('messagesProcessed');
      }
            
      // Campañas ejecutadas
      if (req.path.includes('/campaigns') && req.method === 'POST') {
        this.metricsManager.recordBusinessMetric('campaignsExecuted');
      }
            
      // Templates usados
      if (req.path.includes('/templates') && req.method === 'GET') {
        this.metricsManager.recordBusinessMetric('templatesUsed');
      }
            
      // Contactos gestionados
      if (req.path.includes('/contacts') && ['POST', 'PUT'].includes(req.method)) {
        this.metricsManager.recordBusinessMetric('contactsManaged');
      }
    }
  }
    
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
    
  sanitizeEndpoint(path) {
    // Reemplazar IDs numéricos con :id para agrupar métricas
    return path.replace(/\/\d+/g, '/:id');
  }
    
  isSuspiciousActivity(req) {
    // Detectar patrones sospechosos
    const suspiciousPatterns = [
      /\.\./,  // Path traversal
      /<script/i,  // XSS attempts
      /union.*select/i,  // SQL injection
      /javascript:/i,  // JavaScript injection
      /eval\(/i,  // Code injection
      /exec\(/i   // Command injection
    ];
        
    const checkString = `${req.path} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
        
    return suspiciousPatterns.some(pattern => pattern.test(checkString));
  }
    
  getSuspiciousReason(req) {
    const checkString = `${req.path} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
        
    if (/\.\./.test(checkString)) return 'path_traversal';
    if (/<script/i.test(checkString)) return 'xss_attempt';
    if (/union.*select/i.test(checkString)) return 'sql_injection';
    if (/javascript:/i.test(checkString)) return 'javascript_injection';
    if (/eval\(/i.test(checkString)) return 'code_injection';
    if (/exec\(/i.test(checkString)) return 'command_injection';
        
    return 'unknown_suspicious_pattern';
  }
    
  // Endpoint para obtener métricas
  getMetricsEndpoint() {
    return (req, res) => {
      try {
        const { interval = 'realtime', limit = 100 } = req.query;
        const metrics = this.metricsManager.getMetrics(interval, parseInt(limit));
                
        res.json({
          success: true,
          data: metrics,
          timestamp: Date.now()
        });
                
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error obteniendo métricas',
          code: 'METRICS_ERROR'
        });
      }
    };
  }
    
  // Endpoint para health check
  getHealthEndpoint() {
    return (req, res) => {
      try {
        const health = this.metricsManager.getSystemHealth();
                
        res.status(health.status === 'poor' ? 503 : 200).json({
          success: true,
          health,
          timestamp: Date.now()
        });
                
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error obteniendo estado de salud',
          code: 'HEALTH_CHECK_ERROR'
        });
      }
    };
  }
    
  // Endpoint para top endpoints
  getTopEndpointsEndpoint() {
    return (req, res) => {
      try {
        const { limit = 10 } = req.query;
        const topEndpoints = this.metricsManager.getTopEndpoints(parseInt(limit));
                
        res.json({
          success: true,
          data: topEndpoints,
          timestamp: Date.now()
        });
                
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error obteniendo top endpoints',
          code: 'TOP_ENDPOINTS_ERROR'
        });
      }
    };
  }
}

export default MetricsMiddleware;
/**
 * SystemHealthMonitor - Monitor de Salud del Sistema
 * 
 * Monitorea la salud general del sistema, componentes y servicios,
 * generando alertas y reportes de estado
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import { createLogger } from '../../services/core/core/logger.js';
import { EventEmitter } from 'events';
import os from 'os';
import process from 'process';

const logger = createLogger('HEALTH_MONITOR');

export class SystemHealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuración
    this.config = {
      // Configuración de monitoreo
      checkInterval: options.checkInterval || 30000, // 30 segundos
      healthTimeout: options.healthTimeout || 5000, // 5 segundos
      
      // Umbrales de salud
      thresholds: {
        cpuUsage: options.thresholds?.cpuUsage || 80,
        memoryUsage: options.thresholds?.memoryUsage || 85,
        diskUsage: options.thresholds?.diskUsage || 90,
        loadAverage: options.thresholds?.loadAverage || 2.0,
        responseTime: options.thresholds?.responseTime || 2000,
        errorRate: options.thresholds?.errorRate || 5,
        uptime: options.thresholds?.uptime || 99.9,
        ...options.thresholds
      },
      
      // Configuración de alertas
      enableAlerts: options.enableAlerts !== false,
      alertCooldown: options.alertCooldown || 300000, // 5 minutos
      
      // Configuración de componentes
      monitoredComponents: options.monitoredComponents || [
        'system',
        'process',
        'memory',
        'cpu',
        'disk',
        'network',
        'eventbus',
        'agents',
        'adapters'
      ],
      
      // Configuración de servicios externos
      externalServices: options.externalServices || [],
      
      ...options
    };
    
    // Estado del monitor
    this.isInitialized = false;
    this.isMonitoring = false;
    this.startTime = null;
    
    // Estado de salud
    this.healthStatus = {
      overall: 'unknown',
      components: new Map(),
      services: new Map(),
      lastCheck: null,
      uptime: 0,
      issues: [],
      alerts: []
    };
    
    // Historial de salud
    this.healthHistory = [];
    this.maxHistorySize = 100;
    
    // Estadísticas de salud
    this.healthStats = {
      totalChecks: 0,
      healthyChecks: 0,
      unhealthyChecks: 0,
      criticalIssues: 0,
      resolvedIssues: 0,
      averageResponseTime: 0,
      uptime: 0
    };
    
    // Componentes registrados
    this.registeredComponents = new Map();
    this.registeredServices = new Map();
    
    // Timers
    this.healthCheckTimer = null;
    this.cleanupTimer = null;
    
    // Cache de alertas para cooldown
    this.alertCache = new Map();
    
    logger.info('SystemHealthMonitor inicializado', {
      checkInterval: this.config.checkInterval,
      monitoredComponents: this.config.monitoredComponents
    });
  }
  
  /**
   * Inicializar el monitor
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('SystemHealthMonitor ya está inicializado');
      return;
    }
    
    try {
      logger.info('Inicializando SystemHealthMonitor...');
      
      // Registrar componentes por defecto
      this.registerDefaultComponents();
      
      // Registrar servicios externos
      this.registerExternalServices();
      
      // Configurar timers
      this.setupTimers();
      
      // Realizar primera verificación
      await this.performHealthCheck();
      
      this.isInitialized = true;
      this.startTime = new Date().toISOString();
      
      logger.info('SystemHealthMonitor inicializado correctamente');
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Error inicializando SystemHealthMonitor:', error);
      throw error;
    }
  }
  
  /**
   * Registrar componentes por defecto
   */
  registerDefaultComponents() {
    // Componente del sistema
    this.registerComponent('system', {
      name: 'Sistema Operativo',
      checker: () => this.checkSystemHealth(),
      critical: true
    });
    
    // Componente del proceso
    this.registerComponent('process', {
      name: 'Proceso Node.js',
      checker: () => this.checkProcessHealth(),
      critical: true
    });
    
    // Componente de memoria
    this.registerComponent('memory', {
      name: 'Memoria del Sistema',
      checker: () => this.checkMemoryHealth(),
      critical: true
    });
    
    // Componente de CPU
    this.registerComponent('cpu', {
      name: 'Procesador',
      checker: () => this.checkCPUHealth(),
      critical: true
    });
    
    // Componente de disco
    this.registerComponent('disk', {
      name: 'Almacenamiento',
      checker: () => this.checkDiskHealth(),
      critical: false
    });
    
    // Componente de red
    this.registerComponent('network', {
      name: 'Conectividad de Red',
      checker: () => this.checkNetworkHealth(),
      critical: false
    });
    
    // Componente del EventBus
    this.registerComponent('eventbus', {
      name: 'Bus de Eventos',
      checker: () => this.checkEventBusHealth(),
      critical: true
    });
    
    // Componente de agentes
    this.registerComponent('agents', {
      name: 'Agentes del Sistema',
      checker: () => this.checkAgentsHealth(),
      critical: false
    });
    
    // Componente de adaptadores
    this.registerComponent('adapters', {
      name: 'Adaptadores de Comunicación',
      checker: () => this.checkAdaptersHealth(),
      critical: false
    });
  }
  
  /**
   * Registrar servicios externos
   */
  registerExternalServices() {
    for (const service of this.config.externalServices) {
      this.registerService(service.name, {
        url: service.url,
        method: service.method || 'GET',
        timeout: service.timeout || this.config.healthTimeout,
        expectedStatus: service.expectedStatus || 200,
        critical: service.critical || false,
        headers: service.headers || {}
      });
    }
  }
  
  /**
   * Configurar timers
   */
  setupTimers() {
    // Timer de verificación de salud
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);
    
    // Timer de limpieza
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, 600000); // 10 minutos
  }
  
  /**
   * Iniciar monitoreo
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isMonitoring) {
      logger.warn('SystemHealthMonitor ya está monitoreando');
      return;
    }
    
    try {
      logger.info('Iniciando monitoreo de salud del sistema...');
      
      this.isMonitoring = true;
      
      logger.info('Monitoreo de salud iniciado');
      this.emit('started');
      
    } catch (error) {
      logger.error('Error iniciando monitoreo de salud:', error);
      throw error;
    }
  }
  
  /**
   * Detener monitoreo
   */
  async stop() {
    if (!this.isMonitoring) {
      logger.warn('SystemHealthMonitor no está monitoreando');
      return;
    }
    
    try {
      logger.info('Deteniendo monitoreo de salud...');
      
      // Detener timers
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }
      
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      
      this.isMonitoring = false;
      
      logger.info('Monitoreo de salud detenido');
      this.emit('stopped');
      
    } catch (error) {
      logger.error('Error deteniendo monitoreo de salud:', error);
      throw error;
    }
  }
  
  /**
   * Realizar verificación de salud
   */
  async performHealthCheck() {
    try {
      const checkStartTime = Date.now();
      const timestamp = new Date().toISOString();
      
      logger.debug('Iniciando verificación de salud...');
      
      // Verificar componentes
      const componentResults = await this.checkAllComponents();
      
      // Verificar servicios externos
      const serviceResults = await this.checkAllServices();
      
      // Calcular estado general
      const overallStatus = this.calculateOverallStatus(componentResults, serviceResults);
      
      // Actualizar estado de salud
      this.updateHealthStatus({
        overall: overallStatus,
        components: componentResults,
        services: serviceResults,
        lastCheck: timestamp,
        responseTime: Date.now() - checkStartTime
      });
      
      // Actualizar estadísticas
      this.updateHealthStats(overallStatus, Date.now() - checkStartTime);
      
      // Agregar al historial
      this.addToHistory({
        timestamp,
        overall: overallStatus,
        components: componentResults.size,
        services: serviceResults.size,
        responseTime: Date.now() - checkStartTime,
        issues: this.healthStatus.issues.length
      });
      
      // Verificar alertas
      if (this.config.enableAlerts) {
        this.checkHealthAlerts(componentResults, serviceResults);
      }
      
      // Emitir evento de estado
      this.emit('health:status', this.getHealthStatus());
      
      logger.debug(`Verificación de salud completada en ${Date.now() - checkStartTime}ms`);
      
    } catch (error) {
      logger.error('Error en verificación de salud:', error);
      this.healthStats.unhealthyChecks++;
    }
  }
  
  /**
   * Verificar todos los componentes
   */
  async checkAllComponents() {
    const results = new Map();
    
    for (const [componentId, component] of this.registeredComponents) {
      if (!this.config.monitoredComponents.includes(componentId)) {
        continue;
      }
      
      try {
        const startTime = Date.now();
        const result = await this.checkComponent(componentId, component);
        const responseTime = Date.now() - startTime;
        
        results.set(componentId, {
          ...result,
          responseTime,
          lastCheck: new Date().toISOString()
        });
        
      } catch (error) {
        logger.error(`Error verificando componente ${componentId}:`, error);
        results.set(componentId, {
          status: 'unhealthy',
          message: `Error en verificación: ${error.message}`,
          error: error.message,
          responseTime: 0,
          lastCheck: new Date().toISOString()
        });
      }
    }
    
    return results;
  }
  
  /**
   * Verificar todos los servicios
   */
  async checkAllServices() {
    const results = new Map();
    
    for (const [serviceId, service] of this.registeredServices) {
      try {
        const startTime = Date.now();
        const result = await this.checkService(serviceId, service);
        const responseTime = Date.now() - startTime;
        
        results.set(serviceId, {
          ...result,
          responseTime,
          lastCheck: new Date().toISOString()
        });
        
      } catch (error) {
        logger.error(`Error verificando servicio ${serviceId}:`, error);
        results.set(serviceId, {
          status: 'unhealthy',
          message: `Error en verificación: ${error.message}`,
          error: error.message,
          responseTime: 0,
          lastCheck: new Date().toISOString()
        });
      }
    }
    
    return results;
  }
  
  /**
   * Verificar componente específico
   */
  async checkComponent(componentId, component) {
    try {
      if (typeof component.checker === 'function') {
        return await component.checker();
      } else {
        return {
          status: 'healthy',
          message: 'Componente disponible'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error en componente: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verificar servicio específico
   */
  async checkService(serviceId, service) {
    try {
      // Implementación básica de verificación HTTP
      // En producción se usaría fetch o axios
      return {
        status: 'healthy',
        message: 'Servicio disponible',
        url: service.url
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Servicio no disponible: ${error.message}`,
        error: error.message,
        url: service.url
      };
    }
  }
  
  /**
   * Verificar salud del sistema
   */
  async checkSystemHealth() {
    try {
      const uptime = os.uptime();
      const loadavg = os.loadavg();
      const platform = os.platform();
      
      // Verificar carga del sistema
      const loadThreshold = this.config.thresholds.loadAverage;
      const currentLoad = loadavg[0]; // Carga promedio de 1 minuto
      
      if (currentLoad > loadThreshold) {
        return {
          status: 'degraded',
          message: `Carga del sistema alta: ${currentLoad.toFixed(2)}`,
          metrics: {
            uptime,
            loadavg,
            platform,
            currentLoad
          }
        };
      }
      
      return {
        status: 'healthy',
        message: 'Sistema operativo funcionando correctamente',
        metrics: {
          uptime,
          loadavg,
          platform,
          currentLoad
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error verificando sistema: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verificar salud del proceso
   */
  async checkProcessHealth() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();
      
      // Verificar uso de memoria del proceso
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      if (heapUsagePercent > 90) {
        return {
          status: 'degraded',
          message: `Uso de heap alto: ${heapUsagePercent.toFixed(1)}%`,
          metrics: {
            memUsage,
            cpuUsage,
            uptime,
            heapUsagePercent
          }
        };
      }
      
      return {
        status: 'healthy',
        message: 'Proceso Node.js funcionando correctamente',
        metrics: {
          memUsage,
          cpuUsage,
          uptime,
          heapUsagePercent
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error verificando proceso: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verificar salud de la memoria
   */
  async checkMemoryHealth() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const usagePercent = (usedMem / totalMem) * 100;
      
      const threshold = this.config.thresholds.memoryUsage;
      
      let status = 'healthy';
      let message = 'Memoria del sistema en niveles normales';
      
      if (usagePercent > threshold) {
        status = usagePercent > threshold + 10 ? 'unhealthy' : 'degraded';
        message = `Uso de memoria alto: ${usagePercent.toFixed(1)}%`;
      }
      
      return {
        status,
        message,
        metrics: {
          totalMem,
          freeMem,
          usedMem,
          usagePercent
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error verificando memoria: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verificar salud de la CPU
   */
  async checkCPUHealth() {
    try {
      const cpus = os.cpus();
      const loadavg = os.loadavg();
      
      // Calcular uso promedio de CPU (simplificado)
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });
      
      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const usage = 100 - ~~(100 * idle / total);
      
      const threshold = this.config.thresholds.cpuUsage;
      
      let status = 'healthy';
      let message = 'CPU funcionando en niveles normales';
      
      if (usage > threshold) {
        status = usage > threshold + 15 ? 'unhealthy' : 'degraded';
        message = `Uso de CPU alto: ${usage}%`;
      }
      
      return {
        status,
        message,
        metrics: {
          cpuCount: cpus.length,
          usage,
          loadavg,
          model: cpus[0]?.model || 'Unknown'
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error verificando CPU: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verificar salud del disco
   */
  async checkDiskHealth() {
    try {
      // Implementación básica - en producción usar librerías específicas
      return {
        status: 'healthy',
        message: 'Almacenamiento disponible',
        metrics: {
          usage: 0, // Placeholder
          available: 0, // Placeholder
          total: 0 // Placeholder
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error verificando disco: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verificar salud de la red
   */
  async checkNetworkHealth() {
    try {
      const networkInterfaces = os.networkInterfaces();
      const activeInterfaces = [];
      
      for (const [name, addresses] of Object.entries(networkInterfaces)) {
        for (const address of addresses) {
          if (!address.internal && address.family === 'IPv4') {
            activeInterfaces.push({
              interface: name,
              address: address.address
            });
          }
        }
      }
      
      if (activeInterfaces.length === 0) {
        return {
          status: 'degraded',
          message: 'No se encontraron interfaces de red activas',
          metrics: {
            activeInterfaces: 0,
            totalInterfaces: Object.keys(networkInterfaces).length
          }
        };
      }
      
      return {
        status: 'healthy',
        message: 'Conectividad de red disponible',
        metrics: {
          activeInterfaces: activeInterfaces.length,
          totalInterfaces: Object.keys(networkInterfaces).length,
          interfaces: activeInterfaces
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error verificando red: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verificar salud del EventBus
   */
  async checkEventBusHealth() {
    try {
      // Verificación básica - en producción verificar conectividad real
      return {
        status: 'healthy',
        message: 'Bus de eventos operativo',
        metrics: {
          listeners: 0, // Placeholder
          events: 0 // Placeholder
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error verificando EventBus: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verificar salud de los agentes
   */
  async checkAgentsHealth() {
    try {
      // Verificación básica - en producción verificar agentes reales
      return {
        status: 'healthy',
        message: 'Agentes del sistema operativos',
        metrics: {
          totalAgents: 0, // Placeholder
          activeAgents: 0, // Placeholder
          inactiveAgents: 0 // Placeholder
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error verificando agentes: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Verificar salud de los adaptadores
   */
  async checkAdaptersHealth() {
    try {
      // Verificación básica - en producción verificar adaptadores reales
      return {
        status: 'healthy',
        message: 'Adaptadores de comunicación operativos',
        metrics: {
          totalAdapters: 0, // Placeholder
          connectedAdapters: 0, // Placeholder
          disconnectedAdapters: 0 // Placeholder
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error verificando adaptadores: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Calcular estado general
   */
  calculateOverallStatus(componentResults, serviceResults) {
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    let criticalIssues = 0;
    
    // Evaluar componentes
    for (const [componentId, result] of componentResults) {
      const component = this.registeredComponents.get(componentId);
      
      switch (result.status) {
      case 'healthy':
        healthyCount++;
        break;
      case 'degraded':
        degradedCount++;
        if (component?.critical) criticalIssues++;
        break;
      case 'unhealthy':
        unhealthyCount++;
        if (component?.critical) criticalIssues++;
        break;
      }
    }
    
    // Evaluar servicios
    for (const [serviceId, result] of serviceResults) {
      const service = this.registeredServices.get(serviceId);
      
      switch (result.status) {
      case 'healthy':
        healthyCount++;
        break;
      case 'degraded':
        degradedCount++;
        if (service?.critical) criticalIssues++;
        break;
      case 'unhealthy':
        unhealthyCount++;
        if (service?.critical) criticalIssues++;
        break;
      }
    }
    
    // Determinar estado general
    if (criticalIssues > 0 || unhealthyCount > 0) {
      return 'unhealthy';
    }
    
    if (degradedCount > 0) {
      return 'degraded';
    }
    
    return 'healthy';
  }
  
  /**
   * Actualizar estado de salud
   */
  updateHealthStatus(newStatus) {
    this.healthStatus = {
      ...this.healthStatus,
      ...newStatus,
      uptime: this.startTime ? Date.now() - new Date(this.startTime).getTime() : 0
    };
    
    // Actualizar issues
    this.updateIssues(newStatus.components, newStatus.services);
  }
  
  /**
   * Actualizar issues
   */
  updateIssues(componentResults, serviceResults) {
    const currentIssues = [];
    
    // Issues de componentes
    for (const [componentId, result] of componentResults) {
      if (result.status !== 'healthy') {
        const component = this.registeredComponents.get(componentId);
        currentIssues.push({
          id: `component_${componentId}`,
          type: 'component',
          component: componentId,
          name: component?.name || componentId,
          status: result.status,
          message: result.message,
          critical: component?.critical || false,
          timestamp: result.lastCheck
        });
      }
    }
    
    // Issues de servicios
    for (const [serviceId, result] of serviceResults) {
      if (result.status !== 'healthy') {
        const service = this.registeredServices.get(serviceId);
        currentIssues.push({
          id: `service_${serviceId}`,
          type: 'service',
          service: serviceId,
          name: serviceId,
          status: result.status,
          message: result.message,
          critical: service?.critical || false,
          timestamp: result.lastCheck
        });
      }
    }
    
    this.healthStatus.issues = currentIssues;
  }
  
  /**
   * Actualizar estadísticas de salud
   */
  updateHealthStats(overallStatus, responseTime) {
    this.healthStats.totalChecks++;
    
    if (overallStatus === 'healthy') {
      this.healthStats.healthyChecks++;
    } else {
      this.healthStats.unhealthyChecks++;
    }
    
    // Actualizar tiempo de respuesta promedio
    this.healthStats.averageResponseTime = 
      (this.healthStats.averageResponseTime * (this.healthStats.totalChecks - 1) + responseTime) / 
      this.healthStats.totalChecks;
    
    // Calcular uptime
    if (this.startTime) {
      const totalTime = Date.now() - new Date(this.startTime).getTime();
      const healthyTime = (this.healthStats.healthyChecks / this.healthStats.totalChecks) * totalTime;
      this.healthStats.uptime = (healthyTime / totalTime) * 100;
    }
  }
  
  /**
   * Agregar al historial
   */
  addToHistory(entry) {
    this.healthHistory.unshift(entry);
    
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(0, this.maxHistorySize);
    }
  }
  
  /**
   * Verificar alertas de salud
   */
  checkHealthAlerts(componentResults, serviceResults) {
    const alerts = [];
    
    // Alertas de componentes críticos
    for (const [componentId, result] of componentResults) {
      const component = this.registeredComponents.get(componentId);
      
      if (component?.critical && result.status !== 'healthy') {
        const alertKey = `component_${componentId}_${result.status}`;
        
        if (this.shouldTriggerAlert(alertKey)) {
          alerts.push({
            id: alertKey,
            type: 'component_health',
            severity: result.status === 'unhealthy' ? 'critical' : 'warning',
            component: componentId,
            name: component.name,
            message: `Componente crítico ${component.name}: ${result.message}`,
            status: result.status,
            timestamp: new Date().toISOString()
          });
          
          this.alertCache.set(alertKey, Date.now());
        }
      }
    }
    
    // Alertas de servicios críticos
    for (const [serviceId, result] of serviceResults) {
      const service = this.registeredServices.get(serviceId);
      
      if (service?.critical && result.status !== 'healthy') {
        const alertKey = `service_${serviceId}_${result.status}`;
        
        if (this.shouldTriggerAlert(alertKey)) {
          alerts.push({
            id: alertKey,
            type: 'service_health',
            severity: result.status === 'unhealthy' ? 'critical' : 'warning',
            service: serviceId,
            message: `Servicio crítico ${serviceId}: ${result.message}`,
            status: result.status,
            timestamp: new Date().toISOString()
          });
          
          this.alertCache.set(alertKey, Date.now());
        }
      }
    }
    
    // Alerta de estado general
    if (this.healthStatus.overall !== 'healthy') {
      const alertKey = `overall_${this.healthStatus.overall}`;
      
      if (this.shouldTriggerAlert(alertKey)) {
        alerts.push({
          id: alertKey,
          type: 'overall_health',
          severity: this.healthStatus.overall === 'unhealthy' ? 'critical' : 'warning',
          message: `Estado general del sistema: ${this.healthStatus.overall}`,
          status: this.healthStatus.overall,
          issues: this.healthStatus.issues.length,
          timestamp: new Date().toISOString()
        });
        
        this.alertCache.set(alertKey, Date.now());
      }
    }
    
    // Emitir alertas
    for (const alert of alerts) {
      this.emit('health:alert', alert);
    }
    
    this.healthStatus.alerts = alerts;
  }
  
  /**
   * Verificar si debe activar alerta (cooldown)
   */
  shouldTriggerAlert(alertKey) {
    const lastAlert = this.alertCache.get(alertKey);
    
    if (!lastAlert) {
      return true;
    }
    
    return Date.now() - lastAlert > this.config.alertCooldown;
  }
  
  /**
   * Registrar componente
   */
  registerComponent(id, component) {
    this.registeredComponents.set(id, {
      id,
      name: component.name || id,
      checker: component.checker,
      critical: component.critical || false,
      description: component.description || '',
      registered: new Date().toISOString()
    });
    
    logger.info(`Componente registrado: ${id}`);
  }
  
  /**
   * Desregistrar componente
   */
  unregisterComponent(id) {
    const removed = this.registeredComponents.delete(id);
    if (removed) {
      logger.info(`Componente desregistrado: ${id}`);
    }
    return removed;
  }
  
  /**
   * Registrar servicio
   */
  registerService(id, service) {
    this.registeredServices.set(id, {
      id,
      name: service.name || id,
      url: service.url,
      method: service.method || 'GET',
      timeout: service.timeout || this.config.healthTimeout,
      expectedStatus: service.expectedStatus || 200,
      critical: service.critical || false,
      headers: service.headers || {},
      description: service.description || '',
      registered: new Date().toISOString()
    });
    
    logger.info(`Servicio registrado: ${id}`);
  }
  
  /**
   * Desregistrar servicio
   */
  unregisterService(id) {
    const removed = this.registeredServices.delete(id);
    if (removed) {
      logger.info(`Servicio desregistrado: ${id}`);
    }
    return removed;
  }
  
  /**
   * Limpiar datos antiguos
   */
  cleanupOldData() {
    // Limpiar cache de alertas
    const now = Date.now();
    for (const [alertKey, timestamp] of this.alertCache) {
      if (now - timestamp > this.config.alertCooldown * 2) {
        this.alertCache.delete(alertKey);
      }
    }
    
    logger.debug('Datos antiguos de salud limpiados');
  }
  
  /**
   * Obtener estado de salud
   */
  getHealthStatus() {
    return {
      ...this.healthStatus,
      components: Object.fromEntries(this.healthStatus.components),
      services: Object.fromEntries(this.healthStatus.services)
    };
  }
  
  /**
   * Obtener estadísticas de salud
   */
  getHealthStats() {
    return {
      ...this.healthStats,
      isInitialized: this.isInitialized,
      isMonitoring: this.isMonitoring,
      startTime: this.startTime,
      registeredComponents: this.registeredComponents.size,
      registeredServices: this.registeredServices.size,
      config: this.config
    };
  }
  
  /**
   * Obtener historial de salud
   */
  getHealthHistory(limit = 50) {
    return this.healthHistory.slice(0, limit);
  }
  
  /**
   * Obtener componentes registrados
   */
  getRegisteredComponents() {
    return Array.from(this.registeredComponents.values());
  }
  
  /**
   * Obtener servicios registrados
   */
  getRegisteredServices() {
    return Array.from(this.registeredServices.values());
  }
  
  /**
   * Obtener resumen de salud
   */
  getHealthSummary() {
    const components = this.getRegisteredComponents();
    const services = this.getRegisteredServices();
    
    return {
      overall: this.healthStatus.overall,
      uptime: this.healthStats.uptime,
      lastCheck: this.healthStatus.lastCheck,
      components: {
        total: components.length,
        healthy: Array.from(this.healthStatus.components.values()).filter(c => c.status === 'healthy').length,
        degraded: Array.from(this.healthStatus.components.values()).filter(c => c.status === 'degraded').length,
        unhealthy: Array.from(this.healthStatus.components.values()).filter(c => c.status === 'unhealthy').length
      },
      services: {
        total: services.length,
        healthy: Array.from(this.healthStatus.services.values()).filter(s => s.status === 'healthy').length,
        degraded: Array.from(this.healthStatus.services.values()).filter(s => s.status === 'degraded').length,
        unhealthy: Array.from(this.healthStatus.services.values()).filter(s => s.status === 'unhealthy').length
      },
      issues: this.healthStatus.issues.length,
      criticalIssues: this.healthStatus.issues.filter(i => i.critical).length,
      alerts: this.healthStatus.alerts.length
    };
  }
  
  /**
   * Exportar datos de salud
   */
  exportHealthData(format = 'json', options = {}) {
    const data = {
      status: this.getHealthStatus(),
      stats: this.getHealthStats(),
      history: this.getHealthHistory(options.historyLimit),
      components: this.getRegisteredComponents(),
      services: this.getRegisteredServices()
    };
    
    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'csv':
      return this.convertHealthToCSV(data);
    default:
      throw new Error(`Formato de exportación no soportado: ${format}`);
    }
  }
  
  /**
   * Convertir datos de salud a CSV
   */
  convertHealthToCSV(data) {
    const lines = [];
    lines.push('timestamp,overall,components,services,issues,responseTime');
    
    for (const entry of data.history) {
      lines.push([
        entry.timestamp,
        entry.overall,
        entry.components,
        entry.services,
        entry.issues,
        entry.responseTime
      ].join(','));
    }
    
    return lines.join('\n');
  }
  
  /**
   * Destruir el monitor
   */
  async destroy() {
    logger.info('Destruyendo SystemHealthMonitor...');
    
    try {
      // Detener si está monitoreando
      if (this.isMonitoring) {
        await this.stop();
      }
      
      // Limpiar datos
      this.registeredComponents.clear();
      this.registeredServices.clear();
      this.healthHistory = [];
      this.alertCache.clear();
      
      this.isInitialized = false;
      
      // Remover listeners
      this.removeAllListeners();
      
      logger.info('SystemHealthMonitor destruido');
      
    } catch (error) {
      logger.error('Error destruyendo SystemHealthMonitor:', error);
      throw error;
    }
  }
}

export default SystemHealthMonitor;
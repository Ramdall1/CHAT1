// Herramientas de debugging y monitoreo
export { default as DebugMonitor } from './DebugMonitor.js';
export { default as PerformanceProfiler } from './PerformanceProfiler.js';
export { default as SystemHealthMonitor } from './SystemHealthMonitor.js';
export { default as DebugDashboard } from './DebugDashboard.js';

// Logging system
export { default as Logger } from './logger.js';
export { default as FrontendLogger } from './FrontendLogger.js';

/**
 * Inicializar suite completa de debugging y monitoreo
 */
export async function initializeDebugSuite(options = {}) {
  const config = {
    enableDebugMonitor: process.env.ENABLE_DEBUG_MONITOR !== 'false',
    enablePerformanceProfiler: process.env.ENABLE_PERFORMANCE_PROFILER !== 'false',
    enableHealthMonitor: process.env.ENABLE_HEALTH_MONITOR !== 'false',
    enableDashboard: process.env.ENABLE_DEBUG_DASHBOARD !== 'false',
    dashboardPort: parseInt(process.env.DEBUG_DASHBOARD_PORT) || 3001,
    ...options
  };

  const suite = {
    debugMonitor: null,
    performanceProfiler: null,
    healthMonitor: null,
    dashboard: null
  };

  try {
    // Inicializar Debug Monitor
    if (config.enableDebugMonitor) {
      const { default: DebugMonitor } = await import('./DebugMonitor.js');
      suite.debugMonitor = new DebugMonitor(config.debugMonitor);
      logger.info('✅ Debug Monitor inicializado');
    }

    // Inicializar Performance Profiler
    if (config.enablePerformanceProfiler) {
      const { default: PerformanceProfiler } = await import('./PerformanceProfiler.js');
      suite.performanceProfiler = new PerformanceProfiler(config.performanceProfiler);
      logger.info('✅ Performance Profiler inicializado');
    }

    // Inicializar Health Monitor
    if (config.enableHealthMonitor) {
      const { default: SystemHealthMonitor } = await import('./SystemHealthMonitor.js');
      suite.healthMonitor = new SystemHealthMonitor(config.healthMonitor);
      logger.info('✅ Health Monitor inicializado');
    }

    // Inicializar Dashboard
    if (config.enableDashboard) {
      const { default: DebugDashboard } = await import('./DebugDashboard.js');
      suite.dashboard = new DebugDashboard({
        port: config.dashboardPort,
        ...config.dashboard
      });

      // Registrar monitores en el dashboard
      if (suite.debugMonitor) {
        suite.dashboard.registerMonitor('debug', suite.debugMonitor);
      }
      if (suite.performanceProfiler) {
        suite.dashboard.registerMonitor('performance', suite.performanceProfiler);
      }
      if (suite.healthMonitor) {
        suite.dashboard.registerMonitor('health', suite.healthMonitor);
      }

      await suite.dashboard.start();
      logger.info(`✅ Debug Dashboard iniciado en ${suite.dashboard.getURL()}`);
    }

    logger.info('🎯 Suite de debugging y monitoreo inicializada completamente');
    return suite;

  } catch (error) {
    logger.error('❌ Error inicializando suite de debugging:', error);
    throw error;
  }
}

/**
 * Detener suite de debugging y monitoreo
 */
export async function stopDebugSuite(suite) {
  try {
    if (suite.dashboard) {
      await suite.dashboard.stop();
    }
    if (suite.healthMonitor) {
      suite.healthMonitor.stop();
    }
    if (suite.performanceProfiler) {
      suite.performanceProfiler.stop();
    }
    if (suite.debugMonitor) {
      suite.debugMonitor.stop();
    }

    logger.info('🛑 Suite de debugging y monitoreo detenida');
  } catch (error) {
    logger.error('❌ Error deteniendo suite de debugging:', error);
  }
}

/**
 * Configuración por defecto para desarrollo
 */
export const developmentConfig = {
  enableDebugMonitor: true,
  enablePerformanceProfiler: true,
  enableHealthMonitor: true,
  enableDashboard: true,
  dashboardPort: 3001,
  debugMonitor: {
    logLevel: 'debug',
    enableProfiling: true,
    enableMemoryTracking: true,
    enablePerformanceTracking: true
  },
  performanceProfiler: {
    sampleRate: 1.0,
    slowThreshold: 100,
    verySlowThreshold: 1000,
    enableGC: true,
    enableAsync: true
  },
  healthMonitor: {
    checkInterval: 30000,
    alertThresholds: {
      memoryUsage: 0.85,
      cpuUsage: 0.80,
      diskUsage: 0.90,
      responseTime: 5000,
      errorRate: 0.05
    }
  },
  dashboard: {
    updateInterval: 5000,
    maxLogEntries: 1000,
    enableAuth: false
  }
};

/**
 * Configuración para producción
 */
export const productionConfig = {
  enableDebugMonitor: true,
  enablePerformanceProfiler: true,
  enableHealthMonitor: true,
  enableDashboard: false, // Dashboard deshabilitado en producción por defecto
  debugMonitor: {
    logLevel: 'warn',
    enableProfiling: false,
    enableMemoryTracking: true,
    enablePerformanceTracking: true
  },
  performanceProfiler: {
    sampleRate: 0.1, // Solo 10% de sampling en producción
    slowThreshold: 500,
    verySlowThreshold: 2000,
    enableGC: true,
    enableAsync: false
  },
  healthMonitor: {
    checkInterval: 60000, // Checks menos frecuentes
    alertThresholds: {
      memoryUsage: 0.90,
      cpuUsage: 0.85,
      diskUsage: 0.95,
      responseTime: 10000,
      errorRate: 0.02
    }
  }
};

/**
 * Obtener configuración basada en el entorno
 */
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
    
  switch (env) {
  case 'production':
    return productionConfig;
  case 'test':
    return {
      ...developmentConfig,
      enableDashboard: false,
      debugMonitor: {
        ...developmentConfig.debugMonitor,
        logLevel: 'error'
      }
    };
  default:
    return developmentConfig;
  }
}
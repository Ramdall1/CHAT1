import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /health - Health check básico
router.get('/', async (req, res) => {
  try {
    const healthService = req.app.locals.healthCheckService;

    if (!healthService) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Health Check Service no disponible',
        timestamp: new Date().toISOString(),
      });
    }

    const results = healthService.getResults();
    const overall = results.overall;

    // Determinar código de estado HTTP basado en el estado general
    let statusCode = 200;
    if (overall.status === 'critical' || overall.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    } else if (overall.status === 'warning') {
      statusCode = 200; // OK pero con advertencias
    }

    res.status(statusCode).json({
      status: overall.status,
      message: overall.message,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    logger.error('Error en health check endpoint', {
      error: error.message,
      category: 'HEALTH_CHECK_ERROR',
    });

    res.status(500).json({
      status: 'error',
      message: 'Error interno en health check',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/detailed - Health check detallado
router.get('/detailed', async (req, res) => {
  try {
    const healthService = req.app.locals.healthCheckService;

    if (!healthService) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Health Check Service no disponible',
        timestamp: new Date().toISOString(),
      });
    }

    const results = healthService.getResults();

    res.json({
      ...results,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      pid: process.pid,
    });
  } catch (error) {
    logger.error('Error en detailed health check endpoint', {
      error: error.message,
      category: 'HEALTH_CHECK_ERROR',
    });

    res.status(500).json({
      status: 'error',
      message: 'Error interno en health check detallado',
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /health/run - Ejecutar health checks manualmente
router.post('/run', async (req, res) => {
  try {
    const healthService = req.app.locals.healthCheckService;

    if (!healthService) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Health Check Service no disponible',
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Health checks ejecutados manualmente', {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      category: 'HEALTH_CHECK_MANUAL',
    });

    // Ejecutar checks
    await healthService.runAllChecks();
    const results = healthService.getResults();

    res.json({
      message: 'Health checks ejecutados correctamente',
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error ejecutando health checks manualmente', {
      error: error.message,
      category: 'HEALTH_CHECK_ERROR',
    });

    res.status(500).json({
      status: 'error',
      message: 'Error ejecutando health checks',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/metrics - Métricas básicas del sistema
router.get('/metrics', (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    logger.error('Error obteniendo métricas', {
      error: error.message,
      category: 'METRICS_ERROR',
    });

    res.status(500).json({
      status: 'error',
      message: 'Error obteniendo métricas',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

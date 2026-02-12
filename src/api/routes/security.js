/**
 * @fileoverview Rutas API para monitoreo de seguridad
 * Proporciona endpoints para acceder a estadísticas y reportes de seguridad
 */

import express from 'express';
import { requireAuth, requireAdmin, getSecurityMonitor } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/security/status
 * Obtiene el estado actual del monitoreo de seguridad
 */
router.get('/status', requireAuth, (req, res) => {
  try {
    const securityMonitor = getSecurityMonitor();
    
    if (!securityMonitor) {
      return res.status(503).json({
        success: false,
        message: 'SecurityMonitor no está inicializado'
      });
    }

    const stats = securityMonitor.getSecurityStats();
    
    res.json({
      success: true,
      data: {
        monitoring: {
          isActive: securityMonitor.isMonitoring,
          uptime: Date.now() - (stats.lastCheck?.getTime() || Date.now())
        },
        statistics: stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estado de seguridad',
      error: error.message
    });
  }
});

/**
 * GET /api/security/report
 * Obtiene reporte completo de seguridad (solo administradores)
 */
router.get('/report', requireAuth, requireAdmin, (req, res) => {
  try {
    const securityMonitor = getSecurityMonitor();
    
    if (!securityMonitor) {
      return res.status(503).json({
        success: false,
        message: 'SecurityMonitor no está inicializado'
      });
    }

    const report = securityMonitor.getSecurityReport();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generando reporte de seguridad',
      error: error.message
    });
  }
});

/**
 * GET /api/security/events
 * Obtiene eventos recientes de seguridad
 */
router.get('/events', requireAuth, requireAdmin, (req, res) => {
  try {
    const securityMonitor = getSecurityMonitor();
    
    if (!securityMonitor) {
      return res.status(503).json({
        success: false,
        message: 'SecurityMonitor no está inicializado'
      });
    }

    const limit = parseInt(req.query.limit) || 50;
    const events = securityMonitor.getRecentEvents(limit);
    
    res.json({
      success: true,
      data: {
        events,
        total: events.length,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo eventos de seguridad',
      error: error.message
    });
  }
});

/**
 * GET /api/security/alerts
 * Obtiene alertas activas de seguridad
 */
router.get('/alerts', requireAuth, requireAdmin, (req, res) => {
  try {
    const securityMonitor = getSecurityMonitor();
    
    if (!securityMonitor) {
      return res.status(503).json({
        success: false,
        message: 'SecurityMonitor no está inicializado'
      });
    }

    // En una implementación real, mantendrías un registro de alertas activas
    // Por ahora, devolvemos las estadísticas actuales
    const stats = securityMonitor.getSecurityStats();
    const thresholds = securityMonitor.config.alertThresholds;
    
    const activeAlerts = [];
    
    // Verificar si hay alertas activas basadas en los umbrales
    if (stats.failedLogins >= thresholds.failedLogins) {
      activeAlerts.push({
        type: 'FAILED_LOGIN_THRESHOLD',
        severity: 'high',
        message: `Intentos de login fallidos exceden el umbral (${stats.failedLogins}/${thresholds.failedLogins})`,
        count: stats.failedLogins,
        threshold: thresholds.failedLogins
      });
    }
    
    if (stats.suspiciousIPs >= thresholds.suspiciousIPs) {
      activeAlerts.push({
        type: 'SUSPICIOUS_IP_THRESHOLD',
        severity: 'medium',
        message: `IPs sospechosas exceden el umbral (${stats.suspiciousIPs}/${thresholds.suspiciousIPs})`,
        count: stats.suspiciousIPs,
        threshold: thresholds.suspiciousIPs
      });
    }
    
    if (stats.bruteForceAttempts >= thresholds.bruteForceAttempts) {
      activeAlerts.push({
        type: 'BRUTE_FORCE_THRESHOLD',
        severity: 'critical',
        message: `Intentos de fuerza bruta exceden el umbral (${stats.bruteForceAttempts}/${thresholds.bruteForceAttempts})`,
        count: stats.bruteForceAttempts,
        threshold: thresholds.bruteForceAttempts
      });
    }
    
    res.json({
      success: true,
      data: {
        alerts: activeAlerts,
        total: activeAlerts.length,
        lastCheck: stats.lastCheck
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo alertas de seguridad',
      error: error.message
    });
  }
});

/**
 * POST /api/security/test-alert
 * Genera una alerta de prueba (solo para desarrollo)
 */
router.post('/test-alert', requireAuth, requireAdmin, (req, res) => {
  try {
    const securityMonitor = getSecurityMonitor();
    
    if (!securityMonitor) {
      return res.status(503).json({
        success: false,
        message: 'SecurityMonitor no está inicializado'
      });
    }

    // Generar evento de prueba
    const testEvent = securityMonitor.recordSecurityEvent('test_alert', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      severity: 'medium',
      message: 'Alerta de prueba generada desde API'
    });
    
    res.json({
      success: true,
      message: 'Alerta de prueba generada exitosamente',
      data: testEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generando alerta de prueba',
      error: error.message
    });
  }
});

/**
 * GET /api/security/dashboard
 * Obtiene datos para dashboard de seguridad
 */
router.get('/dashboard', requireAuth, requireAdmin, (req, res) => {
  try {
    const securityMonitor = getSecurityMonitor();
    
    if (!securityMonitor) {
      return res.status(503).json({
        success: false,
        message: 'SecurityMonitor no está inicializado'
      });
    }

    const stats = securityMonitor.getSecurityStats();
    const recentEvents = securityMonitor.getRecentEvents(10);
    const report = securityMonitor.getSecurityReport();
    
    // Calcular tendencias (simplificado)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentEventsLastHour = recentEvents.filter(event => 
      event.timestamp > oneHourAgo
    );
    
    res.json({
      success: true,
      data: {
        overview: {
          totalEvents: stats.totalEvents,
          eventsLastHour: recentEventsLastHour.length,
          monitoring: {
            isActive: securityMonitor.isMonitoring,
            interval: securityMonitor.config.monitoringInterval
          }
        },
        statistics: stats,
        recentEvents: recentEvents.slice(0, 5),
        counters: report.counters,
        thresholds: report.thresholds
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo datos del dashboard',
      error: error.message
    });
  }
});

export default router;
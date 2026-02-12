import express from 'express';
import notificationService from '../services/NotificationService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ===== SUBSCRIPTION MANAGEMENT =====

// Suscribirse a notificaciones
router.post('/subscribe', async (req, res) => {
  try {
    const { userId, socketId, preferences } = req.body;

    if (!userId || !socketId) {
      return res.status(400).json({
        success: false,
        error: 'userId y socketId son requeridos',
      });
    }

    notificationService.subscribe(userId, socketId, preferences);

    res.json({
      success: true,
      message: 'Suscrito a notificaciones exitosamente',
      data: {
        userId,
        socketId,
        preferences: preferences || {},
      },
    });
  } catch (error) {
    logger.error('Error en suscripción a notificaciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Desuscribirse de notificaciones
router.post('/unsubscribe', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId es requerido',
      });
    }

    notificationService.unsubscribe(userId);

    res.json({
      success: true,
      message: 'Desuscrito de notificaciones exitosamente',
    });
  } catch (error) {
    logger.error('Error en desuscripción de notificaciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Actualizar preferencias
router.put('/preferences', async (req, res) => {
  try {
    const { userId, preferences } = req.body;

    if (!userId || !preferences) {
      return res.status(400).json({
        success: false,
        error: 'userId y preferences son requeridos',
      });
    }

    notificationService.updatePreferences(userId, preferences);

    res.json({
      success: true,
      message: 'Preferencias actualizadas exitosamente',
      data: { userId, preferences },
    });
  } catch (error) {
    logger.error('Error actualizando preferencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// ===== NOTIFICATION SENDING =====

// Enviar notificación a usuario específico
router.post('/send', async (req, res) => {
  try {
    const { userId, notification } = req.body;

    if (
      !notification ||
      !notification.type ||
      !notification.title ||
      !notification.message
    ) {
      return res.status(400).json({
        success: false,
        error: 'Datos de notificación incompletos',
      });
    }

    let result;
    if (userId) {
      result = await notificationService.sendToUser(userId, notification);
    } else {
      result = await notificationService.sendNotification(notification);
    }

    res.json({
      success: result,
      message: result
        ? 'Notificación enviada exitosamente'
        : 'Error enviando notificación',
    });
  } catch (error) {
    logger.error('Error enviando notificación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Broadcast a todos los usuarios
router.post('/broadcast', async (req, res) => {
  try {
    const { notification } = req.body;

    if (
      !notification ||
      !notification.type ||
      !notification.title ||
      !notification.message
    ) {
      return res.status(400).json({
        success: false,
        error: 'Datos de notificación incompletos',
      });
    }

    const sentCount = await notificationService.broadcast(notification);

    res.json({
      success: true,
      message: `Broadcast enviado a ${sentCount} usuarios`,
      data: { sentCount },
    });
  } catch (error) {
    logger.error('Error en broadcast:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// ===== ALERT MANAGEMENT =====

// Obtener reglas de alerta
router.get('/alerts/rules', async (req, res) => {
  try {
    const rules = notificationService.getAlertRules();

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    logger.error('Error obteniendo reglas de alerta:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Agregar regla de alerta
router.post('/alerts/rules', async (req, res) => {
  try {
    const { ruleId, rule } = req.body;

    if (!ruleId || !rule || !rule.condition || !rule.action) {
      return res.status(400).json({
        success: false,
        error: 'ruleId, condition y action son requeridos',
      });
    }

    // Convertir string de función a función real (solo para testing)
    if (typeof rule.condition === 'string') {
      try {
        rule.condition = new Function('data', rule.condition);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Condición inválida',
        });
      }
    }

    notificationService.addAlertRule(ruleId, rule);

    res.json({
      success: true,
      message: 'Regla de alerta agregada exitosamente',
      data: { ruleId, rule },
    });
  } catch (error) {
    logger.error('Error agregando regla de alerta:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Eliminar regla de alerta
router.delete('/alerts/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;

    notificationService.removeAlertRule(ruleId);

    res.json({
      success: true,
      message: 'Regla de alerta eliminada exitosamente',
    });
  } catch (error) {
    logger.error('Error eliminando regla de alerta:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Probar alertas manualmente
router.post('/alerts/test', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Datos de prueba requeridos',
      });
    }

    await notificationService.checkAlerts(data);

    res.json({
      success: true,
      message: 'Alertas evaluadas exitosamente',
    });
  } catch (error) {
    logger.error('Error probando alertas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// ===== NOTIFICATION TYPES =====

// Enviar notificación de mensaje
router.post('/message', async (req, res) => {
  try {
    const { messageData } = req.body;

    if (!messageData) {
      return res.status(400).json({
        success: false,
        error: 'Datos del mensaje requeridos',
      });
    }

    const result =
      await notificationService.sendMessageNotification(messageData);

    res.json({
      success: result,
      message: result
        ? 'Notificación de mensaje enviada'
        : 'Error enviando notificación',
    });
  } catch (error) {
    logger.error('Error enviando notificación de mensaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Enviar notificación de IA
router.post('/ai', async (req, res) => {
  try {
    const { aiData } = req.body;

    if (!aiData) {
      return res.status(400).json({
        success: false,
        error: 'Datos de IA requeridos',
      });
    }

    const result = await notificationService.sendAINotification(aiData);

    res.json({
      success: result,
      message: result
        ? 'Notificación de IA enviada'
        : 'Error enviando notificación',
    });
  } catch (error) {
    logger.error('Error enviando notificación de IA:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Enviar notificación del sistema
router.post('/system', async (req, res) => {
  try {
    const { systemData } = req.body;

    if (!systemData || !systemData.message) {
      return res.status(400).json({
        success: false,
        error: 'Datos del sistema requeridos',
      });
    }

    const result = await notificationService.sendSystemNotification(systemData);

    res.json({
      success: result,
      message: result
        ? 'Notificación del sistema enviada'
        : 'Error enviando notificación',
    });
  } catch (error) {
    logger.error('Error enviando notificación del sistema:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Enviar notificación de error
router.post('/error', async (req, res) => {
  try {
    const { errorData } = req.body;

    if (!errorData || !errorData.message) {
      return res.status(400).json({
        success: false,
        error: 'Datos del error requeridos',
      });
    }

    const result = await notificationService.sendErrorNotification(errorData);

    res.json({
      success: result,
      message: result
        ? 'Notificación de error enviada'
        : 'Error enviando notificación',
    });
  } catch (error) {
    logger.error('Error enviando notificación de error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// ===== METRICS AND STATUS =====

// Obtener métricas
router.get('/metrics', async (req, res) => {
  try {
    const metrics = notificationService.getMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Error obteniendo métricas de notificaciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Obtener suscriptores
router.get('/subscribers', async (req, res) => {
  try {
    const subscribers = notificationService.getSubscribers();

    res.json({
      success: true,
      data: subscribers,
    });
  } catch (error) {
    logger.error('Error obteniendo suscriptores:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Estado del servicio
router.get('/status', async (req, res) => {
  try {
    const metrics = notificationService.getMetrics();
    const subscribers = notificationService.getSubscribers();
    const rules = notificationService.getAlertRules();

    res.json({
      success: true,
      data: {
        status: 'active',
        metrics,
        subscribersCount: subscribers.length,
        activeRulesCount: rules.filter(r => r.enabled).length,
        uptime: process.uptime() * 1000,
      },
    });
  } catch (error) {
    logger.error('Error obteniendo estado del servicio:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// ===== WEBSOCKET INTEGRATION =====

// Endpoint para configurar WebSocket
router.post('/websocket/setup', async (req, res) => {
  try {
    const { socketId, userId } = req.body;

    if (!socketId) {
      return res.status(400).json({
        success: false,
        error: 'socketId es requerido',
      });
    }

    // Configurar eventos de WebSocket para notificaciones
    if (global.io) {
      const socket = global.io.sockets.sockets.get(socketId);
      if (socket) {
        // Configurar eventos específicos de notificaciones
        socket.on('notification:subscribe', data => {
          notificationService.subscribe(
            data.userId || userId,
            socketId,
            data.preferences
          );
        });

        socket.on('notification:unsubscribe', () => {
          notificationService.unsubscribe(userId || socketId);
        });

        socket.on('notification:updatePreferences', preferences => {
          notificationService.updatePreferences(
            userId || socketId,
            preferences
          );
        });

        socket.on('disconnect', () => {
          notificationService.unsubscribe(userId || socketId);
        });
      }
    }

    res.json({
      success: true,
      message: 'WebSocket configurado para notificaciones',
    });
  } catch (error) {
    logger.error('Error configurando WebSocket:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

export default router;

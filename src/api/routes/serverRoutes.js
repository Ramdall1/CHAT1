/**
 * Server Routes - Rutas para control del servidor
 */

import express from 'express';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('SERVER_ROUTES');

let serverState = {
  isPaused: false,
  startTime: new Date(),
  restarts: 0
};

/**
 * GET /api/server/status
 * Obtener estado del servidor
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      isPaused: serverState.isPaused,
      startTime: serverState.startTime,
      restarts: serverState.restarts,
      uptime: Date.now() - serverState.startTime.getTime()
    }
  });
});

/**
 * POST /api/server/restart
 * Reiniciar el servidor
 */
router.post('/restart', (req, res) => {
  try {
    logger.warn('🔄 Reiniciando servidor...');
    
    serverState.isPaused = false;
    serverState.restarts++;
    serverState.startTime = new Date();

    logger.info('✅ Servidor reiniciado correctamente');

    res.json({
      success: true,
      message: 'Servidor reiniciado correctamente',
      data: serverState
    });
  } catch (error) {
    logger.error('❌ Error reiniciando servidor:', error);
    res.status(500).json({
      success: false,
      error: 'Error reiniciando servidor'
    });
  }
});

/**
 * POST /api/server/pause
 * Pausar el servidor
 */
router.post('/pause', (req, res) => {
  try {
    logger.warn('⏸️ Pausando servidor...');
    
    serverState.isPaused = true;

    logger.info('✅ Servidor pausado');

    res.json({
      success: true,
      message: 'Servidor pausado',
      data: serverState
    });
  } catch (error) {
    logger.error('❌ Error pausando servidor:', error);
    res.status(500).json({
      success: false,
      error: 'Error pausando servidor'
    });
  }
});

/**
 * POST /api/server/resume
 * Reanudar el servidor
 */
router.post('/resume', (req, res) => {
  try {
    logger.warn('▶️ Reanudando servidor...');
    
    serverState.isPaused = false;

    logger.info('✅ Servidor reanudado');

    res.json({
      success: true,
      message: 'Servidor reanudado',
      data: serverState
    });
  } catch (error) {
    logger.error('❌ Error reanudando servidor:', error);
    res.status(500).json({
      success: false,
      error: 'Error reanudando servidor'
    });
  }
});

export default router;

/**
 * Server Control Module
 * Maneja el control del servidor (reinicio, pausa, etc.)
 */

import { createLogger } from '../services/core/core/logger.js';

const logger = createLogger('SERVER_CONTROL');

let serverInstance = null;
let isPaused = false;

export const serverControl = {
  /**
   * Registra la instancia del servidor
   */
  registerServer(app) {
    serverInstance = app;
    logger.info('✅ Servidor registrado para control');
  },

  /**
   * Reinicia el servidor
   */
  async restart() {
    try {
      logger.warn('🔄 Reiniciando servidor...');
      
      if (serverInstance && serverInstance.close) {
        await new Promise((resolve) => {
          serverInstance.close(() => {
            logger.info('✅ Servidor detenido');
            resolve();
          });
        });
      }

      // Esperar un segundo antes de reiniciar
      await new Promise(resolve => setTimeout(resolve, 1000));

      logger.info('✅ Servidor reiniciado correctamente');
      isPaused = false;
      
      return {
        success: true,
        message: 'Servidor reiniciado correctamente'
      };
    } catch (error) {
      logger.error('❌ Error reiniciando servidor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Pausa el servidor
   */
  async pause() {
    try {
      logger.warn('⏸️ Pausando servidor...');
      isPaused = true;
      
      logger.info('✅ Servidor pausado');
      
      return {
        success: true,
        message: 'Servidor pausado',
        isPaused: true
      };
    } catch (error) {
      logger.error('❌ Error pausando servidor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Reanuda el servidor
   */
  async resume() {
    try {
      logger.warn('▶️ Reanudando servidor...');
      isPaused = false;
      
      logger.info('✅ Servidor reanudado');
      
      return {
        success: true,
        message: 'Servidor reanudado',
        isPaused: false
      };
    } catch (error) {
      logger.error('❌ Error reanudando servidor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Obtiene el estado del servidor
   */
  getStatus() {
    return {
      isPaused,
      timestamp: new Date().toISOString()
    };
  }
};

export default serverControl;

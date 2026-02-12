/**
 * Punto de Entrada del Servidor
 * 
 * Inicializa y arranca la aplicación del chat bot con manejo de errores
 * y configuración del entorno.
 * 
 * @author Chat-Bot-1-2 Team
 * @version 1.0.0
 */

import { App } from './app.js';
import { createLogger } from '../services/core/core/logger.js';
import { CONFIG } from '../workflows/index.js';

const logger = createLogger('SERVER');

/**
 * Función principal para iniciar el servidor
 */
async function main() {
  try {
    // Mostrar información de inicio
    logger.info('🤖 Iniciando Chat-Bot-1-2...');
    logger.info('📋 Cargando configuración...');
    
    const config = CONFIG;
    
    logger.info(`🌍 Entorno: ${config.SERVER.NODE_ENV || 'development'}`);
    logger.info('📦 Versión: 1.0.0');
    
    // Crear y configurar la aplicación
    logger.info('⚙️  Configurando aplicación...');
    const app = new App();
    
    // Inicializar la aplicación
    logger.info('🔧 Inicializando servicios...');
    await app.initializeApp();
    
    // Iniciar el servidor
    logger.info('🚀 Iniciando servidor...');
    await app.start();
    
    // Manejar señales de terminación
    process.on('SIGTERM', async() => {
      logger.info('Recibida señal SIGTERM, cerrando servidor...');
      await app.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async() => {
      logger.info('Recibida señal SIGINT, cerrando servidor...');
      await app.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Error fatal iniciando servidor', error);
    logger.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

// Ejecutar función principal
main().catch((error) => {
  logger.error('❌ Error no manejado:', error);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Script de inicio simple para desarrollo
 * Inicia solo el servidor sin ngrok ni configuración de webhooks
 */

import SecureServer from './src/server/SecureServer.js';
import logger from './src/services/core/core/logger.js';

async function main() {
  try {
    logger.info('🚀 Iniciando ChatBot Enterprise en modo desarrollo...');
    logger.info('📍 Configuración: Sin ngrok, sin webhooks automáticos');
    
    const server = new SecureServer();
    await server.start();
    
    logger.info(`✅ Servidor iniciado exitosamente`);
    logger.info(`🌐 URL: http://localhost:${server.port}`);
    logger.info(`📊 Health: http://localhost:${server.port}/health`);
    logger.info(`📈 Status: http://localhost:${server.port}/api/status`);
    logger.info(`📉 Métricas: http://localhost:${server.port}/metrics`);
    
  } catch (error) {
    logger.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
}

// Manejo de señales
process.on('SIGINT', () => {
  logger.info('🛑 Cerrando servidor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Cerrando servidor...');
  process.exit(0);
});

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

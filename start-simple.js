#!/usr/bin/env node

/**
 * Inicio simple del servidor sin ngrok ni configuración de webhooks
 */

import SecureServer from './src/server/SecureServer.js';
import logger from './src/services/core/core/logger.js';

async function main() {
  try {
    logger.info('🚀 Iniciando servidor en modo simple...');
    
    const server = new SecureServer();
    await server.start();
    
    logger.info(`✅ Servidor iniciado en http://localhost:${server.port}`);
  } catch (error) {
    logger.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

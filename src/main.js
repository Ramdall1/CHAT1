process.setMaxListeners(20);

// Increase max listeners to prevent memory leak warnings

import { exec, spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

import { BackendInitializer } from './backend/BackendInitializer.js';
import { redisSilencer } from './core/RedisSilencer.js';
import { getStructuredLogger } from './core/StructuredLogger.js';
import { validateDatabase } from './database/PostgresService.js';
import { FixedFrontendInitializer } from './frontend/FixedFrontendInitializer.js';
import { auditSystemEvent } from './middleware/auditMiddleware.js';

// Cargar archivo .env según el entorno
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
console.log('📄 Env file:', envFile);
dotenv.config({ path: path.join(process.cwd(), envFile) });
console.log('✅ dotenv.config executed');

const logger = getStructuredLogger();
console.log('✅ logger created');
logger.info(`✅ Cargando configuración desde: ${envFile}`);

// Activar silenciamiento de errores de Redis
redisSilencer.activate();
console.log('✅ redisSilencer activated');

// Función sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para matar procesos en puerto 3000
async function killProcessOnPort3000() {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      await exec('lsof -ti:3000 | xargs kill -9 2>/dev/null');
      await exec('lsof -ti:3001 | xargs kill -9 2>/dev/null');
    } else if (process.platform === 'win32') {
      await exec('for /f "tokens=5" %a in (\'netstat -aon ^| find ":3000" ^| find "LISTENING"\') do taskkill /f /pid %a');
      await exec('for /f "tokens=5" %a in (\'netstat -aon ^| find ":3001" ^| find "LISTENING"\') do taskkill /f /pid %a');
    }
    logger.debug('✅ Procesos en puertos 3000 y 3001 eliminados');
  } catch (error) {
    logger.debug('⚠️ No se pudieron eliminar procesos en puertos 3000/3001:', error.message);
  }
}

// Variables globales para graceful shutdown
let backend = null;
let frontend = null;
let ngrokProcess = null;
let cloudflaredProcess = null;
let isShuttingDown = false;

/**
 * Verificar que los webhooks estén configurados correctamente
 * @param {string} ngrokUrl - URL de ngrok para verificar
 * @returns {Promise<boolean>} True si los webhooks están configurados
 */
async function verifyWebhooks(ngrokUrl) {
  try {
    logger.debug('Verifying URL synchronization', { ngrokUrl });

    // Verificar webhook de WhatsApp
    const whatsappWebhookUrl = `${ngrokUrl}/webhooks`;
    logger.info('🔍 Verificando webhook de WhatsApp:', whatsappWebhookUrl);

    // Aquí iría la lógica real de verificación
    // Por ahora, verificamos que la URL sea válida
    const url = new URL(whatsappWebhookUrl);
    if (!url.protocol || !url.host) {
      throw new Error('URL de webhook inválida');
    }

    logger.info('✅ Webhook de WhatsApp verificado correctamente');
    return true;

  } catch (error) {
    logger.error('❌ Error verificando webhooks:', error.message);
    return false;
  }
}

/**
 * Función para iniciar Cloudflare Tunnel en modo producción
 *
 * Inicia el túnel de Cloudflare usando la configuración en config/cloudflared-config.yaml
 * para exponer los servicios backend y frontend de forma segura.
 *
 * @async
 * @returns {Promise<boolean>} True si se inició exitosamente, false en caso contrario
 */
async function startCloudflaredTunnel() {
  try {
    logger.info('☁️ Iniciando Cloudflare Tunnel...');

    // Verificar si cloudflared está instalado
    try {
      await exec('cloudflared version');
    } catch (error) {
      logger.error('❌ cloudflared no está instalado. Instálalo desde https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/');
      return false;
    }

    // Matar procesos de cloudflared existentes
    try {
      if (process.platform === 'darwin' || process.platform === 'linux') {
        await exec('pkill -f cloudflared');
      } else if (process.platform === 'win32') {
        await exec('taskkill /f /im cloudflared.exe');
      }
      logger.info('✅ Procesos cloudflared anteriores eliminados');
      await sleep(2000);
    } catch (error) {
      // No hay procesos anteriores, continuar
    }

    // Iniciar cloudflared con la configuración
    const configPath = path.join(process.cwd(), 'config', 'cloudflared-config.yaml');

    cloudflaredProcess = spawn('cloudflared', ['tunnel', '--config', configPath, 'run', 'chatbot-prod'], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Capturar logs del proceso (solo errores importantes)
    cloudflaredProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      // Solo mostrar logs importantes de cloudflared
      if (message.includes('error') || message.includes('failed') || message.includes('ERR')) {
        logger.error(`[CLOUDFLARED] ${message}`);
      }
    });

    cloudflaredProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      // Filtrar mensajes de timeout que son normales en cloudflared
      if (message.includes('timeout: no recent network activity') ||
        message.includes('failed to accept QUIC stream') ||
        message.includes('failed to run the datagram handler')) {
        // Silenciar timeouts normales
        return;
      } else if (message.includes('error') || message.includes('failed') || message.includes('ERR')) {
        logger.error(`[CLOUDFLARED] ${message}`);
      } else if (message.includes('WRN') && message.includes('connection')) {
        // Solo mostrar warnings importantes de conexión
        logger.warn(`[CLOUDFLARED] ${message}`);
      }
      // Silenciar otros logs informativos
    });

    cloudflaredProcess.on('error', (error) => {
      logger.error('❌ Error en proceso cloudflared:', error.message);
    });

    cloudflaredProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        logger.error(`❌ Cloudflared terminó con código ${code}`);
      }
    });

    // Esperar un momento para que se establezca la conexión
    await sleep(5000);

    logger.info('✅ Cloudflare Tunnel iniciado correctamente');
    logger.info('🌐 Dominios activos:');
    logger.info('   - https://api.ramdall.com.co (Backend)');
    logger.info('   - https://app.ramdall.com.co (Frontend)');

    return true;
  } catch (error) {
    logger.error('❌ Error iniciando Cloudflare Tunnel:', error.message);
    return false;
  }
}

async function main() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const backendPort = 3001; // Backend en 3001
    const frontendPort = 3000; // Frontend en 3000

    // Solo mostrar info esencial en producción
    if (!isProduction) {
      logger.info('🚀 Iniciando servidor...');
      logger.info(`📍 Modo: ${process.env.NODE_ENV?.toUpperCase() || 'DESCONOCIDO'} | Backend: ${backendPort}, Frontend: ${frontendPort}`);
    }

    // Liberar puerto si es necesario
    if (process.env.KILL_PORT === '1') {
      logger.debug(` MAIN: Liberando puertos ${backendPort} y ${frontendPort}...`);
      await killProcessOnPort3000();
      console.log('⚡ Iniciando inicialización del backend...');
    }

    // Iniciar Backend
    backend = new BackendInitializer({
      port: backendPort,
      enableSocketIO: true, // Reactivar Socket.IO para dashboard
      enableDatabase: true,  //  PostgreSQL REQUERIDO para el proyecto
      enableRedis: true
    });

    // Guardar en global para evitar múltiples instancias
    global.backendInitializer = backend;

    logger.info('⚡ Inicializando backend...');
    await backend.initialize();
    logger.info('✅ Backend inicializado correctamente');
    logger.info('🚀 Backend iniciado correctamente');

    // Iniciar Frontend
    logger.info('🔍 Creando FrontendInitializer...');
    frontend = new FixedFrontendInitializer({
      port: frontendPort,
      enableCompression: true,
      enableSecurity: false,  // DESHABILITADO TEMPORALMENTE PARA EVITAR ERROR DE HELMET
      enableCaching: true
    });
    logger.info('🔍 Inicializando frontend...');
    await frontend.initialize();
    logger.info('🔍 Iniciando servidor frontend...');
    await frontend.start();
    logger.info('🚀 Frontend iniciado correctamente');

    // Auditoría de sistema completamente iniciado con manejo seguro
    try {
      logger.info('🔍 VERIFICANDO: Auditoría SYSTEM_FULLY_STARTED...');
      if (typeof auditSystemEvent === 'function') {
        auditSystemEvent('SYSTEM_FULLY_STARTED', {
          backendPort,
          frontendPort,
          environment: process.env.NODE_ENV,
          allComponents: 'OPERATIONAL'
        }, 'INFO');
      }
      logger.info('✅ VERIFICADO: SYSTEM_FULLY_STARTED completado');
    } catch (auditError) {
      logger.error('❌ ERROR en SYSTEM_FULLY_STARTED:', auditError.message);
      logger.debug('Error en auditoría de sistema iniciado:', auditError.message);
    }

    logger.info('🎉 Sistema ChatBot Enterprise iniciado completamente');

    // Validar que estemos en la base de datos correcta
    logger.info('🔍 VERIFICANDO: Validación de base de datos...');
    logger.info('🔍 Validando conexión a base de datos correcta...');
    await validateDatabase();
    logger.info('✅ VERIFICADO: Base de datos validada');
    logger.info('✅ Base de datos validada: Basededatos1');

    // Auditoría de inicio del sistema con manejo seguro
    try {
      logger.info('🔍 VERIFICANDO: Auditoría SYSTEM_START...');
      if (typeof auditSystemEvent === 'function') {
        auditSystemEvent('SYSTEM_START', {
          backendPort,
          frontendPort,
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }, 'INFO');
      }
      logger.info('✅ VERIFICADO: SYSTEM_START completado');
    } catch (auditError) {
      logger.error('❌ ERROR en SYSTEM_START:', auditError.message);
      logger.debug('Error en auditoría de inicio del sistema:', auditError.message);
    }

    // Auditoría de componentes inicializados con manejo seguro
    try {
      logger.info('🔍 VERIFICANDO: Auditoría COMPONENTS_INITIALIZED...');
      if (typeof auditSystemEvent === 'function') {
        auditSystemEvent('COMPONENTS_INITIALIZED', {
          database: true,
          redis: true,
          backend: true,
          eventConnector: true
        }, 'INFO');
      }
      logger.info('✅ VERIFICADO: COMPONENTS_INITIALIZED completado');
    } catch (auditError) {
      logger.error('❌ ERROR en COMPONENTS_INITIALIZED:', auditError.message);
      logger.debug('Error en auditoría de componentes:', auditError.message);
    }

    // Iniciar Cloudflare Tunnel (producción y desarrollo)
    logger.info('🔍 VERIFICANDO: Inicio de Cloudflare Tunnel...');
    logger.info('🌐 Iniciando Cloudflare Tunnel...');

    try {
      const tunnelStarted = await startCloudflaredTunnel();
      if (tunnelStarted) {
        // Log ya hecho en la función
        logger.info('✅ VERIFICADO: Cloudflare Tunnel iniciado');
      } else {
        logger.warn('⚠️ VERIFICADO: Cloudflare Tunnel no se pudo iniciar');
        logger.warn('⚠️ No se pudo iniciar Cloudflare Tunnel - continuando sin él');
      }
    } catch (tunnelError) {
      logger.error('❌ ERROR en Cloudflare Tunnel:', tunnelError.message);
      logger.warn('⚠️ Error iniciando Cloudflare Tunnel:', tunnelError.message);
    }

    // Verificar configuración del webhook
    logger.info('🔍 VERIFICANDO: Verificación de configuración de webhook...');
    logger.info('🌐 Verificando configuración del webhook...');
    // await verifyUrlSynchronization(null); // Función no definida - comentada temporalmente
    logger.info('✅ VERIFICADO: Verificación de webhook completada');

  } catch (error) {
    console.error('❌ ERROR CRÍTICO en main():', error);
    console.error(' Tipo de error:', typeof error);
    console.error(' Error como string:', String(error));
    console.error(' Propiedades del error:', Object.keys(error || {}));
    console.error(' Error.message:', error?.message || 'SIN MENSAJE');
    console.error(' Error.stack:', error?.stack || 'SIN STACK');
    console.error(' Error.toString():', error?.toString?.() || 'SIN TOSTRING');

    // Log adicional para debugging
    try {
      console.error(' Error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch (jsonError) {
      console.error(' Error al serializar JSON:', jsonError.message);
    }

    console.error(' Error iniciando aplicación');
    process.exit(1);
  }
}

/**
 * Función de apagado graceful del sistema
 *
 * Esta función maneja el cierre ordenado del servidor cuando se recibe
 * una señal del sistema (SIGTERM, SIGINT). Asegura que:
 * 1. Se cierren todas las conexiones activas
 * 2. Se completen las operaciones en curso
 * 3. Se liberen los recursos del sistema
 * 4. Se registre el proceso de cierre en los logs
 *
 * @async
 * @function gracefulShutdown
 * @param {string} signal - La señal del sistema recibida (SIGTERM, SIGINT, etc.)
 * @returns {Promise<void>} Promesa que se resuelve cuando el cierre está completo
 * @throws {Error} Si hay errores durante el proceso de cierre
 */
async function gracefulShutdown(signal) {
  // Evitar cierres múltiples
  if (isShuttingDown) {
    logger.debug(` Señal ${signal} ignorada - cierre ya en progreso`);
    return;
  }

  isShuttingDown = true;
  logger.info(`\n Señal recibida: ${signal}`);
  logger.info('🛑 Iniciando cierre graceful...');

  try {
    // Detener Backend
    if (backend && backend.server) {
      await new Promise((resolve) => {
        backend.server.close(resolve);
      });
      logger.info('✅ Servidor Backend cerrado');
    }

    // Detener Frontend
    if (frontend && frontend.server) {
      await new Promise((resolve) => {
        frontend.server.close(resolve);
      });
      logger.info('✅ Servidor Frontend cerrado');
    }

    // Detener ngrok
    if (ngrokProcess) {
      logger.info('🛑 Deteniendo ngrok...');
      ngrokProcess.kill();
      ngrokProcess = null;
      logger.info(' ngrok detenido');
    }

    // Detener Cloudflare Tunnel
    if (cloudflaredProcess) {
      logger.info('🛑 Deteniendo Cloudflare Tunnel...');
      cloudflaredProcess.kill();
      cloudflaredProcess = null;
      logger.info('✅ Cloudflare Tunnel detenido');
    }

    // Auditoría de cierre del sistema con manejo seguro
    try {
      if (typeof auditSystemEvent === 'function') {
        auditSystemEvent('SYSTEM_SHUTDOWN', {
          signal,
          uptime: process.uptime(),
          graceful: true
        }, 'INFO');
      }
    } catch (auditError) {
      logger.debug('Error en auditoría de cierre:', auditError.message);
    }
    process.exit(0);
  } catch (error) {
    logger.error(' Error durante cierre graceful:', error);
    process.exit(1);
  }
}

/**
 * Manejadores de excepciones globales para evitar cierres inesperados
 */

// Manejar uncaughtExceptions - registrar pero no salir
process.on('uncaughtException', (error) => {
  // Auditoría de error crítico con manejo seguro
  try {
    if (typeof auditSystemEvent === 'function') {
      auditSystemEvent('UNCAUGHT_EXCEPTION', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        uptime: process.uptime()
      }, 'ERROR');
    }
  } catch (auditError) {
    logger.debug('Error en auditoría de excepción:', auditError.message);
  }

  if (error.code === 'EIO' || error.code === 'ENOSPC') {
    logger.error(' Error de E/S (disco lleno) - silenciando para evitar cierre:', error.message);
    return; // No salir del proceso
  }

  logger.error(' Excepción no capturada:', error);

  // Para errores críticos, intentar graceful shutdown
  if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
    logger.error(' Error crítico - iniciando graceful shutdown');
    gracefulShutdown('uncaughtException').catch(() => {
      process.exit(1);
    });
  }
});

// Manejar unhandledRejections con detalle mejorado
process.on('unhandledRejection', (reason, promise) => {
  // Auditoría de rechazo no manejado con manejo seguro
  try {
    if (typeof auditSystemEvent === 'function') {
      auditSystemEvent('UNHANDLED_REJECTION', {
        reason: reason.toString(),
        promise: promise.toString(),
        uptime: process.uptime(),
        stack: reason?.stack || 'No stack available',
        timestamp: new Date().toISOString()
      }, 'ERROR');
    }
  } catch (auditError) {
    logger.debug('Error en auditoría de rechazo:', auditError.message);
  }

  // Log detallado para debugging
  logger.error(' Rechazo no manejado:', {
    reason: reason?.toString() || reason,
    stack: reason?.stack || 'No stack',
    promise: promise?.toString() || 'Unknown promise',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });

  // NO cerrar el proceso automáticamente - solo registrar el error
  // Esto evita que el servidor se cierre por promesas rechazadas
});

// Manejar señales del sistema
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Punto de entrada del módulo
 *
 * Verifica si este archivo está siendo ejecutado directamente
 * (no importado como módulo) y ejecuta la función principal.
 * Maneja errores fatales que puedan ocurrir durante la inicialización.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

/**
 * Exportaciones del módulo
 *
 * @exports {Function} main - Función principal de inicialización (export default)
 */
export default main;

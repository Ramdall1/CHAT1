/**
 * Error Manager - Sistema de captura centralizada de errores
 * Clasificación por severidad, conteo, notificación interna y volcado a logs
 * Versión mejorada con validaciones adicionales y monitoreo avanzado
 * 
 * @author Chat-Bot-1-2 Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../services/core/core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración por defecto mejorada
const DEFAULT_CONFIG = {
  LOG_DIR: process.env.ERROR_LOG_DIR || path.join(__dirname, '../../data/logs'),
  ERROR_LOG_FILE: process.env.ERROR_LOG_FILE || 'error.log',
  MAX_LOG_SIZE: parseInt(process.env.MAX_ERROR_LOG_SIZE) || 10 * 1024 * 1024, // 10MB
  MAX_LOG_FILES: parseInt(process.env.MAX_ERROR_LOG_FILES) || 5,
  NOTIFICATION_THRESHOLD: process.env.ERROR_NOTIFICATION_THRESHOLD || 'error',
  ENABLE_CONSOLE_OUTPUT: process.env.ERROR_CONSOLE_OUTPUT !== 'false',
  BUFFER_SIZE: parseInt(process.env.ERROR_BUFFER_SIZE) || 100,
  FLUSH_INTERVAL: parseInt(process.env.ERROR_FLUSH_INTERVAL) || 5000, // 5 segundos
    
  // Nuevas configuraciones
  ENABLE_METRICS: process.env.ERROR_METRICS_ENABLED !== 'false',
  ALERT_THRESHOLD: parseInt(process.env.ERROR_ALERT_THRESHOLD) || 10, // errores por minuto
  MEMORY_THRESHOLD: parseInt(process.env.ERROR_MEMORY_THRESHOLD) || 100 * 1024 * 1024, // 100MB
  PERFORMANCE_MONITORING: process.env.ERROR_PERFORMANCE_MONITORING === 'true',
  STRUCTURED_LOGGING: process.env.ERROR_STRUCTURED_LOGGING !== 'false'
};

// Niveles de severidad con colores
const SEVERITY_LEVELS = {
  debug: { level: 0, color: '\x1b[36m', emoji: '🔍' },
  info: { level: 1, color: '\x1b[32m', emoji: 'ℹ️' },
  warn: { level: 2, color: '\x1b[33m', emoji: '⚠️' },
  error: { level: 3, color: '\x1b[31m', emoji: '❌' },
  critical: { level: 4, color: '\x1b[35m', emoji: '🚨' }
};

// Estado del manager mejorado
let logger = null;
let isInitialized = false;
let errorBuffer = [];
let errorCounts = {
  debug: 0,
  info: 0,
  warn: 0,
  error: 0,
  critical: 0
};
let errorHistory = []; // Historial para análisis de tendencias
let flushTimer = null;
let logFilePath = '';
const performanceMetrics = {
  totalErrors: 0,
  errorsPerMinute: 0,
  lastMinuteErrors: [],
  memoryUsage: 0,
  startTime: Date.now()
};

/**
 * Inicializa el sistema de gestión de errores con validaciones mejoradas
 */
export async function initializeErrorManager() {
  try {
    // Inicializar logger
    logger = createLogger('ERROR_MANAGER');
        
    // Validar configuración
    if (!validateConfiguration()) {
      throw new Error('Configuración inválida del Error Manager');
    }

    // Crear directorio de logs si no existe
    await fs.mkdir(DEFAULT_CONFIG.LOG_DIR, { recursive: true });
        
    logFilePath = path.join(DEFAULT_CONFIG.LOG_DIR, DEFAULT_CONFIG.ERROR_LOG_FILE);
        
    // Verificar permisos de escritura
    await validateWritePermissions();
        
    // Verificar rotación de logs al iniciar
    await rotateLogIfNeeded();
        
    // Configurar flush automático
    if (flushTimer) {
      clearInterval(flushTimer);
    }
        
    flushTimer = setInterval(async() => {
      try {
        await flushErrorBuffer();
        await updatePerformanceMetrics();
      } catch (error) {
        if (logger) logger.error('Error en flush automático:', error);
      }
    }, DEFAULT_CONFIG.FLUSH_INTERVAL);
        
    // Inicializar métricas de rendimiento
    performanceMetrics.startTime = Date.now();
        
    isInitialized = true;
        
    await logError('info', 'ErrorManager', 'Sistema de gestión de errores inicializado', {
      logDir: DEFAULT_CONFIG.LOG_DIR,
      bufferSize: DEFAULT_CONFIG.BUFFER_SIZE,
      flushInterval: DEFAULT_CONFIG.FLUSH_INTERVAL,
      metricsEnabled: DEFAULT_CONFIG.ENABLE_METRICS,
      performanceMonitoring: DEFAULT_CONFIG.PERFORMANCE_MONITORING
    });
        
    return { success: true, message: 'Error manager inicializado correctamente' };
        
  } catch (error) {
    if (logger) logger.error('❌ Error crítico inicializando ErrorManager:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Valida la configuración del Error Manager
 */
function validateConfiguration() {
  try {
    // Validar tamaños
    if (DEFAULT_CONFIG.MAX_LOG_SIZE < 1024 * 1024) { // Mínimo 1MB
      logger.warn('⚠️ MAX_LOG_SIZE muy pequeño, usando 1MB como mínimo');
      DEFAULT_CONFIG.MAX_LOG_SIZE = 1024 * 1024;
    }

    if (DEFAULT_CONFIG.BUFFER_SIZE < 10) {
      logger.warn('⚠️ BUFFER_SIZE muy pequeño, usando 10 como mínimo');
      DEFAULT_CONFIG.BUFFER_SIZE = 10;
    }

    if (DEFAULT_CONFIG.FLUSH_INTERVAL < 1000) {
      logger.warn('⚠️ FLUSH_INTERVAL muy pequeño, usando 1000ms como mínimo');
      DEFAULT_CONFIG.FLUSH_INTERVAL = 1000;
    }

    return true;
  } catch (error) {
    if (logger) logger.error('Error validando configuración:', error);
    return false;
  }
}

/**
 * Valida permisos de escritura en el directorio de logs
 */
async function validateWritePermissions() {
  try {
    const testFile = path.join(DEFAULT_CONFIG.LOG_DIR, '.write_test');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
  } catch (error) {
    throw new Error(`Sin permisos de escritura en ${DEFAULT_CONFIG.LOG_DIR}: ${error.message}`);
  }
}

/**
 * Registra un error en el sistema con validaciones mejoradas
 * @param {string} severity - Nivel de severidad (debug, info, warn, error, critical)
 * @param {string} module - Módulo que genera el error
 * @param {string} message - Mensaje del error
 * @param {object} metadata - Metadatos adicionales
 * @param {Error} errorObj - Objeto Error original (opcional)
 */
export async function logError(severity = 'error', module = 'Unknown', message = '', metadata = {}, errorObj = null) {
  try {
    // Validaciones de entrada mejoradas
    if (typeof severity !== 'string' || !SEVERITY_LEVELS.hasOwnProperty(severity)) {
      severity = 'error';
    }
        
    if (typeof module !== 'string' || module.trim() === '') {
      module = 'Unknown';
    }
        
    if (typeof message !== 'string') {
      message = String(message || 'Sin mensaje');
    }
        
    if (typeof metadata !== 'object' || metadata === null) {
      metadata = {};
    }
        
    // Crear entrada de error estructurada
    const errorEntry = {
      id: generateErrorId(),
      timestamp: new Date().toISOString(),
      severity,
      module: module.trim(),
      message: message.trim(),
      metadata: sanitizeMetadata(metadata),
      stack: errorObj?.stack || null,
      errorCode: errorObj?.code || null,
      errorName: errorObj?.name || null,
      processInfo: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version
      }
    };
        
    // Agregar información de rendimiento si está habilitado
    if (DEFAULT_CONFIG.PERFORMANCE_MONITORING) {
      errorEntry.performance = {
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };
    }
        
    // Incrementar contadores
    errorCounts[severity]++;
    performanceMetrics.totalErrors++;
        
    // Agregar al historial para análisis de tendencias
    errorHistory.push({
      timestamp: Date.now(),
      severity,
      module
    });
        
    // Mantener solo los últimos 1000 errores en memoria
    if (errorHistory.length > 1000) {
      errorHistory = errorHistory.slice(-1000);
    }
        
    // Agregar al buffer
    errorBuffer.push(errorEntry);
        
    // Verificar si necesitamos flush inmediato
    const shouldFlushImmediately = 
            severity === 'critical' || 
            errorBuffer.length >= DEFAULT_CONFIG.BUFFER_SIZE ||
            await checkAlertThreshold();
        
    if (shouldFlushImmediately) {
      await flushErrorBuffer();
    }
        
    // Output a consola si está habilitado
    if (DEFAULT_CONFIG.ENABLE_CONSOLE_OUTPUT) {
      outputToConsole(errorEntry);
    }
        
    // Verificar alertas críticas
    if (severity === 'critical') {
      await handleCriticalError(errorEntry);
    }
        
    return errorEntry.id;
        
  } catch (error) {
    // Fallback para errores en el sistema de logging
    if (logger) {
      logger.error('❌ Error crítico en logError:', error);
      logger.error('Datos originales:', { severity, module, message, metadata });
    }
    return null;
  }
}

/**
 * Sanitiza metadatos para evitar problemas de serialización
 */
function sanitizeMetadata(metadata) {
  try {
    // Crear copia profunda y sanitizar
    const sanitized = JSON.parse(JSON.stringify(metadata, (key, value) => {
      // Filtrar valores problemáticos
      if (typeof value === 'function') return '[Function]';
      if (value instanceof Error) return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
      if (typeof value === 'symbol') return value.toString();
      if (typeof value === 'undefined') return null;
            
      // Limitar tamaño de strings
      if (typeof value === 'string' && value.length > 1000) {
        return value.substring(0, 1000) + '... [truncated]';
      }
            
      return value;
    }));
        
    return sanitized;
  } catch (error) {
    return { sanitizationError: error.message, originalType: typeof metadata };
  }
}

/**
 * Verifica si se ha alcanzado el umbral de alerta
 */
async function checkAlertThreshold() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
    
  // Filtrar errores del último minuto
  const recentErrors = errorHistory.filter(error => error.timestamp > oneMinuteAgo);
    
  return recentErrors.length >= DEFAULT_CONFIG.ALERT_THRESHOLD;
}

/**
 * Maneja errores críticos con acciones especiales
 */
async function handleCriticalError(errorEntry) {
  try {
    // Log inmediato para errores críticos
    const criticalLogPath = path.join(DEFAULT_CONFIG.LOG_DIR, 'critical.log');
    const logLine = `${errorEntry.timestamp} [CRITICAL] ${errorEntry.module}: ${errorEntry.message}\n`;
        
    await fs.appendFile(criticalLogPath, logLine);
        
    // Notificación especial en consola
    if (logger) {
      logger.error('\n🚨 ERROR CRÍTICO DETECTADO 🚨');
      logger.error('═'.repeat(50));
      logger.error(`Módulo: ${errorEntry.module}`);
      logger.error(`Mensaje: ${errorEntry.message}`);
      logger.error(`Timestamp: ${errorEntry.timestamp}`);
      logger.error('═'.repeat(50));
    }
        
    // Aquí se podrían agregar notificaciones adicionales
    // como envío de emails, webhooks, etc.
        
  } catch (error) {
    if (logger) logger.error('Error manejando error crítico:', error);
  }
}

/**
 * Output mejorado a consola con colores y formato
 */
function outputToConsole(errorEntry) {
  const severityInfo = SEVERITY_LEVELS[errorEntry.severity];
  const color = severityInfo.color;
  const emoji = severityInfo.emoji;
  const reset = '\x1b[0m';
    
  if (DEFAULT_CONFIG.STRUCTURED_LOGGING) {
    logger.info(`${color}${emoji} [${errorEntry.severity.toUpperCase()}] ${errorEntry.module}${reset}: ${errorEntry.message}`);
    if (errorEntry.metadata && Object.keys(errorEntry.metadata).length > 0) {
      logger.info(`${color}   Metadata:${reset}`, errorEntry.metadata);
    }
  } else {
    logger.info(`${color}${emoji} ${errorEntry.timestamp} [${errorEntry.severity.toUpperCase()}] ${errorEntry.module}: ${errorEntry.message}${reset}`);
  }
}

/**
 * Actualiza métricas de rendimiento
 */
async function updatePerformanceMetrics() {
  try {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
        
    // Calcular errores por minuto
    performanceMetrics.lastMinuteErrors = errorHistory.filter(error => error.timestamp > oneMinuteAgo);
    performanceMetrics.errorsPerMinute = performanceMetrics.lastMinuteErrors.length;
        
    // Actualizar uso de memoria
    const memUsage = process.memoryUsage();
    performanceMetrics.memoryUsage = memUsage.heapUsed;
        
    // Verificar si el uso de memoria es excesivo
    if (memUsage.heapUsed > DEFAULT_CONFIG.MEMORY_THRESHOLD) {
      await logError('warn', 'ErrorManager', 'Uso de memoria elevado detectado', {
        currentMemory: memUsage.heapUsed,
        threshold: DEFAULT_CONFIG.MEMORY_THRESHOLD,
        memoryDetails: memUsage
      });
    }
        
  } catch (error) {
    if (logger) logger.error('Error actualizando métricas de rendimiento:', error);
  }
}

/**
 * Vuelca el buffer de errores al archivo de log
 */
async function flushErrorBuffer() {
  if (errorBuffer.length === 0) return;
    
  // Verificar si el error manager está inicializado
  if (!isInitialized || !logFilePath) {
    // Si no está inicializado, solo mostrar en consola
    const errors = [...errorBuffer];
    errorBuffer = [];
        
    errors.forEach(error => {
      logger.info(`${error.timestamp} [${error.severity.toUpperCase()}] ${error.module}: ${error.message}`);
    });
    return;
  }
    
  try {
    const errors = [...errorBuffer];
    errorBuffer = [];
        
    const logLines = errors.map(error => {
      if (DEFAULT_CONFIG.STRUCTURED_LOGGING) {
        return JSON.stringify(error);
      } else {
        return `${error.timestamp} [${error.severity.toUpperCase()}] ${error.module}: ${error.message}`;
      }
    }).join('\n') + '\n';
        
    await fs.appendFile(logFilePath, logLines);
        
    // Verificar rotación después de escribir
    await rotateLogIfNeeded();
        
  } catch (error) {
    if (logger) logger.error('❌ Error en flush del buffer:', error);
    // No restaurar para evitar bucles infinitos
  }
}

/**
 * Rota el archivo de log si excede el tamaño máximo
 */
async function rotateLogIfNeeded() {
  try {
    const stats = await fs.stat(logFilePath).catch(() => null);
        
    if (stats && stats.size > DEFAULT_CONFIG.MAX_LOG_SIZE) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = path.join(
        DEFAULT_CONFIG.LOG_DIR,
        `error_${timestamp}.log`
      );
            
      // Mover archivo actual
      await fs.rename(logFilePath, rotatedPath);
            
      // Limpiar archivos antiguos
      await cleanupOldLogs();
    }
        
  } catch (error) {
    if (logger) logger.error('Error rotando logs:', error);
  }
}

/**
 * Limpia archivos de log antiguos según la política de retención
 */
async function cleanupOldLogs() {
  try {
    const files = await fs.readdir(DEFAULT_CONFIG.LOG_DIR);
    const logFiles = files
      .filter(file => file.startsWith('error_') && file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(DEFAULT_CONFIG.LOG_DIR, file),
        time: fs.stat(path.join(DEFAULT_CONFIG.LOG_DIR, file)).then(s => s.mtime)
      }));
        
    // Resolver promesas de tiempo
    for (const logFile of logFiles) {
      logFile.time = await logFile.time;
    }
        
    // Ordenar por fecha (más reciente primero)
    logFiles.sort((a, b) => b.time - a.time);
        
    // Eliminar archivos excedentes
    if (logFiles.length > DEFAULT_CONFIG.MAX_LOG_FILES) {
      const filesToDelete = logFiles.slice(DEFAULT_CONFIG.MAX_LOG_FILES);
            
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
      }
    }
        
  } catch (error) {
    if (logger) logger.error('Error limpiando logs antiguos:', error);
  }
}

/**
 * Obtiene estadísticas mejoradas del sistema de errores
 */
export function getErrorStats() {
  const uptime = Date.now() - performanceMetrics.startTime;
    
  return {
    counts: { ...errorCounts },
    performance: {
      ...performanceMetrics,
      uptime,
      errorsPerHour: Math.round((performanceMetrics.totalErrors / uptime) * 3600000),
      bufferSize: errorBuffer.length
    },
    configuration: {
      bufferSize: DEFAULT_CONFIG.BUFFER_SIZE,
      flushInterval: DEFAULT_CONFIG.FLUSH_INTERVAL,
      metricsEnabled: DEFAULT_CONFIG.ENABLE_METRICS,
      performanceMonitoring: DEFAULT_CONFIG.PERFORMANCE_MONITORING
    },
    health: {
      isInitialized,
      memoryUsage: process.memoryUsage(),
      logFileExists: logFilePath ? true : false
    }
  };
}

/**
 * Obtiene análisis de tendencias de errores
 */
export function getErrorTrends(timeWindow = 3600000) { // 1 hora por defecto
  const now = Date.now();
  const windowStart = now - timeWindow;
    
  const recentErrors = errorHistory.filter(error => error.timestamp > windowStart);
    
  // Agrupar por severidad
  const bySeverity = recentErrors.reduce((acc, error) => {
    acc[error.severity] = (acc[error.severity] || 0) + 1;
    return acc;
  }, {});
    
  // Agrupar por módulo
  const byModule = recentErrors.reduce((acc, error) => {
    acc[error.module] = (acc[error.module] || 0) + 1;
    return acc;
  }, {});
    
  return {
    timeWindow,
    totalErrors: recentErrors.length,
    bySeverity,
    byModule,
    trend: calculateTrend(recentErrors)
  };
}

/**
 * Calcula tendencia de errores
 */
function calculateTrend(errors) {
  if (errors.length < 2) return 'stable';
    
  const halfPoint = Math.floor(errors.length / 2);
  const firstHalf = errors.slice(0, halfPoint).length;
  const secondHalf = errors.slice(halfPoint).length;
    
  if (secondHalf > firstHalf * 1.2) return 'increasing';
  if (secondHalf < firstHalf * 0.8) return 'decreasing';
  return 'stable';
}

/**
 * Obtiene errores recientes del buffer
 * @param {number} limit - Número máximo de errores a retornar
 * @param {string} severity - Filtrar por severidad (opcional)
 */
export function getRecentErrors(limit = 50, severity = null) {
  let errors = [...errorBuffer];
    
  if (severity && SEVERITY_LEVELS.hasOwnProperty(severity)) {
    errors = errors.filter(error => error.severity.toLowerCase() === severity);
  }
    
  return errors
    .slice(-limit)
    .reverse(); // Más recientes primero
}

/**
 * Lee errores del archivo de log
 * @param {number} lines - Número de líneas a leer desde el final
 */
export async function readErrorLog(lines = 100) {
  try {
    const content = await fs.readFile(logFilePath, 'utf8').catch(() => '');
    const logLines = content.trim().split('\n').filter(line => line.trim());
        
    const recentLines = logLines.slice(-lines);
    const errors = [];
        
    for (const line of recentLines) {
      try {
        errors.push(JSON.parse(line));
      } catch (e) {
        // Línea malformada, ignorar
      }
    }
        
    return { success: true, errors: errors.reverse() };
        
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Reinicia contadores de errores
 */
export function resetErrorCounts() {
  errorCounts = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    critical: 0
  };
    
  return { success: true, message: 'Contadores de errores reiniciados' };
}

/**
 * Fuerza el volcado del buffer
 */
export async function forceFlush() {
  await flushErrorBuffer();
  return { success: true, message: 'Buffer volcado forzosamente' };
}

/**
 * Genera un ID único para el error
 */
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Wrapper para capturar errores de funciones asíncronas
 * @param {Function} fn - Función a ejecutar
 * @param {string} module - Módulo que ejecuta la función
 * @param {object} context - Contexto adicional
 */
export async function catchAsync(fn, module = 'Unknown', context = {}) {
  try {
    return await fn();
  } catch (error) {
    await logError('error', module, error.message, context, error);
    throw error;
  }
}

/**
 * Wrapper para capturar errores de funciones síncronas
 * @param {Function} fn - Función a ejecutar
 * @param {string} module - Módulo que ejecuta la función
 * @param {object} context - Contexto adicional
 */
export function catchSync(fn, module = 'Unknown', context = {}) {
  try {
    return fn();
  } catch (error) {
    logError('error', module, error.message, context, error);
    throw error;
  }
}

/**
 * Cierre limpio del sistema
 */
export async function shutdown() {
  try {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
        
    // Flush final
    await flushErrorBuffer();
        
    await logError('info', 'ErrorManager', 'Sistema de gestión de errores cerrado');
        
    // Flush final después del log de cierre
    await flushErrorBuffer();
        
    isInitialized = false;
        
    return { success: true, message: 'Error manager cerrado correctamente' };
        
  } catch (error) {
    if (logger) logger.error('Error cerrando ErrorManager:', error);
    return { success: false, error: error.message };
  }
}

// Manejo de señales del sistema
process.on('SIGINT', async() => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async() => {
  await shutdown();
  process.exit(0);
});

// Captura de errores no manejados
process.on('uncaughtException', async(error) => {
  await logError('critical', 'Process', 'Excepción no capturada', {}, error);
  await forceFlush();
  process.exit(1);
});

process.on('unhandledRejection', async(reason, promise) => {
  await logError('critical', 'Process', 'Promesa rechazada no manejada', { 
    reason: reason?.toString(),
    promise: promise?.toString()
  });
  await forceFlush();
});

// Exportar instancia singleton
export default {
  initializeErrorManager,
  logError,
  getErrorStats,
  getRecentErrors,
  readErrorLog,
  resetErrorCounts,
  forceFlush,
  catchAsync,
  catchSync,
  shutdown
};
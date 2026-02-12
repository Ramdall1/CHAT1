/**
 * @fileoverview Rutas centralizadas del servidor
 * Extraídas de server.js para mejorar la modularidad
 */

import express from 'express';
import path from 'path';
import { createApiRouter } from '../../apps/api/src/routes/index.js';

// Importar middleware de autenticación centralizado
import { requireAuth, initializeSecurityMonitor, trackSecurity, isAuthenticated } from '../middleware/auth.middleware.js';

// Importar middleware de rate limiting
import {
  generalRateLimit,
  authRateLimit,
  apiRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  attackPatternDetection,
  requestVelocityMonitor
} from '../middleware/rateLimiting.middleware.js';

// Importar routers modulares ESENCIALES
import webhooksRouter from '../api/routes/webhooks.js';
import healthRouter from '../../apps/api/src/routes/health.js';
import authRoutes from '../api/routes/authRoutes.js';
import customFieldsRouter, { initializeCustomFields } from '../api/routes/customFieldsRoutes.js';
import campaignsRouter from '../api/routes/campaignsRoutes.js';
import contactRoutes from '../api/routes/contactRoutes.js';
import dialog360Router from '../api/routes/dialog360Routes.js';
import serverRoutes from '../api/routes/serverRoutes.js';

/**
 * Configurar rutas de autenticación y páginas principales
 */
export function setupAuthRoutes(app) {
  // Aplicar rate limiting específico para rutas de autenticación
  app.use('/login', authRateLimit);
  app.use('/auth', authRateLimit);
  app.use('/register', registrationRateLimit);
  app.use('/password-reset', passwordResetRateLimit);
  app.use('/forgot-password', passwordResetRateLimit);

  // NOTA: Las rutas principales están configuradas en SecureServer.js
  // No duplicar rutas aquí para evitar conflictos
}

/**
 * Configurar rutas de páginas estáticas protegidas
 */
export function setupStaticPageRoutes(app) {
  // NOTA: Las rutas de páginas están configuradas en SecureServer.js
  // Aquí solo se configuran rutas especiales si es necesario
  
  // Campañas Mejoradas (TEMPORAL: sin requireAuth para pruebas)
  app.get('/campaigns-improved.html', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'campaigns-improved.html'));
  });
  
  // Middleware para manejar rutas no encontradas (debe ir al final)
  app.use(async (req, res, next) => {
    // Excluir rutas de API y archivos estáticos
    if (req.path.startsWith('/api') || 
        req.path.startsWith('/public') || 
        req.path.startsWith('/assets') ||
        req.path.startsWith('/css') ||
        req.path.startsWith('/js') ||
        req.path.includes('.')) {
      return next();
    }

    // Para rutas de páginas, redirigir al dashboard (login desactivado)
    res.redirect('/dashboard');
  });
}

/**
 * Configurar rutas de archivos de datos
 */
export function setupDataRoutes(app) {
  // Rutas de datos eliminadas - ahora todos los datos vienen de SQLite
  // Los endpoints /data/messages.json y /data/contacts.json han sido removidos
}

/**
 * Configurar rutas de API modulares ESENCIALES
 */
export async function setupApiRoutes(app, io) {
  // Inicializar campos personalizados
  await initializeCustomFields();
  
  // Aplicar rate limiting específico para APIs
  app.use('/api', apiRateLimit);
  app.use('/webhooks', apiRateLimit);
  
  // Webhooks 360Dialog (CRÍTICO) - Solo una ruta principal
  app.use('/api/webhooks', webhooksRouter);
  
  // Health Check
  app.use('/api/health', healthRouter);
  
  // Autenticación
  app.use('/api/auth', authRoutes);
  
  // Contactos
  app.use('/api/contacts', contactRoutes);
  
  // Campañas
  app.use('/api/campaigns', campaignsRouter);
  
  // 360Dialog API
  app.use('/api/360dialog', dialog360Router);

  // Server Control
  app.use('/api/server', serverRoutes);
  
  // Campos Personalizados (montado en /api para que tenga acceso a /api/custom-fields y /api/contacts/:contactId/custom-fields)
  app.use('/api', customFieldsRouter);
  
  // Router principal de API (DESPUÉS de los routers específicos)
  const { router: apiRouter, db } = createApiRouter(io);
  app.use('/api', apiRouter);
  
  return { db };
}

/**
 * Configurar todas las rutas del servidor
 */
export async function setupAllRoutes(app, io) {
  // SEGURIDAD COMPLETAMENTE DESHABILITADA
  logger.debug('🔓 Seguridad completamente deshabilitada - middlewares de seguridad omitidos');

  // Inicializar SecurityMonitor básico (sin alertas)
  const securityMonitor = initializeSecurityMonitor({
    alertThresholds: {
      failedLogins: 1000, // Umbrales muy altos para evitar alertas
      suspiciousIPs: 1000,
      rateLimitViolations: 1000,
      bruteForceAttempts: 1000,
      anomalousActivity: 1000
    },
    monitoringInterval: 300000, // Intervalo muy largo (5 minutos)
    enableRealTimeAlerts: false // Alertas deshabilitadas
  });

  // NO aplicar middlewares de seguridad
  // app.use(attackPatternDetection);
  // app.use(requestVelocityMonitor);
  // app.use(generalRateLimit);
  // app.use(trackSecurity);
  
  // Configurar rutas de autenticación PRIMERO
  setupAuthRoutes(app);
  
  // Configurar rutas de páginas estáticas
  setupStaticPageRoutes(app);
  
  // Configurar rutas de datos
  setupDataRoutes(app);
  
  // Configurar rutas de API (async)
  const { db } = await setupApiRoutes(app, io);
  
  return { db, securityMonitor };
}

export default {
  setupAuthRoutes,
  setupStaticPageRoutes,
  setupDataRoutes,
  setupApiRoutes,
  setupAllRoutes
};
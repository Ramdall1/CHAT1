/**
 * @fileoverview Middleware centralizado del servidor
 * Extraído de server.js para mejorar la modularidad
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import multer from 'multer';
import AdvancedSecurity from '../services/auth/AdvancedSecurity.js';
import PaginationMiddleware from '../api/middleware/PaginationMiddleware.js';
import cacheService from '../services/core/core/CacheService.js';
import { 
  SECURITY_CONFIG, 
  COMPRESSION_CONFIG, 
  PAGINATION_CONFIG, 
  MULTER_CONFIG,
  DIRECTORIES 
} from '../config/server.config.js';

/**
 * Configurar middleware de seguridad
 */
export function setupSecurityMiddleware() {
  return new AdvancedSecurity({
    jwtSecret: process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#',
    ...SECURITY_CONFIG
  });
}

/**
 * Configurar middleware de paginación
 */
export function setupPaginationMiddleware() {
  return new PaginationMiddleware({
    ...PAGINATION_CONFIG,
    cacheService: cacheService
  });
}

/**
 * Configurar almacenamiento de multer
 */
export function setupMulterStorage() {
  return multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, DIRECTORIES.UPLOADS_DIR);
    },
    filename: function(req, file, cb) {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      cb(null, `${timestamp}_${file.originalname}`);
    }
  });
}

/**
 * Configurar multer con configuración personalizada
 */
export function setupMulter() {
  const storage = setupMulterStorage();
  return multer({ 
    storage: storage,
    ...MULTER_CONFIG
  });
}

/**
 * Aplicar middleware básico a la aplicación Express
 */
export function applyBasicMiddleware(app) {
  // Middleware de archivos estáticos
  app.use(express.static(path.join(process.cwd(), 'public'), {
    index: false,
    extensions: ['html']
  }));
  app.use('/public', express.static(path.join(process.cwd(), 'public')));
  app.use('/client', express.static(DIRECTORIES.CLIENT_DIR));
  app.use('/data', express.static(DIRECTORIES.DATA_DIR));

  // Middleware básico
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  
  // Middleware de compresión
  app.use(compression(COMPRESSION_CONFIG));
}

/**
 * Aplicar middleware de seguridad a la aplicación Express
 */
export function applySecurityMiddleware(app, advancedSecurity) {
  app.use(advancedSecurity.getRateLimitMiddleware());
  app.use(advancedSecurity.getHelmetMiddleware());
}

/**
 * Configurar todos los middlewares de la aplicación
 */
export function setupAllMiddleware(app) {
  // Configurar middleware básico
  applyBasicMiddleware(app);
  
  // Configurar middleware de seguridad
  const advancedSecurity = setupSecurityMiddleware();
  applySecurityMiddleware(app, advancedSecurity);
  
  // Configurar middleware de paginación
  const paginationMiddleware = setupPaginationMiddleware();
  
  // Configurar multer
  const upload = setupMulter();
  
  // Hacer disponibles globalmente
  global.advancedSecurity = advancedSecurity;
  
  return {
    advancedSecurity,
    paginationMiddleware,
    upload
  };
}

export default {
  setupSecurityMiddleware,
  setupPaginationMiddleware,
  setupMulterStorage,
  setupMulter,
  applyBasicMiddleware,
  applySecurityMiddleware,
  setupAllMiddleware
};
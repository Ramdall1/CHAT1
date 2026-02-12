/**
 * @fileoverview Middleware de Autenticación
 * 
 * Middleware centralizado para manejo de autenticación JWT,
 * extraído del archivo server.js monolítico para mejorar la modularidad.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import jwt from 'jsonwebtoken';
import { createLogger } from '../services/core/core/logger.js';

const logger = createLogger('AUTH_MIDDLEWARE');

/**
 * Configuración de autenticación
 */
const AUTH_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#',
  EXCLUDED_PATHS: [
    '/login',
    '/auth/login',
    '/auth/refresh',
    '/authRoutes/login',
    '/authRoutes/refresh',
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/register',
    '/whatsapp/webhook',
    '/api/webhook/360dialog',
    '/webhooks',
    '/webhooks/360dialog',
    '/data/messages',
    '/data/contacts',
    '/dashboard/metrics',
    '/dashboard/status',
    '/dashboard/activity',
    '/dashboard/stats',
    '/dashboard/alerts',
    '/dashboard/export',
    '/messages/updates',
    '/health',
    '/360dialog/status',
    '/360dialog/templates',
    '/api/chat-live/conversations',
    '/api/chat-live/stats',
    '/api/chat-live/typing',
    '/api/conversations',
    '/api/data/messages',
    '/api/data/contacts',
    '/css',
    '/js',
    '/client',
    '/favicon.ico'
  ]
};

/**
 * Middleware de autenticación JWT
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const authenticateToken = (req, res, next) => {
  try {
    // Verificar si la ruta está excluida de autenticación
    const isExcluded = AUTH_CONFIG.EXCLUDED_PATHS.some(path => 
      req.path.startsWith(path)
    );

    if (isExcluded) {
      return next();
    }

    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.warn(`Acceso no autorizado a ${req.path} - Token faltante`);
      return res.status(401).json({
        success: false,
        error: 'Token de acceso requerido'
      });
    }

    // Verificar token
    jwt.verify(token, AUTH_CONFIG.JWT_SECRET, (err, user) => {
      if (err) {
        logger.warn(`Token inválido para ${req.path}: ${err.message}`);
        return res.status(403).json({
          success: false,
          error: 'Token inválido o expirado'
        });
      }

      // Agregar información del usuario al request
      req.user = user;
      logger.debug(`Usuario ${user.username} autenticado para ${req.path}`);
      next();
    });

  } catch (error) {
    logger.error('Error en middleware de autenticación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Middleware de autorización por roles
 * 
 * @param {Array} allowedRoles - Roles permitidos
 * @returns {Function} Middleware function
 */
export const authorizeRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
      }

      if (allowedRoles.length === 0) {
        return next();
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn(`Usuario ${req.user.username} sin permisos para ${req.path}`);
        return res.status(403).json({
          success: false,
          error: 'Permisos insuficientes'
        });
      }

      next();
    } catch (error) {
      logger.error('Error en middleware de autorización:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  };
};

/**
 * Middleware para validar API Key (para webhooks externos)
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const validateApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      logger.warn('API Key no configurada en el servidor');
      return next(); // Continuar si no hay API key configurada
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key requerida'
      });
    }

    if (apiKey !== validApiKey) {
      logger.warn(`API Key inválida desde ${req.ip}`);
      return res.status(403).json({
        success: false,
        error: 'API Key inválida'
      });
    }

    next();
  } catch (error) {
    logger.error('Error en validación de API Key:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Middleware para rate limiting básico
 * 
 * @param {Object} options - Opciones de rate limiting
 * @returns {Function} Middleware function
 */
export const rateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutos
    maxRequests = 100,
    message = 'Demasiadas solicitudes, intente más tarde'
  } = options;

  const requests = new Map();

  return (req, res, next) => {
    try {
      const key = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Limpiar requests antiguos
      if (requests.has(key)) {
        const userRequests = requests.get(key).filter(time => time > windowStart);
        requests.set(key, userRequests);
      }

      // Obtener requests actuales del usuario
      const userRequests = requests.get(key) || [];

      if (userRequests.length >= maxRequests) {
        logger.warn(`Rate limit excedido para IP ${key}`);
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Agregar request actual
      userRequests.push(now);
      requests.set(key, userRequests);

      next();
    } catch (error) {
      logger.error('Error en rate limiting:', error);
      next(); // Continuar en caso de error
    }
  };
};

// Exportación específica para el servidor
export const authMiddleware = authenticateToken;

export default {
  authenticateToken,
  authorizeRoles,
  validateApiKey,
  rateLimit
};
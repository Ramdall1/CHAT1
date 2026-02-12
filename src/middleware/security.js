/**
 * @fileoverview Middleware de Seguridad
 * 
 * Middleware centralizado para manejo de seguridad HTTP,
 * extraído del archivo server.js monolítico para mejorar la modularidad.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import helmet from 'helmet';
import cors from 'cors';
import { createLogger } from '../services/core/core/logger.js';

const logger = createLogger('SECURITY_MIDDLEWARE');

/**
 * Configuración de CORS
 */
const CORS_CONFIG = {
  origin: process.env.NODE_ENV === 'production' ? 
    (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000']) :
    true, // Permitir todos los orígenes en desarrollo
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

/**
 * Configuración de Helmet para seguridad HTTP
 */
const HELMET_CONFIG = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://stackpath.bootstrapcdn.com"
      ],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://stackpath.bootstrapcdn.com"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "blob:", "data:"], // Permitir videos y audios desde blob y data URLs
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://stackpath.bootstrapcdn.com"
      ],
      connectSrc: ["'self'", "wss:", "ws:", "https:", "http:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      scriptSrcAttr: ["'unsafe-inline'"], // Permitir scripts inline en atributos
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
};

/**
 * Middleware de CORS configurado
 */
export const corsMiddleware = cors(CORS_CONFIG);

/**
 * Middleware de Helmet para seguridad HTTP
 */
export const helmetMiddleware = helmet(HELMET_CONFIG);

/**
 * Middleware para logging de requests
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || 'Unknown';

  // Log del request entrante
  logger.info(`${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`);

  // Interceptar la respuesta para logging
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Log de la respuesta
    logger.info(`${method} ${url} - ${statusCode} - ${duration}ms`);
    
    // Log de errores (4xx, 5xx)
    if (statusCode >= 400) {
      logger.warn(`Error Response: ${method} ${url} - ${statusCode} - ${duration}ms`);
    }
    
    originalSend.call(res, data);
  };

  next();
};

/**
 * Middleware para validación de Content-Type
 * 
 * @param {Array} allowedTypes - Tipos de contenido permitidos
 * @returns {Function} Middleware function
 */
export const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    // Solo validar para métodos que envían datos
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const contentType = req.get('Content-Type');
    
    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: 'Content-Type header requerido'
      });
    }

    const isValidType = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isValidType) {
      return res.status(415).json({
        success: false,
        error: `Content-Type no soportado. Tipos permitidos: ${allowedTypes.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Middleware para sanitización de headers
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const sanitizeHeaders = (req, res, next) => {
  try {
    // Remover headers potencialmente peligrosos
    const dangerousHeaders = [
      'x-forwarded-host',
      'x-forwarded-server',
      'x-real-ip'
    ];

    dangerousHeaders.forEach(header => {
      if (req.headers[header]) {
        delete req.headers[header];
      }
    });

    // Agregar headers de seguridad a la respuesta
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    next();
  } catch (error) {
    logger.error('Error en sanitización de headers:', error);
    next();
  }
};

/**
 * Middleware para manejo de errores de seguridad
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const securityErrorHandler = (err, req, res, next) => {
  // Log del error de seguridad
  logger.error('Error de seguridad:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Respuesta genérica para no exponer información sensible
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Middleware para validación de tamaño de payload
 * 
 * @param {Object} options - Opciones de validación
 * @returns {Function} Middleware function
 */
export const validatePayloadSize = (options = {}) => {
  const { maxSize = '10mb' } = options;
  
  return (req, res, next) => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        logger.warn(`Payload demasiado grande: ${sizeInBytes} bytes desde ${req.ip}`);
        return res.status(413).json({
          success: false,
          error: 'Payload demasiado grande',
          maxSize: maxSize
        });
      }
    }
    
    next();
  };
};

/**
 * Función auxiliar para parsear tamaños
 * 
 * @param {String} size - Tamaño en formato string (ej: "10mb")
 * @returns {Number} Tamaño en bytes
 */
function parseSize(size) {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)$/);
  if (!match) return 0;
  
  const [, value, unit] = match;
  return parseFloat(value) * units[unit];
}

/**
 * Middleware específico para Safari que ajusta la configuración
 * para mejorar la compatibilidad con el navegador
 */
export const safariCompatibilityMiddleware = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  
  if (isSafari) {
    logger.info('Safari detectado, aplicando configuración de compatibilidad');
    
    // Agregar headers específicos para Safari
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:3000');
    res.setHeader('Vary', 'Origin');
    
    // Headers adicionales para prevenir problemas de ITP
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Marcar la request como Safari para uso posterior
    req.isSafari = true;
  }
  
  next();
};

export default {
  corsMiddleware,
  helmetMiddleware,
  requestLogger,
  validateContentType,
  sanitizeHeaders,
  securityErrorHandler,
  validatePayloadSize,
  safariCompatibilityMiddleware
};
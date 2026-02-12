import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import cors from 'cors';
import joi from 'joi';
import { createLogger } from '../logger.js';

const logger = createLogger('SECURITY_MANAGER');

class SecurityManager {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || this.generateSecureSecret();
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateSecureSecret();
    this.saltRounds = 12;
    this.tokenExpiry = '24h';
    this.refreshTokenExpiry = '7d';
        
    // Configuración de rate limiting por niveles
    this.rateLimitConfigs = {
      strict: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 requests per 15 minutes
      moderate: process.env.NODE_ENV === 'development'
        ? { windowMs: 1 * 60 * 1000, max: 1000 } // 1000 requests per minute in development
        : { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes in production
      lenient: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests per 15 minutes
      api: { windowMs: 1 * 60 * 1000, max: 60 }, // 60 requests per minute for API
      auth: { windowMs: 15 * 60 * 1000, max: 5 } // 5 auth attempts per 15 minutes
    };
  }

  // Generación de secretos seguros
  generateSecureSecret(length = 64) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Configuración de CORS restrictivo
  getCorsConfig() {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];

    if (process.env.NODE_ENV === 'production') {
      allowedOrigins.push(
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL
      );
    }

    return {
      origin: (origin, callback) => {
        // Permitir requests sin origin (mobile apps, postman, etc.)
        if (!origin) return callback(null, true);
                
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('No permitido por CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'x-internal-token',
        'x-api-key'
      ],
      exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
      maxAge: 86400 // 24 hours
    };
  }

  // Configuración de Helmet para seguridad de headers
  getHelmetConfig() {
    return {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ['\'self\''],
          styleSrc: [
            '\'self\'', 
            '\'unsafe-inline\'', 
            'https://fonts.googleapis.com',
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com'
          ],
          fontSrc: [
            '\'self\'', 
            'https://fonts.gstatic.com',
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com'
          ],
          imgSrc: ['\'self\'', 'data:', 'https:', 'blob:'],
          scriptSrc: [
            '\'self\'', 
            '\'unsafe-inline\'',
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com'
          ],
          connectSrc: ['\'self\'', 'wss:', 'ws:', 'https://api.360dialog.com'],
          frameSrc: ['\'none\''],
          objectSrc: ['\'none\''],
          baseUri: ['\'self\''],
          formAction: ['\'self\''],
          frameAncestors: ['\'self\''],
          scriptSrcAttr: ['\'unsafe-inline\''],
          mediaSrc: ['\'self\'', 'blob:', 'data:']
        }
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: { action: 'sameorigin' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    };
  }

  // Rate limiting por tipo de endpoint
  createRateLimit(type = 'moderate', customConfig = {}) {
    const config = { ...this.rateLimitConfigs[type], ...customConfig };
        
    return rateLimit({
      ...config,
      message: {
        error: 'Demasiadas solicitudes',
        message: `Límite excedido. Intenta de nuevo en ${Math.ceil(config.windowMs / 60000)} minutos.`,
        retryAfter: Math.ceil(config.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Demasiadas solicitudes. Intenta más tarde.',
          retryAfter: Math.ceil(config.windowMs / 1000)
        });
      }
    });
  }

  // Slow down para degradar performance gradualmente
  createSlowDown(type = 'moderate') {
    const config = this.rateLimitConfigs[type];

    return slowDown({
      windowMs: config.windowMs,
      delayAfter: Math.floor(config.max * 0.5), // Comenzar slow down al 50%
      delayMs: 500, // Incrementar 500ms por request
      maxDelayMs: 20000, // Máximo 20 segundos de delay
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
      validate: { delayMs: false } // Desactivar warning de delayMs
    });
  }

  // Generación de tokens JWT
  generateToken(payload, expiresIn = this.tokenExpiry) {
    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn,
      issuer: 'chatbot-system',
      audience: 'chatbot-users'
    });
  }

  // Verificación de tokens JWT
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'chatbot-system',
        audience: 'chatbot-users'
      });
    } catch (error) {
      throw new Error(`Token inválido: ${error.message}`);
    }
  }

  // Hash de contraseñas
  async hashPassword(password) {
    return await bcrypt.hash(password, this.saltRounds);
  }

  // Verificación de contraseñas
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Encriptación de datos sensibles
  encryptData(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), this.encryptionKey).toString();
  }

  // Desencriptación de datos
  decryptData(encryptedData) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      throw new Error('Error al desencriptar datos');
    }
  }

  // Validación de entrada con Joi
  createValidator(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }

      req.validatedData = value;
      next();
    };
  }

  // Middleware de autenticación JWT
  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Token de acceso requerido',
        message: 'Debes proporcionar un token válido'
      });
    }

    try {
      const decoded = this.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({
        error: 'Token inválido',
        message: error.message
      });
    }
  }

  // Middleware de autorización por roles
  authorizeRoles(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Usuario no autenticado'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Permisos insuficientes',
          message: 'No tienes autorización para esta acción'
        });
      }

      next();
    };
  }

  // Sanitización de entrada
  sanitizeInput(input) {
    if (typeof input === 'string') {
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    return input;
  }

  // Middleware de sanitización
  sanitizeRequest(req, res, next) {
    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
          } else {
            obj[key] = this.sanitizeInput(obj[key]);
          }
        }
      }
    };

    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);

    next();
  }

  // Generación de API Keys
  generateApiKey() {
    return 'cbk_' + crypto.randomBytes(32).toString('hex');
  }

  // Validación de API Key
  validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
        
    if (!apiKey) {
      return res.status(401).json({
        error: 'API Key requerida',
        message: 'Debes proporcionar una API Key válida'
      });
    }

    // Aquí validarías contra tu base de datos
    // Por ahora, validamos formato
    if (!apiKey.startsWith('cbk_') || apiKey.length !== 68) {
      return res.status(401).json({
        error: 'API Key inválida',
        message: 'El formato de la API Key no es válido'
      });
    }

    next();
  }

  // Logging de seguridad
  logSecurityEvent(event, details, req = null) {
    const logData = {
      timestamp: new Date().toISOString(),
      event,
      details,
      ip: req ? req.ip : null,
      userAgent: req ? req.get('User-Agent') : null,
      user: req && req.user ? req.user.id : null
    };

    logger.info('[SECURITY]', JSON.stringify(logData));
    // Aquí podrías enviar a un sistema de logging externo
  }
}

export default new SecurityManager();
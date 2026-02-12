import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import Joi from 'joi';
import crypto from 'crypto';

// Event-driven architecture imports
import EventBus from '../../services/core/EventBus.js';
import { EventTypes } from '../../services/core/core/EventTypes.js';
import { createLogger } from '../../services/core/core/logger.js';

import SecurityManager from '../../services/core/core/auth/SecurityManager.js';
import OAuth2Service from '../../services/core/core/OAuth2Service.js';
import TwoFactorAuthService from '../../services/core/core/TwoFactorAuthService.js';
import { loginSchema, registerSchema, changePasswordSchema } from '../../shared/utils/validators/authValidators.js';
import InputSanitizationService from '../../services/core/core/auth/InputSanitizationService.js';

const router = express.Router();

logger.debug('🔧 authRoutes.js - Archivo cargado e inicializado');
const oauth2Service = new OAuth2Service();
const logger = createLogger('AUTH_ROUTES');

// Instancia del servicio 2FA
const twoFactorService = new TwoFactorAuthService();

// Instancia del servicio de sanitización
const inputSanitizationService = new InputSanitizationService();

// EventBus para comunicación desacoplada
const eventBus = new EventBus();

// Middleware para capturar todas las peticiones
router.use((req, res, next) => {
  logger.debug(`🔍 authRoutes - Petición recibida: ${req.method} ${req.path}`);
  logger.debug(`🔍 authRoutes - Body:`, req.body);
  logger.debug(`🔍 authRoutes - Headers:`, req.headers);
  next();
});

// Rate limiting específico para autenticación (más estricto)
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos por IP
  message: {
    error: 'Demasiados intentos de autenticación',
    code: 'TOO_MANY_AUTH_ATTEMPTS',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    SecurityManager.logSecurityEvent('rate_limit_exceeded', {
      endpoint: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }, req);
        
    res.status(429).json({
      error: 'Demasiados intentos de autenticación',
      code: 'TOO_MANY_AUTH_ATTEMPTS',
      retryAfter: '15 minutos'
    });
  }
});

// Slow down para degradar performance gradualmente
const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 2, // después de 2 requests
  delay: 500, // incrementar 500ms por request
  maxDelay: 20000 // máximo 20 segundos de delay
});

// Middleware para hacer disponible el servicio de seguridad en todas las rutas
router.use((req, res, next) => {
  if (req.security) {
    // Ya está disponible desde SecureServer
  }
  next();
});

router.use((req, res, next) => {
  if (req.sanitizationService) {
    // Ya está disponible desde SecureServer
  }
  next();
});

// Aplicar sanitización avanzada a todas las rutas de autenticación
router.use(inputSanitizationService.middleware());

// Middleware de detección de amenazas para rutas críticas
router.use((req, res, next) => {
  logger.debug('🔍 MIDDLEWARE - Threat detection middleware hit');
  if (req.security && req.security.detectThreats) {
    logger.debug('🔍 MIDDLEWARE - Running threat detection');
    const threatAnalysis = req.security.detectThreats(req);
    logger.debug('🔍 MIDDLEWARE - Threat analysis result:', threatAnalysis);
    if (threatAnalysis.riskLevel === 'high') {
      logger.debug('❌ MIDDLEWARE - High risk detected, blocking request');
      SecurityManager.logSecurityEvent('high_risk_auth_attempt', {
        threats: threatAnalysis.threats,
        riskLevel: threatAnalysis.riskLevel,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      }, req);
            
      return res.status(403).json({
        error: 'Acceso denegado por razones de seguridad',
        code: 'SECURITY_THREAT_DETECTED'
      });
    }
  }
  logger.debug('✅ MIDDLEWARE - Threat detection passed');
  next();
});

// Aplicar rate limiting a todas las rutas de auth usando el nuevo sistema de seguridad
router.use((req, res, next) => {
  logger.debug('🔍 MIDDLEWARE - Rate limiting middleware hit');
  try {
    // Usar el nuevo sistema de seguridad si está disponible
    if (req.security && req.security.getLoginRateLimitMiddleware) {
      logger.debug('🔍 MIDDLEWARE - Using new security system rate limit');
      const loginRateLimit = req.security.getLoginRateLimitMiddleware();
      return loginRateLimit(req, res, next);
    }
    // Fallback al sistema anterior
    logger.debug('🔍 MIDDLEWARE - Using fallback rate limit');
    authRateLimit(req, res, next);
  } catch (error) {
    logger.error('❌ MIDDLEWARE - Error in rate limiting:', error);
    // En caso de error, continuar sin rate limiting
    next();
  }
});

router.use((req, res, next) => {
  try {
    if (req.security && req.security.getSlowDownMiddleware) {
      const slowDown = req.security.getSlowDownMiddleware();
      return slowDown(req, res, next);
    }
    authSlowDown(req, res, next);
  } catch (error) {
    logger.error('❌ MIDDLEWARE - Error in slow down:', error);
    // En caso de error, continuar sin slow down
    next();
  }
});

// Middleware de validación
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    req.validatedData = value;
    next();
  };
};

// POST /api/auth/login - Iniciar sesión
// Endpoint de login simplificado para depuración
router.post('/login-test', async(req, res) => {
  logger.debug('🚀 LOGIN TEST ENDPOINT HIT');
  try {
    const { email, password } = req.body;
    logger.debug('📧 Email received:', email);
    logger.debug('🔑 Password received:', password ? '***' : 'UNDEFINED');
    
    // Respuesta simple para verificar que el endpoint funciona
    return res.json({
      success: true,
      message: 'Login test endpoint working',
      data: { email, hasPassword: !!password }
    });
  } catch (error) {
    logger.error('❌ LOGIN TEST ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Login test failed',
      details: error.message
    });
  }
});

// Endpoint de login simplificado sin dependencias complejas
router.post('/login-simple', async(req, res) => {
  logger.debug('🚀 LOGIN SIMPLE ENDPOINT HIT');
  try {
    const { email, password } = req.body;
    logger.debug('📧 Email received:', email);
    logger.debug('🔑 Password received:', password ? '***' : 'UNDEFINED');
    
    // Validación básica
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }
    
    // Verificar credenciales hardcodeadas para prueba
    if (email === 'admin@chatbot.com' && password === 'admin123') {
      // Generar JWT válido
      const JWT_SECRET = process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#';
      const user = {
        id: 1,
        email: email,
        username: 'admin',
        role: 'admin'
      };
      
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      
      return res.json({
        success: true,
        message: 'Login exitoso',
        token: token,
        user: user
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }
  } catch (error) {
    logger.error('❌ LOGIN SIMPLE ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Error en login simple',
      details: error.message
    });
  }
});

// Endpoint de login completamente aislado (sin dependencias)
router.post('/login-isolated', async(req, res) => {
  logger.debug('🔍 LOGIN-ISOLATED - Iniciando endpoint completamente aislado');
  
  try {
    // Solo usar funcionalidades básicas de Node.js
    const body = req.body || {};
    const email = body.email;
    const password = body.password;
    
    logger.debug('🔍 LOGIN-ISOLATED - Email recibido:', email);
    logger.debug('🔍 LOGIN-ISOLATED - Password recibido:', password ? '[PRESENTE]' : '[AUSENTE]');
    
    if (!email || !password) {
      logger.debug('❌ LOGIN-ISOLATED - Credenciales faltantes');
      res.status(400);
      res.json({
        error: 'Email y contraseña son requeridos',
        code: 'MISSING_CREDENTIALS'
      });
      return;
    }
    
    if (email === 'admin@chatbot.com' && password === 'admin123') {
      logger.debug('✅ LOGIN-ISOLATED - Credenciales válidas');
      res.status(200);
      res.json({
        success: true,
        message: 'Login exitoso (aislado)',
        token: 'isolated-test-token-12345',
        user: {
          id: 1,
          email: 'admin@chatbot.com',
          role: 'admin'
        }
      });
      return;
    } else {
      logger.debug('❌ LOGIN-ISOLATED - Credenciales inválidas');
      res.status(401);
      res.json({
        error: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
      return;
    }
    
  } catch (error) {
    logger.error('💥 LOGIN-ISOLATED - Error capturado:', error);
    logger.error('💥 LOGIN-ISOLATED - Stack trace:', error.stack);
    
    try {
      res.status(500);
      res.json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR',
        details: error.message
      });
    } catch (responseError) {
      logger.error('💥 LOGIN-ISOLATED - Error al enviar respuesta:', responseError);
    }
  }
});

// Endpoint de login incremental para identificar dependencias problemáticas
router.post('/login-incremental', async(req, res) => {
  logger.debug('🔍 LOGIN-INCREMENTAL - Iniciando endpoint incremental');
  
  try {
    const { email, password } = req.body;
    
    logger.debug('🔍 LOGIN-INCREMENTAL - Paso 1: Validación básica');
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son requeridos',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    logger.debug('🔍 LOGIN-INCREMENTAL - Paso 2: Probando logger');
    try {
      logger.info('Probando logger en login incremental');
      logger.debug('✅ LOGIN-INCREMENTAL - Logger funciona');
    } catch (loggerError) {
      logger.error('❌ LOGIN-INCREMENTAL - Error en logger:', loggerError);
      return res.status(500).json({
        error: 'Error en logger',
        code: 'LOGGER_ERROR',
        details: loggerError.message
      });
    }
    
    logger.debug('🔍 LOGIN-INCREMENTAL - Paso 3: Probando EventBus');
    try {
      eventBus.emitEvent('test.event', { test: true });
      logger.debug('✅ LOGIN-INCREMENTAL - EventBus funciona');
    } catch (eventBusError) {
      logger.error('❌ LOGIN-INCREMENTAL - Error en EventBus:', eventBusError);
      return res.status(500).json({
        error: 'Error en EventBus',
        code: 'EVENTBUS_ERROR',
        details: eventBusError.message
      });
    }
    
    logger.debug('🔍 LOGIN-INCREMENTAL - Paso 4: Probando SecurityManager');
    try {
      const testToken = SecurityManager.generateToken({ test: true });
      logger.debug('✅ LOGIN-INCREMENTAL - SecurityManager funciona');
    } catch (securityError) {
      logger.error('❌ LOGIN-INCREMENTAL - Error en SecurityManager:', securityError);
      return res.status(500).json({
        error: 'Error en SecurityManager',
        code: 'SECURITY_MANAGER_ERROR',
        details: securityError.message
      });
    }
    
    logger.debug('🔍 LOGIN-INCREMENTAL - Paso 5: Probando authValidators');
    try {
      const validationResult = loginSchema.validate({ email, password });
      if (validationResult.error) {
        logger.debug('❌ LOGIN-INCREMENTAL - Validación falló:', validationResult.error.details);
      } else {
        logger.debug('✅ LOGIN-INCREMENTAL - authValidators funciona');
      }
    } catch (validatorError) {
      logger.error('❌ LOGIN-INCREMENTAL - Error en authValidators:', validatorError);
      return res.status(500).json({
        error: 'Error en authValidators',
        code: 'VALIDATOR_ERROR',
        details: validatorError.message
      });
    }
    
    logger.debug('🔍 LOGIN-INCREMENTAL - Todas las dependencias funcionan');
    
    // Simular login exitoso
    if (email === 'admin@chatbot.com' && password === 'admin123') {
      return res.json({
        success: true,
        message: 'Login exitoso (incremental)',
        token: 'incremental-test-token-12345',
        user: {
          id: 1,
          email: 'admin@chatbot.com',
          role: 'admin'
        }
      });
    } else {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
  } catch (error) {
    logger.error('💥 LOGIN-INCREMENTAL - Error general:', error);
    logger.error('💥 LOGIN-INCREMENTAL - Stack trace:', error.stack);
    
    return res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR',
      details: error.message
    });
  }
});

// POST /login-fixed - Endpoint de login corregido simplificado
router.post('/login-fixed', async(req, res) => {
  logger.debug('🚀 LOGIN-FIXED ENDPOINT HIT - Request received');
  
  try {
    logger.debug('🔍 LOGIN-FIXED - Starting login process');
    const { email, password } = req.body;
    
    logger.debug('🔍 LOGIN-FIXED - Credentials received:', { email, password: password ? '***' : 'UNDEFINED' });
    
    // Validación básica
    if (!email || !password) {
      logger.debug('❌ LOGIN-FIXED ERROR - Missing credentials');
      return res.status(400).json({
        error: 'Email y contraseña son requeridos',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    // Para pruebas, usar credenciales hardcodeadas como los otros endpoints
    if (email === 'admin@chatbot.com' && password === 'admin123') {
      logger.debug('✅ LOGIN-FIXED - Valid hardcoded credentials');
      
      // Generar token JWT
      const token = jwt.sign(
        { 
          userId: 1, 
          email: 'admin@chatbot.com',
          role: 'admin'
        },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: '24h' }
      );
      
      logger.debug('✅ LOGIN-FIXED - Token generated');
      
      // Registrar evento de login exitoso
      try {
        eventBus.emitEvent('user.login', {
          userId: 1,
          email: 'admin@chatbot.com',
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        logger.debug('✅ LOGIN-FIXED - Login event emitted');
      } catch (eventError) {
        logger.error('⚠️ LOGIN-FIXED - Event emission failed:', eventError);
        // No fallar por esto, continuar
      }
      
      logger.debug('🎉 LOGIN-FIXED - Login successful');
      
      return res.json({
        success: true,
        message: 'Login exitoso (fixed)',
        token,
        user: {
          id: 1,
          email: 'admin@chatbot.com',
          role: 'admin',
          name: 'Administrator'
        }
      });
    } else {
      logger.debug('❌ LOGIN-FIXED - Invalid credentials');
      return res.status(401).json({
        error: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
  } catch (error) {
    logger.error('💥 LOGIN-FIXED - Unexpected error:', error);
    logger.error('💥 LOGIN-FIXED - Stack trace:', error.stack);
    
    // Registrar evento de login fallido
    try {
      eventBus.emitEvent('user.login.failed', {
        email: req.body?.email,
        error: error.message,
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (eventError) {
      logger.error('⚠️ LOGIN-FIXED - Failed login event emission failed:', eventError);
    }
    
    return res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR',
      details: error.message
    });
  }
});

// POST /login - Endpoint principal de autenticación con cookies HTTP-only
// Ruta para verificar el estado de autenticación
router.get('/me', async (req, res) => {
  try {
    // Verificar si hay una cookie de sesión
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: 'No hay sesión activa'
      });
    }

    // Verificar la sesión en la base de datos
    try {
      if (req.database) {
        const db = req.database.getManager ? req.database.getManager() : req.database;
        
        const session = await db.get(`
          SELECT s.*, s.user_id, s.expires_at, s.is_active
          FROM sessions s
          WHERE s.id = ? AND s.is_active = 1 AND s.expires_at > datetime('now')
        `, [sessionId]);
        
        if (!session) {
          return res.status(401).json({
            success: false,
            message: 'Sesión inválida o expirada'
          });
        }

        // Actualizar última actividad
        await db.run(`
          UPDATE sessions 
          SET last_activity = datetime('now')
          WHERE id = ?
        `, [sessionId]);

        // Obtener datos del usuario (simulado - en producción vendría de la base de datos)
        const DEFAULT_USERS = [
          {
            id: 1,
            username: 'admin',
            email: 'admin@chatbot.com',
            role: 'admin'
          }
        ];

        const user = DEFAULT_USERS.find(u => u.id === session.user_id);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Usuario no encontrado'
          });
        }

        logger.info(`Verificación de autenticación exitosa para usuario ${user.username}`);

        return res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        });
        
      } else {
        logger.warn('Base de datos no disponible para verificación de sesión');
        return res.status(500).json({
          success: false,
          message: 'Error interno del servidor'
        });
      }
    } catch (dbError) {
      logger.error('Error verificando sesión en SQLite:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }

  } catch (error) {
    logger.error('Error en verificación de autenticación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Ruta para refrescar tokens
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const sessionId = req.cookies?.sessionId;

    if (!refresh_token && !sessionId) {
      return res.status(401).json({
        success: false,
        message: 'Token de refresco o sesión requerida'
      });
    }

    // Si tenemos sessionId, verificar la sesión
    if (sessionId) {
      try {
        if (req.database) {
          const db = req.database.getManager ? req.database.getManager() : req.database;
          
          const session = await db.get(`
            SELECT s.*, s.user_id, s.expires_at, s.is_active
            FROM sessions s
            WHERE s.id = ? AND s.is_active = 1 AND s.expires_at > datetime('now')
          `, [sessionId]);
          
          if (!session) {
            return res.status(401).json({
              success: false,
              message: 'Sesión inválida o expirada'
            });
          }

          // Generar nuevo token de acceso
          const accessToken = jwt.sign(
            { 
              userId: session.user_id, 
              username: 'admin', // En producción obtener de la base de datos
              role: 'admin',
              sessionId: sessionId
            },
            process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#',
            { expiresIn: '24h' }
          );

          // Actualizar hash del token en la sesión
          const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
          
          await db.run(`
            UPDATE sessions 
            SET token_hash = ?, last_activity = datetime('now')
            WHERE id = ?
          `, [tokenHash, sessionId]);

          logger.info(`Token refrescado exitosamente para sesión ${sessionId}`);

          return res.json({
            success: true,
            access_token: accessToken,
            message: 'Token refrescado exitosamente'
          });
          
        } else {
          logger.warn('Base de datos no disponible para refrescar token');
          return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
          });
        }
      } catch (dbError) {
        logger.error('Error refrescando token en SQLite:', dbError);
        return res.status(500).json({
          success: false,
          message: 'Error interno del servidor'
        });
      }
    }

    // Si solo tenemos refresh_token (método alternativo)
    if (refresh_token) {
      try {
        const decoded = jwt.verify(
          refresh_token, 
          process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#'
        );

        // Generar nuevo access token
        const accessToken = jwt.sign(
          { 
            userId: decoded.userId, 
            username: 'admin', // En producción obtener de la base de datos
            role: 'admin',
            sessionId: decoded.sessionId
          },
          process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#',
          { expiresIn: '24h' }
        );

        return res.json({
          success: true,
          access_token: accessToken,
          message: 'Token refrescado exitosamente'
        });

      } catch (jwtError) {
        logger.error('Error verificando refresh token:', jwtError);
        return res.status(401).json({
          success: false,
          message: 'Refresh token inválido'
        });
      }
    }

  } catch (error) {
    logger.error('Error en refresh de token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validar entrada - aceptar tanto username como email
    const loginField = username || email;
    if (!loginField || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/email y password son requeridos'
      });
    }

    // Usuarios por defecto (en producción esto vendría de una base de datos)
    const DEFAULT_USERS = [
      {
        id: 1,
        username: 'admin',
        email: 'admin@chatbot.com',
        password: '$2b$10$xBm3F13Gn9YlzjcdCRx8FeN6ZTJHr1t.dGigovGiwAXFx.7BaljSm', // 'admin123'
        role: 'admin'
      }
    ];

    // Buscar usuario por username o email
    const user = DEFAULT_USERS.find(u => 
      u.username === loginField || u.email === loginField
    );
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar sessionId único
    const sessionId = crypto.randomUUID();

    // Generar tokens JWT con sessionId incluido
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role,
        sessionId: sessionId
      },
      process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#',
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { 
        userId: user.id, 
        sessionId: sessionId
      },
      process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#',
      { expiresIn: '7d' }
    );

    // Crear hashes de los tokens para almacenamiento seguro
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Calcular fecha de expiración de la sesión (7 días)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Almacenar la sesión en SQLite
    try {
      if (req.database) {
        const db = req.database.getManager ? req.database.getManager() : req.database;
        
        await db.run(`
          INSERT INTO sessions (
            id, user_id, token_hash, refresh_token_hash, 
            expires_at, created_at, last_activity, 
            ip_address, user_agent, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          sessionId,
          user.id,
          tokenHash,
          refreshTokenHash,
          expiresAt.toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
          req.ip || req.connection.remoteAddress,
          req.get('User-Agent') || 'Unknown',
          1
        ]);
        
        logger.info(`Sesión ${sessionId} almacenada en SQLite para usuario ${user.username}`);
      } else {
        logger.warn('Base de datos no disponible, sesión no almacenada');
      }
    } catch (dbError) {
      logger.error('Error almacenando sesión en SQLite:', dbError);
      // Continuar con el login aunque falle el almacenamiento de sesión
    }

    // Configurar cookie HTTP-only con el sessionId
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Cambiado de 'strict' a 'lax' para compatibilidad con Safari
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });

    // Emitir evento de login exitoso
    try {
      eventBus.emitEvent('user.login', {
        userId: user.id,
        username: user.username,
        email: user.email,
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (eventError) {
      logger.error('Error emitiendo evento de login:', eventError);
    }

    logger.info(`Usuario ${user.username} autenticado exitosamente con cookies HTTP-only`);

    // Responder solo con datos del usuario (sin tokens)
    res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Error en login:', error);
    
    // Emitir evento de login fallido
    try {
      eventBus.emitEvent('user.login.failed', {
        username: req.body?.username,
        email: req.body?.email,
        error: error.message,
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (eventError) {
      logger.error('Error emitiendo evento de login fallido:', eventError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;
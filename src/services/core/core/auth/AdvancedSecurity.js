/**
 * Sistema de Seguridad Avanzado
 * Implementa autenticación JWT, rate limiting, validación y sanitización
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import validator from 'validator';
import xss from 'xss';
import crypto from 'crypto';
import errorManager from '../../../../utils/error_manager.js';
import SecretManager from './SecretManager.js';
import AdvancedRateLimiter from './AdvancedRateLimiter.js';
import SecureLogger from './SecureLogger.js';
import PasswordValidator from './PasswordValidator.js';
import SessionStore from './SessionStore.js';
import TwoFactorAuth from './TwoFactorAuth.js';
import ThreatDetection from './ThreatDetection.js';
import GeoLocation from './GeoLocation.js';

class AdvancedSecurity {
  constructor(config = {}) {
    // Initialize SecretManager first
    this.secretManager = new SecretManager(config.secretManager || {});
        
    // Initialize AdvancedRateLimiter
    this.rateLimiter = new AdvancedRateLimiter(config.rateLimiter || {});
        
    // Initialize SecureLogger
    this.secureLogger = new SecureLogger({
      logLevel: config.logLevel || 'info',
      enableEncryption: config.enableLogEncryption || false,
      encryptionKey: config.logEncryptionKey || null,
      logDirectory: config.logDirectory || './logs/security'
    });
        
    // Initialize PasswordValidator
    this.passwordValidator = new PasswordValidator(config.passwordPolicy || {});
        
    // Initialize SessionStore
    this.sessionStore = new SessionStore(config.sessionStore || {});
        
    // Initialize TwoFactorAuth
    this.twoFactorAuth = new TwoFactorAuth(config.twoFactorAuth || {});
        
    // Initialize ThreatDetection
    this.threatDetection = new ThreatDetection(config.threatDetection || {});
        
    // Initialize GeoLocation
    this.geoLocation = new GeoLocation(config.geoLocation || {});
        
    this.config = {
      jwt: {
        secret: config.jwtSecret || process.env.JWT_SECRET || null, // Will be set in initialize()
        expiresIn: config.jwtExpiresIn || '24h',
        refreshExpiresIn: config.refreshExpiresIn || '7d',
        algorithm: 'HS256'
      },
      bcrypt: {
        saltRounds: config.bcrypt?.saltRounds || config.saltRounds || 12
      },
      rateLimit: {
        max: config.rateLimit?.max || 999999, // Rate limiting desactivado
        windowMs: config.rateLimit?.windowMs || 900000
      },
      session: {
        maxAge: config.sessionMaxAge || 24 * 60 * 60 * 1000, // 24 horas
        cleanupInterval: config.sessionCleanup || 60 * 60 * 1000 // 1 hora
      },
      security: {
        maxLoginAttempts: config.security?.maxLoginAttempts || config.maxLoginAttempts || 5,
        lockoutDuration: config.security?.lockoutDuration || config.lockoutDuration || 30 * 60 * 1000, // 30 minutos
        passwordMinLength: config.security?.passwordMinLength || config.passwordMinLength || 8,
        requireSpecialChars: config.security?.requireSpecialChars !== false && config.requireSpecialChars !== false,
        sessionTimeout: config.security?.sessionTimeout || config.sessionTimeout || 24 * 60 * 60 * 1000
      }
    };
        
    // Estado interno
    this.activeSessions = new Map();
    this.loginAttempts = new Map();
    this.blockedIPs = new Map();
    this.refreshTokens = new Map();
    this.cleanupIntervalId = null;
        
    // Estadísticas de seguridad
    this.securityStats = {
      totalLoginAttempts: 0,
      failedLoginAttempts: 0,
      successfulLogins: 0,
      blockedAttempts: 0,
      tokensGenerated: 0,
      tokensRevoked: 0,
      sessionsCreated: 0,
      sessionsDestroyed: 0,
      securityEvents: 0,
      lastSecurityEvent: null
    };
        
    this.initialize();
  }
    
  async initialize() {
    try {
      // Initialize SecretManager and get JWT secret
      await this.secretManager.initialize();
        
      // Set JWT secret if not provided
      if (!this.config.jwt.secret) {
        this.config.jwt.secret = await this.secretManager.getSecret('jwt_secret', {
          length: 64,
          type: 'base64url'
        });
      }
        
      // Initialize SessionStore
      await this.sessionStore.initialize();
            
      this.validateConfiguration();
            
      // Configurar limpieza automática de sesiones
      this.cleanupIntervalId = setInterval(() => {
        this.cleanupExpiredSessions();
        this.cleanupLoginAttempts();
        this.cleanupBlockedIPs();
      }, this.config.session.cleanupInterval);
            
      errorManager.logError('info', 'AdvancedSecurity', 'Sistema de seguridad inicializado correctamente', {
        config: {
          jwtAlgorithm: this.config.jwt.algorithm,
          bcryptRounds: this.config.bcrypt.saltRounds,
          maxLoginAttempts: this.config.security.maxLoginAttempts,
          sessionMaxAge: this.config.session.maxAge
        }
      });
            
      logger.info('✅ AdvancedSecurity inicializado');
    } catch (error) {
      errorManager.logError('critical', 'AdvancedSecurity', 'Error crítico inicializando sistema de seguridad', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
    
  validateConfiguration() {
    // Validar JWT secret usando SecretManager
    if (!this.config.jwt.secret) {
      throw new Error('JWT secret es requerido');
    }
        
    const secretValidation = this.secretManager.validateSecret(this.config.jwt.secret, 32);
    if (!secretValidation.isValid) {
      throw new Error(`JWT secret validation failed: ${secretValidation.errors.join(', ')}`);
    }
        
    // Validar bcrypt rounds
    if (this.config.bcrypt.saltRounds < 10 || this.config.bcrypt.saltRounds > 15) {
      throw new Error('bcrypt saltRounds debe estar entre 10 y 15');
    }
        
    // Validar rate limit - DESACTIVADO
    // Rate limiting está desactivado, no validar límites
        
    // Validar configuración de seguridad
    if (this.config.security.maxLoginAttempts < 3 || this.config.security.maxLoginAttempts > 10) {
      throw new Error('maxLoginAttempts debe estar entre 3 y 10');
    }
        
    if (this.config.security.passwordMinLength < 6 || this.config.security.passwordMinLength > 50) {
      throw new Error('passwordMinLength debe estar entre 6 y 50');
    }
        
    logger.info('✅ Configuración de seguridad validada');
    logger.info(`🔐 JWT Secret strength: ${secretValidation.strength}`);
  }
    

    
  // Middleware de Helmet para headers de seguridad
  getHelmetMiddleware() {
    return helmet({
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
          imgSrc: ['\'self\'', 'data:', 'https:'],
          scriptSrc: [
            '\'self\'', 
            '\'unsafe-inline\'',
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com'
          ],
          connectSrc: ['\'self\'', 'wss:', 'ws:'],
          frameSrc: ['\'none\''],
          objectSrc: ['\'none\''],
          baseUri: ['\'self\''],
          formAction: ['\'self\''],
          frameAncestors: ['\'self\''],
          scriptSrcAttr: ['\'unsafe-inline\''],
          mediaSrc: ['\'self\'']
        }
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }
    
  // Advanced Rate Limiting
  getRateLimitMiddleware() {
    return this.rateLimiter.getGlobalLimiter();
  }
    
  // Slow Down para requests frecuentes
  getSlowDownMiddleware() {
    return this.rateLimiter.getSlowDownMiddleware();
  }
    
  // Rate limiting específico para login
  getLoginRateLimitMiddleware() {
    return this.rateLimiter.getAuthLimiter();
  }
    
  // Rate limiting para API endpoints
  getAPIRateLimitMiddleware() {
    return this.rateLimiter.getAPILimiter();
  }
    
  // Rate limiting para contenido estático
  getStaticRateLimitMiddleware() {
    return this.rateLimiter.getStaticLimiter();
  }
    
  // Protección contra brute force
  getBruteForceProtection() {
    return this.rateLimiter.getBruteForceProtection();
  }
    
  // Autenticación y Autorización
  async hashPassword(password) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Password debe ser una cadena válida');
      }
            
      const hash = await bcrypt.hash(password, this.config.bcrypt.saltRounds);
            
      await this.secureLogger.info('AdvancedSecurity', 'Password hasheado correctamente', {
        saltRounds: this.config.bcrypt.saltRounds
      });
            
      return hash;
    } catch (error) {
      await this.secureLogger.error('AdvancedSecurity', 'Error hasheando password', {
        error: error.message
      });
      throw error;
    }
  }
    
  async verifyPassword(password, hash) {
    try {
      if (!password || !hash) {
        throw new Error('Password y hash son requeridos');
      }
            
      const isValid = await bcrypt.compare(password, hash);
            
      await this.secureLogger.info('AdvancedSecurity', 'Verificación de password completada', {
        isValid,
        hashLength: hash.length
      });
            
      return isValid;
    } catch (error) {
      await this.secureLogger.error('AdvancedSecurity', 'Error verificando password', {
        error: error.message
      });
      throw error;
    }
  }
    
  generateTokens(payload) {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload debe ser un objeto válido');
      }
            
      if (!payload.id) {
        throw new Error('Payload debe contener un ID de usuario');
      }
            
      const accessToken = jwt.sign(payload, this.config.jwt.secret, {
        expiresIn: this.config.jwt.expiresIn,
        algorithm: this.config.jwt.algorithm
      });
            
      const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        this.config.jwt.secret,
        {
          expiresIn: this.config.jwt.refreshExpiresIn,
          algorithm: this.config.jwt.algorithm
        }
      );
            
      // Almacenar refresh token
      this.refreshTokens.set(refreshToken, {
        userId: payload.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.parseTimeToMs(this.config.jwt.refreshExpiresIn)
      });
            
      this.securityStats.tokensGenerated++;
            
      errorManager.logError('info', 'AdvancedSecurity', 'Tokens generados correctamente', {
        userId: payload.id,
        accessTokenLength: accessToken.length,
        refreshTokenLength: refreshToken.length,
        totalTokensGenerated: this.securityStats.tokensGenerated
      });
            
      return { accessToken, refreshToken };
    } catch (error) {
      errorManager.logError('error', 'AdvancedSecurity', 'Error generando tokens', {
        error: error.message,
        payload: payload ? { id: payload.id } : null
      });
      throw error;
    }
  }
    
  verifyToken(token) {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Token debe ser una cadena válida');
      }
            
      const decoded = jwt.verify(token, this.config.jwt.secret);
            
      errorManager.logError('info', 'AdvancedSecurity', 'Token verificado correctamente', {
        userId: decoded.id,
        tokenType: decoded.type || 'access',
        exp: decoded.exp
      });
            
      return decoded;
    } catch (error) {
      errorManager.logError('warning', 'AdvancedSecurity', 'Token inválido o expirado', {
        error: error.message,
        tokenLength: token ? token.length : 0
      });
      throw new Error('Token inválido o expirado');
    }
  }
    
  async refreshAccessToken(refreshToken) {
    try {
      if (!refreshToken) {
        throw new Error('Refresh token es requerido');
      }
            
      // Verificar que el refresh token existe
      const tokenData = this.refreshTokens.get(refreshToken);
      if (!tokenData) {
        throw new Error('Refresh token no válido');
      }
            
      // Verificar que no ha expirado
      if (Date.now() > tokenData.expiresAt) {
        this.refreshTokens.delete(refreshToken);
        throw new Error('Refresh token expirado');
      }
            
      // Verificar el token JWT
      const decoded = this.verifyToken(refreshToken);
      if (decoded.type !== 'refresh') {
        throw new Error('Token no es de tipo refresh');
      }
            
      // Generar nuevo access token
      const newTokens = this.generateTokens({
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      });
            
      // Revocar el refresh token anterior
      this.refreshTokens.delete(refreshToken);
            
      errorManager.logError('info', 'AdvancedSecurity', 'Access token renovado correctamente', {
        userId: decoded.id,
        oldTokenRevoked: true
      });
            
      return newTokens;
    } catch (error) {
      errorManager.logError('error', 'AdvancedSecurity', 'Error renovando access token', {
        error: error.message
      });
      throw error;
    }
  }
    
  revokeRefreshToken(refreshToken) {
    try {
      const deleted = this.refreshTokens.delete(refreshToken);
            
      if (deleted) {
        this.securityStats.tokensRevoked++;
        errorManager.logError('info', 'AdvancedSecurity', 'Refresh token revocado', {
          totalTokensRevoked: this.securityStats.tokensRevoked
        });
      }
            
      return deleted;
    } catch (error) {
      errorManager.logError('error', 'AdvancedSecurity', 'Error revocando refresh token', {
        error: error.message
      });
      return false;
    }
  }
    
  // Middleware de autenticación
  authenticateToken() {
    return (req, res, next) => {
      try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
                
        if (!token) {
          errorManager.logError('warning', 'AdvancedSecurity', 'Token de acceso no proporcionado', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });
                    
          return res.status(401).json({
            error: 'Token de acceso requerido',
            code: 'ACCESS_TOKEN_REQUIRED'
          });
        }
                
        const decoded = this.verifyToken(token);
        req.user = decoded;
                
        // Verificar sesión activa si existe sessionId
        if (decoded.sessionId) {
          const session = this.activeSessions.get(decoded.sessionId);
          if (!session || session.expiresAt < Date.now()) {
            errorManager.logError('warning', 'AdvancedSecurity', 'Sesión expirada o no encontrada', {
            userId: decoded.id,
            sessionId: decoded.sessionId,
            ip: req.ip
          });
                        
            return res.status(401).json({
              error: 'Sesión expirada',
              code: 'SESSION_EXPIRED'
            });
          }
                    
          // Actualizar última actividad
          session.lastActivity = Date.now();
        }
                
        errorManager.logError('info', 'AdvancedSecurity', 'Usuario autenticado correctamente', {
          userId: decoded.id,
          endpoint: req.path,
          ip: req.ip
        });
                
        next();
                
      } catch (error) {
        errorManager.logError('warning', 'AdvancedSecurity', 'Error de autenticación', {
          error: error.message,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });
                
        return res.status(403).json({
          error: 'Token inválido',
          code: 'INVALID_TOKEN'
        });
      }
    };
  }
    
  // Middleware de autorización por roles
  requireRole(roles) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          errorManager.logError('warning', 'AdvancedSecurity', 'Intento de acceso sin autenticación', {
          ip: req.ip,
          endpoint: req.path
        });
                    
          return res.status(401).json({
            error: 'Autenticación requerida',
            code: 'AUTHENTICATION_REQUIRED'
          });
        }
                
        const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
        const requiredRoles = Array.isArray(roles) ? roles : [roles];
                
        const hasRole = requiredRoles.some(role => userRoles.includes(role));
                
        if (!hasRole) {
          errorManager.logError('warning', 'AdvancedSecurity', 'Acceso denegado por roles insuficientes', {
            userId: req.user.id,
            userRoles,
            requiredRoles,
            endpoint: req.path,
            ip: req.ip
          });
                    
          this.recordSecurityEvent('unauthorized_access_attempt', {
            userId: req.user.id,
            userRoles,
            requiredRoles,
            endpoint: req.path,
            ip: req.ip
          });
                    
          return res.status(403).json({
            error: 'Permisos insuficientes',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
                
        errorManager.logError('info', 'AdvancedSecurity', 'Autorización exitosa', {
          userId: req.user.id,
          userRoles,
          requiredRoles,
          endpoint: req.path
        });
                
        next();
                
      } catch (error) {
        errorManager.logError('error', 'AdvancedSecurity', 'Error en autorización por roles', {
          error: error.message,
          userId: req.user?.id,
          endpoint: req.path,
          ip: req.ip
        });
                
        return res.status(500).json({
          error: 'Error interno de autorización',
          code: 'AUTHORIZATION_ERROR'
        });
      }
    };
  }

  // Gestión de sesiones
  async createSession(userIdOrData, metadata = {}) {
    try {
      const sessionId = this.generateSessionId();
            
      // Soporte para ambos formatos: createSession(userId, metadata) y createSession(sessionData)
      let sessionData;
      if (typeof userIdOrData === 'object') {
        sessionData = userIdOrData;
        if (!sessionData.userId) {
          throw new Error('sessionData debe contener userId');
        }
      } else {
        if (!userIdOrData) {
          throw new Error('userId es requerido');
        }
        sessionData = { userId: userIdOrData, ...metadata };
      }
            
      const session = {
        id: sessionId,
        ...sessionData,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + this.config.session.maxAge,
        metadata: {
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          ...metadata
        }
      };
            
      // Store in persistent storage
      await this.sessionStore.set(sessionId, session, this.config.session.maxAge);
            
      // Keep in memory for backward compatibility
      this.activeSessions.set(sessionId, session);
      this.securityStats.sessionsCreated++;
            
      await this.secureLogger.logAuthenticationEvent('session_created', {
        sessionId,
        userId: sessionData.userId,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        totalSessions: this.activeSessions.size,
        sessionsCreated: this.securityStats.sessionsCreated
      });
            
      return sessionId;
    } catch (error) {
      await this.secureLogger.error('Error creando sesión', {
        error: error.message,
        userIdOrData: typeof userIdOrData === 'object' ? { userId: userIdOrData.userId } : userIdOrData
      });
      throw error;
    }
  }
    
  async destroySession(sessionId) {
    try {
      if (!sessionId) {
        throw new Error('sessionId es requerido');
      }
            
      const session = this.activeSessions.get(sessionId);
            
      // Delete from persistent storage
      await this.sessionStore.delete(sessionId);
            
      // Delete from memory
      const deleted = this.activeSessions.delete(sessionId);
            
      if (deleted || session) {
        this.securityStats.sessionsDestroyed++;
                
        await this.secureLogger.logAuthenticationEvent('session_destroyed', {
          sessionId,
          userId: session?.userId,
          sessionDuration: session ? Date.now() - session.createdAt : null,
          totalSessions: this.activeSessions.size,
          sessionsDestroyed: this.securityStats.sessionsDestroyed
        });
      } else {
        await this.secureLogger.info('Intento de destruir sesión inexistente', {
          sessionId
        });
      }
            
      return deleted;
    } catch (error) {
      await this.secureLogger.error('Error destruyendo sesión', {
        error: error.message,
        sessionId
      });
      return false;
    }
  }

  async getSession(sessionId) {
    try {
      if (!sessionId) {
        return null;
      }
            
      // Try to get from persistent storage first
      let session = await this.sessionStore.get(sessionId);
            
      if (!session) {
        // Fallback to memory store
        session = this.activeSessions.get(sessionId);
        if (!session) {
          return null;
        }
      } else {
        // Update memory store with persistent data
        this.activeSessions.set(sessionId, session);
      }
            
      // Verificar si la sesión ha expirado
      if (session.expiresAt < Date.now()) {
        await this.sessionStore.delete(sessionId);
        this.activeSessions.delete(sessionId);
        this.securityStats.sessionsDestroyed++;
                
        await this.secureLogger.logAuthenticationEvent('session_expired', {
          sessionId,
          userId: session.userId,
          expiredAt: new Date(session.expiresAt).toISOString(),
          sessionDuration: Date.now() - session.createdAt
        });
                
        return null;
      }
            
      // Update last activity
      session.lastActivity = Date.now();
      await this.sessionStore.set(sessionId, session, this.config.session.maxAge);
      this.activeSessions.set(sessionId, session);
            
      return session;
    } catch (error) {
      await this.secureLogger.error('Error obteniendo sesión', {
        error: error.message,
        sessionId
      });
      return null;
    }
  }

  generateSessionId() {
    try {
      return crypto.randomBytes(32).toString('hex');
    } catch (error) {
      errorManager.logError('error', 'AdvancedSecurity', 'Error generando session ID', {
        error: error.message
      });
      // Fallback usando timestamp y random
      return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }
    
  // Control de intentos de login
  recordLoginAttempt(identifier, success = false) {
    try {
      if (!identifier) {
        throw new Error('identifier es requerido');
      }
            
      const key = `login_${identifier}`;
      const now = Date.now();
            
      this.securityStats.totalLoginAttempts++;
            
      if (!this.loginAttempts.has(key)) {
        this.loginAttempts.set(key, {
          attempts: 0,
          lastAttempt: now,
          blockedUntil: null
        });
      }
            
      const record = this.loginAttempts.get(key);
            
      if (success) {
        // Reset en login exitoso
        this.loginAttempts.delete(key);
        this.securityStats.successfulLogins++;
                
        errorManager.logError('info', 'AdvancedSecurity', 'Login exitoso registrado', {
          identifier,
          previousAttempts: record.attempts,
          totalSuccessfulLogins: this.securityStats.successfulLogins
        });
      } else {
        record.attempts++;
        record.lastAttempt = now;
        this.securityStats.failedLoginAttempts++;
                
        // Bloquear si se exceden los intentos máximos
        if (record.attempts >= this.config.security.maxLoginAttempts) {
          record.blockedUntil = now + this.config.security.lockoutDuration;
                    
          errorManager.logError('warning', 'AdvancedSecurity', 'Cuenta bloqueada por exceso de intentos', {
            identifier,
            attempts: record.attempts,
            maxAttempts: this.config.security.maxLoginAttempts,
            blockedUntil: new Date(record.blockedUntil).toISOString(),
            lockoutDuration: this.config.security.lockoutDuration
          });
                    
          this.recordSecurityEvent('account_locked', {
            identifier,
            attempts: record.attempts,
            blockedUntil: record.blockedUntil
          });
        } else {
          errorManager.logError('warning', 'AdvancedSecurity', 'Intento de login fallido registrado', {
            identifier,
            attempts: record.attempts,
            maxAttempts: this.config.security.maxLoginAttempts,
            remainingAttempts: this.config.security.maxLoginAttempts - record.attempts,
            totalFailedLogins: this.securityStats.failedLoginAttempts
          });
        }
      }
    } catch (error) {
      errorManager.logError('error', 'AdvancedSecurity', 'Error registrando intento de login', {
        error: error.message,
        identifier,
        success
      });
    }
  }

  isAccountLocked(identifier) {
    const key = `login_${identifier}`;
    const record = this.loginAttempts.get(key);
        
    if (!record) return false;
        
    if (record.blockedUntil && record.blockedUntil > Date.now()) {
      return true;
    }
        
    return false;
  }
    
  // Métodos adicionales para compatibilidad con tests
  recordFailedLogin(identifier, ip, details = {}) {
    this.recordLoginAttempt(identifier, false);
    this.recordSecurityEvent('failed_login', { identifier, ip, ...details });
        
    // Use AdvancedRateLimiter for brute force protection
    this.rateLimiter.recordFailedAttempt(ip, { identifier, ...details });
  }
    
  recordSuccessfulLogin(identifier, ip) {
    this.recordLoginAttempt(identifier, true);
    this.recordSecurityEvent('successful_login', { identifier, ip });
        
    // Clear failed attempts on successful login
    this.rateLimiter.recordSuccessfulAttempt(ip);
  }
    
  getLoginAttempts(identifier) {
    const key = `login_${identifier}`;
    const record = this.loginAttempts.get(key);
    return record ? record.attempts : 0;
  }
    
  resetLoginAttempts(identifier) {
    const key = `login_${identifier}`;
    this.loginAttempts.delete(key);
  }

  async clearAllSessions() {
    await this.sessionStore.clear();
    this.activeSessions.clear();
  }

  clearLoginAttempts() {
    this.loginAttempts.clear();
  }
    
  // Validación y Sanitización
  validateInput(data, rules) {
    const errors = [];
    const sanitized = {};
        
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
            
      // Verificar campos requeridos
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} es requerido`);
        continue;
      }
            
      // Si no es requerido y está vacío, continuar
      if (!rule.required && (value === undefined || value === null || value === '')) {
        sanitized[field] = value;
        continue;
      }
            
      // Validaciones específicas
      let sanitizedValue = value;
            
      if (rule.type === 'email') {
        if (!validator.isEmail(value)) {
          errors.push(`${field} debe ser un email válido`);
          continue;
        }
        sanitizedValue = validator.normalizeEmail(value);
      }
            
      if (rule.type === 'password') {
        if (!this.validatePassword(value)) {
          errors.push(`${field} debe tener al menos ${this.config.security.passwordMinLength} caracteres${this.config.security.requireSpecialChars ? ' y contener caracteres especiales' : ''}`);
          continue;
        }
      }
            
      if (rule.type === 'string') {
        sanitizedValue = this.sanitizeString(value);
                
        if (rule.minLength && sanitizedValue.length < rule.minLength) {
          errors.push(`${field} debe tener al menos ${rule.minLength} caracteres`);
          continue;
        }
                
        if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
          errors.push(`${field} no puede tener más de ${rule.maxLength} caracteres`);
          continue;
        }
      }
            
      if (rule.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${field} debe ser un número válido`);
          continue;
        }
        sanitizedValue = num;
                
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`${field} debe ser mayor o igual a ${rule.min}`);
          continue;
        }
                
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`${field} debe ser menor o igual a ${rule.max}`);
          continue;
        }
      }
            
      if (rule.type === 'enum' && rule.values && !rule.values.includes(value)) {
        errors.push(`${field} debe ser uno de: ${rule.values.join(', ')}`);
        continue;
      }
            
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} debe ser uno de: ${rule.enum.join(', ')}`);
        continue;
      }
            
      sanitized[field] = sanitizedValue;
    }
        
    return {
      isValid: errors.length === 0,
      errors,
      data: sanitized
    };
  }
    
  sanitizeString(str) {
    if (typeof str !== 'string') return str;
        
    // Sanitizar XSS
    let sanitized = xss(str, {
      whiteList: {}, // No permitir ningún HTML
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    });
        
    // Escapar caracteres especiales adicionales
    sanitized = sanitized
      .replace(/[<>]/g, '') // Remover < y >
      .trim(); // Remover espacios al inicio y final
        
    return sanitized;
  }
    
  validatePassword(password, userInfo = {}) {
    return this.passwordValidator.validatePassword(password, userInfo);
  }
    
  // Generate a secure password suggestion
  generateSecurePassword(length) {
    return this.passwordValidator.generateSecurePassword(length);
  }
    
  // Check password strength without validation rules
  checkPasswordStrength(password) {
    const result = this.passwordValidator.validatePassword(password);
    return {
      strength: result.strength,
      score: result.score,
      entropy: result.entropy,
      estimatedCrackTime: result.estimatedCrackTime
    };
  }
    
  // Middleware de validación
  validateRequest(rules) {
    return (req, res, next) => {
      const validation = this.validateInput(req.body, rules);
            
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          code: 'VALIDATION_ERROR',
          details: validation.errors
        });
      }
            
      req.validatedData = validation.data;
      next();
    };
  }
    
  // Utilidades
  parseTimeToMs(timeStr) {
    const units = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
        
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) return 0;
        
    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }
    
  async recordSecurityEvent(type, details) {
    // Use SecureLogger for security events
    await this.secureLogger.logSecurityEvent(type, details);
        
    // Aquí se podría integrar con el MetricsManager
    if (this.metricsManager) {
      this.metricsManager.recordSecurityEvent(type, details);
    }
  }
    
  // Limpieza automática
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;
        
    for (const [sessionId, session] of this.activeSessions) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId);
        cleaned++;
      }
    }
        
    if (cleaned > 0) {
      logger.info(`🧹 Limpiadas ${cleaned} sesiones expiradas`);
    }
  }
    
  cleanupLoginAttempts() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    let cleaned = 0;
        
    for (const [key, record] of this.loginAttempts) {
      if (now - record.lastAttempt > maxAge) {
        this.loginAttempts.delete(key);
        cleaned++;
      }
    }
        
    if (cleaned > 0) {
      logger.info(`🧹 Limpiados ${cleaned} registros de intentos de login`);
    }
  }
    
  cleanupBlockedIPs() {
    const now = Date.now();
    let cleaned = 0;
        
    for (const [ip, blockInfo] of this.blockedIPs) {
      if (blockInfo.expiresAt < now) {
        this.blockedIPs.delete(ip);
        cleaned++;
      }
    }
        
    if (cleaned > 0) {
      logger.info(`🧹 Desbloqueadas ${cleaned} IPs`);
    }
  }
    
  // Configurar métricas manager
  setMetricsManager(metricsManager) {
    this.metricsManager = metricsManager;
  }
    
  async close() {
    // Log before closing
    if (this.secureLogger) {
      await this.secureLogger.info('AdvancedSecurity', 'Sistema de seguridad cerrando...');
    }
        
    // Limpiar recursos
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
        
    this.activeSessions.clear();
    this.loginAttempts.clear();
    this.blockedIPs.clear();
    this.refreshTokens.clear();
        
    // Close SessionStore
    if (this.sessionStore) {
      await this.sessionStore.close();
    }
        
    // Close ThreatDetection
    if (this.threatDetection) {
      this.threatDetection.close();
    }
        
    // Close GeoLocation
    if (this.geoLocation) {
      this.geoLocation.close();
    }
        
    // Close SecureLogger last
    if (this.secureLogger) {
      await this.secureLogger.close();
    }
  }
    
  // ===== 2FA METHODS =====
    
  // Setup 2FA for a user
  async setup2FA(userIdentifier, method = 'totp') {
    try {
      const setup = await this.twoFactorAuth.setup2FA(userIdentifier, method);
            
      await this.secureLogger.logAuthenticationEvent('2fa_setup_initiated', {
        userIdentifier,
        method,
        timestamp: new Date()
      });
            
      return {
        success: true,
        setup
      };
    } catch (error) {
      await this.secureLogger.error('2FA setup failed', { userIdentifier, method, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
    
  // Verify 2FA setup
  async verify2FASetup(setup, verificationCode, method = 'totp') {
    try {
      const result = await this.twoFactorAuth.verify2FASetup(setup, verificationCode, method);
            
      if (result.success) {
        await this.secureLogger.logAuthenticationEvent('2fa_setup_verified', {
          method,
          timestamp: new Date()
        });
      } else {
        await this.secureLogger.logAuthenticationEvent('2fa_setup_verification_failed', {
          method,
          timestamp: new Date()
        });
      }
            
      return result;
    } catch (error) {
      await this.secureLogger.error('2FA setup verification failed', { method, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
    
  // Authenticate with 2FA
  async authenticate2FA(userConfig, code, method = null) {
    try {
      const result = await this.twoFactorAuth.authenticate2FA(userConfig, code, method);
            
      if (result.success) {
        await this.secureLogger.logAuthenticationEvent('2fa_authentication_success', {
          method: result.method,
          timestamp: new Date()
        });
      } else {
        await this.secureLogger.logAuthenticationEvent('2fa_authentication_failed', {
          method: method || userConfig.method,
          error: result.error,
          timestamp: new Date()
        });
      }
            
      return result;
    } catch (error) {
      await this.secureLogger.error('2FA authentication error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
    

    
  // Regenerate backup codes
  regenerate2FABackupCodes(userConfig) {
    try {
      const result = this.twoFactorAuth.regenerateBackupCodes(userConfig);
            
      this.secureLogger.logAuthenticationEvent('2fa_backup_codes_regenerated', {
        timestamp: new Date()
      });
            
      return result;
    } catch (error) {
      this.secureLogger.error('2FA backup codes regeneration failed', { error: error.message });
      throw error;
    }
  }
    
  // Disable 2FA
  disable2FA(userConfig) {
    try {
      const result = this.twoFactorAuth.disable2FA(userConfig);
            
      this.secureLogger.logAuthenticationEvent('2fa_disabled', {
        previousMethod: userConfig.method,
        timestamp: new Date()
      });
            
      return result;
    } catch (error) {
      this.secureLogger.error('2FA disable failed', { error: error.message });
      throw error;
    }
  }
    
  // Get 2FA status
  get2FAStatus(userConfig) {
    return this.twoFactorAuth.get2FAStatus(userConfig);
  }
    
  // ===== THREAT DETECTION METHODS =====
    
  // Track login attempt with threat analysis
  async trackLoginAttempt(ip, userId = null, success = false, metadata = {}) {
    try {
      // Get location data if IP is provided
      let locationData = null;
      if (ip && !this.geoLocation.isPrivateIP(ip)) {
        locationData = await this.geoLocation.getLocationFromIP(ip);
        metadata.location = locationData;
      }
            
      // Track the attempt
      const result = this.threatDetection.trackLoginAttempt(ip, userId, success, metadata);
            
      // Log the attempt
      await this.secureLogger.logAuthenticationEvent('login_attempt_tracked', {
        ip,
        userId,
        success,
        threatScore: result.threatScore,
        isBlocked: result.isBlocked,
        isSuspicious: result.isSuspicious,
        location: locationData ? {
          country: locationData.country,
          city: locationData.city
        } : null,
        timestamp: new Date()
      });
            
      return result;
    } catch (error) {
      await this.secureLogger.error('Login attempt tracking failed', { ip, userId, error: error.message });
      return {
        isBlocked: false,
        attemptsRemaining: this.config.security.maxLoginAttempts,
        threatScore: { score: 0, level: 'minimal' },
        isSuspicious: false
      };
    }
  }
    
  // Track request with rate limiting and threat analysis
  async trackRequest(ip, endpoint = null, metadata = {}) {
    // Rate limiting desactivado - siempre permitir todas las peticiones
    return {
      isRateLimited: false,
      requestCount: 0,
      remainingRequests: 999999
    };
  }
    
  // Check if IP/user is blocked by threat detection
  isBlockedByThreatDetection(ip, userId = null) {
    return this.threatDetection.isBlocked(ip, userId);
  }
    
  // Get comprehensive threat report
  getThreatReport(ip, userId = null) {
    return this.threatDetection.getThreatReport(ip, userId);
  }
    
  // Reset threat data
  resetThreatData(ip, userId = null) {
    const result = this.threatDetection.resetThreatData(ip, userId);
        
    this.secureLogger.logSecurityEvent('threat_data_reset', {
      ip,
      userId,
      timestamp: new Date()
    });
        
    return result;
  }
    
  // ===== GEOLOCATION METHODS =====
    
  // Get location from IP
  async getLocationFromIP(ip) {
    try {
      const location = await this.geoLocation.getLocationFromIP(ip);
            
      await this.secureLogger.info('Location lookup performed', {
        ip,
        country: location.country,
        city: location.city,
        accuracy: location.accuracy
      });
            
      return location;
    } catch (error) {
      await this.secureLogger.error('Location lookup failed', { ip, error: error.message });
      throw error;
    }
  }
    
  // Detect VPN/Proxy usage
  async detectVPN(ip, locationData = null) {
    try {
      const result = await this.geoLocation.detectVPN(ip, locationData);
            
      if (result.isVPN) {
        await this.secureLogger.logSecurityEvent('vpn_detected', {
          ip,
          confidence: result.confidence,
          indicators: result.indicators,
          timestamp: new Date()
        });
      }
            
      return result;
    } catch (error) {
      await this.secureLogger.error('VPN detection failed', { ip, error: error.message });
      return {
        isVPN: false,
        confidence: 0,
        indicators: [],
        error: error.message
      };
    }
  }
    
  // Assess location risk
  assessLocationRisk(locationData) {
    const risk = this.geoLocation.assessLocationRisk(locationData);
        
    if (risk.riskScore > 40) {
      this.secureLogger.logSecurityEvent('high_risk_location_detected', {
        country: locationData.country,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        risks: risk.risks,
        timestamp: new Date()
      });
    }
        
    return risk;
  }
    
  // Get comprehensive location report
  async getLocationReport(ip, userId = null, locationHistory = []) {
    try {
      const report = await this.geoLocation.getLocationReport(ip, userId, locationHistory);
            
      await this.secureLogger.info('Location report generated', {
        ip,
        userId,
        country: report.location.country,
        riskLevel: report.riskAssessment.riskLevel,
        isVPN: report.vpnDetection.isVPN,
        timestamp: new Date()
      });
            
      return report;
    } catch (error) {
      await this.secureLogger.error('Location report generation failed', { ip, userId, error: error.message });
      throw error;
    }
  }
    
  // ===== COMPREHENSIVE SECURITY ANALYSIS =====
    
  // Perform comprehensive security check
  async performSecurityCheck(ip, userId = null, metadata = {}) {
    try {
      const results = {
        timestamp: new Date(),
        ip,
        userId,
        checks: {}
      };
            
      // Location analysis
      if (ip && !this.geoLocation.isPrivateIP(ip)) {
        results.checks.location = await this.getLocationReport(ip, userId);
        results.checks.vpn = results.checks.location.vpnDetection;
        results.checks.locationRisk = results.checks.location.riskAssessment;
      }
            
      // Threat analysis
      results.checks.threat = this.getThreatReport(ip, userId);
            
      // Rate limiting check
      results.checks.rateLimit = await this.trackRequest(ip, metadata.endpoint, metadata);
            
      // Overall risk assessment
      let overallRisk = 0;
      const riskFactors = [];
            
      if (results.checks.locationRisk?.riskScore) {
        overallRisk += results.checks.locationRisk.riskScore * 0.3;
        riskFactors.push(`Location: ${results.checks.locationRisk.riskLevel}`);
      }
            
      if (results.checks.threat?.threatScore) {
        overallRisk += results.checks.threat.threatScore * 0.4;
        riskFactors.push(`Threat: ${results.checks.threat.threatLevel}`);
      }
            
      if (results.checks.vpn?.isVPN) {
        overallRisk += results.checks.vpn.confidence * 0.2;
        riskFactors.push(`VPN: ${results.checks.vpn.confidence}% confidence`);
      }
            
      if (results.checks.rateLimit?.isRateLimited) {
        overallRisk += 20;
        riskFactors.push('Rate limited');
      }
            
      results.overallRisk = Math.min(100, Math.round(overallRisk));
      results.riskLevel = this.threatDetection.getThreatLevel(results.overallRisk);
      results.riskFactors = riskFactors;
      results.blocked = results.overallRisk >= 70;
            
      // Log comprehensive check
      await this.secureLogger.logSecurityEvent('comprehensive_security_check', {
        ip,
        userId,
        overallRisk: results.overallRisk,
        riskLevel: results.riskLevel,
        blocked: results.blocked,
        riskFactors,
        timestamp: new Date()
      });
            
      return results;
    } catch (error) {
      await this.secureLogger.error('Comprehensive security check failed', { ip, userId, error: error.message });
      throw error;
    }
  }
    
  // Get security statistics
  getSecurityStatistics() {
    return {
      threatDetection: this.threatDetection.getStatistics(),
      geoLocation: this.geoLocation.getCacheStats(),
      sessions: {
        active: this.activeSessions.size,
        stored: this.sessionStore ? 'Available' : 'Not configured'
      },
      loginAttempts: this.loginAttempts.size,
      blockedIPs: this.blockedIPs.size,
      refreshTokens: this.refreshTokens.size,
      timestamp: new Date()
    };
  }
}

export default AdvancedSecurity;
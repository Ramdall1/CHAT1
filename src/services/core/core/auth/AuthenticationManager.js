import { EventEmitter } from 'events';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createLogger } from '../logger.js';

/**
 * Gestor de autenticación para el sistema de seguridad
 * Maneja la autenticación de usuarios con múltiples estrategias
 */
class AuthenticationManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.logger = createLogger('AUTHENTICATION_MANAGER');
        
    this.config = {
      enabled: true,
            
      // Configuración de JWT
      jwt: {
        secret: config.jwt?.secret || crypto.randomBytes(64).toString('hex'),
        algorithm: 'HS256',
        expiresIn: '24h',
        refreshExpiresIn: '7d',
        issuer: 'chatbot-system',
        audience: 'chatbot-users'
      },
            
      // Configuración de sesiones
      session: {
        enabled: true,
        secret: config.session?.secret || crypto.randomBytes(64).toString('hex'),
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax', // Cambiado de 'strict' a 'lax' para compatibilidad con Safari
        rolling: true
      },
            
      // Configuración de contraseñas
      password: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        saltRounds: 12,
        maxAttempts: 5,
        lockoutDuration: 15 * 60 * 1000 // 15 minutos
      },
            
      // Configuración de autenticación multifactor
      mfa: {
        enabled: false,
        methods: ['totp', 'sms', 'email'],
        totpWindow: 1,
        totpStep: 30,
        backupCodes: 10
      },
            
      // Configuración de OAuth
      oauth: {
        enabled: false,
        providers: {
          google: {
            clientId: '',
            clientSecret: '',
            scope: ['profile', 'email']
          },
          github: {
            clientId: '',
            clientSecret: '',
            scope: ['user:email']
          }
        }
      },
            
      // Configuración de rate limiting
      rateLimit: {
        enabled: true,
        maxAttempts: 10,
        windowMs: 15 * 60 * 1000, // 15 minutos
        blockDuration: 60 * 60 * 1000 // 1 hora
      },
            
      // Configuración de logging
      logging: {
        enabled: true,
        logSuccessfulLogins: true,
        logFailedAttempts: true,
        logPasswordChanges: true,
        logMfaEvents: true
      },
            
      ...config
    };
        
    this.state = 'initialized';
    this.users = new Map();
    this.sessions = new Map();
    this.refreshTokens = new Map();
    this.loginAttempts = new Map();
    this.blockedIPs = new Map();
    this.mfaTokens = new Map();
    this.oauthStates = new Map();
        
    this.statistics = {
      totalLogins: 0,
      successfulLogins: 0,
      failedLogins: 0,
      blockedAttempts: 0,
      passwordResets: 0,
      mfaVerifications: 0,
      oauthLogins: 0,
      sessionsCreated: 0,
      sessionsDestroyed: 0,
      tokensIssued: 0,
      tokensRevoked: 0
    };
        
    this.loginHistory = [];
    this.securityEvents = [];
        
    this._initializeCleanupTimers();
  }
    
  /**
     * Inicializa el gestor de autenticación
     */
  async initialize() {
    try {
      this._validateConfig();
      this._setupEventHandlers();
            
      this.state = 'ready';
      this.emit('initialized');
            
      return true;
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Registra un nuevo usuario
     */
  async registerUser(userData) {
    try {
      const { username, email, password, profile = {} } = userData;
            
      // Validar datos de entrada
      this._validateUserData({ username, email, password });
            
      // Verificar si el usuario ya existe
      if (this._userExists(username, email)) {
        throw new Error('User already exists');
      }
            
      // Hash de la contraseña
      const hashedPassword = await this._hashPassword(password);
            
      // Crear usuario
      const user = {
        id: crypto.randomUUID(),
        username,
        email,
        password: hashedPassword,
        profile,
        roles: ['user'],
        permissions: [],
        mfa: {
          enabled: false,
          methods: [],
          backupCodes: []
        },
        oauth: {
          providers: {}
        },
        security: {
          lastLogin: null,
          lastPasswordChange: new Date(),
          loginAttempts: 0,
          locked: false,
          lockUntil: null,
          passwordHistory: [hashedPassword]
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false,
          phoneVerified: false
        }
      };
            
      this.users.set(user.id, user);
            
      this.emit('userRegistered', { userId: user.id, username, email });
      this._logSecurityEvent('USER_REGISTERED', { userId: user.id, username });
            
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        profile: user.profile
      };
    } catch (error) {
      this.emit('registrationError', error);
      throw error;
    }
  }
    
  /**
     * Autentica un usuario
     */
  async authenticateUser(credentials, options = {}) {
    try {
      const { username, password, ip, userAgent } = credentials;
      const { mfaToken, rememberMe = false } = options;
            
      this.statistics.totalLogins++;
            
      // Verificar rate limiting
      if (this._isRateLimited(ip)) {
        this.statistics.blockedAttempts++;
        throw new Error('Too many login attempts. Please try again later.');
      }
            
      // Buscar usuario
      const user = this._findUserByCredentials(username);
      if (!user) {
        this._recordFailedAttempt(ip, username);
        throw new Error('Invalid credentials');
      }
            
      // Verificar si la cuenta está bloqueada
      if (this._isAccountLocked(user)) {
        this._recordFailedAttempt(ip, username);
        throw new Error('Account is locked. Please try again later.');
      }
            
      // Verificar contraseña
      const isValidPassword = await this._verifyPassword(password, user.password);
      if (!isValidPassword) {
        this._recordFailedAttempt(ip, username, user.id);
        throw new Error('Invalid credentials');
      }
            
      // Verificar MFA si está habilitado
      if (user.mfa.enabled && !mfaToken) {
        const mfaChallenge = await this._createMfaChallenge(user);
        return {
          requiresMfa: true,
          challenge: mfaChallenge,
          userId: user.id
        };
      }
            
      if (user.mfa.enabled && mfaToken) {
        const isMfaValid = await this._verifyMfaToken(user, mfaToken);
        if (!isMfaValid) {
          this._recordFailedAttempt(ip, username, user.id);
          throw new Error('Invalid MFA token');
        }
      }
            
      // Autenticación exitosa
      this._clearFailedAttempts(ip, user.id);
      this._updateUserLoginInfo(user, ip, userAgent);
            
      // Crear sesión y tokens
      const session = await this._createSession(user, { ip, userAgent, rememberMe });
      const tokens = await this._generateTokens(user, session);
            
      this.statistics.successfulLogins++;
      this.statistics.sessionsCreated++;
      this.statistics.tokensIssued++;
            
      this.emit('userAuthenticated', { 
        userId: user.id, 
        username: user.username,
        sessionId: session.id,
        ip,
        userAgent
      });
            
      this._logSecurityEvent('USER_LOGIN', { 
        userId: user.id, 
        username: user.username,
        ip,
        userAgent
      });
            
      return {
        user: this._sanitizeUser(user),
        session: session,
        tokens: tokens
      };
            
    } catch (error) {
      this.statistics.failedLogins++;
      this.emit('authenticationError', error);
      throw error;
    }
  }
    
  /**
     * Verifica un token JWT
     */
  async verifyToken(token, type = 'access') {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        algorithms: [this.config.jwt.algorithm],
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience
      });
            
      if (decoded.type !== type) {
        throw new Error('Invalid token type');
      }
            
      const user = this.users.get(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }
            
      const session = this.sessions.get(decoded.sessionId);
      if (!session || session.revoked) {
        throw new Error('Session not found or revoked');
      }
            
      // Actualizar última actividad de la sesión
      session.lastActivity = new Date();
            
      return {
        user: this._sanitizeUser(user),
        session: session,
        decoded: decoded
      };
            
    } catch (error) {
      this.emit('tokenVerificationError', error);
      throw error;
    }
  }
    
  /**
     * Refresca un token de acceso
     */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.config.jwt.secret);
            
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
            
      const storedToken = this.refreshTokens.get(decoded.jti);
      if (!storedToken || storedToken.revoked) {
        throw new Error('Refresh token not found or revoked');
      }
            
      const user = this.users.get(decoded.userId);
      const session = this.sessions.get(decoded.sessionId);
            
      if (!user || !session) {
        throw new Error('User or session not found');
      }
            
      // Revocar el token anterior
      storedToken.revoked = true;
            
      // Generar nuevos tokens
      const newTokens = await this._generateTokens(user, session);
            
      this.statistics.tokensIssued++;
      this.statistics.tokensRevoked++;
            
      this.emit('tokenRefreshed', { 
        userId: user.id,
        sessionId: session.id
      });
            
      return newTokens;
            
    } catch (error) {
      this.emit('tokenRefreshError', error);
      throw error;
    }
  }
    
  /**
     * Cierra sesión de un usuario
     */
  async logout(sessionId, revokeAllSessions = false) {
    try {
      if (revokeAllSessions) {
        // Revocar todas las sesiones del usuario
        const session = this.sessions.get(sessionId);
        if (session) {
          const userSessions = Array.from(this.sessions.values())
            .filter(s => s.userId === session.userId);
                    
          for (const userSession of userSessions) {
            await this._revokeSession(userSession.id);
          }
        }
      } else {
        // Revocar solo la sesión específica
        await this._revokeSession(sessionId);
      }
            
      this.emit('userLoggedOut', { sessionId, revokeAllSessions });
            
      return true;
    } catch (error) {
      this.emit('logoutError', error);
      throw error;
    }
  }
    
  /**
     * Cambia la contraseña de un usuario
     */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }
            
      // Verificar contraseña actual
      const isCurrentValid = await this._verifyPassword(currentPassword, user.password);
      if (!isCurrentValid) {
        throw new Error('Current password is incorrect');
      }
            
      // Validar nueva contraseña
      this._validatePassword(newPassword);
            
      // Verificar que no sea una contraseña usada anteriormente
      const isPasswordReused = await this._isPasswordReused(newPassword, user.security.passwordHistory);
      if (isPasswordReused) {
        throw new Error('Cannot reuse a previous password');
      }
            
      // Hash de la nueva contraseña
      const hashedPassword = await this._hashPassword(newPassword);
            
      // Actualizar usuario
      user.password = hashedPassword;
      user.security.lastPasswordChange = new Date();
      user.security.passwordHistory.push(hashedPassword);
            
      // Mantener solo las últimas 5 contraseñas
      if (user.security.passwordHistory.length > 5) {
        user.security.passwordHistory = user.security.passwordHistory.slice(-5);
      }
            
      user.metadata.updatedAt = new Date();
            
      this.statistics.passwordResets++;
            
      this.emit('passwordChanged', { userId });
      this._logSecurityEvent('PASSWORD_CHANGED', { userId });
            
      return true;
    } catch (error) {
      this.emit('passwordChangeError', error);
      throw error;
    }
  }
    
  /**
     * Habilita la autenticación multifactor
     */
  async enableMfa(userId, method = 'totp') {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }
            
      if (!this.config.mfa.methods.includes(method)) {
        throw new Error('MFA method not supported');
      }
            
      let mfaData = {};
            
      if (method === 'totp') {
        const secret = crypto.randomBytes(20).toString('base32');
        const qrCode = this._generateTotpQrCode(user.username, secret);
                
        mfaData = {
          secret: secret,
          qrCode: qrCode
        };
      }
            
      // Generar códigos de respaldo
      const backupCodes = this._generateBackupCodes();
            
      user.mfa = {
        enabled: true,
        methods: [method],
        [method]: mfaData,
        backupCodes: backupCodes.map(code => ({ 
          code: this._hashBackupCode(code), 
          used: false 
        }))
      };
            
      user.metadata.updatedAt = new Date();
            
      this.emit('mfaEnabled', { userId, method });
      this._logSecurityEvent('MFA_ENABLED', { userId, method });
            
      return {
        method: method,
        ...mfaData,
        backupCodes: backupCodes
      };
    } catch (error) {
      this.emit('mfaError', error);
      throw error;
    }
  }
    
  /**
     * Obtiene estadísticas del gestor
     */
  getStatistics() {
    return {
      ...this.statistics,
      activeUsers: this.users.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => !s.revoked).length,
      activeRefreshTokens: Array.from(this.refreshTokens.values()).filter(t => !t.revoked).length,
      blockedIPs: this.blockedIPs.size,
      pendingMfaTokens: this.mfaTokens.size
    };
  }
    
  /**
     * Obtiene el historial de logins
     */
  getLoginHistory(limit = 100) {
    return this.loginHistory.slice(-limit);
  }
    
  /**
     * Obtiene eventos de seguridad
     */
  getSecurityEvents(limit = 100) {
    return this.securityEvents.slice(-limit);
  }
    
  /**
     * Limpia datos expirados
     */
  async cleanup() {
    const now = new Date();
        
    // Limpiar sesiones expiradas
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        this.statistics.sessionsDestroyed++;
      }
    }
        
    // Limpiar tokens de refresco expirados
    for (const [tokenId, token] of this.refreshTokens) {
      if (token.expiresAt < now) {
        this.refreshTokens.delete(tokenId);
        this.statistics.tokensRevoked++;
      }
    }
        
    // Limpiar intentos de login expirados
    for (const [key, attempts] of this.loginAttempts) {
      if (attempts.resetAt < now) {
        this.loginAttempts.delete(key);
      }
    }
        
    // Limpiar IPs bloqueadas
    for (const [ip, blockInfo] of this.blockedIPs) {
      if (blockInfo.unblockAt < now) {
        this.blockedIPs.delete(ip);
      }
    }
        
    // Limpiar tokens MFA expirados
    for (const [tokenId, token] of this.mfaTokens) {
      if (token.expiresAt < now) {
        this.mfaTokens.delete(tokenId);
      }
    }
        
    this.emit('cleanupCompleted');
  }
    
  /**
     * Habilita o deshabilita el gestor
     */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    this.emit(enabled ? 'enabled' : 'disabled');
  }
    
  /**
     * Destruye el gestor
     */
  async destroy() {
    this.state = 'destroyed';
        
    // Limpiar timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    // Limpiar datos
    this.users.clear();
    this.sessions.clear();
    this.refreshTokens.clear();
    this.loginAttempts.clear();
    this.blockedIPs.clear();
    this.mfaTokens.clear();
    this.oauthStates.clear();
        
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  _validateConfig() {
    if (!this.config.jwt.secret) {
      throw new Error('JWT secret is required');
    }
        
    if (this.config.password.minLength < 4) {
      throw new Error('Minimum password length must be at least 4');
    }
        
    if (this.config.password.saltRounds < 10) {
      throw new Error('Salt rounds must be at least 10');
    }
  }
    
  _setupEventHandlers() {
    this.on('error', (error) => {
      if (this.config.logging.enabled) {
        this.logger.error('Authentication error:', error);
      }
    });
  }
    
  _initializeCleanupTimers() {
    // Limpiar datos expirados cada 5 minutos
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.emit('error', error);
      });
    }, 5 * 60 * 1000);
  }
    
  _validateUserData({ username, email, password }) {
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }
        
    if (!email || !this._isValidEmail(email)) {
      throw new Error('Valid email is required');
    }
        
    this._validatePassword(password);
  }
    
  _validatePassword(password) {
    const config = this.config.password;
        
    if (!password || password.length < config.minLength) {
      throw new Error(`Password must be at least ${config.minLength} characters long`);
    }
        
    if (password.length > config.maxLength) {
      throw new Error(`Password must be no more than ${config.maxLength} characters long`);
    }
        
    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
        
    if (config.requireLowercase && !/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
        
    if (config.requireNumbers && !/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
        
    if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }
    
  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
    
  _userExists(username, email) {
    return Array.from(this.users.values()).some(user => 
      user.username === username || user.email === email
    );
  }
    
  async _hashPassword(password) {
    return bcrypt.hash(password, this.config.password.saltRounds);
  }
    
  async _verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
    
  async _isPasswordReused(password, passwordHistory) {
    for (const hash of passwordHistory) {
      if (await this._verifyPassword(password, hash)) {
        return true;
      }
    }
    return false;
  }
    
  _findUserByCredentials(identifier) {
    return Array.from(this.users.values()).find(user => 
      user.username === identifier || user.email === identifier
    );
  }
    
  _isRateLimited(ip) {
    const blockInfo = this.blockedIPs.get(ip);
    return blockInfo && blockInfo.unblockAt > new Date();
  }
    
  _isAccountLocked(user) {
    return user.security.locked && user.security.lockUntil > new Date();
  }
    
  _recordFailedAttempt(ip, username, userId = null) {
    const now = new Date();
        
    // Rate limiting por IP
    const ipKey = `ip:${ip}`;
    const ipAttempts = this.loginAttempts.get(ipKey) || { count: 0, resetAt: now };
        
    if (ipAttempts.resetAt < now) {
      ipAttempts.count = 0;
      ipAttempts.resetAt = new Date(now.getTime() + this.config.rateLimit.windowMs);
    }
        
    ipAttempts.count++;
    this.loginAttempts.set(ipKey, ipAttempts);
        
    if (ipAttempts.count >= this.config.rateLimit.maxAttempts) {
      this.blockedIPs.set(ip, {
        unblockAt: new Date(now.getTime() + this.config.rateLimit.blockDuration)
      });
    }
        
    // Bloqueo de cuenta por usuario
    if (userId) {
      const user = this.users.get(userId);
      if (user) {
        user.security.loginAttempts++;
                
        if (user.security.loginAttempts >= this.config.password.maxAttempts) {
          user.security.locked = true;
          user.security.lockUntil = new Date(now.getTime() + this.config.password.lockoutDuration);
        }
      }
    }
        
    this._logSecurityEvent('FAILED_LOGIN_ATTEMPT', { ip, username, userId });
  }
    
  _clearFailedAttempts(ip, userId) {
    const ipKey = `ip:${ip}`;
    this.loginAttempts.delete(ipKey);
        
    const user = this.users.get(userId);
    if (user) {
      user.security.loginAttempts = 0;
      user.security.locked = false;
      user.security.lockUntil = null;
    }
  }
    
  _updateUserLoginInfo(user, ip, userAgent) {
    user.security.lastLogin = new Date();
    user.metadata.updatedAt = new Date();
        
    this.loginHistory.push({
      userId: user.id,
      username: user.username,
      ip: ip,
      userAgent: userAgent,
      timestamp: new Date(),
      success: true
    });
        
    // Mantener solo los últimos 1000 registros
    if (this.loginHistory.length > 1000) {
      this.loginHistory = this.loginHistory.slice(-1000);
    }
  }
    
  async _createSession(user, options = {}) {
    const session = {
      id: crypto.randomUUID(),
      userId: user.id,
      ip: options.ip,
      userAgent: options.userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.config.session.maxAge),
      persistent: options.rememberMe || false,
      revoked: false
    };
        
    this.sessions.set(session.id, session);
    return session;
  }
    
  async _generateTokens(user, session) {
    const now = Math.floor(Date.now() / 1000);
    const accessTokenId = crypto.randomUUID();
    const refreshTokenId = crypto.randomUUID();
        
    // Token de acceso
    const accessToken = jwt.sign({
      jti: accessTokenId,
      type: 'access',
      userId: user.id,
      sessionId: session.id,
      username: user.username,
      roles: user.roles,
      permissions: user.permissions,
      iat: now,
      exp: now + (24 * 60 * 60), // 24 horas
      iss: this.config.jwt.issuer,
      aud: this.config.jwt.audience
    }, this.config.jwt.secret, {
      algorithm: this.config.jwt.algorithm
    });
        
    // Token de refresco
    const refreshToken = jwt.sign({
      jti: refreshTokenId,
      type: 'refresh',
      userId: user.id,
      sessionId: session.id,
      iat: now,
      exp: now + (7 * 24 * 60 * 60), // 7 días
      iss: this.config.jwt.issuer,
      aud: this.config.jwt.audience
    }, this.config.jwt.secret, {
      algorithm: this.config.jwt.algorithm
    });
        
    // Almacenar token de refresco
    this.refreshTokens.set(refreshTokenId, {
      id: refreshTokenId,
      userId: user.id,
      sessionId: session.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
      revoked: false
    });
        
    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: 24 * 60 * 60,
      tokenType: 'Bearer'
    };
  }
    
  async _revokeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.revoked = true;
            
      // Revocar todos los tokens de refresco de esta sesión
      for (const [tokenId, token] of this.refreshTokens) {
        if (token.sessionId === sessionId) {
          token.revoked = true;
          this.statistics.tokensRevoked++;
        }
      }
            
      this.statistics.sessionsDestroyed++;
      this.emit('sessionRevoked', { sessionId });
    }
  }
    
  async _createMfaChallenge(user) {
    const challengeId = crypto.randomUUID();
    const challenge = {
      id: challengeId,
      userId: user.id,
      methods: user.mfa.methods,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutos
    };
        
    this.mfaTokens.set(challengeId, challenge);
        
    return {
      challengeId: challengeId,
      methods: user.mfa.methods,
      expiresIn: 300
    };
  }
    
  async _verifyMfaToken(user, token) {
    // Implementación simplificada - en producción usar librerías como speakeasy
    if (user.mfa.methods.includes('totp')) {
      // Verificar TOTP
      return token.length === 6 && /^\d{6}$/.test(token);
    }
        
    // Verificar códigos de respaldo
    for (const backupCode of user.mfa.backupCodes) {
      if (!backupCode.used && this._verifyBackupCode(token, backupCode.code)) {
        backupCode.used = true;
        return true;
      }
    }
        
    return false;
  }
    
  _generateTotpQrCode(username, secret) {
    const issuer = encodeURIComponent(this.config.jwt.issuer);
    const user = encodeURIComponent(username);
    return `otpauth://totp/${issuer}:${user}?secret=${secret}&issuer=${issuer}`;
  }
    
  _generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < this.config.mfa.backupCodes; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }
    
  _hashBackupCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }
    
  _verifyBackupCode(code, hash) {
    return this._hashBackupCode(code) === hash;
  }
    
  _sanitizeUser(user) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
    
  _logSecurityEvent(type, data) {
    if (!this.config.logging.enabled) return;
        
    const event = {
      type: type,
      timestamp: new Date(),
      data: data
    };
        
    this.securityEvents.push(event);
        
    // Mantener solo los últimos 1000 eventos
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }
        
    this.emit('securityEvent', event);
  }
}

export default AuthenticationManager;
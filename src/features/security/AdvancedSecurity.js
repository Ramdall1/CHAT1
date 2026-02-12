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

class AdvancedSecurity {
  constructor(config = {}) {
    // Configuración básica
      this.config = {
        jwtSecret: config.jwtSecret || process.env.JWT_SECRET || 'default-secret-key',
        jwtRefreshSecret: config.jwtRefreshSecret || process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
        accessTokenExpiry: config.accessTokenExpiry || config.jwtExpiresIn || '15m',
        refreshTokenExpiry: config.refreshTokenExpiry || '7d',
        bcryptRounds: config.bcryptRounds || 12,
        maxLoginAttempts: config.maxLoginAttempts || 5,
        lockoutDuration: config.lockoutDuration || 15 * 60 * 1000, // 15 minutos
        sessionMaxAge: config.sessionMaxAge || 24 * 60 * 60 * 1000, // 24 horas por defecto
        ...config
      };

    // Almacenamiento en memoria para intentos de login y tokens revocados
    this.loginAttempts = new Map();
    this.revokedTokens = new Set();
    this.sessions = new Map();
    
    // Inicializar limpieza periódica
    this.startCleanupInterval();
  }

  startCleanupInterval() {
    // Limpiar datos expirados cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredData();
    }, 5 * 60 * 1000);
  }

  cleanupExpiredData() {
    const now = Date.now();
    
    // Limpiar intentos de login expirados
    for (const [key, data] of this.loginAttempts.entries()) {
      if (data.lockedUntil && data.lockedUntil < now) {
        this.loginAttempts.delete(key);
      }
    }
  }

  async hashPassword(password) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }
      
      return await bcrypt.hash(password, this.config.bcryptRounds);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  async verifyPassword(password, hash) {
    try {
      if (!password || !hash) {
        return false;
      }
      
      return await bcrypt.compare(password, hash);
    } catch (error) {
      return false;
    }
  }

  generateTokens(payload) {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload must be an object');
      }

      const accessToken = jwt.sign(
        payload,
        this.config.jwtSecret,
        { 
          expiresIn: this.config.accessTokenExpiry,
          issuer: 'chatbot-system',
          audience: 'chatbot-users'
        }
      );

      const refreshToken = jwt.sign(
        { userId: payload.id || payload.userId },
        this.config.jwtRefreshSecret,
        { 
          expiresIn: this.config.refreshTokenExpiry,
          issuer: 'chatbot-system',
          audience: 'chatbot-users'
        }
      );

      return { accessToken, refreshToken };
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  verifyToken(token) {
     try {
       if (!token || typeof token !== 'string') {
         throw new Error('Token must be a non-empty string');
       }

       if (this.revokedTokens.has(token)) {
         throw new Error('Token has been revoked');
       }

       return jwt.verify(token, this.config.jwtSecret);
     } catch (error) {
       if (error.name === 'TokenExpiredError') {
         throw new Error('Token ha expirado');
       }
       throw new Error(`Token verification failed: ${error.message}`);
     }
   }

  recordFailedLogin(identifier, ip = null) {
    const key = identifier;
    const now = Date.now();
    
    if (!this.loginAttempts.has(key)) {
      this.loginAttempts.set(key, {
        attempts: 0,
        lastAttempt: now,
        lockedUntil: null
      });
    }

    const data = this.loginAttempts.get(key);
    data.attempts += 1;
    data.lastAttempt = now;

    if (data.attempts >= this.config.maxLoginAttempts) {
      data.lockedUntil = now + this.config.lockoutDuration;
    }

    this.loginAttempts.set(key, data);
  }

  recordSuccessfulLogin(identifier, ip = null) {
    // Limpiar intentos fallidos después de login exitoso
    this.loginAttempts.delete(identifier);
  }

  isAccountLocked(identifier) {
    const data = this.loginAttempts.get(identifier);
    if (!data) return false;

    if (data.lockedUntil && data.lockedUntil > Date.now()) {
      return true;
    }

    // Si el lockout expiró, limpiar los datos
    if (data.lockedUntil && data.lockedUntil <= Date.now()) {
      this.loginAttempts.delete(identifier);
      return false;
    }

    return false;
  }

  getLoginAttempts(identifier) {
    const data = this.loginAttempts.get(identifier);
    return data ? data.attempts : 0;
  }

  resetLoginAttempts(identifier) {
     this.loginAttempts.delete(identifier);
   }

   createSession(sessionData, options = {}) {
      const sessionId = crypto.randomBytes(32).toString('hex');
      const now = Date.now();
      const expiresAt = now + (options.maxAge || this.config.sessionMaxAge);

      this.sessions.set(sessionId, {
        ...sessionData,
        createdAt: now,
        expiresAt,
        lastAccessed: now
      });

      return sessionId;
    }

   getSession(sessionId) {
     const session = this.sessions.get(sessionId);
     if (!session) return null;

     // Verificar si la sesión ha expirado
     if (session.expiresAt < Date.now()) {
       this.sessions.delete(sessionId);
       return null;
     }

     // Actualizar último acceso
     session.lastAccessed = Date.now();
     this.sessions.set(sessionId, session);

     return session;
   }

   destroySession(sessionId) {
     return this.sessions.delete(sessionId);
   }

  validateInput(data, rules) {
    const errors = [];
    
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      
      if (rule.required && (!value || value.toString().trim() === '')) {
         errors.push(`${field} es requerido`);
         continue;
       }
       
       if (value && rule.type) {
          switch (rule.type) {
            case 'email':
              if (!validator.isEmail(value)) {
                errors.push(`${field} debe ser un email válido`);
              }
              break;
            case 'string':
              if (typeof value !== 'string') {
                errors.push(`${field} debe ser una cadena de texto`);
              }
              break;
            case 'number':
              if (isNaN(Number(value))) {
                errors.push(`${field} debe ser un número`);
              }
              break;
            case 'enum':
              if (rule.values && !rule.values.includes(value)) {
                errors.push(`${field} debe ser uno de: ${rule.values.join(', ')}`);
              }
              break;
          }
        }
       
       if (value && rule.minLength && value.length < rule.minLength) {
         errors.push(`${field} debe tener al menos ${rule.minLength} caracteres`);
       }
       
       if (value && rule.maxLength && value.length > rule.maxLength) {
         errors.push(`${field} debe tener máximo ${rule.maxLength} caracteres`);
       }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    // Sanitizar XSS
    let sanitized = xss(str);
    
    // Escapar caracteres especiales adicionales
    sanitized = sanitized
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
    
    return sanitized.trim();
  }

  validatePassword(password) {
    const errors = [];
    
    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password)
    };
  }

  calculatePasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    if (password.length >= 16) score += 1;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  }

  async close() {
    // Limpiar intervalos y recursos
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Limpiar datos en memoria
    this.loginAttempts.clear();
    this.revokedTokens.clear();
    this.sessions.clear();
  }
}

export default AdvancedSecurity;
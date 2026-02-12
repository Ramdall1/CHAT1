/**
 * @fileoverview Sistema de Autenticación y Autorización Avanzado
 * 
 * Módulo completo para gestionar:
 * - Generación y validación de JWT
 * - Autenticación multi-factor
 * - Control de acceso basado en roles
 * - Gestión de sesiones
 * - Auditoría de seguridad
 * 
 * @author ChatBot Enterprise Team
 * @version 3.0.0
 */

import { expressjwt } from 'express-jwt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import environmentConfig from '../../../config/environments/environments/environment.js';
import { createLogger } from './logger.js';

const logger = createLogger('AUTH_SERVICE');
const secret = environmentConfig.getSection('security').jwtSecret;
const algorithm = 'HS256';
const tokenExpiry = process.env.JWT_EXPIRY || '1h';
const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Generar token JWT
 */
export function generateToken(user, options = {}) {
  const payload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    roles: user.roles || ['user'],
    permissions: user.permissions || [],
    iat: Math.floor(Date.now() / 1000),
    ...options.customClaims
  };

  return jwt.sign(payload, secret, {
    algorithm,
    expiresIn: options.expiresIn || tokenExpiry,
    issuer: 'chatbot-enterprise',
    audience: 'chatbot-api'
  });
}

/**
 * Generar refresh token
 */
export function generateRefreshToken(user) {
  const payload = {
    sub: user.id,
    type: 'refresh',
    tokenId: crypto.randomBytes(16).toString('hex')
  };

  return jwt.sign(payload, secret, {
    algorithm,
    expiresIn: refreshTokenExpiry,
    issuer: 'chatbot-enterprise'
  });
}

/**
 * Verificar y decodificar token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, secret, {
      algorithms: [algorithm],
      issuer: 'chatbot-enterprise'
    });
  } catch (error) {
    logger.error('Error verificando token:', error.message);
    throw new Error('Token inválido o expirado');
  }
}

/**
 * Middleware de autenticación
 */
export const authenticate = expressjwt({
  secret,
  algorithms: [algorithm],
  credentialsRequired: true,
  requestProperty: 'auth'
});

/**
 * Middleware de autenticación opcional
 */
export const authenticateOptional = expressjwt({
  secret,
  algorithms: [algorithm],
  credentialsRequired: false,
  requestProperty: 'auth'
});

/**
 * Middleware de autorización por roles
 */
export function authorize(roles = []) {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return [
    authenticate,
    (req, res, next) => {
      if (roles.length && !roles.some(role => req.auth.roles?.includes(role))) {
        logger.warn(`Acceso denegado para usuario ${req.auth.username} a roles ${roles.join(', ')}`);
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tienes permisos para acceder a este recurso',
          requiredRoles: roles
        });
      }
      next();
    }
  ];
}

/**
 * Middleware de autorización por permisos
 */
export function authorizePermissions(permissions = []) {
  if (typeof permissions === 'string') {
    permissions = [permissions];
  }

  return [
    authenticate,
    (req, res, next) => {
      const userPermissions = req.auth.permissions || [];
      const hasPermission = permissions.some(perm => userPermissions.includes(perm));

      if (!hasPermission) {
        logger.warn(`Permiso denegado para usuario ${req.auth.username}`);
        return res.status(403).json({
          error: 'Permiso denegado',
          message: 'No tienes los permisos necesarios',
          requiredPermissions: permissions
        });
      }
      next();
    }
  ];
}

/**
 * Middleware de autenticación multi-factor
 */
export function requireMFA() {
  return [
    authenticate,
    (req, res, next) => {
      if (!req.auth.mfaVerified) {
        logger.warn(`MFA requerido para usuario ${req.auth.username}`);
        return res.status(403).json({
          error: 'MFA requerido',
          message: 'Debes completar la autenticación de dos factores'
        });
      }
      next();
    }
  ];
}

/**
 * Validar credenciales
 */
export function validateCredentials(username, password) {
  const errors = [];

  if (!username || username.trim().length === 0) {
    errors.push('Usuario es requerido');
  }

  if (!password || password.length < 8) {
    errors.push('Contraseña debe tener al menos 8 caracteres');
  }

  if (username && username.length > 100) {
    errors.push('Usuario no puede exceder 100 caracteres');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generar hash de contraseña
 */
export function hashPassword(password) {
  return crypto
    .pbkdf2Sync(password, process.env.PASSWORD_SALT || 'default-salt', 1000, 64, 'sha512')
    .toString('hex');
}

/**
 * Verificar contraseña
 */
export function verifyPassword(password, hash) {
  const newHash = hashPassword(password);
  return newHash === hash;
}

/**
 * Generar código de verificación
 */
export function generateVerificationCode(length = 6) {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Crear sesión
 */
export function createSession(user) {
  return {
    sessionId: crypto.randomUUID(),
    userId: user.id,
    username: user.username,
    token: generateToken(user),
    refreshToken: generateRefreshToken(user),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
}

export default {
  generateToken,
  generateRefreshToken,
  verifyToken,
  authenticate,
  authenticateOptional,
  authorize,
  authorizePermissions,
  requireMFA,
  validateCredentials,
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  createSession
};

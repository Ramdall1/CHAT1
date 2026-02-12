/**
 * @fileoverview Middleware de autenticación centralizado optimizado
 * Consolida todas las configuraciones de seguridad duplicadas con optimizaciones de performance
 */

import jwt from 'jsonwebtoken';
import SecurityMonitor from '../services/security/SecurityMonitor.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Cache para tokens verificados (TTL: 5 minutos)
const tokenCache = new Map();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache para patrones de seguridad compilados
const SECURITY_PATTERNS = {
  pathTraversal: /\.\./,
  xssScript: /script/i,
  sqlInjection: /union.*select/i,
  codeInjection: /exec\(/i,
  xssDirect: /<script/i,
  javascriptUrl: /javascript:/i,
  vbscriptUrl: /vbscript:/i,
  onloadHandler: /onload=/i,
  onerrorHandler: /onerror=/i,
  suspiciousBot: /bot/i,
  googleBot: /googlebot/i
};

// Instancia global del monitor de seguridad (lazy loading)
let securityMonitor = null;

// Cache para verificaciones de sesión
const sessionCache = new Map();
const SESSION_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

/**
 * Limpia el cache de tokens expirados
 */
function cleanTokenCache() {
  const now = Date.now();
  for (const [token, data] of tokenCache.entries()) {
    if (now > data.expiresAt) {
      tokenCache.delete(token);
    }
  }
}

/**
 * Limpia el cache de sesiones expiradas
 */
function cleanSessionCache() {
  const now = Date.now();
  for (const [sessionId, data] of sessionCache.entries()) {
    if (now > data.expiresAt) {
      sessionCache.delete(sessionId);
    }
  }
}

/**
 * Función auxiliar para verificar si un usuario está autenticado
 * Retorna true/false sin redirigir
 */
export async function isAuthenticated(req) {
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                req.query.token || 
                req.cookies?.accessToken ||
                req.cookies?.token;
  
  const sessionId = req.cookies?.sessionId;

  if (!token && !sessionId) {
    return false;
  }

  try {
    // Si hay sessionId y acceso a base de datos, verificar en SQLite
    if (sessionId && req.database) {
      const session = await new Promise((resolve, reject) => {
        req.database.get(
          'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")',
          [sessionId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (session) {
        return true;
      }
    }

    // Verificar token JWT usando caché
    if (token) {
      const cachedSession = sessionCache.get(token);
      
      if (cachedSession && cachedSession.expiresAt > Date.now()) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('Error verificando autenticación:', error);
    return false;
  }
}

// Limpiar caches periódicamente
setInterval(() => {
  cleanTokenCache();
  cleanSessionCache();
}, 60000); // Cada minuto

/**
 * Inicializar monitor de seguridad (lazy loading)
 */
function getOrCreateSecurityMonitor(config = {}) {
  if (!securityMonitor) {
    securityMonitor = new SecurityMonitor(config);
    securityMonitor.startMonitoring();
    
    // Configurar listeners para alertas
    securityMonitor.on('securityAlert', (alert) => {
      logger.debug(`🚨 ALERTA DE SEGURIDAD: ${alert.message}`);
    });
    
    logger.debug('🔍 SecurityMonitor inicializado y activo');
  }
  return securityMonitor;
}

/**
 * Verifica un token JWT con caching
 */
function verifyTokenWithCache(token) {
  // Verificar cache primero
  const cached = tokenCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.decoded;
  }

  // Verificar token usando jwt directamente
  const decoded = jwt.verify(token, JWT_SECRET);
  
  // Cachear resultado
  tokenCache.set(token, {
    decoded,
    expiresAt: Date.now() + TOKEN_CACHE_TTL
  });

  return decoded;
}

/**
 * Verifica sesión con caching
 */
function verifySessionWithCache(sessionId) {
  // Verificar cache primero
  const cached = sessionCache.get(sessionId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.session;
  }

  // Verificar sesión
  const session = global.advancedSecurity.activeSessions?.get(sessionId);
  if (session && session.expiresAt >= Date.now()) {
    // Cachear resultado válido
    sessionCache.set(sessionId, {
      session,
      expiresAt: Date.now() + SESSION_CACHE_TTL
    });
    return session;
  }

  return null;
}

/**
 * Verifica una sesión desde la base de datos SQLite
 */
async function verifySessionFromDatabase(req, res, next, sessionId) {
  try {
    logger.debug('🔍 verifySessionFromDatabase: Iniciando verificación para sessionId:', sessionId);
    
    // Verificar cache primero
    const cached = sessionCache.get(sessionId);
    if (cached && Date.now() < cached.expiresAt) {
      logger.debug('🔍 verifySessionFromDatabase: Sesión encontrada en cache');
      req.user = cached.user;
      return next();
    }

    logger.debug('🔍 verifySessionFromDatabase: Consultando base de datos...');
    logger.debug('🔍 verifySessionFromDatabase: Tipo de req.database:', typeof req.database);
    logger.debug('🔍 verifySessionFromDatabase: req.database es:', req.database?.constructor?.name);
    
    // Consultar sesión en SQLite usando la API correcta del SQLiteManager
    const sessionQuery = `
      SELECT s.*, u.id as user_id, u.username, u.email, u.role 
      FROM sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.id = ? AND s.is_active = 1 AND s.expires_at > datetime('now')
    `;
    
    logger.debug('🔍 verifySessionFromDatabase: Ejecutando consulta con await...');
    
    // Usar await directamente con el método get() del SQLiteManager
    const session = await req.database.get(sessionQuery, [sessionId]);
    
    logger.debug('🔍 verifySessionFromDatabase: Resultado de consulta:', session ? 'Sesión encontrada' : 'Sesión no encontrada');

    if (!session) {
      logger.debug('🔍 verifySessionFromDatabase: Sesión no encontrada o expirada');
      // Sesión no encontrada o expirada
      const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                     req.headers['content-type']?.includes('application/json');
      
      if (isAjax) {
        return res.status(401).json({ 
          success: false, 
          error: 'Sesión expirada',
          code: 'SESSION_EXPIRED'
        });
      }
      return res.redirect('/login');
    }

    logger.debug('🔍 verifySessionFromDatabase: Creando objeto de usuario...');
    
    // Crear objeto de usuario
    const user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      role: session.role,
      sessionId: sessionId
    };

    logger.debug('🔍 verifySessionFromDatabase: Usuario creado:', user.username);

    // Cachear resultado válido
    sessionCache.set(sessionId, {
      user,
      expiresAt: Date.now() + SESSION_CACHE_TTL
    });

    req.user = user;
    
    logger.debug('🔍 verifySessionFromDatabase: Registrando evento de seguridad...');
    
    // Registrar acceso autorizado exitoso
    const monitor = getOrCreateSecurityMonitor();
    monitor.recordSecurityEvent('authorized_access', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      userId: user.id,
      username: user.username,
      authMethod: 'session_cookie',
      severity: 'low'
    });

    logger.debug('🔍 verifySessionFromDatabase: Llamando a next()...');
    next();

  } catch (error) {
    logger.error('🔍 verifySessionFromDatabase: Error verificando sesión desde base de datos:', error);
    
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                   req.headers['content-type']?.includes('application/json');
    
    if (isAjax) {
      return res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
    return res.redirect('/login');
  }
}

// Inicializar monitor de seguridad (función legacy para compatibilidad)
export function initializeSecurityMonitor(config = {}) {
  if (!securityMonitor) {
    securityMonitor = new SecurityMonitor(config);
    securityMonitor.startMonitoring();
    
    // Configurar listeners para alertas
    securityMonitor.on('securityAlert', (alert) => {
      logger.debug(`🚨 ALERTA DE SEGURIDAD: ${alert.message}`);
    });
    
    logger.debug('🔍 SecurityMonitor inicializado y activo');
  }
  return securityMonitor;
}

// Obtener instancia del monitor
export function getSecurityMonitor() {
  return securityMonitor;
}

/**
 * Middleware centralizado para verificar autenticación en rutas protegidas
 * Soporta tanto tokens JWT como cookies de sesión almacenadas en SQLite
 */
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                req.query.token || 
                req.cookies?.accessToken ||
                req.cookies?.token;
  
  const sessionId = req.cookies?.sessionId;

  // Debug logs
  logger.debug('🔍 Auth Debug:', {
    hasToken: !!token,
    hasSessionId: !!sessionId,
    hasDatabase: !!req.database,
    cookies: req.cookies,
    path: req.path
  });

  // Verificar si hay token JWT o sessionId de cookie
  if (!token && !sessionId) {
    // Registrar intento de acceso sin autenticación (lazy loading)
    const monitor = getOrCreateSecurityMonitor();
    monitor.recordSecurityEvent('unauthorized_access_attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      reason: 'missing_auth',
      severity: 'medium'
    });

    // Respuesta optimizada basada en tipo de request
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                   req.headers['content-type']?.includes('application/json') ||
                   req.path.startsWith('/api/');
    
    if (isAjax) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token de acceso requerido',
        code: 'ACCESS_TOKEN_REQUIRED'
      });
    }
    return res.redirect('/login');
  }

  // Si hay sessionId de cookie, verificar sesión en SQLite
  if (sessionId && req.database) {
    return verifySessionFromDatabase(req, res, next, sessionId);
  }

  try {
    // Usar verificación con cache
    const decoded = verifyTokenWithCache(token);
    req.user = decoded;
    
    // Verificar sesión activa con cache si existe sessionId
    if (decoded.sessionId) {
      const session = verifySessionWithCache(decoded.sessionId);
      if (!session) {
        const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                       req.headers['content-type']?.includes('application/json');
        
        if (isAjax) {
          return res.status(401).json({ 
            success: false, 
            error: 'Sesión expirada',
            code: 'SESSION_EXPIRED'
          });
        }
        return res.redirect('/login');
      }
      
      // Actualizar última actividad (solo si ha pasado más de 1 minuto)
      const now = Date.now();
      if (now - session.lastActivity > 60000) {
        session.lastActivity = now;
        // Invalidar cache para forzar actualización
        sessionCache.delete(decoded.sessionId);
      }
    }
    
    // Registrar acceso autorizado exitoso (lazy loading)
    const monitor = getOrCreateSecurityMonitor();
    monitor.recordSecurityEvent('authorized_access', {
      ip: req.ip,
      userId: decoded.id || decoded.userId,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      severity: 'low'
    });
    
    next();
  } catch (error) {
    // Invalidar cache del token
    tokenCache.delete(token);
    
    // Registrar intento de acceso con token inválido (lazy loading)
    const monitor = getOrCreateSecurityMonitor();
    monitor.recordSecurityEvent('invalid_token_attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      reason: error.message,
      severity: 'high'
    });

    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                   req.headers['content-type']?.includes('application/json');
    
    if (isAjax) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }
    return res.redirect('/login');
  }
}

/**
 * Middleware para verificar roles específicos
 */
export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
        code: 'NOT_AUTHENTICATED',
      });
    }

    const userRole = req.user.role || req.user.roles;
    const hasRole = Array.isArray(roles) 
      ? roles.some(role => userRole === role || (Array.isArray(userRole) && userRole.includes(role)))
      : userRole === roles || (Array.isArray(userRole) && userRole.includes(roles));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: userRole
      });
    }

    next();
  };
}

/**
 * Middleware para verificar si el usuario es admin
 */
export const requireAdmin = requireRole(['admin', 'super_admin']);

/**
 * Middleware para verificar acceso a billing
 */
export const requireBillingAccess = requireRole([
  'admin',
  'billing_manager',
  'super_admin',
]);

/**
 * Middleware para verificar acceso a commerce
 */
export const requireCommerceAccess = requireRole([
  'admin',
  'commerce_manager',
  'super_admin',
]);

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
export function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                req.query.token || 
                req.cookies?.accessToken;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // Usar verificación con cache
    const decoded = verifyTokenWithCache(token);
    req.user = decoded;
  } catch (error) {
    // Invalidar cache del token
    tokenCache.delete(token);
    req.user = null;
  }
  
  next();
}

/**
 * Middleware para tracking de seguridad optimizado
 */
export function trackSecurity(req, res, next) {
  // Detectar intentos de autenticación (optimizado)
  const isAuthPath = req.path.includes('/auth/') || req.path.includes('/login');
  
  if (isAuthPath) {
    const monitor = getOrCreateSecurityMonitor();
    monitor.recordSecurityEvent('auth_attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
      severity: 'low'
    });
    
    // Mantener compatibilidad con el sistema existente
    if (global.metricsManager) {
      global.metricsManager.recordSecurityEvent('auth_attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        timestamp: new Date()
      });
    }
  }
  
  // Detectar actividad sospechosa (optimizado)
  const suspiciousInfo = isSuspiciousRequestOptimized(req);
  if (suspiciousInfo.isSuspicious) {
    const monitor = getOrCreateSecurityMonitor();
    monitor.recordSecurityEvent('suspicious_activity', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
      reason: suspiciousInfo.reason,
      severity: 'medium'
    });
  }
  
  next();
}

/**
 * Detecta si una petición es sospechosa (optimizado con patrones compilados)
 */
function isSuspiciousRequestOptimized(req) {
  const url = req.url.toLowerCase();
  const userAgent = (req.get('User-Agent') || '').toLowerCase();
  
  // Verificar patrones sospechosos en URL usando patrones compilados
  for (const [patternName, pattern] of Object.entries(SECURITY_PATTERNS)) {
    if (pattern.test(url)) {
      return {
        isSuspicious: true,
        reason: getReasonFromPattern(patternName)
      };
    }
  }
  
  // Verificar User-Agent sospechoso (optimizado)
  if (SECURITY_PATTERNS.suspiciousBot.test(userAgent) && 
      !SECURITY_PATTERNS.googleBot.test(userAgent)) {
    return {
      isSuspicious: true,
      reason: 'suspicious_bot'
    };
  }
  
  // Verificar múltiples headers sospechosos
  if (req.headers['x-forwarded-for'] && req.headers['x-real-ip']) {
    return {
      isSuspicious: true,
      reason: 'header_manipulation'
    };
  }
  
  return {
    isSuspicious: false,
    reason: null
  };
}

/**
 * Mapea nombres de patrones a razones de seguridad
 */
function getReasonFromPattern(patternName) {
  const reasonMap = {
    pathTraversal: 'path_traversal_attempt',
    xssScript: 'xss_attempt',
    sqlInjection: 'sql_injection_attempt',
    codeInjection: 'code_injection_attempt',
    xssDirect: 'xss_attempt',
    javascriptUrl: 'xss_attempt',
    vbscriptUrl: 'xss_attempt',
    onloadHandler: 'xss_attempt',
    onerrorHandler: 'xss_attempt'
  };
  
  return reasonMap[patternName] || 'unknown_suspicious_pattern';
}

export default {
  requireAuth,
  requireRole,
  requireAdmin,
  requireBillingAccess,
  requireCommerceAccess,
  optionalAuth,
  trackSecurity
};
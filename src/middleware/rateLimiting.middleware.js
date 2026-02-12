/**
 * @fileoverview Middleware de Rate Limiting avanzado
 * Implementa múltiples estrategias de limitación de velocidad para prevenir ataques
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getSecurityMonitor } from './auth.middleware.js';

// Verificar si el rate limiting está habilitado
const isRateLimitingEnabled = false; // Temporalmente deshabilitado para evitar errores IPv6

// Middleware bypass para cuando el rate limiting está deshabilitado
const bypassMiddleware = (req, res, next) => {
  next();
};

// Configuraciones de rate limiting por tipo de endpoint
// NOTA: Configuraciones relajadas para desarrollo local
const rateLimitConfigs = {
  // Rate limiting general para toda la aplicación (MUY PERMISIVO para desarrollo)
  general: {
    windowMs: 1 * 60 * 1000, // 1 minuto (reducido de 15 minutos)
    max: 10000, // máximo 10,000 requests por ventana por IP (aumentado de 1000)
    message: {
      error: 'Demasiadas solicitudes desde esta IP',
      retryAfter: '1 minuto'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Rate limiting para endpoints de autenticación (RELAJADO para testing)
  auth: {
    windowMs: 5 * 60 * 1000, // 5 minutos (reducido de 15 minutos)
    max: 100, // máximo 100 intentos de login por ventana por IP (aumentado de 10)
    message: {
      error: 'Demasiados intentos de autenticación desde esta IP',
      retryAfter: '5 minutos',
      security: 'Este límite protege contra ataques de fuerza bruta'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // No contar logins exitosos
    skipFailedRequests: false
  },

  // Rate limiting para APIs sensibles (MUY PERMISIVO)
  api: {
    windowMs: 1 * 60 * 1000, // 1 minuto (reducido de 5 minutos)
    max: 5000, // máximo 5000 requests por ventana por IP (aumentado de 100)
    message: {
      error: 'Límite de API excedido',
      retryAfter: '1 minuto'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Rate limiting para endpoints de registro (RELAJADO)
  registration: {
    windowMs: 10 * 60 * 1000, // 10 minutos (reducido de 1 hora)
    max: 50, // máximo 50 registros por ventana por IP (aumentado de 3)
    message: {
      error: 'Límite de registros excedido',
      retryAfter: '10 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Rate limiting para recuperación de contraseña (RELAJADO)
  passwordReset: {
    windowMs: 10 * 60 * 1000, // 10 minutos (reducido de 1 hora)
    max: 50, // máximo 50 intentos por ventana por IP (aumentado de 5)
    message: {
      error: 'Demasiados intentos de recuperación de contraseña',
      retryAfter: '10 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false
  }
};

// Función para crear rate limiter con logging de seguridad
function createRateLimiter(config, type = 'general') {
  return rateLimit({
    ...config,
    keyGenerator: ipKeyGenerator,
    handler: (req, res) => {
      const securityMonitor = getSecurityMonitor();
      
      // Registrar evento de rate limiting
      if (securityMonitor) {
        securityMonitor.recordSecurityEvent('rate_limit_exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method,
          type: type,
          severity: type === 'auth' ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          headers: {
            'x-forwarded-for': req.get('X-Forwarded-For'),
            'x-real-ip': req.get('X-Real-IP')
          }
        });
      }

      // Log de seguridad
      logger.warn(`🚨 Rate limit exceeded: ${req.ip} - ${req.path} (${type})`);

      // Respuesta personalizada
      res.status(429).json({
        success: false,
        error: config.message.error,
        retryAfter: config.message.retryAfter,
        timestamp: new Date().toISOString(),
        type: 'RATE_LIMIT_EXCEEDED'
      });
    },
    
    // Función para obtener la clave de identificación (IP + User-Agent para mayor precisión)
    keyGenerator: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || 'unknown';
      return `${ip}:${userAgent.substring(0, 50)}`; // Limitar longitud del User-Agent
    },

    // Función para omitir rate limiting en ciertos casos
    skip: (req) => {
      // IPs de confianza base (localhost, redes privadas, IP específica exenta)
      const baseTrustedIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '192.168.1.2'];
      
      // IPs adicionales de confianza desde variables de entorno
      const additionalTrustedIPs = process.env.TRUSTED_IPS ? 
        process.env.TRUSTED_IPS.split(',').map(ip => ip.trim()) : [];
      
      const trustedIPs = [...baseTrustedIPs, ...additionalTrustedIPs];
      const ip = req.ip || req.connection.remoteAddress;
      
      // También omitir para requests internos del sistema
      const isInternalRequest = req.get('X-Internal-Request') === 'true';
      
      // Omitir para ngrok en desarrollo
      const isNgrokRequest = process.env.NODE_ENV === 'development' && 
        req.get('X-Forwarded-For') && req.get('ngrok-trace-id');
      
      return trustedIPs.includes(ip) || isInternalRequest || isNgrokRequest;
    }
  });
}

// Crear instancias de rate limiters para diferentes tipos de endpoints
export const generalRateLimit = isRateLimitingEnabled ? createRateLimiter(rateLimitConfigs.general, 'general') : bypassMiddleware;
export const authRateLimit = isRateLimitingEnabled ? createRateLimiter(rateLimitConfigs.auth, 'auth') : bypassMiddleware;
export const apiRateLimit = isRateLimitingEnabled ? createRateLimiter(rateLimitConfigs.api, 'api') : bypassMiddleware;
export const registrationRateLimit = isRateLimitingEnabled ? createRateLimiter(rateLimitConfigs.registration, 'registration') : bypassMiddleware;
export const passwordResetRateLimit = isRateLimitingEnabled ? createRateLimiter(rateLimitConfigs.passwordReset, 'passwordReset') : bypassMiddleware;

// Rate limiter dinámico basado en el comportamiento del usuario
export function createDynamicRateLimit(baseConfig, escalationFactor = 2) {
  const suspiciousIPs = new Map(); // Cache de IPs sospechosas
  
  return rateLimit({
    ...baseConfig,
    max: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const suspiciousLevel = suspiciousIPs.get(ip) || 0;
      
      // Reducir límite para IPs sospechosas
      const adjustedMax = Math.max(1, baseConfig.max - (suspiciousLevel * escalationFactor));
      
      return adjustedMax;
    },
    
    handler: (req, res) => {
      const ip = req.ip || req.connection.remoteAddress;
      const currentLevel = suspiciousIPs.get(ip) || 0;
      
      // Incrementar nivel de sospecha
      suspiciousIPs.set(ip, currentLevel + 1);
      
      // Limpiar cache después de 1 hora
      setTimeout(() => {
        suspiciousIPs.delete(ip);
      }, 60 * 60 * 1000);
      
      const securityMonitor = getSecurityMonitor();
      if (securityMonitor) {
        securityMonitor.recordSecurityEvent('dynamic_rate_limit_exceeded', {
          ip: ip,
          suspiciousLevel: currentLevel + 1,
          adjustedLimit: Math.max(1, baseConfig.max - (currentLevel * escalationFactor)),
          endpoint: req.path,
          severity: 'high',
          timestamp: new Date().toISOString()
        });
      }

      res.status(429).json({
        success: false,
        error: 'Límite de velocidad dinámico excedido',
        retryAfter: baseConfig.message?.retryAfter || '15 minutos',
        suspiciousActivity: true,
        timestamp: new Date().toISOString()
      });
    }
  });
}

// Middleware para detectar y bloquear patrones de ataque
export function attackPatternDetection(req, res, next) {
  // Si el rate limiting está deshabilitado, también deshabilitar la detección de ataques en desarrollo
  if (!isRateLimitingEnabled && process.env.NODE_ENV === 'development') {
    return next();
  }
  
  const securityMonitor = getSecurityMonitor();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;
  const query = req.query;
  
  // Patrones de ataque conocidos
  const attackPatterns = {
    sqlInjection: /(\bunion\b|\bselect\b|\bdrop\b|\binsert\b|\bupdate\b|\bdelete\b|--|\/\*|\*\/)/i,
    xss: /<script|javascript:|onerror=|onload=|<svg|<iframe/i,
    pathTraversal: /(\.\.|%2e%2e|\.\.\/|\.\.\\)/i,
    commandInjection: /(\||&|;|\$\(|\`)/,
    botPattern: /(bot|crawler|spider|scraper|scanner)/i
  };
  
  // Verificar patrones en la URL y query parameters
  const fullUrl = `${path}?${new URLSearchParams(query).toString()}`;
  
  for (const [attackType, pattern] of Object.entries(attackPatterns)) {
    if (pattern.test(fullUrl) || pattern.test(userAgent)) {
      if (securityMonitor) {
        securityMonitor.recordSecurityEvent('attack_pattern_detected', {
          ip: ip,
          userAgent: userAgent,
          attackType: attackType,
          endpoint: path,
          fullUrl: fullUrl,
          severity: 'critical',
          timestamp: new Date().toISOString(),
          blocked: true
        });
      }
      
      logger.error(`🚨 ATTACK DETECTED: ${attackType} from ${ip} - ${fullUrl}`);
      
      return res.status(403).json({
        success: false,
        error: 'Solicitud bloqueada por razones de seguridad',
        type: 'SECURITY_VIOLATION',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
}

// Middleware para monitorear velocidad de requests por IP
export function requestVelocityMonitor(req, res, next) {
  // Si el rate limiting está deshabilitado, también deshabilitar el monitoreo de velocidad en desarrollo
  if (!isRateLimitingEnabled && process.env.NODE_ENV === 'development') {
    return next();
  }
  
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  // Cache de timestamps por IP
  if (!global.requestTimestamps) {
    global.requestTimestamps = new Map();
  }
  
  const ipTimestamps = global.requestTimestamps.get(ip) || [];
  
  // Limpiar timestamps antiguos (más de 1 minuto)
  const recentTimestamps = ipTimestamps.filter(timestamp => now - timestamp < 60000);
  
  // Agregar timestamp actual
  recentTimestamps.push(now);
  global.requestTimestamps.set(ip, recentTimestamps);
  
  // Detectar velocidad anormal (más de 30 requests por minuto)
  if (recentTimestamps.length > 30) {
    const securityMonitor = getSecurityMonitor();
    if (securityMonitor) {
      securityMonitor.recordSecurityEvent('high_request_velocity', {
        ip: ip,
        requestCount: recentTimestamps.length,
        timeWindow: '1 minute',
        endpoint: req.path,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.warn(`⚡ High request velocity detected: ${ip} - ${recentTimestamps.length} requests/min`);
  }
  
  next();
}

// Limpiar cache de timestamps cada 5 minutos
setInterval(() => {
  if (global.requestTimestamps) {
    const now = Date.now();
    for (const [ip, timestamps] of global.requestTimestamps.entries()) {
      const recentTimestamps = timestamps.filter(timestamp => now - timestamp < 300000); // 5 minutos
      if (recentTimestamps.length === 0) {
        global.requestTimestamps.delete(ip);
      } else {
        global.requestTimestamps.set(ip, recentTimestamps);
      }
    }
  }
}, 5 * 60 * 1000);

export default {
  generalRateLimit,
  authRateLimit,
  apiRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  createDynamicRateLimit,
  attackPatternDetection,
  requestVelocityMonitor
};
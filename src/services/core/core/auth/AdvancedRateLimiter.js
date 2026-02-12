import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { logError } from '../../../utils/error_manager.js';

/**
 * Advanced Rate Limiting System - COMPLETAMENTE DESACTIVADO
 * Provides intelligent rate limiting with endpoint differentiation,
 * brute force protection, and adaptive security measures
 */
class AdvancedRateLimiter {
  constructor(options = {}) {
    this.config = {
      // Global rate limiting - DESACTIVADO
      global: {
        windowMs: options.globalWindow || 15 * 60 * 1000, // 15 minutes
        max: options.globalMax || 999999, // límite muy alto para desactivar
        message: 'Too many requests from this IP, please try again later'
      },
            
      // Authentication endpoints (more restrictive) - DESACTIVADO
      auth: {
        windowMs: options.authWindow || 15 * 60 * 1000, // 15 minutes
        max: options.authMax || 999999, // límite muy alto para desactivar
        message: 'Too many authentication attempts, please try again later',
        skipSuccessfulRequests: true,
        skipFailedRequests: false
      },
            
      // API endpoints (moderate) - DESACTIVADO
      api: {
        windowMs: options.apiWindow || 15 * 60 * 1000, // 15 minutes
        max: options.apiMax || 999999, // límite muy alto para desactivar
        message: 'API rate limit exceeded, please try again later'
      },
            
      // Static content (lenient) - DESACTIVADO
      static: {
        windowMs: options.staticWindow || 15 * 60 * 1000, // 15 minutes
        max: options.staticMax || 999999, // límite muy alto para desactivar
        message: 'Too many requests for static content'
      },
            
      // Brute force protection - DESACTIVADO
      bruteForce: {
        freeRetries: options.bruteForceRetries || 999999,
        minWait: options.bruteForceMinWait || 0, // sin espera
        maxWait: options.bruteForceMaxWait || 0, // sin espera
        lifetime: options.bruteForceLifetime || 24 * 60 * 60 * 1000, // 24 hours
        failuresBeforeBan: options.failuresBeforeBan || 999999
      },
            
      // Progressive slow down - DESACTIVADO
      slowDown: {
        windowMs: options.slowDownWindow || 15 * 60 * 1000, // 15 minutes
        delayAfter: options.slowDownDelayAfter || 999999, // nunca ralentizar
        delayMs: options.slowDownDelayMs || 0, // sin delay
        maxDelayMs: options.slowDownMaxDelay || 0 // sin delay máximo
      }
    };
        
    // In-memory stores for tracking
    this.bruteForceAttempts = new Map();
    this.suspiciousIPs = new Map();
    this.bannedIPs = new Set();
    this.geoBlacklist = new Set();
        
    // Statistics
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      slowedRequests: 0,
      bruteForceBlocks: 0,
      suspiciousActivity: 0,
      lastReset: Date.now()
    };
        
    this.initialize();
  }
    
  initialize() {
    // Cleanup interval for expired entries
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 60 * 1000); // Every hour
        
    logger.info('✅ AdvancedRateLimiter initialized');
  }
    
  /**
     * Get global rate limiter (lenient) - DESACTIVADO
     */
  getGlobalLimiter() {
    return rateLimit({
      windowMs: this.config.global.windowMs,
      max: this.config.global.max,
      message: { error: this.config.global.message },
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => true, // Saltar todos los requests
      handler: (req, res) => {
        this.recordBlock(req.ip, 'global_limit');
        res.status(429).json({ error: this.config.global.message });
      }
    });
  }
    
  /**
     * Get authentication rate limiter (strict) - DESACTIVADO
     */
  getAuthLimiter() {
    return rateLimit({
      windowMs: this.config.auth.windowMs,
      max: this.config.auth.max,
      message: { error: this.config.auth.message },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: this.config.auth.skipSuccessfulRequests,
      skipFailedRequests: this.config.auth.skipFailedRequests,
      skip: () => true, // Saltar todos los requests
      handler: (req, res) => {
        this.recordBlock(req.ip, 'auth_limit');
        this.recordSuspiciousActivity(req.ip, 'excessive_auth_attempts');
        res.status(429).json({ 
          error: this.config.auth.message,
          retryAfter: Math.ceil(this.config.auth.windowMs / 1000)
        });
      }
    });
  }
    
  /**
     * Get API rate limiter - DESACTIVADO
     */
  getAPILimiter() {
    return rateLimit({
      windowMs: this.config.api.windowMs,
      max: this.config.api.max,
      message: { error: this.config.api.message },
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => true, // Saltar todos los requests
      handler: (req, res) => {
        this.recordBlock(req.ip, 'api_limit');
        res.status(429).json({ error: this.config.api.message });
      }
    });
  }
    
  /**
     * Get static content rate limiter - DESACTIVADO
     */
  getStaticLimiter() {
    return rateLimit({
      windowMs: this.config.static.windowMs,
      max: this.config.static.max,
      message: { error: this.config.static.message },
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => true, // Saltar todos los requests
      handler: (req, res) => {
        this.recordBlock(req.ip, 'static_limit');
        res.status(429).json({ error: this.config.static.message });
      }
    });
  }
    
  /**
     * Get slow down middleware - DESACTIVADO
     */
  getSlowDownMiddleware() {
    return slowDown({
      windowMs: this.config.slowDown.windowMs,
      delayAfter: this.config.slowDown.delayAfter,
      delayMs: this.config.slowDown.delayMs,
      maxDelayMs: this.config.slowDown.maxDelayMs,
      skip: () => true, // Saltar todos los requests
      onLimitReached: (req) => {
        this.recordSlowDown(req.ip);
      }
    });
  }
    
  /**
   * Brute force protection middleware - DESACTIVADO
   */
  getBruteForceProtection() {
    return (req, res, next) => {
      // Simplemente pasar al siguiente middleware sin verificaciones
      next();
    };
  }
    
  /**
   * Record a failed authentication attempt - DESACTIVADO
   */
  recordFailedAttempt(ip, details = {}) {
    // No hacer nada, no registrar intentos fallidos
    return;
  }
    
  /**
   * Record successful authentication (reset attempts) - DESACTIVADO
   */
  recordSuccessfulAttempt(ip) {
    // No hacer nada, no registrar intentos exitosos
    return;
  }
    
  /**
   * Check if IP is currently blocked by brute force protection - DESACTIVADO
   */
  isBruteForceBlocked(attempts) {
    return false; // Nunca bloquear
  }
    
  /**
   * Calculate wait time based on attempts - DESACTIVADO
   */
  calculateWaitTime(attempts) {
    return 0; // Sin tiempo de espera
  }
    
  /**
   * Ban an IP address - DESACTIVADO
   */
  banIP(ip, reason) {
    // No banear IPs
    return;
  }
    
  /**
   * Unban an IP address - DESACTIVADO
   */
  unbanIP(ip) {
    // No hacer nada
    return;
  }
    
  /**
   * Record suspicious activity - DESACTIVADO
   */
  recordSuspiciousActivity(ip, type, details = {}) {
    // No hacer nada
    return;
  }
    
  /**
     * Calculate suspicion score based on activities
     */
  calculateSuspicionScore(activities) {
    let score = 0;
    const now = Date.now();
        
    activities.forEach(activity => {
      const age = now - activity.timestamp;
      const ageMultiplier = Math.max(0.1, 1 - (age / (24 * 60 * 60 * 1000))); // Decay over 24 hours
            
      switch (activity.type) {
      case 'brute_force_attempt':
        score += 15 * ageMultiplier;
        break;
      case 'excessive_auth_attempts':
        score += 10 * ageMultiplier;
        break;
      case 'suspicious_user_agent':
        score += 5 * ageMultiplier;
        break;
      case 'rapid_requests':
        score += 8 * ageMultiplier;
        break;
      case 'invalid_endpoints':
        score += 12 * ageMultiplier;
        break;
      default:
        score += 3 * ageMultiplier;
      }
    });
        
    return Math.round(score);
  }
    
  /**
   * Should skip rate limiting for this request - SIEMPRE SALTAR
   */
  shouldSkipRequest(req) {
    return true; // Saltar todos los requests
  }
    
  /**
     * Record a blocked request
     */
  recordBlock(ip, reason) {
    this.stats.blockedRequests++;
        
    logError('info', 'AdvancedRateLimiter', 'Request blocked', {
      ip,
      reason,
      timestamp: new Date().toISOString()
    });
  }
    
  /**
     * Record a slowed down request
     */
  recordSlowDown(ip) {
    this.stats.slowedRequests++;
        
    logError('info', 'AdvancedRateLimiter', 'Request slowed down', {
      ip,
      timestamp: new Date().toISOString()
    });
  }
    
  /**
     * Clean up expired entries
     */
  cleanupExpiredEntries() {
    const now = Date.now();
    const lifetime = this.config.bruteForce.lifetime;
        
    // Clean brute force attempts
    for (const [ip, attempts] of this.bruteForceAttempts.entries()) {
      if (now - attempts.lastAttempt > lifetime) {
        this.bruteForceAttempts.delete(ip);
      }
    }
        
    // Clean suspicious IPs
    for (const [ip, suspicious] of this.suspiciousIPs.entries()) {
      if (now - suspicious.firstSeen > lifetime) {
        this.suspiciousIPs.delete(ip);
      }
    }
        
    logError('info', 'AdvancedRateLimiter', 'Cleanup completed', {
      bruteForceEntries: this.bruteForceAttempts.size,
      suspiciousIPs: this.suspiciousIPs.size,
      bannedIPs: this.bannedIPs.size
    });
  }
    
  /**
     * Get current statistics
     */
  getStats() {
    return {
      ...this.stats,
      currentEntries: {
        bruteForceAttempts: this.bruteForceAttempts.size,
        suspiciousIPs: this.suspiciousIPs.size,
        bannedIPs: this.bannedIPs.size
      }
    };
  }
    
  /**
     * Reset statistics
     */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      slowedRequests: 0,
      bruteForceBlocks: 0,
      suspiciousActivity: 0,
      lastReset: Date.now()
    };
  }
    
  /**
     * Get security report
     */
  getSecurityReport() {
    const now = Date.now();
    const uptime = now - this.stats.lastReset;
        
    return {
      uptime: uptime,
      stats: this.getStats(),
      topSuspiciousIPs: Array.from(this.suspiciousIPs.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 10)
        .map(([ip, data]) => ({ ip, score: data.score, activities: data.activities.length })),
      bannedIPs: Array.from(this.bannedIPs),
      config: {
        globalMax: this.config.global.max,
        authMax: this.config.auth.max,
        apiMax: this.config.api.max,
        bruteForceRetries: this.config.bruteForce.freeRetries
      }
    };
  }
}

export default AdvancedRateLimiter;
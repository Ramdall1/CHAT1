/**
 * @fileoverview Middleware de autenticación y validación para webhooks de WhatsApp
 * Maneja la verificación de tokens, validación de firmas y rate limiting
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 * @since 2025-01-21
 */

import crypto from 'crypto';
import { createLogger } from '../../services/core/core/logger.js';

const logger = createLogger('WHATSAPP_WEBHOOK_MIDDLEWARE');

/**
 * Configuración del middleware
 */
const CONFIG = {
  // Token de verificación para el webhook
  VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token_here',
  
  // Secret para validar la firma del webhook
  WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET || 'your_webhook_secret_here',
  
  // Rate limiting
  RATE_LIMIT: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 100, // máximo 100 requests por minuto
    skipSuccessfulRequests: false
  },
  
  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 segundos
  
  // Headers requeridos
  REQUIRED_HEADERS: [
    'x-hub-signature-256'
  ]
};

/**
 * Store para rate limiting en memoria
 */
class RateLimitStore {
  constructor() {
    this.requests = new Map();
    this.cleanup();
  }

  /**
   * Registra una request
   * @param {string} key - Clave única (IP, etc.)
   * @returns {Object} Estado del rate limit
   */
  hit(key) {
    const now = Date.now();
    const windowStart = now - CONFIG.RATE_LIMIT.windowMs;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const requests = this.requests.get(key);
    
    // Limpiar requests antiguas
    const validRequests = requests.filter(time => time > windowStart);
    
    // Añadir nueva request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return {
      count: validRequests.length,
      remaining: Math.max(0, CONFIG.RATE_LIMIT.maxRequests - validRequests.length),
      resetTime: windowStart + CONFIG.RATE_LIMIT.windowMs
    };
  }

  /**
   * Limpia requests antiguas periódicamente
   */
  cleanup() {
    setInterval(() => {
      const now = Date.now();
      const windowStart = now - CONFIG.RATE_LIMIT.windowMs;
      
      for (const [key, requests] of this.requests.entries()) {
        const validRequests = requests.filter(time => time > windowStart);
        if (validRequests.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, validRequests);
        }
      }
    }, CONFIG.RATE_LIMIT.windowMs);
  }
}

const rateLimitStore = new RateLimitStore();

/**
 * Middleware de verificación del webhook de WhatsApp
 */
class WhatsAppWebhookMiddleware {
  constructor(options = {}) {
    this.config = { ...CONFIG, ...options };
    this.logger = logger;
  }

  /**
   * Middleware principal que combina todas las validaciones
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  validateWebhook() {
    return async (req, res, next) => {
      try {
        // 1. Rate limiting
        const rateLimitResult = this.checkRateLimit(req);
        if (!rateLimitResult.allowed) {
          return this.sendRateLimitError(res, rateLimitResult);
        }

        // 2. Verificar método HTTP
        if (!this.isValidHttpMethod(req)) {
          return this.sendMethodNotAllowed(res);
        }

        // 3. Manejar verificación del webhook (GET)
        if (req.method === 'GET') {
          return this.handleWebhookVerification(req, res);
        }

        // 4. Validar headers requeridos (POST)
        const headerValidation = this.validateHeaders(req);
        if (!headerValidation.valid) {
          return this.sendBadRequest(res, headerValidation.error);
        }

        // 5. Validar firma del webhook
        const signatureValidation = await this.validateSignature(req);
        if (!signatureValidation.valid) {
          return this.sendUnauthorized(res, signatureValidation.error);
        }

        // 6. Validar estructura del payload
        const payloadValidation = this.validatePayload(req.body);
        if (!payloadValidation.valid) {
          return this.sendBadRequest(res, payloadValidation.error);
        }

        // 7. Añadir metadatos a la request
        req.whatsapp = {
          validated: true,
          timestamp: new Date(),
          source: 'whatsapp_business_api',
          rateLimitInfo: rateLimitResult
        };

        this.logger.info('Webhook validado exitosamente', {
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        next();

      } catch (error) {
        this.logger.error('Error en validación de webhook:', error);
        return this.sendInternalError(res, error);
      }
    };
  }

  /**
   * Verifica rate limiting
   * @param {Object} req - Request object
   * @returns {Object} Resultado del rate limit
   */
  checkRateLimit(req) {
    const key = this.getRateLimitKey(req);
    const result = rateLimitStore.hit(key);
    
    return {
      allowed: result.count <= this.config.RATE_LIMIT.maxRequests,
      count: result.count,
      remaining: result.remaining,
      resetTime: result.resetTime,
      key
    };
  }

  /**
   * Obtiene clave para rate limiting
   * @param {Object} req - Request object
   * @returns {string} Clave única
   */
  getRateLimitKey(req) {
    // Usar IP como clave principal
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `whatsapp_webhook:${ip}`;
  }

  /**
   * Valida método HTTP
   * @param {Object} req - Request object
   * @returns {boolean} True si es válido
   */
  isValidHttpMethod(req) {
    return ['GET', 'POST'].includes(req.method);
  }

  /**
   * Maneja la verificación del webhook (GET request)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  handleWebhookVerification(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    this.logger.info('Verificación de webhook recibida', {
      mode,
      token: token ? '***' : 'missing',
      challenge: challenge ? 'present' : 'missing'
    });

    // Verificar parámetros requeridos
    if (!mode || !token || !challenge) {
      this.logger.warn('Parámetros de verificación faltantes');
      return res.status(400).json({
        error: 'Missing required verification parameters'
      });
    }

    // Verificar modo
    if (mode !== 'subscribe') {
      this.logger.warn('Modo de verificación inválido:', mode);
      return res.status(400).json({
        error: 'Invalid verification mode'
      });
    }

    // Verificar token
    if (token !== this.config.VERIFY_TOKEN) {
      this.logger.warn('Token de verificación inválido');
      return res.status(403).json({
        error: 'Invalid verify token'
      });
    }

    this.logger.info('Verificación de webhook exitosa');
    return res.status(200).send(challenge);
  }

  /**
   * Valida headers requeridos
   * @param {Object} req - Request object
   * @returns {Object} Resultado de validación
   */
  validateHeaders(req) {
    const missingHeaders = [];

    for (const header of this.config.REQUIRED_HEADERS) {
      if (!req.get(header)) {
        missingHeaders.push(header);
      }
    }

    if (missingHeaders.length > 0) {
      return {
        valid: false,
        error: `Missing required headers: ${missingHeaders.join(', ')}`
      };
    }

    // Validar Content-Type
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return {
        valid: false,
        error: 'Invalid Content-Type. Expected application/json'
      };
    }

    return { valid: true };
  }

  /**
   * Valida la firma del webhook
   * @param {Object} req - Request object
   * @returns {Object} Resultado de validación
   */
  async validateSignature(req) {
    try {
      const signature = req.get('x-hub-signature-256');
      
      if (!signature) {
        return {
          valid: false,
          error: 'Missing webhook signature'
        };
      }

      // Obtener el payload raw
      const payload = JSON.stringify(req.body);
      
      // Calcular firma esperada
      const expectedSignature = crypto
        .createHmac('sha256', this.config.WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex');

      const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;

      // Comparar firmas de forma segura
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignatureWithPrefix)
      );

      if (!isValid) {
        this.logger.warn('Firma de webhook inválida', {
          received: signature.substring(0, 20) + '...',
          expected: expectedSignatureWithPrefix.substring(0, 20) + '...'
        });
        
        return {
          valid: false,
          error: 'Invalid webhook signature'
        };
      }

      return { valid: true };

    } catch (error) {
      this.logger.error('Error validando firma:', error);
      return {
        valid: false,
        error: 'Signature validation failed'
      };
    }
  }

  /**
   * Valida la estructura del payload
   * @param {Object} payload - Payload del webhook
   * @returns {Object} Resultado de validación
   */
  validatePayload(payload) {
    if (!payload) {
      return {
        valid: false,
        error: 'Empty payload'
      };
    }

    // Validar estructura básica de WhatsApp
    if (payload.object !== 'whatsapp_business_account') {
      return {
        valid: false,
        error: 'Invalid webhook object type'
      };
    }

    if (!Array.isArray(payload.entry)) {
      return {
        valid: false,
        error: 'Missing or invalid entry array'
      };
    }

    // Validar cada entrada
    for (const entry of payload.entry) {
      if (!entry.id) {
        return {
          valid: false,
          error: 'Missing entry ID'
        };
      }

      if (!Array.isArray(entry.changes)) {
        return {
          valid: false,
          error: 'Missing or invalid changes array'
        };
      }

      // Validar cambios
      for (const change of entry.changes) {
        if (!change.field || !change.value) {
          return {
            valid: false,
            error: 'Invalid change structure'
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Envía error de rate limit
   */
  sendRateLimitError(res, rateLimitInfo) {
    this.logger.warn('Rate limit excedido', rateLimitInfo);
    
    return res.status(429).json({
      error: 'Rate limit exceeded',
      details: {
        limit: this.config.RATE_LIMIT.maxRequests,
        windowMs: this.config.RATE_LIMIT.windowMs,
        remaining: rateLimitInfo.remaining,
        resetTime: rateLimitInfo.resetTime
      }
    });
  }

  /**
   * Envía error de método no permitido
   */
  sendMethodNotAllowed(res) {
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['GET', 'POST']
    });
  }

  /**
   * Envía error de bad request
   */
  sendBadRequest(res, message) {
    return res.status(400).json({
      error: 'Bad request',
      message
    });
  }

  /**
   * Envía error de no autorizado
   */
  sendUnauthorized(res, message) {
    return res.status(401).json({
      error: 'Unauthorized',
      message
    });
  }

  /**
   * Envía error interno del servidor
   */
  sendInternalError(res, error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Webhook validation failed'
    });
  }

  /**
   * Middleware para logging de requests
   */
  logRequest() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        
        this.logger.info('Webhook request processed', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      });
      
      next();
    };
  }

  /**
   * Middleware para timeout de requests
   */
  requestTimeout() {
    return (req, res, next) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          this.logger.warn('Request timeout', {
            method: req.method,
            url: req.url,
            timeout: this.config.REQUEST_TIMEOUT
          });
          
          res.status(408).json({
            error: 'Request timeout'
          });
        }
      }, this.config.REQUEST_TIMEOUT);

      res.on('finish', () => {
        clearTimeout(timeout);
      });

      next();
    };
  }

  /**
   * Obtiene estadísticas del middleware
   * @returns {Object} Estadísticas
   */
  getStats() {
    return {
      rateLimitStore: {
        activeKeys: rateLimitStore.requests.size,
        config: this.config.RATE_LIMIT
      },
      config: {
        verifyTokenConfigured: !!this.config.VERIFY_TOKEN,
        webhookSecretConfigured: !!this.config.WEBHOOK_SECRET,
        requestTimeout: this.config.REQUEST_TIMEOUT
      }
    };
  }
}

export default WhatsAppWebhookMiddleware;
export { CONFIG as MIDDLEWARE_CONFIG };
/**
 * Input Sanitization Service
 * Servicio de sanitización completa de inputs
 * Recomendación #20: Implementar sanitización completa de inputs
 */

import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import xss from 'xss';
import { log as logger } from './logger.js';

class InputSanitizationService {
  constructor() {
    this.maxStringLength = 10000;
    this.maxArrayLength = 1000;
    this.maxObjectDepth = 10;
        
    // Configuración personalizada de XSS
    this.xssOptions = {
      whiteList: {
        // Permitir solo tags seguros para contenido de chat
        p: ['class'],
        br: [],
        strong: [],
        em: [],
        u: [],
        span: ['class'],
        div: ['class'],
        a: ['href', 'title', 'target'],
        img: ['src', 'alt', 'width', 'height'],
        ul: [],
        ol: [],
        li: [],
        blockquote: [],
        code: [],
        pre: []
      },
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
      allowCommentTag: false,
      onIgnoreTag: (tag, html, options) => {
        logger.warn(`Blocked potentially dangerous tag: ${tag}`);
        return '';
      },
      onIgnoreTagAttr: (tag, name, value, isWhiteAttr) => {
        if (!isWhiteAttr) {
          logger.warn(`Blocked potentially dangerous attribute: ${name}="${value}" in tag ${tag}`);
        }
        return '';
      }
    };

    // Patrones de detección de ataques
    this.attackPatterns = {
      sqlInjection: [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
        /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
        /(--|\/\*|\*\/|;)/g,
        /(\b(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)\b)/gi
      ],
      xss: [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
        /<object[^>]*>.*?<\/object>/gi,
        /<embed[^>]*>/gi,
        /<link[^>]*>/gi,
        /<meta[^>]*>/gi
      ],
      pathTraversal: [
        /\.\.\//g,
        /\.\.\\/g,
        /%2e%2e%2f/gi,
        /%2e%2e%5c/gi,
        /\.\.\%2f/gi,
        /\.\.\%5c/gi
      ],
      commandInjection: [
        /[;&|`$(){}[\]]/g,
        /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|wget|curl|nc|telnet|ssh|ftp)\b/gi
      ],
      ldapInjection: [
        /[()&|!]/g,
        /\*.*\*/g
      ]
    };

    // Configuración de DOMPurify
    this.domPurifyConfig = {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'span', 'div', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'title', 'target', 'class', 'src', 'alt', 'width', 'height'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'],
      KEEP_CONTENT: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
      SANITIZE_DOM: true,
      WHOLE_DOCUMENT: false,
      IN_PLACE: false
    };
  }

  /**
     * Sanitizar string básico
     */
  sanitizeString(input, options = {}) {
    if (typeof input !== 'string') {
      return '';
    }

    // Verificar longitud máxima
    if (input.length > (options.maxLength || this.maxStringLength)) {
      logger.warn(`String too long: ${input.length} characters`);
      input = input.substring(0, options.maxLength || this.maxStringLength);
    }

    // Normalizar caracteres Unicode
    input = input.normalize('NFC');

    // Remover caracteres de control (excepto \n, \r, \t)
    input = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Escapar caracteres HTML básicos si no se permite HTML
    if (!options.allowHtml) {
      input = validator.escape(input);
    }

    return input.trim();
  }

  /**
     * Sanitizar HTML con DOMPurify y XSS
     */
  sanitizeHtml(input, options = {}) {
    if (typeof input !== 'string') {
      return '';
    }

    // Sanitización básica primero
    input = this.sanitizeString(input, { ...options, allowHtml: true });

    // Detectar ataques XSS
    if (this.detectXSS(input)) {
      logger.warn('XSS attack detected and blocked', { input: input.substring(0, 100) });
      return '';
    }

    // Usar DOMPurify para sanitización avanzada
    const purified = DOMPurify.sanitize(input, {
      ...this.domPurifyConfig,
      ...options.domPurifyConfig
    });

    // Sanitización adicional con XSS
    const sanitized = xss(purified, {
      ...this.xssOptions,
      ...options.xssOptions
    });

    return sanitized;
  }

  /**
     * Sanitizar email
     */
  sanitizeEmail(input) {
    if (typeof input !== 'string') {
      return '';
    }

    // Sanitización básica
    input = this.sanitizeString(input, { maxLength: 254 });

    // Normalizar email
    if (validator.isEmail(input)) {
      return validator.normalizeEmail(input, {
        gmail_lowercase: true,
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_lowercase: true,
        outlookdotcom_remove_subaddress: false,
        yahoo_lowercase: true,
        yahoo_remove_subaddress: false,
        icloud_lowercase: true,
        icloud_remove_subaddress: false
      });
    }

    return '';
  }

  /**
     * Sanitizar URL
     */
  sanitizeUrl(input, options = {}) {
    if (typeof input !== 'string') {
      return '';
    }

    // Sanitización básica
    input = this.sanitizeString(input, { maxLength: 2048 });

    // Detectar path traversal
    if (this.detectPathTraversal(input)) {
      logger.warn('Path traversal attack detected', { input });
      return '';
    }

    // Validar y normalizar URL
    if (validator.isURL(input, {
      protocols: options.allowedProtocols || ['http', 'https'],
      require_protocol: options.requireProtocol || false,
      require_host: true,
      require_port: false,
      require_valid_protocol: true,
      allow_underscores: false,
      host_whitelist: options.hostWhitelist || false,
      host_blacklist: options.hostBlacklist || false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false,
      disallow_auth: true
    })) {
      return input;
    }

    return '';
  }

  /**
     * Sanitizar número
     */
  sanitizeNumber(input, options = {}) {
    if (typeof input === 'number') {
      if (isNaN(input) || !isFinite(input)) {
        return options.defaultValue || 0;
      }
      return input;
    }

    if (typeof input === 'string') {
      // Remover caracteres no numéricos excepto . y -
      const cleaned = input.replace(/[^0-9.-]/g, '');
            
      if (options.integer) {
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? (options.defaultValue || 0) : parsed;
      } else {
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? (options.defaultValue || 0) : parsed;
      }
    }

    return options.defaultValue || 0;
  }

  /**
     * Sanitizar booleano
     */
  sanitizeBoolean(input, defaultValue = false) {
    if (typeof input === 'boolean') {
      return input;
    }

    if (typeof input === 'string') {
      const lower = input.toLowerCase().trim();
      if (['true', '1', 'yes', 'on'].includes(lower)) {
        return true;
      }
      if (['false', '0', 'no', 'off'].includes(lower)) {
        return false;
      }
    }

    if (typeof input === 'number') {
      return Boolean(input);
    }

    return defaultValue;
  }

  /**
     * Sanitizar array
     */
  sanitizeArray(input, itemSanitizer, options = {}) {
    if (!Array.isArray(input)) {
      return [];
    }

    // Verificar longitud máxima
    if (input.length > (options.maxLength || this.maxArrayLength)) {
      logger.warn(`Array too long: ${input.length} items`);
      input = input.slice(0, options.maxLength || this.maxArrayLength);
    }

    // Sanitizar cada elemento
    return input.map(item => {
      try {
        return itemSanitizer(item);
      } catch (error) {
        logger.error('Error sanitizing array item:', error);
        return null;
      }
    }).filter(item => item !== null);
  }

  /**
     * Sanitizar objeto
     */
  sanitizeObject(input, schema, depth = 0) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return {};
    }

    // Verificar profundidad máxima
    if (depth > this.maxObjectDepth) {
      logger.warn('Object depth exceeded maximum');
      return {};
    }

    const sanitized = {};

    for (const [key, sanitizer] of Object.entries(schema)) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        try {
          if (typeof sanitizer === 'function') {
            sanitized[key] = sanitizer(input[key]);
          } else if (typeof sanitizer === 'object' && sanitizer.type) {
            switch (sanitizer.type) {
            case 'string':
              sanitized[key] = this.sanitizeString(input[key], sanitizer.options);
              break;
            case 'html':
              sanitized[key] = this.sanitizeHtml(input[key], sanitizer.options);
              break;
            case 'email':
              sanitized[key] = this.sanitizeEmail(input[key]);
              break;
            case 'url':
              sanitized[key] = this.sanitizeUrl(input[key], sanitizer.options);
              break;
            case 'number':
              sanitized[key] = this.sanitizeNumber(input[key], sanitizer.options);
              break;
            case 'boolean':
              sanitized[key] = this.sanitizeBoolean(input[key], sanitizer.defaultValue);
              break;
            case 'array':
              sanitized[key] = this.sanitizeArray(input[key], sanitizer.itemSanitizer, sanitizer.options);
              break;
            case 'object':
              sanitized[key] = this.sanitizeObject(input[key], sanitizer.schema, depth + 1);
              break;
            default:
              logger.warn(`Unknown sanitizer type: ${sanitizer.type}`);
            }
          }
        } catch (error) {
          logger.error(`Error sanitizing field ${key}:`, error);
        }
      } else if (sanitizer.required) {
        logger.warn(`Required field missing: ${key}`);
      }
    }

    return sanitized;
  }

  /**
     * Detectar inyección SQL
     */
  detectSQLInjection(input) {
    if (typeof input !== 'string') {
      return false;
    }

    return this.attackPatterns.sqlInjection.some(pattern => pattern.test(input));
  }

  /**
     * Detectar XSS
     */
  detectXSS(input) {
    if (typeof input !== 'string') {
      return false;
    }

    return this.attackPatterns.xss.some(pattern => pattern.test(input));
  }

  /**
     * Detectar path traversal
     */
  detectPathTraversal(input) {
    if (typeof input !== 'string') {
      return false;
    }

    return this.attackPatterns.pathTraversal.some(pattern => pattern.test(input));
  }

  /**
     * Detectar inyección de comandos
     */
  detectCommandInjection(input) {
    if (typeof input !== 'string') {
      return false;
    }

    return this.attackPatterns.commandInjection.some(pattern => pattern.test(input));
  }

  /**
     * Detectar inyección LDAP
     */
  detectLDAPInjection(input) {
    if (typeof input !== 'string') {
      return false;
    }

    return this.attackPatterns.ldapInjection.some(pattern => pattern.test(input));
  }

  /**
     * Análisis completo de seguridad
     */
  analyzeInput(input, context = 'general') {
    const analysis = {
      safe: true,
      threats: [],
      sanitized: input,
      context
    };

    if (typeof input === 'string') {
      // Detectar diferentes tipos de ataques
      if (this.detectSQLInjection(input)) {
        analysis.safe = false;
        analysis.threats.push('SQL_INJECTION');
      }

      if (this.detectXSS(input)) {
        analysis.safe = false;
        analysis.threats.push('XSS');
      }

      if (this.detectPathTraversal(input)) {
        analysis.safe = false;
        analysis.threats.push('PATH_TRAVERSAL');
      }

      if (this.detectCommandInjection(input)) {
        analysis.safe = false;
        analysis.threats.push('COMMAND_INJECTION');
      }

      if (this.detectLDAPInjection(input)) {
        analysis.safe = false;
        analysis.threats.push('LDAP_INJECTION');
      }

      // Sanitizar según el contexto
      switch (context) {
      case 'html':
        analysis.sanitized = this.sanitizeHtml(input);
        break;
      case 'email':
        analysis.sanitized = this.sanitizeEmail(input);
        break;
      case 'url':
        analysis.sanitized = this.sanitizeUrl(input);
        break;
      default:
        analysis.sanitized = this.sanitizeString(input);
      }
    }

    // Log amenazas detectadas
    if (!analysis.safe) {
      logger.warn('Security threats detected', {
        threats: analysis.threats,
        context,
        input: input.toString().substring(0, 100)
      });
    }

    return analysis;
  }

  /**
     * Middleware para sanitización automática
     */
  middleware(options = {}) {
    return (req, res, next) => {
      try {
        // Sanitizar query parameters
        if (req.query && typeof req.query === 'object') {
          req.query = this.sanitizeQueryParams(req.query, options.querySchema);
        }

        // Sanitizar body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeRequestBody(req.body, options.bodySchema);
        }

        // Sanitizar headers específicos
        if (options.sanitizeHeaders) {
          req.headers = this.sanitizeHeaders(req.headers, options.headerSchema);
        }

        next();
      } catch (error) {
        logger.error('Error in sanitization middleware:', error);
        res.status(400).json({ error: 'Invalid input data' });
      }
    };
  }

  /**
     * Sanitizar parámetros de query
     */
  sanitizeQueryParams(query, schema = {}) {
    const defaultSchema = {
      page: { type: 'number', options: { integer: true, defaultValue: 1 } },
      limit: { type: 'number', options: { integer: true, defaultValue: 10 } },
      search: { type: 'string', options: { maxLength: 100 } },
      sort: { type: 'string', options: { maxLength: 50 } },
      order: { type: 'string', options: { maxLength: 10 } }
    };

    return this.sanitizeObject(query, { ...defaultSchema, ...schema });
  }

  /**
     * Sanitizar body de request
     */
  sanitizeRequestBody(body, schema = {}) {
    // Schema por defecto para campos comunes
    const defaultSchema = {
      email: { type: 'email' },
      password: { type: 'string', options: { maxLength: 128 } },
      name: { type: 'string', options: { maxLength: 100 } },
      message: { type: 'html', options: { maxLength: 5000 } },
      phone: { type: 'string', options: { maxLength: 20 } },
      url: { type: 'url' },
      description: { type: 'html', options: { maxLength: 1000 } }
    };

    return this.sanitizeObject(body, { ...defaultSchema, ...schema });
  }

  /**
     * Sanitizar headers
     */
  sanitizeHeaders(headers, schema = {}) {
    const sanitized = {};
    const allowedHeaders = [
      'authorization', 'content-type', 'user-agent', 'accept',
      'accept-language', 'accept-encoding', 'cache-control',
      'x-requested-with', 'x-forwarded-for', 'x-real-ip'
    ];

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
            
      if (allowedHeaders.includes(lowerKey) || schema[lowerKey]) {
        if (schema[lowerKey]) {
          sanitized[key] = this.sanitizeString(value, schema[lowerKey]);
        } else {
          sanitized[key] = this.sanitizeString(value, { maxLength: 1000 });
        }
      }
    }

    return sanitized;
  }

  /**
     * Validar y sanitizar archivo subido
     */
  sanitizeFileUpload(file, options = {}) {
    const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/gif', 'text/plain'];
    const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB por defecto
    const allowedExtensions = options.allowedExtensions || ['.jpg', '.jpeg', '.png', '.gif', '.txt'];

    if (!file) {
      throw new Error('No file provided');
    }

    // Verificar tipo MIME
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type not allowed: ${file.mimetype}`);
    }

    // Verificar tamaño
    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.size} bytes`);
    }

    // Verificar extensión
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`File extension not allowed: ${ext}`);
    }

    // Sanitizar nombre de archivo
    const sanitizedName = this.sanitizeString(file.originalname, { maxLength: 255 })
      .replace(/[^a-zA-Z0-9.-]/g, '_');

    return {
      ...file,
      originalname: sanitizedName,
      safe: true
    };
  }
}

export default InputSanitizationService;
/**
 * Input Sanitization Middleware
 * Middleware para sanitización automática de inputs
 * Recomendación #20: Implementar sanitización completa de inputs
 */

import InputSanitizationService from '../../services/core/core/InputSanitizationService.js';
import { log as logger } from '../../services/core/core/logger.js';

const sanitizationService = new InputSanitizationService();

/**
 * Middleware general de sanitización
 */
export const sanitizeInputs = (options = {}) => {
  return sanitizationService.middleware(options);
};

/**
 * Middleware para sanitización de mensajes de chat
 */
export const sanitizeChatMessage = (req, res, next) => {
  try {
    if (req.body && req.body.message) {
      const analysis = sanitizationService.analyzeInput(req.body.message, 'html');
            
      if (!analysis.safe) {
        logger.warn('Unsafe chat message blocked', {
          userId: req.user?.id,
          threats: analysis.threats,
          ip: req.ip
        });
                
        return res.status(400).json({
          error: 'Message contains unsafe content',
          threats: analysis.threats
        });
      }
            
      req.body.message = analysis.sanitized;
    }
        
    next();
  } catch (error) {
    logger.error('Error in chat message sanitization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware para sanitización de datos de contacto
 */
export const sanitizeContactData = (req, res, next) => {
  try {
    if (req.body) {
      const schema = {
        name: { type: 'string', options: { maxLength: 100 } },
        email: { type: 'email' },
        phone: { type: 'string', options: { maxLength: 20 } },
        company: { type: 'string', options: { maxLength: 100 } },
        notes: { type: 'html', options: { maxLength: 1000 } },
        tags: { 
          type: 'array', 
          itemSanitizer: (item) => sanitizationService.sanitizeString(item, { maxLength: 50 }),
          options: { maxLength: 10 }
        }
      };
            
      req.body = sanitizationService.sanitizeObject(req.body, schema);
    }
        
    next();
  } catch (error) {
    logger.error('Error in contact data sanitization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware para sanitización de plantillas
 */
export const sanitizeTemplateData = (req, res, next) => {
  try {
    if (req.body) {
      const schema = {
        name: { type: 'string', options: { maxLength: 100 } },
        content: { type: 'html', options: { maxLength: 5000 } },
        description: { type: 'string', options: { maxLength: 500 } },
        category: { type: 'string', options: { maxLength: 50 } },
        variables: {
          type: 'array',
          itemSanitizer: (item) => sanitizationService.sanitizeString(item, { maxLength: 50 }),
          options: { maxLength: 20 }
        }
      };
            
      req.body = sanitizationService.sanitizeObject(req.body, schema);
    }
        
    next();
  } catch (error) {
    logger.error('Error in template data sanitization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware para sanitización de datos de usuario
 */
export const sanitizeUserData = (req, res, next) => {
  try {
    if (req.body) {
      const schema = {
        username: { type: 'string', options: { maxLength: 50 } },
        email: { type: 'email' },
        firstName: { type: 'string', options: { maxLength: 50 } },
        lastName: { type: 'string', options: { maxLength: 50 } },
        bio: { type: 'html', options: { maxLength: 1000 } },
        website: { type: 'url' },
        phone: { type: 'string', options: { maxLength: 20 } },
        company: { type: 'string', options: { maxLength: 100 } },
        role: { type: 'string', options: { maxLength: 50 } }
      };
            
      req.body = sanitizationService.sanitizeObject(req.body, schema);
    }
        
    next();
  } catch (error) {
    logger.error('Error in user data sanitization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware para sanitización de parámetros de búsqueda
 */
export const sanitizeSearchParams = (req, res, next) => {
  try {
    if (req.query) {
      const schema = {
        q: { type: 'string', options: { maxLength: 200 } },
        search: { type: 'string', options: { maxLength: 200 } },
        filter: { type: 'string', options: { maxLength: 100 } },
        category: { type: 'string', options: { maxLength: 50 } },
        tag: { type: 'string', options: { maxLength: 50 } },
        page: { type: 'number', options: { integer: true, defaultValue: 1 } },
        limit: { type: 'number', options: { integer: true, defaultValue: 10 } },
        sort: { type: 'string', options: { maxLength: 50 } },
        order: { type: 'string', options: { maxLength: 10 } }
      };
            
      const sanitizedQuery = sanitizationService.sanitizeObject(req.query, schema);
      Object.defineProperty(req, 'query', {
        value: sanitizedQuery,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
        
    next();
  } catch (error) {
    logger.error('Error in search params sanitization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware para sanitización de archivos subidos
 */
export const sanitizeFileUpload = (options = {}) => {
  return (req, res, next) => {
    try {
      if (req.file) {
        req.file = sanitizationService.sanitizeFileUpload(req.file, options);
      }
            
      if (req.files) {
        if (Array.isArray(req.files)) {
          req.files = req.files.map(file => 
            sanitizationService.sanitizeFileUpload(file, options)
          );
        } else {
          // Multer con campos múltiples
          for (const [fieldName, files] of Object.entries(req.files)) {
            req.files[fieldName] = files.map(file => 
              sanitizationService.sanitizeFileUpload(file, options)
            );
          }
        }
      }
            
      next();
    } catch (error) {
      logger.error('Error in file upload sanitization:', error);
      res.status(400).json({ error: error.message });
    }
  };
};

/**
 * Middleware para detectar y bloquear ataques
 */
export const detectAttacks = (req, res, next) => {
  try {
    const checkInput = (input, context = 'general') => {
      if (typeof input === 'string') {
        const analysis = sanitizationService.analyzeInput(input, context);
        if (!analysis.safe) {
          logger.warn('Attack detected and blocked', {
            threats: analysis.threats,
            context,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id,
            input: input.substring(0, 100)
          });
                    
          throw new Error(`Security threat detected: ${analysis.threats.join(', ')}`);
        }
      } else if (typeof input === 'object' && input !== null) {
        for (const [key, value] of Object.entries(input)) {
          checkInput(value, key);
        }
      }
    };
        
    // Verificar query parameters
    if (req.query) {
      checkInput(req.query, 'query');
    }
        
    // Verificar body
    if (req.body) {
      checkInput(req.body, 'body');
    }
        
    // Verificar headers específicos
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'user-agent', 'referer'];
    for (const header of suspiciousHeaders) {
      if (req.headers[header]) {
        checkInput(req.headers[header], `header-${header}`);
      }
    }
        
    next();
  } catch (error) {
    logger.error('Attack detection error:', error);
    res.status(400).json({ 
      error: 'Request blocked due to security concerns',
      code: 'SECURITY_THREAT_DETECTED'
    });
  }
};

/**
 * Middleware para logging de sanitización
 */
export const logSanitization = (req, res, next) => {
  const originalBody = JSON.stringify(req.body);
  const originalQuery = JSON.stringify(req.query);
    
  // Continuar con el siguiente middleware
  next();
    
  // Log después de la sanitización
  const sanitizedBody = JSON.stringify(req.body);
  const sanitizedQuery = JSON.stringify(req.query);
    
  if (originalBody !== sanitizedBody || originalQuery !== sanitizedQuery) {
    logger.info('Input sanitization applied', {
      route: req.route?.path || req.path,
      method: req.method,
      userId: req.user?.id,
      ip: req.ip,
      bodyChanged: originalBody !== sanitizedBody,
      queryChanged: originalQuery !== sanitizedQuery
    });
  }
};

/**
 * Middleware combinado para máxima seguridad
 */
export const maxSecuritySanitization = (options = {}) => {
  return [
    detectAttacks,
    sanitizeInputs(options),
    logSanitization
  ];
};

/**
 * Configuraciones predefinidas para diferentes tipos de rutas
 */
export const sanitizationConfigs = {
  // Para rutas de API públicas
  public: {
    querySchema: {
      page: { type: 'number', options: { integer: true, defaultValue: 1 } },
      limit: { type: 'number', options: { integer: true, defaultValue: 10 } },
      search: { type: 'string', options: { maxLength: 100 } }
    },
    bodySchema: {
      email: { type: 'email' },
      message: { type: 'string', options: { maxLength: 1000 } }
    }
  },
    
  // Para rutas de administración
  admin: {
    querySchema: {
      page: { type: 'number', options: { integer: true, defaultValue: 1 } },
      limit: { type: 'number', options: { integer: true, defaultValue: 50 } },
      search: { type: 'string', options: { maxLength: 200 } },
      filter: { type: 'string', options: { maxLength: 100 } }
    },
    bodySchema: {
      name: { type: 'string', options: { maxLength: 100 } },
      description: { type: 'html', options: { maxLength: 2000 } },
      settings: { type: 'object', schema: {} }
    }
  },
    
  // Para rutas de chat
  chat: {
    bodySchema: {
      message: { type: 'html', options: { maxLength: 5000 } },
      attachments: {
        type: 'array',
        itemSanitizer: (item) => sanitizationService.sanitizeObject(item, {
          type: { type: 'string', options: { maxLength: 50 } },
          url: { type: 'url' },
          name: { type: 'string', options: { maxLength: 255 } }
        }),
        options: { maxLength: 5 }
      }
    }
  },
    
  // Para rutas de archivos
  files: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt']
  }
};

export default {
  sanitizeInputs,
  sanitizeChatMessage,
  sanitizeContactData,
  sanitizeTemplateData,
  sanitizeUserData,
  sanitizeSearchParams,
  sanitizeFileUpload,
  detectAttacks,
  logSanitization,
  maxSecuritySanitization,
  sanitizationConfigs
};
import AuthenticationManager from './AuthenticationManager.js';
import AuthorizationManager from './AuthorizationManager.js';
import EncryptionManager from './EncryptionManager.js';

/**
 * Configuración por defecto del sistema de seguridad
 */
const DEFAULT_SECURITY_CONFIG = {
  enabled: true,
    
  // Configuración de autenticación
  authentication: {
    enabled: true,
    jwt: {
      secret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
      algorithm: 'HS256',
      expiresIn: '24h',
      issuer: 'chatbot-system',
      audience: 'chatbot-users'
    },
    session: {
      secret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax' // Cambiado de 'strict' a 'lax' para compatibilidad con Safari
    },
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
    mfa: {
      enabled: false,
      methods: ['totp', 'backup_codes'],
      totp: {
        issuer: 'ChatBot System',
        window: 1,
        step: 30
      },
      backupCodes: {
        count: 10,
        length: 8
      }
    },
    oauth: {
      enabled: false,
      providers: {}
    },
    rateLimit: {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutos
      blockDuration: 15 * 60 * 1000 // 15 minutos
    }
  },
    
  // Configuración de autorización
  authorization: {
    enabled: true,
    roles: {
      hierarchy: true,
      inheritance: true,
      maxDepth: 5,
      defaultRoles: ['user']
    },
    permissions: {
      granular: true,
      wildcards: true,
      negation: true,
      cache: {
        enabled: true,
        ttl: 300000 // 5 minutos
      }
    },
    policies: {
      dynamic: true,
      contextual: true,
      timeBasedAccess: false,
      locationBasedAccess: false,
      deviceBasedAccess: false
    },
    audit: {
      enabled: true,
      logAccess: true,
      logDenials: true,
      logRoleChanges: true,
      logPermissionChanges: true
    }
  },
    
  // Configuración de encriptación
  encryption: {
    enabled: true,
    symmetric: {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      tagLength: 16,
      encoding: 'hex'
    },
    asymmetric: {
      algorithm: 'rsa',
      keySize: 2048,
      padding: 'oaep',
      hashAlgorithm: 'sha256'
    },
    hashing: {
      algorithm: 'sha256',
      saltLength: 32,
      iterations: 100000,
      keyLength: 64,
      encoding: 'hex'
    },
    bcrypt: {
      saltRounds: 12,
      maxLength: 72
    },
    keyDerivation: {
      algorithm: 'pbkdf2',
      hashFunction: 'sha512',
      iterations: 100000,
      keyLength: 32,
      saltLength: 32
    },
    signing: {
      algorithm: 'rsa-sha256',
      keySize: 2048,
      encoding: 'hex'
    },
    tokens: {
      length: 32,
      encoding: 'hex'
    }
  },
    
  // Configuración general de seguridad
  security: {
    cors: {
      enabled: true,
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    helmet: {
      enabled: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ['\'self\''],
          styleSrc: ['\'self\'', '\'unsafe-inline\''],
          scriptSrc: ['\'self\''],
          imgSrc: ['\'self\'', 'data:', 'https:'],
          connectSrc: ['\'self\''],
          fontSrc: ['\'self\''],
          objectSrc: ['\'none\''],
          mediaSrc: ['\'self\''],
          frameSrc: ['\'none\'']
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // límite de 100 requests por ventana por IP
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    }
  }
};

/**
 * Eventos del sistema de seguridad
 */
const SECURITY_EVENTS = {
  // Eventos de autenticación
  USER_REGISTERED: 'user:registered',
  USER_LOGIN: 'user:login',
  USER_LOGIN_FAILED: 'user:login:failed',
  USER_LOGOUT: 'user:logout',
  USER_LOCKED: 'user:locked',
  USER_UNLOCKED: 'user:unlocked',
  PASSWORD_CHANGED: 'user:password:changed',
  MFA_ENABLED: 'user:mfa:enabled',
  MFA_DISABLED: 'user:mfa:disabled',
  TOKEN_GENERATED: 'token:generated',
  TOKEN_REFRESHED: 'token:refreshed',
  TOKEN_REVOKED: 'token:revoked',
    
  // Eventos de autorización
  ROLE_ASSIGNED: 'role:assigned',
  ROLE_REVOKED: 'role:revoked',
  PERMISSION_GRANTED: 'permission:granted',
  PERMISSION_REVOKED: 'permission:revoked',
  ACCESS_GRANTED: 'access:granted',
  ACCESS_DENIED: 'access:denied',
  POLICY_EVALUATED: 'policy:evaluated',
    
  // Eventos de encriptación
  KEY_GENERATED: 'key:generated',
  KEY_DERIVED: 'key:derived',
  DATA_ENCRYPTED: 'data:encrypted',
  DATA_DECRYPTED: 'data:decrypted',
  DATA_SIGNED: 'data:signed',
  SIGNATURE_VERIFIED: 'signature:verified',
  TOKEN_CREATED: 'token:created',
    
  // Eventos de seguridad general
  SECURITY_VIOLATION: 'security:violation',
  RATE_LIMIT_EXCEEDED: 'security:rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'security:suspicious_activity',
  SECURITY_AUDIT: 'security:audit'
};

/**
 * Estados de seguridad
 */
const SECURITY_STATES = {
  INITIALIZED: 'initialized',
  READY: 'ready',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ERROR: 'error',
  DESTROYED: 'destroyed'
};

/**
 * Niveles de seguridad
 */
const SECURITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Tipos de amenazas de seguridad
 */
const THREAT_TYPES = {
  BRUTE_FORCE: 'brute_force',
  SQL_INJECTION: 'sql_injection',
  XSS: 'xss',
  CSRF: 'csrf',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  DATA_BREACH: 'data_breach',
  MALWARE: 'malware',
  PHISHING: 'phishing',
  DOS: 'dos',
  DDOS: 'ddos'
};

/**
 * Crea una instancia del gestor de autenticación
 */
function createAuthenticationManager(config = {}) {
  const authConfig = {
    ...DEFAULT_SECURITY_CONFIG.authentication,
    ...config
  };
    
  return new AuthenticationManager(authConfig);
}

/**
 * Crea una instancia del gestor de autorización
 */
function createAuthorizationManager(config = {}) {
  const authzConfig = {
    ...DEFAULT_SECURITY_CONFIG.authorization,
    ...config
  };
    
  return new AuthorizationManager(authzConfig);
}

/**
 * Crea una instancia del gestor de encriptación
 */
function createEncryptionManager(config = {}) {
  const encryptionConfig = {
    ...DEFAULT_SECURITY_CONFIG.encryption,
    ...config
  };
    
  return new EncryptionManager(encryptionConfig);
}

/**
 * Crea un sistema de seguridad completo
 */
function createSecuritySystem(config = {}) {
  const securityConfig = {
    ...DEFAULT_SECURITY_CONFIG,
    ...config
  };
    
  const authenticationManager = createAuthenticationManager(securityConfig.authentication);
  const authorizationManager = createAuthorizationManager(securityConfig.authorization);
  const encryptionManager = createEncryptionManager(securityConfig.encryption);
    
  return {
    authentication: authenticationManager,
    authorization: authorizationManager,
    encryption: encryptionManager,
    config: securityConfig,
        
    async initialize() {
      await authenticationManager.initialize();
      await authorizationManager.initialize();
      await encryptionManager.initialize();
    },
        
    async destroy() {
      await authenticationManager.destroy();
      await authorizationManager.destroy();
      await encryptionManager.destroy();
    },
        
    getStatistics() {
      return {
        authentication: authenticationManager.getStatistics(),
        authorization: authorizationManager.getStatistics(),
        encryption: encryptionManager.getStatistics()
      };
    }
  };
}

/**
 * Utilidades del sistema de seguridad
 */
const SecurityUtils = {
  /**
     * Valida una configuración de seguridad
     */
  validateConfig(config) {
    const errors = [];
        
    // Validar configuración de autenticación
    if (config.authentication) {
      if (config.authentication.jwt && !config.authentication.jwt.secret) {
        errors.push('JWT secret is required');
      }
            
      if (config.authentication.session && !config.authentication.session.secret) {
        errors.push('Session secret is required');
      }
            
      if (config.authentication.password) {
        const pwd = config.authentication.password;
        if (pwd.minLength < 6) {
          errors.push('Password minimum length must be at least 6');
        }
        if (pwd.maxLength > 256) {
          errors.push('Password maximum length cannot exceed 256');
        }
        if (pwd.saltRounds < 10) {
          errors.push('Password salt rounds must be at least 10');
        }
      }
    }
        
    // Validar configuración de encriptación
    if (config.encryption) {
      if (config.encryption.symmetric && config.encryption.symmetric.keyLength < 16) {
        errors.push('Symmetric key length must be at least 16 bytes');
      }
            
      if (config.encryption.asymmetric && config.encryption.asymmetric.keySize < 1024) {
        errors.push('Asymmetric key size must be at least 1024 bits');
      }
    }
        
    return {
      valid: errors.length === 0,
      errors: errors
    };
  },
    
  /**
     * Crea una configuración optimizada para desarrollo
     */
  createDevelopmentConfig() {
    return {
      ...DEFAULT_SECURITY_CONFIG,
      authentication: {
        ...DEFAULT_SECURITY_CONFIG.authentication,
        password: {
          ...DEFAULT_SECURITY_CONFIG.authentication.password,
          minLength: 6,
          requireUppercase: false,
          requireLowercase: false,
          requireNumbers: false,
          requireSpecialChars: false,
          saltRounds: 10
        },
        rateLimit: {
          ...DEFAULT_SECURITY_CONFIG.authentication.rateLimit,
          maxAttempts: 10,
          windowMs: 5 * 60 * 1000 // 5 minutos
        }
      },
      security: {
        ...DEFAULT_SECURITY_CONFIG.security,
        cors: {
          ...DEFAULT_SECURITY_CONFIG.security.cors,
          origin: true // Permitir cualquier origen en desarrollo
        },
        rateLimit: {
          ...DEFAULT_SECURITY_CONFIG.security.rateLimit,
          max: 1000 // Límite más alto para desarrollo
        }
      }
    };
  },
    
  /**
     * Crea una configuración optimizada para producción
     */
  createProductionConfig() {
    return {
      ...DEFAULT_SECURITY_CONFIG,
      authentication: {
        ...DEFAULT_SECURITY_CONFIG.authentication,
        password: {
          ...DEFAULT_SECURITY_CONFIG.authentication.password,
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          saltRounds: 14
        },
        mfa: {
          ...DEFAULT_SECURITY_CONFIG.authentication.mfa,
          enabled: true
        }
      },
      encryption: {
        ...DEFAULT_SECURITY_CONFIG.encryption,
        asymmetric: {
          ...DEFAULT_SECURITY_CONFIG.encryption.asymmetric,
          keySize: 4096 // Claves más grandes para producción
        },
        bcrypt: {
          ...DEFAULT_SECURITY_CONFIG.encryption.bcrypt,
          saltRounds: 14
        }
      },
      security: {
        ...DEFAULT_SECURITY_CONFIG.security,
        helmet: {
          ...DEFAULT_SECURITY_CONFIG.security.helmet,
          enabled: true
        },
        rateLimit: {
          ...DEFAULT_SECURITY_CONFIG.security.rateLimit,
          max: 50 // Límite más estricto para producción
        }
      }
    };
  },
    
  /**
     * Obtiene información del sistema de seguridad
     */
  getSystemInfo() {
    return {
      version: '1.0.0',
      features: [
        'JWT Authentication',
        'Session Management',
        'Role-Based Access Control',
        'Multi-Factor Authentication',
        'Password Hashing',
        'Data Encryption',
        'Digital Signatures',
        'Rate Limiting',
        'Security Auditing'
      ],
      supportedAlgorithms: {
        symmetric: ['aes-256-gcm', 'aes-192-gcm', 'aes-128-gcm'],
        asymmetric: ['rsa', 'ec'],
        hashing: ['sha256', 'sha512', 'bcrypt'],
        signing: ['rsa-sha256', 'ecdsa-sha256']
      }
    };
  },
    
  /**
     * Formatea estadísticas de seguridad
     */
  formatStatistics(stats) {
    return {
      summary: {
        totalUsers: stats.authentication?.users || 0,
        activeTokens: stats.authentication?.activeTokens || 0,
        totalRoles: stats.authorization?.roles || 0,
        totalPermissions: stats.authorization?.permissions || 0,
        encryptionOperations: stats.encryption?.encryptionOperations || 0,
        decryptionOperations: stats.encryption?.decryptionOperations || 0
      },
      authentication: stats.authentication || {},
      authorization: stats.authorization || {},
      encryption: stats.encryption || {}
    };
  }
};

// Exportaciones ES Modules
export {
  // Clases principales
  AuthenticationManager,
  AuthorizationManager,
  EncryptionManager,
    
  // Configuración por defecto
  DEFAULT_SECURITY_CONFIG,
    
  // Funciones de fábrica
  createAuthenticationManager,
  createAuthorizationManager,
  createEncryptionManager,
  createSecuritySystem,
    
  // Utilidades
  SecurityUtils,
    
  // Constantes
  SECURITY_EVENTS,
  SECURITY_STATES,
  SECURITY_LEVELS,
  THREAT_TYPES
};

// Exportación por defecto
export default {
  AuthenticationManager,
  AuthorizationManager,
  EncryptionManager,
  DEFAULT_SECURITY_CONFIG,
  createAuthenticationManager,
  createAuthorizationManager,
  createEncryptionManager,
  createSecuritySystem,
  SecurityUtils,
  SECURITY_EVENTS,
  SECURITY_STATES,
  SECURITY_LEVELS,
  THREAT_TYPES
};
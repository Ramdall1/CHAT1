/**
 * OAuth 2.0 Service
 * Servicio de autenticación OAuth 2.0 con múltiples proveedores
 * Recomendación #18: Implementar OAuth 2.0 para autenticación segura
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import logger from './logger.js';
import DatabaseManager from '../../../config/database/DatabaseManager.js';

/**
 * Clase personalizada para errores de OAuth2
 */
class OAuth2Error extends Error {
  constructor(message, code = 'OAUTH2_ERROR', provider = null) {
    super(message);
    this.name = 'OAuth2Error';
    this.code = code;
    this.provider = provider;
  }
}

class OAuth2Service {
  constructor() {
    this.providers = {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scope: 'openid email profile'
      },
      dialog360: {
        clientId: process.env.DIALOG360_CLIENT_ID,
        clientSecret: process.env.DIALOG360_CLIENT_SECRET,
        redirectUri: process.env.DIALOG360_REDIRECT_URI || 'http://localhost:3000/auth/dialog360/callback',
        authUrl: 'https://hub.360dialog.com/oauth/authorize',
        tokenUrl: 'https://hub.360dialog.com/oauth/token',
        userInfoUrl: 'https://hub.360dialog.com/api/v1/me',
        scope: 'whatsapp:read whatsapp:write'
      },
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/microsoft/callback',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scope: 'openid email profile'
      }
    };

    this.jwtSecret = process.env.JWT_SECRET || this.generateSecureSecret();
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
        
    this.initializeDatabase();
  }

  /**
     * Inicializar tablas de OAuth en la base de datos
     */
  async initializeDatabase() {
    try {
      const db = DatabaseManager.getInstance();
            
      // Asegurar que la base de datos esté inicializada
      if (!db.isInitialized) {
        await db.initialize();
      }
            
      // Tabla para tokens OAuth
      await db.runQuery(`
                CREATE TABLE IF NOT EXISTS oauth_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    provider TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    token_type TEXT DEFAULT 'Bearer',
                    expires_at INTEGER,
                    scope TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

      // Tabla para estados OAuth (CSRF protection)
      await db.runQuery(`
                CREATE TABLE IF NOT EXISTS oauth_states (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    state TEXT UNIQUE NOT NULL,
                    provider TEXT NOT NULL,
                    redirect_url TEXT,
                    expires_at INTEGER NOT NULL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `);

      // Tabla para códigos de autorización
      await db.runQuery(`
                CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL,
                    client_id TEXT NOT NULL,
                    redirect_uri TEXT NOT NULL,
                    scope TEXT,
                    expires_at INTEGER NOT NULL,
                    used BOOLEAN DEFAULT FALSE,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

      // Índices para optimización
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider)');
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state)');
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_oauth_codes_code ON oauth_authorization_codes(code)');
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at)');
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at)');

      logger.info('OAuth2 database tables initialized successfully');
    } catch (error) {
      logger.error('Error initializing OAuth2 database:', error);
      throw error;
    }
  }

  /**
     * Generar URL de autorización para un proveedor
     */
  generateAuthUrl(provider, redirectUrl = null) {
    if (!this.providers[provider]) {
      throw new OAuth2Error(
        `Proveedor OAuth no soportado: ${provider}`,
        'UNSUPPORTED_PROVIDER',
        provider
      );
    }

    try {
      const config = this.providers[provider];
      const state = this.generateState();
            
      // Guardar estado en la base de datos
      this.saveState(state, provider, redirectUrl);

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scope,
        state: state,
        access_type: 'offline',
        prompt: 'consent'
      });

      const authUrl = `${config.authUrl}?${params.toString()}`;
      logger.info(`URL de autorización generada para ${provider}`, { provider, state });
            
      return authUrl;
    } catch (error) {
      logger.error(`Error generando URL de autorización para ${provider}:`, error);
      throw new OAuth2Error(
        `Error generando URL de autorización: ${error.message}`,
        'AUTH_URL_GENERATION_ERROR',
        provider
      );
    }
  }

  /**
     * Intercambiar código de autorización por tokens
     */
  async exchangeCodeForTokens(provider, code, state) {
    try {
      // Verificar estado
      const stateData = await this.verifyState(state, provider);
      if (!stateData) {
        throw new OAuth2Error(
          'Parámetro de estado inválido o expirado',
          'INVALID_STATE',
          provider
        );
      }

      const config = this.providers[provider];
      const tokenData = await this.requestTokens(config, code);
            
      // Obtener información del usuario
      const userInfo = await this.getUserInfo(config, tokenData.access_token);
            
      // Crear o actualizar usuario
      const user = await this.createOrUpdateUser(userInfo, provider);
            
      // Guardar tokens
      await this.saveTokens(user.id, provider, tokenData);
            
      // Generar JWT para la aplicación
      const jwt = this.generateJWT(user);
            
      // Limpiar estado usado
      await this.cleanupState(state);
            
      logger.info(`Intercambio de tokens exitoso para ${provider}`, { 
        provider, 
        userId: user.id,
        email: user.email 
      });
            
      return {
        user,
        tokens: {
          accessToken: jwt.accessToken,
          refreshToken: jwt.refreshToken,
          expiresIn: jwt.expiresIn
        },
        redirectUrl: stateData.redirect_url
      };
    } catch (error) {
      logger.error(`Error en intercambio de tokens OAuth2 para ${provider}:`, {
        error: error.message,
        provider,
        code: error.code || 'UNKNOWN_ERROR'
      });
            
      if (error instanceof OAuth2Error) {
        throw error;
      }
            
      throw new OAuth2Error(
        `Error en intercambio de tokens: ${error.message}`,
        'TOKEN_EXCHANGE_ERROR',
        provider
      );
    }
  }

  async requestTokens(config, code) {
    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error('Error en solicitud de tokens:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new OAuth2Error(
          `Solicitud de token falló: ${response.status} ${errorData}`,
          'TOKEN_REQUEST_FAILED'
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof OAuth2Error) {
        throw error;
      }
      throw new OAuth2Error(
        `Error solicitando tokens: ${error.message}`,
        'TOKEN_REQUEST_ERROR'
      );
    }
  }

  async getUserInfo(config, accessToken) {
    try {
      const response = await fetch(config.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new OAuth2Error(
          `Solicitud de información de usuario falló: ${response.status}`,
          'USER_INFO_REQUEST_FAILED'
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof OAuth2Error) {
        throw error;
      }
      throw new OAuth2Error(
        `Error obteniendo información de usuario: ${error.message}`,
        'USER_INFO_ERROR'
      );
    }
  }

  /**
     * Crear o actualizar usuario en la base de datos
     */
  async createOrUpdateUser(userInfo, provider) {
    const db = DatabaseManager.getInstance();
        
    // Normalizar información del usuario según el proveedor
    const normalizedUser = this.normalizeUserInfo(userInfo, provider);
        
    try {
      // Buscar usuario existente por email o ID del proveedor
      let user = await db.getQuery(
        'SELECT * FROM users WHERE email = ? OR oauth_id = ?',
        [normalizedUser.email, normalizedUser.oauth_id]
      );

      if (user) {
        // Actualizar usuario existente
        await db.runQuery(`
                    UPDATE users SET 
                        name = ?, 
                        email = ?, 
                        avatar_url = ?, 
                        oauth_provider = ?, 
                        oauth_id = ?,
                        updated_at = strftime('%s', 'now')
                    WHERE id = ?
                `, [
          normalizedUser.name,
          normalizedUser.email,
          normalizedUser.avatar_url,
          provider,
          normalizedUser.oauth_id,
          user.id
        ]);
                
        user = { ...user, ...normalizedUser };
      } else {
        // Crear nuevo usuario
        const result = await db.runQuery(`
                    INSERT INTO users (
                        name, email, avatar_url, oauth_provider, oauth_id, 
                        email_verified, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 1, 'active', strftime('%s', 'now'), strftime('%s', 'now'))
                `, [
          normalizedUser.name,
          normalizedUser.email,
          normalizedUser.avatar_url,
          provider,
          normalizedUser.oauth_id
        ]);

        user = {
          id: result.lastID,
          ...normalizedUser,
          email_verified: 1,
          status: 'active'
        };
      }

      return user;
    } catch (error) {
      logger.error('Error creating/updating OAuth user:', error);
      throw error;
    }
  }

  /**
     * Normalizar información del usuario según el proveedor
     */
  normalizeUserInfo(userInfo, provider) {
    switch (provider) {
    case 'google':
      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        verified: userInfo.verified_email
      };
    case 'dialog360':
      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name || userInfo.username,
        picture: userInfo.avatar_url,
        verified: true
      };
    case 'github':
      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name || userInfo.login,
        picture: userInfo.avatar_url,
        verified: true
      };
    case 'microsoft':
      return {
        id: userInfo.id,
        email: userInfo.mail || userInfo.userPrincipalName,
        name: userInfo.displayName,
        picture: null,
        verified: true
      };
    default:
      throw new OAuth2Error(
        `Proveedor no soportado para normalización de usuario: ${provider}`,
        'UNSUPPORTED_PROVIDER_NORMALIZATION',
        provider
      );
    }
  }

  /**
     * Guardar tokens OAuth en la base de datos
     */
  async saveTokens(userId, provider, tokenData) {
    const db = DatabaseManager.getInstance();
        
    const expiresAt = tokenData.expires_in ? 
      Math.floor(Date.now() / 1000) + tokenData.expires_in : null;

    try {
      // Eliminar tokens existentes para este usuario y proveedor
      await db.runQuery(
        'DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?',
        [userId, provider]
      );

      // Insertar nuevos tokens
      await db.runQuery(`
                INSERT INTO oauth_tokens (
                    user_id, provider, access_token, refresh_token, 
                    token_type, expires_at, scope, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
            `, [
        userId,
        provider,
        tokenData.access_token,
        tokenData.refresh_token || null,
        tokenData.token_type || 'Bearer',
        expiresAt,
        tokenData.scope || null
      ]);

      logger.info(`OAuth tokens saved for user ${userId} with provider ${provider}`);
    } catch (error) {
      logger.error('Error saving OAuth tokens:', error);
      throw error;
    }
  }

  /**
     * Generar JWT para la aplicación
     */
  generateJWT(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      provider: user.oauth_provider
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: 'chatbot-app',
      audience: 'chatbot-users'
    });

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiresIn }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresIn(this.jwtExpiresIn)
    };
  }

  /**
     * Verificar y renovar JWT
     */
  async verifyJWT(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new OAuth2Error('Token expirado', 'TOKEN_EXPIRED');
      }
      throw new OAuth2Error('Token inválido', 'INVALID_TOKEN');
    }
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      const user = await this.getUserById(decoded.userId);
            
      if (!user) {
        throw new OAuth2Error('Usuario no encontrado', 'USER_NOT_FOUND');
      }

      return this.generateJWT(user);
    } catch (error) {
      if (error instanceof OAuth2Error) {
        throw error;
      }
      throw new OAuth2Error('Refresh token inválido', 'INVALID_REFRESH_TOKEN');
    }
  }

  /**
     * Generar estado seguro para OAuth
     */
  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
     * Guardar estado OAuth
     */
  async saveState(state, provider, redirectUrl) {
    const db = DatabaseManager.getInstance();
    const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutos

    await db.runQuery(`
            INSERT INTO oauth_states (state, provider, redirect_url, expires_at)
            VALUES (?, ?, ?, ?)
        `, [state, provider, redirectUrl, expiresAt]);
  }

  /**
     * Verificar estado OAuth
     */
  async verifyState(state, provider) {
    const db = DatabaseManager.getInstance();
    const now = Math.floor(Date.now() / 1000);

    const stateData = await db.getQuery(`
            SELECT * FROM oauth_states 
            WHERE state = ? AND provider = ? AND expires_at > ?
        `, [state, provider, now]);

    return stateData;
  }

  /**
     * Limpiar estado usado
     */
  async cleanupState(state) {
    const db = DatabaseManager.getInstance();
    await db.runQuery('DELETE FROM oauth_states WHERE state = ?', [state]);
  }

  /**
     * Limpiar estados expirados
     */
  async cleanupExpiredStates() {
    const db = DatabaseManager.getInstance();
    const now = Math.floor(Date.now() / 1000);
        
    const result = await db.runQuery(
      'DELETE FROM oauth_states WHERE expires_at <= ?',
      [now]
    );

    logger.info(`Cleaned up ${result.changes} expired OAuth states`);
  }

  /**
     * Revocar tokens OAuth
     */
  async revokeTokens(userId, provider = null) {
    const db = DatabaseManager.getInstance();
        
    if (provider) {
      await db.runQuery(
        'DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?',
        [userId, provider]
      );
    } else {
      await db.runQuery(
        'DELETE FROM oauth_tokens WHERE user_id = ?',
        [userId]
      );
    }

    logger.info(`OAuth tokens revoked for user ${userId}${provider ? ` (${provider})` : ''}`);
  }

  /**
     * Obtener tokens de usuario
     */
  async getUserTokens(userId, provider = null) {
    const db = DatabaseManager.getInstance();
        
    if (provider) {
      return await db.getQuery(
        'SELECT * FROM oauth_tokens WHERE user_id = ? AND provider = ?',
        [userId, provider]
      );
    } else {
      return await db.getAllQuery(
        'SELECT * FROM oauth_tokens WHERE user_id = ?',
        [userId]
      );
    }
  }

  /**
     * Generar secreto seguro
     */
  generateSecureSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
     * Parsear tiempo de expiración
     */
  parseExpiresIn(expiresIn) {
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600; // Default 1 hora
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  /**
     * Middleware para verificar autenticación OAuth
     */
  authMiddleware() {
    return async(req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = await this.verifyJWT(token);
                
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({ error: error.message });
      }
    };
  }
}

export default OAuth2Service;
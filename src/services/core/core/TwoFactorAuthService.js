/**
 * Two-Factor Authentication Service
 * Servicio de autenticación de dos factores (2FA) con TOTP
 * Recomendación #19: Añadir autenticación de dos factores (2FA)
 */

import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import logger from './logger.js';
import DatabaseManager from '../../../config/database/DatabaseManager.js';

class TwoFactorAuthService {
  constructor() {
    this.appName = process.env.APP_NAME || 'ChatBot App';
    this.issuer = process.env.APP_ISSUER || 'ChatBot';
    this.backupCodesCount = 10;
    this.backupCodeLength = 8;
    this.totpWindow = 2; // Ventana de tiempo para TOTP (±2 períodos)
        
    this.initializeDatabase();
  }

  /**
     * Inicializar tablas de 2FA en la base de datos
     */
  async initializeDatabase() {
    try {
      const db = DatabaseManager.getInstance();
            
      // Asegurar que la base de datos esté inicializada
      if (!db.isInitialized) {
        await db.initialize();
      }
            
      // Tabla para configuración 2FA de usuarios
      await db.runQuery(`
                CREATE TABLE IF NOT EXISTS user_2fa (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE NOT NULL,
                    secret TEXT NOT NULL,
                    enabled BOOLEAN DEFAULT FALSE,
                    backup_codes TEXT, -- JSON array de códigos de respaldo
                    last_used_code TEXT,
                    last_used_at INTEGER,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

      // Tabla para intentos de 2FA (rate limiting y auditoría)
      await db.runQuery(`
                CREATE TABLE IF NOT EXISTS twofa_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    ip_address TEXT NOT NULL,
                    success BOOLEAN NOT NULL,
                    code_type TEXT NOT NULL, -- 'totp' o 'backup'
                    user_agent TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

      // Tabla para dispositivos confiables (opcional)
      await db.runQuery(`
                CREATE TABLE IF NOT EXISTS trusted_devices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    device_fingerprint TEXT NOT NULL,
                    device_name TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    trusted_until INTEGER NOT NULL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

      // Índices para optimización
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id)');
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_twofa_attempts_user_id ON twofa_attempts(user_id)');
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_twofa_attempts_created ON twofa_attempts(created_at)');
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id)');
      await db.runQuery('CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint)');

      logger.info('2FA database tables initialized successfully');
    } catch (error) {
      logger.error('Error initializing 2FA database:', error);
      throw error;
    }
  }

  /**
     * Generar secreto para TOTP
     */
  generateSecret(userEmail) {
    const secret = speakeasy.generateSecret({
      name: `${this.appName} (${userEmail})`,
      issuer: this.issuer,
      length: 32
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeUrl: null // Se generará por separado
    };
  }

  /**
     * Generar código QR para configuración
     */
  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return qrCodeDataUrl;
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
     * Generar códigos de respaldo
     */
  generateBackupCodes() {
    const codes = [];
        
    for (let i = 0; i < this.backupCodesCount; i++) {
      // Generar código alfanumérico de 8 caracteres
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  /**
     * Configurar 2FA para un usuario
     */
  async setup2FA(userId, userEmail) {
    try {
      const db = DatabaseManager.getInstance();
            
      // Verificar si ya tiene 2FA configurado
      const existing = await db.getQuery(
        'SELECT * FROM user_2fa WHERE user_id = ?',
        [userId]
      );

      if (existing && existing.enabled) {
        throw new Error('2FA is already enabled for this user');
      }

      // Generar secreto y códigos de respaldo
      const secretData = this.generateSecret(userEmail);
      const backupCodes = this.generateBackupCodes();
      const qrCodeUrl = await this.generateQRCode(secretData.otpauthUrl);

      // Guardar en la base de datos (pero no habilitado aún)
      if (existing) {
        await db.runQuery(`
                    UPDATE user_2fa SET 
                        secret = ?, 
                        backup_codes = ?, 
                        enabled = FALSE,
                        updated_at = strftime('%s', 'now')
                    WHERE user_id = ?
                `, [secretData.secret, JSON.stringify(backupCodes), userId]);
      } else {
        await db.runQuery(`
                    INSERT INTO user_2fa (user_id, secret, backup_codes, enabled)
                    VALUES (?, ?, ?, FALSE)
                `, [userId, secretData.secret, JSON.stringify(backupCodes)]);
      }

      logger.info(`2FA setup initiated for user ${userId}`);

      return {
        secret: secretData.secret,
        qrCodeUrl,
        backupCodes,
        manualEntryKey: secretData.secret
      };

    } catch (error) {
      logger.error('Error setting up 2FA:', error);
      throw error;
    }
  }

  /**
     * Verificar código TOTP y habilitar 2FA
     */
  async verify2FASetup(userId, token) {
    try {
      const db = DatabaseManager.getInstance();
            
      // Obtener configuración 2FA del usuario
      const user2fa = await db.getQuery(
        'SELECT * FROM user_2fa WHERE user_id = ? AND enabled = FALSE',
        [userId]
      );

      if (!user2fa) {
        throw new Error('2FA setup not found or already enabled');
      }

      // Verificar token TOTP
      const verified = speakeasy.totp.verify({
        secret: user2fa.secret,
        encoding: 'base32',
        token: token,
        window: this.totpWindow
      });

      if (!verified) {
        // Registrar intento fallido
        await this.logAttempt(userId, null, false, 'totp');
        throw new Error('Invalid verification code');
      }

      // Habilitar 2FA
      await db.runQuery(`
                UPDATE user_2fa SET 
                    enabled = TRUE, 
                    last_used_code = ?,
                    last_used_at = strftime('%s', 'now'),
                    updated_at = strftime('%s', 'now')
                WHERE user_id = ?
            `, [token, userId]);

      // Registrar intento exitoso
      await this.logAttempt(userId, null, true, 'totp');

      logger.info(`2FA enabled successfully for user ${userId}`);

      return {
        success: true,
        message: '2FA has been enabled successfully'
      };

    } catch (error) {
      logger.error('Error verifying 2FA setup:', error);
      throw error;
    }
  }

  /**
     * Verificar código 2FA durante el login
     */
  async verify2FA(userId, token, ipAddress = null, userAgent = null) {
    try {
      const db = DatabaseManager.getInstance();
            
      // Verificar rate limiting
      await this.checkRateLimit(userId, ipAddress);
            
      // Obtener configuración 2FA del usuario
      const user2fa = await db.getQuery(
        'SELECT * FROM user_2fa WHERE user_id = ? AND enabled = TRUE',
        [userId]
      );

      if (!user2fa) {
        throw new Error('2FA is not enabled for this user');
      }

      let verified = false;
      let codeType = 'totp';

      // Verificar si es un código de respaldo
      if (token.length === this.backupCodeLength && /^[A-F0-9]+$/.test(token)) {
        verified = await this.verifyBackupCode(userId, token, user2fa);
        codeType = 'backup';
      } else {
        // Verificar TOTP
        verified = speakeasy.totp.verify({
          secret: user2fa.secret,
          encoding: 'base32',
          token: token,
          window: this.totpWindow
        });

        // Verificar que no sea el mismo código usado recientemente
        if (verified && user2fa.last_used_code === token) {
          const lastUsedAt = user2fa.last_used_at;
          const now = Math.floor(Date.now() / 1000);
                    
          // Si el código fue usado en los últimos 30 segundos, rechazarlo
          if (now - lastUsedAt < 30) {
            verified = false;
          }
        }
      }

      // Registrar intento
      await this.logAttempt(userId, ipAddress, verified, codeType, userAgent);

      if (!verified) {
        throw new Error('Invalid 2FA code');
      }

      // Actualizar último código usado (solo para TOTP)
      if (codeType === 'totp') {
        await db.runQuery(`
                    UPDATE user_2fa SET 
                        last_used_code = ?,
                        last_used_at = strftime('%s', 'now'),
                        updated_at = strftime('%s', 'now')
                    WHERE user_id = ?
                `, [token, userId]);
      }

      logger.info(`2FA verification successful for user ${userId}`);

      return {
        success: true,
        codeType
      };

    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      throw error;
    }
  }

  /**
     * Verificar código de respaldo
     */
  async verifyBackupCode(userId, code, user2fa) {
    try {
      const backupCodes = JSON.parse(user2fa.backup_codes || '[]');
      const codeIndex = backupCodes.indexOf(code);

      if (codeIndex === -1) {
        return false;
      }

      // Remover el código usado
      backupCodes.splice(codeIndex, 1);

      // Actualizar códigos de respaldo en la base de datos
      const db = DatabaseManager.getInstance();
      await db.runQuery(`
                UPDATE user_2fa SET 
                    backup_codes = ?,
                    updated_at = strftime('%s', 'now')
                WHERE user_id = ?
            `, [JSON.stringify(backupCodes), userId]);

      logger.info(`Backup code used for user ${userId}. Remaining codes: ${backupCodes.length}`);

      return true;
    } catch (error) {
      logger.error('Error verifying backup code:', error);
      return false;
    }
  }

  /**
     * Deshabilitar 2FA
     */
  async disable2FA(userId, token) {
    try {
      // Verificar código antes de deshabilitar
      await this.verify2FA(userId, token);

      const db = DatabaseManager.getInstance();
      await db.runQuery('DELETE FROM user_2fa WHERE user_id = ?', [userId]);

      logger.info(`2FA disabled for user ${userId}`);

      return {
        success: true,
        message: '2FA has been disabled successfully'
      };

    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw error;
    }
  }

  /**
     * Regenerar códigos de respaldo
     */
  async regenerateBackupCodes(userId, token) {
    try {
      // Verificar código antes de regenerar
      await this.verify2FA(userId, token);

      const newBackupCodes = this.generateBackupCodes();
            
      const db = DatabaseManager.getInstance();
      await db.runQuery(`
                UPDATE user_2fa SET 
                    backup_codes = ?,
                    updated_at = strftime('%s', 'now')
                WHERE user_id = ?
            `, [JSON.stringify(newBackupCodes), userId]);

      logger.info(`Backup codes regenerated for user ${userId}`);

      return {
        success: true,
        backupCodes: newBackupCodes
      };

    } catch (error) {
      logger.error('Error regenerating backup codes:', error);
      throw error;
    }
  }

  /**
     * Obtener estado de 2FA para un usuario
     */
  async get2FAStatus(userId) {
    try {
      const db = DatabaseManager.getInstance();
      const user2fa = await db.getQuery(
        'SELECT enabled, created_at, updated_at FROM user_2fa WHERE user_id = ?',
        [userId]
      );

      if (!user2fa) {
        return {
          enabled: false,
          setupDate: null,
          lastUpdate: null
        };
      }

      // Contar códigos de respaldo restantes
      const backupCodesData = await db.getQuery(
        'SELECT backup_codes FROM user_2fa WHERE user_id = ?',
        [userId]
      );

      const backupCodes = JSON.parse(backupCodesData?.backup_codes || '[]');

      return {
        enabled: user2fa.enabled,
        setupDate: user2fa.created_at,
        lastUpdate: user2fa.updated_at,
        backupCodesRemaining: backupCodes.length
      };

    } catch (error) {
      logger.error('Error getting 2FA status:', error);
      throw error;
    }
  }

  /**
     * Verificar rate limiting para intentos 2FA
     */
  async checkRateLimit(userId, ipAddress) {
    const db = DatabaseManager.getInstance();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - 300; // 5 minutos

    // Contar intentos fallidos en los últimos 5 minutos
    const failedAttempts = await db.getQuery(`
            SELECT COUNT(*) as count 
            FROM twofa_attempts 
            WHERE user_id = ? AND success = FALSE AND created_at > ?
        `, [userId, windowStart]);

    if (failedAttempts.count >= 5) {
      throw new Error('Too many failed 2FA attempts. Please try again later.');
    }

    // Rate limiting por IP si se proporciona
    if (ipAddress) {
      const ipFailedAttempts = await db.getQuery(`
                SELECT COUNT(*) as count 
                FROM twofa_attempts 
                WHERE ip_address = ? AND success = FALSE AND created_at > ?
            `, [ipAddress, windowStart]);

      if (ipFailedAttempts.count >= 10) {
        throw new Error('Too many failed 2FA attempts from this IP. Please try again later.');
      }
    }
  }

  /**
     * Registrar intento de 2FA
     */
  async logAttempt(userId, ipAddress, success, codeType, userAgent = null) {
    try {
      const db = DatabaseManager.getInstance();
      await db.runQuery(`
                INSERT INTO twofa_attempts (user_id, ip_address, success, code_type, user_agent)
                VALUES (?, ?, ?, ?, ?)
            `, [userId, ipAddress || 'unknown', success, codeType, userAgent]);
    } catch (error) {
      logger.error('Error logging 2FA attempt:', error);
    }
  }

  /**
     * Limpiar intentos antiguos de 2FA
     */
  async cleanupOldAttempts() {
    try {
      const db = DatabaseManager.getInstance();
      const cutoffTime = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60); // 7 días

      const result = await db.runQuery(
        'DELETE FROM twofa_attempts WHERE created_at < ?',
        [cutoffTime]
      );

      logger.info(`Cleaned up ${result.changes} old 2FA attempts`);
    } catch (error) {
      logger.error('Error cleaning up 2FA attempts:', error);
    }
  }

  /**
     * Obtener estadísticas de 2FA
     */
  async get2FAStats(userId) {
    try {
      const db = DatabaseManager.getInstance();
            
      const stats = await db.getQuery(`
                SELECT 
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful_attempts,
                    SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_attempts,
                    MAX(created_at) as last_attempt
                FROM twofa_attempts 
                WHERE user_id = ? AND created_at > ?
            `, [userId, Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)]); // Últimos 30 días

      return {
        totalAttempts: stats.total_attempts || 0,
        successfulAttempts: stats.successful_attempts || 0,
        failedAttempts: stats.failed_attempts || 0,
        lastAttempt: stats.last_attempt,
        successRate: stats.total_attempts > 0 ? 
          (stats.successful_attempts / stats.total_attempts * 100).toFixed(2) : 0
      };

    } catch (error) {
      logger.error('Error getting 2FA stats:', error);
      throw error;
    }
  }

  /**
     * Middleware para verificar 2FA requerido
     */
  require2FA() {
    return async(req, res, next) => {
      try {
        if (!req.user || !req.user.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const status = await this.get2FAStatus(req.user.id);
                
        if (!status.enabled) {
          return res.status(403).json({ 
            error: '2FA is required for this action',
            code: '2FA_REQUIRED'
          });
        }

        // Verificar si ya se verificó 2FA en esta sesión
        if (req.session && req.session.twoFactorVerified) {
          return next();
        }

        const token = req.headers['x-2fa-token'] || req.body.twoFactorToken;
                
        if (!token) {
          return res.status(403).json({ 
            error: '2FA token required',
            code: '2FA_TOKEN_REQUIRED'
          });
        }

        await this.verify2FA(req.user.id, token, req.ip, req.get('User-Agent'));
                
        // Marcar como verificado en la sesión
        if (req.session) {
          req.session.twoFactorVerified = true;
        }

        next();

      } catch (error) {
        res.status(403).json({ 
          error: error.message,
          code: '2FA_VERIFICATION_FAILED'
        });
      }
    };
  }
}

export default TwoFactorAuthService;
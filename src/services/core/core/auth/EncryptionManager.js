import { EventEmitter } from 'events';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { createLogger } from '../logger.js';

/**
 * Gestor de encriptación para el sistema de seguridad
 * Maneja la encriptación de datos, hashing y operaciones criptográficas
 */
class EncryptionManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      enabled: true,
            
      // Configuración de encriptación simétrica
      symmetric: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
        tagLength: 16,
        encoding: 'hex'
      },
            
      // Configuración de encriptación asimétrica
      asymmetric: {
        algorithm: 'rsa',
        keySize: 2048,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        hashAlgorithm: 'sha256',
        mgf: crypto.constants.RSA_MGF1
      },
            
      // Configuración de hashing
      hashing: {
        algorithm: 'sha256',
        saltLength: 32,
        iterations: 100000,
        keyLength: 64,
        encoding: 'hex'
      },
            
      // Configuración de bcrypt
      bcrypt: {
        saltRounds: 12,
        maxLength: 72
      },
            
      // Configuración de derivación de claves
      keyDerivation: {
        algorithm: 'pbkdf2',
        hashFunction: 'sha512',
        iterations: 100000,
        keyLength: 32,
        saltLength: 32
      },
            
      // Configuración de firma digital
      signing: {
        algorithm: 'rsa-sha256',
        keySize: 2048,
        encoding: 'hex'
      },
            
      // Configuración de tokens seguros
      tokens: {
        length: 32,
        encoding: 'hex',
        alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      },
            
      // Configuración de caché de claves
      keyCache: {
        enabled: true,
        ttl: 3600000, // 1 hora
        maxSize: 1000
      },
            
      // Configuración de auditoría
      audit: {
        enabled: true,
        logOperations: true,
        logKeyGeneration: true,
        logEncryption: false, // Por seguridad
        logDecryption: false  // Por seguridad
      },
            
      ...config
    };
        
    this.state = 'initialized';
        
    // Almacenamiento de claves
    this.masterKey = null;
    this.keyPairs = new Map();
    this.symmetricKeys = new Map();
    this.keyCache = new Map();
    this.keyDerivationCache = new Map();
        
    // Estadísticas
    this.statistics = {
      encryptionOperations: 0,
      decryptionOperations: 0,
      hashingOperations: 0,
      signingOperations: 0,
      verificationOperations: 0,
      keyGenerations: 0,
      keyDerivations: 0,
      tokenGenerations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
        
    this.operationLog = [];
    this.logger = createLogger('ENCRYPTION_MANAGER');
        
    this._initializeCleanupTimers();
  }
    
  /**
     * Inicializa el gestor de encriptación
     */
  async initialize(masterKey = null) {
    try {
      this._validateConfig();
      this._setupEventHandlers();
            
      // Generar o establecer clave maestra
      if (masterKey) {
        this.masterKey = masterKey;
      } else {
        this.masterKey = this.generateSecureKey(this.config.symmetric.keyLength);
      }
            
      this.state = 'ready';
      this.emit('initialized');
            
      return true;
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Genera una clave segura
     */
  generateSecureKey(length = 32) {
    try {
      const key = crypto.randomBytes(length);
            
      this.statistics.keyGenerations++;
      this._logOperation('KEY_GENERATION', { length });
            
      return key;
    } catch (error) {
      this.statistics.errors++;
      this.emit('keyGenerationError', error);
      throw error;
    }
  }
    
  /**
     * Genera un par de claves asimétricas
     */
  generateKeyPair(options = {}) {
    try {
      const config = {
        ...this.config.asymmetric,
        ...options
      };
            
      const { publicKey, privateKey } = crypto.generateKeyPairSync(config.algorithm, {
        modulusLength: config.keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
            
      const keyPairId = crypto.randomUUID();
      const keyPair = {
        id: keyPairId,
        publicKey: publicKey,
        privateKey: privateKey,
        algorithm: config.algorithm,
        keySize: config.keySize,
        createdAt: new Date()
      };
            
      this.keyPairs.set(keyPairId, keyPair);
            
      this.statistics.keyGenerations++;
      this._logOperation('KEYPAIR_GENERATION', { keyPairId, algorithm: config.algorithm, keySize: config.keySize });
            
      return keyPair;
    } catch (error) {
      this.statistics.errors++;
      this.emit('keyPairGenerationError', error);
      throw error;
    }
  }
    
  /**
     * Deriva una clave a partir de una contraseña
     */
  async deriveKey(password, salt = null, options = {}) {
    try {
      const config = {
        ...this.config.keyDerivation,
        ...options
      };
            
      if (!salt) {
        salt = crypto.randomBytes(config.saltLength);
      }
            
      // Verificar caché
      const cacheKey = this._generateDerivationCacheKey(password, salt, config);
      if (this.keyDerivationCache.has(cacheKey)) {
        this.statistics.cacheHits++;
        return this.keyDerivationCache.get(cacheKey);
      }
            
      this.statistics.cacheMisses++;
            
      const derivedKey = await new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, config.iterations, config.keyLength, config.hashFunction, (err, key) => {
          if (err) reject(err);
          else resolve(key);
        });
      });
            
      const result = {
        key: derivedKey,
        salt: salt,
        iterations: config.iterations,
        algorithm: config.algorithm,
        hashFunction: config.hashFunction
      };
            
      // Cachear resultado
      this.keyDerivationCache.set(cacheKey, result);
            
      this.statistics.keyDerivations++;
      this._logOperation('KEY_DERIVATION', { algorithm: config.algorithm, iterations: config.iterations });
            
      return result;
    } catch (error) {
      this.statistics.errors++;
      this.emit('keyDerivationError', error);
      throw error;
    }
  }
    
  /**
     * Encripta datos usando encriptación simétrica
     */
  encrypt(data, key = null, options = {}) {
    try {
      const config = {
        ...this.config.symmetric,
        ...options
      };
            
      const encryptionKey = key || this.masterKey;
      if (!encryptionKey) {
        throw new Error('No encryption key provided');
      }
            
      const iv = crypto.randomBytes(config.ivLength);
      const cipher = crypto.createCipher(config.algorithm, encryptionKey, { iv });
            
      let encrypted = cipher.update(data, 'utf8', config.encoding);
      encrypted += cipher.final(config.encoding);
            
      const authTag = cipher.getAuthTag();
            
      const result = {
        encrypted: encrypted,
        iv: iv.toString(config.encoding),
        authTag: authTag.toString(config.encoding),
        algorithm: config.algorithm
      };
            
      this.statistics.encryptionOperations++;
      this._logOperation('ENCRYPTION', { algorithm: config.algorithm, dataLength: data.length });
            
      return result;
    } catch (error) {
      this.statistics.errors++;
      this.emit('encryptionError', error);
      throw error;
    }
  }
    
  /**
     * Desencripta datos usando encriptación simétrica
     */
  decrypt(encryptedData, key = null, options = {}) {
    try {
      const config = {
        ...this.config.symmetric,
        ...options
      };
            
      const decryptionKey = key || this.masterKey;
      if (!decryptionKey) {
        throw new Error('No decryption key provided');
      }
            
      const { encrypted, iv, authTag, algorithm } = encryptedData;
            
      const decipher = crypto.createDecipher(algorithm || config.algorithm, decryptionKey, {
        iv: Buffer.from(iv, config.encoding)
      });
            
      decipher.setAuthTag(Buffer.from(authTag, config.encoding));
            
      let decrypted = decipher.update(encrypted, config.encoding, 'utf8');
      decrypted += decipher.final('utf8');
            
      this.statistics.decryptionOperations++;
      this._logOperation('DECRYPTION', { algorithm: algorithm || config.algorithm });
            
      return decrypted;
    } catch (error) {
      this.statistics.errors++;
      this.emit('decryptionError', error);
      throw error;
    }
  }
    
  /**
     * Encripta datos usando encriptación asimétrica
     */
  encryptAsymmetric(data, publicKey, options = {}) {
    try {
      const config = {
        ...this.config.asymmetric,
        ...options
      };
            
      const encrypted = crypto.publicEncrypt({
        key: publicKey,
        padding: config.padding,
        oaepHash: config.hashAlgorithm
      }, Buffer.from(data, 'utf8'));
            
      this.statistics.encryptionOperations++;
      this._logOperation('ASYMMETRIC_ENCRYPTION', { algorithm: config.algorithm });
            
      return encrypted.toString('base64');
    } catch (error) {
      this.statistics.errors++;
      this.emit('asymmetricEncryptionError', error);
      throw error;
    }
  }
    
  /**
     * Desencripta datos usando encriptación asimétrica
     */
  decryptAsymmetric(encryptedData, privateKey, options = {}) {
    try {
      const config = {
        ...this.config.asymmetric,
        ...options
      };
            
      const decrypted = crypto.privateDecrypt({
        key: privateKey,
        padding: config.padding,
        oaepHash: config.hashAlgorithm
      }, Buffer.from(encryptedData, 'base64'));
            
      this.statistics.decryptionOperations++;
      this._logOperation('ASYMMETRIC_DECRYPTION', { algorithm: config.algorithm });
            
      return decrypted.toString('utf8');
    } catch (error) {
      this.statistics.errors++;
      this.emit('asymmetricDecryptionError', error);
      throw error;
    }
  }
    
  /**
     * Genera un hash de datos
     */
  hash(data, salt = null, options = {}) {
    try {
      const config = {
        ...this.config.hashing,
        ...options
      };
            
      if (!salt) {
        salt = crypto.randomBytes(config.saltLength);
      }
            
      const hash = crypto.createHash(config.algorithm);
      hash.update(data);
      hash.update(salt);
            
      const result = {
        hash: hash.digest(config.encoding),
        salt: salt.toString(config.encoding),
        algorithm: config.algorithm
      };
            
      this.statistics.hashingOperations++;
      this._logOperation('HASHING', { algorithm: config.algorithm, dataLength: data.length });
            
      return result;
    } catch (error) {
      this.statistics.errors++;
      this.emit('hashingError', error);
      throw error;
    }
  }
    
  /**
     * Verifica un hash
     */
  verifyHash(data, hashData) {
    try {
      const { hash: expectedHash, salt, algorithm } = hashData;
            
      const computedHash = crypto.createHash(algorithm);
      computedHash.update(data);
      computedHash.update(Buffer.from(salt, this.config.hashing.encoding));
            
      const computedHashString = computedHash.digest(this.config.hashing.encoding);
            
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedHash, this.config.hashing.encoding),
        Buffer.from(computedHashString, this.config.hashing.encoding)
      );
            
      this._logOperation('HASH_VERIFICATION', { algorithm, valid: isValid });
            
      return isValid;
    } catch (error) {
      this.statistics.errors++;
      this.emit('hashVerificationError', error);
      return false;
    }
  }
    
  /**
     * Genera un hash usando bcrypt
     */
  async hashPassword(password, options = {}) {
    try {
      const config = {
        ...this.config.bcrypt,
        ...options
      };
            
      if (password.length > config.maxLength) {
        throw new Error(`Password exceeds maximum length of ${config.maxLength} characters`);
      }
            
      const hash = await bcrypt.hash(password, config.saltRounds);
            
      this.statistics.hashingOperations++;
      this._logOperation('PASSWORD_HASHING', { saltRounds: config.saltRounds });
            
      return hash;
    } catch (error) {
      this.statistics.errors++;
      this.emit('passwordHashingError', error);
      throw error;
    }
  }
    
  /**
     * Verifica una contraseña con bcrypt
     */
  async verifyPassword(password, hash) {
    try {
      const isValid = await bcrypt.compare(password, hash);
            
      this._logOperation('PASSWORD_VERIFICATION', { valid: isValid });
            
      return isValid;
    } catch (error) {
      this.statistics.errors++;
      this.emit('passwordVerificationError', error);
      return false;
    }
  }
    
  /**
     * Firma datos digitalmente
     */
  sign(data, privateKey, options = {}) {
    try {
      const config = {
        ...this.config.signing,
        ...options
      };
            
      const sign = crypto.createSign(config.algorithm);
      sign.update(data);
            
      const signature = sign.sign(privateKey, config.encoding);
            
      this.statistics.signingOperations++;
      this._logOperation('DIGITAL_SIGNING', { algorithm: config.algorithm });
            
      return signature;
    } catch (error) {
      this.statistics.errors++;
      this.emit('signingError', error);
      throw error;
    }
  }
    
  /**
     * Verifica una firma digital
     */
  verify(data, signature, publicKey, options = {}) {
    try {
      const config = {
        ...this.config.signing,
        ...options
      };
            
      const verify = crypto.createVerify(config.algorithm);
      verify.update(data);
            
      const isValid = verify.verify(publicKey, signature, config.encoding);
            
      this.statistics.verificationOperations++;
      this._logOperation('SIGNATURE_VERIFICATION', { algorithm: config.algorithm, valid: isValid });
            
      return isValid;
    } catch (error) {
      this.statistics.errors++;
      this.emit('verificationError', error);
      return false;
    }
  }
    
  /**
     * Genera un token seguro
     */
  generateSecureToken(length = null, options = {}) {
    try {
      const config = {
        ...this.config.tokens,
        ...options
      };
            
      const tokenLength = length || config.length;
            
      let token;
      if (config.alphabet) {
        // Generar token con alfabeto personalizado
        const bytes = crypto.randomBytes(tokenLength);
        token = '';
        for (let i = 0; i < tokenLength; i++) {
          token += config.alphabet[bytes[i] % config.alphabet.length];
        }
      } else {
        // Generar token hexadecimal
        token = crypto.randomBytes(tokenLength).toString(config.encoding);
      }
            
      this.statistics.tokenGenerations++;
      this._logOperation('TOKEN_GENERATION', { length: tokenLength });
            
      return token;
    } catch (error) {
      this.statistics.errors++;
      this.emit('tokenGenerationError', error);
      throw error;
    }
  }
    
  /**
     * Genera un UUID seguro
     */
  generateSecureUUID() {
    try {
      const uuid = crypto.randomUUID();
            
      this.statistics.tokenGenerations++;
      this._logOperation('UUID_GENERATION', {});
            
      return uuid;
    } catch (error) {
      this.statistics.errors++;
      this.emit('uuidGenerationError', error);
      throw error;
    }
  }
    
  /**
     * Genera un HMAC
     */
  generateHMAC(data, key, algorithm = 'sha256') {
    try {
      const hmac = crypto.createHmac(algorithm, key);
      hmac.update(data);
            
      const result = hmac.digest('hex');
            
      this._logOperation('HMAC_GENERATION', { algorithm });
            
      return result;
    } catch (error) {
      this.statistics.errors++;
      this.emit('hmacGenerationError', error);
      throw error;
    }
  }
    
  /**
     * Verifica un HMAC
     */
  verifyHMAC(data, key, expectedHmac, algorithm = 'sha256') {
    try {
      const computedHmac = this.generateHMAC(data, key, algorithm);
            
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedHmac, 'hex'),
        Buffer.from(computedHmac, 'hex')
      );
            
      this._logOperation('HMAC_VERIFICATION', { algorithm, valid: isValid });
            
      return isValid;
    } catch (error) {
      this.statistics.errors++;
      this.emit('hmacVerificationError', error);
      return false;
    }
  }
    
  /**
     * Obtiene estadísticas del gestor
     */
  getStatistics() {
    return {
      ...this.statistics,
      keyPairs: this.keyPairs.size,
      symmetricKeys: this.symmetricKeys.size,
      cachedKeys: this.keyCache.size,
      cachedDerivations: this.keyDerivationCache.size
    };
  }
    
  /**
     * Obtiene el log de operaciones
     */
  getOperationLog(limit = 100) {
    return this.operationLog.slice(-limit);
  }
    
  /**
     * Limpia datos expirados
     */
  async cleanup() {
    const now = new Date();
        
    // Limpiar caché de claves expirado
    for (const [key, cached] of this.keyCache) {
      if (cached.expiresAt < now) {
        this.keyCache.delete(key);
      }
    }
        
    // Limpiar caché de derivación de claves
    for (const [key, cached] of this.keyDerivationCache) {
      if (cached.expiresAt && cached.expiresAt < now) {
        this.keyDerivationCache.delete(key);
      }
    }
        
    // Limpiar log de operaciones antiguo
    if (this.operationLog.length > 10000) {
      this.operationLog = this.operationLog.slice(-10000);
    }
        
    this.emit('cleanupCompleted');
  }
    
  /**
     * Habilita o deshabilita el gestor
     */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    this.emit(enabled ? 'enabled' : 'disabled');
  }
    
  /**
     * Destruye el gestor
     */
  async destroy() {
    this.state = 'destroyed';
        
    // Limpiar timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    // Limpiar datos sensibles
    this.masterKey = null;
    this.keyPairs.clear();
    this.symmetricKeys.clear();
    this.keyCache.clear();
    this.keyDerivationCache.clear();
    this.operationLog = [];
        
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  _validateConfig() {
    if (this.config.symmetric.keyLength < 16) {
      throw new Error('Symmetric key length must be at least 16 bytes');
    }
        
    if (this.config.asymmetric.keySize < 1024) {
      throw new Error('Asymmetric key size must be at least 1024 bits');
    }
        
    if (this.config.bcrypt.saltRounds < 10) {
      throw new Error('Bcrypt salt rounds must be at least 10');
    }
  }
    
  _setupEventHandlers() {
    this.on('error', (error) => {
      if (this.config.audit.enabled) {
        if (this.logger) this.logger.error('Encryption error:', error);
      }
    });
  }
    
  _initializeCleanupTimers() {
    // Limpiar datos expirados cada 10 minutos
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.emit('error', error);
      });
    }, 10 * 60 * 1000);
  }
    
  _generateDerivationCacheKey(password, salt, config) {
    const data = `${password}:${salt.toString('hex')}:${config.iterations}:${config.hashFunction}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
    
  _logOperation(type, data) {
    if (!this.config.audit.enabled || !this.config.audit.logOperations) {
      return;
    }
        
    // No registrar operaciones de encriptación/desencriptación por seguridad
    if ((type === 'ENCRYPTION' || type === 'DECRYPTION') && 
            (!this.config.audit.logEncryption && !this.config.audit.logDecryption)) {
      return;
    }
        
    const logEntry = {
      type: type,
      data: data,
      timestamp: new Date()
    };
        
    this.operationLog.push(logEntry);
    this.emit('operationLogged', logEntry);
  }
}

export default EncryptionManager;
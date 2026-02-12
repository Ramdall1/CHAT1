import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Centralized Secret Management System
 * Provides secure generation, validation, and persistence of secrets
 */
class SecretManager {
  constructor(options = {}) {
    this.secretsPath = options.secretsPath || path.join(process.cwd(), '.secrets');
    this.encryptionKey = options.encryptionKey || this.deriveEncryptionKey();
    this.secrets = new Map();
    this.initialized = false;
  }

  /**
     * Initialize the secret manager
     */
  async initialize() {
    if (this.initialized) return;

    try {
      await this.loadSecrets();
      this.initialized = true;
    } catch (error) {
      logger.warn('SecretManager: Could not load existing secrets, starting fresh');
      this.initialized = true;
    }
  }

  /**
     * Generate a cryptographically secure secret
     */
  generateSecret(length = 64, type = 'base64') {
    const buffer = crypto.randomBytes(length);
        
    switch (type) {
    case 'hex':
      return buffer.toString('hex');
    case 'base64':
      return buffer.toString('base64');
    case 'base64url':
      return buffer.toString('base64url');
    default:
      return buffer.toString('base64');
    }
  }

  /**
     * Validate secret strength
     */
  validateSecret(secret, minLength = 32) {
    const validation = {
      isValid: true,
      errors: [],
      strength: 'weak'
    };

    // Length validation
    if (!secret || secret.length < minLength) {
      validation.isValid = false;
      validation.errors.push(`Secret must be at least ${minLength} characters long`);
    }

    // Entropy validation
    const entropy = this.calculateEntropy(secret);
    if (entropy < 3.5) {
      validation.isValid = false;
      validation.errors.push('Secret has insufficient entropy');
    }

    // Strength assessment
    if (entropy >= 4.5) validation.strength = 'strong';
    else if (entropy >= 3.5) validation.strength = 'medium';

    // Common patterns check
    if (this.hasCommonPatterns(secret)) {
      validation.isValid = false;
      validation.errors.push('Secret contains common patterns');
    }

    return validation;
  }

  /**
     * Get or generate a secret
     */
  async getSecret(name, options = {}) {
    await this.initialize();

    const {
      length = 64,
      type = 'base64',
      persistent = true,
      regenerate = false
    } = options;

    // Return existing secret if available and not regenerating
    if (!regenerate && this.secrets.has(name)) {
      return this.secrets.get(name);
    }

    // Generate new secret
    const secret = this.generateSecret(length, type);
        
    // Validate the generated secret
    const validation = this.validateSecret(secret);
    if (!validation.isValid) {
      throw new Error(`Generated secret validation failed: ${validation.errors.join(', ')}`);
    }

    // Store in memory
    this.secrets.set(name, secret);

    // Persist if requested
    if (persistent) {
      await this.saveSecrets();
    }

    return secret;
  }

  /**
     * Set a custom secret
     */
  async setSecret(name, secret, persistent = true) {
    await this.initialize();

    // Validate the secret
    const validation = this.validateSecret(secret);
    if (!validation.isValid) {
      throw new Error(`Secret validation failed: ${validation.errors.join(', ')}`);
    }

    // Store in memory
    this.secrets.set(name, secret);

    // Persist if requested
    if (persistent) {
      await this.saveSecrets();
    }

    return true;
  }

  /**
     * Remove a secret
     */
  async removeSecret(name, persistent = true) {
    await this.initialize();

    this.secrets.delete(name);

    if (persistent) {
      await this.saveSecrets();
    }

    return true;
  }

  /**
     * List all secret names (not values)
     */
  async listSecrets() {
    await this.initialize();
    return Array.from(this.secrets.keys());
  }

  /**
     * Rotate a secret (generate new value)
     */
  async rotateSecret(name, options = {}) {
    const oldSecret = this.secrets.get(name);
    const newSecret = await this.getSecret(name, { ...options, regenerate: true });
        
    return {
      rotated: true,
      oldSecretHash: oldSecret ? crypto.createHash('sha256').update(oldSecret).digest('hex').substring(0, 8) : null,
      newSecretHash: crypto.createHash('sha256').update(newSecret).digest('hex').substring(0, 8)
    };
  }

  /**
     * Calculate entropy of a string
     */
  calculateEntropy(str) {
    const freq = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
        
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
     * Check for common patterns
     */
  hasCommonPatterns(secret) {
    const commonPatterns = [
      /^(.)\1+$/, // All same character
      /123456|abcdef|qwerty/i, // Common sequences
      /password|secret|admin|test/i, // Common words
      /^[0-9]+$/, // Only numbers
      /^[a-z]+$/i // Only letters
    ];

    return commonPatterns.some(pattern => pattern.test(secret));
  }

  /**
     * Derive encryption key from environment or generate
     */
  deriveEncryptionKey() {
    const envKey = process.env.SECRET_ENCRYPTION_KEY;
    if (envKey && envKey.length >= 32) {
      return crypto.createHash('sha256').update(envKey).digest();
    }

    // Generate a key based on system characteristics (not ideal for production)
    const systemInfo = process.platform + process.arch + (process.env.HOME || process.env.USERPROFILE || '');
    return crypto.createHash('sha256').update(systemInfo).digest();
  }

  /**
     * Encrypt data
     */
  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
        
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
     * Decrypt data
     */
  decrypt(encryptedData) {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
        
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
        
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
        
    return decrypted;
  }

  /**
     * Save secrets to encrypted file
     */
  async saveSecrets() {
    try {
      const secretsData = Object.fromEntries(this.secrets);
      const encryptedData = this.encrypt(JSON.stringify(secretsData));
            
      // Ensure directory exists
      const dir = path.dirname(this.secretsPath);
      await fs.mkdir(dir, { recursive: true });
            
      await fs.writeFile(this.secretsPath, encryptedData, { mode: 0o600 });
    } catch (error) {
      logger.error('SecretManager: Failed to save secrets:', error.message);
      throw error;
    }
  }

  /**
     * Load secrets from encrypted file
     */
  async loadSecrets() {
    try {
      const encryptedData = await fs.readFile(this.secretsPath, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      const secretsData = JSON.parse(decryptedData);
            
      this.secrets = new Map(Object.entries(secretsData));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('SecretManager: Failed to load secrets:', error.message);
      }
      throw error;
    }
  }

  /**
     * Health check
     */
  async healthCheck() {
    const health = {
      initialized: this.initialized,
      secretCount: this.secrets.size,
      encryptionAvailable: !!this.encryptionKey,
      persistenceAvailable: false
    };

    try {
      await fs.access(path.dirname(this.secretsPath));
      health.persistenceAvailable = true;
    } catch (error) {
      // Directory not accessible
    }

    return health;
  }
}

export default SecretManager;
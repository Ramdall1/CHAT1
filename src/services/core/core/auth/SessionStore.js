import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../logger.js';

class SessionStore {
  constructor(config = {}) {
    this.logger = createLogger('SESSION_STORE');
        
    this.config = {
      type: config.type || 'memory', // 'memory', 'redis', 'database', 'file'
      redis: config.redis || null,
      database: config.database || null,
      fileStore: {
        directory: config.fileStore?.directory || './data/sessions',
        ...config.fileStore
      },
      encryption: {
        enabled: config.encryption?.enabled || false,
        key: config.encryption?.key || null,
        algorithm: config.encryption?.algorithm || 'aes-256-gcm'
      },
      ttl: config.ttl || 24 * 60 * 60 * 1000, // 24 hours default
      cleanupInterval: config.cleanupInterval || 60 * 60 * 1000 // 1 hour
    };
        
    this.sessions = new Map(); // In-memory fallback
    this.cleanupTimer = null;
    this.initialized = false;
  }
    
  async initialize() {
    if (this.initialized) return;
        
    try {
      switch (this.config.type) {
      case 'redis':
        await this.initializeRedis();
        break;
      case 'database':
        await this.initializeDatabase();
        break;
      case 'file':
        await this.initializeFileStore();
        break;
      case 'memory':
      default:
        // Memory store is already initialized
        break;
      }
            
      // Start cleanup timer
      this.startCleanupTimer();
      this.initialized = true;
            
    } catch (error) {
      logger.warn('SessionStore initialization failed, falling back to memory store:', error.message);
      this.config.type = 'memory';
      this.initialized = true;
    }
  }
    
  async initializeRedis() {
    if (!this.config.redis) {
      throw new Error('Redis configuration required for Redis session store');
    }
        
    // Redis client should be passed in config or created here
    if (typeof this.config.redis.ping === 'function') {
      await this.config.redis.ping();
    }
  }
    
  async initializeDatabase() {
    if (!this.config.database) {
      throw new Error('Database configuration required for database session store');
    }
        
    // Create sessions table if it doesn't exist
    const createTableQuery = `
            CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(255) PRIMARY KEY,
                data TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_expires_at (expires_at)
            )
        `;
        
    if (typeof this.config.database.query === 'function') {
      await this.config.database.query(createTableQuery);
    }
  }
    
  async initializeFileStore() {
    const dir = this.config.fileStore.directory;
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
    
  async set(sessionId, data, ttl = null) {
    if (!this.initialized) {
      await this.initialize();
    }
        
    const expiresAt = new Date(Date.now() + (ttl || this.config.ttl));
    const sessionData = {
      id: sessionId,
      data: data,
      expiresAt: expiresAt,
      createdAt: new Date(),
      updatedAt: new Date()
    };
        
    try {
      switch (this.config.type) {
      case 'redis':
        await this.setRedis(sessionId, sessionData, ttl);
        break;
      case 'database':
        await this.setDatabase(sessionId, sessionData);
        break;
      case 'file':
        await this.setFile(sessionId, sessionData);
        break;
      case 'memory':
      default:
        this.sessions.set(sessionId, sessionData);
        break;
      }
            
      return true;
    } catch (error) {
      this.logger.error('SessionStore set error:', error);
      // Fallback to memory store
      this.sessions.set(sessionId, sessionData);
      return false;
    }
  }
    
  async get(sessionId) {
    if (!this.initialized) {
      await this.initialize();
    }
        
    try {
      let sessionData;
            
      switch (this.config.type) {
      case 'redis':
        sessionData = await this.getRedis(sessionId);
        break;
      case 'database':
        sessionData = await this.getDatabase(sessionId);
        break;
      case 'file':
        sessionData = await this.getFile(sessionId);
        break;
      case 'memory':
      default:
        sessionData = this.sessions.get(sessionId);
        break;
      }
            
      if (!sessionData) {
        return null;
      }
            
      // Check if session has expired
      if (new Date() > new Date(sessionData.expiresAt)) {
        await this.delete(sessionId);
        return null;
      }
            
      return sessionData.data;
            
    } catch (error) {
      this.logger.error('SessionStore get error:', error);
      // Fallback to memory store
      const sessionData = this.sessions.get(sessionId);
      if (sessionData && new Date() <= new Date(sessionData.expiresAt)) {
        return sessionData.data;
      }
      return null;
    }
  }
    
  async delete(sessionId) {
    if (!this.initialized) {
      await this.initialize();
    }
        
    try {
      switch (this.config.type) {
      case 'redis':
        await this.deleteRedis(sessionId);
        break;
      case 'database':
        await this.deleteDatabase(sessionId);
        break;
      case 'file':
        await this.deleteFile(sessionId);
        break;
      case 'memory':
      default:
        this.sessions.delete(sessionId);
        break;
      }
            
      return true;
    } catch (error) {
      this.logger.error('SessionStore delete error:', error);
      // Fallback to memory store
      this.sessions.delete(sessionId);
      return false;
    }
  }
    
  async clear() {
    if (!this.initialized) {
      await this.initialize();
    }
        
    try {
      switch (this.config.type) {
      case 'redis':
        await this.clearRedis();
        break;
      case 'database':
        await this.clearDatabase();
        break;
      case 'file':
        await this.clearFile();
        break;
      case 'memory':
      default:
        this.sessions.clear();
        break;
      }
            
      return true;
    } catch (error) {
      this.logger.error('SessionStore clear error:', error);
      this.sessions.clear();
      return false;
    }
  }
    
  // Redis implementation
  async setRedis(sessionId, sessionData, ttl) {
    const data = this.encryptData(JSON.stringify(sessionData));
    const expireSeconds = Math.floor((ttl || this.config.ttl) / 1000);
    await this.config.redis.setex(`session:${sessionId}`, expireSeconds, data);
  }
    
  async getRedis(sessionId) {
    const data = await this.config.redis.get(`session:${sessionId}`);
    if (!data) return null;
        
    const decrypted = this.decryptData(data);
    return JSON.parse(decrypted);
  }
    
  async deleteRedis(sessionId) {
    await this.config.redis.del(`session:${sessionId}`);
  }
    
  async clearRedis() {
    const keys = await this.config.redis.keys('session:*');
    if (keys.length > 0) {
      await this.config.redis.del(...keys);
    }
  }
    
  // Database implementation
  async setDatabase(sessionId, sessionData) {
    const data = this.encryptData(JSON.stringify(sessionData.data));
    const query = `
            INSERT INTO sessions (id, data, expires_at) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
            data = VALUES(data), 
            expires_at = VALUES(expires_at), 
            updated_at = CURRENT_TIMESTAMP
        `;
        
    await this.config.database.query(query, [
      sessionId,
      data,
      sessionData.expiresAt
    ]);
  }
    
  async getDatabase(sessionId) {
    const query = 'SELECT data, expires_at FROM sessions WHERE id = ? AND expires_at > NOW()';
    const results = await this.config.database.query(query, [sessionId]);
        
    if (!results || results.length === 0) {
      return null;
    }
        
    const row = results[0];
    const data = this.decryptData(row.data);
        
    return {
      data: JSON.parse(data),
      expiresAt: row.expires_at
    };
  }
    
  async deleteDatabase(sessionId) {
    const query = 'DELETE FROM sessions WHERE id = ?';
    await this.config.database.query(query, [sessionId]);
  }
    
  async clearDatabase() {
    const query = 'DELETE FROM sessions';
    await this.config.database.query(query);
  }
    
  // File implementation
  async setFile(sessionId, sessionData) {
    const filePath = path.join(this.config.fileStore.directory, `${sessionId}.json`);
    const data = this.encryptData(JSON.stringify(sessionData));
    await fs.writeFile(filePath, data, 'utf8');
  }
    
  async getFile(sessionId) {
    const filePath = path.join(this.config.fileStore.directory, `${sessionId}.json`);
        
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const decrypted = this.decryptData(data);
      return JSON.parse(decrypted);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
    
  async deleteFile(sessionId) {
    const filePath = path.join(this.config.fileStore.directory, `${sessionId}.json`);
        
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
    
  async clearFile() {
    const files = await fs.readdir(this.config.fileStore.directory);
    const sessionFiles = files.filter(file => file.endsWith('.json'));
        
    await Promise.all(
      sessionFiles.map(file => 
        fs.unlink(path.join(this.config.fileStore.directory, file))
      )
    );
  }
    
  // Encryption helpers
  encryptData(data) {
    if (!this.config.encryption.enabled || !this.config.encryption.key) {
      return data;
    }
        
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.config.encryption.algorithm, this.config.encryption.key);
    cipher.setAutoPadding(true);
        
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
        
    const authTag = cipher.getAuthTag ? cipher.getAuthTag().toString('hex') : '';
        
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag
    });
  }
    
  decryptData(encryptedData) {
    if (!this.config.encryption.enabled || !this.config.encryption.key) {
      return encryptedData;
    }
        
    try {
      const parsed = JSON.parse(encryptedData);
      const decipher = crypto.createDecipher(this.config.encryption.algorithm, this.config.encryption.key);
            
      if (parsed.authTag) {
        decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));
      }
            
      let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
            
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption error:', error);
      return encryptedData; // Return as-is if decryption fails
    }
  }
    
  // Cleanup expired sessions
  async cleanup() {
    if (!this.initialized) return;
        
    try {
      switch (this.config.type) {
      case 'redis':
        // Redis handles TTL automatically
        break;
      case 'database':
        await this.cleanupDatabase();
        break;
      case 'file':
        await this.cleanupFile();
        break;
      case 'memory':
      default:
        await this.cleanupMemory();
        break;
      }
    } catch (error) {
      this.logger.error('SessionStore cleanup error:', error);
    }
  }
    
  async cleanupDatabase() {
    const query = 'DELETE FROM sessions WHERE expires_at <= NOW()';
    await this.config.database.query(query);
  }
    
  async cleanupFile() {
    const files = await fs.readdir(this.config.fileStore.directory);
    const sessionFiles = files.filter(file => file.endsWith('.json'));
        
    for (const file of sessionFiles) {
      try {
        const filePath = path.join(this.config.fileStore.directory, file);
        const data = await fs.readFile(filePath, 'utf8');
        const sessionData = JSON.parse(this.decryptData(data));
                
        if (new Date() > new Date(sessionData.expiresAt)) {
          await fs.unlink(filePath);
        }
      } catch (error) {
        // If we can't read the file, delete it
        await fs.unlink(path.join(this.config.fileStore.directory, file));
      }
    }
  }
    
  async cleanupMemory() {
    const now = new Date();
    for (const [sessionId, sessionData] of this.sessions.entries()) {
      if (now > new Date(sessionData.expiresAt)) {
        this.sessions.delete(sessionId);
      }
    }
  }
    
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
        
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.logger.error('SessionStore cleanup timer error:', error);
      });
    }, this.config.cleanupInterval);
  }
    
  async close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
        
    // Close any open connections
    if (this.config.type === 'redis' && this.config.redis && typeof this.config.redis.quit === 'function') {
      await this.config.redis.quit();
    }
        
    if (this.config.type === 'database' && this.config.database && typeof this.config.database.end === 'function') {
      await this.config.database.end();
    }
        
    this.initialized = false;
  }
    
  // Statistics and monitoring
  async getStats() {
    const stats = {
      type: this.config.type,
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0
    };
        
    try {
      switch (this.config.type) {
      case 'redis':
        const keys = await this.config.redis.keys('session:*');
        stats.totalSessions = keys.length;
        stats.activeSessions = keys.length; // Redis auto-expires
        break;
      case 'database':
        const totalQuery = 'SELECT COUNT(*) as total FROM sessions';
        const activeQuery = 'SELECT COUNT(*) as active FROM sessions WHERE expires_at > NOW()';
                    
        const totalResult = await this.config.database.query(totalQuery);
        const activeResult = await this.config.database.query(activeQuery);
                    
        stats.totalSessions = totalResult[0].total;
        stats.activeSessions = activeResult[0].active;
        stats.expiredSessions = stats.totalSessions - stats.activeSessions;
        break;
      case 'memory':
      default:
        const now = new Date();
        stats.totalSessions = this.sessions.size;
                    
        for (const sessionData of this.sessions.values()) {
          if (now <= new Date(sessionData.expiresAt)) {
            stats.activeSessions++;
          } else {
            stats.expiredSessions++;
          }
        }
        break;
      }
    } catch (error) {
      this.logger.error('SessionStore stats error:', error);
    }
        
    return stats;
  }
}

export default SessionStore;
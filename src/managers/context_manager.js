/**
 * CONTEXT MANAGER - Gestión de memoria conversacional
 * 
 * Funcionalidades:
 * - Memoria conversacional por usuario
 * - Almacenamiento incremental y rotación segura
 * - Persistencia en archivos JSON individuales
 * - Límites configurables de contexto
 * - Compresión automática de conversaciones antiguas
 * - Recuperación de contexto reciente
 * 
 * @author Sistema Chat Bot v5.0.0
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../services/core/core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContextManager {
  constructor() {
    this.logger = createLogger('CONTEXT_MANAGER');
    this.dataDir = process.env.CONVERSATIONS_DATA_DIR || path.join(__dirname, '../../data/conversaciones');
    this.contexts = new Map(); // Cache en memoria
    this.isLoaded = false;
        
    // Sistema de mutex para operaciones críticas
    this.operationMutex = false;
    this.operationQueue = [];
        
    // Configuración
    this.config = {
      maxMessagesPerContext: parseInt(process.env.MAX_MESSAGES_PER_CONTEXT) || 100,
      maxContextAge: parseInt(process.env.MAX_CONTEXT_AGE_DAYS) || 30,
      recentMessagesCount: parseInt(process.env.RECENT_MESSAGES_COUNT) || 10,
      autoRotate: process.env.AUTO_ROTATE_CONTEXT !== 'false',
      compressOld: process.env.COMPRESS_OLD_CONTEXTS === 'true',
      cacheSize: parseInt(process.env.CONTEXT_CACHE_SIZE) || 50
    };
        
    // Estadísticas
    this.stats = {
      totalContexts: 0,
      totalMessages: 0,
      cacheHits: 0,
      cacheMisses: 0,
      rotations: 0
    };
  }

  /**
     * Inicializa el gestor de contexto
     */
  async initialize() {
    try {
      await this.ensureDataDirectory();
      await this.loadContextsIndex();
      this.isLoaded = true;
      this.log('ContextManager inicializado correctamente');
      return { success: true, message: 'ContextManager inicializado' };
    } catch (error) {
      this.logError('Error inicializando ContextManager', error);
      throw error;
    }
  }

  /**
     * Ejecuta una operación con mutex para evitar condiciones de carrera
     */
  async executeWithMutex(operation) {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  /**
     * Procesa la cola de operaciones secuencialmente
     */
  async processQueue() {
    if (this.operationMutex || this.operationQueue.length === 0) {
      return;
    }

    this.operationMutex = true;

    while (this.operationQueue.length > 0) {
      const { operation, resolve, reject } = this.operationQueue.shift();
            
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.operationMutex = false;
  }

  /**
     * Asegura que el directorio de datos existe
     */
  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
      this.log(`Directorio de conversaciones creado: ${this.dataDir}`);
    }
  }

  /**
     * Carga el índice de contextos existentes
     */
  async loadContextsIndex() {
    try {
      const files = await fs.readdir(this.dataDir);
      const contextFiles = files.filter(file => file.endsWith('.json') && !file.includes('.backup'));
            
      this.stats.totalContexts = contextFiles.length;
            
      // Cargar estadísticas básicas sin cargar todos los contextos
      for (const file of contextFiles.slice(0, 10)) { // Solo los primeros 10 para estadísticas
        try {
          const filePath = path.join(this.dataDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const context = JSON.parse(data);
          if (context.messages) {
            this.stats.totalMessages += context.messages.length;
          }
        } catch (error) {
          this.logError(`Error cargando contexto ${file}`, error);
        }
      }
            
      this.log(`Índice cargado: ${this.stats.totalContexts} contextos encontrados`);
    } catch (error) {
      this.logError('Error cargando índice de contextos', error);
    }
  }

  /**
     * Normaliza un ID de usuario
     */
  normalizeUserId(userId) {
    if (!userId) return null;
    return String(userId).replace(/[^\w\-+]/g, '_');
  }

  /**
     * Obtiene la ruta del archivo de contexto para un usuario
     */
  getContextFilePath(userId) {
    const normalizedId = this.normalizeUserId(userId);
    return path.join(this.dataDir, `${normalizedId}.json`);
  }

  /**
     * Carga el contexto de un usuario desde archivo
     */
  async loadUserContext(userId) {
    try {
      const filePath = this.getContextFilePath(userId);
      const data = await fs.readFile(filePath, 'utf8');
      const context = JSON.parse(data);
            
      // Validar estructura del contexto
      if (!context.userId || !Array.isArray(context.messages)) {
        throw new Error('Estructura de contexto inválida');
      }
            
      // Agregar al cache
      this.contexts.set(userId, context);
      this.manageCacheSize();
            
      this.stats.cacheMisses++;
      return context;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Crear nuevo contexto
        const newContext = this.createNewContext(userId);
        this.contexts.set(userId, newContext);
        return newContext;
      }
      this.logError(`Error cargando contexto para ${userId}`, error);
      throw error;
    }
  }

  /**
     * Crea un nuevo contexto para un usuario
     */
  createNewContext(userId) {
    return {
      userId: this.normalizeUserId(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      metadata: {
        totalMessages: 0,
        lastRotation: null,
        version: '1.0.0'
      },
      summary: {
        topics: [],
        sentiment: 'neutral',
        lastIntent: null
      }
    };
  }

  /**
     * Obtiene el contexto de un usuario (con cache)
     */
  async getContext(userId, options = {}) {
    try {
      const { includeMetadata = true, recentOnly = false } = options;
            
      if (!userId) {
        throw new Error('ID de usuario requerido');
      }
            
      let context;
            
      // Verificar cache
      if (this.contexts.has(userId)) {
        context = this.contexts.get(userId);
        this.stats.cacheHits++;
      } else {
        context = await this.loadUserContext(userId);
      }
            
      // Filtrar mensajes recientes si se solicita
      let messages = context.messages;
      if (recentOnly) {
        messages = messages.slice(-this.config.recentMessagesCount);
      }
            
      const result = {
        userId: context.userId,
        messages,
        ...(includeMetadata && {
          metadata: context.metadata,
          summary: context.summary,
          createdAt: context.createdAt,
          updatedAt: context.updatedAt
        })
      };
            
      return { success: true, context: result };
    } catch (error) {
      this.logError('Error obteniendo contexto', error);
      throw error;
    }
  }

  /**
     * Anexa un mensaje al contexto de un usuario
     */
  async appendMessage(userId, message) {
    return await this.executeWithMutex(async() => {
      try {
        // Validaciones mejoradas
        if (!userId || !message) {
          throw new Error('ID de usuario y mensaje son requeridos');
        }
                
        if (typeof message.content !== 'string' || message.content.length === 0) {
          throw new Error('El contenido del mensaje debe ser una cadena no vacía');
        }
                
        if (message.content.length > 10000) {
          throw new Error('El mensaje es demasiado largo (máximo 10000 caracteres)');
        }
                
        const normalizedUserId = this.normalizeUserId(userId);
                
        // Obtener o crear contexto
        let context;
        if (this.contexts.has(normalizedUserId)) {
          context = this.contexts.get(normalizedUserId);
          this.stats.cacheHits++;
        } else {
          context = await this.loadUserContext(normalizedUserId);
          this.stats.cacheMisses++;
        }
                
        // Preparar mensaje con validaciones adicionales
        const messageEntry = {
          id: message.messageId || this.generateMessageId(),
          timestamp: new Date().toISOString(),
          type: message.type || 'text',
          content: message.content.trim(),
          role: message.role || 'user', // user, assistant, system
          metadata: {
            ...message.metadata,
            processed: true,
            contentLength: message.content.length,
            processingTime: Date.now()
          }
        };
                
        // Validar rol
        if (!['user', 'assistant', 'system'].includes(messageEntry.role)) {
          messageEntry.role = 'user';
        }
                
        // Agregar mensaje
        context.messages.push(messageEntry);
        context.metadata.totalMessages++;
        context.updatedAt = new Date().toISOString();
                
        // Actualizar estadísticas globales
        this.stats.totalMessages++;
                
        // Actualizar resumen si es necesario
        this.updateContextSummary(context, messageEntry);
                
        // Verificar si necesita rotación
        if (this.shouldRotateContext(context)) {
          await this.rotateContext(normalizedUserId, context);
        }
                
        // Guardar contexto de forma atómica
        await this.saveUserContext(normalizedUserId, context);
                
        // Gestionar tamaño de caché
        this.manageCacheSize();
                
        this.log(`Mensaje anexado para usuario ${normalizedUserId}: ${messageEntry.type} (${messageEntry.content.length} chars)`);
                
        return { 
          success: true, 
          messageId: messageEntry.id,
          totalMessages: context.metadata.totalMessages,
          contextSize: context.messages.length
        };
                
      } catch (error) {
        this.logError(`Error anexando mensaje para usuario ${userId}`, error);
        throw error;
      }
    });
  }

  /**
     * Actualiza el resumen del contexto
     */
  updateContextSummary(context, newMessage) {
    try {
      // Detectar temas básicos
      const content = newMessage.content.toLowerCase();
      const topics = ['saludo', 'despedida', 'consulta', 'problema', 'agradecimiento'];
            
      for (const topic of topics) {
        if (content.includes(topic) && !context.summary.topics.includes(topic)) {
          context.summary.topics.push(topic);
        }
      }
            
      // Mantener solo los últimos 5 temas
      if (context.summary.topics.length > 5) {
        context.summary.topics = context.summary.topics.slice(-5);
      }
            
      // Detectar sentimiento básico
      const positiveWords = ['gracias', 'excelente', 'perfecto', 'bien'];
      const negativeWords = ['problema', 'error', 'mal', 'no funciona'];
            
      if (positiveWords.some(word => content.includes(word))) {
        context.summary.sentiment = 'positive';
      } else if (negativeWords.some(word => content.includes(word))) {
        context.summary.sentiment = 'negative';
      }
            
      // Actualizar última intención
      if (newMessage.metadata?.intent) {
        context.summary.lastIntent = newMessage.metadata.intent;
      }
    } catch (error) {
      this.logError('Error actualizando resumen de contexto', error);
    }
  }

  /**
     * Verifica si el contexto necesita rotación
     */
  shouldRotateContext(context) {
    const messageLimit = context.messages.length >= this.config.maxMessagesPerContext;
        
    let ageLimit = false;
    if (this.config.maxContextAge > 0) {
      const ageInDays = (Date.now() - new Date(context.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      ageLimit = ageInDays >= this.config.maxContextAge;
    }
        
    return this.config.autoRotate && (messageLimit || ageLimit);
  }

  /**
     * Rota el contexto de un usuario
     */
  async rotateContext(userId, context) {
    try {
      // Crear backup del contexto actual
      const backupPath = this.getContextFilePath(userId).replace('.json', `.backup.${Date.now()}.json`);
      await fs.writeFile(backupPath, JSON.stringify(context, null, 2));
            
      // Mantener solo los mensajes más recientes
      const recentMessages = context.messages.slice(-this.config.recentMessagesCount);
            
      // Crear nuevo contexto con mensajes recientes
      const rotatedContext = {
        ...context,
        messages: recentMessages,
        createdAt: new Date().toISOString(),
        metadata: {
          ...context.metadata,
          totalMessages: recentMessages.length,
          lastRotation: new Date().toISOString(),
          rotationCount: (context.metadata.rotationCount || 0) + 1
        }
      };
            
      // Actualizar cache
      this.contexts.set(userId, rotatedContext);
            
      this.stats.rotations++;
      this.log(`Contexto rotado para usuario ${userId}: ${context.messages.length} -> ${recentMessages.length} mensajes`);
            
      return rotatedContext;
    } catch (error) {
      this.logError('Error rotando contexto', error);
      throw error;
    }
  }

  /**
     * Guarda el contexto de un usuario
     */
  async saveUserContext(userId, context) {
    const filePath = this.getContextFilePath(userId);
    const tempPath = `${filePath}.tmp`;
        
    try {
      // Escribir a archivo temporal
      await fs.writeFile(tempPath, JSON.stringify(context, null, 2), 'utf8');
            
      // Mover archivo temporal al definitivo (operación atómica)
      await fs.rename(tempPath, filePath);
            
      this.log(`Contexto guardado para usuario ${userId}`);
    } catch (error) {
      // Limpiar archivo temporal en caso de error
      await fs.unlink(tempPath).catch(() => {});
      this.logError('Error guardando contexto', error);
      throw error;
    }
  }

  /**
     * Limpia el contexto de un usuario
     */
  async clearContext(userId, options = {}) {
    try {
      const { keepRecent = 0, createBackup = true } = options;
            
      if (!userId) {
        throw new Error('ID de usuario requerido');
      }
            
      let context;
      if (this.contexts.has(userId)) {
        context = this.contexts.get(userId);
      } else {
        context = await this.loadUserContext(userId);
      }
            
      // Crear backup si se solicita
      if (createBackup && context.messages.length > 0) {
        const backupPath = this.getContextFilePath(userId).replace('.json', `.cleared.${Date.now()}.json`);
        await fs.writeFile(backupPath, JSON.stringify(context, null, 2));
      }
            
      // Mantener mensajes recientes si se especifica
      const messagesToKeep = keepRecent > 0 ? context.messages.slice(-keepRecent) : [];
            
      // Limpiar contexto
      context.messages = messagesToKeep;
      context.metadata.totalMessages = messagesToKeep.length;
      context.updatedAt = new Date().toISOString();
      context.summary = {
        topics: [],
        sentiment: 'neutral',
        lastIntent: null
      };
            
      // Guardar contexto limpio
      await this.saveUserContext(userId, context);
            
      this.log(`Contexto limpiado para usuario ${userId}: ${keepRecent} mensajes conservados`);
      return { 
        success: true, 
        messagesRemoved: context.metadata.totalMessages - messagesToKeep.length,
        messagesKept: messagesToKeep.length
      };
    } catch (error) {
      this.logError('Error limpiando contexto', error);
      throw error;
    }
  }

  /**
     * Obtiene estadísticas del gestor de contexto
     */
  async getStats() {
    try {
      const files = await fs.readdir(this.dataDir);
      const contextFiles = files.filter(file => file.endsWith('.json') && !file.includes('.backup'));
            
      let totalMessages = 0;
      let totalSize = 0;
      const contextSizes = [];
            
      // Analizar algunos contextos para estadísticas detalladas
      for (const file of contextFiles.slice(0, 20)) {
        try {
          const filePath = path.join(this.dataDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
                    
          const data = await fs.readFile(filePath, 'utf8');
          const context = JSON.parse(data);
          if (context.messages) {
            totalMessages += context.messages.length;
            contextSizes.push(context.messages.length);
          }
        } catch (error) {
          // Ignorar archivos corruptos
        }
      }
            
      const avgMessagesPerContext = contextSizes.length > 0 
        ? Math.round(contextSizes.reduce((a, b) => a + b, 0) / contextSizes.length)
        : 0;
            
      return {
        success: true,
        stats: {
          totalContexts: contextFiles.length,
          totalMessages,
          avgMessagesPerContext,
          totalSizeBytes: totalSize,
          cacheStats: {
            size: this.contexts.size,
            hits: this.stats.cacheHits,
            misses: this.stats.cacheMisses,
            hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0 
              ? Math.round((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100)
              : 0
          },
          rotations: this.stats.rotations,
          config: this.config
        }
      };
    } catch (error) {
      this.logError('Error obteniendo estadísticas', error);
      throw error;
    }
  }

  /**
     * Limpieza automática de contextos antiguos
     */
  async cleanup(options = {}) {
    try {
      const { 
        maxAge = this.config.maxContextAge,
        dryRun = false,
        compressOld = this.config.compressOld
      } = options;
            
      const files = await fs.readdir(this.dataDir);
      const contextFiles = files.filter(file => file.endsWith('.json') && !file.includes('.backup'));
            
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);
            
      const results = {
        analyzed: 0,
        removed: 0,
        compressed: 0,
        errors: []
      };
            
      for (const file of contextFiles) {
        try {
          const filePath = path.join(this.dataDir, file);
          const stats = await fs.stat(filePath);
          results.analyzed++;
                    
          if (stats.mtime < cutoffDate) {
            if (compressOld && !dryRun) {
              // Comprimir archivo (simulado - en producción usaría gzip)
              const compressedPath = filePath.replace('.json', '.compressed.json');
              await fs.rename(filePath, compressedPath);
              results.compressed++;
            } else if (!dryRun) {
              await fs.unlink(filePath);
              results.removed++;
            } else {
              results.removed++; // Conteo para dry run
            }
          }
        } catch (error) {
          results.errors.push({ file, error: error.message });
        }
      }
            
      this.log(`Limpieza ${dryRun ? 'simulada' : 'ejecutada'}: ${results.analyzed} analizados, ${results.removed} eliminados, ${results.compressed} comprimidos`);
            
      return { success: true, results };
    } catch (error) {
      this.logError('Error en limpieza de contextos', error);
      throw error;
    }
  }

  /**
     * Gestiona el tamaño del cache en memoria
     */
  manageCacheSize() {
    if (this.contexts.size > this.config.cacheSize) {
      // Remover el contexto más antiguo (LRU simple)
      const firstKey = this.contexts.keys().next().value;
      this.contexts.delete(firstKey);
    }
  }

  /**
     * Genera un ID único para mensajes
     */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
     * Logging unificado
     */
  log(message) {
    const timestamp = new Date().toISOString();
    logger.info(`[${timestamp}] [ContextManager] ${message}`);
  }

  /**
     * Logging de errores
     */
  logError(message, error) {
    const timestamp = new Date().toISOString();
    this.logger.error(`[${timestamp}] [ContextManager] ERROR: ${message}`, error);
  }

  /**
     * Cierre limpio del gestor
     */
  async shutdown() {
    try {
      // Guardar todos los contextos en cache
      for (const [userId, context] of this.contexts.entries()) {
        await this.saveUserContext(userId, context);
      }
            
      this.contexts.clear();
      this.log('ContextManager cerrado correctamente');
    } catch (error) {
      this.logError('Error cerrando ContextManager', error);
    }
  }
}

// Instancia singleton
const contextManager = new ContextManager();

// Funciones exportadas
export const initialize = () => contextManager.initialize();
export const getContext = (userId, options) => contextManager.getContext(userId, options);
export const appendMessage = (userId, message) => contextManager.appendMessage(userId, message);
export const clearContext = (userId, options) => contextManager.clearContext(userId, options);
export const getStats = () => contextManager.getStats();
export const cleanup = (options) => contextManager.cleanup(options);
export const shutdown = () => contextManager.shutdown();

export default contextManager;
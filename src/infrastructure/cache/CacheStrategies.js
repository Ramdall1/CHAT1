/**
 * Cache Strategies
 * Estrategias especializadas de cache para diferentes tipos de datos
 * Optimizaciones específicas por caso de uso
 */

import distributedCacheManager from './DistributedCacheManager.js';
import logger from '../core/core/logger.js';

/**
 * Estrategia base para cache
 */
class BaseCacheStrategy {
  constructor(cacheType, options = {}) {
    this.cacheType = cacheType;
    this.options = {
      ttl: 3600,
      enableMetrics: true,
      enableWarmup: false,
      ...options
    };
    this.cacheManager = distributedCacheManager;
  }

  async get(key) {
    return await this.cacheManager.get(this.cacheType, key);
  }

  async set(key, value, ttl = null) {
    return await this.cacheManager.set(this.cacheType, key, value, ttl || this.options.ttl);
  }

  async del(key) {
    return await this.cacheManager.del(this.cacheType, key);
  }

  async remember(key, fallbackFn, ttl = null) {
    return await this.cacheManager.remember(this.cacheType, key, fallbackFn, ttl || this.options.ttl);
  }
}

/**
 * Estrategia para cache de sesiones de usuario
 */
class SessionCacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('session', {
      ttl: 86400, // 24 horas
      enableWarmup: false
    });
  }

  /**
   * Obtener sesión de usuario
   */
  async getUserSession(userId) {
    return await this.get(`user:${userId}`);
  }

  /**
   * Establecer sesión de usuario
   */
  async setUserSession(userId, sessionData, customTTL = null) {
    const enrichedData = {
      ...sessionData,
      lastAccess: new Date().toISOString(),
      userId
    };
    
    return await this.set(`user:${userId}`, enrichedData, customTTL);
  }

  /**
   * Actualizar último acceso
   */
  async updateLastAccess(userId) {
    const session = await this.getUserSession(userId);
    if (session) {
      session.lastAccess = new Date().toISOString();
      await this.setUserSession(userId, session);
    }
  }

  /**
   * Invalidar sesión de usuario
   */
  async invalidateUserSession(userId) {
    return await this.del(`user:${userId}`);
  }

  /**
   * Obtener sesiones activas
   */
  async getActiveSessions() {
    // Implementar lógica para obtener sesiones activas
    const pattern = 'user:*';
    return await this.cacheManager.invalidatePattern(this.cacheType, pattern);
  }
}

/**
 * Estrategia para cache de conversaciones
 */
class ConversationCacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('conversation', {
      ttl: 7200, // 2 horas
      enableWarmup: true
    });
  }

  /**
   * Obtener conversación completa
   */
  async getConversation(conversationId) {
    return await this.get(`full:${conversationId}`);
  }

  /**
   * Establecer conversación completa
   */
  async setConversation(conversationId, conversationData) {
    const enrichedData = {
      ...conversationData,
      lastUpdate: new Date().toISOString(),
      messageCount: conversationData.messages?.length || 0
    };

    return await this.set(`full:${conversationId}`, enrichedData);
  }

  /**
   * Cache de mensajes recientes (últimos 50)
   */
  async getRecentMessages(conversationId, limit = 50) {
    return await this.get(`recent:${conversationId}:${limit}`);
  }

  async setRecentMessages(conversationId, messages, limit = 50) {
    const recentMessages = messages.slice(-limit);
    return await this.set(`recent:${conversationId}:${limit}`, recentMessages, 1800); // 30 min
  }

  /**
   * Cache de contexto de conversación
   */
  async getConversationContext(conversationId) {
    return await this.get(`context:${conversationId}`);
  }

  async setConversationContext(conversationId, context) {
    return await this.set(`context:${conversationId}`, context, 3600); // 1 hora
  }

  /**
   * Invalidar toda la conversación
   */
  async invalidateConversation(conversationId) {
    const patterns = [
      `full:${conversationId}`,
      `recent:${conversationId}:*`,
      `context:${conversationId}`
    ];

    const results = await Promise.all(
      patterns.map(pattern => this.cacheManager.invalidatePattern(this.cacheType, pattern))
    );

    return results.every(result => result >= 0);
  }

  /**
   * Precarga de conversaciones activas
   */
  async warmupActiveConversations(conversationIds) {
    if (!this.options.enableWarmup) return;

    logger.info(`Precargando ${conversationIds.length} conversaciones activas`);
    
    const warmupPromises = conversationIds.map(async (id) => {
      try {
        // Simular carga de datos (reemplazar con lógica real)
        const conversationData = await this.loadConversationFromDB(id);
        if (conversationData) {
          await this.setConversation(id, conversationData);
        }
      } catch (error) {
        logger.error(`Error precargando conversación ${id}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
  }

  async loadConversationFromDB(conversationId) {
    // Placeholder - implementar carga desde base de datos
    return null;
  }
}

/**
 * Estrategia para cache de usuarios
 */
class UserCacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('user', {
      ttl: 3600, // 1 hora
      enableWarmup: true
    });
  }

  /**
   * Obtener perfil de usuario
   */
  async getUserProfile(userId) {
    return await this.get(`profile:${userId}`);
  }

  /**
   * Establecer perfil de usuario
   */
  async setUserProfile(userId, profileData) {
    const enrichedData = {
      ...profileData,
      lastUpdate: new Date().toISOString(),
      cacheVersion: '1.0'
    };

    return await this.set(`profile:${userId}`, enrichedData);
  }

  /**
   * Cache de preferencias de usuario
   */
  async getUserPreferences(userId) {
    return await this.get(`prefs:${userId}`);
  }

  async setUserPreferences(userId, preferences) {
    return await this.set(`prefs:${userId}`, preferences, 86400); // 24 horas
  }

  /**
   * Cache de contactos del usuario
   */
  async getUserContacts(userId) {
    return await this.get(`contacts:${userId}`);
  }

  async setUserContacts(userId, contacts) {
    return await this.set(`contacts:${userId}`, contacts, 1800); // 30 minutos
  }

  /**
   * Invalidar todos los datos del usuario
   */
  async invalidateUser(userId) {
    const patterns = [
      `profile:${userId}`,
      `prefs:${userId}`,
      `contacts:${userId}`
    ];

    const results = await Promise.all(
      patterns.map(pattern => this.del(pattern))
    );

    return results.every(result => result);
  }
}

/**
 * Estrategia para cache de templates
 */
class TemplateCacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('template', {
      ttl: 86400, // 24 horas
      enableWarmup: true
    });
  }

  /**
   * Obtener template por ID
   */
  async getTemplate(templateId) {
    return await this.get(`id:${templateId}`);
  }

  /**
   * Establecer template
   */
  async setTemplate(templateId, templateData) {
    const enrichedData = {
      ...templateData,
      lastUpdate: new Date().toISOString(),
      version: templateData.version || '1.0'
    };

    return await this.set(`id:${templateId}`, enrichedData);
  }

  /**
   * Cache de templates por categoría
   */
  async getTemplatesByCategory(category) {
    return await this.get(`category:${category}`);
  }

  async setTemplatesByCategory(category, templates) {
    return await this.set(`category:${category}`, templates);
  }

  /**
   * Cache de templates populares
   */
  async getPopularTemplates(limit = 10) {
    return await this.get(`popular:${limit}`);
  }

  async setPopularTemplates(templates, limit = 10) {
    return await this.set(`popular:${limit}`, templates, 3600); // 1 hora
  }

  /**
   * Precarga de templates esenciales
   */
  async warmupEssentialTemplates() {
    if (!this.options.enableWarmup) return;

    logger.info('Precargando templates esenciales');
    
    try {
      // Cargar templates más utilizados
      const essentialTemplates = await this.loadEssentialTemplatesFromDB();
      
      const warmupPromises = essentialTemplates.map(async (template) => {
        await this.setTemplate(template.id, template);
      });

      await Promise.allSettled(warmupPromises);
      logger.info(`${essentialTemplates.length} templates esenciales precargados`);

    } catch (error) {
      logger.error('Error precargando templates esenciales:', error);
    }
  }

  async loadEssentialTemplatesFromDB() {
    // Placeholder - implementar carga desde base de datos
    return [];
  }
}

/**
 * Estrategia para cache de API responses
 */
class APICacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('api', {
      ttl: 300, // 5 minutos
      enableWarmup: false
    });
  }

  /**
   * Cache de respuesta de API con headers
   */
  async cacheAPIResponse(endpoint, params, response, headers = {}) {
    const cacheKey = this.generateAPIKey(endpoint, params);
    const cacheData = {
      response,
      headers,
      timestamp: new Date().toISOString(),
      endpoint,
      params
    };

    return await this.set(cacheKey, cacheData);
  }

  /**
   * Obtener respuesta de API cacheada
   */
  async getCachedAPIResponse(endpoint, params) {
    const cacheKey = this.generateAPIKey(endpoint, params);
    return await this.get(cacheKey);
  }

  /**
   * Generar clave de cache para API
   */
  generateAPIKey(endpoint, params) {
    const sortedParams = Object.keys(params || {})
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});

    const paramString = JSON.stringify(sortedParams);
    const hash = Buffer.from(paramString).toString('base64').slice(0, 16);
    
    return `${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}:${hash}`;
  }

  /**
   * Invalidar cache de endpoint específico
   */
  async invalidateEndpoint(endpoint) {
    const pattern = `${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}:*`;
    return await this.cacheManager.invalidatePattern(this.cacheType, pattern);
  }
}

/**
 * Estrategia para cache de analytics
 */
class AnalyticsCacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('analytics', {
      ttl: 3600, // 1 hora
      enableWarmup: false
    });
  }

  /**
   * Cache de métricas diarias
   */
  async getDailyMetrics(date) {
    return await this.get(`daily:${date}`);
  }

  async setDailyMetrics(date, metrics) {
    return await this.set(`daily:${date}`, metrics, 86400); // 24 horas
  }

  /**
   * Cache de métricas en tiempo real
   */
  async getRealTimeMetrics() {
    return await this.get('realtime');
  }

  async setRealTimeMetrics(metrics) {
    return await this.set('realtime', metrics, 60); // 1 minuto
  }

  /**
   * Cache de reportes agregados
   */
  async getAggregatedReport(reportType, period) {
    return await this.get(`report:${reportType}:${period}`);
  }

  async setAggregatedReport(reportType, period, report) {
    const ttl = this.getReportTTL(period);
    return await this.set(`report:${reportType}:${period}`, report, ttl);
  }

  /**
   * Determinar TTL basado en el período del reporte
   */
  getReportTTL(period) {
    const ttlMap = {
      'hourly': 300,    // 5 minutos
      'daily': 1800,    // 30 minutos
      'weekly': 3600,   // 1 hora
      'monthly': 7200   // 2 horas
    };

    return ttlMap[period] || 3600;
  }
}

/**
 * Factory para crear estrategias de cache
 */
class CacheStrategyFactory {
  static strategies = {
    session: SessionCacheStrategy,
    conversation: ConversationCacheStrategy,
    user: UserCacheStrategy,
    template: TemplateCacheStrategy,
    api: APICacheStrategy,
    analytics: AnalyticsCacheStrategy
  };

  static create(strategyType) {
    const StrategyClass = this.strategies[strategyType];
    
    if (!StrategyClass) {
      throw new Error(`Estrategia de cache '${strategyType}' no encontrada`);
    }

    return new StrategyClass();
  }

  static getAvailableStrategies() {
    return Object.keys(this.strategies);
  }
}

// Instancias pre-creadas para uso común
export const sessionCache = new SessionCacheStrategy();
export const conversationCache = new ConversationCacheStrategy();
export const userCache = new UserCacheStrategy();
export const templateCache = new TemplateCacheStrategy();
export const apiCache = new APICacheStrategy();
export const analyticsCache = new AnalyticsCacheStrategy();

export {
  BaseCacheStrategy,
  SessionCacheStrategy,
  ConversationCacheStrategy,
  UserCacheStrategy,
  TemplateCacheStrategy,
  APICacheStrategy,
  AnalyticsCacheStrategy,
  CacheStrategyFactory
};

export default CacheStrategyFactory;
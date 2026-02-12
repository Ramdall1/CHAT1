import { EventEmitter } from 'events';
import { createLogger } from '../core/logger.js';

/**
 * Gestor principal de notificaciones
 * Coordina el envío de notificaciones a través de múltiples canales
 */
class NotificationManager extends EventEmitter {
  constructor(config = {}) {
    super();
        
    this.config = {
      // Configuración general
      enabled: true,
      defaultChannel: 'email',
      fallbackChannel: 'console',
      maxRetries: 3,
      retryDelay: 5000,
            
      // Configuración de canales
      channels: {
        email: {
          enabled: true,
          provider: 'smtp',
          priority: 1,
          rateLimit: 100, // por minuto
          config: {
            host: 'localhost',
            port: 587,
            secure: false,
            auth: {
              user: '',
              pass: ''
            }
          }
        },
        sms: {
          enabled: false,
          provider: 'disabled', // Twilio removido del proyecto
          priority: 2,
          rateLimit: 50,
          config: {
            // Configuración SMS deshabilitada - Twilio removido
          }
        },
        push: {
          enabled: false,
          provider: 'fcm',
          priority: 3,
          rateLimit: 200,
          config: {
            serverKey: '',
            projectId: ''
          }
        },
        webhook: {
          enabled: true,
          provider: 'http',
          priority: 4,
          rateLimit: 500,
          config: {
            timeout: 10000,
            retries: 3
          }
        },
        slack: {
          enabled: false,
          provider: 'slack',
          priority: 5,
          rateLimit: 100,
          config: {
            token: '',
            defaultChannel: '#general'
          }
        },
        discord: {
          enabled: false,
          provider: 'discord',
          priority: 6,
          rateLimit: 100,
          config: {
            token: '',
            defaultChannel: ''
          }
        },
        console: {
          enabled: true,
          provider: 'console',
          priority: 10,
          rateLimit: 1000,
          config: {
            level: 'info',
            colors: true
          }
        }
      },
            
      // Configuración de plantillas
      templates: {
        enabled: true,
        engine: 'handlebars',
        directory: './templates',
        cache: true,
        defaultLocale: 'es',
        fallbackLocale: 'en'
      },
            
      // Configuración de programación
      scheduling: {
        enabled: true,
        timezone: 'America/Mexico_City',
        batchSize: 100,
        batchDelay: 1000
      },
            
      // Configuración de colas
      queue: {
        enabled: true,
        type: 'memory', // memory, redis, database
        maxSize: 10000,
        priority: true,
        persistence: false,
        workers: 3
      },
            
      // Configuración de filtros
      filters: {
        enabled: true,
        duplicates: {
          enabled: true,
          window: 300000, // 5 minutos
          key: ['recipient', 'type', 'subject']
        },
        rateLimit: {
          enabled: true,
          window: 60000, // 1 minuto
          maxPerRecipient: 10,
          maxPerChannel: 100
        },
        blacklist: {
          enabled: true,
          recipients: [],
          domains: [],
          patterns: []
        }
      },
            
      // Configuración de tracking
      tracking: {
        enabled: true,
        delivery: true,
        opens: true,
        clicks: true,
        bounces: true,
        complaints: true,
        unsubscribes: true
      },
            
      // Configuración de analytics
      analytics: {
        enabled: true,
        retention: 30, // días
        aggregation: ['hourly', 'daily', 'weekly'],
        metrics: ['sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed']
      },
            
      ...config
    };
        
    this.state = 'initialized';
        
    // Proveedores de canales
    this.providers = new Map();
        
    // Motor de plantillas
    this.templateEngine = null;
        
    // Cache de plantillas
    this.templateCache = new Map();
        
    // Cola de notificaciones
    this.notificationQueue = [];
        
    // Workers de procesamiento
    this.workers = [];
        
    // Filtros de notificaciones
    this.filters = new Map();
        
    // Historial de notificaciones enviadas
    this.notificationHistory = new Map();
        
    // Estadísticas del gestor
    this.managerStats = {
      startTime: Date.now(),
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      byChannel: new Map(),
      byType: new Map(),
      averageDeliveryTime: 0,
      errors: 0,
      lastNotification: null
    };
        
    // Rate limiters por canal
    this.rateLimiters = new Map();
        
    // Timers de programación
    this.scheduledTimers = new Map();
        
    // Logger
    this.logger = createLogger('NOTIFICATION_MANAGER');
  }
    
  /**
     * Inicializa el gestor de notificaciones
     */
  async initialize() {
    try {
      this._validateConfig();
      this._setupEventHandlers();
            
      // Inicializar proveedores de canales
      await this._initializeProviders();
            
      // Inicializar motor de plantillas
      if (this.config.templates.enabled) {
        await this._initializeTemplateEngine();
      }
            
      // Inicializar filtros
      this._initializeFilters();
            
      // Inicializar rate limiters
      this._initializeRateLimiters();
            
      // Inicializar workers de cola
      if (this.config.queue.enabled) {
        this._initializeWorkers();
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
     * Envía una notificación
     */
  async send(notification) {
    const startTime = Date.now();
        
    try {
      // Validar notificación
      this._validateNotification(notification);
            
      // Aplicar filtros
      const filtered = await this._applyFilters(notification);
      if (!filtered.allowed) {
        this.emit('notificationFiltered', {
          notification,
          reason: filtered.reason
        });
        return { success: false, reason: filtered.reason };
      }
            
      // Procesar plantilla si es necesario
      const processedNotification = await this._processTemplate(notification);
            
      // Determinar canales de envío
      const channels = this._determineChannels(processedNotification);
            
      // Enviar por cada canal
      const results = [];
            
      for (const channel of channels) {
        try {
          const result = await this._sendToChannel(processedNotification, channel);
          results.push({ channel, ...result });
                    
          if (result.success) {
            break; // Éxito en el primer canal, no intentar otros
          }
        } catch (error) {
          results.push({
            channel,
            success: false,
            error: error.message
          });
        }
      }
            
      // Actualizar estadísticas
      const deliveryTime = Date.now() - startTime;
      this._updateStats(processedNotification, results, deliveryTime);
            
      // Guardar en historial
      this._saveToHistory(processedNotification, results);
            
      const success = results.some(r => r.success);
            
      this.emit('notificationSent', {
        notification: processedNotification,
        results,
        success,
        deliveryTime
      });
            
      return {
        success,
        results,
        deliveryTime,
        id: processedNotification.id
      };
            
    } catch (error) {
      this.managerStats.errors++;
      this.emit('error', error);
      throw error;
    }
  }
    
  /**
     * Envía múltiples notificaciones
     */
  async sendBatch(notifications) {
    const results = [];
        
    for (const notification of notifications) {
      try {
        const result = await this.send(notification);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          notification
        });
      }
    }
        
    this.emit('batchSent', { notifications, results });
        
    return results;
  }
    
  /**
     * Programa una notificación para envío futuro
     */
  scheduleNotification(notification, schedule) {
    if (!this.config.scheduling.enabled) {
      throw new Error('Scheduling not enabled');
    }
        
    const scheduleId = `schedule_${Date.now()}_${Math.random()}`;
        
    let delay;
        
    if (typeof schedule === 'number') {
      // Timestamp absoluto
      delay = schedule - Date.now();
    } else if (schedule instanceof Date) {
      // Objeto Date
      delay = schedule.getTime() - Date.now();
    } else if (typeof schedule === 'string') {
      // Expresión cron o delay relativo
      delay = this._parseCronOrDelay(schedule);
    } else {
      throw new Error('Invalid schedule format');
    }
        
    if (delay <= 0) {
      throw new Error('Schedule time must be in the future');
    }
        
    const timer = setTimeout(async() => {
      try {
        await this.send(notification);
        this.scheduledTimers.delete(scheduleId);
      } catch (error) {
        this.emit('scheduledNotificationError', { scheduleId, error });
      }
    }, delay);
        
    this.scheduledTimers.set(scheduleId, {
      timer,
      notification,
      schedule,
      scheduledAt: Date.now(),
      executeAt: Date.now() + delay
    });
        
    this.emit('notificationScheduled', {
      scheduleId,
      notification,
      executeAt: Date.now() + delay
    });
        
    return scheduleId;
  }
    
  /**
     * Cancela una notificación programada
     */
  cancelScheduledNotification(scheduleId) {
    const scheduled = this.scheduledTimers.get(scheduleId);
        
    if (scheduled) {
      clearTimeout(scheduled.timer);
      this.scheduledTimers.delete(scheduleId);
            
      this.emit('notificationCancelled', { scheduleId });
      return true;
    }
        
    return false;
  }
    
  /**
     * Agrega una notificación a la cola
     */
  async queueNotification(notification, priority = 'normal') {
    if (!this.config.queue.enabled) {
      return this.send(notification);
    }
        
    const queueItem = {
      id: `queue_${Date.now()}_${Math.random()}`,
      notification,
      priority: this._getPriorityValue(priority),
      queuedAt: Date.now(),
      attempts: 0,
      maxAttempts: this.config.maxRetries
    };
        
    // Insertar en la cola manteniendo orden de prioridad
    this._insertIntoQueue(queueItem);
        
    this.emit('notificationQueued', queueItem);
        
    return { queued: true, id: queueItem.id };
  }
    
  /**
     * Procesa la cola de notificaciones
     */
  async processQueue() {
    if (!this.config.queue.enabled || this.notificationQueue.length === 0) {
      return;
    }
        
    const batchSize = this.config.scheduling.batchSize;
    const batch = this.notificationQueue.splice(0, batchSize);
        
    for (const item of batch) {
      try {
        const result = await this.send(item.notification);
                
        this.emit('queueItemProcessed', {
          item,
          result,
          success: result.success
        });
                
      } catch (error) {
        item.attempts++;
                
        if (item.attempts < item.maxAttempts) {
          // Reintroducir en la cola para reintento
          this._insertIntoQueue(item);
        } else {
          this.emit('queueItemFailed', { item, error });
        }
      }
    }
        
    // Programar siguiente procesamiento si hay más elementos
    if (this.notificationQueue.length > 0) {
      setTimeout(() => this.processQueue(), this.config.scheduling.batchDelay);
    }
  }
    
  /**
     * Registra un proveedor de canal personalizado
     */
  registerProvider(channelName, provider) {
    this.providers.set(channelName, provider);
        
    this.emit('providerRegistered', { channelName, provider });
  }
    
  /**
     * Registra una plantilla
     */
  registerTemplate(name, template, locale = 'es') {
    const key = `${name}_${locale}`;
        
    if (this.config.templates.cache) {
      this.templateCache.set(key, template);
    }
        
    this.emit('templateRegistered', { name, locale });
  }
    
  /**
     * Obtiene estadísticas del gestor
     */
  getStatistics() {
    return {
      manager: this.managerStats,
      queue: {
        size: this.notificationQueue.length,
        processing: this.workers.filter(w => w.busy).length,
        workers: this.workers.length
      },
      channels: this._getChannelStatistics(),
      scheduled: {
        count: this.scheduledTimers.size,
        upcoming: Array.from(this.scheduledTimers.values())
          .map(s => ({
            id: s.scheduleId,
            executeAt: s.executeAt,
            type: s.notification.type
          }))
          .sort((a, b) => a.executeAt - b.executeAt)
          .slice(0, 10)
      },
      performance: {
        uptime: Date.now() - this.managerStats.startTime,
        state: this.state,
        errors: this.managerStats.errors,
        successRate: this._calculateSuccessRate()
      }
    };
  }
    
  /**
     * Obtiene el historial de notificaciones
     */
  getNotificationHistory(filters = {}) {
    let history = Array.from(this.notificationHistory.values());
        
    // Aplicar filtros
    if (filters.channel) {
      history = history.filter(h => 
        h.results.some(r => r.channel === filters.channel)
      );
    }
        
    if (filters.type) {
      history = history.filter(h => h.notification.type === filters.type);
    }
        
    if (filters.success !== undefined) {
      history = history.filter(h => h.success === filters.success);
    }
        
    if (filters.since) {
      const since = new Date(filters.since).getTime();
      history = history.filter(h => h.sentAt >= since);
    }
        
    // Ordenar por fecha (más recientes primero)
    history.sort((a, b) => b.sentAt - a.sentAt);
        
    // Limitar resultados
    const limit = filters.limit || 100;
    return history.slice(0, limit);
  }
    
  /**
     * Obtiene métricas de analytics
     */
  getAnalytics(timeRange = '24h') {
    const cutoff = this._parseTimeRange(timeRange);
    const history = Array.from(this.notificationHistory.values())
      .filter(h => h.sentAt >= cutoff);
        
    return {
      summary: {
        total: history.length,
        successful: history.filter(h => h.success).length,
        failed: history.filter(h => !h.success).length,
        successRate: history.length > 0 ? 
          (history.filter(h => h.success).length / history.length) * 100 : 0
      },
      byChannel: this._aggregateByChannel(history),
      byType: this._aggregateByType(history),
      byHour: this._aggregateByHour(history),
      averageDeliveryTime: this._calculateAverageDeliveryTime(history),
      topErrors: this._getTopErrors(history)
    };
  }
    
  /**
     * Destruye el gestor de notificaciones
     */
  destroy() {
    // Cancelar todas las notificaciones programadas
    for (const scheduled of this.scheduledTimers.values()) {
      clearTimeout(scheduled.timer);
    }
    this.scheduledTimers.clear();
        
    // Detener workers
    this.workers.forEach(worker => {
      if (worker.timer) {
        clearInterval(worker.timer);
      }
    });
    this.workers = [];
        
    // Limpiar caches
    this.templateCache.clear();
    this.notificationHistory.clear();
    this.providers.clear();
        
    // Limpiar cola
    this.notificationQueue = [];
        
    this.state = 'destroyed';
    this.emit('destroyed');
  }
    
  // Métodos privados
    
  async _initializeProviders() {
    for (const [channelName, channelConfig] of Object.entries(this.config.channels)) {
      if (channelConfig.enabled) {
        const provider = await this._createProvider(channelName, channelConfig);
        this.providers.set(channelName, provider);
      }
    }
  }
    
  async _createProvider(channelName, config) {
    // Factory para crear proveedores según el tipo
    switch (config.provider) {
    case 'smtp':
      return this._createSMTPProvider(config);
    // case 'twilio': // Deshabilitado - Twilio removido del proyecto
    //   return this._createTwilioProvider(config);
    case 'fcm':
      return this._createFCMProvider(config);
    case 'http':
      return this._createHTTPProvider(config);
    case 'slack':
      return this._createSlackProvider(config);
    case 'discord':
      return this._createDiscordProvider(config);
    case 'console':
      return this._createConsoleProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
    
  _createSMTPProvider(config) {
    return {
      type: 'smtp',
      config,
      async send(notification) {
        // Implementación simplificada de SMTP
        logger.info(`[SMTP] Sending email to ${notification.recipient}`);
        logger.info(`Subject: ${notification.subject}`);
        logger.info(`Body: ${notification.content}`);
                
        return {
          success: true,
          messageId: `smtp_${Date.now()}`,
          provider: 'smtp'
        };
      }
    };
  }
    
  _createTwilioProvider(config) {
    return {
      type: 'sms',
      config,
      async send(notification) {
        throw new Error('Funcionalidad SMS deshabilitada - Twilio removido del proyecto');
      }
    };
  }
    
  _createFCMProvider(config) {
    return {
      type: 'push',
      config,
      async send(notification) {
        logger.info(`[PUSH] Sending to ${notification.recipient}: ${notification.title}`);
                
        return {
          success: true,
          messageId: `push_${Date.now()}`,
          provider: 'fcm'
        };
      }
    };
  }
    
  _createHTTPProvider(config) {
    return {
      type: 'webhook',
      config,
      async send(notification) {
        logger.info(`[WEBHOOK] Sending to ${notification.webhook}: ${notification.content}`);
                
        return {
          success: true,
          messageId: `webhook_${Date.now()}`,
          provider: 'http'
        };
      }
    };
  }
    
  _createSlackProvider(config) {
    return {
      type: 'slack',
      config,
      async send(notification) {
        logger.info(`[SLACK] Sending to ${notification.channel}: ${notification.content}`);
                
        return {
          success: true,
          messageId: `slack_${Date.now()}`,
          provider: 'slack'
        };
      }
    };
  }
    
  _createDiscordProvider(config) {
    return {
      type: 'discord',
      config,
      async send(notification) {
        logger.info(`[DISCORD] Sending to ${notification.channel}: ${notification.content}`);
                
        return {
          success: true,
          messageId: `discord_${Date.now()}`,
          provider: 'discord'
        };
      }
    };
  }
    
  _createConsoleProvider(config) {
    return {
      type: 'console',
      config,
      async send(notification) {
        const timestamp = new Date().toISOString();
        const level = config.config.level || 'info';
                
        logger.info(`[${timestamp}] [${level.toUpperCase()}] ${notification.type}: ${notification.content}`);
                
        return {
          success: true,
          messageId: `console_${Date.now()}`,
          provider: 'console'
        };
      }
    };
  }
    
  async _initializeTemplateEngine() {
    // Implementación simplificada del motor de plantillas
    this.templateEngine = {
      compile: (template) => {
        return (data) => {
          let result = template;
                    
          // Reemplazar variables simples {{variable}}
          result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] || match;
          });
                    
          return result;
        };
      }
    };
  }
    
  _initializeFilters() {
    // Filtro de duplicados
    if (this.config.filters.duplicates.enabled) {
      this.filters.set('duplicates', this._createDuplicateFilter());
    }
        
    // Filtro de rate limiting
    if (this.config.filters.rateLimit.enabled) {
      this.filters.set('rateLimit', this._createRateLimitFilter());
    }
        
    // Filtro de blacklist
    if (this.config.filters.blacklist.enabled) {
      this.filters.set('blacklist', this._createBlacklistFilter());
    }
  }
    
  _createDuplicateFilter() {
    const recentNotifications = new Map();
        
    return {
      name: 'duplicates',
      check: (notification) => {
        const config = this.config.filters.duplicates;
        const key = config.key.map(k => notification[k]).join('|');
        const now = Date.now();
                
        const recent = recentNotifications.get(key);
        if (recent && (now - recent) < config.window) {
          return { allowed: false, reason: 'Duplicate notification' };
        }
                
        recentNotifications.set(key, now);
                
        // Limpiar entradas antiguas
        for (const [k, timestamp] of recentNotifications.entries()) {
          if ((now - timestamp) > config.window) {
            recentNotifications.delete(k);
          }
        }
                
        return { allowed: true };
      }
    };
  }
    
  _createRateLimitFilter() {
    const recipientCounts = new Map();
    const channelCounts = new Map();
        
    return {
      name: 'rateLimit',
      check: (notification) => {
        const config = this.config.filters.rateLimit;
        const now = Date.now();
        const windowStart = now - config.window;
                
        // Verificar límite por destinatario
        const recipientKey = notification.recipient;
        const recipientHistory = recipientCounts.get(recipientKey) || [];
        const recentRecipient = recipientHistory.filter(t => t > windowStart);
                
        if (recentRecipient.length >= config.maxPerRecipient) {
          return { allowed: false, reason: 'Recipient rate limit exceeded' };
        }
                
        // Verificar límite por canal
        const channelKey = notification.channel || this.config.defaultChannel;
        const channelHistory = channelCounts.get(channelKey) || [];
        const recentChannel = channelHistory.filter(t => t > windowStart);
                
        if (recentChannel.length >= config.maxPerChannel) {
          return { allowed: false, reason: 'Channel rate limit exceeded' };
        }
                
        // Actualizar contadores
        recentRecipient.push(now);
        recipientCounts.set(recipientKey, recentRecipient);
                
        recentChannel.push(now);
        channelCounts.set(channelKey, recentChannel);
                
        return { allowed: true };
      }
    };
  }
    
  _createBlacklistFilter() {
    return {
      name: 'blacklist',
      check: (notification) => {
        const config = this.config.filters.blacklist;
        const recipient = notification.recipient;
                
        // Verificar lista de destinatarios bloqueados
        if (config.recipients.includes(recipient)) {
          return { allowed: false, reason: 'Recipient blacklisted' };
        }
                
        // Verificar dominios bloqueados
        if (recipient.includes('@')) {
          const domain = recipient.split('@')[1];
          if (config.domains.includes(domain)) {
            return { allowed: false, reason: 'Domain blacklisted' };
          }
        }
                
        // Verificar patrones bloqueados
        for (const pattern of config.patterns) {
          const regex = new RegExp(pattern);
          if (regex.test(recipient)) {
            return { allowed: false, reason: 'Pattern blacklisted' };
          }
        }
                
        return { allowed: true };
      }
    };
  }
    
  _initializeRateLimiters() {
    for (const [channelName, channelConfig] of Object.entries(this.config.channels)) {
      if (channelConfig.enabled && channelConfig.rateLimit) {
        this.rateLimiters.set(channelName, {
          limit: channelConfig.rateLimit,
          window: 60000, // 1 minuto
          requests: []
        });
      }
    }
  }
    
  _initializeWorkers() {
    const workerCount = this.config.queue.workers;
        
    for (let i = 0; i < workerCount; i++) {
      const worker = {
        id: i,
        busy: false,
        timer: setInterval(() => {
          if (!worker.busy) {
            this.processQueue();
          }
        }, this.config.scheduling.batchDelay)
      };
            
      this.workers.push(worker);
    }
  }
    
  _validateNotification(notification) {
    if (!notification) {
      throw new Error('Notification is required');
    }
        
    if (!notification.recipient) {
      throw new Error('Notification recipient is required');
    }
        
    if (!notification.content && !notification.template) {
      throw new Error('Notification content or template is required');
    }
        
    // Asignar ID único si no existe
    if (!notification.id) {
      notification.id = `notif_${Date.now()}_${Math.random()}`;
    }
        
    // Asignar timestamp si no existe
    if (!notification.timestamp) {
      notification.timestamp = Date.now();
    }
  }
    
  async _applyFilters(notification) {
    for (const filter of this.filters.values()) {
      const result = filter.check(notification);
      if (!result.allowed) {
        return result;
      }
    }
        
    return { allowed: true };
  }
    
  async _processTemplate(notification) {
    if (!notification.template || !this.templateEngine) {
      return notification;
    }
        
    const locale = notification.locale || this.config.templates.defaultLocale;
    const templateKey = `${notification.template}_${locale}`;
        
    let template = this.templateCache.get(templateKey);
        
    if (!template) {
      // Cargar template desde archivo o usar fallback
      template = await this._loadTemplate(notification.template, locale);
            
      if (this.config.templates.cache) {
        this.templateCache.set(templateKey, template);
      }
    }
        
    if (template) {
      const compiled = this.templateEngine.compile(template);
      const rendered = compiled(notification.data || {});
            
      return {
        ...notification,
        content: rendered,
        processedTemplate: true
      };
    }
        
    return notification;
  }
    
  async _loadTemplate(templateName, locale) {
    // Implementación simplificada de carga de plantillas
    const templates = {
      'welcome_es': 'Bienvenido {{name}} a nuestra plataforma!',
      'welcome_en': 'Welcome {{name}} to our platform!',
      'alert_es': 'Alerta: {{message}}',
      'alert_en': 'Alert: {{message}}'
    };
        
    return templates[`${templateName}_${locale}`] || templates[`${templateName}_${this.config.templates.fallbackLocale}`];
  }
    
  _determineChannels(notification) {
    if (notification.channels) {
      return notification.channels;
    }
        
    if (notification.channel) {
      return [notification.channel];
    }
        
    // Usar canal por defecto y fallback
    const channels = [this.config.defaultChannel];
        
    if (this.config.fallbackChannel && this.config.fallbackChannel !== this.config.defaultChannel) {
      channels.push(this.config.fallbackChannel);
    }
        
    return channels.filter(channel => 
      this.config.channels[channel] && 
            this.config.channels[channel].enabled &&
            this.providers.has(channel)
    );
  }
    
  async _sendToChannel(notification, channelName) {
    const provider = this.providers.get(channelName);
        
    if (!provider) {
      throw new Error(`Provider not found for channel: ${channelName}`);
    }
        
    // Verificar rate limit
    if (!this._checkRateLimit(channelName)) {
      throw new Error(`Rate limit exceeded for channel: ${channelName}`);
    }
        
    // Enviar notificación
    const result = await provider.send(notification);
        
    // Actualizar rate limiter
    this._updateRateLimit(channelName);
        
    return result;
  }
    
  _checkRateLimit(channelName) {
    const limiter = this.rateLimiters.get(channelName);
        
    if (!limiter) {
      return true;
    }
        
    const now = Date.now();
    const windowStart = now - limiter.window;
        
    // Limpiar requests antiguos
    limiter.requests = limiter.requests.filter(t => t > windowStart);
        
    return limiter.requests.length < limiter.limit;
  }
    
  _updateRateLimit(channelName) {
    const limiter = this.rateLimiters.get(channelName);
        
    if (limiter) {
      limiter.requests.push(Date.now());
    }
  }
    
  _updateStats(notification, results, deliveryTime) {
    this.managerStats.totalSent++;
    this.managerStats.lastNotification = Date.now();
        
    // Actualizar promedio de tiempo de entrega
    this.managerStats.averageDeliveryTime = 
            (this.managerStats.averageDeliveryTime + deliveryTime) / 2;
        
    const success = results.some(r => r.success);
        
    if (success) {
      this.managerStats.totalDelivered++;
    } else {
      this.managerStats.totalFailed++;
    }
        
    // Actualizar estadísticas por canal
    for (const result of results) {
      const channelStats = this.managerStats.byChannel.get(result.channel) || {
        sent: 0,
        delivered: 0,
        failed: 0
      };
            
      channelStats.sent++;
            
      if (result.success) {
        channelStats.delivered++;
      } else {
        channelStats.failed++;
      }
            
      this.managerStats.byChannel.set(result.channel, channelStats);
    }
        
    // Actualizar estadísticas por tipo
    const type = notification.type || 'unknown';
    const typeStats = this.managerStats.byType.get(type) || {
      sent: 0,
      delivered: 0,
      failed: 0
    };
        
    typeStats.sent++;
        
    if (success) {
      typeStats.delivered++;
    } else {
      typeStats.failed++;
    }
        
    this.managerStats.byType.set(type, typeStats);
  }
    
  _saveToHistory(notification, results) {
    const historyEntry = {
      id: notification.id,
      notification,
      results,
      success: results.some(r => r.success),
      sentAt: Date.now()
    };
        
    this.notificationHistory.set(notification.id, historyEntry);
        
    // Limpiar historial antiguo si es necesario
    if (this.notificationHistory.size > 10000) {
      const entries = Array.from(this.notificationHistory.entries());
      entries.sort((a, b) => a[1].sentAt - b[1].sentAt);
            
      // Eliminar las 1000 entradas más antiguas
      for (let i = 0; i < 1000; i++) {
        this.notificationHistory.delete(entries[i][0]);
      }
    }
  }
    
  _getPriorityValue(priority) {
    const priorities = {
      'low': 1,
      'normal': 2,
      'high': 3,
      'urgent': 4,
      'critical': 5
    };
        
    return priorities[priority] || 2;
  }
    
  _insertIntoQueue(item) {
    // Insertar manteniendo orden de prioridad
    let inserted = false;
        
    for (let i = 0; i < this.notificationQueue.length; i++) {
      if (item.priority > this.notificationQueue[i].priority) {
        this.notificationQueue.splice(i, 0, item);
        inserted = true;
        break;
      }
    }
        
    if (!inserted) {
      this.notificationQueue.push(item);
    }
        
    // Verificar límite de cola
    if (this.notificationQueue.length > this.config.queue.maxSize) {
      const removed = this.notificationQueue.shift();
      this.emit('queueOverflow', { removed });
    }
  }
    
  _parseCronOrDelay(schedule) {
    // Implementación simplificada
    if (schedule.endsWith('s')) {
      return parseInt(schedule) * 1000;
    } else if (schedule.endsWith('m')) {
      return parseInt(schedule) * 60 * 1000;
    } else if (schedule.endsWith('h')) {
      return parseInt(schedule) * 60 * 60 * 1000;
    }
        
    return 60000; // Default: 1 minuto
  }
    
  _getChannelStatistics() {
    const stats = {};
        
    for (const [channel, channelStats] of this.managerStats.byChannel.entries()) {
      stats[channel] = {
        ...channelStats,
        successRate: channelStats.sent > 0 ? 
          (channelStats.delivered / channelStats.sent) * 100 : 0
      };
    }
        
    return stats;
  }
    
  _calculateSuccessRate() {
    const total = this.managerStats.totalSent;
    return total > 0 ? (this.managerStats.totalDelivered / total) * 100 : 0;
  }
    
  _parseTimeRange(timeRange) {
    const units = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
        
    const match = timeRange.match(/^(\d+)([smhd])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      return Date.now() - (value * units[unit]);
    }
        
    return Date.now() - (24 * 60 * 60 * 1000); // Default: 24 horas
  }
    
  _aggregateByChannel(history) {
    const aggregated = {};
        
    for (const entry of history) {
      for (const result of entry.results) {
        if (!aggregated[result.channel]) {
          aggregated[result.channel] = { sent: 0, delivered: 0, failed: 0 };
        }
                
        aggregated[result.channel].sent++;
                
        if (result.success) {
          aggregated[result.channel].delivered++;
        } else {
          aggregated[result.channel].failed++;
        }
      }
    }
        
    return aggregated;
  }
    
  _aggregateByType(history) {
    const aggregated = {};
        
    for (const entry of history) {
      const type = entry.notification.type || 'unknown';
            
      if (!aggregated[type]) {
        aggregated[type] = { sent: 0, delivered: 0, failed: 0 };
      }
            
      aggregated[type].sent++;
            
      if (entry.success) {
        aggregated[type].delivered++;
      } else {
        aggregated[type].failed++;
      }
    }
        
    return aggregated;
  }
    
  _aggregateByHour(history) {
    const aggregated = {};
        
    for (const entry of history) {
      const hour = new Date(entry.sentAt).getHours();
            
      if (!aggregated[hour]) {
        aggregated[hour] = { sent: 0, delivered: 0, failed: 0 };
      }
            
      aggregated[hour].sent++;
            
      if (entry.success) {
        aggregated[hour].delivered++;
      } else {
        aggregated[hour].failed++;
      }
    }
        
    return aggregated;
  }
    
  _calculateAverageDeliveryTime(history) {
    if (history.length === 0) return 0;
        
    const totalTime = history.reduce((sum, entry) => {
      return sum + (entry.deliveryTime || 0);
    }, 0);
        
    return totalTime / history.length;
  }
    
  _getTopErrors(history) {
    const errors = {};
        
    for (const entry of history) {
      if (!entry.success) {
        for (const result of entry.results) {
          if (result.error) {
            errors[result.error] = (errors[result.error] || 0) + 1;
          }
        }
      }
    }
        
    return Object.entries(errors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));
  }
    
  _validateConfig() {
    if (!this.config.defaultChannel) {
      throw new Error('Default channel must be specified');
    }
        
    if (!this.config.channels[this.config.defaultChannel]) {
      throw new Error('Default channel must be configured');
    }
        
    if (this.config.maxRetries < 0) {
      throw new Error('Max retries must be non-negative');
    }
  }
    
  _setupEventHandlers() {
    this.on('error', (error) => {
      this.logger.error('Notification manager error:', error);
    });
  }
}

export default NotificationManager;
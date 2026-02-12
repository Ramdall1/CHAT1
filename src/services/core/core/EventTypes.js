/**
 * Definición de tipos de eventos para la arquitectura orientada a eventos
 * Clasifica todos los eventos en tres categorías principales: system.*, user.*, ai.*
 */

const EventTypes = {
  // ===== EVENTOS DEL SISTEMA (system.*) =====
  SYSTEM: {
    // Eventos de ciclo de vida del sistema
    STARTUP: 'system.startup',
    SHUTDOWN: 'system.shutdown',
    RESTART: 'system.restart',
    READY: 'system.ready',
    
    // Eventos de base de datos
    DATABASE_CONNECTED: 'system.database.connected',
    DATABASE_DISCONNECTED: 'system.database.disconnected',
    DATABASE_ERROR: 'system.database.error',
    DATABASE_BACKUP_STARTED: 'system.database.backup.started',
    DATABASE_BACKUP_COMPLETED: 'system.database.backup.completed',
    DATABASE_BACKUP_FAILED: 'system.database.backup.failed',
    
    // Eventos de servicios
    SERVICE_STARTED: 'system.service.started',
    SERVICE_STOPPED: 'system.service.stopped',
    SERVICE_ERROR: 'system.service.error',
    SERVICE_HEALTH_CHECK: 'system.service.health_check',
    
    // Eventos de seguridad del sistema
    SECURITY_THREAT_DETECTED: 'system.security.threat_detected',
    RATE_LIMIT_EXCEEDED: 'system.security.rate_limit_exceeded',
    UNAUTHORIZED_ACCESS: 'system.security.unauthorized_access',
    
    // Eventos de configuración
    CONFIG_LOADED: 'system.config.loaded',
    CONFIG_UPDATED: 'system.config.updated',
    CONFIG_ERROR: 'system.config.error',
    
    // Eventos de errores del sistema
    ERROR: 'system.error',
    CRITICAL_ERROR: 'system.error.critical',
    WARNING: 'system.warning',
    
    // Eventos de métricas y monitoreo
    METRICS_COLLECTED: 'system.metrics.collected',
    PERFORMANCE_ALERT: 'system.performance.alert',
    RESOURCE_USAGE_HIGH: 'system.resource.usage_high'
  },

  // ===== EVENTOS DE USUARIO (user.*) =====
  USER: {
    // Eventos de autenticación
    LOGIN_ATTEMPT: 'user.auth.login_attempt',
    LOGIN_SUCCESS: 'user.auth.login_success',
    LOGIN_FAILED: 'user.auth.login_failed',
    LOGOUT: 'user.auth.logout',
    PASSWORD_RESET_REQUESTED: 'user.auth.password_reset_requested',
    PASSWORD_RESET_COMPLETED: 'user.auth.password_reset_completed',
    TWO_FACTOR_ENABLED: 'user.auth.two_factor_enabled',
    TWO_FACTOR_DISABLED: 'user.auth.two_factor_disabled',
    
    // Eventos de registro de usuario
    REGISTRATION_STARTED: 'user.registration.started',
    REGISTRATION_COMPLETED: 'user.registration.completed',
    REGISTRATION_FAILED: 'user.registration.failed',
    EMAIL_VERIFICATION_SENT: 'user.registration.email_verification_sent',
    EMAIL_VERIFIED: 'user.registration.email_verified',
    
    // Eventos de perfil de usuario
    PROFILE_UPDATED: 'user.profile.updated',
    PROFILE_VIEWED: 'user.profile.viewed',
    AVATAR_UPLOADED: 'user.profile.avatar_uploaded',
    
    // Eventos de mensajería
    MESSAGE_SENT: 'user.message.sent',
    MESSAGE_RECEIVED: 'user.message.received',
    MESSAGE_READ: 'user.message.read',
    MESSAGE_DELETED: 'user.message.deleted',
    
    // Eventos de contactos
    CONTACT_ADDED: 'user.contact.added',
    CONTACT_REMOVED: 'user.contact.removed',
    CONTACT_BLOCKED: 'user.contact.blocked',
    CONTACT_UNBLOCKED: 'user.contact.unblocked',
    
    // Eventos de campañas
    CAMPAIGN_CREATED: 'user.campaign.created',
    CAMPAIGN_STARTED: 'user.campaign.started',
    CAMPAIGN_PAUSED: 'user.campaign.paused',
    CAMPAIGN_COMPLETED: 'user.campaign.completed',
    CAMPAIGN_DELETED: 'user.campaign.deleted',
    
    // Eventos de pagos
    PAYMENT_INITIATED: 'user.payment.initiated',
    PAYMENT_APPROVED: 'user.payment.approved',
    PAYMENT_FAILED: 'user.payment.failed',
    PAYMENT_REFUNDED: 'user.payment.refunded',
    
    // Eventos de formularios
    FORM_SUBMITTED: 'user.form.submitted',
    FORM_VALIDATED: 'user.form.validated',
    FORM_ERROR: 'user.form.error',
    
    // Eventos de sesión
    SESSION_STARTED: 'user.session.started',
    SESSION_ENDED: 'user.session.ended',
    SESSION_EXPIRED: 'user.session.expired',
    
    // Eventos de actividad
    ACTIVITY_LOGGED: 'user.activity.logged',
    PREFERENCE_UPDATED: 'user.preference.updated'
  },

  // ===== EVENTOS DE IA (ai.*) =====
  AI: {
    // Eventos de procesamiento de IA
    REQUEST_RECEIVED: 'ai.request.received',
    PROCESSING_STARTED: 'ai.processing.started',
    PROCESSING_COMPLETED: 'ai.processing.completed',
    PROCESSING_FAILED: 'ai.processing.failed',
    
    // Eventos de respuestas de IA
    RESPONSE_GENERATED: 'ai.response.generated',
    RESPONSE_SENT: 'ai.response.sent',
    RESPONSE_ERROR: 'ai.response.error',
    
    // Eventos de análisis de IA
    SENTIMENT_ANALYZED: 'ai.analysis.sentiment_analyzed',
    INTENT_DETECTED: 'ai.analysis.intent_detected',
    LANGUAGE_DETECTED: 'ai.analysis.language_detected',
    
    // Eventos de aprendizaje de IA
    MODEL_TRAINED: 'ai.learning.model_trained',
    MODEL_UPDATED: 'ai.learning.model_updated',
    FEEDBACK_RECEIVED: 'ai.learning.feedback_received',
    
    // Eventos de decisiones de IA
    DECISION_MADE: 'ai.decision.made',
    RECOMMENDATION_GENERATED: 'ai.decision.recommendation_generated',
    CLASSIFICATION_COMPLETED: 'ai.decision.classification_completed',
    
    // Eventos de automatización
    AUTOMATION_TRIGGERED: 'ai.automation.triggered',
    AUTOMATION_COMPLETED: 'ai.automation.completed',
    AUTOMATION_FAILED: 'ai.automation.failed',
    
    // Eventos de notificaciones inteligentes
    SMART_NOTIFICATION_SENT: 'ai.notification.smart_sent',
    NOTIFICATION_OPTIMIZED: 'ai.notification.optimized',
    
    // Eventos de agentes
    AGENT_ACTIVATED: 'ai.agent.activated',
    AGENT_DEACTIVATED: 'ai.agent.deactivated',
    AGENT_TASK_ASSIGNED: 'ai.agent.task_assigned',
    AGENT_TASK_COMPLETED: 'ai.agent.task_completed',
    
    // Eventos de métricas de IA
    PERFORMANCE_MEASURED: 'ai.metrics.performance_measured',
    ACCURACY_CALCULATED: 'ai.metrics.accuracy_calculated',
    USAGE_TRACKED: 'ai.metrics.usage_tracked'
  }
};

/**
 * Utilidades para trabajar con tipos de eventos
 */
const EventUtils = {
  /**
   * Verifica si un evento pertenece a una categoría específica
   * @param {string} eventType - Tipo de evento
   * @param {string} category - Categoría (system, user, ai)
   * @returns {boolean}
   */
  isEventOfCategory(eventType, category) {
    return eventType.startsWith(`${category}.`);
  },

  /**
   * Obtiene la categoría de un evento
   * @param {string} eventType - Tipo de evento
   * @returns {string|null}
   */
  getEventCategory(eventType) {
    const parts = eventType.split('.');
    return parts.length > 0 ? parts[0] : null;
  },

  /**
   * Obtiene el subcategoría de un evento
   * @param {string} eventType - Tipo de evento
   * @returns {string|null}
   */
  getEventSubcategory(eventType) {
    const parts = eventType.split('.');
    return parts.length > 1 ? parts[1] : null;
  },

  /**
   * Valida si un tipo de evento es válido
   * @param {string} eventType - Tipo de evento
   * @returns {boolean}
   */
  isValidEventType(eventType) {
    const allEvents = [
      ...Object.values(EventTypes.SYSTEM),
      ...Object.values(EventTypes.USER),
      ...Object.values(EventTypes.AI)
    ];
    return allEvents.includes(eventType);
  },

  /**
   * Obtiene todos los eventos de una categoría
   * @param {string} category - Categoría (SYSTEM, USER, AI)
   * @returns {string[]}
   */
  getEventsByCategory(category) {
    return Object.values(EventTypes[category.toUpperCase()] || {});
  },

  /**
   * Crea un evento personalizado siguiendo la convención de nomenclatura
   * @param {string} category - Categoría (system, user, ai)
   * @param {string} subcategory - Subcategoría
   * @param {string} action - Acción específica
   * @returns {string}
   */
  createCustomEvent(category, subcategory, action) {
    return `${category}.${subcategory}.${action}`;
  }
};

/**
 * Prioridades de eventos para el sistema de colas
 */
const EventPriorities = {
  CRITICAL: 1,    // Errores críticos del sistema, amenazas de seguridad
  HIGH: 2,        // Pagos, autenticación, eventos de usuario importantes
  MEDIUM: 3,      // Mensajes, notificaciones, eventos de IA
  LOW: 4,         // Métricas, logs, eventos de monitoreo
  BACKGROUND: 5   // Tareas de mantenimiento, limpieza
};

/**
 * Mapeo de tipos de eventos a prioridades
 */
const EventPriorityMap = {
  // Eventos críticos
  [EventTypes.SYSTEM.CRITICAL_ERROR]: EventPriorities.CRITICAL,
  [EventTypes.SYSTEM.SECURITY_THREAT_DETECTED]: EventPriorities.CRITICAL,
  [EventTypes.SYSTEM.DATABASE_ERROR]: EventPriorities.CRITICAL,
  
  // Eventos de alta prioridad
  [EventTypes.USER.PAYMENT_INITIATED]: EventPriorities.HIGH,
  [EventTypes.USER.PAYMENT_APPROVED]: EventPriorities.HIGH,
  [EventTypes.USER.PAYMENT_FAILED]: EventPriorities.HIGH,
  [EventTypes.USER.LOGIN_ATTEMPT]: EventPriorities.HIGH,
  [EventTypes.SYSTEM.UNAUTHORIZED_ACCESS]: EventPriorities.HIGH,
  
  // Eventos de prioridad media
  [EventTypes.USER.MESSAGE_SENT]: EventPriorities.MEDIUM,
  [EventTypes.USER.MESSAGE_RECEIVED]: EventPriorities.MEDIUM,
  [EventTypes.AI.RESPONSE_GENERATED]: EventPriorities.MEDIUM,
  [EventTypes.AI.PROCESSING_STARTED]: EventPriorities.MEDIUM,
  
  // Eventos de baja prioridad
  [EventTypes.SYSTEM.METRICS_COLLECTED]: EventPriorities.LOW,
  [EventTypes.USER.ACTIVITY_LOGGED]: EventPriorities.LOW,
  [EventTypes.AI.USAGE_TRACKED]: EventPriorities.LOW
};

export {
  EventTypes,
  EventUtils,
  EventPriorities,
  EventPriorityMap
};

export default EventTypes;
import express from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import SecurityManager from '../../services/core/core/auth/SecurityManager.js';
import { createLogger } from '../../services/core/core/logger.js';
import { 
  sanitizeSearchParams, 
  detectAttacks, 
  logSanitization 
} from '../api/middleware/inputSanitizationMiddleware.js';

const router = express.Router();
const logger = createLogger('ANALYTICS_ROUTES');

// Rate limiting para analytics
const analyticsRateLimit = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutos
  max: 50, // máximo 50 requests por 2 minutos
  message: {
    error: 'Demasiadas consultas de analytics',
    code: 'TOO_MANY_ANALYTICS_REQUESTS',
    retryAfter: '2 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar autenticación, rate limiting y sanitización a todas las rutas
router.use(SecurityManager.authenticateToken);
router.use(analyticsRateLimit);
router.use(detectAttacks);
router.use(logSanitization);

// Esquemas de validación
const dateRangeSchema = Joi.object({
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
  period: Joi.string().valid('today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'this_month', 'last_month', 'this_year', 'custom').default('last_30_days'),
  timezone: Joi.string().optional().default('UTC')
});

const campaignAnalyticsSchema = Joi.object({
  campaign_id: Joi.number().integer().positive().optional(),
  template_id: Joi.number().integer().positive().optional(),
  status: Joi.string().valid('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled').optional(),
  group_by: Joi.string().valid('day', 'week', 'month', 'campaign', 'template', 'status').default('day')
}).concat(dateRangeSchema);

const messageAnalyticsSchema = Joi.object({
  contact_id: Joi.number().integer().positive().optional(),
  conversation_id: Joi.number().integer().positive().optional(),
  message_type: Joi.string().valid('text', 'image', 'document', 'audio', 'video', 'location', 'contact').optional(),
  direction: Joi.string().valid('inbound', 'outbound').optional(),
  status: Joi.string().valid('sent', 'delivered', 'read', 'failed').optional(),
  group_by: Joi.string().valid('day', 'week', 'month', 'hour', 'contact', 'type', 'status').default('day')
}).concat(dateRangeSchema);

// Middleware de validación
const validate = (schema) => {
  return (req, res, next) => {
    const dataToValidate = req.method === 'GET' ? req.query : req.body;
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Parámetros de consulta inválidos',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    req.validatedData = value;
    next();
  };
};

// Función para obtener rango de fechas basado en período
const getDateRange = (period, startDate, endDate, timezone = 'UTC') => {
  const now = new Date();
  let start, end;

  switch (period) {
  case 'today':
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    break;
  case 'yesterday':
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    start = new Date(end.getTime() - 24 * 60 * 60 * 1000 + 1);
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1);
    break;
  case 'last_7_days':
    end = now;
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    break;
  case 'last_30_days':
    end = now;
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    break;
  case 'last_90_days':
    end = now;
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    break;
  case 'this_month':
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = now;
    break;
  case 'last_month':
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    break;
  case 'this_year':
    start = new Date(now.getFullYear(), 0, 1);
    end = now;
    break;
  case 'custom':
    start = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    end = endDate ? new Date(endDate) : now;
    break;
  default:
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
};

// GET /api/analytics/dashboard - Dashboard principal con métricas generales
router.get('/dashboard', sanitizeSearchParams, validate(dateRangeSchema), async(req, res) => {
  try {
    const { period, start_date, end_date, timezone } = req.validatedData;
    const dateRange = getDateRange(period, start_date, end_date, timezone);
        
    const db = req.database.getManager();

    // Métricas de contactos
    const contactStats = await db.get(`
            SELECT 
                COUNT(*) as total_contacts,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_contacts,
                SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new_contacts_period
            FROM contacts 
            WHERE user_id = ?
        `, [dateRange.start, req.user.id]);

    // Métricas de mensajes
    const messageStats = await db.get(`
            SELECT 
                COUNT(*) as total_messages,
                SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound_messages,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound_messages,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_messages,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_messages,
                SUM(CASE WHEN created_at >= ? AND created_at <= ? THEN 1 ELSE 0 END) as messages_period
            FROM messages 
            WHERE user_id = ?
        `, [dateRange.start, dateRange.end, req.user.id]);

    // Métricas de campañas
    const campaignStats = await db.get(`
            SELECT 
                COUNT(*) as total_campaigns,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_campaigns,
                SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as active_campaigns,
                SUM(target_count) as total_target_contacts,
                SUM(sent_count) as total_sent,
                SUM(delivered_count) as total_delivered,
                SUM(CASE WHEN created_at >= ? AND created_at <= ? THEN 1 ELSE 0 END) as campaigns_period
            FROM campaigns 
            WHERE user_id = ?
        `, [dateRange.start, dateRange.end, req.user.id]);

    // Métricas de templates
    const templateStats = await db.get(`
            SELECT 
                COUNT(*) as total_templates,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_templates,
                SUM(usage_count) as total_template_usage
            FROM templates 
            WHERE user_id = ?
        `, [req.user.id]);

    // Conversaciones activas
    const conversationStats = await db.get(`
            SELECT 
                COUNT(DISTINCT conversation_id) as total_conversations,
                COUNT(DISTINCT CASE WHEN m.created_at >= ? THEN conversation_id END) as active_conversations_period
            FROM messages m
            WHERE m.user_id = ?
        `, [dateRange.start, req.user.id]);

    // Tendencias de mensajes por día (últimos 7 días)
    const messageTrends = await db.all(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as message_count,
                SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count
            FROM messages 
            WHERE user_id = ? 
                AND created_at >= date('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, [req.user.id]);

    // Top contactos por actividad
    const topContacts = await db.all(`
            SELECT 
                c.id,
                c.name,
                c.phone_number,
                COUNT(m.id) as message_count,
                MAX(m.created_at) as last_message_at
            FROM contacts c
            LEFT JOIN messages m ON c.id = m.contact_id 
                AND m.created_at >= ? AND m.created_at <= ?
            WHERE c.user_id = ? AND c.is_active = 1
            GROUP BY c.id, c.name, c.phone_number
            HAVING message_count > 0
            ORDER BY message_count DESC, last_message_at DESC
            LIMIT 10
        `, [dateRange.start, dateRange.end, req.user.id]);

    // Calcular tasas de éxito
    const deliveryRate = messageStats.total_messages > 0 ? 
      ((messageStats.delivered_messages || 0) / messageStats.total_messages * 100).toFixed(2) : 0;

    const campaignSuccessRate = campaignStats.total_sent > 0 ? 
      ((campaignStats.total_delivered || 0) / campaignStats.total_sent * 100).toFixed(2) : 0;

    res.json({
      dashboard: {
        period: {
          type: period,
          start_date: dateRange.start,
          end_date: dateRange.end,
          timezone
        },
        summary: {
          contacts: {
            total: contactStats.total_contacts || 0,
            active: contactStats.active_contacts || 0,
            new_in_period: contactStats.new_contacts_period || 0
          },
          messages: {
            total: messageStats.total_messages || 0,
            outbound: messageStats.outbound_messages || 0,
            inbound: messageStats.inbound_messages || 0,
            delivered: messageStats.delivered_messages || 0,
            failed: messageStats.failed_messages || 0,
            in_period: messageStats.messages_period || 0,
            delivery_rate: parseFloat(deliveryRate)
          },
          campaigns: {
            total: campaignStats.total_campaigns || 0,
            completed: campaignStats.completed_campaigns || 0,
            active: campaignStats.active_campaigns || 0,
            target_contacts: campaignStats.total_target_contacts || 0,
            sent: campaignStats.total_sent || 0,
            delivered: campaignStats.total_delivered || 0,
            in_period: campaignStats.campaigns_period || 0,
            success_rate: parseFloat(campaignSuccessRate)
          },
          templates: {
            total: templateStats.total_templates || 0,
            active: templateStats.active_templates || 0,
            total_usage: templateStats.total_template_usage || 0
          },
          conversations: {
            total: conversationStats.total_conversations || 0,
            active_in_period: conversationStats.active_conversations_period || 0
          }
        },
        trends: {
          messages_by_day: messageTrends.map(trend => ({
            date: trend.date,
            total: trend.message_count,
            outbound: trend.outbound_count,
            inbound: trend.inbound_count
          }))
        },
        top_contacts: topContacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          phone_number: contact.phone_number,
          message_count: contact.message_count,
          last_message_at: contact.last_message_at
        }))
      }
    });

  } catch (error) {
    logger.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/analytics/campaigns - Analytics detallado de campañas
router.get('/campaigns', sanitizeSearchParams, validate(campaignAnalyticsSchema), async(req, res) => {
  try {
    const {
      campaign_id,
      template_id,
      status,
      group_by,
      period,
      start_date,
      end_date,
      timezone
    } = req.validatedData;

    const dateRange = getDateRange(period, start_date, end_date, timezone);
    const db = req.database.getManager();

    // Construir filtros dinámicamente
    const whereConditions = ['c.user_id = ?'];
    const queryParams = [req.user.id];

    if (campaign_id) {
      whereConditions.push('c.id = ?');
      queryParams.push(campaign_id);
    }

    if (template_id) {
      whereConditions.push('c.template_id = ?');
      queryParams.push(template_id);
    }

    if (status) {
      whereConditions.push('c.status = ?');
      queryParams.push(status);
    }

    whereConditions.push('c.created_at >= ? AND c.created_at <= ?');
    queryParams.push(dateRange.start, dateRange.end);

    const whereClause = whereConditions.join(' AND ');

    // Query principal según agrupación
    let groupByClause, selectClause;

    switch (group_by) {
    case 'day':
      selectClause = `
                    DATE(c.created_at) as period,
                    COUNT(*) as campaign_count,
                    SUM(c.target_count) as total_targets,
                    SUM(c.sent_count) as total_sent,
                    SUM(c.delivered_count) as total_delivered,
                    SUM(c.failed_count) as total_failed
                `;
      groupByClause = 'GROUP BY DATE(c.created_at)';
      break;
    case 'week':
      selectClause = `
                    strftime('%Y-W%W', c.created_at) as period,
                    COUNT(*) as campaign_count,
                    SUM(c.target_count) as total_targets,
                    SUM(c.sent_count) as total_sent,
                    SUM(c.delivered_count) as total_delivered,
                    SUM(c.failed_count) as total_failed
                `;
      groupByClause = 'GROUP BY strftime(\'%Y-W%W\', c.created_at)';
      break;
    case 'month':
      selectClause = `
                    strftime('%Y-%m', c.created_at) as period,
                    COUNT(*) as campaign_count,
                    SUM(c.target_count) as total_targets,
                    SUM(c.sent_count) as total_sent,
                    SUM(c.delivered_count) as total_delivered,
                    SUM(c.failed_count) as total_failed
                `;
      groupByClause = 'GROUP BY strftime(\'%Y-%m\', c.created_at)';
      break;
    case 'campaign':
      selectClause = `
                    c.id as campaign_id,
                    c.name as campaign_name,
                    c.status,
                    c.target_count as total_targets,
                    c.sent_count as total_sent,
                    c.delivered_count as total_delivered,
                    c.failed_count as total_failed,
                    c.created_at as period
                `;
      groupByClause = '';
      break;
    case 'template':
      selectClause = `
                    t.id as template_id,
                    t.name as template_name,
                    COUNT(c.id) as campaign_count,
                    SUM(c.target_count) as total_targets,
                    SUM(c.sent_count) as total_sent,
                    SUM(c.delivered_count) as total_delivered,
                    SUM(c.failed_count) as total_failed
                `;
      groupByClause = 'GROUP BY t.id, t.name';
      break;
    case 'status':
      selectClause = `
                    c.status as period,
                    COUNT(*) as campaign_count,
                    SUM(c.target_count) as total_targets,
                    SUM(c.sent_count) as total_sent,
                    SUM(c.delivered_count) as total_delivered,
                    SUM(c.failed_count) as total_failed
                `;
      groupByClause = 'GROUP BY c.status';
      break;
    default:
      selectClause = `
                    DATE(c.created_at) as period,
                    COUNT(*) as campaign_count,
                    SUM(c.target_count) as total_targets,
                    SUM(c.sent_count) as total_sent,
                    SUM(c.delivered_count) as total_delivered,
                    SUM(c.failed_count) as total_failed
                `;
      groupByClause = 'GROUP BY DATE(c.created_at)';
    }

    const query = `
            SELECT ${selectClause}
            FROM campaigns c
            LEFT JOIN templates t ON c.template_id = t.id
            WHERE ${whereClause}
            ${groupByClause}
            ORDER BY period DESC
        `;

    const analytics = await db.all(query, queryParams);

    // Calcular métricas agregadas
    const totals = await db.get(`
            SELECT 
                COUNT(*) as total_campaigns,
                SUM(c.target_count) as total_targets,
                SUM(c.sent_count) as total_sent,
                SUM(c.delivered_count) as total_delivered,
                SUM(c.failed_count) as total_failed,
                AVG(CASE WHEN c.target_count > 0 THEN (c.delivered_count * 100.0 / c.target_count) END) as avg_success_rate
            FROM campaigns c
            WHERE ${whereClause}
        `, queryParams);

    // Formatear resultados
    const formattedAnalytics = analytics.map(row => {
      const successRate = row.total_sent > 0 ? 
        ((row.total_delivered || 0) / row.total_sent * 100).toFixed(2) : 0;

      return {
        period: row.period,
        campaign_id: row.campaign_id || null,
        campaign_name: row.campaign_name || null,
        template_id: row.template_id || null,
        template_name: row.template_name || null,
        status: row.status || null,
        metrics: {
          campaign_count: row.campaign_count || 0,
          total_targets: row.total_targets || 0,
          total_sent: row.total_sent || 0,
          total_delivered: row.total_delivered || 0,
          total_failed: row.total_failed || 0,
          success_rate: parseFloat(successRate)
        }
      };
    });

    res.json({
      analytics: formattedAnalytics,
      summary: {
        period: {
          type: period,
          start_date: dateRange.start,
          end_date: dateRange.end,
          group_by
        },
        totals: {
          total_campaigns: totals.total_campaigns || 0,
          total_targets: totals.total_targets || 0,
          total_sent: totals.total_sent || 0,
          total_delivered: totals.total_delivered || 0,
          total_failed: totals.total_failed || 0,
          overall_success_rate: parseFloat((totals.avg_success_rate || 0).toFixed(2))
        },
        filters: {
          campaign_id,
          template_id,
          status
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo analytics de campañas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/analytics/messages - Analytics detallado de mensajes
router.get('/messages', sanitizeSearchParams, validate(messageAnalyticsSchema), async(req, res) => {
  try {
    const {
      contact_id,
      conversation_id,
      message_type,
      direction,
      status,
      group_by,
      period,
      start_date,
      end_date,
      timezone
    } = req.validatedData;

    const dateRange = getDateRange(period, start_date, end_date, timezone);
    const db = req.database.getManager();

    // Construir filtros dinámicamente
    const whereConditions = ['m.user_id = ?'];
    const queryParams = [req.user.id];

    if (contact_id) {
      whereConditions.push('m.contact_id = ?');
      queryParams.push(contact_id);
    }

    if (conversation_id) {
      whereConditions.push('m.conversation_id = ?');
      queryParams.push(conversation_id);
    }

    if (message_type) {
      whereConditions.push('m.message_type = ?');
      queryParams.push(message_type);
    }

    if (direction) {
      whereConditions.push('m.direction = ?');
      queryParams.push(direction);
    }

    if (status) {
      whereConditions.push('m.status = ?');
      queryParams.push(status);
    }

    whereConditions.push('m.created_at >= ? AND m.created_at <= ?');
    queryParams.push(dateRange.start, dateRange.end);

    const whereClause = whereConditions.join(' AND ');

    // Query principal según agrupación
    let groupByClause, selectClause;

    switch (group_by) {
    case 'day':
      selectClause = `
                    DATE(m.created_at) as period,
                    COUNT(*) as message_count,
                    SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                    SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count,
                    SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                    SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as failed_count
                `;
      groupByClause = 'GROUP BY DATE(m.created_at)';
      break;
    case 'week':
      selectClause = `
                    strftime('%Y-W%W', m.created_at) as period,
                    COUNT(*) as message_count,
                    SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                    SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count,
                    SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                    SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as failed_count
                `;
      groupByClause = 'GROUP BY strftime(\'%Y-W%W\', m.created_at)';
      break;
    case 'month':
      selectClause = `
                    strftime('%Y-%m', m.created_at) as period,
                    COUNT(*) as message_count,
                    SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                    SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count,
                    SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                    SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as failed_count
                `;
      groupByClause = 'GROUP BY strftime(\'%Y-%m\', m.created_at)';
      break;
    case 'hour':
      selectClause = `
                    strftime('%Y-%m-%d %H:00', m.created_at) as period,
                    COUNT(*) as message_count,
                    SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                    SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count,
                    SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                    SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as failed_count
                `;
      groupByClause = 'GROUP BY strftime(\'%Y-%m-%d %H:00\', m.created_at)';
      break;
    case 'contact':
      selectClause = `
                    c.id as contact_id,
                    c.name as contact_name,
                    c.phone_number,
                    COUNT(m.id) as message_count,
                    SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                    SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count,
                    MAX(m.created_at) as last_message_at
                `;
      groupByClause = 'GROUP BY c.id, c.name, c.phone_number';
      break;
    case 'type':
      selectClause = `
                    m.message_type as period,
                    COUNT(*) as message_count,
                    SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                    SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count,
                    SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                    SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as failed_count
                `;
      groupByClause = 'GROUP BY m.message_type';
      break;
    case 'status':
      selectClause = `
                    m.status as period,
                    COUNT(*) as message_count,
                    SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                    SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count
                `;
      groupByClause = 'GROUP BY m.status';
      break;
    default:
      selectClause = `
                    DATE(m.created_at) as period,
                    COUNT(*) as message_count,
                    SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                    SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count,
                    SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                    SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as failed_count
                `;
      groupByClause = 'GROUP BY DATE(m.created_at)';
    }

    const query = `
            SELECT ${selectClause}
            FROM messages m
            LEFT JOIN contacts c ON m.contact_id = c.id
            WHERE ${whereClause}
            ${groupByClause}
            ORDER BY period DESC
        `;

    const analytics = await db.all(query, queryParams);

    // Calcular métricas agregadas
    const totals = await db.get(`
            SELECT 
                COUNT(*) as total_messages,
                SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as total_outbound,
                SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as total_inbound,
                SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) as total_delivered,
                SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as total_failed,
                COUNT(DISTINCT m.contact_id) as unique_contacts,
                COUNT(DISTINCT m.conversation_id) as unique_conversations
            FROM messages m
            WHERE ${whereClause}
        `, queryParams);

    // Formatear resultados
    const formattedAnalytics = analytics.map(row => {
      const deliveryRate = row.outbound_count > 0 ? 
        ((row.delivered_count || 0) / row.outbound_count * 100).toFixed(2) : 0;

      return {
        period: row.period,
        contact_id: row.contact_id || null,
        contact_name: row.contact_name || null,
        phone_number: row.phone_number || null,
        last_message_at: row.last_message_at || null,
        metrics: {
          message_count: row.message_count || 0,
          outbound_count: row.outbound_count || 0,
          inbound_count: row.inbound_count || 0,
          delivered_count: row.delivered_count || 0,
          failed_count: row.failed_count || 0,
          delivery_rate: parseFloat(deliveryRate)
        }
      };
    });

    const overallDeliveryRate = totals.total_outbound > 0 ? 
      ((totals.total_delivered || 0) / totals.total_outbound * 100).toFixed(2) : 0;

    res.json({
      analytics: formattedAnalytics,
      summary: {
        period: {
          type: period,
          start_date: dateRange.start,
          end_date: dateRange.end,
          group_by
        },
        totals: {
          total_messages: totals.total_messages || 0,
          total_outbound: totals.total_outbound || 0,
          total_inbound: totals.total_inbound || 0,
          total_delivered: totals.total_delivered || 0,
          total_failed: totals.total_failed || 0,
          unique_contacts: totals.unique_contacts || 0,
          unique_conversations: totals.unique_conversations || 0,
          overall_delivery_rate: parseFloat(overallDeliveryRate)
        },
        filters: {
          contact_id,
          conversation_id,
          message_type,
          direction,
          status
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo analytics de mensajes:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/analytics/performance - Métricas de rendimiento del sistema
router.get('/performance', sanitizeSearchParams, async(req, res) => {
  try {
    const db = req.database.getManager();

    // Métricas de base de datos
    const dbStats = await db.get(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM contacts) as total_contacts,
                (SELECT COUNT(*) FROM messages) as total_messages,
                (SELECT COUNT(*) FROM campaigns) as total_campaigns,
                (SELECT COUNT(*) FROM templates) as total_templates,
                (SELECT COUNT(*) FROM user_sessions) as total_sessions
        `);

    // Métricas de actividad reciente (últimas 24 horas)
    const recentActivity = await db.get(`
            SELECT 
                (SELECT COUNT(*) FROM messages WHERE created_at >= datetime('now', '-1 day')) as messages_24h,
                (SELECT COUNT(*) FROM contacts WHERE created_at >= datetime('now', '-1 day')) as contacts_24h,
                (SELECT COUNT(*) FROM campaigns WHERE created_at >= datetime('now', '-1 day')) as campaigns_24h,
                (SELECT COUNT(*) FROM user_sessions WHERE created_at >= datetime('now', '-1 day')) as sessions_24h
        `);

    // Métricas de rendimiento de mensajes
    const messagePerformance = await db.get(`
            SELECT 
                AVG(CASE WHEN status = 'delivered' THEN 1.0 ELSE 0.0 END) * 100 as avg_delivery_rate,
                AVG(CASE WHEN status = 'failed' THEN 1.0 ELSE 0.0 END) * 100 as avg_failure_rate,
                COUNT(DISTINCT contact_id) as active_contacts,
                COUNT(DISTINCT conversation_id) as active_conversations
            FROM messages 
            WHERE created_at >= datetime('now', '-7 days')
        `);

    // Top usuarios por actividad
    const topUsers = await db.all(`
            SELECT 
                u.id,
                u.username,
                u.email,
                COUNT(m.id) as message_count,
                COUNT(DISTINCT c.id) as contact_count,
                COUNT(DISTINCT camp.id) as campaign_count,
                MAX(s.last_activity) as last_activity
            FROM users u
            LEFT JOIN messages m ON u.id = m.user_id AND m.created_at >= datetime('now', '-30 days')
            LEFT JOIN contacts c ON u.id = c.user_id
            LEFT JOIN campaigns camp ON u.id = camp.user_id
            LEFT JOIN user_sessions s ON u.id = s.user_id
            WHERE u.is_active = 1
            GROUP BY u.id, u.username, u.email
            ORDER BY message_count DESC
            LIMIT 10
        `);

    // Estadísticas de errores (si tienes una tabla de logs)
    const errorStats = {
      total_errors_24h: 0,
      critical_errors_24h: 0,
      most_common_errors: []
    };

    // Métricas del sistema
    const systemMetrics = {
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage(),
      node_version: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString()
    };

    res.json({
      performance: {
        database: {
          total_users: dbStats.total_users || 0,
          total_contacts: dbStats.total_contacts || 0,
          total_messages: dbStats.total_messages || 0,
          total_campaigns: dbStats.total_campaigns || 0,
          total_templates: dbStats.total_templates || 0,
          total_sessions: dbStats.total_sessions || 0
        },
        recent_activity: {
          messages_24h: recentActivity.messages_24h || 0,
          contacts_24h: recentActivity.contacts_24h || 0,
          campaigns_24h: recentActivity.campaigns_24h || 0,
          sessions_24h: recentActivity.sessions_24h || 0
        },
        messaging: {
          avg_delivery_rate: parseFloat((messagePerformance.avg_delivery_rate || 0).toFixed(2)),
          avg_failure_rate: parseFloat((messagePerformance.avg_failure_rate || 0).toFixed(2)),
          active_contacts: messagePerformance.active_contacts || 0,
          active_conversations: messagePerformance.active_conversations || 0
        },
        errors: errorStats,
        system: systemMetrics,
        top_users: topUsers.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          activity: {
            message_count: user.message_count || 0,
            contact_count: user.contact_count || 0,
            campaign_count: user.campaign_count || 0,
            last_activity: user.last_activity
          }
        }))
      }
    });

  } catch (error) {
    logger.error('Error obteniendo métricas de rendimiento:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/analytics/export - Exportar datos de analytics
router.get('/export', sanitizeSearchParams, validate(dateRangeSchema), async(req, res) => {
  try {
    const { period, start_date, end_date, timezone } = req.validatedData;
    const { format = 'json', type = 'summary' } = req.query;
        
    const dateRange = getDateRange(period, start_date, end_date, timezone);
    const db = req.database.getManager();

    const exportData = {};

    if (type === 'summary' || type === 'all') {
      // Resumen general
      const summary = await db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM contacts WHERE user_id = ?) as total_contacts,
                    (SELECT COUNT(*) FROM messages WHERE user_id = ? AND created_at >= ? AND created_at <= ?) as messages_period,
                    (SELECT COUNT(*) FROM campaigns WHERE user_id = ? AND created_at >= ? AND created_at <= ?) as campaigns_period,
                    (SELECT COUNT(*) FROM templates WHERE user_id = ?) as total_templates
            `, [req.user.id, req.user.id, dateRange.start, dateRange.end, req.user.id, dateRange.start, dateRange.end, req.user.id]);

      exportData.summary = summary;
    }

    if (type === 'messages' || type === 'all') {
      // Datos detallados de mensajes
      const messages = await db.all(`
                SELECT 
                    m.*,
                    c.name as contact_name,
                    c.phone_number
                FROM messages m
                LEFT JOIN contacts c ON m.contact_id = c.id
                WHERE m.user_id = ? AND m.created_at >= ? AND m.created_at <= ?
                ORDER BY m.created_at DESC
            `, [req.user.id, dateRange.start, dateRange.end]);

      exportData.messages = messages;
    }

    if (type === 'campaigns' || type === 'all') {
      // Datos detallados de campañas
      const campaigns = await db.all(`
                SELECT 
                    c.*,
                    t.name as template_name
                FROM campaigns c
                LEFT JOIN templates t ON c.template_id = t.id
                WHERE c.user_id = ? AND c.created_at >= ? AND c.created_at <= ?
                ORDER BY c.created_at DESC
            `, [req.user.id, dateRange.start, dateRange.end]);

      exportData.campaigns = campaigns;
    }

    // Metadatos de exportación
    exportData.metadata = {
      exported_at: new Date().toISOString(),
      period: {
        type: period,
        start_date: dateRange.start,
        end_date: dateRange.end,
        timezone
      },
      user_id: req.user.id,
      export_type: type,
      format
    };

    SecurityManager.logSecurityEvent('analytics_exported', {
      user_id: req.user.id,
      export_type: type,
      period,
      format
    }, req);

    if (format === 'csv') {
      // Convertir a CSV (implementación básica)
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${type}_${Date.now()}.csv"`);
            
      // Aquí implementarías la conversión a CSV
      res.send('CSV export not implemented yet');
    } else {
      // Respuesta JSON por defecto
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${type}_${Date.now()}.json"`);
      res.json(exportData);
    }

  } catch (error) {
    logger.error('Error exportando analytics:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

export default router;
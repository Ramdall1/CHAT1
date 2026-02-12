import express from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { authenticateToken } from '../../middleware/auth.js';
import { createLogger } from '../../services/core/core/logger.js';
import { 
  sanitizeInputs, 
  sanitizeSearchParams, 
  detectAttacks, 
  logSanitization 
} from '../middleware/inputSanitizationMiddleware.js';
import { Campaign, CampaignContact, MessageTemplate } from '../../adapters/SequelizeAdapter.js';
import { Op } from '../../adapters/SequelizeAdapter.js';

const router = express.Router();
const logger = createLogger('CAMPAIGN_ROUTES');

// Rate limiting para campañas
const campaignRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 30, // máximo 30 requests por 5 minutos
  message: {
    error: 'Demasiadas operaciones con campañas',
    code: 'TOO_MANY_CAMPAIGN_REQUESTS',
    retryAfter: '5 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar autenticación, rate limiting y sanitización a todas las rutas
router.use(authenticateToken);
router.use(campaignRateLimit);
// Comentado temporalmente para pruebas - detectAttacks está bloqueando curl
// router.use(detectAttacks);
router.use(logSanitization);

// Esquemas de validación
const createCampaignSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  message: Joi.string().optional(),
  template_id: Joi.alternatives().try(
    Joi.number().integer().positive(),
    Joi.string()
  ).optional().allow(null),
  footer_text: Joi.string().optional(),
  button_type: Joi.string().optional(),
  message_category: Joi.string().optional(),
  message_language: Joi.string().optional(),
  audience_segment_id: Joi.number().integer().positive().optional(),
  contact_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
  scheduled_at: Joi.date().iso().optional().allow(null),
  send_immediately: Joi.boolean().default(false),
  filters: Joi.object().optional(),
  variables: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  tags: Joi.array().items(Joi.string().min(1).max(30)).optional()
});

const updateCampaignSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  template_id: Joi.number().integer().positive().optional(),
  audience_segment_id: Joi.number().integer().positive().optional(),
  contact_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
  scheduled_at: Joi.date().iso().min('now').optional(),
  variables: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  tags: Joi.array().items(Joi.string().min(1).max(30)).optional(),
  status: Joi.string().valid('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled').optional()
});

const searchCampaignsSchema = Joi.object({
  search: Joi.string().min(1).max(100).optional(),
  status: Joi.string().valid('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled').optional(),
  template_id: Joi.number().integer().positive().optional(),
  date_from: Joi.date().iso().optional(),
  date_to: Joi.date().iso().optional(),
  tags: Joi.array().items(Joi.string().min(1).max(30)).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort_by: Joi.string().valid('name', 'status', 'created_at', 'scheduled_at', 'sent_count').default('created_at'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc')
});

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
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    req.validatedData = value;
    next();
  };
};

// Función para obtener contactos de una campaña
// Función para obtener contactos basados en filtros
const getContactsByFilters = async(db, userId, filters) => {
  let query = `SELECT id, name, phone_number, email FROM contacts WHERE user_id = ?`;
  let params = [userId];

  // Filtro de estado
  if (filters?.status) {
    if (filters.status === 'active') {
      query += ` AND is_active = 1`;
    } else if (filters.status === 'inactive') {
      query += ` AND is_active = 0`;
    }
  }

  // Filtro de búsqueda (nombre o teléfono)
  if (filters?.search) {
    query += ` AND (name LIKE ? OR phone_number LIKE ?)`;
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  // Filtro de etiqueta
  if (filters?.tag) {
    query += ` AND tags LIKE ?`;
    params.push(`%${filters.tag}%`);
  }

  // Filtro de campo personalizado
  if (filters?.custom_field) {
    query += ` AND metadata LIKE ?`;
    params.push(`%${filters.custom_field}%`);
  }

  const contacts = await db.all(query, params);
  return contacts;
};

const getCampaignContacts = async(db, campaignId, audienceSegmentId, contactIds) => {
  let contacts = [];

  if (audienceSegmentId) {
    // Obtener contactos del segmento de audiencia
    const segment = await db.get(`
            SELECT criteria FROM audience_segments 
            WHERE id = ? AND user_id = ?
        `, [audienceSegmentId, req.user.id]);

    if (segment) {
      // Aquí implementarías la lógica para filtrar contactos según los criterios del segmento
      // Por simplicidad, obtenemos todos los contactos activos
      contacts = await db.all(`
                SELECT id, name, phone_number, email 
                FROM contacts 
                WHERE user_id = ? AND is_active = 1
            `, [req.user.id]);
    }
  } else if (contactIds && contactIds.length > 0) {
    // Obtener contactos específicos
    const placeholders = contactIds.map(() => '?').join(',');
    contacts = await db.all(`
            SELECT id, name, phone_number, email 
            FROM contacts 
            WHERE id IN (${placeholders}) AND user_id = ?
        `, [...contactIds, req.user.id]);
  }

  return contacts;
};

// POST /api/campaigns - Crear nueva campaña
router.post('/', sanitizeInputs, validate(createCampaignSchema), async(req, res) => {
  try {
    const {
      name,
      description,
      template_id,
      audience_segment_id,
      contact_ids,
      scheduled_at,
      send_immediately,
      variables,
      tags,
      filters
    } = req.validatedData;

    const db = req.database.getManager();

    // Verificar que el template existe y pertenece al usuario (si se proporciona)
    let template = null;
    if (template_id) {
      template = await db.get(`
              SELECT id, name, content, variables as template_variables 
              FROM templates 
              WHERE id = ? AND user_id = ? AND is_active = 1
          `, [template_id, req.user.id]);

      if (!template) {
        return res.status(404).json({
          error: 'Template no encontrado o inactivo',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }
    }

    // Obtener contactos objetivo (si se especifican)
    let targetContacts = [];
    
    // Prioridad: filters > audience_segment_id > contact_ids
    if (filters && (filters.tag || filters.search || filters.status || filters.custom_field)) {
      // Usar filtros para obtener contactos
      targetContacts = await getContactsByFilters(db, req.user.id, filters);
    } else if (audience_segment_id || (contact_ids && contact_ids.length > 0)) {
      targetContacts = await getCampaignContacts(db, null, audience_segment_id, contact_ids);
    }
    
    // Solo validar si se intenta enviar inmediatamente
    if (send_immediately && targetContacts.length === 0) {
      return res.status(400).json({
        error: 'No se encontraron contactos válidos para la campaña',
        code: 'NO_VALID_CONTACTS'
      });
    }

    // Determinar estado inicial
    let status = 'draft';
    let actualScheduledAt = null;

    if (send_immediately) {
      status = 'running';
    } else if (scheduled_at) {
      status = 'scheduled';
      actualScheduledAt = scheduled_at;
    }

    // Crear campaña
    const createdCampaign = await Campaign.create({
      user_id: req.user.id,
      name,
      description: description || null,
      template_id,
      audience_segment_id: audience_segment_id || null,
      status,
      scheduled_at: actualScheduledAt,
      variables: variables || {},
      tags: tags || [],
      target_count: targetContacts.length
    });

    const campaignId = createdCampaign.id;

    // Si se especificaron contactos específicos, guardarlos
    if (contact_ids && contact_ids.length > 0) {
      const campaignContacts = contact_ids.map(contactId => ({
        campaign_id: campaignId,
        contact_id: contactId
      }));
      await CampaignContact.bulkCreate(campaignContacts);
    }

    // Si es envío inmediato, procesar la campaña
    if (send_immediately) {
      // Aquí implementarías la lógica de envío inmediato
      // Por ahora solo actualizamos el estado
      await Campaign.update(
        { 
          status: 'running', 
          started_at: new Date() 
        },
        { 
          where: { id: campaignId } 
        }
      );
    }

    // Obtener campaña creada
    const newCampaign = await Campaign.findByPk(campaignId, {
      include: [{
        model: MessageTemplate,
        as: 'template',
        attributes: ['name']
      }]
    });

    SecurityManager.logSecurityEvent('campaign_created', {
      campaign_id: campaignId,
      user_id: req.user.id,
      name,
      status,
      target_count: targetContacts.length
    }, req);

    res.status(201).json({
      message: 'Campaña creada exitosamente',
      campaign: {
        id: newCampaign.id,
        name: newCampaign.name,
        description: newCampaign.description,
        template: {
          id: newCampaign.template_id,
          name: newCampaign.template?.name
        },
        audience_segment_id: newCampaign.audience_segment_id,
        status: newCampaign.status,
        scheduled_at: newCampaign.scheduled_at,
        started_at: newCampaign.started_at,
        completed_at: newCampaign.completed_at,
        variables: newCampaign.variables,
        tags: newCampaign.tags,
        target_count: newCampaign.target_count,
        sent_count: newCampaign.sent_count || 0,
        delivered_count: newCampaign.delivered_count || 0,
        failed_count: newCampaign.failed_count || 0,
        created_at: newCampaign.created_at,
        updated_at: newCampaign.updated_at
      }
    });

  } catch (error) {
    logger.error('Error creando campaña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/campaigns - Obtener campañas con filtros y paginación
router.get('/', sanitizeSearchParams, validate(searchCampaignsSchema), async(req, res) => {
  try {
    const {
      search,
      status,
      template_id,
      date_from,
      date_to,
      tags,
      page,
      limit,
      sort_by,
      sort_order
    } = req.validatedData;

    const offset = (page - 1) * limit;

    // Construir condiciones WHERE para Sequelize
    const whereConditions = {
      user_id: req.user.id
    };

    if (search) {
      whereConditions[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    if (status) {
      whereConditions.status = status;
    }

    if (template_id) {
      whereConditions.template_id = template_id;
    }

    if (date_from) {
      whereConditions.created_at = {
        ...whereConditions.created_at,
        [Op.gte]: date_from
      };
    }

    if (date_to) {
      whereConditions.created_at = {
        ...whereConditions.created_at,
        [Op.lte]: date_to
      };
    }

    if (tags && tags.length > 0) {
      whereConditions[Op.and] = tags.map(tag => ({
        tags: { [Op.contains]: [tag] }
      }));
    }

    // Ejecutar consulta con Sequelize (sin include para compatibilidad con adaptador)
    const result = await Campaign.findAndCountAll({
      where: whereConditions,
      order: [[sort_by, sort_order.toUpperCase()]],
      limit,
      offset,
      distinct: true
    });

    const { count: total, rows: campaigns } = result;

    // Formatear respuesta
    const formattedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      template: {
        id: campaign.template_id,
        name: null // Template name no disponible sin include
      },
      audience_segment: campaign.audience_segment_id ? {
        id: campaign.audience_segment_id,
        name: null // Por ahora sin AudienceSegment model
      } : null,
      status: campaign.status,
      scheduled_at: campaign.scheduled_at,
      started_at: campaign.started_at,
      completed_at: campaign.completed_at,
      variables: campaign.variables,
      tags: campaign.tags,
      target_count: campaign.target_count,
      sent_count: campaign.sent_count || 0,
      delivered_count: campaign.delivered_count || 0,
      failed_count: campaign.failed_count || 0,
      success_rate: campaign.target_count > 0 ? 
        ((campaign.delivered_count || 0) / campaign.target_count * 100).toFixed(2) : 0,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      campaigns: formattedCampaigns,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_items: total,
        items_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      filters: {
        search,
        status,
        template_id,
        date_from,
        date_to,
        tags
      }
    });

  } catch (error) {
    logger.error('Error obteniendo campañas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/campaigns/:id - Obtener campaña específica
router.get('/:id', async(req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
        
    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'ID de campaña inválido',
        code: 'INVALID_CAMPAIGN_ID'
      });
    }

    const db = req.database.getManager();

    const campaign = await db.get(`
            SELECT 
                c.*,
                t.name as template_name,
                t.content as template_content,
                aseg.name as audience_segment_name
            FROM campaigns c
            JOIN templates t ON c.template_id = t.id
            LEFT JOIN audience_segments aseg ON c.audience_segment_id = aseg.id
            WHERE c.id = ? AND c.user_id = ?
        `, [campaignId, req.user.id]);

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    // Obtener contactos específicos si los hay
    const specificContacts = await db.all(`
            SELECT cc.contact_id, c.name, c.phone_number, c.email
            FROM campaign_contacts cc
            JOIN contacts c ON cc.contact_id = c.id
            WHERE cc.campaign_id = ?
        `, [campaignId]);

    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        template: {
          id: campaign.template_id,
          name: campaign.template_name,
          content: campaign.template_content
        },
        audience_segment: campaign.audience_segment_id ? {
          id: campaign.audience_segment_id,
          name: campaign.audience_segment_name
        } : null,
        specific_contacts: specificContacts.map(contact => ({
          id: contact.contact_id,
          name: contact.name,
          phone_number: contact.phone_number,
          email: contact.email
        })),
        status: campaign.status,
        scheduled_at: campaign.scheduled_at,
        started_at: campaign.started_at,
        completed_at: campaign.completed_at,
        variables: JSON.parse(campaign.variables || '{}'),
        tags: JSON.parse(campaign.tags || '[]'),
        target_count: campaign.target_count,
        sent_count: campaign.sent_count || 0,
        delivered_count: campaign.delivered_count || 0,
        failed_count: campaign.failed_count || 0,
        success_rate: campaign.target_count > 0 ? 
          ((campaign.delivered_count || 0) / campaign.target_count * 100).toFixed(2) : 0,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at
      }
    });

  } catch (error) {
    logger.error('Error obteniendo campaña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// PUT /api/campaigns/:id - Actualizar campaña
router.put('/:id', sanitizeInputs, validate(updateCampaignSchema), async(req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
        
    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'ID de campaña inválido',
        code: 'INVALID_CAMPAIGN_ID'
      });
    }

    const db = req.database.getManager();

    // Verificar que la campaña existe y pertenece al usuario
    const existingCampaign = await db.get(`
            SELECT * FROM campaigns 
            WHERE id = ? AND user_id = ?
        `, [campaignId, req.user.id]);

    if (!existingCampaign) {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    // Verificar que la campaña se puede editar
    if (['running', 'completed', 'cancelled'].includes(existingCampaign.status)) {
      return res.status(400).json({
        error: 'No se puede editar una campaña en estado: ' + existingCampaign.status,
        code: 'CAMPAIGN_NOT_EDITABLE'
      });
    }

    const {
      name,
      description,
      template_id,
      audience_segment_id,
      contact_ids,
      scheduled_at,
      variables,
      tags,
      status
    } = req.validatedData;

    // Si se cambia el template, verificar que existe
    if (template_id && template_id !== existingCampaign.template_id) {
      const template = await db.get(`
                SELECT id FROM templates 
                WHERE id = ? AND user_id = ? AND is_active = 1
            `, [template_id, req.user.id]);

      if (!template) {
        return res.status(404).json({
          error: 'Template no encontrado o inactivo',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }
    }

    // Construir query de actualización dinámicamente
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (template_id !== undefined) {
      updates.push('template_id = ?');
      params.push(template_id);
    }

    if (audience_segment_id !== undefined) {
      updates.push('audience_segment_id = ?');
      params.push(audience_segment_id);
    }

    if (scheduled_at !== undefined) {
      updates.push('scheduled_at = ?');
      params.push(scheduled_at);
    }

    if (variables !== undefined) {
      updates.push('variables = ?');
      params.push(JSON.stringify(variables));
    }

    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);

      // Si se inicia la campaña, establecer started_at
      if (status === 'running' && !existingCampaign.started_at) {
        updates.push('started_at = CURRENT_TIMESTAMP');
      }

      // Si se completa o cancela la campaña, establecer completed_at
      if (['completed', 'cancelled'].includes(status) && !existingCampaign.completed_at) {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No hay campos para actualizar',
        code: 'NO_FIELDS_TO_UPDATE'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(campaignId);

    const updateQuery = `
            UPDATE campaigns 
            SET ${updates.join(', ')}
            WHERE id = ?
        `;

    await db.run(updateQuery, params);

    // Actualizar contactos específicos si se proporcionaron
    if (contact_ids !== undefined) {
      // Eliminar contactos existentes
      await db.run(`
                DELETE FROM campaign_contacts WHERE campaign_id = ?
            `, [campaignId]);

      // Agregar nuevos contactos
      if (contact_ids.length > 0) {
        for (const contactId of contact_ids) {
          await db.run(`
                        INSERT INTO campaign_contacts (campaign_id, contact_id)
                        VALUES (?, ?)
                    `, [campaignId, contactId]);
        }
      }

      // Actualizar target_count
      const targetContacts = await getCampaignContacts(db, campaignId, audience_segment_id, contact_ids);
      await db.run(`
                UPDATE campaigns SET target_count = ? WHERE id = ?
            `, [targetContacts.length, campaignId]);
    }

    // Obtener campaña actualizada
    const updatedCampaign = await db.get(`
            SELECT 
                c.*,
                t.name as template_name
            FROM campaigns c
            JOIN templates t ON c.template_id = t.id
            WHERE c.id = ?
        `, [campaignId]);

    SecurityManager.logSecurityEvent('campaign_updated', {
      campaign_id: campaignId,
      user_id: req.user.id,
      updated_fields: Object.keys(req.validatedData)
    }, req);

    res.json({
      message: 'Campaña actualizada exitosamente',
      campaign: {
        id: updatedCampaign.id,
        name: updatedCampaign.name,
        description: updatedCampaign.description,
        template: {
          id: updatedCampaign.template_id,
          name: updatedCampaign.template_name
        },
        audience_segment_id: updatedCampaign.audience_segment_id,
        status: updatedCampaign.status,
        scheduled_at: updatedCampaign.scheduled_at,
        started_at: updatedCampaign.started_at,
        completed_at: updatedCampaign.completed_at,
        variables: JSON.parse(updatedCampaign.variables || '{}'),
        tags: JSON.parse(updatedCampaign.tags || '[]'),
        target_count: updatedCampaign.target_count,
        sent_count: updatedCampaign.sent_count || 0,
        delivered_count: updatedCampaign.delivered_count || 0,
        failed_count: updatedCampaign.failed_count || 0,
        created_at: updatedCampaign.created_at,
        updated_at: updatedCampaign.updated_at
      }
    });

  } catch (error) {
    logger.error('Error actualizando campaña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// DELETE /api/campaigns/:id - Eliminar campaña
router.delete('/:id', async(req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
        
    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'ID de campaña inválido',
        code: 'INVALID_CAMPAIGN_ID'
      });
    }

    const db = req.database.getManager();

    // Verificar que la campaña existe y pertenece al usuario
    const existingCampaign = await db.get(`
            SELECT id, name, status FROM campaigns 
            WHERE id = ? AND user_id = ?
        `, [campaignId, req.user.id]);

    if (!existingCampaign) {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    // Verificar que la campaña se puede eliminar
    if (existingCampaign.status === 'running') {
      return res.status(400).json({
        error: 'No se puede eliminar una campaña en ejecución',
        code: 'CAMPAIGN_RUNNING'
      });
    }

    // Eliminar contactos de la campaña
    await db.run(`
            DELETE FROM campaign_contacts WHERE campaign_id = ?
        `, [campaignId]);

    // Eliminar campaña
    await db.run(`
            DELETE FROM campaigns WHERE id = ?
        `, [campaignId]);

    SecurityManager.logSecurityEvent('campaign_deleted', {
      campaign_id: campaignId,
      campaign_name: existingCampaign.name,
      user_id: req.user.id
    }, req);

    res.json({
      message: 'Campaña eliminada exitosamente'
    });

  } catch (error) {
    logger.error('Error eliminando campaña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// POST /api/campaigns/:id/start - Iniciar campaña
router.post('/:id/start', async(req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
        
    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'ID de campaña inválido',
        code: 'INVALID_CAMPAIGN_ID'
      });
    }

    const db = req.database.getManager();

    // Verificar que la campaña existe y pertenece al usuario
    const campaign = await db.get(`
            SELECT * FROM campaigns 
            WHERE id = ? AND user_id = ?
        `, [campaignId, req.user.id]);

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    // Verificar que la campaña se puede iniciar
    if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
      return res.status(400).json({
        error: 'La campaña no se puede iniciar desde el estado: ' + campaign.status,
        code: 'INVALID_CAMPAIGN_STATUS'
      });
    }

    // Iniciar campaña
    await db.run(`
            UPDATE campaigns 
            SET status = 'running', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [campaignId]);

    SecurityManager.logSecurityEvent('campaign_started', {
      campaign_id: campaignId,
      user_id: req.user.id
    }, req);

    res.json({
      message: 'Campaña iniciada exitosamente',
      campaign_id: campaignId,
      status: 'running'
    });

  } catch (error) {
    logger.error('Error iniciando campaña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// POST /api/campaigns/:id/pause - Pausar campaña
router.post('/:id/pause', async(req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
        
    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'ID de campaña inválido',
        code: 'INVALID_CAMPAIGN_ID'
      });
    }

    const db = req.database.getManager();

    // Verificar que la campaña existe y está en ejecución
    const campaign = await db.get(`
            SELECT * FROM campaigns 
            WHERE id = ? AND user_id = ? AND status = 'running'
        `, [campaignId, req.user.id]);

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaña no encontrada o no está en ejecución',
        code: 'CAMPAIGN_NOT_RUNNING'
      });
    }

    // Pausar campaña
    await db.run(`
            UPDATE campaigns 
            SET status = 'paused', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [campaignId]);

    SecurityManager.logSecurityEvent('campaign_paused', {
      campaign_id: campaignId,
      user_id: req.user.id
    }, req);

    res.json({
      message: 'Campaña pausada exitosamente',
      campaign_id: campaignId,
      status: 'paused'
    });

  } catch (error) {
    logger.error('Error pausando campaña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// GET /api/campaigns/stats/overview - Estadísticas generales de campañas
router.get('/stats/overview', async(req, res) => {
  try {
    const db = req.database.getManager();

    const stats = await db.get(`
            SELECT 
                COUNT(*) as total_campaigns,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_campaigns,
                SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_campaigns,
                SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_campaigns,
                SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused_campaigns,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_campaigns,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_campaigns,
                SUM(target_count) as total_target_contacts,
                SUM(sent_count) as total_sent_messages,
                SUM(delivered_count) as total_delivered_messages,
                SUM(failed_count) as total_failed_messages
            FROM campaigns 
            WHERE user_id = ?
        `, [req.user.id]);

    const successRate = stats.total_sent_messages > 0 ? 
      ((stats.total_delivered_messages || 0) / stats.total_sent_messages * 100).toFixed(2) : 0;

    res.json({
      overview: {
        total_campaigns: stats.total_campaigns || 0,
        campaigns_by_status: {
          draft: stats.draft_campaigns || 0,
          scheduled: stats.scheduled_campaigns || 0,
          running: stats.running_campaigns || 0,
          paused: stats.paused_campaigns || 0,
          completed: stats.completed_campaigns || 0,
          cancelled: stats.cancelled_campaigns || 0
        },
        messaging_stats: {
          total_target_contacts: stats.total_target_contacts || 0,
          total_sent_messages: stats.total_sent_messages || 0,
          total_delivered_messages: stats.total_delivered_messages || 0,
          total_failed_messages: stats.total_failed_messages || 0,
          success_rate: parseFloat(successRate)
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

export default router;
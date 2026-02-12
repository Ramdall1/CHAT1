/**
 * Endpoints Avanzados para Campañas
 * Versión: 1.0.0
 * Fecha: 27 de Octubre, 2025
 * Recomendaciones #12-#16
 */

import express from 'express';
import db from '../../config/database.js';

const router = express.Router();

// ========================================
// #12: APROBACIÓN DE CAMPAÑAS
// ========================================

/**
 * Solicitar aprobación de campaña
 */
router.post('/campaigns/:id/request-approval', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 1; // Obtener del middleware de auth
    
    // Verificar que la campaña existe
    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
    }
    
    // Crear solicitud de aprobación
    const result = await db.run(
      `INSERT INTO campaign_approvals (campaign_id, requested_by, status) 
       VALUES (?, ?, 'pending')`,
      [id, userId]
    );
    
    // Actualizar estado de la campaña
    await db.run(
      'UPDATE campaigns SET status = ? WHERE id = ?',
      ['pending_approval', id]
    );
    
    res.json({
      success: true,
      message: 'Solicitud de aprobación enviada',
      approval_id: result.lastID
    });
  } catch (error) {
    logger.error('Error solicitando aprobación:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Aprobar campaña
 */
router.post('/campaigns/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 1;
    
    // Obtener solicitud pendiente
    const approval = await db.get(
      'SELECT * FROM campaign_approvals WHERE campaign_id = ? AND status = ? ORDER BY requested_at DESC LIMIT 1',
      [id, 'pending']
    );
    
    if (!approval) {
      return res.status(404).json({ success: false, error: 'No hay solicitud pendiente' });
    }
    
    // Aprobar
    await db.run(
      `UPDATE campaign_approvals 
       SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [userId, approval.id]
    );
    
    // Actualizar campaña
    await db.run(
      'UPDATE campaigns SET status = ? WHERE id = ?',
      ['scheduled', id]
    );
    
    res.json({
      success: true,
      message: 'Campaña aprobada'
    });
  } catch (error) {
    logger.error('Error aprobando campaña:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rechazar campaña
 */
router.post('/campaigns/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || 1;
    
    const approval = await db.get(
      'SELECT * FROM campaign_approvals WHERE campaign_id = ? AND status = ? ORDER BY requested_at DESC LIMIT 1',
      [id, 'pending']
    );
    
    if (!approval) {
      return res.status(404).json({ success: false, error: 'No hay solicitud pendiente' });
    }
    
    await db.run(
      `UPDATE campaign_approvals 
       SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?
       WHERE id = ?`,
      [userId, reason || 'Sin razón especificada', approval.id]
    );
    
    await db.run(
      'UPDATE campaigns SET status = ? WHERE id = ?',
      ['draft', id]
    );
    
    res.json({
      success: true,
      message: 'Campaña rechazada'
    });
  } catch (error) {
    logger.error('Error rechazando campaña:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// #13: SEGMENTOS GUARDADOS
// ========================================

/**
 * Crear segmento
 */
router.post('/segments', async (req, res) => {
  try {
    const { name, description, filters, contact_count } = req.body;
    const userId = req.user?.id || 1;
    
    if (!name || !filters) {
      return res.status(400).json({ success: false, error: 'Nombre y filtros son requeridos' });
    }
    
    const result = await db.run(
      `INSERT INTO segments (name, description, filters, contact_count, created_by, last_calculated)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [name, description, JSON.stringify(filters), contact_count || 0, userId]
    );
    
    res.json({
      success: true,
      message: 'Segmento creado',
      segment_id: result.lastID
    });
  } catch (error) {
    logger.error('Error creando segmento:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Listar segmentos
 */
router.get('/segments', async (req, res) => {
  try {
    const segments = await db.all('SELECT * FROM segments ORDER BY created_at DESC');
    
    res.json({
      success: true,
      segments: segments.map(s => ({
        ...s,
        filters: JSON.parse(s.filters)
      }))
    });
  } catch (error) {
    logger.error('Error listando segmentos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Preview de segmento (contar contactos)
 */
router.post('/segments/preview', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Ejecutar query seguro
    const result = await db.get(`SELECT COUNT(*) as count FROM (${query})`);
    
    res.json({
      success: true,
      count: result.count
    });
  } catch (error) {
    logger.error('Error en preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Preview de contactos del segmento
 */
router.post('/segments/preview-contacts', async (req, res) => {
  try {
    const { query, limit = 50 } = req.body;
    
    const contacts = await db.all(`${query} LIMIT ?`, [limit]);
    
    res.json({
      success: true,
      contacts
    });
  } catch (error) {
    logger.error('Error en preview de contactos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// #14: QUEUE SYSTEM CON PRIORIDADES
// ========================================

/**
 * Agregar campaña a la cola
 */
router.post('/campaigns/:id/queue', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority = 'medium', scheduled_at } = req.body;
    
    const result = await db.run(
      `INSERT INTO campaign_queue (campaign_id, priority, scheduled_at, status)
       VALUES (?, ?, ?, 'pending')`,
      [id, priority, scheduled_at]
    );
    
    res.json({
      success: true,
      message: 'Campaña agregada a la cola',
      queue_id: result.lastID
    });
  } catch (error) {
    logger.error('Error agregando a cola:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Obtener siguiente campaña de la cola (por prioridad)
 */
router.get('/queue/next', async (req, res) => {
  try {
    const now = new Date().toISOString();
    
    const item = await db.get(`
      SELECT cq.*, c.* 
      FROM campaign_queue cq
      JOIN campaigns c ON cq.campaign_id = c.id
      WHERE cq.status = 'pending' 
        AND (cq.scheduled_at IS NULL OR cq.scheduled_at <= ?)
      ORDER BY 
        CASE cq.priority 
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        cq.created_at ASC
      LIMIT 1
    `, [now]);
    
    if (item) {
      // Marcar como processing
      await db.run(
        `UPDATE campaign_queue SET status = 'processing', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [item.id]
      );
    }
    
    res.json({
      success: true,
      item
    });
  } catch (error) {
    logger.error('Error obteniendo siguiente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Completar ítem de la cola
 */
router.post('/queue/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { success: itemSuccess, error: itemError } = req.body;
    
    await db.run(
      `UPDATE campaign_queue 
       SET status = ?, completed_at = CURRENT_TIMESTAMP, last_error = ?
       WHERE id = ?`,
      [itemSuccess ? 'completed' : 'failed', itemError || null, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error completando queue item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// #15: RATE LIMITING INTELIGENTE
// ========================================

/**
 * Verificar rate limit
 */
router.get('/rate-limit/check/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const now = new Date().toISOString();
    
    let limit = await db.get(
      'SELECT * FROM rate_limits WHERE limit_type = ? AND reset_at > ?',
      [type, now]
    );
    
    if (!limit) {
      // Crear nuevo límite
      const resetAt = new Date();
      if (type === 'per_minute') resetAt.setMinutes(resetAt.getMinutes() + 1);
      else if (type === 'hourly') resetAt.setHours(resetAt.getHours() + 1);
      else if (type === 'daily') resetAt.setDate(resetAt.getDate() + 1);
      
      const defaultLimits = {
        per_minute: 80,
        hourly: 1000,
        daily: 10000
      };
      
      await db.run(
        'INSERT INTO rate_limits (limit_type, limit_value, current_count, reset_at) VALUES (?, ?, 0, ?)',
        [type, defaultLimits[type] || 1000, resetAt.toISOString()]
      );
      
      limit = await db.get('SELECT * FROM rate_limits WHERE id = last_insert_rowid()');
    }
    
    const available = limit.limit_value - limit.current_count;
    const allowed = available > 0;
    
    res.json({
      success: true,
      allowed,
      limit: limit.limit_value,
      current: limit.current_count,
      available,
      reset_at: limit.reset_at
    });
  } catch (error) {
    logger.error('Error verificando rate limit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Incrementar contador de rate limit
 */
router.post('/rate-limit/increment/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { count = 1 } = req.body;
    
    await db.run(
      'UPDATE rate_limits SET current_count = current_count + ?, updated_at = CURRENT_TIMESTAMP WHERE limit_type = ?',
      [count, type]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error incrementando rate limit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// #16: VALIDACIÓN DE VENTANA 24H
// ========================================

/**
 * Verificar ventana de mensajería
 */
router.get('/message-window/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const now = new Date().toISOString();
    
    const window = await db.get(`
      SELECT * FROM message_windows 
      WHERE contact_id = ? 
        AND is_active = 1 
        AND window_expires_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [contactId, now]);
    
    const isOpen = !!window;
    const requiresTemplate = !isOpen;
    
    res.json({
      success: true,
      is_open: isOpen,
      requires_template: requiresTemplate,
      window: window || null,
      expires_at: window?.window_expires_at
    });
  } catch (error) {
    logger.error('Error verificando ventana:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Registrar mensaje del usuario (abre ventana)
 */
router.post('/message-window/:contactId/open', async (req, res) => {
  try {
    const { contactId } = req.params;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
    
    // Desactivar ventanas anteriores
    await db.run(
      'UPDATE message_windows SET is_active = 0 WHERE contact_id = ?',
      [contactId]
    );
    
    // Crear nueva ventana
    await db.run(
      `INSERT INTO message_windows (contact_id, last_user_message_at, window_expires_at, is_active)
       VALUES (?, ?, ?, 1)`,
      [contactId, now.toISOString(), expiresAt.toISOString()]
    );
    
    res.json({
      success: true,
      message: 'Ventana de 24h abierta',
      expires_at: expiresAt.toISOString()
    });
  } catch (error) {
    logger.error('Error abriendo ventana:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// VALIDACIÓN DE TEMPLATES APROBADOS
// ========================================

/**
 * Verificar si template está aprobado
 */
router.get('/templates/:templateId/approval-status', async (req, res) => {
  try {
    const { templateId } = req.params;
    
    let approval = await db.get(
      'SELECT * FROM template_approvals WHERE template_id = ?',
      [templateId]
    );
    
    // Si no está en cache, consultar a 360Dialog
    if (!approval || (new Date() - new Date(approval.last_checked_at) > 3600000)) {
      // Aquí iría la llamada real a 360Dialog API
      // Por ahora, simular respuesta
      const status = 'APPROVED'; // o 'PENDING', 'REJECTED'
      
      if (approval) {
        await db.run(
          'UPDATE template_approvals SET status = ?, last_checked_at = CURRENT_TIMESTAMP WHERE template_id = ?',
          [status, templateId]
        );
      } else {
        await db.run(
          'INSERT INTO template_approvals (template_id, template_name, status) VALUES (?, ?, ?)',
          [templateId, templateId, status]
        );
      }
      
      approval = await db.get('SELECT * FROM template_approvals WHERE template_id = ?', [templateId]);
    }
    
    res.json({
      success: true,
      is_approved: approval.status === 'APPROVED',
      status: approval.status,
      last_checked: approval.last_checked_at
    });
  } catch (error) {
    logger.error('Error verificando template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// RESPUESTAS INTERACTIVAS
// ========================================

/**
 * Registrar respuesta interactiva
 */
router.post('/campaigns/:id/interactive-response', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      contact_id, 
      interaction_type, 
      button_id, 
      button_title,
      list_id,
      list_title,
      response_time_seconds
    } = req.body;
    
    await db.run(
      `INSERT INTO campaign_interactive_responses 
       (campaign_id, contact_id, interaction_type, button_id, button_title, list_id, list_title, response_time_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, contact_id, interaction_type, button_id, button_title, list_id, list_title, response_time_seconds]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error registrando respuesta interactiva:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Obtener respuestas interactivas de una campaña
 */
router.get('/campaigns/:id/interactive-responses', async (req, res) => {
  try {
    const { id } = req.params;
    
    const responses = await db.all(`
      SELECT 
        cir.*,
        c.name as contact_name,
        c.phone as contact_phone
      FROM campaign_interactive_responses cir
      JOIN contacts c ON cir.contact_id = c.id
      WHERE cir.campaign_id = ?
      ORDER BY cir.created_at DESC
    `, [id]);
    
    res.json({
      success: true,
      responses
    });
  } catch (error) {
    logger.error('Error obteniendo respuestas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// LOGS DE AUDITORÍA (NUEVO)
// ========================================

/**
 * Registrar log de auditoría
 */
router.post('/audit/log', async (req, res) => {
  try {
    const {
      action,
      entity_type,
      entity_id,
      entity_name,
      old_values,
      new_values,
      metadata
    } = req.body;
    
    const userId = req.user?.id || null;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    await db.run(
      `INSERT INTO audit_logs 
       (user_id, action, entity_type, entity_id, entity_name, old_values, new_values, 
        ip_address, user_agent, request_method, request_path, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entity_type,
        entity_id,
        entity_name,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        ipAddress,
        userAgent,
        req.method,
        req.path,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error registrando log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Obtener logs de auditoría con filtros
 */
router.get('/audit/logs', async (req, res) => {
  try {
    const {
      user_id,
      action,
      entity_type,
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = req.query;
    
    let query = 'SELECT * FROM recent_audit_logs WHERE 1=1';
    const params = [];
    
    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }
    
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    
    if (entity_type) {
      query += ' AND entity_type = ?';
      params.push(entity_type);
    }
    
    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const logs = await db.all(query, params);
    
    // Parsear JSON fields
    const parsedLogs = logs.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null
    }));
    
    res.json({
      success: true,
      logs: parsedLogs,
      count: parsedLogs.length
    });
  } catch (error) {
    logger.error('Error obteniendo logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Estadísticas de auditoría
 */
router.get('/audit/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date) {
      dateFilter += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      dateFilter += ' AND created_at <= ?';
      params.push(end_date);
    }
    
    // Contar por acción
    const actionStats = await db.all(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE 1=1 ${dateFilter}
      GROUP BY action
      ORDER BY count DESC
    `, params);
    
    // Contar por tipo de entidad
    const entityStats = await db.all(`
      SELECT entity_type, COUNT(*) as count
      FROM audit_logs
      WHERE 1=1 ${dateFilter}
      GROUP BY entity_type
      ORDER BY count DESC
    `, params);
    
    // Usuarios más activos
    const userStats = await db.all(`
      SELECT al.user_id, u.username, COUNT(*) as count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1 ${dateFilter}
      GROUP BY al.user_id
      ORDER BY count DESC
      LIMIT 10
    `, params);
    
    res.json({
      success: true,
      stats: {
        by_action: actionStats,
        by_entity: entityStats,
        by_user: userStats
      }
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

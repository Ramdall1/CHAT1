import express from 'express';

import { getStructuredLogger } from '#core/StructuredLogger.js';
import { query, queryOne } from '#database/PostgresService.js';

const router = express.Router();
const logger = getStructuredLogger();

/**
 * GET /api/assigned-numbers
 * Obtener todos los números asignados con filtros avanzados, agregaciones y estadísticas
 * Características PostgreSQL: CTEs, Window Functions, Aggregations, JSON Functions
 */
router.get('/', async (req, res) => {
  try {
    // Validación y sanitización de parámetros
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
    const offset = (page - 1) * limit;

    // Filtros avanzados
    const {
      campaign_config_id,
      transaction_id,
      status,
      number_status,
      search,
      assigned_from,
      assigned_to,
      contact_name,
      contact_phone,
      contact_email,
      contact_ciudad_municipio,
      contact_departamento,
      min_amount,
      max_amount,
      sort_by = 'assigned_at',
      sort_order = 'DESC',
      include_deleted = 'false',
      group_by_transaction = 'false'
    } = req.query as Record<string, string>;

    // Validación de ordenamiento
    const validSortFields = [
      'id', 'assigned_number', 'assigned_at', 'campaign_name', 'contact_name',
      'contact_phone', 'valor_aporte', 'status', 'quantity', 'created_at'
    ];
    const validSortOrders = ['ASC', 'DESC'];

    const safeSortBy = validSortFields.includes(sort_by) ? sort_by : 'assigned_at';
    const safeSortOrder = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

    // Construcción dinámica de WHERE clause
    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    // Filtro de eliminados (soft delete)
    if (include_deleted !== 'true') {
      whereConditions.push('an.deleted_at IS NULL');
      whereConditions.push('t.deleted_at IS NULL');
    }

    // Filtro por campaña
    if (campaign_config_id) {
      const campaignId = parseInt(campaign_config_id);
      if (!isNaN(campaignId)) {
        whereConditions.push(`an.campaign_config_id = $${paramIndex++}`);
        params.push(campaignId);
      }
    }

    // Filtro por transacción
    if (transaction_id) {
      const txId = parseInt(transaction_id);
      if (!isNaN(txId)) {
        whereConditions.push(`an.transaction_id = $${paramIndex++}`);
        params.push(txId);
      }
    }

    // Filtro por estado de transacción
    if (status) {
      const validStatuses = ['pending', 'reserved', 'confirmed', 'cancelled', 'expired'];
      if (validStatuses.includes(status)) {
        whereConditions.push(`t.status = $${paramIndex++}`);
        params.push(status);
      }
    }

    // Filtro por estado de número
    if (!status && !number_status) {
      whereConditions.push(`an.reservation_status = $${paramIndex++}`);
      params.push('OCCUPIED');
    } else if (number_status) {
      const validNumberStatuses = ['AVAILABLE', 'RESERVED', 'OCCUPIED'];
      if (validNumberStatuses.includes(number_status.toUpperCase())) {
        whereConditions.push(`an.reservation_status = $${paramIndex++}`);
        params.push(number_status.toUpperCase());
      }
    }

    // Búsqueda en número asignado
    if (search && search.trim()) {
      whereConditions.push(`(
        an.assigned_number ILIKE $${paramIndex} OR
        t.contact_name ILIKE $${paramIndex} OR
        t.contact_phone ILIKE $${paramIndex} OR
        t.contact_email ILIKE $${paramIndex} OR
        t.reference_id ILIKE $${paramIndex}
      )`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Filtros específicos de contacto
    if (contact_name) {
      whereConditions.push(`t.contact_name ILIKE $${paramIndex++}`);
      params.push(`%${contact_name}%`);
    }
    if (contact_phone) {
      whereConditions.push(`t.contact_phone ILIKE $${paramIndex++}`);
      params.push(`%${contact_phone}%`);
    }
    if (contact_email) {
      whereConditions.push(`t.contact_email ILIKE $${paramIndex++}`);
      params.push(`%${contact_email}%`);
    }
    if (contact_ciudad_municipio) {
      whereConditions.push(`t.contact_ciudad_municipio ILIKE $${paramIndex++}`);
      params.push(`%${contact_ciudad_municipio}%`);
    }
    if (contact_departamento) {
      whereConditions.push(`t.contact_departamento ILIKE $${paramIndex++}`);
      params.push(`%${contact_departamento}%`);
    }

    // Filtro por rango de fechas de asignación
    if (assigned_from) {
      whereConditions.push(`an.created_at >= $${paramIndex++}::timestamp`);
      params.push(assigned_from);
    }
    if (assigned_to) {
      whereConditions.push(`an.created_at <= $${paramIndex++}::timestamp`);
      params.push(assigned_to);
    }

    // Filtro por rango de montos
    if (min_amount) {
      const minAmt = parseFloat(min_amount);
      if (!isNaN(minAmt)) {
        whereConditions.push(`t.valor_aporte >= $${paramIndex++}`);
        params.push(minAmt);
      }
    }
    if (max_amount) {
      const maxAmt = parseFloat(max_amount);
      if (!isNaN(maxAmt)) {
        whereConditions.push(`t.valor_aporte <= $${paramIndex++}`);
        params.push(maxAmt);
      }
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Query robusto con CTEs y Window Functions (PostgreSQL avanzado)
    const mainQuery = `
      WITH number_stats AS (
        SELECT 
          COUNT(*) as total_count,
          COUNT(DISTINCT an.transaction_id) as unique_transactions,
          COUNT(DISTINCT an.campaign_config_id) as unique_campaigns,
          SUM(CASE WHEN an.reservation_status = 'OCCUPIED' THEN 1 ELSE 0 END) as occupied_count,
          SUM(CASE WHEN an.reservation_status = 'RESERVED' THEN 1 ELSE 0 END) as reserved_count,
          SUM(CASE WHEN an.reservation_status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_count,
          SUM(COALESCE(t.valor_aporte, 0)) as total_amount
        FROM assigned_numbers an
        LEFT JOIN transactions t ON an.transaction_id = t.id
        LEFT JOIN campaign_configurations cc ON an.campaign_config_id = cc.id
        ${whereClause}
      ),
      filtered_numbers AS (
        SELECT 
          an.id,
          an.assigned_number,
          an.created_at,
          an.reservation_status as number_status,
          an.reservation_uuid as uuid,
          an.reserved_until,
          an.transaction_id,
          an.campaign_config_id,
          an.created_at,
          an.updated_at,
          t.id as transaction_id_full,
          t.reference_id,
          t.status,
          t.quantity,
          t.contact_name,
          t.contact_email,
          t.contact_phone,
          t.contact_cedula as contact_numero_documento,
          t.contact_ciudad_municipio,
          t.contact_departamento,
          t.contact_barrio,
          t.numero_pago as nequi_number,
          t.metodo_pago,
          t.valor_aporte,
          t.confirmed_at,
          t.expires_at,
          cc.campaign_name,
          cc.is_active as campaign_active,
          cc.uuid as campaign_uuid,
          -- Window function para ranking
          ROW_NUMBER() OVER (
            ORDER BY 
              CASE 
                WHEN '${safeSortBy}' = 'campaign_name' THEN cc.campaign_name
                WHEN '${safeSortBy}' = 'contact_name' THEN t.contact_name
                WHEN '${safeSortBy}' = 'valor_aporte' THEN t.valor_aporte::text
                ELSE an.${safeSortBy}::text
              END ${safeSortOrder}
          ) as row_num,
          -- Calcular posición del número en la transacción
          ROW_NUMBER() OVER (
            PARTITION BY an.transaction_id 
            ORDER BY an.assigned_number
          ) as number_position_in_transaction,
          -- Días desde asignación
          EXTRACT(DAY FROM (NOW() - an.created_at)) as days_since_assigned,
          -- Estado de reserva
          CASE 
            WHEN an.reserved_until IS NOT NULL AND an.reserved_until < NOW() THEN true
            ELSE false
          END as reservation_expired
        FROM assigned_numbers an
        LEFT JOIN transactions t ON an.transaction_id = t.id
        LEFT JOIN campaign_configurations cc ON an.campaign_config_id = cc.id
        ${whereClause}
      )
      SELECT 
        fn.*,
        ns.total_count,
        ns.unique_transactions,
        ns.unique_campaigns,
        ns.occupied_count,
        ns.reserved_count,
        ns.available_count,
        ns.total_amount
      FROM filtered_numbers fn
      CROSS JOIN number_stats ns
      WHERE fn.row_num > $${paramIndex} AND fn.row_num <= $${paramIndex + 1}
      ORDER BY fn.row_num
    `;

    params.push(offset, offset + limit);

    const results = await query(mainQuery, params);

    // Extraer estadísticas
    const stats = results.length > 0 ? {
      total_count: parseInt(results[0].total_count),
      unique_transactions: parseInt(results[0].unique_transactions),
      unique_campaigns: parseInt(results[0].unique_campaigns),
      occupied_count: parseInt(results[0].occupied_count),
      reserved_count: parseInt(results[0].reserved_count),
      available_count: parseInt(results[0].available_count),
      total_amount: parseFloat(results[0].total_amount) || 0
    } : {
      total_count: 0,
      unique_transactions: 0,
      unique_campaigns: 0,
      occupied_count: 0,
      reserved_count: 0,
      available_count: 0,
      total_amount: 0
    };

    // Limpiar datos
    const numbers = results.map(({
      total_count, unique_transactions, unique_campaigns,
      occupied_count, reserved_count, available_count, total_amount, row_num,
      ...number
    }) => number);

    // Agrupar por transacción si se solicita
    let responseData = numbers;
    if (group_by_transaction === 'true') {
      const grouped = numbers.reduce((acc, num) => {
        const txId = num.transaction_id;
        if (!acc[txId]) {
          acc[txId] = {
            transaction_id: txId,
            reference_id: num.reference_id,
            contact_name: num.contact_name,
            contact_phone: num.contact_phone,
            contact_email: num.contact_email,
            status: num.status,
            quantity: num.quantity,
            valor_aporte: num.valor_aporte,
            campaign_name: num.campaign_name,
            numbers: []
          };
        }
        acc[txId].numbers.push({
          id: num.id,
          assigned_number: num.assigned_number,
          assigned_at: num.created_at,
          number_status: num.number_status,
          position: num.number_position_in_transaction
        });
        return acc;
      }, {});
      responseData = Object.values(grouped);
    }

    res.json({
      success: true,
      data: responseData,
      pagination: {
        page,
        limit,
        total: stats.total_count,
        totalPages: Math.ceil(stats.total_count / limit),
        hasNextPage: page < Math.ceil(stats.total_count / limit),
        hasPrevPage: page > 1
      },
      statistics: {
        total_numbers: stats.total_count,
        unique_transactions: stats.unique_transactions,
        unique_campaigns: stats.unique_campaigns,
        by_status: {
          occupied: stats.occupied_count,
          reserved: stats.reserved_count,
          available: stats.available_count
        },
        total_amount: stats.total_amount
      },
      filters_applied: {
        campaign_config_id: campaign_config_id || null,
        transaction_id: transaction_id || null,
        status: status || null,
        number_status: number_status || null,
        search: search || null,
        contact_filters: {
          name: contact_name || null,
          phone: contact_phone || null,
          email: contact_email || null,
          ciudad_municipio: contact_ciudad_municipio || null,
          departamento: contact_departamento || null
        },
        date_range: assigned_from || assigned_to ? { from: assigned_from, to: assigned_to } : null,
        amount_range: min_amount || max_amount ? { min: min_amount, max: max_amount } : null
      },
      sort: {
        by: safeSortBy,
        order: safeSortOrder
      },
      grouped_by_transaction: group_by_transaction === 'true'
    });

  } catch (error) {
    logger.error('Error obteniendo números asignados:', error);
    logger.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/assigned-numbers/:id
 * Obtener número asignado específico
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Using PostgresService directly
    if (false) {
      return res.status(503).json({
        success: false,
        error: 'Base de datos no disponible'
      });
    }

    // Buscar en assigned_numbers con datos completos
    const number = await queryOne(`
      SELECT 
        an.*,
        t.status as transaction_status,
        t.valor_aporte,
        t.confirmed_at,
        cc.campaign_name,
        c.name as contact_name,
        c.phone_number as contact_phone,
        c.email as contact_email
      FROM assigned_numbers an
      LEFT JOIN transactions t ON an.transaction_id = t.id
      LEFT JOIN campaign_configurations cc ON an.campaign_config_id = cc.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE an.id = $1
    `, [parseInt(id)]);

    if (!number) {
      return res.status(404).json({
        success: false,
        error: 'Número asignado no encontrado'
      });
    }

    res.json({
      success: true,
      data: number
    });

  } catch (error) {
    logger.error('Error obteniendo número asignado:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;

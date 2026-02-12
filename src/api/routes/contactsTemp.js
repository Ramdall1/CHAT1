import express from 'express';
import { createLogger } from '../../services/core/core/logger.js';
import DatabaseManager from '../../config/database/DatabaseManager.js';

const router = express.Router();
const logger = createLogger('CONTACTS_TEMP');

/**
 * GET /contactsTemp
 * Endpoint temporal para obtener contactos sin autenticación
 */
router.get('/', async (req, res) => {
  try {
    logger.info('📞 Obteniendo contactos (endpoint temporal)...');
    
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const db = DatabaseManager.getInstance();
    await db.initialize();
    const offset = (page - 1) * limit;

    // Construir query dinámicamente
    let whereClause = '';
    const params = [];
    
    if (search) {
      whereClause = 'WHERE name LIKE ? OR phone_number LIKE ? OR email LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Query para obtener contactos
    const contactsQuery = `
      SELECT 
        id, name, phone_number, email, tags, 
        is_blocked, created_at, updated_at
      FROM contacts 
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order.toUpperCase()}
      LIMIT ? OFFSET ?
    `;
    
    params.push(parseInt(limit), parseInt(offset));

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM contacts 
      ${whereClause}
    `;
    
    const countParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

    // Ejecutar queries
    const contacts = await db.getAllQuery(contactsQuery, params);
    const countResult = await db.getQuery(countQuery, countParams);
    
    // Procesar tags (convertir de JSON string a array)
    const processedContacts = contacts.map(contact => ({
      ...contact,
      tags: contact.tags ? JSON.parse(contact.tags) : [],
      is_blocked: Boolean(contact.is_blocked)
    }));

    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    logger.info(`✅ Contactos obtenidos: ${contacts.length} de ${total} total`);

    res.json({
      success: true,
      data: processedContacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    logger.error('❌ Error obteniendo contactos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

export default router;
/**
 * Contact Routes - Rutas simplificadas para gestión de contactos
 * Sin middlewares complejos que causan problemas de dependencias
 */
import express from 'express';
import { createLogger } from '../../services/core/core/logger.js';
import sqlite3 from 'sqlite3';
import path from 'path';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = express.Router();
const logger = createLogger('CONTACT_ROUTES');

// Configurar multer para subida de archivos
const storage = multer.memoryStorage(); // Usar memory storage para procesar archivos en memoria
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
  },
  fileFilter: (req, file, cb) => {
    // Aceptar solo archivos Excel y CSV
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv'
    ];

    const allowedExtensions = ['.xlsx', '.xls', '.csv'];

    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(fileExtension) ||
        allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado. Use .xlsx, .xls o .csv'));
    }
  }
});

logger.info('✅ Contact Routes Module Loaded Successfully');

/**
 * GET /contacts
 * Obtener lista de contactos con paginación y filtros
 */
router.get('/', async (req, res) => {
 try {
   const {
     page = 1,
     limit = 50,
     all, // Nuevo parámetro para obtener todos los contactos sin límite
     search,
     tags,
     tag,
     custom_field,
     is_blocked,
     group,
     status,
     sort_by = 'updated_at',  // ✅ Ordenar por última actividad por defecto
    sort_order = 'desc',
     timeRange, // Nuevo filtro de tiempo: '1h', '24h', '7d', '30d', '90d', '1y'
     date_from, // Fecha desde (YYYY-MM-DD)
     date_to    // Fecha hasta (YYYY-MM-DD)
   } = req.query;

    // Si se especifica 'all=true', obtener todos los contactos sin paginación
    const isUnlimited = all === 'true' || all === '1';
    const actualLimit = isUnlimited ? null : parseInt(limit);
    
    logger.info(`📋 GET /contacts - page: ${page}, limit: ${limit}, search: "${search || ''}", tag: "${tag || ''}", timeRange: "${timeRange || ''}", date_from: "${date_from || ''}", date_to: "${date_to || ''}", custom_field: "${custom_field || ''}"`);
    
    // Usar SQLite directamente
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);
    
    const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const offset = isUnlimited ? 0 : (page - 1) * actualLimit;

    // Construir query dinámicamente
    const whereConditions = [];
    const params = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR phone_number LIKE ? OR email LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (tags) {
      // Buscar etiqueta exacta dentro del JSON array
      whereConditions.push(`tags LIKE ? OR tags LIKE ? OR tags LIKE ? OR tags LIKE ?`);
      params.push(`%"${tags}"%`, `%'${tags}'%`, `[${tags},`, `,"${tags}"]`);
    }

    // Filtro por etiqueta individual
    if (tag) {
      // Buscar etiqueta exacta dentro del JSON array
      whereConditions.push(`tags LIKE ? OR tags LIKE ? OR tags LIKE ? OR tags LIKE ?`);
      params.push(`%"${tag}"%`, `%'${tag}'%`, `[${tag},`, `,"${tag}"]`);
    }

    if (is_blocked !== undefined) {
      whereConditions.push('status = ?');
      params.push(is_blocked === 'true' ? 'blocked' : 'active');
    }

    // Filtro por status (alternativa a is_blocked)
    if (status) {
      whereConditions.push('status = ?');
      params.push(status === 'blocked' ? 'blocked' : 'active');
    }

    // Filtro por grupo (pendiente de implementar en DB)
    // if (group) {
    //   whereConditions.push('group_id = ?');
    //   params.push(group);
    // }

    // Filtros de tiempo
    if (timeRange) {
      const now = new Date();
      let startDate;

      switch (timeRange) {
        case '1h':
          startDate = new Date(now - 1 * 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          // Rango de tiempo inválido, ignorar
          break;
      }

      if (startDate) {
        whereConditions.push('created_at >= ?');
        params.push(startDate.toISOString());
      }
    }

    // Filtros de fecha personalizados
    if (date_from) {
      try {
        const fromDate = new Date(date_from);
        if (!isNaN(fromDate.getTime())) {
          whereConditions.push('created_at >= ?');
          params.push(fromDate.toISOString().split('T')[0] + ' 00:00:00');
        }
      } catch (error) {
        logger.warn('Fecha desde inválida:', date_from);
      }
    }

    if (date_to) {
      try {
        const toDate = new Date(date_to);
        if (!isNaN(toDate.getTime())) {
          whereConditions.push('created_at <= ?');
          params.push(toDate.toISOString().split('T')[0] + ' 23:59:59');
        }
      } catch (error) {
        logger.warn('Fecha hasta inválida:', date_to);
      }
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Query para contar total
    const countQuery = `SELECT COUNT(*) as total FROM contacts ${whereClause}`;
    const totalResult = await queryGet(countQuery, params);
    const total = totalResult ? totalResult.total : 0;

    // Query principal - con o sin paginación
    let query;
    let queryParams = [...params];

    if (isUnlimited) {
      // Sin límite - obtener todos los contactos
      query = `
                SELECT id, phone_number as phone, name, email, tags, status,
                        created_at, updated_at, updated_at as last_message_at
                FROM contacts
                ${whereClause}
                ORDER BY ${sort_by} ${sort_order.toUpperCase()}
            `;
    } else {
      // Con paginación
      query = `
                SELECT id, phone_number as phone, name, email, tags, status,
                        created_at, updated_at, updated_at as last_message_at
                FROM contacts
                ${whereClause}
                ORDER BY ${sort_by} ${sort_order.toUpperCase()}
                LIMIT ? OFFSET ?
            `;
      queryParams.push(actualLimit, offset);
    }

    let contacts = await queryAll(query, queryParams);
    
    // Procesar tags (convertir de JSON string a array si existe)
    let processedContacts = contacts.map(contact => ({
      ...contact,
      phone_number: contact.phone, // Añadir alias para compatibilidad
      tags: contact.tags ? (typeof contact.tags === 'string' ? JSON.parse(contact.tags) : contact.tags) : [],
      is_blocked: contact.status === 'blocked'
    }));
    
    // Filtrar por campo personalizado si se especifica
    if (custom_field) {
      try {
        // Cargar datos de campos personalizados desde archivo JSON
        const fs = await import('fs/promises');
        const contactFieldsPath = path.join(process.cwd(), 'data', 'contact-custom-fields.json');
        
        let contactCustomFields = {};
        try {
          const data = await fs.readFile(contactFieldsPath, 'utf8');
          contactCustomFields = JSON.parse(data);
        } catch (err) {
          logger.warn('⚠️ No se encontró archivo de campos personalizados');
        }
        
        // Filtrar contactos que tengan el campo personalizado especificado
        processedContacts = processedContacts.filter(contact => {
          const contactFields = contactCustomFields[contact.id];
          if (!contactFields || !Array.isArray(contactFields)) return false;
          
          // Verificar si el contacto tiene el campo especificado
          return contactFields.some(field => field.field_id === custom_field);
        });
        
        logger.info(`🔍 Filtrados por campo personalizado "${custom_field}": ${processedContacts.length} contactos`);
      } catch (error) {
        logger.error('❌ Error filtrando por campo personalizado:', error);
      }
    }
    
    db.close();
    
    logger.info(`✅ ${processedContacts.length} contactos encontrados de ${total} total`);
          
    // Preparar respuesta de paginación
    let pagination = null;
    if (!isUnlimited) {
      const finalTotal = custom_field ? processedContacts.length : total;
      pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total: finalTotal,
        pages: Math.ceil(finalTotal / parseInt(limit)),
        has_next: page * parseInt(limit) < finalTotal,
        has_prev: page > 1
      };
    }

    res.json({
      success: true,
      data: processedContacts,
      pagination: pagination,
      unlimited: isUnlimited // Indicar si es una consulta sin límites
    });
          
  } catch (error) {
    logger.error('❌ Error obteniendo contactos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /contacts/groups
 * Obtener lista de grupos de contactos
 */
router.get('/groups', async (req, res) => {
  try {
    // Por ahora retornar array vacío ya que no tenemos tabla de grupos
    // En el futuro se puede implementar con una tabla dedicada
    logger.info('📁 Obteniendo grupos de contactos');
    
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    logger.error('❌ Error obteniendo grupos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /contacts/:id
 * Obtener un contacto específico
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`📋 GET /contacts/${id}`);

    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const contact = await queryGet(
      'SELECT id, phone_number as phone, name, first_name, last_name, email, tags, status, created_at, updated_at FROM contacts WHERE id = ?',
      [id]
    );

    db.close();

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contacto no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        ...contact,
        phone_number: contact.phone,
        tags: contact.tags ? JSON.parse(contact.tags) : [],
        is_blocked: contact.status === 'blocked'
      }
    });

  } catch (error) {
    logger.error('❌ Error obteniendo contacto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * PUT /contacts/:id
 * Actualizar un contacto específico
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, first_name, last_name, email, phone_number, tags, status } = req.body;

    logger.info(`📝 PUT /contacts/${id} - Actualizando contacto`);

    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });

    // Verificar que el contacto existe
    const existingContact = await queryGet('SELECT * FROM contacts WHERE id = ?', [id]);
    if (!existingContact) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Contacto no encontrado'
      });
    }

    // Construir actualización dinámica
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (first_name !== undefined) {
      updates.push('first_name = ?');
      params.push(first_name);
    }

    if (last_name !== undefined) {
      updates.push('last_name = ?');
      params.push(last_name);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }

    if (phone_number !== undefined) {
      updates.push('phone_number = ?');
      // Normalizar número de teléfono: remover +, -, espacios, paréntesis
      let normalizedPhone = phone_number.toString().trim()
        .replace(/^\+/, '')  // Remover + al inicio
        .replace(/[\s\-\(\)]/g, '');  // Remover espacios, guiones, paréntesis
      
      // Si no comienza con 57 (prefijo de Colombia), agregarlo
      if (!normalizedPhone.startsWith('57')) {
        normalizedPhone = '57' + normalizedPhone;
      }
      params.push(normalizedPhone);
    }

    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    // Siempre actualizar updated_at
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    if (updates.length === 1) { // Solo updated_at
      db.close();
      return res.json({
        success: true,
        message: 'No se realizaron cambios'
      });
    }

    const updateQuery = `UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    const result = await queryRun(updateQuery, params);

    db.close();

    logger.info(`✅ Contacto ${id} actualizado correctamente`);

    res.json({
      success: true,
      message: 'Contacto actualizado correctamente',
      changes: result.changes
    });

  } catch (error) {
    logger.error('❌ Error actualizando contacto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /contacts/:id/custom-fields
 * Obtener campos personalizados de un contacto
 */
router.get('/:id/custom-fields', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`📋 GET /contacts/${id}/custom-fields`);

    // Importar la función de BD
    const { loadContactCustomFields } = await import('../services/persistence/customFieldsPersistenceSQL.js');
    
    // Cargar campos personalizados desde BD
    const fields = await loadContactCustomFields(id);

    res.json({
      success: true,
      data: fields
    });

  } catch (error) {
    logger.error('❌ Error obteniendo campos personalizados:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /tags
 * Obtener todas las etiquetas disponibles
 */
router.get('/tags', async (req, res) => {
  try {
    logger.info('🏷️ GET /tags - Obteniendo etiquetas disponibles');

    // Por ahora retornar etiquetas hardcodeadas comunes
    // En el futuro se puede implementar una tabla dedicada
    const availableTags = [
      { id: 'vip', name: 'VIP', color: '#FFD700', description: 'Clientes VIP' },
      { id: 'prospect', name: 'Prospecto', color: '#87CEEB', description: 'Prospectos potenciales' },
      { id: 'customer', name: 'Cliente', color: '#32CD32', description: 'Clientes activos' },
      { id: 'inactive', name: 'Inactivo', color: '#FF6347', description: 'Clientes inactivos' },
      { id: 'lead', name: 'Lead', color: '#FFA500', description: 'Leads calificados' },
      { id: 'support', name: 'Soporte', color: '#DC143C', description: 'Casos de soporte' }
    ];

    res.json({
      success: true,
      data: availableTags
    });

  } catch (error) {
    logger.error('❌ Error obteniendo etiquetas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /tags/contact/:contactId
 * Obtener etiquetas de un contacto específico
 */
router.get('/tags/contact/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;

    logger.info(`🏷️ GET /tags/contact/${contactId} - Obteniendo etiquetas del contacto`);

    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const contact = await queryGet('SELECT tags FROM contacts WHERE id = ?', [contactId]);

    db.close();

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contacto no encontrado'
      });
    }

    const tags = contact.tags ? JSON.parse(contact.tags) : [];

    res.json({
      success: true,
      data: tags
    });

  } catch (error) {
    logger.error('❌ Error obteniendo etiquetas del contacto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /tags
 * Crear una nueva etiqueta
 */
router.post('/tags', async (req, res) => {
  try {
    const { name, color, description } = req.body;

    if (!name || !color) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y color son requeridos'
      });
    }

    logger.info(`🏷️ POST /tags - Creando etiqueta: ${name}`);

    // Por ahora solo validar, en el futuro guardar en BD
    const newTag = {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      color,
      description: description || '',
      created_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      data: newTag,
      message: 'Etiqueta creada correctamente'
    });

  } catch (error) {
    logger.error('❌ Error creando etiqueta:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /tags/folders
 * Obtener carpetas de etiquetas (para organización)
 */
router.get('/tags/folders', async (req, res) => {
  try {
    logger.info('📁 GET /tags/folders - Obteniendo carpetas de etiquetas');

    // Por ahora retornar carpetas hardcodeadas
    const folders = [
      { id: 'clientes', name: 'Clientes', color: '#32CD32', tags: ['vip', 'customer', 'inactive'] },
      { id: 'prospectos', name: 'Prospectos', color: '#87CEEB', tags: ['prospect', 'lead'] },
      { id: 'soporte', name: 'Soporte', color: '#DC143C', tags: ['support'] }
    ];

    res.json({
      success: true,
      data: folders
    });

  } catch (error) {
    logger.error('❌ Error obteniendo carpetas de etiquetas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /contacts/export
 * Exportar contactos
 */
router.get('/export', async (req, res) => {
  try {
    logger.info('📤 Exportando contactos');
    
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const contacts = await queryAll('SELECT id, phone_number as phone, name, email, tags, status, created_at, updated_at FROM contacts ORDER BY created_at DESC');
    
    db.close();
    
    // Procesar para exportación
    const exportData = contacts.map(contact => ({
      ...contact,
      phone_number: contact.phone,
      tags: contact.tags ? JSON.parse(contact.tags) : [],
      is_blocked: contact.status === 'blocked'
    }));
          
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="contacts-export-${new Date().toISOString().split('T')[0]}.json"`);
          
    res.json({
      export_date: new Date().toISOString(),
      total_contacts: exportData.length,
      contacts: exportData
    });
          
  } catch (error) {
    logger.error('❌ Error exportando contactos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * DELETE /contacts/:id
 * Eliminar un contacto y todos sus datos relacionados
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`🗑️ Eliminando contacto ID: ${id} y todos sus datos relacionados`);

    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });

    // Iniciar transacción para asegurar consistencia
    await queryRun('BEGIN TRANSACTION');

    try {
      // 1. Eliminar conversaciones relacionadas
      const conversationsDeleted = await queryRun('DELETE FROM conversations WHERE contact_id = ?', [id]);
      logger.info(`🗑️ Eliminadas ${conversationsDeleted.changes} conversaciones`);

      // 2. Eliminar mensajes relacionados (usando conversation_id)
      const messagesDeleted = await queryRun('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE contact_id = ?)', [id]);
      logger.info(`🗑️ Eliminados ${messagesDeleted.changes} mensajes`);

      // 3. Eliminar relaciones con campañas (solo si la tabla existe)
      let campaignContactsDeleted = { changes: 0 };
      try {
        campaignContactsDeleted = await queryRun('DELETE FROM campaign_contacts WHERE contact_id = ?', [id]);
        logger.info(`🗑️ Eliminadas ${campaignContactsDeleted.changes} relaciones con campañas`);
      } catch (campaignError) {
        if (campaignError.message.includes('no such table')) {
          logger.info(`ℹ️ Tabla campaign_contacts no existe, omitiendo eliminación de relaciones con campañas`);
        } else {
          throw campaignError; // Re-lanzar si es otro tipo de error
        }
      }

      // 4. Eliminar campos personalizados del contacto (desde archivo JSON)
      try {
        const fs = await import('fs/promises');
        const contactFieldsPath = path.join(process.cwd(), 'data', 'contact-custom-fields.json');

        let contactCustomFields = {};
        try {
          const data = await fs.readFile(contactFieldsPath, 'utf8');
          contactCustomFields = JSON.parse(data);
        } catch (err) {
          // Archivo no existe o está vacío
        }

        // Eliminar campos personalizados del contacto
        if (contactCustomFields[id]) {
          delete contactCustomFields[id];
          await fs.writeFile(contactFieldsPath, JSON.stringify(contactCustomFields, null, 2));
          logger.info(`🗑️ Eliminados campos personalizados del contacto ${id}`);
        }
      } catch (error) {
        logger.warn(`⚠️ Error eliminando campos personalizados del contacto ${id}:`, error);
      }

      // 5. Finalmente, eliminar el contacto
      const contactDeleted = await queryRun('DELETE FROM contacts WHERE id = ?', [id]);

      if (contactDeleted.changes === 0) {
        await queryRun('ROLLBACK');
        db.close();
        return res.status(404).json({
          success: false,
          error: 'Contacto no encontrado'
        });
      }

      // Confirmar transacción
      await queryRun('COMMIT');

      logger.info(`✅ Contacto ${id} y todos sus datos relacionados eliminados correctamente`);

      res.json({
        success: true,
        message: 'Contacto y todos sus datos relacionados eliminados correctamente',
        deleted: {
          messages: messagesDeleted.changes,
          conversations: conversationsDeleted.changes,
          campaign_contacts: campaignContactsDeleted.changes,
          contacts: contactDeleted.changes
        }
      });

    } catch (transactionError) {
      await queryRun('ROLLBACK');
      throw transactionError;
    }

    db.close();

  } catch (error) {
    logger.error('❌ Error eliminando contacto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /contacts/import
 * Importar contactos desde archivo CSV/Excel
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    logger.info('📤 Iniciando importación de contactos');

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se encontró el archivo'
      });
    }

    const file = req.file;
    const fileName = file.originalname.toLowerCase();

    logger.info(`📁 Procesando archivo: ${fileName} (${file.size} bytes)`);

    let contactsData = [];

    // Parse Excel file
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      contactsData = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileName.endsWith('.csv')) {
      // Parse CSV
      const csvText = file.buffer.toString('utf8');
      const lines = csvText.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'El archivo CSV no contiene datos suficientes'
        });
      }

      const headers = lines[0].split(',').map(h => h.trim());
      contactsData = lines.slice(1).map(line => {
        const values = line.split(',');
        const contact = {};
        headers.forEach((header, index) => {
          contact[headers[index]] = values[index]?.trim() || '';
        });
        return contact;
      });
    }

    logger.info(`📊 Procesando ${contactsData.length} filas del archivo`);

    if (contactsData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se encontraron datos en el archivo'
      });
    }

    // Process contacts
    let imported = 0;
    let errors = 0;
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });

    const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    for (const row of contactsData) {
      try {
        // Extract data from row
        let phone = row['Telefono '] || row['Telefono'] || row['telefono'] || row['phone'] || '';
        let firstName = row['Nombre'] || row['nombre'] || row['name'] || '';
        let lastName = row['Apellido'] || row['apellido'] || row['lastname'] || '';

        // Skip empty rows
        if (!phone && !firstName) continue;

        // Format phone number
        if (phone) {
          // Convert to string and clean
          phone = phone.toString().replace(/[^0-9]/g, '');

          // Handle Colombian numbers (add 57 if not present, remove + if present)
          if (phone.length === 10 && phone.startsWith('3')) {
            phone = '57' + phone;
          } else if (phone.length === 12 && phone.startsWith('573')) {
            // Already has 57 prefix, keep as is
          } else if (phone.length === 13 && phone.startsWith('573')) {
            // Remove + if present, keep 57 prefix
            phone = phone;
          } else if (phone.length < 10) {
            // Skip invalid phone numbers
            logger.warn(`⚠️ Teléfono inválido omitido: ${phone}`);
            errors++;
            continue;
          }

          // Ensure it starts with 57 and has no +
          if (!phone.startsWith('57')) {
            phone = '57' + phone.replace(/^57/, '');
          }
        }

        // Create full name
        let name = '';
        if (firstName) name += firstName;
        if (lastName) name += (name ? ' ' : '') + lastName;
        if (!name) name = phone || 'Sin nombre';

        // Check if contact already exists
        const existing = await queryGet('SELECT id FROM contacts WHERE phone_number = ?', [phone]);
        if (existing) {
          logger.info(`⚠️ Contacto ya existe, omitiendo: ${phone}`);
          continue;
        }

        // Insert contact
        const result = await queryRun(`
          INSERT INTO contacts (user_id, phone_number, name, status, created_at, updated_at)
          VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [1, phone, name]);

        if (result.lastID) {
          imported++;
          logger.info(`✅ Contacto importado: ${name} (${phone})`);
        } else {
          errors++;
        }

      } catch (rowError) {
        logger.error(`❌ Error procesando fila:`, rowError);
        errors++;
      }
    }

    db.close();

    logger.info(`📊 Importación completada: ${imported} importados, ${errors} errores`);

    res.json({
      success: true,
      imported: imported,
      errors: errors,
      message: `Se importaron ${imported} contactos correctamente${errors > 0 ? ` (${errors} errores)` : ''}`
    });

  } catch (error) {
    logger.error('❌ Error importando contactos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /contacts
 * Crear un nuevo contacto
 */
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, tags, groups, metadata = {}, notes } = req.body;

    // Validar campos requeridos
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'El nombre y teléfono son requeridos'
      });
    }

    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    // Usar tags o groups (groups es del frontend, tags es del backend)
    const tagsArray = tags || groups || [];
    
    // Usar metadata o notes (notes es del frontend, metadata es del backend)
    const metadataObj = metadata || (notes ? { notes } : {});

    // Insertar contacto
    const sql = `
      INSERT INTO contacts (name, phone_number, email, tags, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    // Normalizar número de teléfono: remover +, -, espacios, paréntesis
    let normalizedPhone = phone.trim()
      .replace(/^\+/, '')  // Remover + al inicio
      .replace(/[\s\-\(\)]/g, '');  // Remover espacios, guiones, paréntesis
    
    // Si no comienza con 57 (prefijo de Colombia), agregarlo
    if (!normalizedPhone.startsWith('57')) {
      normalizedPhone = '57' + normalizedPhone;
    }

    const params = [
      name.trim(),
      normalizedPhone,
      email ? email.trim() : null,
      tagsArray.length > 0 ? JSON.stringify(tagsArray) : null,
      Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null
    ];

    db.run(sql, params, function(err) {
      if (err) {
        logger.error('❌ Error creando contacto:', err.message);
        logger.error('📋 SQL:', sql);
        logger.error('📋 Params:', params);
        logger.error('📋 Stack:', err.stack);
        db.close();
        return res.status(500).json({
          success: false,
          error: 'Error al crear contacto',
          details: err.message,
          sql: sql
        });
      }

      const contactId = this.lastID;

      db.close();

      logger.info(`✅ Contacto creado: ${name} (${phone})`);

      res.status(201).json({
        success: true,
        data: {
          id: contactId,
          name,
          phone_number: normalizedPhone,
          email: email || null,
          tags: tagsArray || null,
          metadata: metadataObj || {}
        },
        message: 'Contacto creado exitosamente'
      });
    });

  } catch (error) {
    logger.error('❌ Error en POST /contacts:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

export default router;

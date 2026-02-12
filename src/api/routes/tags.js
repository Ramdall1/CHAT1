/**
 * Tags Routes - Rutas para gestión de etiquetas
 */
import express from 'express';
import { createLogger } from '../../services/core/core/logger.js';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const logger = createLogger('TAGS_ROUTES');

logger.info('✅ Tags Routes Module Loaded Successfully');

// Ruta del archivo de etiquetas
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const tagsFilePath = path.join(__dirname, '../../../data/tags.json');

// Función para cargar etiquetas desde archivo
function loadTags() {
  try {
    if (fs.existsSync(tagsFilePath)) {
      const data = fs.readFileSync(tagsFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Error cargando etiquetas:', error);
  }
  return [];
}

// Función para guardar etiquetas en archivo
function saveTags(tags) {
  try {
    const dir = path.dirname(tagsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`📁 Directorio creado: ${dir}`);
    }
    fs.writeFileSync(tagsFilePath, JSON.stringify(tags, null, 2));
    logger.info(`✅ Etiquetas guardadas en: ${tagsFilePath}`);
    logger.info(`📊 Total de etiquetas guardadas: ${tags.length}`);
  } catch (error) {
    logger.error('❌ Error guardando etiquetas:', error);
  }
}

/**
 * GET /tags
 * Obtener todas las etiquetas disponibles
 */
router.get('/', async (req, res) => {
  try {
    logger.info('🏷️ GET /tags - Obteniendo etiquetas disponibles');

    // Cargar etiquetas desde archivo
    const tags = loadTags();
    logger.info(`📋 ${tags.length} etiquetas cargadas`);

    res.json({
      success: true,
      data: tags
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
router.get('/contact/:contactId', async (req, res) => {
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
router.post('/', async (req, res) => {
  try {
    const { name, color, description, folder } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Nombre es requerido'
      });
    }

    logger.info(`🏷️ POST /tags - Creando etiqueta: ${name}`);

    // Crear la nueva etiqueta
    const newTag = {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      color: color || null,  // Sin color automático
      description: description || '',
      folder: folder || 'Etiquetas',
      created_at: new Date().toISOString()
    };

    // Cargar etiquetas existentes
    const tags = loadTags();
    
    // Verificar si la etiqueta ya existe
    const existingTag = tags.find(t => t.id === newTag.id);
    if (existingTag) {
      return res.status(400).json({
        success: false,
        error: 'La etiqueta ya existe'
      });
    }

    // Agregar la nueva etiqueta
    tags.push(newTag);
    
    // Guardar etiquetas
    saveTags(tags);
    logger.info(`✅ Etiqueta guardada: ${newTag.id}`);

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
 * POST /tags/contact/:contactId
 * Añadir una etiqueta a un contacto
 */
router.post('/contact/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const { tagId } = req.body;

    logger.info(`🏷️ POST /tags/contact/${contactId} - Body recibido:`, JSON.stringify(req.body));
    logger.info(`🏷️ tagId recibido: "${tagId}" (tipo: ${typeof tagId})`);

    if (!tagId) {
      logger.error('❌ tagId es requerido');
      return res.status(400).json({
        success: false,
        error: 'tagId es requerido'
      });
    }

    logger.info(`🏷️ POST /tags/contact/${contactId} - Añadiendo etiqueta ${tagId}`);

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

    // Obtener etiquetas actuales del contacto
    const contact = await queryGet('SELECT tags FROM contacts WHERE id = ?', [contactId]);

    if (!contact) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Contacto no encontrado'
      });
    }

    const currentTags = contact.tags ? JSON.parse(contact.tags) : [];

    // Verificar si la etiqueta ya existe
    if (currentTags.includes(tagId)) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'El contacto ya tiene esta etiqueta'
      });
    }

    // Añadir la nueva etiqueta
    currentTags.push(tagId);

    // Actualizar el contacto
    await queryRun('UPDATE contacts SET tags = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(currentTags), new Date().toISOString(), contactId]);

    db.close();

    res.json({
      success: true,
      message: 'Etiqueta añadida correctamente',
      data: currentTags
    });

  } catch (error) {
    logger.error('❌ Error añadiendo etiqueta al contacto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * DELETE /tags/contact/:contactId/:tagId
 * Remover una etiqueta de un contacto
 */
router.delete('/contact/:contactId/:tagId', async (req, res) => {
  try {
    const { contactId, tagId } = req.params;

    logger.info(`🏷️ DELETE /tags/contact/${contactId}/${tagId} - Removiendo etiqueta`);

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

    // Obtener etiquetas actuales del contacto
    const contact = await queryGet('SELECT tags FROM contacts WHERE id = ?', [contactId]);

    if (!contact) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Contacto no encontrado'
      });
    }

    const currentTags = contact.tags ? JSON.parse(contact.tags) : [];

    // Verificar si la etiqueta existe
    const tagIndex = currentTags.indexOf(tagId);
    if (tagIndex === -1) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'El contacto no tiene esta etiqueta'
      });
    }

    // Remover la etiqueta
    currentTags.splice(tagIndex, 1);

    // Actualizar el contacto
    await queryRun('UPDATE contacts SET tags = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(currentTags), new Date().toISOString(), contactId]);

    db.close();

    res.json({
      success: true,
      message: 'Etiqueta removida correctamente',
      data: currentTags
    });

  } catch (error) {
    logger.error('❌ Error removiendo etiqueta del contacto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * DELETE /tags/:tagId
 * Eliminar una etiqueta completamente (de todos los contactos)
 */
router.delete('/:tagId', async (req, res) => {
  try {
    const { tagId } = req.params;

    logger.info(`🏷️ DELETE /tags/${tagId} - Eliminando etiqueta completamente`);

    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });

    // Obtener todos los contactos que tienen esta etiqueta
    const contacts = await queryAll('SELECT id, tags FROM contacts WHERE tags LIKE ?',
      [`%${tagId}%`]);

    let updatedContacts = 0;

    // Remover la etiqueta de cada contacto
    for (const contact of contacts) {
      const currentTags = contact.tags ? JSON.parse(contact.tags) : [];
      const filteredTags = currentTags.filter(tag => tag !== tagId);

      if (filteredTags.length !== currentTags.length) {
        await queryRun('UPDATE contacts SET tags = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(filteredTags), new Date().toISOString(), contact.id]);
        updatedContacts++;
      }
    }

    db.close();

    // También eliminar del archivo de etiquetas
    const tags = loadTags();
    const filteredTags = tags.filter(t => t.id !== tagId);
    saveTags(filteredTags);
    logger.info(`✅ Etiqueta eliminada del archivo: ${tagId}`);

    res.json({
      success: true,
      message: `Etiqueta eliminada de ${updatedContacts} contactos`,
      data: {
        tagId,
        contactsUpdated: updatedContacts
      }
    });

  } catch (error) {
    logger.error('❌ Error eliminando etiqueta completamente:', error);
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
router.get('/folders', async (req, res) => {
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

export default router;
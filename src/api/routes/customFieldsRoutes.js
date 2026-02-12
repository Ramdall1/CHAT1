/**
 * Rutas para Campos Personalizados - SQLite Version
 */

import express from 'express';
import { createLogger } from '../../services/core/core/logger.js';
import {
    loadCustomFields,
    saveCustomField,
    deleteCustomField,
    loadContactCustomFields,
    saveContactCustomField,
    deleteContactCustomField,
    getContactCustomFieldsAsObject
} from '../services/persistence/customFieldsPersistenceSQL.js';

const logger = createLogger('CUSTOM_FIELDS_ROUTES');
const router = express.Router();

// Inicializar datos
async function initCustomFields() {
    try {
        logger.info('🔧 Inicializando campos personalizados desde SQLite...');
        const fields = await loadCustomFields();
        logger.info(`✅ ${fields.length} campos personalizados cargados desde SQLite`);
    } catch (error) {
        logger.error('Error inicializando campos personalizados:', error);
    }
}

// Inicializar inmediatamente (pero no esperar)
initCustomFields();

/**
 * GET /custom-fields
 * Obtiene todos los campos personalizados disponibles
 */
router.get('/custom-fields', async (req, res) => {
    try {
        const fields = await loadCustomFields();
        logger.info(`✅ GET /api/custom-fields - Retornando ${fields.length} campos`);
        res.json({
            success: true,
            data: fields
        });
    } catch (error) {
        logger.error('Error obteniendo campos personalizados:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo campos personalizados' });
    }
});

/**
 * GET / (raíz del router)
 * Alias para /custom-fields
 */
router.get('/', async (req, res) => {
    try {
        const fields = await loadCustomFields();
        logger.info(`✅ GET /api/ (custom-fields) - Retornando ${fields.length} campos`);
        res.json({
            success: true,
            data: fields
        });
    } catch (error) {
        logger.error('Error obteniendo campos personalizados:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo campos personalizados' });
    }
});

/**
 * POST /custom-fields
 * Crea un nuevo campo personalizado
 */
router.post('/custom-fields', async (req, res) => {
    try {
        const { name, type = 'text', description = '' } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'El nombre es requerido'
            });
        }

        const fieldId = name.toLowerCase().replace(/\s+/g, '_');
        
        await saveCustomField(fieldId, {
            name,
            type,
            description
        });

        res.json({
            success: true,
            data: { id: fieldId, name, type, description },
            message: 'Campo personalizado creado correctamente'
        });
    } catch (error) {
        logger.error('Error creando campo personalizado:', error);
        res.status(500).json({
            success: false,
            error: 'Error creando campo personalizado'
        });
    }
});

/**
 * PATCH /api/custom-fields/:id
 * Actualiza un campo personalizado
 */
router.patch('/custom-fields/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;

        await saveCustomField(id, updateData);

        res.json({
            success: true,
            data: { id, ...updateData },
            message: 'Campo actualizado correctamente'
        });
    } catch (error) {
        logger.error('Error actualizando campo:', error);
        res.status(500).json({
            success: false,
            error: 'Error actualizando campo'
        });
    }
});

/**
 * DELETE /api/custom-fields/:id
 * Elimina un campo personalizado
 */
router.delete('/custom-fields/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await deleteCustomField(id);

        res.json({
            success: true,
            message: 'Campo eliminado correctamente'
        });
    } catch (error) {
        logger.error('Error eliminando campo:', error);
        res.status(500).json({
            success: false,
            error: 'Error eliminando campo'
        });
    }
});

/**
 * GET /api/contacts/:contactId/custom-fields
 */
router.get('/contacts/:contactId/custom-fields', async (req, res) => {
    try {
        const { contactId } = req.params;
        logger.info(`📋 [ENDPOINT] GET /contacts/${contactId}/custom-fields`);
        console.log(`\n\n🔴🔴🔴 ENDPOINT EJECUTADO: /contacts/${contactId}/custom-fields 🔴🔴🔴\n\n`);
        const fields = await loadContactCustomFields(contactId);
        console.log(`\n\n✅ Campos devueltos:`, fields, `\n\n`);
        logger.info(`✅ [ENDPOINT] Campos devueltos: ${fields.length}`);
        
        res.json({ 
            success: true, 
            data: fields 
        });
    } catch (error) {
        console.error('[ENDPOINT] Error obteniendo campos del contacto:', error);
        logger.error('Error obteniendo campos del contacto:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error obteniendo campos del contacto' 
        });
    }
});

/**
 * POST /api/contacts/:contactId/custom-fields
 * Añade un campo personalizado a un contacto
 */
router.post('/contacts/:contactId/custom-fields', async (req, res) => {
    try {
        const { contactId } = req.params;
        const { field_id, value } = req.body;

        if (!field_id || value === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'field_id y value son requeridos' 
            });
        }

        await saveContactCustomField(contactId, field_id, value);
        
        res.json({ 
            success: true, 
            data: { field_id, value }, 
            message: 'Campo añadido correctamente' 
        });
    } catch (error) {
        logger.error('Error añadiendo campo al contacto:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error añadiendo campo al contacto' 
        });
    }
});

/**
 * DELETE /api/contacts/:contactId/custom-fields/:fieldId
 * Elimina un campo personalizado de un contacto
 */
router.delete('/contacts/:contactId/custom-fields/:fieldId', async (req, res) => {
    try {
        const { contactId, fieldId } = req.params;

        await deleteContactCustomField(contactId, fieldId);
        
        res.json({ 
            success: true, 
            message: 'Campo eliminado correctamente' 
        });
    } catch (error) {
        logger.error('Error eliminando campo del contacto:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error eliminando campo del contacto' 
        });
    }
});

// Exportar función para inicializar
export async function initializeCustomFields() {
    logger.info('🔧 Inicializando campos personalizados...');
    await initCustomFields();
    logger.info('✅ Campos personalizados inicializados');
}

export default router;

/**
 * Custom Fields Persistence Service - SQLite Version
 * Gestión de persistencia de campos personalizados en SQLite
 */

import { getDatabaseService } from '../../../services/DatabaseService.js';
import { createLogger } from '../../../services/core/core/logger.js';

const logger = createLogger('CUSTOM_FIELDS_PERSISTENCE');

/**
 * Cargar todas las definiciones de campos personalizados
 */
export async function loadCustomFields() {
    try {
        const db = getDatabaseService();
        
        // Inicializar si no está inicializado
        if (!db.isInitialized) {
            await db.initialize();
        }
        
        const fields = await db.findAll('custom_field_definitions', { is_active: 1 });
        
        // Si no hay campos, crear los predeterminados
        if (!fields || fields.length === 0) {
            await createDefaultFields();
            return await db.findAll('custom_field_definitions', { is_active: 1 });
        }
        
        return fields;
    } catch (error) {
        logger.error('Error cargando campos personalizados:', error);
        return [];
    }
}

/**
 * Crear campos predeterminados
 * DESHABILITADO: No crear campos predeterminados
 */
async function createDefaultFields() {
    try {
        logger.info('⏭️  Creación de campos predeterminados deshabilitada');
        // Los campos predeterminados han sido deshabilitados
        // Los usuarios pueden crear sus propios campos personalizados
    } catch (error) {
        logger.error('Error en createDefaultFields:', error);
    }
}

/**
 * Guardar/actualizar definición de campo personalizado
 */
export async function saveCustomField(fieldId, fieldData) {
    try {
        const db = getDatabaseService();
        
        // Verificar si existe
        const exists = await db.findById('custom_field_definitions', fieldId);
        
        if (exists) {
            await db.update('custom_field_definitions', fieldId, {
                ...fieldData,
                updated_at: new Date().toISOString()
            });
        } else {
            await db.insert('custom_field_definitions', {
                id: fieldId,
                ...fieldData,
                is_active: 1
            });
        }
        
        return true;
    } catch (error) {
        logger.error('Error guardando campo personalizado:', error);
        throw error;
    }
}

/**
 * Eliminar definición de campo personalizado
 */
export async function deleteCustomField(fieldId) {
    try {
        const db = getDatabaseService();
        await db.delete('custom_field_definitions', fieldId);
        return true;
    } catch (error) {
        logger.error('Error eliminando campo personalizado:', error);
        throw error;
    }
}

/**
 * Cargar valores de campos personalizados para un contacto
 */
export async function loadContactCustomFields(contactId) {
    try {
        const db = getDatabaseService();
        console.log(`🔍 [CUSTOM_FIELDS] Buscando campos para contactId: ${contactId} (tipo: ${typeof contactId})`);
        const contactIdInt = parseInt(contactId);
        console.log(`🔍 [CUSTOM_FIELDS] contactId convertido: ${contactIdInt} (tipo: ${typeof contactIdInt})`);
        const values = await db.findAll('custom_field_values', { contact_id: contactIdInt });
        console.log(`✅ [CUSTOM_FIELDS] Campos encontrados: ${values.length}`, values);
        
        // Enriquecer con definiciones
        const enriched = [];
        for (const value of values) {
            const fieldDef = await db.findById('custom_field_definitions', value.field_id);
            enriched.push({
                ...value,
                name: fieldDef?.name || value.field_id,
                type: fieldDef?.type || 'text',
                description: fieldDef?.description || ''
            });
        }
        
        return enriched;
    } catch (error) {
        logger.error('Error cargando campos del contacto:', error);
        return [];
    }
}

/**
 * Guardar valor de campo personalizado para un contacto
 */
export async function saveContactCustomField(contactId, fieldId, value) {
    try {
        const db = getDatabaseService();
        
        // Verificar si existe
        const exists = await db.findAll('custom_field_values', { 
            contact_id: parseInt(contactId), 
            field_id: fieldId 
        });
        
        if (exists && exists.length > 0) {
            // Actualizar
            await db.update('custom_field_values', exists[0].id, {
                value,
                updated_at: new Date().toISOString()
            });
        } else {
            // Insertar
            await db.insert('custom_field_values', {
                contact_id: parseInt(contactId),
                field_id: fieldId,
                value
            });
        }
        
        return true;
    } catch (error) {
        logger.error('Error guardando valor de campo:', error);
        throw error;
    }
}

/**
 * Eliminar valor de campo personalizado para un contacto
 */
export async function deleteContactCustomField(contactId, fieldId) {
    try {
        const db = getDatabaseService();
        
        const record = await db.findAll('custom_field_values', { 
            contact_id: parseInt(contactId), 
            field_id: fieldId 
        });
        
        if (record && record.length > 0) {
            await db.delete('custom_field_values', record[0].id);
        }
        
        return true;
    } catch (error) {
        logger.error('Error eliminando valor de campo:', error);
        throw error;
    }
}

/**
 * Obtener todos los campos personalizados de un contacto como objeto
 */
export async function getContactCustomFieldsAsObject(contactId) {
    try {
        const fields = await loadContactCustomFields(contactId);
        const result = {};
        
        for (const field of fields) {
            result[field.field_id] = {
                value: field.value,
                name: field.name,
                type: field.type
            };
        }
        
        return result;
    } catch (error) {
        logger.error('Error obteniendo campos del contacto como objeto:', error);
        return {};
    }
}

export default {
    loadCustomFields,
    saveCustomField,
    deleteCustomField,
    loadContactCustomFields,
    saveContactCustomField,
    deleteContactCustomField,
    getContactCustomFieldsAsObject
};

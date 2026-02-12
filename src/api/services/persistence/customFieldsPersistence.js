/**
 * Custom Fields Persistence Service
 * Gestión de persistencia de campos personalizados en archivos JSON
 */

import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CUSTOM_FIELDS_FILE = path.join(DATA_DIR, 'custom-fields.json');
const CONTACT_CUSTOM_FIELDS_FILE = path.join(DATA_DIR, 'contact-custom-fields.json');

/**
 * Asegurar que el directorio de datos existe
 */
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
        logger.error('Error creando directorio de datos:', error);
    }
}

/**
 * Cargar campos personalizados definidos
 */
export async function loadCustomFields() {
    try {
        await ensureDataDir();
        const data = await fs.readFile(CUSTOM_FIELDS_FILE, 'utf8');
        const fields = JSON.parse(data);
        return fields;
    } catch (error) {
        // Si el archivo no existe, retornar array vacío (sin campos predeterminados)
        if (error.code === 'ENOENT') {
            const emptyFields = [];
            await saveCustomFields(emptyFields);
            return emptyFields;
        }
        logger.error('Error cargando campos personalizados:', error);
        return [];
    }
}

/**
 * Guardar campos personalizados definidos
 */
export async function saveCustomFields(fields) {
    try {
        await ensureDataDir();
        await fs.writeFile(CUSTOM_FIELDS_FILE, JSON.stringify(fields, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger.error('Error guardando campos personalizados:', error);
        throw error;
    }
}

/**
 * Cargar valores de campos personalizados por contacto
 */
export async function loadContactCustomFields() {
    try {
        await ensureDataDir();
        const data = await fs.readFile(CONTACT_CUSTOM_FIELDS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Si el archivo no existe, retornar objeto vacío
        if (error.code === 'ENOENT') {
            await saveContactCustomFields({});
            return {};
        }
        logger.error('Error cargando campos de contactos:', error);
        return {};
    }
}

/**
 * Guardar valores de campos personalizados por contacto
 */
export async function saveContactCustomFields(contactFields) {
    try {
        await ensureDataDir();
        await fs.writeFile(CONTACT_CUSTOM_FIELDS_FILE, JSON.stringify(contactFields, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger.error('Error guardando campos de contactos:', error);
        throw error;
    }
}

/**
 * Obtener campos de un contacto específico
 */
export async function getContactFields(contactId) {
    try {
        const allFields = await loadContactCustomFields();
        return allFields[contactId] || [];
    } catch (error) {
        logger.error('Error obteniendo campos del contacto:', error);
        return [];
    }
}

/**
 * Guardar campos de un contacto específico
 */
export async function saveContactFields(contactId, fields) {
    try {
        const allFields = await loadContactCustomFields();
        allFields[contactId] = fields;
        await saveContactCustomFields(allFields);
        return true;
    } catch (error) {
        logger.error('Error guardando campos del contacto:', error);
        throw error;
    }
}

export default {
    loadCustomFields,
    saveCustomFields,
    loadContactCustomFields,
    saveContactCustomFields,
    getContactFields,
    saveContactFields
};

/**
 * Servicio de persistencia para campos personalizados
 * Guarda y carga datos en archivos JSON para mantener la persistencia
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../../data/custom-fields.json');
const CONTACTS_DATA_FILE = path.join(__dirname, '../../data/contact-custom-fields.json');

/**
 * Guarda los campos personalizados en un archivo JSON
 */
export async function saveCustomFields(fields) {
    try {
        await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
        await fs.writeFile(DATA_FILE, JSON.stringify(fields, null, 2));
        logger.debug('✅ Campos personalizados guardados en disco');
    } catch (error) {
        logger.error('Error guardando campos personalizados:', error);
    }
}

/**
 * Carga los campos personalizados desde un archivo JSON
 */
export async function loadCustomFields() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logger.debug('No se encontró archivo de campos personalizados, usando valores por defecto');
        return [
            { id: 'cedula', name: 'Cédula de Ciudadanía', type: 'number', description: 'Añadir descripción' },
            { id: 'ciudad', name: 'Ciudad', type: 'text', description: 'Añadir descripción' },
            { id: 'valor_pago', name: 'Valor de Pago', type: 'number', description: 'Añadir descripción' },
            { id: 'id_referencia', name: 'ID_Referencia', type: 'text', description: 'Añadir descripción' },
            { id: 'cantidad_boletos', name: 'Cantidad de Boletos', type: 'number', description: 'Añadir descripción' }
        ];
    }
}

/**
 * Guarda los campos personalizados de contactos en un archivo JSON
 */
export async function saveContactCustomFields(fields) {
    try {
        await fs.mkdir(path.dirname(CONTACTS_DATA_FILE), { recursive: true });
        await fs.writeFile(CONTACTS_DATA_FILE, JSON.stringify(fields, null, 2));
        logger.debug('✅ Campos de contactos guardados en disco');
    } catch (error) {
        logger.error('Error guardando campos de contactos:', error);
    }
}

/**
 * Carga los campos personalizados de contactos desde un archivo JSON
 */
export async function loadContactCustomFields() {
    try {
        const data = await fs.readFile(CONTACTS_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logger.debug('No se encontró archivo de campos de contactos, inicializando vacío');
        return {};
    }
}

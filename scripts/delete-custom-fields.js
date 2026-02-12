#!/usr/bin/env node

/**
 * Script para eliminar todos los campos personalizados existentes
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'database', 'chatbot.db');

console.log('🗑️  Eliminando todos los campos personalizados...');
console.log(`📁 Base de datos: ${dbPath}\n`);

try {
    const db = new Database(dbPath);

    // Obtener todos los campos personalizados
    const fields = db.prepare('SELECT id FROM custom_field_definitions').all();
    
    console.log(`📊 Campos encontrados: ${fields.length}\n`);

    if (fields.length === 0) {
        console.log('✅ No hay campos personalizados para eliminar');
        db.close();
        process.exit(0);
    }

    // Eliminar cada campo
    const deleteStmt = db.prepare('DELETE FROM custom_field_definitions WHERE id = ?');
    
    fields.forEach((field, index) => {
        deleteStmt.run(field.id);
        console.log(`✅ ${index + 1}/${fields.length} - Eliminado: ${field.id}`);
    });

    console.log(`\n✅ Se eliminaron ${fields.length} campos personalizados correctamente`);

    db.close();
    process.exit(0);

} catch (error) {
    console.error('❌ Error eliminando campos personalizados:', error.message);
    process.exit(1);
}

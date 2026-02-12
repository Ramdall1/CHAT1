/**
 * Script para eliminar todos los mensajes de la base de datos
 * Útil para empezar limpio con la funcionalidad de mensajes leídos
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');

console.log('🗑️  Iniciando limpieza de mensajes...');
console.log(`📁 Base de datos: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error abriendo base de datos:', err);
        process.exit(1);
    }
});

// Función para ejecutar consultas con promesas
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
};

const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

async function clearMessages() {
    try {
        // Obtener conteo actual de mensajes
        const countBefore = await get('SELECT COUNT(*) as count FROM messages');
        console.log(`📊 Mensajes actuales: ${countBefore.count}`);
        
        if (countBefore.count === 0) {
            console.log('✅ La tabla de mensajes ya está vacía');
            db.close();
            return;
        }
        
        // Eliminar todos los mensajes
        console.log('🗑️  Eliminando todos los mensajes...');
        const result = await run('DELETE FROM messages');
        console.log(`✅ ${result.changes} mensajes eliminados`);
        
        // Resetear el contador de autoincremento
        console.log('🔄 Reseteando contador de autoincremento...');
        await run("DELETE FROM sqlite_sequence WHERE name='messages'");
        console.log('✅ Contador reseteado');
        
        // Verificar que se eliminaron todos
        const countAfter = await get('SELECT COUNT(*) as count FROM messages');
        console.log(`📊 Mensajes después de limpieza: ${countAfter.count}`);
        
        // Actualizar contadores en otras tablas si existen
        try {
            await run('UPDATE conversations SET message_count = 0, unread_count = 0');
            console.log('✅ Contadores de conversaciones actualizados');
        } catch (err) {
            console.log('ℹ️  Tabla conversations no existe o no necesita actualización');
        }
        
        console.log('');
        console.log('✅ ¡Limpieza completada exitosamente!');
        console.log('📝 Ahora puedes recibir mensajes nuevos para probar la funcionalidad de lectura');
        
        db.close();
        
    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
        db.close();
        process.exit(1);
    }
}

// Ejecutar limpieza
clearMessages();

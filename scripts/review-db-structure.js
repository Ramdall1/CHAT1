/**
 * Script para revisar la estructura completa de la base de datos
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');

console.log('🔍 REVISIÓN COMPLETA DE ESTRUCTURA DE BASE DE DATOS\n');
console.log(`📁 Ruta: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error abriendo base de datos:', err);
        process.exit(1);
    }
});

const all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

async function reviewDatabase() {
    try {
        // 1. Listar todas las tablas
        console.log('📋 TABLAS EN LA BASE DE DATOS:');
        console.log('═'.repeat(80));
        const tables = await all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        
        for (const table of tables) {
            console.log(`\n🗂️  Tabla: ${table.name.toUpperCase()}`);
            console.log('─'.repeat(80));
            
            // Obtener estructura de la tabla
            const columns = await all(`PRAGMA table_info(${table.name})`);
            
            console.log('\n  Columnas:');
            columns.forEach(col => {
                const pk = col.pk ? '🔑 PRIMARY KEY' : '';
                const notnull = col.notnull ? 'NOT NULL' : 'NULLABLE';
                const defval = col.dflt_value ? `DEFAULT ${col.dflt_value}` : '';
                console.log(`    - ${col.name}`);
                console.log(`      Tipo: ${col.type} | ${notnull} ${pk} ${defval}`);
            });
            
            // Obtener índices
            const indexes = await all(`PRAGMA index_list(${table.name})`);
            if (indexes.length > 0) {
                console.log('\n  Índices:');
                for (const idx of indexes) {
                    const idxInfo = await all(`PRAGMA index_info(${idx.name})`);
                    const cols = idxInfo.map(i => i.name).join(', ');
                    const unique = idx.unique ? '🔐 UNIQUE' : '';
                    console.log(`    - ${idx.name}: (${cols}) ${unique}`);
                }
            }
            
            // Obtener conteo de registros
            const count = await all(`SELECT COUNT(*) as count FROM ${table.name}`);
            console.log(`\n  📊 Total de registros: ${count[0].count}`);
        }
        
        console.log('\n\n' + '═'.repeat(80));
        console.log('🔍 ANÁLISIS DE RELACIONES');
        console.log('═'.repeat(80));
        
        // Verificar foreign keys
        const fkInfo = await all(`PRAGMA foreign_key_list(messages)`);
        if (fkInfo.length > 0) {
            console.log('\n📎 Foreign Keys en tabla MESSAGES:');
            fkInfo.forEach(fk => {
                console.log(`  - ${fk.from} → ${fk.table}.${fk.to}`);
            });
        }
        
        const convFk = await all(`PRAGMA foreign_key_list(conversations)`);
        if (convFk.length > 0) {
            console.log('\n📎 Foreign Keys en tabla CONVERSATIONS:');
            convFk.forEach(fk => {
                console.log(`  - ${fk.from} → ${fk.table}.${fk.to}`);
            });
        }
        
        console.log('\n\n' + '═'.repeat(80));
        console.log('🔍 VERIFICACIÓN DE DATOS');
        console.log('═'.repeat(80));
        
        // Verificar mensajes sin contacto
        const orphanMessages = await all(`
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE contact_id NOT IN (SELECT id FROM contacts)
        `);
        console.log(`\n⚠️  Mensajes huérfanos (sin contacto): ${orphanMessages[0].count}`);
        
        // Verificar conversaciones sin contacto
        const orphanConversations = await all(`
            SELECT COUNT(*) as count 
            FROM conversations 
            WHERE contact_id NOT IN (SELECT id FROM contacts)
        `);
        console.log(`⚠️  Conversaciones huérfanas (sin contacto): ${orphanConversations[0].count}`);
        
        // Verificar mensajes con valores NULL en campos importantes
        const nullChecks = await all(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN content IS NULL OR content = '' THEN 1 ELSE 0 END) as null_content,
                SUM(CASE WHEN direction IS NULL OR direction = '' THEN 1 ELSE 0 END) as null_direction,
                SUM(CASE WHEN created_at IS NULL THEN 1 ELSE 0 END) as null_created_at
            FROM messages
        `);
        
        if (nullChecks[0].total > 0) {
            console.log(`\n📊 Análisis de mensajes:`);
            console.log(`   Total: ${nullChecks[0].total}`);
            console.log(`   Sin contenido: ${nullChecks[0].null_content}`);
            console.log(`   Sin dirección: ${nullChecks[0].null_direction}`);
            console.log(`   Sin fecha: ${nullChecks[0].null_created_at}`);
        }
        
        db.close();
        console.log('\n✅ Revisión completada\n');
        
    } catch (error) {
        console.error('❌ Error:', error);
        db.close();
        process.exit(1);
    }
}

reviewDatabase();

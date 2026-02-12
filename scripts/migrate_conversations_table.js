#!/usr/bin/env node

/**
 * Script de migración para agregar columnas faltantes a la tabla conversations
 * Esto eliminará las conversaciones virtuales y permitirá usar conversaciones reales
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta a la base de datos
const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');

console.log('🔧 Iniciando migración de la tabla conversations...');
console.log(`📁 Base de datos: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

// Función para ejecutar consultas de forma asíncrona
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

// Función para obtener datos de forma asíncrona
function getAllQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

async function migrateConversationsTable() {
    try {
        console.log('📋 Verificando estructura actual de la tabla conversations...');
        
        // Verificar si las columnas ya existen
        const tableInfo = await getAllQuery("PRAGMA table_info(conversations)");
        const existingColumns = tableInfo.map(col => col.name);
        
        console.log('📊 Columnas actuales:', existingColumns);
        
        const columnsToAdd = [
            { name: 'channel', definition: "VARCHAR(20) DEFAULT 'whatsapp'" },
            { name: 'priority', definition: "VARCHAR(20) DEFAULT 'medium'" },
            { name: 'subject', definition: "VARCHAR(255)" }
        ];
        
        // Agregar columnas faltantes
        for (const column of columnsToAdd) {
            if (!existingColumns.includes(column.name)) {
                console.log(`➕ Agregando columna: ${column.name}`);
                await runQuery(`ALTER TABLE conversations ADD COLUMN ${column.name} ${column.definition}`);
                console.log(`✅ Columna ${column.name} agregada exitosamente`);
            } else {
                console.log(`⏭️  Columna ${column.name} ya existe, saltando...`);
            }
        }
        
        // Actualizar registros existentes con valores por defecto
        console.log('🔄 Actualizando registros existentes...');
        
        await runQuery(`
            UPDATE conversations 
            SET channel = 'whatsapp' 
            WHERE channel IS NULL
        `);
        
        await runQuery(`
            UPDATE conversations 
            SET priority = 'medium' 
            WHERE priority IS NULL
        `);
        
        console.log('✅ Registros actualizados con valores por defecto');
        
        // Verificar la nueva estructura
        console.log('🔍 Verificando nueva estructura...');
        const newTableInfo = await getAllQuery("PRAGMA table_info(conversations)");
        console.log('📊 Nueva estructura de la tabla conversations:');
        newTableInfo.forEach(col => {
            console.log(`   - ${col.name}: ${col.type} ${col.dflt_value ? `(default: ${col.dflt_value})` : ''}`);
        });
        
        // Contar conversaciones existentes
        const conversationCount = await getAllQuery("SELECT COUNT(*) as count FROM conversations");
        console.log(`📈 Total de conversaciones en la base de datos: ${conversationCount[0].count}`);
        
        console.log('🎉 ¡Migración completada exitosamente!');
        console.log('💡 Ahora el sistema debería usar conversaciones reales en lugar de virtuales');
        
    } catch (error) {
        console.error('❌ Error durante la migración:', error.message);
        throw error;
    }
}

// Ejecutar migración
migrateConversationsTable()
    .then(() => {
        console.log('✨ Proceso de migración finalizado');
        db.close();
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error crítico:', error);
        db.close();
        process.exit(1);
    });
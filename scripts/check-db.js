/**
 * Script para verificar el contenido de la base de datos
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');

console.log('🔍 Verificando base de datos...');
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

async function checkDatabase() {
    try {
        // Verificar mensajes
        console.log('📨 MENSAJES:');
        const messages = await all('SELECT id, contact_id, direction, status, content, created_at FROM messages ORDER BY created_at DESC LIMIT 10');
        console.log(`Total de mensajes: ${messages.length}`);
        if (messages.length > 0) {
            messages.forEach(msg => {
                console.log(`  - ID: ${msg.id}, Contact: ${msg.contact_id}, Direction: ${msg.direction}, Status: ${msg.status}`);
                console.log(`    Content: ${msg.content?.substring(0, 100)}`);
                console.log(`    Created: ${msg.created_at}\n`);
            });
        } else {
            console.log('  ⚠️  No hay mensajes en la base de datos\n');
        }
        
        // Verificar contactos
        console.log('👥 CONTACTOS:');
        const contacts = await all('SELECT id, phone, name FROM contacts LIMIT 10');
        console.log(`Total de contactos: ${contacts.length}`);
        if (contacts.length > 0) {
            contacts.forEach(contact => {
                console.log(`  - ID: ${contact.id}, Phone: ${contact.phone}, Name: ${contact.name}`);
            });
        } else {
            console.log('  ⚠️  No hay contactos en la base de datos');
        }
        console.log('');
        
        // Verificar conversaciones
        console.log('💬 CONVERSACIONES:');
        const conversations = await all('SELECT * FROM conversations LIMIT 10');
        console.log(`Total de conversaciones: ${conversations.length}`);
        if (conversations.length > 0) {
            conversations.forEach(conv => {
                console.log(`  - ID: ${conv.id}, Contact ID: ${conv.contact_id}, Status: ${conv.status}`);
                console.log(`    Last message: ${conv.last_message_at}`);
            });
        } else {
            console.log('  ℹ️  No hay conversaciones registradas');
        }
        console.log('');
        
        db.close();
        
    } catch (error) {
        console.error('❌ Error:', error);
        db.close();
        process.exit(1);
    }
}

checkDatabase();

#!/usr/bin/env node

/**
 * Script para crear conversaciones reales en la base de datos
 * Esto reemplazará las conversaciones virtuales con datos reales
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta a la base de datos
const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');

console.log('🏗️  Creando conversaciones reales...');
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

async function createRealConversations() {
    try {
        console.log('👥 Obteniendo contactos existentes...');
        
        // Obtener contactos existentes
        const contacts = await getAllQuery("SELECT * FROM contacts LIMIT 5");
        console.log(`📋 Encontrados ${contacts.length} contactos`);
        
        // Obtener usuarios existentes
        const users = await getAllQuery("SELECT * FROM users LIMIT 1");
        if (users.length === 0) {
            console.log('❌ No se encontraron usuarios. Creando usuario por defecto...');
            await runQuery(`
                INSERT INTO users (username, email, password_hash, role)
                VALUES ('admin', 'admin@chatbot.com', 'hashed_password', 'admin')
            `);
            console.log('✅ Usuario admin creado');
        }
        
        const user = await getAllQuery("SELECT * FROM users LIMIT 1");
        const userId = user[0].id;
        
        console.log('💬 Creando conversaciones reales...');
        
        // Datos de conversaciones de ejemplo
        const conversationData = [
            {
                subject: 'Consulta sobre productos',
                priority: 'high',
                channel: 'whatsapp',
                status: 'active'
            },
            {
                subject: 'Soporte técnico',
                priority: 'medium',
                channel: 'whatsapp',
                status: 'pending'
            },
            {
                subject: 'Información de precios',
                priority: 'low',
                channel: 'whatsapp',
                status: 'active'
            },
            {
                subject: 'Reclamo de servicio',
                priority: 'high',
                channel: 'whatsapp',
                status: 'active'
            },
            {
                subject: 'Consulta general',
                priority: 'medium',
                channel: 'whatsapp',
                status: 'active'
            }
        ];
        
        // Crear conversaciones para cada contacto
        for (let i = 0; i < Math.min(contacts.length, conversationData.length); i++) {
            const contact = contacts[i];
            const convData = conversationData[i];
            
            // Verificar si ya existe una conversación para este contacto
            const existingConv = await getAllQuery(
                "SELECT * FROM conversations WHERE contact_id = ?",
                [contact.id]
            );
            
            if (existingConv.length === 0) {
                const result = await runQuery(`
                    INSERT INTO conversations (
                        contact_id, status, channel, priority, subject,
                        last_message_at, message_count
                    ) VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
                `, [
                    contact.id, convData.status, convData.channel, 
                    convData.priority, convData.subject, 
                    Math.floor(Math.random() * 5) + 1 // message_count aleatorio
                ]);
                
                console.log(`✅ Conversación creada para ${contact.name || contact.phone} (ID: ${result.lastID})`);
            } else {
                // Actualizar conversación existente con las nuevas columnas
                await runQuery(`
                    UPDATE conversations 
                    SET channel = ?, priority = ?, subject = ?, status = ?
                    WHERE id = ?
                `, [convData.channel, convData.priority, convData.subject, convData.status, existingConv[0].id]);
                
                console.log(`🔄 Conversación actualizada para ${contact.name || contact.phone}`);
            }
        }
        
        // Mostrar estadísticas finales
        const totalConversations = await getAllQuery("SELECT COUNT(*) as count FROM conversations");
        const activeConversations = await getAllQuery("SELECT COUNT(*) as count FROM conversations WHERE status = 'active'");
        
        console.log('📊 Estadísticas finales:');
        console.log(`   - Total de conversaciones: ${totalConversations[0].count}`);
        console.log(`   - Conversaciones activas: ${activeConversations[0].count}`);
        
        // Mostrar algunas conversaciones de ejemplo
        console.log('📋 Conversaciones creadas:');
        const sampleConversations = await getAllQuery(`
            SELECT c.id, c.subject, c.priority, c.channel, c.status, 
                   ct.name as contact_name, ct.phone_number as contact_phone
            FROM conversations c
            LEFT JOIN contacts ct ON c.contact_id = ct.id
            LIMIT 5
        `);
        
        sampleConversations.forEach(conv => {
            console.log(`   - ${conv.contact_name || conv.contact_phone}: ${conv.subject} (${conv.priority}, ${conv.status})`);
        });
        
        console.log('🎉 ¡Conversaciones reales creadas exitosamente!');
        
    } catch (error) {
        console.error('❌ Error creando conversaciones:', error.message);
        throw error;
    }
}

// Ejecutar creación de conversaciones
createRealConversations()
    .then(() => {
        console.log('✨ Proceso completado');
        db.close();
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error crítico:', error);
        db.close();
        process.exit(1);
    });
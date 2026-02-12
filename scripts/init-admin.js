#!/usr/bin/env node

/**
 * Script para inicializar la base de datos con un usuario administrador por defecto
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import SQLiteManager from '../src/config/database/sqlite-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createAdminUser() {
    console.log('🚀 Inicializando base de datos con usuario administrador...');
    
    const dbManager = new SQLiteManager({
        dbPath: path.join(process.cwd(), 'data', 'database.sqlite')
    });

    // Esperar a que la base de datos se inicialice
    console.log('⏳ Esperando inicialización de la base de datos...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        // Verificar si ya existe un usuario administrador
        const existingAdmin = await dbManager.get(
            'SELECT id FROM users WHERE role = ? OR username = ?',
            ['admin', 'admin']
        );

        if (existingAdmin) {
            console.log('✅ Usuario administrador ya existe');
            return;
        }

        // Crear usuario administrador
        const salt = crypto.randomBytes(16).toString('hex');
        const password = 'admin123';
        const passwordHash = await bcrypt.hash(password + salt, 12);

        const adminUser = {
            username: 'admin',
            email: 'admin@chatbot.com',
            password_hash: passwordHash,
            salt: salt,
            role: 'admin',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: JSON.stringify({
                created_by: 'system',
                is_default_admin: true
            })
        };

        const result = await dbManager.insert('users', adminUser);
        
        console.log('✅ Usuario administrador creado exitosamente');
        console.log('📋 Credenciales:');
        console.log('   Username: admin');
        console.log('   Email: admin@chatbot.com');
        console.log('   Password: admin123');
        console.log('   Role: admin');
        console.log(`   ID: ${result.lastID}`);

        // Crear configuración inicial
        const defaultSettings = [
            {
                user_id: result.lastID,
                key: 'app_name',
                value: 'ChatBot System',
                type: 'string',
                is_global: 1
            },
            {
                user_id: result.lastID,
                key: 'app_version',
                value: '1.0.0',
                type: 'string',
                is_global: 1
            },
            {
                user_id: result.lastID,
                key: 'max_message_length',
                value: '4096',
                type: 'number',
                is_global: 1
            }
        ];

        for (const setting of defaultSettings) {
            await dbManager.insert('settings', setting);
        }

        console.log('✅ Configuración inicial creada');

    } catch (error) {
        console.error('❌ Error creando usuario administrador:', error);
        throw error;
    } finally {
        await dbManager.close();
    }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    createAdminUser()
        .then(() => {
            console.log('🎉 Inicialización completada exitosamente');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Error en la inicialización:', error);
            process.exit(1);
        });
}

export default createAdminUser;
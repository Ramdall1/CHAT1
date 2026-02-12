#!/usr/bin/env node

/**
 * Script para crear usuario administrador
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para generar contraseña segura
function generateSecurePassword(length = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}

async function createDefaultAdmin() {
    try {
        console.log('🔧 Inicializando base de datos...');
        
        // Asegurar que el directorio data existe
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Conectar a la base de datos
        const db = new Database('./data/database.sqlite');

        console.log('✅ Conectado a la base de datos');

        // Crear tabla de usuarios si no existe (usando la estructura existente)
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                salt VARCHAR(32) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                status VARCHAR(20) DEFAULT 'active',
                last_login DATETIME,
                failed_attempts INTEGER DEFAULT 0,
                locked_until DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT DEFAULT '{}'
            )
        `);

        console.log('✅ Tabla users verificada/creada');

        // Verificar si ya existe un administrador
        const existingAdmin = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get('admin');

        if (existingAdmin) {
            console.log('ℹ️  Ya existe un usuario administrador');
            console.log(`   Username: ${existingAdmin.username}`);
            console.log(`   Email: ${existingAdmin.email}`);
            db.close();
            return;
        }

        // Generar credenciales para el administrador
        const adminPassword = generateSecurePassword();
        const salt = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(adminPassword + salt, 12);

        // Crear usuario administrador
        const stmt = db.prepare(`
            INSERT INTO users (username, email, password_hash, salt, role, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run('admin', 'admin@chatbot.local', hashedPassword, salt, 'admin', 'active');

        console.log('✅ Usuario administrador creado exitosamente!');
        console.log('');
        console.log('🔑 CREDENCIALES DEL ADMINISTRADOR:');
        console.log('   Username: admin');
        console.log('   Email: admin@chatbot.local');
        console.log(`   Password: ${adminPassword}`);
        console.log('');
        console.log('⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro!');
        console.log('   La contraseña no se mostrará nuevamente.');

        db.close();
        console.log('✅ Conexión a la base de datos cerrada');

    } catch (error) {
        console.error('❌ Error creando usuario administrador:', error);
        process.exit(1);
    }
}

createDefaultAdmin();
/**
 * Script para revisar la estructura exacta de la tabla contacts
 */

import { config } from 'dotenv';
import { Sequelize } from 'sequelize';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de la base de datos
const dbConfig = {
  dialect: 'sqlite',
  storage: join(__dirname, 'data', 'chatbot_dev.db'),
  logging: console.log
};

async function checkContactsStructure() {
  let sequelize = null;
  
  try {
    console.log('🔍 Revisando estructura de la tabla contacts...\n');
    
    sequelize = new Sequelize(dbConfig);
    await sequelize.authenticate();
    
    // 1. Obtener información de la tabla contacts
    console.log('📋 ESTRUCTURA DE LA TABLA CONTACTS:');
    console.log('==================================');
    
    const [tableInfo] = await sequelize.query(`PRAGMA table_info(contacts)`);
    
    tableInfo.forEach(column => {
      console.log(`${column.name}: ${column.type} ${column.notnull ? '(NOT NULL)' : '(NULL)'} ${column.pk ? '(PRIMARY KEY)' : ''} ${column.dflt_value ? `(DEFAULT: ${column.dflt_value})` : ''}`);
    });
    
    // 2. Obtener restricciones de clave foránea
    console.log('\n🔗 CLAVES FORÁNEAS:');
    console.log('==================');
    
    const [foreignKeys] = await sequelize.query(`PRAGMA foreign_key_list(contacts)`);
    
    if (foreignKeys.length > 0) {
      foreignKeys.forEach(fk => {
        console.log(`${fk.from} -> ${fk.table}.${fk.to}`);
      });
    } else {
      console.log('No hay claves foráneas en la tabla contacts');
    }
    
    // 3. Obtener índices
    console.log('\n📊 ÍNDICES:');
    console.log('==========');
    
    const [indexes] = await sequelize.query(`PRAGMA index_list(contacts)`);
    
    if (indexes.length > 0) {
      for (const index of indexes) {
        const [indexInfo] = await sequelize.query(`PRAGMA index_info(${index.name})`);
        console.log(`${index.name} (${index.unique ? 'UNIQUE' : 'NON-UNIQUE'}): ${indexInfo.map(i => i.name).join(', ')}`);
      }
    } else {
      console.log('No hay índices en la tabla contacts');
    }
    
    // 4. Intentar insertar con diferentes combinaciones
    console.log('\n🧪 PROBANDO INSERCIONES:');
    console.log('========================');
    
    // Probar inserción mínima
    try {
      await sequelize.query(`
        INSERT INTO contacts (phone, created_at, updated_at)
        VALUES ('+1111111111', datetime('now'), datetime('now'))
      `);
      console.log('✅ Inserción mínima (solo phone) exitosa');
      
      // Limpiar
      await sequelize.query(`DELETE FROM contacts WHERE phone = '+1111111111'`);
      
    } catch (error) {
      console.log('❌ Inserción mínima falló:', error.message);
    }
    
    // Probar con name
    try {
      await sequelize.query(`
        INSERT INTO contacts (phone, name, created_at, updated_at)
        VALUES ('+2222222222', 'Test User', datetime('now'), datetime('now'))
      `);
      console.log('✅ Inserción con name exitosa');
      
      // Limpiar
      await sequelize.query(`DELETE FROM contacts WHERE phone = '+2222222222'`);
      
    } catch (error) {
      console.log('❌ Inserción con name falló:', error.message);
    }
    
    // Probar con todos los campos
    try {
      await sequelize.query(`
        INSERT INTO contacts (phone, name, email, status, created_at, updated_at)
        VALUES ('+3333333333', 'Full Test', 'test@email.com', 'active', datetime('now'), datetime('now'))
      `);
      console.log('✅ Inserción completa exitosa');
      
      // Limpiar
      await sequelize.query(`DELETE FROM contacts WHERE phone = '+3333333333'`);
      
    } catch (error) {
      console.log('❌ Inserción completa falló:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
  }
}

checkContactsStructure();
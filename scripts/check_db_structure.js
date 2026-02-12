/**
 * Script para revisar la estructura de la base de datos
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
  logging: false,
  define: {
    timestamps: true,
    underscored: true
  }
};

async function checkDatabaseStructure() {
  let sequelize = null;
  
  try {
    console.log('🔍 Revisando estructura de la base de datos...\n');
    
    // Crear instancia de Sequelize
    sequelize = new Sequelize(dbConfig);
    
    // Probar autenticación
    await sequelize.authenticate();
    
    // Obtener todas las tablas
    const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table';");
    console.log('📊 TABLAS EN LA BASE DE DATOS:');
    console.log('=============================');
    tables.forEach(table => console.log(`- ${table.name}`));
    
    // Revisar estructura de cada tabla importante
    const importantTables = ['contacts', 'conversations', 'messages'];
    
    for (const tableName of importantTables) {
      console.log(`\n🔧 ESTRUCTURA DE LA TABLA: ${tableName.toUpperCase()}`);
      console.log('='.repeat(40));
      
      try {
        const [columns] = await sequelize.query(`PRAGMA table_info(${tableName});`);
        columns.forEach(col => {
          console.log(`  ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
        
        // Revisar claves foráneas
        const [foreignKeys] = await sequelize.query(`PRAGMA foreign_key_list(${tableName});`);
        if (foreignKeys.length > 0) {
          console.log('\n  🔗 CLAVES FORÁNEAS:');
          foreignKeys.forEach(fk => {
            console.log(`    ${fk.from} -> ${fk.table}.${fk.to}`);
          });
        }
        
        // Contar registros
        const [count] = await sequelize.query(`SELECT COUNT(*) as count FROM ${tableName};`);
        console.log(`\n  📊 Registros: ${count[0].count}`);
        
      } catch (error) {
        console.log(`  ❌ Error revisando tabla ${tableName}: ${error.message}`);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error revisando estructura:', error.message);
    console.error('📋 Stack trace:', error.stack);
    return false;
  } finally {
    if (sequelize) {
      await sequelize.close();
      console.log('\n🔒 Conexión cerrada correctamente');
    }
  }
}

checkDatabaseStructure()
  .then(success => {
    if (success) {
      console.log('\n🎉 Revisión de estructura completada');
    } else {
      console.log('\n❌ Error en la revisión');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  });
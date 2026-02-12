/**
 * Script para verificar la estructura actual de la base de datos
 * Verifica existencia de tablas y columnas antes de implementar cambios
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

async function verifyDatabaseStructure() {
  let sequelize = null;
  
  try {
    console.log('🔍 Verificando estructura de la base de datos...');
    
    // Crear instancia de Sequelize
    sequelize = new Sequelize(dbConfig);
    
    // Probar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');
    
    // Verificar si existe la base de datos
    const dbPath = join(__dirname, 'data', 'chatbot_dev.db');
    console.log(`📍 Ruta de la base de datos: ${dbPath}`);
    
    // Obtener lista de tablas existentes
    const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    
    console.log('\n📊 TABLAS EXISTENTES:');
    console.log('='.repeat(50));
    
    if (tables.length === 0) {
      console.log('❌ No se encontraron tablas en la base de datos');
      return { exists: false, tables: [], structure: {} };
    }
    
    const structure = {};
    
    for (const table of tables) {
      const tableName = table.name;
      console.log(`\n🔹 Tabla: ${tableName}`);
      
      // Obtener estructura de la tabla
      const [columns] = await sequelize.query(`PRAGMA table_info(${tableName});`);
      
      structure[tableName] = {
        columns: columns,
        indexes: [],
        foreignKeys: []
      };
      
      console.log('   Columnas:');
      columns.forEach(col => {
        const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
        const primary = col.pk === 1 ? ' (PK)' : '';
        const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
        console.log(`     - ${col.name}: ${col.type} ${nullable}${primary}${defaultVal}`);
      });
      
      // Obtener índices
      const [indexes] = await sequelize.query(`PRAGMA index_list(${tableName});`);
      if (indexes && indexes.length > 0) {
        structure[tableName].indexes = indexes;
        console.log('   Índices:');
        for (const index of indexes) {
          try {
            const [indexInfo] = await sequelize.query(`PRAGMA index_info(${index.name});`);
            if (indexInfo && indexInfo.length > 0) {
              console.log(`     - ${index.name}: ${indexInfo.map(i => i.name).join(', ')}`);
            }
          } catch (indexError) {
            console.log(`     - ${index.name}: (error obteniendo info)`);
          }
        }
      }
      
      // Obtener claves foráneas
      try {
        const [foreignKeys] = await sequelize.query(`PRAGMA foreign_key_list(${tableName});`);
        if (foreignKeys && foreignKeys.length > 0) {
          structure[tableName].foreignKeys = foreignKeys;
          console.log('   Claves Foráneas:');
          foreignKeys.forEach(fk => {
            console.log(`     - ${fk.from} → ${fk.table}.${fk.to}`);
          });
        }
      } catch (fkError) {
        console.log('   Claves Foráneas: (error obteniendo info)');
      }
    }
    
    // Verificar tablas requeridas por el sistema
    const requiredTables = [
      'Users', 'Contacts', 'Conversations', 'Messages', 'MessageTemplates',
      'SystemSettings', 'Tags', 'Campaigns', 'ContactSegments', 'ConversationMetrics',
      'AuditLogs', 'AnalyticsEvents', 'BillingCustomers', 'BillingInvoices',
      'BillingPayments', 'BillingSubscriptions', 'BillingUsage', 'CommerceProducts',
      'CommerceOrders', 'CommerceOrderItems', 'CommerceInventory', 'CommerceCategories',
      'AutomationRules', 'AutomationTriggers', 'AutomationActions', 'Integrations',
      'IntegrationConfigs', 'Webhooks', 'WebhookEvents', 'Notifications',
      'NotificationTemplates', 'UserSessions', 'ApiKeys', 'RateLimits'
    ];
    
    console.log('\n🎯 ANÁLISIS DE TABLAS REQUERIDAS:');
    console.log('='.repeat(50));
    
    const existingTableNames = tables.map(t => t.name);
    const missingTables = [];
    const existingTables = [];
    
    requiredTables.forEach(table => {
      if (existingTableNames.includes(table)) {
        existingTables.push(table);
        console.log(`✅ ${table} - Existe`);
      } else {
        missingTables.push(table);
        console.log(`❌ ${table} - Faltante`);
      }
    });
    
    console.log('\n📈 RESUMEN:');
    console.log('='.repeat(50));
    console.log(`📊 Total de tablas existentes: ${existingTableNames.length}`);
    console.log(`✅ Tablas requeridas existentes: ${existingTables.length}`);
    console.log(`❌ Tablas faltantes: ${missingTables.length}`);
    
    if (missingTables.length > 0) {
      console.log('\n🚨 TABLAS FALTANTES:');
      missingTables.forEach(table => console.log(`   - ${table}`));
    }
    
    return {
      exists: true,
      tables: existingTableNames,
      structure,
      requiredTables,
      existingTables,
      missingTables,
      summary: {
        totalExisting: existingTableNames.length,
        requiredExisting: existingTables.length,
        missing: missingTables.length
      }
    };
    
  } catch (error) {
    console.error('❌ Error verificando la estructura:', error.message);
    return { exists: false, error: error.message };
    
  } finally {
    if (sequelize) {
      try {
        await sequelize.close();
        console.log('\n🔒 Conexión cerrada correctamente');
      } catch (closeError) {
        console.error('⚠️ Error al cerrar la conexión:', closeError.message);
      }
    }
  }
}

// Ejecutar verificación
verifyDatabaseStructure()
  .then(result => {
    if (result.exists) {
      console.log('\n🎉 Verificación completada exitosamente');
      if (result.missingTables && result.missingTables.length > 0) {
        console.log('⚠️ Se requiere implementar tablas faltantes');
        process.exit(1);
      } else {
        console.log('✅ Todas las tablas requeridas están presentes');
        process.exit(0);
      }
    } else {
      console.log('\n💥 Error en la verificación de la base de datos');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Error inesperado:', error);
    process.exit(1);
  });
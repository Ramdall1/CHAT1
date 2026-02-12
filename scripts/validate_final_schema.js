/**
 * Script de validación final de la estructura de base de datos
 * Verifica la integridad y completitud del esquema implementado
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
  logging: false
};

const sequelize = new Sequelize(dbConfig);

// Lista completa de tablas esperadas
const expectedTables = [
  // Tablas principales del sistema
  'users', 'contacts', 'conversations', 'messages', 'message_templates',
  'system_settings', 'tags',
  
  // Tablas de campañas y segmentación
  'campaigns', 'contact_segments', 'conversation_metrics',
  
  // Tablas de auditoría y analytics
  'audit_logs', 'analytics_events',
  
  // Tablas de billing
  'billing_customers', 'billing_invoices', 'billing_payments',
  'billing_subscriptions', 'billing_usage',
  
  // Tablas de commerce
  'commerce_products', 'commerce_orders', 'commerce_order_items',
  'commerce_inventory', 'commerce_categories',
  
  // Tablas de automatización
  'automation_rules', 'automation_triggers', 'automation_actions',
  
  // Tablas de integraciones
  'integrations', 'integration_configs', 'webhooks', 'webhook_events',
  
  // Tablas de notificaciones
  'notifications', 'notification_templates',
  
  // Tablas de sesiones y seguridad
  'user_sessions', 'api_keys', 'rate_limits'
];

// Función para obtener información de una tabla
async function getTableInfo(tableName) {
  try {
    const [columns] = await sequelize.query(`PRAGMA table_info(${tableName})`);
    const [indexes] = await sequelize.query(`PRAGMA index_list(${tableName})`);
    const [foreignKeys] = await sequelize.query(`PRAGMA foreign_key_list(${tableName})`);
    
    return {
      name: tableName,
      columns: columns.length,
      indexes: indexes.length,
      foreignKeys: foreignKeys.length,
      columnDetails: columns,
      indexDetails: indexes,
      foreignKeyDetails: foreignKeys
    };
  } catch (error) {
    return null;
  }
}

// Función para validar integridad referencial
async function validateReferentialIntegrity() {
  console.log('\n🔍 VALIDANDO INTEGRIDAD REFERENCIAL...');
  
  try {
    // Verificar que las claves foráneas están habilitadas
    const [pragmaResult] = await sequelize.query('PRAGMA foreign_keys');
    console.log(`✅ Claves foráneas habilitadas: ${pragmaResult[0].foreign_keys ? 'Sí' : 'No'}`);
    
    // Verificar integridad de claves foráneas
    const [integrityCheck] = await sequelize.query('PRAGMA foreign_key_check');
    if (integrityCheck.length === 0) {
      console.log('✅ Integridad referencial: VÁLIDA');
    } else {
      console.log('❌ Problemas de integridad referencial encontrados:');
      integrityCheck.forEach(issue => {
        console.log(`   - Tabla: ${issue.table}, Fila: ${issue.rowid}, Referencia: ${issue.parent}`);
      });
    }
  } catch (error) {
    console.log(`❌ Error validando integridad: ${error.message}`);
  }
}

// Función para verificar datos de muestra
async function validateSampleData() {
  console.log('\n📊 VERIFICANDO DATOS DE MUESTRA...');
  
  const tablesToCheck = ['users', 'system_settings', 'tags', 'message_templates'];
  
  for (const table of tablesToCheck) {
    try {
      const [result] = await sequelize.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = result[0].count;
      console.log(`✅ ${table}: ${count} registros`);
    } catch (error) {
      console.log(`❌ Error verificando ${table}: ${error.message}`);
    }
  }
}

// Función para generar reporte de índices
async function generateIndexReport() {
  console.log('\n📈 REPORTE DE ÍNDICES...');
  
  const importantTables = ['users', 'contacts', 'conversations', 'messages'];
  
  for (const table of importantTables) {
    try {
      const [indexes] = await sequelize.query(`PRAGMA index_list(${table})`);
      console.log(`\n📋 Tabla: ${table}`);
      
      if (indexes.length === 0) {
        console.log('   ⚠️  Sin índices definidos');
      } else {
        for (const index of indexes) {
          const [indexInfo] = await sequelize.query(`PRAGMA index_info(${index.name})`);
          const columns = indexInfo.map(col => col.name).join(', ');
          console.log(`   ✅ ${index.name}: [${columns}] ${index.unique ? '(UNIQUE)' : ''}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error obteniendo índices: ${error.message}`);
    }
  }
}

// Función principal de validación
async function validateFinalSchema() {
  console.log('🚀 INICIANDO VALIDACIÓN FINAL DEL ESQUEMA DE BASE DE DATOS');
  console.log('==================================================');
  
  try {
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');
    
    // Obtener tablas existentes
    const [existingTables] = await sequelize.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    const tableNames = existingTables.map(row => row.name);
    
    console.log('\n📊 RESUMEN DE TABLAS:');
    console.log('==================================================');
    console.log(`📈 Total de tablas existentes: ${tableNames.length}`);
    console.log(`📋 Total de tablas esperadas: ${expectedTables.length}`);
    
    // Verificar tablas presentes y faltantes
    const presentTables = expectedTables.filter(table => tableNames.includes(table));
    const missingTables = expectedTables.filter(table => !tableNames.includes(table));
    const extraTables = tableNames.filter(table => !expectedTables.includes(table));
    
    console.log(`✅ Tablas presentes: ${presentTables.length}`);
    console.log(`❌ Tablas faltantes: ${missingTables.length}`);
    console.log(`ℹ️  Tablas adicionales: ${extraTables.length}`);
    
    if (missingTables.length > 0) {
      console.log('\n🚨 TABLAS FALTANTES:');
      missingTables.forEach(table => console.log(`   - ${table}`));
    }
    
    if (extraTables.length > 0) {
      console.log('\n📋 TABLAS ADICIONALES:');
      extraTables.forEach(table => console.log(`   - ${table}`));
    }
    
    // Análisis detallado de tablas principales
    console.log('\n🔍 ANÁLISIS DETALLADO DE TABLAS PRINCIPALES:');
    console.log('==================================================');
    
    const mainTables = ['users', 'contacts', 'conversations', 'messages', 'message_templates'];
    
    for (const tableName of mainTables) {
      if (tableNames.includes(tableName)) {
        const tableInfo = await getTableInfo(tableName);
        if (tableInfo) {
          console.log(`\n📋 ${tableName.toUpperCase()}:`);
          console.log(`   📊 Columnas: ${tableInfo.columns}`);
          console.log(`   🔍 Índices: ${tableInfo.indexes}`);
          console.log(`   🔗 Claves foráneas: ${tableInfo.foreignKeys}`);
        }
      } else {
        console.log(`\n❌ ${tableName.toUpperCase()}: NO EXISTE`);
      }
    }
    
    // Validaciones adicionales
    await validateReferentialIntegrity();
    await validateSampleData();
    await generateIndexReport();
    
    // Estadísticas finales
    console.log('\n📈 ESTADÍSTICAS FINALES:');
    console.log('==================================================');
    
    const dbSize = await sequelize.query(`
      SELECT page_count * page_size as size 
      FROM pragma_page_count(), pragma_page_size()
    `);
    
    console.log(`💾 Tamaño de la base de datos: ${Math.round(dbSize[0][0].size / 1024)} KB`);
    
    const completionPercentage = Math.round((presentTables.length / expectedTables.length) * 100);
    console.log(`📊 Completitud del esquema: ${completionPercentage}%`);
    
    if (completionPercentage >= 90) {
      console.log('🎉 ESQUEMA COMPLETO Y VALIDADO EXITOSAMENTE');
    } else if (completionPercentage >= 70) {
      console.log('⚠️  ESQUEMA MAYORMENTE COMPLETO - REVISAR TABLAS FALTANTES');
    } else {
      console.log('🚨 ESQUEMA INCOMPLETO - SE REQUIERE IMPLEMENTACIÓN ADICIONAL');
    }
    
  } catch (error) {
    console.error('❌ Error durante la validación:', error.message);
    throw error;
  } finally {
    await sequelize.close();
    console.log('\n🔒 Conexión cerrada correctamente');
  }
}

// Ejecutar validación
validateFinalSchema()
  .then(() => {
    console.log('\n🎉 Validación completada exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Error en la validación:', error.message);
    process.exit(1);
  });
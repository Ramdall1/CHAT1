/**
 * Script para verificar mensajes en la base de datos
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
  logging: false, // Desactivar logs para mejor legibilidad
  define: {
    timestamps: true,
    underscored: true
  }
};

async function checkMessages() {
  let sequelize = null;
  
  try {
    console.log('🔍 Verificando mensajes en la base de datos...\n');
    
    // Crear instancia de Sequelize
    sequelize = new Sequelize(dbConfig);
    
    // Probar autenticación
    await sequelize.authenticate();
    
    // Verificar mensajes
    console.log('📨 MENSAJES EN LA BASE DE DATOS:');
    console.log('================================');
    
    const [messages] = await sequelize.query(`
      SELECT 
        m.id,
        m.conversation_id,
        m.content,
        m.direction,
        m.type,
        m.status,
        m.created_at,
        c.name as contact_name,
        c.phone as contact_phone
      FROM messages m
      LEFT JOIN contacts c ON m.contact_id = c.rowid
      ORDER BY m.created_at DESC
      LIMIT 20
    `);
    
    if (messages.length === 0) {
      console.log('❌ No hay mensajes en la base de datos');
    } else {
      console.log(`✅ Encontrados ${messages.length} mensajes:`);
      messages.forEach((msg, index) => {
        console.log(`\n${index + 1}. Mensaje ID: ${msg.id}`);
        console.log(`   📞 Contacto: ${msg.contact_name || 'Sin nombre'} (${msg.contact_phone || 'Sin teléfono'})`);
        console.log(`   💬 Contenido: ${msg.content}`);
        console.log(`   📍 Dirección: ${msg.direction}`);
        console.log(`   📅 Fecha: ${msg.created_at}`);
        console.log(`   🔄 Estado: ${msg.status}`);
      });
    }
    
    // Verificar conversaciones
    console.log('\n\n💬 CONVERSACIONES EN LA BASE DE DATOS:');
    console.log('=====================================');
    
    const [conversations] = await sequelize.query(`
      SELECT 
        c.id,
        c.contact_id,
        c.status,
        c.message_count,
        c.last_message_at,
        c.created_at,
        ct.name as contact_name,
        ct.phone as contact_phone
      FROM conversations c
      LEFT JOIN contacts ct ON c.contact_id = ct.rowid
      ORDER BY c.last_message_at DESC
      LIMIT 10
    `);
    
    if (conversations.length === 0) {
      console.log('❌ No hay conversaciones en la base de datos');
    } else {
      console.log(`✅ Encontradas ${conversations.length} conversaciones:`);
      conversations.forEach((conv, index) => {
        console.log(`\n${index + 1}. Conversación ID: ${conv.id}`);
        console.log(`   📞 Contacto: ${conv.contact_name || 'Sin nombre'} (${conv.contact_phone || 'Sin teléfono'})`);
        console.log(`   📊 Mensajes: ${conv.message_count || 0}`);
        console.log(`   🔄 Estado: ${conv.status}`);
        console.log(`   📅 Último mensaje: ${conv.last_message_at || 'Nunca'}`);
      });
    }
    
    // Verificar contactos
    console.log('\n\n👥 CONTACTOS EN LA BASE DE DATOS:');
    console.log('================================');
    
    const [contacts] = await sequelize.query(`
      SELECT rowid, name, phone, email, created_at
      FROM contacts
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (contacts.length === 0) {
      console.log('❌ No hay contactos en la base de datos');
    } else {
      console.log(`✅ Encontrados ${contacts.length} contactos:`);
      contacts.forEach((contact, index) => {
        console.log(`\n${index + 1}. Contacto ID: ${contact.rowid}`);
        console.log(`   👤 Nombre: ${contact.name || 'Sin nombre'}`);
        console.log(`   📞 Teléfono: ${contact.phone || 'Sin teléfono'}`);
        console.log(`   📧 Email: ${contact.email || 'Sin email'}`);
        console.log(`   📅 Creado: ${contact.created_at}`);
      });
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verificando mensajes:', error.message);
    console.error('📋 Stack trace:', error.stack);
    return false;
  } finally {
    if (sequelize) {
      await sequelize.close();
      console.log('\n🔒 Conexión cerrada correctamente');
    }
  }
}

checkMessages()
  .then(success => {
    if (success) {
      console.log('\n🎉 Verificación completada exitosamente');
    } else {
      console.log('\n❌ Verificación falló');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  });
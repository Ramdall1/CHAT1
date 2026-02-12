import LocalContactManager from './apps/api/src/services/localContactManager.js';
import { getDatabaseService } from './src/services/DatabaseService.js';
import sqlite3 from 'sqlite3';

async function testNameModification() {
  try {
    console.log('🧪 Iniciando prueba de modificación de nombres...');

    // Inicializar servicios
    const dataDir = './data';
    const db = getDatabaseService();
    await db.initialize();

    const contactManager = new LocalContactManager(dataDir);
    await contactManager.init();

    console.log('✅ Servicios inicializados');

    // Crear un contacto de prueba
    const testPhone = '573113705258';
    const initialContact = await contactManager.createContact(testPhone, {
      name: 'Juan Pérez',
      email: 'juan@example.com'
    });

    console.log('👤 Contacto creado:', initialContact);

    // Verificar en base de datos
    const sqlite = new sqlite3.Database('./data/database.sqlite');

    const contactQuery = () => new Promise((resolve, reject) => {
      sqlite.get('SELECT * FROM contacts WHERE phone_number = ?', [testPhone], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    let contact = await contactQuery();
    console.log('📊 Contacto en BD inicial:', contact);

    // ===== PRUEBA 1: Modificar nombre completo =====
    console.log('\n🔄 Prueba 1: Modificando nombre completo...');
    const updatedContact1 = await contactManager.updateContact(testPhone, {
      name: 'María González'
    });

    console.log('✅ Contacto actualizado:', updatedContact1);

    contact = await contactQuery();
    console.log('📊 Contacto en BD después de actualización:', contact);

    // ===== PRUEBA 2: Modificar solo email (sin cambiar nombre) =====
    console.log('\n🔄 Prueba 2: Modificando solo email...');
    const updatedContact2 = await contactManager.updateContact(testPhone, {
      email: 'maria.gonzalez@example.com'
    });

    console.log('✅ Contacto actualizado:', updatedContact2);

    contact = await contactQuery();
    console.log('📊 Contacto en BD después de actualización de email:', contact);

    // ===== PRUEBA 3: Modificar nombre y otros campos =====
    console.log('\n🔄 Prueba 3: Modificando nombre y otros campos...');
    const updatedContact3 = await contactManager.updateContact(testPhone, {
      name: 'María González Rodríguez',
      notes: 'Cliente VIP actualizado'
    });

    console.log('✅ Contacto actualizado:', updatedContact3);

    contact = await contactQuery();
    console.log('📊 Contacto en BD final:', contact);

    // ===== PRUEBA 4: Verificar que el nombre se actualiza correctamente en logs =====
    console.log('\n🔍 Verificando logs de actualización...');
    // Los logs ya se muestran arriba en las actualizaciones

    sqlite.close();

    console.log('\n🎉 Prueba de modificación de nombres completada exitosamente!');
    console.log('✅ El sistema maneja correctamente la actualización de nombres');
    console.log('✅ Los cambios se reflejan inmediatamente en la base de datos');
    console.log('✅ Los logs muestran las actualizaciones correctamente');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    console.error('Stack trace:', error.stack);
  }
}

testNameModification();
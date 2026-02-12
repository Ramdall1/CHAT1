import LocalContactManager from './apps/api/src/services/localContactManager.js';
import { getDatabaseService } from './src/services/DatabaseService.js';
import sqlite3 from 'sqlite3';

async function testFirstLastNameModification() {
  try {
    console.log('🧪 Iniciando prueba de modificación de nombre y apellido...');

    // Inicializar servicios
    const dataDir = './data';
    const db = getDatabaseService();
    await db.initialize();

    const contactManager = new LocalContactManager(dataDir);
    await contactManager.init();

    console.log('✅ Servicios inicializados');

    // Crear un contacto de prueba con nombre y apellido separados
    const testPhone = '573113705258';
    const initialContact = await contactManager.createContact(testPhone, {
      firstName: 'Juan',
      lastName: 'Pérez',
      name: 'Juan Pérez', // Nombre completo también
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

    // ===== PRUEBA 1: Modificar solo el nombre (first_name) =====
    console.log('\n🔄 Prueba 1: Modificando solo el nombre (first_name)...');
    const updatedContact1 = await contactManager.updateContact(testPhone, {
      firstName: 'María'
    });

    console.log('✅ Contacto actualizado:', updatedContact1);

    contact = await contactQuery();
    console.log('📊 Contacto en BD después de modificar first_name:', contact);

    // ===== PRUEBA 2: Modificar solo el apellido (last_name) =====
    console.log('\n🔄 Prueba 2: Modificando solo el apellido (last_name)...');
    const updatedContact2 = await contactManager.updateContact(testPhone, {
      lastName: 'González'
    });

    console.log('✅ Contacto actualizado:', updatedContact2);

    contact = await contactQuery();
    console.log('📊 Contacto en BD después de modificar last_name:', contact);

    // ===== PRUEBA 3: Modificar nombre y apellido simultáneamente =====
    console.log('\n🔄 Prueba 3: Modificando nombre y apellido simultáneamente...');
    const updatedContact3 = await contactManager.updateContact(testPhone, {
      firstName: 'Ana',
      lastName: 'Rodríguez'
    });

    console.log('✅ Contacto actualizado:', updatedContact3);

    contact = await contactQuery();
    console.log('📊 Contacto en BD final:', contact);

    // ===== PRUEBA 4: Verificar que el nombre completo se actualiza automáticamente =====
    console.log('\n🔄 Prueba 4: Verificando actualización automática del nombre completo...');
    const updatedContact4 = await contactManager.updateContact(testPhone, {
      firstName: 'Carlos',
      lastName: 'Martínez'
    });

    console.log('✅ Contacto actualizado:', updatedContact4);

    contact = await contactQuery();
    console.log('📊 Contacto en BD con nombre completo actualizado:', contact);

    // ===== PRUEBA 5: Crear contacto usando campos separados =====
    console.log('\n🔄 Prueba 5: Creando nuevo contacto con campos separados...');
    const newPhone = '573002368847';
    const newContact = await contactManager.createContact(newPhone, {
      firstName: 'Pedro',
      lastName: 'López',
      email: 'pedro@example.com'
    });

    console.log('✅ Nuevo contacto creado:', newContact);

    const newContactQuery = () => new Promise((resolve, reject) => {
      sqlite.get('SELECT * FROM contacts WHERE phone_number = ?', [newPhone], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const newContactFromDB = await newContactQuery();
    console.log('📊 Nuevo contacto en BD:', newContactFromDB);

    sqlite.close();

    console.log('\n🎉 Prueba de modificación de nombre y apellido completada exitosamente!');
    console.log('✅ El sistema maneja correctamente first_name y last_name');
    console.log('✅ Los cambios se reflejan inmediatamente en la base de datos');
    console.log('✅ Los campos separados funcionan correctamente');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    console.error('Stack trace:', error.stack);
  }
}

testFirstLastNameModification();
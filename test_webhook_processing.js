import LocalMessagingService from './apps/api/src/services/localMessagingService.js';
import LocalContactManager from './apps/api/src/services/localContactManager.js';
import { getDatabaseService } from './src/services/DatabaseService.js';
import sqlite3 from 'sqlite3';

async function testWebhookProcessing() {
  try {
    console.log('🧪 Iniciando prueba de procesamiento de webhook...');

    // Inicializar servicios
    const dataDir = './data';
    const db = getDatabaseService();
    await db.initialize();

    const contactManager = new LocalContactManager(dataDir);
    await contactManager.init();

    const messagingService = new LocalMessagingService(dataDir, contactManager, db);
    await messagingService.init();

    console.log('✅ Servicios inicializados');

    // Simular mensaje entrante como si viniera del webhook
    const mockMessage = {
      id: 'test_message_' + Date.now(),
      from: '573113705258',
      type: 'text',
      text: {
        body: 'Mensaje de prueba desde webhook simulado'
      },
      timestamp: Math.floor(Date.now() / 1000),
      _profileName: 'Usuario de Prueba'
    };

    console.log('📨 Procesando mensaje simulado:', mockMessage);

    // Procesar el mensaje usando receiveMessage
    const result = await messagingService.receiveMessage(mockMessage);

    console.log('✅ Mensaje procesado:', result);

    // Verificar que se creó el contacto
    console.log('\n🔍 Verificando creación de contacto...');
    const sqlite = new sqlite3.Database('./data/database.sqlite');

    const contactQuery = () => new Promise((resolve, reject) => {
      sqlite.get('SELECT * FROM contacts WHERE phone_number = ?', [mockMessage.from], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const contact = await contactQuery();
    console.log('👤 Contacto creado:', contact);

    // Verificar que se creó la conversación
    const conversationQuery = () => new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM conversations', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const conversations = await conversationQuery();
    console.log('💬 Conversaciones creadas:', conversations);

    // Verificar que se guardó el mensaje
    const messageQuery = () => new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const messages = await messageQuery();
    console.log('📨 Mensajes guardados:', messages);

    sqlite.close();

    console.log('\n🎉 Prueba completada exitosamente!');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    console.error('Stack trace:', error.stack);
  }
}

testWebhookProcessing();
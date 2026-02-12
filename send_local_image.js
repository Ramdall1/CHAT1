import { getDatabaseService } from './src/services/DatabaseService.js';
import LocalMessagingService from './apps/api/src/services/localMessagingService.js';
import LocalContactManager from './apps/api/src/services/localContactManager.js';
import { unified360DialogService } from './src/services/core/core/Unified360DialogService.js';
import fs from 'fs';
import path from 'path';

async function sendLocalImage() {
  try {
    console.log('🚀 Enviando imagen local desde carpeta capturas...');

    // Verificar estado del servicio WhatsApp
    console.log('🔍 Verificando estado del servicio WhatsApp...');
    console.log('API Key configurada:', process.env.D360_API_KEY ? '✅ Sí' : '❌ No');
    console.log('Phone Number ID:', process.env.D360_PHONE_NUMBER_ID || 'No configurado');

    // Inicializar servicios
    const dataDir = './data';
    const db = getDatabaseService();
    await db.initialize();

    const contactManager = new LocalContactManager(dataDir);
    await contactManager.init();

    const messagingService = new LocalMessagingService(dataDir, contactManager, db);
    await messagingService.init();

    console.log('✅ Servicios inicializados');

    // Número de teléfono destino
    const phone = '573113705258';
    console.log(`📱 Enviando a: ${phone}`);

    // Ruta de la imagen en capturas
    const imagePath = path.join(process.cwd(), 'capturas', 'test-image.jpg');
    console.log(`📂 Ruta de imagen: ${imagePath}`);

    // Verificar que el archivo existe
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Error: Archivo no encontrado: ${imagePath}`);
      console.log('📁 Contenido de la carpeta capturas:');
      try {
        const files = fs.readdirSync(path.join(process.cwd(), 'capturas'));
        console.log(files);
      } catch (e) {
        console.log('❌ No se puede leer la carpeta capturas');
      }
      return;
    }

    // Leer el archivo
    console.log('📖 Leyendo archivo de imagen...');
    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`📦 Imagen cargada: ${imageBuffer.length} bytes`);

    // Subir la imagen a WhatsApp
    console.log('☁️ Subiendo imagen a WhatsApp...');
    const uploadResult = await messagingService.uploadMedia(
      imageBuffer,
      'image/jpeg',
      'imagen-desde-capturas.jpg'
    );

    if (uploadResult.success && uploadResult.mediaId) {
      console.log('✅ Imagen subida exitosamente:', uploadResult);

      // Enviar la imagen usando Media ID
      console.log('📤 Enviando imagen usando Media ID...');
      const sendResult = await messagingService.sendImage(
        phone,
        uploadResult.mediaId,
        'Imagen enviada desde carpeta capturas/ usando Media ID'
      );

      console.log('🎉 ¡Imagen enviada exitosamente!');
      console.log('📊 Detalles del envío:', sendResult);

    } else {
      console.log('❌ Error al subir la imagen:', uploadResult);
    }

  } catch (error) {
    console.error('❌ Error enviando imagen local:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Ejecutar la función
sendLocalImage();
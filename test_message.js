import { getDatabaseService } from './src/services/DatabaseService.js';
import LocalMessagingService from './apps/api/src/services/localMessagingService.js';
import LocalContactManager from './apps/api/src/services/localContactManager.js';
import { unified360DialogService } from './src/services/core/core/Unified360DialogService.js';

async function testMessage() {
  try {
    console.log('🚀 Iniciando prueba de envío de mensaje...');

    // Verificar estado del servicio WhatsApp
    console.log('🔍 Verificando estado del servicio WhatsApp...');
    console.log('API Key configurada:', process.env.D360_API_KEY ? '✅ Sí' : '❌ No');
    console.log('Phone Number ID:', process.env.D360_PHONE_NUMBER_ID || 'No configurado');
    console.log('Servicio habilitado:', unified360DialogService.isEnabled ? '✅ Sí' : '❌ No');

    // Inicializar servicios
    const dataDir = './data';
    const db = getDatabaseService();
    await db.initialize();

    const contactManager = new LocalContactManager(dataDir);
    await contactManager.init();

    const messagingService = new LocalMessagingService(dataDir, contactManager, db);
    await messagingService.init();

    console.log('✅ Servicios inicializados');

    // Probar diferentes números de teléfono
    const testPhones = [
      '573113705258', // Número original
      '573002368847', // Otro número de la base de datos
      '573009840607'  // Otro número de la base de datos
    ];

    for (const phone of testPhones) {
      console.log(`\n📱 Probando con número: ${phone}`);

      try {
        // Enviar mensaje de texto
        const message = `Prueba de envío desde sistema chatbot - ${new Date().toLocaleTimeString()}`;
        console.log(`📤 Enviando mensaje: ${message}`);

        const result = await messagingService.sendText(phone, message);
        console.log('✅ Mensaje enviado exitosamente:', result);

        // Si funciona, enviar plantilla
        console.log('📋 Enviando plantilla...');
        const templateResult = await messagingService.sendTemplate({
          to: phone,
          name: 'bienvenida',
          components: [
            {
              type: 'body',
              parameters: [
                { text: 'Usuario de Prueba' }
              ]
            }
          ]
        });
        console.log('✅ Plantilla enviada exitosamente:', templateResult);

        // Probar envío de imagen usando URL directa (Método 1)
        console.log('🖼️ Enviando imagen por URL...');
        try {
          const imageResult = await messagingService.sendMedia(
            phone,
            'image',
            'https://picsum.photos/800/600?random=1',
            'Imagen de prueba desde URL'
          );
          console.log('✅ Imagen enviada por URL:', imageResult);
        } catch (error) {
          console.log('⚠️ Error enviando imagen por URL (esperado con credenciales de prueba):', error.message);
        }

        // Probar envío de video usando URL directa (Método 1)
        console.log('🎥 Enviando video por URL...');
        try {
          const videoResult = await messagingService.sendMedia(
            phone,
            'video',
            'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
            'Video de prueba desde URL'
          );
          console.log('✅ Video enviado por URL:', videoResult);
        } catch (error) {
          console.log('⚠️ Error enviando video por URL (esperado con credenciales de prueba):', error.message);
        }

        // Probar subida de imagen LOCAL desde carpeta capturas (Método 2 - Media ID)
        console.log('📤 Probando subida de imagen LOCAL desde carpeta capturas...');
        try {
          const fs = await import('fs');
          const path = await import('path');

          // Leer imagen local desde carpeta capturas
          const imagePath = path.join(process.cwd(), 'capturas', 'test-image.jpg');
          console.log(`📂 Leyendo imagen local: ${imagePath}`);

          if (!fs.existsSync(imagePath)) {
            throw new Error(`Archivo no encontrado: ${imagePath}`);
          }

          const imageBuffer = fs.readFileSync(imagePath);
          console.log(`📦 Imagen local cargada: ${imageBuffer.length} bytes`);

          // Subir la imagen local a WhatsApp
          console.log('☁️ Subiendo imagen local a WhatsApp...');
          const uploadResult = await messagingService.uploadMedia(
            imageBuffer,
            'image/jpeg',
            'test-image-local.jpg'
          );
          console.log('✅ Media subida desde archivo local:', uploadResult);

          // Si la subida fue exitosa, probar envío usando Media ID
          if (uploadResult.success && uploadResult.mediaId) {
            console.log('🖼️ Enviando imagen local usando Media ID...');
            const imageByIdResult = await messagingService.sendImage(
              phone,
              uploadResult.mediaId,
              'Imagen LOCAL subida desde capturas/ y enviada usando Media ID'
            );
            console.log('✅ Imagen local enviada por Media ID:', imageByIdResult);
          } else {
            console.log('⚠️ La subida no fue exitosa, intentando con URL directa...');
            // Fallback: usar URL directa
            const imageUrlResult = await messagingService.sendMedia(
              phone,
              'image',
              'https://picsum.photos/800/600?random=fallback',
              'Imagen fallback enviada por URL directa'
            );
            console.log('✅ Imagen fallback enviada por URL:', imageUrlResult);
          }
        } catch (error) {
          console.log('⚠️ Error en subida/envío de imagen local:', error.message);
          console.log('🔄 Intentando método alternativo con URL directa...');

          try {
            // Método alternativo: enviar por URL directa
            const fallbackResult = await messagingService.sendMedia(
              phone,
              'image',
              'https://picsum.photos/800/600?random=backup',
              'Imagen de respaldo desde URL'
            );
            console.log('✅ Imagen enviada por método alternativo:', fallbackResult);
          } catch (fallbackError) {
            console.log('❌ Ambos métodos fallaron:', fallbackError.message);
          }
        }

        break; // Si uno funciona, salir

      } catch (error) {
        console.error(`❌ Error con ${phone}:`, error.message);
        if (error.details) {
          console.error('Detalles del error:', error.details);
        }
      }
    }

    console.log('🎉 Prueba completada!');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    console.error('Stack trace:', error.stack);
  }
}

testMessage();
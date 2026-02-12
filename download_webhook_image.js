import { unified360DialogService } from './src/services/core/core/Unified360DialogService.js';
import fs from 'fs';
import path from 'path';

async function downloadWebhookImage() {
  try {
    console.log('📥 Descargando imagen desde webhook usando servicio unificado...');

    // Media ID del mensaje
    const mediaId = '1868213827124787';

    console.log('🆔 Media ID:', mediaId);
    console.log('🔑 Usando servicio Unified360DialogService');

    // Paso 1: Generar nueva URL desde Media ID
    console.log('🔄 Generando nueva URL desde Media ID...');
    const urlResult = await unified360DialogService.generateMediaUrl(mediaId);

    if (!urlResult.success) {
      throw new Error('No se pudo generar la URL del media');
    }

    const mediaUrl = urlResult.mediaUrl;
    console.log('✅ Nueva URL generada:', mediaUrl);
    console.log('📝 URL original:', urlResult.originalUrl);

    // Crear directorio si no existe
    const downloadDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
      console.log('📁 Directorio downloads/ creado');
    }

    // Nombre del archivo
    const filename = `imagen_nia_${Date.now()}.jpg`;
    const filepath = path.join(downloadDir, filename);

    // Paso 2: Descargar usando la nueva URL
    console.log('📥 Descargando imagen con la nueva URL...');
    const result = await unified360DialogService.downloadMediaFromWebhook(mediaUrl, filepath);

    console.log('✅ Imagen descargada exitosamente');
    console.log(`📊 Tamaño: ${result.size} bytes`);
    console.log(`📋 Tipo MIME: ${result.mimeType}`);
    console.log(`💾 Archivo guardado en: ${result.path}`);

    // Verificar que se guardó correctamente
    const stats = fs.statSync(filepath);
    console.log(`✅ Verificación: ${stats.size} bytes guardados`);

    console.log('\n🎉 ¡Imagen de Nia descargada y guardada exitosamente!');
    console.log(`📂 Ubicación: ${filepath}`);
    console.log(`👤 Remitente: Nia (573246874692)`);
    console.log(`🆔 Media ID: ${mediaId}`);
    console.log(`📅 Timestamp: ${new Date().toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error descargando imagen:', error.message);

    if (error.response) {
      console.error('📊 Status Code:', error.response.status);
      console.error('📋 Response Headers:', error.response.headers);
    }

    console.log('\n🔧 Posibles soluciones:');
    console.log('1. Verificar que la API Key sea correcta');
    console.log('2. Confirmar que el Media ID sea válido');
    console.log('3. Revisar conectividad a internet');
    console.log('4. Verificar que el servicio 360Dialog esté disponible');
  }
}

// Ejecutar la función
downloadWebhookImage();
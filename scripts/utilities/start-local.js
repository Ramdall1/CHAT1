#!/usr/bin/env node

/**
 * Script para iniciar el servidor en modo completamente LOCAL
 * Sin dependencias externas, solo almacenamiento local
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🏠 Iniciando servidor en MODO LOCAL...');
console.log('📁 Todos los datos se guardarán localmente');
console.log('🔒 Sin conexiones externas requeridas');
console.log('');

// Verificar que existe el archivo .env.local
const envLocalPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envLocalPath)) {
  console.error('❌ Error: No se encontró el archivo .env.local');
  console.log('💡 Ejecuta primero: cp .env.local.example .env.local');
  process.exit(1);
}

// Configurar variables de entorno para modo local
process.env.NODE_ENV = 'local';
process.env.LOCAL_MODE = 'true';
process.env.OFFLINE_MODE = 'true';
process.env.SIMULATE_WHATSAPP = 'true';
process.env.AI_ENABLED = 'false';
process.env.WEBHOOK_ENABLED = 'false';

// Cargar configuración local
import dotenv from 'dotenv';
dotenv.config({ path: envLocalPath });

console.log('⚙️  Configuración cargada:');
console.log(`   - Puerto: ${process.env.PORT || 3000}`);
console.log(`   - Modo Local: ${process.env.LOCAL_MODE}`);
console.log(`   - Modo Offline: ${process.env.OFFLINE_MODE}`);
console.log(`   - Simular WhatsApp: ${process.env.SIMULATE_WHATSAPP}`);
console.log(`   - Directorio de datos: ${process.env.DATA_DIR || './data'}`);
console.log('');

// Iniciar el servidor integrado
const serverProcess = spawn('node', ['src/server_integrated.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

serverProcess.on('close', (code) => {
  console.log(`\n🔴 Servidor terminado con código: ${code}`);
});

serverProcess.on('error', (error) => {
  console.error('❌ Error iniciando servidor:', error);
});

// Manejar señales de terminación
process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo servidor local...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Deteniendo servidor local...');
  serverProcess.kill('SIGTERM');
});

console.log('🚀 Servidor iniciando...');
console.log('📱 Interfaz web disponible en: http://localhost:' + (process.env.PORT || 3000));
console.log('💾 Todos los datos se guardan en: ./data/');
console.log('');
console.log('💡 Para detener el servidor: Ctrl+C');
console.log('📖 Para más información, revisa README_LOCAL.md');
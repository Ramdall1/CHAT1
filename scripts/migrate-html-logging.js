#!/usr/bin/env node

/**
 * Script de migración para reemplazar console.log con el nuevo sistema de logging
 * en archivos HTML del directorio /public
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'html-migration');

// Archivos a migrar (basado en la búsqueda anterior)
const FILES_TO_MIGRATE = [
  'performance-monitor.html',
  'ai-admin-dashboard.html',
  'sandbox-demo.html',
  'manychat-demo.html',
  'dashboard-modern.html',
  'design-preview.html',
  'analytics.html',
  'notifications-dashboard.html',
  'index-manychat.html'
];

// Patrones de reemplazo
const REPLACEMENTS = [
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.info('
  },
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error('
  },
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn('
  },
  {
    pattern: /console\.info\(/g,
    replacement: 'logger.info('
  },
  {
    pattern: /console\.debug\(/g,
    replacement: 'logger.debug('
  }
];

// Template para inyectar el logger
const LOGGER_INJECTION = `
    <!-- Sistema de Logging Frontend -->
    <script src="client/utils/FrontendLogger.js"></script>
    <script>
        // Configurar logger específico para este componente
        const componentName = document.title.split(' - ')[0] || 'Dashboard';
        const logger = window.createLogger(componentName, {
            level: 'info',
            enableConsole: true,
            enableStorage: true,
            enableRemote: false
        });
        
        // Log de inicialización
        logger.info('Componente inicializado', { 
            url: window.location.href,
            timestamp: new Date().toISOString()
        });
    </script>`;

/**
 * Crear directorio de backup si no existe
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✅ Directorio de backup creado: ${BACKUP_DIR}`);
  }
}

/**
 * Crear backup de un archivo
 */
function createBackup(filePath) {
  const fileName = path.basename(filePath);
  const backupPath = path.join(BACKUP_DIR, `${fileName}.backup`);
    
  try {
    fs.copyFileSync(filePath, backupPath);
    console.log(`📁 Backup creado: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error creando backup para ${fileName}:`, error.message);
    return false;
  }
}

/**
 * Inyectar el sistema de logging en un archivo HTML
 */
function injectLogger(content, fileName) {
  // Buscar el final del <head> o antes del primer <script>
  let injectionPoint = content.indexOf('</head>');
    
  if (injectionPoint === -1) {
    // Si no hay </head>, buscar el primer <script>
    injectionPoint = content.indexOf('<script');
    if (injectionPoint === -1) {
      // Si no hay scripts, inyectar antes de </body>
      injectionPoint = content.indexOf('</body>');
      if (injectionPoint === -1) {
        console.warn(`⚠️  No se encontró punto de inyección en ${fileName}`);
        return content;
      }
    }
  }

  // Inyectar el logger
  const beforeInjection = content.substring(0, injectionPoint);
  const afterInjection = content.substring(injectionPoint);
    
  return beforeInjection + LOGGER_INJECTION + '\n' + afterInjection;
}

/**
 * Aplicar reemplazos de console.* a logger.*
 */
function applyReplacements(content) {
  let modifiedContent = content;
  let replacementCount = 0;

  REPLACEMENTS.forEach(({ pattern, replacement }) => {
    const matches = modifiedContent.match(pattern);
    if (matches) {
      replacementCount += matches.length;
      modifiedContent = modifiedContent.replace(pattern, replacement);
    }
  });

  return { content: modifiedContent, count: replacementCount };
}

/**
 * Migrar un archivo específico
 */
function migrateFile(fileName) {
  const filePath = path.join(PUBLIC_DIR, fileName);
    
  console.log(`\n🔄 Migrando: ${fileName}`);
    
  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${fileName}`);
    return false;
  }

  // Crear backup
  if (!createBackup(filePath)) {
    return false;
  }

  try {
    // Leer contenido original
    let content = fs.readFileSync(filePath, 'utf8');
        
    // Verificar si ya tiene el logger inyectado
    if (content.includes('FrontendLogger.js')) {
      console.log(`⏭️  ${fileName} ya tiene el logger inyectado, solo aplicando reemplazos`);
    } else {
      // Inyectar el sistema de logging
      content = injectLogger(content, fileName);
      console.log(`✅ Logger inyectado en ${fileName}`);
    }

    // Aplicar reemplazos de console.* a logger.*
    const { content: modifiedContent, count } = applyReplacements(content);
        
    if (count > 0) {
      console.log(`✅ ${count} llamadas a console.* reemplazadas en ${fileName}`);
    } else {
      console.log(`ℹ️  No se encontraron llamadas a console.* en ${fileName}`);
    }

    // Escribir archivo modificado
    fs.writeFileSync(filePath, modifiedContent, 'utf8');
    console.log(`✅ ${fileName} migrado exitosamente`);
        
    return true;
  } catch (error) {
    console.error(`❌ Error migrando ${fileName}:`, error.message);
    return false;
  }
}

/**
 * Función principal
 */
function main() {
  console.log('🚀 Iniciando migración del sistema de logging en archivos HTML\n');
    
  // Crear directorio de backup
  ensureBackupDir();
    
  let successCount = 0;
  let errorCount = 0;
    
  // Migrar cada archivo
  FILES_TO_MIGRATE.forEach(fileName => {
    if (migrateFile(fileName)) {
      successCount++;
    } else {
      errorCount++;
    }
  });
    
  // Resumen
  console.log('\n📊 RESUMEN DE MIGRACIÓN');
  console.log('========================');
  console.log(`✅ Archivos migrados exitosamente: ${successCount}`);
  console.log(`❌ Archivos con errores: ${errorCount}`);
  console.log(`📁 Backups guardados en: ${BACKUP_DIR}`);
    
  if (errorCount === 0) {
    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('\n📝 Próximos pasos:');
    console.log('1. Verificar que los archivos funcionan correctamente');
    console.log('2. Probar el nuevo sistema de logging en el navegador');
    console.log('3. Revisar la consola del navegador para confirmar el funcionamiento');
    console.log('4. Si todo funciona bien, eliminar los backups');
  } else {
    console.log('\n⚠️  Migración completada con errores. Revisar los archivos fallidos.');
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  migrateFile,
  FILES_TO_MIGRATE,
  REPLACEMENTS
};
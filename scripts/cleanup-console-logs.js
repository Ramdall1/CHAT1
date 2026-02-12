#!/usr/bin/env node

/**
 * Script para limpiar console.log, console.error y console.warn
 * Reemplaza con logger.debug(), logger.error() y logger.warn()
 * 
 * Uso: node scripts/cleanup-console-logs.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colores ANSI
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m'
};

const srcDir = path.join(__dirname, '../src');
let filesProcessed = 0;
let logsRemoved = 0;
let logTypes = {
  debug: 0,
  error: 0,
  warn: 0
};

/**
 * Procesar un archivo y limpiar console.log
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Contar antes de reemplazar
    const debugCount = (originalContent.match(/console\.log\(/g) || []).length;
    const errorCount = (originalContent.match(/console\.error\(/g) || []).length;
    const warnCount = (originalContent.match(/console\.warn\(/g) || []).length;

    // Reemplazar console.log con logger.debug
    content = content.replace(/console\.log\(/g, 'logger.debug(');
    logTypes.debug += debugCount;

    // Reemplazar console.error con logger.error
    content = content.replace(/console\.error\(/g, 'logger.error(');
    logTypes.error += errorCount;

    // Reemplazar console.warn con logger.warn
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
    logTypes.warn += warnCount;

    logsRemoved += debugCount + errorCount + warnCount;

    // Si hubo cambios, escribir el archivo
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesProcessed++;
      
      const relativePath = filePath.replace(srcDir, '');
      const totalChanges = debugCount + errorCount + warnCount;
      
      if (totalChanges > 0) {
        console.log(`${colors.green}✓${colors.reset} ${colors.cyan}${relativePath}${colors.reset} ${colors.dim}(${totalChanges} cambios)${colors.reset}`);
      }
    }
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Error: ${error.message}`);
  }
}

/**
 * Recorrer directorio recursivamente
 */
function walkDir(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Ignorar node_modules, .git, dist, build
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(file)) {
        walkDir(filePath);
      }
    } else if (file.endsWith('.js') && !file.endsWith('.test.js') && !file.endsWith('.spec.js')) {
      processFile(filePath);
    }
  });
}

// Mostrar encabezado
console.log(`\n${colors.bgCyan}${colors.white}${colors.bright} 🧹 LIMPIEZA DE CONSOLE.LOG ${colors.reset}\n`);
console.log(`${colors.dim}Procesando archivos en: ${srcDir}${colors.reset}\n`);

// Procesar archivos
walkDir(srcDir);

// Mostrar resumen
console.log(`\n${colors.bright}${colors.green}✓ Limpieza completada!${colors.reset}\n`);
console.log(`${colors.bright}📊 Estadísticas:${colors.reset}`);
console.log(`   ${colors.cyan}Archivos procesados:${colors.reset} ${colors.bright}${filesProcessed}${colors.reset}`);
console.log(`   ${colors.cyan}Total de cambios:${colors.reset} ${colors.bright}${logsRemoved}${colors.reset}`);
console.log(`   ${colors.yellow}├─ console.log → logger.debug:${colors.reset} ${colors.bright}${logTypes.debug}${colors.reset}`);
console.log(`   ${colors.yellow}├─ console.error → logger.error:${colors.reset} ${colors.bright}${logTypes.error}${colors.reset}`);
console.log(`   ${colors.yellow}└─ console.warn → logger.warn:${colors.reset} ${colors.bright}${logTypes.warn}${colors.reset}`);
console.log(`\n${colors.dim}Todos los archivos han sido actualizados correctamente.${colors.reset}\n`);

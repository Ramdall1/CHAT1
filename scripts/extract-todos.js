#!/usr/bin/env node

/**
 * Script para extraer todos los TODO y FIXME del código
 * Genera un reporte en formato markdown
 * 
 * Uso: node scripts/extract-todos.js > TODOS.md
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
  bgCyan: '\x1b[46m',
  bgYellow: '\x1b[43m',
  white: '\x1b[37m'
};

const srcDir = path.join(__dirname, '../src');
const todos = [];
const fixmes = [];

/**
 * Procesar un archivo y extraer TODO/FIXME
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(srcDir, filePath);

    lines.forEach((line, index) => {
      const todoMatch = line.match(/\/\/\s*TODO:\s*(.+)/);
      const fixmeMatch = line.match(/\/\/\s*FIXME:\s*(.+)/);

      if (todoMatch) {
        todos.push({
          file: relativePath,
          line: index + 1,
          message: todoMatch[1].trim()
        });
      }

      if (fixmeMatch) {
        fixmes.push({
          file: relativePath,
          line: index + 1,
          message: fixmeMatch[1].trim()
        });
      }
    });
  } catch (error) {
    // Ignorar errores de lectura
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
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(file)) {
        walkDir(filePath);
      }
    } else if (file.endsWith('.js')) {
      processFile(filePath);
    }
  });
}

// Mostrar encabezado
console.error(`\n${colors.bgCyan}${colors.white}${colors.bright} 📋 EXTRACCIÓN DE TODO/FIXME ${colors.reset}\n`);
console.error(`${colors.dim}Procesando archivos en: ${srcDir}${colors.reset}\n`);

walkDir(srcDir);

// Mostrar resumen en stderr
console.error(`\n${colors.bright}${colors.green}✓ Extracción completada!${colors.reset}\n`);
console.error(`${colors.bright}📊 Resumen:${colors.reset}`);
console.error(`   ${colors.cyan}TODOs encontrados:${colors.reset} ${colors.bright}${todos.length}${colors.reset}`);
console.error(`   ${colors.cyan}FIXMEs encontrados:${colors.reset} ${colors.bright}${fixmes.length}${colors.reset}`);
console.error(`   ${colors.cyan}Total:${colors.reset} ${colors.bright}${todos.length + fixmes.length}${colors.reset}`);
console.error(`\n${colors.dim}Reporte guardado en TODOS.md${colors.reset}\n`);

// Mostrar reporte en stdout
console.log('# TODO y FIXME - Reporte de Tareas Pendientes\n');
console.log(`**Generado:** ${new Date().toISOString()}\n`);

// Mostrar TODOs
console.log('## 📋 TODO (Tareas Pendientes)\n');
console.log(`**Total:** ${todos.length} items\n`);

if (todos.length > 0) {
  todos.forEach(todo => {
    console.log(`- **${todo.file}:${todo.line}** - ${todo.message}`);
  });
} else {
  console.log('✅ No hay TODOs pendientes\n');
}

console.log('\n---\n');

// Mostrar FIXMEs
console.log('## 🔧 FIXME (Correcciones Necesarias)\n');
console.log(`**Total:** ${fixmes.length} items\n`);

if (fixmes.length > 0) {
  fixmes.forEach(fixme => {
    console.log(`- **${fixme.file}:${fixme.line}** - ${fixme.message}`);
  });
} else {
  console.log('✅ No hay FIXMEs pendientes\n');
}

console.log('\n---\n');

// Resumen
console.log('## 📊 Resumen\n');
console.log(`- **TODOs:** ${todos.length}`);
console.log(`- **FIXMEs:** ${fixmes.length}`);
console.log(`- **Total:** ${todos.length + fixmes.length}`);

#!/usr/bin/env node

/**
 * Script para encontrar código potencialmente muerto
 * Busca funciones no usadas, imports sin usar, variables sin usar
 * 
 * Uso: node scripts/find-dead-code.js
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
  bgRed: '\x1b[41m',
  white: '\x1b[37m'
};

const srcDir = path.join(__dirname, '../src');
const unusedFunctions = [];
const unusedImports = [];
const unusedVariables = [];

/**
 * Procesar un archivo
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(srcDir, filePath);

    // Buscar funciones que podrían no estar siendo usadas
    const functionMatches = content.matchAll(/function\s+(\w+)\s*\(/g);
    for (const match of functionMatches) {
      const funcName = match[1];
      // Contar cuántas veces se menciona la función (excluyendo la definición)
      const count = (content.match(new RegExp(`\\b${funcName}\\b`, 'g')) || []).length;
      if (count === 1) {
        unusedFunctions.push({
          file: relativePath,
          name: funcName
        });
      }
    }

    // Buscar imports sin usar
    const importMatches = content.matchAll(/import\s+(?:{([^}]+)}|(\w+))\s+from/g);
    for (const match of importMatches) {
      const imports = match[1] || match[2];
      if (imports) {
        const importNames = imports.split(',').map(i => i.trim().split(' as ')[0]);
        importNames.forEach(name => {
          if (name && !content.includes(name)) {
            unusedImports.push({
              file: relativePath,
              name: name
            });
          }
        });
      }
    }

    // Buscar variables const sin usar
    const varMatches = content.matchAll(/const\s+(\w+)\s*=/g);
    for (const match of varMatches) {
      const varName = match[1];
      const count = (content.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length;
      if (count === 1 && !varName.startsWith('_')) {
        unusedVariables.push({
          file: relativePath,
          name: varName
        });
      }
    }
  } catch (error) {
    // Ignorar errores
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
    } else if (file.endsWith('.js') && !file.endsWith('.test.js')) {
      processFile(filePath);
    }
  });
}

// Mostrar encabezado
console.error(`\n${colors.bgRed}${colors.white}${colors.bright} 🔍 BÚSQUEDA DE CÓDIGO MUERTO ${colors.reset}\n`);
console.error(`${colors.dim}Procesando archivos en: ${srcDir}${colors.reset}\n`);

walkDir(srcDir);

// Mostrar resumen en stderr
console.error(`\n${colors.bright}${colors.green}✓ Búsqueda completada!${colors.reset}\n`);
console.error(`${colors.bright}📊 Resumen:${colors.reset}`);
console.error(`   ${colors.cyan}Funciones no usadas:${colors.reset} ${colors.bright}${unusedFunctions.length}${colors.reset}`);
console.error(`   ${colors.cyan}Imports sin usar:${colors.reset} ${colors.bright}${unusedImports.length}${colors.reset}`);
console.error(`   ${colors.cyan}Variables sin usar:${colors.reset} ${colors.bright}${unusedVariables.length}${colors.reset}`);
console.error(`   ${colors.cyan}Total:${colors.reset} ${colors.bright}${unusedFunctions.length + unusedImports.length + unusedVariables.length}${colors.reset}`);
console.error(`\n${colors.dim}⚠️  Revisa manualmente antes de eliminar${colors.reset}\n`);

// Mostrar reporte en stdout
console.log('## 📊 Código Potencialmente Muerto\n');

if (unusedFunctions.length > 0) {
  console.log(`### Funciones No Usadas (${unusedFunctions.length})\n`);
  unusedFunctions.slice(0, 20).forEach(func => {
    console.log(`- **${func.file}** - ${func.name}()`);
  });
  if (unusedFunctions.length > 20) {
    console.log(`... y ${unusedFunctions.length - 20} más\n`);
  }
  console.log();
}

if (unusedImports.length > 0) {
  console.log(`### Imports Sin Usar (${unusedImports.length})\n`);
  unusedImports.slice(0, 20).forEach(imp => {
    console.log(`- **${imp.file}** - ${imp.name}`);
  });
  if (unusedImports.length > 20) {
    console.log(`... y ${unusedImports.length - 20} más\n`);
  }
  console.log();
}

if (unusedVariables.length > 0) {
  console.log(`### Variables Sin Usar (${unusedVariables.length})\n`);
  unusedVariables.slice(0, 20).forEach(v => {
    console.log(`- **${v.file}** - ${v.name}`);
  });
  if (unusedVariables.length > 20) {
    console.log(`... y ${unusedVariables.length - 20} más\n`);
  }
  console.log();
}

// Resumen
console.log('## 📈 Resumen\n');
console.log(`- **Funciones no usadas:** ${unusedFunctions.length}`);
console.log(`- **Imports sin usar:** ${unusedImports.length}`);
console.log(`- **Variables sin usar:** ${unusedVariables.length}`);
console.log(`- **Total:** ${unusedFunctions.length + unusedImports.length + unusedVariables.length}`);
console.log('\n⚠️ Nota: Estos resultados son aproximados. Revisa manualmente antes de eliminar.');

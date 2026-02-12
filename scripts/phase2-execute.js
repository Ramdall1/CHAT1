#!/usr/bin/env node

/**
 * Script para ejecutar FASE 2: Limpieza
 * Elimina código muerto identificado
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src');
let filesModified = 0;
let elementsRemoved = 0;

console.log('🧹 FASE 2: EJECUTANDO LIMPIEZA DE CÓDIGO\n');

/**
 * Funciones a eliminar (no usadas)
 */
const functionsToRemove = [
  { file: 'api/routes/chat-live.js', functions: ['getConversationMessages', 'markWhatsAppMessagesAsRead'] },
  { file: 'api/routes/customFieldsRoutes.js', functions: ['initializeCustomFields'] },
  { file: 'api/routes/webhooks.js', functions: ['processMessageStatus', 'processTemplateResponse', 'processFlowResponse', 'extractMessageContent', 'extractMediaUrl', 'extractMediaType'] },
];

/**
 * Variables a eliminar (no usadas)
 */
const variablesToRemove = [
  { file: 'api/routes/analyticsRoutes.js', variables: ['alertRuleSchema'] },
  { file: 'api/routes/authRoutes.js', variables: ['oauth2Service', 'twoFactorService', 'testToken'] },
  { file: 'api/routes/chat-live.js', variables: ['firstMessage'] },
];

/**
 * Procesar archivo y eliminar función
 */
function removeFunctionFromFile(filePath, functionName) {
  try {
    const fullPath = path.join(srcDir, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Archivo no encontrado: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;

    // Patrón para encontrar función
    const functionPattern = new RegExp(
      `(async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}`,
      'gs'
    );

    if (functionPattern.test(content)) {
      content = content.replace(functionPattern, '');
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Eliminada función: ${functionName} en ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Procesar archivo y eliminar variable
 */
function removeVariableFromFile(filePath, variableName) {
  try {
    const fullPath = path.join(srcDir, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Archivo no encontrado: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;

    // Patrón para encontrar variable
    const varPattern = new RegExp(
      `(const|let|var)\\s+${variableName}\\s*=\\s*[^;]+;`,
      'g'
    );

    if (varPattern.test(content)) {
      content = content.replace(varPattern, '');
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Eliminada variable: ${variableName} en ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    return false;
  }
}

console.log('📋 Eliminando funciones no usadas...\n');
functionsToRemove.forEach(item => {
  item.functions.forEach(func => {
    if (removeFunctionFromFile(item.file, func)) {
      elementsRemoved++;
      filesModified++;
    }
  });
});

console.log('\n📋 Eliminando variables sin usar...\n');
variablesToRemove.forEach(item => {
  item.variables.forEach(variable => {
    if (removeVariableFromFile(item.file, variable)) {
      elementsRemoved++;
      filesModified++;
    }
  });
});

console.log(`\n✅ FASE 2 COMPLETADA!`);
console.log(`📊 Estadísticas:`);
console.log(`   - Archivos modificados: ${filesModified}`);
console.log(`   - Elementos eliminados: ${elementsRemoved}`);
console.log(`\n⚠️  NOTA: Revisar cambios antes de hacer commit`);
console.log(`   Ejecutar: npm test`);

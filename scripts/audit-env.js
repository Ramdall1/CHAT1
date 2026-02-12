#!/usr/bin/env node

/**
 * Script de Auditoría y Limpieza de .env
 * Fecha: 27 de Octubre, 2025
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_PATH = path.join(__dirname, '.env');
const ENV_BACKUP = path.join(__dirname, '.env.backup');
const ENV_CLEANED = path.join(__dirname, '.env.cleaned');

console.log('🔍 Iniciando auditoría del archivo .env...\n');

// Leer archivo .env
const envContent = fs.readFileSync(ENV_PATH, 'utf8');
const lines = envContent.split('\n');

// Estadísticas
const stats = {
    totalLines: lines.length,
    comments: 0,
    emptyLines: 0,
    variables: 0,
    sensitive: [],
    duplicates: new Map(),
    unusedVars: []
};

// Variables sensibles a buscar
const sensitivePatterns = [
    /API_KEY/i,
    /SECRET/i,
    /PASSWORD/i,
    /TOKEN/i,
    /PRIVATE/i,
    /CREDENTIAL/i,
    /AUTH/i
];

// Variables que deberían existir
const requiredVars = [
    'PORT',
    'NODE_ENV',
    'D360_API_KEY',
    'JWT_SECRET',
    'DATABASE_URL'
];

// Analizar líneas
const cleanedLines = [];
const seenVars = new Set();

lines.forEach((line, index) => {
    // Línea vacía
    if (line.trim() === '') {
        stats.emptyLines++;
        cleanedLines.push(line);
        return;
    }
    
    // Comentario
    if (line.trim().startsWith('#')) {
        stats.comments++;
        cleanedLines.push(line);
        return;
    }
    
    // Variable
    if (line.includes('=')) {
        stats.variables++;
        const [key, value] = line.split('=');
        const varName = key.trim();
        
        // Verificar duplicados
        if (seenVars.has(varName)) {
            if (!stats.duplicates.has(varName)) {
                stats.duplicates.set(varName, 1);
            }
            stats.duplicates.set(varName, stats.duplicates.get(varName) + 1);
            console.log(`⚠️  Variable duplicada: ${varName} (línea ${index + 1})`);
            return; // No agregar duplicados
        }
        seenVars.add(varName);
        
        // Verificar si es sensible
        const isSensitive = sensitivePatterns.some(pattern => pattern.test(varName));
        if (isSensitive) {
            stats.sensitive.push(varName);
        }
        
        // Verificar si el valor está vacío
        if (!value || value.trim() === '' || value.trim() === '""' || value.trim() === "''") {
            console.log(`⚠️  Variable sin valor: ${varName}`);
        }
        
        // Limpiar valor si contiene espacios o caracteres raros
        let cleanValue = value.trim();
        if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
            cleanValue = cleanValue.slice(1, -1);
        }
        if (cleanValue.startsWith("'") && cleanValue.endsWith("'")) {
            cleanValue = cleanValue.slice(1, -1);
        }
        
        cleanedLines.push(`${varName}=${cleanValue}`);
    }
});

// Verificar variables requeridas
console.log('\n📋 Verificando variables requeridas:');
requiredVars.forEach(varName => {
    if (!seenVars.has(varName)) {
        console.log(`❌ Falta variable requerida: ${varName}`);
    } else {
        console.log(`✅ ${varName}`);
    }
});

// Mostrar estadísticas
console.log('\n📊 Estadísticas del archivo .env:');
console.log(`  Total de líneas: ${stats.totalLines}`);
console.log(`  Variables: ${stats.variables}`);
console.log(`  Comentarios: ${stats.comments}`);
console.log(`  Líneas vacías: ${stats.emptyLines}`);
console.log(`  Variables sensibles: ${stats.sensitive.length}`);
console.log(`  Variables duplicadas: ${stats.duplicates.size}`);

// Mostrar variables sensibles
if (stats.sensitive.length > 0) {
    console.log('\n🔐 Variables sensibles detectadas:');
    stats.sensitive.forEach(varName => {
        console.log(`  - ${varName}`);
    });
    console.log('\n⚠️  Asegúrate de que estas variables NO estén en el repositorio');
}

// Crear backup
console.log('\n💾 Creando backup del .env original...');
fs.copyFileSync(ENV_PATH, ENV_BACKUP);
console.log(`✅ Backup guardado en: ${ENV_BACKUP}`);

// Guardar versión limpia
console.log('\n🧹 Guardando versión limpia...');
fs.writeFileSync(ENV_CLEANED, cleanedLines.join('\n'));
console.log(`✅ Versión limpia guardada en: ${ENV_CLEANED}`);

// Crear .env.vault para variables sensibles (simulado)
const vaultContent = `# ==========================================
# VAULT DE VARIABLES SENSIBLES
# ==========================================
# Este archivo NO debe estar en el repositorio
# Usar un gestor de secretos como:
# - HashiCorp Vault
# - AWS Secrets Manager
# - Azure Key Vault
# - Doppler
# ==========================================

# Recomendaciones:
# 1. Nunca commitear archivos .env con valores reales
# 2. Usar .env.example con valores de ejemplo
# 3. Rotar API keys regularmente
# 4. Usar diferentes keys para dev/staging/prod
# 5. Implementar audit logs para acceso a secretos

# Variables sensibles detectadas: ${stats.sensitive.length}
${stats.sensitive.map(v => `# - ${v}`).join('\n')}
`;

fs.writeFileSync(path.join(__dirname, '.env.vault.info'), vaultContent);

// Recomendaciones finales
console.log('\n🎯 Recomendaciones:');
console.log('  1. Revisa .env.cleaned y úsalo como base');
console.log('  2. Elimina variables duplicadas');
console.log('  3. Mueve variables sensibles a un gestor de secretos');
console.log('  4. Asegúrate de que .env esté en .gitignore');
console.log('  5. Usa .env.example para documentación');

console.log('\n✅ Auditoría completada!');

// Verificar tamaño del archivo
const fileSize = fs.statSync(ENV_PATH).size;
if (fileSize > 5000) {
    console.log(`\n⚠️  ADVERTENCIA: El archivo .env es muy grande (${(fileSize/1024).toFixed(2)} KB)`);
    console.log('    Considera dividirlo en múltiples archivos o usar un gestor de configuración');
}

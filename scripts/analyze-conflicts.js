#!/usr/bin/env node

/**
 * Analizador de Conflictos y Duplicados
 * Identifica:
 * - Importaciones duplicadas
 * - Funciones duplicadas
 * - Conflictos de nombres
 * - Logs innecesarios
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

class ConflictAnalyzer {
  constructor() {
    this.conflicts = [];
    this.duplicates = [];
    this.unnecessaryLogs = [];
    this.importMap = new Map();
    this.functionMap = new Map();
  }

  /**
   * Analizar proyecto
   */
  async analyze() {
    console.log('🔍 Analizando proyecto...\n');

    await this.scanDirectory(path.join(projectRoot, 'src'));
    await this.scanDirectory(path.join(projectRoot, 'client'));

    this.reportFindings();
  }

  /**
   * Escanear directorio
   */
  async scanDirectory(dir) {
    try {
      const files = await fs.readdir(dir, { recursive: true });

      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
          const filePath = path.join(dir, file);
          await this.analyzeFile(filePath);
        }
      }
    } catch (error) {
      // Ignorar directorios que no existen
    }
  }

  /**
   * Analizar archivo
   */
  async analyzeFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      this.checkImports(filePath, lines);
      this.checkFunctions(filePath, lines);
      this.checkUnnecessaryLogs(filePath, lines);
    } catch (error) {
      // Ignorar errores de lectura
    }
  }

  /**
   * Verificar importaciones duplicadas
   */
  checkImports(filePath, lines) {
    const imports = new Map();

    lines.forEach((line, index) => {
      if (line.includes('import ') || line.includes('require(')) {
        const importMatch = line.match(/(?:import|require)\s*(?:\{[^}]*\}|'[^']*'|"[^"]*")/);
        
        if (importMatch) {
          const importStr = importMatch[0];
          
          if (imports.has(importStr)) {
            this.duplicates.push({
              type: 'Importación duplicada',
              file: filePath,
              line: index + 1,
              content: importStr
            });
          } else {
            imports.set(importStr, index + 1);
          }
        }
      }
    });
  }

  /**
   * Verificar funciones duplicadas
   */
  checkFunctions(filePath, lines) {
    const functions = new Map();

    lines.forEach((line, index) => {
      const funcMatch = line.match(/(?:function|const|let)\s+(\w+)\s*(?:=|:|\()/);
      
      if (funcMatch) {
        const funcName = funcMatch[1];
        const key = `${funcName}`;

        if (this.functionMap.has(key)) {
          this.conflicts.push({
            type: 'Función duplicada',
            name: funcName,
            files: [this.functionMap.get(key), filePath],
            lines: [this.functionMap.get(`${key}_line`), index + 1]
          });
        } else {
          this.functionMap.set(key, filePath);
          this.functionMap.set(`${key}_line`, index + 1);
        }
      }
    });
  }

  /**
   * Verificar logs innecesarios
   */
  checkUnnecessaryLogs(filePath, lines) {
    lines.forEach((line, index) => {
      // Logs de debug que no deberían estar en producción
      if (line.includes('console.log') && !line.includes('//')) {
        this.unnecessaryLogs.push({
          file: filePath,
          line: index + 1,
          content: line.trim()
        });
      }

      // Logger.debug en producción
      if (line.includes('logger.debug') && !line.includes('//')) {
        this.unnecessaryLogs.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          type: 'debug'
        });
      }

      // Múltiples console.logs consecutivos
      if (line.includes('console.') && lines[index + 1]?.includes('console.')) {
        this.unnecessaryLogs.push({
          file: filePath,
          line: index + 1,
          content: 'Múltiples logs consecutivos',
          type: 'multiple'
        });
      }
    });
  }

  /**
   * Reportar hallazgos
   */
  reportFindings() {
    console.log('📊 REPORTE DE ANÁLISIS\n');
    console.log('='.repeat(60));

    if (this.conflicts.length > 0) {
      console.log('\n⚠️  CONFLICTOS ENCONTRADOS:\n');
      this.conflicts.forEach(conflict => {
        console.log(`  • ${conflict.type}: ${conflict.name}`);
        console.log(`    Archivos: ${conflict.files.join(', ')}`);
        console.log(`    Líneas: ${conflict.lines.join(', ')}\n`);
      });
    }

    if (this.duplicates.length > 0) {
      console.log('\n🔄 DUPLICADOS ENCONTRADOS:\n');
      this.duplicates.forEach(dup => {
        console.log(`  • ${dup.type}`);
        console.log(`    Archivo: ${dup.file}`);
        console.log(`    Línea: ${dup.line}`);
        console.log(`    Contenido: ${dup.content}\n`);
      });
    }

    if (this.unnecessaryLogs.length > 0) {
      console.log('\n📝 LOGS INNECESARIOS:\n');
      this.unnecessaryLogs.slice(0, 10).forEach(log => {
        console.log(`  • ${log.file}:${log.line}`);
        console.log(`    ${log.content}\n`);
      });
      
      if (this.unnecessaryLogs.length > 10) {
        console.log(`  ... y ${this.unnecessaryLogs.length - 10} más\n`);
      }
    }

    console.log('='.repeat(60));
    console.log('\n📈 RESUMEN:\n');
    console.log(`  Conflictos: ${this.conflicts.length}`);
    console.log(`  Duplicados: ${this.duplicates.length}`);
    console.log(`  Logs innecesarios: ${this.unnecessaryLogs.length}\n`);

    if (this.conflicts.length === 0 && this.duplicates.length === 0) {
      console.log('✅ No se encontraron conflictos o duplicados\n');
    }
  }
}

// Ejecutar análisis
const analyzer = new ConflictAnalyzer();
await analyzer.analyze();

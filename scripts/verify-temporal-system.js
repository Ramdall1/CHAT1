#!/usr/bin/env node

/**
 * Script de Verificación del Sistema de Reportes Temporales
 * Verifica que el sistema funcione correctamente y no genere archivos permanentes
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuración de verificación
 */
const VERIFICATION_CONFIG = {
  // Directorios que NO deben existir después de las pruebas
  forbiddenDirectories: [
    'coverage',
    'test-reports',
    'reports',
    '.jest-cache',
    'test-logs'
  ],
  
  // Archivos que NO deben existir después de las pruebas
  forbiddenFiles: [
    'jest-report.html',
    'coverage-report.json',
    'test-results.xml'
  ],
  
  // Patrones de archivos temporales que NO deben persistir
  forbiddenPatterns: [
    /^test-logs-export-.*\.(json|csv)$/,
    /^coverage-.*\.json$/,
    /^jest-report-.*\.html$/
  ],
  
  // Timeout para comandos de test (en ms)
  testTimeout: 60000
};

/**
 * Clase principal de verificación
 */
class TemporalSystemVerifier {
  constructor(config = VERIFICATION_CONFIG) {
    this.config = config;
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  /**
   * Ejecuta la verificación completa
   */
  async verify() {
    console.log('🔍 Iniciando verificación del sistema de reportes temporales...\n');
    
    try {
      // Verificar configuración inicial
      await this.verifyInitialState();
      
      // Ejecutar pruebas de verificación
      await this.runTestVerification();
      
      // Verificar estado final
      await this.verifyFinalState();
      
      // Verificar limpieza automática
      await this.verifyAutomaticCleanup();
      
      // Mostrar resultados
      this.showResults();
      
      return this.results.failed.length === 0;
      
    } catch (error) {
      console.error('❌ Error durante la verificación:', error.message);
      return false;
    }
  }

  /**
   * Verifica el estado inicial del sistema
   */
  async verifyInitialState() {
    console.log('📋 Verificando estado inicial...');
    
    // Verificar que no existan directorios prohibidos
    for (const dir of this.config.forbiddenDirectories) {
      const dirPath = path.join(process.cwd(), dir);
      try {
        await fs.access(dirPath);
        this.addWarning(`Directorio ${dir} existe antes de las pruebas`);
      } catch {
        this.addPassed(`Directorio ${dir} no existe (correcto)`);
      }
    }
    
    // Verificar configuración de Jest
    await this.verifyJestConfig();
    
    console.log('✅ Estado inicial verificado\n');
  }

  /**
   * Verifica la configuración de Jest
   */
  async verifyJestConfig() {
    try {
      const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
      const configContent = await fs.readFile(jestConfigPath, 'utf8');
      
      // Verificar configuraciones clave
      const checks = [
        { pattern: /collectCoverage:\s*process\.env\.JEST_COVERAGE/, name: 'Cobertura condicional' },
        { pattern: /coverageDirectory:\s*`\/tmp\/jest-coverage-/, name: 'Directorio temporal de cobertura' },
        { pattern: /cacheDirectory:\s*`\/tmp\/jest-cache-/, name: 'Directorio temporal de cache' },
        { pattern: /setupFilesAfterEnv.*cleanup\.js/, name: 'Hook de limpieza configurado' }
      ];
      
      for (const check of checks) {
        if (check.pattern.test(configContent)) {
          this.addPassed(`Jest: ${check.name} configurado correctamente`);
        } else {
          this.addFailed(`Jest: ${check.name} no configurado`);
        }
      }
      
    } catch (error) {
      this.addFailed(`Error verificando configuración de Jest: ${error.message}`);
    }
  }

  /**
   * Ejecuta pruebas de verificación
   */
  async runTestVerification() {
    console.log('🧪 Ejecutando pruebas de verificación...');
    
    try {
      // Ejecutar un test simple sin cobertura
      console.log('   - Ejecutando test básico...');
      execSync('npm run test:temp', {
        cwd: process.cwd(),
        timeout: this.config.testTimeout,
        stdio: 'pipe'
      });
      this.addPassed('Test básico ejecutado correctamente');
      
      // Ejecutar test con cobertura
      console.log('   - Ejecutando test con cobertura...');
      execSync('npm run test:coverage', {
        cwd: process.cwd(),
        timeout: this.config.testTimeout,
        stdio: 'pipe'
      });
      this.addPassed('Test con cobertura ejecutado correctamente');
      
    } catch (error) {
      this.addFailed(`Error ejecutando pruebas: ${error.message}`);
    }
    
    console.log('✅ Pruebas de verificación completadas\n');
  }

  /**
   * Verifica el estado final después de las pruebas
   */
  async verifyFinalState() {
    console.log('🔎 Verificando estado final...');
    
    // Verificar que no existan directorios prohibidos
    for (const dir of this.config.forbiddenDirectories) {
      const dirPath = path.join(process.cwd(), dir);
      try {
        await fs.access(dirPath);
        this.addFailed(`Directorio ${dir} persiste después de las pruebas`);
      } catch {
        this.addPassed(`Directorio ${dir} no existe después de las pruebas`);
      }
    }
    
    // Verificar que no existan archivos prohibidos
    for (const file of this.config.forbiddenFiles) {
      const filePath = path.join(process.cwd(), file);
      try {
        await fs.access(filePath);
        this.addFailed(`Archivo ${file} persiste después de las pruebas`);
      } catch {
        this.addPassed(`Archivo ${file} no existe después de las pruebas`);
      }
    }
    
    // Verificar patrones de archivos
    await this.verifyFilePatterns();
    
    console.log('✅ Estado final verificado\n');
  }

  /**
   * Verifica patrones de archivos prohibidos
   */
  async verifyFilePatterns() {
    try {
      const entries = await fs.readdir(process.cwd());
      
      for (const entry of entries) {
        for (const pattern of this.config.forbiddenPatterns) {
          if (pattern.test(entry)) {
            this.addFailed(`Archivo con patrón prohibido encontrado: ${entry}`);
          }
        }
      }
      
      this.addPassed('No se encontraron archivos con patrones prohibidos');
      
    } catch (error) {
      this.addWarning(`Error verificando patrones de archivos: ${error.message}`);
    }
  }

  /**
   * Verifica la limpieza automática
   */
  async verifyAutomaticCleanup() {
    console.log('🧹 Verificando limpieza automática...');
    
    try {
      // Ejecutar script de limpieza manualmente
      execSync('npm run test:cleanup:verbose', {
        cwd: process.cwd(),
        timeout: 30000,
        stdio: 'pipe'
      });
      this.addPassed('Script de limpieza ejecutado correctamente');
      
      // Verificar directorios temporales en /tmp
      await this.verifyTempDirectories();
      
    } catch (error) {
      this.addFailed(`Error en limpieza automática: ${error.message}`);
    }
    
    console.log('✅ Limpieza automática verificada\n');
  }

  /**
   * Verifica directorios temporales
   */
  async verifyTempDirectories() {
    try {
      const tempEntries = await fs.readdir('/tmp');
      const testRelatedDirs = tempEntries.filter(entry => 
        entry.includes('jest-') || entry.includes('test-') || entry.includes('coverage-')
      );
      
      if (testRelatedDirs.length === 0) {
        this.addPassed('No hay directorios temporales de testing en /tmp');
      } else {
        this.addWarning(`Directorios temporales encontrados en /tmp: ${testRelatedDirs.join(', ')}`);
      }
      
    } catch (error) {
      this.addWarning(`Error verificando /tmp: ${error.message}`);
    }
  }

  /**
   * Añade un resultado exitoso
   */
  addPassed(message) {
    this.results.passed.push(message);
  }

  /**
   * Añade un resultado fallido
   */
  addFailed(message) {
    this.results.failed.push(message);
  }

  /**
   * Añade una advertencia
   */
  addWarning(message) {
    this.results.warnings.push(message);
  }

  /**
   * Muestra los resultados de la verificación
   */
  showResults() {
    console.log('📊 RESULTADOS DE VERIFICACIÓN\n');
    
    console.log(`✅ Pruebas exitosas: ${this.results.passed.length}`);
    this.results.passed.forEach(msg => console.log(`   ✓ ${msg}`));
    
    if (this.results.warnings.length > 0) {
      console.log(`\n⚠️  Advertencias: ${this.results.warnings.length}`);
      this.results.warnings.forEach(msg => console.log(`   ⚠ ${msg}`));
    }
    
    if (this.results.failed.length > 0) {
      console.log(`\n❌ Pruebas fallidas: ${this.results.failed.length}`);
      this.results.failed.forEach(msg => console.log(`   ✗ ${msg}`));
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (this.results.failed.length === 0) {
      console.log('🎉 VERIFICACIÓN EXITOSA: El sistema de reportes temporales funciona correctamente');
    } else {
      console.log('💥 VERIFICACIÓN FALLIDA: Se encontraron problemas en el sistema');
    }
    
    console.log('='.repeat(60) + '\n');
  }
}

/**
 * Función principal
 */
async function main() {
  const verifier = new TemporalSystemVerifier();
  const success = await verifier.verify();
  
  process.exit(success ? 0 : 1);
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Error crítico en verificación:', error);
    process.exit(1);
  });
}

export { TemporalSystemVerifier, VERIFICATION_CONFIG };
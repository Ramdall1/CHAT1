#!/usr/bin/env node

/**
 * Script de Mantenimiento Automático - ChatBot Enterprise
 * Limpia archivos temporales, logs antiguos y reportes obsoletos
 * @version 1.0.0
 * @author Sistema de Mantenimiento
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CONFIG = {
  // Configuración de retención
  KEEP_RECENT_LOGS: 5,           // Mantener últimos 5 logs
  KEEP_RECENT_TEST_SCORES: 10,   // Mantener últimos 10 test-scores
  MAX_LOG_SIZE_MB: 1,            // Tamaño máximo de log en MB
  RETENTION_DAYS: 7,             // Días de retención para archivos temporales
  
  // Directorios a limpiar
  DIRECTORIES: {
    LOGS: ['custom-logs', 'test-logs'],
    REPORTS: ['test-reports'],
    TEMP: ['.jest-cache-performance', 'temp', 'tmp']
  },
  
  // Patrones de archivos a limpiar
  PATTERNS: {
    TEST_SCORES: 'test-scores-*.json',
    BACKUP_FILES: '*.backup',
    TEMP_FILES: ['*.tmp', '*.temp', '*~'],
    OLD_REPORTS: ['jest-report.html', 'coverage-*.html']
  }
};

class MaintenanceManager {
  constructor() {
    this.startTime = Date.now();
    this.stats = {
      filesDeleted: 0,
      spaceSaved: 0,
      errors: 0
    };
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
  }

  getFileSize(filePath) {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  }

  isOlderThan(filePath, days) {
    try {
      const stats = fs.statSync(filePath);
      const fileAge = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      return fileAge > days;
    } catch {
      return false;
    }
  }

  cleanTestScores() {
    this.log('🧹 Limpiando archivos test-scores antiguos...');
    
    try {
      const files = fs.readdirSync('.')
        .filter(file => file.match(/^test-scores-.*\.json$/))
        .map(file => ({
          name: file,
          mtime: fs.statSync(file).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > CONFIG.KEEP_RECENT_TEST_SCORES) {
        const filesToDelete = files.slice(CONFIG.KEEP_RECENT_TEST_SCORES);
        
        for (const file of filesToDelete) {
          const size = this.getFileSize(file.name);
          fs.unlinkSync(file.name);
          this.stats.filesDeleted++;
          this.stats.spaceSaved += size;
        }
        
        this.log(`✅ Eliminados ${filesToDelete.length} archivos test-scores antiguos`);
      }
    } catch (error) {
      this.log(`❌ Error limpiando test-scores: ${error.message}`, 'ERROR');
      this.stats.errors++;
    }
  }

  optimizeLogs() {
    this.log('📝 Optimizando archivos de log...');
    
    for (const logDir of CONFIG.DIRECTORIES.LOGS) {
      if (!fs.existsSync(logDir)) continue;
      
      try {
        const files = fs.readdirSync(logDir)
          .filter(file => file.endsWith('.log'))
          .map(file => path.join(logDir, file));

        for (const filePath of files) {
          const stats = fs.statSync(filePath);
          const sizeMB = stats.size / (1024 * 1024);
          
          // Si el log es muy grande, crear versión compacta
          if (sizeMB > CONFIG.MAX_LOG_SIZE_MB) {
            this.log(`🔄 Optimizando log grande: ${filePath} (${sizeMB.toFixed(2)}MB)`);
            
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            if (lines.length > 100) {
              const compactContent = [
                ...lines.slice(0, 50),
                `\n... [${lines.length - 100} líneas omitidas para optimización] ...\n`,
                ...lines.slice(-50)
              ].join('\n');
              
              const originalSize = this.getFileSize(filePath);
              fs.writeFileSync(filePath, compactContent);
              const newSize = this.getFileSize(filePath);
              
              this.stats.spaceSaved += (originalSize - newSize);
              this.log(`✅ Log optimizado: ${(originalSize - newSize)} bytes ahorrados`);
            }
          }
        }
      } catch (error) {
        this.log(`❌ Error optimizando logs en ${logDir}: ${error.message}`, 'ERROR');
        this.stats.errors++;
      }
    }
  }

  cleanTempFiles() {
    this.log('🗑️ Limpiando archivos temporales...');
    
    // Limpiar directorios temporales
    for (const tempDir of CONFIG.DIRECTORIES.TEMP) {
      if (fs.existsSync(tempDir)) {
        try {
          const size = execSync(`du -sb ${tempDir} 2>/dev/null | cut -f1`).toString().trim();
          execSync(`rm -rf ${tempDir}`);
          this.stats.spaceSaved += parseInt(size) || 0;
          this.stats.filesDeleted++;
          this.log(`✅ Eliminado directorio temporal: ${tempDir}`);
        } catch (error) {
          this.log(`❌ Error eliminando ${tempDir}: ${error.message}`, 'ERROR');
          this.stats.errors++;
        }
      }
    }

    // Limpiar archivos temporales por patrón
    for (const pattern of CONFIG.PATTERNS.TEMP_FILES) {
      try {
        const command = `find . -name "${pattern}" -type f -mtime +${CONFIG.RETENTION_DAYS}`;
        const files = execSync(command).toString().trim().split('\n').filter(f => f);
        
        for (const file of files) {
          if (file && fs.existsSync(file)) {
            const size = this.getFileSize(file);
            fs.unlinkSync(file);
            this.stats.filesDeleted++;
            this.stats.spaceSaved += size;
          }
        }
        
        if (files.length > 0) {
          this.log(`✅ Eliminados ${files.length} archivos temporales (${pattern})`);
        }
      } catch (error) {
        // Silenciar errores de find cuando no encuentra archivos
        if (!error.message.includes('No such file')) {
          this.log(`❌ Error buscando archivos ${pattern}: ${error.message}`, 'ERROR');
          this.stats.errors++;
        }
      }
    }
  }

  cleanReports() {
    this.log('📊 Limpiando reportes antiguos...');
    
    for (const reportDir of CONFIG.DIRECTORIES.REPORTS) {
      if (!fs.existsSync(reportDir)) continue;
      
      try {
        // Limpiar reportes HTML antiguos
        const htmlFiles = fs.readdirSync(reportDir)
          .filter(file => file.endsWith('.html'))
          .map(file => path.join(reportDir, file))
          .filter(file => this.isOlderThan(file, CONFIG.RETENTION_DAYS));

        for (const file of htmlFiles) {
          const size = this.getFileSize(file);
          fs.unlinkSync(file);
          this.stats.filesDeleted++;
          this.stats.spaceSaved += size;
        }

        if (htmlFiles.length > 0) {
          this.log(`✅ Eliminados ${htmlFiles.length} reportes HTML antiguos`);
        }
      } catch (error) {
        this.log(`❌ Error limpiando reportes: ${error.message}`, 'ERROR');
        this.stats.errors++;
      }
    }
  }

  createBackup() {
    this.log('💾 Creando backup antes de la limpieza...');
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-pre-maintenance-${timestamp}.tar.gz`;
      
      execSync(`tar -czf ${backupName} --exclude='node_modules' --exclude='*.tar.gz' --exclude='.git' .`);
      this.log(`✅ Backup creado: ${backupName}`);
      return backupName;
    } catch (error) {
      this.log(`❌ Error creando backup: ${error.message}`, 'ERROR');
      this.stats.errors++;
      return null;
    }
  }

  generateReport() {
    const duration = (Date.now() - this.startTime) / 1000;
    const spaceSavedMB = (this.stats.spaceSaved / (1024 * 1024)).toFixed(2);
    
    this.log('\n📋 REPORTE DE MANTENIMIENTO');
    this.log('================================');
    this.log(`⏱️  Duración: ${duration.toFixed(2)} segundos`);
    this.log(`🗑️  Archivos eliminados: ${this.stats.filesDeleted}`);
    this.log(`💾 Espacio liberado: ${spaceSavedMB} MB`);
    this.log(`❌ Errores: ${this.stats.errors}`);
    this.log('================================\n');

    // Guardar reporte en archivo
    const reportData = {
      timestamp: new Date().toISOString(),
      duration,
      filesDeleted: this.stats.filesDeleted,
      spaceSavedBytes: this.stats.spaceSaved,
      spaceSavedMB: parseFloat(spaceSavedMB),
      errors: this.stats.errors
    };

    try {
      const reportsDir = 'maintenance-reports';
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir);
      }
      
      const reportFile = path.join(reportsDir, `maintenance-${Date.now()}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
      this.log(`📄 Reporte guardado en: ${reportFile}`);
    } catch (error) {
      this.log(`❌ Error guardando reporte: ${error.message}`, 'ERROR');
    }
  }

  async run() {
    this.log('🚀 Iniciando mantenimiento automático...');
    
    // Crear backup de seguridad
    const backup = this.createBackup();
    
    if (!backup) {
      this.log('❌ No se pudo crear backup. Abortando mantenimiento.', 'ERROR');
      return;
    }

    // Ejecutar tareas de limpieza
    this.cleanTestScores();
    this.optimizeLogs();
    this.cleanTempFiles();
    this.cleanReports();
    
    // Generar reporte final
    this.generateReport();
    
    this.log('✅ Mantenimiento completado exitosamente!');
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const maintenance = new MaintenanceManager();
  maintenance.run().catch(error => {
    console.error('❌ Error fatal en mantenimiento:', error);
    process.exit(1);
  });
}

export default MaintenanceManager;
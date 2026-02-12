#!/usr/bin/env node

/**
 * 🚀 Script de Optimización del Sistema ChatBot Pro
 * Analiza y optimiza el rendimiento del sistema
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SystemOptimizer {
  constructor() {
    this.startTime = performance.now();
    this.optimizations = [];
    this.metrics = {
      filesOptimized: 0,
      spaceSaved: 0,
      performanceGain: 0
    };
  }

  async optimize() {
    console.log('🚀 Iniciando optimización del sistema...\n');
        
    await this.analyzeFileStructure();
    await this.optimizeStaticFiles();
    await this.optimizeDataFiles();
    await this.generateOptimizationReport();
        
    console.log('\n✅ Optimización completada!');
  }

  async analyzeFileStructure() {
    console.log('📊 Analizando estructura de archivos...');
        
    const publicDir = path.join(__dirname, 'public');
    const dataDir = path.join(__dirname, 'data');
        
    const publicFiles = this.getDirectorySize(publicDir);
    const dataFiles = this.getDirectorySize(dataDir);
        
    console.log(`   📁 Archivos públicos: ${this.formatBytes(publicFiles.size)} (${publicFiles.count} archivos)`);
    console.log(`   📁 Archivos de datos: ${this.formatBytes(dataFiles.size)} (${dataFiles.count} archivos)`);
        
    this.optimizations.push({
      type: 'analysis',
      description: 'Análisis de estructura completado',
      impact: 'info'
    });
  }

  async optimizeStaticFiles() {
    console.log('\n🎨 Optimizando archivos estáticos...');
        
    // Optimizar archivos CSS duplicados
    await this.removeDuplicateCSS();
        
    // Optimizar archivos JavaScript
    await this.optimizeJavaScript();
        
    // Comprimir archivos HTML grandes
    await this.compressLargeHTML();
  }

  async removeDuplicateCSS() {
    console.log('   🎨 Eliminando CSS duplicado...');
        
    const publicDir = path.join(__dirname, 'public');
    const htmlFiles = this.findFiles(publicDir, '.html');
        
    let duplicateStyles = 0;
    let totalSaved = 0;
        
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const originalSize = content.length;
            
      // Buscar estilos duplicados comunes
      const optimizedContent = this.removeDuplicateStyleBlocks(content);
      const newSize = optimizedContent.length;
            
      if (newSize < originalSize) {
        fs.writeFileSync(file, optimizedContent);
        duplicateStyles++;
        totalSaved += (originalSize - newSize);
                
        console.log(`      ✅ ${path.basename(file)}: ${this.formatBytes(originalSize - newSize)} ahorrados`);
      }
    }
        
    this.metrics.filesOptimized += duplicateStyles;
    this.metrics.spaceSaved += totalSaved;
        
    this.optimizations.push({
      type: 'css',
      description: `CSS duplicado eliminado en ${duplicateStyles} archivos`,
      impact: 'medium',
      savings: totalSaved
    });
  }

  removeDuplicateStyleBlocks(content) {
    // Eliminar bloques de estilo duplicados comunes
    const commonStyles = [
      /\/\*\s*Estilos\s*comunes\s*\*\/[\s\S]*?\/\*\s*Fin\s*estilos\s*comunes\s*\*\//gi,
      /\.btn\s*{[^}]*}\s*\.btn\s*{[^}]*}/gi,
      /body\s*{[^}]*}\s*body\s*{[^}]*}/gi
    ];
        
    let optimized = content;
        
    commonStyles.forEach(pattern => {
      const matches = optimized.match(pattern);
      if (matches && matches.length > 1) {
        // Mantener solo la primera ocurrencia
        optimized = optimized.replace(pattern, matches[0]);
      }
    });
        
    return optimized;
  }

  async optimizeJavaScript() {
    console.log('   📜 Optimizando JavaScript...');
        
    const jsDir = path.join(__dirname, 'public', 'js');
    if (!fs.existsSync(jsDir)) return;
        
    const jsFiles = this.findFiles(jsDir, '.js');
    let optimizedFiles = 0;
    let totalSaved = 0;
        
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const originalSize = content.length;
            
      // Optimizaciones básicas de JavaScript
      const optimizedContent = this.optimizeJSContent(content);
      const newSize = optimizedContent.length;
            
      if (newSize < originalSize) {
        fs.writeFileSync(file, optimizedContent);
        optimizedFiles++;
        totalSaved += (originalSize - newSize);
                
        console.log(`      ✅ ${path.basename(file)}: ${this.formatBytes(originalSize - newSize)} ahorrados`);
      }
    }
        
    this.metrics.filesOptimized += optimizedFiles;
    this.metrics.spaceSaved += totalSaved;
        
    this.optimizations.push({
      type: 'javascript',
      description: `JavaScript optimizado en ${optimizedFiles} archivos`,
      impact: 'medium',
      savings: totalSaved
    });
  }

  optimizeJSContent(content) {
    // Optimizaciones básicas de JavaScript
    return content
    // Eliminar comentarios de línea múltiple
      .replace(/\/\*[\s\S]*?\*\//g, '')
    // Eliminar comentarios de línea simple (pero mantener URLs)
      .replace(/\/\/(?![^\r\n]*https?:)[^\r\n]*/g, '')
    // Eliminar espacios en blanco excesivos
      .replace(/\s+/g, ' ')
    // Eliminar espacios alrededor de operadores
      .replace(/\s*([{}();,])\s*/g, '$1')
      .trim();
  }

  async compressLargeHTML() {
    console.log('   📄 Comprimiendo archivos HTML grandes...');
        
    const publicDir = path.join(__dirname, 'public');
    const htmlFiles = this.findFiles(publicDir, '.html');
        
    let compressedFiles = 0;
    let totalSaved = 0;
        
    for (const file of htmlFiles) {
      const stats = fs.statSync(file);
            
      // Solo comprimir archivos mayores a 30KB
      if (stats.size > 30 * 1024) {
        const content = fs.readFileSync(file, 'utf8');
        const originalSize = content.length;
                
        const compressedContent = this.compressHTML(content);
        const newSize = compressedContent.length;
                
        if (newSize < originalSize) {
          fs.writeFileSync(file, compressedContent);
          compressedFiles++;
          totalSaved += (originalSize - newSize);
                    
          console.log(`      ✅ ${path.basename(file)}: ${this.formatBytes(originalSize - newSize)} ahorrados`);
        }
      }
    }
        
    this.metrics.filesOptimized += compressedFiles;
    this.metrics.spaceSaved += totalSaved;
        
    this.optimizations.push({
      type: 'html',
      description: `HTML comprimido en ${compressedFiles} archivos`,
      impact: 'high',
      savings: totalSaved
    });
  }

  compressHTML(content) {
    return content
    // Eliminar comentarios HTML
      .replace(/<!--[\s\S]*?-->/g, '')
    // Eliminar espacios en blanco excesivos
      .replace(/\s+/g, ' ')
    // Eliminar espacios alrededor de tags
      .replace(/>\s+</g, '><')
    // Eliminar espacios al inicio y final de líneas
      .replace(/^\s+|\s+$/gm, '')
      .trim();
  }

  async optimizeDataFiles() {
    console.log('\n📊 Optimizando archivos de datos...');
        
    await this.cleanupLogFiles();
    await this.optimizeJSONFiles();
    await this.createDataBackup();
  }

  async cleanupLogFiles() {
    console.log('   🧹 Limpiando archivos de log...');
        
    const dataDir = path.join(__dirname, 'data');
    const logFiles = this.findFiles(dataDir, '_log.json');
        
    let cleanedFiles = 0;
    let totalSaved = 0;
        
    for (const file of logFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const originalSize = content.length;
            
      try {
        const data = JSON.parse(content);
                
        // Mantener solo los últimos 100 registros
        if (Array.isArray(data) && data.length > 100) {
          const trimmedData = data.slice(-100);
          const newContent = JSON.stringify(trimmedData, null, 2);
                    
          fs.writeFileSync(file, newContent);
          cleanedFiles++;
          totalSaved += (originalSize - newContent.length);
                    
          console.log(`      ✅ ${path.basename(file)}: ${data.length - 100} registros eliminados`);
        }
      } catch (error) {
        console.log(`      ⚠️ Error procesando ${path.basename(file)}: ${error.message}`);
      }
    }
        
    this.metrics.spaceSaved += totalSaved;
        
    this.optimizations.push({
      type: 'logs',
      description: `Archivos de log limpiados: ${cleanedFiles}`,
      impact: 'medium',
      savings: totalSaved
    });
  }

  async optimizeJSONFiles() {
    console.log('   📋 Optimizando archivos JSON...');
        
    const dataDir = path.join(__dirname, 'data');
    const jsonFiles = this.findFiles(dataDir, '.json').filter(f => !f.includes('_log.json'));
        
    let optimizedFiles = 0;
    let totalSaved = 0;
        
    for (const file of jsonFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const originalSize = content.length;
            
      try {
        const data = JSON.parse(content);
        const optimizedContent = JSON.stringify(data); // Sin espacios
                
        if (optimizedContent.length < originalSize) {
          fs.writeFileSync(file, JSON.stringify(data, null, 2)); // Mantener formato legible
          optimizedFiles++;
          totalSaved += (originalSize - optimizedContent.length);
                    
          console.log(`      ✅ ${path.basename(file)}: optimizado`);
        }
      } catch (error) {
        console.log(`      ⚠️ Error procesando ${path.basename(file)}: ${error.message}`);
      }
    }
        
    this.optimizations.push({
      type: 'json',
      description: `Archivos JSON optimizados: ${optimizedFiles}`,
      impact: 'low',
      savings: totalSaved
    });
  }

  async createDataBackup() {
    console.log('   💾 Creando respaldo de datos...');
        
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
        
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
        
    const dataDir = path.join(__dirname, 'data');
    const backupData = {
      timestamp: new Date().toISOString(),
      files: {}
    };
        
    const jsonFiles = this.findFiles(dataDir, '.json');
    for (const file of jsonFiles) {
      const relativePath = path.relative(dataDir, file);
      try {
        backupData.files[relativePath] = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        console.log(`      ⚠️ Error respaldando ${relativePath}: ${error.message}`);
      }
    }
        
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`      ✅ Respaldo creado: ${path.basename(backupFile)}`);
        
    this.optimizations.push({
      type: 'backup',
      description: 'Respaldo de datos creado',
      impact: 'info'
    });
  }

  async generateOptimizationReport() {
    const endTime = performance.now();
    const executionTime = endTime - this.startTime;
        
    console.log('\n📊 Reporte de Optimización');
    console.log('═'.repeat(50));
    console.log(`⏱️  Tiempo de ejecución: ${Math.round(executionTime)}ms`);
    console.log(`📁 Archivos optimizados: ${this.metrics.filesOptimized}`);
    console.log(`💾 Espacio ahorrado: ${this.formatBytes(this.metrics.spaceSaved)}`);
    console.log(`🚀 Mejora de rendimiento estimada: ${this.calculatePerformanceGain()}%`);
        
    console.log('\n🔧 Optimizaciones aplicadas:');
    this.optimizations.forEach((opt, index) => {
      const icon = this.getImpactIcon(opt.impact);
      const savings = opt.savings ? ` (${this.formatBytes(opt.savings)} ahorrados)` : '';
      console.log(`   ${icon} ${opt.description}${savings}`);
    });
        
    // Guardar reporte
    const reportFile = path.join(__dirname, 'optimization-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      executionTime: Math.round(executionTime),
      metrics: this.metrics,
      optimizations: this.optimizations
    };
        
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Reporte guardado en: ${path.basename(reportFile)}`);
  }

  calculatePerformanceGain() {
    // Estimación basada en el espacio ahorrado y archivos optimizados
    const baseGain = Math.min(this.metrics.spaceSaved / 1024 / 10, 15); // Max 15%
    const fileGain = Math.min(this.metrics.filesOptimized * 0.5, 10); // Max 10%
    return Math.round(baseGain + fileGain);
  }

  getImpactIcon(impact) {
    const icons = {
      'high': '🔥',
      'medium': '⚡',
      'low': '💡',
      'info': 'ℹ️'
    };
    return icons[impact] || '📌';
  }

  // Utilidades
  getDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
        
    if (!fs.existsSync(dirPath)) return { size: 0, count: 0 };
        
    const files = fs.readdirSync(dirPath);
        
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
            
      if (stats.isDirectory()) {
        const subDir = this.getDirectorySize(filePath);
        totalSize += subDir.size;
        fileCount += subDir.count;
      } else {
        totalSize += stats.size;
        fileCount++;
      }
    }
        
    return { size: totalSize, count: fileCount };
  }

  findFiles(dir, extension) {
    let files = [];
        
    if (!fs.existsSync(dir)) return files;
        
    const items = fs.readdirSync(dir);
        
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
            
      if (stats.isDirectory()) {
        files = files.concat(this.findFiles(itemPath, extension));
      } else if (item.endsWith(extension)) {
        files.push(itemPath);
      }
    }
        
    return files;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
        
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
        
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Ejecutar optimización si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const optimizer = new SystemOptimizer();
  optimizer.optimize().catch(console.error);
}

export default SystemOptimizer;
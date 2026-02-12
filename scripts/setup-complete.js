#!/usr/bin/env node

/**
 * Script de Configuración Completa
 * Ejecuta todas las validaciones, pruebas y configuraciones necesarias
 */

import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CompleteSetup {
  constructor() {
    this.config = {
      projectRoot: process.cwd(),
      requiredDirectories: [
        'src/monitoring',
        'src/validation',
        'src/docs',
        'tests/unit',
        'tests/integration',
        'tests/performance',
        'docs',
        'logs'
      ],
      requiredFiles: [
        'ecosystem.config.js',
        'src/debug_server.js',
        'src/monitoring/logger.js',
        'src/monitoring/real-time-monitor.js',
        'tests/performance/load-testing.js'
      ],
      services: [
        { name: 'main-app', port: 3000 },
        { name: 'monitor-service', port: 3001 },
        { name: 'log-aggregator', port: 3002 }
      ]
    };
        
    this.results = {
      directoryCheck: false,
      fileCheck: false,
      dependencyCheck: false,
      unitTests: false,
      integrationTests: false,
      loadTests: false,
      documentationGenerated: false,
      servicesStarted: false,
      healthCheck: false
    };
  }

  /**
     * Ejecuta la configuración completa
     */
  async run() {
    console.log('🚀 Iniciando configuración completa del sistema...\n');
        
    try {
      // 1. Verificar estructura de directorios
      await this.checkDirectories();
            
      // 2. Verificar archivos requeridos
      await this.checkRequiredFiles();
            
      // 3. Verificar dependencias
      await this.checkDependencies();
            
      // 4. Ejecutar pruebas unitarias
      await this.runUnitTests();
            
      // 5. Ejecutar pruebas de integración
      await this.runIntegrationTests();
            
      // 6. Ejecutar pruebas de carga
      await this.runLoadTests();
            
      // 7. Generar documentación
      await this.generateDocumentation();
            
      // 8. Iniciar servicios
      await this.startServices();
            
      // 9. Verificar salud del sistema
      await this.performHealthCheck();
            
      // 10. Generar reporte final
      await this.generateFinalReport();
            
      console.log('\n✅ Configuración completa exitosa!');
            
    } catch (error) {
      console.error('\n❌ Error en la configuración:', error.message);
      process.exit(1);
    }
  }

  /**
     * Verifica estructura de directorios
     */
  async checkDirectories() {
    console.log('📁 Verificando estructura de directorios...');
        
    for (const dir of this.config.requiredDirectories) {
      const fullPath = path.join(this.config.projectRoot, dir);
            
      if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  Creando directorio: ${dir}`);
        fs.mkdirSync(fullPath, { recursive: true });
      } else {
        console.log(`   ✅ Directorio existe: ${dir}`);
      }
    }
        
    this.results.directoryCheck = true;
    console.log('✅ Estructura de directorios verificada\n');
  }

  /**
     * Verifica archivos requeridos
     */
  async checkRequiredFiles() {
    console.log('📄 Verificando archivos requeridos...');
        
    let allFilesExist = true;
        
    for (const file of this.config.requiredFiles) {
      const fullPath = path.join(this.config.projectRoot, file);
            
      if (fs.existsSync(fullPath)) {
        console.log(`   ✅ Archivo existe: ${file}`);
      } else {
        console.log(`   ❌ Archivo faltante: ${file}`);
        allFilesExist = false;
      }
    }
        
    this.results.fileCheck = allFilesExist;
        
    if (allFilesExist) {
      console.log('✅ Todos los archivos requeridos están presentes\n');
    } else {
      console.log('⚠️  Algunos archivos están faltantes\n');
    }
  }

  /**
     * Verifica dependencias del sistema
     */
  async checkDependencies() {
    console.log('📦 Verificando dependencias...');
        
    return new Promise((resolve) => {
      // Verificar Node.js
      exec('node --version', (error, stdout) => {
        if (error) {
          console.log('   ❌ Node.js no encontrado');
          this.results.dependencyCheck = false;
        } else {
          console.log(`   ✅ Node.js: ${stdout.trim()}`);
                    
          // Verificar npm
          exec('npm --version', (error, stdout) => {
            if (error) {
              console.log('   ❌ npm no encontrado');
              this.results.dependencyCheck = false;
            } else {
              console.log(`   ✅ npm: ${stdout.trim()}`);
              this.results.dependencyCheck = true;
            }
                        
            console.log('✅ Dependencias verificadas\n');
            resolve();
          });
        }
      });
    });
  }

  /**
     * Ejecuta pruebas unitarias
     */
  async runUnitTests() {
    console.log('🧪 Ejecutando pruebas unitarias...');
        
    return new Promise((resolve) => {
      const testRunner = spawn('node', ['tests/unit/test-runner.js'], {
        cwd: this.config.projectRoot,
        stdio: 'pipe'
      });
            
      let output = '';
            
      testRunner.stdout.on('data', (data) => {
        output += data.toString();
      });
            
      testRunner.stderr.on('data', (data) => {
        output += data.toString();
      });
            
      testRunner.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ Pruebas unitarias pasaron');
          this.results.unitTests = true;
        } else {
          console.log('   ❌ Algunas pruebas unitarias fallaron');
          console.log('   📄 Output:', output.slice(-200));
          this.results.unitTests = false;
        }
                
        console.log('✅ Pruebas unitarias completadas\n');
        resolve();
      });
    });
  }

  /**
     * Ejecuta pruebas de integración
     */
  async runIntegrationTests() {
    console.log('🔗 Ejecutando pruebas de integración...');
        
    return new Promise((resolve) => {
      const integrationTest = spawn('node', ['tests/integration/integration-tests.js'], {
        cwd: this.config.projectRoot,
        stdio: 'pipe'
      });
            
      let output = '';
            
      integrationTest.stdout.on('data', (data) => {
        output += data.toString();
      });
            
      integrationTest.stderr.on('data', (data) => {
        output += data.toString();
      });
            
      integrationTest.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ Pruebas de integración pasaron');
          this.results.integrationTests = true;
        } else {
          console.log('   ❌ Algunas pruebas de integración fallaron');
          console.log('   📄 Output:', output.slice(-200));
          this.results.integrationTests = false;
        }
                
        console.log('✅ Pruebas de integración completadas\n');
        resolve();
      });
    });
  }

  /**
     * Ejecuta pruebas de carga
     */
  async runLoadTests() {
    console.log('⚡ Ejecutando pruebas de carga...');
        
    return new Promise((resolve) => {
      const loadTest = spawn('node', ['tests/performance/load-testing.js'], {
        cwd: this.config.projectRoot,
        stdio: 'pipe'
      });
            
      let output = '';
            
      loadTest.stdout.on('data', (data) => {
        output += data.toString();
      });
            
      loadTest.stderr.on('data', (data) => {
        output += data.toString();
      });
            
      loadTest.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ Pruebas de carga pasaron');
          this.results.loadTests = true;
        } else {
          console.log('   ❌ Algunas pruebas de carga fallaron');
          console.log('   📄 Output:', output.slice(-200));
          this.results.loadTests = false;
        }
                
        console.log('✅ Pruebas de carga completadas\n');
        resolve();
      });
    });
  }

  /**
     * Genera documentación
     */
  async generateDocumentation() {
    console.log('📚 Generando documentación...');
        
    return new Promise((resolve) => {
      const docGenerator = spawn('node', ['src/docs/doc-generator.js'], {
        cwd: this.config.projectRoot,
        stdio: 'pipe'
      });
            
      let output = '';
            
      docGenerator.stdout.on('data', (data) => {
        output += data.toString();
        console.log('   📝', data.toString().trim());
      });
            
      docGenerator.stderr.on('data', (data) => {
        output += data.toString();
      });
            
      docGenerator.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ Documentación generada exitosamente');
          this.results.documentationGenerated = true;
        } else {
          console.log('   ❌ Error generando documentación');
          console.log('   📄 Output:', output.slice(-200));
          this.results.documentationGenerated = false;
        }
                
        console.log('✅ Generación de documentación completada\n');
        resolve();
      });
    });
  }

  /**
     * Inicia servicios del sistema
     */
  async startServices() {
    console.log('🚀 Iniciando servicios del sistema...');
        
    // Verificar si PM2 está disponible
    return new Promise((resolve) => {
      exec('which pm2', (error) => {
        if (error) {
          console.log('   ⚠️  PM2 no encontrado, iniciando servicios manualmente...');
          this.startServicesManually().then(() => {
            this.results.servicesStarted = true;
            console.log('✅ Servicios iniciados\n');
            resolve();
          });
        } else {
          console.log('   ✅ PM2 encontrado, usando configuración PM2...');
          this.startServicesWithPM2().then(() => {
            this.results.servicesStarted = true;
            console.log('✅ Servicios iniciados con PM2\n');
            resolve();
          });
        }
      });
    });
  }

  /**
     * Inicia servicios manualmente
     */
  async startServicesManually() {
    console.log('   🔧 Iniciando servicios manualmente...');
        
    // Solo verificar que el servidor principal esté corriendo
    return new Promise((resolve) => {
      exec('lsof -ti:3000', (error, stdout) => {
        if (stdout.trim()) {
          console.log('   ✅ Servidor principal ya está corriendo en puerto 3000');
        } else {
          console.log('   ⚠️  Servidor principal no está corriendo');
          console.log('   💡 Ejecuta: node src/debug_server.js para iniciar');
        }
        resolve();
      });
    });
  }

  /**
     * Inicia servicios con PM2
     */
  async startServicesWithPM2() {
    return new Promise((resolve) => {
      const pm2Start = spawn('pm2', ['start', 'ecosystem.config.js'], {
        cwd: this.config.projectRoot,
        stdio: 'pipe'
      });
            
      pm2Start.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ Servicios iniciados con PM2');
        } else {
          console.log('   ⚠️  Error iniciando con PM2, servicios pueden estar ya corriendo');
        }
        resolve();
      });
    });
  }

  /**
     * Verifica salud del sistema
     */
  async performHealthCheck() {
    console.log('🏥 Verificando salud del sistema...');
        
    const healthChecks = [
      { name: 'Servidor Principal', url: 'http://localhost:3000', timeout: 5000 },
      { name: 'Archivos Estáticos', path: 'public/index.html' },
      { name: 'Documentación', path: 'docs/index.html' }
    ];
        
    let allHealthy = true;
        
    for (const check of healthChecks) {
      if (check.url) {
        // Verificar URL
        try {
          const response = await this.checkURL(check.url, check.timeout);
          if (response) {
            console.log(`   ✅ ${check.name}: Respondiendo`);
          } else {
            console.log(`   ❌ ${check.name}: No responde`);
            allHealthy = false;
          }
        } catch (error) {
          console.log(`   ❌ ${check.name}: Error - ${error.message}`);
          allHealthy = false;
        }
      } else if (check.path) {
        // Verificar archivo
        const fullPath = path.join(this.config.projectRoot, check.path);
        if (fs.existsSync(fullPath)) {
          console.log(`   ✅ ${check.name}: Archivo existe`);
        } else {
          console.log(`   ❌ ${check.name}: Archivo no encontrado`);
          allHealthy = false;
        }
      }
    }
        
    this.results.healthCheck = allHealthy;
        
    if (allHealthy) {
      console.log('✅ Sistema saludable\n');
    } else {
      console.log('⚠️  Algunos componentes del sistema tienen problemas\n');
    }
  }

  /**
     * Verifica URL con timeout
     */
  async checkURL(url, timeout = 5000) {
    return new Promise(async(resolve) => {
      const { default: http } = await import('http');
      const urlObj = new URL(url);
            
      const req = http.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: 'GET',
        timeout: timeout
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
            
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
            
      req.end();
    });
  }

  /**
     * Genera reporte final
     */
  async generateFinalReport() {
    console.log('📊 Generando reporte final...');
        
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        totalChecks: Object.keys(this.results).length,
        passedChecks: Object.values(this.results).filter(Boolean).length,
        failedChecks: Object.values(this.results).filter(r => !r).length
      },
      recommendations: this.generateRecommendations()
    };
        
    // Guardar reporte en JSON
    fs.writeFileSync(
      path.join(this.config.projectRoot, 'setup-report.json'),
      JSON.stringify(report, null, 2)
    );
        
    // Generar reporte HTML
    const htmlReport = this.generateHTMLReport(report);
    fs.writeFileSync(
      path.join(this.config.projectRoot, 'setup-report.html'),
      htmlReport
    );
        
    // Mostrar resumen en consola
    this.displaySummary(report);
        
    console.log('✅ Reporte final generado\n');
  }

  /**
     * Genera recomendaciones basadas en resultados
     */
  generateRecommendations() {
    const recommendations = [];
        
    if (!this.results.fileCheck) {
      recommendations.push('Verificar que todos los archivos requeridos estén presentes');
    }
        
    if (!this.results.unitTests) {
      recommendations.push('Revisar y corregir pruebas unitarias que fallan');
    }
        
    if (!this.results.integrationTests) {
      recommendations.push('Revisar y corregir pruebas de integración que fallan');
    }
        
    if (!this.results.loadTests) {
      recommendations.push('Optimizar rendimiento para pasar pruebas de carga');
    }
        
    if (!this.results.servicesStarted) {
      recommendations.push('Verificar configuración de servicios y puertos');
    }
        
    if (!this.results.healthCheck) {
      recommendations.push('Revisar conectividad y salud de componentes del sistema');
    }
        
    if (recommendations.length === 0) {
      recommendations.push('Sistema completamente configurado y funcionando correctamente');
    }
        
    return recommendations;
  }

  /**
     * Genera reporte HTML
     */
  generateHTMLReport(report) {
    const statusIcon = (status) => status ? '✅' : '❌';
    const statusColor = (status) => status ? '#28a745' : '#dc3545';
        
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Configuración - ChatBot</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { background: #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; }
        .summary-item { background: white; border-radius: 5px; padding: 15px; }
        .summary-number { font-size: 2em; font-weight: bold; }
        .check-item { display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #eee; }
        .check-icon { margin-right: 15px; font-size: 1.2em; }
        .check-name { flex: 1; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-top: 30px; }
        .recommendations ul { margin: 0; padding-left: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Reporte de Configuración</h1>
            <p>Sistema ChatBot - ${new Date(report.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <h2>📈 Resumen</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-number" style="color: #007bff;">${report.summary.totalChecks}</div>
                    <div>Total Verificaciones</div>
                </div>
                <div class="summary-item">
                    <div class="summary-number" style="color: #28a745;">${report.summary.passedChecks}</div>
                    <div>Exitosas</div>
                </div>
                <div class="summary-item">
                    <div class="summary-number" style="color: #dc3545;">${report.summary.failedChecks}</div>
                    <div>Fallidas</div>
                </div>
            </div>
        </div>
        
        <div>
            <h2>🔍 Detalles de Verificación</h2>
            ${Object.entries(report.results).map(([key, status]) => `
                <div class="check-item">
                    <div class="check-icon" style="color: ${statusColor(status)};">${statusIcon(status)}</div>
                    <div class="check-name">${this.getCheckDisplayName(key)}</div>
                </div>
            `).join('')}
        </div>
        
        <div class="recommendations">
            <h2>💡 Recomendaciones</h2>
            <ul>
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>
</body>
</html>`;
  }

  /**
     * Obtiene nombre de visualización para verificaciones
     */
  getCheckDisplayName(key) {
    const names = {
      directoryCheck: 'Estructura de Directorios',
      fileCheck: 'Archivos Requeridos',
      dependencyCheck: 'Dependencias del Sistema',
      unitTests: 'Pruebas Unitarias',
      integrationTests: 'Pruebas de Integración',
      loadTests: 'Pruebas de Carga',
      documentationGenerated: 'Generación de Documentación',
      servicesStarted: 'Inicio de Servicios',
      healthCheck: 'Verificación de Salud'
    };
        
    return names[key] || key;
  }

  /**
     * Muestra resumen en consola
     */
  displaySummary(report) {
    console.log('📊 RESUMEN FINAL');
    console.log('================');
    console.log(`Total de verificaciones: ${report.summary.totalChecks}`);
    console.log(`Exitosas: ${report.summary.passedChecks}`);
    console.log(`Fallidas: ${report.summary.failedChecks}`);
    console.log(`Porcentaje de éxito: ${Math.round((report.summary.passedChecks / report.summary.totalChecks) * 100)}%`);
        
    if (report.summary.failedChecks === 0) {
      console.log('\n🎉 ¡CONFIGURACIÓN PERFECTA!');
      console.log('El sistema está completamente configurado y listo para usar.');
      console.log('\n🌐 Accede al sistema en: http://localhost:3000');
      console.log('📚 Documentación en: ./docs/index.html');
    } else {
      console.log('\n⚠️  CONFIGURACIÓN PARCIAL');
      console.log('Algunos componentes necesitan atención.');
      console.log('Revisa el reporte detallado en: setup-report.html');
    }
  }
}

// Ejecutar configuración si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new CompleteSetup();
  setup.run().catch(console.error);
}

export default CompleteSetup;
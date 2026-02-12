#!/usr/bin/env node

/**
 * Script de Diagnóstico de URLs
 * Verifica todas las URLs del sistema para detectar problemas de navegación
 */

import http from 'http';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class URLDiagnostics {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
    
    // URLs principales a verificar
    this.urlsToTest = [
      '/',
      '/index.html',
      '/dashboard.html',
      '/ai-admin-dashboard.html',
      '/flows.html',
      '/integrations.html',
      '/templates.html',
      '/visual-flow-builder.html',
      '/health',
      '/api/status',
      '/api/health',
      '/api/data/contacts'
    ];
    
    // URLs de navegación interna (hash-based)
    this.hashUrls = [
      '#dashboard',
      '#flows',
      '#integrations',
      '#templates',
      '#analytics',
      '#configuration',
      '#tags'
    ];
  }

  async checkUrl(url) {
    return new Promise((resolve) => {
      try {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
        console.log(`🔍 Verificando: ${fullUrl}`);
        
        const urlObj = new URL(fullUrl);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': 'URL-Diagnostics/1.0'
          },
          timeout: 5000
        };

        const req = client.request(options, (res) => {
          const result = {
            url: fullUrl,
            status: res.statusCode,
            statusText: res.statusMessage,
            contentType: res.headers['content-type'],
            contentLength: res.headers['content-length'],
            timestamp: new Date().toISOString()
          };

          if (res.statusCode >= 200 && res.statusCode < 400) {
            this.results.passed.push(result);
            console.log(`✅ OK: ${fullUrl} (${res.statusCode})`);
          } else {
            this.results.failed.push(result);
            console.log(`❌ FAIL: ${fullUrl} (${res.statusCode} ${res.statusMessage})`);
          }

          resolve(result);
        });

        req.on('error', (error) => {
          const result = {
            url: fullUrl,
            error: error.message,
            timestamp: new Date().toISOString()
          };
          
          this.results.failed.push(result);
          console.log(`❌ ERROR: ${fullUrl} - ${error.message}`);
          resolve(result);
        });

        req.on('timeout', () => {
          req.destroy();
          const result = {
            url: fullUrl,
            error: 'Request timeout',
            timestamp: new Date().toISOString()
          };
          
          this.results.failed.push(result);
          console.log(`❌ TIMEOUT: ${fullUrl}`);
          resolve(result);
        });

        req.end();
      } catch (error) {
        const result = {
          url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        this.results.failed.push(result);
        console.log(`❌ ERROR: ${result.url} - ${error.message}`);
        resolve(result);
      }
    });
  }

  async checkStaticFiles() {
    console.log('\n📁 Verificando archivos estáticos...');
    
    const staticFiles = [
      '/css/styles.css',
      '/css/dashboard.css',
      '/css/flow-builder-enhanced.css',
      '/js/app.js',
      
      '/js/navigation-config.js',

    ];

    for (const file of staticFiles) {
      await this.checkUrl(file);
    }
  }

  async checkAPIEndpoints() {
    console.log('\n🔌 Verificando endpoints de API...');
    
    const apiEndpoints = [
      '/api/health',
      '/api/status',
      '/api/data/contacts',
      '/api/flows',
      '/api/templates',
      '/api/integrations'
    ];

    for (const endpoint of apiEndpoints) {
      await this.checkUrl(endpoint);
    }
  }

  async scanForMalformedUrls() {
    console.log('\n🔍 Escaneando archivos en busca de URLs malformadas...');
    
    const publicDir = path.join(__dirname, '../public');
    const patterns = [
      /http:\/\/tp\/\//g,
      /http:\/\/ttp\/\//g,
      /https:\/\/tp\/\//g,
      /https:\/\/ttp\/\//g,
      /http:\/\/.*\/\/.*\//g
    ];

    try {
      const files = await this.scanDirectory(publicDir, ['.html', '.js', '.css']);
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          
          for (const pattern of patterns) {
            const matches = content.match(pattern);
            if (matches) {
              this.results.warnings.push({
                file: file.replace(publicDir, ''),
                pattern: pattern.toString(),
                matches: matches,
                timestamp: new Date().toISOString()
              });
              console.log(`⚠️  URLs malformadas encontradas en ${file}: ${matches.join(', ')}`);
            }
          }
        } catch (error) {
          console.log(`❌ Error leyendo ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error escaneando directorio: ${error.message}`);
    }
  }

  async scanDirectory(dir, extensions) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath, extensions);
          files.push(...subFiles);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.log(`❌ Error accediendo al directorio ${dir}: ${error.message}`);
    }
    
    return files;
  }

  async generateReport() {
    const report = {
      summary: {
        total: this.results.passed.length + this.results.failed.length,
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        warnings: this.results.warnings.length,
        timestamp: new Date().toISOString()
      },
      results: this.results
    };

    const reportPath = path.join(__dirname, '../reports/url-diagnostics-report.json');
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📊 Reporte guardado en: ${reportPath}`);
    } catch (error) {
      console.log(`❌ Error guardando reporte: ${error.message}`);
    }

    return report;
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DEL DIAGNÓSTICO DE URLs');
    console.log('='.repeat(60));
    console.log(`✅ URLs funcionando: ${this.results.passed.length}`);
    console.log(`❌ URLs con problemas: ${this.results.failed.length}`);
    console.log(`⚠️  Advertencias: ${this.results.warnings.length}`);
    
    if (this.results.failed.length > 0) {
      console.log('\n❌ URLs con problemas:');
      this.results.failed.forEach(result => {
        console.log(`   • ${result.url} - ${result.error || result.statusText}`);
      });
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Advertencias:');
      this.results.warnings.forEach(warning => {
        console.log(`   • ${warning.file}: ${warning.matches.join(', ')}`);
      });
    }
    
    console.log('='.repeat(60));
  }

  async run() {
    console.log('🚀 Iniciando diagnóstico de URLs...\n');
    
    // Verificar URLs principales
    console.log('🌐 Verificando URLs principales...');
    for (const url of this.urlsToTest) {
      await this.checkUrl(url);
    }
    
    // Verificar archivos estáticos
    await this.checkStaticFiles();
    
    // Verificar endpoints de API
    await this.checkAPIEndpoints();
    
    // Escanear por URLs malformadas
    await this.scanForMalformedUrls();
    
    // Generar reporte
    await this.generateReport();
    
    // Mostrar resumen
    this.printSummary();
    
    // Retornar código de salida apropiado
    return this.results.failed.length === 0 ? 0 : 1;
  }
}

// Ejecutar diagnóstico si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const diagnostics = new URLDiagnostics();
  diagnostics.run()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Error ejecutando diagnóstico:', error);
      process.exit(1);
    });
}

export default URLDiagnostics;
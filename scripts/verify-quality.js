#!/usr/bin/env node

/**
 * Script de verificación de umbrales de calidad para CI/CD
 * Verifica cobertura de código, calidad de pruebas y otros métricas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class QualityVerifier {
  constructor() {
    this.thresholds = this.loadThresholds();
    this.results = {
      coverage: null,
      testQuality: null,
      performance: null,
      overall: false
    };
  }

  loadThresholds() {
    try {
      const thresholdsPath = path.join(__dirname, '../.github/quality-thresholds.json');
      return JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'));
    } catch (error) {
      console.error('❌ Error loading quality thresholds:', error.message);
      process.exit(1);
    }
  }

  async verifyCoverage() {
    console.log('🔍 Verificando cobertura de código...');
    
    try {
      const coveragePath = path.join(process.cwd(), 'coverage/coverage-summary.json');
      
      if (!fs.existsSync(coveragePath)) {
        console.log('⚠️  Archivo de cobertura no encontrado');
        return false;
      }

      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const coverage = coverageData.total;
      
      console.log('\\n=== VERIFICACIÓN DE COBERTURA ===');
      
      let passed = true;
      Object.keys(this.thresholds.coverage).forEach(metric => {
        const actual = coverage[metric]?.pct || 0;
        const required = this.thresholds.coverage[metric];
        const metricPassed = actual >= required;
        
        console.log(`${metric.padEnd(12)}: ${actual.toFixed(1)}% ${metricPassed ? '✅' : '❌'} (requerido: ${required}%)`);
        
        if (!metricPassed) {
          passed = false;
        }
      });

      this.results.coverage = passed;
      return passed;
    } catch (error) {
      console.error('❌ Error verificando cobertura:', error.message);
      return false;
    }
  }

  async verifyTestQuality() {
    console.log('\\n🧪 Verificando calidad de pruebas...');
    
    try {
      // Buscar archivos de puntuación de pruebas
      const scoreFiles = this.findScoreFiles(process.cwd());
      
      if (scoreFiles.length === 0) {
        console.log('⚠️  No se encontraron archivos de puntuación');
        return false;
      }

      let totalScore = 0;
      let totalTests = 0;
      let passedTests = 0;
      let totalDuration = 0;

      scoreFiles.forEach(file => {
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (data.summary) {
            totalScore += data.summary.overallScore || 0;
            totalTests += data.summary.totalTests || 0;
            passedTests += data.summary.passedTests || 0;
            totalDuration += data.summary.averageExecutionTime || 0;
          }
        } catch (e) {
          console.log(`⚠️  Error leyendo archivo de puntuación: ${file}`);
        }
      });

      console.log('\\n=== VERIFICACIÓN DE CALIDAD DE PRUEBAS ===');
      
      const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
      const avgDuration = totalTests > 0 ? totalDuration / totalTests : 0;
      
      // Verificar umbrales
      const passRatePassed = passRate >= this.thresholds.testQuality.passRate;
      const scorePassed = totalScore >= this.thresholds.testQuality.minimumScore;
      const testCountPassed = totalTests >= this.thresholds.testQuality.minimumTests;
      const durationPassed = avgDuration <= this.thresholds.performance.maxTestDuration;
      
      console.log(`Pruebas totales    : ${totalTests} ${testCountPassed ? '✅' : '❌'} (mínimo: ${this.thresholds.testQuality.minimumTests})`);
      console.log(`Pruebas pasadas    : ${passedTests}/${totalTests}`);
      console.log(`Tasa de éxito      : ${passRate.toFixed(1)}% ${passRatePassed ? '✅' : '❌'} (mínimo: ${this.thresholds.testQuality.passRate}%)`);
      console.log(`Puntuación total   : ${totalScore} ${scorePassed ? '✅' : '❌'} (mínimo: ${this.thresholds.testQuality.minimumScore})`);
      console.log(`Duración promedio  : ${avgDuration.toFixed(0)}ms ${durationPassed ? '✅' : '❌'} (máximo: ${this.thresholds.performance.maxTestDuration}ms)`);

      const passed = passRatePassed && scorePassed && testCountPassed && durationPassed;
      this.results.testQuality = passed;
      
      // Guardar resumen para CI
      const summary = {
        totalTests,
        passedTests,
        totalScore,
        passRate: passRate.toFixed(2),
        avgDuration: avgDuration.toFixed(0),
        thresholdsPassed: passed
      };
      
      fs.writeFileSync('test-quality-summary.json', JSON.stringify(summary, null, 2));
      
      return passed;
    } catch (error) {
      console.error('❌ Error verificando calidad de pruebas:', error.message);
      return false;
    }
  }

  findScoreFiles(dir) {
    const scoreFiles = [];
    
    function searchRecursive(currentDir) {
      try {
        const files = fs.readdirSync(currentDir);
        files.forEach(file => {
          const fullPath = path.join(currentDir, file);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            searchRecursive(fullPath);
          } else if (file.includes('test-scores') && file.endsWith('.json')) {
            scoreFiles.push(fullPath);
          }
        });
      } catch (error) {
        // Ignorar directorios sin permisos
      }
    }
    
    searchRecursive(dir);
    return scoreFiles;
  }

  async generateReport() {
    console.log('\\n📊 Generando reporte de calidad...');
    
    const report = {
      timestamp: new Date().toISOString(),
      thresholds: this.thresholds,
      results: this.results,
      overall: this.results.coverage && this.results.testQuality,
      summary: {
        passed: this.results.coverage && this.results.testQuality,
        coverage: this.results.coverage ? 'PASSED' : 'FAILED',
        testQuality: this.results.testQuality ? 'PASSED' : 'FAILED'
      }
    };

    fs.writeFileSync('quality-report.json', JSON.stringify(report, null, 2));
    
    console.log('\\n=== RESUMEN FINAL ===');
    console.log(`Cobertura de código: ${report.summary.coverage}`);
    console.log(`Calidad de pruebas : ${report.summary.testQuality}`);
    console.log(`Estado general     : ${report.summary.passed ? '✅ APROBADO' : '❌ RECHAZADO'}`);
    
    return report.summary.passed;
  }

  async run() {
    console.log('🚀 Iniciando verificación de calidad...');
    
    try {
      const coveragePassed = await this.verifyCoverage();
      const testQualityPassed = await this.verifyTestQuality();
      const overallPassed = await this.generateReport();
      
      if (!overallPassed) {
        console.log('\\n❌ Los umbrales de calidad no se cumplieron');
        process.exit(1);
      } else {
        console.log('\\n✅ Todos los umbrales de calidad se cumplieron');
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Error durante la verificación:', error.message);
      process.exit(1);
    }
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new QualityVerifier();
  verifier.run();
}

export default QualityVerifier;
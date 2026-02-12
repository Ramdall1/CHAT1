#!/usr/bin/env node

/**
 * Script para simular el pipeline CI/CD localmente
 * Ejecuta las mismas verificaciones que se ejecutan en CI/CD
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class LocalCI {
    constructor() {
        this.results = {
            lint: false,
            format: false,
            security: false,
            tests: false,
            coverage: false,
            build: false
        };
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            error: '\x1b[31m',
            warning: '\x1b[33m',
            reset: '\x1b[0m'
        };
        
        const icons = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };

        console.log(`${colors[type]}${icons[type]} ${message}${colors.reset}`);
    }

    async runCommand(command, description, required = true) {
        this.log(`Ejecutando: ${description}`, 'info');
        
        try {
            const result = execSync(command, { 
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            this.log(`${description} - EXITOSO`, 'success');
            return { success: true, output: result };
        } catch (error) {
            if (required) {
                this.log(`${description} - FALLÓ`, 'error');
                console.log(error.stdout || error.message);
                return { success: false, output: error.stdout || error.message };
            } else {
                this.log(`${description} - FALLÓ (no crítico)`, 'warning');
                return { success: false, output: error.stdout || error.message };
            }
        }
    }

    async checkLinting() {
        this.log('🔍 Verificando linting...', 'info');
        const result = await this.runCommand('npm run lint', 'Linting de código', false);
        this.results.lint = result.success;
        return result.success;
    }

    async checkFormatting() {
        this.log('📝 Verificando formato de código...', 'info');
        const result = await this.runCommand('npm run format:check', 'Verificación de formato', false);
        this.results.format = result.success;
        return result.success;
    }

    async runSecurityAudit() {
        this.log('🔒 Ejecutando auditoría de seguridad...', 'info');
        const result = await this.runCommand('npm audit --audit-level moderate', 'Auditoría de seguridad', false);
        this.results.security = result.success;
        return result.success;
    }

    async runTests() {
        this.log('🧪 Ejecutando pruebas...', 'info');
        const result = await this.runCommand(
            'NODE_OPTIONS=--experimental-vm-modules npx jest tests/basic.test.js tests/system.test.js tests/core/ChatBot.test.js',
            'Pruebas unitarias',
            true
        );
        this.results.tests = result.success;
        return result.success;
    }

    async generateCoverage() {
        this.log('📊 Generando reporte de cobertura...', 'info');
        const result = await this.runCommand('node scripts/coverage-report.js', 'Reporte de cobertura', false);
        this.results.coverage = result.success;
        return result.success;
    }

    async runBuild() {
        this.log('🏗️ Ejecutando build...', 'info');
        const result = await this.runCommand('npm run build', 'Build del proyecto', false);
        this.results.build = result.success;
        return result.success;
    }

    generateReport() {
        this.log('\n📋 RESUMEN DE VERIFICACIONES:', 'info');
        
        const checks = [
            { name: 'Linting', status: this.results.lint },
            { name: 'Formato', status: this.results.format },
            { name: 'Seguridad', status: this.results.security },
            { name: 'Pruebas', status: this.results.tests },
            { name: 'Cobertura', status: this.results.coverage },
            { name: 'Build', status: this.results.build }
        ];

        checks.forEach(check => {
            const status = check.status ? 'EXITOSO' : 'FALLÓ';
            const type = check.status ? 'success' : 'error';
            this.log(`${check.name}: ${status}`, type);
        });

        const passedChecks = checks.filter(check => check.status).length;
        const totalChecks = checks.length;
        
        this.log(`\n🎯 Resultado: ${passedChecks}/${totalChecks} verificaciones exitosas`, 
                 passedChecks === totalChecks ? 'success' : 'warning');

        if (passedChecks === totalChecks) {
            this.log('🚀 ¡Listo para CI/CD!', 'success');
        } else {
            this.log('⚠️ Hay verificaciones que necesitan atención antes del CI/CD', 'warning');
        }

        // Generar reporte en archivo
        const report = {
            timestamp: new Date().toISOString(),
            results: this.results,
            summary: {
                passed: passedChecks,
                total: totalChecks,
                percentage: Math.round((passedChecks / totalChecks) * 100)
            }
        };

        if (!fs.existsSync('reports')) {
            fs.mkdirSync('reports', { recursive: true });
        }

        fs.writeFileSync('reports/local-ci-report.json', JSON.stringify(report, null, 2));
        this.log('📄 Reporte guardado en: reports/local-ci-report.json', 'info');
    }

    async run() {
        this.log('🚀 Iniciando verificaciones CI/CD locales...\n', 'info');

        // Ejecutar verificaciones en orden
        await this.checkLinting();
        await this.checkFormatting();
        await this.runSecurityAudit();
        await this.runTests();
        await this.generateCoverage();
        await this.runBuild();

        // Generar reporte final
        this.generateReport();
    }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    const ci = new LocalCI();
    ci.run().catch(console.error);
}

export default LocalCI;